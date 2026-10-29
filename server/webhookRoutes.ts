import { timingSafeEqual } from "node:crypto";
import { Router, Request, Response } from "express";
import { getSupabaseClientAsync } from "./db";
import { ENV } from "./_core/env";

type StatusHistoricoEvolution = "aceito_evolution" | "entregue" | "lido";
type RegistroDesconhecido = Record<string, unknown>;

const EVENTOS_ACEITOS = new Set(["MESSAGES_UPDATE", "CONNECTION_UPDATE"]);
const MAX_ATUALIZACOES_POR_EVENTO = 50;
const MAX_ID_MENSAGEM = 256;
const MAX_ESTADO_CONEXAO = 64;

/** Eventos recebidos da Evolution API. A instância user-{id} é a fronteira de
 * isolamento: nunca aceitamos um evento sem conseguir associá-lo ao assinante. */
function userIdDaInstancia(instancia: unknown): number | null {
  const match = typeof instancia === "string" ? /^user-(\d+)$/.exec(instancia) : null;
  const userId = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

function ehRegistro(valor: unknown): valor is RegistroDesconhecido {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

export function statusHistoricoEvolution(valor: unknown): StatusHistoricoEvolution | null {
  const status = String(valor ?? "").trim().toUpperCase();
  if (["READ", "READ_ACK", "PLAYED", "PLAYED_ACK", "4", "5"].includes(status)) return "lido";
  if (["DELIVERY_ACK", "DELIVERED", "3"].includes(status)) return "entregue";
  if (["SERVER_ACK", "SENT", "2"].includes(status)) return "aceito_evolution";
  return null;
}

const ORDEM_STATUS: Record<StatusHistoricoEvolution, number> = {
  aceito_evolution: 1,
  entregue: 2,
  lido: 3,
};

// "enviado" é o status histórico já gravado pelo worker após a Evolution
// aceitar a requisição. Para recibos, ele tem a mesma posição de aceite.
const ORDEM_STATUS_EXISTENTE: Record<string, number> = {
  ...ORDEM_STATUS,
  enviado: ORDEM_STATUS.aceito_evolution,
};

/** Um callback atrasado nunca pode reduzir o status já exibido ao usuário. */
export function deveAvancarStatusHistorico(atual: unknown, proximo: StatusHistoricoEvolution): boolean {
  const ordemAtual = typeof atual === "string" ? ORDEM_STATUS_EXISTENTE[atual] ?? 0 : 0;
  return ORDEM_STATUS[proximo] > ordemAtual;
}

function statusAnterioresPermitidos(proximo: StatusHistoricoEvolution): string[] {
  return Object.keys(ORDEM_STATUS_EXISTENTE)
    .filter((status) => ORDEM_STATUS_EXISTENTE[status] < ORDEM_STATUS[proximo]);
}

function extrairAtualizacoes(data: RegistroDesconhecido): RegistroDesconhecido[] {
  const candidatas = Array.isArray(data.updates)
    ? data.updates
    : data.key && (data.update || data.status)
      ? [data]
      : [];
  return candidatas.filter(ehRegistro).slice(0, MAX_ATUALIZACOES_POR_EVENTO);
}

function atualizacaoRastreavel(update: RegistroDesconhecido): { messageId: string; status: StatusHistoricoEvolution } | null {
  const key = ehRegistro(update.key) ? update.key : null;
  const updateData = ehRegistro(update.update) ? update.update : update;
  const messageId = typeof key?.id === "string" ? key.id.trim() : "";
  const status = statusHistoricoEvolution(updateData.status ?? update.status);
  // A Evolution pode omitir fromMe em algumas versões. Se vier explicitamente
  // como false, o evento é de uma mensagem recebida e não pertence à nossa outbox.
  if (key?.fromMe === false || !messageId || messageId.length > MAX_ID_MENSAGEM || !status) return null;
  return { messageId, status };
}

/** Minimiza retenção: não grava corpo de mensagem, telefone/JID, mídia ou metadados do provedor. */
export function resumirEventoWebhook(event: string, instancia: string, userId: number, data: RegistroDesconhecido): Record<string, unknown> {
  if (event === "MESSAGES_UPDATE") {
    return {
      event,
      instance: instancia,
      userId,
      updates: extrairAtualizacoes(data).map(atualizacaoRastreavel).filter(Boolean),
    };
  }
  const instanceData = ehRegistro(data.instance) ? data.instance : {};
  const state = String(instanceData.state ?? data.state ?? "unknown").trim().slice(0, MAX_ESTADO_CONEXAO) || "unknown";
  return { event, instance: instancia, userId, state };
}

export function validarTokenWebhook(configuredToken: string, receivedToken: unknown): "ok" | "ausente" | "invalido" {
  if (!configuredToken) return "ausente";
  if (typeof receivedToken !== "string") return "invalido";
  const esperado = Buffer.from(configuredToken);
  const recebido = Buffer.from(receivedToken);
  if (esperado.length !== recebido.length) return "invalido";
  return timingSafeEqual(esperado, recebido) ? "ok" : "invalido";
}

export function registerWebhookRoutes(app: Router) {
  app.post("/api/webhook/evolution", async (req: Request, res: Response) => {
    const configuredToken = ENV.evolutionWebhookToken;
    const receivedToken = typeof req.query.token === "string" ? req.query.token : req.header("x-cobrapro-webhook-token");
    const tokenStatus = validarTokenWebhook(configuredToken, receivedToken);
    // A chave de serviço do Supabase não pode receber eventos sem um segredo
    // configurado. Falhar fechado previne alteração de estado de outra empresa.
    if (tokenStatus === "ausente") {
      console.error("[Webhook Evolution] Token de autenticação não configurado; evento recusado.");
      return res.status(503).json({ received: false, error: "Webhook temporariamente indisponível" });
    }
    if (tokenStatus === "invalido") {
      return res.status(401).json({ received: false, error: "Webhook não autorizado" });
    }

    try {
      const processado = await processWebhookEvent(req.body);
      // Eventos fora da allowlist são reconhecidos para não gerar retry infinito,
      // porém nunca são persistidos ou autorizados a alterar estado.
      return res.status(processado ? 200 : 202).json({ received: processado });
    } catch (err) {
      // Não confirmar ao provedor um evento que não foi persistido/processado.
      // O retry da Evolution é seguro porque a atualização de status é monotônica.
      console.error("[Webhook Evolution] Erro ao processar:", err);
      return res.status(503).json({ received: false, error: "Webhook temporariamente indisponível" });
    }
  });

  app.get("/api/webhook/evolution", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "CobraPro Evolution Webhook", timestamp: new Date().toISOString() });
  });
}

async function atualizarStatusMensagem(
  sb: NonNullable<Awaited<ReturnType<typeof getSupabaseClientAsync>>>,
  userId: number,
  providerMessageId: string,
  status: StatusHistoricoEvolution,
) {
  const agora = new Date().toISOString();
  const { data: outbox, error } = await sb.from("whatsapp_outbox")
    .select("id")
    .eq("user_id", userId).eq("provider_message_id", providerMessageId);
  if (error) throw new Error(`Não foi possível localizar a outbox: ${error.message}`);
  // Se o recibo chegou antes de o worker persistir o provider_message_id,
  // devolvemos 5xx ao provedor para que ele o reenvie após o vínculo existir.
  if (!outbox?.length) throw new Error("Outbox ainda não vinculada ao recibo; solicitar retry seguro");

  for (const item of outbox ?? []) {
    const outboxId = String(item.id);
    // Garante que um callback mais rápido que o worker ainda deixa histórico
    // rastreável. ignoreDuplicates jamais sobrescreve um estado mais avançado.
    const { error: criarLogError } = await sb.from("notificacoes_log").upsert({
      outbox_id: outboxId,
      user_id: userId,
      tipo: "status_evolution",
      status,
      erro: null,
      createdAt: agora,
    }, { onConflict: "outbox_id", ignoreDuplicates: true });
    if (criarLogError) throw new Error(`Não foi possível preparar o histórico: ${criarLogError.message}`);

    const { error: logError } = await sb.from("notificacoes_log")
      .update({ status, erro: null })
      .eq("outbox_id", outboxId).eq("user_id", userId)
      .in("status", statusAnterioresPermitidos(status));
    if (logError) throw new Error(`Não foi possível atualizar histórico: ${logError.message}`);

    const { error: outboxError } = await sb.from("whatsapp_outbox")
      .update({ updated_at: agora })
      .eq("id", outboxId).eq("user_id", userId);
    if (outboxError) throw new Error(`Não foi possível atualizar a outbox: ${outboxError.message}`);
  }
}

async function processWebhookEvent(payload: unknown): Promise<boolean> {
  if (!ehRegistro(payload)) return false;
  const event = typeof payload.event === "string" ? payload.event.trim() : "";
  const instancia = typeof payload.instance === "string" ? payload.instance.trim() : "";
  const data = ehRegistro(payload.data) ? payload.data : {};
  const userId = userIdDaInstancia(instancia);
  if (!EVENTOS_ACEITOS.has(event) || !userId) {
    console.warn("[Webhook Evolution] Evento ignorado: tipo ou instância não reconhecidos");
    return false;
  }

  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Supabase indisponível");
  const agora = new Date().toISOString();
  const { error: eventoError } = await sb.from("whatsapp_eventos").insert({
    evento: event,
    instancia,
    // O payload completo pode carregar PII e mídia. Mantemos somente a evidência necessária.
    payload: JSON.stringify(resumirEventoWebhook(event, instancia, userId, data)),
    criado_em: agora,
  });
  if (eventoError) throw new Error(`Não foi possível persistir evento: ${eventoError.message}`);

  if (event === "MESSAGES_UPDATE") {
    for (const update of extrairAtualizacoes(data)) {
      const rastreavel = atualizacaoRastreavel(update);
      if (rastreavel) await atualizarStatusMensagem(sb, userId, rastreavel.messageId, rastreavel.status);
    }
    return true;
  }

  const instanceData = ehRegistro(data.instance) ? data.instance : {};
  const state = String(instanceData.state ?? data.state ?? "unknown").trim().slice(0, MAX_ESTADO_CONEXAO) || "unknown";
  const { error } = await sb.from("configuracoes").upsert(
    { chave: "evolution_connection_state", valor: state, user_id: userId },
    { onConflict: "chave,user_id" },
  );
  if (error) throw new Error(`Não foi possível salvar conexão: ${error.message}`);
  return true;
}
