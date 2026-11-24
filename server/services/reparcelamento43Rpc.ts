import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  reparcelamento43PreviewSchema, reparcelamento43ExecucaoSchema,
  conferirCotacao43, conferirResultado43,
  type Reparcelamento43Preview, type Reparcelamento43Execucao,
} from '../../shared/reparcelamento43';
export * from '../../shared/reparcelamento43';
export type ClienteReparcelamento43 = {
  rpc(nome: string, params: Record<string,unknown>): PromiseLike<{data: unknown;error: {code?: string|null}|null}>;
};
function owner(uid: number) {
  if (!Number.isInteger(uid) || uid <= 0 || uid > 2147483647) throw new TRPCError({code:'UNAUTHORIZED',message:'Sessão financeira inválida.'});
}
function seguro<T>(fn:()=>T, code: 'BAD_REQUEST'|'INTERNAL_SERVER_ERROR'): T {
  try { return fn(); } catch { throw new TRPCError({code,message:'Intenção/confirmação43 inválida. Preserve o mesmo UUID e payload; erro não prova rollback.'}); }
}
const envelope = z.object({data:z.unknown(),error:z.object({code:z.string().nullable().optional(),message:z.string().nullable().optional(),details:z.string().nullable().optional(),hint:z.string().nullable().optional()}).strict().nullable()});
async function chamar(c: ClienteReparcelamento43, nome: string, params: Record<string,unknown>) {
  let raw:unknown;
  try { raw = await c.rpc(nome,params); }
  catch { throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Resultado desconhecido. Preserve o mesmo UUID/payload e use reconciliação; timeout não prova rollback.'}); }
  const r = seguro(()=>envelope.parse(raw),'INTERNAL_SERVER_ERROR');
  if (r.error) {
    if (r.data !== null) throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Envelope43 contraditório; resultado não confirmado.'});
    const code = r.error.code;
    if (['22023','22007','22008','22P02','22003'].includes(code??'')) throw new TRPCError({code:'BAD_REQUEST',message:'Intenção43 inválida.'});
    if (code === '42501') throw new TRPCError({code:'NOT_FOUND',message:'Contrato, parcela ou conta indisponível para esta empresa.'});
    if (['23505','23514','40001','40P01','55000','55P03'].includes(code??'')) throw new TRPCError({code:'CONFLICT',message:'Estado, simulação ou UUID43 divergente/fechado. Preserve UUID/payload; erro não prova rollback.'});
    if (['PGRST202','42883','42P01'].includes(code??'')) throw new TRPCError({code:'PRECONDITION_FAILED',message:'Execução43 indisponível; nenhum fallback REST será executado.'});
    throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Resultado43 não confirmado. Preserve UUID/payload.'});
  }
  return r.data;
}
function params(input: Reparcelamento43Execucao) {
  const {idempotencyKey,...request} = input;
  return {p_chave_idempotencia:idempotencyKey,p_request:request};
}
export async function cotarReparcelamento43(c: ClienteReparcelamento43, uid: number, input: Reparcelamento43Preview) {
  owner(uid);const i = seguro(()=>reparcelamento43PreviewSchema.parse(input),'BAD_REQUEST');
  const value = await chamar(c,'rpc_cotar_reparcelamento43',{p_user_id:uid,p_request:i});
  return seguro(()=>conferirCotacao43(value,uid,i),'INTERNAL_SERVER_ERROR');
}
export async function executarReparcelamento43(c: ClienteReparcelamento43, uid: number, input: Reparcelamento43Execucao) {
  owner(uid);const i = seguro(()=>reparcelamento43ExecucaoSchema.parse(input),'BAD_REQUEST');
  const value = await chamar(c,'rpc_executar_reparcelamento43',{p_user_id:uid,...params(i)});
  return seguro(()=>conferirResultado43(value,uid,i),'INTERNAL_SERVER_ERROR');
}
export async function reconciliarReparcelamento43(c: ClienteReparcelamento43, uid: number, input: Reparcelamento43Execucao) {
  owner(uid);const i = seguro(()=>reparcelamento43ExecucaoSchema.parse(input),'BAD_REQUEST');
  const value = await chamar(c,'rpc_reconciliar_reparcelamento43',{p_user_id:uid,...params(i)});
  return seguro(()=> {
    const confirmed = z.strictObject({status:z.literal('confirmed'),result:z.unknown()}).safeParse(value);
    if (confirmed.success) return {status:'confirmed' as const,result:conferirResultado43(confirmed.data.result,uid,i)};
    const absent = z.strictObject({status:z.literal('not_executed'),idempotencyKey:z.string().uuid()}).parse(value);
    if (absent.idempotencyKey !== i.idempotencyKey) throw new Error('UUID43 de outra intenção');
    return absent;
  },'INTERNAL_SERVER_ERROR');
}
