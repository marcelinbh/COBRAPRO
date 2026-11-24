import { TRPCError } from '@trpc/server';
import { pagamentoAssinatura42Schema, confirmarResultadoAssinatura42, confirmarConferenciaAssinatura42, type PagamentoAssinatura42 } from '../../shared/assinaturas42';
type ClienteRpc42 = { rpc(nome: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string | null } | null }> };
/** Owner vem exclusivamente de ctx.user.id; nenhuma escrita REST, retry ou fallback. */
async function chamar42(cliente: ClienteRpc42, userId: number, entrada: PagamentoAssinatura42, conferir: boolean): Promise<unknown> {
  if (!Number.isInteger(userId) || userId <= 0 || userId > 2147483647) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const input = pagamentoAssinatura42Schema.parse(entrada);
  let response: Awaited<ReturnType<ClienteRpc42['rpc']>>;
  try {
    response = await cliente.rpc(conferir ? 'rpc_conferir_assinatura42' : 'rpc_receber_assinatura42', {
      p_user_id: userId, p_chave: input.idempotencyKey, p_assinatura_id: input.assinaturaId,
      p_cliente_id: input.clienteId, p_conta_id: input.contaCaixaId,
      p_valor: input.valorPago, p_mes: input.mesReferencia, p_observacoes: input.observacoes,
    });
  } catch {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Sem confirmação. Preserve a mesma intenção e UUID; use Conferir/cancelar tentativa. Timeout não significa ausência de execução.' });
  }
  if (!response || typeof response !== 'object' || !Object.hasOwn(response, 'data') || !Object.hasOwn(response, 'error')) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Confirmação inválida; preserve a mesma intenção e UUID.' });
  }
  if (response.error !== null) {
    const code = response.error?.code;
    const message = 'Recebimento não confirmado. Preserve a mesma intenção e UUID; use Conferir/cancelar tentativa antes de outro pagamento.';
    if (response.data !== null) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
    if (['22023', '22007', '22P02', '22003'].includes(code ?? '')) throw new TRPCError({ code: 'BAD_REQUEST', message });
    if (code === '42501') throw new TRPCError({ code: 'NOT_FOUND', message: 'Assinatura, cliente ou conta indisponível para esta empresa. Preserve a intenção para conferência.' });
    if (['23505', '40001', '40P01', '55P03'].includes(code ?? '')) throw new TRPCError({ code: 'CONFLICT', message });
    if (['55000', '23514', 'PGRST202', '42883', '42P01'].includes(code ?? '')) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Integridade/RPC de assinaturas não disponível ou intenção fechada. Sem fallback; preserve UUID para conferência.' });
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
  }
  return response.data;
}
export async function receberAssinatura42(cliente: ClienteRpc42, userId: number, input: PagamentoAssinatura42) {
  const data = await chamar42(cliente, userId, input, false);
  try { return confirmarResultadoAssinatura42(data, input); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Prova de recebimento inválida; preserve a mesma intenção e UUID para conferir.' }); }
}
export async function conferirAssinatura42(cliente: ClienteRpc42, userId: number, input: PagamentoAssinatura42) {
  const data = await chamar42(cliente, userId, input, true);
  try { return confirmarConferenciaAssinatura42(data, input); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Prova de conferência inválida; intenção preservada. Nenhum novo pagamento autorizado.' }); }
}
