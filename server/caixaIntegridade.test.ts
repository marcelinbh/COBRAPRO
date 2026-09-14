import { describe, expect, it } from "vitest";
import { calcularSaldoAtual } from "../shared/caixa";

describe("integridade do Caixa", () => {
  it("aplica uma despesa apenas uma vez no saldo", () => {
    expect(calcularSaldoAtual("1000.00", [
      { tipo: "saida", valor: "250.75" },
    ])).toBe(749.25);
  });

  it("restaura o saldo quando a despesa é estornada", () => {
    expect(calcularSaldoAtual(1000, [
      { tipo: "saida", valor: 250 },
      { tipo: "entrada", valor: 250 },
    ])).toBe(1000);
  });

  it("preserva a precisão em centavos", () => {
    expect(calcularSaldoAtual("10.00", [
      { tipo: "entrada", valor: "0.10" },
      { tipo: "entrada", valor: "0.20" },
      { tipo: "saida", valor: "0.30" },
    ])).toBe(10);
  });
});
