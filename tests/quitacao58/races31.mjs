import pg from 'pg';
export async function races({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,captureOrder}) {
 const full=async()=>{const rels=await sql("SELECT n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p') AND n.nspname IN('public','caixa_manutencao45','calendario46','despesa_cancelamento_v1','despesas49','inclusao52','manutencao44','manutencao48','obrigacoes51','private47','sucessores53','telefone41') ORDER BY n.nspname,c.relname LIMIT 1000");const snap={};for(const r of rels){const q='"'+r.schema.replaceAll('"','""')+'"."'+r.name.replaceAll('"','""')+'"';snap[r.schema+'.'+r.name]=(await sql(`SELECT coalesce(jsonb_agg(x.j ORDER BY x.j::text),'[]'::jsonb) rows FROM (SELECT to_jsonb(a) j FROM ${q} a) x LIMIT 1`))[0].rows;}return snap;};
 const service=async fn=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 const call=(n,v=[])=>service(()=>rpc('public.'+n,v));
 const today=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d LIMIT 1"))[0].d;
 const create=()=>call('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','100.00','0.00',2,today,today,['2027-01-10','2027-02-10'],null,null,'0','0']);
 const quote=(cid,proposal)=>call('rpc_cotar_obrigacoes51',[1,cid,proposal]);
 const req=q=>({contratoId:q.contratoId,proposta:q.proposta,estadoHash:q.estadoHash,dataCalculo:q.dataCalculo,motivo:'Synthetic integrity race27'});
 const exec=(q,key)=>call('rpc_executar_obrigacoes51',[1,key,req(q)]);
 const settle=l=>quote(l.id,{acao:'quitar',contaCaixaId:1,valorRecebido:l.totalContrato,reconhecoDinheiroReal:true});
 const cancel=l=>quote(l.id,{acao:'cancelar',alvo:{tipo:'contrato'},reconhecoSemEstorno:true});
 const runRace=async(kind)=>{const l=await create(),qs=await settle(l),qc=await cancel(l),receipt=await call('rpc_cotar_emprestimo_multimodal',[1,l.id,l.parcelasIds[0]]),key=randomUUID(),k2=kind==='same-UUID'?key:randomUUID();const c=new pg.Client(config);await c.connect();await c.query('SET ROLE service_role');let outcomes;
 try {let first=kind==='cancel-settle'||kind==='cancel-receipt'?qc:qs;let second=kind.endsWith('receipt')?['SELECT public.rpc_receber_emprestimo_multimodal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r',[1,k2,l.id,l.parcelasIds[0],receipt.totalExigido,receipt.totalExigido,receipt.dataPagamento,receipt.estadoHash,'integral',null]]:['SELECT public.rpc_executar_obrigacoes51($1,$2,$3) r',[1,k2,req(qs)]];
 outcomes=await Promise.allSettled([exec(first,key),c.query(...second).then(r=>r.rows[0].r)]);
 if(kind==='same-UUID'){assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,2);assert.deepEqual(outcomes[0].value,outcomes[1].value);assert.deepEqual(await exec(qs,key),outcomes[0].value);await reject(()=>call('rpc_executar_obrigacoes51',[1,key,{...req(qs),motivo:'different synthetic replay'}]),'23505');}else {assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);assert.ok(['40001','23514','22023'].includes(outcomes.find(x=>x.status==='rejected').reason.code));}
 const rows=await sql("SELECT id,parcela_id,tipo,valor FROM public.transacoes_caixa WHERE contrato_id=$1 AND tipo='entrada' ORDER BY id LIMIT 10",[l.id]);assert.equal(rows.length,kind==='same-UUID'?2:kind==='cancel-settle'?(outcomes[0].status==='fulfilled'?0:2):kind==='settle-receipt'?(outcomes[0].status==='fulfilled'?2:1):(outcomes[0].status==='fulfilled'?0:1));
 if(kind==='same-UUID')assert.equal((await sql('SELECT count(*)::int n FROM obrigacoes51.operacoes WHERE user_id=1 AND chave=$1 LIMIT 1',[key]))[0].n,1);
 result.races27??=[];result.races27.push({kind,cid:l.id,UUIDs:[key,k2],outcomes:outcomes.map(x=>x.status==='fulfilled'?{status:x.status,value:x.value}:{status:x.status,code:x.reason.code,message:x.reason.message}),receipts:rows});
 }finally{await c.end();}};
 for(const kind of ['same-UUID','cancel-settle','cancel-receipt','settle-receipt'])await scenario('RACE27 '+kind,()=>runRace(kind));
 await scenario('ATOMIC27 natural second ledger sequence exhaustion reverses entire settlement; original writers exact',async()=>{
  const l=await create(),q=await settle(l),key=randomUUID(),before=await full(),catalog=await captureOrder();
  const seq=(await sql("SELECT pg_get_serial_sequence('public.transacoes_caixa','id') seq LIMIT 1"))[0].seq;assert.match(seq,/^public\.[a-z_]+$/);
  const state=(await sql(`SELECT last_value::text last,is_called FROM ${seq} LIMIT 1`))[0];assert.equal((await sql('SELECT count(*)::int n FROM public.transacoes_caixa WHERE id=2147483647 LIMIT 1'))[0].n,0);
  let first,e;
  try{
   await sql('SELECT setval($1::regclass,2147483646,true) LIMIT 1',[seq]);
   await sql('BEGIN');try{const r=await call('rpc_cotar_emprestimo_multimodal',[1,l.id,l.parcelasIds[0]]);first=await call('rpc_receber_emprestimo_multimodal',[1,randomUUID(),l.id,l.parcelasIds[0],r.totalExigido,r.totalExigido,r.dataPagamento,r.estadoHash,'integral',null]);assert.equal((await sql("SELECT count(*)::int n FROM transacoes_caixa WHERE contrato_id=$1 AND tipo='entrada' AND id=2147483647 LIMIT 1",[l.id]))[0].n,1);}finally{await sql('ROLLBACK');}
   await sql('SELECT setval($1::regclass,2147483646,true) LIMIT 1',[seq]);
   e=await reject(()=>exec(q,key),'2200H');assert.match(e.message,/maximum value|nextval/i);
   assert.equal((await sql(`SELECT last_value::text last FROM ${seq} LIMIT 1`))[0].last,'2147483647');
   assert.deepEqual(await full(),before);assert.deepEqual(await captureOrder(),catalog);
   assert.equal((await sql('SELECT count(*)::int n FROM obrigacoes51.operacoes WHERE chave=$1 LIMIT 1',[key]))[0].n,0);
  }finally{await sql('ROLLBACK');await sql('SELECT setval($1::regclass,$2::bigint,$3::boolean) LIMIT 1',[seq,state.last,state.is_called]);}
  assert.deepEqual((await sql(`SELECT last_value::text last,is_called FROM ${seq} LIMIT 1`))[0],state);
  await verify();await rpc('obrigacoes51.verificar');await rpc('inclusao52.verificar');await rpc('sucessores53.verificar');
  result.atomic27={cid:l.id,key,code:e.code,message:e.message,where:e.where,firstReceiptProven:first,physicalTablesExact:Object.keys(before).length,allOwnersRowsColumnsJournalsExact:true,catalogExact:true,sequenceRestoredExact:true,writerModified:false};save('atomic27.json',result.atomic27);
 });
 save('races27.json',result.races27);
}
