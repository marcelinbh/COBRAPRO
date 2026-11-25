import { z } from 'zod';
import { reparcelamento43PreviewSchema, conferirCotacao43, reparcelamento43CotacaoSchema, type Reparcelamento43Preview } from './reparcelamento43';
const id=z.number().int().positive().max(2147483647),money=z.string().regex(/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/),hash=z.string().regex(/^[a-f0-9]{64}$/);
// Quote47 conserva principal e usa juros líquidos atuais auditados46/48; desconto48 já integra saldo, não deduzir outra vez.
export const reparcelamento47PreviewSchema=reparcelamento43PreviewSchema;
export const reparcelamento47CotacaoSchema=reparcelamento43CotacaoSchema.extend({
 regra:z.literal('reparcelamento47_cotacao_v2'),cotacaoId:z.string().uuid(),origemOperationId:z.string().uuid(),modalidadeOrigem:z.literal('mensal'),principalOriginal:money,jurosEmbutidos:money,executavel:z.literal(true),
});
export const reparcelamento47ExecucaoSchema=reparcelamento47PreviewSchema.extend({cotacaoId:z.string().uuid(),cotacaoHash:hash,estadoHash:hash,idempotencyKey:z.string().uuid()});
export const reparcelamento47ResultadoSchema=z.strictObject({success:z.literal(true),regra:z.literal('reparcelamento47_v2'),userId:id,idempotencyKey:z.string().uuid(),operationId:z.string().uuid(),contratoOrigemId:id,contratoId:id,raizId:id,contaCaixaId:id,parcelasIds:z.array(id).min(1).max(60),saldoTransferido:money,principalOriginal:money,jurosEmbutidos:money,jurosNovos:money,totalNovo:money,desembolso:z.literal('0.00'),repetida:z.boolean()});
export type Reparcelamento47Cotacao=z.infer<typeof reparcelamento47CotacaoSchema>;
export type Reparcelamento47Execucao=z.infer<typeof reparcelamento47ExecucaoSchema>;
export type Reparcelamento47Resultado=z.infer<typeof reparcelamento47ResultadoSchema>;
const cents=(s:string)=>BigInt(s.replace('.','')),round=(v:bigint,d:bigint)=>(2n*v+d)/(2n*d);
export function conferirCotacao47(value:unknown,owner:number,request:Reparcelamento43Preview):Reparcelamento47Cotacao {
 const q=reparcelamento47CotacaoSchema.parse(value);
 const {cotacaoId,origemOperationId,modalidadeOrigem,principalOriginal,jurosEmbutidos,executavel,...base}=q;
 conferirCotacao43({...base,regra:'reparcelamento43_v1'},owner,request);
 if(cents(principalOriginal)<=0n||q.encargos!=='0.00'||cents(q.saldoDevedor)!==cents(principalOriginal)+cents(jurosEmbutidos))throw Error('Saldo47 não conserva principal e juros explícitos sem encargos');
 return q;
}
export function intencao47DaCotacao(q:Reparcelamento47Cotacao,key:string){return reparcelamento47ExecucaoSchema.parse({...q.request,cotacaoId:q.cotacaoId,cotacaoHash:q.cotacaoHash,estadoHash:q.estadoHash,idempotencyKey:key});}
export function conferirResultado47(value:unknown,owner:number,input:Reparcelamento47Execucao):Reparcelamento47Resultado {
 const r=reparcelamento47ResultadoSchema.parse(value);
 if(r.userId!==owner||r.idempotencyKey!==input.idempotencyKey||r.contratoOrigemId!==input.contratoId||r.raizId!==input.contratoId||r.contratoId===input.contratoId||r.parcelasIds.length!==input.numeroParcelas||new Set(r.parcelasIds).size!==r.parcelasIds.length||cents(r.saldoTransferido)!==cents(r.principalOriginal)+cents(r.jurosEmbutidos)||cents(r.jurosNovos)!==round(cents(r.saldoTransferido)*cents(input.taxaJuros)*BigInt(input.numeroParcelas),10000n)||cents(r.totalNovo)!==cents(r.saldoTransferido)+cents(r.jurosNovos))throw Error('Resultado47 de outra empresa/intenção ou não conservativo');
 return r;
}
export function request47(input:Reparcelamento47Execucao){const {idempotencyKey,...r}=reparcelamento47ExecucaoSchema.parse(input);return r;}
export function conferirRecovery47(value:unknown,owner:number,input:Reparcelamento47Execucao){
 const v=z.strictObject({userId:id,idempotencyKey:z.string().uuid(),request:reparcelamento47ExecucaoSchema.omit({idempotencyKey:true}),requestHash:hash,proof:z.literal('uuid_fenced47_v2'),status:z.enum(['confirmed','not_executed']),operationId:z.string().uuid().nullable(),result:z.unknown()}).parse(value);
 const r=request47(input);
 if(v.userId!==owner||v.idempotencyKey!==input.idempotencyKey||Object.keys(r).some(k=>v.request[k as keyof typeof r]!==r[k as keyof typeof r]))throw Error('Recovery47 de outra intenção');
 if(v.status==='confirmed'){const result=conferirResultado47(v.result,owner,input);if(v.operationId!==result.operationId)throw Error('Recovery47 operation divergente');return {status:'confirmed' as const,result};}
 if(v.operationId!==null||v.result!==null)throw Error('Fence47 contraditório');
 return {status:'not_executed' as const,idempotencyKey:input.idempotencyKey};
}
