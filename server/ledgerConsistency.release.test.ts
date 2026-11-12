import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { lerResumoCaixaDashboard } from "./dashboardLedger";
import {
  lerLedgerFinancialReporting, lerRelatorioFinancialReporting, lerScoreFinancialReporting,
  listarFinancialReporting, REPORTING_PAGE_SIZE, validarIntegridadeLedgerFinancialReporting,
} from "./financialReporting";

type Filtro = { metodo: string; coluna: string; valor: any };
type Consulta = { tabela: string; colunas: string; filtros: Filtro[]; inicio: number; fim: number; count?: string; ordem?: string };
type Opcoes = { falha?: (q: Consulta) => boolean; resposta?: (q: Consulta, r: any) => any };
const DIA = "2026-11-12";
const conta = (extra: Record<string, any> = {}) => ({ id: 15, user_id: 41, ativo: true, saldo: "2500.00", ...extra });
const movimento = (extra: Record<string, any> = {}) => ({ id: 1, user_id: 41, conta_caixa_id: 15, tipo: "entrada", categoria: "pagamento_parcela", valor: "0.10", data_transacao: DIA, parcela_id: null, contrato_id: null, ...extra });
const contrato = (extra: Record<string, any> = {}) => ({ id: 1, user_id: 41, status: "ativo", valor_principal: "0.10", ...extra });
const base = (extra: Record<string, any[]> = {}) => ({ contas_caixa: [conta()], transacoes_caixa: [], contratos: [], ...extra });

/** Mock projeta apenas as colunas requisitadas e aplica filtros ANTES de range.
 * Não devolve dados ocultos que mascarariam ausência de user_id/conta_caixa_id. */
function fonteRest(tabelas: Record<string, any[]>, opcoes: Opcoes = {}) {
  const consultas: Consulta[] = [];
  const fonte = { from(tabela: string) {
    const q: Consulta = { tabela, colunas: "", filtros: [], inicio: 0, fim: 499 };
    const builder: any = {
      select(colunas: string, options?: any) { q.colunas = colunas; q.count = options?.count; return builder; },
      order(coluna: string) { q.ordem = coluna; return builder; },
      range(inicio: number, fim: number) { q.inicio = inicio; q.fim = fim; return builder; },
      then(resolve: any, reject: any) {
        consultas.push(q);
        if (opcoes.falha?.(q)) return Promise.resolve({ data: null, error: { message: "segredo do banco/tenant não deve aparecer" }, count: null }).then(resolve, reject);
        const rows = (tabelas[q.tabela] ?? []).filter(row => q.filtros.every(f => {
          if (f.metodo === "eq") return row[f.coluna] === f.valor;
          if (f.metodo === "in") return f.valor.includes(row[f.coluna]);
          if (f.metodo === "gte") return row[f.coluna] >= f.valor;
          if (f.metodo === "lte") return row[f.coluna] <= f.valor;
          throw new Error("Filtro inesperado");
        })).sort((a, b) => a.id - b.id);
        const data = rows.slice(q.inicio, q.fim + 1).map(row => Object.fromEntries(q.colunas.split(",").map(c => c.trim()).map(c => [c, row[c]])));
        const resposta = { data, error: null, count: rows.length };
        return Promise.resolve(opcoes.resposta ? opcoes.resposta(q, resposta) : resposta).then(resolve, reject);
      },
    };
    for (const metodo of ["eq", "in", "gte", "lte"]) builder[metodo] = (coluna: string, valor: any) => { q.filtros.push({ metodo, coluna, valor }); return builder; };
    for (const metodo of ["insert", "update", "delete", "upsert", "rpc"]) builder[metodo] = () => { throw new Error(`Write proibido: ${metodo}`); };
    return builder;
  } };
  return { fonte, consultas };
}
const integridade = (q: Consulta) => q.tabela === "transacoes_caixa" && q.colunas === "id, user_id, conta_caixa_id";
const valores = (q: Consulta) => q.tabela === "transacoes_caixa" && q.colunas.split(",").map(c => c.trim()).includes("valor");
const resumo = (rest: ReturnType<typeof fonteRest>) => lerResumoCaixaDashboard(null, rest.fonte, 41, DIA);
const ledger = (rest: ReturnType<typeof fonteRest>) => lerLedgerFinancialReporting(rest.fonte, 41, DIA, DIA);

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Rede proibida: somente mocks locais"); })));
afterEach(() => vi.unstubAllGlobals());

describe("release: nenhum saldo validado oculta vínculo divergente na conta alvo", () => {
  it.each([resumo, ledger])("contas 15/19 com 12 lançamentos de outro owner falham 412, não saldo 2500", async ler => {
    const rest = fonteRest(base({ contas_caixa: [conta(), conta({ id: 19, saldo: "0.00" })], transacoes_caixa: Array.from({ length: 12 }, (_, i) => movimento({ id: i + 1, conta_caixa_id: i % 2 ? 19 : 15, user_id: 99, valor: "918273.45", descricao: "SEGREDO ALHEIO" })) }));
    await expect(ler(rest)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(rest.consultas.some(valores)).toBe(false);
    expect(rest.consultas.filter(integridade)).toHaveLength(1);
    const erro = await ler(rest).catch(e => e);
    expect(erro.message).not.toMatch(/918273|99|SEGREDO|15|19/);
  });
  it.each([resumo, ledger])("não deixa tenant legítimo em conta alheia contaminar nem ser exposto", async ler => {
    const rest = fonteRest(base({ contas_caixa: [conta(), conta({ id: 88, user_id: 99, saldo: "777777.77" })], transacoes_caixa: [movimento(), movimento({ id: 2, user_id: 99, conta_caixa_id: 88, valor: "918273.45" })] }));
    const resultado = await ler(rest);
    expect(JSON.stringify(resultado)).not.toMatch(/918273|777777|"user_id":99/);
    expect(resultado).toMatchObject(ler === resumo ? { saldoTotal: 2500.1, recebidoHoje: 0.1 } : { recebido: 0.1, quantidade: 1 });
    for (const q of rest.consultas) {
      expect(q.colunas).not.toBe("*"); expect(q.colunas).not.toContain("descricao");
      expect(q.count).toBe("exact"); expect(q.ordem).toBe("id");
      if (integridade(q)) {
        expect(q.filtros).toEqual([{ metodo: "in", coluna: "conta_caixa_id", valor: [15] }]);
      } else expect(q.filtros).toContainEqual({ metodo: "eq", coluna: "user_id", valor: 41 });
    }
  });
  it.each([resumo, ledger])("bloqueia lançamento do usuário apontando para conta alheia/inexistente", async ler => {
    const rest = fonteRest(base({ contas_caixa: [conta(), conta({ id: 88, user_id: 99 })], transacoes_caixa: [movimento({ conta_caixa_id: 88 })] }));
    await expect(ler(rest)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it.each([resumo, ledger])("owner nulo na conta alvo nunca equivale a zero confirmado", async ler => {
    const rest = fonteRest(base({ transacoes_caixa: [movimento({ user_id: null })] }));
    await expect(ler(rest)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("conferência cobre conta inativa e divergência fora do período/tipo/categoria", async () => {
    const rest = fonteRest(base({ contas_caixa: [conta(), conta({ id: 19, ativo: false })], transacoes_caixa: [movimento({ user_id: 99, conta_caixa_id: 19, tipo: "saida", categoria: "outros", data_transacao: "2020-01-01" })] }));
    await expect(resumo(rest)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(lerLedgerFinancialReporting(rest.fonte, 41, DIA, DIA, q => q.eq("tipo", "entrada").eq("categoria", "pagamento_parcela"))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(rest.consultas.filter(integridade).every(q => q.filtros.length === 1)).toBe(true);
  });
  it("relatório parcial apresenta indisponibilidade sem dados nem falso zero de Caixa", async () => {
    const rest = fonteRest(base({ transacoes_caixa: [movimento({ user_id: 99, valor: "918273.45" })] }));
    const r = await lerRelatorioFinancialReporting(rest.fonte, 41, { inicio: DIA, fim: DIA }, DIA);
    expect(r.completo).toBe(false);
    expect(r.ledger).toMatchObject({ status: "indisponivel", completo: false });
    expect(r.fluxo).toMatchObject({ status: "indisponivel", completo: false });
    expect(r.ledger).not.toHaveProperty("dados");
    expect(JSON.stringify(r)).not.toContain("918273");
    await expect(lerScoreFinancialReporting(rest.fonte, 41, DIA)).rejects.toThrow();
  });
  it("relatório/extrato válidos preservam carteira, vínculos e centavos", async () => {
    const rest = fonteRest(base({
      contratos: [contrato({ cliente_id: 7, modalidade: "mensal", data_inicio: "2026-11-01" })],
      clientes: [{ id: 7, user_id: 41, nome: "Cliente próprio", ativo: true }],
      parcelas: [{ id: 1, user_id: 41, contrato_id: 1, cliente_id: 7, numero_parcela: 1, valor: "0.20", valor_original: null, saldo_residual: "0.00", valor_multa: "0.00", status: "pendente", data_vencimento: DIA }],
      transacoes_caixa: [movimento({ contrato_id: 1, parcela_id: 1 })],
    }));
    const r = await lerRelatorioFinancialReporting(rest.fonte, 41, { inicio: DIA, fim: DIA, clienteId: 7 }, DIA);
    expect(r.completo).toBe(true);
    expect(r.ledger).toMatchObject({ status: "validado", completo: true, dados: { recebido: 0.1 } });
    expect(r.dividas).toMatchObject({ status: "validado", dados: { aberto: 0.2 } });
    expect(r.extrato).toMatchObject({ status: "validado", dados: { recebidoPeriodo: 0.1 } });
    expect(await lerScoreFinancialReporting(rest.fonte, 41, DIA)).toMatchObject({ completo: true, totalRecebido: 0.1, totalAberto: 0.2, denominador: 0.3 });
  });
});

describe("release: completude, paginação e falhas fechadas REST", () => {
  it.each([resumo, ledger])("divergência apenas no 1001º registro ainda bloqueia na terceira página", async ler => {
    const rest = fonteRest(base({ transacoes_caixa: [...Array.from({ length: 1000 }, (_, i) => movimento({ id: i + 1 })), movimento({ id: 1001, user_id: 99 })] }));
    await expect(ler(rest)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(rest.consultas.filter(integridade).map(q => [q.inicio, q.fim])).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(rest.consultas.some(valores)).toBe(false);
  });
  it.each([resumo, ledger])("1001 movimentos completos mantêm último centavo e período antes de range", async ler => {
    const rest = fonteRest(base({ contas_caixa: [conta({ saldo: "0.00" })], transacoes_caixa: Array.from({ length: 1001 }, (_, i) => movimento({ id: i + 1, valor: "0.01" })) }));
    expect(await ler(rest)).toMatchObject(ler === resumo ? { saldoTotal: 10.01, recebidoHoje: 10.01 } : { recebido: 10.01, quantidade: 1001 });
    expect(rest.consultas.filter(valores).map(q => q.inicio)).toEqual([0, 500, 1000]);
    if (ler === ledger) for (const q of rest.consultas.filter(valores)) {
      expect(q.filtros).toContainEqual({ metodo: "gte", coluna: "data_transacao", valor: DIA });
      expect(q.filtros).toContainEqual({ metodo: "lte", coluna: "data_transacao", valor: DIA });
    }
  });
  it.each(["count-null", "count-diverge", "truncada", "duplicada", "falha", "owner", "conta"])("integridade %s indisponibiliza total sem ler valores", async caso => {
    const rest = fonteRest(base({ transacoes_caixa: Array.from({ length: 501 }, (_, i) => movimento({ id: i + 1 })) }), {
      falha: q => caso === "falha" && integridade(q) && q.inicio === 500,
      resposta: (q, r) => {
        if (!integridade(q)) return r;
        if (caso === "count-null") return { ...r, count: null };
        if (caso === "count-diverge" && q.inicio) return { ...r, count: r.count + 1 };
        if (caso === "truncada") return { ...r, data: r.data.slice(0, 100) };
        if (caso === "duplicada" && q.inicio) return { ...r, data: [{ ...r.data[0], id: 1 }] };
        if (caso === "owner") return { ...r, data: [{ ...r.data[0], user_id: 99 }] };
        if (caso === "conta") return { ...r, data: [{ ...r.data[0], conta_caixa_id: 88 }] };
        return r;
      },
    });
    await expect(resumo(rest)).rejects.toThrow();
    await expect(ledger(rest)).rejects.toThrow();
    expect(rest.consultas.some(valores)).toBe(false);
  });
  it("fonte ausente, erro de SELECT e resposta ausente não viram saldo zero", async () => {
    await expect(lerResumoCaixaDashboard(null, null, 41, DIA)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(lerLedgerFinancialReporting(null, 41)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    for (const rest of [fonteRest(base(), { falha: () => true }), fonteRest(base(), { resposta: () => ({ data: null, count: 0, error: null }) })]) {
      await expect(resumo(rest)).rejects.toThrow(); await expect(ledger(rest)).rejects.toThrow();
    }
  });
  it.each([resumo, ledger])("vazio confirmado é zero legítimo, sem consulta global de integridade", async ler => {
    const rest = fonteRest(base({ contas_caixa: [] }));
    expect(await ler(rest)).toMatchObject(ler === resumo ? { saldoTotal: 0, recebidoHoje: 0 } : { recebido: 0, quantidade: 0 });
    expect(rest.consultas.filter(integridade)).toHaveLength(0);
    expect(rest.consultas.filter(valores).every(q => q.filtros.some(f => f.coluna === "user_id" && f.valor === 41))).toBe(true);
  });
  it("mais de 100 contas próprias gera lotes autorizados, nunca leitura global", async () => {
    const rest = fonteRest(base({ contas_caixa: Array.from({ length: 101 }, (_, i) => conta({ id: i + 1, saldo: "0.01" })), transacoes_caixa: [movimento({ conta_caixa_id: 101 })] }));
    expect(await resumo(rest)).toMatchObject({ saldoTotal: 1.11 });
    const checks = rest.consultas.filter(integridade);
    expect(checks).toHaveLength(2);
    expect(checks.map(q => q.filtros[0].valor.length)).toEqual([100, 1]);
  });
  it("limite de paginação não apresenta 100000 registros como total completo", async () => {
    const rest = fonteRest({ transacoes_caixa: [] }, { resposta: (q, r) => ({ ...r, count: REPORTING_PAGE_SIZE * 201, data: Array.from({ length: REPORTING_PAGE_SIZE }, (_, i) => ({ id: q.inicio + i + 1, user_id: 41 })) }) });
    await expect(listarFinancialReporting(rest.fonte, "transacoes_caixa", "id, user_id", 41)).rejects.toThrow(/Limite de leitura/);
    expect(rest.consultas).toHaveLength(200);
  });
  it("IDs inválidos de contas não permitem ampliar a consulta de integridade", async () => {
    const rest = fonteRest(base());
    await expect(validarIntegridadeLedgerFinancialReporting(rest.fonte, 41, [15, 15])).rejects.toThrow();
    await expect(validarIntegridadeLedgerFinancialReporting(rest.fonte, 41, [0])).rejects.toThrow();
    expect(rest.consultas).toHaveLength(0);
  });
  it.each(["owner", "conta", "truncada", "count", "erro"])("leitura monetária inválida %s após integridade limpa ainda bloqueia", async caso => {
    const rest = fonteRest(base({ transacoes_caixa: Array.from({ length: 501 }, (_, i) => movimento({ id: i + 1 })) }), {
      resposta: (q, r) => {
        if (!valores(q)) return r;
        if (caso === "owner") return { ...r, data: [{ ...r.data[0], user_id: 99 }] };
        if (caso === "conta") return { ...r, data: [{ ...r.data[0], conta_caixa_id: 88 }] };
        if (caso === "truncada") return { ...r, data: r.data.slice(0, 10) };
        if (caso === "count") return { ...r, count: null };
        return { data: null, count: null, error: { message: "valor alheio 918273.45" } };
      },
    });
    await expect(resumo(rest)).rejects.toThrow();
    await expect(ledger(rest)).rejects.toThrow();
  });
});

describe("release: centavos sem floats nem zeros inventados", () => {
  it("soma saldos de contas, entradas e capital em centavos exatos", async () => {
    const rest = fonteRest(base({ contas_caixa: [conta({ saldo: "0.10" }), conta({ id: 19, saldo: "0.20" })], contratos: [contrato(), contrato({ id: 2, valor_principal: "0.20" })] }));
    expect(await resumo(rest)).toEqual({ saldoTotal: 0.3, capitalCirculacao: 0.3, recebidoHoje: 0, contratosAtivos: 2 });
  });
  it("saldo-base negativo e despesas não são arredondados ou somados de novo", async () => {
    const rest = fonteRest(base({ contas_caixa: [conta({ saldo: "-0.01" })], transacoes_caixa: [movimento(), movimento({ id: 2, valor: "0.20" }), movimento({ id: 3, tipo: "saida", categoria: "outros", valor: "100.00" })] }));
    expect(await resumo(rest)).toMatchObject({ saldoTotal: -99.71, recebidoHoje: 0.3 });
    expect(await ledger(rest)).toMatchObject({ saldo: -99.7, recebido: 0.3 });
  });
  it("saldos intermediários altos cancelam exatamente inclusive entre contas", async () => {
    const rest = fonteRest(base({ contas_caixa: [conta({ saldo: "0.01" }), conta({ id: 19, saldo: "0.02" })], transacoes_caixa: [
      ...Array.from({ length: 10 }, (_, i) => movimento({ id: i + 1, categoria: "outros", valor: "9999999999999.99" })),
      ...Array.from({ length: 10 }, (_, i) => movimento({ id: i + 11, conta_caixa_id: 19, tipo: "saida", categoria: "outros", valor: "9999999999999.99" })),
    ] }));
    expect(await resumo(rest)).toMatchObject({ saldoTotal: 0.03 });
  });
  it.each([null, undefined, "", "NaN", "1.001", "0.30000000000000004", "-1.00", Infinity])("valor %s nunca vira zero/arredondamento", async valor => {
    const rest = fonteRest(base({ transacoes_caixa: [movimento({ valor })] }));
    await expect(resumo(rest)).rejects.toThrow(); await expect(ledger(rest)).rejects.toThrow();
  });
  it.each([null, undefined, "", "NaN", "0.001"])("saldo-base inválido %s não vira zero", async saldo => {
    await expect(resumo(fonteRest(base({ contas_caixa: [conta({ saldo })] })))).rejects.toThrow();
  });
  it("transporte numérico que perde centavo não é sucesso", async () => {
    const rest = fonteRest(base({ contas_caixa: [conta({ saldo: "9007199254740992.01" })] }));
    await expect(resumo(rest)).rejects.toThrow(/numérica insegura/);
  });
  it("conta inativa limpa não entra no saldo mas seu recebimento válido permanece", async () => {
    const rest = fonteRest(base({ contas_caixa: [conta({ ativo: false })], transacoes_caixa: [movimento()] }));
    expect(await resumo(rest)).toMatchObject({ saldoTotal: 0, recebidoHoje: 0.1 });
  });
  it.each([{ tipo: "transferencia" }, { categoria: "" }, { data_transacao: "2026-02-30" }])("movimento inválido %j continua bloqueado", async override => {
    const rest = fonteRest(base({ transacoes_caixa: [movimento(override)] }));
    await expect(resumo(rest)).rejects.toThrow();
    await expect(lerLedgerFinancialReporting(rest.fonte, 41)).rejects.toThrow();
  });
});

type ConsultaSQL = { tabela: string; selecao: Record<string, any>; sql: string; params: any[]; limite: number; offset: number };
function fonteDrizzle(tabelas: Record<string, any[]>, alterar?: (q: ConsultaSQL, rows: any[]) => any[]) {
  const consultas: ConsultaSQL[] = [];
  const db = { select(selecao: Record<string, any>) {
    const q: ConsultaSQL = { tabela: "", selecao, sql: "", params: [], limite: 0, offset: 0 };
    const builder: any = {
      from(tabela: any) { q.tabela = getTableName(tabela); return builder; },
      where(condicao: any) { const c = new PgDialect().sqlToQuery(condicao); q.sql = c.sql; q.params = c.params; return builder; },
      orderBy() { return builder; }, limit(limite: number) { q.limite = limite; return builder; }, offset(offset: number) { q.offset = offset; return builder; },
      then(resolve: any, reject: any) {
        consultas.push(q);
        const rows = (tabelas[q.tabela] ?? []).filter(row => {
          if (q.sql.includes('"conta_caixa_id" in')) return q.params.includes(row.conta_caixa_id);
          if (q.sql.includes('"status"')) return row.status === q.params[0] && row.user_id === q.params[1];
          return row.user_id === q.params[0];
        }).sort((a, b) => a.id - b.id);
        let data: any[];
        if ("qtd" in q.selecao) data = [{ qtd: String(rows.length) }];
        else data = rows.slice(q.offset, q.offset + q.limite).map(row => Object.fromEntries(Object.entries(q.selecao).map(([alias, coluna]) => [alias, coluna.name ? row[coluna.name] : row.data_transacao])));
        return Promise.resolve(alterar ? alterar(q, data) : data).then(resolve, reject);
      },
    };
    return builder;
  } };
  return { db, consultas };
}
const resumoSQL = (drizzle: ReturnType<typeof fonteDrizzle>) => lerResumoCaixaDashboard(drizzle.db, null, 41, DIA);
const integridadeSQL = (q: ConsultaSQL) => q.tabela === "transacoes_caixa" && q.sql.includes('"conta_caixa_id" in');

describe("release: Drizzle tem a mesma política de ownership/precisão", () => {
  it("saldo 2500 em conta 15 com owner divergente bloqueia antes de valores SQL", async () => {
    const drizzle = fonteDrizzle(base({ transacoes_caixa: [movimento({ user_id: 99, valor: "918273.45" })] }));
    await expect(resumoSQL(drizzle)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const checks = drizzle.consultas.filter(integridadeSQL);
    expect(checks.every(q => q.params.every(id => id === 15))).toBe(true);
    expect(checks.some(q => "valor" in q.selecao)).toBe(false);
    expect(drizzle.consultas.some(q => "valor" in q.selecao)).toBe(false);
  });
  it("Drizzle pagina 1001 linhas, conta antes/depois e equivale ao REST", async () => {
    const dados = base({ contas_caixa: [conta({ saldo: "-0.01" }), conta({ id: 19, saldo: "0.20" })], contratos: [contrato()], transacoes_caixa: Array.from({ length: 1001 }, (_, i) => movimento({ id: i + 1, valor: "0.01" })) });
    const drizzle = fonteDrizzle(dados);
    expect(await resumoSQL(drizzle)).toEqual(await resumo(fonteRest(dados)));
    const pages = drizzle.consultas.filter(q => integridadeSQL(q) && !("qtd" in q.selecao));
    expect(pages.map(q => [q.offset, q.limite])).toEqual([[0, 500], [500, 500], [1000, 500]]);
    expect(drizzle.consultas.filter(q => integridadeSQL(q) && "qtd" in q.selecao)).toHaveLength(2);
    const monetarias = drizzle.consultas.filter(q => "valor" in q.selecao);
    expect(monetarias.every(q => q.sql.includes('"user_id"') && q.params.includes(41))).toBe(true);
  });
  it("Drizzle vazio confirmado é zero sem IN vazio ou consulta global", async () => {
    const drizzle = fonteDrizzle(base({ contas_caixa: [] }));
    expect(await resumoSQL(drizzle)).toEqual({ saldoTotal: 0, capitalCirculacao: 0, recebidoHoje: 0, contratosAtivos: 0 });
    expect(drizzle.consultas.some(integridadeSQL)).toBe(false);
  });
  it("owner divergente na terceira página SQL não é ignorado", async () => {
    const drizzle = fonteDrizzle(base({ transacoes_caixa: [...Array.from({ length: 1000 }, (_, i) => movimento({ id: i + 1 })), movimento({ id: 1001, user_id: 99 })] }));
    await expect(resumoSQL(drizzle)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(drizzle.consultas.some(q => "valor" in q.selecao)).toBe(false);
  });
  it.each(["count", "truncada", "duplicada", "mudou"])("resposta SQL %s não produz total incompleto", async caso => {
    let contas = 0;
    const drizzle = fonteDrizzle(base({ transacoes_caixa: Array.from({ length: 501 }, (_, i) => movimento({ id: i + 1 })) }), (q, rows) => {
      if (!integridadeSQL(q)) return rows;
      if ("qtd" in q.selecao) {
        contas++;
        if (caso === "count") return [{ qtd: null }];
        if (caso === "mudou" && contas > 1) return [{ qtd: "502" }];
      }
      if (caso === "truncada" && !("qtd" in q.selecao)) return rows.slice(0, 100);
      if (caso === "duplicada" && q.offset) return [{ ...rows[0], id: 1 }];
      return rows;
    });
    await expect(resumoSQL(drizzle)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("vínculo inverso e valor ausente são bloqueados no SQL", async () => {
    await expect(resumoSQL(fonteDrizzle(base({ transacoes_caixa: [movimento({ conta_caixa_id: 88 })] })))).rejects.toThrow();
    await expect(resumoSQL(fonteDrizzle(base({ transacoes_caixa: [movimento({ valor: null })] })))).rejects.toThrow();
  });
});
