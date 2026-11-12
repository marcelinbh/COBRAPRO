import { describe, expect, it } from "vitest";
import { calcularSaldoAtual, calcularSaldoAtualDecimal, type MovimentoCaixa } from "../shared/caixa";

const entradas: MovimentoCaixa[] = Array.from({ length: 10 }, () => ({ tipo: "entrada", valor: "9999999999999.99" }));
const saidas: MovimentoCaixa[] = Array.from({ length: 10 }, () => ({ tipo: "saida", valor: "9999999999999.99" }));
describe("saldo do Caixa com acumulador decimal exato", () => {
  it("conserva saldo após despesas e estornos altos agrupados", () => {
    expect(calcularSaldoAtual("1000.00", [...saidas, ...entradas])).toBe(1000);
    expect(calcularSaldoAtual("1000.00", [...entradas, ...saidas])).toBe(1000);
    expect(calcularSaldoAtualDecimal("1000.00", [...saidas, ...entradas])).toBe("1000.00");
  });
  it("transporta acumulado negativo alto exatamente, sem perder centavo", () => {
    expect(calcularSaldoAtualDecimal("1000.00", saidas)).toBe("-99999999998999.90");
  });
  it("resultado numérico impossível não é arredondado silenciosamente", () => {
    expect(() => calcularSaldoAtual("9007199254740992.01", [])).toThrow();
    expect(calcularSaldoAtualDecimal("9007199254740992.01", [])).toBe("9007199254740992.01");
  });
  it.each([NaN, Infinity, -Infinity, "NaN", "infinity", "", "R$ 10.00", "1.001", "0.30000000000000004"])("valor %s inválido não vira zero", valor => {
    expect(() => calcularSaldoAtual("100.00", [{ tipo: "entrada", valor }])).toThrow();
  });
  it("direção desconhecida ou lançamento negativo não é reinterpretado", () => {
    expect(() => calcularSaldoAtual("100.00", [{ tipo: "transferencia", valor: "10.00" } as any])).toThrow();
    expect(() => calcularSaldoAtual("100.00", [{ tipo: "saida", valor: "-10.00" }])).toThrow();
  });
  it("saldo-base negativo continua válido e é acumulado exatamente", () => {
    expect(calcularSaldoAtualDecimal("-0.01", [{ tipo: "entrada", valor: "0.01" }])).toBe("0.00");
  });
});
