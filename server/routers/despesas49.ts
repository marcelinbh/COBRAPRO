import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import { capabilities49, edicao49Input, validarQuote49, validarRecibo49, validarRecovery49 } from '../../shared/despesas49';
export type Fonte49 = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> };
async function source(): Promise<Fonte49> {
  const f = await getSupabaseClientAsync();
  if (!f) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Fonte49 indisponível; sem fallback.' });
  return f;
}
export async function call49(f: Fonte49, name: string, args: Record<string, unknown>) {
  let r;
  try { r = await f.rpc(name, args); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Resultado desconhecido. Preserve UUID e pedido exato49.' }); }
  if (r.error) {
    const c = r.error.code;
    const code = c === '42501' ? 'NOT_FOUND' : ['22023', '22008', '22P02'].includes(c ?? '') ? 'BAD_REQUEST' : ['23505', '23514', '40001', '40P01'].includes(c ?? '') ? 'CONFLICT' : ['55000', 'PGRST202', '42883', '3F000'].includes(c ?? '') ? 'PRECONDITION_FAILED' : 'INTERNAL_SERVER_ERROR';
    throw new TRPCError({ code, message: '49 não confirmado. Reconfira MESMA UUID e pedido; nunca execute fallback.' });
  }
  return r.data;
}
export const despesas49Router = router({
  capacidades: protectedProcedure.query(async () => capabilities49.parse(await call49(await source(), 'rpc_capacidades_despesas49', {}))),
  cotar: protectedProcedure.input(z.object({ despesaId: z.number().int().positive().max(2147483647) }).strict()).mutation(async ({ ctx, input }) => validarQuote49(await call49(await source(), 'rpc_cotar_edicao_despesa49', { p_user_id: ctx.user.id, p_despesa_id: input.despesaId }), ctx.user.id, input.despesaId)),
  editar: protectedProcedure.input(edicao49Input).mutation(async ({ ctx, input }) => validarRecibo49(await call49(await source(), 'rpc_editar_despesa49', { p_user_id: ctx.user.id, p_chave: input.idempotencyKey, p_request: input.request }), ctx.user.id, input)),
  recuperar: protectedProcedure.input(edicao49Input).mutation(async ({ ctx, input }) => validarRecovery49(await call49(await source(), 'rpc_recuperar_edicao_despesa49', { p_user_id: ctx.user.id, p_chave: input.idempotencyKey, p_request: input.request }), ctx.user.id, input)),
});
