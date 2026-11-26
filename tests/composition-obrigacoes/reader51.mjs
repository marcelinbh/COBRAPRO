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
const base=fs.mkdtempSync(path.join(temp,'reader51-artifacts-')),out=path.join(base,'logs');fs.mkdirSync(out,{mode:0o700});
const mode='reader-only-private',root=fs.mkdtempSync(path.join(temp,'cp51-'));fs.chmodSync(root,0o700);fs.mkdirSync(root+'/socket',{mode:0o700});
console.log('ARTIFACTS51 '+base);
const pinnedSources=JSON.parse(fs.readFileSync(new URL('./predecessor-sources.json',import.meta.url),'utf8'));

const env={PATH:'/usr/bin:/bin',HOME:process.env.HOME,LANG:'C.UTF-8'},run=(name,args)=>execFileSync(bin+'/'+name,args,{env,encoding:'utf8'}),read=p=>fs.readFileSync(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const sources=[],result={mode,startedAt:new Date().toISOString(),results:[],errors:[],sources,namespace:{net:fs.readlinkSync('/proc/self/ns/net'),mnt:fs.readlinkSync('/proc/self/ns/mnt'),pid:fs.readlinkSync('/proc/self/ns/pid')},root};
const save=(n,v)=>fs.writeFileSync(out+'/'+n,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
let started=false,db,bootstrap;
const sql=async(q,v=[])=>(await db.query(q,v)).rows,rpc=async(n,v=[])=>(await sql(`SELECT ${n}(${v.map((_,i)=>'$'+(i+1)).join(',')}) r`,v))[0].r;
const reject=async(fn,code)=>{let e;try{await fn();}catch(x){e=x;}assert.ok(e,'expected SQL refusal '+code);if(code)assert.equal(e.code,code,e.message);return e;};
const scenario=async(n,fn)=>{await fn();result.results.push(n);console.log('PASS51 '+n);};
const financial=async()=>(await sql("SELECT jsonb_build_object('contas',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a),'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),'contratos',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contratos c),'parcelas',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p),'historico',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM contrato_historico h)) s LIMIT 1"))[0].s;
const verify=async()=>{for(const f of ['public.legados_verificar','public.multimodal_verificar','public.multa36_verificar','public.caixa37_verificar','manutencao44.verificar','caixa_manutencao45.verificar','calendario46.verificar','private47.verificar','manutencao48.verificar','despesas49.verificar'])await rpc(f);};
result.testSources=Object.fromEntries(['reader51.mjs','reader51-focused.mjs','reader51-fixture.sql'].map(f=>[f,hash(read(candidate+'/tests/composition-obrigacoes/'+f))]));
result.readSources=Object.fromEntries(['shared/obrigacoes51.ts','shared/obrigacoes51Projection.ts','server/services/obrigacoes51Rpc.ts'].map(f=>[f,hash(read(candidate+'/'+f))]));
try{
 for(const [file,expected] of Object.entries(pinnedSources))assert.equal(hash(read(path.join(repo,file))),expected,file+' BYTE-EXACT certified input');
 run('initdb',['-D',root+'/data','-U','bootstrap51','-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',root+'/data','-l',root+'/postgres.log','-o',`-k ${root}/socket -p 55751 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
 const config={host:root+'/socket',port:55751,user:'postgres',database:'postgres'};
 bootstrap=new pg.Client({...config,user:'bootstrap51'});await bootstrap.connect();await bootstrap.query('CREATE ROLE postgres LOGIN NOSUPERUSER NOBYPASSRLS CREATEDB CREATEROLE; ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres; CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT anon,authenticated,service_role TO postgres WITH SET TRUE');await bootstrap.end();bootstrap=null;
 db=new pg.Client(config);await db.connect();await sql("SET TimeZone='UTC'; SET search_path=public,pg_catalog; SET statement_timeout='90s'");
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
 await sql(read(candidate+'/tests/composition-obrigacoes/reader51-fixture.sql'));
 const physical=JSON.parse(read(repo+'/tests/calendario46/physical-frozen.json'))[0];
 for(const shape of physical.table_shape)if((await sql('SELECT to_regclass($1) present LIMIT 1',[shape.relation]))[0].present&&shape.kind==='r'&&shape.rls)await sql(`ALTER TABLE ${shape.relation} ENABLE ROW LEVEL SECURITY`);
 const migrations=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa','0036a_multa_metadata_estavel','0037_rpc_aporte_transferencia_caixa','0042_assinaturas_recebimento_atomico','0041_telefone_atomico','0040_cheques_transacionais','0043_reparcelamento_execucao','0044_manutencao_emprestimos','0038c_cancelamento_pendente_isolado','0045_caixa_manutencao_observacao_auditada','0049_manutencao_despesas','0046_calendario25_governado','0047_reparcelamento_atual','0048_manutencao25_governada'];
 for(const m of migrations)await load('drizzle/'+m+'.sql');
 result.role=(await sql("SELECT current_user,session_user,rolsuper,rolbypassrls,current_setting('listen_addresses') listen,current_setting('server_version') version FROM pg_roles WHERE rolname=current_user LIMIT 1"))[0];assert.equal(result.role.rolsuper,false);assert.equal(result.role.rolbypassrls,false);assert.equal(result.role.listen,'');
 await verify();save('baseline-constraints.json',await sql("SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='private47.cadeia'::regclass ORDER BY conname LIMIT 100"));save('baseline-functions.json',await sql("SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosrc,p.proconfig,p.prosecdef,p.proacl,pg_get_userbyid(p.proowner) owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') ORDER BY n.nspname,p.proname,args LIMIT 1000"));
 if(mode==='baseline'){result.status='BASELINE_OK';console.log('BASELINE GREEN (no new capability tested)');}
 else{
  const ddl=read(candidate+'/drizzle/0051_composicao_obrigacoes.sql');result.ddlSha256=hash(ddl);assert.equal(result.ddlSha256,'4df5a5b8fe7b3f0ed88be71e9376779e79a3c24f5a043fc64f7813dda6c18365','certified statefix DDL bytes');
  const before=await financial();
  await sql(ddl);assert.deepEqual(await financial(),before,'DDL0051 altered financial rows');await verify();await rpc('obrigacoes51.verificar');
  await import('./reader51-focused.mjs').then(m=>m.focused({db,sql,rpc,reject,scenario,assert,save,financial,verify,result,config,candidate,out}));
  assert.ok(result.results.length>=10);result.status='GREEN';console.log('GREEN reader-only focused SQL+APP real fixtures; no official FULL gate');
 }
}catch(e){result.status='RED';result.errors.push({message:e.message,code:e.code,where:e.where,detail:e.detail,stack:e.stack});console.error(e);process.exitCode=1;}
finally{
 if(db)await db.end().catch(()=>{});if(bootstrap)await bootstrap.end().catch(()=>{});
 try {
  if(started){
   run('pg_ctl',['-D',root+'/data','-m','immediate','-w','stop']);
   let status;try{run('pg_ctl',['-D',root+'/data','status']);status=0;}catch(e){status=e.status;}
   const pidAbsent=!fs.existsSync(root+'/data/postmaster.pid');
   result.cleanup={stopped:status===3,status,pidAbsent,privateSocket:true,socketMode:fs.statSync(root+'/socket').mode&0o777};
   assert.equal(status,3);assert.equal(pidAbsent,true);assert.equal(result.cleanup.socketMode,0o700);
  }
  if(fs.existsSync(root+'/postgres.log'))save('postgres-'+mode+'.log',read(root+'/postgres.log'));
 }catch(e){result.status='RED';result.errors.push({message:e.message,stage:'cleanup'});process.exitCode=1;}
 finally{fs.rmSync(root,{recursive:true,force:true});result.cleanup={...result.cleanup,rootRemoved:!fs.existsSync(root)};save('result-'+mode+'.json',result);console.log('RESULT51 '+out+'/result-'+mode+'.json');}
}
