import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

it('PG17 multa36: admissão35, recebimento integral/parcial, renovação, ponte, fences e guards', async () => {
 const root=mkdtempSync(`${tmpdir()}/multa-pg17-`),bin='/usr/lib/postgresql/17/bin',port=55446;
 mkdirSync(`${root}/socket`,{mode:0o700});
 const env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:root};
 const run=(cmd:string,args:string[])=>execFileSync(cmd,args,{env,encoding:'utf8'});
 const config={host:`${root}/socket`,port,user:'postgres',database:'postgres'};
 const db=new pg.Client(config);let started=false;const evidence:string[]=[];
 const sql=async(q:string,v:unknown[]=[])=> (await db.query(q,v)).rows;
 const rpc=async(name:string,v:unknown[])=> (await sql(`SELECT public.${name}(${v.map((_,i)=>`$${i+1}`).join(',')}) r`,v))[0].r;
 const target=readFileSync('drizzle/0036_rpc_multa_manual_fixa.sql','utf8');
 const body=target.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
 const financial=async()=> (await sql(`SELECT jsonb_build_object('c',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contratos c),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),'h',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM contrato_historico h),'a',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a)) s`))[0].s;
 const proofs=async()=> (await sql(`SELECT jsonb_build_object('estados',(SELECT jsonb_agg(to_jsonb(e) ORDER BY contrato_id) FROM multimodal_estados e),'operacoes',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM multimodal_operacoes e),'origens',(SELECT jsonb_agg(to_jsonb(e) ORDER BY contrato_id) FROM multimodal_origens e),'pernas',(SELECT jsonb_agg(to_jsonb(e) ORDER BY operacao_id) FROM multimodal_pernas e),'renovacoes',(SELECT jsonb_agg(to_jsonb(e) ORDER BY anterior_id) FROM multimodal_renovacoes e)) s`))[0].s;
 const reject=async(f:()=>Promise<unknown>,code:string)=>{await expect(f()).rejects.toMatchObject({code});};
 const scenario=async(name:string,f:()=>Promise<void>)=>{await f();evidence.push(`PASS ${name}`);};
 const rollback=async(f:()=>Promise<void>)=>{await sql('BEGIN');try{await f();}finally{await sql('ROLLBACK');}};
 const gate=async(name:string,setup:string)=>rollback(async()=>{
  await sql(setup);const before=await financial();await sql('SAVEPOINT gate');
  await reject(()=>db.query(body),'55000');await sql('ROLLBACK TO SAVEPOINT gate');expect(await financial()).toEqual(before);evidence.push(`PASS preflight ${name}`);
 });
 const days=async()=> (await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text today,((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date-1)::text yesterday"))[0];
 const create=async(m='mensal',n=1,first?:string,account=1,principal='100.00',rate='10.00')=>{
  const day=first??(await days()).yesterday;
  const ds=(await sql('SELECT array_agg(public.multimodal_data($1::date,$2,i) ORDER BY i)::text[] d FROM generate_series(0,$3::integer-1) i',[day,m,n]))[0].d;
  return rpc('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,account,m,m==='tabela_price'?'mensal':m==='diario'?'diaria':m,principal,rate,n,day,day,ds,null,null,'2.0000','0.0330']);
 };
 const apply=async(c:any,ids:number[]|null=null,key=randomUUID(),value='7.50')=>{const args=[1,key,c.id,value,ids];return {r:await rpc('rpc_aplicar_multa36',args),args};};
 const quote=async(c:any,pid=c.parcelasIds[0])=>rpc('rpc_cotar_multa36',[1,c.id,pid]);
 const receive=async(c:any,q:any,value=q.totalExigido,mode='integral',key=randomUUID())=>{
  const args=[1,key,c.id,q.parcelaId,value,q.totalExigido,q.dataPagamento,q.estadoHash,mode,null];return {r:await rpc('rpc_receber_multa36',args),args};
 };
 const renew=async(c:any,pid:number,next:string)=>{
  const q=await rpc('rpc_cotar_renovacao_multa36',[1,c.id,pid,next]);expect(q.renovavel).toBe(true);
  const args=[1,randomUUID(),c.id,pid,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,next,null];return {r:await rpc('rpc_renovar_multa36',args),q,args};
 };
 try{
  run(`${bin}/initdb`,['-D',`${root}/data`,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
  run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-l',`${root}/postgres.log`,'-o',`-k ${root}/socket -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
  await db.connect();await sql("SET statement_timeout='30s'; SET TimeZone='UTC'");
  for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql'])await sql(readFileSync(f,'utf8'));
  await sql("INSERT INTO contas_caixa(id,user_id,nome,saldo,ativo) VALUES(6,1,'Caixa limpo ponte0034',1000,true)");
  await sql('ALTER TABLE users ADD COLUMN "passwordHash" text, ADD COLUMN session_version integer NOT NULL DEFAULT 0, ADD CONSTRAINT users_session_version_nonnegative CHECK(session_version>=0)');
  for(const f of ['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal'])await sql(readFileSync(`drizzle/${f}.sql`,'utf8'));
  for(const [name,setup] of [
   ['source guard',"CREATE OR REPLACE FUNCTION ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$BEGIN RETURN NEW;END$$"],
   ['overload','CREATE FUNCTION public.multimodal_calcular(text) RETURNS int LANGUAGE sql AS $$SELECT 1$$'],
   ['ACL helper','GRANT EXECUTE ON FUNCTION multimodal_snapshot(integer) TO service_role'],
   ['RLS capability','ALTER TABLE multimodal_autorizacoes DISABLE ROW LEVEL SECURITY'],
   ['policy','CREATE POLICY drift ON multimodal_autorizacoes USING(true)'],
   ['trigger-off','ALTER TABLE transacoes_caixa DISABLE TRIGGER multimodal_ledger'],
   ['default','ALTER TABLE parcelas ALTER COLUMN multa_manual SET DEFAULT 1'],
  ])await gate(name,setup);
  const old=await financial();await sql(target);expect(await financial()).toEqual(old);evidence.push('PASS instalação sem mutação financeira');
  await gate('one-shot reapply','SELECT 1');
  await scenario('ACL service_role RPC only / tabelas privadas RLS sem policy',async()=>{
   await sql('SET ROLE service_role');expect(await rpc('rpc_capacidades_multa36',[])).toEqual({disponivel:true,regra:'multa36_v1',aplicacao:true,recebimento:true,renovacao:true});await reject(()=>sql('SELECT * FROM multa36_operacoes'),'42501');await reject(()=>rpc('multa36_snapshot',[900]),'42501');await sql('RESET ROLE');
   for(const role of ['anon','authenticated']){await sql(`SET ROLE ${role}`);await reject(()=>rpc('rpc_capacidades_multa36',[]),'42501');await sql('RESET ROLE');}
   const flags=await sql("SELECT relname,relrowsecurity,NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=c.oid) no_policy,NOT has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') private FROM pg_class c WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'multa36_%'");expect(flags.length).toBe(10);for(const v of flags){expect(v.relrowsecurity).toBe(true);expect(v.no_policy).toBe(true);expect(v.private).toBe(true);}
  });
  await scenario('multa substitui percentual, sem caixa, seleção/replay e principal35 imutável',async()=>{
   const c=await create('diario',3);const p=await proofs();const before=(await sql('SELECT count(*)::int n FROM transacoes_caixa'))[0].n;
   const a=await apply(c,[c.parcelasIds[0]]);expect(a.r.quantidade).toBe(1);expect(a.r.valorMultaTotal).toBe('7.50');expect((await sql('SELECT count(*)::int n FROM transacoes_caixa'))[0].n).toBe(before);expect(await proofs()).toEqual(p);
   // Diário3: round(110/3,2)=36.67; round(36.67*0.033/100,2)=0.01.
   const q=await quote(c);expect(q.multa).toBe('7.50');expect(q.mora).toBe('0.01');expect(q.totalExigido).toBe('44.18');expect((await quote(c,c.parcelasIds[1])).multa).toBe('0.00');
   expect((await rpc('rpc_aplicar_multa36',a.args)).repetida).toBe(true);
   await reject(()=>apply(c,[c.parcelasIds[0]],randomUUID()),'23505');
   const b=[...a.args];b[3]='8.00';await reject(()=>rpc('rpc_aplicar_multa36',b),'23505');
   expect((await rpc('rpc_identificar_multa36',[1,c.id,c.parcelasIds[0]])).trilho).toBe('multa36');
  });
  await scenario('cinco modalidades integral/parcial, encargos congelados e audit allocation conservativa',async()=>{
   for(const m of ['mensal','semanal','quinzenal','diario','tabela_price']){
    const c=await create(m);const applied=await apply(c);const q=await quote(c);expect(q.multa).toBe('7.50');expect(q.mora).toBe('0.04');expect(q.totalExigido).toBe('117.54');
    const a=await receive(c,q,'1.00','parcial');expect(a.r.saldoResidual).toBe('116.54');const q2=await quote(c);expect(q2.totalExigido).toBe('116.54');expect(q2.multa).toBe('7.50');
    const b=await receive(c,q2,'8.00','parcial');const q3=await quote(c);const paid=await receive(c,q3);expect(paid.r.contratoStatus).toBe('quitado');expect((await rpc('rpc_receber_multa36',a.args)).repetida).toBe(true);expect((await rpc('rpc_aplicar_multa36',applied.args)).repetida).toBe(true);expect((await quote(c)).elegivel).toBe(false);
    const alloc=(await sql("SELECT sum((p.alocacao->>'principal')::numeric)::text principal,sum((p.alocacao->>'juros')::numeric)::text juros,sum((p.alocacao->>'multa')::numeric)::text multa,sum((p.alocacao->>'mora')::numeric)::text mora FROM multa36_pernas p JOIN multa36_operacoes o ON o.id=p.operacao_id WHERE o.contrato_id=$1",[c.id]))[0];expect(alloc).toEqual({principal:'100.00',juros:'10.00',multa:'7.50',mora:'0.04'});
    expect(b.r.valorPagoAcumulado).toBe('9.00');
   }
  });
  await scenario('cinco modalidades n60: seleção vencida, parcial/integral e principal60 conservado',async()=>{
   for(const m of ['mensal','semanal','quinzenal','diario','tabela_price']){
    const c=await create(m,60,undefined,1,'10000.01','1.13');const initial=await sql('SELECT id,valor::text,valor_original::text,valor_juros::text FROM parcelas WHERE contrato_id=$1 ORDER BY id',[c.id]);expect(initial).toHaveLength(60);
    const predecessor=await proofs();const a=await apply(c);expect(a.r.parcelasIds).toEqual([c.parcelasIds[0]]);expect(a.r.quantidade).toBe(1);
    const q=await quote(c);await receive(c,q,'1.00','parcial');const next=await quote(c);expect(next.multa).toBe('7.50');const full=await receive(c,next);expect(full.r.contratoStatus).toBe('ativo');expect(full.r.saldoResidual).toBe('0.00');
    expect(await sql('SELECT id,valor::text,valor_original::text,valor_juros::text FROM parcelas WHERE contrato_id=$1 ORDER BY id',[c.id])).toEqual(initial);expect(await proofs()).toEqual(predecessor);
    expect((await sql('SELECT (sum(valor_original)-sum(valor_juros))::text principal,count(*) FILTER(WHERE status=\'paga\')::int pagas FROM parcelas WHERE contrato_id=$1',[c.id]))[0]).toEqual({principal:'10000.01',pagas:1});
    const preserved=(await sql('SELECT (valor_original-valor_juros)::text p FROM parcelas WHERE id=$1',[c.parcelasIds[0]]))[0].p;
    expect((await sql("SELECT sum((p.alocacao->>'principal')::numeric)::text p FROM multa36_pernas p JOIN multa36_operacoes o ON o.id=p.operacao_id WHERE o.contrato_id=$1",[c.id]))[0].p).toBe(preserved);
    expect((await rpc('rpc_aplicar_multa36',a.args)).repetida).toBe(true);
   }
  });
  await scenario('civil BRT 02:59:59/03:00 UTC, fuso sessão e parcial congelado em dia futuro',async()=>{
   const c=await create();await apply(c);const day=(await days()).today;
   const before=await rpc('multa36_cotacao',[1,c.id,c.parcelasIds[0],`${day}T02:59:59Z`]);const after=await rpc('multa36_cotacao',[1,c.id,c.parcelasIds[0],`${day}T03:00:00Z`]);
   expect(before.dataPagamento).toBe(c.vencimentos[0]);expect(before.mora).toBe('0.00');expect(before.totalExigido).toBe('117.50');expect(after.dataPagamento).toBe(day);expect(after.mora).toBe('0.04');expect(after.totalExigido).toBe('117.54');
   const q=await quote(c);await sql("SET TimeZone='Pacific/Auckland'");expect(await quote(c)).toEqual(q);await sql("SET TimeZone='UTC'");
   const stale=[1,randomUUID(),c.id,q.parcelaId,q.totalExigido,q.totalExigido,c.vencimentos[0],q.estadoHash,'integral',null];await reject(()=>rpc('rpc_receber_multa36',stale),'40001');
   const paid=await receive(c,q,'1.00','parcial');const next=await quote(c);const future=(await sql("SELECT ($1::date+20)::text||'T12:00:00Z' d",[day]))[0].d;
   const frozen=await rpc('multa36_cotacao',[1,c.id,q.parcelaId,future]);expect(frozen.totalExigido).toBe(paid.r.saldoResidual);expect(frozen.mora).toBe(next.mora);expect(frozen.multa).toBe(next.multa);expect(frozen.estadoHash).toBe(next.estadoHash);await receive(c,next);
  });
  await scenario('renovação paga só juros+multa+mora, sucessora limpa e principal único',async()=>{
   for(const m of ['mensal','semanal','quinzenal','diario']){
    const c=await create(m);await apply(c);const ds=(await sql('SELECT array_agg(multimodal_data($1::date,$2,i) ORDER BY i)::text[] d FROM generate_series(0,3) i',[c.vencimentos[0],m]))[0].d;
    let pid=c.parcelasIds[0];const first=await renew(c,pid,ds[1]);expect(first.q.principalPreservado).toBe('100.00');expect(first.q.totalExigido).toBe('17.54');pid=first.r.novaParcelaId;
    expect((await quote(c,pid)).multa).toBe('0.00');const next=await renew(c,pid,ds[2]);pid=next.r.novaParcelaId;await receive(c,await quote(c,pid));expect((await rpc('rpc_renovar_multa36',first.args)).repetida).toBe(true);
    expect((await rpc('rpc_identificar_multa36',[1,c.id,c.parcelasIds[0]])).status).toBe('renovada');
    expect((await sql('SELECT status FROM contratos WHERE id=$1',[c.id]))[0].status).toBe('quitado');
    expect((await sql("SELECT count(*)::int n,sum(principal)::text p FROM multa36_renovacoes WHERE contrato_id=$1",[c.id]))[0]).toEqual({n:2,p:'200.00'});
    expect((await sql("SELECT sum((p.alocacao->>'principal')::numeric)::text p FROM multa36_pernas p JOIN multa36_operacoes o ON o.id=p.operacao_id WHERE o.contrato_id=$1",[c.id]))[0].p).toBe('100.00');
    const all=await sql('SELECT id,status FROM parcelas WHERE contrato_id=$1 ORDER BY id',[c.id]);const qs=[];for(const p of all)qs.push(await quote(c,p.id));
    expect(qs.map(q=>q.status)).toEqual(['renovada','renovada','paga']);expect(new Set(qs.map(q=>q.estadoHash)).size).toBe(1);expect(new Set(qs.map(q=>q.contaCaixaId)).size).toBe(1);expect(new Set(qs.map(q=>q.dataPagamento)).size).toBe(1);
    for(const q of qs){expect(q.elegivel).toBe(false);expect(q.totalExigido).toBe('0.00');}
    expect(qs[0].multa).toBe('7.50');expect(qs[0].mora).toBe('0.04');expect(qs[0].valorPagoAcumulado).toBe('17.54');
    await reject(()=>rpc('rpc_receber_multa36',[1,randomUUID(),c.id,c.parcelasIds[0],'1.00','1.00',qs[0].dataPagamento,qs[0].estadoHash,'integral',null]),'40001');
    await reject(()=>rpc('rpc_renovar_multa36',[1,randomUUID(),c.id,c.parcelasIds[0],'1.00','1.00',qs[0].dataPagamento,qs[0].estadoHash,ds[3],null]),'40001');
   }
  });
  await scenario('inputs inválidos, hoje/futuro/paga/parcial/Price/sem elegível e legado não admitido',async()=>{
   const c=await create();for(const value of ['0.00','01.00','1','1.001','NaN','-1.00','10000000000.00'])await reject(()=>apply(c,null,randomUUID(),value),'22023');await reject(()=>apply(c,[c.parcelasIds[0],c.parcelasIds[0]]),'22023');await reject(()=>apply(c,[]),'22023');
   const t=await create('mensal',1,(await days()).today);await reject(()=>apply(t),'23514');
   const p=await create('tabela_price');await apply(p);const next=(await sql('SELECT multimodal_data($1::date,\'mensal\',1)::text d',[p.vencimentos[0]]))[0].d;expect((await rpc('rpc_cotar_renovacao_multa36',[1,p.id,p.parcelasIds[0],next])).renovavel).toBe(false);
   await reject(()=>rpc('rpc_aplicar_multa36',[1,randomUUID(),900,'1.00',null]),'42501');
   await rollback(async()=>{await sql('DELETE FROM parcelas WHERE id=901; UPDATE contratos SET conta_caixa_id=1 WHERE id=900; UPDATE parcelas SET conta_caixa_id=1 WHERE id=900');await sql('SAVEPOINT legado');await reject(()=>rpc('rpc_aplicar_multa36',[1,randomUUID(),900,'1.00',null]),'23514');await sql('ROLLBACK TO SAVEPOINT legado');});
   const day=(await days()).today;const old=await rpc('rpc_criar_emprestimo',[1,randomUUID(),1,1,'mensal','mensal','100.00','10.00',1,day,day,[day],null,null]);await reject(()=>rpc('rpc_aplicar_multa36',[1,randomUUID(),old.id,'1.00',null]),'23514');
   await apply(c);const q=await quote(c);await receive(c,q,'1.00','parcial');const nextc=(await sql('SELECT multimodal_data($1::date,\'mensal\',1)::text d',[c.vencimentos[0]]))[0].d;expect((await rpc('rpc_cotar_renovacao_multa36',[1,c.id,c.parcelasIds[0],nextc])).renovavel).toBe(false);
  });
  await scenario('reconciliação/fence global por owner/UUID, replay prova e cotação vencida',async()=>{
   const c=await create();const a=await apply(c);const request={acao:'multa',contratoId:c.id,multa:'7.50',parcelasIds:null};expect((await rpc('rpc_reconciliar_multa36',[1,a.args[1],request])).result).toEqual(a.r);
   const k=randomUUID();expect((await rpc('rpc_reconciliar_multa36',[1,k,request])).status).toBe('not_executed');await reject(()=>apply(c,null,k),'55000');await reject(()=>rpc('rpc_reconciliar_multa36',[1,k,{...request,multa:'1.00'}]),'23505');
   const q=await quote(c);await receive(c,q,'1.00','parcial');await reject(()=>receive(c,q),'40001');await reject(async()=>receive(c,await quote(c),undefined,'integral',a.args[1] as string),'23505');
   await reject(()=>rpc('rpc_cotar_multa36',[2,c.id,c.parcelasIds[0]]),'42501');
  });
  await scenario('ponte outras origens mesma conta: criação35/recebimento35/0021/0031/despesa/0034',async()=>{
   const protectedC=await create();await apply(protectedC);const q0=await quote(protectedC);const previous=await sql('SELECT to_jsonb(e) e FROM multa36_estados e WHERE contrato_id=$1',[protectedC.id]);
   const c=await create();const q=await rpc('rpc_cotar_emprestimo_multimodal',[1,c.id,c.parcelasIds[0]]);await rpc('rpc_receber_emprestimo_multimodal',[1,randomUUID(),c.id,c.parcelasIds[0],q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,'integral',null]);
   // 0034 recusa conta com origem0021/ciclo ou despesa avulsa por sua regra própria.
   // Exercitar a ponte0034 em conta36 limpa dessas origens, não resealar fonte0034.
   await rollback(async()=>{await sql("DELETE FROM parcelas WHERE id=901; UPDATE contratos SET conta_caixa_id=6,num_parcelas=1,numero_parcelas=1,valor_parcela=100 WHERE id=900; UPDATE parcelas SET numero=1,numero_parcela=1,valor=100,valor_original=100,conta_caixa_id=6 WHERE id=900");const lc=await create('mensal',1,undefined,6);await apply(lc);const lq=await rpc('rpc_cotar_recebimento_legado',[1,900,900,6]);expect(lq.elegivel).toBe(true);expect((await rpc('rpc_receber_legado',[1,randomUUID(),900,900,6,lq.totalExigido,lq.totalExigido,lq.dataPagamento,lq.estadoHash,lq.regra,null])).success).toBe(true);});
   const day=(await days()).today;const old=await rpc('rpc_criar_emprestimo',[1,randomUUID(),1,1,'mensal','mensal','100.00','10.00',1,day,day,[day],null,null]);const oq=await rpc('rpc_cotar_emprestimo_prospectivo',[1,old.id,old.parcelasIds[0]]);await rpc('rpc_receber_emprestimo_prospectivo',[1,randomUUID(),old.id,old.parcelasIds[0],oq.totalExigido,oq.totalExigido,oq.dataPagamento,oq.estadoHash,'integral',null]);
   const e=await rpc('rpc_criar_despesa_prospectiva',[1,'Despesa multa36','outros','12.00',day,null,randomUUID()]);expect((await rpc('rpc_pagar_despesa_prospectiva',[1,e.id??e.despesaId,1,day,randomUUID()])).success).toBe(true);
   expect(await sql('SELECT to_jsonb(e) e FROM multa36_estados e WHERE contrato_id=$1',[protectedC.id])).toEqual(previous);expect(await quote(protectedC)).toEqual(q0);expect((await sql('SELECT count(*)::int n FROM multa36_coexistencia'))[0].n).toBe(0);
  });
  await scenario('service_role ciclo financeiro, auditoria histórica imutável e reconciliação receber/renovar',async()=>{
   const c=await create();await sql('SET ROLE service_role');const a=await apply(c);const q=await quote(c);const part=await receive(c,q,'1.00','parcial');await sql('RESET ROLE');
   const prior=await sql('SELECT id,to_jsonb(o) row FROM multa36_operacoes o WHERE contrato_id=$1 ORDER BY id',[c.id]);const legs=await sql('SELECT to_jsonb(p) row FROM multa36_pernas p JOIN multa36_operacoes o ON o.id=p.operacao_id WHERE o.contrato_id=$1',[c.id]);
   await sql('SET ROLE service_role');await receive(c,await quote(c));const pr={acao:'receber',contratoId:c.id,parcelaId:q.parcelaId,valorRecebido:'1.00',totalExigido:q.totalExigido,dataPagamento:q.dataPagamento,estadoHash:q.estadoHash,modo:'parcial',observacoes:null};expect((await rpc('rpc_reconciliar_multa36',[1,part.args[1],pr])).result).toEqual(part.r);await sql('RESET ROLE');
   expect(await sql('SELECT id,to_jsonb(o) row FROM multa36_operacoes o WHERE id=ANY($1::uuid[]) ORDER BY id',[prior.map(v=>v.id)])).toEqual(prior);expect(await sql('SELECT to_jsonb(p) row FROM multa36_pernas p WHERE operacao_id=$1',[part.r.operationId])).toEqual(legs);
   for(const mutation of ['UPDATE multa36_operacoes SET auditoria=\'{}\' WHERE id=$1','UPDATE multa36_origens SET hash_admissao=\'x\' WHERE operacao_id=$1','UPDATE multa36_pernas SET alocacao=\'{}\' WHERE operacao_id=$1'])await reject(()=>sql(mutation,[mutation.includes('origens')?a.r.operationId:part.r.operationId]),'42501');
   const r=await create();await apply(r);const next=(await sql("SELECT multimodal_data($1::date,'mensal',1)::text d",[r.vencimentos[0]]))[0].d;const one=await renew(r,r.parcelasIds[0],next);await receive(r,await quote(r,one.r.novaParcelaId));
   const rr={acao:'renovar',contratoId:r.id,parcelaId:r.parcelasIds[0],valorRecebido:one.q.totalExigido,totalExigido:one.q.totalExigido,dataPagamento:one.q.dataPagamento,estadoHash:one.q.estadoHash,modo:'renovar',novoVencimento:next,observacoes:null};expect((await rpc('rpc_reconciliar_multa36',[1,one.args[1],rr])).result).toEqual(one.r);
   for(const [request,args,name] of [[pr,part.args,'rpc_receber_multa36'],[rr,one.args,'rpc_renovar_multa36']] as const){const key=randomUUID();expect((await rpc('rpc_reconciliar_multa36',[1,key,request])).status).toBe('not_executed');const blocked=[...args];blocked[1]=key;await reject(()=>rpc(name,blocked),'55000');}
  });
  await scenario('cohort ownership e ledger INTEIRO: nulo/crossowner fora do contrato, vínculo e cancelada sem prova',async()=>{
   const c=await create();await apply(c);const pid=c.parcelasIds[0];
   for(const [mutation,code] of [
    [`ALTER TABLE parcelas DISABLE TRIGGER USER;UPDATE parcelas SET user_id=NULL WHERE id=${pid};ALTER TABLE parcelas ENABLE TRIGGER USER`,'42501'],
    [`ALTER TABLE parcelas DISABLE TRIGGER USER;UPDATE parcelas SET cliente_id=2 WHERE id=${pid};ALTER TABLE parcelas ENABLE TRIGGER USER`,'42501'],
    [`ALTER TABLE parcelas DISABLE TRIGGER USER;UPDATE parcelas SET conta_caixa_id=2 WHERE id=${pid};ALTER TABLE parcelas ENABLE TRIGGER USER`,'42501'],
    [`ALTER TABLE parcelas DISABLE TRIGGER USER;UPDATE parcelas SET status='cancelada' WHERE id=${pid};ALTER TABLE parcelas ENABLE TRIGGER USER`,'23514'],
    ["ALTER TABLE transacoes_caixa DISABLE TRIGGER USER;INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,valor,descricao,data_transacao) VALUES(NULL,1,'entrada',1,'ledger null sem cid',current_date);ALTER TABLE transacoes_caixa ENABLE TRIGGER USER",'42501'],
    ["ALTER TABLE transacoes_caixa DISABLE TRIGGER USER;INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,valor,descricao,data_transacao) VALUES(2,1,'entrada',1,'ledger crossowner sem cid',current_date);ALTER TABLE transacoes_caixa ENABLE TRIGGER USER",'42501'],
   ] as const)await rollback(async()=>{await sql(mutation);await sql('SAVEPOINT cohort');await reject(()=>quote(c),code);await sql('ROLLBACK TO SAVEPOINT cohort');});
  });
  await scenario('spoof reject, REST/GUC, provas imutáveis e drift fail-closed',async()=>{
   const c=await create();await apply(c);const pid=c.parcelasIds[0];const before=await financial();await sql("SET ROLE service_role;SET app.finance_authorized='true'");
   for(const query of [`UPDATE parcelas SET multa_manual=1 WHERE id=${pid}`,`DELETE FROM parcelas WHERE id=${pid}`,'UPDATE contas_caixa SET saldo=999 WHERE id=1',"INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,valor,descricao,data_transacao) VALUES(1,1,'entrada',1,'REST',current_date)"])await reject(()=>sql(query),'42501');await sql('RESET ROLE');expect(await financial()).toEqual(before);
   await reject(()=>sql('UPDATE multa36_encargos SET valor=1 WHERE parcela_id=$1',[pid]),'42501');await reject(()=>sql('DELETE FROM multa36_operacoes WHERE contrato_id=$1',[c.id]),'42501');
   await rollback(async()=>{await sql("SELECT ciclo_autorizar('receber',1,$1)",[900]);await sql('SAVEPOINT spoof');await reject(()=>sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor,descricao,data_transacao) VALUES(1,1,900,900,'entrada','pagamento_parcela',100,'Recebimento prospectivo forjado',current_date)"),'42501');await sql('ROLLBACK TO SAVEPOINT spoof');});
   for(const mutation of ['ALTER TABLE multa36_capacidades DISABLE ROW LEVEL SECURITY','GRANT INSERT(guard) ON multa36_capacidades TO service_role','ALTER TABLE transacoes_caixa DISABLE TRIGGER a0_multa36_ponte'])await rollback(async()=>{await sql(mutation);await sql('SAVEPOINT drift');await reject(()=>quote(c),'55000');await sql('ROLLBACK TO SAVEPOINT drift');});
   await rollback(async()=>{await sql('ALTER TABLE parcelas DISABLE TRIGGER USER');await sql('UPDATE parcelas SET valor_original=1 WHERE id=$1',[pid]);await sql('ALTER TABLE parcelas ENABLE TRIGGER USER');await sql('SAVEPOINT drift');await reject(()=>quote(c),'23514');await sql('ROLLBACK TO SAVEPOINT drift');});
  });
  await scenario('concorrência real execução/replay/reconciliação fence',async()=>{
   const a=new pg.Client(config),b=new pg.Client(config);await a.connect();await b.connect();try{
    const c=await create();const key=randomUUID();const args=[1,key,c.id,'7.50',null];const qs='SELECT rpc_aplicar_multa36($1,$2,$3,$4,$5) r';const rs=await Promise.all([a.query(qs,args),b.query(qs,args)]);expect(rs.map(v=>v.rows[0].r.repetida).sort()).toEqual([false,true]);
    const k=randomUUID();await a.query('BEGIN');await a.query('SELECT multa36_barreira(1,$1)',[k]);let done=false;const waiting=b.query('SELECT rpc_reconciliar_multa36(1,$1,$2) r',[k,{acao:'multa',contratoId:c.id,multa:'7.50',parcelasIds:null}]).then(v=>{done=true;return v;});await new Promise(r=>setTimeout(r,80));expect(done).toBe(false);await a.query('COMMIT');expect((await waiting).rows[0].r.status).toBe('not_executed');
   }finally{await a.query('ROLLBACK').catch(()=>{});await a.end();await b.end();}
  });
 }finally{
  await db.end().catch(()=>{});if(started){run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-m','fast','-w','stop']);let status=0;try{run(`${bin}/pg_ctl`,['-D',`${root}/data`,'status']);}catch(e){status=(e as {status:number}).status;}expect(status).toBe(3);evidence.push('STOP_EXIT=0 FINAL_STATUS=3');}
  writeFileSync(`${root}/evidence.log`,evidence.join('\n')+'\n');writeFileSync('tests/postgres-multa/latest-test.log',`${root}/evidence.log\n${evidence.join('\n')}\n`);console.log(`MULTA_PG17_EVIDENCE=${root}/evidence.log\n${evidence.join('\n')}`);
 }
},180000);
