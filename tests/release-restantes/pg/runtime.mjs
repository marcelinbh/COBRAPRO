export async function runtime({sql,rpc,reject,scenario,randomUUID,assert,save,functions,seals,financial,verify,result}){
 const day=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d"))[0].d;
 const cash=async()=>JSON.stringify((await sql("SELECT jsonb_build_object('a',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t)) c"))[0].c);
 const sealed=await seals(),sources=await functions();
 const verifyAll=async()=>{await verify();await rpc('telefone41.verificar');await rpc('manutencao44.verificar');await rpc('despesa_cancelamento_v1.verificar');await rpc('caixa_manutencao45.verificar');};
 let pay42,phone,cheque,successor,calendar,cancel,note;
 const dirtyBefore=await sql('SELECT to_jsonb(t) row FROM transacoes_caixa t WHERE conta_caixa_id IN(4,5) ORDER BY id');
 await scenario('37 pin real compartilhado + quatro funções35 continuam no trilho35 convencional',async()=>{
  const q=await rpc('rpc_cotar_caixa37',[1,'aporte',null,1,'1.00',null]);await rpc('rpc_aportar_caixa37',[1,randomUUID(),1,q.valor,q.dataTransacao,q.estadoHash,null]);
  const c=await rpc('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','10.00','0.00',1,day,day,[day],null,null,'2.0000','0.0330']);
  assert.equal((await rpc('rpc_identificar_emprestimo_multimodal',[1,c.id,c.parcelasIds[0]])).trilho,'multimodal');const p=await rpc('rpc_cotar_emprestimo_multimodal',[1,c.id,c.parcelasIds[0]]);assert.equal((await rpc('rpc_receber_emprestimo_multimodal',[1,randomUUID(),c.id,c.parcelasIds[0],p.totalExigido,p.totalExigido,p.dataPagamento,p.estadoHash,'integral',null])).status,'paga');
 });
 await scenario('42 recebe real após todos DDL; replay e conferência',async()=>{
  const args=[1,randomUUID(),42,1,1,'29.90','2026-11',null];await sql('SET ROLE service_role');pay42=await rpc('rpc_receber_assinatura42',args);assert.equal(pay42.success,true);assert.equal((await rpc('rpc_conferir_assinatura42',args)).estado,'confirmed');assert.equal((await rpc('rpc_receber_assinatura42',args)).operationId,pay42.operationId);await sql('RESET ROLE');
 });
 await scenario('41 cria/recebe/cancela real após stack',async()=>{
  const r={acao:'criar',marca:'Fixture',modelo:'Combinada offline',imei:null,cor:null,armazenamento:null,custo:'50.00',precoVenda:'70.00',entradaPercentual:'20.00',jurosMensal:'10.00',numParcelas:3,dataPrimeiraParcela:'2027-01-31',contaCaixaId:1,compradorNome:'Fixture sintético',compradorCpf:null,compradorRg:null,compradorTelefone:null,compradorEmail:null,compradorEstadoCivil:null,compradorProfissao:null,compradorInstagram:null,compradorCep:null,compradorCidade:null,compradorEstado:null,compradorEndereco:null,compradorLocalTrabalho:null};
  await sql('SET ROLE service_role');phone=await rpc('rpc_executar_telefone41',[1,randomUUID(),r]);await sql('RESET ROLE');
  const p=(await sql('SELECT id,valor::text FROM parcelas_venda_telefone WHERE venda_id=$1 ORDER BY numero LIMIT 1',[phone.vendaId]))[0];await sql('SET ROLE service_role');
  await rpc('rpc_executar_telefone41',[1,randomUUID(),{acao:'receber',vendaId:phone.vendaId,parcelaId:Number(p.id),contaCaixaId:1,valorPago:p.valor}]);await rpc('rpc_executar_telefone41',[1,randomUUID(),{acao:'cancelar',vendaId:phone.vendaId,motivo:'Teste cumulativo offline'}]);await sql('RESET ROLE');
 });
 await scenario('40 cria descontado e cancela com líquido exato após stack',async()=>{
  const args=[1,randomUUID(),{acao:'criar',dataOperacao:day,clienteId:1,contaCaixaId:1,emitente:'Fixture conjunta',numeroCheque:'COMBINADO',banco:null,agencia:null,conta:null,cpfCnpjEmitente:null,valorNominal:'10.00',dataVencimento:day,taxaDesconto:'3.00',tipoTaxa:'mensal',observacoes:null}];await sql('SET ROLE service_role');cheque=await rpc('rpc_cheques40',args);assert.equal(cheque.status,'descontado');assert.equal((await rpc('rpc_cheques40',args)).operationId,cheque.operationId);const r=await rpc('rpc_cheques40',[1,randomUUID(),{acao:'cancelar',dataOperacao:day,id:cheque.id}]);assert.equal(r.status,'cancelado');assert.equal(r.estornadoNoCaixa,true);await sql('RESET ROLE');
 });
 await scenario('43 executa sem caixa e sucessora recebe parcial/integral REAL pelo writer35 após stack',async()=>{
  const before=await cash(),req={contratoId:920,numeroParcelas:2,taxaJuros:'5.00',tipoTaxa:'mensal',dataInicio:'2027-01-31',incluirMultas:false};await sql('SET ROLE service_role');
  const q=await rpc('rpc_cotar_reparcelamento43',[1,req]),key=randomUUID(),conf={...q.request,estadoHash:q.estadoHash,cotacaoHash:q.cotacaoHash};successor=await rpc('rpc_executar_reparcelamento43',[1,key,conf]);assert.equal(successor.desembolso,'0.00');assert.equal(await cash(),before);
  const cid=successor.contratoId,pid=successor.parcelasIds[0];assert.equal((await rpc('rpc_identificar_emprestimo_multimodal',[1,cid,pid])).trilho,'multimodal');const qq=await rpc('rpc_cotar_emprestimo_multimodal',[1,cid,pid]);const receiveArgs=[1,randomUUID(),cid,pid,'10.00',qq.totalExigido,qq.dataPagamento,qq.estadoHash,'parcial',null];assert.equal((await rpc('rpc_receber_emprestimo_multimodal',receiveArgs)).status,'parcial');assert.equal((await rpc('rpc_receber_emprestimo_multimodal',receiveArgs)).repetida,true);
  for(const id of successor.parcelasIds){const p=await rpc('rpc_cotar_emprestimo_multimodal',[1,cid,id]);assert.equal((await rpc('rpc_receber_emprestimo_multimodal',[1,randomUUID(),cid,id,p.totalExigido,p.totalExigido,p.dataPagamento,p.estadoHash,'integral',null])).status,'paga');}
  assert.equal((await rpc('rpc_executar_reparcelamento43',[1,key,conf])).contratoId,cid);await sql('RESET ROLE');
  assert.deepEqual(await sql('SELECT tipo,sum(valor)::numeric(12,2)::text total,count(*)::int n FROM transacoes_caixa WHERE contrato_id=$1 GROUP BY tipo',[cid]),[{tipo:'entrada',total:'110.00',n:3}]);assert.equal((await sql('SELECT status FROM contratos WHERE id=$1',[cid]))[0].status,'quitado');assert.equal((await sql('SELECT count(*)::int n FROM multimodal_origens WHERE contrato_id=$1',[cid]))[0].n,0);
 });
 await scenario('43 sucessora coexiste na MESMA conta1 com42/41/40/35 e pin37 real',async()=>{
  await sql('BEGIN');
  // Origem sintética extra não protegida, somente neste teste descartado; preserva o fixture anterior.
  await sql("INSERT INTO contratos(id,user_id,cliente_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario) VALUES(921,1,1,1,'mensal','mensal',10,10,10,1,1,'2026-01-01','2026-02-01','ativo',2,0.033); INSERT INTO parcelas(id,contrato_id,user_id,cliente_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,data_vencimento,status) VALUES(921,921,1,1,1,1,1,10,10,0,0,'2026-02-01','pendente')");
  const before=await cash(),q=await rpc('rpc_cotar_reparcelamento43',[1,{contratoId:921,numeroParcelas:1,taxaJuros:'0.00',tipoTaxa:'mensal',dataInicio:'2027-01-31',incluirMultas:false}]),c=await rpc('rpc_executar_reparcelamento43',[1,randomUUID(),{...q.request,estadoHash:q.estadoHash,cotacaoHash:q.cotacaoHash}]);assert.equal(await cash(),before);
  const p=await rpc('rpc_cotar_emprestimo_multimodal',[1,c.contratoId,c.parcelasIds[0]]);assert.equal((await rpc('rpc_receber_emprestimo_multimodal',[1,randomUUID(),c.contratoId,c.parcelasIds[0],p.totalExigido,p.totalExigido,p.dataPagamento,p.estadoHash,'integral',null])).status,'paga');await sql('ROLLBACK');
 });
 await scenario('44 calendário real sem modificar caixa',async()=>{
  const loan=await rpc('rpc_criar_emprestimo',[1,randomUUID(),1,1,'mensal','mensal','20.00','10.00',2,day,day,['2030-01-10','2030-02-10'],null,null]);const before=await cash();await sql('SET ROLE service_role');const q=await rpc('rpc_cotar_calendario44',[1,loan.id]),args=[1,randomUUID(),loan.id,q.estadoHash,['2030-03-10','2030-04-10'],'Ajuste cumulativo sintético'];calendar=await rpc('rpc_executar_calendario44',args);assert.equal(calendar.success,true);assert.equal((await rpc('rpc_conferir_calendario44',args)).status,'confirmed');await sql('RESET ROLE');assert.equal(await cash(),before);
 });
 await scenario('38c cancela obrigação20 pendente sem efeito caixa',async()=>{
  const d=await rpc('rpc_criar_despesa_prospectiva',[1,'Fixture cumulativa','outros','10.01',day,null,randomUUID()]);const before=await cash();await sql('SELECT despesa_cancelamento_v1.configurar(true)');await sql('SET ROLE service_role');const args=[1,randomUUID(),d.despesaId,d.operationId,'Duplicada sintética'];cancel=await rpc('rpc_cancelar_despesa_pendente38c',args);assert.equal((await rpc('rpc_recuperar_cancelamento_despesa38c',args)).status,'confirmed');await sql('RESET ROLE');assert.equal((await sql('SELECT status FROM contas_pagar WHERE id=$1',[d.despesaId]))[0].status,'cancelado');assert.equal(await cash(),before);
 });
 await scenario('45 anota pagamento42 sem alterar linha financeira/saldo/livro',async()=>{
  const tid=Number(pay42.transacaoCaixaId),before=await cash();await sql('SET ROLE service_role');const q=await rpc('rpc_consultar_observacao45',[1,tid]),args=[1,randomUUID(),{transacaoId:tid,estadoHash:q.estadoHash,observacao:'Anotação cumulativa sintética',motivo:'Correção textual'}];note=await rpc('rpc_corrigir_observacao45',args);assert.equal((await rpc('rpc_reconciliar_observacao45',args)).status,'confirmed');assert.equal((await rpc('rpc_consultar_observacao45',[1,tid])).correcoes,1);await sql('RESET ROLE');assert.equal(await cash(),before);
 });
 await scenario('45 anota pernas40/41/43 sem colisão de provas ou mutação monetária',async()=>{
  const rows=await sql("SELECT min(id)::int id,categoria FROM transacoes_caixa WHERE categoria IN('cheque_desconto40','venda_telefone') OR contrato_id=$1 GROUP BY categoria ORDER BY categoria",[successor.contratoId]);assert.equal(rows.length,3);const before=await cash();
  for(const row of rows){const q=await rpc('rpc_consultar_observacao45',[1,row.id]);await rpc('rpc_corrigir_observacao45',[1,randomUUID(),{transacaoId:row.id,estadoHash:q.estadoHash,observacao:'Nota de coexistência '+row.categoria,motivo:'Prova não monetária'}]);}assert.equal(await cash(),before);save('45-annotated40-41-43.json',rows);
 });
 await scenario('histórico contaminado4/5 continua byte-exato; nenhuma capability residual',async()=>{
  assert.deepEqual(await sql('SELECT to_jsonb(t) row FROM transacoes_caixa t WHERE conta_caixa_id IN(4,5) ORDER BY id'),dirtyBefore);
  assert.deepEqual((await sql('SELECT (SELECT count(*)::int FROM ciclo_autorizacoes) c,(SELECT count(*)::int FROM multimodal_autorizacoes) m,(SELECT count(*)::int FROM reparcelamento43_capacidades) r,(SELECT count(*)::int FROM cheques40_capacidades) ch'))[0],{c:0,m:0,r:0,ch:0});
 });
 await scenario('runtime não modifica fontes nem selos; verificadores34/35/36/37/41/44/38c/45 íntegros',async()=>{await verifyAll();assert.deepEqual(await seals(),sealed);assert.deepEqual(await functions(),sources);});
 await scenario('drift de fonte35/ponte40/ACL43 detectado sem reseal',async()=>{
  for(const ddl of ['ALTER FUNCTION public.multimodal_validar(integer,integer) SET search_path=public','ALTER FUNCTION public.ciclo_guardar() SET search_path=public','GRANT EXECUTE ON FUNCTION public.reparcelamento43_validar_recebimento(integer,integer) TO service_role']){
   await sql('BEGIN');await sql(ddl);await sql('SAVEPOINT drift');await reject(()=>rpc('public.caixa37_verificar'),'55000');await sql('ROLLBACK TO SAVEPOINT drift');await sql('ROLLBACK');
  }await verifyAll();assert.deepEqual(await seals(),sealed);
 });
 save('runtime-writes.json',{pay42,phone,cheque,successor,calendar,cancel,note});
}
