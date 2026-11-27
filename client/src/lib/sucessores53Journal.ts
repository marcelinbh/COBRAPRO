import { intent53,validarClosure53,type Intent53,type Closure53 } from '../../../shared/sucessores53';
import { canonical51 } from '../../../shared/obrigacoes51';
import { withFinance53,assertNoOtherFinance53,type FinanceLocks53 } from '../../../shared/financialCoordination53';
export type Scope53={ownerId:number;sessionScope:string;contratoId:number};
export const key53=(s:Scope53)=>`cobrapro:sucessores53:v1:${s.ownerId}:${s.sessionScope}:${s.contratoId}`;
function same(i:Intent53,s:Scope53){if(i.ownerId!==s.ownerId||i.sessionScope!==s.sessionScope||i.contratoId!==s.contratoId)throw Error('Journal53 empresa/sessão/contrato divergente.');}
function cas(storage:Storage,key:string,raw:string|null){if(storage.getItem(key)!==raw)throw Error('CAS53 mudou; preserve pedido/UUID.');}
export function read53(storage:Storage,s:Scope53){const raw=storage.getItem(key53(s));if(raw===null)return {raw,pending:null,terminal:null};const i=intent53.parse(JSON.parse(raw));same(i,s);const a=storage.getItem(`${key53(s)}:closed:${i.idempotencyKey}`);if(a===null)return {raw,pending:i,terminal:null};const v=JSON.parse(a);if(canonical51(v.intent)!==canonical51(i))throw Error('Arquivo53 divergente.');return {raw,pending:i,terminal:validarClosure53(v.closure,i)};}
export async function send53(options:{storage:Storage;locks:FinanceLocks53;scope:Scope53;expected:string|null;mode:'new'|'repeat'|'recover';nova?:Intent53;atual:()=>boolean;post:(i:Intent53,recover:boolean)=>Promise<unknown>}){
 const {storage,locks,scope,expected,mode}=options,key=key53(scope);
 return withFinance53(locks,scope.ownerId,key,async()=>{
  if(!options.atual())throw Error('Sessão53 mudou.');cas(storage,key,expected);let r=read53(storage,scope);if(r.terminal)return r;
  if(mode==='new'){
   if(r.pending||!options.nova)throw Error('Pendência53 exige recuperação exata.');assertNoOtherFinance53(storage,scope.ownerId,key,true);const i=intent53.parse(options.nova);same(i,scope);if(storage.getItem(`${key}:closed:${i.idempotencyKey}`)!==null)throw Error('UUID53 encerrada.');const raw=JSON.stringify(i);storage.setItem(key,raw);cas(storage,key,raw);r=read53(storage,scope);
  }
  if(!r.pending||!r.raw)throw Error('Pedido53 persistido não encontrado.');const i=r.pending,raw=r.raw;if(!options.atual())throw Error('Sessão53 mudou antes do POST.');cas(storage,key,raw);
  const answer=await options.post(i,mode==='recover');if(!options.atual())throw Error('Resposta53 de sessão anterior ignorada; preserve journal.');cas(storage,key,raw);const c=validarClosure53(answer,i),archiveKey=`${key}:closed:${i.idempotencyKey}`,archive=JSON.stringify({intent:i,closure:c});const old=storage.getItem(archiveKey);if(old!==null&&old!==archive)throw Error('Arquivo53 não substituível.');storage.setItem(archiveKey,archive);cas(storage,archiveKey,archive);return read53(storage,scope);
 });
}
export async function close53(storage:Storage,locks:FinanceLocks53,s:Scope53,expected:string,atual:()=>boolean){return withFinance53(locks,s.ownerId,key53(s),async()=>{
 if(!atual())throw Error('Sessão53 mudou.');cas(storage,key53(s),expected);const r=read53(storage,s);if(!r.pending||!r.terminal)throw Error('Prova53 ainda não arquivada.');const index=JSON.stringify({idempotencyKey:r.pending.idempotencyKey});storage.setItem(`${key53(s)}:last-terminal`,index);cas(storage,`${key53(s)}:last-terminal`,index);cas(storage,key53(s),expected);if(!atual())throw Error('Sessão53 mudou.');storage.removeItem(key53(s));cas(storage,key53(s),null);return r.terminal as Closure53;
 });}
