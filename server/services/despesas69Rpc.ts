import { TRPCError } from '@trpc/server';
import { getSupabaseClientAsync } from '../db';
import { capabilities69, validarQuote69, validarRecibo69, validarRecovery69, type Edicao69Input } from '../../shared/despesas69';
export type Fonte69 = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> };
async function source(): Promise<Fonte69> {
  const f = await getSupabaseClientAsync();
  if (!f) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Fonte69 indisponível; sem fallback.' });
  return f;
}
async function call69(name: string, args: Record<string, unknown>) {
  const f = await source();
  let r;
  try { r = await f.rpc(name, args); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Resultado desconhecido. Preserve UUID e pedido exato69; consulte recuperação.' }); }
  if (r.error) {
    const c = r.error.code;
    const code = c === '42501' ? 'NOT_FOUND' : ['22023', '22008', '22P02'].includes(c ?? '') ? 'BAD_REQUEST' : ['23505', '23514', '40001', '40P01'].includes(c ?? '') ? 'CONFLICT' : ['55000', 'PGRST202', '42883', '3F000'].includes(c ?? '') ? 'PRECONDITION_FAILED' : 'INTERNAL_SERVER_ERROR';
    throw new TRPCError({ code, message: '69 não confirmado. Preserve UUID e pedido originais; nenhuma operação alternativa foi executada.' });
  }
  return r.data;
}
export const despesas69Service = {
  async capacidades() { return capabilities69.parse(await call69('rpc_capacidades_despesas69', {})); },
  async cotar(owner: number, despesaId: number) { return validarQuote69(await call69('rpc_cotar_edicao_despesa69', { p_user_id: owner, p_despesa_id: despesaId }), owner, despesaId); },
  async editar(owner: number, input: Edicao69Input) { return validarRecibo69(await call69('rpc_editar_despesa69', { p_user_id: owner, p_chave: input.idempotencyKey, p_request: input.request }), owner, input); },
  async recuperar(owner: number, input: Edicao69Input) { return validarRecovery69(await call69('rpc_recuperar_edicao_despesa69', { p_user_id: owner, p_chave: input.idempotencyKey, p_request: input.request }), owner, input); },
};
