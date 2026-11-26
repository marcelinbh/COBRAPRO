import { TRPCError } from '@trpc/server';
import { dataHojeBrasilia } from './businessDate';
import { listarRegistrosEmprestimos } from './emprestimosLeitura';
import { lerProjecaoVinculada51, type FonteLeitura51 } from './obrigacoes51Leitura';
import { projetarParcela51, projetarContrato51, type MetadadoParcela51 } from '../../shared/obrigacoes51Projection';
export type FiltroParcelas51 = { status?: string; clienteId?: number; contratoId?: number; dataInicio?: string; dataFim?: string; modalidade?: string; arquivo?: 'operacional' | 'historico' | 'todos' };
const fail = (): never => { throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Não foi possível confirmar os vínculos/estado51 das parcelas.' }); };
/** Leitura real, sem importar db/env/router. A prova de vínculo precede RPC51.
 * Não há filtragem financeira REST antes de conferir o conjunto COMPLETO. */
export async function listarParcelasEfetivas51(db: FonteLeitura51 | null, uid: number, filtro: FiltroParcelas51 = {}, hoje = dataHojeBrasilia()) {
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Fonte de parcelas indisponível.' });
  const read = (q: () => any) => listarRegistrosEmprestimos(q, uid);
  const collectors = await read(() => db.from('koletores').select('id, user_id, perfil, ativo', { count: 'exact' }).eq('user_id', uid).eq('ativo', true).order('id'));
  if (collectors.length > 1 || collectors.some(c => c.ativo !== true || !['koletor', 'admin', 'gerente'].includes(c.perfil))) return fail();
  const collectorId = collectors[0]?.perfil === 'koletor' ? collectors[0].id : null;
  const contracts = await read(() => {
    let q = db.from('contratos').select('id, user_id, cliente_id, koletor_id, modalidade, status, numero_parcelas, taxa_juros, tipo_taxa, valor_principal', { count: 'exact' }).eq('user_id', uid).order('id');
    if (collectorId !== null) q = q.eq('koletor_id', collectorId);
    return q;
  });
  if (contracts.some(c => !Number.isInteger(c.cliente_id) || c.cliente_id <= 0 || (collectorId !== null && c.koletor_id !== collectorId))) return fail();
  const ids = contracts.map(c => c.id);
  if (!ids.length) return [];
  const customerIds = [...new Set(contracts.map(c => c.cliente_id))];
  const customers = await read(() => db.from('clientes').select('id, user_id, nome, whatsapp, chave_pix', { count: 'exact' }).eq('user_id', uid).in('id', customerIds).order('id'));
  const byCustomer = new Map(customers.map(c => [c.id, c]));
  if (customerIds.some(id => !byCustomer.has(id)) || customers.some(c => !customerIds.includes(c.id))) return fail();
  const byContract = new Map(contracts.map(c => [c.id, c]));
  const metadataQuery = (cids: number[]) => db.from('parcelas').select('id, user_id, contrato_id, cliente_id', { count: 'exact' }).in('contrato_id', cids).order('id');
  const metadata = await read(() => metadataQuery(ids));
  if (metadata.some(p => !byContract.has(p.contrato_id) || p.cliente_id !== byContract.get(p.contrato_id).cliente_id)) return fail();
  const rows = await read(() => db.from('parcelas').select('id, user_id, contrato_id, cliente_id, numero_parcela, valor_original, valor_pago, valor_juros, valor_multa, saldo_residual, data_vencimento, data_pagamento, status', { count: 'exact' }).eq('user_id', uid).in('contrato_id', ids).order('data_vencimento').order('id'));
  const metaById = new Map(metadata.map(p => [p.id, p]));
  if (rows.length !== metadata.length || rows.some(p => {
    const m = metaById.get(p.id);
    return !m || p.contrato_id !== m.contrato_id || p.cliente_id !== m.cliente_id;
  })) return fail();
  const result = [];
  for (const c of contracts) {
    const meta: MetadadoParcela51[] = metadata.filter(p => p.contrato_id === c.id).map(p => ({ id: p.id, user_id: p.user_id, contrato_id: p.contrato_id, cliente_id: p.cliente_id }));
    const proof = await lerProjecaoVinculada51(db, uid, c.id, meta, async () => {
      const review = await read(() => metadataQuery([c.id]));
      if (review.some(p => p.contrato_id !== c.id || p.cliente_id !== c.cliente_id)) return fail();
      return review;
    });
    const customer = byCustomer.get(c.cliente_id)!, contract = projetarContrato51(c.status, proof);
    const ps = rows.filter(p => p.contrato_id === c.id);
    for (const raw of ps) {
      const p = projetarParcela51(raw, proof, hoje);
      result.push({ id: p.id, contratoId: c.id, clienteId: c.cliente_id,
        clienteNome: customer.nome, clienteWhatsapp: customer.whatsapp ?? null, clienteChavePix: customer.chave_pix ?? null,
        numeroParcela: p.numero_parcela, valorOriginal: p.valor_original, valorPago: p.valor_pago,
        valorJuros: p.valor_juros, valorMulta: p.valor_multa, saldoResidual: p.saldo_residual,
        dataVencimento: p.data_vencimento, dataPagamento: p.data_pagamento,
        status: p.status, statusFinanceiroOriginal: p.statusFinanceiroOriginal, statusObrigacao: p.statusObrigacao,
        obrigacaoAtual: p.obrigacaoAtual, componenteAdicional: p.componenteAdicional, arquivada: p.arquivada,
        contratoStatus: contract.status, contratoStatusFinanceiroOriginal: c.status, contratoArquivado: proof.arquivado,
        modalidade: c.modalidade, numeroParcelas: ps.length, totalParcelas: ps.length, taxaJuros: c.taxa_juros,
        tipoTaxa: c.tipo_taxa, valorPrincipal: c.valor_principal });
    }
  }
  const archive = filtro.arquivo ?? 'operacional';
  return result.filter(p => (archive === 'todos' || (archive === 'historico' ? p.arquivada : !p.arquivada)) &&
    (!filtro.status || p.status === filtro.status) && (!filtro.clienteId || p.clienteId === filtro.clienteId) &&
    (!filtro.contratoId || p.contratoId === filtro.contratoId) && (!filtro.modalidade || p.modalidade === filtro.modalidade) &&
    (!filtro.dataInicio || p.dataVencimento >= filtro.dataInicio) && (!filtro.dataFim || p.dataVencimento <= filtro.dataFim))
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento) || a.id - b.id);
}
