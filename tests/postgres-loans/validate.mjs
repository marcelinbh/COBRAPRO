import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [host,user,project] = process.argv.slice(2);
assert(host.startsWith('/tmp/cobrapro-loans-pg17-') && host.endsWith('/socket'));
const config={host,user,database:'postgres',port:55439};
const db=new pg.Client(config); await db.connect();
let passed=0;
async function test(name, fn) { await fn(); console.log(`PASS ${++passed} ${name}`); }
async function error(fn,code) { await assert.rejects(fn,e=>e.code===code); }
const params=(over={})=>({user:1,key:randomUUID(),cliente:1,conta:1,modalidade:'mensal',tipo:'mensal',principal:'500.00',taxa:'50.00',n:3,inicio:'2026-01-01',desembolso:'2026-01-01',datas:['2026-02-01','2026-03-01','2026-04-01'],descricao:null,observacoes:null,...over});
async function rpc(p=params(),client=db) {
 const q=await client.query('SELECT public.rpc_criar_emprestimo($1::integer,$2::uuid,$3::integer,$4::integer,$5::text,$6::text,$7::numeric,$8::numeric,$9::integer,$10::date,$11::date,$12::date[],$13::text,$14::text) AS r',Object.values(p));
 return q.rows[0].r;
}
async function effects() {
 const q=await db.query(`SELECT (SELECT count(*) FROM contratos)::int AS contratos,(SELECT count(*) FROM parcelas)::int AS parcelas,(SELECT count(*) FROM transacoes_caixa)::int AS caixa,(SELECT count(*) FROM contrato_historico)::int AS historico,(SELECT count(*) FROM emprestimos_rpc_operacoes)::int AS operacoes,(SELECT count(*) FROM emprestimos_rpc_origens)::int AS origens`);
 return q.rows[0];
}
const legacy=(await db.query(`SELECT jsonb_build_object('c',(SELECT to_jsonb(c) FROM contratos c WHERE id=900),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p WHERE contrato_id=900),'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t WHERE conta_caixa_id IN (4,5))) AS s`)).rows[0].s;
try {
 await test('PostgreSQL17, sem TCP e sem colunas inventadas',async()=>{
  assert.match((await db.query('SHOW server_version')).rows[0].server_version,/^17\./);
  assert.equal((await db.query('SHOW listen_addresses')).rows[0].listen_addresses,'');
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='transacoes_caixa' AND column_name IN ('cliente_id','operacao_financeira_id')`)).rows[0].n,0);
 });
 let first;
 const intent=params();
 await test('criação integral, soma exata, aliases, defaults, tenant, ledger e trilha',async()=>{
  await db.query('SET ROLE service_role');
  first=await rpc(intent);
  await db.query('RESET ROLE');
  assert.equal(first.valorParcela,'416.67'); assert.equal(first.totalContrato,'1250.00'); assert.equal(first.jurosTotal,'750.00');
  assert.equal(first.parcelasIds.length,3); assert.equal(first.repetida,false);
  const c=(await db.query('SELECT * FROM contratos WHERE id=$1',[first.id])).rows[0];
  assert.equal(c.num_parcelas,3);assert.equal(c.numero_parcelas,3);assert.equal(c.status,'ativo');
  assert.equal(c.multa_atraso,'2.0000');assert.equal(c.juros_mora_diario,'0.0330');assert.equal(c.koletor_id,1);
  const ps=(await db.query('SELECT * FROM parcelas WHERE contrato_id=$1 ORDER BY numero',[first.id])).rows;
  assert.deepEqual(ps.map(p=>p.valor),['416.67','416.67','416.66']);
  for(let i=0;i<3;i++) { const p=ps[i];assert.equal(p.numero,i+1);assert.equal(p.numero_parcela,i+1);assert.equal(p.valor,p.valor_original);assert.equal(p.valor_juros,'250.00');assert.equal(p.user_id,1);assert.equal(p.cliente_id,1);assert.equal(p.koletor_id,1);assert.equal(p.valor_pago,'0.00');assert.equal(p.saldo_residual,'0.00');assert.equal(p.data_pagamento,null); }
  const sums=(await db.query('SELECT sum(valor_original)::text AS total,sum(valor_juros)::text AS juros,sum(valor_original-valor_juros)::text AS capital FROM parcelas WHERE contrato_id=$1',[first.id])).rows[0];
  assert.deepEqual(sums,{total:'1250.00',juros:'750.00',capital:'500.00'});
  const caixa=(await db.query('SELECT * FROM transacoes_caixa WHERE contrato_id=$1',[first.id])).rows;
  assert.equal(caixa.length,1);assert.equal(caixa[0].valor,'500.00');assert.equal(caixa[0].tipo,'saida');assert.equal(caixa[0].categoria,'emprestimo_liberado');assert.equal(caixa[0].user_id,1);
  assert.equal((await db.query('SELECT saldo FROM contas_caixa WHERE id=1')).rows[0].saldo,'1000.00');
  const op=(await db.query('SELECT * FROM emprestimos_rpc_operacoes WHERE id=$1',[first.operationId])).rows[0];
  assert.match(op.hash_payload,/^[0-9a-f]{64}$/);assert(op.concluida_em);assert.equal(op.auditoria.historicoId,'1');assert.equal(op.auditoria.parcelas.length,3);
  assert.equal((await db.query('SELECT user_id FROM contrato_historico WHERE contrato_id=$1',[first.id])).rows[0].user_id,'1');
 });
 await test('replay serial, resposta perdida pós-commit e payload conflict',async()=>{
  const before=await effects(); const replay=await rpc(intent);assert.deepEqual(replay,{...first,repetida:true});
  assert.deepEqual(await rpc({...intent,principal:'500',taxa:'50.0',descricao:'  '}),{...first,repetida:true});
  await error(()=>rpc({...intent,principal:'501'}),'23505');
  await error(()=>rpc({...intent,observacoes:'mudou'}),'23505');
  await error(()=>rpc({...intent,datas:['2026-03-01','2026-04-01','2026-05-01']}),'23505');
  assert.deepEqual(await effects(),before);
 });
 await test('arredondamento capital/juros e N=60',async()=>{
  const r=await rpc(params({principal:'100',taxa:'0'}));
  assert.equal(r.totalContrato,'100.00');
  assert.deepEqual((await db.query('SELECT valor_original FROM parcelas WHERE contrato_id=$1 ORDER BY numero',[r.id])).rows.map(p=>p.valor_original),['33.33','33.33','33.34']);
  const s=await rpc(params({principal:'100',taxa:'0.01'}));
  assert.equal(s.jurosTotal,'0.03');
  const t=await rpc(params({principal:'0.03',taxa:'16.67'}));assert.equal(t.jurosTotal,'0.02');
  assert.deepEqual((await db.query('SELECT valor_juros FROM parcelas WHERE contrato_id=$1 ORDER BY numero',[t.id])).rows.map(p=>p.valor_juros),['0.01','0.01','0.00']);
  const dates=Array.from({length:60},(_,i)=>new Date(Date.UTC(2027,0+i,15,12)).toISOString().slice(0,10));
  const max=await rpc(params({principal:'600',taxa:'1',n:60,datas:dates}));assert.equal(max.parcelasIds.length,60);assert.equal(max.totalContrato,'960.00');
  const single=await rpc(params({principal:'0.01',taxa:'0',n:1,datas:['2028-02-29']}));assert.equal(single.totalContrato,'0.01');
 });
 await test('rejeita modalidades, precisão, extremos, agenda e parcelas zero',async()=>{
  const before=await effects();
  for(const modality of ['diario','semanal','quinzenal','tabela_price','bullet','venda','cheque','reparcelamento']) await error(()=>rpc(params({modalidade:modality})),'22023');
  for(const changes of [{tipo:'diaria'},{principal:'0'},{principal:'0.001'},{principal:'NaN'},{principal:'Infinity'},{taxa:'-1'},{taxa:'0.001'},{taxa:'1000'},{principal:'9999999999.99',taxa:'1'},{n:0},{n:61},{key:null},{principal:'0.01',taxa:'0'},{principal:'0.01',taxa:'33.33'},{datas:['2026-01-31','2026-03-03','2026-03-31']},{datas:['2026-02-01',null,'2026-04-01']},{datas:['2026-02-01']},{desembolso:'2026-01-02'},{inicio:null},{descricao:'x'.repeat(2001)}]) await error(()=>rpc(params(changes)),'22023');
  assert.deepEqual(await effects(),before);
 });
 await test('tenant cliente/conta/nulo, conta inativa e ledger owner divergente',async()=>{
  const before=await effects();
  for(const changes of [{cliente:2},{cliente:999},{conta:2},{conta:3},{conta:999}]) await error(()=>rpc(params(changes)),'42501');
  for(const conta of [4,5]) await error(()=>rpc(params({conta})),'23514');
  await db.query('UPDATE clientes SET user_id=NULL WHERE id=1');await error(()=>rpc(),'42501');await db.query('UPDATE clientes SET user_id=1 WHERE id=1');
  await db.query('UPDATE koletores SET ativo=false WHERE id=1');await error(()=>rpc(),'42501');await db.query('UPDATE koletores SET ativo=true WHERE id=1');
  await db.query("INSERT INTO koletores(id,user_id,nome) VALUES(3,1,'Ambíguo')");await error(()=>rpc(),'23514');await db.query('DELETE FROM koletores WHERE id=3');
  assert.deepEqual(await effects(),before);
  const absent=await rpc(params({user:2,cliente:2,conta:2,n:1,datas:['2026-01-31']}));
  assert.equal((await db.query('SELECT koletor_id FROM contratos WHERE id=$1',[absent.id])).rows[0].koletor_id,2);
  await db.query('INSERT INTO users(id) VALUES(3)');
  await db.query("INSERT INTO clientes(id,user_id,nome) VALUES(3,3,'Sem koletor')");
  await db.query("INSERT INTO contas_caixa(id,user_id,nome) VALUES(6,3,'Sem koletor')");
  const none=await rpc(params({user:3,cliente:3,conta:6,n:1,datas:['2026-01-31']}));
  assert.equal((await db.query('SELECT koletor_id FROM contratos WHERE id=$1',[none.id])).rows[0].koletor_id,null);
 });
 await test('rollback induzido em cada escrita; mesma chave pode repetir após falha',async()=>{
  const stages=[['emprestimos_rpc_operacoes','INSERT'],['contratos','INSERT'],['parcelas','INSERT'],['transacoes_caixa','INSERT'],['contrato_historico','INSERT'],['emprestimos_rpc_origens','INSERT'],['emprestimos_rpc_operacoes','UPDATE']];
  await db.query(`CREATE FUNCTION public.fail_synthetic() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic rollback' USING ERRCODE='P0001'; END $$`);
  for(const [table,event] of stages) {
   const before=await effects();const p=params();
   const condition=table==='parcelas'?' WHEN (NEW.numero=2)':'';
   await db.query(`CREATE TRIGGER fail_synthetic AFTER ${event} ON public.${table} FOR EACH ROW${condition} EXECUTE FUNCTION public.fail_synthetic()`);
   await error(()=>rpc(p),'P0001');assert.deepEqual(await effects(),before);
   await db.query(`DROP TRIGGER fail_synthetic ON public.${table}`);
   const retried=await rpc(p);assert.equal(retried.repetida,false);
  }
  await db.query('DROP FUNCTION public.fail_synthetic()');
 });
 await test('desconexão com transação não commitada não deixa efeito; chave pode repetir',async()=>{
  const before=await effects();const p=params();const disconnected=new pg.Client(config);
  await disconnected.connect();await disconnected.query('BEGIN');await rpc(p,disconnected);
  await disconnected.end();
  for(let attempt=0;attempt<20;attempt++) {
   if(JSON.stringify(await effects())===JSON.stringify(before)) break;
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.deepEqual(await effects(),before);assert.equal((await rpc(p)).repetida,false);
 });
 await test('concorrência mesma chave, conflict simultâneo e contas serializadas',async()=>{
  const clients=await Promise.all(Array.from({length:8},async()=>{const c=new pg.Client(config);await c.connect();return c;}));
  try {
   const before=await effects();const p=params();const all=await Promise.all(clients.map(c=>rpc(p,c)));
   assert.equal(new Set(all.map(r=>r.id)).size,1);assert.equal(all.filter(r=>!r.repetida).length,1);
   const after=await effects();assert.equal(after.contratos-before.contratos,1);assert.equal(after.caixa-before.caixa,1);assert.equal(after.parcelas-before.parcelas,3);
   const p2=params();const pair=await Promise.allSettled([rpc(p2,clients[0]),rpc({...p2,principal:'501'},clients[1])]);
   assert.equal(pair.filter(p=>p.status==='fulfilled').length,1);assert.equal(pair.find(p=>p.status==='rejected').reason.code,'23505');
   const different=await Promise.all(clients.map(c=>rpc(params(),c)));assert.equal(new Set(different.map(r=>r.id)).size,8);
  } finally { await Promise.all(clients.map(c=>c.end())); }
 });
 await test('TOCTOU de owner após lock da conta/cliente é recusado',async()=>{
  const holder=new pg.Client(config),caller=new pg.Client(config);await holder.connect();await caller.connect();
  try {
   for(const table of ['contas_caixa','clientes']) {
    const before=await effects();await holder.query('BEGIN');await holder.query(`UPDATE ${table} SET user_id=2 WHERE id=1`);
    const pending=rpc(params(),caller).then(()=>null,e=>e);
    await new Promise(resolve=>setTimeout(resolve,80));await holder.query('COMMIT');
    assert.equal((await pending).code,'42501');await db.query(`UPDATE ${table} SET user_id=1 WHERE id=1`);
    assert.deepEqual(await effects(),before);
   }
  } finally {await holder.end();await caller.end();}
 });
 await test('ACL service_role apenas EXECUTE, sem acesso direto à provenance; search_path seguro',async()=>{
  const signature='public.rpc_criar_emprestimo(integer,uuid,integer,integer,text,text,numeric,numeric,integer,date,date,date[],text,text)';
  for(const role of ['anon','authenticated']) {
   assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS ok',[role,signature])).rows[0].ok,false);
   await db.query(`SET ROLE ${role}`);await error(()=>rpc(),'42501');await db.query('RESET ROLE');
  }
  await db.query('SET ROLE service_role');
  await error(()=>db.query('SELECT * FROM emprestimos_rpc_operacoes LIMIT 1'),'42501');
  const r=await rpc(params());assert(r.success);await db.query('RESET ROLE');
  const conf=(await db.query('SELECT proconfig,prosecdef FROM pg_proc WHERE oid=$1::regprocedure',[signature])).rows[0];
  assert.equal(conf.prosecdef,true);assert(conf.proconfig.includes('search_path=pg_catalog, pg_temp'));
 });
 await test('timezone não muda DATE; status civil BRT',async()=>{
  const p=params({n:1,datas:['2028-02-29']});await db.query("SET TIME ZONE 'Pacific/Kiritimati'");const r=await rpc(p);
  await db.query("SET TIME ZONE 'Etc/GMT+12'");assert.deepEqual(await rpc(p),{...r,repetida:true});
  const hoje=(await db.query("SELECT (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS d")).rows[0].d;
  const now=await rpc(params({inicio:hoje,desembolso:hoje,n:1,datas:[hoje]}));
  assert.equal((await db.query('SELECT status FROM parcelas WHERE contrato_id=$1',[now.id])).rows[0].status,'vencendo_hoje');
 });
 await test('legado intacto e preflights 0013/0015 continuam bloqueados',async()=>{
  await db.query("SET TIME ZONE 'UTC'");
  const current=(await db.query(`SELECT jsonb_build_object('c',(SELECT to_jsonb(c) FROM contratos c WHERE id=900),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p WHERE contrato_id=900),'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t WHERE conta_caixa_id IN (4,5))) AS s`)).rows[0].s;
  assert.deepEqual(current,legacy);
  for(const file of ['0013_integridade_parcelas.sql','0015_rpc_recebimento_parcela.sql']) {
   await db.query('BEGIN');let failure;
   try { await db.query(readFileSync(`${project}/drizzle/${file}`,'utf8')); } catch (e) { failure=e; }
   await db.query('ROLLBACK');assert(failure);
   assert.match(failure.message,file.startsWith('0013') ? /parcelas sem empresa/ : /parcelas com chave nula, duplicada/);
   console.log(`  BLOCKED ${file}: ${failure.message}`);
  }
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rpc_registrar_pagamento_parcela'")).rows[0].n,0);
 });
 console.log(`SUMMARY ${passed} grupos PostgreSQL17 passaram`);
} finally {await db.query('RESET ROLE').catch(()=>{});await db.end();}
