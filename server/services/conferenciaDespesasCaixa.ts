import { TRPCError } from '@trpc/server';
import { calcularSaldoAtualDecimal } from '../../shared/caixa';
import { dataCivilDespesa } from '../../shared/despesasIntent';
import { listarFinancialReporting, validarIntegridadeLedgerFinancialReporting } from '../financialReporting';

type Row = Record<string, any>;
function falha(): never { throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Conferência indisponível: leitura ou vínculo inconsistente. Nenhuma correção foi executada.' }); }
function decimal(v: unknown, negativo = false): string {
  // ::text é exigido: numeric não atravessa Number/JSON como fonte monetária.
  if (typeof v !== 'string' || !(negativo ? /^-?\d+(?:\.\d{1,2})?$/ : /^\d+(?:\.\d{1,2})?$/).test(v)) falha();
  return calcularSaldoAtualDecimal(v, []);
}
const positivo = (v: unknown) => { const d = decimal(v); if (d === '0.00') falha(); return d; };
const id = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0 && Number(v) <= 2147483647;
const pago = (s: string) => ['pago', 'paga'].includes(s);
const encerrado = (s: string) => ['cancelado', 'cancelada'].includes(s);

async function lerPagamentos(fonte: any, userId: number): Promise<Row[]> {
  const rows: Row[] = [];
  const ids = new Set<number>();
  let esperado: number | undefined;
  for (let pagina = 0; pagina < 200; pagina++) {
    const r = await fonte.from('despesas_rpc_pagamentos')
      .select('despesa_id, user_id, operacao_id, conta_caixa_id, valor::text, data_pagamento, saida_id, operacao_estorno_id, estorno_id', { count: 'exact' })
      .eq('user_id', userId).order('despesa_id', { ascending: true }).range(pagina * 500, pagina * 500 + 499);
    if (r.error || !Array.isArray(r.data) || !Number.isSafeInteger(r.count) || r.count < 0 || r.data.length > 500) falha();
    if (esperado == null) esperado = r.count;
    if (esperado !== r.count) falha();
    for (const row of r.data) {
      if (!id(row?.despesa_id) || row.user_id !== userId || ids.has(row.despesa_id)) falha();
      ids.add(row.despesa_id); rows.push(row);
    }
    if (rows.length > r.count) falha();
    if (r.data.length < 500) { if (rows.length !== r.count) falha(); return rows; }
  }
  falha();
}

async function snapshot(fonte: any, userId: number) {
  const contas = await listarFinancialReporting(fonte, 'contas_caixa', 'id, user_id, nome, ativo, saldo::text', userId);
  if (contas.some(c => !id(c.id) || typeof c.nome !== 'string' || typeof c.ativo !== 'boolean')) falha();
  contas.forEach(c => decimal(c.saldo, true));
  const contaIds = contas.map(c => c.id);
  // Metadados apenas, inclusive contas inativas; nunca devolver dinheiro alheio.
  await validarIntegridadeLedgerFinancialReporting(fonte, userId, contaIds);
  const transacoes = await listarFinancialReporting(fonte, 'transacoes_caixa', 'id, user_id, conta_caixa_id, tipo, categoria, descricao, valor::text, data_transacao, contrato_id, parcela_id', userId);
  const despesas = await listarFinancialReporting(fonte, 'contas_pagar', 'id, user_id, descricao, valor::text, status, conta_caixa_id, data_pagamento', userId);
  // A chave física é despesa_id, não id; paginação própria sem aliases inferidos.
  const pagamentos = await lerPagamentos(fonte, userId);
  const proprias = new Set(contaIds);
  for (const t of transacoes) {
    if (!id(t.id) || !proprias.has(t.conta_caixa_id) || !['entrada', 'saida'].includes(t.tipo) || typeof t.categoria !== 'string' || typeof t.data_transacao !== 'string' || !dataCivilDespesa(t.data_transacao)) falha();
    positivo(t.valor);
  }
  for (const d of despesas) {
    if (!id(d.id) || !['pendente', 'atrasada', 'atrasado', 'pago', 'paga', 'cancelado', 'cancelada'].includes(d.status) || typeof d.descricao !== 'string') falha();
    positivo(d.valor);
    if (d.conta_caixa_id != null && !proprias.has(d.conta_caixa_id)) falha();
    if (d.data_pagamento != null && (typeof d.data_pagamento !== 'string' || !dataCivilDespesa(d.data_pagamento))) falha();
  }
  const despesaIds = new Set(despesas.map(d => d.id));
  for (const p of pagamentos) {
    if (!despesaIds.has(p.despesa_id) || !proprias.has(p.conta_caixa_id) || !id(p.saida_id) || (p.estorno_id != null && !id(p.estorno_id))) falha();
    positivo(p.valor);
  }
  await validarIntegridadeLedgerFinancialReporting(fonte, userId, contaIds);
  return { contas, transacoes, despesas, pagamentos };
}

export type DivergenciaDespesaCaixa = {
  contaCaixaId: number | null; despesaId: number | null; tipo: string;
  esperado: string | null; encontrado: string | null; mensagem: string;
};

/** Conferência operacional, NÃO autorização de writer ou prova bancária.
 * O vínculo despesa -> saída/estorno é pelo ID persistido, nunca por descrição.
 * Divergências são indicadas, não saneadas. Não calcula valor de um ajuste. */
export function analisarDespesasCaixa(dados: Awaited<ReturnType<typeof snapshot>>, contaCaixaId?: number) {
  const { contas, transacoes, despesas, pagamentos } = dados;
  if (contaCaixaId != null && !contas.some(c => c.id === contaCaixaId)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conta não disponível nesta empresa.' });
  const divergencias: DivergenciaDespesaCaixa[] = [];
  const vinculadas = new Set<number>();
  const tx = new Map(transacoes.map(t => [t.id, t]));
  const pg = new Map(pagamentos.map(p => [p.despesa_id, p]));
  const add = (d: Row, tipo: string, mensagem: string, esperado: string | null = null, encontrado: string | null = null) => {
    divergencias.push({ contaCaixaId: d.conta_caixa_id ?? null, despesaId: d.id, tipo, esperado, encontrado, mensagem });
  };
  for (const d of despesas) {
    const p = pg.get(d.id);
    const baixada = pago(d.status) || (encerrado(d.status) && d.data_pagamento != null);
    if (!p) {
      if (!baixada) continue;
      // Nomes iguais, renomes e datas iguais não identificam uma obrigação.
      const candidatas = transacoes.filter(t => t.conta_caixa_id === d.conta_caixa_id && t.tipo === 'saida' && t.categoria === 'despesa_operacional' &&
        [ `Pagamento: ${d.descricao}`, `Pagamento da conta #${d.id}: ${d.descricao}` ].includes(t.descricao));
      add(d, 'legado_sem_vinculo', candidatas.length
        ? `Baixa sem vínculo técnico de origem: ${candidatas.length} saída(s) de descrição compatível, sem adoção ou prova de correspondência.`
        : 'Baixa sem vínculo técnico de origem; não é possível afirmar pagamento real nem criar saída faltante por status.', positivo(d.valor));
      if (!d.conta_caixa_id || !d.data_pagamento) add(d, 'baixa_incompleta', 'Baixa sem conta/data confirmadas; revisão documental necessária.');
      continue;
    }
    if (p.conta_caixa_id !== d.conta_caixa_id || positivo(p.valor) !== positivo(d.valor) || p.data_pagamento !== d.data_pagamento) {
      add(d, 'pagamento_divergente', 'Metadados da baixa diferem do vínculo persistido. Não corrigir por diferença de saldo.');
    }
    const conferirPerna = (txId: number, tipo: 'entrada' | 'saida', data: string | null) => {
      const t = tx.get(txId);
      if (!t) { add(d, 'movimento_ausente', `${tipo === 'saida' ? 'Saída' : 'Estorno'} referenciado não está no livro próprio; nenhuma nova perna será fabricada.`, positivo(p.valor), null); return; }
      // Mesmo owner está garantido pela leitura, mas não autoriza outro vínculo.
      if (vinculadas.has(t.id)) add(d, 'vinculo_reutilizado', 'Uma mesma perna foi referenciada mais de uma vez; revisão necessária.');
      vinculadas.add(t.id);
      if (t.conta_caixa_id !== p.conta_caixa_id || t.tipo !== tipo || t.categoria !== 'despesa_operacional' || t.contrato_id != null || t.parcela_id != null || positivo(t.valor) !== positivo(p.valor) || (data != null && t.data_transacao !== data)) {
        add(d, 'movimento_divergente', 'Perna vinculada difere de conta, direção, valor, data ou categoria da baixa.', positivo(p.valor), positivo(t.valor));
      }
    };
    conferirPerna(p.saida_id, 'saida', p.data_pagamento);
    const temEstorno = p.estorno_id != null && p.operacao_estorno_id != null;
    if ((p.estorno_id == null) !== (p.operacao_estorno_id == null)) add(d, 'estorno_incompleto', 'Vínculo de estorno incompleto; não considerar obrigação reconciliada.');
    if (temEstorno) conferirPerna(p.estorno_id, 'entrada', null);
    if ((temEstorno && !encerrado(d.status)) || (!temEstorno && !pago(d.status))) add(d, 'status_divergente', 'Status atual não corresponde à presença de baixa/estorno vinculado.');
  }
  for (const t of transacoes) {
    if (t.categoria === 'despesa_operacional' && !vinculadas.has(t.id)) {
      divergencias.push({ contaCaixaId: t.conta_caixa_id, despesaId: null, tipo: 'movimento_sem_vinculo', esperado: null, encontrado: positivo(t.valor), mensagem: `Movimento próprio #${t.id} sem vínculo técnico de despesa conferido. Legado não é duplicidade comprovada.` });
    }
  }
  const selecionadas = contas.filter(c => contaCaixaId == null || c.id === contaCaixaId);
  const contasResultado = selecionadas.map(c => {
    const movimentos = transacoes.filter(t => t.conta_caixa_id === c.id);
    const entradas = calcularSaldoAtualDecimal('0.00', movimentos.filter(t => t.tipo === 'entrada'));
    const saidas = calcularSaldoAtualDecimal('0.00', movimentos.filter(t => t.tipo === 'saida').map(t => ({ ...t, tipo: 'entrada' as const })));
    return { id: c.id, nome: c.nome, ativa: c.ativo, saldoBase: decimal(c.saldo, true), entradas, saidas,
      saldoLivro: calcularSaldoAtualDecimal(decimal(c.saldo, true), movimentos),
      divergencias: divergencias.filter(v => v.contaCaixaId === c.id).length };
  });
  return { contas: contasResultado, divergencias: divergencias.filter(v => contaCaixaId == null || v.contaCaixaId === contaCaixaId || v.contaCaixaId == null),
    despesasConferidas: despesas.length, movimentos: transacoes.length };
}

export async function conferirDespesasCaixa(fonte: any, userId: number, contaCaixaId?: number) {
  if (!id(userId)) falha();
  // Duas observações completas iguais detectam drift visível entre fontes.
  // Não se promete snapshot MVCC: REST separado não é transação única.
  const primeira = await snapshot(fonte, userId);
  const segunda = await snapshot(fonte, userId);
  if (JSON.stringify(primeira) !== JSON.stringify(segunda)) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Os registros mudaram durante a conferência. Atualize; nenhum ajuste foi executado.' });
  return { ...analisarDespesasCaixa(segunda, contaCaixaId), empresaId: userId, geradoEm: new Date().toISOString(), somenteLeitura: true as const,
    natureza: 'observacoes_rest_repetidas' as const, autorizaCorrecao: false as const,
    escopo: 'Saldo de todo o livro próprio; divergências apenas de despesas operacionais. Não certifica parcelas, contratos, snapshots de RPC nem saldo bancário.' };
}
