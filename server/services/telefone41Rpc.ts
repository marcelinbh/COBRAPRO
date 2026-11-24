import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { intencaoTelefone41Schema, type IntencaoTelefone41 } from '../../shared/telefone41';
export interface ClienteTelefone41 {
  rpc(name: 'rpc_executar_telefone41' | 'rpc_reconciliar_telefone41' | 'rpc_abandonar_telefone41', args: Record<string,unknown>): PromiseLike<unknown>;
}
const resultadoSchema = z.object({success:z.literal(true),repetida:z.boolean(),userId:z.number().int().positive(),idempotencyKey:z.string().uuid(),acao:z.enum(['criar','receber','cancelar']),vendaId:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),parcelasIds:z.array(z.number().int().positive()),transacoesIds:z.array(z.number().int().positive()),status:z.enum(['ativo','quitado','cancelado'])}).strict();
function erro(message: string): never { throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message}); }
function normalizar(value: unknown, owner: number, i: IntencaoTelefone41) {
 const parsed=resultadoSchema.safeParse(value);
 if(!parsed.success) erro('Prova telefone41 inválida; preserve a mesma intenção.');
 const r=parsed.data;
 if(r.userId!==owner || r.idempotencyKey!==i.idempotencyKey || r.acao!==i.request.acao || ('vendaId' in i.request && r.vendaId!==i.request.vendaId) || (r.acao==='criar' && r.parcelasIds.length!==(i.request as {numParcelas:number}).numParcelas)) erro('Bindings da prova telefone41 divergentes; preserve a mesma intenção.');
 return r;
}
export async function executarTelefone41(cliente: ClienteTelefone41, owner: number, input: unknown, recovery=false, abandon=false) {
 if(!Number.isInteger(owner)||owner<=0||owner>2147483647) throw new TRPCError({code:'UNAUTHORIZED'});
 const validated=intencaoTelefone41Schema.safeParse(input);
 if(!validated.success) throw new TRPCError({code:'BAD_REQUEST',message:'Intenção telefone41 inválida.'});
 const i=validated.data;
 let response: unknown;
 try { response=await cliente.rpc(abandon?'rpc_abandonar_telefone41':recovery?'rpc_reconciliar_telefone41':'rpc_executar_telefone41',{p_user_id:owner,p_chave:i.idempotencyKey,p_request:i.request}); }
 catch { erro('Resultado telefone41 incerto. Recupere/reenvie o MESMO UUID e request; não crie nova intenção.'); }
 if(response===null||typeof response!=='object'||Array.isArray(response)||!Object.hasOwn(response,'data')||!Object.hasOwn(response,'error')) erro('Envelope telefone41 não confirmado; preserve a intenção.');
 const env=response as Record<string,unknown>;
 if(Object.keys(env).some(k=>!['data','error','count','status','statusText','success'].includes(k)) || (Object.hasOwn(env,'success') && env.success!==(env.error===null)) || (Object.hasOwn(env,'status') && (typeof env.status!=='number'||!Number.isInteger(env.status)||env.status<0||env.status>599 || (env.error===null && (env.status<200||env.status>=300))))) erro('Envelope telefone41 contraditório; preserve a intenção.');
 const r=response as {data:unknown,error:unknown};
 if(r.error!==null){
  if(!r.error||typeof r.error!=='object'||Array.isArray(r.error)||r.data!==null) erro('Envelope telefone41 contraditório.');
  const code=(r.error as {code?:string}).code;
  if(['PGRST106','PGRST202','42883','42P01','55000'].includes(code??'')) throw new TRPCError({code:'PRECONDITION_FAILED',message:'Telefone41 ainda não certificado/disponível. Nenhum writer alternativo será usado.'});
  if(['22023','22007','22008','22P02','22003'].includes(code??'')) throw new TRPCError({code:'BAD_REQUEST',message:'Valores/data telefone41 inválidos; preserve a intenção até conferir.'});
  if(code==='42501') throw new TRPCError({code:'NOT_FOUND',message:'Venda, parcela ou conta indisponível para esta empresa.'});
  if(['23505','40001','40P01'].includes(code??'')) throw new TRPCError({code:'CONFLICT',message:'Intenção/estado concorrente. Preserve UUID e request para recuperação.'});
  if(code==='23514') throw new TRPCError({code:'PRECONDITION_FAILED',message:'Livro ou saldo não comprovado; operação revertida integralmente no PostgreSQL.'});
  erro('Resultado telefone41 não confirmado; preserve UUID e request.');
 }
 if(!recovery && !abandon) return normalizar(r.data,owner,i);
 const recovered=z.object({status:z.enum(['confirmed','unknown','not_executed']),result:z.unknown(),userId:z.number().int().positive().optional(),idempotencyKey:z.string().uuid().optional()}).strict().safeParse(r.data);
 if(!recovered.success) erro('Recovery telefone41 inválido.');
 if(recovered.data.status==='confirmed') return {status:'confirmed' as const,result:normalizar(recovered.data.result,owner,i)};
 if(recovered.data.result!==null) erro('Recovery telefone41 contraditório.');
 if(recovered.data.status==='not_executed') {
  if(recovered.data.userId!==owner || recovered.data.idempotencyKey!==i.idempotencyKey) erro('Fence telefone41 com bindings divergentes.');
  return {status:'not_executed' as const,result:null};
 }
 if(recovered.data.userId!==undefined || recovered.data.idempotencyKey!==undefined) erro('Recovery telefone41 contraditório.');
 return {status:'unknown' as const,result:null};
}
