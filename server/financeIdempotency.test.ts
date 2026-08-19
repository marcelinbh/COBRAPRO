import { describe, expect, it } from "vitest";
import { chavePagamentoParcela, podeRegistrarMovimento } from "./financeIdempotency";

describe("idempotência financeira", () => {
  it("aceita somente estados ainda liquidáveis", () => {
    expect(podeRegistrarMovimento("pendente", ["pendente", "atrasada"])).toBe(true);
    expect(podeRegistrarMovimento("paga", ["pendente", "atrasada"])).toBe(false);
  });

  it("gera chave estável para pagamentos repetidos da mesma parcela", () => {
    expect(chavePagamentoParcela(42, 150.5)).toBe("42:15050");
  });
});
