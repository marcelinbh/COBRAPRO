import { readFileSync } from 'node:fs';
import pg from 'pg';
/** Parent supplies a socket-only isolated PG17 already composed through60 (+67/68).
 * No baseline fixture20/49 shortcut. Never connect this suite to production. */
export async function runtime69({ sql, rpc, reject, scenario, randomUUID, assert, save, config }) {
  assert.ok(config.host?.startsWith('/'), 'private Unix socket required');
  const role = (await sql("SELECT current_user,rolsuper,rolbypassrls,current_setting('server_version_num')::int version,current_setting('listen_addresses') listen FROM pg_roles WHERE rolname=current_user LIMIT 1"))[0];
  assert.equal(role.current_user, 'postgres'); assert.equal(role.rolsuper, false); assert.equal(role.rolbypassrls, false); assert.equal(Math.floor(role.version / 10000), 17); assert.equal(role.listen, '');
  const verify = async () => { for (const n of ['despesas49.verificar','obrigacoes51.verificar','inclusao52.verificar','sucessores53.verificar','emprestimos_lista60.verificar']) await rpc(n); };
  const functions = () => sql("SELECT p.oid,to_jsonb(p) snapshot FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_' ORDER BY p.oid LIMIT 20000");
  const cash = async () => JSON.stringify((await sql("SELECT jsonb_build_object('contas',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.contas_caixa a),'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transacoes_caixa t),'pagamentos',(SELECT jsonb_agg(to_jsonb(p) ORDER BY despesa_id) FROM public.despesas_rpc_pagamentos p)) s LIMIT 1"))[0].s);
  const all = async () => JSON.stringify((await sql("SELECT jsonb_build_object('contas',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.contas_caixa a),'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transacoes_caixa t),'despesas',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM public.contas_pagar d),'origens',(SELECT jsonb_agg(to_jsonb(o) ORDER BY despesa_id) FROM public.despesas_rpc_origens o),'pagamentos',(SELECT jsonb_agg(to_jsonb(p) ORDER BY despesa_id) FROM public.despesas_rpc_pagamentos p),'ops',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.despesas_rpc_operacoes o),'fences',(SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.financial_intent_fences f)) s LIMIT 1"))[0].s);
  const compiled = async () => (await sql("SELECT encode(extensions.digest(prosrc,'sha256'),'hex') h FROM pg_proc WHERE oid='obrigacoes51.verificar()'::regprocedure LIMIT 1"))[0].h;
  const body54 = '8f587261d12bad22e26b6a3381f2c8004c6ab950faf1a9c3dd5e6932778e7074';
  await verify(); assert.equal(await compiled(), body54);
  const ddl = readFileSync(new URL('../../drizzle/0069_substituicao_valor_despesa.sql', import.meta.url), 'utf8');
  const preFunctions = await functions(), preFinance = await all();
  await scenario('69 DDL rejects predecessor drift and new-source tamper, rolls back; installs on current valid60 catalog', async () => {
    for (const change of ["ALTER FUNCTION despesas49.validar(integer,integer) SET search_path=public", "CREATE FUNCTION public.extra_unapproved69() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$"]) {
      await sql('BEGIN'); await sql(change); await reject(() => sql(ddl), '55000'); await sql('ROLLBACK');
      assert.deepEqual(await functions(), preFunctions); assert.equal(await all(), preFinance);
    }
    const bad = ddl.replace("BEGIN RAISE EXCEPTION '69 append-only'", "BEGIN /* unknown69 */ RAISE EXCEPTION '69 append-only'"); assert.notEqual(bad, ddl);
    await reject(() => sql(bad), '55000'); await sql('ROLLBACK'); assert.deepEqual(await functions(), preFunctions);
    await sql(ddl); assert.equal(await all(), preFinance); const after = await functions(); assert.deepEqual(after.filter(f => preFunctions.some(p => p.oid === f.oid)), preFunctions);
    assert.equal(await compiled(), body54); await verify(); await rpc('despesas69.verificar');
    const cap = await rpc('rpc_capacidades_despesas69'); assert.equal(cap.habilitado, true); assert.equal(cap.valorEditavel, true); save('69-install.json', { cap, role, oldFunctionsExact: true, oldFinanceExact: true });
  });
  const expense = (valor = '10.01', owner = 1) => rpc('rpc_criar_despesa_prospectiva', [owner, 'Despesa69 real20', 'outros', valor, '2030-01-31', null, randomUUID()]);
  const quote = d => rpc('rpc_cotar_edicao_despesa69', [1, d.despesaId]);
  const req = (q, valor = '20.02', extra = {}) => ({ despesaId: q.quote49.despesaId, origemOperationId: q.quote49.origemOperationId, estadoHash: q.quote49.estadoHash, descricao: q.quote49.original.descricao, categoria: q.quote49.original.categoria, dataVencimento: q.quote49.original.data_vencimento, observacoes: q.quote49.original.observacoes ?? '', motivo: 'Correção explícita desta ocorrência', valor, ...extra });
  const connect = async () => { const c = new pg.Client(config); await c.connect(); await c.query("SET TimeZone='UTC'; SET statement_timeout='15s'; SET lock_timeout='10s'; SET ROLE service_role"); return c; };
  const call = (c, name, v) => c.query(`SELECT ${name}(${v.map((_, i) => '$' + (i + 1)).join(',')}) r`, v).then(x => x.rows[0].r);
  const capture = promise => { const s = { done: false }; s.promise = promise.then(r => { s.done = true; return { r }; }, e => { s.done = true; return { code: e.code }; }); return s; };
  const blocked = async (c, state) => { for (let i = 0; i < 200; i++) { const r = (await sql('SELECT pg_blocking_pids($1) blockers LIMIT 1', [c.processID]))[0]; if (r.blockers.length) { assert.equal(state.done, false); return r.blockers; } if (state.done) throw Error('contender completed before physical lock observed'); await new Promise(r => setTimeout(r, 10)); } throw Error('physical lock not observed'); };
  let committed, original, originalQuote, originalRequest, originalKey;
  await scenario('69 value-only successor20 exact max NUMERIC, original only status/timestamp, no cash/payments DML', async () => {
    const before = await cash(); original = await expense(); originalQuote = await quote(original); originalRequest = req(originalQuote, '9999999999999.99'); originalKey = randomUUID();
    const origin = await sql('SELECT to_jsonb(o) r FROM public.despesas_rpc_origens o WHERE despesa_id=$1 LIMIT 1', [original.despesaId]);
    await sql('SET ROLE service_role'); committed = await rpc('rpc_editar_despesa69', [1, originalKey, originalRequest]); await sql('RESET ROLE');
    assert.equal(committed.valorAnterior, '10.01'); assert.equal(committed.valorNovo, '9999999999999.99'); assert.notEqual(committed.sucessoraId, original.despesaId);
    assert.deepEqual(await sql('SELECT to_jsonb(o) r FROM public.despesas_rpc_origens o WHERE despesa_id=$1 LIMIT 1', [original.despesaId]), origin);
    const after = (await sql('SELECT to_jsonb(d) r FROM public.contas_pagar d WHERE id=$1 LIMIT 1', [original.despesaId]))[0].r;
    const expected = { ...originalQuote.quote49.original, status: 'cancelado', updatedAt: after.updatedAt }; assert.deepEqual(after, expected);
    assert.equal((await sql('SELECT valor::text v FROM public.contas_pagar WHERE id=$1 LIMIT 1', [committed.sucessoraId]))[0].v, committed.valorNovo);
    assert.equal(await cash(), before); save('69-value-only.json', { original, originalQuote, originalKey, committed });
  });
  await scenario('69 exact retry dedupe and recoveryOFF confirms after losing reply; never new successor', async () => {
    const before = await all(); await sql('SELECT despesas69.configurar(false)'); const reader = await connect();
    try { assert.deepEqual(await call(reader, 'rpc_editar_despesa69', [1, originalKey, originalRequest]), committed); assert.deepEqual((await call(reader, 'rpc_recuperar_edicao_despesa69', [1, originalKey, originalRequest])).result, committed); }
    finally { await reader.end(); }
    assert.equal(await all(), before); await reject(() => rpc('rpc_editar_despesa69', [1, originalKey, { ...originalRequest, valor: '1.01' }]), '23505');
    await sql('SELECT despesas69.configurar(true)');
  });
  await scenario('69 no delta / canonical money / stale / owner / legacy / paid rejection leaves all original data unchanged', async () => {
    const d = await expense(), q = await quote(d), r = req(q), before = await all();
    await reject(() => rpc('rpc_editar_despesa69', [2, randomUUID(), r]), '42501');
    await reject(() => rpc('rpc_cotar_edicao_despesa69', [1, 900]), '23514'); // inherited synthetic legacy fixture, never adoption.
    await reject(() => rpc('rpc_editar_despesa69', [1, randomUUID(), req(q, q.quote49.valor)]), '22023');
    for (const value of ['0.00','1','1.1','1.001','1e2','NaN','Infinity','10000000000000.00','01.00']) await reject(() => rpc('rpc_editar_despesa69', [1, randomUUID(), { ...r, valor: value }]), '22023');
    await reject(() => rpc('rpc_editar_despesa69', [1, randomUUID(), { ...r, estadoHash: '0'.repeat(64) }]), '40001'); assert.equal(await all(), before);
    const paid = await expense('1.01'); await rpc('rpc_pagar_despesa_prospectiva', [1, paid.despesaId, 1, '2030-01-31', randomUUID()]); const paidBefore = await all(); await reject(() => rpc('rpc_cotar_edicao_despesa69', [1, paid.despesaId]), '23514'); assert.equal(await all(), paidBefore);
  });
  await scenario('69 authoritative rollback AFTER logical cancel BEFORE create20 using sequence exhaustion, no partial expense/origin/fence', async () => {
    const d = await expense(), q = await quote(d), r = req(q), key = randomUUID(), before = await all();
    const sequence = (await sql("SELECT pg_get_serial_sequence('public.contas_pagar','id') s LIMIT 1"))[0].s;
    assert.match(sequence, /^[a-zA-Z0-9_."]+$/); const seq = (await sql(`SELECT last_value::text v,is_called FROM ${sequence} LIMIT 1`))[0];
    try {
      // Sequence state is not a metadata reseal or financial UPDATE. Writer20 cannot allocate int4 successor.
      await sql('SELECT setval($1::regclass,2147483647,true) LIMIT 1', [sequence]);
      const e = await reject(() => rpc('rpc_editar_despesa69', [1, key, r])); assert.ok(['2200H','22003'].includes(e.code), e.message);
      assert.equal(await all(), before); assert.deepEqual(await quote(d), q); assert.equal((await sql('SELECT count(*)::int n FROM despesas69.operacoes WHERE user_id=1 AND chave=$1 LIMIT 1', [key]))[0].n, 0);
    } finally { await sql('SELECT setval($1::regclass,$2::bigint,$3) LIMIT 1', [sequence, seq.v, seq.is_called]); }
    const fence = await rpc('rpc_recuperar_edicao_despesa69', [1, key, r]); assert.equal(fence.status, 'not_executed'); await reject(() => rpc('rpc_editar_despesa69', [1, key, r]), '23514'); save('69-rollback-before-create.json', { key, fence });
  });
  await scenario('69 recoveryOFF absent request installs exact terminal fence; delayed20/38c/49/69 writers refused', async () => {
    const d = await expense(), q = await quote(d), r = req(q), k = randomUUID(), before = await cash(); await sql('SELECT despesas69.configurar(false)');
    const f = await rpc('rpc_recuperar_edicao_despesa69', [1, k, r]); assert.equal(f.status, 'not_executed'); assert.ok(f.fence.fenceId); assert.deepEqual(await rpc('rpc_recuperar_edicao_despesa69', [1, k, r]), f);
    await reject(() => rpc('rpc_editar_despesa69', [1, k, r]), '23514');
    await reject(() => rpc('rpc_pagar_despesa_prospectiva', [1, d.despesaId, 1, '2030-01-31', k]), '55000');
    await reject(() => rpc('rpc_cancelar_despesa_pendente38c', [1, k, d.despesaId, q.quote49.origemOperationId, 'Late cancel']), '55000');
    const { valor, ...r49 } = r; await reject(() => rpc('rpc_editar_despesa49', [1, k, r49]), '23505'); assert.equal(await cash(), before); await sql('SELECT despesas69.configurar(true)');
  });
  // Activate predecessor flags ONLY inside this private runtime fixture. Migration69 never flips them.
  await sql('SELECT despesas49.configurar(true)'); await sql('SELECT despesa_cancelamento_v1.configurar(true)');
  for (const competitor of ['20','38c','49','69']) for (const winner of ['competitor','69']) await scenario(`69 physical race vs${competitor}, winner=${winner}`, async () => {
    const d = await expense('1.01'), q = await quote(d), r = req(q, '2.02'), ke = randomUUID(), ko = randomUUID(), other = await connect(), before = await cash();
    const { valor, ...r49 } = r; r49.descricao = 'Metadata-only49';
    const otherName = { '20':'rpc_pagar_despesa_prospectiva', '38c':'rpc_cancelar_despesa_pendente38c', '49':'rpc_editar_despesa49', '69':'rpc_editar_despesa69' }[competitor];
    const otherArgs = { '20':[1,d.despesaId,1,'2030-01-31',ko], '38c':[1,ko,d.despesaId,q.quote49.origemOperationId,'Cancel concorrente'], '49':[1,ko,r49], '69':[1,ko,req(q,'3.03')] }[competitor];
    try {
      await sql('BEGIN'); await sql('SET LOCAL ROLE service_role'); const first = winner === '69' ? await rpc('rpc_editar_despesa69', [1,ke,r]) : await rpc(otherName, otherArgs);
      const waiting = capture(winner === '69' ? call(other,otherName,otherArgs) : call(other,'rpc_editar_despesa69',[1,ke,r])); const blockers = await blocked(other,waiting); await sql('COMMIT'); const outcome = await waiting.promise;
      assert.ok(['23514','40001'].includes(outcome.code), JSON.stringify(outcome));
      const counts = (await sql("SELECT (SELECT count(*) FROM despesas69.operacoes WHERE user_id=1 AND despesa_id=$1 AND status='confirmed')::int edits69,(SELECT count(*) FROM despesas49.operacoes WHERE user_id=1 AND request->>'despesaId'=$2 AND estado='confirmed')::int edits49,(SELECT count(*) FROM despesas_rpc_pagamentos WHERE despesa_id=$1)::int payments LIMIT 1",[d.despesaId,String(d.despesaId)]))[0];
      if (winner==='69' || competitor==='69') assert.equal(counts.edits69,1); else assert.equal(counts.edits69,0);
      assert.equal(counts.payments,winner==='competitor' && competitor==='20'?1:0);
      if (!(winner==='competitor' && competitor==='20')) assert.equal(await cash(),before);
      save(`69-race-${competitor}-${winner}.json`,{first,blockers,outcome,counts});
    } finally { await sql('ROLLBACK'); await other.end(); }
  });
  await scenario('69 recovery physically waits uncommitted writer, crash rolls back then fences; committed response-loss dedupes', async () => {
    const d = await expense(), q = await quote(d), r = req(q), k = randomUUID(), writer = await connect(), reader = await connect(), before = await cash();
    try { await writer.query('BEGIN'); const uncommitted = await call(writer,'rpc_editar_despesa69',[1,k,r]); const pending=capture(call(reader,'rpc_recuperar_edicao_despesa69',[1,k,r])); await blocked(reader,pending); await writer.end(); const recovered=await pending.promise; assert.equal(recovered.r.status,'not_executed'); assert.equal((await sql('SELECT status FROM contas_pagar WHERE id=$1 LIMIT 1',[d.despesaId]))[0].status,'pendente'); assert.equal((await sql('SELECT count(*)::int n FROM contas_pagar WHERE id=$1 LIMIT 1',[uncommitted.sucessoraId]))[0].n,0); assert.equal(await cash(),before); }
    finally { await writer.end().catch(()=>{}); await reader.end(); }
    const d2=await expense(),q2=await quote(d2),r2=req(q2),k2=randomUUID(),w=await connect(); let written;
    try { await w.query('BEGIN'); written=await call(w,'rpc_editar_despesa69',[1,k2,r2]); await w.query('COMMIT'); } finally { await w.end(); }
    await sql('SELECT despesas69.configurar(false)'); assert.deepEqual((await rpc('rpc_recuperar_edicao_despesa69',[1,k2,r2])).result,written); await sql('SELECT despesas69.configurar(true)');
  });
  await scenario('69 mixed chain49->69->49 preserves69 receipts and successor can pay/estorno20; no recurrence-root update', async () => {
    const d=await expense('1.01'),q=await quote(d),{valor,...r49}=req(q,'1.01',{descricao:'Primeira49'}); const a=await rpc('rpc_editar_despesa49',[1,randomUUID(),r49]);
    const q69=await quote({despesaId:a.sucessoraId}),bKey=randomUUID(),bRequest=req(q69,'2.02'),b=await rpc('rpc_editar_despesa69',[1,bKey,bRequest]);
    const qb=await quote({despesaId:b.sucessoraId}),{valor:unused,...next49}=req(qb,'2.02',{descricao:'Terceira49'}),c=await rpc('rpc_editar_despesa49',[1,randomUUID(),next49]);
    assert.deepEqual((await rpc('rpc_recuperar_edicao_despesa69',[1,bKey,bRequest])).result,b);
    const line=await rpc('rpc_linhagem_despesas69',[1,a.sucessoraId]); assert.equal(line.sucessoraId,b.sucessoraId); assert.equal(line.status,'confirmed');
    const paid=await rpc('rpc_pagar_despesa_prospectiva',[1,c.sucessoraId,1,'2030-01-31',randomUUID()]);assert.equal(paid.valor,'2.02');
    const reversed=await rpc('rpc_estornar_despesa_prospectiva',[1,c.sucessoraId,paid.operationId,'2030-02-01','Compensação original',randomUUID()]); assert.equal(reversed.success,true);
    await rpc('despesas69.provar',[b.operationId]); save('69-chain.json',{a,b,c,paid,reversed});
  });
  await scenario('69 ACL private and immutable ledger; runtime catalog drift fails closed without reseal', async () => {
    await sql('SET ROLE service_role'); await reject(()=>sql('SELECT operation_id FROM despesas69.operacoes LIMIT 1'),'42501'); await sql('RESET ROLE');
    await reject(()=>sql('UPDATE despesas69.operacoes SET resultado=resultado WHERE user_id=1'),'42501'); await reject(()=>sql('TRUNCATE despesas69.operacoes'),'42501');
    await sql('BEGIN'); await sql('ALTER FUNCTION despesas69.cotar(integer,integer) SET search_path=public'); await reject(()=>rpc('rpc_capacidades_despesas69'),'55000'); await sql('ROLLBACK');
    await rpc('despesas69.verificar'); await verify(); assert.equal(await compiled(),body54);
  });
  await sql('SELECT despesas49.configurar(false)'); await sql('SELECT despesa_cancelamento_v1.configurar(false)');
}
