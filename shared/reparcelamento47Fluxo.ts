import { z } from 'zod';
import { reparcelamento47ExecucaoSchema,conferirResultado47,type Reparcelamento47Execucao,type Reparcelamento47Resultado } from './reparcelamento47';
export type Storage47={getItem(k:string):string|null;setItem(k:string,v:string):void;removeItem(k:string):void};
export type Locks47={request<T>(name:string,callback:()=>Promise<T>):Promise<T>};
const key=(owner:number)=>`cobrapro:reparcelar47:v2:empresa:${owner}`;
const terminalPointerKey=(owner:number)=>`${key(owner)}:ultimo-terminal`;
const terminalPointerSchema=z.strictObject({version:z.literal(2),owner:z.number().int().positive(),idempotencyKey:z.string().uuid()});
const terminalReceiptSchema=z.strictObject({version:z.literal(2),owner:z.number().int().positive(),input:reparcelamento47ExecucaoSchema,proof:z.discriminatedUnion('status',[
 z.strictObject({status:z.literal('confirmed'),result:z.unknown()}),
 z.strictObject({status:z.literal('not_executed'),idempotencyKey:z.string().uuid()}),
])});
/** Read-only local receipt, not a new server proof or permission to execute. No cross-owner enumeration. */
export function lerUltimoResultado47(storage:Storage47,owner:number):Reparcelamento47Resultado|null {
 if(lerIntencao47(storage,owner))return null;
 const raw=storage.getItem(terminalPointerKey(owner));if(raw===null)return null;
 const pointer=terminalPointerSchema.parse(JSON.parse(raw));if(pointer.owner!==owner)throw Error('Índice terminal47 de outra empresa');
 const receiptRaw=storage.getItem(`${key(owner)}:terminal:${pointer.idempotencyKey}`);if(receiptRaw===null)throw Error('Recibo terminal47 ausente; nenhuma confirmação local');
 const receipt=terminalReceiptSchema.parse(JSON.parse(receiptRaw));
 if(receipt.owner!==owner||receipt.input.idempotencyKey!==pointer.idempotencyKey)throw Error('Recibo terminal47 de outra empresa/intenção');
 if(receipt.proof.status==='not_executed'){
  if(receipt.proof.idempotencyKey!==pointer.idempotencyKey)throw Error('Fence terminal47 de outra UUID');
  return null;
 }
 return conferirResultado47(receipt.proof.result,owner,receipt.input);
}
const recordSchema=z.strictObject({version:z.literal(2),owner:z.number().int().positive(),session:z.string().uuid(),revision:z.string().uuid(),phase:z.literal('pending'),input:reparcelamento47ExecucaoSchema});
export function lerIntencao47(storage:Storage47,owner:number){const raw=storage.getItem(key(owner));if(raw===null)return null;const v=recordSchema.parse(JSON.parse(raw));if(v.owner!==owner)throw Error('Journal47 de outra empresa');return v;}
function assertCAS(storage:Storage47,owner:number,expected:string|null){if(storage.getItem(key(owner))!==expected)throw Error('CAS47 perdeu corrida; preservar journal');}
function cas(storage:Storage47,owner:number,expected:string|null,next:string|null){assertCAS(storage,owner,expected);if(next===null)storage.removeItem(key(owner));else storage.setItem(key(owner),next);if(storage.getItem(key(owner))!==next)throw Error('CAS47 readback falhou; não enviar');}
function close(storage:Storage47,owner:number,raw:string,input:Reparcelamento47Execucao,proof:unknown){
 assertCAS(storage,owner,raw);
 const receiptKey=`${key(owner)}:terminal:${input.idempotencyKey}`,receipt=JSON.stringify({version:2,owner,input,proof});
 storage.setItem(receiptKey,receipt);if(storage.getItem(receiptKey)!==receipt)throw Error('Recibo47 não persistido; manter pending');
 // Per-owner locator only; immutable UUID receipt remains the proof. Fail closed before deleting pending.
 const pointer=JSON.stringify(terminalPointerSchema.parse({version:2,owner,idempotencyKey:input.idempotencyKey}));
 storage.setItem(terminalPointerKey(owner),pointer);if(storage.getItem(terminalPointerKey(owner))!==pointer)throw Error('Índice terminal47 não persistido; manter pending');
 cas(storage,owner,raw,null);
}
export async function enviarIntencao47(storage:Storage47,locks:Locks47|undefined,owner:number,session:string,input:Reparcelamento47Execucao,atual:()=>boolean,send:(i:Reparcelamento47Execucao)=>Promise<Reparcelamento47Resultado>){
 if(!locks)throw Error('WebLocks obrigatório47; nenhum envio');
 return locks.request(key(owner),async()=>{
 if(!atual())throw Error('Sessão47 mudou; nenhum envio');
 if(lerIntencao47(storage,owner))throw Error('Journal47 pendente: confira mesma UUID antes de outra ação');
 const record=recordSchema.parse({version:2,owner,session,revision:crypto.randomUUID(),phase:'pending',input});const raw=JSON.stringify(record);cas(storage,owner,null,raw);
 if(!atual())throw Error('Sessão47 mudou após persistência; preservar na empresa original');
 const value=await send(record.input);
 if(!atual())throw Error('Resposta47 de sessão anterior preservada');
 assertCAS(storage,owner,raw);const result=conferirResultado47(value,owner,record.input);
 close(storage,owner,raw,record.input,{status:'confirmed',result});return result;
 });
}
export async function recuperarIntencao47(storage:Storage47,locks:Locks47|undefined,owner:number,session:string,atual:()=>boolean,recover:(i:Reparcelamento47Execucao)=>Promise<{status:'confirmed';result:Reparcelamento47Resultado}|{status:'not_executed';idempotencyKey:string}>){
 if(!locks)throw Error('WebLocks obrigatório47; nenhuma conferência');
 return locks.request(key(owner),async()=>{
 if(!atual())throw Error('Sessão47 mudou');
 const original=storage.getItem(key(owner)),record=lerIntencao47(storage,owner);if(!record)throw Error('Nenhuma intenção47 persistida');
 // Sessão nova da MESMA empresa somente recupera: claim CAS dentro do WebLock, nunca send.
 const claimed=JSON.stringify({...record,session,revision:crypto.randomUUID()});cas(storage,owner,original,claimed);
 if(!atual())throw Error('Sessão47 mudou após claim');
 const value=await recover(record.input);
 if(!atual())throw Error('Recovery47 de sessão anterior preservado');assertCAS(storage,owner,claimed);
 if(value.status==='confirmed')conferirResultado47(value.result,owner,record.input);else if(value.idempotencyKey!==record.input.idempotencyKey)throw Error('Fence47 de outra UUID');
 close(storage,owner,claimed,record.input,value);return value;
 });
}
