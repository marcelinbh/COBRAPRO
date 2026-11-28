import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
/** Parent supplies isolated PG17 after actual composition through60 + additive67.
 * Same helper contract as runtime49; no connection/provisioning/env discovery here.
 * INSTALL68 must run before69 (postflight expects empty new schema).
 */
export async function runtime68({ sql, rpc, reject, scenario, assert, save, config }) {
  const cash = async () => (await sql("SELECT jsonb_build_object('contas',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.contas_caixa c),'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transacoes_caixa t)) s LIMIT 1"))[0].s;
  const functions = () => sql("SELECT p.oid,to_jsonb(p) snapshot,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND p.prokind='f' ORDER BY p.oid LIMIT 20000");
  const before = await functions(), cashBefore = await cash();
  const migration = readFileSync(new URL('../../drizzle/0068_recorrencia_despesas.sql', import.meta.url), 'utf8');
  const call = (owner, key, request, recover = false) => rpc(recover ? 'public.rpc_recuperar_despesas68' : 'public.rpc_configurar_despesas68', [owner, key, request]);
  let today, baseRequest;
  const uid = 'recorrencia68-private-fixture', project = 'private68';
  await scenario('68 migration accepts current valid additive preimage, exact old sources and cash unchanged', async () => {
    await sql(readFileSync(new URL('./preflight68.sql', import.meta.url), 'utf8'));
    // A modified NEW source cannot be used to derive/reseal37.
    await reject(() => sql(migration.replace("'68 append-only'", "'68 altered'")), '55000');await sql('ROLLBACK');assert.deepEqual(await functions(), before);
    await sql('BEGIN');await sql("ALTER FUNCTION public.rpc_criar_despesa_prospectiva(integer,text,text,numeric,date,text,uuid) SET search_path=public");await reject(() => sql(migration), '55000');await sql('ROLLBACK');assert.deepEqual(await functions(), before);
    await sql(migration);await sql(readFileSync(new URL('./postflight68.sql', import.meta.url), 'utf8'));
    const after = await functions();assert.deepEqual(after.filter(a => before.some(b => a.oid === b.oid)), before);assert.deepEqual(await cash(), cashBefore);
    today = (await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text today LIMIT 1"))[0].today;
    baseRequest = { action: 'criar', template: { descricao: 'Synthetic68', categoria: 'outros', valor: '19.01', observacoes: '' }, frequencia: 'mensal', ancora: today, termino: null };
    const list = await rpc('public.rpc_listar_despesas68', [1, null]);assert.equal(list.agenda.vinculada, false);assert.deepEqual(list.series, []);save('68-additive-install.json', { beforeCount: before.length, afterCount: after.length, cashUnchanged: true });
  });
  await scenario('68 calendar BRT anchor parity and leap/year/15day boundaries', async () => {
    const fixtures = [['2030-01-31','mensal',1,'2030-02-28'],['2030-01-31','mensal',2,'2030-03-31'],['2028-01-31','mensal',1,'2028-02-29'],['2028-02-29','anual',1,'2029-02-28'],['2028-02-29','anual',4,'2032-02-29'],['2030-12-31','quinzenal',1,'2031-01-15'],['2030-12-31','semanal',1,'2031-01-07'],['0001-01-31','mensal',1,'0001-02-28']];
    for (const [a,f,n,d] of fixtures) assert.equal((await sql('SELECT despesas68.data($1,$2,$3)::text d LIMIT 1',[a,f,n]))[0].d,d);
    await reject(() => sql("SELECT despesas68.data('9999-12-31','mensal',1) LIMIT 1"),'22008');
    await reject(() => sql("SELECT despesas68.civil('0000-01-01') LIMIT 1"),'22023');
    assert.equal((await sql("SELECT (TIMESTAMPTZ '2030-03-01 01:00:00Z' AT TIME ZONE 'America/Sao_Paulo')::date::text d LIMIT 1"))[0].d,'2030-02-28');
  });
  let serie, first, child;
  await scenario('68 CRUD before agenda; own receipts exact replay, cross-owner rejects, fence blocks latePOST', async () => {
    const key = randomUUID();serie = await call(1,key,baseRequest);assert.equal(serie.revision,1);assert.deepEqual(await call(1,key,baseRequest),serie);
    await reject(() => call(1,key,{...baseRequest,template:{...baseRequest.template,valor:'19.02'}}),'23505');
    await reject(() => call(2,randomUUID(),{action:'pausar',serieId:serie.serieId,expectedRevision:1}),'42501');
    const fencedKey = randomUUID(), f = await call(1,fencedKey,baseRequest,true);assert.equal(f.status,'not_executed');assert.ok(f.fenceId);await reject(() => call(1,fencedKey,baseRequest),'23514');
    assert.deepEqual(await cash(),cashBefore);
  });
  await scenario('68 dedicated agenda UID binding backend-only/CAS/body-owner not part of DB cron', async () => {
    await reject(() => rpc('public.rpc_gerar_despesas68',['notification-domain',randomUUID()]),'42501');
    await rpc('public.rpc_vincular_agenda_despesas68',[uid,project,null,true]);
    await reject(() => rpc('public.rpc_vincular_agenda_despesas68',[uid,project,null,true]),'40001');
    await sql('SET ROLE authenticated');await reject(() => rpc('public.rpc_vincular_agenda_despesas68',[uid,project,uid,true]),'42501');await sql('RESET ROLE');
    await sql('SET ROLE service_role');await reject(() => sql('SELECT user_id FROM despesas68.series LIMIT 1'),'42501');await sql('RESET ROLE');
  });
  const connect = async () => { const c = new pg.Client(config);await c.connect();await c.query("SET statement_timeout='10s'; SET lock_timeout='8s'; SET ROLE service_role");return c; };
  const blocked = async (c,done) => {
    for(let n=0;n<200;n++) { const row=(await sql('SELECT pg_blocking_pids($1) blockers FROM pg_stat_activity WHERE pid=$1 LIMIT 1',[c.processID]))[0];if(row?.blockers.length) { assert.equal(done(),false);return; }await new Promise(r=>setTimeout(r,10)); }
    throw Error('68 physical lock not observed');
  };
  await scenario('68 same occurrence two concurrent callbacks atomically create20 once then retry/no duplication', async () => {
    const c=await connect();let done=false;
    try { await sql('BEGIN');await sql('SET LOCAL ROLE service_role');first=await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);assert.equal(first.geradas,1);
      const pending=c.query('SELECT public.rpc_gerar_despesas68($1,$2) r LIMIT 1',[uid,randomUUID()]).then(x=>{done=true;return x.rows[0].r;});await blocked(c,()=>done);await sql('COMMIT');assert.equal((await pending).geradas,0);
      assert.equal((await sql('SELECT count(*)::integer n FROM despesas68.ocorrencias WHERE user_id=1 AND serie_id=$1 LIMIT 1',[serie.serieId]))[0].n,1);
      child=(await sql('SELECT root_id,operation20,child_uuid FROM despesas68.ocorrencias WHERE user_id=1 AND serie_id=$1 AND ordinal=0 LIMIT 1',[serie.serieId]))[0];
      const d=(await sql('SELECT status,recorrente,frequencia,conta_caixa_id,data_pagamento FROM contas_pagar WHERE id=$1 AND user_id=1 LIMIT 1',[child.root_id]))[0];assert.deepEqual(d,{status:'pendente',recorrente:false,frequencia:null,conta_caixa_id:null,data_pagamento:null});assert.deepEqual(await cash(),cashBefore);
    } finally { await sql('ROLLBACK');await c.end(); }
  });
  await scenario('68 templatefuture CAS rejects stale, never changes generated financial20, pause/resume explicit', async () => {
    const row=(await rpc('public.rpc_listar_despesas68',[1,null])).series.find(s=>s.serieId===serie.serieId);
    const changed=await call(1,randomUUID(),{action:'alterar',serieId:serie.serieId,expectedRevision:row.revision,effectiveOrdinal:row.futureOrdinal,template:{...baseRequest.template,valor:'20.02'}});
    await reject(() => call(1,randomUUID(),{action:'pausar',serieId:serie.serieId,expectedRevision:row.revision}),'40001');
    const pause=await call(1,randomUUID(),{action:'pausar',serieId:serie.serieId,expectedRevision:changed.revision});assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,0);
    const resume=await call(1,randomUUID(),{action:'retomar',serieId:serie.serieId,expectedRevision:pause.revision});assert.equal(resume.status,'confirmed');
    assert.equal((await sql('SELECT valor::text v FROM contas_pagar WHERE id=$1 LIMIT 1',[child.root_id]))[0].v,'19.01');
  });
  await scenario('68 root49 succession recursively sameowner then payment20 manual never regenerates cancelled root', async () => {
    await sql('SELECT despesas49.configurar(true) LIMIT 1');let current = child.root_id;
    for(let i=0;i<2;i++) { const q=await rpc('public.rpc_cotar_edicao_despesa49',[1,current]);const r={despesaId:current,origemOperationId:q.origemOperationId,estadoHash:q.estadoHash,descricao:'Synthetic successor '+i,categoria:'outros',dataVencimento:today,observacoes:'',motivo:'Synthetic PG68 lineage'};const e=await rpc('public.rpc_editar_despesa49',[1,randomUUID(),r]);current=e.sucessoraId; }
    const o=(await rpc('public.rpc_listar_despesas68',[1,null])).ocorrencias.find(o=>o.rootId===child.root_id);assert.equal(o.currentId,current);assert.equal(o.status,'pendente');assert.deepEqual(await cash(),cashBefore);
    const run=await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);assert.equal(run.geradas,0);
    const paid=await rpc('public.rpc_pagar_despesa_prospectiva',[1,current,1,today,randomUUID()]);assert.equal(paid.status,'pago');assert.equal(paid.valor,'19.01');assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,0);
    assert.equal((await sql('SELECT count(*)::integer n FROM despesas68.ocorrencias WHERE user_id=1 AND serie_id=$1 LIMIT 1',[serie.serieId]))[0].n,1);
  });
  await scenario('68 generation rollback/crash beforecommit leaves no20/origin/link/cursor, nextretry creates once', async () => {
    const other=await call(1,randomUUID(),baseRequest);const b=(await sql('SELECT count(*)::integer n FROM despesas_rpc_operacoes LIMIT 1'))[0].n;
    await sql('BEGIN');const r=await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);assert.equal(r.geradas,1);await sql('ROLLBACK');assert.equal((await sql('SELECT count(*)::integer n FROM despesas_rpc_operacoes LIMIT 1'))[0].n,b);assert.equal((await sql('SELECT next_ordinal n FROM despesas68.series WHERE id=$1 AND user_id=1 LIMIT 1',[other.serieId]))[0].n,0);
    assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,1);assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,0);
  });
  await scenario('68 two owners with identical templates do not collapse, closed series never adopts history', async () => {
    const own2=await call(2,randomUUID(),baseRequest);assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,1);
    const row=(await sql('SELECT root_id,user_id FROM despesas68.ocorrencias WHERE serie_id=$1 LIMIT 1',[own2.serieId]))[0];assert.equal(row.user_id,2);
    await call(2,randomUUID(),{action:'encerrar',serieId:own2.serieId,expectedRevision:1});assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,0);await reject(() => call(2,randomUUID(),{action:'retomar',serieId:own2.serieId,expectedRevision:2}),'23514');
  });
  await scenario('68 config CAS vs generator uses same series lock, winner defines future revision without duplicate ordinal', async () => {
    const created=await call(1,randomUUID(),baseRequest),c=await connect();let done=false;
    try {
      await sql('BEGIN');const changed=await call(1,randomUUID(),{action:'alterar',serieId:created.serieId,expectedRevision:1,effectiveOrdinal:1,template:{...baseRequest.template,valor:'33.03'}});
      const pending=c.query('SELECT public.rpc_gerar_despesas68($1,$2) r LIMIT 1',[uid,randomUUID()]).then(x=>{done=true;return x.rows[0].r;});
      // SKIP LOCKED may return an authorized no-op instead of waiting; both are
      // safe and backlog remains observable. Commit then next heartbeat recovers.
      await sql('COMMIT');await pending;await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);
      assert.equal(changed.revision,2);assert.equal((await sql('SELECT count(*)::integer n FROM despesas68.ocorrencias WHERE user_id=1 AND serie_id=$1 LIMIT 1',[created.serieId]))[0].n,1);
      assert.equal((await sql('SELECT revision FROM despesas68.ocorrencias WHERE user_id=1 AND serie_id=$1 LIMIT 1',[created.serieId]))[0].revision,1);
    } finally { await sql('ROLLBACK');await c.end(); }
  });
  await scenario('68 deferred commit-check failure after writer20 rolls entire financial creation back', async () => {
    const created=await call(1,randomUUID(),baseRequest),before=(await sql('SELECT count(*)::integer n FROM despesas_rpc_operacoes LIMIT 1'))[0].n;
    await sql('BEGIN');const t=await rpc('public.rpc_criar_despesa_prospectiva',[1,baseRequest.template.descricao,'outros','19.01',today,'',randomUUID()]);
    const key=(await sql('SELECT chave_idempotencia::text k FROM despesas_rpc_operacoes WHERE id=$1 LIMIT 1',[t.operationId]))[0].k;
    await sql("INSERT INTO despesas68.ocorrencias VALUES(1,$1,0,$2,1,$3,$4,$5,$6)",[created.serieId,today,key,t.despesaId,t.operationId,{...t,valor:'0.00'}]);
    await reject(()=>sql('SET CONSTRAINTS ALL IMMEDIATE'),'23514');await sql('ROLLBACK');
    assert.equal((await sql('SELECT count(*)::integer n FROM despesas_rpc_operacoes LIMIT 1'))[0].n,before);assert.equal((await sql('SELECT count(*)::integer n FROM contas_pagar WHERE id=$1 LIMIT 1',[t.despesaId]))[0].n,0);
    assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,1);
  });
  await scenario('68 wrapper20 manual creation concurrent with cron remain independent exact financial sources', async () => {
    const created=await call(1,randomUUID(),baseRequest),c=await connect();
    try { const manual=c.query('SELECT public.rpc_criar_despesa_prospectiva($1,$2,$3,$4,$5,$6,$7) r LIMIT 1',[1,'Independent manual20','outros','2.01',today,'',randomUUID()]);const cron=await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);const m=(await manual).rows[0].r;assert.equal(cron.geradas,1);assert.equal(m.success,true);assert.equal((await sql('SELECT count(*)::integer n FROM despesas68.ocorrencias WHERE user_id=1 AND serie_id=$1 LIMIT 1',[created.serieId]))[0].n,1);assert.equal((await sql('SELECT count(*)::integer n FROM despesas68.ocorrencias WHERE root_id=$1 LIMIT 1',[m.despesaId]))[0].n,0);
    } finally { await c.end(); }
  });
  await scenario('68 bounded backlog retains missed ordinals, futuretemplate never rewrites previous revisions', async () => {
    // Synthetic isolated fixtures only, not historical adoption or runtime owner API.
    // Twelve overdue weekly competences simulate platform unavailability.
    const backlogId=randomUUID(),anchor=(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date-84)::text a LIMIT 1"))[0].a;
    await sql("INSERT INTO despesas68.series(user_id,id,frequencia,ancora,estado,revision,next_ordinal) VALUES(1,$1,'semanal',$2,'ativa',1,0)",[backlogId,anchor]);
    await sql('INSERT INTO despesas68.revisoes VALUES(1,$1,1,0,$2)',[backlogId,baseRequest.template]);
    const c=await cash(),r1=await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);assert.equal(r1.geradas,8);assert.equal(r1.backlog,true);
    const list=await rpc('public.rpc_listar_despesas68',[1,null]),row=list.series.find(s=>s.serieId===backlogId);assert.equal(row.nextOrdinal,8);assert.equal(row.futureOrdinal,13);
    await call(1,randomUUID(),{action:'alterar',serieId:backlogId,expectedRevision:1,effectiveOrdinal:13,template:{...baseRequest.template,valor:'25.00'}});
    const r2=await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);assert.equal(r2.geradas,5);assert.equal(r2.backlog,false);
    assert.equal((await sql('SELECT count(*)::integer n FROM despesas68.ocorrencias WHERE user_id=1 AND serie_id=$1 AND revision=1 LIMIT 1',[backlogId]))[0].n,13);assert.deepEqual(await cash(),c);
    const pausedId=randomUUID();await sql("INSERT INTO despesas68.series(user_id,id,frequencia,ancora,estado,revision,next_ordinal) VALUES(1,$1,'semanal',$2,'ativa',1,0)",[pausedId,anchor]);await sql('INSERT INTO despesas68.revisoes VALUES(1,$1,1,0,$2)',[pausedId,baseRequest.template]);
    await call(1,randomUUID(),{action:'pausar',serieId:pausedId,expectedRevision:1});assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,0);
    const resume=await call(1,randomUUID(),{action:'retomar',serieId:pausedId,expectedRevision:2});assert.equal(resume.effectiveOrdinal,13);assert.equal((await sql('SELECT from_ordinal,to_exclusive FROM despesas68.skips WHERE serie_id=$1 LIMIT 1',[pausedId]))[0].to_exclusive,13);assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,0);
  });
  await scenario('68 crash after20/link rolls back new financial rows/cursor atomically, otherowner progresses', async () => {
    const a=await call(1,randomUUID(),baseRequest),b=await call(2,randomUUID(),baseRequest),n=(await sql('SELECT count(*)::integer n FROM despesas_rpc_operacoes LIMIT 1'))[0].n,c=await cash();
    // Transaction is intentionally aborted AFTER successful20/link beforecommit.
    // No schema mutation, reseal, deletion or compensation is used.
    await sql('BEGIN');const gen=await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);assert.equal(gen.geradas,1);await sql('ROLLBACK');assert.equal((await sql('SELECT count(*)::integer n FROM despesas_rpc_operacoes LIMIT 1'))[0].n,n);
    const generated=await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);assert.equal(generated.geradas,1);const remaining=await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);assert.equal(remaining.geradas,1);assert.deepEqual(await cash(),c);
    for(const id of [a.serieId,b.serieId])assert.equal((await sql('SELECT count(*)::integer n FROM despesas68.ocorrencias WHERE serie_id=$1 LIMIT 1',[id]))[0].n,1);
  });
  await scenario('68 pagar20 concorrente49 na ocorrência preserva raiz e dedupe cron', async () => {
    const created=await call(1,randomUUID(),baseRequest);await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);const root=(await sql('SELECT root_id FROM despesas68.ocorrencias WHERE serie_id=$1 AND user_id=1 LIMIT 1',[created.serieId]))[0].root_id;
    const q=await rpc('public.rpc_cotar_edicao_despesa49',[1,root]),request={despesaId:root,origemOperationId:q.origemOperationId,estadoHash:q.estadoHash,descricao:'Race49 synthetic',categoria:'outros',dataVencimento:today,observacoes:'',motivo:'Synthetic race'};
    const c=await connect();let done=false;
    try {
      await sql('BEGIN');const paid=await rpc('public.rpc_pagar_despesa_prospectiva',[1,root,1,today,randomUUID()]);
      const contender=c.query('SELECT public.rpc_editar_despesa49($1,$2,$3) r LIMIT 1',[1,randomUUID(),request]).then(r=>{done=true;return {result:r.rows[0].r};},e=>{done=true;return {code:e.code};});
      await blocked(c,()=>done);await sql('COMMIT');assert.equal((await contender).code,'23514');assert.equal(paid.status,'pago');
      assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,0);const o=(await rpc('public.rpc_listar_despesas68',[1,null])).ocorrencias.find(o=>o.rootId===root);assert.equal(o.currentId,root);assert.equal(o.status,'pago');
    } finally {await sql('ROLLBACK');await c.end();}
  });
  await scenario('68 logical cancellation38c never regenerates current/root and revoked UID cannot write', async () => {
    const created=await call(1,randomUUID(),baseRequest);await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);const root=(await sql('SELECT root_id,operation20 FROM despesas68.ocorrencias WHERE serie_id=$1 AND user_id=1 LIMIT 1',[created.serieId]))[0];
    await sql('SELECT despesa_cancelamento_v1.configurar(true) LIMIT 1');await rpc('public.rpc_cancelar_despesa_pendente38c',[1,randomUUID(),root.root_id,root.operation20,'Synthetic cancel68']);
    assert.equal((await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()])).geradas,0);const o=(await rpc('public.rpc_listar_despesas68',[1,null])).ocorrencias.find(o=>o.rootId===root.root_id);assert.equal(o.currentId,root.root_id);assert.equal(o.status,'cancelado');
    await rpc('public.rpc_vincular_agenda_despesas68',[uid,project,uid,false]);await reject(()=>rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]),'42501');
    const edit=await call(1,randomUUID(),baseRequest);assert.equal(edit.status,'confirmed');await rpc('public.rpc_vincular_agenda_despesas68',[uid,project,uid,true]);await rpc('public.rpc_gerar_despesas68',[uid,randomUUID()]);
  });
  await scenario('68 postruntime verifies exact old writers54/60 and new receipts/schema seal; drift never reseals', async () => {
    await rpc('despesas68.verificar');assert.deepEqual((await functions()).filter(a=>before.some(b=>b.oid===a.oid)),before);
    await sql('BEGIN');await sql('ALTER FUNCTION despesas68.data(date,text,integer) SET search_path=public');await sql('SAVEPOINT drift68');await reject(() => rpc('public.rpc_listar_despesas68',[1,null]),'55000');await sql('ROLLBACK TO SAVEPOINT drift68');await sql('ROLLBACK');await rpc('despesas68.verificar');
    save('68-runtime-complete.json',{calendar:true,concurrency:true,root49Recursive:true,manual20:true,rollback:true,tenant:true});
  });
}
