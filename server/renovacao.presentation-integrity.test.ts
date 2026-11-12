import { describe, expect, it } from "vitest";
import { calcularValorAbertoParcela, getStatusParcela } from "../shared/finance";
import { statusCalendarioParcela } from "../shared/parcelasCalendar";
import { resumirCarteiraDashboard } from "../shared/dashboardPortfolio";
describe("principal transferido não é dívida duplicada ou pagamento fictício", () => {
  it("antecessora renovada contribui zero; sucessora mantém a única obrigação", () => {
    const anterior = { status: "renovada", valorOriginal: "1050.00", saldoResidual: "1000.00", valorMulta: "20.00" };
    const sucessora = { status: "pendente", valorOriginal: "1050.00", saldoResidual: "0.00", valorMulta: "0.00" };
    expect(calcularValorAbertoParcela(anterior)).toBe(0);
    expect(calcularValorAbertoParcela(sucessora)).toBe(1050);
    const carteira = resumirCarteiraDashboard([{ ...anterior, dataVencimento: "2026-10-10" }, { ...sucessora, dataVencimento: "2026-12-10" }], "2026-11-10");
    expect(carteira.totalReceber).toBe(1050);
    expect(carteira.totalInadimplente).toBe(0);
  });
  it("não transforma renovada em paga, pendente ou atrasada", () => {
    expect(getStatusParcela("renovada", "2020-01-01")).toBe("renovada");
    expect(statusCalendarioParcela("renovada", "2020-01-01", "2026-11-10")).toBe("renovada");
  });
  it.each(["cancelado", "cancelada", "pago", "paga"])("não cobra status encerrado %s", status => {
    expect(calcularValorAbertoParcela({ status, valorOriginal: 1000, saldoResidual: 1000 })).toBe(0);
  });
});
