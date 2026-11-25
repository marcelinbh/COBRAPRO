import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
export async function runtime({sql,rpc,reject,scenario,randomUUID,assert,save,functions,seals,financial,verify,result,db,config,repo}){
 const prod=JSON.parse(readFileSync(repo+'/tests/calendario46/physical-frozen.json','utf8'))[0];
 const sha=s=>createHash('sha256').update(s).digest('hex');
 assert.equal(sha(readFileSync(repo+'/tests/calendario46/physical-frozen.json','utf8')),'863f6fa11a924c5aa384ef07bb1fe5640a49179c7f39d3f6a2bd077096d245b9');
 const target=readFileSync(repo+'/drizzle/0046_calendario25_governado.sql','utf8');
 const days=async(n,first='2030-01-28')=>(await sql("SELECT array_agg(($1::date+make_interval(months=>i))::date::text ORDER BY i) d FROM generate_series(0,$2::int-1) i",[first,n]))[0].d;
 const today=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d"))[0].d;
 const create=async(n=2,taxa='0.01')=>rpc('public.rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','100.01',taxa,n,today,today,await days(n),null,null,'2.0000','0.0330']);
 const state=cid=>rpc('public.multimodal_validar',[1,cid]);
 const cash=async()=>JSON.stringify((await sql("SELECT jsonb_build_object('a',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t)) c"))[0].c);
 const service=async(fn)=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 await scenario('Frozen233 sources/config/secdef/service ACL before DDL46 +72 private ACL rows',async()=>{
  for(const f of prod.functions){const p=(await sql('SELECT prosrc,proconfig,prosecdef,has_function_privilege(\'service_role\',oid,\'EXECUTE\') service FROM pg_proc WHERE oid=to_regprocedure($1)',[f.signature]))[0];assert.ok(p);assert.equal(sha(p.prosrc),f.sha256,f.signature);assert.deepEqual(p.proconfig,f.config);assert.equal(p.prosecdef,f.secdef);assert.equal(p.service,f.service_exec);}
  for(const p of prod.private_access){const a=(await sql("SELECT c.relrowsecurity rls,c.relforcerowsecurity force_rls,(SELECT count(*)::int FROM pg_policy WHERE polrelid=c.oid) policies,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon_crud,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') authenticated_crud,has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') service_crud FROM pg_class c WHERE c.oid=to_regclass($1)",[p.relation]))[0];for(const k of Object.keys(a))assert.equal(a[k],p[k],p.relation);}
  save('frozen-source-proof.json',{functions:233,privateACL:72,sourceSHA256:sha(readFileSync(repo+'/tests/calendario46/physical-frozen.json','utf8'))});
 });
 if(process.env.WITH49==='1'){
  const sql49=readFileSync(repo+'/tests/calendario46/optional49-strict-final.sql','utf8');assert.equal(sha(sql49),'6b44cc2b28565147605f4183154e42205953b1faee86f35fec9eec22975601bb');
  const f=await financial();await sql(sql49);assert.equal(await financial(),f);await verify();await rpc('despesas49.verificar');save('49-composition-before46-functions.json',await functions());save('49-composition-before46-seals.json',await seals());console.log('PASS optional49 STRICTfinal pinned installed before46');
 }
 // Real completed journals before migration prove installation preserves old data, not just empty relations.
 const old=await create(2); const oldState=await state(old.id);
 const oldJournal=await sql('SELECT id,user_id,family,chave,request,payload,hash_payload,resultado,auditoria,concluida_em,created_at FROM multimodal_operacoes ORDER BY id');
 const bf=await functions(),bs=await seals(),fin=await financial();save('46-before-functions.json',bf);save('46-before-seals.json',bs);save('46-before-financial.json',JSON.parse(fin));
 await scenario('Governed46 unknown source BEFORE pin refuses without reseal/data delta',async()=>{
  await sql('BEGIN');await sql("ALTER FUNCTION public.multimodal_payload(integer,text,jsonb) SET search_path=public");await reject(()=>sql(target),'55000');await sql('ROLLBACK');assert.deepEqual(await functions(),bf);assert.deepEqual(await seals(),bs);assert.equal(await financial(),fin);
 });
 await scenario('Governed46 tampered new function AFTER pin refuses and rolls back',async()=>{
  const bad=target.replace(" RAISE EXCEPTION '46 stale quote'"," RAISE EXCEPTION '46 tampered quote'");assert.notEqual(bad,target);await reject(()=>sql(bad),'55000');await sql('ROLLBACK');assert.deepEqual(await functions(),bf);assert.deepEqual(await seals(),bs);assert.equal(await financial(),fin);
 });
 await scenario('Install46 only two function deltas +2 family CHECKs; zero old journals/financial delta',async()=>{
  await sql(target);await verify();await rpc('calendario46.verificar');assert.equal(await financial(),fin);assert.deepEqual(await state(old.id),oldState);assert.deepEqual(await sql('SELECT id,user_id,family,chave,request,payload,hash_payload,resultado,auditoria,concluida_em,created_at FROM multimodal_operacoes ORDER BY id'),oldJournal);
  const af=await functions();const changes=bf.filter(b=>JSON.stringify(b)!==JSON.stringify(af.find(a=>a.oid===b.oid))).map(f=>f.nspname+'.'+f.proname);assert.deepEqual(changes.sort(),['public.multimodal_barreira','public.multimodal_payload']);save('46-after-functions.json',af);save('46-after-seals.json',await seals());save('46-after-financial.json',JSON.parse(await financial()));save('46-deltafunctions.json',changes);
 });
 const postFuncs=await functions(),postSeals=await seals();
 await scenario('Calendar genuine standard25 monthly1..60; same35origin, zero values/cash/count, append immutable audit',async()=>{
  const witnesses=[];
  for(let n=1;n<=60;n++){
   const c=await create(n),before=await state(c.id),beforeCash=await cash();
   const creation=(await sql('SELECT to_jsonb(o) o FROM multimodal_operacoes o WHERE id=$1',[before.origem.operacao_id]))[0].o;
   const q=await service(()=>rpc('public.rpc_cotar_calendario46',[1,c.id]));
   const req=[1,randomUUID(),c.id,q.estadoHash,await days(n,'2030-02-28'),'Manutenção mensal real25'];
   const r=await service(()=>rpc('public.rpc_executar_calendario46',req));assert.equal(r.success,true);
   const after=await state(c.id);assert.equal(await cash(),beforeCash);assert.deepEqual(after.origem,before.origem);assert.deepEqual(after.ledger,before.ledger);assert.deepEqual(after.renovacoes,before.renovacoes);
   const stripC=c=>Object.fromEntries(Object.entries(c).filter(([k])=>!['data_vencimento_primeira','data_vencimento','dia_vencimento','updatedAt'].includes(k)));
   const stripP=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['data_vencimento','updatedAt'].includes(k)));
   assert.deepEqual(stripC(after.contrato),stripC(before.contrato));assert.deepEqual(after.parcelas.map(stripP),before.parcelas.map(stripP));assert.deepEqual(after.historico.slice(0,-1),before.historico);assert.equal(after.historico.at(-1).tipo,'edicao_calendario');
   assert.deepEqual((await sql('SELECT to_jsonb(o) o FROM multimodal_operacoes o WHERE id=$1',[before.origem.operacao_id]))[0].o,creation);
   assert.equal((await service(()=>rpc('public.rpc_executar_calendario46',req))).repetida,true);assert.equal((await service(()=>rpc('public.rpc_conferir_calendario46',req))).status,'confirmed');
   const journals=await sql('SELECT family,auditoria,payload,hash_payload FROM multimodal_operacoes WHERE id=$1',[r.operationId]);assert.equal(journals[0].family,'multimodal_calendario46');assert.deepEqual(journals[0].auditoria.antes,before);assert.deepEqual(journals[0].auditoria.depois,after);assert.equal(journals[0].auditoria.extra.origemOperacao,before.origem.operacao_id);
   const counts=(await sql('SELECT (SELECT count(*)::int FROM emprestimos_rpc_origens WHERE contrato_id=$1) origin21,(SELECT count(*)::int FROM multimodal_origens WHERE contrato_id=$1) origin25',[c.id]))[0];assert.deepEqual(counts,{origin21:0,origin25:1});witnesses.push({n,cid:c.id,operationId:r.operationId,originId:after.origem.operacao_id,...counts,unchangedCash:true,unchangedValues:true,creationUnchanged:true});
  }
  save('monthly25-1-60.json',witnesses);
 });
 await scenario('Real21 identified separately; calendar44 kept byte-exact working',async()=>{
  const c=await rpc('public.rpc_criar_emprestimo',[1,randomUUID(),1,1,'mensal','mensal','100.01','0.01',2,today,today,await days(2),null,null]);const q=await service(()=>rpc('public.rpc_cotar_calendario46',[1,c.id]));const before=await cash();const r=await service(async()=>rpc('public.rpc_executar_calendario46',[1,randomUUID(),c.id,q.estadoHash,await days(2,'2031-01-28'),'Origem21 verdadeira']));assert.equal(r.success,true);assert.equal(await cash(),before);assert.equal((await rpc('public.legados_identificar_trilho',[1,c.id,c.parcelasIds[0]])).trilho,'prospectivo');save('origin21-witness.json',{cid:c.id,result:r});
 });
 const c=await create(2),q=await rpc('public.rpc_cotar_calendario46',[1,c.id]);
 await scenario('Invalid owner/date/day/count/unchanged/stale/payload; direct physical and old audit writes blocked',async()=>{
  const before=await financial();await service(()=>reject(()=>rpc('public.rpc_cotar_calendario46',[2,c.id]),'42501'));
  for(const [hash,d,code] of [[q.estadoHash,q.vencimentos,'22023'],['a'.repeat(64),await days(2,'2031-01-28'),'40001'],[q.estadoHash,['2031-01-31','2031-02-28'],'22023'],[q.estadoHash,[today],'22023']])await reject(()=>rpc('public.rpc_executar_calendario46',[1,randomUUID(),c.id,hash,d,'Negativo46 real']),code);
  await reject(()=>sql('UPDATE parcelas SET data_vencimento=data_vencimento+1 WHERE id=$1',[c.parcelasIds[0]]),'42501');await reject(()=>sql("UPDATE multimodal_operacoes SET auditoria='{}' WHERE id=(SELECT operacao_id FROM multimodal_origens WHERE contrato_id=$1)",[c.id]),'42501');assert.equal(await financial(),before);
  const req=[1,randomUUID(),c.id,q.estadoHash,await days(2,'2031-01-28'),'Replay exato46'];await rpc('public.rpc_executar_calendario46',req);await reject(()=>rpc('public.rpc_executar_calendario46',[...req.slice(0,5),'Outro motivo46']),'23505');
 });
 await scenario('Durable fence same UUID lock blocks delayed execution and changed payload',async()=>{
  const q=await rpc('public.rpc_cotar_calendario46',[1,c.id]);const req=[1,randomUUID(),c.id,q.estadoHash,await days(2,'2032-01-28'),'Fence exato46'];const before=await financial();const r=await service(()=>rpc('public.rpc_conferir_calendario46',req));assert.equal(r.status,'fenced');await service(()=>reject(()=>rpc('public.rpc_executar_calendario46',req),'23514'));await reject(()=>rpc('public.rpc_conferir_calendario46',[...req.slice(0,5),'Divergência fence']),'23505');assert.equal(await financial(),before);save('fence-witness.json',{req,r});
 });
 const client=async()=>{const c=new pg.Client(config);await c.connect();await c.query("SET ROLE service_role; SET statement_timeout='20s'");return c;};
 const call=(d,n,args)=>d.query(`SELECT public.${n}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args).then(r=>r.rows[0].r);
 await scenario('Concurrent same UUID commits exactly once;2 UUIDs same quote one40001',async()=>{
  const c=await create(2),q=await rpc('public.rpc_cotar_calendario46',[1,c.id]);const req=[1,randomUUID(),c.id,q.estadoHash,await days(2,'2031-01-28'),'Race real46'];const a=await client(),b=await client();try{
   const rs=await Promise.all([call(a,'rpc_executar_calendario46',req),call(b,'rpc_executar_calendario46',req)]);assert.equal(rs.filter(x=>x.repetida).length,1);
   const q2=await rpc('public.rpc_cotar_calendario46',[1,c.id]);const req2=[1,randomUUID(),c.id,q2.estadoHash,await days(2,'2032-01-28'),'Race2 real46'];const rs2=await Promise.allSettled([call(a,'rpc_executar_calendario46',req2),call(b,'rpc_executar_calendario46',[1,randomUUID(),...req2.slice(2)])]);assert.equal(rs2.filter(x=>x.status==='fulfilled').length,1);assert.equal(rs2.find(x=>x.status==='rejected').reason.code,'40001');
  }finally{await a.end();await b.end();}
 });
 await scenario('Recovery waits same UUID until committed writer; not false absence fence',async()=>{
  const c=await create(1),q=await rpc('public.rpc_cotar_calendario46',[1,c.id]);const req=[1,randomUUID(),c.id,q.estadoHash,await days(1,'2031-01-28'),'Recovery race46'];const a=await client(),b=await client();try{
   await a.query('BEGIN');await call(a,'rpc_executar_calendario46',req);let done=false;const pending=call(b,'rpc_conferir_calendario46',req).then(r=>{done=true;return r;});await new Promise(r=>setTimeout(r,100));assert.equal(done,false);await a.query('COMMIT');assert.equal((await pending).status,'confirmed');
  }finally{await a.end();await b.end();}
 });
 await scenario('Calendar25 -> real receipt25 existing quote stale, new quote/write validates and keeps calendar audit',async()=>{
  const c=await create(2),beforeQ=await rpc('public.rpc_cotar_emprestimo_multimodal',[1,c.id,c.parcelasIds[0]]),q=await rpc('public.rpc_cotar_calendario46',[1,c.id]);const r=await rpc('public.rpc_executar_calendario46',[1,randomUUID(),c.id,q.estadoHash,await days(2,'2031-01-28'),'Calendar before receipt']);
  const audit=(await sql('SELECT auditoria FROM multimodal_operacoes WHERE id=$1',[r.operationId]))[0].auditoria;
  await reject(()=>rpc('public.rpc_receber_emprestimo_multimodal',[1,randomUUID(),c.id,c.parcelasIds[0],beforeQ.totalExigido,beforeQ.totalExigido,beforeQ.dataPagamento,beforeQ.estadoHash,'integral',null]),'40001');
  const nq=await rpc('public.rpc_cotar_emprestimo_multimodal',[1,c.id,c.parcelasIds[0]]);const received=await service(()=>rpc('public.rpc_receber_emprestimo_multimodal',[1,randomUUID(),c.id,c.parcelasIds[0],nq.totalExigido,nq.totalExigido,nq.dataPagamento,nq.estadoHash,'integral',null]));assert.equal(received.status,'paga');const st=await state(c.id);assert.equal(st.parcelas[0].status,'paga');assert.equal(st.ledger.at(-1).categoria,'pagamento_parcela');assert.deepEqual((await sql('SELECT auditoria FROM multimodal_operacoes WHERE id=$1',[r.operationId]))[0].auditoria,audit);await reject(()=>rpc('public.rpc_cotar_calendario46',[1,c.id]),'23514');save('receipt-after-calendar.json',{calendar:r,quote:nq,receipt:received,state:st});
 });
 await scenario('Calendar25 -> renewal25 actual anchored next period succeeds; calendar audit unchanged',async()=>{
  const c=await create(1,'10.00'),q=await rpc('public.rpc_cotar_calendario46',[1,c.id]);const r=await rpc('public.rpc_executar_calendario46',[1,randomUUID(),c.id,q.estadoHash,['2031-02-28'],'Calendar before renewal']);const st=await state(c.id);const audit=(await sql('SELECT auditoria FROM multimodal_operacoes WHERE id=$1',[r.operationId]))[0].auditoria;
  const nq=await service(()=>rpc('public.rpc_cotar_renovacao_multimodal',[1,c.id,c.parcelasIds[0],'2031-03-28']));assert.equal(nq.renovavel,true);const renewed=await service(()=>rpc('public.rpc_renovar_emprestimo_multimodal',[1,randomUUID(),c.id,c.parcelasIds[0],nq.totalExigido,nq.totalExigido,nq.dataPagamento,nq.estadoHash,'2031-03-28',null]));assert.equal(renewed.status,'renovada');const final=await state(c.id);assert.equal(final.origem.operacao_id,st.origem.operacao_id);assert.equal(final.renovacoes.length,1);assert.deepEqual((await sql('SELECT auditoria FROM multimodal_operacoes WHERE id=$1',[r.operationId]))[0].auditoria,audit);await reject(()=>rpc('public.rpc_cotar_calendario46',[1,c.id]),'23514');save('renewal-after-calendar.json',{calendar:r,quote:nq,renewal:renewed,state:final});
 });
 await scenario('Concurrent calendar25 x receipt/renewal25 physical lock: one winner, no false financial operation',async()=>{
  const witnesses=[];
  for(const kind of ['receipt','renewal']){
   const c=await create(1,'10.00'),q=await rpc('public.rpc_cotar_calendario46',[1,c.id]);
   const fq=kind==='receipt'?await rpc('public.rpc_cotar_emprestimo_multimodal',[1,c.id,c.parcelasIds[0]]):await rpc('public.rpc_cotar_renovacao_multimodal',[1,c.id,c.parcelasIds[0],'2030-02-28']);
   const a=await client(),b=await client();try{
    const calendar=[1,randomUUID(),c.id,q.estadoHash,['2031-01-28'],'Calendar financial race46'];
    const finance=[1,randomUUID(),c.id,c.parcelasIds[0],fq.totalExigido,fq.totalExigido,fq.dataPagamento,fq.estadoHash,kind==='receipt'?'integral':'2030-02-28',null];
    const rr=await Promise.allSettled([call(a,'rpc_executar_calendario46',calendar),call(b,kind==='receipt'?'rpc_receber_emprestimo_multimodal':'rpc_renovar_emprestimo_multimodal',finance)]);
    assert.equal(rr.filter(x=>x.status==='fulfilled').length,1);assert.ok(['23514','40001'].includes(rr.find(x=>x.status==='rejected').reason.code));await state(c.id);
    const ops=await sql("SELECT family FROM multimodal_operacoes WHERE user_id=1 AND (payload->>'contratoId')::int=$1 AND resultado IS NOT NULL",[c.id]);assert.equal(ops.length,1);witnesses.push({kind,cid:c.id,committed:ops[0].family,rejected:rr.find(x=>x.status==='rejected').reason.code});
   }finally{await a.end();await b.end();}
  }save('calendar-financial-races.json',witnesses);
 });
 await scenario('Runtime no reseal/source drift, no caps, closedACL and PG17 roles; drift rejected not adopted',async()=>{
  await verify();await rpc('calendario46.verificar');assert.deepEqual(await functions(),postFuncs);assert.deepEqual(await seals(),postSeals);
  const residue=(await sql('SELECT (SELECT count(*)::int FROM ciclo_autorizacoes) c,(SELECT count(*)::int FROM multimodal_autorizacoes) m,(SELECT count(*)::int FROM multa36_capacidades) mu,(SELECT count(*)::int FROM cheques40_operacoes) cheques'))[0];assert.deepEqual(residue,{c:0,m:0,mu:0,cheques:0});
  const roles=await sql("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN('postgres','service_role','anon','authenticated') ORDER BY rolname");assert.ok(roles.every(x=>!x.rolsuper&&!x.rolbypassrls));save('roles46v2.json',roles);
  await sql('BEGIN');await sql("ALTER FUNCTION calendario46.validar(integer,integer) SET search_path=public");await reject(()=>rpc('public.rpc_cotar_calendario46',[1,c.id]),'55000');await sql('ROLLBACK');assert.deepEqual(await functions(),postFuncs);assert.deepEqual(await seals(),postSeals);
  await service(()=>reject(()=>rpc('public.multimodal_escrever',[randomUUID(),'parcelas',null,{}]),'42501'));save('runtime46v2-residue.json',residue);
 });
}
