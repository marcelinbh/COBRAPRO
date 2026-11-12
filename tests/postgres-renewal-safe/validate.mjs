import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [host,user,project,with33]=process.argv.slice(2);
assert(host.startsWith('/tmp/cobrapro-renewal-safe-pg17-')&&host.endsWith('/socket'));
assert(!Object.keys(process.env).some(k=>/SUPABASE|DATABASE|SECRET|TOKEN|PGHOST|PGPASSWORD/.test(k)));
const config={host,user,database:'postgres',port:55441};
const db=new pg.Client(config);await db.connect();
let passed=0;
async function test(name,fn){await fn();console.log(`PASS ${++passed} ${name}`);}
async function rejects(fn,code){await assert.rejects(fn,e=>e.code===code);}
const migration=readFileSync(`${project}/drizzle/0031_rpc_renovacao_juros_prospectiva.sql`,'utf8');
async function create(over={},client=db){
 const v={tenant:1,key:randomUUID(),cliente:1,conta:1,mod:'mensal',tipo:'mensal',principal:'1000.03',taxa:'5.56',n:1,inicio:'2026-01-01',desembolso:'2026-01-01',datas:['2026-11-10'],descricao:null,obs:null,...over};
 return (await client.query('SELECT public.rpc_criar_emprestimo($1::int,$2::uuid,$3::int,$4::int,$5::text,$6::text,$7::numeric,$8::numeric,$9::int,$10::date,$11::date,$12::date[],$13::text,$14::text) r',Object.values(v))).rows[0].r;
}
async function quote(c,p=c.parcelasIds[0],tenant=1,client=db){return(await client.query('SELECT public.rpc_cotar_renovacao_prospectiva($1,$2,$3) r',[tenant,c.id,p])).rows[0].r;}
function intent(q,over={}){return {tenant:1,key:randomUUID(),c:q.contratoId,p:q.parcelaId,recebido:q.totalExigido,total:q.totalExigido,date:q.dataPagamento,hash:q.estadoHash,qhash:q.cotacaoHash,...over};}
async function renew(i,client=db){return(await client.query('SELECT public.rpc_renovar_emprestimo_prospectivo($1::int,$2::uuid,$3::int,$4::int,$5::numeric,$6::numeric,$7::date,$8::text,$9::text) r',Object.values(i))).rows[0].r;}
async function receipt(c,p=c.parcelasIds[0],client=db,partial=null){
 const q=(await client.query('SELECT public.rpc_cotar_emprestimo_prospectivo(1,$1,$2) r',[c.id,p])).rows[0].r;
 return (await client.query('SELECT public.rpc_receber_emprestimo_prospectivo(1,$1::uuid,$2::int,$3::int,$4::numeric,$5::numeric,$6::date,$7::text,$8::text,NULL) r',[randomUUID(),c.id,p,partial??q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,partial?'parcial':'integral'])).rows[0].r;
}
async function state(){
 const names=['contratos','parcelas','transacoes_caixa','contrato_historico','ciclo_estados','ciclo_operacoes','ciclo_pernas','ciclo_autorizacoes','renovacao_operacoes','renovacao_provas','renovacao_capacidades'];
 const s={};for(const n of names)s[n]=(await db.query(`SELECT coalesce(jsonb_agg(j ORDER BY j::text),'[]'::jsonb) s FROM (SELECT to_jsonb(x) j FROM ${n} x) a`)).rows[0].s;return s;
}
const legacy=(await db.query('SELECT to_jsonb(c) c FROM contratos c WHERE id=900')).rows[0];
try{
 const pre=await create(); // Complete snapshot is mandatory even with 0021 provenance.
 await test('preflight recusa CHECK desconhecido e DDL rollback mantém catálogo',async()=>{
  await db.query("ALTER TABLE parcelas ADD CONSTRAINT extra_unknown CHECK(valor>=0)");
  await rejects(()=>db.query(migration),'P0001');await db.query('ROLLBACK');
  assert.equal((await db.query("SELECT to_regclass('public.renovacao_provas') x")).rows[0].x,null);
  await db.query('ALTER TABLE parcelas DROP CONSTRAINT extra_unknown');
 });
 await test('preflight recusa função predecessora alterada/ACL exposta e rollback',async()=>{
  await db.query('GRANT EXECUTE ON FUNCTION ciclo_autorizar(text,integer,integer) TO service_role');
  await rejects(()=>db.query(migration),'P0001');await db.query('ROLLBACK');
  await db.query('REVOKE ALL ON FUNCTION ciclo_autorizar(text,integer,integer) FROM service_role');
 });
 await test('preflight recusa coluna/default novo sem escrever ou ampliar CHECK',async()=>{
  await db.query("ALTER TABLE parcelas ADD COLUMN desconhecida text DEFAULT 'x'");
  await rejects(()=>db.query(migration),'P0001');await db.query('ROLLBACK');
  assert.equal((await db.query("SELECT to_regclass('public.renovacao_provas') x")).rows[0].x,null);
  await db.query('ALTER TABLE parcelas DROP COLUMN desconhecida');
 });
 await db.query(migration);
 if(with33==='--with33')await db.query(readFileSync(`${project}/drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql`,'utf8'));
 await test('PG17 somente socket, env sem secrets, schema status aditivo e nenhuma atualização na instalação',async()=>{
  assert.match((await db.query('SHOW server_version')).rows[0].server_version,/^17\./);
  assert.equal((await db.query('SHOW listen_addresses')).rows[0].listen_addresses,'');
  assert((await quote(pre)).elegivel);
  assert.deepEqual((await db.query('SELECT to_jsonb(c) c FROM contratos c WHERE id=900')).rows[0],legacy);
 });
 let first,qr,r,ii;
 await test('cotação exata juros embutidos 55.60, principal zero pago, hash/data BRT',async()=>{
  const hoje=(await db.query("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d")).rows[0].d;
  first=await create({datas:[hoje]});qr=await quote(first);ii=intent(qr);
  assert.equal(qr.jurosEmbutidos,'55.60');assert.equal(qr.totalExigido,'55.60');assert.equal(qr.principalAntes,'1000.03');assert.equal(qr.principalPago,'0.00');assert.equal(qr.novoTotal,'1055.63');
  assert.match(qr.expiraEm,/T00:00:00-03:00$/);assert.equal(qr.dataPagamento,hoje);
 });
 await test('renovação recebe componentes uma vez, conserva principal e NÃO marca paga',async()=>{
  await db.query('SET ROLE service_role');r=await renew(ii);await db.query('RESET ROLE');
  assert.equal(r.status,'renovada');assert.equal(r.contratoStatus,'ativo');assert.equal(r.principalPago,'0.00');assert.equal(r.principalAntes,r.principalDepois);
  const proof=(await db.query('SELECT to_jsonb(x) p FROM renovacao_provas x WHERE operacao_id=$1',[r.operationId])).rows[0].p;
  assert.equal(proof.principal_antes,proof.principal_depois);assert.equal(proof.principal_pago,0);assert.equal(proof.valor_recebido,proof.juros_pagos+proof.multa_paga+proof.mora_paga);
  const old=(await db.query('SELECT status,valor_pago,saldo_residual,valor_original,valor_juros FROM parcelas WHERE id=$1',[qr.parcelaId])).rows[0];
  assert.deepEqual(old,{status:'renovada',valor_pago:'55.60',saldo_residual:'1000.03',valor_original:'1055.63',valor_juros:'55.60'});
  assert.equal((await db.query('SELECT count(*)::int n FROM transacoes_caixa WHERE parcela_id=$1',[qr.parcelaId])).rows[0].n,1);
  assert.equal((await db.query('SELECT saldo FROM contas_caixa WHERE id=1')).rows[0].saldo,'1000.00');
  assert.equal((await db.query('SELECT count(*)::int n FROM renovacao_capacidades')).rows[0].n,0);
 });
 await test('retry resposta perdida é estável e UUID divergente falha inclusive após dia antigo',async()=>{
  assert.deepEqual(await renew(ii),{...r,repetida:true});
  await rejects(()=>renew({...ii,recebido:'0.01',total:'0.01'}),'23505');
  await rejects(()=>renew({...ii,date:'2026-01-01'}),'23505');
 });
 await test('antecessor não recebe de novo, segunda renovação bloqueada; sucessor integral quita contrato',async()=>{
  await rejects(()=>quote(first),'23514');await rejects(()=>receipt(first),'23514');
  await rejects(()=>quote(first,r.sucessoraId),'23514');
  const paid=await receipt(first,r.sucessoraId);assert.equal(paid.status,'paga');assert.equal(paid.contratoStatus,'quitado');
  assert.equal((await db.query('SELECT status FROM parcelas WHERE id=$1',[r.parcelaId])).rows[0].status,'renovada');
 });
 await test('sucessor parcial mantém ativo, integral residual quita; prova exclusiva não reutilizável',async()=>{
  const c=await create();const rr=await renew(intent(await quote(c)));
  const partial=await receipt(c,rr.sucessoraId,db,'1.00');assert.equal(partial.status,'parcial');assert.equal(partial.contratoStatus,'ativo');
  const full=await receipt(c,rr.sucessoraId);assert.equal(full.status,'paga');assert.equal(full.contratoStatus,'quitado');
  await rejects(()=>db.query('INSERT INTO renovacao_provas SELECT * FROM renovacao_provas WHERE operacao_id=$1',[rr.operationId]),'23505');
  await rejects(()=>db.query("UPDATE renovacao_operacoes SET resultado='{}' WHERE id=$1",[rr.operationId]),'42501');
 });
 await test('valores insuficientes, extras, NaN, data impossível, hashes e tenant não escrevem nada',async()=>{
  const c=await create();const q=await quote(c);const i=intent(q);const before=await state();
  for(const patch of [{recebido:'0.01',total:'0.01'},{recebido:'1.00'},{recebido:'0.001',total:'0.001'},{recebido:'NaN',total:'NaN'},{recebido:'Infinity',total:'Infinity'},{recebido:'0.00',total:'0.00'}])await rejects(()=>renew({...i,...patch}),patch.recebido==='0.01'?'40001':'22023');
  for(const patch of [{hash:'f'.repeat(64)},{qhash:'f'.repeat(64)},{date:'2026-01-01'}])await rejects(()=>renew({...i,...patch}),'40001');
  await rejects(()=>renew({...i,date:'2026-02-31'}),'22008');await rejects(()=>renew({...i,tenant:2}),'42501');await rejects(()=>quote(c,900),'42501');await rejects(()=>quote({id:900,parcelasIds:[900]}),'42501');
  assert.deepEqual(await state(),before);
 });
 await test('múltiplas parcelas, parcial anterior sem alocação e integral anterior bloqueados',async()=>{
  const c=await create({n:2,datas:['2026-11-10','2026-12-10']});await rejects(()=>quote(c),'23514');
  const p=await create();await receipt(p,p.parcelasIds[0],db,'55.60');await rejects(()=>quote(p),'23514');
  const paid=await create();await receipt(paid);await rejects(()=>quote(paid),'23514');
 });
 await test('0021 sem snapshot 0022, desconto/amortização adulterados recusados e preservados',async()=>{
  const prior=(await db.query('SELECT r FROM test_before_0022')).rows[0].r;await rejects(()=>quote(prior),'23514');
  assert.equal((await db.query('SELECT count(*)::int n FROM ciclo_estados WHERE contrato_id=$1',[prior.id])).rows[0].n,0);
  for(const patch of ['valor_desconto=1.00','valor_original=1054.63','valor_pago=55.60','multa_manual=1.00']){
   const c=await create(); // DBA adversarial somente local demonstra que mesmo drift fora do guard não é adotado.
   await db.query('ALTER TABLE parcelas DISABLE TRIGGER ciclo_parcela');
   await db.query(`UPDATE parcelas SET ${patch} WHERE id=$1`,[c.parcelasIds[0]]);
   await db.query('ALTER TABLE parcelas ENABLE TRIGGER ciclo_parcela');
   const before=await state();await rejects(()=>quote(c),'23514');assert.deepEqual(await state(),before);
  }
 });
 await test('BRT virada, timezone sessão, calendário clamp explícito e encargos exatos',async()=>{
  const c=await create({datas:['2026-11-08']});
  for(const tz of ['UTC','Pacific/Kiritimati','Etc/GMT+12','America/Sao_Paulo']){
   await db.query(`SET TIME ZONE '${tz}'`);
   const before=(await db.query('SELECT renovacao_cotacao(1,$1,$2,$3::timestamptz) r',[c.id,c.parcelasIds[0],'2026-11-09T02:59:59.999Z'])).rows[0].r;
   const after=(await db.query('SELECT renovacao_cotacao(1,$1,$2,$3::timestamptz) r',[c.id,c.parcelasIds[0],'2026-11-09T03:00:00Z'])).rows[0].r;
   assert.equal(before.multa,'0.00');assert.equal(before.mora,'0.00');assert.equal(after.multa,'21.11');assert.equal(after.mora,'0.35');assert.notEqual(before.cotacaoHash,after.cotacaoHash);
  }
  await db.query("SET TIME ZONE 'UTC'");
  const jan=await create({datas:['2027-01-31']});const q=(await db.query("SELECT renovacao_cotacao(1,$1,$2,'2027-01-31T18:00Z'::timestamptz) r",[jan.id,jan.parcelasIds[0]])).rows[0].r;
  assert.equal(q.novoVencimento,'2027-02-28');assert.equal(q.totalExigido,'55.60');
  await db.query("SET TIME ZONE 'UTC'");
  const qlate=await quote(c);const done=await renew(intent(qlate));assert.equal(done.valorRecebido,qlate.totalExigido);assert.equal(done.multaPaga,qlate.multa);assert.equal(done.moraPaga,qlate.mora);
 });
 await test('guards original permanecem contra manual/status legado/prova falsa/capacidade GUC',async()=>{
  const before=await state();
  await db.query("SET app.renovacao='true'");
  for(const sql of ["UPDATE contas_caixa SET saldo=999 WHERE id=1",`UPDATE contratos SET valor_principal=1 WHERE id=${first.id}`,`UPDATE parcelas SET valor_pago=999 WHERE contrato_id=${first.id}`,`INSERT INTO parcelas(contrato_id,numero,valor,data_vencimento) VALUES(${first.id},3,1,CURRENT_DATE)`,`INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao) VALUES(1,1,'entrada','renovacao_juros',1,'falso',CURRENT_DATE)`,`UPDATE transacoes_caixa SET valor=1 WHERE contrato_id=${first.id}`,`DELETE FROM contrato_historico WHERE contrato_id=${first.id}`,"UPDATE parcelas SET status='renovada' WHERE id=900",'DELETE FROM renovacao_provas'])await rejects(()=>db.query(sql),'42501');
  assert.deepEqual(await state(),before);
  for(const role of ['anon','authenticated','service_role']){
   await db.query(`SET ROLE ${role}`);
   for(const t of ['renovacao_operacoes','renovacao_provas','renovacao_capacidades'])await rejects(()=>db.query(`SELECT * FROM ${t}`),'42501');
   await rejects(()=>db.query("SELECT renovacao_consumir_capacidade('parcelas','INSERT',NULL,'{}'::jsonb)"),'42501');
   if(role!=='service_role')await rejects(()=>quote(pre),'42501');
   await db.query('RESET ROLE');
  }
 });
 await test('rollback após CADA escrita: zero alteração monetária/ciclo/prova e retry funciona',async()=>{
  await db.query(`CREATE FUNCTION test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fail injected' USING ERRCODE='P0001'; END $$`);
  for(const [table,event] of [['renovacao_operacoes','INSERT'],['renovacao_capacidades','INSERT'],['renovacao_capacidades','DELETE'],['parcelas','UPDATE'],['parcelas','INSERT'],['transacoes_caixa','INSERT'],['renovacao_provas','INSERT'],['contratos','UPDATE'],['contrato_historico','INSERT'],['ciclo_estados','UPDATE'],['renovacao_operacoes','UPDATE']]){
   const c=await create();const i=intent(await quote(c));const before=await state();
   await db.query(`CREATE TRIGGER test_failure AFTER ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_fail()`);
   await rejects(()=>renew(i),'P0001');assert.deepEqual(await state(),before);
   await db.query(`DROP TRIGGER test_failure ON ${table}`);assert.equal((await renew(i)).repetida,false);
  }
 });
 await test('concorrência real oito replays UUID: uma entrada, uma prova e um sucessor',async()=>{
  const c=await create();const i=intent(await quote(c));const clients=await Promise.all(Array.from({length:8},async()=>{const x=new pg.Client(config);await x.connect();await x.query("SET statement_timeout='10s'");return x;}));
  try{const out=await Promise.all(clients.map(x=>renew(i,x)));assert.equal(out.filter(x=>!x.repetida).length,1);assert.equal(new Set(out.map(x=>x.sucessoraId)).size,1);}finally{await Promise.all(clients.map(x=>x.end()));}
 });
 await test('cotação expira APÓS espera real no lock; zero escrita em virada BRT simulada',async()=>{
  // Instrumentação SOMENTE no banco sintético; função real restaurada antes dos demais testes.
  const def=(await db.query("SELECT pg_get_functiondef('rpc_renovar_emprestimo_prospectivo(integer,uuid,integer,integer,numeric,numeric,date,text,text)'::regprocedure) d")).rows[0].d;
  await db.query('CREATE TABLE test_clock(v timestamptz NOT NULL)');
  await db.query('INSERT INTO test_clock VALUES(clock_timestamp())');
  await db.query("CREATE FUNCTION test_clock_fn() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT v FROM public.test_clock $$");
  await db.query(def.replaceAll('clock_timestamp()', 'public.test_clock_fn()'));
  const c=await create();const i=intent(await quote(c));const before=await state();
  const x=new pg.Client(config),y=new pg.Client(config);await x.connect();await y.connect();
  try{
   await x.query('BEGIN');await x.query('SELECT pg_advisory_xact_lock(22022,1)');
   const pending=renew(i,y).then(r=>({r}),error=>({error}));
   let waiting=false;
   for(let n=0;n<40;n++){
    waiting=(await db.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='advisory') w",[y.processID])).rows[0].w;
    if(waiting)break;await new Promise(r=>setTimeout(r,10));
   }
   assert(waiting,'renovação realmente aguardou advisory lock');
   await x.query("UPDATE test_clock SET v=(($1::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')",[i.date]);
   await x.query('COMMIT');const out=await pending;assert.equal(out.error?.code,'40001');assert.deepEqual(await state(),before);
  }finally{await x.query('ROLLBACK');await x.end();await y.end();await db.query(def);await db.query('DROP FUNCTION test_clock_fn();DROP TABLE test_clock');}
  assert.equal((await renew(i)).repetida,false);
 });
 await test('concorrência dois UUID renovação e renovação versus recebimento: sem deadlock/duplicidade',async()=>{
  for(const receiving of [false,true]){
   const c=await create();const q=await quote(c);const x=new pg.Client(config),y=new pg.Client(config);await x.connect();await y.connect();
   await x.query("SET statement_timeout='10s'");await y.query("SET statement_timeout='10s'");
   // Recebimento precisa cotação ANTES das escritas concorrentes.
   const cq=(await y.query('SELECT rpc_cotar_emprestimo_prospectivo(1,$1,$2) r',[c.id,q.parcelaId])).rows[0].r;
   try{
    const other=()=>receiving?y.query('SELECT rpc_receber_emprestimo_prospectivo(1,$1::uuid,$2,$3,$4::numeric,$4::numeric,$5::date,$6,\'integral\',NULL)',[randomUUID(),c.id,q.parcelaId,cq.totalExigido,cq.dataPagamento,cq.estadoHash]):renew(intent(q),y);
    const out=await Promise.allSettled([renew(intent(q),x),other()]);assert.equal(out.filter(z=>z.status==='fulfilled').length,1);
    const error=out.find(z=>z.status==='rejected').reason;assert(['23514','40001'].includes(error.code),error.message);
    assert.equal((await db.query("SELECT count(*)::int n FROM transacoes_caixa WHERE parcela_id=$1 AND tipo='entrada'",[q.parcelaId])).rows[0].n,1);
   }finally{await x.end();await y.end();}
  }
 });
 await test('hash prova, ledger e conservações finais; origem/legado intactos',async()=>{
  const rows=(await db.query(`SELECT r.valor_recebido::text,r.juros_pagos::text,r.multa_paga::text,r.mora_paga::text,r.principal_antes::text,r.principal_depois::text,r.principal_pago::text,t.valor::text v,
  r.perna_snapshot=to_jsonb(t) same,o.auditoria->'prova'=to_jsonb(r) proof,o.hash_payload=encode(extensions.digest(o.payload::text,'sha256'),'hex') hash
  FROM renovacao_provas r JOIN transacoes_caixa t ON t.id=r.transacao_id JOIN renovacao_operacoes o ON o.id=r.operacao_id`)).rows;
  const cents=v=>BigInt(v.replace('.',''));
  for(const x of rows){assert(x.same&&x.proof&&x.hash);assert.equal(x.valor_recebido,x.v);assert.equal(cents(x.valor_recebido),cents(x.juros_pagos)+cents(x.multa_paga)+cents(x.mora_paga));assert.equal(x.principal_antes,x.principal_depois);assert.equal(x.principal_pago,'0.00');}
  assert.deepEqual((await db.query('SELECT to_jsonb(c) c FROM contratos c WHERE id=900')).rows[0],legacy);
 });
 await test('migration one-shot recusa segunda instalação sem DDL residual',async()=>{await rejects(()=>db.query(migration),'P0001');await db.query('ROLLBACK');});
 console.log(`RESULT ${passed} PASS`);
}finally{await db.end();}
