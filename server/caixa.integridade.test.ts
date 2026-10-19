import { calcularSaldoAtual } from "../shared/caixa";
import { describe, expect, it } from "vitest";

describe("integridade do Caixa", () => {
  it("debita uma despesa exatamente uma vez", () => {
    const saldo = calcularSaldoAtual("1000.00", [
      { tipo: "saida", valor: "250.75" },
    ]);

    expect(saldo).toBe(749.25);
  });

  it("restaura o valor ao estornar uma despesa sem apagar o histórico", () => {
    const saldo = calcularSaldoAtual(1000, [
      { tipo: "saida", valor: 250 },
      { tipo: "entrada", valor: 250 },
    ]);

    expect(saldo).toBe(1000);
  });

  it("mantém centavos precisos após múltiplas movimentações", () => {
    const saldo = calcularSaldoAtual("10.00", [
      { tipo: "entrada", valor: "0.10" },
      { tipo: "entrada", valor: "0.20" },
      { tipo: "saida", valor: "0.30" },
    ]);

    expect(saldo).toBe(10);
  });

  it("ignora valores vazios em vez de corromper o saldo", () => {
    expect(calcularSaldoAtual("50.00", [
      { tipo: "entrada", valor: null },
      { tipo: "saida", valor: undefined },
    ])).toBe(50);
  });
});
