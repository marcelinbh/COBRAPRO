import { Router, Request, Response } from "express";
import { getSupabaseClientAsync } from "./db";

/**
 * Webhook da Evolution API
 * 
 * A Evolution API v1.x envia eventos POST para este endpoint.
 * Eventos suportados:
 *   - MESSAGES_UPSERT: nova mensagem recebida/enviada
 *   - MESSAGES_UPDATE: status de mensagem atualizado (entregue, lido)
 *   - CONNECTION_UPDATE: status da conexão WhatsApp mudou
 *   - QRCODE_UPDATED: novo QR Code gerado
 */

export function registerWebhookRoutes(app: Router) {
  // Endpoint principal do webhook
  app.post("/api/webhook/evolution", async (req: Request, res: Response) => {
    try {
      const payload = req.body;

      // Responder imediatamente para não deixar a Evolution API esperando
      res.status(200).json({ received: true });

      // Processar o evento em background
      await processWebhookEvent(payload);
    } catch (err) {
      console.error("[Webhook Evolution] Erro ao processar:", err);
      res.status(200).json({ received: true }); // Sempre 200 para evitar reenvios
    }
  });

  // Endpoint de verificação (health check do webhook)
  app.get("/api/webhook/evolution", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "CobraPro Evolution Webhook", timestamp: new Date().toISOString() });
  });
}

async function processWebhookEvent(payload: Record<string, unknown>) {
  try {
    const event = payload?.event as string;
    const instance = payload?.instance as string;
    const data = payload?.data as Record<string, unknown>;

    if (!event) return;

    console.log(`[Webhook Evolution] Evento: ${event} | Instância: ${instance}`);

    const sb = await getSupabaseClientAsync();
    if (!sb) {
      console.error("[Webhook Evolution] Supabase indisponível");
      return;
    }

    // Salvar evento no banco para auditoria
    await sb.from("whatsapp_eventos").insert({
      evento: event,
      instancia: instance || "cobrapro",
      payload: JSON.stringify(payload),
      criado_em: new Date().toISOString(),
    }).then(({ error }: { error: unknown }) => {
      if (error) console.warn("[Webhook Evolution] Erro ao salvar evento:", error);
    });

    // Processar eventos específicos
    switch (event) {
      case "MESSAGES_UPDATE": {
        // Atualizar status de mensagens enviadas (entregue, lido)
        if (Array.isArray(data?.updates)) {
          for (const update of data.updates as Array<Record<string, unknown>>) {
            const msgId = (update?.key as Record<string, unknown>)?.id as string;
            const status = (update?.update as Record<string, unknown>)?.status as string;
            if (msgId && status) {
              await sb.from("whatsapp_mensagens")
                .update({ status_entrega: status, atualizado_em: new Date().toISOString() })
                .eq("evolution_msg_id", msgId)
                .then(({ error }: { error: unknown }) => {
                  if (error) console.warn("[Webhook Evolution] Erro ao atualizar status:", error);
                });
            }
          }
        }
        break;
      }

      case "MESSAGES_UPSERT": {
        // Nova mensagem recebida (resposta do cliente)
        const msgs = Array.isArray(data?.messages) ? data.messages as Array<Record<string, unknown>> : [];
        for (const msg of msgs) {
          const fromMe = (msg?.key as Record<string, unknown>)?.fromMe as boolean;
          if (!fromMe) {
            // Mensagem recebida do cliente — registrar para acompanhamento
            const remoteJid = (msg?.key as Record<string, unknown>)?.remoteJid as string;
            const text = (msg?.message as Record<string, unknown>)?.conversation as string
              || ((msg?.message as Record<string, unknown>)?.extendedTextMessage as Record<string, unknown>)?.text as string
              || "";
            
            console.log(`[Webhook Evolution] Mensagem recebida de ${remoteJid}: ${text.substring(0, 50)}`);
            
            await sb.from("whatsapp_eventos").insert({
              evento: "MENSAGEM_RECEBIDA",
              instancia: instance || "cobrapro",
              payload: JSON.stringify({ remoteJid, text, timestamp: msg?.messageTimestamp }),
              criado_em: new Date().toISOString(),
            }).then(({ error }: { error: unknown }) => {
              if (error) console.warn("[Webhook Evolution] Erro ao salvar mensagem recebida:", error);
            });
          }
        }
        break;
      }

      case "CONNECTION_UPDATE": {
        // Status da conexão mudou
        const state = (data?.instance as Record<string, unknown>)?.state as string || data?.state as string;
        console.log(`[Webhook Evolution] Conexão: ${state}`);
        
        // Salvar estado atual da conexão
        await sb.from("configuracoes").upsert(
          { chave: "evolution_connection_state", valor: state || "unknown" },
          { onConflict: "chave,user_id" }
        ).then(({ error }: { error: unknown }) => {
          if (error) console.warn("[Webhook Evolution] Erro ao salvar estado:", error);
        });
        break;
      }

      case "QRCODE_UPDATED": {
        console.log("[Webhook Evolution] Novo QR Code gerado");
        break;
      }

      default:
        console.log(`[Webhook Evolution] Evento não tratado: ${event}`);
    }
  } catch (err) {
    console.error("[Webhook Evolution] Erro no processamento:", err);
  }
}
