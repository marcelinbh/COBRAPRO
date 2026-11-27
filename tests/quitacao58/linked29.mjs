export async function linked({sql,rpc,reject,assert,save,financial,verify,result,config,captureOrder,randomUUID}) {
 const service=async fn=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 const call=(n,v)=>service(()=>rpc('public.'+n,v));
 const today=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d LIMIT 1"))[0].d;
 const loan=await call('rpc_criar_emprestimo_multimodal',[3,randomUUID(),3,32,'mensal','mensal','10.00','0.00',1,today,today,['2027-01-10'],null,null,'0','0']);
 const q=await call('rpc_cotar_caixa37',[3,'transferir',32,33,'1.00','Synthetic linked27']);
 const transfer=await call('rpc_transferir_caixa37',[3,randomUUID(),32,33,'1.00',q.dataTransacao,q.estadoHash,'Synthetic linked27']);
 const op=transfer.operationId,cid=loan.id;
 const helper=async()=>{await sql('SELECT pg_advisory_xact_lock(22022,32),pg_advisory_xact_lock(34034,3),pg_advisory_xact_lock(34035,$1) LIMIT 1',[cid]);return rpc('obrigacoes51.validar_livro_recebimento',[3,32,cid]);};
 await sql('BEGIN');try{await helper();}finally{await sql('ROLLBACK');}
 const before=await financial(),cat=await captureOrder(),cases=[];
 // Dependency corruption only in synthetic private journal; immutable guards remain intact.
 // Changing external account33 base must be refused by preserved original pin37
 // guard; do not disable guards to fabricate journal corruption.
 await sql('BEGIN');let e;try{e=await reject(()=>sql('UPDATE public.contas_caixa SET saldo=saldo+1 WHERE id=33'),'42501');}finally{await sql('ROLLBACK');}
 assert.deepEqual(await financial(),before);assert.deepEqual(await captureOrder(),cat);cases.push({name:'external linked transfer base mutation refused by original pin37 guard',code:e.code,message:e.message,where:e.where,noPartialDML:true});
 // Direct alteration of linked journal/legs is forbidden by preserved immutable writer guards.
 for(const [name,query,values] of [
 ['foreign request mutation',"UPDATE public.caixa37_operacoes SET request=jsonb_set(request,'{userId}','2'::jsonb) WHERE id=$1",[op]],
 ['foreign operation owner mutation','UPDATE public.caixa37_operacoes SET user_id=2 WHERE id=$1',[op]],
 ['foreign external leg reference mutation',"UPDATE public.caixa37_pernas SET user_id=2 WHERE operacao_id=$1 AND papel='destino'",[op]],
 ['foreign external leg snapshot mutation',"UPDATE public.caixa37_pernas SET snapshot=jsonb_set(snapshot,'{valor}','2'::jsonb) WHERE operacao_id=$1 AND papel='destino'",[op]],
 ['foreign external pin base mutation',"UPDATE public.caixa37_contas SET saldo_base=saldo_base+1 WHERE conta_id=33",[]]
 ]){
  await sql('BEGIN');try{const e=await reject(()=>sql(query,values),'42501');cases.push({name,code:e.code,message:e.message,guardPreserved:true});}finally{await sql('ROLLBACK');}
 }
 await sql('BEGIN');try{await helper();}finally{await sql('ROLLBACK');}
 await verify();await rpc('obrigacoes51.verificar');assert.deepEqual(await financial(),before);assert.deepEqual(await captureOrder(),cat);
 result.linked29={loan,transfer,cases,original37StrictDependencies:true,guardsNeverDisabled:true,writersUnchanged:true};save('linked29.json',result.linked29);console.log('PASS27 linked-transfer genuine37 external account dependency strict');
}
