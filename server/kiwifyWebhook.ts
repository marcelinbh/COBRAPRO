import bcrypt from "bcryptjs";
import crypto, { timingSafeEqual } from "crypto";
import type { Express, Request, Response } from "express";
import { getSupabaseClientAsync } from "./db";
import { enviarEmail, type EmailDeliveryResult } from "./_core/email";
import { escapeHtml } from "./utils/html";
import { processVerifiedKiwifySubscription } from "./services/kiwifySubscriptionRuntime";
import { KiwifySubscriptionError } from "./services/kiwifySubscriptions";

/** A Kiwify assina os bytes originais do corpo; nunca reserialize JSON para validar. */
type RawBodyRequest = Request & { rawBody?: Buffer };

type KiwifyCustomer = {
  name?: string;
  full_name?: string;
  email?: string;
};

type KiwifyOrder = {
  order_id?: string;
  order_status?: string;
  webhook_event_type?: string;
  Customer?: KiwifyCustomer;
  Product?: { product_id?: string; product_name?: string };
};

type KiwifyPayload = {
  order?: KiwifyOrder;
  order_id?: string;
  order_status?: string;
  webhook_event_type?: string;
  event?: string;
  product_id?: string;
  product_title?: string;
  customer?: KiwifyCustomer;
  Customer?: KiwifyCustomer;
};

type DadosPedido = {
  orderId: string;
  eventType: string;
  status: string;
  email: string;
  nome: string;
  produto: string;
  produtoId: string | null;
};

const RESET_ORIGIN = "https://cobrapro.online";
const RESET_TTL_MS = 60 * 60 * 1000;

export function assinaturaKiwifyEhValida(rawBody: Buffer, signature: unknown, token: string): boolean {
  if (!token || !Buffer.isBuffer(rawBody) || typeof signature !== "string" || !/^[a-f0-9]{40}$/.test(signature)) {
    return false;
  }
  const esperada = crypto.createHmac("sha1", token).update(rawBody).digest("hex");
  const recebida = Buffer.from(signature, "utf8");
  const calculada = Buffer.from(esperada, "utf8");
  return recebida.length === calculada.length && timingSafeEqual(recebida, calculada);
}

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!local || !dominio) return "oculto";
  return `${local.slice(0, 1)}***@${dominio}`;
}

function extrairDadosPedido(payload: KiwifyPayload): DadosPedido | null {
  const order = payload.order;
  const orderId = String(order?.order_id ?? payload.order_id ?? "").trim();
  const status = String(order?.order_status ?? payload.order_status ?? "").trim().toLowerCase();
  const eventType = String(order?.webhook_event_type ?? payload.webhook_event_type ?? payload.event ?? "").trim().toLowerCase();
  const customer = order?.Customer ?? payload.Customer ?? payload.customer;
  const email = String(customer?.email ?? "").trim().toLowerCase();
  const nome = String(customer?.full_name ?? customer?.name ?? "Cliente").trim().slice(0, 255) || "Cliente";
  const produto = String(order?.Product?.product_name ?? payload.product_title ?? "CobraPro").trim().slice(0, 255) || "CobraPro";
  const produtoId = String(order?.Product?.product_id ?? payload.product_id ?? "").trim() || null;

  if (!orderId || orderId.length > 255 || !email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return { orderId, eventType, status, email, nome, produto, produtoId };
}

function compraAprovada(dados: DadosPedido): boolean {
  return dados.status === "paid" || dados.status === "approved" || dados.status === "complete" || dados.eventType === "order_approved" || dados.eventType === "compra_aprovada";
}

function payloadMinimo(dados: DadosPedido): Record<string, string | null> {
  return {
    eventType: dados.eventType || null,
    orderStatus: dados.status || null,
    productId: dados.produtoId,
  };
}

function htmlDefinirSenha(nome: string, produto: string, resetUrl: string): string {
  return `
<!doctype html>
<html lang="pt-BR"><body style="font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc;padding:32px">
  <main style="max-width:600px;margin:auto;background:#1e293b;border-radius:12px;padding:32px">
    <h1 style="color:#22c55e">CobraPro</h1>
    <h2>Bem-vindo(a), ${escapeHtml(nome)}!</h2>
    <p>Sua compra de <strong>${escapeHtml(produto)}</strong> foi aprovada. Para ativar sua conta, defina uma senha segura.</p>
    <p><a href="${resetUrl}" style="display:inline-block;background:#22c55e;color:#0f172a;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Definir minha senha</a></p>
    <p style="color:#94a3b8;font-size:13px">Este link é individual, pode ser usado uma vez e expira em uma hora. Se você não reconhece esta compra, ignore esta mensagem.</p>
  </main>
</body></html>`.trim();
}

async function atualizarReserva(orderId: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = await getSupabaseClientAsync();
  if (!supabase) throw new Error("Banco de dados indisponível");
  const { error } = await supabase.from("kiwify_webhooks").update(patch).eq("order_id", orderId);
  if (error) throw new Error(`Falha ao atualizar evento Kiwify: ${error.message}`);
}

/**
 * Reserva order_id antes de criar conta ou enviar e-mail. O banco precisa ter
 * unicidade em order_id; a API retorna conflito de unicidade em reentregas.
 */
type ReservaEvento = {
  estado: "reservado" | "duplicado";
  status?: string | null;
  userId?: number | null;
};

async function reservarEvento(dados: DadosPedido): Promise<ReservaEvento> {
  const supabase = await getSupabaseClientAsync();
  if (!supabase) throw new Error("Banco de dados indisponível");

  const { error } = await supabase.from("kiwify_webhooks").insert({
    order_id: dados.orderId,
    email: mascararEmail(dados.email),
    nome: "Webhook Kiwify",
    status: "processando",
    payload: payloadMinimo(dados),
    email_enviado: 0,
  });

  if (!error) return { estado: "reservado" };
  // Postgres 23505 e a mensagem do PostgREST representam a mesma reentrega.
  if (error.code === "23505" || /duplicate|unique/i.test(error.message ?? "")) {
    const { data: existente, error: consultaErro } = await supabase
      .from("kiwify_webhooks")
      .select("status, user_criado")
      .eq("order_id", dados.orderId)
      .maybeSingle();
    if (consultaErro) throw new Error(`Falha ao ler evento Kiwify existente: ${consultaErro.message}`);
    return {
      estado: "duplicado",
      status: typeof existente?.status === "string" ? existente.status : null,
      userId: typeof existente?.user_criado === "number" ? existente.user_criado : null,
    };
  }
  throw new Error(`Falha ao reservar evento Kiwify: ${error.message}`);
}

export function statusDoConviteKiwify(entrega: EmailDeliveryResult): string {
  if (entrega.accepted) return "concluido";
  if (!entrega.deliveryKnown) return "email_confirmacao_pendente";
  return entrega.retryEligible ? "email_pendente" : "email_bloqueado";
}

type ResultadoCompra = { userId?: number; emailEnviado: boolean; existente: boolean; entrega?: EmailDeliveryResult };

async function enviarConviteDeDefinicaoDeSenha(userId: number, dados: DadosPedido): Promise<EmailDeliveryResult> {
  const supabase = await getSupabaseClientAsync();
  if (!supabase) throw new Error("Banco de dados indisponível");

  const token = crypto.randomBytes(32).toString("hex");
  const { error: resetErro } = await supabase.from("password_resets").insert({
    user_id: userId,
    token: hashResetToken(token),
    expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
  });
  if (resetErro) throw new Error(`Não foi possível emitir o link seguro: ${resetErro.message}`);

  // Registrar antes do POST: uma interrupção após aceite não autoriza reenvio.
  await atualizarReserva(dados.orderId, { status: "email_enviando", user_criado: userId });
  return enviarEmail({
    to: dados.email,
    toName: dados.nome,
    subject: "Defina sua senha de acesso ao CobraPro",
    htmlContent: htmlDefinirSenha(dados.nome, dados.produto, `${RESET_ORIGIN}/reset-senha?token=${token}`),
  });
}

async function criarContaEEnviarConvite(dados: DadosPedido): Promise<ResultadoCompra> {
  const supabase = await getSupabaseClientAsync();
  if (!supabase) throw new Error("Banco de dados indisponível");

  const { data: existente, error: consultaErro } = await supabase
    .from("users")
    .select("id")
    .eq("email", dados.email)
    .maybeSingle();
  if (consultaErro) throw new Error(`Falha ao consultar usuário: ${consultaErro.message}`);

  // Um webhook de venda nunca altera credencial, papel ou sessão de uma conta existente.
  if (existente?.id) return { userId: existente.id as number, emailEnviado: false, existente: true };

  const senhaAleatoria = crypto.randomBytes(48).toString("base64url");
  const passwordHash = await bcrypt.hash(senhaAleatoria, 12);
  const openId = `kiwify_${crypto.randomUUID()}`;
  const { data: criado, error: criacaoErro } = await supabase
    .from("users")
    .insert({
      openId,
      name: dados.nome,
      email: dados.email,
      passwordHash,
      loginMethod: "kiwify",
      role: "user",
      lastSignedIn: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (criacaoErro || !criado?.id) throw new Error(criacaoErro?.message ?? "Não foi possível criar a conta");

  await atualizarReserva(dados.orderId, { status: "convite_preparando", user_criado: criado.id });
  const entrega = await enviarConviteDeDefinicaoDeSenha(criado.id as number, dados);
  return { userId: criado.id as number, emailEnviado: entrega.accepted, existente: false, entrega };
}

async function processarCompraAprovada(dados: DadosPedido): Promise<ResultadoCompra> {
  const resultado = await criarContaEEnviarConvite(dados);
  await atualizarReserva(dados.orderId, {
    status: resultado.existente ? "usuario_existente" : statusDoConviteKiwify(resultado.entrega!),
    user_criado: resultado.userId ?? null,
    email_enviado: resultado.emailEnviado ? 1 : 0,
    erro: resultado.emailEnviado || resultado.existente ? null : `Convite: ${resultado.entrega?.kind}`,
  });
  return resultado;
}

export function registerKiwifyWebhookRoutes(app: Express) {
  app.post("/api/webhook/kiwify", async (req: RawBodyRequest, res: Response) => {
    const token = process.env.KIWIFY_WEBHOOK_TOKEN ?? "";
    if (!token) return res.status(503).json({ error: "Webhook temporariamente indisponível" });

    const signature = req.query.signature;
    const rawBody = req.rawBody;
    if (!rawBody || !assinaturaKiwifyEhValida(rawBody, signature, token)) {
      return res.status(401).json({ error: "Assinatura inválida" });
    }

    // Assinaturas nunca passam por reserva legada, criação de conta ou convite.
    // O runtime recebe EXATAMENTE os bytes autenticados, sem ler req.body.
    if (process.env.ENABLE_KIWIFY_SUBSCRIPTIONS === "true") {
      try {
        const result = await processVerifiedKiwifySubscription(rawBody);
        if (result.outcome === "consumed") {
          return res.status(200).json({ received: true });
        }
        if (result.outcome === "ignored") {
          if (result.reason === "product_not_allowed" || result.reason === "non_grant_event") {
            return res.status(200).json({ received: true, ignored: true });
          }
          if (result.reason === "user_not_unique" || result.reason === "no_current_paid_period") {
            // ACK definitivo perderia um evento legítimo sem conta/evidência.
            console.error("[KiwifySubscriptions] review_required");
            return res.status(503).json({ error: "Evento requer conferência antes de confirmação", needsReview: true, retry: true });
          }
        }
      } catch (error) {
        if (error instanceof KiwifySubscriptionError && error.code === "invalid_payload") {
          console.error("[KiwifySubscriptions] invalid_payload");
          return res.status(400).json({ error: "Payload de pedido inválido" });
        }
        // Não registrar erro original, códigos arbitrários, payload ou PII.
      }
      console.error("[KiwifySubscriptions] unavailable");
      return res.status(503).json({ error: "Webhook temporariamente indisponível", retry: true });
    }

    const payload = req.body as KiwifyPayload;
    const dados = extrairDadosPedido(payload);
    if (!dados) return res.status(400).json({ error: "Payload de pedido inválido" });

    if (!compraAprovada(dados)) {
      return res.status(200).json({ received: true, ignored: true });
    }

    try {
      const reserva = await reservarEvento(dados);
      if (reserva.estado === "duplicado") {
        // Uma falha temporária de e-mail pode ser retomada somente para a conta
        // que este mesmo pedido já criou. Nunca use uma reentrega para mexer em
        // conta preexistente com o mesmo e-mail.
        if (reserva.status === "email_pendente" && reserva.userId && reserva.userId > 0) {
          const supabase = await getSupabaseClientAsync();
          if (!supabase) throw new Error("Banco de dados indisponível");
          const { data: usuario, error: usuarioErro } = await supabase.from("users")
            .select("id, email, name").eq("id", reserva.userId).maybeSingle();
          if (usuarioErro || !usuario?.email || usuario.email.toLowerCase() !== dados.email) {
            return res.status(409).json({ error: "Pedido e conta de destino divergentes" });
          }
          // Somente uma reentrega pode adquirir o envio pendente.
          const { data: adquirida, error: adquirirErro } = await supabase.from("kiwify_webhooks")
            .update({ status: "convite_preparando" }).eq("order_id", dados.orderId)
            .eq("status", "email_pendente").eq("user_criado", reserva.userId)
            .select("user_criado").maybeSingle();
          if (adquirirErro) throw new Error("Reserva de convite indisponível");
          if (!adquirida) return res.status(200).json({ received: true, duplicate: true });
          const entrega = await enviarConviteDeDefinicaoDeSenha(reserva.userId, {
            ...dados, email: usuario.email, nome: usuario.name ?? "Cliente",
          });
          await atualizarReserva(dados.orderId, {
            status: statusDoConviteKiwify(entrega),
            email_enviado: entrega.accepted ? 1 : 0,
            erro: entrega.accepted ? null : `Convite: ${entrega.kind}`,
          });
          if (entrega.retryEligible) return res.status(503).json({ error: "Convite pendente de entrega" });
          if (!entrega.accepted) return res.status(200).json({ received: true, needsReview: true });
          return res.status(200).json({ received: true, retried: true });
        }
        return res.status(200).json({ received: true, duplicate: true });
      }
      const resultado = await processarCompraAprovada(dados);
      if (!resultado.existente && !resultado.emailEnviado) {
        if (resultado.entrega?.retryEligible) return res.status(503).json({ error: "Convite pendente de entrega" });
        return res.status(200).json({ received: true, needsReview: true });
      }
      return res.status(200).json({ received: true });
    } catch {
      // Nunca substituir um estado de envio por "erro": o POST ao provedor pode
      // ter sido aceito antes da queda. Estados incompletos exigem conferência.
      console.error("[Kiwify] Falha ao processar evento autenticado; conferir estado persistido.");
      return res.status(500).json({ error: "Não foi possível processar o evento" });
    }
  });

  app.get("/api/webhook/kiwify", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "CobraPro Kiwify Webhook" });
  });
}
