import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [host,user,project]=process.argv.slice(2);
assert(host.startsWith('/tmp/cobrapro-legados-pg17-') && host.endsWith('/socket'));
const cfg={host,user,database:'postgres',port:55474};
const db=new pg.Client(cfg); await db.connect();
let count=0;
const test=async(name,fn)=>{await fn();console.log(`PASS ${++count} ${name}`);};
const rejects=async(fn,code)=>assert.rejects(fn,e=>e.code===code);
const sql=async(q,v=[],client=db)=>(await client.query(q,v)).rows;
async function quote(c,p=c.p[0],a=c.a,u=1,client=db){return(await sql('SELECT public.rpc_cotar_recebimento_legado($1,$2,$3,$4) r',[u,c.id,p,a],client))[0].r;}
function intent(q,patch={}){return {u:1,key:randomUUID(),c:q.contratoId,p:q.parcelaId,a:q.contaCaixaId,valor:q.totalExigido,total:q.totalExigido,dia:q.dataPagamento,hash:q.estadoHash,regra:q.regra,obs:null,...patch};}
async function receive(i,client=db){return(await sql('SELECT public.rpc_receber_legado($1::int,$2::uuid,$3::int,$4::int,$5::int,$6::text,$7::text,$8::date,$9::text,$10::text,$11::text) r',Object.values(i),client))[0].r;}
async function fixture(n=1){
 const a=(await sql("INSERT INTO contas_caixa(user_id,nome,saldo) VALUES(1,'Sintético',-50) RETURNING id"))[0].id;
 const c=(await sql("INSERT INTO contratos(user_id,cliente_id,conta_caixa_id,modalidade,valor_principal,valor_parcela,total_contrato,data_inicio,num_parcelas,numero_parcelas) VALUES(1,1,$1,'mensal',100,100,100*$2,'2026-01-01',$2,$2) RETURNING id",[a,n]))[0].id;
 const p=[];
 for(let i=1;i<=n;i++)p.push((await sql("INSERT INTO parcelas(user_id,cliente_id,contrato_id,numero,numero_parcela,valor,valor_original,valor_pago,data_vencimento,conta_caixa_id) VALUES(1,1,$1,$2,$2,100,100,0,'2026-01-01',$3) RETURNING id",[c,i,a]))[0].id);
 return {id:c,p,a};
}
async function snapshot(){return(await sql(`SELECT jsonb_build_object(
 'c',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contratos c),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p),
 'a',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),
 'h',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM contrato_historico h),'o',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM legados_operacoes o),
 'au',(SELECT jsonb_agg(to_jsonb(a) ORDER BY operacao_id) FROM legados_auditoria a),'e',(SELECT jsonb_agg(to_jsonb(e) ORDER BY contrato_id) FROM legados_estados e),
 'cap',(SELECT jsonb_agg(to_jsonb(c)) FROM legados_capacidades c)) s`))[0].s;}
async function ineligible(name,mutation,motivo){await test(name,async()=>{const c=await fixture(2);await mutation(c);const before=await snapshot();const q=await quote(c);assert.equal(q.elegivel,false);if(motivo)assert(q.motivos.includes(motivo),JSON.stringify(q));const fake=intent({contratoId:c.id,parcelaId:c.p[0],contaCaixaId:c.a,totalExigido:'100.00',dataPagamento:'2026-11-10',estadoHash:'f'.repeat(64),regra:'recebimento_legado_sem_recalculo_v1'});await assert.rejects(()=>receive(fake));assert.deepEqual(await snapshot(),before);});}
async function newClient(){const c=new pg.Client(cfg);await c.connect();await c.query("SET statement_timeout='8s'");return c;}
async function waitLock(client,pid){for(let j=0;j<300;j++){const r=await sql("SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1",[pid]);if(r[0]?.wait_event_type==='Lock')return r[0];await new Promise(r=>setTimeout(r,10));}throw Error('No genuine lock wait');}
try{
 await test('PG17 socket privado, ambiente limpo, metadata intacta e reaplicação',async()=>{
  assert.match((await sql('SHOW server_version'))[0].server_version,/^17\./);assert.equal((await sql('SHOW listen_addresses'))[0].listen_addresses,'');
  assert.equal((await sql('SELECT assinatura=public.legados_metadata() ok FROM legados_manifesto'))[0].ok,true);
  await db.query(readFileSync(`${project}/drizzle/0034_rpc_recebimento_legado_validado.sql`,'utf8'));
 });
 await test('cotação sem reserva e elegível integral delta ledger, original NULL imutável, saldo-base negativo preservado',async()=>{
  const c=await fixture(2);await sql('UPDATE parcelas SET valor_original=NULL,valor_pago=NULL,observacoes=\'histórico\',status=\'atrasado\' WHERE id=$1',[c.p[0]]);
  await sql("UPDATE contratos SET status='atrasado' WHERE id=$1",[c.id]);
  const before=await snapshot();await sql('SET ROLE service_role');const q=await quote(c);await sql('RESET ROLE');assert(q.elegivel);assert.deepEqual(await snapshot(),before);
  const i=intent(q);await sql('SET ROLE service_role');const r=await receive(i);await sql('RESET ROLE');assert.equal(r.contratoStatus,'atrasado');assert.equal(r.valorRecebido,'100.00');
  const p=(await sql('SELECT to_jsonb(p) p FROM parcelas p WHERE id=$1',[c.p[0]]))[0].p;
  for(const field of ['valor','valor_original','numero','numero_parcela','user_id','cliente_id','conta_caixa_id','data_vencimento','observacoes','valor_juros','valor_multa','valor_desconto','multa_manual','multa_diaria_usada'])assert.deepEqual(p[field],before.p.find(x=>x.id===c.p[0])[field],field);
  assert.equal(p.valor_pago,100);assert.equal(p.saldo_residual,0);assert.equal(p.status,'paga');assert.equal(p.data_pagamento,q.dataPagamento);
  assert.equal((await sql('SELECT saldo FROM contas_caixa WHERE id=$1',[c.a]))[0].saldo,'-50.00');
  assert.equal((await sql('SELECT count(*)::int n,sum(valor)::text v FROM transacoes_caixa WHERE parcela_id=$1',[c.p[0]]))[0].n,1);
  assert.equal((await sql('SELECT count(*)::int n FROM emprestimos_rpc_origens WHERE contrato_id=$1',[c.id]))[0].n,0);
  const retry=await receive(i);assert.deepEqual(retry,{...r,repetida:true});
  const after=await snapshot();await rejects(()=>receive({...i,obs:'diferente'}),'23505');assert.deepEqual(await snapshot(),after);
  const q2=await quote(c,c.p[1]);assert(q2.elegivel);assert.equal((await receive(intent(q2))).contratoStatus,'quitado');
  await rejects(()=>sql('UPDATE parcelas SET observacoes=\'mutação\' WHERE id=$1',[c.p[0]]),'42501');
  await rejects(()=>sql('UPDATE transacoes_caixa SET valor=1 WHERE parcela_id=$1',[c.p[0]]),'42501');
  await rejects(()=>sql('UPDATE contas_caixa SET saldo=0 WHERE id=$1',[c.a]),'42501');
  await rejects(()=>sql('UPDATE clientes SET user_id=2 WHERE id=1'),'42501');
  await rejects(()=>sql("UPDATE legados_operacoes SET payload='{}'::jsonb WHERE id=$1",[r.operationId]),'42501');
 });
 await test('DATE Brasília, fusos extremos; stale hash/total/dia sem reserva',async()=>{
  const c=await fixture();const q=await quote(c);const i=intent(q);const before=await snapshot();
  for(const patch of [{hash:'f'.repeat(64)},{dia:'2020-01-01'},{valor:'1.00',total:'1.00'}])await rejects(()=>receive({...i,...patch}),'40001');
  assert.deepEqual(await snapshot(),before);
  for(const zone of ['UTC','Pacific/Kiritimati','Etc/GMT+12']){await sql(`SET TIME ZONE '${zone}'`);const q2=await quote(c);assert.equal(q2.dataPagamento,q.dataPagamento);assert.equal(q2.estadoHash,q.estadoHash);}
  await sql("SET TIME ZONE 'UTC'");await sql('UPDATE parcelas SET observacoes=\'estado alterado\' WHERE id=$1',[c.p[0]]);await rejects(()=>receive(i),'40001');
 });
 await test('entrada exata: NaN/Infinity/precisão/limite/zero/desconto e regra',async()=>{
  const c=await fixture();const i=intent(await quote(c));const before=await snapshot();
  for(const value of ['NaN','Infinity','0.001','100.000','01.00','1e2','10000000000.00','0.00'])await rejects(()=>receive({...i,valor:value,total:value}),'22023');
  for(const patch of [{valor:'50.00'},{regra:'outra'},{obs:'x'.repeat(1001)}])await rejects(()=>receive({...i,...patch}),'22023');
  assert.deepEqual(await snapshot(),before);
 });
 for(const [name,mutation,motivo] of [
  ['target owner NULL',c=>sql('UPDATE parcelas SET user_id=NULL WHERE id=$1',[c.p[0]]),'TENANT_AUSENTE_OU_DIVERGENTE'],
  ['descendente owner NULL não omitido',c=>sql('UPDATE parcelas SET user_id=NULL,cliente_id=NULL WHERE id=$1',[c.p[1]]),'TENANT_AUSENTE_OU_DIVERGENTE'],
  ['descendente owner externo',c=>sql('UPDATE parcelas SET user_id=2 WHERE id=$1',[c.p[1]]),'TENANT_AUSENTE_OU_DIVERGENTE'],
  ['contrato owner NULL',c=>sql('UPDATE contratos SET user_id=NULL WHERE id=$1',[c.id]),'TENANT_AUSENTE_OU_DIVERGENTE'],
  ['cliente externo',c=>sql('UPDATE contratos SET cliente_id=2 WHERE id=$1',[c.id]),'TENANT_AUSENTE_OU_DIVERGENTE'],
  ['conta owner externo',c=>sql('UPDATE contas_caixa SET user_id=2 WHERE id=$1',[c.a]),'TENANT_AUSENTE_OU_DIVERGENTE'],
  ['koletor externo',c=>sql('UPDATE parcelas SET koletor_id=2 WHERE id=$1',[c.p[0]]),'TENANT_AUSENTE_OU_DIVERGENTE'],
  ['alias número ausente',c=>sql('UPDATE parcelas SET numero_parcela=NULL WHERE id=$1',[c.p[0]]),'ALIAS_DIVERGENTE'],
  ['alias número divergente',c=>sql('UPDATE parcelas SET numero_parcela=4 WHERE id=$1',[c.p[0]]),'ALIAS_DIVERGENTE'],
  ['duplicidade inclui owner NULL',c=>sql('UPDATE parcelas SET numero=1,numero_parcela=1 WHERE id=$1',[c.p[1]]),'DESCENDENTE_INVALIDO'],
  ['valor original divergente',c=>sql('UPDATE parcelas SET valor_original=101 WHERE id=$1',[c.p[0]]),'PRINCIPAL_INVALIDO'],
  ['juros embutidos não inferidos',c=>sql('UPDATE parcelas SET valor_juros=1 WHERE id=$1',[c.p[0]]),'ENCARGOS_AMBIGUOS'],
  ['multa anterior',c=>sql('UPDATE parcelas SET valor_multa=1 WHERE id=$1',[c.p[0]]),'ENCARGOS_AMBIGUOS'],
  ['desconto anterior',c=>sql('UPDATE parcelas SET valor_desconto=1 WHERE id=$1',[c.p[0]]),'ENCARGOS_AMBIGUOS'],
  ['encargo NULL',c=>sql('UPDATE parcelas SET multa_manual=NULL WHERE id=$1',[c.p[0]]),'ENCARGOS_AMBIGUOS'],
  ['parcial bloqueado',c=>sql("UPDATE parcelas SET status='parcial',valor_pago=10,saldo_residual=90 WHERE id=$1",[c.p[0]]),'ESTADO_NAO_SUPORTADO'],
  ['pago sem caixa bloqueado',c=>sql('UPDATE parcelas SET valor_pago=10 WHERE id=$1',[c.p[0]]),'LEDGER_DIVERGENTE_OU_AMBIGUO'],
  ['reparcelamento bloqueado',c=>sql("UPDATE contratos SET modalidade='reparcelamento' WHERE id=$1",[c.id]),'ESTADO_NAO_SUPORTADO'],
  ['origem antiga não remapeada',c=>sql('UPDATE contratos SET contrato_origem_id=900 WHERE id=$1',[c.id]),'ESTADO_NAO_SUPORTADO'],
  ['ledger parcela estrangeiro',c=>sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor,descricao,data_transacao) VALUES(2,$1,$2,$3,'entrada','pagamento_parcela',100,'sintético','2026-01-01')",[c.a,c.id,c.p[0]]),'LEDGER_DIVERGENTE_OU_AMBIGUO'],
  ['ledger conta owner NULL sem filtro',c=>sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,valor,descricao,data_transacao) VALUES(NULL,$1,'entrada',1,'sintético','2026-01-01')",[c.a]),'LEDGER_DIVERGENTE_OU_AMBIGUO'],
  ['avulso ambíguo sem inferência',c=>sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,valor,descricao,data_transacao) VALUES(1,$1,'entrada',1,'sintético','2026-01-01')",[c.a]),'LEDGER_DIVERGENTE_OU_AMBIGUO'],
 ])await ineligible(name,mutation,motivo);
 await test('tenant cliente NULL explícito sem DML do fluxo',async()=>{
  const c=await fixture();const cl=(await sql("INSERT INTO clientes(user_id,nome) VALUES(1,'Cliente NULL sintético') RETURNING id"))[0].id;await sql('UPDATE contratos SET cliente_id=$1 WHERE id=$2',[cl,c.id]);await sql('UPDATE parcelas SET cliente_id=$1 WHERE contrato_id=$2',[cl,c.id]);await sql('UPDATE clientes SET user_id=NULL WHERE id=$1',[cl]);const before=await snapshot();assert.equal((await quote(c)).elegivel,false);assert.deepEqual(await snapshot(),before);await sql('UPDATE clientes SET user_id=1 WHERE id=$1',[cl]);
 });
 await test('conta cohort prospectivo recusada; guard 0022 e proveniência preservados',async()=>{
  const c=await fixture();await sql("SELECT public.rpc_criar_emprestimo(1,$1,1,$2,'mensal','mensal',100,10,1,'2026-01-01','2026-01-01',ARRAY['2026-02-01'::date])",[randomUUID(),c.a]);
  const before=await snapshot();const q=await quote(c);assert.deepEqual(q,{elegivel:false,motivos:['CONTA_PROTEGIDA']});assert.deepEqual(await snapshot(),before);
 });
 await test('falha real em CADA escrita financeira/interna produz rollback integral',async()=>{
  const c=await fixture();const i=intent(await quote(c));
  await sql(`CREATE FUNCTION public.test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_ARGV[0]='any' OR TG_OP=TG_ARGV[0] THEN RAISE EXCEPTION 'fault' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$`);
  const points=[['legados_operacoes','INSERT'],['legados_estados','INSERT'],['legados_capacidades','INSERT'],['parcelas','UPDATE'],['legados_capacidades','DELETE'],['transacoes_caixa','INSERT'],['contratos','UPDATE'],['contrato_historico','INSERT'],['legados_estados','UPDATE'],['legados_auditoria','INSERT'],['legados_operacoes','UPDATE']];
  for(const [table,op] of points){
   await sql(`CREATE TRIGGER test_fault BEFORE ${op} ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.test_fail('any')`);const before=await snapshot();await rejects(()=>receive(i),'P0001');assert.deepEqual(await snapshot(),before,`${table} ${op}`);await sql(`DROP TRIGGER test_fault ON public.${table}`);
  }
  assert.equal((await receive(i)).success,true);
 });
 await test('fault em cada uma das 4 reservas/consumos de capability: rollback de TODAS etapas',async()=>{
  const c=await fixture();const i=intent(await quote(c));
  await sql('CREATE SEQUENCE test_write_counter');
  await sql(`CREATE FUNCTION test_cap_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF nextval('public.test_write_counter')=TG_ARGV[0]::integer THEN RAISE EXCEPTION 'cap fault' USING ERRCODE='P0001'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$`);
  for(const op of ['INSERT','DELETE'])for(let n=1;n<=4;n++){
   await sql("SELECT setval('test_write_counter',1,false)");await sql(`CREATE TRIGGER test_cap_fault BEFORE ${op} ON legados_capacidades FOR EACH ROW EXECUTE FUNCTION test_cap_fault('${n}')`);
   const before=await snapshot();await rejects(()=>receive(i),'P0001');assert.deepEqual(await snapshot(),before,`${op} capability ${n}`);await sql('DROP TRIGGER test_cap_fault ON legados_capacidades');
  }
 });
 await test('mesmo UUID concorrente espera de lock real e só uma entrada',async()=>{
  const c=await fixture();const i=intent(await quote(c));const a=await newClient(),b=await newClient();
  try{await a.query('BEGIN');const r=await receive(i,a);const pid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;const promise=receive(i,b);await waitLock(b,pid);await a.query('COMMIT');assert.deepEqual(await promise,{...r,repetida:true});assert.equal((await sql('SELECT count(*)::int n FROM transacoes_caixa WHERE parcela_id=$1',[c.p[0]]))[0].n,1);}
  finally{await a.query('ROLLBACK');await a.end();await b.end();}
 });
 await test('duas chaves e duas contas concorrentes: uma confirma, outra recusa',async()=>{
  const c=await fixture();const other=(await sql("INSERT INTO contas_caixa(user_id,nome) VALUES(1,'Outro') RETURNING id"))[0].id;
  const i=intent(await quote(c)),j=intent(await quote(c,c.p[0],other));const a=await newClient(),b=await newClient();
  try{await a.query('BEGIN');await receive(i,a);const pid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;const promise=receive(j,b).then(r=>({r}),e=>({e}));await waitLock(b,pid);await a.query('COMMIT');assert.equal((await promise).e.code,'23514');assert.equal((await sql('SELECT count(*)::int n FROM transacoes_caixa WHERE parcela_id=$1',[c.p[0]]))[0].n,1);}
  finally{await a.query('ROLLBACK');await a.end();await b.end();}
 });
 await test('insert fantasma descendente/ledger: aborto protocolo real antes de commit',async()=>{
  const c=await fixture(2);const a=await newClient(),b=await newClient();
  try{await a.query('BEGIN');await quote(c,c.p[0],c.a,1,a);const before=await snapshot();
   for(const [q,v] of [
    ["INSERT INTO parcelas(user_id,cliente_id,contrato_id,numero,numero_parcela,valor,data_vencimento) VALUES(NULL,NULL,$1,3,3,100,'2026-01-01')",[c.id]],
    ["INSERT INTO transacoes_caixa(user_id,conta_caixa_id,contrato_id,tipo,valor,descricao,data_transacao) VALUES(1,$1,$2,'entrada',1,'fantasma','2026-01-01')",[c.a,c.id]],
   ])await rejects(()=>b.query(q,v),'40001');
   assert.deepEqual(await snapshot(),before);await a.query('COMMIT');}
  finally{await a.query('ROLLBACK');await a.end();await b.end();}
 });
 await test('mudança concorrente commit primeiro: quote aguarda conta, revalida owner sem alteração',async()=>{
  const c=await fixture();const a=await newClient(),b=await newClient();
  try{await a.query('BEGIN');await a.query('UPDATE contas_caixa SET user_id=2 WHERE id=$1',[c.a]);const pid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;const promise=quote(c,c.p[0],c.a,1,b);await waitLock(b,pid);await a.query('COMMIT');assert.equal((await promise).elegivel,false);}
  finally{await a.query('ROLLBACK');await a.end();await b.end();}
 });
 await test('owner cliente concorrente espera row lock real; recebimento não confirma tenant externo',async()=>{
  const c=await fixture();const cl=(await sql("INSERT INTO clientes(user_id,nome) VALUES(1,'Concorrência owner') RETURNING id"))[0].id;
  await sql('UPDATE contratos SET cliente_id=$1 WHERE id=$2',[cl,c.id]);await sql('UPDATE parcelas SET cliente_id=$1 WHERE contrato_id=$2',[cl,c.id]);
  const a=await newClient(),b=await newClient();
  try{await a.query('BEGIN');await quote(c,c.p[0],c.a,1,a);const pid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
   const promise=b.query('UPDATE clientes SET user_id=2 WHERE id=$1',[cl]);await waitLock(b,pid);await a.query('COMMIT');await promise;assert.equal((await quote(c)).elegivel,false);}
  finally{await a.query('ROLLBACK');await a.end();await b.end();}
 });
 await test('fault AFTER write adulterando campo histórico rejeitado pela prova exata sem commit',async()=>{
  const c=await fixture();const i=intent(await quote(c));
  await sql(`CREATE FUNCTION test_silent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='UPDATE' THEN NEW.valor_desconto:=1; END IF; RETURN NEW; END $$`);
  await sql('CREATE TRIGGER test_silent BEFORE UPDATE ON parcelas FOR EACH ROW EXECUTE FUNCTION test_silent()');const before=await snapshot();await rejects(()=>receive(i),'23514');assert.deepEqual(await snapshot(),before);await sql('DROP TRIGGER test_silent ON parcelas');
 });
 await test('ACL novas tabelas/RPC: public/anon/authenticated sem SELECT nem execução; service sem private capability',async()=>{
  for(const role of ['anon','authenticated','service_role']){await sql(`SET ROLE ${role}`);for(const table of ['legados_operacoes','legados_auditoria','legados_estados','legados_capacidades','legados_manifesto'])await rejects(()=>sql(`SELECT * FROM ${table} LIMIT 1`),'42501');await rejects(()=>sql('SELECT public.legados_travar(1,900,1)'),'42501');if(role!=='service_role')await rejects(()=>sql('SELECT public.rpc_cotar_recebimento_legado(1,900,900,1)'),'42501');await sql('RESET ROLE');}
 });
 await test('metadata fail-closed, reapply não conserta drift e nenhuma escrita/backfill',async()=>{
  const c=await fixture();const before=await snapshot();await sql('ALTER TABLE parcelas ALTER COLUMN valor_desconto DROP DEFAULT');
  await rejects(()=>quote(c),'55000');await rejects(()=>db.query(readFileSync(`${project}/drizzle/0034_rpc_recebimento_legado_validado.sql`,'utf8')),'P0001');await sql('ROLLBACK');assert.deepEqual(await snapshot(),before);
  await sql('ALTER TABLE parcelas ALTER COLUMN valor_desconto SET DEFAULT 0.00');assert.equal((await sql('SELECT assinatura=public.legados_metadata() ok FROM legados_manifesto'))[0].ok,true);
 });
 await test('elegibilidade não vencida, vencendo hoje e atraso sem novo encargo',async()=>{
  for(const date of ["2099-01-01",(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date)::text d"))[0].d,"2020-01-01"]){const c=await fixture();await sql('UPDATE parcelas SET data_vencimento=$1 WHERE id=$2',[date,c.p[0]]);const q=await quote(c);assert(q.elegivel);assert.equal(q.totalExigido,'100.00');assert.equal((await receive(intent(q))).success,true);}
 });
 await test('instalação fresh falha metadata/homônimo sem objeto parcial nem backfill',async()=>{
  for(const [n,change] of [['missing', 'ALTER TABLE parcelas DROP COLUMN valor_desconto'],['homonym','CREATE TABLE legados_operacoes(x integer)']]){
   const name=`test_legados_${n}`;await sql(`CREATE DATABASE ${name}`);const c=new pg.Client({...cfg,database:name});await c.connect();
   try{await c.query(readFileSync(`${project}/tests/postgres-legados/fixture.sql`,'utf8').replace(/^CREATE ROLE .*;$/gm,''));await c.query(readFileSync(`${project}/drizzle/0021_rpc_emprestimos_prospectivos.sql`,'utf8'));await c.query(readFileSync(`${project}/drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql`,'utf8'));await c.query(change);
    const before=(await c.query("SELECT jsonb_agg(to_jsonb(p) ORDER BY id) p FROM parcelas p")).rows[0].p;
    await rejects(()=>c.query(readFileSync(`${project}/drizzle/0034_rpc_recebimento_legado_validado.sql`,'utf8')),'P0001');await c.query('ROLLBACK');
    assert.equal((await c.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public' AND p.proname IN('rpc_receber_legado','rpc_cotar_recebimento_legado')")).rows[0].n,0);
    assert.equal((await c.query("SELECT to_regclass('public.legados_manifesto') r")).rows[0].r,null);assert.deepEqual((await c.query("SELECT jsonb_agg(to_jsonb(p) ORDER BY id) p FROM parcelas p")).rows[0].p,before);
   }finally{await c.end();await sql(`DROP DATABASE ${name}`);}
  }
 });
 console.log(`TOTAL_PASS=${count}`);
}finally{await db.end();}
