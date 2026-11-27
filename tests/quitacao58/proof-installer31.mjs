import fs from 'node:fs';
export async function proof({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config,read,hash,candidate,captureOrder}){
 const W=candidate+'/tests/quitacao58',call=(n,v=[])=>rpc('public.'+n,v);
 const service=async fn=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 const preview=(cid,p)=>service(()=>call('rpc_cotar_obrigacoes51',[1,cid,p]));
 const req=q=>({contratoId:q.contratoId,proposta:q.proposta,estadoHash:q.estadoHash,dataCalculo:q.dataCalculo,motivo:'Synthetic bounded58'});
 const execute=(q,k=randomUUID())=>service(()=>call('rpc_executar_obrigacoes51',[1,k,req(q)]));
 const today=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d LIMIT 1"))[0].d;
 const create=()=>service(()=>call('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','10.00','10.00',2,today,today,['2026-12-27','2027-01-27'],null,null,'0','0']));
 const loan=await create(),cid=loan.id,proposal={acao:'quitar',contaCaixaId:1,valorRecebido:'13.00',reconhecoDinheiroReal:true};
 const qa=await preview(cid,{acao:'adicionar',valor:'1.00',dataVencimento:'2027-02-27',classificacao:'obrigacao_adicional_nao_desembolsada'}),ra=await execute(qa),added=ra.resultado.idsAfetados[0];
 await execute(await preview(cid,{acao:'editar',parcelaId:loan.parcelasIds[0],novoValor:'7.00',novaDataVencimento:'2026-12-28'}));
 const cancelq=await preview(cid,{acao:'cancelar',alvo:{tipo:'parcela',parcelaId:added},reconhecoSemEstorno:true});
 const physicalBeforeCancel=await financial();const cancel=await execute(cancelq);assert.deepEqual(await financial(),physicalBeforeCancel);
 const physical=await financial();
 const red=await reject(()=>preview(cid,proposal),'23514');assert.equal(red.message,'Ledger37 whole-owner crossowner/estrutura inválida');assert.deepEqual(await financial(),physical);
 const direct=await service(()=>call('rpc_cotar_emprestimo_multimodal',[1,cid,loan.parcelasIds[0]]));assert.equal(direct.totalExigido,'7.00');
 result.initialRed={code:red.code,message:red.message,where:red.where,underlying35QuoteWorks:true};save('red58.json',result.initialRed);
 const before=await captureOrder();const seals=async()=>await sql("SELECT '51' name,assinatura FROM obrigacoes51.manifesto WHERE id=1 UNION ALL SELECT '52',assinatura FROM inclusao52.manifesto WHERE id=1 UNION ALL SELECT '53',assinatura FROM sucessores53.manifesto WHERE id=1 UNION ALL SELECT '37',assinatura FROM public.caixa37_manifesto WHERE id=1 UNION ALL SELECT '47',assinatura FROM private47.manifesto WHERE id=1 ORDER BY name LIMIT 5");const oldSeals=await seals();
 const helper=read(W+'/candidate-helper.sql'),cot=read(W+'/candidate-cotacao.sql');const match=cot.match(/AS (\$\w*\$)([\s\S]*)\1;/);assert.ok(match);const prosrc=match[2];
 // Candidate installer local tests only: no original writer/migration changes.
 const install=read(new URL('../../drizzle/0058_quitacao_conta_alvo.sql',import.meta.url));result.installer58Sha256=hash(install);assert.equal(result.installer58Sha256,'cf0e949d9628b6de51a1b9cd9c52272cfbda072ffc3e9a80ea89c4f975cd6b72');
 await import('./installer-tests31.mjs').then(m=>m.tests({db,sql,rpc,reject,assert,save,financial,verify,result,config,captureOrder,install}));
 const predictedSeal=await rpc('obrigacoes51.metadata');const after=await captureOrder();
 for(const p of before.functions){const a=after.functions.find(x=>x.oid===p.oid);assert.ok(a);assert.deepEqual(p.name==='obrigacoes51.cotacao'?{...a.snapshot,prosrc:null}:a,p.name==='obrigacoes51.cotacao'?{...p.snapshot,prosrc:null}:p,p.name);}
 assert.equal(after.functions.length-before.functions.length,1);assert.equal(after.functions.find(x=>!before.functions.some(y=>y.oid===x.oid)).name,'obrigacoes51.validar_livro_recebimento');assert.deepEqual(after.catalog,before.catalog);assert.deepEqual(after.attributes,before.attributes);
 const newSeals=await seals();for(const old of oldSeals)if(old.name!=='51')assert.deepEqual(newSeals.find(x=>x.name===old.name),old);
 const compiled=after.functions.find(x=>x.name==='obrigacoes51.verificar');assert.equal(hash(compiled.snapshot.prosrc),JSON.parse(read(candidate+'/tests/composition-obrigacoes/pins54.json')).compiledBodySha256);
 save('install58-proof.json',{catalogBefore:before,catalogAfter:after,predictedSeal,oldSeals,newSeals,financeExact:true,originalVerifiersPASS:true,compiled54Exact:true,releaseInstaller:false,installerExactFinal31Tested:true});
 const green=await preview(cid,proposal);assert.equal(green.valorExigido,'13.00');assert.deepEqual(green.idsAfetados,loan.parcelasIds);
 const b=await call('multimodal_snapshot',[cid]);const key=randomUUID();await sql('BEGIN');const receipt=await execute(green,key);const inside=await call('multimodal_snapshot',[cid]);assert.deepEqual(inside.ledger.slice(b.ledger.length).map(x=>x.valor),[7,6]);assert.deepEqual(inside.parcelas.find(x=>x.id===added),b.parcelas.find(x=>x.id===added));await sql('ROLLBACK');assert.deepEqual(await financial(),physical);
 const settled=await execute(green,key),a=await call('multimodal_snapshot',[cid]);assert.deepEqual(await execute(green,key),settled);await service(()=>reject(()=>call('rpc_executar_obrigacoes51',[1,key,{...req(green),motivo:'Different UUID request'}]),'23505'));
 assert.deepEqual(a.parcelas.find(x=>x.id===added),b.parcelas.find(x=>x.id===added));assert.equal(a.ledger.length-b.ledger.length,2);assert.deepEqual((await sql('SELECT id,user_id,conta_caixa_id,contrato_id,valor FROM transacoes_caixa WHERE id=95858 LIMIT 1'))[0],physical.ledger.find(x=>x.id===95858)&&{id:95858,user_id:2,conta_caixa_id:15,contrato_id:95858,valor:'10.00'});
 assert.deepEqual(await service(()=>call('rpc_executar_obrigacoes51',[1,cancel.idempotencyKey,cancel.request])),cancel);
 const helperDirect=async(aid,cid)=>{await sql('BEGIN');try{await rpc('obrigacoes51.travar',[1,cid]);return await rpc('obrigacoes51.validar_livro_recebimento',[1,aid,cid]);}finally{await sql('ROLLBACK');}};
 await reject(()=>helperDirect(2,cid),'42501');
 result.initialGreen={quote13:true,twoGenuineReceipts:[7,6],rollbackPhysicalExact:true,replayExact:true,UUIDReuseRefused:true,cancelReplayImmutable:true,foreignExplicitTargetRefused:true,original37Unchanged:true,original35WriterUnchanged:true,compiled54Exact:true,otherCashCorruptionUnchanged:true};
 save('green58.json',{result:result.initialGreen,red:result.initialRed,loan,added,cancel,green,receipt,settled,b,a});console.log('PASS58 RED original whole-owner -> GREEN scoped quote + real35 settlement');
}
