import { Router, Request, Response } from "express";
import { getSupabaseClientAsync } from "./db";
import { ENV } from "./_core/env";

/** Eventos recebidos da Evolution API. A instância user-{id} é a fronteira de
 * isolamento: nunca aceitamos um evento sem conseguir associá-lo ao assinante. */
function userIdDaInstancia(instancia: unknown): number | null {
  const match = typeof instancia === "string" ? /^user-(\d+)$/.exec(instancia) : null;
  const userId = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

function statusHistoricoEvolution(valor: unknown): "aceito_evolution" | "entregue" | "lido" | null {
  const status = String(valor ?? "").trim().toUpperCase();
  if (["READ", "READ_ACK", "PLAYED", "PLAYED_ACK", "4", "5"].includes(status)) return "lido";
  if (["DELIVERY_ACK", "DELIVERED", "3"].includes(status)) return "entregue";
  if (["SERVER_ACK", "SENT", "2"].includes(status)) return "aceito_evolution";
  return null;
}

function extrairAtualizacoes(data: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(data.updates)) return data.updates as Array<Record<string, unknown>>;
  // A Evolution pode enviar uma única atualização diretamente em data.
  if (data.key && (data.update || data.status)) return [data];
  return [];
}

export function registerWebhookRoutes(app: Router) {
  app.post("/api/webhook/evolution", async (req: Request, res: Response) => {
    const configuredToken = ENV.evolutionWebhookToken;
    const receivedToken = typeof req.query.token === "string" ? req.query.token : req.header("x-cobrapro-webhook-token");
    if (configuredToken && receivedToken !== configuredToken) {
      return res.status(401).json({ received: false, error: "Webhook não autorizado" });
    }
    // A resposta rápida impede que o provedor repita um evento já aceito. O
    // processamento não pode escrever nenhum dado se a instância for inválida.
    res.status(200).json({ received: true });
    try {
      await processWebhookEvent(req.body as Record<string, unknown>);
    } catch (err) {
      console.error("[Webhook Evolution] Erro ao processar:", err);
    }
  });

  app.get("/api/webhook/evolution", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "CobraPro Evolution Webhook", timestamp: new Date().toISOString() });
  });
}

async function atualizarStatusMensagem(
  sb: Awaited<ReturnType<typeof getSupabaseClientAsync>>,
  userId: number,
  providerMessageId: string,
  status: "aceito_evolution" | "entregue" | "lido",
) {
  if (!sb) return;
  const agora = new Date().toISOString();
  const { data: outbox, error } = await sb.from("whatsapp_outbox")
    .update({ updated_at: agora })
    .eq("user_id", userId).eq("provider_message_id", providerMessageId)
    .select("id");
  if (error) {
    console.warn("[Webhook Evolution] Não foi possível localizar a outbox:", error.message);
    return;
  }
  for (const item of outbox ?? []) {
    const { error: logError } = await sb.from("notificacoes_log")
      .update({ status, erro: null })
      .eq("outbox_id", item.id).eq("user_id", userId);
    if (logError) console.warn("[Webhook Evolution] Não foi possível atualizar histórico:", logError.message);
  }
}

async function processWebhookEvent(payload: Record<string, unknown>) {
  const event = payload?.event as string;
  const instancia = payload?.instance as string;
  const data = (payload?.data ?? {}) as Record<string, unknown>;
  const userId = userIdDaInstancia(instancia);
  if (!event || !userId) {
    console.warn("[Webhook Evolution] Evento ignorado: instância não reconhecida");
    return;
  }

  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Supabase indisponível");
  const agora = new Date().toISOString();
  const { error: eventoError } = await sb.from("whatsapp_eventos").insert({
    evento: event,
    instancia,
    payload: JSON.stringify(payload),
    criado_em: agora,
  });
  if (eventoError) console.warn("[Webhook Evolution] Erro ao salvar evento:", eventoError.message);

  if (event === "MESSAGES_UPDATE") {
    for (const update of extrairAtualizacoes(data)) {
      const key = (update.key ?? {}) as Record<string, unknown>;
      const updateData = (update.update ?? update) as Record<string, unknown>;
      const messageId = key.id as string | undefined;
      const status = statusHistoricoEvolution(updateData.status ?? update.status);
      if (messageId && status) await atualizarStatusMensagem(sb, userId, messageId, status);
    }
    return;
  }

  if (event === "CONNECTION_UPDATE") {
    const instanceData = (data.instance ?? {}) as Record<string, unknown>;
    const state = String(instanceData.state ?? data.state ?? "unknown");
    const { error } = await sb.from("configuracoes").upsert(
      { chave: "evolution_connection_state", valor: state, user_id: userId },
      { onConflict: "chave,user_id" },
    );
    if (error) console.warn("[Webhook Evolution] Erro ao salvar conexão:", error.message);
  }
}
