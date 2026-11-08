import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [host,user,project]=process.argv.slice(2);
assert(host.startsWith('/tmp/cobrapro-loan-cycle-pg17-')&&host.endsWith('/socket'));
const config={host,user,database:'postgres',port:55440};
const db=new pg.Client(config);await db.connect();
let passed=0;
async function test(name,fn){await fn();console.log(`PASS ${++passed} ${name}`);}
async function rejects(fn,code){await assert.rejects(fn,e=>e.code===code);}
async function create(over={},client=db){
 const v={tenant:1,key:randomUUID(),cliente:1,conta:1,mod:'mensal',tipo:'mensal',principal:'100.00',taxa:'10.00',n:2,inicio:'2026-01-01',desembolso:'2026-01-01',datas:['2026-02-01','2026-03-01'],descricao:null,obs:null,...over};
 return (await client.query('SELECT public.rpc_criar_emprestimo($1::int,$2::uuid,$3::int,$4::int,$5::text,$6::text,$7::numeric,$8::numeric,$9::int,$10::date,$11::date,$12::date[],$13::text,$14::text) r',Object.values(v))).rows[0].r;
}
async function quote(c,p=c.parcelasIds[0],tenant=1,client=db){return(await client.query('SELECT public.rpc_cotar_emprestimo_prospectivo($1,$2,$3) r',[tenant,c.id,p])).rows[0].r;}
function intent(q,over={}){return {tenant:1,key:randomUUID(),c:q.contratoId,p:q.parcelaId,recebido:q.totalExigido,total:q.totalExigido,date:q.dataPagamento,hash:q.estadoHash,modo:'integral',obs:null,...over};}
async function receive(i,client=db){return(await client.query('SELECT public.rpc_receber_emprestimo_prospectivo($1::int,$2::uuid,$3::int,$4::int,$5::numeric,$6::numeric,$7::date,$8::text,$9::text,$10::text) r',Object.values(i))).rows[0].r;}
async function state(){return(await db.query(`SELECT jsonb_build_object('c',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contratos c),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),'h',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM contrato_historico h),'o',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM ciclo_operacoes o),'e',(SELECT jsonb_agg(to_jsonb(e) ORDER BY contrato_id) FROM ciclo_estados e),'l',(SELECT jsonb_agg(to_jsonb(l) ORDER BY operacao_id) FROM ciclo_pernas l),'a',(SELECT jsonb_agg(to_jsonb(a)) FROM ciclo_autorizacoes a)) s`)).rows[0].s;}
async function legacy(){return(await db.query(`SELECT jsonb_build_object('c',(SELECT to_jsonb(c) FROM contratos c WHERE id=900),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p WHERE contrato_id=900),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t WHERE conta_caixa_id IN(4,5))) s`)).rows[0].s;}
const old=await legacy();
try{
 await test('PG17 socket-only e schema DATE real',async()=>{
  assert.match((await db.query('SHOW server_version')).rows[0].server_version,/^17\./);
  assert.equal((await db.query('SHOW listen_addresses')).rows[0].listen_addresses,'');
 });
 let first;
 await test('snapshot completo em criação futura e elegibilidade RPC backend-only',async()=>{
  await db.query('SET ROLE service_role');first=await create();const q=await quote(first);await db.query('RESET ROLE');
  assert(q.elegivel);assert.equal(q.jurosEmbutidos,'10.00');
  assert.equal((await db.query('SELECT origem_completa FROM ciclo_estados WHERE contrato_id=$1',[first.id])).rows[0].origem_completa,true);
  assert.equal((await db.query('SELECT count(*)::int n FROM ciclo_autorizacoes')).rows[0].n,0);
 });
 await test('0021 anterior intacta elegível sem backfill e adulteradas recusadas',async()=>{
  const rows=(await db.query('SELECT nome,r FROM test_origens ORDER BY nome')).rows;
  for(const x of rows){if(x.nome==='intacta'){assert((await quote(x.r)).elegivel);assert.equal((await db.query('SELECT count(*)::int n FROM ciclo_estados WHERE contrato_id=$1',[x.r.id])).rows[0].n,0);}
   else await rejects(()=>quote(x.r),'23514');}
 });
 await test('BRT 23:59 até virar dia, tz sessão independente; mora não juros embutidos',async()=>{
  for(const tz of ['UTC','Pacific/Kiritimati','Etc/GMT+12','America/Sao_Paulo']){
   await db.query(`SET TIME ZONE '${tz}'`);
   const rows=(await db.query(`SELECT public.ciclo_encargos(110,2,0.033,DATE '2026-11-08',$1::timestamptz) r`,['2026-11-09T02:59:59.999Z'])).rows;
   assert.deepEqual(rows[0].r,{dias:0,multa:0,mora:0});
   const after=(await db.query(`SELECT public.ciclo_encargos(110,2,0.033,DATE '2026-11-08',$1::timestamptz) r`,['2026-11-09T03:00:00Z'])).rows[0].r;
   assert.deepEqual(after,{dias:1,multa:2.2,mora:0.04});
  }
  await db.query("SET TIME ZONE 'UTC'");
  const hoje=(await db.query("SELECT ((statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date)::text hoje")).rows[0].hoje;
  const c=await create({n:1,datas:[hoje],taxa:'10'});const q=await quote(c);
  assert.equal(q.totalExigido,'110.00');assert.equal(q.multa,'0.00');assert.equal(q.mora,'0.00');assert.equal(q.jurosEmbutidos,'10.00');
 });
 await test('parcial depois integral conserva residual/encargos, receita exata, todas pagas quita',async()=>{
  const q=await quote(first);const i=intent(q,{recebido:'10.00',modo:'parcial'});const r=await receive(i);
  assert.equal(r.status,'parcial');assert.equal(r.contratoStatus,'ativo');
  assert.equal(r.saldoResidual,(Number(q.totalExigido)-10).toFixed(2));assert.equal(r.valorPagoAcumulado,'10.00');
  const same=await receive(i);assert.deepEqual(same,{...r,repetida:true});
  const q2=await quote(first);assert.equal(q2.totalExigido,r.saldoResidual);assert.equal(q2.multa,q.multa);assert.equal(q2.mora,q.mora);
  const r2=await receive(intent(q2));assert.equal(r2.status,'paga');assert.equal(r2.contratoStatus,'ativo');assert.equal(r2.saldoResidual,'0.00');
  const q3=await quote(first,first.parcelasIds[1]);const r3=await receive(intent(q3));assert.equal(r3.contratoStatus,'quitado');
  const sums=(await db.query(`SELECT p.id,p.valor_pago,coalesce(sum(t.valor),0)::text receipts FROM parcelas p LEFT JOIN transacoes_caixa t ON t.parcela_id=p.id AND t.tipo='entrada' WHERE p.contrato_id=$1 GROUP BY p.id ORDER BY p.id`,[first.id])).rows;
  for(const x of sums)assert.equal(x.valor_pago,x.receipts);
  assert.equal((await db.query('SELECT saldo FROM contas_caixa WHERE id=1')).rows[0].saldo,'1000.00');
  assert.equal((await db.query('SELECT count(*)::int n FROM ciclo_pernas')).rows[0].n,3);
 });
 await test('idempotência mismatch, stale quote, valores, excesso, desconto e tenant',async()=>{
  const c=await create();const q=await quote(c);const i=intent(q);const before=await state();
  for(const patch of [{tenant:2},{p:900}])await rejects(()=>receive({...i,...patch}),'42501');
  for(const patch of [{recebido:'0.00'},{recebido:'0.001'},{recebido:'NaN'},{recebido:'Infinity'},{recebido:'1.00'},{recebido:q.totalExigido,modo:'parcial'}])await rejects(()=>receive({...i,...patch}),'22023');
  for(const patch of [{hash:'f'.repeat(64)},{total:'1.00'},{date:'2026-01-01'}])await rejects(()=>receive({...i,...patch}),'40001');
  await rejects(()=>quote({id:900,parcelasIds:[900]}),'42501');assert.deepEqual(await state(),before);
  const done=await receive(i);await rejects(()=>receive({...i,obs:'outro'}),'23505');
  assert.deepEqual(await receive(i),{...done,repetida:true});
 });
 await test('guardas owner/conta/manual/ledger/parcelas/histórico e acesso privado',async()=>{
  const before=await state();
  for(const sql of [`UPDATE contas_caixa SET user_id=2 WHERE id=1`,`UPDATE contas_caixa SET saldo=999 WHERE id=1`,`DELETE FROM transacoes_caixa WHERE contrato_id=${first.id}`,`UPDATE transacoes_caixa SET valor=1 WHERE contrato_id=${first.id}`,`INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao) VALUES(1,1,'entrada','outros',1,'manual',CURRENT_DATE)`,`UPDATE contratos SET valor_principal=1 WHERE id=${first.id}`,`UPDATE parcelas SET valor_pago=999 WHERE contrato_id=${first.id}`,`INSERT INTO parcelas(contrato_id,numero,valor,data_vencimento) VALUES(${first.id},3,1,CURRENT_DATE)`,`DELETE FROM contrato_historico WHERE contrato_id=${first.id}`])await rejects(()=>db.query(sql),'42501');
  assert.deepEqual(await state(),before);
  for(const role of ['anon','authenticated','service_role']){
   await db.query(`SET ROLE ${role}`);
   for(const table of ['ciclo_estados','ciclo_operacoes','ciclo_pernas','ciclo_autorizacoes','emprestimos_rpc_origens'])await rejects(()=>db.query(`SELECT * FROM ${table}`),'42501');
   await rejects(()=>db.query(`SELECT public.ciclo_autorizar('receber',1,${first.id})`),'42501');
   if(role!=='service_role')await rejects(()=>quote(first),'42501');
   await db.query('RESET ROLE');
  }
 });
 await test('rollback em TODAS escritas e retry mesmo UUID',async()=>{
  await db.query(`CREATE FUNCTION test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fail injected' USING ERRCODE='P0001'; END $$`);
  for(const [table,event] of [['ciclo_operacoes','INSERT'],['ciclo_estados','INSERT'],['ciclo_autorizacoes','INSERT'],['parcelas','UPDATE'],['transacoes_caixa','INSERT'],['ciclo_pernas','INSERT'],['contratos','UPDATE'],['contrato_historico','INSERT'],['ciclo_estados','UPDATE'],['ciclo_operacoes','UPDATE'],['ciclo_autorizacoes','DELETE']]){
   // origem anterior intacta cobre INSERT do estado, demais usam futuras.
   const c=table==='ciclo_estados'&&event==='INSERT'?(await db.query("SELECT r FROM test_origens WHERE nome='intacta'")).rows[0].r:await create();
   const i=intent(await quote(c));const before=await state();
   await db.query(`CREATE TRIGGER test_failure AFTER ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_fail()`);
   await rejects(()=>receive(i),'P0001');assert.deepEqual(await state(),before);
   await db.query(`DROP TRIGGER test_failure ON ${table}`);
   assert.equal((await receive(i)).repetida,false);
  }
 });
 await test('concorrência 8 replays mesma chave, um recebimento',async()=>{
  const c=await create();const i=intent(await quote(c));const clients=await Promise.all(Array.from({length:8},async()=>{const x=new pg.Client(config);await x.connect();return x;}));
  try{const r=await Promise.all(clients.map(x=>receive(i,x)));assert.equal(r.filter(x=>!x.repetida).length,1);assert.equal(new Set(r.map(x=>x.transacaoCaixaId)).size,1);}finally{await Promise.all(clients.map(x=>x.end()));}
 });
 await test('concorrência full/full e partial/full stale; sem pagamento perdido',async()=>{
  for(const partial of [false,true]){
   const c=await create();const q=await quote(c);const a=intent(q,partial?{recebido:'1.00',modo:'parcial'}:{});const b=intent(q);
   const x=new pg.Client(config),y=new pg.Client(config);await x.connect();await y.connect();
   try{const rs=await Promise.allSettled([receive(a,x),receive(b,y)]);assert.equal(rs.filter(r=>r.status==='fulfilled').length,1);assert.equal(rs.filter(r=>r.status==='rejected')[0].reason.code,'40001');
    assert.equal((await db.query('SELECT count(*)::int n FROM transacoes_caixa WHERE parcela_id=$1 AND tipo=\'entrada\'',[q.parcelaId])).rows[0].n,1);
   }finally{await x.end();await y.end();}
  }
 });
 await test('owner conta trocado durante lock recusado, sem adoção/reparo',async()=>{
  const c=await create({tenant:2,cliente:2,conta:2});const i=intent(await quote(c,c.parcelasIds[0],2),{tenant:2});
  const x=new pg.Client(config);await x.connect();await x.query('BEGIN');await x.query('SELECT pg_advisory_xact_lock(22022,2)');
  const pending=receive(i).then(r=>({r}),error=>({error}));await new Promise(r=>setTimeout(r,80));
  // Simula DBA adversarial ignorando trigger (fora do modelo service_role).
  await x.query('ALTER TABLE contas_caixa DISABLE TRIGGER ciclo_conta');await x.query('UPDATE contas_caixa SET user_id=1 WHERE id=2');await x.query('ALTER TABLE contas_caixa ENABLE TRIGGER ciclo_conta');await x.query('COMMIT');await x.end();
  assert.equal((await pending).error.code,'42501');
  assert.equal((await db.query('SELECT count(*)::int n FROM ciclo_operacoes WHERE contrato_id=$1',[c.id])).rows[0].n,0);
 });
 await test('preflight homônimo/overload fechado e instalação one-shot atômica',async()=>{
  const sql=readFileSync(`${project}/drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql`,'utf8');
  await rejects(()=>db.query(sql),'P0001');await db.query('ROLLBACK');
  await db.query(`CREATE FUNCTION public.rpc_criar_emprestimo(text) RETURNS text LANGUAGE sql AS $$ SELECT $1 $$`);
  await rejects(()=>db.query(sql),'P0001');await db.query('ROLLBACK');await db.query('DROP FUNCTION public.rpc_criar_emprestimo(text)');
 });
 await test('0013/15 ainda recusadas por legado e comparação legado intacto',async()=>{
  for(const n of ['0013_integridade_parcelas.sql','0015_rpc_recebimento_parcela.sql']){
   await db.query('BEGIN');await rejects(()=>db.query(readFileSync(`${project}/drizzle/${n}`,'utf8')),'P0001');await db.query('ROLLBACK');
  }
  assert.deepEqual(await legacy(),old);
 });
 console.log(`RESULT ${passed} PASS`);
}finally{await db.end();}
