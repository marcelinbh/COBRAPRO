import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import type { Express, NextFunction, Request, Response } from "express";
import { users } from "../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { getDb, getSupabaseClientAsync } from "./db";
import { registrarLoginLog } from "./loginLogger";
import { sdk } from "./_core/sdk";
import { enviarEmail } from "./_core/email";
import { storagePut } from "./storage";
import { validarUploadCliente } from "./uploadSecurity";
import { chaveDeLimitacao, LimitadorDeTentativas } from "./authRateLimit";
import { ROLE_CADASTRO_PUBLICO } from "./authRole";
import { ENV } from "./_core/env";
import { resetPasswordAndRevokeSessions, sessionVersionFromUser } from "./services/sessionRevocation";

const ORIGEM_PUBLICA_PADRAO = "https://cobrapro.online";
const ORIGENS_PRIMEIRA_PARTE = new Set([
  "https://cobrapro.online",
  "https://www.cobrapro.online",
]);
const limiteDeAutenticacao = new LimitadorDeTentativas();
const JANELA_LOGIN_MS = 15 * 60 * 1000;
const JANELA_RESET_MS = 60 * 60 * 1000;

/**
 * O cabeçalho Origin é controlado pela requisição. Nunca o reflita em e-mails
 * de segurança sem validar o domínio, ou um atacante pode solicitar um reset
 * para um usuário e receber no e-mail dele um link apontando para seu domínio.
 */
export function obterOrigemSeguraParaReset(origin: unknown): string {
  if (typeof origin !== "string") return ORIGEM_PUBLICA_PADRAO;
  try {
    const url = new URL(origin);
    if (ORIGENS_PRIMEIRA_PARTE.has(url.origin)) return url.origin;
    // Desenvolvimento local não deve ampliar a superfície de produção.
    if (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      return url.origin;
    }
    return ORIGEM_PUBLICA_PADRAO;
  } catch {
    return ORIGEM_PUBLICA_PADRAO;
  }
}

/**
 * Evita login CSRF, criação indevida de contas e disparo de resets a partir de
 * formulários hospedados por terceiros. Chamadas não oriundas de navegador
 * (sem Origin / Sec-Fetch-Site) continuam possíveis para integrações legítimas.
 */
export function origemEhConfiavelParaMutacaoPublica(req: Pick<Request, "headers">): boolean {
  const fetchSite = req.headers["sec-fetch-site"];
  if (typeof fetchSite === "string" && fetchSite.toLowerCase() === "cross-site") return false;

  const origin = req.headers.origin;
  if (typeof origin !== "string" || !origin) return true;
  return obterOrigemSeguraParaReset(origin) === origin;
}

function exigirOrigemConfiavelParaMutacaoPublica(req: Request, res: Response, next: NextFunction) {
  if (origemEhConfiavelParaMutacaoPublica(req)) return next();
  res.status(403).json({ error: "Origem da requisição não permitida" });
}

function limitarTentativaPublica(
  req: Request,
  res: Response,
  finalidade: "login" | "reset",
  email: string,
): string | null {
  const limite = finalidade === "login" ? 8 : 4;
  const janelaMs = finalidade === "login" ? JANELA_LOGIN_MS : JANELA_RESET_MS;
  const chave = chaveDeLimitacao(req, finalidade, email);
  const resultado = limiteDeAutenticacao.consumir(chave, limite, janelaMs);
  if (resultado.permitido) return chave;
  res.setHeader("Retry-After", String(resultado.aguardarSegundos));
  res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." });
  return null;
}

/** O token bruto só existe no e-mail do usuário; o banco recebe a hash. */
export function hashTokenDeRecuperacao(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

type ColunaDeConsumo = "used" | "usado";
type ResetDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Consulta só metadados, nunca tokens. Schema ausente/ambíguo falha fechado. */
async function colunaDeConsumoNoPostgres(db: Pick<ResetDb, "execute">): Promise<ColunaDeConsumo> {
  const columns = await db.execute<{ name: ColunaDeConsumo; valid: boolean }>(sql`
    SELECT attname AS name, (atttypid = 'boolean'::regtype AND attnotnull) AS valid
    FROM pg_catalog.pg_attribute
    WHERE attrelid = to_regclass('public.password_resets')
      AND attname IN ('used', 'usado') AND NOT attisdropped
    LIMIT 2
  `);
  if (columns.length !== 1 || !columns[0].valid) {
    throw new Error("Contrato de consumo de recuperação indisponível ou ambíguo.");
  }
  return columns[0].name;
}

/**
 * Probes de projeção com LIMIT 0: nenhuma linha/token é lida. A compatibilidade
 * é decidida ANTES de qualquer UPDATE, nunca repetindo uma mutação após erro.
 * Falhas de permissão/transporte/cache não são interpretadas como coluna ausente.
 */
export async function colunaDeConsumoNoSupabase(supabase: any): Promise<ColunaDeConsumo> {
  const presentes = await Promise.all((["used", "usado"] as const).map(async (column) => {
    const { data, error } = await supabase.from("password_resets").select(column).limit(0);
    if (!error && Array.isArray(data) && data.length === 0) return column;
    if (error?.code === "42703") return null; // undefined_column na projeção somente
    throw new Error("Contrato de consumo de recuperação indisponível.");
  }));
  const columns = presentes.filter((column): column is ColunaDeConsumo => column !== null);
  if (columns.length !== 1) {
    throw new Error("Contrato de consumo de recuperação indisponível ou ambíguo.");
  }
  return columns[0];
}

/**
 * Faz o compare-and-set do token no Supabase: somente a primeira chamada com
 * token válido, ainda não usado e não expirado recebe o usuário associado.
 * Compatibilidade legada REST; NÃO é transação com a atualização de users.
 * O modo versionado usa exclusivamente a RPC transacional abaixo.
 */
export async function consumirTokenRecuperacaoNoSupabase(supabase: any, tokenHash: string, now: Date): Promise<number | null> {
  const usedColumn = await colunaDeConsumoNoSupabase(supabase);
  const { data, error } = await supabase
    .from("password_resets")
    .update({ [usedColumn]: true })
    .eq("token", tokenHash)
    .eq(usedColumn, false)
    .gt("expires_at", now.toISOString())
    .select("user_id")
    .maybeSingle();

  if (error) throw new Error("Não foi possível consumir o token de recuperação.");
  if (data === null) return null;
  if (!Number.isSafeInteger(data?.user_id) || data.user_id <= 0) {
    throw new Error("Resposta inválida do consumo de recuperação.");
  }
  return data.user_id;
}

// Helper: buscar usuário por email (Drizzle ou Supabase REST)
async function findUserByEmail(email: string): Promise<typeof users.$inferSelect | null> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0] ?? null;
    } catch (err) {
      console.warn("[Auth] Consulta local de usuário falhou; usando adaptador REST.");
    }
  }
  const supabase = await getSupabaseClientAsync();
  if (!supabase) {
    console.error("[Auth] No Supabase client available");
    return null;
  }
  const { data, error } = await supabase.from("users").select("*").eq("email", email).limit(1).maybeSingle();
  if (error) console.warn("[Auth] Consulta REST de usuário indisponível.");
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
  const supabase = await getSupabaseClientAsync();
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
    sessionVersion: ENV.enableSessionRevocation ? sessionVersionFromUser(data)
      : Number.isSafeInteger(data.session_version) && (data.session_version as number) >= 0
        ? data.session_version as number : 0,
    onboardingCompleto: (data.onboarding_completo ?? false) as boolean,
    nomeEmpresa: (data.nome_empresa ?? null) as string | null,
    idioma: (data.idioma ?? 'pt-BR') as string | null,
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
      appId: ENV.enableSessionRevocation ? ENV.appId : process.env.VITE_APP_ID ?? "cobrapro",
      name: user.name ?? user.email ?? "",
      // Snapshot da mesma linha usada no bcrypt: não reler versão depois de validar a senha.
      ...(ENV.enableSessionRevocation ? { sessionVersion: sessionVersionFromUser(user) } : {}),
    },
    { expiresInMs: ONE_YEAR_MS }
  );
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

export function registerAuthRoutes(app: Express) {
  // ── POST /api/auth/login ──────────────────────────────────────────────────
  app.post("/api/auth/login", exigirOrigemConfiavelParaMutacaoPublica, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: "Email e senha são obrigatórios" });
        return;
      }
      if (email.length > 320 || password.length > 128) {
        res.status(400).json({ error: "Credenciais inválidas" });
        return;
      }
      const chaveLimite = limitarTentativaPublica(req, res, "login", email);
      if (!chaveLimite) return;

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
          const supabase = await getSupabaseClientAsync();
          if (supabase) {
            await supabase.from("users").update({ lastSignedIn: new Date().toISOString() }).eq("id", user.id);
          }
        }
      } catch (_) { /* non-critical */ }

      await createSessionForUser(user, req, res);
      limiteDeAutenticacao.remover(chaveLimite);

      // Registrar log de login (não-bloqueante)
      registrarLoginLog(user.id, req, true).catch(() => {});

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
  app.post("/api/auth/register", exigirOrigemConfiavelParaMutacaoPublica, async (req: Request, res: Response) => {
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
      if (password.length < 8 || password.length > 128) {
        res.status(400).json({ error: "A senha deve ter entre 8 e 128 caracteres" });
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
        await db.insert(users).values({
          openId,
          name,
          email,
          passwordHash,
          loginMethod: "email",
          // Privilégios administrativos são provisionados fora de rotas públicas.
          role: ROLE_CADASTRO_PUBLICO,
          lastSignedIn: new Date(),
        });
        newUser = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0] ?? null;
      } else {
        // Fallback: Supabase REST
        const supabase = await getSupabaseClientAsync();
        if (!supabase) {
          res.status(500).json({ error: "Banco de dados indisponível" });
          return;
        }
        const { data, error } = await supabase.from("users").insert({
          openId,
          name,
          email,
          passwordHash,
          loginMethod: "email",
          role: ROLE_CADASTRO_PUBLICO,
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
  app.post("/api/auth/forgot-password", exigirOrigemConfiavelParaMutacaoPublica, async (req: Request, res: Response) => {
    try {
      const { email } = req.body as { email?: string };
      if (typeof email !== "string" || !email.trim()) {
        res.status(400).json({ error: "Email é obrigatório" });
        return;
      }
      if (email.length > 320) {
        res.status(400).json({ error: "E-mail inválido" });
        return;
      }
      if (!limitarTentativaPublica(req, res, "reset", email)) return;

      const user = await findUserByEmail(email);

      // Sempre retornar sucesso para não revelar se o email existe
      if (!user?.email) {
        res.json({ success: true, message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve." });
        return;
      }

      // Gerar token seguro
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashTokenDeRecuperacao(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      const db = await getDb();
      if (db) {
        await db.transaction(async (tx) => {
          const usedColumn = sql.identifier(await colunaDeConsumoNoPostgres(tx));
          await tx.execute(sql`UPDATE public.password_resets SET ${usedColumn} = true WHERE user_id = ${user.id}`);
          await tx.execute(sql`
            INSERT INTO public.password_resets (user_id, token, expires_at, ${usedColumn})
            VALUES (${user.id}, ${tokenHash}, ${expiresAt}, false)
          `);
        });
      } else {
        // REST legado: resolver contrato sem ler linhas nem tentar UPDATE alternativo.
        const supabase = await getSupabaseClientAsync();
        if (!supabase) throw new Error("Persistência de token indisponível");
        const usedColumn = await colunaDeConsumoNoSupabase(supabase);
        const { error: invalidarErro } = await supabase
          .from("password_resets")
          .update({ [usedColumn]: true })
          .eq("user_id", user.id);
        if (invalidarErro) throw new Error("Não foi possível invalidar tokens anteriores");
        const { error: insertErr } = await supabase.from("password_resets").insert({
          user_id: user.id,
          token: tokenHash,
          expires_at: expiresAt.toISOString(),
          [usedColumn]: false,
        });
        if (insertErr) throw new Error("Não foi possível persistir token de recuperação");
      }

      // Montar URL de reset
      const origin = obterOrigemSeguraParaReset(req.headers.origin);
      const resetUrl = `${origin}/reset-senha?token=${token}`;

      const entrega = await enviarEmail({
        to: user.email,
        toName: user.name ?? user.email,
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
      });
      if (!entrega.accepted) {
        console.warn(`[Auth] E-mail de recuperação não aceito: kind=${entrega.kind}`);
      }

      res.json({
        success: true,
        message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve.",
      });
    } catch {
      console.error("[Auth] Falha ao iniciar recuperação de senha.");
      // Falhas internas não devem revelar que uma conta foi encontrada.
      res.json({ success: true, message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve." });
    }
  });

  // ── POST /api/auth/reset-password ────────────────────────────────────
  app.post("/api/auth/reset-password", exigirOrigemConfiavelParaMutacaoPublica, async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body as { token?: string; password?: string };
      if (typeof token !== "string" || typeof password !== "string" || !token || !password || token.length > 512) {
        res.status(400).json({ error: "Token e nova senha são obrigatórios" });
        return;
      }
      if (password.length < 8 || password.length > 128) {
        res.status(400).json({ error: "A senha deve ter entre 8 e 128 caracteres" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const tokenHash = hashTokenDeRecuperacao(token);
      const now = new Date();

      if (ENV.enableSessionRevocation) {
        const supabase = await getSupabaseClientAsync();
        if (!supabase) throw new Error("Redefinição transacional de senha indisponível.");
        const alterada = await resetPasswordAndRevokeSessions(supabase, tokenHash, passwordHash);
        if (!alterada) {
          res.status(400).json({ error: "Token inválido ou expirado" });
          return;
        }
        res.json({ success: true, message: "Senha alterada com sucesso!" });
        return; // Nunca consumir token ou alterar senha por REST separadamente neste modo.
      }

      const db = await getDb();
      if (db) {
        const alterada = await db.transaction(async (tx) => {
          const usedColumn = sql.identifier(await colunaDeConsumoNoPostgres(tx));
          const resetsConsumidos = await tx.execute<{ user_id: number }>(sql`
            UPDATE public.password_resets SET ${usedColumn} = true
            WHERE token = ${tokenHash} AND ${usedColumn} = false AND expires_at > ${now}
            RETURNING user_id
          `);
          const reset = resetsConsumidos[0];
          if (!reset) return false;

          const usuarioAtualizado = await tx.update(users)
            .set({ passwordHash, updatedAt: now })
            .where(eq(users.id, reset.user_id))
            .returning({ id: users.id });
          if (!usuarioAtualizado[0]) throw new Error("Usuário associado ao token não encontrado");
          return true;
        });
        if (!alterada) {
          res.status(400).json({ error: "Token inválido ou expirado" });
          return;
        }
      } else {
        // Fallback: Supabase REST
        const supabase = await getSupabaseClientAsync();
        if (!supabase) {
          res.status(500).json({ error: "Banco de dados indisponível" });
          return;
        }
        const userId = await consumirTokenRecuperacaoNoSupabase(supabase, tokenHash, now);
        if (!userId) {
          res.status(400).json({ error: "Token inválido ou expirado" });
          return;
        }

        const { data: usuarioAtualizado, error: usuarioErro } = await supabase
          .from("users")
          .update({ passwordHash, updatedAt: now.toISOString() })
          .eq("id", userId)
          .select("id")
          .maybeSingle();
        if (usuarioErro || !usuarioAtualizado) {
          throw new Error("Não foi possível atualizar a senha de recuperação.");
        }
      }

      res.json({ success: true, message: "Senha alterada com sucesso!" });
    } catch {
      // Não registrar SQL, respostas de transporte ou hashes/tokens em exceções.
      console.error("[Auth] Falha ao redefinir senha.");
      res.status(500).json({ error: "Erro interno. Tente novamente." });
    }
  });

  // ─── UPLOAD DE ARQUIVOS (foto e documentos de clientes) ─────────────
  app.post("/api/upload", exigirOrigemConfiavelParaMutacaoPublica, async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.isCron || user.id <= 0) {
        res.status(403).json({ error: "Esta rota exige uma sessão de usuário" });
        return;
      }

      const upload = validarUploadCliente(req.body);
      const key = `tenants/${user.id}/clientes/${upload.pasta}/${crypto.randomUUID()}_${upload.nomeSeguro}`;
      const { url } = await storagePut(key, upload.buffer, upload.contentType);
      res.json({ url, key });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao fazer upload do arquivo";
      const clientError = [
        "Invalid session cookie", "User not found", "Failed to sync user info",
        "Arquivo ausente ou excede o limite de 10 MB", "Conteúdo do arquivo inválido",
        "Nome do arquivo inválido", "Tipo de arquivo não permitido", "Destino de upload não permitido",
        "O conteúdo não corresponde ao tipo de arquivo informado",
      ].includes(message);
      if (clientError) {
        const status = message.includes("session") || message === "User not found" || message.includes("sync") ? 401 : 400;
        res.status(status).json({ error: status === 401 ? "Sessão inválida ou expirada" : message });
        return;
      }
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: "Erro ao fazer upload do arquivo" });
    }
  });
}
