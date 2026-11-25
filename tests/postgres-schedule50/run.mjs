import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createAdapter } from './adapter.mjs';
const home = process.env.HOME;
const repo = fileURLToPath(new URL('../../', import.meta.url));
if (!home?.endsWith('/50-schedule-compatible-v2') || process.env.PGHOST !== '/proc/self/cwd' || !process.cwd().startsWith(home+'/evidence/pg-') || process.env.DATABASE_URL || process.env.SUPABASE_URL) throw Error('SOCKET_PRIVADO_ENV_VAZIO_REQUIRED');
const owner = new Pool({ user:'owner50', max:1 }), pool = new Pool({ max:6 }), tenant = new Pool({ user:'tenant50', max:1 });
const sb = createAdapter(pool);
globalThis.__scheduleDb = sb;
globalThis.__actor = { isCron:true, taskUid:'cGt8wArds2oGUEpKbRJZo8', id:-1 };
globalThis.fetch = () => { throw Error('NETWORK_FORBIDDEN'); };
const out = path.join(home,'evidence/pgbuild'); await mkdir(out,{ recursive:true });
await build({ entryPoints:[path.join(repo,'server/notificacoesScheduledRoutes.ts')], outfile:path.join(out,'schedule.mjs'), platform:'node',format:'esm',packages:'external',bundle:true,
  plugins:[{ name:'offline-boundaries',setup(b){
    b.onResolve({filter:/(^|\/)db$/},()=>({path:'db',namespace:'offline'}));
    b.onResolve({filter:/(^|\/)env$/},()=>({path:'env',namespace:'offline'}));
    b.onResolve({filter:/(^|\/)sdk$/},()=>({path:'sdk',namespace:'offline'}));
    b.onResolve({filter:/(^|\/)relatorioDiario$/},()=>({path:'report',namespace:'offline'}));
    b.onLoad({filter:/.*/,namespace:'offline'},({path:p})=>({contents: p==='db' ? 'export const getSupabaseClientAsync=async()=>globalThis.__scheduleDb;' : p==='sdk' ? 'export const sdk={authenticateRequest:async()=>globalThis.__actor};' : p==='report' ? 'export function gerarMensagemRelatorio(){throw Error("REPORT_FORBIDDEN");}' : 'export const ENV={evolutionWebhookAllowLegacyQuery:false,evolutionWebhookToken:"fixture-only"};',loader:'js'}));
  }}] });
await build({ entryPoints:[path.join(repo,'server/services/notificacoesAutomaticas.ts')],outfile:path.join(out,'service.mjs'),platform:'node',format:'esm',packages:'external',bundle:true,
  plugins:[{name:'offline-db-env',setup(b){
    b.onResolve({filter:/(^|\/)db$/},()=>({path:'db',namespace:'offline'}));
    b.onResolve({filter:/(^|\/)env$/},()=>({path:'env',namespace:'offline'}));
    b.onLoad({filter:/.*/,namespace:'offline'},({path:p})=>({contents:p==='db'?'export const getSupabaseClientAsync=async()=>globalThis.__scheduleDb;':'export const ENV={};',loader:'js'}));
  }}] });
const scheduled = await import(path.join(out,'schedule.mjs')), service = await import(path.join(out,'service.mjs'));
const UID=scheduled.AGENDA_PROJECT_TASK_UID, KEY=scheduled.AGENDA_PROJECT_REGISTRY_KEY, TENANT=scheduled.AGENDA_TENANT_REGISTRY_KEY;
const evidence = {status:'RUNNING',scenarios:[],roles:null,schema:null,scope:'PG17 local support schema confirmed from parent; no production/finance/provider'};
const q=async(sql,args=[]) => (await pool.query(sql,args)).rows;
const oq=async(sql,args=[]) => (await owner.query(sql,args)).rows;
const invoke=async(body={dryRun:true}, route='/api/scheduled/notificacoes')=>{
  const handlers={}; scheduled.registerNotificacoesScheduledRoutes({post(p,h){handlers[p]=h;}});
  const res={code:200,status(n){this.code=n;return this;},set(){return this;},json(value){this.body=value;return this;}};
  await handlers[route]({body,get(){return undefined;}},res);return res;
};
async function test(name,fn){await fn();evidence.scenarios.push({name,status:'PASS'});console.log(`PASS ${evidence.scenarios.length}: ${name}`);}
const cleanRegistry=()=>pool.query('DELETE FROM configuracoes WHERE chave=$1 OR chave=$2',[KEY,TENANT]);
const registry=(key=KEY,uid=UID,userId=null)=>pool.query('INSERT INTO configuracoes(chave,valor,user_id) VALUES($1,$2,$3)',[key,uid,userId]);
try {
  assert.match((await q('SHOW server_version'))[0].server_version,/^17\./); assert.equal((await q('SHOW listen_addresses'))[0].listen_addresses,'');
  evidence.roles=await q("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('owner50','service50','tenant50') ORDER BY rolname LIMIT 3");
  assert(evidence.roles.every(r=>!r.rolsuper&&!r.rolbypassrls));
  assert.equal((await oq("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' LIMIT 1"))[0].n,0);
  await owner.query('CREATE TABLE configuracoes(id SERIAL PRIMARY KEY,chave VARCHAR(100) NOT NULL,valor TEXT,user_id INTEGER NULL,"createdAt" TIMESTAMPTZ DEFAULT now(),"updatedAt" TIMESTAMPTZ DEFAULT now())');
  await owner.query(await readFile(path.join(repo,'drizzle/0010_whatsapp_eventos.sql'),'utf8'));
  const original=await readFile(path.join(repo,'drizzle/0012_confiabilidade_operacional.sql'),'utf8');
  await owner.query(original.slice(original.indexOf('CREATE TABLE IF NOT EXISTS whatsapp_outbox')));
  await owner.query('ALTER TABLE notificacoes_log ALTER COLUMN status TYPE VARCHAR(20)');
  const tables=['configuracoes','whatsapp_eventos','whatsapp_outbox','whatsapp_tentativas','notificacoes_log','notificacoes_automaticas'];
  for(const t of tables) await owner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${t} FORCE ROW LEVEL SECURITY; CREATE POLICY service_crud ON ${t} FOR ALL TO service50 USING(true) WITH CHECK(true); GRANT SELECT,INSERT,UPDATE,DELETE ON ${t} TO service50;`);
  await owner.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service50');
  for(const t of ['configuracoes','whatsapp_outbox','notificacoes_log']) await owner.query(`CREATE POLICY own_read ON ${t} FOR SELECT TO tenant50 USING(user_id=51); GRANT SELECT ON ${t} TO tenant50;`);
  await owner.query("CREATE POLICY own_read ON whatsapp_eventos FOR SELECT TO tenant50 USING(instancia='user-51'); GRANT SELECT ON whatsapp_eventos TO tenant50;");
  evidence.schema=await q("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname LIMIT 20");
  assert(evidence.schema.every(r=>r.relrowsecurity&&r.relforcerowsecurity&&r.owner==='owner50'));
  await pool.query("INSERT INTO configuracoes(chave,valor,user_id) VALUES('notificacoes_auto_ativo','false',51),('relatorio_diario_ativo','false',51),('notificacoes_auto_ativo','false',52)");
  await pool.query("INSERT INTO whatsapp_outbox(id,user_id,tipo,telefone,mensagem,chave_deduplicacao,data_referencia,status,provider_message_id) VALUES('50505050-0000-4000-8000-000000000051',51,'no_vencimento','fixture','fixture','schedule51','2026-11-24','enviado','fixture-provider51'),('50505050-0000-4000-8000-000000000052',52,'no_vencimento','fixture','fixture','schedule52','2026-11-24','enviado','fixture-provider52')");
  await pool.query("INSERT INTO notificacoes_log(user_id,tipo,status,outbox_id) VALUES(51,'no_vencimento','aceito_evolution','50505050-0000-4000-8000-000000000051'),(52,'no_vencimento','lido','50505050-0000-4000-8000-000000000052')");
  const outboxBefore=await q('SELECT id,user_id,status,updated_at FROM whatsapp_outbox ORDER BY id LIMIT 10');
  const logBefore=await q('SELECT id,user_id,status,outbox_id FROM notificacoes_log ORDER BY id LIMIT 10');
  await test('UID real sem registro persistido:403, nenhum evento ou trabalho',async()=>{
    const r=await invoke();assert.equal(r.code,403);assert.equal((await q('SELECT count(*)::int n FROM whatsapp_eventos LIMIT 1'))[0].n,0);
  });
  await test('registry projeto exato NULL permite handler real PROJECT, producer/worker reais dryRun OFF',async()=>{
    await registry();const r=await invoke();assert.equal(r.code,200);assert.equal(r.body.escopo,'project');assert.equal(r.body.enviados,0);assert.equal(r.body.elegiveis,0);
    const events=await q('SELECT instancia,payload FROM whatsapp_eventos ORDER BY id LIMIT 20');assert.equal(events.length,6);
    assert.equal(events.filter(e=>e.instancia===`project-${scheduled.AGENDA_PROJECT_ID}`).length,2);
    assert(events.every(e=>JSON.parse(e.payload).escopo==='project'));assert(!JSON.stringify(events).includes('fixture-provider'));assert(!JSON.stringify(events).includes('telefone'));
  });
  await test('registro duplicado com NULL não é protegido pelo unique legado: auth fail-closed',async()=>{
    await registry();assert.equal((await invoke()).code,403);await cleanRegistry();
    await registry();await registry(KEY,"different-uid",null);assert.equal((await invoke()).code,403);await cleanRegistry();
  });
  await test('UID projeto em tenant fake4682/0 recusa; never adopts tenant',async()=>{
    for(const [key,id] of [[TENANT,4682],[KEY,4682],[KEY,0]]){await cleanRegistry();await registry(key,UID,id);assert.equal((await invoke()).code,403);}await cleanRegistry();
  });
  await test('UID não autorizado em PROJECT recusa; TENANT52 exato escopa todos os reads/observações',async()=>{
    globalThis.__actor={isCron:true,taskUid:'fixture-tenant',id:51};await registry(KEY,'fixture-tenant',null);assert.equal((await invoke()).code,403);await cleanRegistry();await registry(TENANT,'fixture-tenant',52);
    const before=(await q("SELECT count(*)::int n FROM whatsapp_eventos WHERE instancia='user-51' LIMIT 1"))[0].n;
    const r=await invoke();assert.equal(r.code,200);assert.equal(r.body.escopo,'tenant');assert.equal((await q("SELECT count(*)::int n FROM whatsapp_eventos WHERE instancia='user-51' LIMIT 1"))[0].n,before);
    const health=await invoke({},'/api/scheduled/notificacoes/health');assert.equal(health.code,200);assert.equal(health.body.escopo,'tenant');
  });
  await test('TENANT mesmo UID em dois owners é ambíguo; zero/invalid recusa',async()=>{
    await registry(TENANT,'fixture-tenant',51);assert.equal((await invoke()).code,403);await cleanRegistry();await registry(TENANT,'fixture-tenant',0);assert.equal((await invoke()).code,403);await cleanRegistry();
  });
  await test('leitor real distingue aceite sem callback, lido outro owner e heartbeat sem ligar OFF',async()=>{
    const r=await service.obterSaudeNotificacoes(51);assert.equal(r.recibos.aceitosSemRecibo,1);assert.equal(r.recibos.lidos,0);assert.equal(r.recibos.entregues,0);assert.equal(r.heartbeat.escopo,'project');assert.equal(r.cadencia,'nao_verificada');
    assert.equal((await q("SELECT valor FROM configuracoes WHERE user_id=51 AND chave='notificacoes_auto_ativo' LIMIT 1"))[0].valor,'false');
  });
  await test('criado_em NULL não esconde heartbeat recente: NULLS LAST real',async()=>{
    await pool.query("INSERT INTO whatsapp_eventos(evento,instancia,payload,criado_em) SELECT 'SCHEDULED_NOTIFICACOES','user-51','{}',NULL FROM generate_series(1,105)");
    const r=await service.obterSaudeNotificacoes(51);assert(r.heartbeat);assert.equal(r.heartbeat.escopo,'project');
  });
  await test('RLS real tenant não proprietário não lê projeto registry ou owner52/eventos/provas',async()=>{
    await cleanRegistry();await registry();
    assert((await tenant.query('SELECT user_id,chave FROM configuracoes ORDER BY id LIMIT 20')).rows.every(r=>r.user_id===51));
    assert((await tenant.query('SELECT user_id,status FROM notificacoes_log ORDER BY id LIMIT 20')).rows.every(r=>r.user_id===51));
    assert((await tenant.query('SELECT instancia FROM whatsapp_eventos ORDER BY id LIMIT 200')).rows.every(r=>r.instancia==='user-51'));
    await assert.rejects(tenant.query('INSERT INTO configuracoes(chave,valor,user_id) VALUES($1,$2,NULL)',[KEY,UID]));
  });
  await test('erro SQL real não vira zero de saúde; persistência inicial falha sem trabalho',async()=>{
    await owner.query('REVOKE SELECT ON notificacoes_log FROM service50');await assert.rejects(service.obterSaudeNotificacoes(51),/OBSERVABILIDADE/);await owner.query('GRANT SELECT ON notificacoes_log TO service50');
    globalThis.__actor={isCron:true,taskUid:UID,id:-1};await owner.query('REVOKE INSERT ON whatsapp_eventos FROM service50');assert.equal((await invoke()).code,503);await owner.query('GRANT INSERT ON whatsapp_eventos TO service50');
  });
  await test('DML companion guard validado SOMENTE fixture local:0/1 INSERT,no-op,rollback,ambiguous refuse',async()=>{
    await cleanRegistry();const sql=await readFile(path.join(repo,'tests/postgres-schedule50/PARENT_REGISTRY_DML_REVIEW_ONLY.sql'),'utf8');
    await pool.query(sql);assert.equal((await q('SELECT count(*)::int n FROM configuracoes WHERE chave=$1 LIMIT 1',[KEY]))[0].n,0);
    const persistent=sql.replace(/ROLLBACK;\s*$/,'COMMIT;');await pool.query(persistent);const before=await q('SELECT id,chave,valor,user_id,"updatedAt" FROM configuracoes WHERE chave=$1 LIMIT 2',[KEY]);await pool.query(persistent);assert.deepEqual(await q('SELECT id,chave,valor,user_id,"updatedAt" FROM configuracoes WHERE chave=$1 LIMIT 2',[KEY]),before);
    await registry();await assert.rejects(pool.query(sql),/AMBIGUO/);await pool.query('ROLLBACK');await cleanRegistry();
    await registry(TENANT,UID,4682);await assert.rejects(pool.query(sql),/AMBIGUO/);await pool.query('ROLLBACK');await cleanRegistry();
  });
  await test('outbox/log imutáveis: nenhum send/replay/fila, zero financeiro e nenhum function-DDL',async()=>{
    assert.deepEqual(await q('SELECT id,user_id,status,updated_at FROM whatsapp_outbox ORDER BY id LIMIT 10'),outboxBefore);assert.deepEqual(await q('SELECT id,user_id,status,outbox_id FROM notificacoes_log ORDER BY id LIMIT 10'),logBefore);
    assert.equal((await q("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' LIMIT 1"))[0].n,0);
    assert.equal((await q("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('parcelas','contratos','operacoes_financeiras','auditoria_financeira') LIMIT 1"))[0].n,0);
  });
  evidence.status='PASS_LOCAL_PG17_SERVICE_NONOWNER_NOSUPERUSER_NOBYPASSRLS_RLS_FORCED';
} finally {
  await owner.end();await pool.end();await tenant.end();delete globalThis.__scheduleDb;delete globalThis.__actor;
  await writeFile(path.join(home,'evidence/pg-matrix.json'),JSON.stringify(evidence,null,2)+'\n');
}
