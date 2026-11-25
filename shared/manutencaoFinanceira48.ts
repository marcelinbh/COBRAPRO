import { z } from 'zod';
const id=z.number().int().positive().max(2147483647),uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const taxa48=z.string().regex(/^(0|[1-9][0-9]{0,2})\.[0-9]{4}$/).refine(s=>{const [a,b]=s.split('.');return BigInt(a)*10000n+BigInt(b)<=1000000n&&b.endsWith('00');},'Taxa deve caber no NUMERIC(5,2) físico.');
export const moeda48=z.string().regex(/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/);
export function normalizarTaxa48(value:string){const s=value.trim().replace(',','.');if(!/^(0|[1-9][0-9]{0,2})(\.[0-9]{1,4})?$/.test(s))throw Error('Taxa de 0 a 100, representável em duas casas.');const [a,b='']=s.split('.');return taxa48.parse(`${a}.${b.padEnd(4,'0')}`);}
export function normalizarMoeda48(value:string){const s=value.trim().replace(',','.');if(!/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(s))throw Error('Valor em centavos, sem expoente ou arredondamento.');const [a,b='']=s.split('.');return moeda48.parse(`${a}.${b.padEnd(2,'0')}`);}
export const alteracao48=z.discriminatedUnion('acao',[
 z.object({acao:z.literal('juros'),taxaJuros:taxa48}).strict(),
 z.object({acao:z.literal('valor'),parcelaId:id,valor:moeda48}).strict(),
 z.object({acao:z.literal('desconto'),parcelaId:id,valor:moeda48}).strict(),
 z.object({acao:z.literal('cancelar')}).strict(),
]);
export type Alteracao48=z.infer<typeof alteracao48>;
export const quoteInput48=z.object({contratoId:id,alteracao:alteracao48}).strict();
export const intent48=quoteInput48.extend({idempotencyKey:uuid,estadoHash:hash,motivo:z.string().min(3).max(500).refine(s=>s===s.trim())}).strict();
export type Intent48=z.infer<typeof intent48>;
export const quote48=quoteInput48.extend({estadoHash:hash,regra:z.literal('manutencao25_obrigacao_v1'),principal:moeda48,jurosTotal:moeda48,totalContrato:moeda48,obrigacaoCancelada:moeda48,numeroParcelas:z.number().int().min(1).max(60),alteradas:z.number().int().min(1).max(60)}).strict();
export const result48=intent48.extend({success:z.literal(true),repetida:z.boolean(),operationId:uuid,regra:z.literal('manutencao25_obrigacao_v1'),totalContrato:moeda48,jurosTotal:moeda48,obrigacaoCancelada:moeda48}).strict();
export const closure48=z.discriminatedUnion('status',[
 z.object({status:z.literal('confirmed'),sameIntentOnly:z.literal(true),resultado:result48}).strict(),
 intent48.extend({status:z.literal('fenced'),regra:z.literal('manutencao48_fence_v1')}).strict(),
]);
export type Closure48=z.infer<typeof closure48>;
export function validarClosure48(data:unknown,intent:Intent48){const c=closure48.parse(data),p=c.status==='confirmed'?c.resultado:c;for(const key of ['contratoId','idempotencyKey','estadoHash','motivo'] as const)if(p[key]!==intent[key])throw Error('Prova48 não pertence ao pedido exato.');if(JSON.stringify(alteracao48.parse(p.alteracao))!==JSON.stringify(alteracao48.parse(intent.alteracao)))throw Error('Prova48 não pertence à alteração exata.');return c;}
export const scopedQuote48=quoteInput48.extend({sessionScope:hash,ownerId:id}).strict();
export const scopedIntent48=intent48.extend({sessionScope:hash,ownerId:id}).strict();
export type ScopedIntent48=z.infer<typeof scopedIntent48>;
export type Storage48=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
/** All calls must be inside the same Web Lock, including awaited POST/recovery. */
export function persistir48(storage:Storage48,key:string,expected:string|null,intent:ScopedIntent48){if(storage.getItem(key)!==expected)throw Error('CAS48 divergente; preserve o journal.');const raw=JSON.stringify(scopedIntent48.parse(intent));if(expected!==null&&raw!==expected)throw Error('Pedido48 já pendente; nunca sobrescrever.');storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Journal48 não persistiu.');return raw;}
export function arquivar48(storage:Storage48,key:string,raw:string,proof:unknown){if(storage.getItem(key)!==raw)throw Error('CAS48 divergente; preserve o journal.');const scoped=scopedIntent48.parse(JSON.parse(raw)),{sessionScope,ownerId,...intent}=scoped;const terminal=validarClosure48(proof,intent);const archiveKey=`${key}:closed:${intent.idempotencyKey}`,archive=JSON.stringify({intent:scoped,closure:terminal}),old=storage.getItem(archiveKey);if(old!==null&&old!==archive)throw Error('Arquivo48 divergente.');storage.setItem(archiveKey,archive);if(storage.getItem(archiveKey)!==archive||storage.getItem(key)!==raw)throw Error('Prova48 não persistiu ou CAS mudou.');storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('Journal48 ainda pendente.');return terminal;}
