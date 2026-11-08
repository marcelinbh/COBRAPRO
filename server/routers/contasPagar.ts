import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { dataHojeBrasilia } from "../services/businessDate";
import { criarDespesaAtomica, pagarDespesaAtomica, estornarDespesaAtomica } from "../services/despesasRpc";
import { criarDespesaInput, pagarDespesaInput, estornarDespesaInput, dinheiroDespesa, dataCivilDespesa } from "../../shared/despesasIntent";

const expenseColumns = 'id, descricao, categoria, valor::text, data_vencimento, data_pagamento, status, recorrente, frequencia, conta_caixa_id, observacoes, user_id, createdAt, updatedAt';
const ledgerColumns = 'id::text, conta_caixa_id, tipo, categoria, descricao, valor::text, data_transacao, contrato_id, parcela_id, createdAt, user_id';
type Row = Record<string, any>;
type Fonte = NonNullable<Awaited<ReturnType<typeof getSupabaseClientAsync>>>;
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const idString = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v : typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : '';
  return /^[1-9]\d*$/.test(s) && BigInt(s) <= BigInt('9223372036854775807') ? s : null;
};
const statusNormal = (s: string) => ({ pago: 'paga', atrasado: 'atrasada', cancelado: 'cancelada' }[s] ?? s);
function statusExibicao(d: Row, hoje = dataHojeBrasilia()): string {
  return d.status === 'pendente' && typeof d.data_vencimento === 'string' && dataCivilDespesa(d.data_vencimento) && d.data_vencimento < hoje ? 'atrasada' : statusNormal(d.status);
}
function disabled(): never {
  throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Despesas prospectivas atômicas estão desabilitadas. Legado requer conferência; nenhum fallback será executado.' });
}
async function fonte(escrita = false): Promise<Fonte> {
  // Antes de obter cliente/DB: flag desligada não executa sequer o trilho antigo.
  if (escrita && process.env.ENABLE_RPC_DESPESAS_PROSPECTIVAS !== 'true') disabled();
  const cliente = await getSupabaseClientAsync();
  if (!cliente) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Fonte de despesas indisponível; não confundir com lista vazia.' });
  return cliente;
}
class TrilhaIndisponivel extends Error {}
async function ler(f: Fonte, tabela: string, colunas: string, userId: number, chave = 'id', ids?: (number | string)[]): Promise<Row[]> {
  if (ids && !ids.length) return [];
  const rows: Row[] = [];
  const grupos = ids ? Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) => ids.slice(i * 200, (i + 1) * 200)) : [undefined];
  for (const grupo of grupos) {
    let acabou = false;
    for (let pagina = 0; pagina < 100; pagina++) {
      let q = f.from(tabela).select(colunas).eq('user_id', userId).order(chave, { ascending: true }).range(pagina * 1000, (pagina + 1) * 1000 - 1);
      if (grupo) q = q.in(chave, grupo);
      const { data, error } = await q;
      if (error) {
        if (tabela.startsWith('despesas_rpc_') && ['42P01', 'PGRST205', '42501'].includes(error.code)) throw new TrilhaIndisponivel();
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível consultar despesas/proveniência. Requer conferência; nenhuma ação financeira foi executada.' });
      }
      if (!Array.isArray(data) || (data as unknown as Row[]).some(r => r.user_id !== userId)) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Consulta de despesas incompleta ou owner divergente.' });
      rows.push(...data as unknown as Row[]);
      if (data.length < 1000) { acabou = true; break; }
    }
    if (!acabou) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Consulta excedeu o limite seguro; não exibir totais parciais.' });
  }
  return rows;
}
// Serialização textual jsonb do PostgreSQL: chaves por tamanho UTF-8, depois bytes.
// Usada somente para verificar hashes persistidos, nunca para produzir auditoria nova.
function jsonbText(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(jsonbText).join(', ')}]`;
  const keys = Object.keys(v).sort((a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return `{${keys.map(k => `${JSON.stringify(k)}: ${k === 'id' && idString(v[k]) ? JSON.stringify(idString(v[k])) : jsonbText(v[k])}`).join(', ')}}`;
}
function igual(a: unknown, b: unknown): boolean {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  return jsonbText(a) === jsonbText(b);
}
/** JSONB::text mantém escala monetária; tokenizer não modifica textos/descrições. */
function snapshotExato(text: string): Row {
  const preservado = text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token, offset: number) => {
    if (token.startsWith('"')) return token;
    const prefix = text.slice(0, offset);
    return /"valor"\s*:\s*$/.test(prefix) || (/"(?:id|saida_id|estorno_id)"\s*:\s*$/.test(prefix) && !Number.isSafeInteger(Number(token))) ? JSON.stringify(token) : token;
  });
  return JSON.parse(preservado);
}
function decodificar(rows: Row[], campos: string[]): Row[] {
  return rows.map(row => {
    const r = { ...row };
    for (const campo of campos) {
      if (r[campo] === null) continue;
      if (typeof r[campo] !== 'string') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Trilha sem JSONB textual exato; requer conferência.' });
      r[`${campo}Texto`] = r[campo];
      r[campo] = snapshotExato(r[campo]);
    }
    return r;
  });
}
function operacaoValida(op: Row | undefined, userId: number, tipo: string, despesaId: number): op is Row {
  if (!op || op.user_id !== userId || op.tipo !== tipo || !uuid(op.id) || !uuid(op.chave_idempotencia) || !op.payload || !op.auditoria) return false;
  if (typeof op.payloadTexto !== 'string') return false;
  const digest = createHash('sha256').update(`{"tipo": ${JSON.stringify(tipo)}, "userId": ${userId}, "payload": ${op.payloadTexto}}`).digest('hex');
  const r = op.resultado;
  return op.hash_payload === `\\x${digest}` && r?.success === true && r.acao === tipo && r.userId === userId &&
    r.despesaId === despesaId && r.operationId === op.id && r.chaveIdempotencia === op.chave_idempotencia;
}

export type DespesaListada = {
  id: number; descricao: string; categoria: string; valor: string; status: string;
  dataVencimento: string; dataPagamento: string | null; contaCaixaId: number | null;
  recorrente: boolean; periodicidade: string | null; observacoes: string | null;
  proveniencia0020: boolean; podePagar: boolean; podeEstornar: boolean;
  pagamentoOperationId: string | null; transacaoSaidaId: string | null;
  requerConferencia: boolean; mensagemConferencia: string | null;
};
/** UI é conservadora. A RPC revalida snapshots, conta e TODO ledger sob locks no commit. */
export function marcarElegibilidade(d: Row, origem: Row | undefined, pg: Row | undefined, ops: Row[], saida: Row | undefined, userId: number, trilhaDisponivel = true): DespesaListada {
  const opCriar = ops.find(o => o.id === origem?.operacao_id && o.user_id === userId);
  let proveniencia = !!origem && d.user_id === userId && origem.user_id === userId && origem.despesa_id === d.id &&
    operacaoValida(opCriar, userId, 'criar', d.id) && origem.snapshot?.id === d.id && origem.snapshot?.user_id === userId &&
    origem.snapshot?.status === 'pendente' && origem.snapshot?.recorrente === false && origem.snapshot?.frequencia === null &&
    origem.snapshot?.data_pagamento === null && origem.snapshot?.conta_caixa_id === null && igual(opCriar.auditoria.depois, origem.snapshot) &&
    opCriar.auditoria.origemOperationId === origem.operacao_id && opCriar.resultado.status === 'pendente' &&
    dinheiroDespesa(String(origem.snapshot.valor)) === opCriar.resultado.valor && opCriar.resultado.dataVencimento === origem.snapshot.data_vencimento &&
    opCriar.payload.descricao === origem.snapshot.descricao && opCriar.payload.categoria === origem.snapshot.categoria &&
    dinheiroDespesa(String(opCriar.payload.valor)) === dinheiroDespesa(String(origem.snapshot.valor)) &&
    opCriar.payload.dataVencimento === origem.snapshot.data_vencimento && opCriar.payload.observacoes === origem.snapshot.observacoes;
  proveniencia = !!proveniencia && trilhaDisponivel;
  const podePagar = proveniencia && !pg && d.status === 'pendente' && igual(d, origem?.snapshot);
  const opPagar = ops.find(o => o.id === pg?.operacao_id && o.user_id === userId);
  const txId = idString(pg?.saida_id);
  const valor = dinheiroDespesa(String(d.valor));
  const podeEstornar = !!(proveniencia && pg && pg.user_id === userId && pg.despesa_id === d.id &&
    pg.operacao_estorno_id === null && pg.estorno_id === null && pg.estorno_snapshot === null && d.status === 'pago' &&
    igual(d, pg.despesa_snapshot) && dinheiroDespesa(String(pg.valor)) === valor && dinheiroDespesa(String(origem?.snapshot.valor)) === valor &&
    pg.conta_caixa_id === d.conta_caixa_id && pg.data_pagamento === d.data_pagamento && uuid(pg.operacao_id) &&
    operacaoValida(opPagar, userId, 'pagar', d.id) && opPagar.resultado.status === 'pago' &&
    opPagar.resultado.pagamentoOperationId === pg.operacao_id && opPagar.resultado.transacaoSaidaId === txId &&
    opPagar.resultado.valor === valor && opPagar.resultado.contaCaixaId === pg.conta_caixa_id && opPagar.resultado.dataPagamento === pg.data_pagamento &&
    opPagar.payload.despesaId === d.id && opPagar.payload.contaCaixaId === pg.conta_caixa_id && opPagar.payload.data === pg.data_pagamento &&
    opPagar.auditoria.origemOperationId === origem?.operacao_id && igual(opPagar.auditoria.antes, origem?.snapshot) &&
    igual(opPagar.auditoria.depois, pg.despesa_snapshot) && igual(opPagar.auditoria.saida, pg.saida_snapshot) &&
    saida && saida.user_id === userId && idString(saida.id) === txId && igual(saida, pg.saida_snapshot) &&
    saida.tipo === 'saida' && saida.categoria === 'despesa_operacional' && saida.conta_caixa_id === pg.conta_caixa_id &&
    dinheiroDespesa(String(saida.valor)) === valor && saida.data_transacao === pg.data_pagamento && saida.contrato_id === null && saida.parcela_id === null);
  // Estado encerrado também é somente consulta. Não criar UUID de pagamento a partir de status/descrição.
  const requerConferencia = !podePagar && !podeEstornar;
  return {
    id: d.id, descricao: d.descricao, categoria: d.categoria ?? 'outros', valor: String(d.valor), status: statusExibicao(d),
    dataVencimento: d.data_vencimento, dataPagamento: d.data_pagamento, contaCaixaId: d.conta_caixa_id,
    recorrente: d.recorrente === true, periodicidade: d.frequencia, observacoes: d.observacoes,
    proveniencia0020: proveniencia, podePagar, podeEstornar,
    pagamentoOperationId: podeEstornar ? pg!.operacao_id : null, transacaoSaidaId: podeEstornar ? txId : null,
    requerConferencia, mensagemConferencia: requerConferencia ? (!trilhaDisponivel ? 'Trilha 0020 indisponível; requer conferência. Somente consulta.' : 'Requer conferência. Legado/estado encerrado ou proveniência incompatível; somente consulta.') : null,
  };
}
async function listadas(f: Fonte, userId: number): Promise<DespesaListada[]> {
  const despesas = await ler(f, 'contas_pagar', expenseColumns, userId);
  if (!despesas.length) return [];
  try {
    const ids = despesas.map(d => d.id);
    const [origensRaw, pagamentosRaw] = await Promise.all([
      ler(f, 'despesas_rpc_origens', 'despesa_id, user_id, operacao_id, snapshot::text', userId, 'despesa_id', ids),
      ler(f, 'despesas_rpc_pagamentos', 'despesa_id, user_id, operacao_id, conta_caixa_id, valor::text, data_pagamento, saida_id::text, saida_snapshot::text, despesa_snapshot::text, operacao_estorno_id, estorno_id::text, estorno_snapshot::text', userId, 'despesa_id', ids),
    ]);
    const origens = decodificar(origensRaw, ['snapshot']);
    const pagamentos = decodificar(pagamentosRaw, ['saida_snapshot', 'despesa_snapshot', 'estorno_snapshot']);
    const opIds = Array.from(new Set([...origens.map(o => o.operacao_id), ...pagamentos.map(p => p.operacao_id)]));
    const [opsRaw, saidas] = await Promise.all([
      ler(f, 'despesas_rpc_operacoes', 'id, user_id, chave_idempotencia, tipo, payload::text, hash_payload, resultado, auditoria::text', userId, 'id', opIds),
      ler(f, 'transacoes_caixa', ledgerColumns, userId, 'id', pagamentos.map(p => p.saida_id)),
    ]);
    const ops = decodificar(opsRaw, ['payload', 'auditoria']);
    return despesas.map(d => marcarElegibilidade(d, origens.find(o => o.despesa_id === d.id), pagamentos.find(p => p.despesa_id === d.id), ops, saidas.find(s => idString(s.id) === idString(pagamentos.find(p => p.despesa_id === d.id)?.saida_id)), userId));
  } catch (error) {
    if (!(error instanceof TrilhaIndisponivel)) throw error;
    return despesas.map(d => marcarElegibilidade(d, undefined, undefined, [], undefined, userId, false));
  }
}
function naoSuportado(): never {
  throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Edição, cancelamento, exclusão, recorrência e sincronização de despesas não são suportados. Legado requer conferência; nenhum fallback será executado.' });
}
const rejeitar = protectedProcedure.input(z.unknown()).mutation(naoSuportado);
export const contasPagarRouter = router({
  listar: protectedProcedure.input(z.object({ status: z.enum(['pendente', 'paga', 'pago', 'atrasada', 'atrasado', 'cancelada', 'cancelado', 'todos']).optional(), categoria: z.string().optional() }).strict().optional())
    .query(async ({ ctx, input }) => (await listadas(await fonte(), ctx.user.id)).filter(d => (!input?.status || input.status === 'todos' || d.status === statusNormal(input.status)) && (!input?.categoria || d.categoria === input.categoria)).sort((a, b) => b.dataVencimento.localeCompare(a.dataVencimento) || b.id - a.id)),
  resumo: protectedProcedure.query(async ({ ctx }) => {
    const despesas = await ler(await fonte(), 'contas_pagar', 'id, user_id, status, valor::text, data_pagamento, data_vencimento', ctx.user.id);
    const hoje = dataHojeBrasilia();
    const mes = hoje.slice(0, 7);
    if (despesas.some(d => statusNormal(d.status) === 'paga' && (typeof d.data_pagamento !== 'string' || !dataCivilDespesa(d.data_pagamento)))) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Data histórica de pagamento inválida; resumo do mês requer conferência, não será subcontado como zero.' });
    }
    const resumir = (pred: (d: Row) => boolean) => {
      const rows = despesas.filter(pred);
      let cents = BigInt(0);
      for (const row of rows) {
        const dinheiro = dinheiroDespesa(String(row.valor));
        if (!dinheiro) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Valor histórico inválido; resumo requer conferência, não será substituído por zero.' });
        cents += BigInt(dinheiro.replace('.', ''));
      }
      return { total: `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`, qtd: rows.length };
    };
    const pendente = resumir(d => statusExibicao(d, hoje) === 'pendente');
    const atrasado = resumir(d => statusExibicao(d, hoje) === 'atrasada');
    const pago = resumir(d => statusNormal(d.status) === 'paga' && typeof d.data_pagamento === 'string' && d.data_pagamento.slice(0, 7) === mes);
    return { totalPendente: pendente.total, qtdPendente: pendente.qtd, totalAtrasado: atrasado.total, qtdAtrasado: atrasado.qtd, totalPago: pago.total, qtdPago: pago.qtd };
  }),
  capacidades: protectedProcedure.query(() => ({ prospectivasHabilitadas: process.env.ENABLE_RPC_DESPESAS_PROSPECTIVAS === 'true', recorrencia: false as const })),
  criar: protectedProcedure.input(criarDespesaInput).mutation(async ({ ctx, input }) => criarDespesaAtomica(await fonte(true), { userId: ctx.user.id, idempotencyKey: input.idempotencyKey, descricao: input.descricao, categoria: input.categoria, valor: input.valor, dataVencimento: input.dataVencimento, observacoes: input.observacoes })),
  pagar: protectedProcedure.input(pagarDespesaInput).mutation(async ({ ctx, input }) => pagarDespesaAtomica(await fonte(true), { userId: ctx.user.id, idempotencyKey: input.idempotencyKey, despesaId: input.id, contaCaixaId: input.contaCaixaId, dataPagamento: input.dataPagamento })),
  estornar: protectedProcedure.input(estornarDespesaInput).mutation(async ({ ctx, input }) => estornarDespesaAtomica(await fonte(true), { userId: ctx.user.id, idempotencyKey: input.idempotencyKey, despesaId: input.id, pagamentoOperationId: input.pagamentoOperationId, dataEstorno: input.dataEstorno, motivo: input.motivo })),
  editar: rejeitar, update: rejeitar, cancelar: rejeitar, excluir: rejeitar, recorrencia: rejeitar, sincronizarCaixa: rejeitar,
});
export type ContasPagarRouter = typeof contasPagarRouter;
