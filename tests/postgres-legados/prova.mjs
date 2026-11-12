import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const [host,user]=process.argv.slice(2);
assert(host.startsWith('/tmp/cobrapro-legados-pg17-') && host.endsWith('/socket'));
const cfg={host,user,database:'postgres',port:55474};
const admin=new pg.Client(cfg), service=new pg.Client(cfg);
await admin.connect(); await service.connect();
await service.query('SET ROLE service_role');
const query=async(q,v=[],client=admin)=>(await client.query(q,v)).rows;
const read=async(source,id,uid=1)=>(await query('SELECT public.legados_prova_pagamento($1,$2,$3) r',[uid,source,id],service))[0].r;
let passed=0;
const test=async(name,fn)=>{await fn();console.log(`PASS_PROVA ${++passed} ${name}`);};
async function legacy(){
 const aid=(await query("INSERT INTO contas_caixa(user_id,nome,saldo) VALUES(1,'Prova sintética',100) RETURNING id"))[0].id;
 const cid=(await query("INSERT INTO contratos(user_id,cliente_id,conta_caixa_id,modalidade,valor_principal,valor_parcela,total_contrato,data_inicio,num_parcelas,numero_parcelas) VALUES(1,1,$1,'mensal',123.45,123.45,123.45,'2026-01-01',1,1) RETURNING id",[aid]))[0].id;
 const pid=(await query("INSERT INTO parcelas(user_id,cliente_id,contrato_id,numero,numero_parcela,valor,valor_original,valor_pago,data_vencimento,conta_caixa_id) VALUES(1,1,$1,1,1,123.45,123.45,0,'2026-01-01',$2) RETURNING id",[cid,aid]))[0].id;
 const q=(await query('SELECT public.rpc_cotar_recebimento_legado(1,$1,$2,$3) r',[cid,pid,aid],service))[0].r;
 assert.equal(q.elegivel,true);
 const r=(await query('SELECT public.rpc_receber_legado(1,$1,$2,$3,$4,$5,$5,$6,$7,$8) r',[randomUUID(),cid,pid,aid,q.totalExigido,q.dataPagamento,q.estadoHash,q.regra],service))[0].r;
 return {aid,cid,pid,r,source:'legados_operacoes'};
}
async function cycle(){
 const aid=(await query("INSERT INTO contas_caixa(user_id,nome,saldo) VALUES(1,'Ciclo prova',1000) RETURNING id"))[0].id;
 const c=(await query("SELECT public.rpc_criar_emprestimo(1,$1,1,$2,'mensal','mensal',100,10,1,'2026-01-01','2026-01-01',ARRAY['2026-02-01'::date]) r",[randomUUID(),aid],service))[0].r;
 assert.equal(c.success,true);
 const cid=c.id,pid=(await query('SELECT id FROM parcelas WHERE contrato_id=$1',[cid]))[0].id;
 const q=(await query('SELECT public.rpc_cotar_emprestimo_prospectivo(1,$1,$2) r',[cid,pid],service))[0].r;
 assert.equal(q.elegivel,true);
 const r=(await query("SELECT public.rpc_receber_emprestimo_prospectivo(1,$1,$2,$3,12.34,$4,$5,$6,'parcial') r",[randomUUID(),cid,pid,q.totalExigido,q.dataPagamento,q.estadoHash],service))[0].r;
 return {aid,cid,pid,r,source:'ciclo_operacoes'};
}
// Corrupção é estritamente test-only, dentro de transação revertida, não relaxa guards.
async function corrupt(c,sql,values=[]){
 await admin.query('BEGIN');
 try {
  await admin.query("SET LOCAL session_replication_role='replica'");
  await admin.query(sql,values);
  await admin.query('SET LOCAL ROLE service_role');
  const r=(await query('SELECT public.legados_prova_pagamento(1,$1,$2) r',[c.source,c.r.operationId],admin))[0].r;
  assert.equal(r,null);
 } finally {await admin.query('ROLLBACK');}
}
try {
 await test('service genuine non-superuser sem BYPASSRLS; owner postgres, STABLE, search_path fixo e ACL exata',async()=>{
  const role=(await query('SELECT current_user u, session_user s, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user',[],service))[0];
  assert.equal(role.u,'service_role'); assert.notEqual(role.s,'service_role'); assert.equal(role.rolsuper,false); assert.equal(role.rolbypassrls,false);
  const p=(await query("SELECT p.prosecdef,p.provolatile,p.proconfig,r.rolname owner FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='public.legados_prova_pagamento(integer,text,uuid)'::regprocedure"))[0];
  assert.equal(p.prosecdef,true); assert.equal(p.provolatile,'s'); assert.equal(p.owner,'postgres'); assert(p.proconfig.includes('search_path=pg_catalog, pg_temp'));
  const acl=await query("SELECT r.rolname,x.privilege_type,x.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) x LEFT JOIN pg_roles r ON r.oid=x.grantee WHERE p.oid='public.legados_prova_pagamento(integer,text,uuid)'::regprocedure");
  assert.deepEqual(acl.map(x=>x.rolname).sort(),['postgres','service_role']); assert(acl.every(x=>x.privilege_type==='EXECUTE'&&!x.is_grantable));
  for(const table of ['ciclo_operacoes','ciclo_pernas','legados_operacoes','legados_auditoria']) await assert.rejects(()=>query(`SELECT ${table==='legados_auditoria'?'operacao_id':table==='ciclo_pernas'?'transacao_id':'id'} FROM ${table} LIMIT 1`,[],service),e=>e.code==='42501');
  await assert.rejects(()=>query('SELECT transacao_id FROM ciclo_pernas LIMIT 1',[],service),e=>e.code==='42501');
  for(const role of ['anon','authenticated']){
   await admin.query(`SET ROLE ${role}`);
   try {await assert.rejects(()=>query('SELECT public.legados_prova_pagamento(1,$1,$2)',['legados_operacoes',randomUUID()]),e=>e.code==='42501');} finally {await admin.query('RESET ROLE');}
  }
 });
 const l=await legacy();
 await test('legado confirmado por RPC financeira real: cinco campos, decimal string exato, sem novas colunas no Caixa',async()=>{
  const before=(await query('SELECT public.legados_snapshot($1) r',[l.cid]))[0].r;
  assert.deepEqual(await read(l.source,l.r.operationId),{parcelaId:l.pid,contratoId:l.cid,clienteId:1,valor:'123.45',dataPagamento:l.r.dataPagamento});
  const columns=await query("SELECT attname FROM pg_attribute WHERE attrelid='public.transacoes_caixa'::regclass AND attname IN('cliente_id','operacao_financeira_id') AND NOT attisdropped");assert.equal(columns.length,0);
  assert.deepEqual((await query('SELECT public.legados_snapshot($1) r',[l.cid]))[0].r,before);
  await service.query('BEGIN READ ONLY');
  try {
   assert.equal((await query('SHOW transaction_read_only',[],service))[0].transaction_read_only,'on');
   assert.deepEqual(await read(l.source,l.r.operationId),{parcelaId:l.pid,contratoId:l.cid,clienteId:1,valor:'123.45',dataPagamento:l.r.dataPagamento});
  } finally {await service.query('ROLLBACK');}
 });
 const c=await cycle();
 await test('ciclo parcial real: prova é somente a entrada 12.34, não total/juros/residual/acumulado',async()=>{
  assert.deepEqual(await read(c.source,c.r.operationId),{parcelaId:c.pid,contratoId:c.cid,clienteId:1,valor:'12.34',dataPagamento:c.r.dataPagamento});
 });
 for(const item of [l,c]) {
  await test(item.source+' rejeita tenant, operação ausente/fonte trocada, user NULL e fonte renovação',async()=>{
   assert.equal(await read(item.source,item.r.operationId,2),null);assert.equal(await read(item.source,randomUUID()),null);
   assert.equal(await read(item.source==='ciclo_operacoes'?'legados_operacoes':'ciclo_operacoes',item.r.operationId),null);
   assert.equal(await read(item.source,item.r.operationId,null),null);assert.equal(await read('renovacao_juros',item.r.operationId),null);
  });
  for(const [name,q,v] of [
   ['operação incompleta',`UPDATE ${item.source} SET resultado=NULL,concluida_em=NULL${item.source==='ciclo_operacoes'?',auditoria=NULL':''} WHERE id=$1`,[item.r.operationId]],
   ['operationId divergente',`UPDATE ${item.source} SET resultado=jsonb_set(resultado,'{operationId}',to_jsonb($2::text)) WHERE id=$1`,[item.r.operationId,randomUUID()]],
   ['valor do resultado divergente',`UPDATE ${item.source} SET resultado=jsonb_set(resultado,'{valorRecebido}','"0.01"'::jsonb) WHERE id=$1`,[item.r.operationId]],
   ['data resultado divergente',`UPDATE ${item.source} SET resultado=jsonb_set(resultado,'{dataPagamento}','"2020-01-01"'::jsonb) WHERE id=$1`,[item.r.operationId]],
   ['operação renovação',`UPDATE ${item.source} SET resultado=jsonb_set(resultado,'{regra}','"renovacao_juros"'::jsonb) WHERE id=$1`,[item.r.operationId]],
   ['valor Caixa divergente','UPDATE transacoes_caixa SET valor=valor+0.01 WHERE id=$1',[item.r.transacaoCaixaId]],
   ['data Caixa divergente','UPDATE transacoes_caixa SET data_transacao=data_transacao+1 WHERE id=$1',[item.r.transacaoCaixaId]],
   ['tenant Caixa errado','UPDATE transacoes_caixa SET user_id=2 WHERE id=$1',[item.r.transacaoCaixaId]],
   ['conta tenant errado','UPDATE contas_caixa SET user_id=2 WHERE id=$1',[item.aid]],
   ['contrato tenant errado','UPDATE contratos SET user_id=2 WHERE id=$1',[item.cid]],
   ['parcela tenant errado','UPDATE parcelas SET user_id=2 WHERE id=$1',[item.pid]],
   ['cliente tenant errado','UPDATE clientes SET user_id=2 WHERE id=1',[]],
   ['cliente parcela divergente','UPDATE parcelas SET cliente_id=2 WHERE id=$1',[item.pid]],
   ['categoria não pagamento','UPDATE transacoes_caixa SET categoria=\'renovacao_juros\' WHERE id=$1',[item.r.transacaoCaixaId]],
   ['tipo saída','UPDATE transacoes_caixa SET tipo=\'saida\' WHERE id=$1',[item.r.transacaoCaixaId]],
  ]) await test(item.source+' fail-closed '+name,()=>corrupt(item,q,v));
 }
 await test('ciclo exige snapshot/perna e auditoria real da própria operação',async()=>{
  await corrupt(c,'DELETE FROM ciclo_pernas WHERE operacao_id=$1',[c.r.operationId]);
  await corrupt(c,"UPDATE ciclo_pernas SET snapshot='{}'::jsonb WHERE operacao_id=$1",[c.r.operationId]);
  await corrupt(c,"UPDATE ciclo_operacoes SET auditoria='{}'::jsonb WHERE id=$1",[c.r.operationId]);
 });
 await test('legado exige auditoria/perna durável da própria operação',async()=>{
  await corrupt(l,'DELETE FROM legados_auditoria WHERE operacao_id=$1',[l.r.operationId]);
  await corrupt(l,'UPDATE legados_auditoria SET transacao_id=$2 WHERE operacao_id=$1',[l.r.operationId,c.r.transacaoCaixaId]);
 });
 await test('erro de banco não retorna prova nem vira ausência silenciosa',async()=>{
  await admin.query('BEGIN');
  try {await admin.query('ALTER TABLE ciclo_pernas RENAME TO test_unavailable');await admin.query('SET LOCAL ROLE service_role');await assert.rejects(()=>query('SELECT public.legados_prova_pagamento(1,$1,$2)',['ciclo_operacoes',c.r.operationId]),e=>e.code==='42P01');}finally{await admin.query('ROLLBACK');}
 });
 await test('operacoes_financeiras antiga sem coluna vínculo permanece NULL, mesmo com resultado success',async()=>{
  await admin.query('BEGIN');
  try {const id=randomUUID();await query("INSERT INTO operacoes_financeiras(id,user_id,tipo,chave_idempotencia,hash_requisicao,status,resultado,concluida_em) VALUES($1,1,'recebimento_parcela',$1,'synthetic','concluida',$2,NOW())",[id,{...l.r,operationId:id}]);await admin.query('SET LOCAL ROLE service_role');assert.equal((await query('SELECT public.legados_prova_pagamento(1,$1,$2) r',['operacoes_financeiras',id]))[0].r,null);}finally{await admin.query('ROLLBACK');}
 });
 await test('operacoes_financeiras vínculo opcional explícito + auditoria real, rejeita ausência/tenant/op/valor/data/renovação',async()=>{
  await admin.query('BEGIN');
  try {
   await admin.query("SET LOCAL session_replication_role='replica'");await admin.query('ALTER TABLE transacoes_caixa ADD COLUMN operacao_financeira_id uuid');
   const id=randomUUID(),txid=987654;
   await query("INSERT INTO transacoes_caixa(id,user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor,descricao,data_transacao,operacao_financeira_id) VALUES($1,1,$2,$3,$4,'entrada','pagamento_parcela',123.45,'Sintético explícito',$5,$6)",[txid,l.aid,l.cid,l.pid,l.r.dataPagamento,id]);
   const r={success:true,operationId:id,parcelaId:l.pid,transacaoCaixaId:txid,status:'paga',dataPagamento:l.r.dataPagamento};
   await query("INSERT INTO operacoes_financeiras(id,user_id,tipo,chave_idempotencia,hash_requisicao,status,resultado,concluida_em) VALUES($1,1,'recebimento_parcela',$1,'synthetic','concluida',$2,NOW())",[id,r]);
   const aid=randomUUID(),details={valorPago:'123.45',dataPagamento:r.dataPagamento,payload:{valorPago:'123.45',dataPagamento:r.dataPagamento,parcelaId:l.pid,contaCaixaId:l.aid}};
   await query("INSERT INTO auditoria_financeira(id,user_id,operacao_id,acao,entidade,entidade_id,detalhes) VALUES($1,1,$2,'registrar_pagamento_parcela','parcelas',$3,$4)",[aid,id,String(l.pid),details]);
   const localRead=async()=>{await admin.query('SET LOCAL ROLE service_role');try{return(await query('SELECT public.legados_prova_pagamento(1,$1,$2) r',['operacoes_financeiras',id]))[0].r;}finally{await admin.query('RESET ROLE');}};
   assert.deepEqual(await localRead(),{parcelaId:l.pid,contratoId:l.cid,clienteId:1,valor:'123.45',dataPagamento:r.dataPagamento});
   for(const q of [
    `UPDATE transacoes_caixa SET operacao_financeira_id=NULL WHERE id=${txid}`,
    `UPDATE transacoes_caixa SET operacao_financeira_id='${randomUUID()}' WHERE id=${txid}`,
    `UPDATE transacoes_caixa SET user_id=2 WHERE id=${txid}`,
    `UPDATE transacoes_caixa SET valor=123.46 WHERE id=${txid}`,
    `UPDATE transacoes_caixa SET data_transacao=data_transacao+1 WHERE id=${txid}`,
    `UPDATE operacoes_financeiras SET tipo='renovacao_juros' WHERE id='${id}'`,
    `DELETE FROM auditoria_financeira WHERE id='${aid}'`,
    `UPDATE auditoria_financeira SET detalhes=jsonb_set(detalhes,'{valorPago}','"1.00"'::jsonb) WHERE id='${aid}'`,
   ]){await admin.query('SAVEPOINT bad');await admin.query(q);assert.equal(await localRead(),null,q);await admin.query('ROLLBACK TO SAVEPOINT bad');}
  }finally{await admin.query('ROLLBACK');}
 });
 console.log(`TOTAL_PROVA_PASS=${passed}`);
} finally {await service.end();await admin.end();}
