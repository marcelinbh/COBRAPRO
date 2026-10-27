import { describe, expect, it } from "vitest";
import { calcularDescontoCheque, dataChequeValida } from "./chequesFinanceiros";

describe("calcularDescontoCheque", () => {
  it("mantém valor nominal quando o cheque vence hoje", () => {
    const resultado = calcularDescontoCheque({ valorNominal: 1000, taxaPercentual: 10, tipoTaxa: "mensal", diasAteVencimento: 0 });
    expect(resultado.valorLiquido).toBeCloseTo(1000, 8);
    expect(resultado.valorDesconto).toBeCloseTo(0, 8);
  });

  it("calcula corretamente uma taxa semanal para sete dias", () => {
    const resultado = calcularDescontoCheque({ valorNominal: 1000, taxaPercentual: 7, tipoTaxa: "semanal", diasAteVencimento: 7 });
    expect(resultado.valorLiquido).toBeCloseTo(934.5794, 4);
    expect(resultado.valorDesconto).toBeCloseTo(65.4206, 4);
  });

  it("calcula corretamente uma taxa quinzenal para quinze dias", () => {
    const resultado = calcularDescontoCheque({ valorNominal: 1000, taxaPercentual: 15, tipoTaxa: "quinzenal", diasAteVencimento: 15 });
    expect(resultado.valorLiquido).toBeCloseTo(869.5652, 4);
    expect(resultado.valorDesconto).toBeCloseTo(130.4348, 4);
  });

  it("rejeita vencimento anterior ao dia da operação", () => {
    expect(() => calcularDescontoCheque({ valorNominal: 1000, taxaPercentual: 1, tipoTaxa: "diaria", diasAteVencimento: -1 })).toThrow("Vencimento inválido");
  });

  it("rejeita datas civis inexistentes sem normalizá-las", () => {
    expect(dataChequeValida("2026-02-31")).toBe(false);
    expect(dataChequeValida("2026-02-28")).toBe(true);
  });
});
