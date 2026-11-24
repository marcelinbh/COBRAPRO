import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {runOriginalSuites,preparationSentinels,runL05OriginalCapabilities,runL05IntegratedBridges} from './coexistence-originals.mjs';
const out='docs',bin='/usr/lib/postgresql/17/bin',port=55478;
const hash=s=>createHash('sha256').update(s).digest('hex'),read=p=>readFileSync(p,'utf8');
const source36='0036_rpc_multa_manual_fixa',source36a='0036a_multa_metadata_estavel';
const pin36='7194c1f7038eb9e36358330614249b66575075bef465fcfe3c8aca59a4fed21f';
const pin36a='df1abe0b096b3f993954f16b3c93a1cdfb0ddd36cb968158f39b05150eaeba8f';
const migrations=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal',source36,source36a];
const sources=Object.fromEntries(migrations.map(m=>[m,read(`drizzle/${m}.sql`)]));
const target=read('drizzle/0037_rpc_aporte_transferencia_caixa.sql'),sha=hash(target);
assert.equal(hash(sources[source36]),pin36);
assert.equal(hash(sources[source36a]),pin36a);
const sourceInventory=preparationSentinels({read,sources});
if(process.argv.includes('--sentinels')){assert.equal(migrations.indexOf(source36a),migrations.indexOf(source36)+1);assert.ok(!/autovacuum\s*=\s*o[f]{2}/.test(read(import.meta.filename)));writeFileSync(`${out}/logcoexistence-sentinels.json`,JSON.stringify({status:'PREPARATION_ONLY',sql37Unreleased:sha,...sourceInventory},null,2)+'\n');console.log(`PREP_SENTINELS PASS SQL36=${pin36} SQL36a=${pin36a} SQL37_UNRELEASED=${sha}`);process.exit(0);}
assert.equal(process.env.COEXISTENCE_FINAL_SQL37_SHA,sha,'Aguardar SHA37 final autorizado pelo responsável; não executar candidato automaticamente');
const root=mkdtempSync(`${tmpdir()}/coexistence-caixa37-pg17-`),env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:root};
mkdirSync(`${root}/socket`,{mode:0o700});
const run=(cmd,args)=>execFileSync(cmd,args,{env,encoding:'utf8'});
const results=[],failures=[],originals=[],capabilityMatrices=[],freshStates=[];let started=false,admin,environmentVerified=false;
const record=s=>{results.push(s);console.log(s);};
const baseconfig={host:`${root}/socket`,port,user:'postgres',database:'postgres'};
const safeError=e=>({message:e.message,code:e.code,detail:e.detail,position:e.position,internalPosition:e.internalPosition,internalQuery:e.internalQuery,where:e.where,schema:e.schema,table:e.table,constraint:e.constraint,routine:e.routine,stack:e.stack});
const attempt=p=>p.then(value=>({value}),error=>({error}));
const cents=s=>{const negative=s.startsWith('-');const [a,b]=s.replace(/^-/,'').split('.');return BigInt(a)*100n*(negative?-1n:1n)+BigInt(b)*(negative?-1n:1n);};
export async function certify(){
 try{
  record(`SOURCE SQL37_SHA256=${sha} SQL36_SHA256=${hash(sources[source36])} SQL36a_SHA256=${hash(sources[source36a])} SYNTHETIC_ONLY=true`);
  run(`${bin}/initdb`,['-D',`${root}/data`,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
  run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-l',`${root}/postgres.log`,'-o',`-k ${root}/socket -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700 -c autovacuum=on`,'-w','start']);started=true;
  admin=new pg.Client(baseconfig);await admin.connect();
  assert.equal((await admin.query('SHOW autovacuum')).rows[0].autovacuum,'on');assert.equal((await admin.query('SHOW listen_addresses')).rows[0].listen_addresses,'');
  assert.equal((await admin.query('SHOW unix_socket_permissions')).rows[0].unix_socket_permissions,'0700');environmentVerified=true;record('ENVIRONMENT VERIFIED PG17 AUTOVACUUM=on TCP=off SOCKET_PERMISSIONS=0700');
  for(let fresh=1;fresh<=2;fresh++){
   const database=`coexistence_fresh${fresh}`;await admin.query(`CREATE DATABASE ${database}`);
   const state={fresh,database,created:true,installed:false,dedicatedCompleted:false,originalsCompleted:false};freshStates.push(state);
   const config={...baseconfig,database},db=new pg.Client(config);await db.connect();
   const sql=async(q,v=[],client=db)=>(await client.query(q,v)).rows;
   const rpc=async(n,v=[],client=db)=>{await client.query('SET ROLE service_role');try{return (await sql(`SELECT public.${n}(${v.map((_,i)=>`$${i+1}`).join(',')}) r`,v,client))[0].r;}finally{await client.query('RESET ROLE').catch(()=>{});}};
   const day=async(offset=0)=>(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date+$1::int)::text d",[offset]))[0].d;
   const residues=async()=>{const r=(await sql(`SELECT (SELECT count(*)::int FROM caixa37_capacidades) c,(SELECT count(*)::int FROM caixa37_coexistencia) w,(SELECT count(*)::int FROM multimodal_autorizacoes) a35,(SELECT count(*)::int FROM multimodal_coexistencia) w35,(SELECT count(*)::int FROM multa36_capacidades) a36,(SELECT count(*)::int FROM multa36_coexistencia) w36,(SELECT count(*)::int FROM legados_capacidades) a34,(SELECT count(*)::int FROM ciclo_autorizacoes) a22,(SELECT count(*)::int FROM ciclo_despesas_autorizacoes) a25,(SELECT count(*)::int FROM renovacao_capacidades) a31`))[0];assert.ok(Object.values(r).every(n=>n===0),JSON.stringify(r));};
   const snapshot=async(uid)=>(await sql(`SELECT caixa37_hash(jsonb_build_object('livro',caixa37_snapshot($1),'antigos',caixa37_anteriores($1),'provas',caixa37_provas($1))) h`,[uid]))[0].h;
   const old=async(uid)=>(await sql('SELECT caixa37_anteriores($1) s',[uid]))[0].s;
   const accounts=async(uid)=>sql('SELECT to_jsonb(a) a FROM contas_caixa a WHERE user_id=$1 ORDER BY id',[uid]);
   const quote=(c,a='aporte',o=null,d=c.a,v='1.00',client=db)=>rpc('rpc_cotar_caixa37',[c.u,a,o,d,v,null],client);
   const execute=(c,q,k=randomUUID(),client=db)=>q.acao==='aporte'?rpc('rpc_aportar_caixa37',[c.u,k,q.contaDestinoId,q.valor,q.dataTransacao,q.estadoHash,q.descricao],client):rpc('rpc_transferir_caixa37',[c.u,k,q.contaOrigemId,q.contaDestinoId,q.valor,q.dataTransacao,q.estadoHash,q.descricao],client);
   const reject=async(f,codes)=>{const x=await attempt(f());assert.ok(x.error,'esperava recusa');assert.ok([codes].flat().includes(x.error.code),`${x.error.code} ${x.error.message} ${x.error.detail??''}`);return x.error;};
   const negative=async(c,f,codes)=>{const before=await snapshot(c.u);await reject(f,codes);assert.equal(await snapshot(c.u),before);await residues();};
   const newCase=async(label,{legacy=false,historical=false}={})=>{
    const u=(await sql('SELECT coalesce(max(id),0)+1 id FROM users'))[0].id;await sql('INSERT INTO users(id) VALUES($1)',[u]);
    const cl=(await sql("INSERT INTO clientes(user_id,nome) VALUES($1,$2) RETURNING id",[u,`Sintético ${label}`]))[0].id;
    const a=(await sql("INSERT INTO contas_caixa(user_id,nome,saldo) VALUES($1,$2,1000) RETURNING id",[u,`Conta ${label} A`]))[0].id;
    const b=(await sql("INSERT INTO contas_caixa(user_id,nome,saldo) VALUES($1,$2,100) RETURNING id",[u,`Conta ${label} B`]))[0].id;
    const c={u,cl,a,b,label};
    if(legacy){c.id=(await sql("INSERT INTO contratos(user_id,cliente_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento) VALUES($1,$2,$3,'mensal','mensal',10,10,10,1,1,'2026-01-01','2026-02-01') RETURNING id",[u,cl,a]))[0].id;c.pid=(await sql("INSERT INTO parcelas(user_id,cliente_id,conta_caixa_id,contrato_id,numero,numero_parcela,valor,valor_original,valor_pago,data_vencimento) VALUES($1,$2,$3,$4,1,1,10,10,0,'2026-02-01') RETURNING id",[u,cl,a,c.id]))[0].id;}
    if(historical)await sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao) SELECT $1,$2,'entrada','ajuste_manual',5.00,'Duplicidade aparente sintética','2026-01-01'::date FROM generate_series(1,2)",[u,a]);
    return c;
   };
   const create=async(c,f=35,{account=c.a,date=null,client=db}={})=>{const d=date??await day();return rpc(f===21?'rpc_criar_emprestimo':'rpc_criar_emprestimo_multimodal',[c.u,randomUUID(),c.cl,account,'mensal','mensal','100.00','10.00',1,d,d,[d],null,null,...(f===35?['2.0000','0.0330']:[])],client);};
   const prepareReceive=async(c,f,loan,client=db)=>{
    const q=await rpc(f===22?'rpc_cotar_emprestimo_prospectivo':f===35?'rpc_cotar_emprestimo_multimodal':'rpc_cotar_multa36',[c.u,loan.id,loan.parcelasIds[0]],client);assert.equal(q.elegivel,true,JSON.stringify(q));
    return {name:f===22?'rpc_receber_emprestimo_prospectivo':f===35?'rpc_receber_emprestimo_multimodal':'rpc_receber_multa36',args:[c.u,randomUUID(),loan.id,loan.parcelasIds[0],q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,'integral',null]};
   };
   const receive=async(c,f,loan,client=db)=>{const p=await prepareReceive(c,f,loan,client);return rpc(p.name,p.args,client);};
   const prepareRenew=async(c,f,loan,pid=loan.parcelasIds[0],client=db)=>{
    const next=(await sql("SELECT multimodal_data($1::date,'mensal',1)::text d",[loan.vencimentos?.[0]??await day()]))[0].d;
    const name=f===31?'rpc_cotar_renovacao_prospectiva':f===35?'rpc_cotar_renovacao_multimodal':'rpc_cotar_renovacao_multa36';
    const q=await rpc(name,[c.u,loan.id,pid,...(f===31?[]:[next])],client);assert.equal(q.renovavel??q.elegivel,true,JSON.stringify(q));
    return {name:f===31?'rpc_renovar_emprestimo_prospectivo':f===35?'rpc_renovar_emprestimo_multimodal':'rpc_renovar_multa36',args:[c.u,randomUUID(),loan.id,pid,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,...(f===31?[q.cotacaoHash]:[next,null])],q};
   };
   const renew=async(c,f,loan,pid=loan.parcelasIds[0])=>{const p=await prepareRenew(c,f,loan,pid);return rpc(p.name,p.args);};
   const pin=async c=>{const before=await old(c.u),base=await accounts(c.u);await execute(c,await quote(c,'aporte',null,c.a,'0.01'));await execute(c,await quote(c,'transferir',c.a,c.b,'1.00'));await execute(c,await quote(c,'transferir',c.b,c.a,'1.00'));assert.deepEqual(await old(c.u),before);assert.deepEqual(await accounts(c.u),base);};
   const scenario=async(id,f)=>{try{await f();await residues();record(`PASS fresh${fresh} ${id}`);}catch(e){failures.push({fresh,id,...safeError(e)});record(`FAIL fresh${fresh} ${id}: ${e.code??''} ${e.message}`);await sql('ROLLBACK').catch(()=>{});await sql('RESET ROLE').catch(()=>{});}};
   const newClient=async()=>{const c=new pg.Client(config);c.on('error',()=>{});await c.connect();await c.query("SET statement_timeout='8s'; SET TimeZone='UTC'");return c;};
   const pid=async c=>(await c.query('SELECT pg_backend_pid() p')).rows[0].p;
   const held=async p=>{const r=(await admin.query("SELECT locktype,mode,classid,objid FROM pg_locks WHERE pid=$1 AND granted AND locktype IN('advisory','tuple','transactionid') ORDER BY locktype LIMIT 30",[p])).rows;assert.ok(r.some(x=>x.locktype==='advisory'));return r;};
   const observe=async(p,pending)=>{
    let settled=false;pending.then(()=>{settled=true;});const end=Date.now()+4000;
    while(Date.now()<end){const locks=(await admin.query('SELECT locktype,mode FROM pg_locks WHERE pid=$1 AND NOT granted LIMIT 5',[p])).rows;if(locks.length)return {wait:true,locks};if(settled)return {wait:false,result:await pending};await new Promise(r=>setTimeout(r,8));}throw Error('Sem espera observada nem tryfail em 4s');
   };
   try{
    await sql("SET statement_timeout='60s'; SET TimeZone='UTC'");
    for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql','tests/postgres-caixa37/fixture.sql'])await sql((fresh===2?read(f).replace(/^CREATE ROLE .*;$/gm,''):read(f)));
    // Sequências de clientes/contas corrigidas no fixture sintético antes do selo, não dados/provas financeiras.
    await sql("SELECT setval('clientes_id_seq',(SELECT max(id) FROM clientes),true),setval('contas_caixa_id_seq',(SELECT max(id) FROM contas_caixa),true)");
    for(const m of migrations)await sql(sources[m]);await sql(target);state.installed=true;record(`INSTALLED fresh${fresh} ${sha}`);
    const awaitedDay=await day();const metadata36Before=await sql("SELECT to_jsonb(c) c FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'multa36\\_%' ESCAPE '\\' AND c.relkind IN('r','S') ORDER BY oid");
    await scenario('L01 35/36 criação/recebimento/renovação ANTES pin;37 ambos sentidos;depois novos originais',async()=>{
     for(const f of [35,36]){
      const c=await newCase(`L01-${f}`);let loan=await create(c,35,{date:await day(-1)});if(f===36)await rpc('rpc_aplicar_multa36',[c.u,randomUUID(),loan.id,'7.50',null]);
      const beforeRenew=(await sql('SELECT count(*)::int n FROM transacoes_caixa WHERE contrato_id=$1',[loan.id]))[0].n;
      const renewal=await renew(c,f,loan);assert.equal((await sql('SELECT status FROM parcelas WHERE id=$1',[loan.parcelasIds[0]]))[0].status,'cancelada');
      const legs=await sql('SELECT tipo,valor::text FROM transacoes_caixa WHERE contrato_id=$1 ORDER BY id',[loan.id]);assert.equal(legs.length,beforeRenew+1);assert.equal(legs.at(-1).tipo,'entrada');assert.equal(legs[0].valor,'100.00');
      const cashBeforeCancel=await sql('SELECT id,valor::text,tipo FROM transacoes_caixa WHERE contrato_id=$1 ORDER BY id',[loan.id]);
      await pin(c);assert.deepEqual(await sql('SELECT id,valor::text,tipo FROM transacoes_caixa WHERE contrato_id=$1 ORDER BY id',[loan.id]),cashBeforeCancel);
      await receive(c,f,{...loan,parcelasIds:[renewal.novaParcelaId]});
      const newer=await create(c,35,{date:await day(-1)});if(f===36)await rpc('rpc_aplicar_multa36',[c.u,randomUUID(),newer.id,'7.50',null]);
      const r2=await renew(c,f,newer);await receive(c,f,{...newer,parcelasIds:[r2.novaParcelaId]});
      const rcv=await create(c,35,{date:await day(-1)});if(f===36)await rpc('rpc_aplicar_multa36',[c.u,randomUUID(),rcv.id,'7.50',null]);await receive(c,f,rcv);
      const originalBase=await accounts(c.u);await pin(c);assert.deepEqual(await accounts(c.u),originalBase);
      const inverse=await newCase(`L01-${f}-received-before`),beforeLoan=await create(inverse,35,{date:await day(-1)});if(f===36)await rpc('rpc_aplicar_multa36',[inverse.u,randomUUID(),beforeLoan.id,'7.50',null]);await receive(inverse,f,beforeLoan);await pin(inverse);
     }
    });
    await scenario('L04 31 ANTES e DEPOIS pin37 com principal/base/proofs preservados',async()=>{
     const c=await newCase('L04-31'),loan=await create(c,21);const r=await renew(c,31,loan);assert.ok(r.sucessoraId);await pin(c);
     const another=await create(c,21);const r2=await renew(c,31,another);assert.equal(r2.success,true);await pin(c);
     assert.equal((await sql("SELECT count(*)::int n FROM transacoes_caixa WHERE contrato_id=$1 AND tipo='saida'",[loan.id]))[0].n,1);
    });
    await scenario('L02 despesa25 criada ANTES pin; pagar e estornar DEPOIS;21/22 protegidos',async()=>{
     const c=await newCase('L02-25'),d=await rpc('rpc_criar_despesa_prospectiva',[c.u,'Despesa anterior pin','outros','12.00',await day(),null,randomUUID()]);await pin(c);
     const paid=await rpc('rpc_pagar_despesa_prospectiva',[c.u,d.despesaId,c.a,await day(),randomUUID()]);await rpc('rpc_estornar_despesa_prospectiva',[c.u,d.despesaId,paid.operationId,await day(),'Estorno sintético',randomUUID()]);
     const rows=await sql("SELECT tipo,valor::text FROM transacoes_caixa WHERE conta_caixa_id=$1 AND categoria='despesa_operacional' ORDER BY id",[c.a]);assert.deepEqual(rows,[{tipo:'saida',valor:'12.00'},{tipo:'entrada',valor:'12.00'}]);
     const loan=await create(c,21);await receive(c,22,loan);await pin(c);
    });
    await scenario('L03 transferências37 bidirecionais;recebimento34/replay;avulso antigo continua inelegível',async()=>{
     const c=await newCase('L03-34',{legacy:true});await pin(c);const q=await rpc('rpc_cotar_recebimento_legado',[c.u,c.id,c.pid,c.a]);assert.equal(q.elegivel,true,JSON.stringify(q));
     const args=[c.u,randomUUID(),c.id,c.pid,c.a,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,q.regra,null];const r=await rpc('rpc_receber_legado',args);assert.deepEqual(await rpc('rpc_receber_legado',args),{...r,repetida:true});await pin(c);
     const bad=await newCase('L03-avulso',{legacy:true});await sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao) VALUES($1,$2,'entrada','ajuste_manual',1,'Avulso anterior sem proof','2026-01-01')",[bad.u,bad.a]);await pin(bad);const n=await rpc('rpc_cotar_recebimento_legado',[bad.u,bad.id,bad.pid,bad.a]);assert.equal(n.elegivel,false);assert.ok(n.motivos.includes('LEDGER_DIVERGENTE_OU_AMBIGUO'),JSON.stringify(n));
    });
    await scenario('H01 duplicidade física aparente válida conta uma vez por linha;35/36 canceladas zero dinheiro de cancelar',async()=>{
     const c=await newCase('H01',{historical:true});const q=await quote(c);assert.equal(q.destino.entradas,'10.00');assert.equal(q.destino.saldoEfetivo,'1010.00');const originals=await sql('SELECT to_jsonb(t) t FROM transacoes_caixa t WHERE conta_caixa_id=$1 ORDER BY id',[c.a]);await pin(c);assert.deepEqual((await sql('SELECT to_jsonb(t) t FROM transacoes_caixa t WHERE id=ANY($1::int[]) ORDER BY id',[originals.map(x=>x.t.id)])),originals);
     for(const f of [35,36]){const cc=await newCase(`H01-cancelada${f}`),loan=await create(cc,35,{date:await day(-1)});if(f===36)await rpc('rpc_aplicar_multa36',[cc.u,randomUUID(),loan.id,'7.50',null]);const prepared=await prepareRenew(cc,f,loan);const r=await rpc(prepared.name,prepared.args);
      assert.equal((await sql('SELECT status FROM parcelas WHERE id=$1',[loan.parcelasIds[0]]))[0].status,'cancelada');const rows=await sql('SELECT tipo,valor::text FROM transacoes_caixa WHERE contrato_id=$1 ORDER BY id',[loan.id]);assert.deepEqual(rows,[{tipo:'saida',valor:'100.00'},{tipo:'entrada',valor:prepared.q.totalExigido}]);
      if(f===35)await negative(cc,()=>rpc('rpc_cotar_emprestimo_multimodal',[cc.u,loan.id,loan.parcelasIds[0]]),'23514');else{const quoteCancelled=await rpc('rpc_cotar_multa36',[cc.u,loan.id,loan.parcelasIds[0]]);assert.equal(quoteCancelled.totalExigido,'0.00');assert.equal(quoteCancelled.elegivel,false);}await pin(cc);assert.deepEqual(await sql('SELECT tipo,valor::text FROM transacoes_caixa WHERE contrato_id=$1 ORDER BY id',[loan.id]),rows);assert.ok(r.novaParcelaId);
     }
    });
    await scenario('L05 witness21 inexistente/ambíguo/commitado/hashincorreto sem falsebridge',async()=>{
     for(const mode of ['inexistente','ambíguo','commitado','hashincorreto']){
      const c=await newCase(`L05-${mode}`,{legacy:true});await pin(c);
      const payload={clienteId:c.cl,contaCaixaId:c.a,valorPrincipal:'10.00',dataDesembolso:await day()};
      const insertOp=()=>sql('INSERT INTO emprestimos_rpc_operacoes(user_id,chave_idempotencia,hash_payload,payload) VALUES($1,$2,CASE WHEN $4::bool THEN repeat(\'b\',64) ELSE encode(extensions.digest($3::jsonb::text,\'sha256\'),\'hex\') END,$3)',[c.u,randomUUID(),payload,mode==='hashincorreto']);
      if(mode==='commitado')await insertOp();const before=await snapshot(c.u);await sql('BEGIN');try{
       if(mode!=='inexistente'&&mode!=='commitado')await insertOp();if(mode==='ambíguo')await insertOp();await sql("SELECT ciclo_autorizar('criar',$1,NULL)",[c.a]);await sql('SAVEPOINT bad');await reject(()=>sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,contrato_id,tipo,categoria,valor,descricao,data_transacao) VALUES($1,$2,$3,'saida','emprestimo_liberado',10,'Empréstimo RPC - Contrato #'||$3::int::text,$4)",[c.u,c.a,c.id,awaitedDay]),'42501');await sql('ROLLBACK TO SAVEPOINT bad');
      }finally{await sql('ROLLBACK');}assert.equal(await snapshot(c.u),before);await residues();
     }
    });
    await scenario('L05 witness22 inexistente/ambíguo/commitado/hashincorreto em conta pin37 sem falsebridge',async()=>{
     for(const mode of ['inexistente','ambíguo','commitado','hashincorreto']){
      const c=await newCase(`L05-22-${mode}`),loan=await create(c,21);await pin(c);
      const payload={valorRecebido:'1.00',dataPagamento:awaitedDay};
      const pendingOp=async()=>{return (await sql("INSERT INTO ciclo_operacoes(user_id,chave_idempotencia,hash_payload,contrato_id,parcela_id,payload) VALUES($1,$2,CASE WHEN $6::bool THEN repeat('b',64) ELSE encode(extensions.digest($5::jsonb::text,'sha256'),'hex') END,$3,$4,$5) RETURNING id",[c.u,randomUUID(),loan.id,loan.parcelasIds[0],payload,mode==='hashincorreto']))[0].id;};
      let opid;if(mode==='commitado')opid=await pendingOp();const before=await snapshot(c.u);await sql('BEGIN');try{
       if(mode!=='inexistente'&&mode!=='commitado')opid=await pendingOp();if(mode==='ambíguo')await pendingOp();
       await sql("SELECT ciclo_autorizar('receber',$1,$2)",[c.a,loan.id]);await sql('SAVEPOINT bad22');
       await reject(()=>sql("INSERT INTO transacoes_caixa(user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor,descricao,data_transacao) VALUES($1,$2,$3,$4,'entrada','pagamento_parcela',1,'Recebimento prospectivo '||$5::text,$6)",[c.u,c.a,loan.id,loan.parcelasIds[0],opid??randomUUID(),awaitedDay]),'42501');await sql('ROLLBACK TO SAVEPOINT bad22');
      }finally{await sql('ROLLBACK');}assert.equal(await snapshot(c.u),before);await residues();
     }
    });
    await scenario('L05 oldwriter22/31/34 não recebe cohort35/36 pinado;crosscohort físico protegido',async()=>{
     for(const f of [35,36]){const c=await newCase(`L05-cross${f}`),loan=await create(c,35,{date:await day(-1)});if(f===36)await rpc('rpc_aplicar_multa36',[c.u,randomUUID(),loan.id,'7.50',null]);await pin(c);
      await negative(c,()=>rpc('rpc_receber_emprestimo_prospectivo',[c.u,randomUUID(),loan.id,loan.parcelasIds[0],'100.00','100.00',awaitedDay,'a'.repeat(64),'integral',null]),['42501','23514']);
      const q34=await rpc('rpc_cotar_recebimento_legado',[c.u,loan.id,loan.parcelasIds[0],c.a]);assert.equal(q34.elegivel,false);
      await negative(c,()=>rpc('rpc_renovar_emprestimo_prospectivo',[c.u,randomUUID(),loan.id,loan.parcelasIds[0],'10.00','10.00',awaitedDay,'a'.repeat(64),'a'.repeat(64)]),['42501','23514']);
      await sql('BEGIN');try{await sql('SAVEPOINT cap');await reject(()=>sql("INSERT INTO legados_capacidades VALUES(txid_current(),pg_backend_pid(),$1,$2,$3,'ledger')",[loan.id,loan.parcelasIds[0],c.a]),'42501');await sql('ROLLBACK TO SAVEPOINT cap');}finally{await sql('ROLLBACK');}
     }
    });
    await scenario('L05 capabilities35/36 consumidores originais ACL/xid/pid/sessão/evento/tabela/row; lacunas explícitas',async()=>{
     const c=await newCase('L05-original-capabilities'),loan35=await create(c,35,{date:await day(-1)}),loan36=await create(c,35,{date:await day(-1)});
     await rpc('rpc_aplicar_multa36',[c.u,randomUUID(),loan36.id,'7.50',null]);await pin(c);const before=await snapshot(c.u);
     for(const [family,loan] of [[35,loan35],[36,loan36]])capabilityMatrices.push({...await runL05IntegratedBridges({db,c,loan,family,record,fresh})});
     capabilityMatrices.push({fresh,...await runL05OriginalCapabilities({db,newClient,c,loan35,loan36,sources,record,fresh})});assert.equal(await snapshot(c.u),before);await residues();
    });
    for(const f of [21,22,25,31,34,35,36])await scenario(`C02 corrida REAL37×writer${f} em AMBOS sentidos`,async()=>{
     const c=await newCase(`C02-${f}`,{legacy:f===34});await pin(c);const a=await newClient(),b=await newClient();
     const prepare=async()=>{
      if(f===21||f===35)return {call:client=>create(c,f,{client})};
      if(f===25){const e=await rpc('rpc_criar_despesa_prospectiva',[c.u,'Corrida25','outros','12.00',await day(),null,randomUUID()]);return {call:client=>rpc('rpc_pagar_despesa_prospectiva',[c.u,e.despesaId,c.a,awaitedDay,randomUUID()],client)};}
      if(f===34){const q=await rpc('rpc_cotar_recebimento_legado',[c.u,c.id,c.pid,c.a]);assert.equal(q.elegivel,true);return {call:client=>rpc('rpc_receber_legado',[c.u,randomUUID(),c.id,c.pid,c.a,q.totalExigido,q.totalExigido,q.dataPagamento,q.estadoHash,q.regra,null],client)};}
      const loan=await create(c,f===22||f===31?21:35,{date:f===36?await day(-1):null});if(f===36)await rpc('rpc_aplicar_multa36',[c.u,randomUUID(),loan.id,'7.50',null]);const p=f===31?await prepareRenew(c,31,loan):await prepareReceive(c,f,loan);return {call:client=>rpc(p.name,p.args,client)};
     };
     try{
      const p=await prepare(),q=await quote(c,'transferir',c.a,c.b,'0.01');await a.query('BEGIN');const oldResult=await p.call(a);assert.equal(oldResult.success,true);const oldPid=await pid(a);record(`OBSERVED fresh${fresh} writer${f} HOLDS ${JSON.stringify(await held(oldPid))}`);
      const before=await snapshot(c.u),start=Date.now();const e=await reject(()=>execute(c,q,randomUUID(),b),'40001');assert.ok(Date.now()-start<2000,'tryfail não imediato');assert.equal(await snapshot(c.u),before);record(`TRYFAIL fresh${fresh} 37×writer${f} code=${e.code} elapsedMs=${Date.now()-start}`);await a.query('COMMIT');await execute(c,await quote(c,'transferir',c.a,c.b,'0.01'));
      // Segundo sentido em owner/contrato limpo:34 só suporta uma parcela por caso.
      const cc=f===34?await newCase(`C02-${f}-reverse`,{legacy:true}):c;if(f===34)await pin(cc);
      let pp;if(f===34){const z=await rpc('rpc_cotar_recebimento_legado',[cc.u,cc.id,cc.pid,cc.a]);pp={call:client=>rpc('rpc_receber_legado',[cc.u,randomUUID(),cc.id,cc.pid,cc.a,z.totalExigido,z.totalExigido,z.dataPagamento,z.estadoHash,z.regra,null],client)};}else pp=await prepare();
      const q2=await quote(cc);await a.query('BEGIN');const r37=await execute(cc,q2,randomUUID(),a);assert.equal(r37.success,true);const holds=await held(await pid(a));const bpid=await pid(b);const pending=attempt(pp.call(b));const observed=await observe(bpid,pending);record(`OBSERVED fresh${fresh} writer${f}×37 ${JSON.stringify({wait:observed.wait,locks:observed.locks,code:observed.result?.error?.code,holds})}`);
      if(!observed.wait)assert.equal(observed.result.error?.code,'40001');await a.query('COMMIT');const outcome=await pending;if(outcome.error)assert.ok(['40001'].includes(outcome.error.code),`${outcome.error.code} ${outcome.error.message}`);else assert.equal(outcome.value.success,true);await residues();
     }finally{await a.query('ROLLBACK').catch(()=>{});await b.query('ROLLBACK').catch(()=>{});await a.end();await b.end();}
    });
    await scenario('C02 create/reparent concorrentes e conjunto/owner revalidados sem append parcial',async()=>{
     const c=await newCase('C02-cadastro'),other=await newCase('C02-ownerB'),a=await newClient(),b=await newClient();try{
      const q=await quote(c);await a.query('BEGIN');await execute(c,q,randomUUID(),a);const hold=await held(await pid(a));
      for(const [q0,v] of [["INSERT INTO contas_caixa(user_id,nome) VALUES($1,'phantom')",[c.u]],['UPDATE contas_caixa SET user_id=$1 WHERE id=$2',[other.u,c.b]]]){const start=Date.now();const bpid=await pid(b),pending=attempt(b.query(q0,v)),observed=await observe(bpid,pending);record(`OBSERVED fresh${fresh} cadastro×37 ${JSON.stringify({hold,observed})}`);if(observed.wait){await a.query('COMMIT');const outcome=await pending;assert.equal(outcome.error,undefined);assert.equal((await sql('SELECT user_id FROM contas_caixa WHERE id=$1',[c.b]))[0].user_id,other.u);}else{assert.equal(observed.result.error?.code,'40001');assert.ok(Date.now()-start<2000);}}await a.query('COMMIT');
      await negative(c,()=>sql('UPDATE contas_caixa SET user_id=$1 WHERE id=$2',[other.u,c.a]),'42501');const q2=await quote(c);await sql("INSERT INTO contas_caixa(user_id,nome) VALUES($1,'novo conjunto após cotação')",[c.u]);await negative(c,()=>execute(c,q2),'40001');
      const moved=await newCase('C02-reparent-before');await a.query('BEGIN');await a.query('UPDATE contas_caixa SET user_id=$1 WHERE id=$2',[other.u,moved.b]);const q3=await quote(moved,'aporte',null,moved.a,'1.00',b).then(x=>({x}),e=>({e}));assert.equal(q3.e?.code,'40001');await a.query('COMMIT');assert.equal((await quote(moved)).elegivel,true);await negative(moved,()=>quote(moved,'transferir',moved.a,moved.b),'42501');
     }finally{await a.query('ROLLBACK').catch(()=>{});await a.end();await b.end();}
    });
    await scenario('C01 stress 32 workers37 aporte/transfer opostas;saldo/op/legs exatos zero resíduos',async()=>{
     const c=await newCase('C01-stress');await pin(c);const base=await accounts(c.u),total=cents((await quote(c)).saldoTotalOwnerAntes);const beforeOps=(await sql('SELECT count(*)::int n FROM caixa37_operacoes WHERE user_id=$1',[c.u]))[0].n;let committed=0,aportado=0n,expectedLegs=0;
     for(let batch=0;batch<4;batch++){
      const jobs=[];for(let i=0;i<8;i++){const mode=i%3===0?'aporte':'transferir',o=mode==='aporte'?null:i%2?c.a:c.b,d=mode==='aporte'?c.a:o===c.a?c.b:c.a;const q=await quote(c,mode,o,d,'0.01');jobs.push({q,k:randomUUID()});}
      const clients=await Promise.all(jobs.map(()=>newClient()));try{const outcomes=await Promise.all(jobs.map((j,i)=>attempt(execute(c,j.q,j.k,clients[i]))));
       for(let i=0;i<outcomes.length;i++){const x=outcomes[i];if(x.error){assert.equal(x.error.code,'40001');}else{committed++;expectedLegs+=jobs[i].q.acao==='aporte'?1:2;if(jobs[i].q.acao==='aporte')aportado+=1n;assert.equal(x.value.pernas.length,jobs[i].q.acao==='aporte'?1:2);}}
      }finally{await Promise.all(clients.map(x=>x.end()));}await residues();
     }
     assert.ok(committed>=4);assert.equal(cents((await quote(c)).saldoTotalOwnerAntes),total+aportado);assert.deepEqual(await accounts(c.u),base);
     assert.equal((await sql('SELECT count(*)::int n FROM caixa37_operacoes WHERE user_id=$1',[c.u]))[0].n,beforeOps+committed);
     assert.equal((await sql('SELECT count(*)::int n FROM caixa37_pernas p JOIN caixa37_operacoes o ON o.id=p.operacao_id WHERE o.user_id=$1',[c.u]))[0].n,5+expectedLegs);
     record(`STRESS fresh${fresh} attempts=32 commits=${committed} safe40001=${32-committed} aporteCents=${aportado} legs=${expectedLegs}`);
    });
    await scenario('MANUTENÇÃO36a autovacuum ON ANALYZE/VACUUM/FREEZE sem falso55000',async()=>{
     assert.equal((await sql('SHOW autovacuum'))[0].autovacuum,'on');const before=(await sql('SELECT multa36_metadata() h'))[0].h;
     const tables=await sql("SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relname LIKE 'multa36\\_%' ESCAPE '\\' AND relkind='r' ORDER BY relname");
     for(const {relname} of tables)await sql(`VACUUM (FREEZE, ANALYZE) public.${relname}`);
     assert.equal((await sql('SELECT multa36_metadata() h'))[0].h,before);await sql('SELECT legados_verificar(),multimodal_verificar(),multa36_verificar(),caixa37_verificar()');
    });
    try{await sql('SELECT legados_verificar(),multimodal_verificar(),multa36_verificar(),caixa37_verificar()');}catch(e){writeFileSync(`${out}/logcoexistence-metadata36-diff-fresh${fresh}.json`,JSON.stringify({before:metadata36Before,after:await sql("SELECT to_jsonb(c) c FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'multa36\\_%' ESCAPE '\\' AND c.relkind IN('r','S') ORDER BY oid")},null,2));failures.push({fresh,id:'final-metadata',...safeError(e)});record(`FAIL fresh${fresh} final-metadata ${e.message}`);}await residues();
    record(`COUNTS fresh${fresh} ${JSON.stringify((await sql('SELECT (SELECT count(*)::int FROM caixa37_operacoes) ops,(SELECT count(*)::int FROM caixa37_pernas) legs,(SELECT count(*)::int FROM transacoes_caixa) ledger'))[0])}`);
    state.dedicatedCompleted=true;
   }finally{await db.end();}
   originals.push(...await runOriginalSuites({admin,baseconfig,fresh,target,sources,read,record,out,root}));
   state.originalsCompleted=true;
  }
 }catch(e){failures.push({id:'harness',...safeError(e)});record(`FAIL HARNESS ${e.code??''} ${e.message}`);}
 finally{
  await admin?.end().catch(()=>{});
  if(started){try{run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-m','fast','-w','stop']);let status;try{run(`${bin}/pg_ctl`,['-D',`${root}/data`,'status']);status=0;}catch(e){status=e.status;}assert.equal(status,3);assert.equal(existsSync(`${root}/data/postmaster.pid`),false);copyFileSync(`${root}/postgres.log`,`${out}/logcoexistence-postgres.log`);rmSync(`${root}/data`,{recursive:true});record(`CLEANUP own=${root}/data STOP=0 STATUS=3 PID_ABSENT=true PGDATA_REMOVED=true`);}catch(e){failures.push({id:'cleanup',...safeError(e)});}}
  const result={sql37Sha256:sha,sql37Sha256Current:hash(read('drizzle/0037_rpc_aporte_transferencia_caixa.sql')),sql36Sha256:hash(sources[source36]),sql36aSha256:hash(sources[source36a]),autovacuum:'on',environmentVerified,freshStates,sourceInventory,root,results,failures,originals,capabilityMatrices};
  assert.equal(result.sql36Sha256,pin36);assert.equal(hash(read(`drizzle/${source36}.sql`)),pin36);
  writeFileSync(`${out}/logcoexistence-results.json`,JSON.stringify(result,null,2)+'\n');writeFileSync(`${out}/logcoexistence-test.log`,results.join('\n')+'\n');
  const gaps=capabilityMatrices.flatMap(x=>x.gaps);const gate='NO-GO';
  writeFileSync(`${out}/logcoexistence-RESULT.md`, `# SQL37 — coexistência/concorrência\n\n**${gate} subfrente; não constitui certificação global ou instalação produtiva.**\n\nAutovacuum ON, predecessor36a obrigatório, PG17 socket0700/TCP desabilitado. Duas freshDB. Corpos originais e controles instrumentados declarados são separados; nenhuma suíte full com setup substituído.\n\nSQL37: \`${sha}\`; no fim: \`${result.sql37Sha256Current}\`. SQL36 congelado: \`${result.sql36Sha256}\`. SQL36a: \`${result.sql36aSha256}\`.\n\nComando somente após liberação final: \`COEXISTENCE_FINAL_SQL37_SHA=${sha} node tests/postgres-caixa37/certification-coexistence.mjs\`.\n\n## Matriz e locks\n\n${results.filter(x=>/^(PASS|FAIL|STRESS|COUNTS|OBSERVED|TRYFAIL|GAP_NO_GO)/.test(x)).map(x=>'- '+x).join('\n')}\n\n## Falhas e lacunas\n\n${failures.map(x=>'- '+x.id+': '+x.message).join('\n')||'Nenhuma falha dedicada.'}\n\n${gaps.map(x=>'- NO-GO consumer'+x.family+' '+x.test+': '+x.note).join('\n')}\n\n## Suítes e omissões nominais\n\n${originals.map(x=>`### ${x.suite} fresh${x.fresh} — ${x.mode}\n\nFonte SHA \`${x.sourceSha256}\`; fullSuite=false; PASS=${x.passed.length}; omissões=${x.skipped.length}; ${x.failure?'FAIL '+x.failure.message:'seleção executada'}.\n\n${x.passed.map(n=>'- PASS '+n).join('\n')}\n\n${x.skipped.map(n=>'- OMITIDO '+n).join('\n')}\n\n${x.equivalents.map(e=>'- Equivalente nominal '+e.omission+': '+(e.dedicated??e.status)).join('\n')}\n`).join('\n')}\n\nGaps universais operation/payload/prova dos consumidores35/36 não são atribuídos a eles: produtor privado, pontes e provas finais são camadas distintas. Cópias shadow não escrevem dinheiro real; fonte original intocada. Original36 setup/preflight/reapply segue NO-GO nesta subfrente. Q02/X01/X02/S02/restart pertencem à outra frente. Sem Git, rede, browser, produção, builders antigos ou reseal runtime.\n`);

 }
 if(failures.length||originals.some(x=>x.failure))process.exitCode=1;
 const counts={dedicatedPass:results.filter(x=>/^PASS fresh\d+ /.test(x)).length,dedicatedErrors:failures.length,originalPass:originals.reduce((n,x)=>n+x.passed.length,0),originalSkipped:originals.reduce((n,x)=>n+x.skipped.length,0),originalErrors:originals.reduce((n,x)=>n+x.errors.length,0),originalFailedSelections:originals.filter(x=>x.failure).length,observedLocks:results.filter(x=>/^OBSERVED /.test(x)).length,tryfails:results.filter(x=>/^TRYFAIL /.test(x)).length,capabilities:capabilityMatrices.map(x=>({fresh:x.fresh,family:x.family??'35/36',pass:(x.results??x.observed).filter(y=>y.status==='PASS').length,gaps:x.gaps.length}))};
 const scopedComplete=freshStates.length===2&&freshStates.every(x=>x.installed&&x.dedicatedCompleted&&x.originalsCompleted)&&!failures.length&&!originals.some(x=>x.failure);
 writeFileSync(`${out}/logcoexistence-COUNTS.json`,JSON.stringify({sql37Sha256:sha,counts,freshStates,coexistenceContractGate:scopedComplete?'GO escopo L01-L05/H01/C01-C02 exercitado':'NO-GO escopo não concluído ou falha observada',globalGate:'NO-GO certificação global não demonstrada nesta subfrente; original36 setup/preflight/reapply omitidos'},null,2)+'\n');
 const report=read(`${out}/logcoexistence-RESULT.md`).replace('Duas freshDB.',`FreshDB instaladas=${freshStates.filter(x=>x.installed).length}/2; dedicadas concluídas=${freshStates.filter(x=>x.dedicatedCompleted).length}/2; seleções originais concluídas=${freshStates.filter(x=>x.originalsCompleted).length}/2. Desenho não implica execução concluída.`);
 writeFileSync(`${out}/logcoexistence-RESULT.md`,report+`\n## Atribuição estrita CONTRACT37 e contagens exatas\n\nEscopo convivência exercitado: **${scopedComplete?'GO local restrito aos cenários concluídos':'NO-GO; rodada incompleta ou falhas registradas'}**. Certificação global: **NO-GO nesta subfrente**, independentemente de capacidades manuais shadow aceitas. Omissão nominal original36 setup/preflight/reapply permanece separada e uma execução full36 fora de37 não prova schema36a+37.\n\nContagens: \`${JSON.stringify(counts)}\`. Estados: \`${JSON.stringify(freshStates)}\`.\n\nOs rótulos históricos GAP_NO_GO de componentes universais isolados35/36 são limitações de alcance, não requisitos adicionais de CONTRACT37 nem constatação de corrupção monetária. Capacidades/operações manuais emitidas pelo superusuário de teste, pendentes na própria transação, podem ser emitidas pela própria sessão fora da RPC; a aceitação shadow ou consumo isolado sem commit financeiro não implica capacidade explorável por anon/authenticated/service_role. A ACL e os produtores privados/pontes/guards/prova final são fronteiras reais distintas. Negativas e eventuais falhas concretas permanecem integralmente registradas; não são descartadas por essa atribuição. Bridge payload-value é análise estática sem DML autorizado e não uma assertion negativa executada. Consumer35 em outra conexão é omissão explícita; consumer36 peer foi exercitado quando sua matriz completou.\n`);
 return {failures,originals};
}
if(process.argv[1]?.endsWith('/certification-coexistence.mjs'))await certify();
