import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), resetDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getSupabaseClientAsync: mocks.getSupabaseClientAsync, resetDb: mocks.resetDb }));
import { appRouter } from "./routers";
import { listarDashboard } from "./dashboardQueries";

type Filtro = { metodo: string; coluna: string; valor: any };
type Consulta = { tabela: string; colunas: string; filtros: Filtro[]; inicio?: number; fim?: number; limite?: number; ordem?: string };
function fonteRest(tabelas: Record<string, any[]> = {}, falha?: (q: Consulta) => boolean) {
  // Fixtures de ledger devem ter uma conta própria explícita, como no catálogo físico.
  if (!("contas_caixa" in tabelas) && tabelas.transacoes_caixa?.some(row => row.user_id === 41)) {
    tabelas = { ...tabelas, contas_caixa: [{ id: 1, user_id: 41, ativo: true, saldo: "0.00" }] };
  }
  const consultas: Consulta[] = [];
  const fonte = {
    from(tabela: string) {
      const q: Consulta = { tabela, colunas: "", filtros: [] };
      const builder: any = {
        select(colunas: string) { q.colunas = colunas; return builder; },
        order(coluna: string) { q.ordem = coluna; return builder; },
        range(inicio: number, fim: number) { q.inicio = inicio; q.fim = fim; return builder; },
        limit(limite: number) { q.limite = limite; return builder; },
        then(resolve: any, reject: any) {
          consultas.push(q);
          if (falha?.(q)) return Promise.resolve({ data: null, error: { message: "Falha sintética de transporte" } }).then(resolve, reject);
          let data = (tabelas[tabela] ?? []).filter(row => q.filtros.every(filtro => {
            const value = filtro.coluna.split(".").reduce((obj: any, key) => obj?.[key], row);
            switch (filtro.metodo) {
              case "eq": return value === filtro.valor;
              case "in": return filtro.valor.includes(value);
              case "gte": return value >= filtro.valor;
              case "lte": return value <= filtro.valor;
              default: throw new Error("Filtro não previsto");
            }
          }));
          const count = data.length;
          if (q.ordem) data = [...data].sort((a, b) => a[q.ordem!] > b[q.ordem!] ? 1 : a[q.ordem!] < b[q.ordem!] ? -1 : 0);
          if (q.inicio != null) data = data.slice(q.inicio, q.fim! + 1);
          if (q.limite != null) data = data.slice(0, q.limite);
          return Promise.resolve({ data, error: null, count }).then(resolve, reject);
        },
      };
      for (const metodo of ["eq", "in", "gte", "lte"]) builder[metodo] = (coluna: string, valor: any) => { q.filtros.push({ metodo, coluna, valor }); return builder; };
      return builder;
    },
  };
  return { fonte, consultas };
}

function contexto(): TrpcContext {
  return {
    user: { id: 41, openId: "dashboard-test", name: "Sintético", email: "dashboard@example.invalid", loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}
const caller = () => appRouter.createCaller(contexto()).dashboard;
const parcelaRest = (extra: Record<string, any> = {}) => ({ id: 1, user_id: 41, cliente_id: 1, numero_parcela: 1, status: "pendente", valor: "100", valor_original: null, saldo_residual: "0", valor_multa: "0", valor_juros: "0", data_vencimento: "2026-11-06", clientes: { nome: "Sintético", user_id: 41 }, ...extra });
const movimentoRest = (extra: Record<string, any> = {}) => ({ id: 1, user_id: 41, conta_caixa_id: extra.user_id && extra.user_id !== 41 ? 2 : 1, tipo: "entrada", categoria: "pagamento_parcela", valor: "25", data_transacao: "2026-11-06", ...extra });
function conferirTenant(q: Consulta) {
  if (q.colunas === "id, user_id, conta_caixa_id") {
    expect(q.filtros).toEqual([{ metodo: "in", coluna: "conta_caixa_id", valor: [1] }]);
  } else expect(q.filtros).toContainEqual({ metodo: "eq", coluna: "user_id", valor: 41 });
}


beforeEach(() => {
  mocks.getDb.mockReset().mockResolvedValue(null);
  mocks.getSupabaseClientAsync.mockReset();
  mocks.resetDb.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-07T00:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Rede real proibida em teste de dashboard"); }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("dashboard REST: consultas somente leitura e isoladas", () => {
  it("KPIs usam valor nullable/fallback, residual uma vez, DATE do dia BRT e não incluem tenant alheio", async () => {
    const rest = fonteRest({
      contas_caixa: [{ id: 1, user_id: 41, ativo: true, saldo: "100" }, { id: 2, user_id: 99, ativo: true, saldo: "9000" }],
      contratos: [{ id: 1, user_id: 41, status: "ativo", valor_principal: "100" }, { id: 2, user_id: 99, status: "ativo", valor_principal: "9000" }],
      parcelas: [parcelaRest(), parcelaRest({ id: 2, status: "parcial", saldo_residual: "40", valor_multa: "15", data_vencimento: "2026-11-05" }), parcelaRest({ id: 3, user_id: 99, status: "atrasada", valor: "9000" }), parcelaRest({ id: 4, status: "cancelada", valor: "9000" })],
      transacoes_caixa: [movimentoRest(), movimentoRest({ id: 2, user_id: 99, valor: "9000" }), movimentoRest({ id: 3, tipo: "saida", valor: "5" }), movimentoRest({ id: 4, data_transacao: "2026-11-07", valor: "10" })],
    });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    expect(await caller().kpis()).toEqual({ saldoTotal: 130, capitalCirculacao: 100, totalReceber: 140, totalInadimplente: 40, qtdInadimplentes: 1, jurosPendentes: 0, qtdVenceHoje: 1, valorVenceHoje: 100, recebidoHoje: 25, contratosAtivos: 1 });
    for (const q of rest.consultas) conferirTenant(q);
    expect(rest.consultas.find(q => q.tabela === "parcelas")?.colunas).toContain("valor,");
  });

  it.each(["kpis", "resumoCaixa", "fluxoMensal", "tendenciaJuros"] as const)("%s recusa owner divergente fora do período antes de agregar ou ler valores", async procedimento => {
    const rest = fonteRest({
      contas_caixa: [{ id: 1, user_id: 41, ativo: true, saldo: "100" }],
      transacoes_caixa: [movimentoRest({ user_id: 99, conta_caixa_id: 1, valor: "918273.45", data_transacao: "2020-01-01", categoria: "outros", tipo: "saida" })],
    });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    await expect(caller()[procedimento]()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(rest.consultas.filter(q => q.tabela === "transacoes_caixa").every(q => q.colunas === "id, user_id, conta_caixa_id")).toBe(true);
    expect(rest.consultas.some(q => q.tabela === "parcelas")).toBe(false);
  });

  it("uma fonte vazia válida continua distinta de fonte ausente", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue(fonteRest().fonte);
    expect(await caller().kpis()).toEqual({ saldoTotal: 0, capitalCirculacao: 0, totalReceber: 0, totalInadimplente: 0, qtdInadimplentes: 0, jurosPendentes: 0, qtdVenceHoje: 0, valorVenceHoje: 0, recebidoHoje: 0, contratosAtivos: 0 });
    expect(await caller().parcelasHoje()).toEqual([]);
    expect(await caller().parcelasAtrasadas()).toEqual([]);
    expect(await caller().fluxoMensal()).toHaveLength(7);
    expect(await caller().tendenciaJuros()).toHaveLength(6);
  });

  it("sinaliza residual inválido em KPI em vez de retornar dívida inventada", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue(fonteRest({ parcelas: [parcelaRest({ status: "parcial", saldo_residual: "-10" })] }).fonte);
    await expect(caller().kpis()).rejects.toThrow(/residual/);
  });

  it("residual inválido não impede consultar o Caixa de fonte independente válida", async () => {
    const rest = fonteRest({
      contas_caixa: [{ id: 1, user_id: 41, ativo: true, saldo: "100" }, { id: 2, user_id: 99, ativo: true, saldo: "9000" }],
      contratos: [{ id: 1, user_id: 41, status: "ativo", valor_principal: "200" }],
      parcelas: [parcelaRest({ status: "parcial", saldo_residual: "0" })],
      transacoes_caixa: [movimentoRest(), movimentoRest({ id: 2, user_id: 99, valor: "9000" })],
    });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    await expect(caller().kpis()).rejects.toThrow(/residual/);
    rest.consultas.length = 0;
    expect(await caller().resumoCaixa()).toEqual({ saldoTotal: 125, capitalCirculacao: 200, recebidoHoje: 25, contratosAtivos: 1 });
    expect(rest.consultas.some(q => q.tabela === "parcelas")).toBe(false);
    for (const q of rest.consultas) conferirTenant(q);
  });

  it("resumo independente falha explicitamente se o livro-caixa falha ou a fonte está ausente", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue(fonteRest({}, q => q.tabela === "transacoes_caixa").fonte);
    await expect(caller().resumoCaixa()).rejects.toThrow(/Falha na consulta/);
    mocks.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(caller().resumoCaixa()).rejects.toThrow(/indisponível/);
  });

  it("últimos sete dias termina em 06/11 e limita DATE sem timestamp", async () => {
    const rest = fonteRest({ transacoes_caixa: [movimentoRest(), movimentoRest({ id: 2, data_transacao: "2026-11-07", valor: "999" }), movimentoRest({ id: 3, user_id: 99, valor: "9000" })] });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    const fluxo = await caller().fluxoMensal();
    expect(fluxo.map(d => d.dia)).toEqual(["31/10", "01/11", "02/11", "03/11", "04/11", "05/11", "06/11"]);
    expect(fluxo.at(-1)).toEqual({ dia: "06/11", valor: 25 });
    for (const q of rest.consultas) {
      conferirTenant(q);
      if (!q.filtros.some(f => f.coluna === "data_transacao")) continue;
      expect(q.filtros.find(f => f.coluna === "data_transacao")?.valor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("atenção usa hoje/mais7/menos30 BRT, status elegível e valor aberto", async () => {
    const rest = fonteRest({ parcelas: [
      parcelaRest({ id: 1, data_vencimento: "2026-11-06", valor_multa: "5" }),
      parcelaRest({ id: 2, data_vencimento: "2026-11-13" }),
      parcelaRest({ id: 3, data_vencimento: "2026-11-14" }),
      parcelaRest({ id: 4, status: "paga" }),
      parcelaRest({ id: 5, data_vencimento: "2026-10-07", status: "atrasada", saldo_residual: "20", valor_multa: "10" }),
      parcelaRest({ id: 6, data_vencimento: "2026-10-08", status: "atrasada" }),
      parcelaRest({ id: 7, data_vencimento: "2026-10-07", status: "atrasada", user_id: 99 }),
    ] });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    expect(await caller().precisaAtencao()).toEqual({ venceSemana: { qtd: 2, valor: 205 }, atrasados30: { qtd: 1, valor: 130 } });
    expect(rest.consultas[0].filtros).toContainEqual({ metodo: "gte", coluna: "data_vencimento", valor: "2026-11-06" });
    expect(rest.consultas[0].filtros).toContainEqual({ metodo: "lte", coluna: "data_vencimento", valor: "2026-11-13" });
    expect(rest.consultas[1].filtros).toContainEqual({ metodo: "lte", coluna: "data_vencimento", valor: "2026-10-07" });
  });

  it("tendência preserva fevereiro em 31/03 e filtra entradas de parcela por DATE", async () => {
    vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));
    const rest = fonteRest({ transacoes_caixa: [movimentoRest({ data_transacao: "2026-02-28" }), movimentoRest({ id: 2, data_transacao: "2026-02-28", categoria: "ajuste", valor: "999" }), movimentoRest({ id: 3, data_transacao: "2026-03-31", user_id: 99, valor: "9000" })] });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    const tendencia = await caller().tendenciaJuros();
    expect(tendencia.map(m => m.mes)).toEqual(["out", "nov", "dez", "jan", "fev", "mar"]);
    expect(tendencia[4].valor).toBe(25);
    const fevereiro = rest.consultas.find(q => q.filtros.some(f => f.coluna === "data_transacao" && f.valor === "2026-02-01"))!;
    expect(fevereiro.filtros).toContainEqual({ metodo: "gte", coluna: "data_transacao", valor: "2026-02-01" });
    expect(fevereiro.filtros).toContainEqual({ metodo: "lte", coluna: "data_transacao", valor: "2026-02-28" });
    for (const q of rest.consultas) for (const f of q.filtros.filter(f => f.coluna === "data_transacao")) expect(f.valor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("joins REST restringem explicitamente tenant do cliente, mesmo com parcela própria", async () => {
    const rest = fonteRest({ parcelas: [parcelaRest(), parcelaRest({ id: 3, user_id: 99 })], clientes: [{ id: 1, nome: "Sintético", user_id: 41 }, { id: 2, nome: "Alheio", user_id: 99 }] });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    const lista = await caller().parcelasHoje();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: 1, clienteNome: "Sintético", numeroParcela: 1, valorOriginal: "100" });
    expect(rest.consultas[0].colunas).not.toContain("clientes!");
    const clientes = rest.consultas.find(q => q.tabela === "clientes")!;
    expect(clientes.filtros).toContainEqual({ metodo: "eq", coluna: "user_id", valor: 41 });
    expect(clientes.filtros).toContainEqual({ metodo: "in", coluna: "id", valor: [1] });
    expect(clientes.limite).toBe(20);
  });

  it("parcela própria com cliente de outra empresa falha sem expor nome nem inventar vínculo", async () => {
    const rest = fonteRest({ parcelas: [parcelaRest({ cliente_id: 2 })], clientes: [{ id: 2, nome: "Alheio não expor", user_id: 99 }] });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    await expect(caller().parcelasHoje()).rejects.toThrow(/sem vínculo de cliente confirmado/);
  });

  it("falha na consulta separada de cliente não vira lista vazia de sucesso", async () => {
    const rest = fonteRest({ parcelas: [parcelaRest()] }, q => q.tabela === "clientes");
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    await expect(caller().parcelasHoje()).rejects.toThrow(/Falha na consulta/);
  });

  it("dias de atraso não avançam às 21h BRT, inclusive no segundo zero UTC", async () => {
    const rest = fonteRest({ parcelas: [parcelaRest({ status: "atrasada", data_vencimento: "2026-11-05" }), parcelaRest({ id: 2, user_id: 99, status: "atrasada" })], clientes: [{ id: 1, nome: "Sintético", user_id: 41 }] });
    mocks.getSupabaseClientAsync.mockResolvedValue(rest.fonte);
    const lista = await caller().parcelasAtrasadas();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ valorAtualizado: 100, diasAtraso: 1 });
    expect(rest.consultas.find(q => q.tabela === "clientes")?.filtros).toContainEqual({ metodo: "eq", coluna: "user_id", valor: 41 });
  });

  it("paginação lê além de 1000 registros, sem truncar silenciosamente o total", async () => {
    const registros = Array.from({ length: 1001 }, (_, id) => movimentoRest({ id }));
    const rest = fonteRest({ transacoes_caixa: registros });
    expect(await listarDashboard(rest.fonte, "transacoes_caixa", "valor", 41)).toHaveLength(1001);
    expect(rest.consultas.map(q => [q.inicio, q.fim])).toEqual([[0, 999], [1000, 1999]]);
  });

  it.each(["kpis", "resumoCaixa", "parcelasHoje", "parcelasAtrasadas", "precisaAtencao", "tendenciaJuros", "fluxoMensal"] as const)("fonte ausente não vira falso sucesso em %s", async (procedimento) => {
    mocks.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(caller()[procedimento]()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it.each(["kpis", "resumoCaixa", "parcelasHoje", "parcelasAtrasadas", "precisaAtencao", "tendenciaJuros", "fluxoMensal"] as const)("erro REST não vira zero/lista vazia em %s", async (procedimento) => {
    mocks.getSupabaseClientAsync.mockResolvedValue(fonteRest({}, () => true).fonte);
    await expect(caller()[procedimento]()).rejects.toThrow(/Falha na consulta/);
  });

  it.each(["contas_caixa", "contratos", "parcelas", "transacoes_caixa"])("falha isolada na fonte %s bloqueia os KPIs", async tabela => {
    mocks.getSupabaseClientAsync.mockResolvedValue(fonteRest({}, q => q.tabela === tabela).fonte);
    await expect(caller().kpis()).rejects.toThrow(/valores não calculados/);
  });
});

type ConsultaDrizzle = { tabela: string; selecao?: Record<string, any>; where?: any; join?: any };
function fonteDrizzle(respostas: any[][] | Record<string, any[]> = [], falha = false) {
  const consultas: ConsultaDrizzle[] = [];
  let indice = 0;
  const db = {
    select(selecao?: Record<string, any>) {
      const q: ConsultaDrizzle = { tabela: "", selecao };
      let limite = 500, offset = 0;
      const builder: any = {
        from(tabela: any) { q.tabela = getTableName(tabela); return builder; },
        where(condicao: any) { q.where = condicao; return builder; },
        innerJoin(_tabela: any, condicao: any) { q.join = condicao; return builder; },
        orderBy() { return builder; }, limit(n: number) { limite = n; return builder; }, offset(n: number) { offset = n; return builder; },
        then(resolve: any, reject: any) {
          consultas.push(q);
          if (falha) return Promise.reject(new Error("Transporte Drizzle indisponível")).then(resolve, reject);
          if (Array.isArray(respostas)) return Promise.resolve(respostas[indice++] ?? []).then(resolve, reject);
          const c = compilar(q.where);
          const rows = (respostas[q.tabela] ?? []).filter(row => {
            if (c.sql.includes('"conta_caixa_id" in')) return c.params.includes(row.conta_caixa_id);
            if (c.sql.includes('DATE(')) return row.tipo === c.params[0] && row.data_transacao === c.params[1] && row.user_id === c.params[2];
            if (c.sql.includes('"status" in')) return c.params.includes(row.status) && row.user_id === c.params.at(-1);
            if (c.sql.includes('"status"')) return row.status === c.params[0] && row.user_id === c.params[1];
            return row.user_id === c.params[0];
          }).sort((a, b) => a.id - b.id);
          const data = selecao && "qtd" in selecao ? [{ qtd: String(rows.length) }]
            : selecao && "total" in selecao ? [{ total: String(rows.reduce((s, row) => s + Number(row.valor), 0)) }]
            : rows.slice(offset, offset + limite).map(row => Object.fromEntries(Object.entries(selecao ?? {}).map(([alias, coluna]) => [alias, coluna.name ? (coluna.name in row ? row[coluna.name] : row[alias]) : alias === "valor" ? row.valor : row.data_transacao])));
          return Promise.resolve(data).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { db, consultas };
}
const compilar = (sql: any) => new PgDialect().sqlToQuery(sql);

describe("dashboard Drizzle: filtros explícitos e paridade", () => {
  const fixtureSQL = () => ({
    contas_caixa: [{ id: 1, user_id: 41, ativo: true, saldo: "100" }],
    transacoes_caixa: [movimentoRest(), movimentoRest({ id: 2, tipo: "saida", categoria: "outros", valor: "5" })],
    contratos: [{ id: 1, user_id: 41, status: "ativo", valor_principal: "100" }],
    parcelas: [
      { id: 1, user_id: 41, status: "pendente", valorOriginal: null, valor: "100", saldoResidual: "0", valorMulta: "0", valorJuros: "0", dataVencimento: "2026-11-06", clienteId: 1 },
      { id: 2, user_id: 41, status: "parcial", valorOriginal: "100", valor: "100", saldoResidual: "40", valorMulta: "15", valorJuros: "0", dataVencimento: "2026-11-05", clienteId: 1 },
    ],
  });
  function conferirConsultaSQL(q: ConsultaDrizzle) {
    const c = compilar(q.where);
    if (c.sql.includes('"conta_caixa_id" in')) expect(c.params).toEqual([1]);
    else { expect(c.sql).toContain(`"${q.tabela}"."user_id"`); expect(c.params).toContain(41); }
  }
  it("resumo de Caixa é independente de parcelas e confere cada conta própria", async () => {
    const drizzle = fonteDrizzle(fixtureSQL());
    mocks.getDb.mockResolvedValue(drizzle.db);
    expect(await caller().resumoCaixa()).toEqual({ saldoTotal: 120, capitalCirculacao: 100, recebidoHoje: 25, contratosAtivos: 1 });
    expect(drizzle.consultas.some(q => q.tabela === "parcelas")).toBe(false);
    drizzle.consultas.forEach(conferirConsultaSQL);
  });
  it("KPIs e resumo usam o mesmo ledger conferido e preservam a carteira", async () => {
    const drizzle = fonteDrizzle(fixtureSQL());
    mocks.getDb.mockResolvedValue(drizzle.db);
    expect(await caller().kpis()).toEqual({ saldoTotal: 120, capitalCirculacao: 100, totalReceber: 140, totalInadimplente: 40, qtdInadimplentes: 1, jurosPendentes: 0, qtdVenceHoje: 1, valorVenceHoje: 100, recebidoHoje: 25, contratosAtivos: 1 });
    drizzle.consultas.forEach(conferirConsultaSQL);
    expect(drizzle.consultas.some(q => compilar(q.where).sql.includes('"conta_caixa_id" in'))).toBe(true);
  });

  it.each(["kpis", "resumoCaixa", "fluxoMensal"] as const)("%s Drizzle recusa conta divergente antes de qualquer agregação", async procedimento => {
    const dados = fixtureSQL();
    dados.transacoes_caixa.push(movimentoRest({ id: 3, user_id: 99, conta_caixa_id: 1, valor: "918273.45" }));
    const drizzle = fonteDrizzle(dados);
    mocks.getDb.mockResolvedValue(drizzle.db);
    await expect(caller()[procedimento]()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(drizzle.consultas.some(q => q.selecao && ("valor" in q.selecao || "total" in q.selecao))).toBe(false);
  });

  it.each(["parcelasHoje", "parcelasAtrasadas"] as const)("join de %s inclui tenant, e contagem de parcelas também", async procedimento => {
    const drizzle = fonteDrizzle([[]]);
    mocks.getDb.mockResolvedValue(drizzle.db);
    await caller()[procedimento]();
    const q = drizzle.consultas[0];
    expect(compilar(q.join).sql).toContain('"clientes"."user_id"');
    expect(compilar(q.join).params).toContain(41);
    expect(compilar(q.where).sql).toContain('"parcelas"."user_id"');
    if (procedimento === "parcelasHoje") {
      const subquery = compilar(q.selecao!.totalParcelas);
      expect(subquery.sql).toContain("p2.user_id");
      expect(subquery.params).toEqual([41]);
    }
  });

  it("fluxo Drizzle termina no dia BRT e todas consultas incluem tenant", async () => {
    const drizzle = fonteDrizzle({ contas_caixa: [], transacoes_caixa: [], contratos: [] });
    mocks.getDb.mockResolvedValue(drizzle.db);
    expect((await caller().fluxoMensal()).at(-1)).toEqual({ dia: "06/11", valor: 0 });
    expect(drizzle.consultas.filter(q => q.selecao && "total" in q.selecao).map(q => compilar(q.where).params)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"].map(data => ["entrada", data, 41]));
  });

  it.each(["kpis", "resumoCaixa", "parcelasHoje", "parcelasAtrasadas", "fluxoMensal"] as const)("falha Drizzle em %s não é mascarada por fallback vazio", async procedimento => {
    mocks.getDb.mockResolvedValue(fonteDrizzle([], true).db);
    mocks.getSupabaseClientAsync.mockResolvedValue(fonteRest().fonte);
    await expect(caller()[procedimento]()).rejects.toThrow(/Transporte Drizzle/);
    expect(mocks.resetDb).not.toHaveBeenCalled();
  });
});
