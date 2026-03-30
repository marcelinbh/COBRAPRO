import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;
let _supabase: SupabaseClient | null = null;
let _dbInitialized = false;

// Supabase JS client (connects via HTTPS REST - works everywhere, no TCP issues)
export function getSupabaseClient(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = ENV.supabaseUrl || process.env.SUPABASE_URL;
  const key = ENV.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log("[Database] Supabase REST client initialized");
  }
  return _supabase;
}

// Lazily create the drizzle instance. Tries direct PostgreSQL first.
// Falls back to null (callers then use Supabase REST API via getSupabaseClient).
export async function getDb() {
  if (_dbInitialized) return _db;
  _dbInitialized = true;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("[Database] DATABASE_URL not set, using Supabase REST API");
    return null;
  }

  try {
    _client = postgres(dbUrl, {
      max: 5,
      ssl: 'require',
      connect_timeout: 8,
      idle_timeout: 20,
    });
    // Test connection with timeout
    await Promise.race([
      _client`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 8000)),
    ]);
    _db = drizzle(_client);
    console.log("[Database] Connected via PostgreSQL direct");
  } catch (error) {
    console.warn("[Database] Direct PostgreSQL unavailable, using Supabase REST API:", (error as Error).message);
    try { _client?.end(); } catch (_) {}
    _client = null;
    _db = null;
  }

  return _db;
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
        const normalized = value ?? null;
        values[field] = normalized;
        updateSet[field] = normalized;
      };
      textFields.forEach(assignNullable);
      if (user.lastSignedIn !== undefined) {
        values.lastSignedIn = user.lastSignedIn;
        updateSet.lastSignedIn = user.lastSignedIn;
      }
      if (user.role !== undefined) {
        values.role = user.role;
        updateSet.role = user.role;
      } else if (user.openId === ENV.ownerOpenId) {
        values.role = 'admin';
        updateSet.role = 'admin';
      }
      if (!values.lastSignedIn) values.lastSignedIn = new Date();
      if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
      await db.insert(users).values(values).onConflictDoUpdate({
        target: users.openId,
        set: updateSet,
      });
      return;
    } catch (error) {
      console.error("[Database] Drizzle upsert failed, trying REST fallback:", (error as Error).message);
      resetDb();
    }
  }

  // Fallback: Supabase REST API
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[Database] Cannot upsert user: no database connection available");
    return;
  }
  const updateData: Record<string, unknown> = {
    open_id: user.openId,
    last_signed_in: (user.lastSignedIn ?? new Date()).toISOString(),
  };
  if (user.name !== undefined) updateData.name = user.name;
  if (user.email !== undefined) updateData.email = user.email;
  if (user.loginMethod !== undefined) updateData.login_method = user.loginMethod;
  if (user.role !== undefined) updateData.role = user.role;
  else if (user.openId === ENV.ownerOpenId) updateData.role = 'admin';

  const { error } = await supabase.from('users').upsert(updateData, { onConflict: 'open_id' });
  if (error) {
    console.error("[Database] Supabase REST upsert failed:", error);
    throw new Error(error.message);
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();

  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error("[Database] Drizzle select failed, trying REST fallback:", (error as Error).message);
      resetDb();
    }
  }

  // Fallback: Supabase REST API
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[Database] Cannot get user: no database connection available");
    return undefined;
  }
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('open_id', openId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return undefined;
  return {
    id: data.id,
    openId: data.open_id,
    name: data.name ?? null,
    email: data.email ?? null,
    passwordHash: data.password_hash ?? null,
    loginMethod: data.login_method ?? null,
    role: data.role ?? 'user',
    lastSignedIn: data.last_signed_in ? new Date(data.last_signed_in) : null,
    createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
  } as typeof users.$inferSelect;
}

// TODO: add feature queries here as your schema grows.
