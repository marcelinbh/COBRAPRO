import { it as test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projection51,quote51,result51 } from '../shared/obrigacoes51';
import { validarMetadados51,validarProjecao51 } from '../shared/obrigacoes51Projection';
import { estado51,type Client51 } from './services/obrigacoes51Rpc';
const proof=(name:string)=>JSON.parse(fs.readFileSync(new URL('../tests/composition-obrigacoes/proofs/'+name,import.meta.url),'utf8'));
const p=proof('statefix-large-proof.json');
const metadata=p.parcelas.map((x:any)=>({id:x.parcelaId,user_id:1,contrato_id:p.contratoId,cliente_id:1}));
test('SQL real512: schema de leitura e helper preservam conjunto completo acima60 e budget3000',()=>{
 assert.equal(p.parcelas.length,512);assert.deepEqual(projection51.parse(p),p);
 const ids=validarMetadados51(metadata,1,p.contratoId);assert.equal(ids.length,512);
 assert.deepEqual(validarProjecao51(p,1,p.contratoId,ids),p);
});
test('512: ainda recusa owner errado, metadados incompletos/duplicados, extras, divergências e accessors',()=>{
 const ids=metadata.map((x:any)=>x.id);
 assert.throws(()=>validarMetadados51([...metadata.slice(0,-1),{...metadata.at(-1),user_id:2}],1,p.contratoId));
 assert.throws(()=>validarMetadados51([...metadata,metadata[0]],1,p.contratoId));
 assert.throws(()=>validarProjecao51(p,1,p.contratoId,ids.slice(0,-1)));
 assert.throws(()=>validarProjecao51({...p,userId:2},1,p.contratoId,ids));
 assert.throws(()=>validarProjecao51({...p,parcelas:[...p.parcelas,p.parcelas[0]]},1,p.contratoId,ids));
 assert.throws(()=>validarProjecao51({...p,parcelas:p.parcelas.map((x:any,i:number)=>i?x:{...x,obrigacaoAtual:'0.00'})},1,p.contratoId,ids));
 assert.throws(()=>validarProjecao51({...p,extra:true},1,p.contratoId,ids));
 const trap={...p};Object.defineProperty(trap,'parcelas',{enumerable:true,get(){throw new Error('accessor executed');}});
 assert.throws(()=>validarProjecao51(trap,1,p.contratoId,ids),/incompleta ou divergente/);
});
test('Quote/result NOVOS writers mantêm max60, apenas projection tem leitura completa',()=>{
 const q=proof('settlement51-proof.json').q,r=proof('settlement51-proof.json').r.resultado;
 assert.equal(quote51.safeParse({...q,idsAfetados:Array.from({length:61},(_,i)=>i+1)}).success,false);
 assert.equal(result51.safeParse({...r,idsAfetados:Array.from({length:61},(_,i)=>i+1)}).success,false);
});
test('Facada de leitura aceita512 reais e falha fechado para módulo ausente, erro/null/timeout, nunca saldo0',async()=>{
 assert.deepEqual(await estado51({rpc:async()=>({data:p,error:null})} as Client51,1,p.contratoId),p);
 for(const response of [{data:null,error:null},{data:p,error:{code:'PGRST202'}},{data:p,error:{code:'55000'}},{data:{...p,userId:2},error:null}])await assert.rejects(estado51({rpc:async()=>response} as Client51,1,p.contratoId));
 await assert.rejects(estado51({rpc:async()=>{throw Error('timeout');}} as Client51,1,p.contratoId));
});
test('SQL real misto: irmã paga continua paga; parcial renunciada preserva físico/pagos/Caixa',()=>{
 const x=proof('statefix-mixed-proof.json');assert.deepEqual(x.before,x.after);
 const paid=x.p.parcelas.find((r:any)=>r.statusFinanceiroOriginal==='paga');assert.equal(paid.statusObrigacao,'paga');assert.equal(paid.obrigacaoAtual,'0.00');
 const ids=validarMetadados51(x.p.parcelas.map((r:any)=>({id:r.parcelaId,user_id:1,contrato_id:x.p.contratoId,cliente_id:1})),1,x.p.contratoId);
 assert.deepEqual(validarProjecao51(x.p,1,x.p.contratoId,ids),x.p);
});
test('SQL real cheques e successors43/47 parse sem habilitar novos writers',()=>{
 for(const p of [proof('statefix-cheque-proof.json'),proof('statefix-chain43-proof.json').successor,proof('statefix-chain47-proof.json').successor]) {
  assert.deepEqual(projection51.parse(p),p);
  assert.deepEqual(validarProjecao51(p,1,p.contratoId,p.parcelas.map((r:any)=>r.parcelaId)),p);
 }
});
