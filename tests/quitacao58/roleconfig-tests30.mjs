import pg from 'pg';
export async function roleconfigs({sql,reject,assert,save,result,config,install,abort,invariant,cat,full,before,marks}) {
 const cfg=new pg.Client({...config,user:'bootstrap51'});await cfg.connect();
 const originalRoles=(await cfg.query("SELECT rolname,rolconfig FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role') ORDER BY rolname LIMIT 4")).rows;
 const originalSettings=(await cfg.query('SELECT setdatabase,setrole,setconfig FROM pg_db_role_setting ORDER BY setdatabase,setrole LIMIT 100')).rows;
 const profile=result.role.rolbypassrls?'supabase':'private';
 const restore=async()=>{
  // Fixture bootstrap only; exact prior arrays including NULL, never modifying installer or runtime.
  // pg_roles.rolconfig is the global pg_db_role_setting projection in PG17, not pg_authid.
  await cfg.query('DELETE FROM pg_db_role_setting');
  for(const r of originalSettings)await cfg.query('INSERT INTO pg_db_role_setting(setdatabase,setrole,setconfig) VALUES($1,$2,$3::text[])',[r.setdatabase,r.setrole,r.setconfig]);
  assert.deepEqual((await cfg.query("SELECT rolname,rolconfig FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role') ORDER BY rolname LIMIT 4")).rows,originalRoles);
 };
 const cases=[
  ['preexisting roleconfig drift','ALTER ROLE authenticated SET search_path=public'],
  ['preexisting database roleconfig drift','ALTER ROLE authenticated IN DATABASE postgres SET search_path=public'],
  ...['anon','postgres','service_role'].map(r=>['global search_path '+r,`ALTER ROLE ${r} SET search_path=public`]),
  ...['anon','authenticated','postgres','service_role'].map(r=>['global statement_timeout '+r,`ALTER ROLE ${r} SET statement_timeout='1s'`]),
  ...['anon','postgres','service_role'].map(r=>['database search_path '+r,`ALTER ROLE ${r} IN DATABASE postgres SET search_path=public`]),
  ['database authenticated timeout','ALTER ROLE authenticated IN DATABASE postgres SET statement_timeout=8000'],
  ['all-role database search_path','ALTER DATABASE postgres SET search_path=public'],
  ['all-role database jwt_exp extra-or-wrong',"ALTER DATABASE postgres SET app.settings.jwt_exp='3599'"],
  ['other-database authenticated search_path','ALTER ROLE authenticated IN DATABASE template1 SET search_path=public'],
  ['NULL distinct from empty roleconfig',"INSERT INTO pg_db_role_setting(setdatabase,setrole,setconfig) SELECT 0,oid,'{}'::text[] FROM pg_roles WHERE rolname='service_role'"],
  ['global all-role setting','INSERT INTO pg_db_role_setting(setdatabase,setrole,setconfig) VALUES(0,0,ARRAY[\'search_path=public\'])'],
  ['mixed other-profile configs with original flags',profile==='private'?"ALTER ROLE anon SET statement_timeout='3s'; ALTER ROLE authenticated SET statement_timeout='8s'":"ALTER ROLE anon RESET ALL; ALTER ROLE authenticated RESET ALL; ALTER ROLE postgres RESET ALL; ALTER DATABASE postgres RESET ALL"],
 ];
 if(profile==='supabase')cases.push(
  ['missing anon global config','ALTER ROLE anon RESET ALL'],
  ['missing postgres database config','ALTER DATABASE postgres RESET app.settings.jwt_exp'],
  ['timeout equivalent semantic not literal',"ALTER ROLE authenticated SET statement_timeout='8000ms'"],
  ['search_path equivalent not literal',"ALTER ROLE postgres SET search_path TO '\"$user\", public, extensions'"],
  ['database config NULL distinct array',"UPDATE pg_db_role_setting SET setconfig=NULL WHERE setrole=0 AND setdatabase=(SELECT oid FROM pg_database WHERE datname='postgres')"],
  ['database config empty distinct array',"UPDATE pg_db_role_setting SET setconfig='{}'::text[] WHERE setrole=0 AND setdatabase=(SELECT oid FROM pg_database WHERE datname='postgres')"]
 );
 try {
  for(const [name,mutation] of cases){
   console.log('START30 CONFIG '+profile+' '+name);let e;
   await cfg.query(mutation);
   const mutatedCatalog=await cat();
   try{
    e=await reject(()=>sql(abort),'55000');await sql('ROLLBACK');
    assert.equal(e.message,'58 install roleconfig profile mismatch',name+' MUST refuse by explicit preflight, not injected final abort');
    assert.match(e.where??'',/inline_code_block/);
    assert.equal((await sql("SELECT to_regprocedure('obrigacoes51.validar_livro_recebimento(integer,integer,integer)') helper LIMIT 1"))[0].helper,null);
    assert.deepEqual(await full(),before);assert.deepEqual(await cat(),mutatedCatalog,'installer did not adopt/normalize mutated config');
   } finally {await sql('ROLLBACK');await restore();}
   await invariant();
   const mark={name,profile,code:e.code,message:e.message,where:e.where,preexistingDriftRefused:true,status:'PASS',fullInstallerReachedFinalChecks:false,rejectedInPre58BeforeAnyPermanentDDL:true,rollbackExact:true,all119TablesRowsColumnsJournalsExact:true,wholeCatalogRolesConfigACLExact:true};
   marks.push(mark);save('installer58-tests-checkpoint.json',marks);console.log('PASS30 CONFIG '+profile+' '+name);
  }
 }finally{await restore();await cfg.end();}
 result.roleconfig30={profile,explicitWholeProfile:true,cases:cases.length,allRefusedBeforePermanentDDL:true,original29GapsClosed:2,noMixingNoNormalizationNoAdoption:true,all119AndCatalogExact:true};save('roleconfig-tests30.json',result.roleconfig30);
}
