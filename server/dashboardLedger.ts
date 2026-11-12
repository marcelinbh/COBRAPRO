import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { contasCaixa, contratos, transacoesCaixa } from "../drizzle/schema";
import { calcularSaldoAtual, calcularSaldoAtualDecimal, type MovimentoCaixa } from "../shared/caixa";
import { dataRelatorio } from "../shared/reporting";
import { exigirFonteDashboard } from "./dashboardQueries";
import {
  listarFinancialReporting, REPORTING_MAX_PAGES, REPORTING_PAGE_SIZE,
  validarIntegridadeLedgerFinancialReporting,
} from "./financialReporting";

function revisao(): never {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Livro-caixa com vínculo ou valor inválido; revisão necessária." });
}

function decimal(valor: unknown, negativo = false): string {
  const texto = typeof valor === "number" ? String(valor) : valor;
  if (typeof texto !== "string" || !(negativo ? /^-?\d+(?:\.\d{1,2})?$/ : /^\d+(?:\.\d{1,2})?$/).test(texto)) revisao();
  return texto;
}

/** Preserva decimais na entrada e BigInt no acumulador, inclusive entre contas. */
function totalDecimal(valores: readonly string[]): number {
  return calcularSaldoAtual("0.00", valores.map(valor => ({
    tipo: valor.startsWith("-") ? "saida" : "entrada",
    valor: valor.startsWith("-") ? valor.slice(1) : valor,
  })));
}

function validarMovimento(row: any, userId: number, contas: ReadonlySet<number>): MovimentoCaixa {
  if (row.user_id !== userId || !contas.has(row.conta_caixa_id) || !["entrada", "saida"].includes(row.tipo)
    || typeof row.categoria !== "string" || !row.categoria) revisao();
  dataRelatorio(row.data_transacao);
  return { tipo: row.tipo, valor: decimal(row.valor) };
}

/** SQL não tem teto REST, mas ainda exige ordem, limites e contagem confirmada.
 * SELECTs de integridade projetam só metadados e ficam restritos às contas próprias. */
async function listarDrizzle(db: any, tabela: any, colunas: Record<string, any>, condicao: any, validar: (row: any) => boolean): Promise<any[]> {
  const contar = async () => {
    const rows = await db.select({ qtd: sql<string>`COUNT(*)` }).from(tabela).where(condicao).limit(1);
    const raw = rows?.[0]?.qtd;
    if ((typeof raw !== "number" && (typeof raw !== "string" || !/^\d+$/.test(raw))) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 0) revisao();
    return Number(raw);
  };
  const esperado = await contar();
  const rows: any[] = [];
  const ids = new Set<number>();
  for (let pagina = 0; pagina < REPORTING_MAX_PAGES; pagina++) {
    const lote = await db.select(colunas).from(tabela).where(condicao).orderBy(tabela.id)
      .limit(REPORTING_PAGE_SIZE).offset(pagina * REPORTING_PAGE_SIZE);
    if (!Array.isArray(lote) || lote.length > REPORTING_PAGE_SIZE) revisao();
    for (const row of lote) {
      if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id) || !validar(row)) revisao();
      ids.add(row.id);
      rows.push(row);
    }
    if (rows.length > esperado) revisao();
    if (lote.length < REPORTING_PAGE_SIZE) {
      if (rows.length !== esperado || await contar() !== esperado) revisao();
      return rows;
    }
  }
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Limite de leitura excedido; total incompleto não apresentado." });
}

async function lerFonteDrizzle(db: any, userId: number) {
  const contas = await listarDrizzle(db, contasCaixa,
    { id: contasCaixa.id, user_id: contasCaixa.userId, saldo: contasCaixa.saldo, ativo: contasCaixa.ativo },
    eq(contasCaixa.userId, userId), row => row.user_id === userId);
  const contaIds = contas.map(c => c.id);
  for (let inicio = 0; inicio < contaIds.length; inicio += 100) {
    const lote = contaIds.slice(inicio, inicio + 100);
    await listarDrizzle(db, transacoesCaixa,
      { id: transacoesCaixa.id, user_id: transacoesCaixa.userId, conta_caixa_id: transacoesCaixa.contaCaixaId },
      inArray(transacoesCaixa.contaCaixaId, lote), row => row.user_id === userId && lote.includes(row.conta_caixa_id));
  }
  const transacoes = await listarDrizzle(db, transacoesCaixa, {
    id: transacoesCaixa.id, user_id: transacoesCaixa.userId, conta_caixa_id: transacoesCaixa.contaCaixaId,
    tipo: transacoesCaixa.tipo, categoria: transacoesCaixa.categoria, valor: transacoesCaixa.valor,
    data_transacao: sql<string>`DATE(${transacoesCaixa.dataTransacao})::text`,
  }, eq(transacoesCaixa.userId, userId), row => row.user_id === userId);
  const contratosData = await listarDrizzle(db, contratos,
    { id: contratos.id, user_id: contratos.userId, valor_principal: contratos.valorPrincipal },
    and(eq(contratos.status, "ativo"), eq(contratos.userId, userId)), row => row.user_id === userId);
  return { contas, contratosData, transacoes };
}

/** Somente leitura; divergência no livro inteiro bloqueia saldo/recebimento,
 * sem ignorar outro tenant nem expor seus valores. Não reconstrói o legado. */
export async function lerResumoCaixaDashboard(db: any, fonte: any, userId: number, hoje: string) {
  dataRelatorio(hoje);
  let dados: { contas: any[]; contratosData: any[]; transacoes: any[] };
  if (db) {
    dados = await lerFonteDrizzle(db, userId);
  } else {
    const supabase = exigirFonteDashboard(fonte);
    const contas = await listarFinancialReporting(supabase, "contas_caixa", "id, user_id, saldo, ativo", userId);
    await validarIntegridadeLedgerFinancialReporting(supabase, userId, contas.map(c => c.id));
    const [contratosData, transacoes] = await Promise.all([
      listarFinancialReporting(supabase, "contratos", "id, user_id, valor_principal", userId, q => q.eq("status", "ativo")),
      listarFinancialReporting(supabase, "transacoes_caixa", "id, user_id, conta_caixa_id, valor, tipo, categoria, data_transacao", userId),
    ]);
    dados = { contas, contratosData, transacoes };
  }
  const { contas, contratosData, transacoes } = dados;
  const contasProprias = new Set<number>(contas.map(c => c.id));
  const movimentos = new Map<number, MovimentoCaixa[]>();
  const recebidos: string[] = [];
  for (const t of transacoes) {
    const movimento = validarMovimento(t, userId, contasProprias);
    const lote = movimentos.get(t.conta_caixa_id) ?? [];
    lote.push(movimento);
    movimentos.set(t.conta_caixa_id, lote);
    if (t.tipo === "entrada" && t.categoria === "pagamento_parcela" && t.data_transacao === hoje) recebidos.push(decimal(t.valor));
  }
  const saldos: string[] = [];
  for (const conta of contas) {
    if (typeof conta.ativo !== "boolean") revisao();
    if (conta.ativo) saldos.push(calcularSaldoAtualDecimal(decimal(conta.saldo, true), movimentos.get(conta.id) ?? []));
  }
  return {
    saldoTotal: totalDecimal(saldos),
    capitalCirculacao: totalDecimal(contratosData.map(c => decimal(c.valor_principal))),
    recebidoHoje: totalDecimal(recebidos), contratosAtivos: contratosData.length,
  };
}
