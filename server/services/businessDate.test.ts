import { describe, expect, it } from "vitest";
import { adicionarDiasData, dataHojeBrasilia, diferencaDiasData, horarioBrasilia } from "./businessDate";
import { calcularJurosMora, getStatusParcela } from "../../shared/finance";

describe("calendário financeiro de Brasília", () => {
  it("não antecipa a data comercial quando UTC já mudou, mas Brasília ainda está no dia anterior", () => {
    const instante = new Date("2026-10-20T02:30:00.000Z"); // 23:30 do dia 19 em Brasília
    expect(dataHojeBrasilia(instante)).toBe("2026-10-19");
    expect(horarioBrasilia(instante)).toBe("23:30:00");
  });

  it("soma datas civis sem alteração de fuso em troca de mês", () => {
    expect(adicionarDiasData("2026-01-30", 3)).toBe("2026-02-02");
    expect(diferencaDiasData("2026-10-19", "2026-10-20")).toBe(1);
  });

  it("só aplica multa depois de o dia do vencimento terminar em Brasília", () => {
    const vencimento = new Date("2026-10-19T12:00:00-03:00");
    const aindaNoVencimento = new Date("2026-10-20T02:59:59.000Z"); // 23:59:59 BRT do dia 19
    const primeiroMinutoEmAtraso = new Date("2026-10-20T03:00:00.000Z");

    expect(calcularJurosMora(100, vencimento, aindaNoVencimento, 2, 10)).toMatchObject({ diasAtraso: 0, juros: 0, multa: 0, total: 100 });
    expect(calcularJurosMora(100, vencimento, primeiroMinutoEmAtraso, 2, 10)).toMatchObject({ diasAtraso: 1, juros: 2, multa: 10, total: 112 });
  });

  it("classifica o status pelo calendário brasileiro", () => {
    expect(getStatusParcela("pendente", "2099-01-01")).toBe("pendente");
    expect(getStatusParcela("paga", "2000-01-01")).toBe("paga");
    expect(getStatusParcela("parcial", "2000-01-01")).toBe("parcial");
  });
});
