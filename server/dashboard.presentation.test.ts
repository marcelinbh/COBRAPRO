import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consultas: {} as Record<string, any>, mutate: vi.fn() }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    cobradores: { me: { useQuery: () => ({ data: { perfil: "gestor" } }) } },
    dashboard: Object.fromEntries(["kpis", "resumoCaixa", "parcelasHoje", "parcelasAtrasadas", "fluxoMensal", "scoreNegocio", "precisaAtencao", "tendenciaJuros"].map(nome => [nome, { useQuery: () => mocks.consultas[nome] }])),
    whatsapp: { relatorioDiario: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } },
  },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "pt" } }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => React.createElement("div", null, children),
  AreaChart: () => React.createElement("span", null, "dashboard-chart-fluxo"),
  BarChart: () => React.createElement("span", null, "dashboard-chart-tendencia"),
  Area: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null,
}));
import Dashboard from "../client/src/pages/Dashboard";

const kpis = {
  saldoTotal: 0, capitalCirculacao: 100, totalReceber: 200, totalInadimplente: 125.8,
  qtdInadimplentes: 1, jurosPendentes: 0, qtdVenceHoje: 0, valorVenceHoje: 0,
  recebidoHoje: 0, contratosAtivos: 1,
};
const renderizar = () => renderToStaticMarkup(React.createElement(Dashboard));

beforeEach(() => {
  // Vitest sem plugin React transforma JSX clássico; a aplicação usa runtime automático.
  vi.stubGlobal("React", React);
  mocks.mutate.mockReset();
  const data: Record<string, any> = {
    kpis, resumoCaixa: undefined, parcelasHoje: [], parcelasAtrasadas: [], fluxoMensal: [], tendenciaJuros: [],
    scoreNegocio: { score: 0, taxaRecebimento: 0, inadimplencia: 0, totalRecebido: 0 },
    precisaAtencao: { venceSemana: { qtd: 0, valor: 0 }, atrasados30: { qtd: 0, valor: 0 } },
  };
  mocks.consultas = Object.fromEntries(Object.entries(data).map(([nome, data]) => [nome, { data, isLoading: false, isError: false }]));
});
afterEach(() => vi.unstubAllGlobals());

describe("dashboard: apresentação sem browser", () => {
  it("divide pelo total aberto, não pelo capital, e mostra em dia positivo da mesma base", () => {
    const html = renderizar();
    expect(html).toContain("62.9%");
    expect(html).not.toContain("125.8%");
    expect(html).toContain("74,20");
    expect(html).not.toContain("-25,80");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("rejeita carteira incompatível em vez de limitar percentual em 100%", () => {
    mocks.consultas.kpis.data = { ...kpis, totalReceber: 100 };
    const html = renderizar();
    expect(html).toContain("Base da carteira inconsistente");
    expect(html).toContain("Indisponível");
    expect(html).not.toContain("width:100%");
    expect(html).not.toContain("125.8%");
  });

  it("falha de transporte de KPIs oculta saldo antigo e não apresenta sucesso/zero", () => {
    mocks.consultas.kpis = { data: { ...kpis, saldoTotal: 987.65 }, isError: true, isLoading: false, error: { message: "Fonte indisponível" } };
    const html = renderizar();
    expect(html).toContain("Fonte indisponível");
    expect(html).toContain("Indisponível");
    expect(html).not.toContain("987,65");
    expect(html).not.toContain("62.9%");
  });

  it("residual inválido mantém saldo e capital válidos da consulta independente", () => {
    mocks.consultas.kpis = { isError: true, isLoading: false, error: { message: "Saldo residual inválido; revisão necessária." } };
    mocks.consultas.resumoCaixa = { data: { saldoTotal: 2500, capitalCirculacao: 25050, recebidoHoje: 25, contratosAtivos: 17 }, isError: false, isLoading: false };
    const html = renderizar();
    expect(html).toContain("2.500,00");
    expect(html).toContain("25.050,00");
    expect(html).toContain("Indisponível");
    expect(html).toContain("O Caixa é conferido separadamente");
    expect(html).not.toContain("62.9%");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("fallback do Caixa em falha não reapresenta saldo antigo", () => {
    mocks.consultas.kpis = { isError: true, isLoading: false, error: { message: "Carteira indisponível" } };
    mocks.consultas.resumoCaixa = { data: { saldoTotal: 987.65, capitalCirculacao: 999, recebidoHoje: 25, contratosAtivos: 1 }, isError: true, isLoading: false };
    const html = renderizar();
    expect(html).not.toContain("987,65");
    expect(html).toContain("Indisponível");
  });

  it("carteira vazia tem mensagem própria e não desenha saúde fictícia", () => {
    mocks.consultas.kpis.data = { ...kpis, totalReceber: 0, totalInadimplente: 0 };
    const html = renderizar();
    expect(html).toContain("Sem valores em aberto na carteira.");
    expect(html).not.toContain("dashboard.portfolioHealth");
    expect(html).not.toContain("Indisponível");
  });

  it("falhas de listas, atenção e gráficos não mostram dados stale nem gráficos de sucesso", () => {
    for (const nome of ["parcelasHoje", "parcelasAtrasadas", "fluxoMensal", "tendenciaJuros", "precisaAtencao"]) {
      mocks.consultas[nome].isError = true;
    }
    mocks.consultas.parcelasHoje.data = [{ id: 1, clienteNome: "Nome antigo não apresentar", valorOriginal: "9000" }];
    mocks.consultas.parcelasAtrasadas.data = [{ id: 2, clienteNome: "Nome antigo não apresentar", valorAtualizado: 9000 }];
    const html = renderizar();
    expect(html).toContain("Não foi possível consultar os alertas financeiros.");
    expect(html).toContain("Fluxo indisponível");
    expect(html).toContain("Tendência indisponível");
    expect(html).toContain("Consulta de parcelas indisponível.");
    expect(html).not.toContain("Nome antigo não apresentar");
    expect(html).not.toContain("dashboard-chart-fluxo");
    expect(html).not.toContain("dashboard-chart-tendencia");
    expect(html).not.toContain("common.noData");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("consulta concluída sem dados não fica em reticências nem desenha gráficos de sucesso", () => {
    for (const nome of ["kpis", "resumoCaixa", "fluxoMensal", "tendenciaJuros", "scoreNegocio"]) {
      mocks.consultas[nome] = { data: undefined, isError: false, isLoading: false };
    }
    const html = renderizar();
    expect(html).toContain("Consulta concluída sem dados financeiros; revisão necessária.");
    expect(html).toContain("Tentar novamente");
    expect(html).toContain("Fluxo indisponível");
    expect(html).toContain("Tendência indisponível");
    expect(html).toContain("Score indisponível");
    expect(html).not.toContain("...");
    expect(html).not.toContain("dashboard-chart-fluxo");
    expect(html).not.toContain("dashboard-chart-tendencia");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("mantém placeholders apenas enquanto a consulta realmente carrega", () => {
    for (const nome of ["kpis", "fluxoMensal", "tendenciaJuros", "scoreNegocio"]) {
      mocks.consultas[nome] = { data: undefined, isError: false, isLoading: true };
    }
    const html = renderizar();
    expect(html).toContain("Carregando...");
    expect(html).toContain("...");
    expect(html).not.toContain("Consulta concluída sem dados financeiros");
    expect(html).not.toContain("Tentar novamente");
    expect(html).not.toContain("dashboard-chart-fluxo");
    expect(html).not.toContain("dashboard-chart-tendencia");
  });

  it("listas vazias confirmadas continuam válidas em vez de indisponíveis", () => {
    const html = renderizar();
    expect(html).toContain("dashboard-chart-fluxo");
    expect(html).toContain("dashboard-chart-tendencia");
    expect(html).not.toContain("Fluxo indisponível");
    expect(html).not.toContain("Tendência indisponível");
    expect(html).not.toContain("Consulta concluída sem dados financeiros");
  });
});
