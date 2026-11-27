export async function scenarios({sql,rpc,reject,scenario,randomUUID,assert,save,financial}) {
 const service=async fn=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 const call=(name,args)=>service(()=>rpc('public.'+name,args));
 const today=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d LIMIT 1"))[0].d;
 const root=await call('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','300.00','10.00',3,today,today,['2027-01-10','2027-02-10','2027-03-10'],null,null,'2','0.033']);
 const add=await call('rpc_cotar_obrigacoes51',[1,root.id,{acao:'adicionar',valor:'175.35',dataVencimento:'2027-04-10',classificacao:'obrigacao_adicional_nao_desembolsada'}]);
 await call('rpc_executar_obrigacoes51',[1,randomUUID(),{contratoId:root.id,proposta:add.proposta,estadoHash:add.estadoHash,dataCalculo:add.dataCalculo,motivo:'Adicional sintético53'}]);
 const q=await call('rpc_cotar_reparcelamento47',[1,{contratoId:root.id,numeroParcelas:2,taxaJuros:'5.00',tipoTaxa:'mensal',dataInicio:'2027-09-10',incluirMultas:false}]);
 await rpc('private47.configurar',[true]);
 const request47={...q.request,cotacaoId:q.cotacaoId,cotacaoHash:q.cotacaoHash,estadoHash:q.estadoHash},key47=randomUUID();
 const r=await call('rpc_executar_reparcelamento47',[1,key47,request47]);
 const before=await financial(),refusals=[];
 for(const [name,args,code] of [
  ['rpc_cotar_obrigacoes51',[1,r.contratoId,{acao:'editar',parcelaId:r.parcelasIds[0],novaDataVencimento:'2027-09-11'}],'0A000'],
  ['rpc_cotar_reparcelamento47',[1,{contratoId:r.contratoId,numeroParcelas:2,taxaJuros:'5.00',tipoTaxa:'mensal',dataInicio:'2027-11-10',incluirMultas:false}],'42501'],
  ['rpc_cotar_calendario46',[1,r.contratoId],null],
  ['rpc_cotar_manutencao48',[1,r.contratoId,{acao:'juros',taxaJuros:'12.0000'}],null],
  ['rpc_cotar_obrigacoes51',[1,952,{acao:'editar',parcelaId:9521,novaDataVencimento:'2027-01-11'}],'0A000'],
 ]) {const e=await reject(()=>call(name,args),code);refusals.push({name,code:e.code,message:e.message});}
 assert.deepEqual(await financial(),before);
 const reader=await call('rpc_estado_obrigacoes51',[1,r.contratoId]);
 assert.equal(r.obrigacaoAdicional,'175.35');assert.equal(reader.obrigacaoAdicional,'0.00');
 save('red53-proof.json',{root,q,r,reader,refusals,noFinancialDrift:true});
 await scenario('RED53 baseline51 refuses successor dates/finance/native transfer/legacy edit; inherited A absent in reader',async()=>{});
 return {root,q,r,request47,key47};
}
