import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const root=mkdtempSync(`${tmpdir()}/caixa37-pg17-`),bin='/usr/lib/postgresql/17/bin',port=55477;
mkdirSync(`${root}/socket`,{mode:0o700});
const env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:root};
const run=(c,a)=>execFileSync(c,a,{env,encoding:'utf8'});
const read=p=>readFileSync(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const migrations=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa','0036a_multa_metadata_estavel'];
const target=read('drizzle/0037_rpc_aporte_transferencia_caixa.sql'),body=target.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const results=[],synthetic={syntheticOnly:true,source:'PG17 local disposable Caixa37; nenhuma credencial/dado real',cases:[]};let started=false;
export async function certify(){
 try{
  console.log(`LOCAL PG17 socket privado ${root}/socket; nenhuma rede TCP/credencial real`);
  run(`${bin}/initdb`,['-D',`${root}/data`,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
  run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-l',`${root}/postgres.log`,'-o',`-k ${root}/socket -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
  const config={host:`${root}/socket`,port,user:'postgres',database:'postgres'};
  const admin=new pg.Client(config);admin.on('error',()=>{});await admin.connect();
  for(let fresh=1;fresh<=2;fresh++){
   const database=`caixa37_fresh_${fresh}`;await admin.query(`CREATE DATABASE ${database}`);
   const db=new pg.Client({...config,database});await db.connect();
   const sql=async(q,v=[])=> (await db.query(q,v)).rows;
   const rpc=async(n,v=[],client=db)=>(await client.query(`SELECT public.${n}(${v.map((_,i)=>`$${i+1}`).join(',')}) r`,v)).rows[0].r;
   const day=async()=>(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d"))[0].d;
   const financial=async()=> (await sql("SELECT public.caixa37_hash(public.caixa37_snapshot(1)||jsonb_build_object('old',public.caixa37_anteriores(1),'ops',public.caixa37_provas(1),'fences',(SELECT jsonb_agg(to_jsonb(f) ORDER BY chave) FROM public.caixa37_fences f))) h"))[0].h;
   const barefinancial=async()=> (await sql("SELECT encode(extensions.digest(jsonb_build_object('contas',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contas_caixa c),'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transacoes_caixa t),'contratos',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contratos c),'parcelas',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM parcelas p),'historico',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM contrato_historico h))::text,'sha256'),'hex') h"))[0].h;
   const residue=async()=>assert.deepEqual((await sql('SELECT (SELECT count(*)::int FROM caixa37_capacidades) c,(SELECT count(*)::int FROM caixa37_coexistencia) w'))[0],{c:0,w:0});
   const reject=async(fn,code)=>{let caught;try{await fn();}catch(e){caught=e;}assert.ok(caught,`esperava SQLSTATE ${code}`);assert.equal(caught.code,code,`${caught.message} (${caught.detail??''})`);};
   const negative=async(fn,code)=>{const before=await financial();await reject(fn,code);assert.equal(await financial(),before);await residue();};
   const rollback=async(fn)=>{await sql('BEGIN');try{await fn();}finally{await sql('ROLLBACK');}};
   const scenario=async(id,fn)=>{await fn();await residue();const s=`PASS fresh${fresh} ${id}`;results.push(s);console.log(s);};
   const quote=async(a='aporte',o=null,d=7,v='1.00',desc=null,uid=1)=>rpc('rpc_cotar_caixa37',[uid,a,o,d,v,desc]);
   const req=q=>({acao:q.acao,contaOrigemId:q.contaOrigemId,contaDestinoId:q.contaDestinoId,valor:q.valor,descricao:q.descricao,dataTransacao:q.dataTransacao,estadoHash:q.estadoHash});
   const execute=async(q,k=randomUUID(),uid=1,client=db)=> q.acao==='aporte'?rpc('rpc_aportar_caixa37',[uid,k,q.contaDestinoId,q.valor,q.dataTransacao,q.estadoHash,q.descricao],client):rpc('rpc_transferir_caixa37',[uid,k,q.contaOrigemId,q.contaDestinoId,q.valor,q.dataTransacao,q.estadoHash,q.descricao],client);
   const recover=(q,k,uid=1,client=db)=>rpc('rpc_reconciliar_caixa37',[uid,k,req(q)],client);
   const create35=async(account=1)=>{const d=await day();return rpc('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,account,'mensal','mensal','100.00','10.00',1,d,d,[d],null,null,'2.0000','0.0330']);};
   const create21=async(account=1)=>{const d=await day();return rpc('rpc_criar_emprestimo',[1,randomUUID(),1,account,'mensal','mensal','100.00','10.00',1,d,d,[d],null,null]);};
   const receive22=async(c)=>{const q=await rpc('rpc_cotar_emprestimo_prospectivo',[1,c.id,c.parcelasIds[0]]);return rpc('rpc_receber_emprestimo_prospectivo',[1,randomUUID(),c.id,c.parcelasIds[0],q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,'integral',null]);};
   try{
    await sql("SET statement_timeout='60s'; SET TimeZone='UTC'");
    for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql','tests/postgres-caixa37/fixture.sql'])await sql(fresh===2?read(f).replace(/^CREATE ROLE .*;$/gm,''):read(f));
    for(const m of migrations){console.log(`fresh${fresh} instalar ${m}`);await sql(read(`drizzle/${m}.sql`));}
    const baseline=await barefinancial();
    if(fresh===1){writeFileSync('tests/postgres-caixa37/catalog-before.json',JSON.stringify((await sql("SELECT jsonb_build_object('functions',(SELECT jsonb_agg(proname ORDER BY proname) FROM pg_proc WHERE pronamespace='public'::regnamespace),'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'type',t.tgtype,'func',p.proname,'def',pg_get_triggerdef(t.oid)) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal)) c"))[0].c,null,2));}
    // Falhas de preflight têm de reverter todos os objetos37.
    for(const [label,setup] of [
     ['source',"CREATE OR REPLACE FUNCTION multa36_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$BEGIN RETURN NEW;END$$"],
     ['ACL','GRANT EXECUTE ON FUNCTION multa36_snapshot(integer) TO service_role'],
     ['overload','CREATE FUNCTION public.multa36_snapshot(text) RETURNS int LANGUAGE sql AS $$SELECT 1$$'],
     ['RLS','ALTER TABLE multa36_capacidades DISABLE ROW LEVEL SECURITY'],
     ['trigger','ALTER TABLE transacoes_caixa DISABLE TRIGGER a0_multa36_ponte'],
     ['rowtype','ALTER TABLE transacoes_caixa ADD COLUMN drift integer'],
     ['config',"ALTER FUNCTION multa36_guardar() SET search_path=public"],
     ['extra protected helper','CREATE FUNCTION public.multa36_extra() RETURNS integer LANGUAGE sql AS $$SELECT 1$$'],
     ['extra trigger','CREATE TRIGGER drift BEFORE INSERT ON transacoes_caixa FOR EACH ROW EXECUTE FUNCTION multa36_guardar()'],
     ['role','ALTER ROLE authenticated BYPASSRLS'],
     ['schema','CREATE SCHEMA caixa37_fake'],
     ['CHECK','ALTER TABLE transacoes_caixa DROP CONSTRAINT transacoes_caixa_tipo_check'],
     ['FK','ALTER TABLE transacoes_caixa DROP CONSTRAINT transacoes_caixa_user_id_fkey'],
     ['index','DROP INDEX idx_transacoes_caixa_user_id'],
     ['clientes FK','ALTER TABLE clientes DROP CONSTRAINT clientes_user_id_fkey'],
     ['clientes CHECK extra',"ALTER TABLE clientes ADD CONSTRAINT extra_check CHECK(nome<>'')"],
     ['clientes index extra','CREATE INDEX extra_cliente ON clientes(nome)'],
     ['contratos CHECK','ALTER TABLE contratos DROP CONSTRAINT contratos_status_check'],
     ['contratos FK altered','ALTER TABLE contratos DROP CONSTRAINT contratos_cliente_id_fkey; ALTER TABLE contratos ADD CONSTRAINT contratos_cliente_id_fkey FOREIGN KEY(cliente_id) REFERENCES clientes(id) ON DELETE CASCADE'],
     ['contratos index','DROP INDEX idx_contratos_user_id'],
     ['parcelas FK','ALTER TABLE parcelas DROP CONSTRAINT parcelas_contrato_id_fkey'],
     ['parcelas index','DROP INDEX idx_parcelas_user_id'],
     ['koletores FK','ALTER TABLE koletores DROP CONSTRAINT koletores_user_id_fkey'],
     ['historico FK','ALTER TABLE contrato_historico DROP CONSTRAINT contrato_historico_contrato_id_fkey'],
     ['historico index','DROP INDEX idx_contrato_historico_contrato'],
     ['homonym','CREATE TABLE caixa37_estranho(id integer)']]){
      await rollback(async()=>{await sql(setup);const before=await barefinancial();await sql('SAVEPOINT gate');await reject(()=>sql(body),'55000');await sql('ROLLBACK TO SAVEPOINT gate');assert.equal(await barefinancial(),before);});
      results.push(`PASS fresh${fresh} D01 preflight ${label}`);
    }
    await sql(target);assert.equal(await barefinancial(),baseline);results.push(`PASS fresh${fresh} D01 instalação sem dinheiro`);
    await scenario('D01 reapply one-shot',async()=>{const before=await financial();await reject(()=>sql(target),'55000');await sql('ROLLBACK');assert.equal(await financial(),before);});
    await scenario('S01 ACL/RLS somente cinco RPCs',async()=>{
     const rows=await sql("SELECT relname,relrowsecurity,NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=c.oid) no_policy,NOT has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') private FROM pg_class c WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'caixa37_%'");assert.equal(rows.length,7);for(const x of rows)assert.ok(x.relrowsecurity&&x.no_policy&&x.private);
     for(const role of ['anon','authenticated']){await sql(`SET ROLE ${role}`);await reject(()=>rpc('rpc_capacidades_caixa37'),'42501');await sql('RESET ROLE');}
     await sql('SET ROLE service_role');assert.deepEqual(await rpc('rpc_capacidades_caixa37'),{disponivel:true,regra:'caixa37_v1',aporte:true,transferencia:true,recovery:true});await reject(()=>sql('SELECT * FROM caixa37_operacoes'),'42501');await reject(()=>rpc('caixa37_snapshot',[1]),'42501');await sql('RESET ROLE');
    });
    await scenario('F01/F02/F03 aporte centavo/máximo/base negativa; transfer inversa/negativo/base intocada',async()=>{
     const accounts=await sql('SELECT * FROM contas_caixa ORDER BY id');
     for(const [d,v] of [[8,'0.01'],[7,'9999999999.99']]){const q=await quote('aporte',null,d,v);const x=await execute(q);assert.equal(x.pernas.length,1);assert.equal(x.saldoDestinoApos,q.saldoDestinoApos);assert.equal(x.saldoTotalOwnerApos,q.saldoTotalOwnerApos);if(fresh===1)synthetic.cases.push({name:`aporte_${v}`,userId:1,idempotencyKey:x.idempotencyKey,request:req(q),quote:q,result:x,recovery:await recover(q,x.idempotencyKey)});}
     for(const [o,d] of [[8,7],[7,8]]){const q=await quote('transferir',o,d,'100.00');const x=await execute(q);assert.equal(x.pernas.length,2);assert.deepEqual(x.pernas.map(p=>p.papel),['origem','destino']);assert.equal(x.saldoTotalOwnerAntes,x.saldoTotalOwnerApos);if(fresh===1)synthetic.cases.push({name:`transfer_${o}_${d}`,userId:1,idempotencyKey:x.idempotencyKey,request:req(q),quote:q,result:x,recovery:await recover(q,x.idempotencyKey)});}
     assert.deepEqual(await sql('SELECT * FROM contas_caixa ORDER BY id'),accounts);
     await negative(()=>quote('aporte',null,3),'42501');
     assert.ok((await quote()).saldoTotalOwnerAntes.endsWith('.00')||(await quote()).saldoTotalOwnerAntes.endsWith('.99'));
    });
    await scenario('F07/H01 ledger1001; agregado >MAX_SAFE_INTEGER; base física negativa sem limite de operação',async()=>{
     const q=await quote('aporte',null,30,'0.01',null,3);
     assert.equal(q.destino.entradas,'10009999999999989.99');assert.equal(q.destino.saldoEfetivo,'9999999999999990.00');assert.equal(q.saldoTotalOwnerAntes,'10000000000000002.34');
     const r=await execute(q,randomUUID(),3);assert.equal(r.saldoTotalOwnerApos,'10000000000000002.35');assert.equal((await recover(q,r.idempotencyKey,3)).status,'confirmed');
    });
    await scenario('F04 canonicidade monetária/JSON/date/hash/IDs',async()=>{
     for(const v of ['0.00','-1.00','1,00','1e2','1.001','01.00','10000000000.00','NaN'])await negative(()=>quote('aporte',null,7,v),'22023');
     await negative(()=>quote('transferir',7,7),'22023');
     const q=await quote();for(const mutation of [{valor:1},{extra:true},{descricao:''},{descricao:' x '},{contaDestinoId:2147483648},{dataTransacao:'2026-02-30'},{estadoHash:'X'.repeat(64)}])await negative(()=>rpc('rpc_reconciliar_caixa37',[1,randomUUID(),{...req(q),...mutation}]),'22023');
    });
    await scenario('F05/F06 reverseledger/terceira inativa/null owner; ownerB independente',async()=>{
     await negative(()=>quote('aporte',null,2),'42501');
     for(const values of [[2,3],[null,3],[1,2]])await rollback(async()=>{
      await sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,valor,descricao,data_transacao) VALUES($1,$2,'entrada',1,'Contaminação sintética',$3)",[...values,await day()]);
      await sql('SAVEPOINT bad');await reject(()=>quote(),'23514');await sql('ROLLBACK TO SAVEPOINT bad');
      if(values[0]===null)assert.equal((await quote('aporte',null,2,'1.00',null,2)).elegivel,true);
     });
    });
    await scenario('Q01 hash global outra conta inclusive inativa',async()=>{
     const q=await quote();await sql("UPDATE contas_caixa SET nome=nome||' alterada' WHERE id=3");await negative(()=>execute(q),'40001');
    });
    let first;
    await scenario('I01/I02 replay histórico após append legítimo + recovery + UUID entre ações',async()=>{
     const q=await quote('aporte',null,7,'3.45','Texto canônico');const k=randomUUID();const r=await execute(q,k);first={q,k,r};
     await execute(await quote('aporte',null,7,'4.56'));
     assert.deepEqual(await execute(q,k),{...r,repetida:true});assert.deepEqual((await recover(q,k)).result,r);
     await negative(()=>execute({...q,valor:'3.46'},k),'23505');
     await negative(()=>execute({...q,acao:'transferir',contaOrigemId:8},k),'23505');
    });
    await scenario('R03 fence permanente antiga cotação/day, replay e execução tardia',async()=>{
     const q={...await quote(),dataTransacao:'1900-01-01',estadoHash:'a'.repeat(64)};const k=randomUUID();const r=await recover(q,k);assert.equal(r.status,'not_executed');assert.deepEqual(await recover(q,k),r);
     if(fresh===1)synthetic.cases.push({name:'fenced_expired_request',userId:1,idempotencyKey:k,request:req(q),recovery:r});
     await negative(()=>execute(q,k),'55000');await negative(()=>recover({...q,valor:'2.00'},k),'23505');
    });
    await scenario('R04 histórico conta inativa',async()=>{
     await sql('UPDATE contas_caixa SET ativo=false WHERE id=7');assert.deepEqual(await execute(first.q,first.k),{...first.r,repetida:true});assert.equal((await recover(first.q,first.k)).status,'confirmed');await sql('UPDATE contas_caixa SET ativo=true WHERE id=7');
    });
    await scenario('Q02 fusos UTC/BRT/Tóquio cotação mesmo dia',async()=>{
     const q=await quote();for(const z of ['UTC','America/Sao_Paulo','Asia/Tokyo']){await sql(`SET TimeZone='${z}'`);assert.deepEqual(await quote(),q);}await sql("SET TimeZone='UTC'");
    });
    await scenario('S03 audit/pin/perna/fence imutáveis; pending commit bloqueado',async()=>{
     for(const query of ["UPDATE caixa37_operacoes SET request='{}'", "UPDATE caixa37_pernas SET hash_snapshot='bad'","UPDATE caixa37_contas SET saldo_base=0","DELETE FROM caixa37_fences"])await negative(()=>sql(query),'42501');
     await sql('BEGIN');const q=await quote();await sql('INSERT INTO caixa37_operacoes(user_id,chave,acao,request,hash_request,instante) VALUES(1,$1,\'aporte\',$2,public.caixa37_hash($2),clock_timestamp())',[randomUUID(),req(q)]);await reject(()=>sql('COMMIT'),'23514');await residue();
    });
    await scenario('S01/S02 manual/GUC/category rejeitados; UPDATE/DELETE base e ledger',async()=>{
     await sql('SET ROLE service_role');await sql("SET app.caixa37_source='trusted'; SET app.financial_rpc='true'");
     await reject(()=>sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao) VALUES(1,7,'entrada','ajuste_manual',1,'Aporte37 fake',CURRENT_DATE)"),'42501');
     await reject(()=>sql('UPDATE contas_caixa SET saldo=0 WHERE id=7'),'42501');await reject(()=>sql('DELETE FROM transacoes_caixa WHERE conta_caixa_id=7'),'42501');await sql('RESET ROLE');
    });
    await scenario('D02 runtime source/ACL/config/trigger drift failclosed sem reseal',async()=>{
     for(const setup of ['GRANT SELECT ON caixa37_pernas TO service_role','ALTER TABLE transacoes_caixa DISABLE TRIGGER z_caixa37_ledger',"ALTER FUNCTION caixa37_saldo(integer,integer) SET search_path=public"]){await rollback(async()=>{await sql(setup);await sql('SAVEPOINT drift');await reject(()=>quote(),'55000');await sql('ROLLBACK TO SAVEPOINT drift');});}
    });
    await scenario('L01 35/36 antes/depois pin37 proofs imutáveis',async()=>{
     const c=await create35();const old=(await sql('SELECT public.caixa37_anteriores(1) s'))[0].s;
     await execute(await quote('aporte',null,1,'0.01'));assert.deepEqual((await sql('SELECT public.caixa37_anteriores(1) s'))[0].s,old);
     const c2=await create35();const q=await rpc('rpc_cotar_emprestimo_multimodal',[1,c2.id,c2.parcelasIds[0]]);await rpc('rpc_receber_emprestimo_multimodal',[1,randomUUID(),c2.id,c2.parcelasIds[0],q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,'integral',null]);
     // 36 exige vencimento anterior, criação35 antiga fornecida somente por RPC original.
     const yesterday=(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date-1)::text d"))[0].d;
     const c36=await rpc('rpc_criar_emprestimo_multimodal',[1,randomUUID(),1,1,'mensal','mensal','100.00','10.00',1,yesterday,yesterday,[yesterday],null,null,'2.0000','0.0330']);
     await rpc('rpc_aplicar_multa36',[1,randomUUID(),c36.id,'7.50',null]);
     const before=(await sql('SELECT public.caixa37_anteriores(1) s'))[0].s;await execute(await quote('transferir',1,7,'1.00'));assert.deepEqual((await sql('SELECT public.caixa37_anteriores(1) s'))[0].s,before);
     const q36=await rpc('rpc_cotar_multa36',[1,c36.id,c36.parcelasIds[0]]);await rpc('rpc_receber_multa36',[1,randomUUID(),c36.id,c36.parcelasIds[0],q36.totalExigido,q36.totalExigido,q36.dataPagamento,q36.estadoHash,'integral',null]);
     assert.equal((await rpc('rpc_cotar_emprestimo_multimodal',[1,c.id,c.parcelasIds[0]])).elegivel,true);
    });
    await scenario('L02 21/22 e25 pagar/estornar em conta pin37',async()=>{
     const c=await create21();await receive22(c);
     const d=await rpc('rpc_criar_despesa_prospectiva',[1,'Despesa37 coexistência','outros','12.00',await day(),null,randomUUID()]);
     const paid=await rpc('rpc_pagar_despesa_prospectiva',[1,d.despesaId,1,await day(),randomUUID()]);
     await rpc('rpc_estornar_despesa_prospectiva',[1,d.despesaId,paid.operationId,await day(),'Estorno sintético',randomUUID()]);
    });
    await scenario('L03 exceção34 só pernas37 comprovadas em conta própria elegível',async()=>{
     await execute(await quote('aporte',null,6,'0.01'));const q=await rpc('rpc_cotar_recebimento_legado',[1,910,910,6]);assert.equal(q.elegivel,true,JSON.stringify(q));
     const args=[1,randomUUID(),910,910,6,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,q.regra,null];const x=await rpc('rpc_receber_legado',args);assert.equal(x.success,true);assert.equal((await rpc('rpc_receber_legado',args)).repetida,true);
    });
    await scenario('L04 DEDICADO renovação31 pós37 e defaults originais',async()=>{
     const c=await create21();const next=(await sql('SELECT ($1::date+30)::text d',[await day()]))[0].d;
     const q=await rpc('rpc_cotar_renovacao_prospectiva',[1,c.id,c.parcelasIds[0]]);
     const x=await rpc('rpc_renovar_emprestimo_prospectivo',[1,randomUUID(),c.id,c.parcelasIds[0],q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,q.cotacaoHash]);assert.equal(x.success,true);
    });
    await scenario('C01/C02 contenção real account/owner/row; predecessor/cadastro rollback sem deadlock',async()=>{
     const other=new pg.Client({...config,database});await other.connect();
     try{
      for(const lock of ['SELECT pg_advisory_xact_lock(22022,7)','SELECT pg_advisory_xact_lock(34034,1)','SELECT 1 FROM contas_caixa WHERE id=7 FOR NO KEY UPDATE']){
       await other.query('BEGIN');await other.query(lock);const before=await financial();await reject(()=>quote(),'40001');assert.equal(await financial(),before);await other.query('ROLLBACK');
      }
      await sql('BEGIN');await sql('SELECT pg_advisory_xact_lock(22022,1),pg_advisory_xact_lock(34034,1)');
      await reject(()=>other.query("UPDATE contas_caixa SET nome='não persistir' WHERE id=1"),'40001');
      await reject(()=>other.query("INSERT INTO contas_caixa(user_id,nome) VALUES(1,'phantom recusado')"),'40001');await sql('ROLLBACK');
     }finally{await other.end();}
    });
    await scenario('C02 ISOLAMENTO A37/Bwriter35: commit B após snapshot predecessor A semfalse23514',async()=>{
     const before=(await sql('SELECT caixa37_anteriores(1) s'))[0].s,qa=await quote('aporte',null,7,'0.01');
     const other=new pg.Client({...config,database}),locker=new pg.Client({...config,database});await other.connect();await locker.connect();
     try{
      await locker.query('BEGIN');await locker.query('SELECT 1 FROM users WHERE id=1 FOR UPDATE');
      const pid=(await other.query('SELECT pg_backend_pid() pid')).rows[0].pid,key=randomUUID();
      const pending=execute(qa,key,1,other).then(value=>({value}),error=>({error}));
      const until=Date.now()+5000;let observed=false;while(Date.now()<until){const waiting=(await admin.query("SELECT locktype FROM pg_locks WHERE pid=$1 AND NOT granted LIMIT 1",[pid])).rows;if(waiting.length){observed=true;results.push(`OBSERVED fresh${fresh} A37 pending usersFK after snapshot locktype=${waiting[0].locktype} pid=${pid}`);break;}await new Promise(r=>setTimeout(r,10));}assert.ok(observed,'A37 FK lock não observado');
      const d=await day();const b=await rpc('rpc_criar_emprestimo_multimodal',[2,randomUUID(),2,2,'mensal','mensal','10.00','1.00',1,d,d,[d],null,null,'2.0000','0.0330']);assert.equal(b.success,true);
      assert.deepEqual((await sql('SELECT caixa37_anteriores(1) s'))[0].s,before);
      await locker.query('COMMIT');const a=await pending;if(a.error)throw a.error;assert.equal(a.value.success,true);assert.equal((await recover(qa,key)).status,'confirmed');
     }finally{await locker.query('ROLLBACK');await locker.end();await other.end();}
    });
    await scenario('I01/R02 barreira observada exec/replay, execution×recovery, recovery×recovery e fence×lateexec',async()=>{
     const other=new pg.Client({...config,database});await other.connect();
     const waitLock=async(pid)=>{const until=Date.now()+5000;while(Date.now()<until){const rows=(await admin.query("SELECT mode FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted LIMIT 1",[pid])).rows;if(rows.length){results.push(`OBSERVED fresh${fresh} pid=${pid} advisory waiter=${rows[0].mode}`);return;}await new Promise(r=>setTimeout(r,10));}throw Error('Nenhuma espera advisory observada');};
     const pid=(await other.query('SELECT pg_backend_pid() pid')).rows[0].pid;
     try{
      for(const mode of ['replay','confirmed','fence','fence_recovery']){
       const q=await quote();const k=randomUUID();await sql('BEGIN');
       let original;if(mode==='replay'||mode==='confirmed')original=await execute(q,k);else original=await recover(q,k);
       const pending=(mode==='replay'||mode==='fence'?execute(q,k,1,other):recover(q,k,1,other)).then(value=>({value}),error=>({error}));
       await waitLock(pid);await sql('COMMIT');const resolved=await pending;
       if(mode==='fence')assert.equal(resolved.error?.code,'55000');
       else if(mode==='replay')assert.deepEqual(resolved.value,{...original,repetida:true});
       else if(mode==='confirmed')assert.deepEqual(resolved.value.result,original);
       else assert.deepEqual(resolved.value,original);
       await residue();
      }
     }finally{await sql('ROLLBACK');await other.end();}
    });
    await scenario('C01 transferências37 opostas concorrentes; commit exato ou40001 seguro',async()=>{
     const a=await quote('transferir',7,8,'1.00'),b=await quote('transferir',8,7,'1.00');
     const other=new pg.Client({...config,database});await other.connect();try{
      const outcomes=await Promise.all([execute(a).then(r=>({r}),e=>({e})),execute(b,randomUUID(),1,other).then(r=>({r}),e=>({e}))]);
      assert.equal(outcomes.filter(x=>x.r).length,1);assert.equal(outcomes.find(x=>x.e).e.code,'40001');
     }finally{await other.end();}
    });
    await scenario('X01 fault físico segunda perna: sequence integer overflow e PK collision; rollback e mesmoUUID retry',async()=>{
     const last=(await sql('SELECT last_value::text n FROM transacoes_caixa_id_seq'))[0].n;
     try{
      const q=await quote('transferir',7,8,'0.01'),key=randomUUID();await sql("SELECT setval('transacoes_caixa_id_seq',2147483646,true)");
      await negative(()=>execute(q,key),'2200H');await sql("SELECT setval('transacoes_caixa_id_seq',$1,true)",[last]);
      const retry=await execute(q,key);assert.equal(retry.pernas.length,2);assert.equal((await execute(q,key)).repetida,true);
      await rollback(async()=>{
       const n=(await sql('SELECT nextval(\'transacoes_caixa_id_seq\')::int n'))[0].n;
       await sql("INSERT INTO transacoes_caixa(id,user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao) VALUES($1,1,4,'entrada','ajuste_manual',0.01,'PK fault sintético',$2)",[n+2,await day()]);
       const q2=await quote('transferir',7,8,'0.01'),key2=randomUUID(),before=await financial();await sql("SELECT setval('transacoes_caixa_id_seq',$1,true)",[n]);
       await sql('SAVEPOINT money');await reject(()=>execute(q2,key2),'23505');await sql('ROLLBACK TO SAVEPOINT money');assert.equal(await financial(),before);await residue();
       await sql("SELECT setval('transacoes_caixa_id_seq',$1,true)",[n+2]);const r=await execute(q2,key2);assert.equal(r.pernas.length,2);assert.equal((await execute(q2,key2)).repetida,true);
      });
     }finally{await sql("SELECT setval('transacoes_caixa_id_seq',(SELECT max(id) FROM transacoes_caixa),true)");}
    });
    await scenario('D02 instrumentação fonte sem reseal bloqueada; NÃO certifica fault pós-perna',async()=>{
     const {functionsFromSQL}=await import('../../server/migrations/0033.preflight.sources.mjs');const source=functionsFromSQL(target).find(f=>f.proname==='caixa37_mutar');
     const points=[
      ['antes primeira perna',"FOREACH papel37 IN ARRAY papeis LOOP","RAISE EXCEPTION 'fault37' USING ERRCODE='23514'; FOREACH papel37 IN ARRAY papeis LOOP"],
      ['depois primeira perna',"PERFORM public.caixa37_escrever(op.id,papel37,linha);","PERFORM public.caixa37_escrever(op.id,papel37,linha); RAISE EXCEPTION 'fault37' USING ERRCODE='23514';"],
      ['depois todas pernas',"expected:=jsonb_set(expected,'{ledger}'","RAISE EXCEPTION 'fault37' USING ERRCODE='23514'; expected:=jsonb_set(expected,'{ledger}'"],
      ['antes seal',"UPDATE public.caixa37_operacoes SET resultado=result37","RAISE EXCEPTION 'fault37' USING ERRCODE='23514'; UPDATE public.caixa37_operacoes SET resultado=result37"],
      ['depois seal',"PERFORM public.caixa37_validar_op(op.id); RETURN result37;","RAISE EXCEPTION 'fault37' USING ERRCODE='23514'; PERFORM public.caixa37_validar_op(op.id); RETURN result37;"],
      ['valor físico diferente',"public.caixa37_escrever(op.id,papel37,linha)","public.caixa37_escrever(op.id,papel37,linha||jsonb_build_object('valor',(r->>'valor')::numeric+0.01))"]
     ];
     for(const [label,needle,replacement] of points){await rollback(async()=>{
      const q=await quote('transferir',7,8,'1.00'),before=await financial();
      // Instrumentação explícita somente local: gate da função instrumentada é omitido; nenhum manifesto é resealed/adotado.
      const instrumented=source.ddl.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace('PERFORM public.caixa37_verificar();','').replace(needle,replacement);
      assert.notEqual(instrumented,source.ddl);await sql(instrumented);
      // Guards continuam com gate intacto: execução privada não alcança dinheiro com drift instrumentado.
      await sql('SAVEPOINT fault');await reject(()=>rpc('caixa37_mutar',[1,randomUUID(),req(q)]),label==='antes primeira perna'?'23514':'55000');await sql('ROLLBACK TO SAVEPOINT fault');assert.equal(await financial(),before);
      results.push(`PASS fresh${fresh} X01 drift-instrumentation ${label}: failclosed antes money (não prova fault pós-perna)`);
     });}
    });
    await sql('SELECT public.legados_verificar(),public.multimodal_verificar(),public.multa36_verificar(),public.caixa37_verificar()');
    const counts=(await sql('SELECT (SELECT count(*)::int FROM caixa37_operacoes) ops,(SELECT count(*)::int FROM caixa37_pernas) legs,(SELECT count(*)::int FROM caixa37_fences) fences,(SELECT count(*)::int FROM transacoes_caixa) ledger'))[0];
    results.push(`COUNTS fresh${fresh} ${JSON.stringify(counts)} baseline=${baseline} final=${await barefinancial()}`);
   }finally{await db.end();}
  }
  await admin.end();
  console.log('CERTIFICAÇÃO PARCIAL: casos executados no relatório; matriz completa ainda requer validação.');
 }finally{
  if(started)run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-m','immediate','-w','stop']);
  writeFileSync('tests/postgres-caixa37/latest-test.log',results.join('\n')+`\nROOT ${root}\nSQL37_SHA256 ${hash(target)}\n`);
  writeFileSync('tests/postgres-caixa37/synthetic-rpc-envelopes.json',JSON.stringify({...synthetic,sql37Sha256:hash(target)},null,2)+'\n');
 }
 return results;
}
if(process.argv[1]?.endsWith('/runner.mjs'))certify().catch(e=>{console.error('FAIL',e);process.exitCode=1;});
