import dns from "dns";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

// Force IPv4 DNS resolution to avoid IPv6 connectivity issues in some hosting environments
// (e.g., DigitalOcean App Platform ATL1 blocks IPv6 connections to Supabase)
dns.setDefaultResultOrder("ipv4first");

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

// Use PostgreSQL direct connection (DATABASE_URL) as primary database.
// Falls back to Supabase REST API if DATABASE_URL is not available.
export async function getDb(): Promise<ReturnType<typeof drizzle> | null> {
  if (_db) return _db;
  if (_dbInitialized) return null;
  _dbInitialized = true;

  const dbUrl = ENV.databaseUrl || process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    console.log('[Database] No PostgreSQL DATABASE_URL found, using Supabase REST API');
    return null;
  }

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
    openId: user.openId,
    lastSignedIn: (user.lastSignedIn ?? new Date()).toISOString(),
  };
  if (user.name !== undefined) updateData.name = user.name;
  if (user.email !== undefined) updateData.email = user.email;
  if (user.loginMethod !== undefined) updateData.loginMethod = user.loginMethod;
  if (user.role !== undefined) updateData.role = user.role;
  else if (user.openId === ENV.ownerOpenId) updateData.role = 'admin';

  const { error } = await supabase.from('users').upsert(updateData, { onConflict: 'openId' });
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
    .eq('openId', openId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return undefined;
  return {
    id: data.id,
    openId: data.openId ?? openId,
    name: data.name ?? null,
    email: data.email ?? null,
    passwordHash: data.passwordHash ?? null,
    loginMethod: data.loginMethod ?? null,
    role: data.role ?? 'user',
    lastSignedIn: data.lastSignedIn ? new Date(data.lastSignedIn) : null,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  } as typeof users.$inferSelect;
}

// TODO: add feature queries here as your schema grows.

/**
 * Retorna o koletor_id vinculado ao user_id informado.
 * Retorna null se o usuário não tiver um koletor vinculado (admin ou sem vínculo).
 */
export async function getKoletorIdForUser(userId: number): Promise<number | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('koletores')
    .select('id')
    .eq('user_id', userId)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
