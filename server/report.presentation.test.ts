import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ consultas: {} as Record<string, any>, useQuery: vi.fn(), stateOverrides: [] as any[] }));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (initial: any) => [mocks.stateOverrides.length ? mocks.stateOverrides.shift() : typeof initial === "function" ? initial() : initial, vi.fn()] };
});
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  dashboard: Object.fromEntries(["kpis", "resumoCaixa", "relatorioFinanceiro", "parcelasHoje", "parcelasAtrasadas", "fluxoMensal", "scoreNegocio", "precisaAtencao", "tendenciaJuros"].map(nome => [nome, { useQuery: (...args: any[]) => { if (nome === "relatorioFinanceiro") mocks.useQuery(...args); return mocks.consultas[nome]; } }])),
  cobradores: { me: { useQuery: () => ({ data: { perfil: "gestor" } }) } },
  whatsapp: { relatorioDiario: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
} }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "pt" } }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("recharts", () => ({ ResponsiveContainer: ({ children }: any) => React.createElement("div", null, children), BarChart: () => React.createElement("span", null, "report-chart-validado"), AreaChart: () => null, Area: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null }));
import Relatorios from "../client/src/pages/Relatorios";
import Dashboard from "../client/src/pages/Dashboard";
const validado = (dados: any) => ({ status: "validado", completo: true, dados });
const indisponivel = (motivo = "Residual legado inválido; revisão necessária.") => ({ status: "indisponivel", completo: false, motivo });
const dividas = () => ({ parcelas: [], aberto: 0, emAtraso: 0, abertoCentavos: 0, atrasoCentavos: 0, quantidade: 0, quantidadeAtrasadas: 0 });
const dadosRelatorio = () => ({
  inicio: "2026-11-01", fim: "2026-11-10", hoje: "2026-11-10", completo: true,
  ledger: validado({ entradas: 2500, saidas: 100, saldo: 2400, recebido: 60, quantidade: 2, movimentos: [] }),
  fluxo: validado({ movimentos: [] }), dividas: validado(dividas()), projecao: validado(dividas()),
  vinculos: validado({ contratos: [], clientes: [{ id: 1, nome: "Sintético", ativo: true }] }), extrato: null, base: "Somente ledger; dívida atual validada.",
});
const render = (Component: React.ComponentType) => renderToStaticMarkup(React.createElement(Component));
const pdfButton = (html: string, label = "Exportar Relatório PDF") => html.match(new RegExp(`<button[^>]*>(?:(?!<button)[\\s\\S])*?${label}\\s*<\\/button>`, "g"))?.at(-1) || "";
beforeEach(() => {
  vi.stubGlobal("React", React); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T00:30:00Z"));
  mocks.stateOverrides = []; mocks.useQuery.mockReset();
  const kpis = { saldoTotal: 2400, capitalCirculacao: 100, totalReceber: 0, totalInadimplente: 0, jurosPendentes: 0, contratosAtivos: 0, recebidoHoje: 60, qtdInadimplentes: 0, qtdVenceHoje: 0, valorVenceHoje: 0 };
  const dados: Record<string, any> = { kpis, resumoCaixa: undefined, relatorioFinanceiro: dadosRelatorio(), parcelasHoje: [], parcelasAtrasadas: [], fluxoMensal: [], tendenciaJuros: [], precisaAtencao: { venceSemana: { qtd: 0, valor: 0 }, atrasados30: { qtd: 0, valor: 0 } }, scoreNegocio: { completo: true, score: 50, taxaRecebimento: 66.666666, inadimplencia: 33.333333, totalRecebido: 80, emAtraso: 40, totalAberto: 40, denominador: 120, base: "Histórico ledger + dívida aberta", dataReferencia: "2026-11-10" } };
  mocks.consultas = Object.fromEntries(Object.entries(dados).map(([nome, data]) => [nome, { data, isLoading: false, isError: false, isFetching: false }]));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("report: apresentação segura e PDF", () => {
  it.each(["loading", "fetching", "error", "incompleto"])("%s bloqueia PDF e não mostra dinheiro antigo nem vazio falso", estado => {
    const q = mocks.consultas.relatorioFinanceiro;
    if (estado === "loading") q.isLoading = true;
    if (estado === "fetching") q.isFetching = true;
    if (estado === "error") { q.isError = true; q.error = { message: "SELECT indisponível" }; }
    if (estado === "incompleto") { q.data.completo = false; for (const key of ["ledger", "fluxo", "dividas", "projecao", "vinculos"]) q.data[key] = indisponivel(); }
    const html = render(Relatorios);
    expect(pdfButton(html)).toContain('disabled=""'); expect(html).not.toContain("2.500,00");
    expect(html).not.toContain("vazio confirmado"); expect(html).not.toContain("report-chart-validado");
  });
  it("residual inválido preserva Caixa válido e bloqueia exportação", () => {
    const q = mocks.consultas.relatorioFinanceiro;
    q.data.completo = false; q.data.dividas = indisponivel(); q.data.projecao = indisponivel();
    const html = render(Relatorios);
    expect(html).toContain("2.500,00"); expect(html).toContain("2.400,00"); expect(html).toContain("Residual legado inválido");
    expect(pdfButton(html)).toContain('disabled=""');
    expect(html).not.toContain("Ainda aberto (residual validado)");
  });
  it("vazio completo confirmado habilita PDF sem inventar percentual de zero", () => {
    const html = render(Relatorios);
    expect(pdfButton(html)).not.toContain('disabled=""'); expect(html).toContain("vazio confirmado"); expect(html).toContain("Sem base percentual");
    expect(html).not.toContain("Taxa de Recebimento");
  });
  it("período BRT inicial termina em 10/11 às 00:30 UTC, não 11/11", () => {
    render(Relatorios);
    expect(mocks.useQuery.mock.calls[0][0]).toMatchObject({ inicio: "2026-11-01", fim: "2026-11-10" });
  });
  it("período inválido desabilita leitura, PDF e dados cached", () => {
    mocks.stateOverrides = ["2026-11-12", "2026-11-10", "todas", "todos"];
    const html = render(Relatorios);
    expect(mocks.useQuery.mock.calls[0][1]).toMatchObject({ enabled: false });
    expect(pdfButton(html)).toContain('disabled=""'); expect(html).toContain("período civil válido"); expect(html).not.toContain("2.500,00");
  });
  it("extrato incompleto bloqueia ambos PDFs sem total recebido falso", () => {
    mocks.stateOverrides = ["2026-11-01", "2026-11-10", "todas", "1"];
    mocks.consultas.relatorioFinanceiro.data.extrato = indisponivel("Recebimento sem contrato confirmado");
    mocks.consultas.relatorioFinanceiro.data.completo = false;
    const html = render(Relatorios);
    expect(pdfButton(html)).toContain('disabled=""'); expect(pdfButton(html, "Exportar Extrato PDF")).toContain('disabled=""');
    expect(html).toContain("Recebimento sem contrato confirmado");
    expect(html).not.toContain("Recebido no período (ledger / contrato validado)");
  });
  it("falha global mantém saldo independente válido sem dívida zero", () => {
    mocks.consultas.kpis = { isError: true, isLoading: false, data: { saldoTotal: 987.65 } };
    mocks.consultas.resumoCaixa = { isError: false, isLoading: false, data: { saldoTotal: 777, capitalCirculacao: 888 } };
    const html = render(Relatorios);
    expect(html).toContain("777,00"); expect(html).toContain("888,00"); expect(html).not.toContain("987,65"); expect(html).toContain("Indisponível");
  });
});

describe("report: score estados e denominador explícito", () => {
  it.each(["loading", "error"])("%s não renderiza score antigo nem componentes zero de sucesso", estado => {
    const q = mocks.consultas.scoreNegocio;
    if (estado === "loading") q.isLoading = true;
    else { q.isError = true; q.error = { message: "Score sem fonte" }; }
    const html = render(Dashboard);
    expect(html).not.toContain("/100"); expect(html).not.toContain("66.7%"); expect(html).not.toContain("80,00");
    expect(html).toContain(estado === "loading" ? "Carregando score" : "Score indisponível");
  });
  it("score e percentuais indicam mesma base histórica de 120", () => {
    const html = render(Dashboard);
    expect(html).toContain("66.7%"); expect(html).toContain("33.3%"); expect(html).toContain("Denominador:");
    expect(html).toContain("120,00"); expect(html).toContain("recebido + aberto validado");
  });
  it("score com leitura vazia confirmada é sem base, não score zero", () => {
    mocks.consultas.scoreNegocio.data = { ...mocks.consultas.scoreNegocio.data, score: null, taxaRecebimento: null, inadimplencia: null, denominador: 0, totalRecebido: 0 };
    const html = render(Dashboard);
    expect(html).toContain("Sem base financeira para score"); expect(html).not.toContain("/100");
  });
});
