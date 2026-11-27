import { z } from 'zod';
import { int32_51,hash51,money51,readMoney51,positiveMoney51,date51,canonical51 } from './obrigacoes51';
import { copiarJsonCaixa37 } from './caixa37';
export const proposta53=z.object({versao:z.literal('sucessores53_editar_v1'),acao:z.literal('editar'),parcelaId:int32_51,novaDataVencimento:date51.optional(),novoValor:positiveMoney51.optional()}).strict().refine(v=>v.novaDataVencimento!==undefined||v.novoValor!==undefined);
export const quoteInput53=z.object({ownerId:int32_51,sessionScope:hash51,contratoId:int32_51,proposta:proposta53}).strict();
export const request53=z.object({contratoId:int32_51,proposta:proposta53,estadoHash:hash51,dataCalculo:date51,motivo:z.string().min(3).max(500).refine(v=>v===v.trim())}).strict();
export const intent53=request53.extend({ownerId:int32_51,sessionScope:hash51,idempotencyKey:z.string().uuid()}).strict();
export const quote53=z.object({versao:z.literal('sucessores53_v1'),userId:int32_51,contratoId:int32_51,paiId:int32_51,raizId:int32_51,proposta:proposta53,estadoHash:hash51,dataCalculo:date51,caixaPreservado:z.literal(true),semantica:z.literal('Bi_preservada_Jn_apenas'),baseTransferida:readMoney51,totalDepois:readMoney51}).strict();
const common={versao:z.literal('sucessores53_v1'),userId:int32_51,idempotencyKey:z.string().uuid(),sameIntentOnly:z.literal(true),request:request53};
const result53=z.object({operationId:z.string().uuid(),contratoId:int32_51,paiId:int32_51,raizId:int32_51,parcelaId:int32_51,caixaPreservado:z.literal(true),semantica:z.literal('Bi_preservada_Jn_apenas')}).strict();
export const closure53=z.discriminatedUnion('status',[z.object({...common,status:z.literal('confirmed'),resultado:result53}).strict(),z.object({...common,status:z.literal('fenced')}).strict()]);
export const estado53=z.object({versao:z.literal('sucessores53_composicao_v1'),userId:int32_51,contratoId:int32_51,paiId:int32_51,raizId:int32_51,proveniencia:z.literal('sucessor47'),P:readMoney51,Jt:readMoney51,A:readMoney51,U:z.literal('0.00'),B:readMoney51,Jn:readMoney51,total:readMoney51,componentesGlobais:z.literal('obrigacao_acordada_nao_saldo_por_componente'),saldoPorComponenteDisponivel:z.boolean(),manutencaoDisponivel:z.boolean(),parcelas:z.array(z.object({parcelaId:int32_51,B:readMoney51,Jn:readMoney51,P:z.null(),Jt:z.null(),A:z.null(),U:z.null(),alocacaoIndividual:z.literal('indisponivel_historica'),dataVencimento:date51,valor:readMoney51}).strict()).min(1).max(60)}).strict().superRefine((s,ctx)=>{
 const cents=(v:string)=>BigInt(v.replace('.',''));const sum=(k:'B'|'Jn'|'valor')=>s.parcelas.reduce((a,p)=>a+cents(p[k]),0n);
 if(new Set(s.parcelas.map(p=>p.parcelaId)).size!==s.parcelas.length||cents(s.P)+cents(s.Jt)+cents(s.A)!==cents(s.B)||sum('B')!==cents(s.B)||sum('Jn')!==cents(s.Jn)||sum('valor')!==cents(s.total)||cents(s.B)+cents(s.Jn)!==cents(s.total)||s.parcelas.some(p=>cents(p.B)+cents(p.Jn)!==cents(p.valor)))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Composição53 não conserva centavos.'});
});
export type Proposta53=z.infer<typeof proposta53>;
export type Intent53=z.infer<typeof intent53>;export type Quote53=z.infer<typeof quote53>;export type Closure53=z.infer<typeof closure53>;export type Estado53=z.infer<typeof estado53>;
export const requestFrom53=(v:Intent53)=>{const {ownerId,sessionScope,idempotencyKey,...r}=intent53.parse(v);return r;};
export function validarClosure53(value:unknown,intent:Intent53):Closure53 {
 const i=intent53.parse(copiarJsonCaixa37(intent)),c=closure53.parse(copiarJsonCaixa37(value));
 if(c.userId!==i.ownerId||c.idempotencyKey!==i.idempotencyKey||canonical51(c.request)!==canonical51(requestFrom53(i))||(c.status==='confirmed'&&(c.resultado.contratoId!==i.contratoId||c.resultado.parcelaId!==i.proposta.parcelaId||c.resultado.raizId!==c.resultado.paiId)))throw Error('Closure53 diverge da empresa/UUID/request/folha47 provados; preservar pending.');return c;
}
