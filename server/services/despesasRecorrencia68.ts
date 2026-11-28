import { TRPCError } from '@trpc/server';
import { getSupabaseClientAsync } from '../db';
import { batch68, validarList68, validarProof68, type Input68 } from '../../shared/despesasRecorrencia68';
export type Fonte68 = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> };
export async function fonte68(): Promise<Fonte68> {
  const f = await getSupabaseClientAsync();
  if (!f) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Fonte68 indisponível; sem fallback.' });
  return f;
}
export async function call68(f: Fonte68, name: string, args: Record<string, unknown>): Promise<unknown> {
  let r;
  try { r = await f.rpc(name, args); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Resultado68 desconhecido. Preserve UUID e pedido exato.' }); }
  if (r.error) {
    const c = r.error.code ?? '';
    const code = c === '42501' ? 'FORBIDDEN' : ['22023', '22007', '22008', '22P02', '22003'].includes(c) ? 'BAD_REQUEST' : ['23505', '23514', '40001', '40P01'].includes(c) ? 'CONFLICT' : ['55000', 'PGRST202', '42883', '42P01', '3F000'].includes(c) ? 'PRECONDITION_FAILED' : 'INTERNAL_SERVER_ERROR';
    throw new TRPCError({ code, message: '68 não confirmado. Reconfira a MESMA UUID/pedido; nenhum fallback.' });
  }
  return r.data;
}
export async function consultar68(f: Fonte68, owner: number, after: string | null) {
  return validarList68(await call68(f, 'rpc_listar_despesas68', { p_user_id: owner, p_after: after }), owner);
}
export async function configurar68(f: Fonte68, owner: number, input: Input68, recover: boolean) {
  return validarProof68(await call68(f, recover ? 'rpc_recuperar_despesas68' : 'rpc_configurar_despesas68', { p_user_id: owner, p_chave: input.idempotencyKey, p_request: input.request }), owner, input);
}
export async function gerar68(f: Fonte68, taskUid: string, runId: string) {
  const r = batch68.parse(await call68(f, 'rpc_gerar_despesas68', { p_task_uid: taskUid, p_run_id: runId }));
  if (r.runId !== runId) throw Error('Run68 divergente.');
  return r;
}
