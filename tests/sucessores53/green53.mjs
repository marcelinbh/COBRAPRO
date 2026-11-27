import fs from 'node:fs';
import pg from 'pg';
export async function scenarios({sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,candidate,chain,config}) {
 const service=async fn=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 const call=(name,args)=>service(()=>rpc('public.'+name,args));
 const cid=chain.r.contratoId,pid=chain.r.parcelasIds[0];
 const ddl=fs.readFileSync(candidate+'/drizzle/0053_sucessores_financeiros.sql','utf8');
 await scenario('53 install preflight drift rejects and rollback has no DDL/financial residue',async()=>{
  const before=await financial();await sql('BEGIN');await sql('ALTER FUNCTION private47.validar(integer,integer) SET search_path=public');await reject(()=>sql(ddl),'55000');await sql('ROLLBACK');assert.equal((await sql("SELECT to_regnamespace('sucessores53') x LIMIT 1"))[0].x,null);assert.deepEqual(await financial(),before);
 });
 await scenario('53 installation on51 has no financial DML, one-shot and static new-body pin',async()=>{
  const before=await financial();const bad=ddl.replace("SELECT encode(extensions.digest(j::text,'sha256'),'hex') $$;",()=>"SELECT encode(extensions.digest(j::text,'sha256'),'hex') /*tamper53*/ $$;");assert.notEqual(bad,ddl);await reject(()=>sql(bad),'55000');await sql('ROLLBACK');assert.equal((await sql("SELECT to_regnamespace('sucessores53') x LIMIT 1"))[0].x,null);
  await sql(ddl);assert.deepEqual(await financial(),before);await verify();await rpc('sucessores53.verificar');await reject(()=>sql(ddl),'55000');await sql('ROLLBACK');
 });
 const quote=(v,uid=1)=>call('rpc_cotar_sucessores53',[uid,cid,{versao:'sucessores53_editar_v1',acao:'editar',parcelaId:pid,...v}]);
 const req=q=>({contratoId:cid,proposta:q.proposta,estadoHash:q.estadoHash,dataCalculo:q.dataCalculo,motivo:'Manutenção sintética53'});
 const execute=(q,key=randomUUID())=>call('rpc_executar_sucessores53',[1,key,req(q)]);
 await scenario('53 global P/Jt/A/B/Jn proof, no false individual capital attribution',async()=>{
  const state=await call('rpc_estado_sucessores53',[1,cid]);assert.equal(state.P,'300.00');assert.equal(state.Jt,'90.00');assert.equal(state.A,'175.35');assert.equal(state.B,'565.35');assert.equal(state.Jn,'56.54');assert.ok(state.parcelas.every(p=>p.P===null&&p.Jt===null&&p.A===null&&p.U===null));save('composition53-proof.json',state);
 });
 let qDates,datesKey,closure;
 await scenario('53 real dates vertical changes only target date plus derived summaries/history, no Caixa/ancestral',async()=>{
  const b=await financial(),before=await rpc('public.multimodal_snapshot',[cid]);qDates=await quote({novaDataVencimento:'2027-09-11'});datesKey=randomUUID();closure=await execute(qDates,datesKey);const after=await rpc('public.multimodal_snapshot',[cid]);
  assert.deepEqual(after.ledger,before.ledger);assert.deepEqual(after.parcelas.filter(p=>p.id!==pid),before.parcelas.filter(p=>p.id!==pid));const bp=before.parcelas.find(p=>p.id===pid),ap=after.parcelas.find(p=>p.id===pid);assert.equal(ap.data_vencimento,'2027-09-11');for(const k of Object.keys(bp))if(!['data_vencimento','updatedAt'].includes(k))assert.deepEqual(ap[k],bp[k],k);
  const a=await financial();assert.deepEqual(a.contas,b.contas);assert.deepEqual(a.ledger,b.ledger);assert.deepEqual(a.contratos.filter(c=>c.id!==cid),b.contratos.filter(c=>c.id!==cid));assert.deepEqual(a.parcelas.filter(p=>p.contrato_id!==cid),b.parcelas.filter(p=>p.contrato_id!==cid));assert.deepEqual(await execute(qDates,datesKey),closure);assert.deepEqual(await call('rpc_conferir_sucessores53',[1,datesKey,req(qDates)]),closure);await rpc('private47.validar',[1,cid]);save('dates53-proof.json',{qDates,closure,before,after,ancestralAndCashPreserved:true});
 });
 await scenario('53 UUID request mismatch, stale dates, no-op, neighbors, date parser and owner refusal no DML',async()=>{
  const b=await financial();await reject(()=>call('rpc_executar_sucessores53',[1,datesKey,{...req(qDates),motivo:'Outro pedido'}]),'23505');await reject(()=>execute(qDates),'40001');await reject(()=>quote({novaDataVencimento:'2027-09-11'}),'22023');await reject(()=>quote({novaDataVencimento:'2027-10-10'}),'22023');await reject(()=>quote({novaDataVencimento:'2027-02-29'}),'22008');await reject(()=>quote({novaDataVencimento:'2027-09-12'},2),'42501');await reject(()=>quote({novoValor:'130.001'}),'22023');await reject(()=>quote({novoValor:'282.67'}),'22023');assert.deepEqual(await financial(),b);
 });
 await scenario('53 value+date atomic preserves Bi and A/P/Jt, changes Jn only, SQL rollback exact',async()=>{
  const q=await quote({novoValor:'320.00',novaDataVencimento:'2027-09-12'});const b=await financial();await sql('BEGIN');await execute(q);await sql('ROLLBACK');assert.deepEqual(await financial(),b);
  const before=await rpc('public.multimodal_snapshot',[cid]),r=await execute(q),after=await rpc('public.multimodal_snapshot',[cid]);const bp=before.parcelas.find(p=>p.id===pid),ap=after.parcelas.find(p=>p.id===pid);assert.equal(ap.valor_original,320);assert.equal(ap.valor_juros,37.32);assert.equal(ap.valor_original-ap.valor_juros,bp.valor_original-bp.valor_juros);assert.deepEqual(after.ledger,before.ledger);const state=await call('rpc_estado_sucessores53',[1,cid]);assert.equal(state.B,'565.35');assert.equal(state.A,'175.35');assert.equal(state.Jn,'65.59');save('value53-proof.json',{q,r,before,after,state});
 });
 await scenario('53 durable fence wins late POST without eligibility recotation; no financial DML',async()=>{
  const q=await quote({novaDataVencimento:'2027-09-13'}),key=randomUUID(),b=await financial();const f=await call('rpc_conferir_sucessores53',[1,key,req(q)]);assert.equal(f.status,'fenced');await reject(()=>execute(q,key),'23514');assert.deepEqual(await call('rpc_conferir_sucessores53',[1,key,req(q)]),f);assert.deepEqual(await financial(),b);save('fence53-proof.json',{q,key,f});
 });
 await scenario('53 concurrent same UUID returns one exact closure on real two SQL connections',async()=>{
  const q=await quote({novaDataVencimento:'2027-09-13'}),key=randomUUID();const c=new pg.Client(config);await c.connect();await c.query('SET ROLE service_role');try{const [a,b]=await Promise.all([execute(q,key),c.query('SELECT public.rpc_executar_sucessores53($1,$2,$3) r',[1,key,req(q)])]);assert.deepEqual(a,b.rows[0].r);assert.equal((await sql('SELECT count(*)::int n FROM sucessores53.operacoes WHERE user_id=1 AND chave=$1 LIMIT 1',[key]))[0].n,1);}finally{await c.end();}
 });
 await scenario('53 actual maintenance followed by real receipt35 and complete replay; historical47 recovery intact',async()=>{
  const before=await financial();const q=await call('rpc_cotar_emprestimo_multimodal',[1,cid,pid]);const r=await call('rpc_receber_emprestimo_multimodal',[1,randomUUID(),cid,pid,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,'integral',null]);const state=await call('rpc_estado_sucessores53',[1,cid]);assert.equal(state.saldoPorComponenteDisponivel,false);assert.equal(state.manutencaoDisponivel,false);assert.equal(state.A,'175.35');await rpc('sucessores53.replay',[1,cid,await rpc('public.multimodal_snapshot',[cid])]);await reject(()=>quote({novaDataVencimento:'2027-09-14'}),'0A000');const rec=await call('rpc_reconciliar_reparcelamento47',[1,chain.key47,chain.request47]);assert.equal(rec.status,'confirmed');assert.equal(rec.proof,'uuid_fenced47_v2');assert.equal(rec.userId,1);assert.equal(rec.idempotencyKey,chain.key47);assert.deepEqual(rec.request,chain.request47);assert.equal(rec.operationId,chain.r.operationId);assert.deepEqual(rec.result,chain.r);assert.equal(Object.hasOwn(rec,'resultado'),false);const after=await financial();assert.equal(after.ledger.length,before.ledger.length+1);save('receipt35-after53-proof.json',{q,r,state,rec});
 });
 await scenario('53 service ACL, direct DML and immutable old/new journals fail closed',async()=>{
  const b=await financial();await service(()=>reject(()=>sql('SELECT id FROM sucessores53.operacoes LIMIT 1'),'42501'));await reject(()=>sql('UPDATE parcelas SET data_vencimento=data_vencimento+1 WHERE id=$1',[pid]),'42501');await reject(()=>sql('DELETE FROM sucessores53.operacoes WHERE contrato_id=$1',[cid]),'42501');await reject(()=>sql('TRUNCATE sucessores53.fences'),'42501');assert.deepEqual(await financial(),b);await verify();await rpc('sucessores53.verificar');
 });
}
