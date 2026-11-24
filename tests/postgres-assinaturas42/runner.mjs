import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,openSync,closeSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import pg from 'pg';
const REPO=fileURLToPath(new URL('../../',import.meta.url)),bin='/usr/lib/postgresql/17/bin';
const root=mkdtempSync('/tmp/cobrapro-assinaturas42-'),OUT=root,port=55492,read=p=>readFileSync(p,'utf8');
mkdirSync(root+'/evidence',{mode:0o700});
const env={PATH:'/usr/bin:/bin',HOME:root,LANG:'C.UTF-8'},run=(cmd,args)=>execFileSync(cmd,args,{env,encoding:'utf8'});
let socketFd; let started=false;const clients=[],checks=[];
const record=s=>{console.log('PASS '+s);checks.push(s);};
try{
 mkdirSync(root+'/socket',{mode:0o700}); socketFd=openSync(root+'/socket','r'); const socketPath=`/proc/${process.pid}/fd/${socketFd}`;
 run(bin+'/initdb',['-D',root+'/data','-U','harness_admin42','-A','trust','--no-locale','-E','UTF8']);
 run(bin+'/pg_ctl',['-D',root+'/data','-l',root+'/postgres.log','-o',`-k ${socketPath} -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
 const config={host:socketPath,port,user:'postgres',database:'postgres'};
 const bootstrap=new pg.Client({...config,user:'harness_admin42'});clients.push(bootstrap);await bootstrap.connect();
 await bootstrap.query('CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS CREATEDB CREATEROLE; ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres;');
 const db=new pg.Client(config);clients.push(db);await db.connect();
 const sql=(q,v=[])=>db.query(q,v),rpc=async(v,client=db)=>(await client.query('SELECT public.rpc_receber_assinatura42($1,$2,$3,$4,$5,$6,$7,$8) r',v)).rows[0].r;
 const reject=async(fn,code)=>{let caught;try{await fn();}catch(e){caught=e;}assert.ok(caught,`esperava ${code}`);assert.equal(caught.code,code,`${caught.message} / ${caught.detail}`);};
 for(const path of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql','tests/postgres-caixa37/fixture.sql'])await sql(read(REPO+'/'+path).replace('ALTER ROLE service_role NOSUPERUSER BYPASSRLS;',''));
 await bootstrap.query('ALTER ROLE service_role NOSUPERUSER BYPASSRLS');
 // Shape de 0009 sem as alterações de parcelas já incluídas no fixture31-37.
 const schema9=read(REPO+'/drizzle/0009_assinaturas.sql');
 await sql(schema9.slice(0,schema9.indexOf('-- Adicionar coluna contagem_renovacoes')));
 await sql('ALTER TABLE assinaturas ADD COLUMN user_id integer; ALTER TABLE pagamentos_assinatura ADD COLUMN user_id integer;');
 await sql(`INSERT INTO assinaturas(id,user_id,cliente_id,servico,valor_mensal,data_inicio,conta_caixa_id,status) VALUES
 (42,1,1,'Sintética42',29.90,'2026-01-01',7,'inadimplente'),(43,1,1,'Sintética43',29.90,'2026-01-01',7,'ativa');
 GRANT SELECT,INSERT,UPDATE,DELETE ON assinaturas,pagamentos_assinatura TO service_role;
 GRANT USAGE,SELECT ON SEQUENCE assinaturas_id_seq,pagamentos_assinatura_id_seq TO service_role;`);
 // Owner4: somente conta50 possui linha histórica crossowner. Conta51 está íntegra.
 await sql(`INSERT INTO users(id) VALUES(4);
 INSERT INTO clientes(id,user_id,nome) VALUES(44,4,'Cliente próprio sintético');
 INSERT INTO contas_caixa(id,user_id,nome,saldo,ativo) VALUES(50,4,'Histórico divergente',10,true),(51,4,'Nova íntegra',0,true);
 INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao,contrato_id)
 VALUES(4,50,'entrada','pagamento_parcela',1,'Histórico crossowner sintético','2026-01-01',910);
 INSERT INTO assinaturas(id,user_id,cliente_id,servico,valor_mensal,data_inicio,conta_caixa_id,status)
 VALUES(44,4,44,'Assinatura própria',29.90,'2026-01-01',51,'ativa');`);
 await sql('ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY; ALTER TABLE pagamentos_assinatura ENABLE ROW LEVEL SECURITY; REVOKE ALL ON assinaturas,pagamentos_assinatura FROM anon,authenticated;');
 // Ambiente managed: postgres é owner, NÃO superuser; admin isolado só configura roles antes dos selos.
 await bootstrap.query('GRANT anon,authenticated,service_role TO postgres WITH SET TRUE;');
 assert.deepEqual((await sql("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0],{rolsuper:false,rolbypassrls:true});
 record('instalação e runtime com owner postgres NOSUPERUSER BYPASSRLS, sem relaxar checks');
 const migrations=['0020_rpc_despesas_prospectivas','0021_rpc_emprestimos_prospectivos','0022_rpc_ciclo_emprestimos_prospectivos','0025_integrar_rpc_despesas_ciclo','0031_rpc_renovacao_juros_prospectiva','0033_rpc_reconciliacao_intencoes_financeiras','0034_rpc_recebimento_legado_validado','0035_rpc_ciclo_emprestimos_multimodal','0036_rpc_multa_manual_fixa','0036a_multa_metadata_estavel','0037_rpc_aporte_transferencia_caixa'];
 for(const m of migrations){console.log('Instalar '+m);await sql(read(REPO+'/drizzle/'+m+'.sql'));}
 // RED real usando migration0042 ORIGINAL num DDL transacional descartado, não mock.
 await sql('BEGIN');
 const original42=read(REPO+'/tests/postgres-assinaturas42/original42-red.fixture.sql').replace('BEGIN;\nSET LOCAL','SET LOCAL').replace(/COMMIT;\s*$/,'');
 await sql(original42);await sql('SAVEPOINT original_writer');
 await reject(()=>rpc([4,randomUUID(),44,44,51,'29.90','2026-11',null]),'23514');
 await sql('ROLLBACK');record('RED original42: owner com conta50 crossowner impede recebimento na conta51 íntegra (23514)');
 const dirtyBefore=JSON.stringify((await sql('SELECT to_jsonb(t) r FROM transacoes_caixa t WHERE conta_caixa_id=50 ORDER BY id')).rows);
 const target=read(REPO+'/drizzle/0042_assinaturas_recebimento_atomico.sql');
 // RED real: RPC não existe e não há baixa alternativa. Captura só SQLSTATE, sem rede externa.
 await reject(()=>rpc([1,randomUUID(),42,1,7,'29.90','2026-11',null]),'42883');record('RED baseline sem RPC42: SQLSTATE 42883');
 const legacy=await sql('SELECT public.caixa37_snapshot(1) s');
 await sql(target);assert.deepEqual((await sql('SELECT public.caixa37_snapshot(1) s')).rows,legacy.rows);record('instalação sem alteração de contas/ledger e selos predecessores válidos');
 const state=async()=>JSON.stringify((await sql(`SELECT jsonb_build_object(
 'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM pagamentos_assinatura p),
 'ops',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM assinaturas42_operacoes o),
 'ledger',public.caixa37_snapshot(1),'subscriptions',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM assinaturas a)) s`)).rows);
 const negative=async(fn,code)=>{const before=await state();await reject(fn,code);assert.equal(await state(),before);};
 const args=[1,randomUUID(),42,1,7,'29.90','2026-11',null];
 await sql('SET ROLE anon');await reject(()=>rpc(args),'42501');await sql('RESET ROLE');
 await sql('SET ROLE authenticated');await reject(()=>rpc(args),'42501');await sql('RESET ROLE');
 await sql('SET ROLE service_role');await reject(()=>sql('SELECT id FROM assinaturas42_operacoes LIMIT 1'),'42501');
 await reject(()=>sql("SELECT public.assinaturas42_validar('00000000-0000-4000-8000-000000000000')"),'42501');await sql('RESET ROLE');record('ACL: anon/auth bloqueados, service_role sem SELECT/EXECUTE dos helpers privados');
 await negative(()=>rpc([2,randomUUID(),42,1,7,'29.90','2026-11',null]),'42501');
 await negative(()=>rpc([1,randomUUID(),42,2,7,'29.90','2026-11',null]),'42501');
 await negative(()=>rpc([1,randomUUID(),42,1,3,'29.90','2026-11',null]),'42501');
 await negative(()=>rpc([1,randomUUID(),42,1,7,'29.901','2026-11',null]),'22023');
 await negative(()=>rpc([1,randomUUID(),42,1,7,'29.89','2026-11',null]),'23514');
 await negative(()=>rpc([1,randomUUID(),42,1,7,'29.90','2025-12',null]),'23514');
 await negative(()=>rpc([1,randomUUID(),42,1,7,'29.90','2026-13',null]),'22023');record('owner/cliente/conta/centavos/valor/competência inválidos: rollback integral');
 // GREEN real: service_role recebe usando ponte42 contra todas as guardas predecessor reais.
 await sql('SET ROLE service_role');const result=await rpc(args);await sql('RESET ROLE');
 assert.equal(result.success,true);assert.equal(result.vigenciaAte,'2026-11-30');assert.equal(result.status,'ativa');assert.equal(result.repetida,false);
 assert.equal((await sql('SELECT count(*)::int n FROM pagamentos_assinatura WHERE assinatura_id=42')).rows[0].n,1);
 const cash=(await sql('SELECT public.caixa37_saldo(1,7) s')).rows[0].s;assert.equal(cash.saldoBase,'-100.00');assert.equal(cash.saldoEfetivo,'-70.10');record('GREEN pagamento+vigência/status+caixa atômicos; base negativa preservada e entrada exata29.90');
 const beforeReplay=await state();const replay=await rpc(args);assert.equal(replay.repetida,true);assert.equal(replay.operationId,result.operationId);assert.equal(await state(),beforeReplay);record('timeout/resposta perdida: mesma intenção e UUID retornam mesma operação sem nova entrada');
 await negative(()=>rpc([...args.slice(0,7),'outro payload']),'23505');
 await negative(()=>rpc([1,randomUUID(),42,1,7,'29.90','2026-11',null]),'23505');record('UUID payload diferente e competência duplicada em novo UUID rejeitados');
 // Falha dentro do ledger: CHK aplicada numa transação local, selo recalculado apenas no fixture adversarial.
 await sql('BEGIN');await sql('ALTER TABLE transacoes_caixa ADD CONSTRAINT injected42 CHECK (categoria IS DISTINCT FROM \'pagamento_assinatura\') NOT VALID');
 await sql('UPDATE multimodal_manifesto SET assinatura=multimodal_metadata() WHERE id=1; UPDATE caixa37_manifesto SET assinatura=caixa37_metadata() WHERE id=1');
 const rb=await state();await sql('SAVEPOINT attempt');await reject(()=>rpc([1,randomUUID(),43,1,7,'29.90','2026-11',null]),'23514');await sql('ROLLBACK TO SAVEPOINT attempt');assert.equal(await state(),rb);await sql('ROLLBACK');record('falha real no INSERT ledger reverte pagamento, vigência, operação e capacidades');

 await sql('BEGIN');await sql('ALTER TABLE assinaturas ADD CONSTRAINT injected_status42 CHECK (vigencia_pago_ate IS NULL) NOT VALID');
 await sql('UPDATE caixa37_manifesto SET assinatura=caixa37_metadata() WHERE id=1');
 const statusBefore=await state();await sql('SAVEPOINT failstatus');await reject(()=>rpc([1,randomUUID(),43,1,7,'29.90','2026-11',null]),'23514');
 await sql('ROLLBACK TO SAVEPOINT failstatus');assert.equal(await state(),statusBefore);await sql('ROLLBACK');record('falha real no UPDATE vigência após ledger também reverte todas as etapas');
 await negative(()=>sql("DELETE FROM transacoes_caixa WHERE id=$1",[Number(result.transacaoCaixaId)]),'42501');
 await negative(()=>sql("UPDATE pagamentos_assinatura SET valor_pago=0 WHERE id=$1",[Number(result.pagamentoId)]),'42501');
 await negative(()=>sql("UPDATE assinaturas SET vigencia_pago_ate='2030-01-01' WHERE id=42"),'42501');
 await negative(()=>sql('UPDATE contas_caixa SET saldo=999 WHERE id=7'),'42501');record('ledger/pagamento/vigência/base recebida não admitem patch ou exclusão');
 await sql("UPDATE assinaturas SET status='cancelada' WHERE id=43");await negative(()=>rpc([1,randomUUID(),43,1,7,'29.90','2026-11',null]),'23514');await sql("UPDATE assinaturas SET status='ativa' WHERE id=43");
 // Uma transação mantém o advisory conta. Rival deve falhar sem dupla baixa, retomar com mesmo UUID após release.
 const other=new pg.Client(config);clients.push(other);await other.connect();await sql('BEGIN');await sql('SELECT pg_advisory_xact_lock(22022,7)');
 const race=[1,randomUUID(),43,1,7,'29.90','2026-11',null];await reject(()=>rpc(race,other),'40001');await sql('ROLLBACK');assert.equal((await rpc(race,other)).success,true);record('concorrência lock22022: sem efeito rival e retomada da mesma intenção após liberar');
 // Conta pin37 real e contrato35 real: writer42 deve coexistir, nunca inventar capability alheia.
 const q=(await sql("SELECT rpc_cotar_caixa37(1,'aporte',NULL,7,'1.00',NULL) q")).rows[0].q;
 await sql('SELECT rpc_aportar_caixa37($1,$2,$3,$4,$5,$6,$7)',[1,randomUUID(),7,q.valor,q.dataTransacao,q.estadoHash,null]);
 const pin=await rpc([1,randomUUID(),42,1,7,'29.90','2026-12',null]);assert.equal(pin.vigenciaAte,'2026-12-31');
 await sql('SELECT caixa37_validar_livro(1)');record('conta pin37: aporte37 real antes de nova assinatura42; saldo/provas37 continuam válidos');

 // Mesma conta em todas as famílias publicadas: criação21 + recebimento22, multimodal35 + multa36.
 const day=(await sql("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text d")).rows[0].d;
 const loan21=(await sql('SELECT rpc_criar_emprestimo($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) r',[1,randomUUID(),1,1,'mensal','mensal','10.00','10.00',1,day,day,[day],null,null])).rows[0].r;
 const yesterday=(await sql("SELECT ((clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date-1)::text d")).rows[0].d;
 const multi35=(await sql('SELECT rpc_criar_emprestimo_multimodal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) r',[1,randomUUID(),1,1,'mensal','mensal','10.00','10.00',1,yesterday,yesterday,[yesterday],null,null,'2.0000','0.0330'])).rows[0].r;
 await sql('SELECT rpc_aplicar_multa36($1,$2,$3,$4,$5)',[1,randomUUID(),multi35.id,'2.00',multi35.parcelasIds]);
 const shared42=await rpc([1,randomUUID(),42,1,1,'29.90','2027-01',null]);assert.equal(shared42.success,true);
 await sql('SELECT caixa37_validar_livro(1)');record('ponte42 exata na conta1 protegida por empréstimo21, multimodal35 e multa36');
 await negative(()=>sql('UPDATE clientes SET user_id=2 WHERE id=1'),'42501');
 await negative(()=>sql('UPDATE assinaturas SET user_id=2 WHERE id=42'),'42501');record('tenant cliente/assinatura recebida imutável');
 // Dois UUID diferentes para a mesma competência: só uma entrada, rival40001/23505; retry nunca duplica.
 const ra=[1,randomUUID(),43,1,7,'29.90','2027-02',null],rb2=[1,randomUUID(),43,1,7,'29.90','2027-02',null];
 const concurrent=await Promise.allSettled([rpc(ra),rpc(rb2,other)]);
 assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
 const loser=concurrent.findIndex(r=>r.status==='rejected');assert.ok(['40001','23505'].includes(concurrent[loser].reason.code));
 await negative(()=>rpc(loser===0?ra:rb2),'23505');
 assert.equal((await sql("SELECT count(*)::int n FROM pagamentos_assinatura WHERE assinatura_id=43 AND mes_referencia='2027-02'")).rows[0].n,1);record('duas sessões/UUIDs competem pela mesma competência: pagamento e perna únicos');
 const older=await rpc([1,randomUUID(),42,1,7,'29.90','2026-02',null]);assert.equal(older.vigenciaAte,'2027-01-31');record('competência antiga não reduz vigência já paga');
 await sql("UPDATE contas_caixa SET ativo=false WHERE id=7");assert.equal((await rpc(args)).operationId,result.operationId);await sql("UPDATE contas_caixa SET ativo=true WHERE id=7");record('recovery histórico não depende de conta ainda ativa nem do mês atual');

 const same=[1,randomUUID(),43,1,7,'29.90','2027-03','mesma intenção simultânea'];
 const simultaneous=await Promise.all([rpc(same),rpc(same,other)]);
 assert.equal(simultaneous[0].operationId,simultaneous[1].operationId);assert.equal(simultaneous.filter(r=>r.repetida).length,1);record('mesma intenção concorrente aguarda UUID e confirma mesma operação única');
 await sql('BEGIN');await sql('ALTER TABLE transacoes_caixa DISABLE TRIGGER a00_assinaturas42_ledger');
 await reject(()=>rpc([1,randomUUID(),42,1,7,'29.90','2027-04',null]),'55000');await sql('ROLLBACK');record('selo37 rejeita trigger42 desabilitado; nenhum reseal runtime');
 await sql('BEGIN');await sql('ALTER FUNCTION assinaturas42_consumir(text,text,text,jsonb,jsonb) SET search_path=public');
 await reject(()=>rpc(args),'55000');await sql('ROLLBACK');record('selo37 rejeita adulteração de helper42 mesmo em recovery');
 const residue=(await sql('SELECT count(*)::int n FROM assinaturas42_capacidades')).rows[0].n;assert.equal(residue,0);record('nenhuma capacidade residual no commit; triggers e selos financeiros preservados');
 // GREEN escopo próprio42: nenhuma adoção, correção ou remoção de histórico.
 await reject(()=>sql('SELECT caixa37_validar_livro(4)'),'23514');
 await sql('SET ROLE service_role');const cleanPayment=await rpc([4,randomUUID(),44,44,51,'29.90','2026-11',null]);await sql('RESET ROLE');
 assert.equal(cleanPayment.success,true);
 assert.equal(JSON.stringify((await sql('SELECT to_jsonb(t) r FROM transacoes_caixa t WHERE conta_caixa_id=50 ORDER BY id')).rows),dirtyBefore);
 assert.equal((await sql('SELECT caixa37_saldo(4,51) s')).rows[0].s.saldoEfetivo,'29.90');
 await reject(()=>rpc([4,randomUUID(),44,44,50,'29.90','2026-12',null]),'23514');
 await sql('SELECT assinaturas42_validar_conta(4,51)');
 record('GREEN42 conta51 íntegra recebe29.90 apesar da conta50 crossowner: histórico byte a byte intacto; conta50 continua recusada');
 // Continuação final: conferência jamais chama o writer; mesma trava UUID nas duas RPCs.
 const conferir=async(v,client=db)=>(await client.query('SELECT public.rpc_conferir_assinatura42($1,$2,$3,$4,$5,$6,$7,$8) r',v)).rows[0].r;
 const uuidLock="pg_advisory_xact_lock(hashtextextended('assinaturas42:'||p_user_id::text||':'||p_chave::text,42))";
 assert.equal(target.split(uuidLock).length-1,2);record('writer e conferência compartilham expressão UUID lock byte a byte');
 await sql('SET ROLE anon');await reject(()=>conferir(args),'42501');await sql('RESET ROLE');
 await sql('SET ROLE authenticated');await reject(()=>conferir(args),'42501');await sql('RESET ROLE');
 await sql('SET ROLE service_role');
 for(const table of ['assinaturas42_fences','assinaturas42_operacoes','assinaturas42_capacidades']){
  await reject(()=>sql(`SELECT 1 FROM ${table} LIMIT 1`),'42501');
 }
 await reject(()=>sql('DELETE FROM assinaturas42_fences'),'42501');
 await reject(()=>sql('TRUNCATE assinaturas42_fences'),'42501');await sql('RESET ROLE');
 assert.equal((await sql("SELECT count(*)::int n FROM pg_class c WHERE c.oid IN ('assinaturas42_fences'::regclass,'assinaturas42_operacoes'::regclass,'assinaturas42_capacidades'::regclass) AND c.relrowsecurity")).rows[0].n,3);
 assert.equal((await sql("SELECT count(*)::int n FROM pg_policy WHERE polrelid IN ('assinaturas42_fences'::regclass,'assinaturas42_operacoes'::regclass,'assinaturas42_capacidades'::regclass)")).rows[0].n,0);record('fence privado: RLS sem policies; anon/auth sem RPC; service sem leitura, delete ou truncate');
 const afterLostResponse=await conferir(args);assert.equal(afterLostResponse.estado,'confirmed');assert.equal(afterLostResponse.resultado.operationId,result.operationId);
 await negative(()=>conferir([...args.slice(0,7),'payload divergente']),'23505');record('conferência de commit perdido retorna sucesso original; mesmo UUID com payload divergente não descarta');
 const bad=[1,randomUUID(),43,1,7,'29.89','2028-01','erro valor definitivo'];
 const initialPay=(await sql('SELECT count(*)::int n FROM pagamentos_assinatura')).rows[0].n;
 await negative(()=>rpc(bad),'23514');
 await sql('SET ROLE service_role');const closed=await conferir(bad);await sql('RESET ROLE');assert.equal(closed.estado,'fenced');
 assert.equal((await sql('SELECT count(*)::int n FROM pagamentos_assinatura')).rows[0].n,initialPay);
 assert.deepEqual(await conferir(bad),closed);await negative(()=>rpc(bad),'23514');
 const divergent=[...bad];divergent[5]='29.90';await reject(()=>conferir(divergent),'23505');await reject(()=>rpc(divergent),'23505');
 const fixed=[...divergent];fixed[1]=randomUUID();fixed[7]='corrigido nova intenção';assert.equal((await rpc(fixed)).success,true);
 assert.equal((await sql("SELECT count(*)::int n FROM pagamentos_assinatura WHERE assinatura_id=43 AND mes_referencia='2028-01'")).rows[0].n,1);record('validação recusada → fence durável → nova intenção corrigida: uma única entrada; replay e divergência bloqueados');
 await reject(()=>sql('DELETE FROM assinaturas42_fences WHERE user_id=1 AND chave=$1',[bad[1]]),'42501');
 await reject(()=>sql("UPDATE assinaturas42_fences SET request='{}'::jsonb WHERE user_id=1 AND chave=$1",[bad[1]]),'42501');record('fence append-only também para owner da tabela; nenhum reset local/DELETE resolve UUID fechado');
 const waiterPid=(await other.query('SELECT pg_backend_pid() p')).rows[0].p;
 const waitUUID=async()=>{for(let i=0;i<100;i++){
  const waiting=(await sql("SELECT count(*)::int n FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted",[waiterPid])).rows[0].n;
  if(waiting===1)return;await new Promise(r=>setTimeout(r,10));
 }throw Error('rival não aguardou advisory UUID');};
 const writerFirst=[1,randomUUID(),43,1,7,'29.90','2028-02','writer vence'];
 await sql('BEGIN');const winner=await rpc(writerFirst);
 const pendingFence=conferir(writerFirst,other);await waitUUID();await sql('COMMIT');
 const confirmedRace=await pendingFence;assert.equal(confirmedRace.estado,'confirmed');assert.equal(confirmedRace.resultado.operationId,winner.operationId);
 assert.equal((await sql('SELECT count(*)::int n FROM assinaturas42_fences WHERE chave=$1',[writerFirst[1]])).rows[0].n,0);record('duas sessões writer primeiro: fence aguarda UUID/commit e retorna confirmed, nunca cria ausência falsa');
 const fenceFirst=[1,randomUUID(),43,1,7,'29.90','2028-03','fence vence'];
 await sql('BEGIN');assert.equal((await conferir(fenceFirst)).estado,'fenced');
 const pendingWriter=rpc(fenceFirst,other).then(value=>({value,error:null}),error=>({value:null,error}));await waitUUID();await sql('COMMIT');
 const stopped=await pendingWriter;assert.equal(stopped.error?.code,'23514');
 assert.equal((await sql("SELECT count(*)::int n FROM pagamentos_assinatura WHERE assinatura_id=43 AND mes_referencia='2028-03'")).rows[0].n,0);
 assert.equal((await conferir(fenceFirst,other)).estado,'fenced');record('duas sessões fence primeiro: writer aguarda UUID e recusa após commit, zero pagamento/ledger');
 const rolledBack=[1,randomUUID(),43,1,7,'29.90','2028-04','writer rollback'];
 await sql('BEGIN');await rpc(rolledBack);const pendingAbsent=conferir(rolledBack,other);await waitUUID();await sql('ROLLBACK');
 assert.equal((await pendingAbsent).estado,'fenced');await negative(()=>rpc(rolledBack),'23514');record('writer rollback antes de resposta: conferência aguarda e fecha ausência definitivamente');
 const unknownBinding=[1,randomUUID(),2147483647,2147483647,2147483647,'29.90','2028-05',null];
 await negative(()=>rpc(unknownBinding),'42501');assert.equal((await conferir(unknownBinding)).estado,'fenced');record('vínculo inexistente recusado também permite fence sem criar infraestrutura financeira ou FK falsa');
 await sql('BEGIN');await sql('ALTER FUNCTION rpc_conferir_assinatura42(integer,uuid,integer,integer,integer,text,text,text) SET search_path=public');await reject(()=>conferir(args),'55000');await sql('ROLLBACK');record('metadata37 sela RPC de conferência e fence; adulteração falha sem reseal runtime');
 await sql('SELECT caixa37_validar_livro(1)');
 writeFileSync(OUT+'/evidence/postgres-result.json',JSON.stringify({status:'PASS',version:(await sql('SHOW server_version')).rows[0],syntheticOnly:true,tcp:false,installRole:(await sql("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0],checks,result},null,2)+'\n');
}catch(error){console.error(error);writeFileSync(OUT+'/evidence/postgres-error.txt',String(error.stack)+'\n'+JSON.stringify({message:error.message,code:error.code,detail:error.detail,where:error.where},null,2)+'\n');process.exitCode=1;
}finally{
 for(const client of clients)await client.end().catch(()=>{});
 if(started)run(bin+'/pg_ctl',['-D',root+'/data','-m','immediate','-w','stop']);
 if(socketFd!==undefined)closeSync(socketFd);
 if(process.exitCode!==1)rmSync(root,{recursive:true,force:true});
}
