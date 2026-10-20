import { describe, expect, it } from "vitest";
import { calcularJurosMora } from "../shared/finance";

describe("regressão de mora — cobrança somente quando configurada", () => {
  const vencimento = new Date("2026-10-01T12:00:00-03:00");
  const referencia = new Date("2026-10-11T12:00:00-03:00");

  it("não cria juros de R$100/dia quando a multa diária não foi ativada", () => {
    expect(calcularJurosMora(1_500, vencimento, referencia, 0, 0)).toMatchObject({
      diasAtraso: 10,
      juros: 0,
      multa: 0,
      total: 1_500,
    });
  });

  it("calcula apenas a multa configurada após o primeiro dia de atraso", () => {
    expect(calcularJurosMora(1_000, vencimento, referencia, 0.33, 2)).toMatchObject({
      diasAtraso: 10,
      juros: 3.3,
      multa: 20,
      total: 1_023.3,
    });
  });
});
