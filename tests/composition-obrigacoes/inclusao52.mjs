export async function inclusao52({sql,rpc,randomUUID,assert,save,financial,result,scenario}){
 const service=async fn=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 const call=(name,args=[])=>service(()=>rpc('public.'+name,args));
 const today=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d LIMIT 1"))[0].d;
 const req=q=>({contratoId:q.contratoId,proposta:q.proposta,estadoHash:q.estadoHash,dataCalculo:q.dataCalculo,motivo:'Inclusão sintética52'});
 const failures=[];
 for(const cohort of ['21','semanal','quinzenal','diario','legado','legado_registrado']){
  try{
   let loan;
   if(cohort.startsWith('legado'))loan={id:cohort==='legado'?961:962};
   else {
    const modal=cohort==='21'?'mensal':cohort;
    const dates=(await sql("SELECT public.multimodal_data('2027-01-10'::date,$1,i)::text d FROM generate_series(0,2) i ORDER BY i LIMIT 3",[modal])).map(r=>r.d);
    loan=await call(cohort==='21'?'rpc_criar_emprestimo':'rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,modal,modal==='diario'?'diaria':modal,'300.00','10.00',3,today,today,dates,null,null,...(cohort==='21'?[]:['2','0.033'])]);
   }
   const snapshot=()=>rpc(cohort==='21'?'public.ciclo_snapshot':'public.multimodal_snapshot',[loan.id]);
   const before=await snapshot();save('fixture52-'+cohort+'.json',before);const financialBefore=await financial();const n=before.parcelas.length;
   const d=(await sql("SELECT public.multimodal_data($1::date,$2,$3)::text d LIMIT 1",[before.contrato.data_vencimento_primeira,cohort==='21'||cohort.startsWith('legado')?'mensal':cohort,n]))[0].d;
   const proposta={acao:'adicionar',valor:'17.35',dataVencimento:d,classificacao:'obrigacao_adicional_nao_desembolsada'};
   const q=await call('rpc_cotar_obrigacoes51',[1,loan.id,proposta]);assert.equal(q.origem,cohort==='21'?'prospectivo21':cohort.startsWith('legado')?'legado':'multimodal35');
   const k=randomUUID(),request=req(q);const r=await call('rpc_executar_obrigacoes51',[1,k,request]);assert.equal(r.status,'confirmed');assert.equal(r.resultado.valorRecebido,'0.00');assert.equal(r.resultado.contaDestinoId,null);assert.equal(r.resultado.caixaPreservado,true);
   const after=await snapshot(),pid=r.resultado.idsAfetados[0];assert.ok(Number.isInteger(pid)&&pid>0&&pid<=2147483647);assert.equal(after.parcelas.length,n+1);assert.deepEqual(after.parcelas.filter(p=>p.id!==pid),before.parcelas);assert.deepEqual(after.ledger,before.ledger);assert.deepEqual(after.historico.slice(0,before.historico.length),before.historico);assert.equal(after.historico.length,before.historico.length+1);
   assert.equal(after.contrato.valor_principal,before.contrato.valor_principal);assert.equal(after.contrato.taxa_juros,before.contrato.taxa_juros);assert.equal(after.contrato.num_parcelas,n+1);assert.equal(after.contrato.numero_parcelas,n+1);
   const a=after.parcelas.find(p=>p.id===pid);assert.equal(a.valor,17.35);assert.equal(a.valor_original,17.35);assert.equal(a.valor_juros,0);assert.equal(a.numero,n+1);assert.equal(a.numero_parcela,n+1);
   const fAfter=await financial();assert.deepEqual(fAfter.contas,financialBefore.contas);assert.deepEqual(fAfter.ledger,financialBefore.ledger);
   save('append-executed52-'+cohort+'.json',{before,q,k,request,r,after});
   const projection=await call('rpc_estado_obrigacoes51',[1,loan.id]);assert.equal(projection.obrigacaoAdicional,'17.35');assert.equal(projection.parcelas.find(p=>p.parcelaId===pid).componenteAdicional,'17.35');
   const beforeSecond=await snapshot();const nextDate=(await sql("SELECT public.multimodal_data($1::date,$2,$3)::text d LIMIT 1",[beforeSecond.contrato.data_vencimento_primeira,cohort==='21'||cohort.startsWith('legado')?'mensal':cohort,n+1]))[0].d;
   const secondProposal={...proposta,valor:'10.00',dataVencimento:nextDate};const secondQ=await call('rpc_cotar_obrigacoes51',[1,loan.id,secondProposal]);const secondR=await call('rpc_executar_obrigacoes51',[1,randomUUID(),req(secondQ)]);const secondAfter=await snapshot();assert.equal(secondAfter.parcelas.length,n+2);assert.deepEqual(secondAfter.parcelas.filter(p=>p.id!==secondR.resultado.idsAfetados[0]),beforeSecond.parcelas);assert.deepEqual(secondAfter.ledger,beforeSecond.ledger);
   let replay44=null;
   if(cohort==='21'){
    const original=before.parcelas[1];const editQ=await call('rpc_cotar_obrigacoes51',[1,loan.id,{acao:'editar',parcelaId:original.id,novoValor:'131.00'}]);await call('rpc_executar_obrigacoes51',[1,randomUUID(),req(editQ)]);
    const q44=await call('rpc_cotar_calendario44',[1,loan.id]);const agenda=['2027-05-10','2027-06-10','2027-07-10','2027-08-10','2027-09-10'];const r44=await call('rpc_executar_calendario44',[1,randomUUID(),loan.id,q44.estadoHash,agenda,'Replay52 cardinalidade atual']);replay44={editQ,q44,r44};
   }
   const receiptProofs=[];
   for(const target of [before.parcelas[0].id,pid]){
    let qr,rr;
    if(cohort.startsWith('legado')){qr=await call('rpc_cotar_recebimento_legado',[1,loan.id,target,6]);assert.equal(qr.elegivel,true);rr=await call('rpc_receber_legado',[1,randomUUID(),loan.id,target,6,qr.totalExigido,qr.totalExigido,qr.dataPagamento,qr.estadoHash,qr.regra,'Prova52 real34']);}
    else{const suffix=cohort==='21'?'prospectivo':'multimodal';qr=await call('rpc_cotar_emprestimo_'+suffix,[1,loan.id,target]);assert.equal(qr.elegivel,true);rr=await call('rpc_receber_emprestimo_'+suffix,[1,randomUUID(),loan.id,target,qr.totalExigido,qr.totalExigido,qr.dataPagamento,qr.estadoHash,'integral','Prova52 recebimento real']);}
    receiptProofs.push({qr,rr});
   }
   const paidBefore=await financial();const paidNextDate=(await sql("SELECT public.multimodal_data($1::date,$2,$3)::text d LIMIT 1",[beforeSecond.contrato.data_vencimento_primeira,cohort==='21'||cohort.startsWith('legado')?'mensal':cohort,n+2]))[0].d;let refusal;try{await call('rpc_cotar_obrigacoes51',[1,loan.id,{...proposta,dataVencimento:paidNextDate}]);}catch(e){refusal=e;}assert.ok(refusal,'new A after actual payment must refuse');assert.deepEqual(await financial(),paidBefore);
   const paid=await call('rpc_estado_obrigacoes51',[1,loan.id]);assert.equal(paid.parcelas.find(p=>p.parcelaId===pid).obrigacaoAtual,'0.00');assert.equal(paid.parcelas.find(p=>p.parcelaId===pid).componenteAdicional,'17.35');assert.deepEqual(await call('rpc_conferir_obrigacoes51',[1,k,request]),r);
   save('inclusao52-'+cohort+'.json',{cohort,before,q,k,request,r,after,projection,secondQ,secondR,secondAfter,replay44,receiptProofs,paid});result.results.push('append_'+cohort+'_atomic_A_receipt_real_recovery');console.log('PASS52 '+cohort);
  }catch(e){failures.push({cohort,code:e.code,message:e.message,where:e.where,stack:e.stack});console.log('RED52 '+cohort+' '+e.code+' '+e.message);}
 }
 save('inclusao52-failures.json',failures);assert.deepEqual(failures,[],'Every new cohort must actually append and receive by its genuine writer');
}
