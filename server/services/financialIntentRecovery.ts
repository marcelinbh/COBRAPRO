import { TRPCError } from '@trpc/server';
import { assertRecoveryEvidence, type RecoveryRequest } from '../../shared/financialIntentRecovery';
import { entradaEmprestimoProspectivoSchema, normalizarResultadoEmprestimoProspectivo, type ClienteEmprestimosRpc } from './emprestimosRpc';
import { entradaRecebimentoProspectivoSchema, normalizarRecebimentoProspectivo } from './cicloEmprestimosRpc';
import { criarDespesaInput, pagarDespesaInput, estornarDespesaInput } from '../../shared/despesasIntent';
import { normalizarResultadoDespesa } from './despesasRpc';
/** Não chama mutação financeira nem consulta REST. RPC ausente/erro/timeout é desconhecido. */
export async function reconcileFinancialIntent(client: ClienteEmprestimosRpc, userId: number, input: RecoveryRequest) {
  let response: Awaited<ReturnType<ClienteEmprestimosRpc['rpc']>>;
  try { response = await client.rpc('rpc_reconciliar_intencao_financeira', { p_user_id: userId, p_family: input.family, p_chave: input.idempotencyKey, p_request: input.payload }); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Reconciliação sem resposta. UUID/payload preservados; não execução NÃO comprovada.' }); }
  if (response.error) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Reconciliação autoritativa indisponível ou divergente. Nenhum descarte permitido; preserve UUID/payload e repita a conferência.' });
  try {
    const evidence = assertRecoveryEvidence(response.data, userId, input);
    if (evidence.status === 'confirmed') {
      const body = { ...input.payload, idempotencyKey: input.idempotencyKey };
      if (input.family === 'emprestimo_criar') evidence.result = normalizarResultadoEmprestimoProspectivo(evidence.result, entradaEmprestimoProspectivoSchema.parse(body));
      else if (input.family === 'emprestimo_receber') evidence.result = normalizarRecebimentoProspectivo(evidence.result, entradaRecebimentoProspectivoSchema.parse(body));
      else if (input.family === 'despesa_criar') evidence.result = normalizarResultadoDespesa(evidence.result, 'criar', { ...criarDespesaInput.parse(body), userId });
      else if (input.family === 'despesa_pagar') { const i = pagarDespesaInput.parse(body); evidence.result = normalizarResultadoDespesa(evidence.result, 'pagar', { ...i, despesaId: i.id, userId }); }
      else { const i = estornarDespesaInput.parse(body); evidence.result = normalizarResultadoDespesa(evidence.result, 'estornar', { ...i, despesaId: i.id, userId }); }
    }
    return evidence;
  } catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Evidência/resultado incompatível com UUID e payload. Intenção preservada; não execução NÃO comprovada.' }); }
}
