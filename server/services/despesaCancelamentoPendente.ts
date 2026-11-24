import { TRPCError } from '@trpc/server';
import { capacidadesCancelamentoPendente, cancelamentoPendenteInput, validarCancelamentoPendente, validarRecoveryCancelamento, type CancelamentoPendenteInput } from '../../shared/despesaCancelamentoPendente';
export type FonteCancelamentoPendente = { rpc(name: string, input?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> };
/** Banco é a única autoridade da flag; nenhuma cópia ambiental/cache de módulo. */
export async function capacidadesCancelamento(fonte: FonteCancelamentoPendente) {
  const response = await fonte.rpc('rpc_capacidades_cancelamento_despesa38c', {});
  if (response.error) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Disponibilidade38c não comprovada.' });
  const parsed = capacidadesCancelamentoPendente.safeParse(response.data);
  if (!parsed.success) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Capacidade38c divergente.' });
  return parsed.data;
}
/** userId é argumento interno derivado de ctx.user.id, nunca input público. */
export async function executarCancelamentoPendente(fonte: FonteCancelamentoPendente, userId: number, raw: CancelamentoPendenteInput, recuperar = false) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const parsed = cancelamentoPendenteInput.safeParse(raw);
  if (!parsed.success) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Intenção de cancelamento inválida.' });
  const input = parsed.data;
  let response;
  try {
    response = await fonte.rpc(recuperar ? 'rpc_recuperar_cancelamento_despesa38c' : 'rpc_cancelar_despesa_pendente38c', {
      p_user_id: userId, p_chave: input.idempotencyKey, p_despesa_id: input.despesaId,
      p_origem_operation_id: input.origemOperationId, p_motivo: input.motivo,
    });
  } catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Resultado desconhecido; preserve e reconfira a MESMA UUID e payload.' }); }
  if (response.error) {
    const sql = response.error.code;
    const code = sql === '42501' ? 'NOT_FOUND' : ['22023', '22P02'].includes(sql ?? '') ? 'BAD_REQUEST' : ['23505', '23514', '40001', '40P01'].includes(sql ?? '') ? 'CONFLICT' : ['55000', 'PGRST106', 'PGRST202', '42883', '3F000'].includes(sql ?? '') ? 'PRECONDITION_FAILED' : 'INTERNAL_SERVER_ERROR';
    throw new TRPCError({ code, message: 'Cancelamento não confirmado; owner/estado requer conferência. Preserve a MESMA UUID, sem fallback.' });
  }
  try { return recuperar ? validarRecoveryCancelamento(response.data, userId, input) : validarCancelamentoPendente(response.data, userId, input); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Prova incompleta ou divergente: preserve a MESMA UUID original.' }); }
}
