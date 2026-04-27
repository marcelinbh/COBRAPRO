/**
 * Webhook da Kiwify — Integração de Vendas
 *
 * Fluxo:
 *   1. Kiwify envia POST /api/webhook/kiwify com o evento de compra aprovada
 *   2. Validamos o token de segurança (header x-kiwify-token ou query ?token=)
 *   3. Verificamos idempotência pelo order_id (evita duplicatas)
 *   4. Criamos o usuário no banco com senha temporária gerada automaticamente
 *   5. Enviamos e-mail de boas-vindas via Brevo com login e senha
 *   6. Registramos o log na tabela kiwify_webhooks
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { users } from "../drizzle/schema";
import { getDb, getSupabaseClientAsync } from "./db";
import { enviarEmail } from "./_core/email";

// ─── Tipos do payload da Kiwify ──────────────────────────────────────────────
interface KiwifyCustomer {
  name?: string;
  full_name?: string;
  email?: string;
  mobile?: string;
  CPF?: string;
}

interface KiwifyPayload {
  order_id?: string;
  order_status?: string;
  payment_method?: string;
  product_id?: string;
  product_title?: string;
  customer?: KiwifyCustomer;
  // Assinatura
  subscription?: { id?: string; status?: string };
  // Campos extras que a Kiwify pode enviar
  [key: string]: unknown;
}

// ─── Gerador de senha aleatória legível ──────────────────────────────────────
function gerarSenhaTemporaria(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let senha = "";
  for (let i = 0; i < 10; i++) {
    senha += chars[Math.floor(Math.random() * chars.length)];
  }
  return senha;
}

// ─── Template HTML do e-mail de boas-vindas ──────────────────────────────────
function gerarHtmlBoasVindas(dados: {
  nome: string;
  email: string;
  senha: string;
  produto: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="color:#22c55e;font-size:32px;margin:0;letter-spacing:-1px">CobraPro</h1>
      <p style="color:#64748b;margin:8px 0 0;font-size:14px">Sistema de Gestão de Cobranças</p>
    </div>

    <!-- Card principal -->
    <div style="background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155">
      <h2 style="color:#f1f5f9;margin:0 0 8px;font-size:22px">Bem-vindo(a), ${dados.nome}! 🎉</h2>
      <p style="color:#94a3b8;margin:0 0 24px;font-size:15px">
        Sua compra de <strong style="color:#22c55e">${dados.produto}</strong> foi aprovada com sucesso.
        Seu acesso ao CobraPro já está ativo!
      </p>

      <!-- Credenciais -->
      <div style="background:#0f172a;border-radius:8px;padding:20px;margin-bottom:24px;border:1px solid #22c55e33">
        <p style="color:#64748b;margin:0 0 12px;font-size:12px;text-transform:uppercase;letter-spacing:1px">
          Suas credenciais de acesso
        </p>
        <div style="margin-bottom:12px">
          <span style="color:#64748b;font-size:13px">Login (e-mail)</span><br>
          <span style="color:#f1f5f9;font-size:16px;font-weight:bold">${dados.email}</span>
        </div>
        <div>
          <span style="color:#64748b;font-size:13px">Senha temporária</span><br>
          <span style="color:#22c55e;font-size:20px;font-weight:bold;letter-spacing:2px">${dados.senha}</span>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px">
        <a href="https://cobrapro.online/login"
           style="display:inline-block;background:#22c55e;color:#0f172a;text-decoration:none;
                  padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px">
          Acessar o CobraPro →
        </a>
      </div>

      <!-- Aviso de segurança -->
      <div style="background:#fbbf2415;border:1px solid #fbbf2440;border-radius:8px;padding:16px">
        <p style="color:#fbbf24;margin:0;font-size:13px">
          🔒 <strong>Por segurança:</strong> recomendamos que você altere sua senha após o primeiro acesso.
          Acesse <strong>Configurações → Minha Conta</strong> para trocar.
        </p>
      </div>
    </div>

    <!-- Suporte -->
    <div style="text-align:center;margin-top:24px">
      <p style="color:#475569;font-size:13px;margin:0">
        Dúvidas? Entre em contato: <a href="mailto:contato@vitalfinanceira.com" style="color:#22c55e">contato@vitalfinanceira.com</a>
      </p>
      <p style="color:#334155;font-size:11px;margin:8px 0 0">
        Este e-mail foi enviado automaticamente. Não responda diretamente.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ─── Registro de log na tabela kiwify_webhooks ───────────────────────────────
async function logWebhook(dados: {
  orderId: string;
  email: string;
  nome: string;
  status: string;
  payload: KiwifyPayload;
  userCriado?: number;
  emailEnviado?: boolean;
  erro?: string;
}) {
  try {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return;
    await supabase.from("kiwify_webhooks").upsert(
      {
        order_id: dados.orderId,
        email: dados.email,
        nome: dados.nome,
        status: dados.status,
        payload: dados.payload,
        user_criado: dados.userCriado ?? null,
        email_enviado: dados.emailEnviado ? 1 : 0,
        erro: dados.erro ?? null,
      },
      { onConflict: "order_id" }
    );
  } catch (err) {
    console.error("[Kiwify] Erro ao salvar log:", err);
  }
}

// ─── Processamento principal ─────────────────────────────────────────────────
async function processarCompraAprovada(payload: KiwifyPayload) {
  const orderId = payload.order_id ?? "";
  const customer = payload.customer ?? {};
  const email = (customer.email ?? "").trim().toLowerCase();
  const nome = (customer.full_name ?? customer.name ?? "Cliente").trim();
  const produto = (payload.product_title ?? "CobraPro").trim();

  if (!email) {
    console.error("[Kiwify] Compra sem e-mail do cliente:", orderId);
    return;
  }

  console.log(`[Kiwify] Processando compra aprovada | order: ${orderId} | email: ${email}`);

  // Verificar idempotência — se já processamos este order_id, ignorar
  try {
    const supabase = await getSupabaseClientAsync();
    if (supabase) {
      const { data: existing } = await supabase
        .from("kiwify_webhooks")
        .select("id, user_criado")
        .eq("order_id", orderId)
        .maybeSingle();

      if (existing) {
        console.log(`[Kiwify] order_id ${orderId} já processado anteriormente — ignorando`);
        return;
      }
    }
  } catch (_) { /* continuar mesmo se falhar a checagem */ }

  const db = await getDb();
  let userId: number | undefined;
  let senhaGerada = "";
  let erro: string | undefined;
  let emailEnviado = false;

  try {
    // ── 1. Verificar se usuário já existe ────────────────────────────────────
    let usuarioExistente: typeof users.$inferSelect | null = null;

    if (db) {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      usuarioExistente = result[0] ?? null;
    } else {
      const supabase = await getSupabaseClientAsync();
      if (supabase) {
        const { data } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
        if (data) {
          usuarioExistente = {
            id: data.id,
            openId: data.openId ?? "",
            name: data.name ?? null,
            email: data.email ?? null,
            passwordHash: data.passwordHash ?? null,
            loginMethod: data.loginMethod ?? null,
            role: (data.role ?? "user") as "admin" | "user",
            lastSignedIn: data.lastSignedIn ? new Date(data.lastSignedIn) : new Date(),
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
            onboardingCompleto: (data.onboarding_completo ?? false) as boolean,
            nomeEmpresa: (data.nome_empresa ?? null) as string | null,
          };
        }
      }
    }

    if (usuarioExistente) {
      // Usuário já existe — apenas reenviar e-mail com nova senha temporária
      console.log(`[Kiwify] Usuário ${email} já existe (id: ${usuarioExistente.id}) — reenviando acesso`);
      userId = usuarioExistente.id;
      senhaGerada = gerarSenhaTemporaria();
      const novoHash = await bcrypt.hash(senhaGerada, 12);

      if (db) {
        await db.update(users).set({ passwordHash: novoHash, updatedAt: new Date() }).where(eq(users.id, usuarioExistente.id));
      } else {
        const supabase = await getSupabaseClientAsync();
        if (supabase) {
          await supabase.from("users").update({ passwordHash: novoHash }).eq("id", usuarioExistente.id);
        }
      }
    } else {
      // ── 2. Criar novo usuário ────────────────────────────────────────────
      senhaGerada = gerarSenhaTemporaria();
      const passwordHash = await bcrypt.hash(senhaGerada, 12);
      const openId = `kiwify_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      if (db) {
        await db.insert(users).values({
          openId,
          name: nome,
          email,
          passwordHash,
          loginMethod: "kiwify",
          role: "user",
          lastSignedIn: new Date(),
        });
        const created = await db.select().from(users).where(eq(users.email, email)).limit(1);
        userId = created[0]?.id;
      } else {
        const supabase = await getSupabaseClientAsync();
        if (!supabase) throw new Error("Banco de dados indisponível");

        const { data, error: insertError } = await supabase
          .from("users")
          .insert({
            openId,
            name: nome,
            email,
            passwordHash,
            loginMethod: "kiwify",
            role: "user",
            lastSignedIn: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);
        userId = (data as { id: number }).id;
      }

      console.log(`[Kiwify] Usuário criado: ${email} (id: ${userId})`);
    }

    // ── 3. Enviar e-mail de boas-vindas via Brevo ────────────────────────────
    const htmlContent = gerarHtmlBoasVindas({ nome, email, senha: senhaGerada, produto });

    emailEnviado = await enviarEmail({
      to: email,
      toName: nome,
      subject: `✅ Seu acesso ao CobraPro está pronto!`,
      htmlContent,
    });

    if (emailEnviado) {
      console.log(`[Kiwify] E-mail de boas-vindas enviado para ${email}`);
    } else {
      console.error(`[Kiwify] Falha ao enviar e-mail para ${email}`);
      erro = "Usuário criado mas e-mail não foi enviado";
    }
  } catch (err) {
    erro = (err as Error).message;
    console.error(`[Kiwify] Erro ao processar compra ${orderId}:`, erro);
  }

  // ── 4. Registrar log ─────────────────────────────────────────────────────
  await logWebhook({
    orderId,
    email,
    nome,
    status: payload.order_status ?? "paid",
    payload,
    userCriado: userId,
    emailEnviado,
    erro,
  });
}

// ─── Registro das rotas Express ───────────────────────────────────────────────
export function registerKiwifyWebhookRoutes(app: Express) {
  // Token de segurança — configurado na Kiwify como "Token"
  const KIWIFY_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN ?? "";

  // POST /api/webhook/kiwify — recebe eventos da Kiwify
  app.post("/api/webhook/kiwify", async (req: Request, res: Response) => {
    try {
      // Validar token de segurança (enviado pela Kiwify no header ou query)
      const tokenHeader = (req.headers["x-kiwify-token"] as string) ?? "";
      const tokenQuery = (req.query.token as string) ?? "";
      const tokenRecebido = tokenHeader || tokenQuery;

      if (KIWIFY_TOKEN && tokenRecebido !== KIWIFY_TOKEN) {
        console.warn("[Kiwify] Token inválido recebido:", tokenRecebido);
        res.status(401).json({ error: "Token inválido" });
        return;
      }

      const payload = req.body as KiwifyPayload;
      const status = payload.order_status ?? "";

      // Responder imediatamente com 200 (Kiwify exige resposta rápida)
      res.status(200).json({ received: true });

      // Processar apenas compras aprovadas
      if (status === "paid" || status === "approved" || status === "complete") {
        await processarCompraAprovada(payload);
      } else {
        console.log(`[Kiwify] Evento ignorado (status: ${status}) | order: ${payload.order_id}`);
      }
    } catch (err) {
      console.error("[Kiwify] Erro no endpoint:", err);
      // Já respondeu 200 acima — não enviar novamente
    }
  });

  // GET /api/webhook/kiwify — health check
  app.get("/api/webhook/kiwify", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "CobraPro Kiwify Webhook",
      timestamp: new Date().toISOString(),
    });
  });
}
