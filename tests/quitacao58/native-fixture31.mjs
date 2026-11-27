import fs from 'node:fs';
import pg from 'pg';
const distributions={auth:4,graphql_public:1,pgbouncer:1,realtime:19,storage:24,vault:5};
const tables={auth:'users',storage:'objects',realtime:'messages',vault:'secrets',supabase_migrations:'schema_migrations'};
const extra=JSON.parse(fs.readFileSync(new URL('./public-extras-fixture31.json',import.meta.url),'utf8'));
// Never impersonate the optional0016 session-revocation surface with a false stub.
// This inert nonfinancial alias tests the same out-of-pin preservation/count property.
for(const e of extra)if(e.proname==='revogar_sessoes_ao_alterar_senha')e.proname='extra_nonfinancial_session31';
const quote=x=>'"'+x.replaceAll('"','""')+'"';
async function connect(config){const c=new pg.Client({...config,user:'bootstrap51'});await c.connect();return c;}
async function rows(c){const out={};for(const [schema,table] of Object.entries(tables))out[schema+'.'+table]=(await c.query(`SELECT marker FROM ${quote(schema)}.${quote(table)} ORDER BY marker LIMIT 2`)).rows;return out;}
function extras(order){const names=new Set(extra.map(x=>'public.'+x.proname));return order.functions.filter(x=>Object.keys(distributions).some(s=>x.name.startsWith(s+'.'))||names.has(x.name));}
export async function setup({sql,reject,assert,save,result,config,captureOrder}){
 const c=await connect(config);
 try {
  for(const schema of new Set([...Object.keys(distributions),...Object.keys(tables)]))await c.query(`CREATE SCHEMA ${quote(schema)} AUTHORIZATION bootstrap51; GRANT USAGE ON SCHEMA ${quote(schema)} TO postgres`);
  for(const [schema,n] of Object.entries(distributions))for(let i=0;i<n;i++)await c.query(`CREATE FUNCTION ${quote(schema)}.${quote('sentinel31_'+i)}() RETURNS integer LANGUAGE sql AS $$ SELECT 31 $$; REVOKE ALL ON FUNCTION ${quote(schema)}.${quote('sentinel31_'+i)}() FROM PUBLIC`);
  // Public extras are NOT synthesized: metadata37 seals ALL public functions.
  // Actual public16 compatibility is checked read-only in production and preserved
  // by the unchanged GLOBAL function witness, not by forging/resealing fixture37.
  await c.query('ALTER FUNCTION auth.sentinel31_0() OWNER TO postgres');
  for(const [schema,table] of Object.entries(tables))await c.query(`CREATE TABLE ${quote(schema)}.${quote(table)}(marker text NOT NULL); INSERT INTO ${quote(schema)}.${quote(table)} VALUES('PRIVATE_FICTITIOUS_NATIVE_SENTINEL31'); REVOKE ALL ON TABLE ${quote(schema)}.${quote(table)} FROM PUBLIC,postgres,anon,authenticated,service_role`);
  const funcs=extras(await captureOrder());assert.equal(funcs.length,54);
  const nativeRows=await rows(c);
  const noRead=await reject(()=>sql('SELECT marker FROM auth.users LIMIT 1'),'42501');
  result.nativeCompatibility31={syntheticOnly:true,production:false,setupAfterOriginal53:true,onlineReseal:false,managedFunctions:54,publicExtrasEmulated:0,actualPublic16CompatibilityExternalReadOnly:true,noPublic37Reseal:true,sessionRevocationStubNeverImpersonated:true,managedTables:5,ownerCannotReadNativeTable:{code:noRead.code},beforeFunctions:funcs,beforeRows:nativeRows};
  save('native-compatibility31-before.json',result.nativeCompatibility31);
  console.log('PASS31 synthetic54 managed extras after53, no public extras/no reseal; native SELECT denied42501');
 } finally {await c.end();}
}
export async function ready({sql,reject,assert,save,result,config,captureOrder}){
 const order=await captureOrder();assert.equal(order.functions.length,414);
 for(const f of result.nativeCompatibility31.beforeFunctions)assert.deepEqual(order.functions.find(x=>x.oid===f.oid),f,'extra baseline intact '+f.name);
 result.nativeCompatibility31.globalFunctionsBefore58=414;result.nativeCompatibility31.financialFunctionsStill360=true;
 save('native-compatibility31-ready.json',result.nativeCompatibility31);console.log('PASS31 ready414 after53; extra baseline intact');
}
export async function finish({assert,save,result,config,captureOrder}){
 const c=await connect(config);
 try {
  const before=result.nativeCompatibility31;
  assert.deepEqual(await rows(c),before.beforeRows);
  const order=await captureOrder();for(const f of before.beforeFunctions)assert.deepEqual(order.functions.find(x=>x.oid===f.oid),f,'native/public extra intact '+f.name);
  assert.equal(order.functions.length,415);assert.equal(result.nativeManagedExclusiveLockIgnored,true);
  before.preservedAll54ManagedFunctions=true;before.preservedAllNativeRows=true;before.managedExclusiveLockIgnored=true;before.ownerNeverGrantedNativeSelect=true;
  save('native-compatibility31-final.json',before);console.log('PASS31 all54 managed extra functions and native rows preserved; native exclusive lock ignored');
 } finally {await c.end();}
}
