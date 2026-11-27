import { TRPCError } from '@trpc/server';
import { int32_51,canonical51 } from '../../shared/obrigacoes51';
import { quoteInput53,quote53,intent53,estado53,validarClosure53,requestFrom53 } from '../../shared/sucessores53';
import { copiarJsonCaixa37 } from '../../shared/caixa37';
export const facades53={cotar:'rpc_cotar_sucessores53',executar:'rpc_executar_sucessores53',conferir:'rpc_conferir_sucessores53',estado:'rpc_estado_sucessores53'} as const;
export type Client53={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{code?:string}|null}>};
async function call(client:Client53,kind:keyof typeof facades53,args:Record<string,unknown>){
 let r;try{r=await client.rpc(facades53[kind],args);}catch{throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Sem confirmação53; preserve UUID/request. Timeout não prova rollback.'});}
 if(r.error){const code=r.error.code??'';throw new TRPCError({code:code==='42501'?'NOT_FOUND':['22023','22008','22007','22P02'].includes(code)?'BAD_REQUEST':['23514','23505','40001','40P01'].includes(code)?'CONFLICT':['55000','0A000','42883','PGRST202'].includes(code)?'PRECONDITION_FAILED':'INTERNAL_SERVER_ERROR',message:`Sucessor53 indisponível (${code}); sem fallback nem adoção histórica.`});}return copiarJsonCaixa37(r.data);
}
export async function cotarSucessor53(client:Client53,uid:number,value:unknown){int32_51.parse(uid);const v=quoteInput53.parse(copiarJsonCaixa37(value));if(v.ownerId!==uid)throw new TRPCError({code:'CONFLICT',message:'Empresa53 divergente.'});const q=quote53.parse(await call(client,'cotar',{p_user_id:uid,p_contrato_id:v.contratoId,p_proposta:v.proposta}));if(q.userId!==uid||q.contratoId!==v.contratoId||canonical51(q.proposta)!==canonical51(v.proposta)||q.raizId!==q.paiId)throw Error('Cotação53 não pertence ao pedido/folha47.');return q;}
export async function executarSucessor53(client:Client53,uid:number,value:unknown,recover=false){int32_51.parse(uid);const v=intent53.parse(copiarJsonCaixa37(value));if(v.ownerId!==uid)throw new TRPCError({code:'CONFLICT',message:'Empresa53 divergente.'});return validarClosure53(await call(client,recover?'conferir':'executar',{p_user_id:uid,p_chave:v.idempotencyKey,p_request:requestFrom53(v)}),v);}
export async function estadoSucessor53(client:Client53,uid:number,cid:number){int32_51.parse(uid);int32_51.parse(cid);const s=estado53.parse(await call(client,'estado',{p_user_id:uid,p_contrato_id:cid}));if(s.userId!==uid||s.contratoId!==cid)throw Error('Composição53 de outra empresa/folha.');return s;}
