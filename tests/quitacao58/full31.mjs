import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const repo=fs.realpathSync(process.cwd()),candidate=repo,bin=process.env.PG17_BIN??'/usr/lib/postgresql/17/bin';
assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DOTENV_CONFIG_PATH,'/dev/null');assert.equal(process.env.R2_LOCAL_PG51,'1');
const temp=fs.realpathSync(os.tmpdir()),tempRelative=path.relative(repo,temp);
assert.ok(tempRelative==='..' || tempRelative.startsWith('..'+path.sep) || path.isAbsolute(tempRelative),'TMPDIR must be outside repository');
const base=fs.mkdtempSync(path.join(temp,'cobrapro51-artifacts-')),out=path.join(base,'logs');fs.mkdirSync(out,{mode:0o700});
const profile=process.argv[3];assert.ok(['private','supabase'].includes(profile));const mode=process.argv[2];assert.ok(['red','green'].includes(mode));const root=fs.mkdtempSync(path.join(temp,'p-'));fs.chmodSync(root,0o700);fs.mkdirSync(root+'/s',{mode:0o700});
console.log('ARTIFACTS51 '+base);
const pinnedSources=JSON.parse(fs.readFileSync(new URL('../composition-obrigacoes/predecessor-sources.json',import.meta.url),'utf8'));

const env={PATH:'/usr/bin:/bin',HOME:process.env.HOME,LANG:'C.UTF-8'},run=(name,args)=>execFileSync(bin+'/'+name,args,{env,encoding:'utf8'}),read=p=>fs.readFileSync(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const sources=[],result={mode,startedAt:new Date().toISOString(),results:[],errors:[],sources,namespace:{net:fs.readlinkSync('/proc/self/ns/net'),mnt:fs.readlinkSync('/proc/self/ns/mnt'),pid:fs.readlinkSync('/proc/self/ns/pid')},root};
const save=(n,v)=>fs.writeFileSync(out+'/'+n,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
let started=false,db,bootstrap;
const sql=async(q,v=[])=>(await db.query(q,v)).rows,rpc=async(n,v=[])=>(await sql(`SELECT ${n}(${v.map((_,i)=>'$'+(i+1)).join(',')}) r`,v))[0].r;
const reject=async(fn,code)=>{let e;try{await fn();}catch(x){e=x;}assert.ok(e,'expected SQL refusal '+code);if(code)assert.equal(e.code,code,e.message);return e;};
const scenario=async(n,fn)=>{console.log('START51 '+n);await fn();result.results.push(n);save('checkpoint27.json',result);console.log('PASS51 '+n);};
const financial=async()=>(await sql("SELECT jsonb_build_object('contas',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a),'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),'contratos',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contratos c),'parcelas',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p),'historico',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM contrato_historico h)) s LIMIT 1"))[0].s;
const verify=async()=>{for(const f of ['public.legados_verificar','public.multimodal_verificar','public.multa36_verificar','public.caixa37_verificar','manutencao44.verificar','caixa_manutencao45.verificar','calendario46.verificar','private47.verificar','manutencao48.verificar','despesas49.verificar'])await rpc(f);};
result.testSources=Object.fromEntries(['pg51.mjs','scenarios51.mjs','statefix51.mjs'].map(f=>[f,hash(read(candidate+'/tests/composition-obrigacoes/'+f))]));
result.readSources=Object.fromEntries(['shared/obrigacoes51.ts','shared/obrigacoes51Projection.ts','server/services/obrigacoes51Rpc.ts'].map(f=>[f,hash(read(candidate+'/'+f))]));

// Private order gate: current catalogs, exact predecessor preservation, no installer edits.
const pins54=JSON.parse(read(candidate+'/tests/composition-obrigacoes/pins54.json'));
const pins52=JSON.parse(read(candidate+'/tests/composition-obrigacoes/pins52.json'));
const pins53=JSON.parse(read(candidate+'/tests/sucessores53/function-deltas.json'));
const captureOrder=async()=>({
 functions:await sql("SELECT p.oid,n.nspname||'.'||p.proname name,to_jsonb(p) snapshot FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') ORDER BY p.oid LIMIT 20000"),
 catalog:await sql("SELECT 'class' kind,c.oid,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] snapshot FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') UNION ALL SELECT 'trigger',oid,to_jsonb(t) FROM pg_trigger t UNION ALL SELECT 'constraint',oid,to_jsonb(c) FROM pg_constraint c UNION ALL SELECT 'policy',oid,to_jsonb(p) FROM pg_policy p UNION ALL SELECT 'default',oid,to_jsonb(d) FROM pg_attrdef d UNION ALL SELECT 'index',indexrelid,to_jsonb(i) FROM pg_index i ORDER BY kind,oid LIMIT 20000"),
 attributes:await sql("SELECT a.attrelid,a.attnum,to_jsonb(a) snapshot FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') ORDER BY a.attrelid,a.attnum LIMIT 20000")
});
const assertOrderDelta=(before,after,allowed,label)=>{
 const changed=[];
 for(const old of before.functions){const current=after.functions.find(x=>x.oid===old.oid);assert.ok(current,label+' missing function '+old.name);if(allowed.has(old.name)){assert.deepEqual({...current.snapshot,prosrc:null},{...old.snapshot,prosrc:null},label+' only prosrc '+old.name);if(current.snapshot.prosrc!==old.snapshot.prosrc)changed.push(old.name);}else assert.deepEqual(current,old,label+' exact predecessor '+old.name);}
 assert.deepEqual(changed.sort(),[...allowed].sort(),label+' exact old function delta');
 for(const old of before.catalog)assert.deepEqual(after.catalog.find(x=>x.kind===old.kind&&x.oid===old.oid),old,label+' exact old catalog '+old.kind+':'+old.oid);
 for(const old of before.attributes)assert.deepEqual(after.attributes.find(x=>x.attrelid===old.attrelid&&x.attnum===old.attnum),old,label+' exact old attribute');
 const verifier=after.functions.find(x=>x.name==='obrigacoes51.verificar');assert.equal(hash(verifier.snapshot.prosrc),pins54.compiledBodySha256,label+' compiled54 verifier preserved');
 result.order545253??=[];result.order545253.push({stage:label,verifier51Sha256:hash(verifier.snapshot.prosrc),changedOldFunctions:changed,predecessorFunctionsExactExceptExplicitProsrc:true,predecessorRelationsAttributesTriggersConstraintsPoliciesDefaultsIndexesExact:true,predecessorCounts:{functions:before.functions.length,catalog:before.catalog.length,attributes:before.attributes.length}});
 save('order-'+label+'.json',{before,after,proof:result.order545253.at(-1)});
};
const assertCompiled54=async label=>{const row=(await sql("SELECT encode(extensions.digest(prosrc,'sha256'),'hex') sha,to_jsonb(p) snapshot FROM pg_proc p WHERE oid='obrigacoes51.verificar()'::regprocedure LIMIT 1"))[0];assert.equal(row.sha,pins54.compiledBodySha256,label);await rpc('obrigacoes51.verificar');return row;};

const profileTools=await import('../installer-profile/profile-tools.mjs');

try{
 for(const [file,expected] of Object.entries(pinnedSources))assert.equal(hash(read(path.join(repo,file))),expected,file+' BYTE-EXACT certified input');
 run('initdb',['-D',root+'/data','-U','bootstrap51','-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',root+'/data','-l',root+'/postgres.log','-o',`-k ${root}/s -p 55751 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
 const config={host:root+'/s',port:55751,user:'postgres',database:'postgres'};
 bootstrap=new pg.Client({...config,user:'bootstrap51'});await bootstrap.connect();await bootstrap.query('CREATE ROLE postgres LOGIN NOSUPERUSER NOBYPASSRLS CREATEDB CREATEROLE; ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres; CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT anon,authenticated,service_role TO postgres WITH SET TRUE');await import('./fixture-config30.mjs').then(m=>m.configure({bootstrap,profile,assert,save,result}));await bootstrap.end();bootstrap=null;
 db=new pg.Client(config);await db.connect();await sql("SET TimeZone='UTC'; SET search_path=public,pg_catalog");
 const load=async(p,transform=x=>x)=>{const s=read(repo+'/'+p);assert.equal(hash(s),pinnedSources[p],p+' BYTE-EXACT predecessor source');sources.push({path:p,sha256:hash(s)});await sql(transform(s));console.log('FIXTURE INSTALL '+p);};
 for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql','tests/postgres-caixa37/fixture.sql'])await load(f,s=>s.replace('ALTER ROLE service_role NOSUPERUSER BYPASSRLS;','').replace(/CREATE ROLE (?:service_role|anon|authenticated)[^;]*;/g,''));
 await load('tests/release-restantes/fixtures/cheques40.sql');await load('tests/release-restantes/fixtures/telefone41.sql');
 await load('drizzle/0009_assinaturas.sql',s=>s.slice(0,s.indexOf('-- Adicionar coluna contagem_renovacoes')));await sql('ALTER TABLE assinaturas ADD COLUMN user_id integer; ALTER TABLE pagamentos_assinatura ADD COLUMN user_id integer');
 await sql("INSERT INTO assinaturas(id,user_id,cliente_id,servico,valor_mensal,data_inicio,conta_caixa_id,status) VALUES(42,1,1,'Fixture51',29.90,'2026-01-01',1,'ativa'); INSERT INTO contratos(id,user_id,cliente_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario) VALUES(920,1,1,6,'mensal','mensal',100,100,100,1,1,'2026-01-01','2026-02-01','ativo',2,0.033); INSERT INTO parcelas(id,contrato_id,user_id,cliente_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,data_vencimento,status) VALUES(920,920,1,1,6,1,1,100,100,0,0,'2026-02-01','pendente')");
 // Dedicated NEW legacy fixtures51, before all sealing. Not historical repair.
 await sql("INSERT INTO contratos(id,user_id,cliente_id,koletor_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario) SELECT i,1,1,1,6,'mensal','mensal',100,50,100,2,2,'2026-11-01','2027-02-10','ativo',2,0.033 FROM generate_series(951,954) i; INSERT INTO parcelas(id,contrato_id,user_id,cliente_id,koletor_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,data_vencimento,status) SELECT i*10+j,i,1,1,1,6,j,j,50,50,0,0,make_date(2027,j,10),'pendente' FROM generate_series(951,954) i CROSS JOIN generate_series(1,2) j");
 // New synthetic read-only legacy fixtures, created BEFORE predecessor seals (no remediation).
 await sql("INSERT INTO contratos(id,user_id,cliente_id,koletor_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario) SELECT i,1,1,1,6,CASE WHEN i=957 THEN 'cheque' ELSE 'mensal' END,'mensal',CASE WHEN i=956 THEN 512 ELSE 100 END,CASE WHEN i=956 THEN 1 ELSE 50 END,CASE WHEN i=956 THEN 512 ELSE 100 END,CASE WHEN i=956 THEN 512 ELSE 2 END,CASE WHEN i=956 THEN 512 ELSE 2 END,'2026-11-01','2027-02-10','ativo',2,0.033 FROM generate_series(955,959) i; INSERT INTO parcelas(id,contrato_id,user_id,cliente_id,koletor_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,data_vencimento,status) SELECT i*1000+j,i,1,1,1,6,j,j,CASE WHEN i=956 THEN 1 ELSE 50 END,CASE WHEN i=956 THEN 1 ELSE 50 END,0,0,'2027-02-10','pendente' FROM generate_series(955,959) i CROSS JOIN LATERAL generate_series(1,CASE WHEN i=956 THEN 512 ELSE 2 END) j; UPDATE parcelas SET saldo_residual=1 WHERE contrato_id=958 AND numero=1");
 await sql("INSERT INTO contratos(id,user_id,cliente_id,koletor_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario) VALUES(960,1,1,1,6,'mensal','mensal',100,100,100,1,1,'2026-11-01','2027-02-10','ativo',0,0); INSERT INTO parcelas(id,contrato_id,user_id,cliente_id,koletor_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,data_vencimento,status) VALUES(960001,960,1,1,1,6,1,1,9999999999999.99,9999999999999.99,0,0,'2027-02-10','pendente')");
 await sql("INSERT INTO contratos(id,user_id,cliente_id,koletor_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento_primeira,dia_vencimento,data_vencimento,status,multa_atraso,juros_mora_diario) SELECT i,1,1,1,6,'mensal','mensal',100,50,100,2,2,'2026-11-01','2027-01-10',10,'2027-02-10','ativo',0,0 FROM generate_series(961,962) i; INSERT INTO parcelas(id,contrato_id,user_id,cliente_id,koletor_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,data_vencimento,status) SELECT i*1000+j,i,1,1,1,6,j,j,50,50,0,0,make_date(2027,j,10),'pendente' FROM generate_series(961,962) i CROSS JOIN generate_series(1,2) j");
 await sql("INSERT INTO contas_caixa(id,user_id,nome,tipo,saldo,ativo) VALUES(15,1,'Synthetic unrelated corrupt58','caixa',100,true); INSERT INTO contratos(id,user_id,cliente_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,data_inicio,total_contrato,status) VALUES(95858,1,1,NULL,'mensal','mensal',10,10,'2026-11-01',10,'ativo'); INSERT INTO transacoes_caixa(id,user_id,conta_caixa_id,contrato_id,tipo,categoria,descricao,valor,data_transacao) VALUES(95858,2,15,95858,'saida','emprestimo_liberado','Synthetic unrelated58 foreign leg',10,'2026-11-01')");
 await sql("INSERT INTO contas_caixa(id,user_id,nome,tipo,saldo,ativo) SELECT i,1,'Synthetic target27-'||i,'caixa',100,true FROM generate_series(16,22) i; INSERT INTO contratos(id,user_id,cliente_id,koletor_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,data_inicio,total_contrato,status) SELECT i,1,1,1,i-95844,'mensal','mensal',10,10,'2026-11-01',10,'ativo' FROM generate_series(95860,95865) i; INSERT INTO parcelas(id,contrato_id,user_id,cliente_id,koletor_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,data_vencimento,status) SELECT i,i,1,1,1,i-95844,1,1,10,10,0,0,'2027-02-10','pendente' FROM generate_series(95860,95865) i; INSERT INTO transacoes_caixa(id,user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,descricao,valor,data_transacao) VALUES(95860,2,16,NULL,NULL,'saida','emprestimo_liberado','Synthetic foreign acct27',10,'2026-11-01'),(95861,NULL,17,NULL,NULL,'saida','emprestimo_liberado','Synthetic NULL acct27',10,'2026-11-01'),(95862,1,22,95862,NULL,'saida','emprestimo_liberado','Synthetic wrongcash27',10,'2026-11-01'),(95863,2,22,95863,NULL,'saida','emprestimo_liberado','Synthetic foreign contract27',10,'2026-11-01'),(95864,2,22,NULL,95864,'saida','emprestimo_liberado','Synthetic child NULL contract27',10,'2026-11-01'),(95865,NULL,22,NULL,95865,'saida','emprestimo_liberado','Synthetic child NULL owner27',10,'2026-11-01')");
 await sql("INSERT INTO public.clientes SELECT (jsonb_populate_record(NULL::public.clientes,(SELECT to_jsonb(c) FROM public.clientes c WHERE id=1)||jsonb_build_object('id',3,'user_id',3,'nome','Synthetic owner3 dependency27'))).*; INSERT INTO public.contas_caixa(id,user_id,nome,tipo,saldo,ativo) VALUES(32,3,'Synthetic linked-source27','caixa',100,true),(33,3,'Synthetic linked-destination27','caixa',100,true)");
 const physical=JSON.parse(read(repo+'/tests/calendario46/physical-frozen.json'))[0];
 for(const shape of physical.table_shape)if((await sql('SELECT to_regclass($1) present LIMIT 1',[shape.relation]))[0].present&&shape.kind==='r'&&shape.rls)await sql(`ALTER TABLE ${shape.relation} ENABLE ROW LEVEL SECURITY`);
 const migrations=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa','0036a_multa_metadata_estavel','0037_rpc_aporte_transferencia_caixa','0042_assinaturas_recebimento_atomico','0041_telefone_atomico','0040_cheques_transacionais','0043_reparcelamento_execucao','0044_manutencao_emprestimos','0038c_cancelamento_pendente_isolado','0045_caixa_manutencao_observacao_auditada','0049_manutencao_despesas','0046_calendario25_governado','0047_reparcelamento_atual','0048_manutencao25_governada'];
 for(const m of migrations)await load('drizzle/'+m+'.sql');
 await sql('INSERT INTO public.legados_estados(contrato_id,user_id,snapshot) SELECT 962,1,public.legados_snapshot(962)');
 await import('../installer-profile/synthetic-baseline.mjs').then(m=>m.construct({profile,config,sql,financial,captureOrder,assert,save,result}));
 result.role=(await sql("SELECT current_user,session_user,rolsuper,rolbypassrls,current_setting('listen_addresses') listen,current_setting('server_version') version FROM pg_roles WHERE rolname=current_user LIMIT 1"))[0];assert.equal(result.role.rolsuper,false);assert.equal(result.role.rolbypassrls,profile==='supabase');assert.equal(result.role.listen,'');
 await verify();save('baseline-constraints.json',await sql("SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='private47.cadeia'::regclass ORDER BY conname LIMIT 100"));save('baseline-functions.json',await sql("SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosrc,p.proconfig,p.prosecdef,p.proacl,pg_get_userbyid(p.proowner) owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') ORDER BY n.nspname,p.proname,args LIMIT 1000"));
 if(mode==='baseline'){result.status='BASELINE_OK';console.log('BASELINE GREEN (no new capability tested)');}
 else{
  const ddl=read(candidate+'/drizzle/0051_composicao_obrigacoes.sql');result.ddlSha256=hash(ddl);assert.equal(result.ddlSha256,'4df5a5b8fe7b3f0ed88be71e9376779e79a3c24f5a043fc64f7813dda6c18365','certified statefix DDL bytes');
  const before=await financial();
  // First prove strict preflight rejection under concrete drift and no partial DDL commit.
  await sql('BEGIN');await sql('ALTER FUNCTION manutencao48.proposta(jsonb) SET search_path=public');await reject(()=>sql(ddl),'55000');await sql('ROLLBACK');assert.equal((await sql("SELECT to_regnamespace('obrigacoes51') x LIMIT 1"))[0].x,null);assert.deepEqual(await financial(),before);result.results.push('DDL RED predecessor search_path drift rollback');
  const tampered=ddl.replace("CREATE FUNCTION obrigacoes51.hash(j jsonb)","CREATE FUNCTION obrigacoes51.hash(j jsonb)").replace("SELECT encode(extensions.digest(j::text,'sha256'),'hex')", "SELECT encode(extensions.digest(j::text,'sha256'),'hex') /* unapproved successor */");assert.notEqual(tampered,ddl);await reject(()=>sql(tampered),'55000');await sql('ROLLBACK');assert.equal((await sql("SELECT to_regnamespace('obrigacoes51') x LIMIT 1"))[0].x,null);assert.deepEqual(await financial(),before);result.results.push('DDL RED successor exact body hash rollback');
  await sql(ddl);assert.deepEqual(await financial(),before,'DDL altered financial rows');result.results.push('DDL GREEN strict one-shot install no financial DML');await verify();await rpc('obrigacoes51.verificar');

 const before54Order=await captureOrder(),before54Financial=await financial(),ddl54=read(candidate+'/drizzle/0054_verificacao_obrigacoes_deduplicada.sql');
 result.ddl54Sha256=hash(ddl54);assert.equal(result.ddl54Sha256,pins54.compiledDDLSha256);await sql(ddl54);assert.deepEqual(await financial(),before54Financial);
 assertOrderDelta(before54Order,await captureOrder(),new Set(['obrigacoes51.verificar']),'after54');
 let before52Order=await captureOrder();
 const profileCtx={db,sql,rpc,reject,assert,save,financial,result,config,read,hash,candidate,profile,captureOrder};
 await profileTools.beforeInstall(profileCtx,52);

  if(mode==='green'){
 const ddl52=read(candidate+'/drizzle/0052_inclusao_expandida.sql'),before52=await financial();result.ddl52Sha256=hash(ddl52);save('financial-pre52.json',before52);save('pre52-functions.json',await sql("SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosrc,p.proconfig,p.prosecdef,p.proacl,pg_get_userbyid(p.proowner) owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') ORDER BY n.nspname,p.proname,args LIMIT 1000"));
 await sql('BEGIN');await sql('ALTER FUNCTION obrigacoes51.cotacao(integer,integer,jsonb,timestamptz) SET search_path=public');await reject(()=>sql(ddl52),'55000');await sql('ROLLBACK');assert.equal((await sql("SELECT to_regnamespace('inclusao52') x LIMIT 1"))[0].x,null);assert.deepEqual(await financial(),before52);
 const tampered52=ddl52.replace("RAISE EXCEPTION '52 capability OLD/NEW/owner/op/xid/locks divergente'","RAISE EXCEPTION '52 capability adulterada'");assert.notEqual(tampered52,ddl52);await reject(()=>sql(tampered52),'55000');await sql('ROLLBACK');assert.equal((await sql("SELECT to_regnamespace('inclusao52') x LIMIT 1"))[0].x,null);assert.deepEqual(await financial(),before52);
 await sql(ddl52);assert.deepEqual(await financial(),before52,'52 install changed financial data');save('financial-post52.json',await financial());await verify();await rpc('obrigacoes51.verificar');save('capacidade52.json',await rpc('public.rpc_capacidade_inclusao52'));result.install52={noFinancialDML:true,predecessorDriftRefused:true,successorTamperRefused:true};
 assertOrderDelta(before52Order,await captureOrder(),new Set(pins52.allowlist),'after52');await assertCompiled54('after52');
 await reject(()=>sql(ddl52),'55000');await sql('ROLLBACK');await sql('BEGIN');await sql('ALTER TABLE inclusao52.adicionais DISABLE TRIGGER commit52');await reject(()=>rpc('public.rpc_capacidade_inclusao52'),'55000');await reject(()=>rpc('public.rpc_capacidade_obrigacoes51'),'25P02');await sql('ROLLBACK');await rpc('public.rpc_capacidade_inclusao52');result.install52.runtimeDriftFailClosed=true;
 save('post52-functions.json',await sql("SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosrc,p.proconfig,p.prosecdef,p.proacl,pg_get_userbyid(p.proowner) owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') ORDER BY n.nspname,p.proname,args LIMIT 1000"));
 }
 if(mode==='green'){
  const ctx={db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,candidate,out},start53=result.results.length;
  const chain=await import('../sucessores53/red53.mjs').then(m=>m.scenarios(ctx));
 const before53Order=await captureOrder();await profileTools.beforeInstall(profileCtx,53);
  await import('../sucessores53/green53.mjs').then(m=>m.scenarios({...ctx,chain}));
 assertOrderDelta(before53Order,await captureOrder(),new Set(['private47.validar','public.multimodal_guardar']),'after53');await assertCompiled54('after53');
  result.results53=result.results.splice(start53);assert.equal(result.results53.length,11);
  result.ddl53Sha256=hash(read(candidate+'/drizzle/0053_sucessores_financeiros.sql'));await rpc('inclusao52.verificar');
  save('post53-functions.json',await sql("SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosrc,p.proconfig,p.prosecdef,p.proacl,pg_get_userbyid(p.proowner) owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') ORDER BY n.nspname,p.proname,args LIMIT 1000"));
 }
 await import('./native-fixture31.mjs').then(async m=>{await m.setup({sql,reject,assert,save,result,config,captureOrder});await m.ready({sql,reject,assert,save,result,config,captureOrder});});
 await import('./proof-installer31.mjs').then(m=>m.proof({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,read,hash,candidate,captureOrder}));
 if(mode==='green'){await import('../composition-obrigacoes/inclusao52.mjs').then(m=>m.inclusao52({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,candidate,out}));}
 await import('../composition-obrigacoes/scenarios51.mjs').then(m=>m.scenarios({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,candidate,out}));
  await import('../composition-obrigacoes/statefix51.mjs').then(m=>m.statefix({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,candidate,out}));
  assert.equal(result.results.filter(x=>!x.startsWith('append_')).length,31);result.regressions51=31;if(mode==='red'){await import('../composition-obrigacoes/inclusao52.mjs').then(m=>m.inclusao52({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,candidate,out}));}
  if(mode==='green')await import('../composition-obrigacoes/adversarial52.mjs').then(m=>m.adversarial52({sql,rpc,reject,randomUUID,assert,save,financial,result,config}));
  await assertCompiled54('final-after-adversarial52-and31reg51');await import('./target31.mjs').then(m=>m.targets({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,read,hash,candidate,captureOrder})); await import('./races31.mjs').then(m=>m.races({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,read,hash,candidate,captureOrder})); await import('./linked29.mjs').then(m=>m.linked({sql,rpc,reject,assert,save,financial,verify,result,config,captureOrder,randomUUID})); await import('./native-fixture31.mjs').then(m=>m.finish({assert,save,result,config,captureOrder})); result.status='GREEN';console.log('GREEN51 executable SQL scenarios; TS is tested separately by Vitest');
 }
}catch(e){result.status='RED';result.errors.push({message:e.message,code:e.code,where:e.where,detail:e.detail,stack:e.stack});console.error(e);process.exitCode=1;}
finally{
 if(db)await db.end().catch(()=>{});if(bootstrap)await bootstrap.end().catch(()=>{});
 try {
  if(started){
   run('pg_ctl',['-D',root+'/data','-m','immediate','-w','stop']);
   let status;try{run('pg_ctl',['-D',root+'/data','status']);status=0;}catch(e){status=e.status;}
   const pidAbsent=!fs.existsSync(root+'/data/postmaster.pid');
   result.cleanup={stopped:status===3,status,pidAbsent,privateSocket:true,socketMode:fs.statSync(root+'/s').mode&0o777};
   assert.equal(status,3);assert.equal(pidAbsent,true);assert.equal(result.cleanup.socketMode,0o700);
  }
  if(fs.existsSync(root+'/postgres.log'))save('postgres-'+mode+'.log',read(root+'/postgres.log'));
 }catch(e){result.status='RED';result.errors.push({message:e.message,stage:'cleanup'});process.exitCode=1;}
 finally{fs.rmSync(root,{recursive:true,force:true});result.cleanup={...result.cleanup,rootRemoved:!fs.existsSync(root)};save('result-'+mode+'.json',result);console.log('RESULT51 '+out+'/result-'+mode+'.json');}
}
