import dns from "dns";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

// Force IPv4 DNS resolution to avoid IPv6 connectivity issues
dns.setDefaultResultOrder("ipv4first");

// ─── Custom fetch using undici with public DNS resolver ───────────────────────
// Some hosting environments (e.g., DigitalOcean App Platform ATL1) block DNS
// resolution for *.supabase.co. We use undici with a custom DNS lookup that
// queries Google/Cloudflare DNS (8.8.8.8, 1.1.1.1) directly.
let _customFetch: typeof fetch | null = null;

async function getCustomFetch(): Promise<typeof fetch> {
  if (_customFetch) return _customFetch;
  
  try {
    const { fetch: undiciFetch, Agent } = await import('undici');
    const dnsResolver = new dns.Resolver();
    dnsResolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
    
    // Cache for resolved IPs to avoid repeated DNS lookups
    const dnsCache = new Map<string, { address: string; expires: number }>();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agent = new Agent({
      connect: {
        lookup: (hostname: string, _options: unknown, callback: (...args: any[]) => void) => {
          const cached = dnsCache.get(hostname);
          if (cached && cached.expires > Date.now()) {
            return callback(null, [{ address: cached.address, family: 4 }]);
          }
          dnsResolver.resolve4(hostname, (err, addresses) => {
            if (err) {
              // Fallback to system DNS
              return callback(err);
            }
            const address = addresses[0];
            dnsCache.set(hostname, { address, expires: Date.now() + 60000 }); // Cache for 1 minute
            callback(null, [{ address, family: 4 }]);
          });
        }
      }
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _customFetch = (url: any, init?: any): Promise<Response> => {
      return undiciFetch(url, { ...init, dispatcher: agent }) as unknown as Promise<Response>;
    };
    console.log('[Database] Custom fetch with public DNS resolver initialized');
  } catch (e) {
    // Fallback to native fetch if undici is not available
    console.log('[Database] undici not available, using native fetch');
    _customFetch = fetch;
  }
  
  return _customFetch!;
}

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;
let _supabase: SupabaseClient | null = null;
let _dbInitialized = false;
let _supabaseInitializing = false;
let _supabaseInitialized = false;

// Supabase JS client (connects via HTTPS REST with custom DNS resolver)
export async function getSupabaseClientAsync(): Promise<SupabaseClient | null> {
  if (_supabase) return _supabase;
  if (_supabaseInitialized) return null;
  if (_supabaseInitializing) {
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    return _supabase;
  }
  
  _supabaseInitializing = true;
  const url = ENV.supabaseUrl || process.env.SUPABASE_URL;
  const key = ENV.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (url && key) {
    const customFetch = await getCustomFetch();
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: customFetch },
    });
    console.log("[Database] Supabase REST client initialized with custom DNS fetch");
  }
  
  _supabaseInitialized = true;
  _supabaseInitializing = false;
  return _supabase;
}

// Synchronous version for backward compatibility (returns cached client or null)
export function getSupabaseClient(): SupabaseClient | null {
  return _supabase;
}

// Use PostgreSQL direct connection (DATABASE_URL) as primary database.
// Falls back to Supabase REST API if DATABASE_URL is not available or unreachable.
export async function getDb(): Promise<ReturnType<typeof drizzle> | null> {
  if (_db) return _db;
  if (_dbInitialized) return null;
  _dbInitialized = true;

  const dbUrl = ENV.databaseUrl || process.env.DATABASE_URL;
  if (!dbUrl || (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://'))) {
    console.log('[Database] No PostgreSQL DATABASE_URL found, using Supabase REST API');
    return null;
  }

  // Check if this is a Supabase-hosted PostgreSQL URL (*.supabase.co)
  // On some hosting environments (e.g., DigitalOcean ATL1), the Supabase PostgreSQL
  // hostname does not resolve via system DNS. In that case, skip direct connection
  // and use the Supabase REST API (which works via undici with public DNS).
  try {
    const urlObj = new URL(dbUrl);
    const hostname = urlObj.hostname;
    if (hostname.includes('supabase.co') || hostname.includes('supabase.com')) {
      // Test DNS resolution via public DNS resolver
      const canResolve = await new Promise<boolean>((resolve) => {
        const testResolver = new dns.Resolver();
        testResolver.setServers(['8.8.8.8', '1.1.1.1']);
        testResolver.resolve4(hostname, (err) => resolve(!err));
      });
      if (!canResolve) {
        console.log('[Database] Supabase PostgreSQL hostname not resolvable via public DNS, using REST API');
        _dbInitialized = true; // Mark as initialized to avoid retrying on every request
        return null;
      }
    }
  } catch (_) { /* ignore URL parse errors */ }

  try {
    _client = postgres(dbUrl, {
      ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    _db = drizzle(_client);
    console.log('[Database] PostgreSQL direct connection initialized');
    return _db;
  } catch (err) {
    console.error('[Database] PostgreSQL connection failed:', (err as Error).message);
    _dbInitialized = false;
    return null;
  }
}

// Reset connection state (useful for reconnect after errors)
export function resetDb() {
  _dbInitialized = false;
  _db = null;
  try { _client?.end(); } catch (_) {}
  _client = null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();

  if (db) {
    try {
      const values: InsertUser = { openId: user.openId };
      const updateSet: Record<string, unknown> = {};
      const textFields = ["name", "email", "loginMethod"] as const;
      type TextField = (typeof textFields)[number];
      const assignNullable = (field: TextField) => {
        const value = user[field];
        if (value === undefined) return;
        values[field] = value;
        updateSet[field] = value;
      };
      textFields.forEach(assignNullable);
      if (user.role !== undefined) {
        values.role = user.role;
        updateSet.role = user.role;
      }
      updateSet.updatedAt = new Date();
      await db.insert(users).values(values).onConflictDoUpdate({
        target: users.openId,
        set: updateSet,
      });
      return;
    } catch (err) {
      console.error('[Database] Drizzle upsertUser failed, trying REST:', (err as Error).message);
    }
  }

  // Fallback to Supabase REST
  const supabase = await getSupabaseClientAsync();
  if (!supabase) throw new Error("No database connection available");

  const { error } = await supabase.from('users').upsert({
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    role: user.role,
    updatedAt: new Date().toISOString(),
  }, { onConflict: 'openId' });

  if (error) throw new Error(`Supabase upsertUser failed: ${error.message}`);
}

export async function findUserByEmail(email: string) {
  const db = await getDb();

  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0] || null;
    } catch (err) {
      console.error('[Auth] Drizzle findUserByEmail failed, trying REST:', (err as Error).message);
      console.error('[Auth] Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    }
  }

  // Fallback to Supabase REST
  const supabase = await getSupabaseClientAsync();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .limit(1);

  console.log(`[Auth] Supabase findUserByEmail - data: ${data ? 'found' : 'null'} error: ${error ? error.message || JSON.stringify(error) : 'none'}`);
  if (error) return null;
  return data?.[0] || null;
}

// Alias for backward compatibility with sdk.ts
export const getUserByOpenId = findUserByOpenId;

export async function findUserByOpenId(openId: string) {
  const db = await getDb();

  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      return result[0] || null;
    } catch (err) {
      console.error('[Database] Drizzle findUserByOpenId failed:', (err as Error).message);
    }
  }

  const supabase = await getSupabaseClientAsync();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('openId', openId)
    .limit(1);

  if (error) return null;
  return data?.[0] || null;
}

export async function updateUserLastSignedIn(openId: string): Promise<void> {
  const db = await getDb();

  if (db) {
    try {
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.openId, openId));
      return;
    } catch (err) {
      console.error('[Database] Drizzle updateUserLastSignedIn failed:', (err as Error).message);
    }
  }

  const supabase = await getSupabaseClientAsync();
  if (!supabase) return;

  await supabase.from('users').update({ lastSignedIn: new Date().toISOString() }).eq('openId', openId);
}

export async function findUserById(id: number) {
  const db = await getDb();

  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0] || null;
    } catch (err) {
      console.error('[Database] Drizzle findUserById failed:', (err as Error).message);
    }
  }

  const supabase = await getSupabaseClientAsync();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) return null;
  return data?.[0] || null;
}

export async function getUserCount(): Promise<number> {
  const db = await getDb();

  if (db) {
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(users);
      return Number(result[0]?.count || 0);
    } catch (err) {
      console.error('[Database] Drizzle getUserCount failed:', (err as Error).message);
    }
  }

  const supabase = await getSupabaseClientAsync();
  if (!supabase) return 0;

  const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}
