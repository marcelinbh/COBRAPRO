import { describe, expect, it } from "vitest";
import { calcularSaldoAtual } from "../shared/caixa";

describe("cálculo de saldo do Caixa", () => {
  it("conta cada lançamento exatamente uma vez", () => {
    const saldo = calcularSaldoAtual("1000.00", [
      { tipo: "entrada", valor: "250.00" },
      { tipo: "saida", valor: "120.50" },
    ]);

    expect(saldo).toBe(1129.5);
  });

  it("não duplica um ajuste manual já presente no livro de movimentos", () => {
    const saldoBase = 100000;
    const movimentos = [
      { tipo: "entrada" as const, valor: 116074 },
      { tipo: "saida" as const, valor: 115843 },
      { tipo: "entrada" as const, valor: 116.07 },
      { tipo: "saida" as const, valor: 115.84 },
    ];

    expect(calcularSaldoAtual(saldoBase, movimentos)).toBe(100231.23);
  });

  it("aceita valores nulos sem corromper o saldo", () => {
    expect(calcularSaldoAtual("50.00", [
      { tipo: "entrada", valor: null },
      { tipo: "saida", valor: undefined },
    ])).toBe(50);
  });
});
