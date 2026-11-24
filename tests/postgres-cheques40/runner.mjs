import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync,openSync,closeSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const repo=fileURLToPath(new URL('../../',import.meta.url)),here=fileURLToPath(new URL('./',import.meta.url));
const args=process.argv.slice(2);for(let i=0;i<args.length;i++){if(['--artifacts','--pg-bin'].includes(args[i])&&args[i+1]){i++;continue;}throw Error('Usage: runner.mjs [--artifacts EXISTING_OUTSIDE_REPO] [--pg-bin PG17_BIN]');}
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const inside=p=>{const rel=relative(realpathSync(repo),p);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));};
const temp=realpathSync(tmpdir());if(inside(temp))throw Error('TMPDIR dentro do repo proibido');
const explicit=option('--artifacts',null),out=explicit?realpathSync(resolve(explicit))+'/':mkdtempSync(temp+'/cobrapro-cheques40-artifacts-')+'/';
if(inside(realpathSync(out)))throw Error('Artifacts dentro do repo proibidos');
mkdirSync(out+'evidence',{mode:0o700});
const root=mkdtempSync(temp+'/cobrapro-cheques40-cluster-'),bin=resolve(option('--pg-bin',process.env.PG17_BIN||'/usr/lib/postgresql/17/bin')),port=55440;
console.log('ARTIFACTS '+out);console.log('CLUSTER '+root+' (Unix socket only; removed finally)');
let socketFd;
const env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:out};
const run=(name,args)=>execFileSync(bin+'/'+name,args,{env,encoding:'utf8'});
const read=p=>readFileSync(p,'utf8');
const testedFiles=['drizzle/0042_assinaturas_recebimento_atomico.sql','drizzle/0041_telefone_atomico.sql','drizzle/0040_cheques_transacionais.sql'];
const expectedHashes=['0df0301ade56145681b721da149fc3048a46ed630cfe1be771c0bcfcf25c83fb','dead49422eecd04c18b241dd0f4c4421f0e8edc1e5ccc9ecebda10adfc76bb6d','d829fa99f81b3ec0f023480cad0cdb80a5c704e58c6aed532fc2ad10ec91d1af'];
const testedHashes=Object.fromEntries(testedFiles.map(p=>[p,createHash('sha256').update(read(repo+p)).digest('hex')]));
const results=[],roleEvidence=[];let started=false,bootstrap,admin,db;
const migrations=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa','0036a_multa_metadata_estavel','0037_rpc_aporte_transferencia_caixa'];
try{
 for(const [i,p] of testedFiles.entries())assert.equal(testedHashes[p],expectedHashes[i],'Hash predecessor/40: '+p);
 mkdirSync(root+'/socket',{mode:0o700});socketFd=openSync(root+'/socket','r');const socketPath=`/proc/${process.pid}/fd/${socketFd}`;
 run('initdb',['-D',root+'/data','-U','harness_admin40','-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',root+'/data','-l',out+'evidence/postgres.log','-o',`-k ${socketPath} -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
 const config={host:socketPath,port,user:'postgres',database:'postgres'};
 bootstrap=new pg.Client({...config,user:'harness_admin40'});await bootstrap.connect();
 await bootstrap.query('CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS CREATEDB CREATEROLE');
 admin=new pg.Client(config);await admin.connect();await admin.query('CREATE DATABASE cheques40');
 db=new pg.Client({...config,database:'cheques40'});await db.connect();
 const sql=async(q,v=[])=>(await db.query(q,v)).rows;
 const rpc=async(r,k=randomUUID(),uid=1,client=db)=>(await client.query('SELECT public.rpc_cheques40($1,$2,$3) r',[uid,k,{dataOperacao:(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'})).format(new Date()),...r}])).rows[0].r;
 const reject=async(fn,code)=>{let caught;try{await fn();}catch(e){caught=e;}assert.ok(caught,'expected SQLSTATE '+code);assert.equal(caught.code,code,caught.message);return caught;};
 const scenario=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
 const assertRole=async(stage)=>{const role=(await sql("SELECT current_user AS current_user,session_user AS session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user LIMIT 1"))[0];assert.equal(role.current_user,'postgres');assert.equal(role.session_user,'postgres');assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,true);roleEvidence.push({stage,...role});console.log('ROLE '+stage+' postgres NOSUPERUSER BYPASSRLS');};
 await assertRole('before fixtures');
 for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql','tests/postgres-caixa37/fixture.sql'])await sql(read(repo+'/'+f).replace('ALTER ROLE service_role NOSUPERUSER BYPASSRLS;',''));
 await bootstrap.query('ALTER ROLE service_role NOSUPERUSER BYPASSRLS; GRANT anon,authenticated,service_role TO postgres WITH SET TRUE');
 await bootstrap.end();bootstrap=null;
 await sql(read(here+'fixture.sql'));
 await sql(read(repo+'tests/postgres-telefone41/fixture-physical.sql'));
 const chequeCatalog=async()=>({constraints:await sql("SELECT conname,contype,convalidated,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='public.cheques'::regclass ORDER BY conname LIMIT 20"),defaults:await sql("SELECT a.attname,pg_get_expr(d.adbin,d.adrelid) expression FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.cheques'::regclass ORDER BY a.attnum LIMIT 20")});
 const chequeCatalogBefore=await chequeCatalog();
 const statusCheck=chequeCatalogBefore.constraints.find(c=>c.conname==='cheques_status_check');assert.ok(statusCheck?.convalidated);
 assert.deepEqual([...statusCheck.definition.matchAll(/'([^']+)'/g)].map(m=>m[1]),['em_carteira','descontado','compensado','devolvido','cancelado']);
 for(const status of ['aguardando','pendente'])await reject(()=>sql('UPDATE public.cheques SET status=$1 WHERE id=900',[status]),'23514');
 const schema9=read(repo+'/drizzle/0009_assinaturas.sql');await sql(schema9.slice(0,schema9.indexOf('-- Adicionar coluna contagem_renovacoes')));
 await sql('ALTER TABLE assinaturas ADD COLUMN user_id integer; ALTER TABLE pagamentos_assinatura ADD COLUMN user_id integer');
 await sql("INSERT INTO assinaturas(id,user_id,cliente_id,servico,valor_mensal,data_inicio,conta_caixa_id,status) VALUES(42,1,1,'Assinatura teste',29.90,'2026-01-01',1,'ativa')");
 await assertRole('before installing stack20_37_42_41');
 for(const m of migrations){console.log('install '+m);await sql(read(repo+'/drizzle/'+m+'.sql'));}
 await sql(read(repo+'drizzle/0042_assinaturas_recebimento_atomico.sql'));
 await sql(read(repo+'drizzle/0041_telefone_atomico.sql'));
 const preday=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d"))[0].d;
 const prevday=(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date-1)::text d"))[0].d;
 const loan21=(await sql('SELECT rpc_criar_emprestimo($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) r',[1,randomUUID(),1,1,'mensal','mensal','10.00','10.00',1,preday,preday,[preday],null,null]))[0].r;
 const loan35=(await sql('SELECT rpc_criar_emprestimo_multimodal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) r',[1,randomUUID(),1,1,'mensal','mensal','10.00','10.00',1,prevday,prevday,[prevday],null,null,'2.0000','0.0330']))[0].r;
 await sql('SELECT rpc_aplicar_multa36($1,$2,$3,$4,$5)',[1,randomUUID(),loan35.id,'2.00',loan35.parcelasIds]);
 const aporte=async(id)=>{const q=(await sql("SELECT rpc_cotar_caixa37(1,'aporte',NULL,$1,'1.00',NULL) q",[id]))[0].q;return (await sql('SELECT rpc_aportar_caixa37($1,$2,$3,$4,$5,$6,$7) r',[1,randomUUID(),id,q.valor,q.dataTransacao,q.estadoHash,null]))[0].r;};
 await aporte(1);
 await sql('SELECT rpc_receber_assinatura42($1,$2,$3,$4,$5,$6,$7,$8)',[1,randomUUID(),42,1,1,'29.90','2026-11',null]);
 console.log('STACK 20–37 +42 and real21/35/36/37/42 operations before40 installed');
 const sourceHashes=Object.fromEntries(migrations.slice(-3).map(m=>[m,createHash('sha256').update(read(repo+'/drizzle/'+m+'.sql')).digest('hex')]));
 const beforeFunctions=await sql("SELECT proname,pg_get_functiondef(oid) definition,proacl::text acl FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname NOT IN('ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','caixa37_ponte','caixa37_ledger','caixa37_perna_comprovada') ORDER BY oid");
 const baseline=await sql('SELECT id,saldo::text,user_id FROM contas_caixa ORDER BY id');
 const financialSnapshot=async()=>JSON.stringify((await sql("SELECT jsonb_build_object('contas',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM contas_caixa a),'cheques',(SELECT jsonb_agg(to_jsonb(c)-'cheques40_meta' ORDER BY c.id) FROM cheques c),'ledger',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM transacoes_caixa l)) data"))[0].data);
 const financialBefore=await financialSnapshot();
 const legacyRows=await sql('SELECT to_jsonb(c) row FROM cheques c ORDER BY id LIMIT 100');
 const oldLedger=await sql('SELECT id,to_jsonb(l) row FROM transacoes_caixa l ORDER BY id LIMIT 1000');

 const target=read(repo+'drizzle/0040_cheques_transacionais.sql');
 await assertRole('before installing40');
 await sql(target);
 await scenario('install no financial mutation / predecessor sources unchanged',async()=>{
  assert.equal(await financialSnapshot(),financialBefore);
  assert.deepEqual(await chequeCatalog(),chequeCatalogBefore);
  writeFileSync(out+'evidence/cheques-physical-catalog.json',JSON.stringify({source:'catálogo informado pelo pai; reprodução local, não consulta produção',before:chequeCatalogBefore,after:await chequeCatalog(),forbiddenStatusesRejected:['aguardando','pendente']},null,2)+'\n');
  assert.deepEqual(await sql('SELECT id,saldo::text,user_id FROM contas_caixa ORDER BY id'),baseline);
  assert.deepEqual(await sql("SELECT proname,pg_get_functiondef(oid) definition,proacl::text acl FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname NOT IN('rpc_cheques40','rpc_abandonar_cheques40','cheques40_guardar','cheques40_imutavel','cheques40_consumir','cheques40_validar','cheques40_completar','cheques40_conjunto','cheques40_travar_conta','cheques40_validar_conta','ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','caixa37_ponte','caixa37_ledger','caixa37_perna_comprovada') ORDER BY oid"),beforeFunctions);
 });
 await scenario('migration one-shot rejects reapply without resealing unknown state',async()=>{
  await reject(()=>sql(target),'55000');await sql('ROLLBACK');await sql('SELECT public.caixa37_verificar()');
 });
 const day=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d"))[0].d;
 const create=(more={})=>({acao:'criar',clienteId:1,contaCaixaId:101,emitente:'Emitente sintético',numeroCheque:'12345',banco:null,agencia:null,conta:null,cpfCnpjEmitente:null,valorNominal:'100.00',dataVencimento:day,taxaDesconto:'3.00',tipoTaxa:'mensal',observacoes:null,...more});
 let created,key=randomUUID(),req=create();
 await scenario('ACL RLS service-only execute no private SELECT',async()=>{
  for(const role of ['anon','authenticated']){await sql('SET ROLE '+role);await reject(()=>rpc(req),'42501');await sql('RESET ROLE');}
  await sql('SET ROLE service_role');await reject(()=>sql('SELECT user_id,chave FROM cheques40_operacoes LIMIT 1'),'42501');await reject(()=>sql('SELECT public.cheques40_guardar()'),'42501');await sql('RESET ROLE');
  const tables=await sql("SELECT relname,relrowsecurity,has_table_privilege('service_role',oid,'SELECT,INSERT,UPDATE,DELETE') access FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname IN('cheques40_operacoes','cheques40_origens','cheques40_contas','cheques40_capacidades') LIMIT 10");
  assert.equal(tables.length,4);for(const t of tables){assert.equal(t.relrowsecurity,true);assert.equal(t.access,false);}
 });
 await scenario('create debit atomic, replay same intention and mismatched UUID rejected',async()=>{
  await sql('SET ROLE service_role');created=await rpc(req,key);await sql('RESET ROLE');
  assert.equal(created.status,'descontado');assert.equal(created.valorLiquido,'100.00');
  assert.deepEqual(await rpc(req,key),{...created,repetida:true});await reject(()=>rpc({...req,emitente:'Outra intenção'},key),'23505');
  assert.equal((await sql('SELECT count(*)::int n FROM transacoes_caixa WHERE conta_caixa_id=101 LIMIT 1'))[0].n,1);
 });
 await scenario('return audited compensation append-only',async()=>{
  const r={acao:'devolver',id:created.id,motivo:'Sem fundos sintético'},k=randomUUID();const x=await rpc(r,k);assert.equal(x.status,'devolvido');assert.equal(x.estornadoNoCaixa,true);
  assert.deepEqual(await rpc(r,k),{...x,repetida:true});await reject(()=>rpc({acao:'cancelar',id:created.id}),'23505');
  const a=(await sql("SELECT auditoria FROM cheques40_operacoes WHERE chave=$1 LIMIT 1",[k]))[0].auditoria;assert.ok(a.compensaTransacaoId);assert.equal(a.saldoDepois,'1000.00');
  await reject(()=>sql('DELETE FROM transacoes_caixa WHERE id=$1',[a.compensaTransacaoId]),'42501');
 });
 await scenario('compensar nominal and cancelar net exactly once',async()=>{
  const c=await rpc(create());const x=await rpc({acao:'compensar',id:c.id});assert.equal(x.status,'compensado');await reject(()=>rpc({acao:'devolver',id:c.id,motivo:'Tentativa duplicada'}),'23505');
  const c2=await rpc(create());const y=await rpc({acao:'cancelar',id:c2.id});assert.equal(y.status,'cancelado');
 });
 await scenario('numeric discount cent-exact and compensation restores only net debit',async()=>{
  const due=(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date+30)::text d"))[0].d;
  const c=await rpc(create({valorNominal:'100.00',dataVencimento:due}));assert.equal(c.valorLiquido,'97.09');assert.equal(c.valorDesconto,'2.91');
  const n=(await sql('SELECT count(*)::int n FROM transacoes_caixa WHERE conta_caixa_id=101 LIMIT 1'))[0].n;
  const r=await rpc({acao:'cancelar',id:c.id});assert.equal(r.estornadoNoCaixa,true);
  const leg=(await sql('SELECT valor::text,tipo FROM transacoes_caixa WHERE id=(SELECT transacao_id FROM cheques40_operacoes WHERE chave=$1) LIMIT 1',[r.idempotencyKey]))[0];assert.deepEqual(leg,{valor:'97.09',tipo:'entrada'});
  assert.equal((await sql('SELECT count(*)::int n FROM transacoes_caixa WHERE conta_caixa_id=101 LIMIT 1'))[0].n,n+1);
 });
 await scenario('expired intent cannot execute later but committed original replays historically',async()=>{
  await reject(()=>rpc(create({dataOperacao:'2020-01-01'})),'22023');
  assert.equal((await rpc(req,key)).id,created.id);
  await sql('UPDATE contas_caixa SET ativo=false WHERE id=101');assert.equal((await rpc(req,key)).repetida,true);await sql('UPDATE contas_caixa SET ativo=true WHERE id=101');
 });
 await scenario('closed parameters and decimal exactness reject malformed payloads',async()=>{
  for(const patch of [{valorNominal:'1e2'},{valorNominal:'1.001'},{valorNominal:100},{taxaDesconto:'3'},{emitente:' '},{tipoTaxa:'invalid'},{userId:2}])await reject(()=>rpc(create(patch)),'22023');
  await reject(()=>rpc({acao:'devolver',id:1,motivo:''}),'22023');
 });
 await scenario('cross-tenant bindings and legacy fail closed',async()=>{
  await reject(()=>rpc(create({clienteId:2})),'42501');await reject(()=>rpc(create({contaCaixaId:102})),'42501');await reject(()=>rpc({acao:'cancelar',id:900}),'42501');await reject(()=>rpc({acao:'cancelar',id:created.id},randomUUID(),2),'42501');
 });
 await scenario('underflow complete rollback including new account pin',async()=>{
  const b=(await sql('SELECT count(*)::int n FROM cheques40_operacoes LIMIT 1'))[0].n;
  await reject(()=>rpc(create({contaCaixaId:103,valorNominal:'100.01'})),'23514');
  assert.equal((await sql('SELECT count(*)::int n FROM cheques40_contas WHERE conta_id=103 LIMIT 1'))[0].n,0);
  assert.equal((await sql('SELECT count(*)::int n FROM cheques40_operacoes LIMIT 1'))[0].n,b);
 });
 await scenario('real mid-transaction PK fault rolls back status ledger and audit',async()=>{
  const c=await rpc(create()),k=randomUUID(),r={acao:'cancelar',id:c.id};
  const sequence=(await sql('SELECT last_value::text,is_called FROM transacoes_caixa_id_seq LIMIT 1'))[0];
  const collision=(await sql('SELECT id FROM transacoes_caixa ORDER BY id LIMIT 1'))[0].id;
  const before=(await sql('SELECT count(*)::int n FROM cheques40_operacoes LIMIT 1'))[0].n;
  await sql("SELECT setval('transacoes_caixa_id_seq',$1,false)",[collision]);
  await reject(()=>rpc(r,k),'23505');
  assert.equal((await sql('SELECT status FROM cheques WHERE id=$1 LIMIT 1',[c.id]))[0].status,'descontado');
  assert.equal((await sql('SELECT count(*)::int n FROM cheques40_operacoes LIMIT 1'))[0].n,before);
  assert.equal((await sql('SELECT count(*)::int n FROM cheques40_capacidades LIMIT 1'))[0].n,0);
  await sql("SELECT setval('transacoes_caixa_id_seq',$1,$2)",[sequence.last_value,sequence.is_called]);
  assert.equal((await rpc(r,k)).status,'cancelado');
 });
 await scenario('real create failure rolls back cheque origin account pin and ledger',async()=>{
  const sequence=(await sql('SELECT last_value::text,is_called FROM transacoes_caixa_id_seq LIMIT 1'))[0];
  const collision=(await sql('SELECT id FROM transacoes_caixa ORDER BY id LIMIT 1'))[0].id;
  const before=(await sql('SELECT count(*)::int n FROM cheques LIMIT 1'))[0].n;
  await sql("SELECT setval('transacoes_caixa_id_seq',$1,false)",[collision]);
  await reject(()=>rpc(create({contaCaixaId:103})),'23505');
  assert.equal((await sql('SELECT count(*)::int n FROM cheques LIMIT 1'))[0].n,before);
  assert.equal((await sql('SELECT count(*)::int n FROM cheques40_contas WHERE conta_id=103 LIMIT 1'))[0].n,0);
  await sql("SELECT setval('transacoes_caixa_id_seq',$1,$2)",[sequence.last_value,sequence.is_called]);
 });
 await scenario('foreign or null ledger owner poisons account and is never silently adopted',async()=>{
  for(const owner of [2,null]){
   await sql('BEGIN');await sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,valor,descricao,data_transacao) VALUES($1,103,'entrada',1,'Poison sintético',$2)",[owner,day]);await sql('SAVEPOINT poison');
   await reject(()=>rpc(create({contaCaixaId:103})),'23514');await sql('ROLLBACK TO SAVEPOINT poison');await sql('ROLLBACK');
  }
 });
 await scenario('parallel duplicate same UUID only one debit',async()=>{
  const k=randomUUID(),r=create(),other=new pg.Client({...config,database:'cheques40'});await other.connect();
  try{const values=await Promise.all([rpc(r,k),rpc(r,k,1,other)]);assert.equal(values.filter(x=>x.repetida).length,1);assert.equal(values[0].id,values[1].id);}finally{await other.end();}
 });
 await scenario('concurrent account protocol rejects contender without underflow',async()=>{
  const other=new pg.Client({...config,database:'cheques40'});await other.connect();
  try{await other.query('BEGIN');await other.query('SELECT pg_advisory_xact_lock(22022,103)');await reject(()=>rpc(create({contaCaixaId:103})),'40001');await other.query('ROLLBACK');
   await rpc(create({contaCaixaId:103}));await reject(()=>rpc(create({contaCaixaId:103})),'23514');
  }finally{await other.end();}
 });
 await scenario('concurrent compensar/cancelar one terminal state and one credit only',async()=>{
  const c=await rpc(create()),other=new pg.Client({...config,database:'cheques40'});await other.connect();
  try {
   const before=(await sql('SELECT count(*)::int n FROM transacoes_caixa WHERE conta_caixa_id=101 LIMIT 1'))[0].n;
   const values=await Promise.allSettled([rpc({acao:'compensar',id:c.id}),rpc({acao:'cancelar',id:c.id},randomUUID(),1,other)]);
   assert.equal(values.filter(x=>x.status==='fulfilled').length,1);
   assert.equal((await sql('SELECT count(*)::int n FROM transacoes_caixa WHERE conta_caixa_id=101 LIMIT 1'))[0].n,before+1);
  } finally {await other.end();}
 });
 await scenario('runtime ACL drift failclosed without reseal',async()=>{
  await sql('BEGIN');await sql('GRANT SELECT ON cheques40_operacoes TO service_role');await sql('SAVEPOINT bad');
  await reject(()=>rpc(create()),'55000');await sql('ROLLBACK TO SAVEPOINT bad');await sql('ROLLBACK');
 });
 await scenario('manual writes GUC spoof, audit mutation, base/owner mutation blocked',async()=>{
  for(const q of ["UPDATE contas_caixa SET saldo=2000 WHERE id=101","UPDATE contas_caixa SET user_id=2 WHERE id=101","UPDATE clientes SET user_id=2 WHERE id=1","DELETE FROM cheques40_operacoes","UPDATE cheques SET status='descontado' WHERE id="+created.id])await reject(()=>sql(q),'42501');
  await sql('SET ROLE service_role');await sql("SET app.financial_rpc='true'");await reject(()=>sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao) VALUES(1,1,'entrada','outros',1,'Fake',CURRENT_DATE)"),'42501');await sql('RESET ROLE');
 });
 await scenario('shared account1 with21/35/multa36/pin37 accepts40 and predecessor writers after40',async()=>{
  const c=await rpc(create({contaCaixaId:1,valorNominal:'1.00'}));assert.equal(c.status,'descontado');
  await rpc({acao:'compensar',id:c.id});
  await aporte(1);
  const c2=await rpc(create({contaCaixaId:1,valorNominal:'1.00'}));await rpc({acao:'cancelar',id:c2.id});
  const c3=await rpc(create({contaCaixaId:1,valorNominal:'1.00'}));await rpc({acao:'devolver',id:c3.id,motivo:'Auditado conta compartilhada'});
  const n21=(await sql('SELECT rpc_criar_emprestimo($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) r',[1,randomUUID(),1,1,'mensal','mensal','1.00','10.00',1,day,day,[day],null,null]))[0].r;assert.ok(n21.id);
  const n35=(await sql('SELECT public.rpc_criar_emprestimo_multimodal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) r',[1,randomUUID(),1,1,'mensal','mensal','1.00','10.00',1,prevday,prevday,[prevday],null,null,'2.0000','0.0330']))[0].r;assert.ok(n35.id);
  await sql('SELECT rpc_aplicar_multa36($1,$2,$3,$4,$5)',[1,randomUUID(),n35.id,'2.00',n35.parcelasIds]);
  await sql('SELECT rpc_receber_assinatura42($1,$2,$3,$4,$5,$6,$7,$8)',[1,randomUUID(),42,1,1,'29.90','2026-12',null]);
  await sql('SELECT caixa37_validar_livro(1)');
  const tids=await sql('SELECT transacao_id FROM cheques40_operacoes WHERE ledger->>\'conta_caixa_id\'=\'1\' LIMIT 20');
  for(const row of tids)assert.equal((await sql('SELECT caixa37_perna_comprovada($1,1) ok',[row.transacao_id]))[0].ok,true);
 });
 await scenario('writer41 remains functional after40 and its proof branch is preserved',async()=>{
  const criarTelefone40=(extra={})=>({acao:'criar',marca:'Fixture',modelo:'Telefone sintético',imei:null,cor:null,armazenamento:null,custo:'500.00',precoVenda:'700.00',entradaPercentual:'20.00',jurosMensal:'10.00',numParcelas:3,dataPrimeiraParcela:'2027-01-31',contaCaixaId:1,compradorNome:'Fixture sem dados reais',compradorCpf:null,compradorRg:null,compradorTelefone:null,compradorEmail:null,compradorEstadoCivil:null,compradorProfissao:null,compradorInstagram:null,compradorCep:null,compradorCidade:null,compradorEstado:null,compradorEndereco:null,compradorLocalTrabalho:null,...extra});
  const r=(await sql('SELECT rpc_executar_telefone41($1,$2,$3) r',[1,randomUUID(),criarTelefone40()]))[0].r;assert.ok(r.vendaId);
  const p=(await sql('SELECT id,valor::text FROM parcelas_venda_telefone WHERE venda_id=$1 ORDER BY numero LIMIT 1',[r.vendaId]))[0];
  await sql('SELECT rpc_executar_telefone41($1,$2,$3)',[1,randomUUID(),{acao:'receber',vendaId:r.vendaId,parcelaId:Number(p.id),contaCaixaId:1,valorPago:p.valor}]);
  await sql('SELECT rpc_executar_telefone41($1,$2,$3)',[1,randomUUID(),{acao:'cancelar',vendaId:r.vendaId,motivo:'Coexistência40 auditada'}]);
  await sql('SELECT telefone41.verificar()');
 });
 await scenario('fence absence prevents forever late execution; committed intention recovers instead',async()=>{
  const k=randomUUID(),r={dataOperacao:day,...create({valorNominal:'9999999999.99'})};
  const fence=async(k,r,client=db)=>(await client.query('SELECT rpc_abandonar_cheques40($1,$2,$3) r',[1,k,r])).rows[0].r;
  await reject(()=>rpc(r,k),'23514');const a=await fence(k,r);assert.equal(a.estado,'nao_executada');assert.deepEqual(await fence(k,r),a);
  await reject(()=>rpc(r,k),'23505');await reject(()=>fence(k,{...r,emitente:'outro'}),'23505');
  const b=await fence(key,{dataOperacao:day,...req});assert.equal(b.estado,'executada');assert.equal(b.resultado.operationId,created.operationId);
  const other=new pg.Client({...config,database:'cheques40'});await other.connect();
  try{const k2=randomUUID(),r2={dataOperacao:day,...create({valorNominal:'1.00'})};const values=await Promise.allSettled([rpc(r2,k2),fence(k2,r2,other)]);assert.equal(values[1].status,'fulfilled');
   const f=values[1].value;if(f.estado==='nao_executada'){assert.equal(values[0].status,'rejected');await reject(()=>rpc(r2,k2),'23505');}else{assert.equal(values[0].status,'fulfilled');assert.equal(f.resultado.operationId,values[0].value.operationId);}
  }finally{await other.end();}
 });
 await scenario('dirty historical sibling account does not block clean selected account; dirty selected account fails closed',async()=>{
  await sql("INSERT INTO contas_caixa(id,user_id,nome,saldo,ativo) VALUES(115,1,'Conta antiga contaminada',0,true)");
  await sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao) VALUES(NULL,115,'entrada','outros',1,'Histórico sem owner',CURRENT_DATE)");
  const historic=await sql('SELECT to_jsonb(l) snapshot FROM transacoes_caixa l WHERE conta_caixa_id=115 LIMIT 10');
  const c=await rpc(create({contaCaixaId:1,valorNominal:'1.00'}));await rpc({acao:'cancelar',id:c.id});
  const other=new pg.Client({...config,database:'cheques40'});await other.connect();
  try{await other.query('BEGIN');await other.query('SELECT pg_advisory_xact_lock(22022,115)');const c2=await rpc(create({contaCaixaId:1,valorNominal:'1.00'}));await rpc({acao:'devolver',id:c2.id,motivo:'Conta limpa independente'});await other.query('ROLLBACK');}finally{await other.end();}
  await reject(()=>rpc(create({contaCaixaId:115,valorNominal:'1.00'})),'23514');
  assert.deepEqual(await sql('SELECT to_jsonb(l) snapshot FROM transacoes_caixa l WHERE conta_caixa_id=115 LIMIT 10'),historic);
  await sql('SELECT cheques40_validar_conta(1,1)');
 });
 await scenario('all historical cheque and ledger rows remain unchanged after all new flows',async()=>{
  const current=await sql("SELECT to_jsonb(c)-'cheques40_meta' row FROM cheques c WHERE id=900 ORDER BY id LIMIT 100");assert.deepEqual(current,legacyRows);
  assert.equal((await sql('SELECT cheques40_meta FROM cheques WHERE id=900 LIMIT 1'))[0].cheques40_meta,null);
  for(const l of oldLedger)assert.deepEqual((await sql('SELECT id,to_jsonb(l) row FROM transacoes_caixa l WHERE id=$1 LIMIT 1',[l.id]))[0],l);
 });
 await scenario('no residual capabilities and sealed metadata valid',async()=>{assert.equal((await sql('SELECT count(*)::int n FROM cheques40_capacidades LIMIT 1'))[0].n,0);await sql('SELECT public.caixa37_verificar()');});
 await assertRole('after all25 scenarios');
 const definerOwners=await sql("SELECT DISTINCT r.rolname,r.rolsuper,r.rolbypassrls FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.pronamespace IN ('public'::regnamespace,'telefone41'::regnamespace) AND p.prosecdef LIMIT 10");
 assert.ok(definerOwners.length>0);for(const role of definerOwners){assert.equal(role.rolname,'postgres');assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,true);}
 assert.equal(results.length,25);
 for(const [p,h] of Object.entries(testedHashes))assert.equal(createHash('sha256').update(read(repo+p)).digest('hex'),h,'baseline changed during PG test: '+p);
 writeFileSync(out+'evidence/real-rpc-envelope.json',JSON.stringify({intent:{idempotencyKey:key,request:{dataOperacao:day,...req}},response:{data:created,error:null}},null,2));
 writeFileSync(out+'evidence/postgres-result.json',JSON.stringify({status:'PASS_PG17_STACK20_37_42_41_THEN40_NOSUPERUSER_BYPASSRLS',version:(await sql('SHOW server_version'))[0],results,roleEvidence,definerOwners,bootstrapRole:'harness_admin40: roles only, disconnected before all migrations; all fixture DDL/DML uses postgres NOSUPERUSER BYPASSRLS',sourceHashes,testedHashes,physicalColumnsFromParent:true,physicalCheckAndDefaultsFromParent:true,physicalProductionValidated:false},null,2)+'\n');
}catch(e){console.error(e);writeFileSync(out+'evidence/postgres-result.json',JSON.stringify({status:'FAIL',results,error:{message:e.message,code:e.code,detail:e.detail,where:e.where}},null,2));process.exitCode=1;
}finally{if(db)await db.end().catch(()=>{});if(admin)await admin.end().catch(()=>{});if(bootstrap)await bootstrap.end().catch(()=>{});try{if(started){run('pg_ctl',['-D',root+'/data','-m','immediate','-w','stop']);console.log('CLEANUP local PostgreSQL stopped');}}finally{if(socketFd!==undefined)closeSync(socketFd);rmSync(root,{recursive:true,force:true});console.log('CLEANUP cluster removed; artifacts '+out);}}
