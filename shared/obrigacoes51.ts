import { z } from 'zod';
export const int32_51=z.number().int().positive().max(2147483647);
export const hash51=z.string().regex(/^[a-f0-9]{64}$/);
export const money51=z.string().regex(/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/);
export const readMoney51=z.string().regex(/^(0|[1-9][0-9]{0,12})\.[0-9]{2}$/);
export const positiveMoney51=money51.refine(s=>BigInt(s.replace('.',''))>0n,'Informe valor positivo em centavos, sem arredondamento.');
export const date51=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+'T12:00:00Z');return s>='1900-01-01'&&s<='9999-12-31'&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;},'DATE civil inválida.');
const alvo51=z.discriminatedUnion('tipo',[z.object({tipo:z.literal('contrato')}).strict(),z.object({tipo:z.literal('parcela'),parcelaId:int32_51}).strict()]);
export const proposta51=z.discriminatedUnion('acao',[
 z.object({acao:z.literal('adicionar'),valor:positiveMoney51,dataVencimento:date51,classificacao:z.literal('obrigacao_adicional_nao_desembolsada')}).strict(),
 z.object({acao:z.literal('editar'),parcelaId:int32_51,novoValor:positiveMoney51.optional(),novaDataVencimento:date51.optional()}).strict(),
 z.object({acao:z.literal('cancelar'),alvo:alvo51,reconhecoSemEstorno:z.literal(true)}).strict(),
 z.object({acao:z.literal('arquivar'),alvo:alvo51}).strict(),
 z.object({acao:z.literal('quitar'),contaCaixaId:int32_51,valorRecebido:positiveMoney51,reconhecoDinheiroReal:z.literal(true)}).strict(),
]).superRefine((p,c)=>{if(p.acao==='editar'&&!p.novoValor&&!p.novaDataVencimento)c.addIssue({code:z.ZodIssueCode.custom,message:'Informe valor e/ou data.'});});
export const quoteInput51=z.object({contratoId:int32_51,proposta:proposta51,ownerId:int32_51,sessionScope:hash51}).strict();
export const request51=z.object({contratoId:int32_51,proposta:proposta51,estadoHash:hash51,dataCalculo:date51,motivo:z.string().min(3).max(500).refine(s=>s===s.trim())}).strict();
export const intent51=request51.extend({idempotencyKey:z.string().uuid(),ownerId:int32_51,sessionScope:hash51}).strict();
export const quote51=z.object({versao:z.literal('obrigacoes51_v1'),userId:int32_51,contratoId:int32_51,proposta:proposta51,origem:z.enum(['multimodal35','prospectivo21','legado']),estadoHash:hash51,dataCalculo:date51,totalAntes:money51,totalDepois:money51,obrigacaoAdicional:money51,valorExigido:money51,contaDestinoId:int32_51.nullable(),idsAfetados:z.array(int32_51).max(60),caixaPreservado:z.boolean()}).strict();
export const result51=z.object({operationId:z.string().uuid(),contratoId:int32_51,acao:z.enum(['adicionar','editar','cancelar','arquivar','quitar']),idsAfetados:z.array(int32_51).min(1).max(60),valorRecebido:money51,contaDestinoId:int32_51.nullable(),caixaPreservado:z.boolean()}).strict();
const common={sameIntentOnly:z.literal(true),versao:z.literal('obrigacoes51_v1'),userId:int32_51,idempotencyKey:z.string().uuid(),request:request51};
export const closure51=z.discriminatedUnion('status',[z.object({...common,status:z.literal('confirmed'),resultado:result51}).strict(),z.object({...common,status:z.literal('fenced')}).strict()]);
export const projection51=z.object({versao:z.literal('obrigacoes51_v1'),userId:int32_51,contratoId:int32_51,statusObrigacao:z.enum(['ativo','quitado','encerrado_por_cancelamento']),arquivado:z.boolean(),obrigacaoAdicional:readMoney51,parcelas:z.array(z.object({parcelaId:int32_51,statusFinanceiroOriginal:z.string(),statusObrigacao:z.enum(['aberta','paga','cancelada','transferida']),obrigacaoAtual:readMoney51,componenteAdicional:readMoney51,arquivada:z.boolean()}).strict())}).strict();
export type Proposta51=z.infer<typeof proposta51>;
export type Intent51=z.infer<typeof intent51>;
export type Quote51=z.infer<typeof quote51>;
export type Projection51=z.infer<typeof projection51>;
export type Closure51=z.infer<typeof closure51>;
export function canonical51(v:unknown):string{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical51).join(',')+']';return '{'+Object.keys(v as object).sort().map(k=>JSON.stringify(k)+':'+canonical51((v as Record<string,unknown>)[k])).join(',')+'}';}
export function toRequest51(v:Intent51){const {ownerId:_,sessionScope:__,idempotencyKey:___,...request}=intent51.parse(v);return request;}
export function validarClosure51(data:unknown,intent:Intent51):Closure51{const v=intent51.parse(intent),r=closure51.parse(data);if(r.userId!==v.ownerId||r.idempotencyKey!==v.idempotencyKey||canonical51(r.request)!==canonical51(toRequest51(v)))throw new Error('Prova51 não pertence à intenção exata. Preserve UUID e pedido.');if(r.status==='confirmed'&&(r.resultado.contratoId!==v.contratoId||r.resultado.acao!==v.proposta.acao||r.resultado.caixaPreservado!==(v.proposta.acao!=='quitar')||r.resultado.valorRecebido!==(v.proposta.acao==='quitar'?v.proposta.valorRecebido:'0.00')||r.resultado.contaDestinoId!==(v.proposta.acao==='quitar'?v.proposta.contaCaixaId:null)))throw new Error('Efeito51 divergente.');return r;}
