import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync,copyFileSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
import {report36a} from './report36a.mjs';
const out='tests/postgres-multa-metadata36a',bin='/usr/lib/postgresql/17/bin',port=55486;
const read=p=>readFileSync(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const migrations=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa'];
const frozen=['a6852e4160dcadf21f81029daf231af6d308fab7f8733b3e16769d03923bc452','08b05165412c8f6259db98d70c8d220c6f99c7a3a6bc7866aa86cc00b0558a82','abce663253f85eafe03d3c4f9a81d601941164bba7ef4d0d8024b892be88f64c','63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199','f0d0db2cafecd39c7f9ce0296683e66141ee8bbad4243b079b5994244f02db7f','7ec52905fa260dc6d14af5fabcef74a2a1a7f0fa65874e15d3bd8358cadc5827','615d0b81fb1a41b5dd205214ebddc7e32f0d75576022df66905bc90396959ad0','6e5c11587d571e64a51585488c2fad7075f4d5dfeb9202a3a5dced795a9c0b03','7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f'];
const volatile=['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'];
const quote=n=>'"'+n.replaceAll('"','""')+'"';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function certify(){
 const sources=migrations.map(m=>read(`drizzle/${m}.sql`)),target=read('drizzle/0036a_multa_metadata_estavel.sql'),sha=hash(target);
 const result={sql36aSha256:sha,sql36Sha256:hash(sources.at(-1)),frozen:Object.fromEntries(migrations.map((m,i)=>[m,hash(sources[i])])),commands:[],results:[],databases:[],failures:[],cleanup:null};
 const record=s=>{result.results.push(s);console.log(s);};
 const failure=(id,e,fresh)=>{result.failures.push({id,fresh,code:e.code,message:e.message,detail:e.detail,stack:e.stack});record(`FAIL ${fresh??''} ${id}: ${e.code??''} ${e.message}`);writeFileSync(`${out}/PROGRESS36a.md`,`# PROGRESS36a\n\nFalha detectada; target/builder não modificados.\n\n${result.failures.map(x=>`- fresh${x.fresh??''} ${x.id}: ${x.code??''} ${x.message}\n${x.detail??''}`).join('\n')}\n`);};
 let root,started=false,admin;
 const run=(cmd,args)=>{result.commands.push([cmd,...args]);return execFileSync(cmd,args,{env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:process.cwd()},encoding:'utf8'});};
 try{
  sources.forEach((s,i)=>assert.equal(hash(s),frozen[i],`Frozen ${migrations[i]}`));
  record(run(process.execPath,[`${out}/build.mjs`,'--check']).trim());
  const old=functionsFromSQL(sources.at(-1)).find(f=>f.proname==='multa36_metadata'),fixed=functionsFromSQL(target);
  assert.equal(fixed.length,1);assert.equal(fixed[0].proname,'multa36_metadata');
  assert.equal(fixed[0].body,old.body.replace("'tables',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid)","'tables',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid)"));
  record(`PASS STATIC único corpo metadata36 alterado, seis campos voláteis; SHA=${sha}`);
  root=mkdtempSync(`${process.cwd()}/${out}/.pg17-`);mkdirSync(`${root}/socket`,{mode:0o700});
  run(`${bin}/initdb`,['-D',`${root}/data`,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
  // Thresholds padrão até36a; configuração global só muda após hotfix.
  // reloptions das tabelas permanecem NULL; autovacuum nunca é desligado.
  run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-l',`${root}/postgres.log`,'-o',`-k ${root}/socket -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700 -c autovacuum=on -c autovacuum_naptime=1s -c log_autovacuum_min_duration=0`,'-w','start']);started=true;
  const base={host:`${root}/socket`,port,user:'postgres',database:'postgres'};admin=new pg.Client(base);await admin.connect();
  result.environment=(await admin.query("SELECT version() version,current_setting('autovacuum') autovacuum,current_setting('autovacuum_naptime') naptime,current_setting('listen_addresses') listen,current_setting('unix_socket_permissions') socket_permissions,current_setting('autovacuum_vacuum_threshold') vacuum_threshold,current_setting('autovacuum_vacuum_scale_factor') vacuum_scale_factor,current_setting('autovacuum_analyze_threshold') analyze_threshold")).rows[0];
  assert.equal(result.environment.autovacuum,'on');assert.equal(result.environment.listen,'');assert.equal(statSync(`${root}/socket`).mode&0o777,0o700);record(`ENV ${JSON.stringify(result.environment)}`);
  for(let fresh=1;fresh<=2;fresh++){
   for(const setting of ['autovacuum_vacuum_threshold','autovacuum_vacuum_scale_factor','autovacuum_analyze_threshold'])await admin.query(`ALTER SYSTEM RESET ${setting}`);
   await admin.query('SELECT pg_reload_conf()');await delay(200);
   const name=`metadata36a_fresh${fresh}`;await admin.query(`CREATE DATABASE ${name}`);const db=new pg.Client({...base,database:name});await db.connect();
   const evidence={fresh,name,checks:[],negatives:[],maintenance:[],installDelta:null,autovacuum:null};result.databases.push(evidence);
   const sql=async(q,v=[])=>(await db.query(q,v)).rows;
   const manifest=async()=>sql('SELECT id,assinatura FROM multa36_manifesto ORDER BY id');
   const verify=async()=>{await sql('SELECT legados_verificar(),multimodal_verificar(),multa36_verificar()');};
   const rpc=async(n,v=[])=>{await sql('SET ROLE service_role');try{return(await sql(`SELECT public.${n}(${v.map((_,i)=>`$${i+1}`).join(',')}) r`,v))[0].r;}finally{await sql('RESET ROLE');}};
   const snapshot=async()=>{
    const tables=await sql("SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname<>'multa36_manifesto' ORDER BY c.relname");const data={};
    for(const {relname} of tables){const r=(await sql(`SELECT count(*)::int n,coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text s FROM public.${quote(relname)} t`))[0];data[relname]={count:r.n,sha256:hash(r.s)};}return data;
   };
   const catalog=async()=>{
    const r={};for(const [key,q] of Object.entries({functions:"SELECT to_jsonb(p) j FROM pg_proc p WHERE pronamespace='public'::regnamespace ORDER BY oid",relations:"SELECT to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] j FROM pg_class c WHERE relnamespace='public'::regnamespace ORDER BY oid",attributes:"SELECT to_jsonb(a) j FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace ORDER BY attrelid,attnum",constraints:"SELECT to_jsonb(k) j FROM pg_constraint k WHERE connamespace='public'::regnamespace ORDER BY oid",policies:"SELECT to_jsonb(p) j FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace ORDER BY p.oid",triggers:"SELECT to_jsonb(t) j FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace ORDER BY t.oid",sequences:"SELECT to_jsonb(s) j FROM pg_sequences s WHERE schemaname='public' ORDER BY sequencename"}))r[key]=(await sql(q)).map(x=>x.j);return r;
   };
   const classes=async()=>(await sql("SELECT to_jsonb(c) j FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'multa36\\_%' ESCAPE '\\' AND c.relkind IN('r','S') ORDER BY oid")).map(x=>x.j);
   const diff=(a,b)=>a.flatMap(x=>{const y=b.find(y=>y.oid===x.oid);return Object.keys(x).filter(k=>JSON.stringify(x[k])!==JSON.stringify(y?.[k])).map(k=>({relation:x.relname,field:k,before:x[k],after:y?.[k]}));});
   const reject=async(f)=>{let e;try{await f();}catch(x){e=x;}assert.ok(e,'esperava recusa55000');assert.equal(e.code,'55000',`${e.code} ${e.message}`);return {code:e.code,message:e.message};};
   const body=target.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
   const check=async(id,f)=>{try{await f();evidence.checks.push(id);record(`PASS fresh${fresh} ${id}`);return true;}catch(e){await sql('ROLLBACK').catch(()=>{});await sql('RESET ROLE').catch(()=>{});failure(id,e,fresh);return false;}};
   const gate=async(id,ddl,query=body)=>{
    const before=await snapshot(),seal=await manifest();await sql('BEGIN');let rejection;
    try{await sql(ddl);await sql('SAVEPOINT reject36a');rejection=await reject(()=>sql(query));await sql('ROLLBACK TO SAVEPOINT reject36a');assert.deepEqual(await snapshot(),before);assert.deepEqual(await manifest(),seal);}finally{await sql('ROLLBACK');}
    assert.deepEqual(await snapshot(),before);assert.deepEqual(await manifest(),seal);await verify();evidence.negatives.push({id,...rejection,financialChangedRows:0,proofChangedRows:0,reseal:false});
   };
   try{
    await sql("SET statement_timeout='60s'; SET TimeZone='UTC'");
    for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql'])await sql(fresh===2?read(f).replace(/^CREATE ROLE .*;$/gm,''):read(f));
    await sql('ALTER TABLE users ADD COLUMN "passwordHash" text,ADD COLUMN session_version integer NOT NULL DEFAULT 0,ADD CONSTRAINT users_session_version_nonnegative CHECK(session_version>=0)');
    for(const s of sources)await sql(s);await verify();record(`INSTALLED frozen20/21/22/25/31/33/34/35/36 fresh${fresh}`);
    evidence.originalControl={verifier34_35_36:true,classes:await classes(),seal:await manifest(),settings:(await sql("SELECT current_setting('autovacuum') av,current_setting('autovacuum_vacuum_threshold') threshold,current_setting('autovacuum_vacuum_scale_factor') scale"))[0]};
    evidence.initialSnapshot=await snapshot();
    await check('original ANALYZE invalida selo e hotfix recusa sem instalar/reseal',async()=>{
     // ANALYZE pode persistir estatística apesar de ROLLBACK no PG17 real.
     // Base adicional dedicada; nunca reparar/resselar o selo inválido.
     const extra=`metadata36a_old_analyze${fresh}`;await admin.query(`CREATE DATABASE ${extra}`);
     const x=new pg.Client({...base,database:extra});await x.connect();
     const xs=async(q,v=[])=>(await x.query(q,v)).rows;
     const xc=async()=>(await xs("SELECT to_jsonb(c) j FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'multa36\\_%' ESCAPE '\\' AND c.relkind IN('r','S') ORDER BY oid")).map(v=>v.j);
     const xw=async()=>(await xs("SELECT jsonb_build_object('functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace),'manifest',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM multa36_manifesto m),'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),'contratos',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM contratos t),'parcelas',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM parcelas t),'money',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM contas_caixa t)) j"))[0].j;
     try{
      for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql'])await xs(read(f).replace(/^CREATE ROLE .*;$/gm,''));
      await xs('ALTER TABLE users ADD COLUMN "passwordHash" text,ADD COLUMN session_version integer NOT NULL DEFAULT 0,ADD CONSTRAINT users_session_version_nonnegative CHECK(session_version>=0)');
      for(const s of sources)await xs(s);await xs('SELECT multa36_verificar()');
      const before=await xw(),c0=await xc();await xs('BEGIN');
      try{await xs('ANALYZE public.multa36_capacidades');const d=diff(c0,await xc());assert.ok(d.some(v=>volatile.includes(v.field)));await xs('SAVEPOINT oldbad');const originalReject=await reject(()=>xs('SELECT multa36_verificar()'));await xs('ROLLBACK TO SAVEPOINT oldbad');const hotfixReject=await reject(()=>xs(body));await xs('ROLLBACK TO SAVEPOINT oldbad');assert.deepEqual(await xw(),before);evidence.oldAnalyze={database:extra,diff:d,originalReject,hotfixReject,rolledBack:true,reseal:false,functionsMoneyManifestUnchanged:true};}finally{await xs('ROLLBACK');}
      assert.deepEqual(await xw(),before);evidence.oldAnalyze.catalogRestoredAfterRollback=diff(c0,await xc()).length===0;
     }finally{await x.query('ROLLBACK').catch(()=>{});await x.end();}
     await verify();
    });
    await check('baseline preventiva com prova35/36 e ledger não vazios; originalverifier válido',async()=>{
     const day=(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date-1)::text d"))[0].d;
     const c=await rpc('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','100.00','10.00',1,day,day,[day],null,null,'2.0000','0.0330']);assert.equal(c.success,true);
     const a=await rpc('rpc_aplicar_multa36',[1,randomUUID(),c.id,'7.50',null]);assert.equal(a.success,true);
     const q=await rpc('rpc_cotar_multa36',[1,c.id,c.parcelasIds[0]]);const r=await rpc('rpc_receber_multa36',[1,randomUUID(),c.id,c.parcelasIds[0],'1.00',q.totalExigido,q.dataPagamento,q.estadoHash,'parcial',null]);assert.equal(r.success,true);
     await verify();evidence.preHotfixLegitimate={contractId:c.id,create35:1,apply36:1,receive36Partial:1,originalVerifierValid:true,thresholdsDefault:true};
    });
    const preNegatives=[
     ['source-guard',"CREATE OR REPLACE FUNCTION ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$BEGIN RETURN NEW;END$$"],
     ['ACL-helper','GRANT EXECUTE ON FUNCTION multa36_snapshot(integer) TO service_role'],
     ['config-helper',"ALTER FUNCTION multa36_snapshot(integer) SET search_path=public"],
     ['RLS-private','ALTER TABLE multa36_capacidades DISABLE ROW LEVEL SECURITY'],
     ['trigger-off','ALTER TABLE transacoes_caixa DISABLE TRIGGER multa36_guard_transacoes_caixa'],
     ['column-default','ALTER TABLE parcelas ALTER COLUMN multa_manual SET DEFAULT 1'],
     ['CHECK-base','ALTER TABLE contratos DROP CONSTRAINT contratos_modalidade_check'],
     ['FK-base','ALTER TABLE clientes DROP CONSTRAINT clientes_user_id_fkey'],
     ['index-base','DROP INDEX idx_contratos_user_id'],
     ['policy-private','CREATE POLICY drift36a ON multa36_capacidades USING(true)'],
     ['column-ACL','GRANT INSERT(guard) ON multa36_capacidades TO service_role'],
    ];
    for(const [id,ddl] of preNegatives)await check(`preflight-negative ${id}`,()=>gate(`pre:${id}`,ddl));
    const installed=await check('install delta-only metadata + manifesto36; zero money/proof delta',async()=>{
     await verify();const c0=await catalog(),s0=await snapshot(),seal0=await manifest();await sql(target);await verify();const c1=await catalog(),s1=await snapshot(),seal1=await manifest();assert.deepEqual(s1,s0);assert.notDeepEqual(seal1,seal0);
     const changed=c0.functions.filter(x=>JSON.stringify(x)!==JSON.stringify(c1.functions.find(y=>y.oid===x.oid)));assert.equal(changed.length,1);assert.equal(changed[0].proname,'multa36_metadata');
     const before=changed[0],after=c1.functions.find(y=>y.oid===before.oid);assert.equal(after.prosrc,old.body.replace("'tables',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid)","'tables',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid)"));
     const minus=f=>Object.fromEntries(Object.entries(f).filter(([k])=>k!=='prosrc'));assert.deepEqual(minus(after),minus(before));
     for(const k of Object.keys(c0).filter(k=>k!=='functions'))assert.deepEqual(c1[k],c0[k],`Catálogo intacto ${k}`);
     evidence.installDelta={functionsChanged:['multa36_metadata'],functionsUntouched:c0.functions.length-1,sourceChangedKeys:['prosrc'],manifest36ChangedRows:1,financialChangedRows:0,proofChangedRows:0,allOtherPublicTablesIdentical:true,relationsACL_RLS_owner_intact:true,attributes_constraints_triggers_policies_sequences_intact:true,before:s0,after:s1,sealBefore:seal0,sealAfter:seal1};
    });
    if(!installed)continue;
    const seedWitness={};
    for(const n of ['users','clientes','koletores','contas_caixa','contas_pagar','contratos','parcelas','transacoes_caixa','contrato_historico','legados_manifesto','multimodal_manifesto']){const k=n==='legados_manifesto'?'versao':'id';seedWitness[n]=await sql(`SELECT ${k}::text id,to_jsonb(t) j FROM public.${quote(n)} t ORDER BY ${k}`);}
    const proofWitness={};for(const n of ['multimodal_operacoes','multimodal_origens','multimodal_pernas','multa36_operacoes','multa36_origens','multa36_encargos','multa36_pernas'])proofWitness[n]=(await sql(`SELECT to_jsonb(t)::text j FROM public.${quote(n)} t ORDER BY to_jsonb(t)::text`)).map(x=>x.j);
    await check('ACL/RLS36 service_role RPC only; anon/auth sem execute',async()=>{
     assert.deepEqual(await rpc('rpc_capacidades_multa36'),{disponivel:true,regra:'multa36_v1',aplicacao:true,recebimento:true,renovacao:true});
     const r=await sql("SELECT relname,relrowsecurity,relforcerowsecurity,reloptions,NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=c.oid) no_policy,NOT has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') private FROM pg_class c WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'multa36\\_%' ESCAPE '\\' ORDER BY relname");assert.equal(r.length,10);for(const x of r){assert.equal(x.relrowsecurity,true);assert.equal(x.relforcerowsecurity,false);assert.equal(x.no_policy,true);assert.equal(x.private,true);assert.equal(x.reloptions,null);}evidence.privateTables=r;
     for(const role of ['service_role','anon','authenticated']){await sql(`SET ROLE ${role}`);try{let e;try{await sql(role==='service_role'?'SELECT id FROM multa36_operacoes':'SELECT rpc_capacidades_multa36()');}catch(x){e=x;}assert.equal(e?.code,'42501');}finally{await sql('RESET ROLE');}}
    });
    await check('one-shot reapply 55000; zero snapshot delta',()=>gate('reapply','SELECT 1'));
    const fixedNegatives=[
     ['source-metadata',functionsFromSQL(target)[0].ddl.replace('CREATE OR REPLACE FUNCTION','CREATE OR REPLACE FUNCTION').replace(' SELECT encode',' SELECT /* drift36a */ encode')],
     ['ACL-helper','GRANT EXECUTE ON FUNCTION multa36_snapshot(integer) TO service_role'],
     ['config-helper',"ALTER FUNCTION multa36_snapshot(integer) SET search_path=public"],
     ['RLS-private','ALTER TABLE multa36_capacidades DISABLE ROW LEVEL SECURITY'],
     ['trigger-off','ALTER TABLE transacoes_caixa DISABLE TRIGGER multa36_guard_transacoes_caixa'],
     ['column-private','ALTER TABLE multa36_capacidades ALTER COLUMN posterior DROP NOT NULL'],
     ['CHECK-private','ALTER TABLE multa36_encargos DROP CONSTRAINT multa36_encargos_valor_check'],
     ['FK-private','ALTER TABLE multa36_pernas DROP CONSTRAINT multa36_pernas_transacao_id_fkey'],
     ['index-PK-private','ALTER TABLE multa36_fences DROP CONSTRAINT multa36_fences_pkey'],
     ['reloptions-structural','ALTER TABLE multa36_capacidades SET (fillfactor=90)'],
    ];
    for(const [id,ddl] of fixedNegatives)await check(`fixed-negative ${id}`,()=>gate(`fixed:${id}`,ddl,'SELECT multa36_verificar()'));
    const tables=(await sql("SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'multa36\\_%' ESCAPE '\\' ORDER BY relname")).map(x=>x.relname);
    for(const mode of ['ANALYZE','VACUUM (FREEZE, ANALYZE)'])await check(`${mode} real todas10 tables36; verifier pass sem reseal`,async()=>{
     const c0=await classes(),s0=await snapshot(),seal=await manifest();for(const t of tables)await sql(`${mode} public.${quote(t)}`);await verify();assert.deepEqual(await snapshot(),s0);assert.deepEqual(await manifest(),seal);const d=diff(c0,await classes());assert.ok(d.length>0);assert.ok(d.every(x=>volatile.includes(x.field)),JSON.stringify(d));evidence.maintenance.push({mode,tables,commands:tables.length,diffs:d,sealUnchanged:true,financialChangedRows:0,proofChangedRows:0,verifiers34_35_36:true});
    });
    await check('operações legítimas35/apply36/receive36/renew36 geram mortes; autovacuum REAL; sem reseal',async()=>{
     for(const [setting,value] of [['autovacuum_vacuum_threshold','1'],['autovacuum_vacuum_scale_factor','0'],['autovacuum_analyze_threshold','1000000']])await admin.query(`ALTER SYSTEM SET ${setting}='${value}'`);
     await admin.query('SELECT pg_reload_conf()');await delay(200);
     evidence.autovacuumSettings=(await sql("SELECT current_setting('autovacuum') av,current_setting('autovacuum_vacuum_threshold') threshold,current_setting('autovacuum_vacuum_scale_factor') scale,current_setting('autovacuum_analyze_threshold') analyze"))[0];assert.equal(evidence.autovacuumSettings.av,'on');assert.equal(evidence.autovacuumSettings.threshold,'1');
     const stats=async()=>sql("SELECT relname,last_autovacuum::text,autovacuum_count::int,n_tup_ins::int,n_tup_del::int,n_dead_tup::int FROM pg_stat_all_tables WHERE schemaname='public' AND relname IN('multa36_capacidades','multa36_coexistencia') ORDER BY relname");
     const start=await stats(),c0=await classes(),seal=await manifest();const day=(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date-1)::text d"))[0].d;const ops=[];
     for(let i=0;i<8;i++){
      const c=await rpc('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','100.00','10.00',1,day,day,[day],null,null,'2.0000','0.0330']);assert.equal(c.success,true);
      const apply=await rpc('rpc_aplicar_multa36',[1,randomUUID(),c.id,'7.50',null]);assert.equal(apply.success,true);let pid=c.parcelasIds[0];
      if(i%2){const next=(await sql("SELECT multimodal_data($1::date,'mensal',1)::text d",[day]))[0].d;const q=await rpc('rpc_cotar_renovacao_multa36',[1,c.id,pid,next]);assert.equal(q.renovavel,true);const r=await rpc('rpc_renovar_multa36',[1,randomUUID(),c.id,pid,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,next,null]);assert.equal(r.success,true);pid=r.novaParcelaId;}
      else{const q=await rpc('rpc_cotar_multa36',[1,c.id,pid]);const r=await rpc('rpc_receber_multa36',[1,randomUUID(),c.id,pid,'1.00',q.totalExigido,q.dataPagamento,q.estadoHash,'parcial',null]);assert.equal(r.success,true);}
      const q=await rpc('rpc_cotar_multa36',[1,c.id,pid]);const r=await rpc('rpc_receber_multa36',[1,randomUUID(),c.id,pid,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,'integral',null]);assert.equal(r.success,true);ops.push(c.id);
      await sql('SELECT pg_stat_force_next_flush()');await verify();
     }
     const preserved=await snapshot(),end=Date.now()+90000;let observed;
     do{await sql('SELECT pg_stat_clear_snapshot()');observed=await stats();const caps=observed.find(x=>x.relname==='multa36_capacidades'),prior=start.find(x=>x.relname===caps.relname);if(caps.last_autovacuum&&caps.autovacuum_count>prior.autovacuum_count)break;await delay(500);}while(Date.now()<end);
     const caps=observed.find(x=>x.relname==='multa36_capacidades');assert.ok(caps.last_autovacuum&&caps.autovacuum_count>start.find(x=>x.relname===caps.relname).autovacuum_count,JSON.stringify(observed));
     await verify();assert.deepEqual(await snapshot(),preserved);assert.deepEqual(await manifest(),seal);assert.equal((await sql('SELECT count(*)::int n FROM multa36_capacidades'))[0].n,0);assert.equal((await sql('SELECT count(*)::int n FROM multa36_coexistencia'))[0].n,0);
     const totals=await sql("SELECT count(*)::int pernas,count(DISTINCT o.contrato_id)::int contratos,coalesce(sum((p.alocacao->>'principal')::numeric),0)::text principal,coalesce(sum((p.alocacao->>'juros')::numeric),0)::text juros,coalesce(sum((p.alocacao->>'multa')::numeric),0)::text multa,coalesce(sum((p.alocacao->>'mora')::numeric),0)::text mora FROM multa36_pernas p JOIN multa36_operacoes o ON o.id=p.operacao_id WHERE o.contrato_id=ANY($1::int[])",[ops]);assert.equal(totals[0].principal,'800.00');assert.equal(totals[0].multa,'60.00');assert.equal(totals[0].pernas,16);assert.equal(totals[0].contratos,8);
     const states=await sql("SELECT id,status FROM contratos WHERE id=ANY($1::int[]) ORDER BY id",[ops]);assert.ok(states.every(x=>x.status==='quitado'));
     const d=diff(c0,await classes());assert.ok(d.length>0);assert.ok(d.every(x=>volatile.includes(x.field)));evidence.autovacuum={before:start,after:observed,contractIds:ops,creates35:8,apply36:8,partialReceive36:4,renew36:4,fullReceive36:8,allocation:totals[0],diffs:d,sealUnchanged:true,postOperationsWaitFinancialProofDelta:0,verifiers34_35_36:true};record(`AUTOVACUUM fresh${fresh} ${JSON.stringify(observed)}`);
    });
    await check('final34/35/36 e ledger/provas históricos imutáveis',async()=>{
     await verify();assert.deepEqual(await manifest(),evidence.installDelta.sealAfter);const final=await snapshot();evidence.finalSnapshot=final;
     const initial=evidence.installDelta.after;for(const n of ['legados_manifesto','multimodal_manifesto'])assert.deepEqual(final[n],initial[n]);
     let seedRows=0;for(const [n,rows] of Object.entries(seedWitness)){const k=n==='legados_manifesto'?'versao':'id';const now=await sql(`SELECT ${k}::text id,to_jsonb(t) j FROM public.${quote(n)} t WHERE ${k}::text=ANY($1::text[]) ORDER BY ${k}`,[rows.map(r=>r.id)]);assert.deepEqual(now,rows,`Linha histórica intacta ${n}`);seedRows+=rows.length;}
     evidence.historicalRows={tables:Object.keys(seedWitness),rows:seedRows,changedRows:0};
     let proofRows=0;for(const [n,rows] of Object.entries(proofWitness)){const now=(await sql(`SELECT to_jsonb(t)::text j FROM public.${quote(n)} t WHERE to_jsonb(t)::text=ANY($1::text[]) ORDER BY to_jsonb(t)::text`,[rows])).map(x=>x.j);assert.deepEqual(now,rows,`Prova histórica intacta ${n}`);proofRows+=rows.length;}evidence.historicalProofRows={tables:Object.keys(proofWitness),rows:proofRows,changedRows:0};
     assert.equal(final.multa36_operacoes.count,initial.multa36_operacoes.count+24);assert.equal(final.multa36_pernas.count,initial.multa36_pernas.count+16);assert.equal(final.multa36_renovacoes.count,initial.multa36_renovacoes.count+4);assert.equal(final.transacoes_caixa.count,initial.transacoes_caixa.count+24);
    });
   }catch(e){failure('database-harness',e,fresh);}finally{await db.query('ROLLBACK').catch(()=>{});await db.end();}
  }
 }catch(e){failure('harness',e);}
 finally{
  await admin?.end().catch(()=>{});
  if(started)try{run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-m','fast','-w','stop']);let status=0;try{run(`${bin}/pg_ctl`,['-D',`${root}/data`,'status']);}catch(e){status=e.status;}assert.equal(status,3);assert.equal(existsSync(`${root}/data/postmaster.pid`),false);copyFileSync(`${root}/postgres.log`,`${out}/postgres36a.log`);rmSync(`${root}/data`,{recursive:true});rmSync(`${root}/socket`,{recursive:true});rmSync(root,{recursive:true});result.cleanup={stopExit:0,status:3,pidAbsent:true,ownRoot:root,ownRootRemoved:true};record('CLEANUP STOP=0 STATUS=3 PID_ABSENT=true OWN_DATA_REMOVED=true');}catch(e){failure('cleanup',e);}
  result.sql36aSha256Current=hash(read('drizzle/0036a_multa_metadata_estavel.sql'));if(result.sql36aSha256Current!==sha)failure('source-changed-during-run',Error('SQL36a alterado; final rerun requerido'));
  result.passed=result.results.filter(x=>x.startsWith('PASS')).length;writeFileSync(`${out}/results36a.json`,JSON.stringify(result,null,2)+'\n');writeFileSync(`${out}/runner36a.log`,result.results.join('\n')+'\n');
 }
 report36a(result);
 return result;
}
if(process.argv[1]?.endsWith('/runner.mjs')){const r=await certify();if(r.failures.length)process.exitCode=1;}
