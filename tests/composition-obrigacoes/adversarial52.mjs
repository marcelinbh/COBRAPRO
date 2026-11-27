import pg from 'pg';
export async function adversarial52({sql,rpc,reject,randomUUID,assert,save,financial,result,config}){
 const cases=[];
 const test=async(name,fn)=>{await fn();cases.push(name);console.log('PASS52ADV '+name);};
 const service=async fn=>{await sql('SET ROLE service_role');try{return await fn();}finally{await sql('RESET ROLE');}};
 const call=(n,v=[])=>service(()=>rpc('public.'+n,v));
 const today=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d LIMIT 1"))[0].d;
 const create=async(modal='semanal',n=3)=>{
  const dates=(await sql("SELECT public.multimodal_data('2027-01-10'::date,$1,i)::text d FROM generate_series(0,$2-1) i ORDER BY i LIMIT 60",[modal,n])).map(r=>r.d);
  return call(modal==='mensal'?'rpc_criar_emprestimo':'rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,modal,modal==='diario'?'diaria':modal,'300.00','10.00',n,today,today,dates,null,null,...(modal==='mensal'?[]:['2','0.033'])]);
 };
 const proposal={acao:'adicionar',valor:'17.35',dataVencimento:'2027-01-31',classificacao:'obrigacao_adicional_nao_desembolsada'};
 const quote=(cid,p=proposal)=>call('rpc_cotar_obrigacoes51',[1,cid,p]);
 const request=q=>({contratoId:q.contratoId,proposta:q.proposta,estadoHash:q.estadoHash,dataCalculo:q.dataCalculo,motivo:'Adversarial52 sintético'});
 const execute=(q,k=randomUUID())=>call('rpc_executar_obrigacoes51',[1,k,request(q)]);
 const state=async()=>({financial:await financial(),private:(await sql("SELECT jsonb_build_object('ops',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM obrigacoes51.operacoes o),'a52',(SELECT jsonb_agg(to_jsonb(a) ORDER BY parcela_id) FROM inclusao52.adicionais a),'a51',(SELECT jsonb_agg(to_jsonb(a) ORDER BY parcela_id) FROM obrigacoes51.adicionais a),'caps',(SELECT jsonb_agg(to_jsonb(c) ORDER BY xid,pid,guard) FROM inclusao52.capacidades c),'ciclo',(SELECT jsonb_agg(to_jsonb(c) ORDER BY contrato_id) FROM ciclo_estados c),'legados',(SELECT jsonb_agg(to_jsonb(l) ORDER BY contrato_id) FROM legados_estados l),'mops',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM multimodal_operacoes m)) s LIMIT 1"))[0].s});
 const abort=async fn=>{const before=await state();await sql('BEGIN');try{await fn();}finally{await sql('ROLLBACK');}assert.deepEqual(await state(),before);};
 await test('ACL52 private tables/functions cannot be used by service_role; GUC is not capability',async()=>{
  const loan=await create('mensal');const before=await state();
  for(const table of ['adicionais','capacidades','manifesto'])await service(()=>reject(()=>sql(`SELECT * FROM inclusao52.${table} LIMIT 1`),'42501'));
  await service(()=>reject(()=>rpc('inclusao52.consumir',['ciclo_guardar','parcelas','INSERT',null,{}]),'42501'));
  await abort(async()=>{await sql("SET LOCAL cobrapro.inclusao52='true'");const s=await rpc('public.ciclo_snapshot',[loan.id]),seed=await rpc('public.multimodal_nova_linha',['parcelas']),stamp=(await sql('SELECT clock_timestamp()::text t LIMIT 1'))[0].t,plan=await rpc('inclusao52.plano',[s,{...proposal,dataVencimento:'2027-04-10'},stamp,seed]),np=plan.parcelas.find(p=>p.id===seed.id);await reject(()=>sql("INSERT INTO parcelas SELECT (jsonb_populate_record(NULL::parcelas,$1)).*",[np]),'42501');});
  assert.deepEqual(await state(),before);
 });
 await test('NUMERIC/date/owner/header exact refusals and zero financial effects',async()=>{
  const loan=await create(),before=await state();
  for(const p of [{...proposal,valor:'0.00'},{...proposal,valor:'0.001'},{...proposal,valor:17.35},{...proposal,valor:'9999999999.99'},{...proposal,dataVencimento:'2027-02-29'},{...proposal,dataVencimento:'2027-02-01'}])await reject(()=>quote(loan.id,p));
  await reject(()=>call('rpc_cotar_obrigacoes51',[2,loan.id,proposal]),'42501');assert.deepEqual(await state(),before);
 });
 // These are real SQL writer stages in a transaction with an exact in-progress51 request,
 // not patched guards, resealed metadata, fake origins, payments or successful confirmations.
 for(const stage of ['parcela','testemunho','header','historico','closure'])await test('rollback52 whole state after real '+stage,async()=>{
  const loan=await create('mensal'),q=await quote(loan.id,{...proposal,dataVencimento:'2027-04-10'}),key=randomUUID();
  await abort(async()=>{
   if(stage==='closure'){await execute(q,key);await reject(()=>sql('SELECT 1/0 fail LIMIT 1'),'22012');return;}
   await rpc('obrigacoes51.travar',[1,loan.id]);const b=await rpc('obrigacoes51.base',[1,loan.id]),opid=randomUUID(),req=request(q);
   await sql('INSERT INTO obrigacoes51.operacoes(id,user_id,chave,contrato_id,request,hash_request,antes) VALUES($1,1,$2,$3,$4,obrigacoes51.hash($4),$5)',[opid,key,loan.id,req,b]);
   const stamp=(await sql('SELECT clock_timestamp()::text t LIMIT 1'))[0].t,seed=await rpc('public.multimodal_nova_linha',['parcelas']),plan=await rpc('inclusao52.plano',[b.financeiro,q.proposta,stamp,seed]),np=plan.parcelas.find(p=>p.id===seed.id);
   await rpc('inclusao52.escrever',[opid,'parcelas',null,np]);
   if(stage!=='parcela')await sql("INSERT INTO inclusao52.adicionais VALUES(1,$1,$2,$3,$4,17.35,$5,obrigacoes51.hash($5),'prospectivo21','inclusao52_v1')",[loan.id,np.id,opid,np.numero,np]);
   if(['header','historico'].includes(stage))await rpc('inclusao52.escrever',[opid,'contratos',b.financeiro.contrato,plan.contrato]);
   if(stage==='historico'){
    const h={...await rpc('public.multimodal_nova_linha',['contrato_historico']),contrato_id:loan.id,user_id:'1',tipo:'inclusao_obrigacao',descricao:'Inclusão52 '+opid+': '+req.motivo,created_at:np.createdAt};await rpc('inclusao52.escrever',[opid,'contrato_historico',null,h]);
   }
   assert.equal((await sql('SELECT count(*)::int n FROM parcelas WHERE id=$1 LIMIT 1',[np.id]))[0].n,1);
   await reject(()=>sql('SELECT 1/0 fail LIMIT 1'),'22012');
  });
 });
 await test('capability52 OLD/NEW/table/event/owner/xid/guard mismatch and residual commit rollback',async()=>{
  const loan=await create('mensal'),q=await quote(loan.id,{...proposal,dataVencimento:'2027-04-10'});
  for(const kind of ['posterior','anterior','tabela','evento','owner','xid','guard','residual'])await abort(async()=>{
   await rpc('obrigacoes51.travar',[1,loan.id]);const b=await rpc('obrigacoes51.base',[1,loan.id]),opid=randomUUID(),req=request(q);
   await sql('INSERT INTO obrigacoes51.operacoes(id,user_id,chave,contrato_id,request,hash_request,antes) VALUES($1,1,$2,$3,$4,obrigacoes51.hash($4),$5)',[opid,randomUUID(),loan.id,req,b]);
   const np=await rpc('public.multimodal_nova_linha',['parcelas']);
   await sql("INSERT INTO inclusao52.capacidades VALUES(txid_current()+$1,pg_backend_pid(),$2,$3,$4,$5,$6,'parcelas','INSERT',NULL,$7)",[kind==='xid'?1:0,kind==='guard'?'legados_guardar':'ciclo_guardar',opid,kind==='owner'?2:1,loan.id,np.id,np]);
   if(kind==='residual'){await reject(()=>sql('SET CONSTRAINTS inclusao52.capability52 IMMEDIATE'),'23514');return;}
   const args=['ciclo_guardar',kind==='tabela'?'transacoes_caixa':'parcelas',kind==='evento'?'UPDATE':'INSERT',kind==='anterior'?{}:null,kind==='posterior'?{...np,status:'paga'}:np];
   if(['xid','guard'].includes(kind))assert.equal(await rpc('inclusao52.consumir',args),false);else await reject(()=>rpc('inclusao52.consumir',args),'42501');
  });
 });
 await test('writer52 detects late BEFORE-trigger non-target tamper and rolls back without removing guards/reseal',async()=>{
  const loan=await create('mensal'),q=await quote(loan.id,{...proposal,dataVencimento:'2027-04-10'});
  await abort(async()=>{
   await rpc('obrigacoes51.travar',[1,loan.id]);const b=await rpc('obrigacoes51.base',[1,loan.id]),opid=randomUUID(),req=request(q);
   await sql('INSERT INTO obrigacoes51.operacoes(id,user_id,chave,contrato_id,request,hash_request,antes) VALUES($1,1,$2,$3,$4,obrigacoes51.hash($4),$5)',[opid,randomUUID(),loan.id,req,b]);
   const seed=await rpc('public.multimodal_nova_linha',['parcelas']),stamp=(await sql('SELECT clock_timestamp()::text t LIMIT 1'))[0].t,plan=await rpc('inclusao52.plano',[b.financeiro,q.proposta,stamp,seed]),np=plan.parcelas.find(p=>p.id===seed.id);
   await sql("CREATE FUNCTION pg_temp.tamper52() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.observacoes:='unexpected non-target field';RETURN NEW;END $$; CREATE TRIGGER zz52_test_tamper BEFORE INSERT ON public.parcelas FOR EACH ROW EXECUTE FUNCTION pg_temp.tamper52()");
   const e=await reject(()=>rpc('inclusao52.escrever',[opid,'parcelas',null,np]),'23514');assert.match(e.message,/readback integral/);
  });
 });
 const client=async()=>{const c=new pg.Client(config);await c.connect();await c.query("SET statement_timeout='35s';SET ROLE service_role");return c;};
 await test('concurrent52 same UUID exactly one A/closure; replay survives current-state change',async()=>{
  const loan=await create(),q=await quote(loan.id),k=randomUUID(),c=await client();try{const [a,b]=await Promise.all([execute(q,k),c.query('SELECT public.rpc_executar_obrigacoes51($1,$2,$3) r',[1,k,request(q)])]);assert.deepEqual(a,b.rows[0].r);assert.equal((await sql('SELECT count(*)::int n FROM obrigacoes51.operacoes WHERE contrato_id=$1 LIMIT 1',[loan.id]))[0].n,1);assert.equal((await sql('SELECT count(*)::int n FROM parcelas WHERE contrato_id=$1 LIMIT 1',[loan.id]))[0].n,4);}finally{await c.end();}
 });
 await test('concurrent52 distinct UUID one winner and stale40001, no deadlock',async()=>{
  const loan=await create(),q=await quote(loan.id),c=await client();try{const r=await Promise.allSettled([execute(q),c.query('SELECT public.rpc_executar_obrigacoes51($1,$2,$3) r',[1,randomUUID(),request(q)])]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.find(x=>x.status==='rejected').reason.code,'40001');assert.equal((await sql('SELECT count(*)::int n FROM parcelas WHERE contrato_id=$1 LIMIT 1',[loan.id]))[0].n,4);}finally{await c.end();}
 });
 await test('concurrent52 inclusion vs real35 receipt/51cancel/44; loser refuses without deadlock',async()=>{
  for(const action of ['receipt','cancel','44']){
   const loan=await create(action==='44'?'mensal':'semanal'),q=await quote(loan.id,action==='44'?{...proposal,dataVencimento:'2027-04-10'}:proposal),c=await client();let other;
   if(action==='receipt'){const qr=await call('rpc_cotar_emprestimo_multimodal',[1,loan.id,loan.parcelasIds[0]]);other=()=>c.query('SELECT public.rpc_receber_emprestimo_multimodal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r',[1,randomUUID(),loan.id,loan.parcelasIds[0],qr.totalExigido,qr.totalExigido,qr.dataPagamento,qr.estadoHash,'integral','Concorrência52']);}
   else if(action==='cancel'){const qc=await quote(loan.id,{acao:'cancelar',alvo:{tipo:'contrato'},reconhecoSemEstorno:true});other=()=>c.query('SELECT public.rpc_executar_obrigacoes51($1,$2,$3) r',[1,randomUUID(),request(qc)]);}
   else{const q44=await call('rpc_cotar_calendario44',[1,loan.id]);other=()=>c.query('SELECT public.rpc_executar_calendario44($1,$2,$3,$4,$5,$6) r',[1,randomUUID(),loan.id,q44.estadoHash,['2027-05-10','2027-06-10','2027-07-10'],'Concorrência52']);}
   try{const r=await Promise.allSettled([execute(q),other()]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.filter(x=>x.status==='rejected').length,1);assert.ok(['40001','23514'].includes(r.find(x=>x.status==='rejected').reason.code));}finally{await c.end();}
  }
 });
 await test('raw48 vs new35 same UUID both orders; no40P01, no foreign operation adoption',async()=>{
  for(const rawFirst of [true,false]){
   const loan=await create(),q=await quote(loan.id),s=await rpc('public.multimodal_snapshot',[loan.id]),hash=await rpc('obrigacoes51.hash',[s]),key=randomUUID(),c=await client();
   try{const raw=()=>c.query('SELECT public.rpc_executar_manutencao48($1,$2,$3,$4,$5,$6) r',[1,key,loan.id,hash,q.proposta,'raw48 conflito52']);const launch=rawFirst?[raw(),execute(q,key)]:[execute(q,key),raw()];const r=await Promise.allSettled(launch);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.ok(['0A000','23505','23514'].includes(r.find(x=>x.status==='rejected').reason.code));assert.equal((await sql('SELECT count(*)::int n FROM multimodal_operacoes WHERE user_id=1 AND family=\'multimodal_manutencao48\' AND chave=$1 LIMIT 1',[key]))[0].n,1);}finally{await c.end();}
  }
 });
 await test('fence52 before POST durable; UUID request divergence does not append',async()=>{
  const loan=await create(),q=await quote(loan.id),key=randomUUID(),req=request(q),before=await state();const f=await call('rpc_conferir_obrigacoes51',[1,key,req]);assert.equal(f.status,'fenced');await reject(()=>execute(q,key),'23514');await reject(()=>call('rpc_conferir_obrigacoes51',[1,key,{...req,motivo:'outro'}]),'23505');assert.deepEqual(await state(),before);
 });
 save('adversarial52.json',{status:'GREEN',cases});result.adversarial52=cases;
}
