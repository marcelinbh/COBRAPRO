import { describe, expect, it } from "vitest";
import { calcularSaldoResidual, calcularValorAbertoParcela } from "../shared/finance";

describe("pagamentos parciais", () => {
  it("mantém o saldo devedor na própria parcela sem somar novamente o principal", () => {
    const saldoAposPrimeiroPagamento = calcularSaldoResidual(150, 60);

    expect(saldoAposPrimeiroPagamento).toBe(90);
    expect(calcularValorAbertoParcela({
      status: "parcial",
      valorOriginal: "150.00",
      saldoResidual: saldoAposPrimeiroPagamento,
      valorMulta: "0.00",
    })).toBe(90);
  });

  it("permite novo pagamento parcial usando apenas o saldo pendente", () => {
    const saldoInicial = calcularSaldoResidual(150, 60);
    const saldoAposSegundoPagamento = calcularSaldoResidual(saldoInicial, 50);

    expect(saldoAposSegundoPagamento).toBe(40);
    expect(calcularValorAbertoParcela({
      status: "parcial",
      valorOriginal: "150.00",
      saldoResidual: saldoAposSegundoPagamento,
      valorMulta: "15.00",
    })).toBe(40);
  });

  it("preserva registros legados sem saldo residual, sem esconder o principal em aberto", () => {
    expect(calcularValorAbertoParcela({
      status: "parcial",
      valorOriginal: "150.00",
      saldoResidual: null,
      valorMulta: "15.00",
    })).toBe(165);
  });

  it("continua incluindo multa e saldo legado nas parcelas ainda não parcialmente pagas", () => {
    expect(calcularValorAbertoParcela({
      status: "atrasada",
      valorOriginal: "150.00",
      saldoResidual: "20.00",
      valorMulta: "15.00",
    })).toBe(185);
  });
});
