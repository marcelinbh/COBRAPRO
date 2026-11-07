import { and, eq, sql } from "drizzle-orm";
import { contasCaixa, contratos, transacoesCaixa } from "../drizzle/schema";
import { numeroDashboard, saldoContaDashboard } from "../shared/dashboardPortfolio";
import { exigirFonteDashboard, listarDashboard } from "./dashboardQueries";

/** Somente leitura; o livro-caixa não depende de inferir o residual de parcelas. */
export async function lerResumoCaixaDashboard(db: any, fonte: any, userId: number, hoje: string) {
  if (db) {
    const contas = await db.select({ id: contasCaixa.id, saldo: contasCaixa.saldo })
      .from(contasCaixa).where(and(eq(contasCaixa.ativo, true), eq(contasCaixa.userId, userId)));
    let saldoTotal = 0;
    for (const conta of contas) {
      const entradas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
        .from(transacoesCaixa).where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, "entrada"), eq(transacoesCaixa.userId, userId)));
      const saidas = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
        .from(transacoesCaixa).where(and(eq(transacoesCaixa.contaCaixaId, conta.id), eq(transacoesCaixa.tipo, "saida"), eq(transacoesCaixa.userId, userId)));
      saldoTotal += saldoContaDashboard(conta.saldo, [
        { tipo: "entrada", valor: entradas[0]?.total }, { tipo: "saida", valor: saidas[0]?.total },
      ]);
    }
    const capital = await db.select({ total: sql<string>`COALESCE(SUM(valor_principal), 0)` })
      .from(contratos).where(and(eq(contratos.status, "ativo"), eq(contratos.userId, userId)));
    const recebido = await db.select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
      .from(transacoesCaixa).where(and(eq(transacoesCaixa.tipo, "entrada"), eq(transacoesCaixa.categoria, "pagamento_parcela"), eq(sql`DATE(${transacoesCaixa.dataTransacao})`, hoje), eq(transacoesCaixa.userId, userId)));
    const quantidade = await db.select({ qtd: sql<number>`COUNT(*)` })
      .from(contratos).where(and(eq(contratos.status, "ativo"), eq(contratos.userId, userId)));
    return {
      saldoTotal, capitalCirculacao: numeroDashboard(capital[0]?.total, "capital"),
      recebidoHoje: numeroDashboard(recebido[0]?.total, "recebimento"),
      contratosAtivos: numeroDashboard(quantidade[0]?.qtd, "quantidade de contratos"),
    };
  }
  const supabase = exigirFonteDashboard(fonte);
  const [contas, contratosData, transacoes] = await Promise.all([
    listarDashboard(supabase, "contas_caixa", "id, saldo, ativo", userId, q => q.eq("ativo", true)),
    listarDashboard(supabase, "contratos", "valor_principal", userId, q => q.eq("status", "ativo")),
    listarDashboard(supabase, "transacoes_caixa", "conta_caixa_id, valor, tipo, categoria, data_transacao", userId),
  ]);
  const saldoTotal = contas.reduce((s: number, conta: any) => s + saldoContaDashboard(conta.saldo, transacoes.filter(t => t.conta_caixa_id === conta.id)), 0);
  const capitalCirculacao = contratosData.reduce((s: number, c: any) => s + Math.round(numeroDashboard(c.valor_principal, "capital") * 100), 0) / 100;
  const recebidoHoje = transacoes.filter(t => t.tipo === "entrada" && t.categoria === "pagamento_parcela" && t.data_transacao === hoje)
    .reduce((s: number, t: any) => s + Math.round(numeroDashboard(t.valor, "recebimento") * 100), 0) / 100;
  return { saldoTotal, capitalCirculacao, recebidoHoje, contratosAtivos: contratosData.length };
}
