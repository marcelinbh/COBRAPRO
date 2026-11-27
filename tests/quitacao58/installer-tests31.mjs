import pg from 'pg';
import fs from 'node:fs';
export async function tests({db,sql,rpc,reject,assert,save,financial,verify,result,config,captureOrder,install}) {
 const query=fs.readFileSync(new URL('./witness-query28.sql',import.meta.url),'utf8');
 const full=async()=>{const rels=await sql("SELECT n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p') AND n.nspname IN('public','caixa_manutencao45','calendario46','despesa_cancelamento_v1','despesas49','inclusao52','manutencao44','manutencao48','obrigacoes51','private47','sucessores53','telefone41') ORDER BY n.nspname,c.relname LIMIT 1000");const snap={};for(const r of rels){const q='"'+r.schema.replaceAll('"','""')+'"."'+r.name.replaceAll('"','""')+'"';snap[r.schema+'.'+r.name]=(await sql(`SELECT coalesce(jsonb_agg(x.j ORDER BY x.j::text),'[]'::jsonb) rows FROM (SELECT to_jsonb(a) j FROM ${q} a) x LIMIT 1`))[0].rows;}return snap;};
 const cat=async()=>({order:await captureOrder(),complete:(await sql(query))[0]});
 // Initialize PL/pgSQL before settings capture, exactly as predecessor verifier ordering.
 await verify();await rpc('obrigacoes51.verificar');await rpc('inclusao52.verificar');await rpc('sucessores53.verificar');
 const before=await full(),catalog=await cat(),marks=[];
 assert.equal(Object.keys(before).length,119,'119 original physical relations');
 const manifests=Object.keys(before).filter(k=>/manifesto$/.test(k));assert.equal(manifests.length,15);
 const invariant=async()=>{assert.equal((await sql("SELECT to_regprocedure('obrigacoes51.validar_livro_recebimento(integer,integer,integer)') x LIMIT 1"))[0].x,null);assert.deepEqual(await full(),before);assert.deepEqual(await cat(),catalog);};
 const mark=(name,e)=>{marks.push({name,code:e.code,message:e.message,where:e.where,noPartialDDL:true,all119TablesRowsColumnsJournalsExact:true,wholeCatalogRolesConfigACLExact:true});save('installer58-tests-checkpoint.json',marks);console.log('PASS30 INSTALLER '+name);};
 const rejectInstall=async(name,ddl=install,mutation)=>{console.log('START30 INSTALLER '+name);await sql('BEGIN');if(mutation)await sql(mutation);let e;try{e=await reject(()=>sql(ddl),'55000');}finally{await sql('ROLLBACK');}await invariant();mark(name,e);};
 // NEW compatibility probes, no original case removed.
 const old30=fs.readFileSync(new URL('./old30-rejected.fixture.sql',import.meta.url),'utf8');
 await rejectInstall('old30 nonfinancial catalog incompatibility',old30);
 assert.equal(marks.at(-1).message,'58 unknown function catalog refused');
 await rejectInstall('unknown private financial function',install,'CREATE FUNCTION obrigacoes51.unknown31() RETURNS integer LANGUAGE sql AS $$ SELECT 31 $$');
 await rejectInstall('unknown public financial overload',install,'CREATE FUNCTION public.caixa37_validar_livro(integer,integer) RETURNS integer LANGUAGE sql AS $$ SELECT 31 $$');
 await rejectInstall('source config drift',install,'ALTER FUNCTION obrigacoes51.cotacao(integer,integer,jsonb,timestamptz) SET search_path=public');
 await rejectInstall('source body drift',install,"CREATE OR REPLACE FUNCTION obrigacoes51.hash(j jsonb) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT 'bad'::text $$");
 await rejectInstall('source ACL drift',install,'GRANT EXECUTE ON FUNCTION obrigacoes51.hash(jsonb) TO anon');
 await rejectInstall('source owner drift',install,'GRANT CREATE ON SCHEMA obrigacoes51 TO authenticated; ALTER FUNCTION obrigacoes51.hash(jsonb) OWNER TO authenticated');
 await rejectInstall('repeatable read',install.replace('BEGIN;','BEGIN ISOLATION LEVEL REPEATABLE READ;'));
 await rejectInstall('serializable',install.replace('BEGIN;','BEGIN ISOLATION LEVEL SERIALIZABLE;'));
 const changed=install.replace('58 alvo inválido','58 altered helper');assert.notEqual(changed,install);await rejectInstall('helper body tamper after CREATE rolls back',changed);
 // Full SQL executes through catalog witness before injected abort, never replacing its checks.
 const abort=install.replace('COMMIT;',()=>"DO $abort_test58$ BEGIN RAISE EXCEPTION 'synthetic installer abort' USING ERRCODE='55000'; END $abort_test58$; COMMIT;");await rejectInstall('abort after all DDL and all checks rollback exact',abort);
 const bootstrap=new pg.Client({...config,user:'bootstrap51'});await bootstrap.connect();
 try {
  const roles=(await bootstrap.query("SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role') ORDER BY rolname LIMIT 4")).rows;
  for(const r of roles)for(const attr of ['SUPERUSER','BYPASSRLS','LOGIN','ABSENT']) {
   const desired=attr==='SUPERUSER'?true:attr==='BYPASSRLS'?!r.rolbypassrls:attr==='LOGIN'?!r.rolcanlogin:null;
   const mutate=attr==='ABSENT'?`ALTER ROLE ${r.rolname} RENAME TO missing29_${r.rolname}`:`ALTER ROLE ${r.rolname} ${desired?'':'NO'}${attr}`;
   const revert=attr==='ABSENT'?`ALTER ROLE missing29_${r.rolname} RENAME TO ${r.rolname}`:`ALTER ROLE ${r.rolname} ${attr==='SUPERUSER'?(r.rolsuper?'':'NO'):attr==='BYPASSRLS'?(r.rolbypassrls?'':'NO'):(r.rolcanlogin?'':'NO')}${attr}`;
   const name=`exact role ${r.rolname} ${attr}`;console.log('START30 INSTALLER '+name);let e;
   await bootstrap.query(mutate);
   try {e=await reject(()=>sql(install),'55000');await sql('ROLLBACK');}finally {await bootstrap.query(revert);}
   await invariant();mark(name,e);
  }
 } finally {await bootstrap.end();}
 await import('./roleconfig-tests30.mjs').then(m=>m.roleconfigs({sql,reject,assert,save,result,config,install,abort,invariant,cat,full,before,marks}));
 await rejectInstall('current/session mismatch',install,'SET LOCAL ROLE service_role');
 // Witness adversaries injected AFTER capture, original SQL including final check remains whole.
 for(const [name,mutation] of [
  ['witness native managed function',"ALTER FUNCTION auth.sentinel31_0() SET search_path=public;"],
  ['witness roleconfig',"ALTER ROLE postgres SET search_path=public;"],
  ['witness schema ACL','GRANT USAGE ON SCHEMA obrigacoes51 TO anon;'],
  ['witness GUC',"SET LOCAL application_name='synthetic29';"],
  ['witness table owner','GRANT CREATE ON SCHEMA obrigacoes51 TO authenticated; ALTER TABLE obrigacoes51.operacoes OWNER TO authenticated;'],
  ['witness trigger','ALTER TABLE obrigacoes51.operacoes DISABLE TRIGGER USER;'],
  ['witness default','ALTER TABLE public.contas_caixa ALTER COLUMN ativo SET DEFAULT false;']
 ]) {const needle='DO $post58$';assert.ok(install.includes(needle));const injected=install.replace(needle,()=>mutation+'\n'+needle);await rejectInstall(name,injected);}
 console.log('START30 EXACT FINAL30 INSTALL');
 const nativeLock=new pg.Client({...config,user:'bootstrap51'});await nativeLock.connect();await nativeLock.query('BEGIN; LOCK TABLE auth.users IN ACCESS EXCLUSIVE MODE');
 try { await sql(install); } finally { await nativeLock.query('ROLLBACK');await nativeLock.end(); }
 result.nativeManagedExclusiveLockIgnored=true;await verify();await rpc('obrigacoes51.verificar');await rpc('inclusao52.verificar');await rpc('sucessores53.verificar');
 const after=await full(),afterCat=await cat();
 for(const k of Object.keys(before))if(k!=='obrigacoes51.manifesto')assert.deepEqual(after[k],before[k],k+' unchanged during exact installer');
 assert.deepEqual(after['obrigacoes51.manifesto'].map(x=>({...x,assinatura:null})),before['obrigacoes51.manifesto'].map(x=>({...x,assinatura:null})));
 assert.notEqual(after['obrigacoes51.manifesto'][0].assinatura,before['obrigacoes51.manifesto'][0].assinatura);
 assert.equal(after['obrigacoes51.manifesto'][0].assinatura,await rpc('obrigacoes51.metadata'));
 // complete witness excludes pg_proc except extension functions; all must be unchanged.
 assert.deepEqual(afterCat.complete,catalog.complete);
 save('whole119-and15seals31.json',{before,after,physical119ExactExceptPlanned51Signature:true,manifests,other14ManifestsExact:true,wholeCatalogBefore:catalog.complete,wholeCatalogAfter:afterCat.complete});
 const e=await reject(()=>sql(install),'55000');await sql('ROLLBACK');assert.deepEqual(await full(),after);assert.deepEqual(await cat(),afterCat);mark('second exact application refused',e);
 await sql('BEGIN');await sql('ALTER FUNCTION obrigacoes51.validar_livro_recebimento(integer,integer,integer) SET search_path=public');const runtime=await reject(()=>rpc('public.rpc_capacidade_obrigacoes51'),'55000');await sql('ROLLBACK');await rpc('obrigacoes51.verificar');mark('helper runtime config drift failclosed',runtime);
 result.installer58={status:'EXACT_FINAL31_INTEGRATED_PASS',tests:marks,physicalTables:119,fixtureManifests:15,otherManifestsExact:14,plannedBeforePermanentDDL:true,originalMetadataExpressionOnlyCotacaoProsrc:true,helperOIDPlanEvaluatedAfterCreateBeforeCotacao:true,onlySignature51Updated:true};save('installer58-tests.json',result.installer58);
}
