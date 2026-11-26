import { conferirCotacao47,conferirResultado47,conferirRecovery47 } from '../shared/reparcelamento47';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { proposta51,intent51,quote51,closure51,projection51,canonical51,toRequest51,validarClosure51 } from '../shared/obrigacoes51';
import { cotar51,executar51,estado51,capacidade51,sessionScope51,checkSession51,type Client51 } from './services/obrigacoes51Rpc';
const base=fileURLToPath(new URL('../tests/composition-obrigacoes/proofs',import.meta.url));
const proof=JSON.parse(fs.readFileSync(base+'/settlement51-proof.json','utf8'));
const intent={...proof.r.request,idempotencyKey:proof.r.idempotencyKey,ownerId:1,sessionScope:'a'.repeat(64)};
function client(data:unknown,error:null|{code:string}=null){const calls:any[]=[];return {calls,adapter:{rpc:async(name,args)=>{calls.push({name,args});return {data,error};}} as Client51};}
test('Schemas51 refuse floating money, impossible dates, extras, implicit account/consent',()=>{
 assert.ok(proposta51.safeParse({acao:'quitar',contaCaixaId:1,valorRecebido:'0.01',reconhecoDinheiroReal:true}).success);
 for(const p of [{acao:'quitar',valorRecebido:'10.00',reconhecoDinheiroReal:true},{acao:'quitar',contaCaixaId:1,valorRecebido:10,reconhecoDinheiroReal:true},{acao:'quitar',contaCaixaId:1,valorRecebido:'10.005',reconhecoDinheiroReal:true},{acao:'editar',parcelaId:1},{acao:'editar',parcelaId:1,novaDataVencimento:'2027-02-29'},{acao:'cancelar',alvo:{tipo:'contrato'},reconhecoSemEstorno:false},{acao:'adicionar',valor:'10.00',dataVencimento:'2027-01-01',classificacao:'capital'}])assert.equal(proposta51.safeParse(p).success,false);
 assert.equal(intent51.safeParse({...intent,sessionScope:'',extra:true}).success,false);
});
test('Real PG51 quote/result parse and preserve selected destination/cents',()=>{
 assert.deepEqual(quote51.parse(proof.q),proof.q);assert.deepEqual(validarClosure51(proof.r,intent),proof.r);assert.equal(proof.r.resultado.contaDestinoId,intent.proposta.contaCaixaId);
 for(const patch of [{userId:2},{idempotencyKey:randomUUID()},{request:{...proof.r.request,motivo:'Outra intenção'}},{resultado:{...proof.r.resultado,contaDestinoId:2}},{resultado:{...proof.r.resultado,valorRecebido:'0.00'}},{resultado:{...proof.r.resultado,caixaPreservado:true}}])assert.throws(()=>validarClosure51({...proof.r,...patch},intent));
 assert.equal(closure51.safeParse({...proof.r,arbitrary:'x'}).success,false);
});
test('Canonical request includes account, excludes only session/owner/chave',()=>{
 const r=toRequest51(intent);assert.equal(r.proposta.contaCaixaId,1);assert.equal('ownerId' in r,false);assert.equal('idempotencyKey' in r,false);assert.equal(canonical51({b:1,a:{z:3,y:2}}),canonical51({a:{y:2,z:3},b:1}));assert.notEqual(canonical51(r),canonical51({...r,proposta:{...r.proposta,contaCaixaId:2}}));
});
test('Service51 exactly one RPC per execute; recovery exact UUID/request no APP loop',async()=>{
 const c=client(proof.r);assert.deepEqual(await executar51(c.adapter,1,intent),proof.r);assert.equal(c.calls.length,1);assert.equal(c.calls[0].name,'rpc_executar_obrigacoes51');assert.deepEqual(c.calls[0].args,{p_user_id:1,p_chave:intent.idempotencyKey,p_request:toRequest51(intent)});
 await executar51(c.adapter,1,intent,true);assert.equal(c.calls.length,2);assert.equal(c.calls[1].name,'rpc_conferir_obrigacoes51');assert.deepEqual(c.calls[1].args,c.calls[0].args);
 await assert.rejects(executar51(c.adapter,2,intent));assert.equal(c.calls.length,2);
});
test('Service51 null/network/incompatible proof retain ambiguity, no fallback',async()=>{
 for(const c of [client(null),client(proof.r,{code:'55000'}),client({...proof.r,userId:2})]){await assert.rejects(executar51(c.adapter,1,intent));assert.equal(c.calls.length,1);}
 let calls=0;await assert.rejects(executar51({rpc:async()=>{calls++;throw Error('timeout');}},1,intent));assert.equal(calls,1);
});
test('Quote binding51, capability witness51 and session ABA scope',async()=>{
 const qi={contratoId:proof.q.contratoId,proposta:proof.q.proposta,ownerId:1,sessionScope:intent.sessionScope};assert.deepEqual(await cotar51(client(proof.q).adapter,1,qi),proof.q);await assert.rejects(cotar51(client({...proof.q,contaDestinoId:2}).adapter,1,qi));
 assert.deepEqual(await capacidade51(client({versao:'obrigacoes51_v1',disponivel:true}).adapter),{versao:'obrigacoes51_v1',disponivel:true});await assert.rejects(capacidade51(client({versao:'obrigacoes51_v1',disponivel:false}).adapter));
 const a=sessionScope51(1,'app_session_id=token-a'),b=sessionScope51(1,'app_session_id=token-b');assert.notEqual(a,b);assert.throws(()=>checkSession51(1,b,{ownerId:1,sessionScope:a}));assert.throws(()=>sessionScope51(1,undefined));
});
test('Projection51 cancellation never fabricates payment or cash',()=>{
 const p=JSON.parse(fs.readFileSync(base+'/cancel51-proof.json','utf8')).projection;assert.deepEqual(projection51.parse(p),p);assert.ok(p.parcelas.some((x:any)=>x.statusObrigacao==='cancelada'&&x.obrigacaoAtual==='0.00'&&x.statusFinanceiroOriginal==='pendente'));
});

test('Replay47 A explicit receives real SQL v3 quote/result/recovery, v2 remains accepted',()=>{const p=JSON.parse(fs.readFileSync(base+'/cross46-48-47-proof.json','utf8'));assert.deepEqual(conferirCotacao47(p.q47,1,p.q47.request),p.q47);const intent={...p.request47,idempotencyKey:p.key47};assert.deepEqual(conferirResultado47(p.r47,1,intent),p.r47);assert.equal(conferirRecovery47(p.recovery47,1,intent).status,'confirmed');assert.throws(()=>conferirCotacao47({...p.q47,regra:'reparcelamento47_cotacao_v2'},1,p.q47.request));});
