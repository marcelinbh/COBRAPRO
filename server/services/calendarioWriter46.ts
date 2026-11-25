import { TRPCError } from '@trpc/server';
import { createHash } from 'node:crypto';
import { parse } from 'cookie';
import { COOKIE_NAME } from '../../shared/const';
import { z } from 'zod';
import { calendario44Schema, cotarCalendarioSchema, quoteSchema44, validarClosure44, type Calendario44 } from '../../shared/manutencaoEmprestimos';
export const session46 = z.string().regex(/^[a-f0-9]{64}$/);
export const scopedQuote46 = cotarCalendarioSchema.extend({ sessionScope: session46 }).strict();
export const scopedIntent46 = z.object({ sessionScope: session46, intent: calendario44Schema }).strict();
export const facades46 = { cotar: 'rpc_cotar_calendario46', executar: 'rpc_executar_calendario46', conferir: 'rpc_conferir_calendario46' } as const;
export type Client46 = { rpc(name: typeof facades46[keyof typeof facades46], args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> };
export function exigir46() {
  if (process.env.ENABLE_CALENDARIO_0046 !== 'true') throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Calendário46 não instalado/certificado. Sem fallback financeiro.' });
}
/** Cookie already authenticated by protectedProcedure. Neither cookie nor token leaves the server. */
export function sessionScope46(uid: number, header: string | undefined) {
  const token = parse(header ?? '')[COOKIE_NAME];
  if (!Number.isInteger(uid) || uid <= 0 || !token) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão de calendário indisponível.' });
  return createHash('sha256').update(`journal46:${uid}:${token}`).digest('hex');
}
export function conferirSessao46(actual: string, expected: string) {
  if (actual !== expected) throw new TRPCError({ code: 'CONFLICT', message: 'Sessão mudou. Preserve o journal anterior; nenhum envio autorizado.' });
}
async function call46(client: Client46, kind: keyof typeof facades46, args: Record<string, unknown>) {
  exigir46();
  let r;
  try { r = await client.rpc(facades46[kind], args); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Sem confirmação. Preserve a mesma UUID e confira; não presuma rollback.' }); }
  if (r.error) {
    const c = r.error.code;
    throw new TRPCError({ code: c === '42501' ? 'NOT_FOUND' : ['22023', '22007', '22008', '22P02'].includes(c ?? '') ? 'BAD_REQUEST' : ['23505', '23514', '40001', '40P01'].includes(c ?? '') ? 'CONFLICT' : ['55000', '42883', 'PGRST202', 'PGRST106'].includes(c ?? '') ? 'PRECONDITION_FAILED' : 'INTERNAL_SERVER_ERROR', message: 'Calendário46 não confirmado. Preserve pedido/UUID; não tentar outro writer.' });
  }
  return r.data;
}
function owner(uid: number) { if (!Number.isInteger(uid) || uid <= 0 || uid > 2147483647) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Owner do servidor inválido.' }); }
export async function cotar46(client: Client46, uid: number, input: unknown) {
  owner(uid); const v = cotarCalendarioSchema.parse(input);
  const r = quoteSchema44.parse(await call46(client, 'cotar', { p_user_id: uid, p_contrato_id: v.contratoId }));
  if (r.contratoId !== v.contratoId || r.parcelasIds.length !== r.vencimentos.length || new Set(r.parcelasIds).size !== r.parcelasIds.length) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Cotação46 divergente.' });
  return r;
}
export async function executar46(client: Client46, uid: number, input: Calendario44, recover = false) {
  owner(uid); const v = calendario44Schema.parse(input);
  const data = await call46(client, recover ? 'conferir' : 'executar', { p_user_id: uid, p_chave_idempotencia: v.idempotencyKey, p_contrato_id: v.contratoId, p_estado_hash: v.estadoHash, p_vencimentos: v.vencimentos, p_motivo: v.motivo });
  try { return validarClosure44(recover ? data : { status: 'confirmed', sameIntentOnly: true, resultado: data }, v); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Confirmação/fence46 divergente. Preserve pedido/UUID, sem encerramento local.' }); }
}
