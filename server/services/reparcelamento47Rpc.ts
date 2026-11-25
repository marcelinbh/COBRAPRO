import { TRPCError } from '@trpc/server';
import { conferirCotacao47,conferirResultado47,conferirRecovery47,reparcelamento47PreviewSchema,reparcelamento47ExecucaoSchema,request47,type Reparcelamento47Execucao } from '../../shared/reparcelamento47';
import { type Reparcelamento43Preview } from '../../shared/reparcelamento43';
import { type ClienteReparcelamento43 } from './reparcelamento43Rpc';
export type ClienteReparcelamento47=ClienteReparcelamento43;
async function call(c:ClienteReparcelamento47,uid:number,name:string,args:Record<string,unknown>){
 if(!Number.isInteger(uid)||uid<=0||uid>2147483647)throw new TRPCError({code:'UNAUTHORIZED',message:'Sessão financeira inválida.'});
 let raw;try{raw=await c.rpc(name,{p_user_id:uid,...args});}catch{throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Resultado47 desconhecido; preserve UUID e confira a mesma intenção.'});}
 if(!raw||typeof raw!=='object'||!('data' in raw)||!('error' in raw))throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Envelope47 inválido; preserve intenção.'});
 if(raw.error){
 if(raw.data!==null)throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Envelope47 contraditório.'});
 const code=raw.error.code;
 if(code==='0A000')throw new TRPCError({code:'PRECONDITION_FAILED',message:'47 permite somente mensal25 inteiramente aberto, sem multa/mora, recebimento ou renovação. Nenhuma transferência confirmada.'});
 if(code==='42501')throw new TRPCError({code:'NOT_FOUND',message:'Origem/cotação47 indisponível nesta empresa.'});
 if(['PGRST202','42883','42P01'].includes(code??''))throw new TRPCError({code:'PRECONDITION_FAILED',message:'Writer47 não instalado; sem fallback.'});
 if(['40001','40P01','55P03','23514','23505','55000'].includes(code??''))throw new TRPCError({code:'CONFLICT',message:'Estado47 expirado, OFF, fenced ou prova divergente. Preserve a intenção e confira antes de recotar.'});
 if(['22023','22007','22008','22P02','22003'].includes(code??''))throw new TRPCError({code:'BAD_REQUEST',message:'Intenção47 inválida.'});
 throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Resultado47 não confirmado; preserve intenção.'});
 }
 return raw.data;
}
export async function cotarReparcelamento47(c:ClienteReparcelamento47,uid:number,input:Reparcelamento43Preview){const r=reparcelamento47PreviewSchema.parse(input);return conferirCotacao47(await call(c,uid,'rpc_cotar_reparcelamento47',{p_request:r}),uid,r);}
export async function executarReparcelamento47(c:ClienteReparcelamento47,uid:number,input:Reparcelamento47Execucao){const i=reparcelamento47ExecucaoSchema.parse(input);return conferirResultado47(await call(c,uid,'rpc_executar_reparcelamento47',{p_chave_idempotencia:i.idempotencyKey,p_request:request47(i)}),uid,i);}
export async function reconciliarReparcelamento47(c:ClienteReparcelamento47,uid:number,input:Reparcelamento47Execucao){const i=reparcelamento47ExecucaoSchema.parse(input);return conferirRecovery47(await call(c,uid,'rpc_reconciliar_reparcelamento47',{p_chave_idempotencia:i.idempotencyKey,p_request:request47(i)}),uid,i);}
