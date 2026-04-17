import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { InsertUser } from "../drizzle/schema";
import { ENV } from './_core/env';

let _supabase: SupabaseClient | null = null;

// Initialize Supabase client
export function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = ENV.supabaseUrl || process.env.SUPABASE_URL;
  const key = ENV.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("[Database] CRITICAL: Supabase credentials missing! Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  try {
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log("[Database] Supabase client initialized successfully");
    return _supabase;
  } catch (e) {
    throw new Error(`[Database] Failed to initialize Supabase: ${(e as Error).message}`);
  }
}

// Async version for backward compatibility
async function getSupabaseClientAsync(): Promise<SupabaseClient> {
  return getSupabaseClient();
}

// Wrapper that mimics Drizzle interface but uses Supabase
export async function getDb() {
  const supabase = await getSupabaseClientAsync();
  
  return {
    select: () => ({
      from: (table: any) => {
        const tableName = table._ ? table._.name : table;
        return {
          where: (condition: any) => ({
            limit: async (n: number) => {
              // This is a simplified implementation
              // In real usage, conditions would be parsed
              const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(n);
              if (error) throw error;
              return data || [];
            },
          }),
          eq: (col: string, val: any) => ({
            single: async () => {
              const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq(col, val)
                .single();
              return { data, error };
            },
            limit: async (n: number) => {
              const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq(col, val)
                .limit(n);
              return data || [];
            },
          }),
          in: (col: string, vals: any[]) => ({
            select: (cols: string) => ({
              order: (orderCol: string, opts?: any) => ({
                limit: async (n: number) => {
                  let query = supabase
                    .from(tableName)
                    .select(cols)
                    .in(col, vals);
                  if (orderCol) {
                    query = query.order(orderCol, { ascending: opts?.ascending !== false });
                  }
                  const { data, error } = await query.limit(n);
                  return data || [];
                },
              }),
            }),
          }),
          limit: async (n: number) => {
            const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .limit(n);
            return data || [];
          },
          order: (col: string, opts?: any) => ({
            limit: async (n: number) => {
              const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .order(col, { ascending: opts?.ascending !== false })
                .limit(n);
              return data || [];
            },
          }),
        };
      },
    }),
    insert: (table: any) => ({
      values: async (data: any) => {
        const tableName = table._ ? table._.name : table;
        const { data: result, error } = await supabase
          .from(tableName)
          .insert(data)
          .select();
        if (error) throw error;
        return result;
      },
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: async (condition: any) => {
          // Simplified: assumes condition is eq(table.id, value)
          const tableName = table._ ? table._.name : table;
          const { error } = await supabase
            .from(tableName)
            .update(data)
            .eq('id', condition);
          if (error) throw error;
        },
        eq: async (col: string, val: any) => {
          const tableName = table._ ? table._.name : table;
          const { error } = await supabase
            .from(tableName)
            .update(data)
            .eq(col, val);
          if (error) throw error;
        },
      }),
    }),
  } as any;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const supabase = await getSupabaseClientAsync();
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
    console.error("[Database] Supabase upsert failed:", error);
    throw new Error(error.message);
  }
}

export async function getUserByOpenId(openId: string) {
  const supabase = await getSupabaseClientAsync();
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
  };
}
