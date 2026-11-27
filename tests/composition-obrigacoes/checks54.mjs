import pg from 'pg';
import {spawn,execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
export async function checks54({db,sql,rpc,reject,assert,save,financial,config,result,read,hash,candidate}){
 const ddl=read(candidate+'/drizzle/0054_verificacao_obrigacoes_deduplicada.sql'),pins=JSON.parse(read(candidate+'/tests/composition-obrigacoes/pins54.json'));
 assert.equal(hash(ddl),pins.compiledDDLSha256);
 const stress=async(label)=>{
  // Private CPU contention only: pin server+workers to one permitted CPU and
  // run two finite CPU contenders. No PostgreSQL sleep, mock, catalog change,
  // timeout inflation, role elevation, network, data, or JIT change.
  const allowed=read('/proc/self/status').match(/Cpus_allowed_list:\s*(\d+)/)[1];
  const pgpid=read(result.root+'/data/postmaster.pid').split('\n')[0];
  execFileSync('/usr/bin/taskset',['-pc',allowed,pgpid]);
  const workers=await Promise.all(Array.from({length:4},async()=>{const c=new pg.Client(config);await c.connect();const pid=(await c.query('SELECT pg_backend_pid() pid')).rows[0].pid;execFileSync('/usr/bin/taskset',['-pc',allowed,String(pid)]);await c.query("SET statement_timeout='8s'; SET ROLE service_role");return c;}));
  const burners=Array.from({length:2},()=>spawn('/usr/bin/taskset',['-c',allowed,process.execPath,'-e','const end=Date.now()+15000;while(Date.now()<end){Math.sqrt(Math.random());}'],{stdio:'ignore'}));
  await new Promise(r=>setTimeout(r,250));const start=performance.now();
  try{const rows=await Promise.all(workers.map(async(c,i)=>{const t=performance.now();try{const r=await c.query('SELECT public.rpc_estado_obrigacoes51(1,$1) r',[[955,956,957,959][i]]);return {ok:true,ms:performance.now()-t,parcels:r.rows[0].r.parcelas.length};}catch(e){return {ok:false,ms:performance.now()-t,code:e.code,message:e.message};}}));return {label,rows,ms:performance.now()-start,timeoutMs:8000,cpu:allowed,finiteCpuContenders:2};}
  finally{for(const b of burners)b.kill('SIGKILL');await Promise.all(workers.map(c=>c.end()));const all=read('/proc/self/status').match(/Cpus_allowed_list:\s*(.*)/)[1].trim();execFileSync('/usr/bin/taskset',['-pc',all,pgpid]);}
 };
 const before=await financial(),original=(await sql("SELECT pg_get_functiondef('obrigacoes51.verificar()'::regprocedure) d LIMIT 1"))[0].d;
 const snapshot=async()=>await sql("SELECT p.oid,to_jsonb(p) p FROM pg_proc p ORDER BY p.oid LIMIT 20000");
 const baseline=await snapshot(),futures=[];
 const mark=n=>{result.results.push(n);console.log('PASS54 '+n);};
 const error=async q=>{try{await sql(q);return null;}catch(e){return {code:e.code,message:e.message};}};
 const bench=async(label)=>{
  const single=[];for(let i=0;i<3;i++){const t=performance.now();await rpc('obrigacoes51.verificar');single.push(performance.now()-t);}
  const clients=await Promise.all(Array.from({length:4},async()=>{const c=new pg.Client(config);await c.connect();await c.query("SET statement_timeout='8s'; SET ROLE service_role");return c;}));
  try{
   const t=performance.now(),rows=await Promise.all(clients.map(async(c,i)=>{const start=performance.now();try{const r=await c.query('SELECT public.rpc_estado_obrigacoes51(1,$1) r',[955+i%3]);return {ms:performance.now()-start,ok:true,parcels:r.rows[0].r.parcelas.length};}catch(e){return {ms:performance.now()-start,ok:false,code:e.code,message:e.message};}}));
   return {label,timeoutMs:8000,jit:(await sql("SELECT current_setting('jit') v LIMIT 1"))[0].v,single,concurrentMs:performance.now()-t,rows};
  }finally{await Promise.all(clients.map(c=>c.end()));}
 };
 await sql("SET track_functions='all'");await rpc('obrigacoes51.verificar');await sql('SELECT pg_stat_force_next_flush()');await new Promise(r=>setTimeout(r,1100));await sql('SELECT pg_stat_clear_snapshot()');
 const statOriginal=async()=>await sql("SELECT funcid,schemaname,funcname,calls FROM pg_stat_user_functions WHERE funcname LIKE '%metadata%' ORDER BY funcid LIMIT 1000");
 const original0=await statOriginal();await rpc('obrigacoes51.verificar');await sql('SELECT pg_stat_force_next_flush()');await new Promise(r=>setTimeout(r,1100));await sql('SELECT pg_stat_clear_snapshot()');const original1=await statOriginal();
 const originalDelta=original1.map(x=>({...x,calls:Number(x.calls)-Number(original0.find(y=>y.funcid===x.funcid)?.calls??0)})).filter(x=>x.calls);assert.equal(originalDelta.reduce((n,x)=>n+x.calls,0),70);assert.equal(originalDelta.length,12);result.metadataOriginalTrace54=originalDelta;save('trace54-original70.json',originalDelta);
 result.benchmark54={baseline:await bench('original51')};save('benchmark54-baseline.json',result.benchmark54.baseline);result.benchmark54.stressBaseline=await stress('original51-controlled-contention');assert.ok(result.benchmark54.stressBaseline.rows.some(x=>x.code==='57014'),JSON.stringify(result.benchmark54.stressBaseline));save('benchmark54-stress-baseline.json',result.benchmark54.stressBaseline);
 // Concrete preflight source/config and successor body corruption: full rollback.
 for(const [label,mutation,tampered] of [
  ['predecessor config','ALTER FUNCTION manutencao48.proposta(jsonb) SET search_path=public',ddl],
  ['self51 source',original.replace('BEGIN','BEGIN\n-- private drift'),ddl],
  ['compiled source',null,ddl.replace('METADATA_INCOMPATIVEL','METADATA_INCOMPATIVEL54')],
 ]){
  await sql('BEGIN');if(mutation)await sql(mutation);await reject(()=>sql(tampered),'55000');await sql('ROLLBACK');assert.deepEqual(await snapshot(),baseline);assert.deepEqual(await financial(),before);mark('preflight rollback '+label);
 }
 // Capture each single drift under original function, then compare exact new errors.
 for(const name of pins.uniqueBodies){
  const signature=name+'()',definition=(await sql('SELECT pg_get_functiondef($1::regprocedure) d LIMIT 1',[signature]))[0].d;
  const metadata=name.endsWith('_verificar')?name.replace('_verificar','_metadata'):name.replace('.verificar','.metadata');
  const metaDefinition=(await sql('SELECT pg_get_functiondef($1::regprocedure) d LIMIT 1',[metadata+'()']))[0].d;
  const mutations=[['source',definition.replace('BEGIN','BEGIN\n-- private54 drift')],['search_path',`ALTER FUNCTION ${signature} SET search_path=public`],['ACL',`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`],['metadata source',metaDefinition.replace('AS $function$','AS $function$\n-- private54 drift')]];
  const ns=name.split('.')[0];if(ns!=='public')mutations.push(['schema ACL',`GRANT USAGE ON SCHEMA ${ns} TO authenticated`]);
  for(const [kind,mutation] of mutations){await sql('BEGIN');await sql(mutation);const old=await error('SELECT public.rpc_estado_obrigacoes51(1,956) r');assert.equal(old?.code,'55000',name+' '+kind);await sql('ROLLBACK');futures.push({name,kind,mutation,old});}
 }
 // Policies/triggers are real catalog mutations; do not reseal drift.
 for(const [name,mutation] of [
  ['policy51','CREATE POLICY adversary54 ON obrigacoes51.operacoes TO authenticated USING(true)'],
  ['trigger51','ALTER TABLE transacoes_caixa DISABLE TRIGGER obrigacoes51_guard'],
  ['policy47','CREATE POLICY adversary54 ON private47.operacoes TO authenticated USING(true)'],
  ['trigger47','ALTER TABLE private47.cadeia DISABLE TRIGGER imutavel47'],
 ]){await sql('BEGIN');await sql(mutation);const old=await error('SELECT public.rpc_estado_obrigacoes51(1,956) r');assert.equal(old?.code,'55000');await sql('ROLLBACK');futures.push({name,kind:'physical',mutation,old});}
 await sql(ddl);assert.deepEqual(await financial(),before);const after=await snapshot();assert.equal(after.length,baseline.length);
 const changes=after.filter((x,i)=>JSON.stringify(x)!==JSON.stringify(baseline[i]));assert.equal(changes.length,1);assert.equal(changes[0].p.proname,'verificar');assert.equal(hash(changes[0].p.prosrc),pins.compiledBodySha256);
 const changedBefore=baseline.find(x=>x.oid===changes[0].oid);assert.deepEqual({...changes[0].p,prosrc:null},{...changedBefore.p,prosrc:null});mark('exact only prosrc delta, derived install51 seal, zero financial DML');
 await reject(()=>sql(ddl),'55000');await sql('ROLLBACK');assert.deepEqual(await snapshot(),after);mark('reinstall refused with zero delta');
 for(const t of futures){await sql('BEGIN');await sql(t.mutation);const next=await error('SELECT public.rpc_estado_obrigacoes51(1,956) r');assert.deepEqual(next,t.old,t.name+' '+t.kind);await sql('ROLLBACK');assert.deepEqual(await financial(),before);}
 result.adversarial54=futures.map(({mutation,...x})=>x);mark('exact SQLSTATE/message all12 source/config/ACL/metadata plus schema/policy/trigger drift');
 // Original self body restored is a drift under new seal; no runtime resealing.
 await sql('BEGIN');await sql(original);await reject(()=>rpc('obrigacoes51.verificar'),'55000');await sql('ROLLBACK');mark('self51 exact old-body drift fails closed');
 for(const isolation of ['repeatable read','serializable']){await sql('BEGIN ISOLATION LEVEL '+isolation);const e=await reject(()=>rpc('obrigacoes51.verificar'),'55000');assert.equal(e.message,'Caixa37 exige PG17/Read Committed');await sql('ROLLBACK');}mark('inherited isolation guard');
 // Executor does not elevate non-super postgres. track_functions is a fixture-only
 // parameter grant by bootstrap, and tracing is performed without source mutation.
 await sql("SET track_functions='all'");await rpc('obrigacoes51.verificar');await sql('SELECT pg_stat_force_next_flush()');
 await new Promise(r=>setTimeout(r,1100));await sql('SELECT pg_stat_clear_snapshot()');
 const trace=await sql("SELECT schemaname,funcname,calls FROM pg_stat_user_functions WHERE funcname LIKE '%metadata%' ORDER BY schemaname,funcname LIMIT 1000");save('trace54.json',trace);result.trace54=trace;
 // Exact count proven through before/after counter deltas after priming all plans.
 const counters=async()=>await sql("SELECT funcid,schemaname,funcname,calls FROM pg_stat_user_functions WHERE funcname LIKE '%metadata%' ORDER BY funcid LIMIT 1000");
 const t0=await counters();await rpc('obrigacoes51.verificar');await sql('SELECT pg_stat_force_next_flush()');await new Promise(r=>setTimeout(r,1100));await sql('SELECT pg_stat_clear_snapshot()');const t1=await counters();
 const delta=t1.map(x=>({...x,calls:Number(x.calls)-Number(t0.find(y=>y.funcid===x.funcid)?.calls??0)})).filter(x=>x.calls);assert.equal(delta.length,12);assert.ok(delta.every(x=>x.calls===1));result.metadataUniqueTrace54=delta;save('trace54-unique-delta.json',delta);mark('12 unique real metadata calls, every guard executes once');
 result.benchmark54.stressNew=await stress('compiled54-controlled-contention');assert.ok(result.benchmark54.stressNew.rows.every(x=>x.ok),JSON.stringify(result.benchmark54.stressNew));
 result.benchmark54.new=await bench('compiled54');assert.ok(result.benchmark54.new.rows.every(x=>x.ok),JSON.stringify(result.benchmark54.new));
 // Genuine APP read-list style phase: four in-flight queries, then two passes over
 // a selection including512 installments. No batch/skip/helper substitution.
 const t=performance.now();for(let pass=0;pass<2;pass++)for(const id of [955,956,957,959,960]){await sql("SET statement_timeout='8s'; SET ROLE service_role");try{await rpc('public.rpc_estado_obrigacoes51',[1,id]);}finally{await sql('RESET ROLE');}}
 result.benchmark54.list={passes:2,parents:5,ms:performance.now()-t,perStatementTimeoutMs:8000};await sql("SET statement_timeout='90s'");save('benchmark54.json',result.benchmark54);mark('new four concurrent and read-list repeated passes within8s per statement');
 assert.deepEqual(await financial(),before);mark('all performance/adversarial tests zero financial DML');
}
