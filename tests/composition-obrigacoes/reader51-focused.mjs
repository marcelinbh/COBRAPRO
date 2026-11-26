import { listarEmprestimosSeguros as candidateList } from '../../server/services/emprestimosListaSegura.ts';
import { listarEmprestimosSeguros as originalList } from '/home/ubuntu/cobrapro-unlock-2611/r2-reader-hotfix/baseline/server/services/emprestimosListaSegura.ts';
import { source51Test } from '../../server/services/projection51TestSource.ts';
import pg from 'pg';
export async function focused({sql,rpc,reject,scenario,assert,save,financial,verify,result,config}) {
 const state=(cid,uid=1)=>rpc('public.rpc_estado_obrigacoes51',[uid,cid]);
 const before=await financial();
 const writers=await sql("SELECT n.nspname,p.proname,p.prosrc,p.proconfig,p.prosecdef,p.proacl,pg_get_userbyid(p.proowner) owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='obrigacoes51' AND p.proname IN('vinculos','travar','base','verificar','validar_leitura','registrada_leitura')) OR (n.nspname='public' AND p.proname IN('legados_travar','legados_validar','legados_snapshot')) ORDER BY n.nspname,p.proname LIMIT 20");
 await scenario('RED SQL0051 own null origem genuine historical paid+null aliases refusal42501',async()=>{
  const e=await reject(()=>state(970),'42501'); assert.equal(e.message,'51 vínculos próprios completos obrigatórios; sem saneamento');
  save('SQL-RED-null-origin.json',{code:e.code,message:e.message,where:e.where,scope:'real SQL0051 intact on synthetic historical fixture before seals'});
  await reject(()=>state(971),'42501'); assert.deepEqual(await financial(),before);
 });
 await scenario('RED SQL0051 null paid is ambiguous independently of null origem, no zero assumption',async()=>{
  const e=await reject(()=>state(973),'23514');assert.equal(e.message,'51 valores registrados inválidos');
  for(const cid of [970,973]) {
   const p=(await sql('SELECT to_jsonb(p) row FROM public.parcelas p WHERE contrato_id=$1 AND valor_pago IS NULL ORDER BY id LIMIT 3',[cid]))[0].row;
   await reject(()=>rpc('obrigacoes51.registrada_leitura',[p]),'23514');
  }
  assert.deepEqual(await financial(),before);save('SQL-RED-null-paid.json',{code:e.code,message:e.message});
 });
 await scenario('GREEN SQL original own control valid obligation100 and original capability/verifier',async()=>{
  const p=await state(972);assert.ok(p.parcelas.every(p=>p.obrigacaoAtual==='50.00'));assert.equal(p.statusObrigacao,'ativo');
  assert.deepEqual(await rpc('public.rpc_capacidade_obrigacoes51'),{versao:'obrigacoes51_v1',disponivel:true});await verify();await rpc('obrigacoes51.verificar');
  save('SQL-GREEN-control.json',p);
 });
 await scenario('GREEN writers null origin remain42501; no financial relaxation',async()=>{
  for(const cid of [970,971]) for(const f of ['vinculos','travar','base'])await reject(()=>rpc('obrigacoes51.'+f,[1,cid]),'42501');
  await reject(()=>rpc('public.legados_travar',[1,970,null]),'42501');assert.deepEqual(await financial(),before);
 });
 const mutations={
  foreignparent:'UPDATE contratos SET user_id=2 WHERE id=972',
  foreignclient:'UPDATE contratos SET cliente_id=2 WHERE id=972',
  foreignparcelowner:'UPDATE parcelas SET user_id=2 WHERE id=972002',
  foreignparcelclient:'UPDATE parcelas SET cliente_id=2 WHERE id=972002',
  foreigncollector:'UPDATE contratos SET koletor_id=2 WHERE id=972',
  foreignparcelcollector:'UPDATE parcelas SET koletor_id=2 WHERE id=972002',
  foreigncashalias:'UPDATE parcelas SET conta_caixa_id=2 WHERE id=972002',
  foreignhistory:"INSERT INTO contrato_historico(user_id,contrato_id,tipo,descricao) VALUES('2',972,'criacao','Foreign fixture negative')",
  foreignledger:"INSERT INTO transacoes_caixa(user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor,descricao,data_transacao) VALUES(2,2,972,972002,'entrada','pagamento_parcela',50,'Foreign fixture negative','2027-02-01')",
 };
 for(const [name,q] of Object.entries(mutations))await scenario('GREEN absolute original SQL rejection '+name,async()=>{
  await sql('BEGIN');try{await sql(q);await reject(()=>state(972),'42501');}finally{await sql('ROLLBACK');}
  assert.deepEqual(await financial(),before);
 });
 await scenario('GREEN original legacy snapshot validation unchanged and drift refused',async()=>{
  await sql('BEGIN');try {
   await sql("INSERT INTO legados_estados(contrato_id,user_id,snapshot) VALUES(972,1,public.legados_snapshot(972))");
   await state(972);
   await sql("UPDATE legados_estados SET snapshot=snapshot||'{\"tampered\":true}'::jsonb WHERE contrato_id=972");
   await reject(()=>state(972),'23514');
  }finally{await sql('ROLLBACK');}assert.deepEqual(await financial(),before);
 });
 const client=new pg.Client(config);await client.connect();await client.query('SET ROLE service_role');
 let queue=Promise.resolve();
 const serviceQuery=(q,v)=>{const next=queue.then(()=>client.query(q,v));queue=next.catch(()=>{});return next;};
 try {
  const adapter=async(ids)=>{
   const f=source51Test();
   f.tables.contratos=await sql('SELECT id,user_id,cliente_id,koletor_id,modalidade,status,valor_principal FROM contratos WHERE id=ANY($1::int[]) ORDER BY id LIMIT 4',[ids]);
   f.tables.parcelas=await sql('SELECT id,user_id,contrato_id,cliente_id,numero_parcela,valor_original,valor_juros,valor_pago,valor_multa,multa_manual,saldo_residual,data_vencimento::text,data_pagamento::text,status FROM parcelas WHERE contrato_id=ANY($1::int[]) ORDER BY id LIMIT 10',[ids]);
   f.tables.clientes=await sql('SELECT id,user_id,nome FROM clientes WHERE id=1 LIMIT 1');f.tables.koletores=[];f.tables.configuracoes=[];
   const errors=[];
   return {...f,errors,rpc:async(name,args)=>{
    assert.equal(name,'rpc_estado_obrigacoes51');assert.equal(args.p_user_id,1);assert.ok(ids.includes(args.p_contrato_id));
    try{return {data:(await serviceQuery('SELECT public.rpc_estado_obrigacoes51($1,$2) r LIMIT 1',[args.p_user_id,args.p_contrato_id])).rows[0].r,error:null,status:200};}
    catch(e){errors.push({code:e.code,message:e.message,where:e.where});return {data:null,error:{code:e.code,message:e.message,details:e.detail??null,hint:e.hint??null},status:e.code==='42501'?403:400};}
   }};
  };
  await scenario('RED APP original real SQL42501 own history crashes entire valid list',async()=>{
   const f=await adapter([970,972]);await assert.rejects(()=>originalList(f,1,'2026-11-26'),e=>e.code==='PRECONDITION_FAILED');
   assert.equal(f.errors[0].code,'42501');save('APP-RED-real-sql.json',{status:'RED reproduced',errors:f.errors});
  });
  await scenario('GREEN APP same real SQL untouched own history placeholder plus control validated100',async()=>{
   const f=await adapter([970,972]),r=await candidateList(f,1,'2026-11-26');
   assert.deepEqual(r.items.map(x=>x.kind),['unavailable','validated']);assert.equal(r.items[0].id,970);
   assert.deepEqual(r.totals.values,{capital:100,totalReceber:100,totalPago:0});assert.equal(r.coverage.complete,false);assert.equal(r.coverage.unavailableContracts,1);
   assert.deepEqual(Object.keys(r.items[0]).sort(),['id','kind','message']);
   assert.ok(!f.calls.some(c=>/valor_original|valor_principal|nome/.test(c.fields)&&c.filters.some(([,v])=>Array.isArray(v)&&v.includes(970))));
   save('APP-GREEN-real-sql.json',{result:r,sqlErrors:f.errors,queries:f.calls});assert.deepEqual(await financial(),before);
  });
  await scenario('GREEN APP null monetary refusal not zero and all unavailable totalsnull',async()=>{
   const f=await adapter([973]),r=await candidateList(f,1,'2026-11-26');assert.equal(r.totals.values,null);assert.equal(r.items[0].kind,'unavailable');assert.equal(f.errors[0].code,'23514');
   save('APP-GREEN-null-paid.json',{result:r,sqlErrors:f.errors});assert.deepEqual(await financial(),before);
  });
 }finally{await client.end();}
 await scenario('GREEN byte-exact writers+locks+snapshots+verifier and zero DML financial/history across entire harness',async()=>{
  const after=await sql("SELECT n.nspname,p.proname,p.prosrc,p.proconfig,p.prosecdef,p.proacl,pg_get_userbyid(p.proowner) owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='obrigacoes51' AND p.proname IN('vinculos','travar','base','verificar','validar_leitura','registrada_leitura')) OR (n.nspname='public' AND p.proname IN('legados_travar','legados_validar','legados_snapshot')) ORDER BY n.nspname,p.proname LIMIT 20");
  assert.deepEqual(after,writers);assert.deepEqual(await financial(),before);await verify();await rpc('obrigacoes51.verificar');
  save('INVARIANTS.json',{writersBefore:writers,writersAfter:after,financialBefore:before,financialAfter:await financial()});
 });
 result.noFlags=true;result.noMigration52=true;result.productionAccess=false;
}
