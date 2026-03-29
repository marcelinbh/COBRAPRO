import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import type { Request, Response } from "express";
import { getSessionCookieOptions } from "./_core/cookies";

export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: typeof users.$inferSelect }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indisponível" };

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = result[0];
  if (!user) return { success: false, error: "Email ou senha incorretos" };
  if (!user.passwordHash) return { success: false, error: "Email ou senha incorretos" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { success: false, error: "Email ou senha incorretos" };

  // Atualizar lastSignedIn
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  return { success: true, user };
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: typeof users.$inferSelect }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indisponível" };

  // Verificar se email já existe
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) return { success: false, error: "Este email já está cadastrado" };

  const passwordHash = await bcrypt.hash(password, 12);
  const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Verificar se é o primeiro usuário (será admin)
  const count = await db.select().from(users).limit(1);
  const isFirstUser = count.length === 0;

  await db.insert(users).values({
    openId,
    name,
    email,
    passwordHash,
    loginMethod: "email",
    role: isFirstUser ? "admin" : "user",
    lastSignedIn: new Date(),
  });

  const newUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return { success: true, user: newUser[0] };
}

export async function createSessionForUser(
  user: typeof users.$inferSelect,
  req: Request,
  res: Response
): Promise<void> {
  const sessionToken = await sdk.signSession(
    {
      openId: user.openId,
      appId: process.env.VITE_APP_ID ?? "cobrapro",
      name: user.name ?? user.email ?? "",
    },
    { expiresInMs: ONE_YEAR_MS }
  );
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}
