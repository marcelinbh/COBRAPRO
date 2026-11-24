import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {functionsFromSQL} from '../../server/migrations/0033.preflight.sources.mjs';
const read=p=>readFileSync(p,'utf8'), hash=s=>createHash('sha256').update(s).digest('hex');
execFileSync('node',['tests/postgres-caixa37/build.mjs','--check'],{cwd:process.cwd(),stdio:'inherit'});
const s36=read('drizzle/0036_rpc_multa_manual_fixa.sql'),s37=read('drizzle/0037_rpc_aporte_transferencia_caixa.sql');
const pre=new Map(functionsFromSQL(s36).map(f=>[f.proname,f]));
pre.set('legados_validar',functionsFromSQL(read('drizzle/0034_rpc_recebimento_legado_validado.sql')).find(f=>f.proname==='legados_validar'));
const whitelist=['ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','legados_validar'];
const fs37=functionsFromSQL(s37);
for(const name of whitelist){
 const old=pre.get(name),now=fs37.find(f=>f.proname===name);assert.ok(old&&now);
 assert.equal(now.args,old.args);assert.equal(now.types,old.types);assert.equal(now.result,old.result);assert.deepEqual(now.proconfig,old.proconfig);
 if(name!=='legados_validar')assert.equal(now.body.replace(/\n IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public\.caixa37_consumir\(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb\(NEW\)\) THEN RETURN NEW; END IF;/,''),old.body);
 else{
  const original=old.body.split('\n').find(l=>l.includes("IF (t.tipo='entrada' AND t.parcela_id IS NULL)"));
  const changed=original.replace('IF (t.tipo=',"IF NOT public.caixa37_perna_comprovada(t.id,uid) AND ((t.tipo=").replace('THEN RAISE EXCEPTION',') THEN RAISE EXCEPTION');
  assert.equal(now.body.replace(changed,original),old.body);
 }
}
const rpcnames=fs37.filter(f=>f.proname.startsWith('rpc_')&&!pre.has(f.proname)).map(f=>f.proname).sort();
assert.deepEqual(rpcnames,['rpc_aportar_caixa37','rpc_capacidades_caixa37','rpc_cotar_caixa37','rpc_reconciliar_caixa37','rpc_transferir_caixa37'].sort());
assert.equal(new Set(fs37.map(f=>`${f.proname}(${f.types})`)).size,fs37.length);
const samples=JSON.parse(read('tests/postgres-caixa37/synthetic-rpc-envelopes.json'));
assert.equal(samples.syntheticOnly,true);assert.equal(samples.sql37Sha256,hash(s37));assert.equal(samples.cases.length,5);
for(const c of samples.cases){assert.deepEqual(c.recovery.request,c.request);assert.equal(c.recovery.userId,c.userId);assert.equal(c.recovery.idempotencyKey,c.idempotencyKey);if(c.result){assert.deepEqual(c.recovery.result,c.result);assert.equal(c.result.idempotencyKey,c.idempotencyKey);assert.equal(c.result.pernas.length,c.request.acao==='aporte'?1:2);}else assert.equal(c.recovery.status,'not_executed');}
console.log(`VALIDATE37 seis extensões estritas byte-preserving + cinco RPCs + envelopes PG17: SHA ${hash(s37)}; NÃO certifica matriz P0 completa.`);
