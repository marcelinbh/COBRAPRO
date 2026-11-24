import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,openSync,closeSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const suite=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(suite,'../..'),out=path.join(suite,'artifacts'),bin=process.env.PG_BIN||(existsSync('/usr/lib/postgresql/17/bin/initdb')?'/usr/lib/postgresql/17/bin':execFileSync('pg_config',['--bindir'],{encoding:'utf8'}).trim());
const mode='certified',evidence=path.join(out,'evidence',mode);mkdirSync(evidence,{recursive:true});
const root=mkdtempSync(evidence+'/pg17-');mkdirSync(root+'/socket',{mode:0o700});const fd=openSync(root+'/socket','r'),socket=`/proc/${process.pid}/fd/${fd}`,port=55549;
const env={PATH:'/usr/bin:/bin',HOME:root,LANG:'C.UTF-8'},run=(cmd,args)=>execFileSync(bin+'/'+cmd,args,{env,encoding:'utf8'}),read=p=>readFileSync(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const save=(n,v)=>writeFileSync(evidence+'/'+n,JSON.stringify(v,null,2)+'\n');
const files=[["42","drizzle/0042_assinaturas_recebimento_atomico.sql","0df0301ade56145681b721da149fc3048a46ed630cfe1be771c0bcfcf25c83fb"],["41","drizzle/0041_telefone_atomico.sql","dead49422eecd04c18b241dd0f4c4421f0e8edc1e5ccc9ecebda10adfc76bb6d"],["40","drizzle/0040_cheques_transacionais.sql","d829fa99f81b3ec0f023480cad0cdb80a5c704e58c6aed532fc2ad10ec91d1af"],["43","drizzle/0043_reparcelamento_execucao.sql","8d4bc41efa0ae6917e2f685b2d3e7f6ee293f75a9aef5e07be736cc80d1fc4c7"],["44","drizzle/0044_manutencao_emprestimos.sql","16cb42492a21e1b79d208dd82e6b9bdf79579fa746cdff620226939614951f76"],["38c","drizzle/0038c_cancelamento_pendente_isolado.sql","5fe0f34f68ed727da7058ff1fad9883fb36b6d38400ef65964a66d578d5bb261"],["45","drizzle/0045_caixa_manutencao_observacao_auditada.sql","8cec2a580792d47216b23891f73bc6fd58094fb8c44bcb17d252ad4f41516ac1"]];
const migrations=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa','0036a_multa_metadata_estavel','0037_rpc_aporte_transferencia_caixa'];
let started=false,db,bootstrap;const result={mode,results:[],files:[],errors:[]};
const sql=async(q,v=[])=>(await db.query(q,v)).rows,rpc=async(n,v=[])=>(await sql(`SELECT ${n}(${v.map((_,i)=>'$'+(i+1)).join(',')}) r`,v))[0].r;
const reject=async(fn,code)=>{let e;try{await fn();}catch(x){e=x;}assert.ok(e,'expected '+code);assert.equal(e.code,code,e.message);return e;};
const scenario=async(n,fn)=>{await fn();result.results.push(n);console.log('PASS '+n);};
const functions=()=>sql("SELECT p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosrc,p.proacl,p.proconfig,p.proowner,p.prosecdef,p.prorettype FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' ORDER BY p.oid");
const financial=async()=>JSON.stringify((await sql("SELECT jsonb_build_object('a',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),'c',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contratos c),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p),'s',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM assinaturas s)) s"))[0].s);
const seals=()=>sql("SELECT (SELECT assinatura FROM legados_manifesto WHERE versao=1) s34,(SELECT assinatura FROM multimodal_manifesto WHERE id=1) s35,(SELECT assinatura FROM multa36_manifesto WHERE id=1) s36,(SELECT assinatura FROM caixa37_manifesto WHERE id=1) s37");
const verify=async()=>{for(const n of ['legados_verificar','multimodal_verificar','multa36_verificar','caixa37_verificar'])await rpc('public.'+n);};
const catalog=()=>sql(`WITH ns AS(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema'),rels AS(SELECT oid FROM pg_class WHERE relnamespace IN(SELECT oid FROM ns))
SELECT 'class:'||oid k,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] v FROM pg_class c WHERE oid IN(SELECT oid FROM rels)
UNION ALL SELECT 'attribute:'||attrelid||':'||attnum,to_jsonb(a) FROM pg_attribute a WHERE attrelid IN(SELECT oid FROM rels)
UNION ALL SELECT 'type:'||oid,to_jsonb(t) FROM pg_type t WHERE typnamespace IN(SELECT oid FROM ns)
UNION ALL SELECT 'constraint:'||oid,to_jsonb(c) FROM pg_constraint c WHERE connamespace IN(SELECT oid FROM ns)
UNION ALL SELECT 'trigger:'||oid,to_jsonb(t) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM rels)
UNION ALL SELECT 'default:'||oid,to_jsonb(d) FROM pg_attrdef d WHERE adrelid IN(SELECT oid FROM rels) ORDER BY k`);
try{
 for(const [f,h] of Object.entries({"drizzle/0020_rpc_despesas_prospectivas.sql": "a6852e4160dcadf21f81029daf231af6d308fab7f8733b3e16769d03923bc452", "drizzle/0021_rpc_emprestimos_prospectivos.sql": "08b05165412c8f6259db98d70c8d220c6f99c7a3a6bc7866aa86cc00b0558a82", "drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql": "abce663253f85eafe03d3c4f9a81d601941164bba7ef4d0d8024b892be88f64c", "drizzle/0025_integrar_rpc_despesas_ciclo.sql": "63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199", "drizzle/0031_rpc_renovacao_juros_prospectiva.sql": "f0d0db2cafecd39c7f9ce0296683e66141ee8bbad4243b079b5994244f02db7f", "drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql": "7ec52905fa260dc6d14af5fabcef74a2a1a7f0fa65874e15d3bd8358cadc5827", "drizzle/0034_rpc_recebimento_legado_validado.sql": "615d0b81fb1a41b5dd205214ebddc7e32f0d75576022df66905bc90396959ad0", "drizzle/0035_rpc_ciclo_emprestimos_multimodal.sql": "6e5c11587d571e64a51585488c2fad7075f4d5dfeb9202a3a5dced795a9c0b03", "drizzle/0036_rpc_multa_manual_fixa.sql": "7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f", "drizzle/0036a_multa_metadata_estavel.sql": "df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f", "drizzle/0037_rpc_aporte_transferencia_caixa.sql": "2acc5c0840e77a1131fa02d04f0b1faf85bbdb0430071b73477a276ded312334", "tests/postgres-loans/fixture.sql": "aff45b7950b2c458f172a06109ad3f7f0b9e56ef922bf7d5e52405acb3672f2d", "tests/postgres-financial-coexistence/fixture.sql": "021e28f520360579794e05d3f40730f1c0f7d779c4a5873c883b786fe6709316", "tests/postgres-caixa37/fixture.sql": "e760b313a1dc7bfe77d4e837ac031bf1a0ced2808734703c342eb486e27c23fe", "drizzle/0009_assinaturas.sql": "2d0555669cd407beef1579539498067d022ab18a8d8890c6ea7fbd692d4a72eb", "tests/release-restantes/fixtures/cheques40.sql": "5d7ff610f8b065c2b701667c6b4866ef91fcc5430086f334385dd8c79bdccb93", "tests/release-restantes/fixtures/telefone41.sql": "f2433b9fae841120316d4498ff5d0959556803087bf6fef3cabaaeb00335e1b4"}))assert.equal(hash(read(repo+'/'+f)),h,f+' pinned baseline');
 for(const [id,f,h] of files)assert.equal(hash(read(repo+'/'+f)),h,id+' original SHA');
 run('initdb',['-D',root+'/data','-U','harness_combined','-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',root+'/data','-l',root+'/postgres.log','-o',`-k ${socket} -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
 const config={host:socket,port,user:'postgres',database:'postgres'};bootstrap=new pg.Client({...config,user:'harness_combined'});await bootstrap.connect();
 await bootstrap.query('CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS CREATEDB CREATEROLE; ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres');
 db=new pg.Client(config);await db.connect();await sql("SET TimeZone='UTC'; SET statement_timeout='60s'");
 for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql','tests/postgres-caixa37/fixture.sql'])await sql(read(repo+'/'+f).replace('ALTER ROLE service_role NOSUPERUSER BYPASSRLS;',''));
 await bootstrap.query('ALTER ROLE service_role NOSUPERUSER BYPASSRLS; GRANT anon,authenticated,service_role TO postgres WITH SET TRUE');await bootstrap.end();bootstrap=null;
 await sql(read(suite+'/fixtures/cheques40.sql'));await sql(read(suite+'/fixtures/telefone41.sql'));
 const schema9=read(repo+'/drizzle/0009_assinaturas.sql');await sql(schema9.slice(0,schema9.indexOf('-- Adicionar coluna contagem_renovacoes')));await sql('ALTER TABLE assinaturas ADD COLUMN user_id integer; ALTER TABLE pagamentos_assinatura ADD COLUMN user_id integer');
 await sql("INSERT INTO assinaturas(id,user_id,cliente_id,servico,valor_mensal,data_inicio,conta_caixa_id,status) VALUES(42,1,1,'Combinada sintética',29.90,'2026-01-01',1,'ativa')");
 await sql("INSERT INTO contratos(id,user_id,cliente_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario) VALUES(920,1,1,6,'mensal','mensal',100,100,100,1,1,'2026-01-01','2026-02-01','ativo',2,0.033); INSERT INTO parcelas(id,contrato_id,user_id,cliente_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,data_vencimento,status) VALUES(920,920,1,1,6,1,1,100,100,0,0,'2026-02-01','pendente')");
 result.role=(await sql("SELECT current_user,session_user,rolsuper,rolbypassrls,current_setting('listen_addresses') listen,current_setting('server_version') version FROM pg_roles WHERE rolname=current_user"))[0];assert.match(result.role.version,/^17\./);assert.equal(result.role.rolsuper,false);assert.equal(result.role.rolbypassrls,true);assert.equal(result.role.listen,'');
 result.baselines=migrations.map(m=>({path:repo+'/drizzle/'+m+'.sql',sha256:hash(read(repo+'/drizzle/'+m+'.sql'))}));
 for(const m of migrations){await sql(read(repo+'/drizzle/'+m+'.sql'));console.log('INSTALL '+m);}
 for(const [id,f,h] of files){
  const used=repo+'/'+f,target=read(used);assert.equal(hash(target),h,id+' installed file SHA');
  const before=await functions(),beforeSeals=await seals(),financialBefore=await financial();save(id+'-before-functions.json',before);save(id+'-before-seals.json',beforeSeals);
  const beforeCatalog=await catalog();save(id+'-before-catalog.json',beforeCatalog);
  if(id==='43'&&mode!=='original'){
   const drifts=['ALTER FUNCTION public.ciclo_guardar() SET search_path=public','ALTER FUNCTION public.multimodal_validar(integer,integer) SET search_path=public','ALTER TABLE parcelas DISABLE TRIGGER ciclo_parcela'];
   const red=[];
   for(const ddl of drifts){await sql('BEGIN');await sql(ddl);const e=await reject(()=>sql(target),'55000');await sql('ROLLBACK');red.push({ddl,code:e.code,message:e.message});assert.deepEqual(await functions(),before);assert.deepEqual(await seals(),beforeSeals);}
   const bad=target.replace('BEGIN\n IF confirmacao','BEGIN\n /* unexpected source43 */\n IF confirmacao');assert.notEqual(bad,target);const e=await reject(()=>sql(bad),'55000');await sql('ROLLBACK');red.push({ddl:'tampered new43 prosrc, expected pins unchanged',code:e.code,message:e.message});assert.deepEqual(await functions(),before);assert.deepEqual(await seals(),beforeSeals);save('43-preflight-drift-red.json',red);console.log('PASS43 preflight rejects unknown bridge/35/trigger/new43 sources without reseal');
  }
  console.log('INSTALL '+id+' '+hash(target));
  try{await sql(target);}catch(e){save(id+'-failure.json',{message:e.message,code:e.code,where:e.where,detail:e.detail});throw e;}
  await verify();const after=await functions();save(id+'-after-functions.json',after);save(id+'-after-seals.json',await seals());
  const afterCatalog=await catalog();save(id+'-after-catalog.json',afterCatalog);const existingCatalogChanges=beforeCatalog.filter(a=>JSON.stringify(a)!==JSON.stringify(afterCatalog.find(b=>b.k===a.k))).map(a=>a.k);
  if(['43','44','38c','45'].includes(id))assert.deepEqual(existingCatalogChanges,[],'existing rowtypes/catalog changed '+id);
  const changed=before.filter(a=>JSON.stringify(a)!==JSON.stringify(after.find(b=>b.oid===a.oid))).map(a=>a.nspname+'.'+a.proname);
  result.files.push({id,path:used,sha256:hash(target),changedPredecessorFunctions:changed,existingCatalogChanges});
  if(['43','44','38c','45'].includes(id))assert.equal(await financial(),financialBefore,'financial rows changed during DDL '+id);
  console.log('PASS installed '+id+' changed predecessors '+changed.join(','));
 }
 assert.equal((await rpc('public.rpc_capacidades_cancelamento_despesa38c')).habilitado,false,'38c must install defaultOFF');
 assert.equal((await sql('SELECT count(*)::int n FROM despesa_cancelamento_v1.flags'))[0].n,0,'installation must not enable38c');
 await import('./runtime.mjs').then(m=>m.runtime({sql,rpc,reject,scenario,randomUUID,assert,save,functions,seals,financial,verify,result}));
 result.definerOwners=await sql("SELECT DISTINCT r.rolname,r.rolsuper,r.rolbypassrls FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND p.prosecdef");
 for(const r of result.definerOwners){assert.equal(r.rolname,'postgres');assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,true);}
 result.originalsUnchanged=files.map(([id,f,h])=>{assert.equal(hash(read(repo+'/'+f)),h);return{id,path:repo+'/'+f,sha256:h};});
 assert.equal(result.results.length,13);result.status='PASS';console.log('GREEN cumulative stack with runtime');
}catch(e){result.status='FAIL';result.errors.push({message:e.message,code:e.code,where:e.where,detail:e.detail,stack:e.stack});console.error(e);process.exitCode=1;}
finally{if(db)await db.end().catch(()=>{});if(bootstrap)await bootstrap.end().catch(()=>{});if(started){run('pg_ctl',['-D',root+'/data','-m','immediate','-w','stop']);let status;try{run('pg_ctl',['-D',root+'/data','status']);status=0;}catch(e){status=e.status;}result.cleanup={stopped:status===3,status,root};rmSync(root+'/data',{recursive:true,force:true});}closeSync(fd);save('result.json',result);}
