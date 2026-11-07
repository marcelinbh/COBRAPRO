import { describe, expect, it } from "vitest";
import { calendarioDashboard } from "./dashboardDates";
import { numeroDashboard, resumirCarteiraDashboard, saldoContaDashboard, saudeCarteiraDashboard, valorAbertoDashboard, valorBaseDashboard, type ParcelaDashboard } from "../shared/dashboardPortfolio";

const parcela = (dados: Partial<ParcelaDashboard> = {}): ParcelaDashboard => ({
  status: "pendente", valorOriginal: "100.00", saldoResidual: "0.00", valorMulta: "0.00",
  dataVencimento: "2026-11-06", clienteId: 1, ...dados,
});

describe("dashboard: saldo confiável", () => {
  it("mantém saldo negativo legítimo sem clamp e contabiliza cada movimento uma vez", () => {
    expect(saldoContaDashboard("-50", [{ tipo: "entrada", valor: "10.10" }, { tipo: "saida", valor: "20.20" }])).toBe(-60.1);
    expect(saldoContaDashboard("0", [])).toBe(0);
  });

  it("não converte saldo ausente ou movimento inválido em zero", () => {
    expect(() => saldoContaDashboard(null, [])).toThrow(/saldo-base/);
    expect(() => saldoContaDashboard("0", [{ tipo: "entrada", valor: "NaN" }])).toThrow(/movimento/);
    expect(() => saldoContaDashboard("0", [{ tipo: "ignorado", valor: "10" }])).toThrow(/tipo/);
  });
});

describe("dashboard: base única da carteira", () => {
  it("retorna carteira vazia sem inventar dívida ou saúde percentual", () => {
    expect(resumirCarteiraDashboard([], "2026-11-06")).toEqual({
      totalReceber: 0, totalInadimplente: 0, qtdInadimplentes: 0,
      jurosPendentes: 0, qtdVenceHoje: 0, valorVenceHoje: 0,
    });
    expect(saudeCarteiraDashboard(0, 0)).toEqual({ emDia: 0, taxaInadimplencia: 0 });
  });

  it("usa o residual parcial apenas uma vez, incluindo parcial vencido na mesma base inadimplente", () => {
    const resumo = resumirCarteiraDashboard([
      parcela({ status: "atrasada", valorOriginal: "150", saldoResidual: "20", valorMulta: "15", dataVencimento: "2026-11-05" }),
      parcela({ status: "parcial", valorOriginal: "150", saldoResidual: "40", valorMulta: "15", dataVencimento: "2026-11-05", valorJuros: "10" }),
      parcela({ status: "parcial", saldoResidual: "60", dataVencimento: "2026-11-07", clienteId: 2 }),
      parcela({ valorOriginal: "200" }),
      parcela({ status: "paga", valorOriginal: "9000" }),
      parcela({ status: "cancelada", valorOriginal: "9000" }),
      parcela({ status: "desconhecido", valorOriginal: "9000" }),
    ], "2026-11-06");
    expect(resumo).toEqual({ totalReceber: 485, totalInadimplente: 225, qtdInadimplentes: 1, jurosPendentes: 10, qtdVenceHoje: 1, valorVenceHoje: 200 });
    const saude = saudeCarteiraDashboard(resumo.totalReceber, resumo.totalInadimplente)!;
    expect(saude.emDia).toBe(260);
    expect(saude.taxaInadimplencia).toBeCloseTo(225 / 485 * 100);
  });

  it("valor obrigatório é a base quando valor_original é nulo; juros não são somados novamente", () => {
    expect(valorBaseDashboard(parcela({ valorOriginal: null, valor: "125.80" }))).toBe(125.8);
    expect(valorAbertoDashboard(parcela({ valorOriginal: null, valor: "125.80", valorJuros: "25.80", valorMulta: "10", saldoResidual: "5" }))).toBe(140.8);
    expect(valorAbertoDashboard(parcela({ status: "parcial", valorOriginal: null, valor: "125.80", saldoResidual: "30", valorMulta: "10" }))).toBe(30);
  });

  it.each([null, undefined, "0", "-1", "NaN", "", Infinity])("sinaliza residual legado parcial inválido (%s), não usa principal nem zero", (saldoResidual) => {
    expect(() => valorAbertoDashboard(parcela({ status: "parcial", saldoResidual }))).toThrow(/residual/);
  });

  it("sinaliza residual negativo em outros abertos e não inventa base ausente", () => {
    expect(() => valorAbertoDashboard(parcela({ saldoResidual: "-30" }))).toThrow(/residual/);
    expect(() => valorAbertoDashboard(parcela({ valorOriginal: null }))).toThrow(/valor da parcela/);
    expect(() => numeroDashboard("12x", "recebimento")).toThrow(/inválido/);
  });

  it("vencimento passado de pendente também está inadimplente, e cliente é contado uma vez", () => {
    const resumo = resumirCarteiraDashboard([
      parcela({ dataVencimento: "2026-11-05" }), parcela({ status: "atrasada" }),
      parcela({ status: "vencendo_hoje", clienteId: 2 }),
    ], "2026-11-06");
    expect(resumo.totalReceber).toBe(300);
    expect(resumo.totalInadimplente).toBe(200);
    expect(resumo.qtdInadimplentes).toBe(1);
    expect(resumo.valorVenceHoje).toBe(100);
  });

  it("soma parcelas em centavos sem produzir em dia negativo por arredondamento", () => {
    const resumo = resumirCarteiraDashboard([parcela({ valorOriginal: "0.10", status: "atrasada" }), parcela({ valorOriginal: "0.20" })], "2026-11-06");
    expect(resumo.totalReceber).toBe(0.3);
    expect(saudeCarteiraDashboard(resumo.totalReceber, resumo.totalInadimplente)?.emDia).toBe(0.2);
    expect(saudeCarteiraDashboard(100, 125.8)).toBeNull();
    expect(saudeCarteiraDashboard(NaN, 0)).toBeNull();
    expect(saudeCarteiraDashboard(-1, 0)).toBeNull();
    expect(saudeCarteiraDashboard(100, 100)).toEqual({ emDia: 0, taxaInadimplencia: 100 });
  });
});

describe("dashboard: calendário civil BRT", () => {
  it("em 06/11 BRT 21h não inclui 07/11 mesmo sendo o dia seguinte UTC", () => {
    const calendario = calendarioDashboard(new Date("2026-11-07T00:00:00Z"));
    expect(calendario.hoje).toBe("2026-11-06");
    expect(calendario.em7Dias).toBe("2026-11-13");
    expect(calendario.ha30Dias).toBe("2026-10-07");
    expect(calendario.dias.map(d => d.data)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
    expect(calendario.dias.at(-1)?.dia).toBe("06/11");
  });

  it("vira somente à meia-noite BRT e mantém virada de ano", () => {
    const antes = calendarioDashboard(new Date("2027-01-01T02:59:59Z"));
    const depois = calendarioDashboard(new Date("2027-01-01T03:00:00Z"));
    expect(antes.hoje).toBe("2026-12-31");
    expect(antes.em7Dias).toBe("2027-01-07");
    expect(depois.hoje).toBe("2027-01-01");
    expect(depois.dias[0].data).toBe("2026-12-26");
    expect(depois.meses.map(m => m.inicio)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"]);
  });

  it.each([
    ["2026-04-01T00:00:00Z", "2026-02-28"],
    ["2024-04-01T00:00:00Z", "2024-02-29"],
  ])("no dia 31 não pula fevereiro e usa seu último dia (%s)", (agora, fimFevereiro) => {
    const calendario = calendarioDashboard(new Date(agora));
    expect(calendario.hoje.slice(5)).toBe("03-31");
    expect(calendario.meses.map(m => m.inicio.slice(5, 7))).toEqual(["10", "11", "12", "01", "02", "03"]);
    expect(calendario.meses[4].fim).toBe(fimFevereiro);
    expect(calendario.meses[5].fim.slice(5)).toBe("03-31");
    for (const mes of calendario.meses) {
      expect(mes.inicio).toMatch(/^\d{4}-\d{2}-01$/);
      expect(mes.fim).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
