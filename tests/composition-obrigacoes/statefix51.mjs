export async function statefix({sql,rpc,reject,scenario,randomUUID,assert,save,financial,out}) {
 const call=(n,v=[])=>rpc('public.'+n,v);
 const service=async fn=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 const state=(cid,uid=1)=>service(()=>call('rpc_estado_obrigacoes51',[uid,cid]));
 const preview=(cid,p)=>service(()=>call('rpc_cotar_obrigacoes51',[1,cid,p]));
 const req=q=>({contratoId:q.contratoId,proposta:q.proposta,estadoHash:q.estadoHash,dataCalculo:q.dataCalculo,motivo:'Regressão statefix51'});
 const execute=q=>service(()=>call('rpc_executar_obrigacoes51',[1,randomUUID(),req(q)]));
 const today=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d LIMIT 1"))[0].d;
 const create=async(n=3)=>service(()=>call('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','300.00','10.00',n,today,today,Array.from({length:n},(_,i)=>`2027-${String(i+1).padStart(2,'0')}-10`),null,null,'2','0.033']));
 const receive=async(cid,pid,mode='integral',amount)=>{const q=await service(()=>call('rpc_cotar_emprestimo_multimodal',[1,cid,pid]));return service(()=>call('rpc_receber_emprestimo_multimodal',[1,randomUUID(),cid,pid,amount??q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,mode,null]));};
 const cancel={acao:'cancelar',alvo:{tipo:'contrato'},reconhecoSemEstorno:true};
 await scenario('STATEFIX mixed paid+partial+open cancel contract preserves paid/cash/history and only renounces outstanding',async()=>{
  const loan=await create(),cid=loan.id,[paid,partial,open]=loan.parcelasIds;
  await receive(cid,paid);await receive(cid,partial,'parcial','25.00');
  const before=await financial(),snapshot=await call('multimodal_snapshot',[cid]);
  const q=await preview(cid,cancel),r=await execute(q),after=await financial(),p=await state(cid);
  assert.deepEqual(after,before);assert.deepEqual(await call('multimodal_snapshot',[cid]),snapshot);
  assert.equal(p.statusObrigacao,'encerrado_por_cancelamento');
  assert.deepEqual(q.idsAfetados,[partial,open]);assert.deepEqual(r.resultado.idsAfetados,[partial,open]);
  const row=p.parcelas.find(x=>x.parcelaId===paid);assert.equal(row.statusFinanceiroOriginal,'paga');assert.equal(row.statusObrigacao,'paga');assert.equal(row.obrigacaoAtual,'0.00');
  for(const id of [partial,open]){const row=p.parcelas.find(x=>x.parcelaId===id);assert.equal(row.statusObrigacao,'cancelada');assert.equal(row.obrigacaoAtual,'0.00');}
  assert.equal(snapshot.parcelas.find(x=>x.id===partial).valor_pago,25);
  await reject(()=>receive(cid,partial),'23514');
  save('statefix-mixed-proof.json',{loan,q,r,snapshot,p,before,after});
 });
 await scenario('STATEFIX all paid contract cannot fabricate cancellation: no outstanding, no event, cash preserved',async()=>{
  const loan=await create(2);for(const id of loan.parcelasIds)await receive(loan.id,id);
  const before=await financial();await reject(()=>preview(loan.id,cancel),'22023');const p=await state(loan.id);
  assert.equal(p.statusObrigacao,'quitado');assert.ok(p.parcelas.every(x=>x.statusObrigacao==='paga'&&x.obrigacaoAtual==='0.00'));assert.deepEqual(await financial(),before);
  save('statefix-all-paid-proof.json',{loan,p});
 });
 await scenario('STATEFIX transferred registered obligation zero without mutating original fixture status constraints',async()=>{
  const before=await financial(),v=await rpc('obrigacoes51.registrada',[{status:'renovada'}]);assert.equal(v,'0');assert.deepEqual(await financial(),before);save('statefix-transferred-proof.json',{registered:v,scope:'pure registered SQL, unchanged original physical constraint excludes renovada'});
 });
 await scenario('STATEFIX 512 registered legacy installments complete beyond writer60 and old sanitizer3000',async()=>{
  const before=await financial(),p=await state(956);assert.equal(p.parcelas.length,512);assert.equal(new Set(p.parcelas.map(x=>x.parcelaId)).size,512);assert.ok(p.parcelas.every(x=>x.obrigacaoAtual==='1.00'&&x.statusObrigacao==='aberta'));assert.equal(p.statusObrigacao,'ativo');assert.deepEqual(await financial(),before);
  await reject(()=>preview(956,cancel),'54000');save('statefix-large-proof.json',p);
 });
 await scenario('STATEFIX cheque legacy contract remains readable but every new action51 excluded',async()=>{
  const before=await financial(),p=await state(957);assert.equal(p.parcelas.length,2);assert.ok(p.parcelas.every(x=>x.obrigacaoAtual==='50.00'));assert.deepEqual(await financial(),before);
  for(const proposal of [cancel,{acao:'arquivar',alvo:{tipo:'contrato'}},{acao:'quitar',contaCaixaId:6,valorRecebido:'100.00',reconhecoDinheiroReal:true},{acao:'editar',parcelaId:957001,novoValor:'60.00'},{acao:'adicionar',valor:'50.00',dataVencimento:'2027-03-10',classificacao:'obrigacao_adicional_nao_desembolsada'}])await reject(()=>preview(957,proposal),'0A000');save('statefix-cheque-proof.json',p);
 });
 await scenario('STATEFIX genuine47 successor/origin readable via unchanged47 proof, no new writer51 chain',async()=>{
  const proof=JSON.parse((await import('node:fs')).readFileSync(out+'/cross46-48-47-proof.json','utf8'));
  const before=await financial(),origin=await state(proof.q47.contratoId),successor=await state(proof.r47.contratoId);
  assert.equal(origin.parcelas.length,4);assert.equal(successor.parcelas.length,2);assert.equal(successor.statusObrigacao,'ativo');assert.ok(successor.parcelas.every(x=>x.statusObrigacao==='aberta'));assert.deepEqual(await financial(),before);
  await reject(()=>preview(proof.r47.contratoId,cancel),'0A000');await reject(()=>state(proof.r47.contratoId,2),'42501');save('statefix-chain47-proof.json',{origin,successor});
 });
 await scenario('STATEFIX genuine43 successor and historical origin readable, no new writer51 chain',async()=>{
  const q=await service(()=>call('rpc_cotar_reparcelamento43',[1,{contratoId:955,numeroParcelas:2,taxaJuros:'5.00',tipoTaxa:'mensal',dataInicio:'2027-04-10',incluirMultas:false}]));
  const r=await service(()=>call('rpc_executar_reparcelamento43',[1,randomUUID(),{...q.request,estadoHash:q.estadoHash,cotacaoHash:q.cotacaoHash}]));
  const before=await financial(),origin=await state(955),successor=await state(r.contratoId);
  assert.equal(origin.parcelas.length,2);assert.equal(successor.parcelas.length,2);assert.equal(successor.statusObrigacao,'ativo');assert.deepEqual(await financial(),before);
  await reject(()=>preview(r.contratoId,cancel),'0A000');await reject(()=>state(r.contratoId,2),'42501');save('statefix-chain43-proof.json',{q,r,origin,successor});
 });
 await scenario('STATEFIX ambiguous legacy money remains refusal without zero/fallback/adoption',async()=>{
  const before=await financial();await reject(()=>state(958),'23514');assert.deepEqual(await financial(),before);assert.equal((await sql('SELECT count(*)::int n FROM legados_estados WHERE contrato_id=958 LIMIT 1'))[0].n,0);
 });
 await scenario('STATEFIX read links remain strict for owners and ledger; absent/drift module fails closed',async()=>{
  await reject(()=>state(956,2),'42501');
  for(const mutation of ['UPDATE parcelas SET user_id=2 WHERE id=956512','UPDATE parcelas SET cliente_id=2 WHERE id=956512','UPDATE parcelas SET conta_caixa_id=2 WHERE id=956512']) {
   await sql('BEGIN');await sql(mutation);await reject(()=>call('rpc_estado_obrigacoes51',[1,956]),'42501');await sql('ROLLBACK');
  }
  // Owner is not a license to fabricate51 events: INSERT can only project a matching completed closure.
  await sql('BEGIN');await sql("INSERT INTO obrigacoes51.cancelamentos SELECT 1,956,956001,id,1,0,'pendente' FROM obrigacoes51.operacoes WHERE request->'proposta'->>'acao'='cancelar' ORDER BY created_at LIMIT 1");await reject(()=>call('rpc_estado_obrigacoes51',[1,956]),'23514');await sql('ROLLBACK');
  await sql('BEGIN');await sql('ALTER FUNCTION obrigacoes51.validar_leitura(integer,integer) SET search_path=public');await reject(()=>call('rpc_estado_obrigacoes51',[1,956]),'55000');await sql('ROLLBACK');
  await sql('BEGIN');await sql('ALTER FUNCTION public.rpc_estado_obrigacoes51(integer,integer) RENAME TO fixture_missing_estado51');await reject(()=>call('rpc_estado_obrigacoes51',[1,956]),'42883');await sql('ROLLBACK');
  await state(956);
 });
 await scenario('MONEYREAD NUMERIC15 real legacy max exact textual, zero DML, owner and new writers remain restrictive',async()=>{
  const before=await financial(),p=await state(960);
  assert.equal(p.parcelas[0].obrigacaoAtual,'9999999999999.99');assert.equal(p.parcelas[0].componenteAdicional,'0.00');assert.deepEqual(await financial(),before);
  await reject(()=>state(960,2),'42501');
  assert.equal(await rpc('public.multimodal_moeda',['9999999999999.99']),false);
  await reject(()=>preview(960,{acao:'editar',parcelaId:960001,novoValor:'9999999999999.99'}),'22023');
  save('statefix-money15-proof.json',p);
 });
}
