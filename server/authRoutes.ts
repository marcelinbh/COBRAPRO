import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { users } from "../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";

async function createSessionForUser(
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

export function registerAuthRoutes(app: Express) {
  // ── POST /api/auth/login ──────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email e senha são obrigatórios" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Banco de dados indisponível" });
      return;
    }

    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Email ou senha incorretos" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Email ou senha incorretos" });
      return;
    }

    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
    await createSessionForUser(user, req, res);

    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  // ── POST /api/auth/register ───────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };
    if (!name || !email || !password) {
      res.status(400).json({ error: "Nome, email e senha são obrigatórios" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Banco de dados indisponível" });
      return;
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Este email já está cadastrado" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Primeiro usuário vira admin automaticamente
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(users);
    const isFirstUser = (countResult[0]?.count ?? 0) === 0;

    await db.insert(users).values({
      openId,
      name,
      email,
      passwordHash,
      loginMethod: "email",
      role: isFirstUser ? "admin" : "user",
      lastSignedIn: new Date(),
    });

    const newUser = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (!newUser) {
      res.status(500).json({ error: "Erro ao criar usuário" });
      return;
    }

    await createSessionForUser(newUser, req, res);
    res.json({
      success: true,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    });
  });

  // ── GET /api/auth/seed-admin ──────────────────────────────────────────────
  // Rota interna para criar o admin inicial (chamada uma única vez)
  app.post("/api/auth/seed-admin", async (req: Request, res: Response) => {
    const { secret } = req.body as { secret?: string };
    if (secret !== "cobrapro-seed-2026") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Banco de dados indisponível" });
      return;
    }

    const adminEmail = "koletor3@gmail.com";
    const existing = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

    if (existing.length > 0) {
      // Atualizar senha e garantir role admin
      const passwordHash = await bcrypt.hash("97556511", 12);
      await db.update(users).set({ passwordHash, role: "admin", loginMethod: "email" }).where(eq(users.email, adminEmail));
      res.json({ success: true, message: "Admin atualizado com sucesso" });
      return;
    }

    const passwordHash = await bcrypt.hash("97556511", 12);
    const openId = `admin_cobrapro_${Date.now()}`;

    await db.insert(users).values({
      openId,
      name: "Administrador",
      email: adminEmail,
      passwordHash,
      loginMethod: "email",
      role: "admin",
      lastSignedIn: new Date(),
    });

    res.json({ success: true, message: "Admin criado com sucesso" });
  });
}
