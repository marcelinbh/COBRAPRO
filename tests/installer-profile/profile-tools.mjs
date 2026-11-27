import pg from 'pg';
const privateProfile={anon:[false,false,false],authenticated:[false,false,false],postgres:[false,false,true],service_role:[false,false,false]};
const supabaseProfile={...privateProfile,postgres:[false,true,true],service_role:[false,true,false]};
export async function beforeInstall({db,sql,reject,assert,save,financial,result,config,read,hash,candidate,profile,captureOrder},version){
 const roles=async()=>Object.fromEntries((await sql("SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname IN('postgres','service_role','anon','authenticated') ORDER BY rolname LIMIT 4")).map(x=>[x.rolname,[x.rolsuper,x.rolbypassrls,x.rolcanlogin]]));
 const expected=profile==='private'?privateProfile:supabaseProfile;assert.deepEqual(await roles(),expected);
 result.installProfiles??=[];result.installProfiles.push({version,profile,verifiedActualTuple:await roles(),ownerSessionPG17ReadCommitted:(await sql("SELECT current_user,session_user,current_setting('server_version_num') version,current_setting('transaction_isolation') isolation LIMIT 1"))[0]});
 const ddl=read(candidate+'/drizzle/'+(version===52?'0052_inclusao_expandida.sql':'0053_sucessores_financeiros.sql'));
 const old=read(candidate+'/tests/installer-profile/historical'+version+'.sql');
 assert.equal(hash(old),version===52?'a858637974f0574e98f70687a951e4fc91e4bbd079e693d15e6190820423122e':'1b16de30c3d24ee966def7f9bb46cf31795cc4fd3f347d868b6fc79b865bc787');
 const catalog=await captureOrder(),data=await financial();
 const bootstrap=new pg.Client({...config,user:'bootstrap51'});await bootstrap.connect();
 const tupleOption=v=>`${v[0]?'SUPERUSER':'NOSUPERUSER'} ${v[1]?'BYPASSRLS':'NOBYPASSRLS'} ${v[2]?'LOGIN':'NOLOGIN'}`;
 const reset=async()=>{await sql('ROLLBACK');for(const name of Object.keys(expected))await bootstrap.query(`ALTER ROLE ${name} ${tupleOption(expected[name])}`);assert.deepEqual(await roles(),expected);};
 const invariant=async()=>{assert.deepEqual(await financial(),data);assert.deepEqual(await captureOrder(),catalog);assert.equal((await sql('SELECT to_regnamespace($1) n LIMIT 1',[version===52?'inclusao52':'sucessores53']))[0].n,null);};
 result.profileAdversarial??=[];
 const mark=(name,e)=>{const p={version,profile,name,code:e.code,message:e.message,where:e.where,rejectedInPreflightBeforeCreateDDL:true,financialExact:true,catalogExact:true};result.profileAdversarial.push(p);save('profile-'+version+'-'+name+'.json',p);console.log('PASS PROFILE'+version+' '+profile+' '+name);};
 try{
  // The historical installers are byte-exact. Reproduce their production rejection
  // on this wholly private cluster, without weakening either old installer.
  await bootstrap.query('ALTER ROLE postgres NOSUPERUSER BYPASSRLS LOGIN; ALTER ROLE service_role NOSUPERUSER BYPASSRLS NOLOGIN');
  const e=await reject(()=>sql(old),'55000');await sql('ROLLBACK');await invariant();mark('historical-actual-supabase-RED',e);await reset();
  for(const name of Object.keys(expected)){
   for(const [kind,index] of [['superuser',0],['bypass-deviation',1],['login-deviation',2]]){
    const v=[...expected[name]];v[index]=!v[index];await bootstrap.query(`ALTER ROLE ${name} ${tupleOption(v)}`);
    const e=await reject(()=>sql(ddl),'55000');assert.equal(e.message,version+' install role profile mismatch');await sql('ROLLBACK');await invariant();mark(name+'-'+kind,e);await reset();
   }
   // Rename preserves grants/dependencies but makes the required role absent.
   await bootstrap.query(`ALTER ROLE ${name} RENAME TO profile_missing_${name}`);
   const renamedCatalog=await captureOrder();let missingError;
   try{missingError=await reject(()=>sql(ddl),'55000');if(name==='postgres')assert.match(missingError.message,/PG17/);else assert.equal(missingError.message,version+' install role profile mismatch');await sql('ROLLBACK');assert.deepEqual(await financial(),data);assert.deepEqual(await captureOrder(),renamedCatalog);}
   finally{await sql('ROLLBACK');await bootstrap.query(`ALTER ROLE profile_missing_${name} RENAME TO ${name}`);}
   await invariant();mark(name+'-missing',missingError);
  }
  for(const isolation of ['repeatable read','serializable']){
   await sql('BEGIN ISOLATION LEVEL '+isolation);const e=await reject(()=>sql(ddl),'55000');assert.match(e.message,/PG17/);await sql('ROLLBACK');await invariant();mark(isolation.replaceAll(' ','-'),e);
  }
  // PostgreSQL session owner mismatch with exact current_user postgres.
  await bootstrap.query('SET ROLE postgres');
  try{const e=await reject(()=>bootstrap.query(ddl),'55000');assert.match(e.message,/PG17/);await bootstrap.query('ROLLBACK');await invariant();mark('session-owner-mismatch',e);}
  finally{await bootstrap.query('ROLLBACK');await bootstrap.query('RESET ROLE');}
  // Current/session mismatch under bootstrap owner exercises the original guard.
  const ownerError=await reject(()=>bootstrap.query(ddl),'55000');assert.match(ownerError.message,/PG17/);await bootstrap.query('ROLLBACK');await invariant();mark('current-owner-mismatch',ownerError);
  // Version is immutable in genuine PG17; prove source retains the exact version
  // expression. Do not substitute installer text or fake a server version.
  assert.ok(ddl.includes("current_setting('server_version_num')::int/10000<>17"));
  result.versionMismatchGate={staticExactGuard:true,genuineWrongPGMajorNotRun:true};
  await reset();await invariant();
 }finally{await sql('ROLLBACK');await bootstrap.end();}
 save('install-profile-'+version+'.json',result.installProfiles.at(-1));
}
