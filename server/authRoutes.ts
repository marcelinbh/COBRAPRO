import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { passwordResets, users } from "../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { getDb, getSupabaseClient } from "./db";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";

// Helper: buscar usuário por email (Drizzle ou Supabase REST)
async function findUserByEmail(email: string): Promise<typeof users.$inferSelect | null> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0] ?? null;
    } catch (err) {
      console.warn("[Auth] Drizzle findUserByEmail failed, trying REST:", (err as Error).message);
      console.warn("[Auth] Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err as object)));
    }
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[Auth] No Supabase client available");
    return null;
  }
  const { data, error } = await supabase.from("users").select("*").eq("email", email).limit(1).maybeSingle();
  console.log("[Auth] Supabase findUserByEmail - data:", data ? "found" : "null", "error:", error ? error.message : "none");
  if (error || !data) return null;
  return mapSupabaseUser(data);
}

// Helper: buscar usuário por id (Drizzle ou Supabase REST)
async function findUserById(id: number): Promise<typeof users.$inferSelect | null> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0] ?? null;
    } catch (err) {
      console.warn("[Auth] Drizzle findUserById failed, trying REST:", (err as Error).message);
    }
  }
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("users").select("*").eq("id", id).limit(1).maybeSingle();
  if (error || !data) return null;
  return mapSupabaseUser(data);
}

// Helper: mapear linha do Supabase para o tipo do Drizzle
function mapSupabaseUser(data: Record<string, unknown>): typeof users.$inferSelect {
  return {
    id: data.id as number,
    openId: (data.openId ?? "") as string,
    name: (data.name ?? null) as string | null,
    email: (data.email ?? null) as string | null,
    passwordHash: (data.passwordHash ?? null) as string | null,
    loginMethod: (data.loginMethod ?? null) as string | null,
    role: (data.role ?? "user") as "admin" | "user",
    lastSignedIn: data.lastSignedIn ? new Date(data.lastSignedIn as string) : new Date(),
    createdAt: data.createdAt ? new Date(data.createdAt as string) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt as string) : new Date(),
  };
}

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
  // ── GET /api/auth/logout ──────────────────────────────────────────────────
  app.get("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.redirect("/login");
  });

  // ── POST /api/auth/login ──────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: "Email e senha são obrigatórios" });
        return;
      }

      const user = await findUserByEmail(email);

      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Email ou senha incorretos" });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Email ou senha incorretos" });
        return;
      }

      // Atualizar lastSignedIn (best-effort)
      try {
        const db = await getDb();
        if (db) {
          await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
        } else {
          const supabase = getSupabaseClient();
          if (supabase) {
            await supabase.from("users").update({ lastSignedIn: new Date().toISOString() }).eq("id", user.id);
          }
        }
      } catch (_) { /* non-critical */ }

      await createSessionForUser(user, req, res);
      res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      console.error("[Auth] Login error:", err);
      res.status(500).json({ error: "Erro interno ao processar login. Tente novamente." });
    }
  });

  // ── POST /api/auth/register ───────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
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

      const existing = await findUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "Este email já está cadastrado" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const db = await getDb();
      let newUser: typeof users.$inferSelect | null = null;

      if (db) {
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
        newUser = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0] ?? null;
      } else {
        // Fallback: Supabase REST
        const supabase = getSupabaseClient();
        if (!supabase) {
          res.status(500).json({ error: "Banco de dados indisponível" });
          return;
        }
        // Verificar se é primeiro usuário
        const { count } = await supabase.from("users").select("*", { count: "exact", head: true });
        const isFirstUser = (count ?? 0) === 0;

          const { data, error } = await supabase.from("users").insert({
            openId,
            name,
            email,
            passwordHash,
            loginMethod: "email",
            role: isFirstUser ? "admin" : "user",
            lastSignedIn: new Date().toISOString(),
          }).select().single();

        if (error || !data) {
          res.status(500).json({ error: "Erro ao criar usuário" });
          return;
        }
        newUser = mapSupabaseUser(data as Record<string, unknown>);
      }

      if (!newUser) {
        res.status(500).json({ error: "Erro ao criar usuário" });
        return;
      }

      await createSessionForUser(newUser, req, res);
      res.json({
        success: true,
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      });
    } catch (err) {
      console.error("[Auth] Register error:", err);
      res.status(500).json({ error: "Erro interno ao registrar. Tente novamente." });
    }
  });

  // ── POST /api/auth/forgot-password ────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email) {
        res.status(400).json({ error: "Email é obrigatório" });
        return;
      }

      const user = await findUserByEmail(email);

      // Sempre retornar sucesso para não revelar se o email existe
      if (!user) {
        res.json({ success: true, message: "Se o email existir, você receberá as instruções." });
        return;
      }

      // Gerar token seguro
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      const db = await getDb();
      if (db) {
        // Invalidar tokens anteriores do mesmo usuário
        await db.update(passwordResets).set({ usado: true }).where(eq(passwordResets.userId, user.id));
        // Inserir novo token
        await db.insert(passwordResets).values({ userId: user.id, token, expiresAt });
      } else {
        // Fallback: Supabase REST
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase.from("password_resets").update({ usado: true }).eq("userId", user.id);
          await supabase.from("password_resets").insert({
            userId: user.id,
            token,
            expiresAt: expiresAt.toISOString(),
            usado: false,
          });
        }
      }

      // Montar URL de reset
      const origin = (req.headers.origin as string) || `https://cobrapro.online`;
      const resetUrl = `${origin}/reset-senha?token=${token}`;

      // Enviar e-mail via Brevo
      const brevoApiKey = process.env.BREVO_API_KEY ?? "";
      if (brevoApiKey) {
        try {
          await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { name: "CobraPro", email: "noreply@cobrapro.online" },
              to: [{ email: user.email, name: user.name ?? user.email }],
              subject: "Recuperação de senha — CobraPro",
              htmlContent: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:40px;border-radius:12px">
                  <div style="text-align:center;margin-bottom:32px">
                    <h1 style="color:#22c55e;font-size:28px;margin:0">CobraPro</h1>
                    <p style="color:#6b7280;margin:8px 0 0">Sistema de Gestão de Cobranças</p>
                  </div>
                  <h2 style="color:#fff;font-size:20px">Recuperação de senha</h2>
                  <p style="color:#d1d5db;line-height:1.6">Recebemos uma solicitação para redefinir a senha da sua conta CobraPro.</p>
                  <p style="color:#d1d5db;line-height:1.6">Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong style="color:#22c55e">1 hora</strong>.</p>
                  <div style="text-align:center;margin:32px 0">
                    <a href="${resetUrl}" style="background:#22c55e;color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">Redefinir minha senha</a>
                  </div>
                  <p style="color:#6b7280;font-size:13px">Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanece a mesma.</p>
                  <hr style="border:1px solid #1f2937;margin:24px 0">
                  <p style="color:#4b5563;font-size:12px;text-align:center">CobraPro — cobrapro.online</p>
                </div>
              `,
            }),
          });
        } catch (err) {
          console.error("[Brevo] Erro ao enviar e-mail de recuperação:", err);
        }
      }

      res.json({
        success: true,
        message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve.",
      });
    } catch (err) {
      console.error("[Auth] Forgot-password error:", err);
      res.status(500).json({ error: "Erro interno. Tente novamente." });
    }
  });

  // ── POST /api/auth/reset-password ────────────────────────────────────
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body as { token?: string; password?: string };
      if (!token || !password) {
        res.status(400).json({ error: "Token e nova senha são obrigatórios" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const now = new Date();

      const db = await getDb();
      if (db) {
        const resetResult = await db
          .select()
          .from(passwordResets)
          .where(
            and(
              eq(passwordResets.token, token),
              eq(passwordResets.usado, false),
              gt(passwordResets.expiresAt, now)
            )
          )
          .limit(1);

        const reset = resetResult[0];
        if (!reset) {
          res.status(400).json({ error: "Token inválido ou expirado" });
          return;
        }

        await db.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
        await db.update(passwordResets).set({ usado: true }).where(eq(passwordResets.id, reset.id));
      } else {
        // Fallback: Supabase REST
        const supabase = getSupabaseClient();
        if (!supabase) {
          res.status(500).json({ error: "Banco de dados indisponível" });
          return;
        }
        const { data: resetData, error: resetError } = await supabase
          .from("password_resets")
          .select("*")
          .eq("token", token)
          .eq("usado", false)
          .gt("expiresAt", now.toISOString())
          .limit(1)
          .maybeSingle();

        if (resetError || !resetData) {
          res.status(400).json({ error: "Token inválido ou expirado" });
          return;
        }

        await supabase.from("users").update({ passwordHash }).eq("id", resetData.userId);
        await supabase.from("password_resets").update({ usado: true }).eq("id", resetData.id);
      }

      res.json({ success: true, message: "Senha alterada com sucesso!" });
    } catch (err) {
      console.error("[Auth] Reset-password error:", err);
      res.status(500).json({ error: "Erro interno. Tente novamente." });
    }
  });

  // ── POST /api/auth/seed-admin ─────────────────────────────────────────────
  app.post("/api/auth/seed-admin", async (req: Request, res: Response) => {
    try {
      const { secret } = req.body as { secret?: string };
      if (secret !== "cobrapro-seed-2026") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const adminEmail = "koletor3@gmail.com";
      const passwordHash = await bcrypt.hash("97556511", 12);

      const db = await getDb();
      if (db) {
        const existing = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
        if (existing.length > 0) {
          await db.update(users).set({ passwordHash, role: "admin", loginMethod: "email" }).where(eq(users.email, adminEmail));
          res.json({ success: true, message: "Admin atualizado com sucesso (Drizzle)" });
          return;
        }
        const openId = `admin_cobrapro_${Date.now()}`;
        await db.insert(users).values({
          openId, name: "Administrador", email: adminEmail, passwordHash,
          loginMethod: "email", role: "admin", lastSignedIn: new Date(),
        });
        res.json({ success: true, message: "Admin criado com sucesso (Drizzle)" });
        return;
      }

      // Fallback: Supabase REST
      const supabase = getSupabaseClient();
      if (!supabase) {
        res.status(500).json({ error: "Banco de dados indisponível" });
        return;
      }

         const { data: existing } = await supabase.from("users").select("id, email").eq("email", adminEmail).limit(1).maybeSingle();
      if (existing) {
        await supabase.from("users").update({
          passwordHash, role: "admin", loginMethod: "email",
        }).eq("email", adminEmail);
        res.json({ success: true, message: "Admin atualizado com sucesso (REST)" });
        return;
      }

      const openId = `admin_cobrapro_${Date.now()}`;
      await supabase.from("users").insert({
        openId, name: "Administrador", email: adminEmail,
        passwordHash, loginMethod: "email", role: "admin",
        lastSignedIn: new Date().toISOString(),
      });
      res.json({ success: true, message: "Admin criado com sucesso (REST)" });
    } catch (err) {
      console.error("[Auth] Seed-admin error:", err);
      res.status(500).json({ error: "Erro interno. Tente novamente." });
    }
  });

  // ─── UPLOAD DE ARQUIVOS (foto e documentos de clientes) ─────────────
  app.post("/api/upload", async (req: Request, res: Response) => {
    try {
      const { base64, contentType, filename, folder } = req.body;
      if (!base64 || !contentType || !filename) {
        res.status(400).json({ error: "base64, contentType e filename são obrigatórios" });
        return;
      }
      const buffer = Buffer.from(base64, "base64");
      const safeFolder = (folder || "clientes").replace(/[^a-zA-Z0-9_-]/g, "");
      const timestamp = Date.now();
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `${safeFolder}/${timestamp}_${safeName}`;
      const { url } = await storagePut(key, buffer, contentType);
      res.json({ url, key });
    } catch (err) {
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: "Erro ao fazer upload do arquivo" });
    }
  });
}
