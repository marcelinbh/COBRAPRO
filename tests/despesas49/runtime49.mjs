import {readFileSync} from 'node:fs';
import pg from 'pg';
export async function runtime({sql,rpc,reject,scenario,randomUUID,assert,save,functions,seals,financial,verify,result,config}){
 const cash=async()=>JSON.stringify((await sql("SELECT jsonb_build_object('a',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t)) c"))[0].c);
 const catalog=()=>sql(`WITH ns AS(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema'),rels AS(SELECT oid FROM pg_class WHERE relnamespace IN(SELECT oid FROM ns))
 SELECT 'class:'||oid k,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] v FROM pg_class c WHERE oid IN(SELECT oid FROM rels)
 UNION ALL SELECT 'attribute:'||attrelid||':'||attnum,to_jsonb(a) FROM pg_attribute a WHERE attrelid IN(SELECT oid FROM rels)
 UNION ALL SELECT 'constraint:'||oid,to_jsonb(c) FROM pg_constraint c WHERE connamespace IN(SELECT oid FROM ns)
 UNION ALL SELECT 'trigger:'||oid,to_jsonb(t) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM rels)
 UNION ALL SELECT 'default:'||oid,to_jsonb(d) FROM pg_attrdef d WHERE adrelid IN(SELECT oid FROM rels) ORDER BY k`);
 const beforeCatalog=await catalog();save('49-before-catalog.json',beforeCatalog);
 const beforeFunctions=await functions(),beforeSeals=await seals(),beforeFinance=await financial(),beforeCash=await cash();
 save('49-before-functions.json',beforeFunctions);save('49-before-seals.json',beforeSeals);save('49-before-finance.json',JSON.parse(beforeFinance));
 const migration=readFileSync(new URL('../../drizzle/0049_manutencao_despesas.sql',import.meta.url),'utf8');
 await scenario('49 instala exata pós45 com zero efeito financeiro; predecessores preservados',async()=>{
  const bad=migration.replace("BEGIN RAISE EXCEPTION '49 append-only'","BEGIN /* tampered49 */ RAISE EXCEPTION '49 append-only'");await reject(()=>sql(bad),'55000');await sql('ROLLBACK');assert.deepEqual(await functions(),beforeFunctions);assert.deepEqual(await seals(),beforeSeals);assert.equal(await financial(),beforeFinance);
  const badCatalog=[];
  for(const ddl of ['CREATE FUNCTION public.unknown49() RETURNS integer LANGUAGE sql AS $$ SELECT 49 $$', 'GRANT EXECUTE ON FUNCTION public.rpc_pagar_despesa_prospectiva(integer,integer,integer,date,uuid) TO service_role WITH GRANT OPTION']){
   await sql('BEGIN');await sql(ddl);const e=await reject(()=>sql(migration),'55000');await sql('ROLLBACK');badCatalog.push({ddl,code:e.code,message:e.message});assert.deepEqual(await functions(),beforeFunctions);assert.deepEqual(await seals(),beforeSeals);
  }
  save('49-preflight-extra-acl-red.json',badCatalog);
  await sql(readFileSync(new URL('./preflight49.sql',import.meta.url),'utf8'));await sql(migration);await sql(readFileSync(new URL('./postflight49.sql',import.meta.url),'utf8'));const afterCatalog=await catalog();save('49-after-catalog.json',afterCatalog);assert.deepEqual(beforeCatalog,afterCatalog.filter(a=>beforeCatalog.some(b=>b.k===a.k)));assert.equal(await financial(),beforeFinance);const after=await functions();assert.deepEqual(beforeFunctions,after.filter(f=>beforeFunctions.some(b=>b.oid===f.oid)));
  const afterSeals=await seals();assert.equal(afterSeals[0].s34,beforeSeals[0].s34);assert.equal(afterSeals[0].s35,beforeSeals[0].s35);assert.equal(afterSeals[0].s36,beforeSeals[0].s36);
  save('49-after-functions.json',after);save('49-after-seals.json',afterSeals);save('49-after-finance.json',JSON.parse(await financial()));
 });
 const req=(q,extra={})=>({despesaId:q.despesaId,origemOperationId:q.origemOperationId,estadoHash:q.estadoHash,descricao:'Despesa editada offline',categoria:'internet',dataVencimento:'2030-02-28',observacoes:'Correção de cadastro',motivo:'Vencimento e categoria corrigidos',...extra});
 const expense=async(owner=1)=>rpc('rpc_criar_despesa_prospectiva',[owner,'Despesa49 real20','outros','9999999999999.99','2030-01-31',null,randomUUID()]);
 let original,quote,request,key,edited;
 await scenario('49 flag defaultOFF e quote owner física sem movimentos',async()=>{
  assert.equal((await rpc('rpc_capacidades_despesas49')).habilitado,false);original=await expense();quote=await rpc('rpc_cotar_edicao_despesa49',[1,original.despesaId]);request=req(quote);key=randomUUID();
  assert.equal(quote.valor,'9999999999999.99');assert.equal(quote.habilitado,false);await reject(()=>rpc('rpc_editar_despesa49',[1,key,request]),'55000');assert.equal(await cash(),beforeCash);
 });
 await scenario('49 edição sucessão20 preserva original/origem e valor exato, total aberto igual e Caixa zero',async()=>{
  await sql('SELECT despesas49.configurar(true)');await sql('SET ROLE service_role');edited=await rpc('rpc_editar_despesa49',[1,key,request]);await sql('RESET ROLE');
  assert.equal(edited.success,true);assert.equal(edited.valor,quote.valor);assert.notEqual(edited.sucessoraId,original.despesaId);
  const d=(await sql('SELECT to_jsonb(d) row FROM contas_pagar d WHERE id=$1',[original.despesaId]))[0].row;assert.equal(d.status,'cancelado');
  assert.equal((await sql('SELECT snapshot FROM despesas_rpc_origens WHERE despesa_id=$1',[original.despesaId]))[0].snapshot.status,'pendente');
  assert.equal((await sql("SELECT sum(valor)::text t FROM contas_pagar WHERE id IN($1,$2) AND status='pendente'",[original.despesaId,edited.sucessoraId]))[0].t,quote.valor);assert.equal(await cash(),beforeCash);
  save('49-success.json',{quote,request,key,edited,original});
 });
 await scenario('49 replay pós flagOFF e recovery retornam recibo exato; payload diferente falha',async()=>{
  await sql('SELECT despesas49.configurar(false)');assert.deepEqual(await rpc('rpc_editar_despesa49',[1,key,request]),edited);
  assert.deepEqual((await rpc('rpc_recuperar_edicao_despesa49',[1,key,request])).result,edited);await reject(()=>rpc('rpc_editar_despesa49',[1,key,{...request,motivo:'Outra intenção'}]),'23505');await sql('SELECT despesas49.configurar(true)');
 });
 await scenario('49 rejeita owner divergente e legado não sancionado',async()=>{
  await reject(()=>rpc('rpc_cotar_edicao_despesa49',[2,original.despesaId]),'42501');await reject(()=>rpc('rpc_cotar_edicao_despesa49',[1,900]),'23514');assert.equal(await cash(),beforeCash);
 });
 await scenario('49 request fecha owner/valor/snapshot fabricado e inválidos de data',async()=>{
  for(const bad of [{...request,userId:2},{...request,valor:'1.00'},{...request,antes:quote.original},{...request,dataVencimento:'2030-02-30'}]){let e;try{await rpc('rpc_editar_despesa49',[1,randomUUID(),bad]);}catch(x){e=x;}assert.ok(e);assert.ok(['22023','22008'].includes(e.code),e.message);}
 });
 await scenario('49 fence terminal sob lock33/20 bloqueia POST atrasado e writer20 por mesma UUID',async()=>{
  const q=await rpc('rpc_cotar_edicao_despesa49',[1,edited.sucessoraId]),r=req(q,{descricao:'Não executar'}),k=randomUUID(),f=await rpc('rpc_recuperar_edicao_despesa49',[1,k,r]);assert.equal(f.status,'not_executed');assert.ok(f.fence.fenceId);assert.deepEqual(await rpc('rpc_recuperar_edicao_despesa49',[1,k,r]),f);
  await reject(()=>rpc('rpc_editar_despesa49',[1,k,r]),'23514');await reject(()=>rpc('rpc_criar_despesa_prospectiva',[1,'Colisão','outros','1.00','2030-01-01',null,k]),'55000');save('49-fence.json',{r,k,f});
 });
 await scenario('49 cotação stale não muda fonte/sucessora e rollback integral',async()=>{
  const d=await expense(),q=await rpc('rpc_cotar_edicao_despesa49',[1,d.despesaId]),r=req(q,{estadoHash:'0'.repeat(64)}),b=await sql('SELECT to_jsonb(d) row FROM contas_pagar d WHERE id=$1',[d.despesaId]);
  await reject(()=>rpc('rpc_editar_despesa49',[1,randomUUID(),r]),'40001');assert.deepEqual(await sql('SELECT to_jsonb(d) row FROM contas_pagar d WHERE id=$1',[d.despesaId]),b);
 });
 await scenario('49 sucessora permanece elegível e pagamento20 real registra valor integral preciso',async()=>{
  await sql('SET ROLE service_role');const paid=await rpc('rpc_pagar_despesa_prospectiva',[1,edited.sucessoraId,1,'2030-02-28',randomUUID()]);await sql('RESET ROLE');assert.equal(paid.success,true);assert.equal(paid.valor,quote.valor);assert.equal(paid.status,'pago');
  await reject(()=>rpc('rpc_cotar_edicao_despesa49',[1,edited.sucessoraId]),'23514');save('49-successor-payment20.json',paid);
 });
 await scenario('49 origem adulterada não recebe sucessora nem compensação fabricada',async()=>{
  const d=await expense();await sql('BEGIN');await sql('UPDATE contas_pagar SET descricao=$1 WHERE id=$2',['Drift físico',d.despesaId]);await sql('SAVEPOINT dirty');await reject(()=>rpc('rpc_cotar_edicao_despesa49',[1,d.despesaId]),'23514');await sql('ROLLBACK TO SAVEPOINT dirty');await sql('ROLLBACK');
 });
 await scenario('49 ACL schema/tables fechado e auditoria imutável inclusive owner',async()=>{
  await sql('SET ROLE service_role');await reject(()=>sql('SELECT operation_id FROM despesas49.operacoes LIMIT 1'),'42501');await sql('RESET ROLE');await reject(()=>sql('UPDATE despesas49.operacoes SET resultado=resultado WHERE user_id=1'),'42501');await reject(()=>sql('TRUNCATE despesas49.operacoes'),'42501');
  const acl=await sql("SELECT n.nspname,p.proname,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') auth,has_function_privilege('service_role',p.oid,'EXECUTE') service FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='despesas49' OR p.proname LIKE '%despesa%49' ORDER BY p.oid");assert.ok(acl.length>10);for(const a of acl){assert.equal(a.anon,false);assert.equal(a.auth,false);assert.equal(a.service,a.nspname==='public');}save('49-private-access.json',acl);
 });
 await scenario('49 fontes e verify pós-instalação; drift detectado sem runtime reseal',async()=>{
  await verify();await rpc('despesas49.verificar');await rpc('despesa_cancelamento_v1.verificar');await rpc('caixa_manutencao45.verificar');
  const f=await functions(),s=await seals();await sql('BEGIN');await sql('ALTER FUNCTION despesas49.cotar(integer,integer) SET search_path=public');await sql('SAVEPOINT drift');await reject(()=>rpc('rpc_capacidades_despesas49'),'55000');await sql('ROLLBACK TO SAVEPOINT drift');await sql('ROLLBACK');assert.deepEqual(await functions(),f);assert.deepEqual(await seals(),s);
 });
 await scenario('49 concorrência real writer/recovery: recovery espera mesmo lock e confirma exata após commit',async()=>{
  const d=await expense(),q=await rpc('rpc_cotar_edicao_despesa49',[1,d.despesaId]),r=req(q,{descricao:'Concorrente real'}),k=randomUUID();
  const second=new pg.Client(config);await second.connect();
  try {
   await sql('BEGIN');const written=await rpc('rpc_editar_despesa49',[1,k,r]);let done=false;
   const pending=second.query('SELECT rpc_recuperar_edicao_despesa49($1,$2,$3) r',[1,k,r]).then(v=>{done=true;return v.rows[0].r;});
   await new Promise(resolve=>setTimeout(resolve,80));assert.equal(done,false,'recovery must wait for writer held key lock');
   await sql('COMMIT');const recovered=await pending;assert.equal(recovered.status,'confirmed');assert.deepEqual(recovered.result,written);save('49-concurrent-writer-recovery.json',{r,k,written,recovered});
  }finally{await sql('ROLLBACK');await second.end();}
 });
 const connect=async()=>{const c=new pg.Client(config);await c.connect();await c.query("SET statement_timeout='8s'; SET lock_timeout='5s'; SET ROLE service_role");return c;};
 const queryRpc=(c,n,v)=>c.query(`SELECT ${n}(${v.map((_,i)=>'$'+(i+1)).join(',')}) r`,v).then(x=>x.rows[0].r);
 const blocked=async(c,pending)=>{
  for(let i=0;i<100;i++){
   const a=(await sql('SELECT pg_blocking_pids($1) blockers FROM pg_stat_activity WHERE pid=$1',[c.processID]))[0];
   if(a?.blockers.length){assert.equal(pending.done,false);return a.blockers;}
   if(pending.done)throw new Error('contender finished before observed physical lock');
   await new Promise(r=>setTimeout(r,10));
  }
  throw new Error('physical lock not observed');
 };
 const capture=(promise)=>{const state={done:false};state.promise=promise.then(r=>{state.done=true;return {r};},e=>{state.done=true;return {code:e.code,message:e.message};});return state;};
 await scenario('49 duas UUIDs distintas mesma cotação: contender bloqueia, uma confirma outra40001, sucessão única',async()=>{
  const d=await expense(),q=await rpc('rpc_cotar_edicao_despesa49',[1,d.despesaId]),r=req(q),k1=randomUUID(),k2=randomUUID(),c=await connect();
  try{await sql('BEGIN');await sql('SET LOCAL ROLE service_role');const a=await rpc('rpc_editar_despesa49',[1,k1,r]);
   const b=capture(queryRpc(c,'rpc_editar_despesa49',[1,k2,{...r,descricao:'Outra edição mesma cotação'}]));const blockers=await blocked(c,b);await sql('COMMIT');const outcome=await b.promise;
   assert.equal(outcome.code,'40001',JSON.stringify(outcome));assert.equal((await sql("SELECT count(*)::int n FROM despesas49.operacoes WHERE user_id=1 AND request->>'despesaId'=$1 AND estado='confirmed'",[String(d.despesaId)]))[0].n,1);
   assert.equal((await sql('SELECT count(*)::int n FROM despesas_rpc_origens WHERE despesa_id=$1',[a.sucessoraId]))[0].n,1);save('49-two-edits-one-quote.json',{q,k1,k2,a,blockers,outcome});
  }finally{await sql('ROLLBACK');await c.end();}
 });
 for(const winner of ['20','49'])await scenario('49 pagamento20 vs49 ordem física real; vencedor'+winner+'; original cancelada nunca paga',async()=>{
  const d=await expense(),q=await rpc('rpc_cotar_edicao_despesa49',[1,d.despesaId]),r=req(q),ke=randomUUID(),kp=randomUUID(),c=await connect();
  const originalOrigin=await sql('SELECT to_jsonb(o) row FROM despesas_rpc_origens o WHERE despesa_id=$1',[d.despesaId]);
  try{await sql('BEGIN');await sql('SET LOCAL ROLE service_role');const written=winner==='20'?await rpc('rpc_pagar_despesa_prospectiva',[1,d.despesaId,1,'2030-02-28',kp]):await rpc('rpc_editar_despesa49',[1,ke,r]);
   const pending=capture(winner==='20'?queryRpc(c,'rpc_editar_despesa49',[1,ke,r]):queryRpc(c,'rpc_pagar_despesa_prospectiva',[1,d.despesaId,1,'2030-02-28',kp]));const blockers=await blocked(c,pending);await sql('COMMIT');const outcome=await pending.promise;assert.equal(outcome.code,'23514',JSON.stringify(outcome));
   assert.deepEqual(await sql('SELECT to_jsonb(o) row FROM despesas_rpc_origens o WHERE despesa_id=$1',[d.despesaId]),originalOrigin);
   const row=(await sql('SELECT status FROM contas_pagar WHERE id=$1',[d.despesaId]))[0];assert.equal(row.status,winner==='20'?'pago':'cancelado');
   assert.equal((await sql('SELECT count(*)::int n FROM despesas_rpc_pagamentos WHERE despesa_id=$1',[d.despesaId]))[0].n,winner==='20'?1:0);
   if(winner==='49'){await sql('SET ROLE service_role');const paid=await rpc('rpc_pagar_despesa_prospectiva',[1,written.sucessoraId,1,'2030-02-28',randomUUID()]);await sql('RESET ROLE');assert.equal(paid.status,'pago');assert.equal(paid.valor,q.valor);}
   save('49-payment20-race-'+winner+'.json',{q,written,blockers,outcome,row});
  }finally{await sql('ROLLBACK');await c.end();}
 });
 await sql('SELECT despesa_cancelamento_v1.configurar(true)');
 for(const winner of ['38c','49'])await scenario('49 cancel38c vs49 ordem física real; vencedor'+winner+'; um terminal sem dupla sucessão',async()=>{
  const d=await expense(),q=await rpc('rpc_cotar_edicao_despesa49',[1,d.despesaId]),r=req(q),ke=randomUUID(),kc=randomUUID(),c=await connect(),before=await cash();
  const cancel=[1,kc,d.despesaId,q.origemOperationId,'Cancelamento concorrente privado'];
  try{await sql('BEGIN');await sql('SET LOCAL ROLE service_role');const written=winner==='38c'?await rpc('rpc_cancelar_despesa_pendente38c',cancel):await rpc('rpc_editar_despesa49',[1,ke,r]);
   const pending=capture(winner==='38c'?queryRpc(c,'rpc_editar_despesa49',[1,ke,r]):queryRpc(c,'rpc_cancelar_despesa_pendente38c',cancel));const blockers=await blocked(c,pending);await sql('COMMIT');const outcome=await pending.promise;assert.equal(outcome.code,'23514',JSON.stringify(outcome));
   const n=(await sql("SELECT (SELECT count(*) FROM despesas49.operacoes WHERE request->>'despesaId'=$1 AND estado='confirmed')::int edited,(SELECT count(*) FROM despesa_cancelamento_v1.operacoes WHERE despesa_id=$2)::int cancelled",[String(d.despesaId),d.despesaId]))[0];assert.equal(n.edited+n.cancelled,1);assert.equal(n.edited,winner==='49'?1:0);assert.equal(await cash(),before);
   assert.equal((await sql('SELECT count(*)::int n FROM despesas_rpc_pagamentos WHERE despesa_id=$1',[d.despesaId]))[0].n,0);save('49-cancel38c-race-'+winner+'.json',{q,written,blockers,outcome,n});
  }finally{await sql('ROLLBACK');await c.end();}
 });
 await sql('SELECT despesa_cancelamento_v1.configurar(false)');
 await scenario('49 recoveryOFF ausente instala fence exata; replayOFF confirma; latePOST20/49/38c bloqueados',async()=>{
  const d=await expense(),q=await rpc('rpc_cotar_edicao_despesa49',[1,d.despesaId]),r=req(q),k=randomUUID(),before=await cash();await sql('SELECT despesas49.configurar(false)');await sql('SET ROLE service_role');
  const f=await rpc('rpc_recuperar_edicao_despesa49',[1,k,r]);assert.equal(f.status,'not_executed');assert.deepEqual(await rpc('rpc_recuperar_edicao_despesa49',[1,k,r]),f);assert.deepEqual(await rpc('rpc_editar_despesa49',[1,key,request]),edited);
  await reject(()=>rpc('rpc_editar_despesa49',[1,k,r]),'23514');await reject(()=>rpc('rpc_pagar_despesa_prospectiva',[1,d.despesaId,1,'2030-02-28',k]),'55000');await reject(()=>rpc('rpc_cancelar_despesa_pendente38c',[1,k,d.despesaId,q.origemOperationId,'Late cancel']),'55000');await sql('RESET ROLE');assert.equal(await cash(),before);save('49-recovery-off.json',{q,k,r,f});await sql('SELECT despesas49.configurar(true)');
 });
 await scenario('49 crash de conexão antesCOMMIT: recovery espera rollback físico e fence bloqueia writer atrasado',async()=>{
  const d=await expense(),q=await rpc('rpc_cotar_edicao_despesa49',[1,d.despesaId]),r=req(q),k=randomUUID(),writer=await connect(),reader=await connect(),before=await cash();
  try{await writer.query('BEGIN');const uncommitted=await queryRpc(writer,'rpc_editar_despesa49',[1,k,r]);const pending=capture(queryRpc(reader,'rpc_recuperar_edicao_despesa49',[1,k,r]));const blockers=await blocked(reader,pending);await writer.end();const outcome=await pending.promise;assert.equal(outcome.r.status,'not_executed');
   assert.equal((await sql('SELECT status FROM contas_pagar WHERE id=$1',[d.despesaId]))[0].status,'pendente');assert.equal((await sql('SELECT count(*)::int n FROM contas_pagar WHERE id=$1',[uncommitted.sucessoraId]))[0].n,0);assert.equal(await cash(),before);await reject(()=>rpc('rpc_editar_despesa49',[1,k,r]),'23514');save('49-crash-before-commit.json',{q,k,r,uncommitted,blockers,outcome});
  }finally{await writer.end().catch(()=>{});await reader.end();}
 });
 await scenario('49 commit com resposta perdida e recoveryOFF em conexão nova confirma recibo persistido',async()=>{
  const d=await expense(),q=await rpc('rpc_cotar_edicao_despesa49',[1,d.despesaId]),r=req(q),k=randomUUID(),writer=await connect();let written;
  try{await writer.query('BEGIN');written=await queryRpc(writer,'rpc_editar_despesa49',[1,k,r]);await writer.query('COMMIT');}finally{await writer.end();}
  await sql('SELECT despesas49.configurar(false)');const reader=await connect();try{const recovered=await queryRpc(reader,'rpc_recuperar_edicao_despesa49',[1,k,r]);assert.equal(recovered.status,'confirmed');assert.deepEqual(recovered.result,written);save('49-crash-after-commit-off.json',{q,k,r,written,recovered});}finally{await reader.end();}await sql('SELECT despesas49.configurar(true)');
 });
 result.scope={productionCatalogPins:233,privateObjects:72,nonSuperuser:true,noBypassRls:true,network:'socket-only',chequesRuntime:false,postDdlFinanceDelta:false,recurrence:false,concurrency:'physical pg_blocking_pids witnessed: distinct edit keys,20/49 both orders,38c/49 both orders,recoveryOFF,connection abort/commit loss'};
 save('49-post-functions.json',await functions());save('49-post-seals.json',await seals());
 await verify();await rpc('despesas49.verificar');await rpc('despesa_cancelamento_v1.verificar');await rpc('caixa_manutencao45.verificar');
 await sql(readFileSync(new URL('./postflight49.sql',import.meta.url),'utf8'));save('49-postflight.json',{passed:true,capabilities:await rpc('rpc_capacidades_despesas49')});
}
