import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

it('PG17 multimodal: instalação fail-closed, cinco fórmulas, ciclo completo, fences, isolamento e coexistência', async () => {
 const root=mkdtempSync(`${tmpdir()}/multimodal-pg17-`),bin='/usr/lib/postgresql/17/bin',port=55445;
 mkdirSync(`${root}/socket`,{mode:0o700});
 const env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:root};
 const run=(cmd:string,args:string[])=>execFileSync(cmd,args,{env,encoding:'utf8'});
 const config={host:`${root}/socket`,port,user:'postgres',database:'postgres'};
 const db=new pg.Client(config);let started=false;const evidence:string[]=[];
 const sql=async(q:string,v:unknown[]=[])=> (await db.query(q,v)).rows;
 const rpc=async(name:string,v:unknown[])=> (await sql(`SELECT public.${name}(${v.map((_,i)=>`$${i+1}`).join(',')}) r`,v))[0].r;
 const target=readFileSync('drizzle/0035_rpc_ciclo_emprestimos_multimodal.sql','utf8');
 const body=target.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
 const catalog=async()=> (await sql(`SELECT jsonb_build_object('p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace),'c',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_class c WHERE relnamespace='public'::regnamespace),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE NOT tgisinternal)) s`))[0].s;
 const financial=async()=> (await sql(`SELECT jsonb_build_object('c',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contratos c),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p),'t',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),'h',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM contrato_historico h),'a',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM contas_caixa a)) s`))[0].s;
 const reject=async(f:()=>Promise<unknown>,code:string)=>{await expect(f()).rejects.toMatchObject({code});};
 const scenario=async(name:string,f:()=>Promise<void>)=>{await f();evidence.push(`PASS ${name}`);};
 const rollback=async(f:()=>Promise<void>)=>{await sql('BEGIN');try{await f();}finally{await sql('ROLLBACK');}};
 const gate=async(name:string,setup:string)=>rollback(async()=>{
  await sql(setup);const before=await catalog(),data=await financial();await sql('SAVEPOINT gate');
  await reject(()=>db.query(body),'55000');await sql('ROLLBACK TO SAVEPOINT gate');expect(await catalog()).toEqual(before);expect(await financial()).toEqual(data);evidence.push(`PASS gate-before-DDL ${name}`);
 });
 const today=async()=> (await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d"))[0].d as string;
 const agenda=async(first:string,n:number,m:string)=> (await sql('SELECT array_agg(public.multimodal_data($1::date,$2,i) ORDER BY i)::text[] d FROM generate_series(0,$3::integer-1) i',[first,m,n]))[0].d as string[];
 const create=async(m='mensal',n=1,principal='100.00',taxa='10.00',dates?:string[],key=randomUUID(),account=1)=>{
  const day=dates?.[0]??await today(); const dates0=dates??await agenda(day,n,m);
  const args=[1,key,1,account,m,m==='tabela_price'?'mensal':m==='diario'?'diaria':m,principal,taxa,n,day,day,dates0,null,null,'2.0000','0.0330'];
  return {r:await rpc('rpc_criar_emprestimo_multimodal',args),args};
 };
 const quote=async(c:any,pid=c.parcelasIds[0])=>rpc('rpc_cotar_emprestimo_multimodal',[1,c.id,pid]);
 const receive=async(c:any,q:any,value=q.totalExigido,mode='integral',key=randomUUID())=>{
  const args=[1,key,c.id,q.parcelaId,value,q.totalExigido,q.dataPagamento,q.estadoHash,mode,null];return {r:await rpc('rpc_receber_emprestimo_multimodal',args),args};
 };
 const renew=async(c:any,pid:number,next:string,key=randomUUID())=>{
  const q=await rpc('rpc_cotar_renovacao_multimodal',[1,c.id,pid,next]);expect(q.renovavel).toBe(true);
  const args=[1,key,c.id,pid,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,next,null];return {r:await rpc('rpc_renovar_emprestimo_multimodal',args),q,args};
 };
 try{
  run(`${bin}/initdb`,['-D',`${root}/data`,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
  run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-l',`${root}/postgres.log`,'-o',`-k ${root}/socket -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
  await db.connect();await sql("SET statement_timeout='30s'; SET TimeZone='UTC'");
  for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql','drizzle/0020_rpc_despesas_prospectivas.sql','drizzle/0021_rpc_emprestimos_prospectivos.sql','drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql','drizzle/0025_integrar_rpc_despesas_ciclo.sql','drizzle/0031_rpc_renovacao_juros_prospectiva.sql','drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql','drizzle/0034_rpc_recebimento_legado_validado.sql'])await sql(readFileSync(f,'utf8'));
  for(const [name,setup] of [
   ['homônimo função outro schema',"CREATE SCHEMA alt; CREATE FUNCTION alt.multimodal_unknown() RETURNS int LANGUAGE sql AS $$SELECT 1$$"],
   ['homônimo tipo','CREATE TYPE multimodal_foo AS ENUM (\'x\')'],
   ['pré-requisito ausente','ALTER TABLE ciclo_autorizacoes RENAME TO missing_cap'],
   ['owner tabela','ALTER TABLE ciclo_autorizacoes OWNER TO service_role'],
   ['owner função','ALTER FUNCTION ciclo_guardar() OWNER TO service_role'],
   ['ACL RPC ausente','REVOKE EXECUTE ON FUNCTION rpc_criar_emprestimo(integer,uuid,integer,integer,text,text,numeric,numeric,integer,date,date,date[],text,text) FROM service_role'],
   ['source guard',"CREATE OR REPLACE FUNCTION ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$BEGIN RETURN NEW;END$$"],
   ['overload',"CREATE FUNCTION public.ciclo_autorizar(text) RETURNS void LANGUAGE sql AS $$SELECT pg_sleep(0)$$"],
   ['ACL helper','GRANT EXECUTE ON FUNCTION ciclo_autorizar(text,integer,integer) TO service_role'],
   ['RLS capability','ALTER TABLE ciclo_autorizacoes DISABLE ROW LEVEL SECURITY'],
   ['ACL coluna','GRANT INSERT(acao) ON ciclo_despesas_autorizacoes TO service_role'],
   ['policy','CREATE POLICY drift ON ciclo_autorizacoes USING(true)'],
   ['ACL capability 0034','GRANT INSERT ON legados_capacidades TO service_role'],
   ['ACL coluna capability 0034','GRANT INSERT(etapa) ON legados_capacidades TO service_role'],
   ['RLS capability 0034','ALTER TABLE legados_capacidades DISABLE ROW LEVEL SECURITY'],
   ['policy capability 0034','CREATE POLICY drift ON legados_capacidades USING(true)'],
   ['trigger-off','ALTER TABLE transacoes_caixa DISABLE TRIGGER ciclo_ledger'],
   ['trigger extra','CREATE TRIGGER drift BEFORE INSERT ON parcelas FOR EACH ROW EXECUTE FUNCTION ciclo_guardar()'],
   ['default drift','ALTER TABLE parcelas ALTER COLUMN valor_desconto SET DEFAULT 1'],
  ])await gate(name,setup);
  const known=JSON.parse(target.match(/expected := \$known35\$([\s\S]*?)\$known35\$/)![1]);
  for(const f of known){const signature=`public.${f.proname}(${f.types})`;const definition=(await sql('SELECT pg_get_functiondef($1::regprocedure) d',[signature]))[0].d as string;
   await gate(`source hash ${signature}`,definition.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace('AS $function$','AS $function$\n-- source drift test\n'));
  }
  const oldCatalog=await catalog(),oldData=await financial();await sql(target);expect(await financial()).toEqual(oldData);
  const installed=await catalog();for(const p of oldCatalog.p)expect(installed.p.find((v:any)=>v.oid===p.oid)).toEqual(p);
  for(const t of oldCatalog.t)expect(installed.t.find((v:any)=>v.oid===t.oid)).toEqual(t);
  evidence.push('PASS instalação sem mutação de dados/RPCs/ACL/triggers legados');
  await gate('one-shot reaplicação','SELECT 1');
  await scenario('capabilities funcionais, helpers/tabelas privados, RLS sem policy e service_role somente EXECUTE',async()=>{
   await sql('SET ROLE service_role');expect(await rpc('rpc_capacidades_emprestimos_multimodal',[])).toEqual({disponivel:true,regra:'multimodal_v1',modalidades:['mensal','semanal','quinzenal','diario','tabela_price'],recebimento:true,renovacao:true});await reject(()=>sql('SELECT * FROM multimodal_origens'),'42501');await reject(()=>rpc('multimodal_nova_linha',['parcelas']),'42501');await sql('RESET ROLE');
   for(const role of ['anon','authenticated']){await sql(`SET ROLE ${role}`);await reject(()=>rpc('rpc_capacidades_emprestimos_multimodal',[]),'42501');await sql('RESET ROLE');}
   const flags=await sql("SELECT c.relname,c.relrowsecurity,NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=c.oid) no_policy,NOT has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') private FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname LIKE 'multimodal_%'");expect(flags.length).toBeGreaterThanOrEqual(9);for(const v of flags){expect(v.relrowsecurity).toBe(true);expect(v.no_policy).toBe(true);expect(v.private).toBe(true);}
  });
  for(const m of ['mensal','semanal','quinzenal','diario','tabela_price'])await scenario(`fórmula ${m}, n1/n60, centavos, taxa0 e fechamento principal`,async()=>{
   for(const [n,p,t] of [[1,'100.00','10.00'],[3,'100.01','2.13'],[60,'10000.01','0.00'],[60,'10000.01','1.13']] as const){
    const {r}=await create(m,n,p,t);const calc=(await rpc('multimodal_calcular',[m,p,t,n]));const rows=await sql('SELECT valor::text,valor_juros::text FROM parcelas WHERE contrato_id=$1 ORDER BY numero',[r.id]);
    expect(rows).toHaveLength(n);expect(r.totalContrato).toBe(Number(calc.total).toFixed(2));expect(r.jurosTotal).toBe(Number(calc.juros).toFixed(2));
    const sums=(await sql('SELECT sum(valor_original)-sum(valor_juros) principal FROM parcelas WHERE contrato_id=$1',[r.id]))[0];expect(sums.principal).toBe(p);
    for(let i=0;i<n;i++){expect(rows[i].valor).toBe(Number(calc.linhas[i].valor).toFixed(2));expect(rows[i].valor_juros).toBe(Number(calc.linhas[i].juros).toFixed(2));}
    if(n===1)expect(r.totalContrato).toBe('110.00');if(t==='0.00')expect(r.totalContrato).toBe(p);
    if(m!=='tabela_price')expect(r.jurosTotal).toBe((await sql('SELECT round($1::numeric*$2::numeric/100*$3::integer,2)::text j',[p,t,m==='diario'?1:n]))[0].j);
   }
  });
  await scenario('Price independente exato conhecido 1000/10%/3 e ultimo principal',async()=>{
   const {r}=await create('tabela_price',3,'1000.00','10.00');const rows=await sql('SELECT valor::text,valor_juros::text FROM parcelas WHERE contrato_id=$1 ORDER BY numero',[r.id]);
   expect(rows).toEqual([{valor:'402.11',valor_juros:'100.00'},{valor:'402.11',valor_juros:'69.79'},{valor:'402.13',valor_juros:'36.56'}]);expect(r.totalContrato).toBe('1206.35');
  });
  await scenario('agenda fim de mês, leap e precisão inválida',async()=>{
   expect(await agenda('2028-01-31',4,'mensal')).toEqual(['2028-01-31','2028-02-29','2028-03-31','2028-04-30']);
   await create('mensal',4,'100.00','1.00',['2028-01-31','2028-02-29','2028-03-31','2028-04-30']);
   await reject(()=>create('mensal',3,'100.00','1.00',['2028-01-31','2028-02-29','2028-03-29']),'22023');
   await reject(()=>create('diario',1,'100.001'),'22023');await reject(()=>create('tabela_price',60,'0.01','0.00'),'22023');
   await reject(()=>create('semanal',1,'100.00','1000.00'),'22023');
   const args=[1,randomUUID(),1,1,'mensal','mensal','100.00','1.00',1,'2028-01-01','2028-01-01',['2028-02-01'],null,null,'2.00001','0.0330'];await reject(()=>rpc('rpc_criar_emprestimo_multimodal',args),'22023');
  });
  await scenario('recebimentos parcial/integral cada modalidade, residual sem novos encargos, replay após mudança',async()=>{
   for(const m of ['mensal','semanal','quinzenal','diario','tabela_price']){
    const {r,args}=await create(m);const q=await quote(r);const partial=await receive(r,q,'10.00','parcial');expect(partial.r.saldoResidual).toBe('100.00');
    const after=await quote(r);expect(after.totalExigido).toBe('100.00');expect(after.multa).toBe(q.multa);const full=await receive(r,after);expect(full.r.contratoStatus).toBe('quitado');
    expect((await rpc('rpc_receber_emprestimo_multimodal',partial.args)).repetida).toBe(true);expect((await rpc('rpc_criar_emprestimo_multimodal',args)).repetida).toBe(true);
    expect((await quote(r)).elegivel).toBe(false);
   }
  });
  await scenario('atraso só na virada BRT; multa uma vez no parcial',async()=>{
   const a=await rpc('ciclo_encargos',[100,2,0.033,'2028-02-29','2028-03-01T02:59:59Z']);const b=await rpc('ciclo_encargos',[100,2,0.033,'2028-02-29','2028-03-01T03:00:00Z']);expect(a).toEqual({dias:0,multa:0,mora:0});expect(b).toEqual({dias:1,multa:2,mora:0.03});
   const yesterday=(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date-1)::text d"))[0].d;const {r}=await create('mensal',1,'100.00','10.00',[yesterday]);const q=await quote(r);expect(q.multa).toBe('2.20');expect(q.mora).toBe('0.04');await receive(r,q,'10.00','parcial');const q2=await quote(r);expect(q2.totalExigido).toBe('102.24');expect(q2.multa).toBe('2.20');
  });
  await scenario('2+ renovações bullet de mensal/semanal/quinzenal/diario sem desembolso nem consumo principal',async()=>{
   for(const m of ['mensal','semanal','quinzenal','diario']){
    const {r}=await create(m);let pid=r.parcelasIds[0];const dates=await agenda(r.vencimentos[0],4,m);const replays:any[]=[];
    for(let i=1;i<=3;i++){const renewed=await renew(r,pid,dates[i]);expect(renewed.q.principalPreservado).toBe('100.00');expect(renewed.q.juros).toBe('10.00');expect(renewed.r.status).toBe('renovada');replays.push(renewed);pid=renewed.r.novaParcelaId;}
    const ledger=await sql('SELECT tipo,valor::text FROM transacoes_caixa WHERE contrato_id=$1 ORDER BY id',[r.id]);expect(ledger).toEqual([{tipo:'saida',valor:'100.00'},...Array(3).fill({tipo:'entrada',valor:'10.00'})]);
    expect((await rpc('rpc_renovar_emprestimo_multimodal',replays[0].args)).repetida).toBe(true);
    const q=await quote(r,pid);const full=await receive(r,q);expect(full.r.contratoStatus).toBe('quitado');
    expect((await rpc('rpc_identificar_emprestimo_multimodal',[1,r.id,r.parcelasIds[0]])).status).toBe('renovada');
   }
  });
  await scenario('renovação recusa Price/multiparcelas/parcial/juros zero e novo vencimento incompatível',async()=>{
   for(const [m,n,t] of [['tabela_price',1,'10.00'],['mensal',2,'10.00'],['diario',1,'0.00']] as const){const {r}=await create(m,n,'100.00',t);const ds=await agenda(r.vencimentos[0],2,m);expect((await rpc('rpc_cotar_renovacao_multimodal',[1,r.id,r.parcelasIds[0],ds[1]])).renovavel).toBe(false);}
   const {r}=await create();const ds=await agenda(r.vencimentos[0],3,'mensal');await reject(()=>rpc('rpc_cotar_renovacao_multimodal',[1,r.id,r.parcelasIds[0],ds[2]]),'22023');await receive(r,await quote(r),'1.00','parcial');expect((await rpc('rpc_cotar_renovacao_multimodal',[1,r.id,r.parcelasIds[0],ds[1]])).renovavel).toBe(false);
  });
  await scenario('payload drift/fence permanente/reconciliação original mesmo após execução subsequente',async()=>{
   const {r,args}=await create();const changed=[...args];changed[7]='101.00';await reject(()=>rpc('rpc_criar_emprestimo_multimodal',changed),'23505');
   const request={clienteId:1,contaCaixaId:1,modalidade:'mensal',tipoTaxa:'mensal',valorPrincipal:'100.00',taxaJuros:'10.00',numeroParcelas:1,dataInicio:args[9],dataDesembolso:args[10],vencimentos:args[11],multaAtraso:'2.0000',jurosMoraDiario:'0.0330'};
   await receive(r,await quote(r));const confirmed=await rpc('rpc_reconciliar_multimodal',[1,'multimodal_criar',args[1],request]);expect(confirmed.status).toBe('confirmed');expect(confirmed.payload).toEqual(request);expect(confirmed.result).toEqual(r);expect(confirmed.fenceId).toBeNull();expect(confirmed.payloadHash).toMatch(/^[a-f0-9]{64}$/);
   const key=randomUUID();const fence=await rpc('rpc_reconciliar_multimodal',[1,'multimodal_criar',key,request]);expect(fence.status).toBe('not_executed');expect(fence.proof).toBe('uuid_fenced_v1');expect(fence.result).toBeNull();const blocked=[...args];blocked[1]=key;await reject(()=>rpc('rpc_criar_emprestimo_multimodal',blocked),'55000');expect((await rpc('rpc_reconciliar_multimodal',[1,'multimodal_criar',key,request])).fenceId).toBe(fence.fenceId);await reject(()=>rpc('rpc_reconciliar_multimodal',[1,'multimodal_criar',key,{...request,valorPrincipal:'101.00'}]),'23505');
  });
  await scenario('REST/GUC guard, vínculos físicos owner null/externo, snapshot e trigger tampering',async()=>{
   const {r}=await create();await sql("SET ROLE service_role; SET app.finance_authorized='true'");
   for(const q of [`UPDATE contratos SET user_id=2 WHERE id=${r.id}`,`UPDATE parcelas SET valor=1 WHERE id=${r.parcelasIds[0]}`,`DELETE FROM parcelas WHERE id=${r.parcelasIds[0]}`,'UPDATE contas_caixa SET saldo=999 WHERE id=1','UPDATE clientes SET user_id=2 WHERE id=1',`INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,valor,descricao,data_transacao) VALUES(1,1,'entrada',1,'REST',current_date)`])await reject(()=>sql(q),'42501');await sql('RESET ROLE');
   for(const mutation of [
    `ALTER TABLE parcelas DISABLE TRIGGER USER; UPDATE parcelas SET user_id=NULL WHERE id=${r.parcelasIds[0]}; ALTER TABLE parcelas ENABLE TRIGGER USER`,
    `ALTER TABLE contratos DISABLE TRIGGER USER; UPDATE contratos SET cliente_id=2 WHERE id=${r.id}; ALTER TABLE contratos ENABLE TRIGGER USER`,
    `ALTER TABLE transacoes_caixa DISABLE TRIGGER USER; INSERT INTO transacoes_caixa(user_id,conta_caixa_id,contrato_id,tipo,valor,descricao,data_transacao) VALUES(NULL,1,${r.id},'entrada',1,'NULL',current_date); ALTER TABLE transacoes_caixa ENABLE TRIGGER USER`,
    `ALTER TABLE contratos DISABLE TRIGGER USER; UPDATE contratos SET user_id=NULL WHERE id=${r.id}; ALTER TABLE contratos ENABLE TRIGGER USER`,
    `ALTER TABLE contas_caixa DISABLE TRIGGER USER; UPDATE contas_caixa SET user_id=2 WHERE id=1; ALTER TABLE contas_caixa ENABLE TRIGGER USER`,
    `ALTER TABLE parcelas DISABLE TRIGGER USER; UPDATE parcelas SET conta_caixa_id=2 WHERE id=${r.parcelasIds[0]}; ALTER TABLE parcelas ENABLE TRIGGER USER`,
    `ALTER TABLE transacoes_caixa DISABLE TRIGGER USER; INSERT INTO transacoes_caixa(user_id,conta_caixa_id,parcela_id,tipo,valor,descricao,data_transacao) VALUES(2,2,${r.parcelasIds[0]},'entrada',1,'foreign physical link',current_date); ALTER TABLE transacoes_caixa ENABLE TRIGGER USER`,
    `UPDATE multimodal_estados SET snapshot=jsonb_set(snapshot,'{contrato,valor_principal}','1') WHERE contrato_id=${r.id}`,
   ])await rollback(async()=>{await sql(mutation);await sql('SAVEPOINT q');await reject(()=>quote(r),'23514');await sql('ROLLBACK TO SAVEPOINT q');});
   await rollback(async()=>{await sql('ALTER TABLE parcelas DISABLE TRIGGER multimodal_parcela');await sql('SAVEPOINT q');await reject(()=>quote(r),'55000');await sql('ROLLBACK TO SAVEPOINT q');});
   await reject(()=>create('mensal',1,'100.00','10.00',undefined,randomUUID(),4),'23514');await reject(()=>create('mensal',1,'100.00','10.00',undefined,randomUUID(),5),'23514');
   await reject(()=>rpc('rpc_identificar_emprestimo_multimodal',[2,r.id,r.parcelasIds[0]]),'42501');
  });
  await scenario('corrupção BEFORE/AFTER INSERT não certificada antes selar snapshot',async()=>{
   for(const corruption of [
    "CREATE FUNCTION corrupt_insert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.valor_principal:=1; RETURN NEW; END$$; CREATE TRIGGER z_corrupt BEFORE INSERT ON contratos FOR EACH ROW EXECUTE FUNCTION corrupt_insert()",
    "CREATE FUNCTION corrupt_insert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.valor_original:=1; RETURN NEW; END$$; CREATE TRIGGER z_corrupt BEFORE INSERT ON parcelas FOR EACH ROW EXECUTE FUNCTION corrupt_insert()",
    "CREATE FUNCTION corrupt_insert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.valor:=1; RETURN NEW; END$$; CREATE TRIGGER z_corrupt BEFORE INSERT ON transacoes_caixa FOR EACH ROW EXECUTE FUNCTION corrupt_insert()",
    "CREATE FUNCTION corrupt_insert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN INSERT INTO public.contrato_historico(user_id,contrato_id,tipo,descricao) VALUES('2',NEW.contrato_id,'extra','AFTER'); RETURN NEW; END$$; CREATE TRIGGER z_corrupt AFTER INSERT ON contrato_historico FOR EACH ROW WHEN(NEW.tipo='criacao') EXECUTE FUNCTION corrupt_insert()",
   ])await rollback(async()=>{await sql(corruption);
    // Owner do teste simula sabotagem pós-instalação e reseal de metadata apenas;
    // invariantes de VALORES/contagem/snapshot da RPC ainda devem recusar a criação.
    await sql('UPDATE multimodal_manifesto SET assinatura=multimodal_metadata()');const before=await financial();await sql('SAVEPOINT corrupt');
    await reject(()=>create(),'23514');await sql('ROLLBACK TO SAVEPOINT corrupt');expect(await financial()).toEqual(before);
   });
  });
  await scenario('mensal clamp de renovação 31/jan -> leap -> 31/mar sem drift',async()=>{
   const {r}=await create('mensal',1,'100.00','10.00',['2028-01-31']);const a=await renew(r,r.parcelasIds[0],'2028-02-29');const b=await renew(r,a.r.novaParcelaId,'2028-03-31');expect(b.r.novoVencimento).toBe('2028-03-31');
   await reject(()=>renew(r,b.r.novaParcelaId,'2028-04-29'),'22023');
  });
  await scenario('0034 nunca pode escrever cohort multimodal mesmo com capacidade privada antiga',async()=>{
   const {r}=await create('mensal',1,'100.00','0.00');const before=await financial();
   await rollback(async()=>{await sql('INSERT INTO legados_capacidades VALUES(txid_current(),pg_backend_pid(),$1,$2,1,\'parcela\')',[r.id,r.parcelasIds[0]]);await sql('SAVEPOINT reject_legacy');await reject(()=>sql("UPDATE parcelas SET status='paga',valor_pago=100 WHERE id=$1",[r.parcelasIds[0]]),'42501');await sql('ROLLBACK TO SAVEPOINT reject_legacy');});expect(await financial()).toEqual(before);
   for(const [cid,pid] of [[r.id,r.parcelasIds[0]],[900,r.parcelasIds[0]],[r.id,900]])await rollback(async()=>{
    await sql('SAVEPOINT reject_ledger');await reject(()=>sql("INSERT INTO legados_capacidades VALUES(txid_current(),pg_backend_pid(),$1,$2,1,'ledger')",[cid,pid]),'42501');await sql('ROLLBACK TO SAVEPOINT reject_ledger');
    expect((await sql('SELECT count(*)::int n FROM multimodal_coexistencia'))[0].n).toBe(0);
   });expect(await financial()).toEqual(before);
  });
  await scenario('0034 recebe fixture próprio 900/900 na mesma conta 1 após criar novo: crédito único, replay e provas multimodais intactas',async()=>{
   const {r}=await create('diario');const before=await financial();
   await rollback(async()=>{
    // Variante sintética local elegível; o fixture inválido original e o cenário
    // mensal/despesa abaixo continuam intactos depois do ROLLBACK.
    await sql("DELETE FROM parcelas WHERE id=901; UPDATE contratos SET conta_caixa_id=1,num_parcelas=1,numero_parcelas=1,valor_parcela=100 WHERE id=900; UPDATE parcelas SET numero=1,numero_parcela=1,valor=100,valor_original=100,conta_caixa_id=1 WHERE id=900");
    const proof=async()=> (await sql(`SELECT jsonb_build_object('snapshots',(SELECT jsonb_agg(multimodal_snapshot(contrato_id) ORDER BY contrato_id) FROM multimodal_origens),'estados',(SELECT jsonb_agg(to_jsonb(e) ORDER BY contrato_id) FROM multimodal_estados e),'operacoes',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM multimodal_operacoes o),'pernas',(SELECT jsonb_agg(to_jsonb(p) ORDER BY operacao_id,transacao_id) FROM multimodal_pernas p),'renovacoes',(SELECT jsonb_agg(to_jsonb(x) ORDER BY anterior_id) FROM multimodal_renovacoes x)) s`))[0].s;
    const newBefore=await proof(),account=(await sql('SELECT to_jsonb(a) a FROM contas_caixa a WHERE id=1'))[0].a;
    const oldMetadata=(await sql('SELECT legados_metadata() m,(SELECT assinatura FROM legados_manifesto WHERE versao=1) assinatura'))[0];expect(oldMetadata.m).toBe(oldMetadata.assinatura);
    await sql('SET ROLE service_role');const q=await rpc('rpc_cotar_recebimento_legado',[1,900,900,1]);expect(q.elegivel).toBe(true);expect(q.totalExigido).toBe('100.00');
    const args=[1,randomUUID(),900,900,1,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,q.regra,null];
    await sql('SELECT pg_sleep(0.02)');const paid=await rpc('rpc_receber_legado',args);expect(paid.success).toBe(true);expect(paid.contratoStatus).toBe('quitado');await sql('RESET ROLE');
    const credits=await sql('SELECT user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor::text,descricao,data_transacao::text,"createdAt"=transaction_timestamp() transaction_default FROM transacoes_caixa WHERE contrato_id=900');
    expect(credits).toEqual([{user_id:1,conta_caixa_id:1,contrato_id:900,parcela_id:900,tipo:'entrada',categoria:'pagamento_parcela',valor:'100.00',descricao:`Recebimento legado ${paid.operationId}`,data_transacao:q.dataPagamento,transaction_default:true}]);
    expect(await proof()).toEqual(newBefore);expect((await sql('SELECT to_jsonb(a) a FROM contas_caixa a WHERE id=1'))[0].a).toEqual(account);await quote(r);
    const after=await financial();await sql('SET ROLE service_role');expect((await rpc('rpc_receber_legado',args)).repetida).toBe(true);await sql('RESET ROLE');expect(await financial()).toEqual(after);expect(await proof()).toEqual(newBefore);
    expect((await sql('SELECT count(*)::int n FROM legados_auditoria WHERE operacao_id=$1',[paid.operationId]))[0].n).toBe(1);
    expect((await sql('SELECT count(*)::int n FROM multimodal_coexistencia'))[0].n).toBe(0);expect((await sql('SELECT count(*)::int n FROM legados_capacidades'))[0].n).toBe(0);
    expect((await sql('SELECT legados_metadata() m,(SELECT assinatura FROM legados_manifesto WHERE versao=1) assinatura'))[0]).toEqual(oldMetadata);
   });expect(await financial()).toEqual(before);
  });
  await scenario('ponte 0034 só aceita operação privada própria única e posterior inteiro: owner/parcela/valor/data/descrição/createdAt',async()=>{
   const prepare=async()=>{
    await sql("DELETE FROM parcelas WHERE id=901; UPDATE contratos SET conta_caixa_id=1,num_parcelas=1,numero_parcelas=1,valor_parcela=100 WHERE id=900; UPDATE parcelas SET numero=1,numero_parcela=1,valor=100,valor_original=100,conta_caixa_id=1,valor_pago=100,saldo_residual=0,status='paga',data_pagamento=current_date WHERE id=900");
    await sql('INSERT INTO legados_estados VALUES(900,1,legados_snapshot(900))');
   };
   const pending=async(uid=1,cid=900,pid=900,aid=1)=>{
    const payload={userId:uid,contratoId:cid,parcelaId:pid,contaCaixaId:aid,valorRecebido:'100.00',totalExigido:'100.00',dataPagamento:await today(),estadoHash:'a'.repeat(64),regra:'recebimento_legado_sem_recalculo_v1',observacoes:null};
    return (await sql("INSERT INTO legados_operacoes(user_id,chave_idempotencia,hash_payload,contrato_id,parcela_id,conta_id,payload) VALUES($1,$2,encode(extensions.digest($3::jsonb::text,'sha256'),'hex'),$4,$5,$6,$3) RETURNING id",[uid,randomUUID(),payload,cid,pid,aid]))[0].id;
   };
   const cap=()=>sql("INSERT INTO legados_capacidades VALUES(txid_current(),pg_backend_pid(),900,900,1,'ledger')");
   const before=await financial();
   for(const mutation of ['sem operação','duas operações','owner operação','hash payload','payload vínculo','owner parcela','owner contrato','owner cliente','owner conta','parcela física cruzada'])await rollback(async()=>{
    await prepare();
    if(mutation!=='sem operação')await pending(mutation==='owner operação'?2:1);
    if(mutation==='duas operações')await pending();
    if(mutation==='hash payload')await sql("ALTER TABLE legados_operacoes DISABLE TRIGGER USER; UPDATE legados_operacoes SET hash_payload=repeat('b',64) WHERE contrato_id=900; ALTER TABLE legados_operacoes ENABLE TRIGGER USER");
    if(mutation==='payload vínculo')await sql("ALTER TABLE legados_operacoes DISABLE TRIGGER USER; UPDATE legados_operacoes SET payload=jsonb_set(payload,'{parcelaId}','901'),hash_payload=encode(extensions.digest(jsonb_set(payload,'{parcelaId}','901')::text,'sha256'),'hex') WHERE contrato_id=900; ALTER TABLE legados_operacoes ENABLE TRIGGER USER");
    const owners:Record<string,string>={'owner parcela':'parcelas','owner contrato':'contratos','owner cliente':'clientes','owner conta':'contas_caixa'};const table=owners[mutation];
    if(table)await sql(`ALTER TABLE ${table} DISABLE TRIGGER USER; UPDATE ${table} SET user_id=2 WHERE id=${table==='clientes'||table==='contas_caixa'?1:900}; ALTER TABLE ${table} ENABLE TRIGGER USER`);
    if(mutation==='parcela física cruzada'){const cid=(await sql('SELECT contrato_id FROM multimodal_origens ORDER BY contrato_id LIMIT 1'))[0].contrato_id;await sql('ALTER TABLE parcelas DISABLE TRIGGER USER');await sql('UPDATE parcelas SET contrato_id=$1 WHERE id=900',[cid]);await sql('ALTER TABLE parcelas ENABLE TRIGGER USER');}
    await sql('SAVEPOINT invalid_bridge');await reject(cap,'42501');await sql('ROLLBACK TO SAVEPOINT invalid_bridge');expect((await sql('SELECT count(*)::int n FROM multimodal_coexistencia'))[0].n).toBe(0);
   });expect(await financial()).toEqual(before);
   await rollback(async()=>{
    await prepare();const id=await pending();await cap();
    expect((await sql('SELECT posterior FROM multimodal_coexistencia'))[0].posterior).not.toHaveProperty('id');
    const insert=(overrides:object={})=>sql('INSERT INTO transacoes_caixa SELECT (jsonb_populate_record(NULL::transacoes_caixa,$1::jsonb)).*',[{id:2000000,user_id:1,conta_caixa_id:1,contrato_id:900,parcela_id:900,tipo:'entrada',categoria:'pagamento_parcela',valor:'100.00',descricao:`Recebimento legado ${id}`,data_transacao:day,createdAt:created,...overrides}]);
    const {day,created}=(await sql('SELECT current_date::text AS "day",transaction_timestamp()::text AS created'))[0];
    const newParcela=(await sql('SELECT p.id FROM parcelas p JOIN multimodal_origens o ON o.contrato_id=p.contrato_id ORDER BY p.id LIMIT 1'))[0].id;
    for(const overrides of [{valor:'99.00'},{user_id:2},{parcela_id:901},{parcela_id:newParcela},{descricao:'forjada'},{data_transacao:'2020-01-01'},{createdAt:'2020-01-01T00:00:00Z'}]){
     await sql('SAVEPOINT mismatch');await reject(()=>insert(overrides),'42501');await sql('ROLLBACK TO SAVEPOINT mismatch');expect((await sql('SELECT count(*)::int n FROM multimodal_coexistencia'))[0].n).toBe(1);expect((await sql('SELECT count(*)::int n FROM legados_capacidades'))[0].n).toBe(1);
    }
    await insert();expect((await sql('SELECT count(*)::int n FROM multimodal_coexistencia'))[0].n).toBe(0);expect((await sql('SELECT count(*)::int n FROM legados_capacidades'))[0].n).toBe(0);
    await sql('SAVEPOINT one_shot');await reject(()=>insert({id:2000001}),'42501');await sql('ROLLBACK TO SAVEPOINT one_shot');
   });expect(await financial()).toEqual(before);
  });
  await scenario('ponte 0034 metadata novo detecta bridge/ACL/colunas e prova final antiga desfaz tampering pós-guard',async()=>{
   for(const mutation of ['ALTER TABLE legados_capacidades DISABLE TRIGGER multimodal_ponte_legados','GRANT INSERT(etapa) ON legados_capacidades TO service_role','ALTER TABLE legados_capacidades ALTER COLUMN conta_id SET DEFAULT 1'])await rollback(async()=>{
    await sql(mutation);await sql('SAVEPOINT metadata');await reject(()=>rpc('rpc_capacidades_emprestimos_multimodal',[]),'55000');await sql('ROLLBACK TO SAVEPOINT metadata');
   });
   await rollback(async()=>{
    await sql("DELETE FROM parcelas WHERE id=901; UPDATE contratos SET conta_caixa_id=1,num_parcelas=1,numero_parcelas=1,valor_parcela=100 WHERE id=900; UPDATE parcelas SET numero=1,numero_parcela=1,valor=100,valor_original=100,conta_caixa_id=1 WHERE id=900");
    await sql("CREATE FUNCTION corrupt_legacy_ledger() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.valor:=99; RETURN NEW; END$$; CREATE TRIGGER z_corrupt_legacy BEFORE INSERT ON transacoes_caixa FOR EACH ROW WHEN(NEW.contrato_id=900) EXECUTE FUNCTION corrupt_legacy_ledger(); UPDATE multimodal_manifesto SET assinatura=multimodal_metadata()");
    const before=await financial(),q=await rpc('rpc_cotar_recebimento_legado',[1,900,900,1]);expect(q.elegivel).toBe(true);await sql('SAVEPOINT final_old_proof');
    await reject(()=>rpc('rpc_receber_legado',[1,randomUUID(),900,900,1,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,q.regra,null]),'23514');await sql('ROLLBACK TO SAVEPOINT final_old_proof');expect(await financial()).toEqual(before);expect((await sql('SELECT count(*)::int n FROM multimodal_coexistencia'))[0].n).toBe(0);
   });
  });
  await scenario('reconciliação receber/renovar, fence de três famílias e tenant inválido',async()=>{
   const {r}=await create();const q=await quote(r);const paid=await receive(r,q,'1.00','parcial');const req={contratoId:r.id,parcelaId:q.parcelaId,valorRecebido:'1.00',totalExigido:q.totalExigido,dataPagamento:q.dataPagamento,estadoHash:q.estadoHash,modo:'parcial'};
   const ev=await rpc('rpc_reconciliar_multimodal',[1,'multimodal_receber',paid.args[1],req]);expect(ev.status).toBe('confirmed');expect(ev.result).toEqual(paid.r);expect(ev.payload).toEqual(req);
   const {r:b}=await create();const ds=await agenda(b.vencimentos[0],3,'mensal');const one=await renew(b,b.parcelasIds[0],ds[1]);await renew(b,one.r.novaParcelaId,ds[2]);
   const rr={contratoId:b.id,parcelaId:b.parcelasIds[0],valorRecebido:one.q.totalExigido,totalExigido:one.q.totalExigido,dataPagamento:one.q.dataPagamento,estadoHash:one.q.estadoHash,novoVencimento:ds[1]};
   const er=await rpc('rpc_reconciliar_multimodal',[1,'multimodal_renovar',one.args[1],rr]);expect(er.status).toBe('confirmed');expect(er.result).toEqual(one.r);
   for(const [family,request,mutation,args] of [['multimodal_receber',req,'rpc_receber_emprestimo_multimodal',paid.args],['multimodal_renovar',rr,'rpc_renovar_emprestimo_multimodal',one.args]] as const){const key=randomUUID();const f=await rpc('rpc_reconciliar_multimodal',[1,family,key,request]);expect(f.status).toBe('not_executed');const blocked=[...args];blocked[1]=key;await reject(()=>rpc(mutation,blocked),'55000');}
   await reject(()=>rpc('rpc_reconciliar_multimodal',[999,'multimodal_receber',randomUUID(),req]),'42501');
   await reject(()=>rpc('rpc_reconciliar_multimodal',[1,'multimodal_receber',randomUUID(),{...req,userId:2}]),'22023');
   await reject(()=>rpc('rpc_cotar_emprestimo_multimodal',[2,b.id,one.r.novaParcelaId]),'42501');
  });
  await scenario('coexistência 0021 mensal/0020 despesa mesma conta, legado imóvel e nenhum estado legado para cohort',async()=>{
   const legacyBefore=(await sql('SELECT to_jsonb(c) c FROM contratos c WHERE id=900'))[0].c;const day=await today();
   const old=await rpc('rpc_criar_emprestimo',[1,randomUUID(),1,1,'mensal','mensal','100.00','10.00',1,day,day,[day],null,null]);
   const oq=await rpc('rpc_cotar_emprestimo_prospectivo',[1,old.id,old.parcelasIds[0]]);const oldPaid=await rpc('rpc_receber_emprestimo_prospectivo',[1,randomUUID(),old.id,old.parcelasIds[0],oq.totalExigido,oq.totalExigido,oq.dataPagamento,oq.estadoHash,'integral',null]);expect(oldPaid.contratoStatus).toBe('quitado');
   const expense=await rpc('rpc_criar_despesa_prospectiva',[1,'Despesa sintética','outros','12.00',day,null,randomUUID()]);const expenseId=expense.id??expense.despesaId;
   const paid=await rpc('rpc_pagar_despesa_prospectiva',[1,expenseId,1,day,randomUUID()]);expect(paid.success).toBe(true);
   expect((await sql('SELECT to_jsonb(c) c FROM contratos c WHERE id=900'))[0].c).toEqual(legacyBefore);
   expect((await rpc('rpc_identificar_emprestimo_multimodal',[1,old.id,old.parcelasIds[0]]))).toBeNull();
   expect((await sql('SELECT count(*)::int n FROM multimodal_origens o JOIN emprestimos_rpc_origens e ON e.contrato_id=o.contrato_id'))[0].n).toBe(0);
   expect((await sql('SELECT count(*)::int n FROM multimodal_origens o JOIN legados_estados e ON e.contrato_id=o.contrato_id'))[0].n).toBe(0);
  });
  await scenario('barreira real concorrente execução/reconciliação e replay concurrente',async()=>{
   const a=new pg.Client(config),b=new pg.Client(config);await a.connect();await b.connect();
   try{const key=randomUUID();await a.query('BEGIN');await a.query('SELECT multimodal_barreira(1,$1,$2,false)',['multimodal_criar',key]);
    const req={clienteId:1,contaCaixaId:1,modalidade:'mensal',tipoTaxa:'mensal',valorPrincipal:'100.00',taxaJuros:'10.00',numeroParcelas:1,dataInicio:await today(),dataDesembolso:await today(),vencimentos:[await today()],multaAtraso:'2.0000',jurosMoraDiario:'0.0330'};
    let done=false;const waiting=b.query('SELECT rpc_reconciliar_multimodal(1,$1,$2,$3) r',['multimodal_criar',key,req]).then(r=>{done=true;return r;});await new Promise(r=>setTimeout(r,80));expect(done).toBe(false);await a.query('COMMIT');expect((await waiting).rows[0].r.status).toBe('not_executed');
    const {r,args}=await create();const q=await quote(r);const recv=[1,randomUUID(),r.id,q.parcelaId,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,'integral',null];
    const query='SELECT rpc_receber_emprestimo_multimodal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r';const rs=await Promise.all([a.query(query,recv),b.query(query,recv)]);expect(rs.map(x=>x.rows[0].r.repetida).sort()).toEqual([false,true]);
   }finally{await a.query('ROLLBACK').catch(()=>{});await a.end();await b.end();}
  });
 }finally{
  await db.end().catch(()=>{});if(started){run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-m','fast','-w','stop']);let status=0;try{run(`${bin}/pg_ctl`,['-D',`${root}/data`,'status']);}catch(e){status=(e as {status:number}).status;}expect(status).toBe(3);evidence.push('STOP_EXIT=0 FINAL_STATUS=3');}
  writeFileSync(`${root}/evidence.log`,evidence.join('\n')+'\n');console.log(`MULTIMODAL_PG17_EVIDENCE=${root}/evidence.log\n${evidence.join('\n')}`);
 }
},180000);
