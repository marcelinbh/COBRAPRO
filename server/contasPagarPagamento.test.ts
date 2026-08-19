import { describe, expect, it } from "vitest";
import { dataPagamentoParaBanco, statusPodeSerPago } from "./contasPagarPagamento";

describe("pagamento de contas a pagar", () => {
  it("normaliza a data para funcionar com campos DATE e TIMESTAMP", () => {
    expect(dataPagamentoParaBanco(new Date("2026-08-19T15:30:00.000Z"))).toBe("2026-08-19");
  });

  it("permite pagar somente contas pendentes ou atrasadas", () => {
    expect(statusPodeSerPago("pendente")).toBe(true);
    expect(statusPodeSerPago("atrasada")).toBe(true);
    expect(statusPodeSerPago("paga")).toBe(false);
    expect(statusPodeSerPago("cancelada")).toBe(false);
  });
});
