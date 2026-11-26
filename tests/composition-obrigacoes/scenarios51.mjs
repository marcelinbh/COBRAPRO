import pg from 'pg';
export async function scenarios({db,sql,rpc,reject,scenario,randomUUID,assert,save,financial,verify,result,config}){
 const call=(n,v=[])=>rpc('public.'+n,v);
 const service=async fn=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 const preview=(cid,p,uid=1)=>service(()=>call('rpc_cotar_obrigacoes51',[uid,cid,p]));
 const request=(q,motivo='Teste fictício51')=>({contratoId:q.contratoId,proposta:q.proposta,estadoHash:q.estadoHash,dataCalculo:q.dataCalculo,motivo});
 const execute=(q,k=randomUUID())=>service(()=>call('rpc_executar_obrigacoes51',[1,k,request(q)]));
 const today=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d LIMIT 1"))[0].d;
 const create=async(n=3)=>service(()=>call('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','300.00','10.00',n,today,today,Array.from({length:n},(_,i)=>`2027-${String(i+1).padStart(2,'0')}-10`),null,null,'2','0.033']));
 const added={acao:'adicionar',valor:'175.35',dataVencimento:'2027-04-10',classificacao:'obrigacao_adicional_nao_desembolsada'};
 let root,appendId;
 await scenario('ACL/private schemas NOSUPERUSER NOBYPASSRLS capability51',async()=>{
  assert.deepEqual(await service(()=>call('rpc_capacidade_obrigacoes51')),{versao:'obrigacoes51_v1',disponivel:true});
  assert.equal((await sql("SELECT has_schema_privilege('service_role','obrigacoes51','USAGE') s,has_function_privilege('service_role','obrigacoes51.executar(integer,uuid,jsonb,boolean)','EXECUTE') f LIMIT 1"))[0].s,false);
  await service(()=>reject(()=>sql('SELECT * FROM obrigacoes51.operacoes LIMIT 1'),'42501'));
 });
 await scenario('Inclusão35 adicional A sem capital/juros/Caixa e aliases completos',async()=>{
  root=await create();const before=await call('multimodal_snapshot',[root.id]);const q=await preview(root.id,added);assert.equal(q.totalDepois,'565.35');assert.equal(q.obrigacaoAdicional,'175.35');const r=await execute(q);appendId=r.resultado.idsAfetados[0];
  const after=await call('multimodal_snapshot',[root.id]);assert.deepEqual(after.ledger,before.ledger);assert.equal(after.contrato.valor_principal,before.contrato.valor_principal);assert.deepEqual(after.parcelas.filter(p=>p.id!==appendId),before.parcelas);const row=after.parcelas.find(p=>p.id===appendId);assert.equal(row.valor_juros,0);assert.equal(row.numero,4);assert.equal(row.numero_parcela,4);assert.equal(row.valor,175.35);assert.equal(row.valor_original,175.35);assert.equal(after.contrato.num_parcelas,4);assert.equal(after.contrato.numero_parcelas,4);
  save('add51-proof.json',{q,r,before,after});
 });
 await scenario('Edição35 valor+data atomicamente só alvo; complemento permanece A',async()=>{
  const target=root.parcelasIds[1];const before=await call('multimodal_snapshot',[root.id]);const q=await preview(root.id,{acao:'editar',parcelaId:target,novoValor:'145.01',novaDataVencimento:'2027-02-28'});const r=await execute(q);const after=await call('multimodal_snapshot',[root.id]);assert.deepEqual(after.ledger,before.ledger);assert.deepEqual(after.parcelas.filter(p=>p.id!==target),before.parcelas.filter(p=>p.id!==target));const p=after.parcelas.find(p=>p.id===target);assert.equal(p.valor,145.01);assert.equal(p.data_vencimento,'2027-02-28');assert.equal(after.parcelas.find(p=>p.id===appendId).valor_juros,0);save('edit51-proof.json',{q,r,before,after});
 });
 await scenario('Compatibilidade inclusão→edição→46→48→cotação47 A explícito e capital íntegro',async()=>{
  const cid=root.id;const dates=['2027-05-10','2027-06-10','2027-07-10','2027-08-10'];const q46=await service(()=>call('rpc_cotar_calendario46',[1,cid]));await service(()=>call('rpc_executar_calendario46',[1,randomUUID(),cid,q46.estadoHash,dates,'Calendário fixture51']));
  const q48=await service(()=>call('rpc_cotar_manutencao48',[1,cid,{acao:'juros',taxaJuros:'12.0000'}]));await service(()=>call('rpc_executar_manutencao48',[1,randomUUID(),cid,q48.estadoHash,{acao:'juros',taxaJuros:'12.0000'},'Juros fixture51']));
  const current=await call('multimodal_snapshot',[cid]);assert.equal(current.parcelas.find(p=>p.id===appendId).valor,175.35);assert.equal(current.parcelas.find(p=>p.id===appendId).valor_juros,0);
  const q47=await service(()=>call('rpc_cotar_reparcelamento47',[1,{contratoId:cid,numeroParcelas:2,taxaJuros:'5.00',tipoTaxa:'mensal',dataInicio:'2027-09-10',incluirMultas:false}]));assert.equal(q47.principalOriginal,'300.00');assert.equal(q47.obrigacaoAdicional,'175.35');assert.equal(q47.regra,'reparcelamento47_cotacao_v3');// New isolated synthetic installation only: enable fixture47 to exercise chain v3, never deployment flags.
  await rpc('private47.configurar',[true]);const key47=randomUUID(),request47={...q47.request,cotacaoId:q47.cotacaoId,cotacaoHash:q47.cotacaoHash,estadoHash:q47.estadoHash};const r47=await service(()=>call('rpc_executar_reparcelamento47',[1,key47,request47]));assert.equal(r47.principalOriginal,'300.00');assert.equal(r47.obrigacaoAdicional,'175.35');assert.equal(r47.regra,'reparcelamento47_v3');await rpc('private47.validar_op',[r47.operationId]);const recovery47=await service(()=>call('rpc_reconciliar_reparcelamento47',[1,key47,request47]));assert.equal(recovery47.status,'confirmed');save('cross46-48-47-proof.json',{q46,q48,q47,current,r47,recovery47,request47,key47});
 });
 await scenario('Cancelamento individual preserva toda base e Caixa; irmã recebe pelo writer35 real',async()=>{
  const loan=await create(2),cid=loan.id,pid=loan.parcelasIds[0],sibling=loan.parcelasIds[1];const b=await call('multimodal_snapshot',[cid]);const q=await preview(cid,{acao:'cancelar',alvo:{tipo:'parcela',parcelaId:pid},reconhecoSemEstorno:true});const r=await execute(q);assert.deepEqual(await call('multimodal_snapshot',[cid]),b);
  const projection=await service(()=>call('rpc_estado_obrigacoes51',[1,cid]));assert.equal(projection.parcelas.find(p=>p.parcelaId===pid).obrigacaoAtual,'0.00');assert.equal(projection.parcelas.find(p=>p.parcelaId===sibling).statusObrigacao,'aberta');
  const receive=async pid=>{const q=await service(()=>call('rpc_cotar_emprestimo_multimodal',[1,cid,pid]));return service(()=>call('rpc_receber_emprestimo_multimodal',[1,randomUUID(),cid,pid,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,'integral',null]));};
  await reject(()=>receive(pid),'23514');await receive(sibling);const after=await service(()=>call('rpc_estado_obrigacoes51',[1,cid]));assert.equal(after.statusObrigacao,'encerrado_por_cancelamento');save('cancel51-proof.json',{q,r,projection,after});
 });
 await scenario('Quitação35 global recebe dinheiro real em uma RPC/transaction e baixas atômicas',async()=>{
  const loan=await create(3),cid=loan.id;const before=await call('multimodal_snapshot',[cid]);const proposal={acao:'quitar',contaCaixaId:1,valorRecebido:loan.totalContrato,reconhecoDinheiroReal:true};const q=await preview(cid,proposal);assert.equal(q.contaDestinoId,1);assert.equal(q.valorExigido,loan.totalContrato);assert.equal(q.caixaPreservado,false);const key=randomUUID(),r=await execute(q,key),after=await call('multimodal_snapshot',[cid]);assert.equal(r.resultado.valorRecebido,loan.totalContrato);assert.equal(r.resultado.contaDestinoId,1);assert.ok(after.parcelas.every(p=>p.status==='paga'&&p.saldo_residual===0));assert.equal(after.ledger.length-before.ledger.length,3);assert.equal(after.contrato.status,'quitado');assert.deepEqual(await service(()=>call('rpc_conferir_obrigacoes51',[1,key,request(q)])),r);assert.deepEqual(await execute(q,key),r);save('settlement51-proof.json',{q,r,before,after});
 });
 await scenario('Cancelamento integral/arquivo legado íntegro sem origem falsa nem mutação base',async()=>{
  const cid=951,before=await financial();const q=await preview(cid,{acao:'cancelar',alvo:{tipo:'contrato'},reconhecoSemEstorno:true});assert.equal(q.origem,'legado');const r=await execute(q);assert.deepEqual(await financial(),before);const a=await preview(cid,{acao:'arquivar',alvo:{tipo:'contrato'}});await execute(a);assert.equal((await service(()=>call('rpc_estado_obrigacoes51',[1,cid]))).arquivado,true);assert.deepEqual(await financial(),before);save('legacy51-proof.json',{q,r,a});
 });
 await scenario('Prospectivo21 edição individual valor+data→44 recomposto→recebimento real',async()=>{
  const loan=await service(()=>call('rpc_criar_emprestimo',[1,randomUUID(),1,1,'mensal','mensal','300.00','10.00',3,today,today,['2027-01-10','2027-02-10','2027-03-10'],null,null]));const cid=loan.id,pid=loan.parcelasIds[1];
  const before=await call('ciclo_snapshot',[cid]);const q=await preview(cid,{acao:'editar',parcelaId:pid,novoValor:'135.55',novaDataVencimento:'2027-02-28'});await execute(q);const q44=await service(()=>call('rpc_cotar_calendario44',[1,cid]));await service(()=>call('rpc_executar_calendario44',[1,randomUUID(),cid,q44.estadoHash,['2027-04-10','2027-05-10','2027-06-10'],'Agenda21 após edição51']));
  const receive=await service(()=>call('rpc_cotar_emprestimo_prospectivo',[1,cid,pid]));await service(()=>call('rpc_receber_emprestimo_prospectivo',[1,randomUUID(),cid,pid,receive.totalExigido,receive.totalExigido,receive.dataPagamento,receive.estadoHash,'integral',null]));const after=await call('ciclo_snapshot',[cid]);assert.equal(after.parcelas.find(p=>p.id===pid).status,'paga');assert.equal(after.parcelas.find(p=>p.id===pid).valor_original,135.55);save('prospectivo21-edit44-proof.json',{before,q,q44,receive,after});
 });
 await scenario('Prospectivo21 quitação global transacional com conta destino explícita',async()=>{
  const loan=await service(()=>call('rpc_criar_emprestimo',[1,randomUUID(),1,1,'mensal','mensal','100.00','5.00',2,today,today,['2027-01-10','2027-02-10'],null,null]));const q=await preview(loan.id,{acao:'quitar',contaCaixaId:1,valorRecebido:loan.totalContrato,reconhecoDinheiroReal:true});const r=await execute(q),after=await call('ciclo_snapshot',[loan.id]);assert.ok(after.parcelas.every(p=>p.status==='paga'));assert.equal(after.contrato.status,'quitado');save('prospectivo21-settlement-proof.json',{q,r,after});
 });
 await scenario('Legado íntegro quitação global sem origem35/21 falsa',async()=>{
  const q=await preview(954,{acao:'quitar',contaCaixaId:6,valorRecebido:'100.00',reconhecoDinheiroReal:true});const r=await execute(q),after=await call('multimodal_snapshot',[954]);assert.ok(after.parcelas.every(p=>p.status==='paga'));assert.equal(after.contrato.status,'quitado');assert.equal(after.origem,null);save('legacy51-settlement-proof.json',{q,r,after});
 });
 await scenario('Owner/vínculos completos; request preciso centavos/date e conta explícita',async()=>{
  await reject(()=>preview(root.id,{acao:'editar',parcelaId:root.parcelasIds[0],novoValor:'130.001'}),'22023');await reject(()=>preview(root.id,{acao:'editar',parcelaId:root.parcelasIds[0],novaDataVencimento:'2027-02-29'}),'22008');await reject(()=>preview(root.id,{acao:'editar',parcelaId:root.parcelasIds[0],novoValor:'130.00'},2),'42501');
  await reject(()=>preview(root.id,{acao:'quitar',valorRecebido:'100.00',reconhecoDinheiroReal:true}),'22023');await reject(()=>preview(root.id,{acao:'quitar',contaCaixaId:2,valorRecebido:'100.00',reconhecoDinheiroReal:true}),'0A000');
 });
 await scenario('Fence durable before POST impede writer tardio; divergência UUID conflita',async()=>{
  const q=await preview(952,{acao:'cancelar',alvo:{tipo:'parcela',parcelaId:9521},reconhecoSemEstorno:true}),k=randomUUID(),req=request(q);const f=await service(()=>call('rpc_conferir_obrigacoes51',[1,k,req]));assert.equal(f.status,'fenced');assert.deepEqual(f.request,req);await reject(()=>execute(q,k),'23514');await service(()=>reject(()=>call('rpc_conferir_obrigacoes51',[1,k,{...req,motivo:'Outro motivo'}]),'23505'));
 });
 await scenario('SQL rollback whole global settlement after first successful underlying receipt',async()=>{
  const loan=await create(3);const q=await preview(loan.id,{acao:'quitar',contaCaixaId:1,valorRecebido:loan.totalContrato,reconhecoDinheiroReal:true});const before=await financial();await sql('BEGIN');await execute(q);await sql('ROLLBACK');assert.deepEqual(await financial(),before);assert.equal((await sql('SELECT count(*)::int n FROM obrigacoes51.operacoes WHERE contrato_id=$1 LIMIT 1',[loan.id]))[0].n,0);
 });
 await scenario('Concorrência UUID51 dois POSTs retorna a mesma única confirmação',async()=>{
  const q=await preview(953,{acao:'cancelar',alvo:{tipo:'parcela',parcelaId:9531},reconhecoSemEstorno:true}),key=randomUUID(),req=request(q);const c=new pg.Client(config);await c.connect();await c.query('SET ROLE service_role');try{const a=execute(q,key),b=c.query('SELECT public.rpc_executar_obrigacoes51($1,$2,$3) r',[1,key,req]);const [ra,rb]=await Promise.all([a,b]);assert.deepEqual(ra,rb.rows[0].r);assert.equal((await sql('SELECT count(*)::int n FROM obrigacoes51.operacoes WHERE user_id=1 AND chave=$1 LIMIT 1',[key]))[0].n,1);}finally{await c.end();}
 });
 await scenario('Concorrência cancelamento51 x quitação51: um vencedor; perdedor stale sem Caixa fictício',async()=>{
  const loan=await create(3),cid=loan.id;const cancel=await preview(cid,{acao:'cancelar',alvo:{tipo:'contrato'},reconhecoSemEstorno:true}),settle=await preview(cid,{acao:'quitar',contaCaixaId:1,valorRecebido:loan.totalContrato,reconhecoDinheiroReal:true});const c=new pg.Client(config);await c.connect();await c.query('SET ROLE service_role');try{const results=await Promise.allSettled([execute(cancel),c.query('SELECT public.rpc_executar_obrigacoes51($1,$2,$3) r',[1,randomUUID(),request(settle)])]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);const state=await service(()=>call('rpc_estado_obrigacoes51',[1,cid]));const ledger=(await sql("SELECT tipo,valor FROM transacoes_caixa WHERE contrato_id=$1 AND tipo='entrada' ORDER BY id LIMIT 60",[cid]));if(state.statusObrigacao==='encerrado_por_cancelamento')assert.equal(ledger.length,0);else{assert.equal(state.statusObrigacao,'quitado');assert.equal(ledger.length,3);}}finally{await c.end();}
 });
 await scenario('Abort SQL real após baixas de quitação mantém rollback completo de ledger/conta/history/journal',async()=>{
  const loan=await create(3),q=await preview(loan.id,{acao:'quitar',contaCaixaId:1,valorRecebido:loan.totalContrato,reconhecoDinheiroReal:true}),before=await financial();await sql('BEGIN');await execute(q);await reject(()=>sql('SELECT 1/0 AS erro LIMIT 1'),'22012');await reject(()=>sql('COMMIT'),'25P02').catch(()=>{});await sql('ROLLBACK');assert.deepEqual(await financial(),before);assert.equal((await sql('SELECT count(*)::int n FROM obrigacoes51.operacoes WHERE contrato_id=$1 LIMIT 1',[loan.id]))[0].n,0);
 });
 await scenario('guardCash37 runtime alteração trigger antigo fecha capacidade/writer51 sem reseal',async()=>{
  const before=await financial();await sql('BEGIN');await sql('ALTER TABLE transacoes_caixa DISABLE TRIGGER obrigacoes51_guard');await reject(()=>call('rpc_capacidade_obrigacoes51'),'55000');await sql('ROLLBACK');assert.deepEqual(await financial(),before);await call('rpc_capacidade_obrigacoes51');
 });
 await scenario('Trilhas51/ACL service não permitem update/delete/fabricar cancelamento',async()=>{
  await service(()=>reject(()=>sql('INSERT INTO obrigacoes51.cancelamentos VALUES(1,953,9532,gen_random_uuid(),50,0,\'pendente\')'),'42501'));await reject(()=>sql('DELETE FROM obrigacoes51.cancelamentos WHERE parcela_id=9531'),'42501');
 });
 await verify();await call('rpc_capacidade_obrigacoes51');
}
