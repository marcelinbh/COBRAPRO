import { describe,it,expect } from 'vitest';
import { intent53,validarClosure53,requestFrom53,proposta53 } from '../shared/sucessores53';
import { executarSucessor53,cotarSucessor53 } from './services/sucessores53Rpc';
import { send53,close53,key53,read53 } from '../client/src/lib/sucessores53Journal';
import { assertNoOtherFinance53 } from '../shared/financialCoordination53';
const intent=intent53.parse({ownerId:1,sessionScope:'a'.repeat(64),idempotencyKey:'11111111-1111-4111-8111-111111111111',contratoId:1002,proposta:{versao:'sucessores53_editar_v1',acao:'editar',parcelaId:1005,novaDataVencimento:'2027-09-11'},estadoHash:'b'.repeat(64),dataCalculo:'2026-11-26',motivo:'Teste sintético53'});
const closed={versao:'sucessores53_v1',status:'confirmed',sameIntentOnly:true,userId:1,idempotencyKey:intent.idempotencyKey,request:requestFrom53(intent),resultado:{operationId:'22222222-2222-4222-8222-222222222222',contratoId:1002,paiId:1001,raizId:1001,parcelaId:1005,caixaPreservado:true,semantica:'Bi_preservada_Jn_apenas'}};
function disk(){const m=new Map<string,string>();return {get length(){return m.size;},key:(i:number)=>[...m.keys()][i]??null,getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);},clear:()=>m.clear()} as Storage;}
const locks={request:async<T>(name:string,fn:()=>Promise<T>)=>fn()};const scope={ownerId:1,sessionScope:intent.sessionScope,contratoId:1002};
describe('sucessores53 APP strict real vertical',()=>{
 it('rejects extra proposal fields, cents/date and foreign closure target',()=>{
  expect(()=>proposta53.parse({...intent.proposta,taxa:'10'})).toThrow();expect(()=>proposta53.parse({...intent.proposta,novoValor:'130.001'})).toThrow();expect(()=>proposta53.parse({...intent.proposta,novaDataVencimento:'2027-02-29'})).toThrow();expect(()=>validarClosure53({...closed,userId:2},intent)).toThrow();expect(()=>validarClosure53({...closed,resultado:{...closed.resultado,parcelaId:1006}},intent)).toThrow();expect(validarClosure53(closed,intent).status).toBe('confirmed');
 });
 it('ownerctx only exact facade and timeout has no fallback',async()=>{
  const calls:string[]=[];const c={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push(name);expect(args.p_user_id).toBe(1);return {data:closed,error:null};}};expect((await executarSucessor53(c,1,intent)).status).toBe('confirmed');expect(calls).toEqual(['rpc_executar_sucessores53']);await expect(executarSucessor53(c,2,intent)).rejects.toThrow();await expect(executarSucessor53({rpc:async()=>{throw Error('timeout');}},1,intent)).rejects.toThrow('preserve');
 });
 it('persist/readback before POST and archived closure wins new capacity after crash',async()=>{
  const storage=disk(),names:string[]=[];const ls={request:async<T>(n:string,fn:()=>Promise<T>)=>{names.push(n);return fn();}};let posts=0;
  const result=await send53({storage,locks:ls,scope,expected:null,mode:'new',nova:intent,atual:()=>true,post:async(i)=>{posts++;expect(read53(storage,scope).pending).toEqual(i);return closed;}});expect(result.terminal?.status).toBe('confirmed');expect(storage.getItem(key53(scope))).not.toBeNull();expect(names.slice(0,2)).toEqual(['cobrapro:financeiro:owner:1',key53(scope)]);
  await send53({storage,locks,scope,expected:result.raw,mode:'recover',atual:()=>true,post:async()=>{posts++;throw Error('should not POST');}});expect(posts).toBe(1);await close53(storage,locks,scope,result.raw!,()=>true);expect(storage.getItem(key53(scope))).toBeNull();expect(storage.getItem(key53(scope)+':last-terminal')).not.toBeNull();
 });
 it('unknown POST retains exact UUID and recovery fences before another gesture',async()=>{
  const storage=disk();await expect(send53({storage,locks,scope,expected:null,mode:'new',nova:intent,atual:()=>true,post:async()=>{throw Error('timeout');}})).rejects.toThrow();expect(read53(storage,scope).pending).toEqual(intent);const fenced={...closed,status:'fenced'};delete (fenced as any).resultado;const r=await send53({storage,locks,scope,expected:storage.getItem(key53(scope)),mode:'recover',atual:()=>true,post:async(i,recover)=>{expect(recover).toBe(true);expect(i).toEqual(intent);return fenced;}});expect(r.terminal?.status).toBe('fenced');
 });
 it('other companies never read; same-owner48/46/47 pending prevents UUID new',()=>{
  const storage=disk();storage.setItem('cobrapro:manutencao48:2:'+intent.sessionScope+':1002','private foreign data');assertNoOtherFinance53(storage,1,key53(scope));storage.setItem('cobrapro:calendario46:1:'+intent.sessionScope+':1002','old bytes');expect(()=>assertNoOtherFinance53(storage,1,key53(scope))).toThrow('Pendência');expect(storage.getItem('cobrapro:calendario46:1:'+intent.sessionScope+':1002')).toBe('old bytes');
 });
});
