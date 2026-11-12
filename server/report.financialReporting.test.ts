import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), resetDb: vi.fn(), enviar: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getSupabaseClientAsync: mocks.getSupabaseClientAsync, resetDb: mocks.resetDb }));
vi.mock("./services/evolutionClient", () => ({ enviarMensagemEvolution: mocks.enviar }));
import { appRouter } from "./routers";
import { gerarMensagemRelatorio } from "./routers/relatorioDiario";
import { gerarPreviewRelatorioDiario, lerRelatorioFinancialReporting, lerScoreFinancialReporting, listarFinancialReporting, REPORTING_PAGE_SIZE } from "./financialReporting";
import { abertoCentavosRelatorio, adicionarDiasRelatorio, centavosRelatorio, dataRelatorio, hojeRelatorio, leituraValidada, reaisRelatorio, resumirLedgerRelatorio, scoreRelatorio } from "../shared/reporting";

type Consulta = { tabela: string; colunas: string; filtros: { metodo: string; coluna: string; valor: any }[]; inicio: number; fim: number; count?: string; limite?: number };
function fonteRest(tabelas: Record<string, any[]> = {}, opcoes: { falha?: (q: Consulta) => boolean; teto?: number; count?: (q: Consulta, count: number) => number | null; repetir?: boolean; ownerErrado?: boolean } = {}) {
  const consultas: Consulta[] = [];
  const fonte = { from(tabela: string) {
    const q: Consulta = { tabela, colunas: "", filtros: [], inicio: 0, fim: 999 };
    const builder: any = {
      select(colunas: string, options?: any) { q.colunas = colunas; q.count = options?.count; return builder; },
      order() { return builder; }, range(inicio: number, fim: number) { q.inicio = inicio; q.fim = fim; return builder; },
      limit(limite: number) { q.limite = limite; return builder; },
      then(resolve: any, reject: any) {
        consultas.push(q);
        if (opcoes.falha?.(q)) return Promise.resolve({ data: null, error: { message: "SELECT sintético falhou" }, count: null }).then(resolve, reject);
        // Contrato REST físico: ledger não possui cliente_id; clientes não têm status.
        if (q.tabela === "transacoes_caixa" && q.colunas.split(",").map(s => s.trim()).includes("cliente_id")) throw new Error("Coluna física inexistente: transacoes_caixa.cliente_id");
        if (q.tabela === "clientes" && q.filtros.some(f => f.coluna === "status")) throw new Error("Coluna física inexistente: clientes.status");
        const rows = (tabelas[tabela] ?? []).filter(r => q.filtros.every(f => {
          const v = r[f.coluna];
          if (f.metodo === "eq") return v === f.valor;
          if (f.metodo === "in") return f.valor.includes(v);
          if (f.metodo === "gte") return v >= f.valor;
          if (f.metodo === "lte") return v <= f.valor;
          throw new Error("Filtro não previsto");
        })).sort((a, b) => a.id - b.id);
        let data = rows.slice(opcoes.repetir ? 0 : q.inicio, opcoes.repetir ? REPORTING_PAGE_SIZE : q.fim + 1);
        if (opcoes.teto) data = data.slice(0, opcoes.teto);
        if (q.limite) data = data.slice(0, q.limite);
        if (opcoes.ownerErrado && data.length) data = [{ ...data[0], user_id: 999 }];
        const count = opcoes.count ? opcoes.count(q, rows.length) : rows.length;
        return Promise.resolve({ data, error: null, count }).then(resolve, reject);
      },
    };
    for (const metodo of ["eq", "in", "gte", "lte"]) builder[metodo] = (coluna: string, valor: any) => { q.filtros.push({ metodo, coluna, valor }); return builder; };
    for (const metodo of ["insert", "update", "delete", "upsert", "rpc"]) builder[metodo] = () => { throw new Error(`Mutação proibida: ${metodo}`); };
    return builder;
  } };
  return { fonte, consultas };
}
const parcela = (extra: Record<string, any> = {}) => ({ id: 1, user_id: 41, contrato_id: 1, cliente_id: 1, numero_parcela: 1, status: "pendente", valor: "100.00", valor_original: null, saldo_residual: "0.00", valor_multa: "0.00", data_vencimento: "2026-11-10", ...extra });
const movimento = (extra: Record<string, any> = {}) => ({ id: 1, user_id: 41, tipo: "entrada", categoria: "pagamento_parcela", valor: "60.00", data_transacao: "2026-11-10", parcela_id: 1, contrato_id: 1, ...extra });
const tabelas = (extra: Record<string, any[]> = {}) => ({
  parcelas: [parcela()], transacoes_caixa: [movimento()],
  contratos: [{ id: 1, user_id: 41, cliente_id: 1, status: "ativo", modalidade: "mensal", valor_principal: "100.00", data_inicio: "2026-10-01" }],
  clientes: [{ id: 1, user_id: 41, ativo: true, nome: "Cliente sintético" }],
  configuracoes: [{ id: 1, user_id: 41, chave: "nomeEmpresa", valor: "Empresa sintética" }], ...extra,
});
const contexto = () => ({ user: { id: 41, role: "user", loginMethod: "email" }, req: { headers: {} }, res: {} } as TrpcContext);
const caller = () => appRouter.createCaller(contexto());
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T00:30:00Z"));
  mocks.getDb.mockResolvedValue(null); mocks.getSupabaseClientAsync.mockReset(); mocks.enviar.mockReset();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Rede real proibida"); }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("report: matemática e calendário civil", () => {
  it("BRT independente de TZ do navegador e DATE sem conversão timestamp", () => {
    expect(hojeRelatorio()).toBe("2026-11-10");
    expect(adicionarDiasRelatorio("2026-11-10", 30)).toBe("2026-12-10");
    expect(adicionarDiasRelatorio("2026-03-01", -1)).toBe("2026-02-28");
    expect(() => dataRelatorio("2026-02-30")).toThrow(/civil inválida/);
    expect(() => dataRelatorio("2026-11-10T00:00:00Z")).toThrow();
  });
  it.each([null, undefined, "", "NaN", "-1.00", "1,00", "0.001", Number.POSITIVE_INFINITY])("recusa dinheiro inválido %s em vez de zero", valor => expect(() => centavosRelatorio(valor)).toThrow());
  it("ledger em centavos exatos e despesa apenas uma vez", () => {
    const total = resumirLedgerRelatorio([
      { tipo: "entrada", categoria: "pagamento_parcela", valor: "0.10", dataTransacao: "2026-11-10" },
      { tipo: "entrada", categoria: "pagamento_parcela", valor: "0.20", dataTransacao: "2026-11-10" },
      { tipo: "saida", categoria: "despesa_operacional", valor: "100.00", dataTransacao: "2026-11-10" },
    ]);
    expect(total.entradas).toBe(0.3); expect(total.saidas).toBe(100); expect(total.saldo).toBe(-99.7);
  });
  it("recusa transporte numérico que perderia um centavo em vez de arredondar sucesso", () => {
    expect(() => reaisRelatorio(9007199254740991)).toThrow();
    expect(reaisRelatorio(30)).toBe(0.3);
    expect(reaisRelatorio(-9970)).toBe(-99.7);
  });
  it("score declara denominador único, usa evento ledger e parcial aberto", () => {
    const score = scoreRelatorio(8000, 4000, 4000);
    expect(score).toMatchObject({ totalRecebido: 80, totalAberto: 40, emAtraso: 40, denominador: 120, score: 50 });
    expect(score.taxaRecebimento).toBeCloseTo(66.666666); expect(score.inadimplencia).toBeCloseTo(33.333333);
    expect(scoreRelatorio(0, 0, 0)).toMatchObject({ score: null, taxaRecebimento: null, inadimplencia: null, denominador: 0 });
  });
  it.each([null, "0.00", "-10.00", "NaN"])("parcial residual %s permanece bloqueado para revisão", residual => {
    expect(() => abertoCentavosRelatorio({ status: "parcial", valorOriginal: null, valor: "100.00", saldoResidual: residual, dataVencimento: "2026-11-10" })).toThrow();
  });
});

describe("report: REST completo antes de agregação", () => {
  it("1001 movimentos incluem último registro e filtram período no servidor", async () => {
    const rest = fonteRest(tabelas({ transacoes_caixa: [...Array.from({ length: 1001 }, (_, i) => movimento({ id: i + 1, valor: "1.00" })), movimento({ id: 1002, valor: "9000", data_transacao: "2026-11-09" }), movimento({ id: 1003, user_id: 99, valor: "9000" })] }));
    const relatorio = await lerRelatorioFinancialReporting(rest.fonte, 41, { inicio: "2026-11-10", fim: "2026-11-10" });
    expect(leituraValidada(relatorio.ledger) && relatorio.ledger.dados.entradas).toBe(1001);
    expect(relatorio.completo).toBe(true);
    const consultas = rest.consultas.filter(q => q.tabela === "transacoes_caixa" && q.filtros.some(f => f.metodo === "gte" && f.valor === "2026-11-10"));
    expect(consultas.map(q => [q.inicio, q.fim])).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    for (const q of rest.consultas) {
      expect(q.colunas).not.toBe("*"); expect(q.colunas).not.toContain("(");
      expect(q.filtros).toContainEqual({ metodo: "eq", coluna: "user_id", valor: 41 });
    }
  });
  it("1001ª parcela parcial vencida entra no score e no atraso civil", async () => {
    const rest = fonteRest(tabelas({ parcelas: [...Array.from({ length: 1000 }, (_, i) => parcela({ id: i + 1, data_vencimento: "2026-11-11", valor: "0.10" })), parcela({ id: 1001, status: "parcial", saldo_residual: "40.00", data_vencimento: "2026-10-01" })], transacoes_caixa: [movimento({ valor: "80.00" })] }));
    const score = await lerScoreFinancialReporting(rest.fonte, 41);
    expect(score).toMatchObject({ totalRecebido: 80, totalAberto: 140, emAtraso: 40, denominador: 220, dataReferencia: "2026-11-10" });
  });
  it("teto REST menor que solicitado bloqueia total truncado por count exact", async () => {
    const rest = fonteRest({ transacoes_caixa: Array.from({ length: 1001 }, (_, i) => movimento({ id: i + 1 })) }, { teto: 100 });
    await expect(listarFinancialReporting(rest.fonte, "transacoes_caixa", "id, user_id", 41)).rejects.toThrow(/truncada/);
  });
  it.each(["count-null", "count-diverge", "pagina-repetida", "owner-errado"])("completude inválida %s é bloqueada", async caso => {
    const rest = fonteRest({ transacoes_caixa: Array.from({ length: 1001 }, (_, i) => movimento({ id: i + 1 })) }, {
      count: caso === "count-null" ? () => null : caso === "count-diverge" ? (q, count) => count + (q.inicio ? 1 : 0) : undefined,
      repetir: caso === "pagina-repetida", ownerErrado: caso === "owner-errado",
    });
    await expect(listarFinancialReporting(rest.fonte, "transacoes_caixa", "id, user_id", 41)).rejects.toThrow();
  });
  it("falha na página 3 nunca produz parcial como total", async () => {
    const rest = fonteRest({ transacoes_caixa: Array.from({ length: 1001 }, (_, i) => movimento({ id: i + 1 })) }, { falha: q => q.inicio === 1000 });
    await expect(listarFinancialReporting(rest.fonte, "transacoes_caixa", "id, user_id", 41)).rejects.toThrow(/Falha na consulta/);
  });
  it("residual inválido indisponibiliza dívida mas mantém Caixa validado", async () => {
    const rest = fonteRest(tabelas({ parcelas: [parcela({ status: "parcial", saldo_residual: "0.00" })], transacoes_caixa: [movimento(), movimento({ id: 2, tipo: "saida", categoria: "despesa_operacional", valor: "100.00" })], contas_pagar: [{ id: 1, user_id: 41, status: "paga", valor: "100.00" }] }));
    const r = await lerRelatorioFinancialReporting(rest.fonte, 41, { inicio: "2026-11-10", fim: "2026-11-10" });
    expect(r.completo).toBe(false); expect(r.dividas).toMatchObject({ status: "indisponivel", completo: false });
    expect(leituraValidada(r.ledger) && r.ledger.dados).toMatchObject({ entradas: 60, saidas: 100, saldo: -40 });
    expect(rest.consultas.some(q => q.tabela === "contas_pagar")).toBe(false);
  });
  it("renovada transfere principal ao sucessor sem dívida do antecessor ou pagamento falso", async () => {
    const rest = fonteRest(tabelas({ parcelas: [parcela({ status: "renovada", saldo_residual: "100.00" }), parcela({ id: 2, status: "pendente", valor: "150.00", data_vencimento: "2026-11-11" })], transacoes_caixa: [movimento({ valor: "50.00" })] }));
    const r = await lerRelatorioFinancialReporting(rest.fonte, 41, { inicio: "2026-11-01", fim: "2026-11-30" });
    expect(r.completo).toBe(true);
    expect(leituraValidada(r.dividas) && r.dividas.dados.aberto).toBe(150);
    expect(leituraValidada(r.dividas) && r.dividas.dados.parcelas[0].status).toBe("renovada");
    expect(leituraValidada(r.ledger) && r.ledger.dados.recebido).toBe(50);
    expect(leituraValidada(r.projecao) && r.projecao.dados.aberto).toBe(150);
  });
  it("paga de original nulo não inventa recebimento e parcial tem residual na projeção", async () => {
    const rest = fonteRest(tabelas({ parcelas: [parcela({ status: "paga", valor_pago: "80.00" }), parcela({ id: 2, status: "parcial", saldo_residual: "40.00", data_vencimento: "2026-11-11" })], transacoes_caixa: [] }));
    const r = await lerRelatorioFinancialReporting(rest.fonte, 41, { inicio: "2026-11-01", fim: "2026-11-30" });
    expect(leituraValidada(r.ledger) && r.ledger.dados.recebido).toBe(0);
    expect(leituraValidada(r.projecao) && r.projecao.dados.aberto).toBe(40);
  });
  it("extrato atribui ledger pelo contrato físico; evento sem vínculo torna extrato indisponível", async () => {
    const rest = fonteRest(tabelas());
    const r = await lerRelatorioFinancialReporting(rest.fonte, 41, { inicio: "2026-11-10", fim: "2026-11-10", clienteId: 1 });
    expect(leituraValidada(r.extrato ?? undefined) && r.extrato?.status === "validado" && r.extrato.dados.recebidoPeriodo).toBe(60);
    const invalido = fonteRest(tabelas({ transacoes_caixa: [movimento({ contrato_id: null })] }));
    const r2 = await lerRelatorioFinancialReporting(invalido.fonte, 41, { inicio: "2026-11-10", fim: "2026-11-10", clienteId: 1 });
    expect(r2.extrato).toMatchObject({ status: "indisponivel", completo: false }); expect(r2.completo).toBe(false);
    expect(r2.ledger.status).toBe("validado");
  });
});

describe("report: ambos diários confiáveis e sem envio", () => {
  it.each(["parcelas", "transacoes_caixa", "clientes", "contratos", "configuracoes"])("SELECT falhando em %s bloqueia mensagem/URL e enviarAgora", async tabela => {
    const rest = fonteRest(tabelas(), { falha: q => q.tabela === tabela });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    await expect(gerarPreviewRelatorioDiario(rest.fonte, 41)).rejects.toThrow();
    await expect(gerarMensagemRelatorio(41)).rejects.toThrow();
    await expect(caller().relatorioDiario.preview()).rejects.toThrow();
    await expect(caller().whatsapp.relatorioDiario({})).rejects.toThrow();
    await expect(caller().relatorioDiario.enviarAgora({ telefone: "11999999999" })).rejects.toThrow();
    expect(mocks.enviar).not.toHaveBeenCalled();
  });
  it("clientes.ativo boolean, parcial hoje, cancelada excluída e ledger BRT compartilhados", async () => {
    const rest = fonteRest(tabelas({ parcelas: [parcela({ status: "parcial", saldo_residual: "40.00" }), parcela({ id: 2, status: "cancelada", valor: "9000.00" }), parcela({ id: 3, status: "pendente", data_vencimento: "2026-10-01" })], clientes: [{ id: 1, user_id: 41, nome: "Sintético", ativo: true }, { id: 2, user_id: 41, nome: "Inativo", ativo: false }, { id: 3, user_id: 99, nome: "Alheio", ativo: true }] }));
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    const preview = await caller().relatorioDiario.preview();
    const url = await caller().whatsapp.relatorioDiario({});
    expect(preview.mensagem).toBe(url.mensagem);
    expect(url).toMatchObject({ completo: true, totalRecebidoHoje: 60, totalVencendoHoje: 1, valorVencendoHoje: 40, totalAtrasadas: 1 });
    expect(url.mensagem).toContain("10/11/2026 (Brasília)"); expect(url.mensagem).toContain("Clientes ativos: 1");
    expect(rest.consultas.filter(q => q.tabela === "clientes").every(q => q.filtros.some(f => f.coluna === "ativo" && f.valor === true))).toBe(true);
    expect(mocks.enviar).not.toHaveBeenCalled();
  });
  it("diário pagina 1001 recebimentos e não usa data_pagamento nem status para recebimento", async () => {
    const rest = fonteRest(tabelas({ transacoes_caixa: Array.from({ length: 1001 }, (_, i) => movimento({ id: i + 1, valor: "1.00" })) }));
    expect(await gerarPreviewRelatorioDiario(rest.fonte, 41)).toMatchObject({ totalRecebidoHoje: 1001, pagamentosCount: 1001 });
    expect(rest.consultas.some(q => q.colunas.includes("data_pagamento") || q.colunas.includes("valor_pago"))).toBe(false);
  });
  it("fonte ausente recusa os dois diários e score; vazio confirmado tem score null", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(caller().whatsapp.relatorioDiario({})).rejects.toThrow(/indisponível/);
    await expect(caller().relatorioDiario.preview()).rejects.toThrow(/indisponível/);
    await expect(caller().dashboard.scoreNegocio()).rejects.toThrow(/indisponível/);
    mocks.getSupabaseClientAsync.mockResolvedValue(fonteRest().fonte);
    expect(await caller().dashboard.scoreNegocio()).toMatchObject({ completo: true, score: null, denominador: 0 });
  });
  it("lista mantém status atrasada explícito em paridade com KPI mesmo com DATE futuro", async () => {
    const rest = fonteRest(tabelas({ parcelas: [parcela({ status: "atrasada", data_vencimento: "2026-11-11" })] }));
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    const lista = await caller().dashboard.parcelasAtrasadas();
    expect(lista).toHaveLength(1); expect(lista[0]).toMatchObject({ valorAtualizado: 100, diasAtraso: 0 });
    expect((await lerScoreFinancialReporting(rest.fonte, 41)).emAtraso).toBe(100);
  });
  it("alertas e lista incluem pendente vencida + parcial residual sem writes", async () => {
    const rest = fonteRest(tabelas({ parcelas: [parcela({ data_vencimento: "2026-10-01" }), parcela({ id: 2, data_vencimento: "2026-10-01", status: "parcial", saldo_residual: "40.00" })] }));
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    expect((await caller().dashboard.precisaAtencao()).atrasados30).toMatchObject({ qtd: 1, valor: 140 });
    const atrasadas = await caller().dashboard.parcelasAtrasadas();
    expect(atrasadas.map(p => p.valorAtualizado)).toEqual([100, 40]);
    expect(mocks.enviar).not.toHaveBeenCalled();
  });
});
