import { describe, expect, it } from "vitest";
import {
  deveAvancarStatusHistorico,
  resumirEventoWebhook,
  statusHistoricoEvolution,
  validarTokenWebhook,
} from "./webhookRoutes";

describe("webhook Evolution - autenticação fail-closed", () => {
  it("recusa o evento quando o segredo não foi configurado", () => {
    expect(validarTokenWebhook("", "qualquer-token")).toBe("ausente");
  });

  it("recusa token ausente, diferente ou de tamanho diferente", () => {
    expect(validarTokenWebhook("segredo-longo", undefined)).toBe("invalido");
    expect(validarTokenWebhook("segredo-longo", "segredo-curto")).toBe("invalido");
    expect(validarTokenWebhook("segredo-longo", "segredo-longa")).toBe("invalido");
  });

  it("aceita somente a credencial exata", () => {
    expect(validarTokenWebhook("segredo-longo", "segredo-longo")).toBe("ok");
  });
});

describe("webhook Evolution - recibos seguros", () => {
  it("normaliza somente os estados de entrega conhecidos", () => {
    expect(statusHistoricoEvolution("SERVER_ACK")).toBe("aceito_evolution");
    expect(statusHistoricoEvolution("DELIVERED")).toBe("entregue");
    expect(statusHistoricoEvolution("READ")).toBe("lido");
    expect(statusHistoricoEvolution("estado-desconhecido")).toBeNull();
  });

  it("nunca reduz um status de leitura por callback atrasado", () => {
    expect(deveAvancarStatusHistorico("aceito_evolution", "entregue")).toBe(true);
    expect(deveAvancarStatusHistorico("enviado", "entregue")).toBe(true);
    expect(deveAvancarStatusHistorico("entregue", "lido")).toBe(true);
    expect(deveAvancarStatusHistorico("lido", "entregue")).toBe(false);
    expect(deveAvancarStatusHistorico("lido", "aceito_evolution")).toBe(false);
    expect(deveAvancarStatusHistorico("lido", "lido")).toBe(false);
  });

  it("persiste um resumo sem corpo, JID, mídia ou payload bruto", () => {
    const resumo = resumirEventoWebhook("MESSAGES_UPDATE", "user-42", 42, {
      updates: [{
        key: { id: "provider-message-id", remoteJid: "5531999999999@s.whatsapp.net", fromMe: true },
        update: { status: "READ", message: { conversation: "conteúdo confidencial" } },
        message: { imageMessage: { caption: "documento" } },
      }],
    });
    const serializado = JSON.stringify(resumo);
    expect(resumo).toEqual({
      event: "MESSAGES_UPDATE",
      instance: "user-42",
      userId: 42,
      updates: [{ messageId: "provider-message-id", status: "lido" }],
    });
    expect(serializado).not.toContain("remoteJid");
    expect(serializado).not.toContain("confidencial");
    expect(serializado).not.toContain("imageMessage");
  });

  it("descarta recibo de mensagem recebida e limita lotes malformados", () => {
    const resumo = resumirEventoWebhook("MESSAGES_UPDATE", "user-42", 42, {
      updates: [
        { key: { id: "inbound", fromMe: false }, update: { status: "READ" } },
        { key: { id: "outbound".repeat(100), fromMe: true }, update: { status: "READ" } },
        { key: { id: "valido", fromMe: true }, update: { status: "DELIVERED" } },
        null,
      ],
    });
    expect(resumo).toEqual({
      event: "MESSAGES_UPDATE",
      instance: "user-42",
      userId: 42,
      updates: [{ messageId: "valido", status: "entregue" }],
    });
  });
});
