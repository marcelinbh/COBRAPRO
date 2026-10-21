import { describe, expect, it } from "vitest";
import { validarTokenWebhook } from "./webhookRoutes";

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
