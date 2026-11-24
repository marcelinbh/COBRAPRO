import {writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import ts from 'typescript';
const hash=s=>createHash('sha256').update(s).digest('hex');
const names={m34:'0034_rpc_recebimento_legado_validado',m35:'0035_rpc_ciclo_emprestimos_multimodal',m36:'0036_rpc_multa_manual_fixa',m36a:'0036a_multa_metadata_estavel'};
function matches(a,b){for(const [k,v] of Object.entries(b))if(v&&typeof v==='object')matches(a[k],v);else assert.deepEqual(a[k],v);}
function expect(a){return {toBe:b=>assert.equal(a,b),toEqual:b=>assert.deepEqual(a,b),toHaveLength:b=>assert.equal(a.length,b),toBeNull:()=>assert.equal(a,null),toMatch:b=>assert.match(a,b),toBeGreaterThanOrEqual:b=>assert.ok(a>=b),not:{toHaveProperty:b=>assert.ok(!Object.hasOwn(a,b))},rejects:{toMatchObject:async b=>{let e;try{await a;}catch(x){e=x;}assert.ok(e,'expected rejection');matches(e,b);}}};}
const omitted34=['PG17 socket privado, ambiente limpo, metadata intacta e reaplicação','falha real em CADA escrita financeira/interna produz rollback integral','fault em cada uma das 4 reservas/consumos de capability: rollback de TODAS etapas','fault AFTER write adulterando campo histórico rejeitado pela prova exata sem commit','metadata fail-closed, reapply não conserta drift e nenhuma escrita/backfill','instalação fresh falha metadata/homônimo sem objeto parcial nem backfill'];
const omitted35=['corrupção BEFORE/AFTER INSERT não certificada antes selar snapshot','ponte 0034 metadata novo detecta bridge/ACL/colunas e prova final antiga desfaz tampering pós-guard'];
export function preparationSentinels({read,sources}){
 for(const p of ['tests/postgres-legados/validate.mjs','tests/postgres-legados/prova.mjs','server/migrations/multimodal.postgres.test.ts','server/migrations/multa.postgres.test.ts'])assert.ok(read(p).length>1000,p);
 assert.equal(hash(sources[names.m36]),'7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f');
 const s=sources[names.m35];assert.equal(s.split('INSERT INTO public.multimodal_manifesto VALUES(1,public.multimodal_metadata());').length,2);
 return {source36:hash(sources[names.m36]),source36a:hash(sources[names.m36a]),originals:Object.fromEntries(['tests/postgres-legados/validate.mjs','tests/postgres-legados/prova.mjs','server/migrations/multimodal.postgres.test.ts','server/migrations/multa.postgres.test.ts'].map(p=>[p,hash(read(p))]))};
}
export async function runOriginalSuites({admin,baseconfig,fresh,target,sources,read,record,out}){
 const results=[],artifacts=[];
 const artifact=(name,code)=>{const p=`${out}/logcoexistence-${name}-fresh${fresh}.mjs`;writeFileSync(p,code+'\n');artifacts.push({path:p,sha256:hash(code+'\n')});return p;};
 const newResult=(suite,sourcePath,mode)=>{const r={suite,fresh,mode,sourcePath,sourceSha256:hash(read(sourcePath)),passed:[],skipped:[],errors:[],failure:null,equivalents:[],fullSuite:false};results.push(r);return r;};
 const dispatchFor=(r,db,skip=[])=>async(label,fn)=>{
  if(skip.includes(label)){r.skipped.push(label);record(`OMITIDO ${r.suite} fresh${fresh} ${label}`);return;}
  try{await fn();r.passed.push(label);record(`PASS ORIGINAL${r.suite} fresh${fresh} ${label}`);}catch(e){r.errors.push({label,message:e.message,code:e.code});r.failure??={message:`${label}: ${e.code??''} ${e.message}`};record(`FAIL ORIGINAL${r.suite} fresh${fresh} ${label}: ${e.code??''} ${e.message}`);await db.query('ROLLBACK').catch(()=>{});await db.query('RESET ROLE').catch(()=>{});}
 };
 const connect=async name=>{await admin.query(`CREATE DATABASE ${name}`);const config={...baseconfig,database:name},db=new pg.Client(config);await db.connect();return {db,config};};
 const sessionDefinition=()=>{
  const s=read('drizzle/0016_revogacao_sessoes_reset_senha.sql'),body=s.slice(s.indexOf('CREATE OR REPLACE FUNCTION public.revogar_sessoes_ao_alterar_senha()')).match(/AS \$body\$([\s\S]*?)\$body\$/)[1].replace(/%L/g,"'passwordHash'");
  return `CREATE OR REPLACE FUNCTION public.revogar_sessoes_ao_alterar_senha() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $body$${body}$body$; CREATE TRIGGER users_revogar_sessoes_ao_alterar_senha BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.revogar_sessoes_ao_alterar_senha()`;
 };
 const install=async(db,{through=37,instrument=null,session=false}={})=>{
  for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql'])await db.query(read(f).replace(/^CREATE ROLE .*;$/gm,''));
  await db.query('ALTER TABLE users ADD COLUMN "passwordHash" text, ADD COLUMN session_version integer NOT NULL DEFAULT 0, ADD CONSTRAINT users_session_version_nonnegative CHECK(session_version>=0)');
  await db.query("INSERT INTO contas_caixa(id,user_id,nome,saldo) VALUES(6,1,'Caixa limpo ponte0034',1000); SELECT setval('contas_caixa_id_seq',6),setval('clientes_id_seq',2)");
  if(session)await db.query(sessionDefinition());
  for(const [name,s] of Object.entries(sources)){
   if(through<35&&name===names.m35)break;if(through<36&&name===names.m36)break;
   let value=s;if(instrument&&name===names.m35){const anchor='INSERT INTO public.multimodal_manifesto VALUES(1,public.multimodal_metadata());';assert.equal(value.split(anchor).length,2);value=value.replace(anchor,()=>`SET LOCAL search_path=public,pg_catalog;\n${instrument};\nSET LOCAL search_path=pg_catalog,pg_temp;\n${anchor}`);assert.ok(value.includes(`${instrument};\nSET LOCAL search_path=pg_catalog,pg_temp;\n${anchor}`),'instrumento original deve permanecer byte a byte; replacement string não pode consumir dollar-quoting');artifact(`source35-instrumented-${instrument.includes('legacy')?'legacy':hash(instrument).slice(0,8)}`,value);}
   await db.query(value);
  }
  if(through===37)await db.query(target);
  await db.query("SET statement_timeout='30s'; SET TimeZone='UTC'; SET search_path=public,pg_catalog");
 };
 const adapt34=(source)=>source.slice(source.indexOf('let count=0;'),source.lastIndexOf('}finally{await db.end();}')).replace('console.log(`TOTAL_PASS=${count}`);','console.log(`TOTAL_PASS_ADAPTED=${adaptedPassed()}`);').replace('const test=async(name,fn)=>{await fn();console.log(`PASS ${++count} ${name}`);};','const test=dispatch;')+'}finally{}';
 const execute34=async(r,db,config,skip=[])=>{
  const code="const adaptedPassed=()=>passed(); const cfg=config; const readFileSync=read; const project='/home/ubuntu/cobrapro';\n"+adapt34(read(r.sourcePath));artifact(`original${r.suite}`,code);
  await new Function('db','config','dispatch','pg','assert','randomUUID','read','passed',`return (async()=>{${code}})()`)(db,config,dispatchFor(r,db,skip),pg,assert,randomUUID,read,()=>r.passed.length);
 };
 const executeTS=async(r,db,config,skip=[])=>{
  const source=read(r.sourcePath),definitions=source.slice(source.indexOf(' const sql='),source.indexOf(' try{\n  run('));
  const start=source.indexOf(r.suite===35?"  await scenario('0016 metadata":"  await scenario('ACL service_role");
  let code=definitions.replace(/ const scenario=async\(name:string,f:\(\)=>Promise<void>\)=>\{await f\(\);evidence.push\(`PASS \$\{name\}`\);\};/,' const scenario=dispatch;')+source.slice(start,source.lastIndexOf(' }finally{\n  await db.end()'));
  // Setup gate deliberately absent from integrated selection; its nominal complement is separate.
  code=code.replace("  await gate('one-shot reaplicação','SELECT 1');",'');
  code=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;artifact(`original${r.suite}`,code);
  await new Function('db','config','dispatch','pg','expect','randomUUID','readFileSync','evidence','target',`return (async()=>{${code}})()`)(db,config,dispatchFor(r,db,skip),pg,expect,randomUUID,read,[],sources[r.suite===35?names.m35:names.m36]);
 };
 for(const suite of [34,35,36]){
  const {db,config}=await connect(`original${suite}_fresh${fresh}`),r=newResult(suite,suite===34?'tests/postgres-legados/validate.mjs':`server/migrations/${suite===35?'multimodal':'multa'}.postgres.test.ts`,'seleção integrada36a+37');
  try{await install(db,{session:suite===35});if(suite===34)await execute34(r,db,config,omitted34);else await executeTS(r,db,config,suite===35?omitted35:[]);
   if(suite===35){
    const dispatch=dispatchFor(r,db);
    await dispatch('ponte0034 subset integrado: metadata bridge/ACL/coluna fail-closed sem reseal',async()=>{
     for(const mutation of ['ALTER TABLE legados_capacidades DISABLE TRIGGER multimodal_ponte_legados','GRANT INSERT(etapa) ON legados_capacidades TO service_role','ALTER TABLE legados_capacidades ALTER COLUMN conta_id SET DEFAULT 1']){
      await db.query('BEGIN');try{await db.query(mutation);await db.query('SAVEPOINT metadata');await assert.rejects(()=>db.query('SELECT rpc_capacidades_emprestimos_multimodal()'),e=>e.code==='55000');await db.query('ROLLBACK TO SAVEPOINT metadata');}finally{await db.query('ROLLBACK');}
     }
    });
   }
   r.skipped.push('setup/initdb/instalação/preflight/reapply e comparação catálogo baseline substituídos: seleção integrada não é suíte completa');
   r.equivalents.push(...(suite===34?omitted34.map(n=>({omission:n,dedicated:'34baseline validate preservado + prova34 projeções de leitura'})):suite===35?[{omission:'0016 instalação/preflight',dedicated:'35baseline setup/0016/gates preservados'},{omission:omitted35[0],dedicated:'35fault quatro instrumentos antes do selo inicial'},{omission:omitted35[1],dedicated:'35fault legacy pré-seal + negativos bridge/ACL/colunas integrados'}]:[{omission:'setup/preflight/reapply36',dedicated:null,status:'NO-GO original36 setup não executado nesta subfrente'}]));
  }catch(e){r.failure??={message:e.message,code:e.code};record(`FAIL ORIGINAL${suite} fresh${fresh} adapter ${e.code??''} ${e.message}`);}finally{await db.end().catch(()=>{});}
 }
 // Baseline34 uses original synthetic fixture and genuine NOBYPASSRLS role before sealing.
 {
  const {db,config}=await connect(`original34_baseline_fresh${fresh}`),r=newResult('34baseline','tests/postgres-legados/validate.mjs','complemento baseline34; não integrado37');
  try{
   await db.query(read('tests/postgres-legados/fixture.sql').replace(/^CREATE ROLE .*;$/gm,''));await db.query('ALTER ROLE service_role NOBYPASSRLS');
   for(const n of ['0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos',names.m34])await db.query(sources[n]);
   await db.query("SET search_path=public,pg_catalog; SET statement_timeout='30s'");await execute34(r,db,config);
   await runProof34({db,config,r,read,record,artifact,dispatchFor});
  }catch(e){r.failure??={message:e.message,code:e.code};record(`FAIL ORIGINAL34baseline fresh${fresh} ${e.code??''} ${e.message}`);}finally{await db.query('ROLLBACK').catch(()=>{});await db.end();await admin.query('ALTER ROLE service_role BYPASSRLS');}
 }
 // Original35 preflight and 0016 code is preserved as a dedicated baseline, not relabeled full-suite.
 {
  const {db,config}=await connect(`original35_setup_fresh${fresh}`),r=newResult('35setup','server/migrations/multimodal.postgres.test.ts','setup/0016/gates preservados baseline35');
  try{
   await install(db,{through:34});const source=read(r.sourcePath),defs=source.slice(source.indexOf(' const sql='),source.indexOf(' try{\n  run('));
   const begin=source.indexOf('  await rollback(async()=>{const before=await financial();await sql(body);');
   const end=source.indexOf("  await scenario('capabilities funcionais");
   let code=defs.replace(/ const scenario=async\(name:string,f:\(\)=>Promise<void>\)=>\{await f\(\);evidence.push\(`PASS \$\{name\}`\);\};/,' const scenario=dispatch;')+source.slice(begin,end);
   // Keep evidence entries as separate counts; setup uses versioned source35, no build.
   code=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;artifact('original35-setup',code);
   const evidence=[];await new Function('db','config','dispatch','pg','expect','randomUUID','readFileSync','evidence','target',`return (async()=>{${code}})()`)(db,config,dispatchFor(r,db),pg,expect,randomUUID,read,evidence,sources[names.m35]);
   for(const n of evidence){r.passed.push(n.replace(/^PASS /,''));record(`PASS ORIGINAL35setup fresh${fresh} ${n}`);}
   r.skipped.push('runtime financeiro full original35: separado da seleção integrada; initdb próprio substituído pelo cluster socket0700 autorizado');
  }catch(e){r.failure??={message:e.message,code:e.code};record(`FAIL ORIGINAL35setup fresh${fresh} ${e.code??''} ${e.message}`);}finally{await db.end();}
 }
 // Original36 setup/preflight/reapply is a PRE37 baseline; never claim its checks on schema37.
 {
  const {db,config}=await connect(`original36_setup_fresh${fresh}`),r=newResult('36setup','server/migrations/multa.postgres.test.ts','setup/preflight/reapply original36 baseline35→36; sem36a/37');
  try{
   await install(db,{through:35});const source=read(r.sourcePath),defs=source.slice(source.indexOf(' const sql='),source.indexOf(' try{\n  run('));
   const begin=source.indexOf('  for(const [name,setup] of [');const end=source.indexOf("  await scenario('ACL service_role");assert.ok(begin>=0&&end>begin);
   let code=defs+source.slice(begin,end);code=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;artifact('original36-setup',code);
   const evidence=[];await new Function('db','config','pg','expect','randomUUID','readFileSync','evidence','target',`return (async()=>{${code}})()`)(db,config,pg,expect,randomUUID,read,evidence,sources[names.m36]);
   for(const n of evidence){r.passed.push(n.replace(/^PASS /,''));record(`PASS ORIGINAL36setup fresh${fresh} ${n}`);}
   r.skipped.push('initdb/roles/fixtures/dependências originais fornecidos pelo cluster/instalador autorizado; runtime36 no schema36a+37 é outra seleção');
   r.equivalents.push({omission:'setup/preflight/reapply36 omitido da seleção integrada',dedicated:'sete gates originais, instalação sem mutação financeira e one-shot reapply em baseline35→36'});
  }catch(e){r.failure??={message:e.message,code:e.code};record(`FAIL ORIGINAL36setup fresh${fresh} ${e.code??''} ${e.message}`);}finally{await db.query('ROLLBACK').catch(()=>{});await db.end();}
 }
 // Exactly the corruption strings from original35, installed AFTER preflight, BEFORE initial seal.
 const s35=read('server/migrations/multimodal.postgres.test.ts'),block=s35.slice(s35.indexOf("  await scenario('corrupção BEFORE/AFTER INSERT"),s35.indexOf("  await scenario('mensal clamp"));
 const faultStrings=[...block.matchAll(/^    "(CREATE FUNCTION[^\n]+)"[,]?$/gm)].map(x=>x[1]);assert.equal(faultStrings.length,4);
 faultStrings.push("CREATE FUNCTION corrupt_legacy_ledger() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.valor:=99; RETURN NEW; END$$; CREATE TRIGGER z_corrupt_legacy BEFORE INSERT ON transacoes_caixa FOR EACH ROW WHEN(NEW.contrato_id=900) EXECUTE FUNCTION corrupt_legacy_ledger()");
 for(let index=0;index<faultStrings.length;index++){
  const {db}=await connect(`original35_fault${index}_fresh${fresh}`),r=newResult(`35fault${index}`,'server/migrations/multimodal.postgres.test.ts','equivalente dedicado com instrumento pré-seal; nunca reseal runtime');
  const dispatch=dispatchFor(r,db);
  try{
   await install(db,{through:35,instrument:faultStrings[index]});
   assert.equal((await db.query('SELECT (SELECT assinatura FROM multimodal_manifesto)=multimodal_metadata() ok')).rows[0].ok,true);
   await dispatch(index<4?`corrupção BEFORE/AFTER INSERT variante${index+1}: selo inicial real`:'ponte0034 AFTER guard: prova final antiga, selo inicial real',async()=>{
    const sql=async(q,v=[])=>(await db.query(q,v)).rows,financial=async()=>(await sql("SELECT jsonb_build_object('c',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contratos c),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),'h',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM contrato_historico h),'a',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a)) s"))[0].s;
    const day=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d"))[0].d;
    if(index===4)await sql("DELETE FROM parcelas WHERE id=901; UPDATE contratos SET conta_caixa_id=1,num_parcelas=1,numero_parcelas=1,valor_parcela=100 WHERE id=900; UPDATE parcelas SET numero=1,numero_parcela=1,valor=100,valor_original=100,conta_caixa_id=1 WHERE id=900");
    const before=await financial();await db.query('SET ROLE service_role');
    try{
     if(index<4)await assert.rejects(()=>db.query("SELECT rpc_criar_emprestimo_multimodal(1,$1,1,1,'mensal','mensal',100,10,1,$2::date,$2::date,ARRAY[$2::date],NULL,NULL,2,0.033)",[randomUUID(),day]),e=>e.code==='23514');
     else{const q=(await sql('SELECT rpc_cotar_recebimento_legado(1,900,900,1) q'))[0].q;assert.equal(q.elegivel,true);await assert.rejects(()=>db.query('SELECT rpc_receber_legado(1,$1,900,900,1,$2,$2,$3,$4,$5,NULL)',[randomUUID(),q.totalExigido,q.dataPagamento,q.estadoHash,q.regra]),e=>e.code==='23514');}
    }finally{await db.query('RESET ROLE');}
    assert.deepEqual(await financial(),before);assert.equal((await sql('SELECT count(*)::int n FROM multimodal_autorizacoes'))[0].n,0);
    await sql('SELECT multimodal_verificar(),legados_verificar()');
   });
   r.skipped.push('baseline instrumentada não é certificação de source35 congelada nem suite full');
  }catch(e){r.failure??={message:e.message,code:e.code};record(`FAIL ORIGINAL35fault${index} fresh${fresh} ${e.code??''} ${e.message}`);}finally{await db.end();}
 }
 for(const r of results){assert.equal(hash(read(r.sourcePath)),r.sourceSha256,'fonte original alterada durante execução');r.artifacts=artifacts;}
 return results;
}
async function runProof34({db,config,r,read,record,artifact,dispatchFor}){
 const sourcePath='tests/postgres-legados/prova.mjs',source=read(sourcePath),sourceSha256=hash(source),service=new pg.Client(config);await service.connect();await service.query('SET ROLE service_role');
 const readerSource=read('drizzle/0034_rpc_recebimento_legado_validado.sql'),start=readerSource.indexOf('CREATE FUNCTION public.legados_prova_pagamento('),end=readerSource.indexOf('$proof$;',start)+8;
 const reader=readerSource.slice(start,end);assert.ok(reader.endsWith('$proof$;'));
 // Faults corrupt a copied read universe, never disable a real financial guard. Reader body unchanged except literal schema qualifier.
 let shadow=false;const realQuery=db.query.bind(db);
 const shadowSetup=async()=>{
  await realQuery('CREATE SCHEMA proof34_shadow');
  for(const t of ['ciclo_operacoes','ciclo_pernas','legados_operacoes','legados_auditoria','operacoes_financeiras','auditoria_financeira','contas_caixa','contratos','parcelas','clientes','transacoes_caixa'])await realQuery(`CREATE TABLE proof34_shadow.${t} AS SELECT * FROM public.${t}`);
  const projected=reader.replaceAll('public.','proof34_shadow.');await realQuery(projected);
  await realQuery('GRANT USAGE ON SCHEMA proof34_shadow TO service_role; REVOKE ALL ON FUNCTION proof34_shadow.legados_prova_pagamento(integer,text,uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION proof34_shadow.legados_prova_pagamento(integer,text,uuid) TO service_role; SET LOCAL search_path=proof34_shadow,public,pg_catalog');shadow=true;
  artifact('proof34-reader-projection',projected);
 };
 const admin={query:async(q,v)=>{if(q==="TEST_ONLY_READ_PROJECTION")return shadowSetup();if(shadow)q=q.replaceAll('public.legados_prova_pagamento','proof34_shadow.legados_prova_pagamento');try{return await realQuery(q,v);}finally{if(q==='ROLLBACK')shadow=false;}}};
 let code=source.slice(source.indexOf('const query='),source.lastIndexOf('} finally {await service.end();await admin.end();}'))+'}finally{}';
 code=code.replace('const test=async(name,fn)=>{await fn();console.log(`PASS_PROVA ${++passed} ${name}`);};','const test=dispatch;').replaceAll("SET LOCAL session_replication_role='replica'",'TEST_ONLY_READ_PROJECTION').replace('console.log(`TOTAL_PROVA_PASS=${passed}`);','');
 artifact('original34-proof-adapted',code);
 r.proofSourcePath=sourcePath;r.proofSourceSha256=sourceSha256;r.proofProjection={originalReaderSha256:hash(reader),change:'somente public. → proof34_shadow.; DML negativo em cópias CTAS sem guard; transações revertidas'};
 try{await new Function('admin','service','dispatch','assert','randomUUID',`return (async()=>{${code}})()`)(admin,service,dispatchFor(r,db),assert,randomUUID);assert.equal(hash(read(sourcePath)),sourceSha256);}finally{await db.query('ROLLBACK').catch(()=>{});await service.end();}
 record(`SOURCE ORIGINAL34 PROOF_SHA=${sourceSha256} READER_SHA=${hash(reader)} PROJECTION_ONLY=true`);
}

export async function runL05OriginalCapabilities({db,newClient,c,loan35,loan36,sources,record,fresh}){
 const sql=async(q,v=[])=>(await db.query(q,v)).rows,findFunction=(source,name)=>{const m=source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([^]*?AS \\$\\$[^]*?\\$\\$;`));assert.ok(m,name);return m[0];};
 const guardSource=findFunction(sources[names.m35],'multimodal_guardar'),consumerSource=findFunction(sources[names.m36],'multa36_consumir');
 const observed=[];
 const gap=(family,test,note)=>{observed.push({family,test,status:'GAP_NO_GO',note});record(`GAP_NO_GO fresh${fresh} L05 consumer${family} ${test}: ${note}`);};
 const pass=(family,test,layer)=>{observed.push({family,test,status:'PASS',layer});record(`PASS L05 fresh${fresh} consumer${family} ${test} layer=${layer}`);};
 const cap35='multimodal_autorizacoes',cap36='multa36_capacidades';
 for(const role of ['anon','authenticated','service_role']){
  await db.query(`SET ROLE ${role}`);try{
   for(const t of [cap35,cap36]){
    for(const q of [`SELECT * FROM ${t} LIMIT 1`,`INSERT INTO ${t} SELECT * FROM ${t} LIMIT 1`,`UPDATE ${t} SET pid=pid WHERE false`,`DELETE FROM ${t} WHERE false`])await assert.rejects(()=>db.query(q),e=>e.code==='42501');
   }
   await assert.rejects(()=>db.query("SELECT multa36_consumir('multa36_guardar','transacoes_caixa','INSERT',NULL,'{}')"),e=>e.code==='42501');
   await assert.rejects(()=>db.query("SELECT multimodal_escrever($1,'transacoes_caixa',NULL,'{}')",[randomUUID()]),e=>e.code==='42501');pass('35/36',`ACL ${role}`,'ACL originals');
  }finally{await db.query('RESET ROLE');}
 }
 const row35=(await sql('SELECT to_jsonb(t) j FROM transacoes_caixa t WHERE contrato_id=$1 ORDER BY id LIMIT 1',[loan35.id]))[0].j;
 const row36=(await sql('SELECT to_jsonb(t) j FROM transacoes_caixa t WHERE contrato_id=$1 ORDER BY id LIMIT 1',[loan36.id]))[0].j;
 const peer=await newClient(),peerPid=(await peer.query('SELECT pg_backend_pid() p')).rows[0].p;
 try{
  for(const family of [35,36]){
   const baseRow={...(family===35?row35:row36),id:2100000+family};
   const cases=['exact-positive','absent','pid','xid','session','table','event','old','row-id','row-value','row-owner','row-description','row-date','row-createdAt','operation-absent','operation-completed','operation-owner','operation-contract','operation-action','payload-hash','payload-drift','proof-missing','double-consume'];
   for(const mode of cases){
    await db.query('BEGIN');try{
     const xid=(await sql('SELECT txid_current()::text x,pg_backend_pid() p'))[0];
     const uid=mode==='operation-owner'?2:c.u,cid=mode==='operation-contract'?loan35.id:loan36.id;
     let op;
     if(family===35){
      const payload={userId:uid,contratoId:mode==='operation-contract'?loan36.id:loan35.id,valorRecebido:mode==='payload-drift'?'999.00':String(baseRow.valor)},id=randomUUID(),operationFamily=mode==='operation-action'?'multimodal_criar':'multimodal_receber';
      op=(await sql("INSERT INTO multimodal_operacoes(id,user_id,family,chave,request,payload,hash_payload) VALUES($1,$2,$5,$1,$3,$3,CASE WHEN $4 THEN repeat('b',64) ELSE encode(extensions.digest($3::jsonb::text,'sha256'),'hex') END) RETURNING id",[id,uid,payload,mode==='payload-hash',operationFamily]))[0].id;
      // COPY guard35 source verbatim except function identifier; target is an empty read universe, not public financial tables.
      await sql('CREATE SCHEMA l05_shadow');await sql('CREATE TABLE l05_shadow.transacoes_caixa AS SELECT * FROM public.transacoes_caixa WITH NO DATA');
      await sql(guardSource.replace('public.multimodal_guardar()','l05_shadow.l05_guard35()'));await sql('REVOKE ALL ON FUNCTION l05_shadow.l05_guard35() FROM PUBLIC,anon,authenticated,service_role');
      await sql('CREATE TRIGGER original35 BEFORE INSERT ON l05_shadow.transacoes_caixa FOR EACH ROW EXECUTE FUNCTION l05_shadow.l05_guard35()');
     }else{
      const request={acao:mode==='operation-action'?'multa':'receber',contratoId:cid,valor:mode==='payload-drift'?'999.00':String(baseRow.valor)},id=randomUUID();
      op=(await sql("INSERT INTO multa36_operacoes(id,user_id,chave,contrato_id,acao,request,hash_payload) VALUES($1,$2,$1,$3,$4,$5,CASE WHEN $6 THEN repeat('b',64) ELSE encode(extensions.digest($5::jsonb::text,'sha256'),'hex') END) RETURNING id",[id,uid,cid,request.acao,request,mode==='payload-hash']))[0].id;
     }
     if(mode==='operation-completed'){
      // Existing completed original op is selected; no immutable operation is patched.
      op=(await sql(`SELECT id FROM ${family===35?'multimodal_operacoes':'multa36_operacoes'} WHERE resultado IS NOT NULL AND user_id=$1 ORDER BY id LIMIT 1`,[c.u]))[0].id;
     }
     const capRow={...baseRow},actual={...baseRow};
     const patches={'row-id':{id:baseRow.id+1},'row-value':{valor:'0.01'},'row-owner':{user_id:2},'row-description':{descricao:'forjada'},'row-date':{data_transacao:'2020-01-01'},'row-createdAt':{createdAt:'2020-01-01T00:00:00Z'}};Object.assign(actual,patches[mode]??{});
     const capXid=mode==='xid'?(BigInt(xid.x)+1n).toString():xid.x,capPid=['pid','session'].includes(mode)?peerPid:xid.p;
     const table=mode==='table'?'parcelas':'transacoes_caixa',event=mode==='event'?'UPDATE':'INSERT',anterior=['event','old'].includes(mode)?{}:null;
     if(mode!=='absent'){
      if(mode==='operation-absent'){
       await db.query('SAVEPOINT missing_op');await assert.rejects(()=>family===35?sql('INSERT INTO multimodal_autorizacoes VALUES($1,$2,$3,$4,$5,$6,$7)',[capXid,capPid,randomUUID(),table,event,anterior,capRow]):sql("INSERT INTO multa36_capacidades VALUES($1,$2,'multa36_guardar',$3,$4,$5,$6,$7)",[capXid,capPid,randomUUID(),table,event,anterior,capRow]),e=>e.code==='23503');await db.query('ROLLBACK TO SAVEPOINT missing_op');pass(family,mode,'FK original');continue;
      }
      if(family===35)await sql('INSERT INTO multimodal_autorizacoes VALUES($1,$2,$3,$4,$5,$6,$7)',[capXid,capPid,op,table,event,anterior,capRow]);
      else if(mode==='old'){
       // Original36 INSERT+anterior mismatch is stopped by its physical CHECK, before consumer.
       await db.query('SAVEPOINT bad_old');await assert.rejects(()=>sql("INSERT INTO multa36_capacidades VALUES($1,$2,'multa36_guardar',$3,$4,$5,$6,$7)",[capXid,capPid,op,table,event,anterior,capRow]),e=>e.code==='23514');await db.query('ROLLBACK TO SAVEPOINT bad_old');pass(family,mode,'CHECK original');continue;
      }else await sql("INSERT INTO multa36_capacidades VALUES($1,$2,'multa36_guardar',$3,$4,$5,$6,$7)",[capXid,capPid,op,table,event,anterior,capRow]);
     }
     let accepted=false;
     if(mode==='session'&&family===36){assert.equal((await peer.query("SELECT multa36_consumir('multa36_guardar','transacoes_caixa','INSERT',NULL,$1) ok",[actual])).rows[0].ok,false);pass(family,'session-peer','original consumer in distinct backend; uncommitted witness invisible');}
     if(family===35){
      await db.query('SAVEPOINT consume');try{await sql('INSERT INTO l05_shadow.transacoes_caixa SELECT (jsonb_populate_record(NULL::l05_shadow.transacoes_caixa,$1)).*',[actual]);accepted=true;}catch(e){assert.equal(e.code,'42501');await db.query('ROLLBACK TO SAVEPOINT consume');}
     }else accepted=(await sql("SELECT multa36_consumir('multa36_guardar','transacoes_caixa','INSERT',NULL,$1) ok",[actual]))[0].ok;
     const originalLacksCheck=family===35&&['operation-completed','operation-owner','operation-contract','operation-action','payload-hash','payload-drift','proof-missing'].includes(mode)||family===36&&['payload-hash','payload-drift','proof-missing'].includes(mode);
     if(originalLacksCheck){if(accepted)gap(family,mode,'consumidor original aceita capacidade exata owner-installer; não verifica este componente isoladamente; somente shadow/no financial commit');else pass(family,mode,'consumer original');}
     else if(['exact-positive','double-consume'].includes(mode)){assert.equal(accepted,true,`${family} positive consumer not reached`);pass(family,mode,'consumer original positive');}
     else{assert.equal(accepted,false,`aceitação inesperada original${family} ${mode}`);pass(family,mode,'consumer original');}
     if(mode==='double-consume'){
      if(family===35)await assert.rejects(()=>sql('INSERT INTO l05_shadow.transacoes_caixa SELECT (jsonb_populate_record(NULL::l05_shadow.transacoes_caixa,$1)).*',[{...actual,id:actual.id+1}]),e=>e.code==='42501');
      else assert.equal((await sql("SELECT multa36_consumir('multa36_guardar','transacoes_caixa','INSERT',NULL,$1) ok",[actual]))[0].ok,false);pass(family,'double-consume-negative','one-shot consumer original');
     }
    }finally{await db.query('ROLLBACK');}
   }
  }
 }finally{await peer.end();}
 gap(35,'sessão real distinta','pid de backend distinto exercitado; trigger shadow permanece transacional invisível ao peer, portanto não alegar consumo35 em outra conexão');
 return {guard35Sha256:hash(guardSource),consumer36Sha256:hash(consumerSource),observed,gaps:observed.filter(x=>x.status==='GAP_NO_GO'),instrumentation:'guard35 cópia identificador/schema target shadow; corpo original intocado; consumidor36 original; tudo transacional rollback'};
}

export async function runL05IntegratedBridges({db,c,loan,family,record,fresh}){
 const sql=async(q,v=[])=>(await db.query(q,v)).rows;
 const ledger=(await sql('SELECT to_jsonb(t) j FROM transacoes_caixa t WHERE contrato_id=$1 ORDER BY id LIMIT 1',[loan.id]))[0].j;
 const base={...ledger,id:2200000+family},results=[];
 const modes=['absent','xid','pid','table','event','posterior-owner','posterior-id','posterior-value','posterior-date','posterior-description','posterior-createdAt','operation-absent','operation-owner','operation-completed','payload-hash','payload-value'];
 for(const mode of modes){
  await db.query('BEGIN');try{
   const current=(await sql('SELECT txid_current()::text x,pg_backend_pid() p'))[0];let op;
   const uid=mode==='operation-owner'?2:c.u,request={userId:uid,contratoId:loan.id,valor:mode==='payload-value'?'999.00':String(base.valor)};
   if(family===35){const id=randomUUID();op=(await sql("INSERT INTO multimodal_operacoes(id,user_id,family,chave,request,payload,hash_payload) VALUES($1,$2,'multimodal_criar',$1,$3,$3,CASE WHEN $4 THEN repeat('b',64) ELSE encode(extensions.digest($3::jsonb::text,'sha256'),'hex') END) RETURNING id",[id,uid,request,mode==='payload-hash']))[0].id;}
   else{const id=randomUUID();op=(await sql("INSERT INTO multa36_operacoes(id,user_id,chave,contrato_id,acao,request,hash_payload) VALUES($1,$2,$1,$3,'receber',$4,CASE WHEN $5 THEN repeat('b',64) ELSE encode(extensions.digest($4::jsonb::text,'sha256'),'hex') END) RETURNING id",[id,uid,loan.id,request,mode==='payload-hash']))[0].id;}
   if(mode==='operation-completed')op=(await sql(`SELECT id FROM ${family===35?'multimodal_operacoes':'multa36_operacoes'} WHERE resultado IS NOT NULL ORDER BY id LIMIT 1`))[0].id;
   const expected={...base};
   const patch={'posterior-owner':{user_id:2},'posterior-id':{id:base.id+1},'posterior-value':{valor:'0.01'},'posterior-date':{data_transacao:'2020-01-01'},'posterior-description':{descricao:'forjada'},'posterior-createdAt':{createdAt:'2020-01-01T00:00:00Z'}};Object.assign(expected,patch[mode]??{});
   if(mode!=='absent'){
    const x=mode==='xid'?(BigInt(current.x)+1n).toString():current.x,p=mode==='pid'?current.p+1:current.p,t=mode==='table'?'parcelas':'transacoes_caixa',e=mode==='event'?'UPDATE':'INSERT',a=mode==='event'?{}:null;
    if(mode==='operation-absent'){
     await db.query('SAVEPOINT absent');await assert.rejects(()=>family===35?sql('INSERT INTO multimodal_autorizacoes VALUES($1,$2,$3,$4,$5,$6,$7)',[x,p,randomUUID(),t,e,a,expected]):sql("INSERT INTO multa36_capacidades VALUES($1,$2,'multa36_guardar',$3,$4,$5,$6,$7)",[x,p,randomUUID(),t,e,a,expected]),z=>z.code==='23503');await db.query('ROLLBACK TO SAVEPOINT absent');results.push({mode,status:'PASS',layer:'FK original'});continue;
    }
    if(family===35)await sql('INSERT INTO multimodal_autorizacoes VALUES($1,$2,$3,$4,$5,$6,$7)',[x,p,op,t,e,a,expected]);else await sql("INSERT INTO multa36_capacidades VALUES($1,$2,'multa36_guardar',$3,$4,$5,$6,$7)",[x,p,op,t,e,a,expected]);
   }
   const requestValueGap=mode==='payload-value';
   // Pontes originais autenticam o hash inteiro mas não interpretam valor do request35/36; consumidor privado e prova final são camadas distintas.
   if(requestValueGap){results.push({mode,status:'GAP_NO_GO',layer:'pontes35/36 request sem binding semântico completo; não executar DML sintético autorizado'});record(`GAP_NO_GO fresh${fresh} L05 bridge${family} payload-value: não atribuir binding semântico inexistente à ponte`);continue;}
   await db.query('SAVEPOINT rejected');let error;
   try{await sql('INSERT INTO public.transacoes_caixa SELECT (jsonb_populate_record(NULL::public.transacoes_caixa,$1)).*',[base]);}catch(z){error=z;}
   assert.ok(error,`bridge${family} ${mode} aceitou`);assert.equal(error.code,'42501');assert.match(error.message,/Ponte37|Ponte36/,'não aceitar recusa antes/depois de camada ponte como prova de witness');await db.query('ROLLBACK TO SAVEPOINT rejected');
   results.push({mode,status:'PASS',layer:error.message});record(`PASS L05 fresh${fresh} bridge${family} ${mode} code=${error.code} layer=${error.message}`);
  }finally{await db.query('ROLLBACK');}
 }
 return {fresh,family,results,gaps:results.filter(x=>x.status==='GAP_NO_GO').map(x=>({family,test:x.mode,status:x.status,note:x.layer})),instrumentation:'operações pendentes/capabilities sintéticas em BEGIN/ROLLBACK; DML público apenas negativo; sem reseal/bypass'};
}
