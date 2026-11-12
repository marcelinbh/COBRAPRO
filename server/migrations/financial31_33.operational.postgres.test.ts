import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

it('PG17 postgres NOSUPERUSER: catalog LOCK 42501, ACL efetiva, instalações exatas e serialização com snapshot fresco', async () => {
 const root=mkdtempSync(`${tmpdir()}/financial3133-operational-`), bin='/usr/lib/postgresql/17/bin';
 mkdirSync(`${root}/socket`,{mode:0o700});
 const env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:root};
 const run=(cmd:string,args:string[])=>execFileSync(cmd,args,{env,encoding:'utf8'});
 const operator=run('/usr/bin/id',['-un']).trim();
 const clients:pg.Client[]=[], evidence:string[]=[]; let started=false;
 const connect=async(user=operator,database='postgres')=>{const c=new pg.Client({host:`${root}/socket`,port:55446,user,database});await c.connect();clients.push(c);return c;};
 const m31=readFileSync('drizzle/0031_rpc_renovacao_juros_prospectiva.sql','utf8');
 const m33=readFileSync('drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql','utf8');
 const rows=async(c:pg.Client)=>{const out:Record<string,unknown>={};for(const n of ['users','contratos','parcelas','transacoes_caixa','contrato_historico','contas_caixa','contas_pagar','clientes','koletores']) out[n]=(await c.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) s FROM public.${n} t`)).rows[0].s;return out;};
 const wait=async(observer:pg.Client,c:pg.Client)=>{for(let i=0;i<200;i++){if((await observer.query('SELECT wait_event FROM pg_stat_activity WHERE pid=$1',[c.processID])).rows[0]?.wait_event==='advisory')return;await new Promise(r=>setTimeout(r,10));}throw new Error('Espera advisory não observada');};
 try {
 run(`${bin}/initdb`,['-D',`${root}/data`,'-A','trust','--no-locale','-E','UTF8']);
 run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-l',`${root}/postgres.log`,'-o',`-k ${root}/socket -p 55446 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);started=true;
 const admin=await connect();
 await admin.query('CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS');
 // Fixture somente: bootstrap superuser cria predecessores imutáveis. Operador managed
 // não recebe grants/memberships; owner pré-existente é normalizado para postgres.
 for(const [i,renewal] of [false,true].entries()) {
 const database=`profile${i}`;await admin.query(`CREATE DATABASE ${database}`);
 const bootstrap=await connect(operator,database);
 for(const f of ['tests/postgres-loans/fixture.sql','tests/postgres-financial-coexistence/fixture.sql','drizzle/0020_rpc_despesas_prospectivas.sql','drizzle/0021_rpc_emprestimos_prospectivos.sql','drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql','drizzle/0025_integrar_rpc_despesas_ciclo.sql']) {
 // Roles são cluster-wide e só criadas pelo primeiro fixture.
 let sql=readFileSync(f,'utf8');if(i===1&&f.endsWith('fixture.sql'))sql=sql.replace(/^CREATE ROLE .*;\n/gm,'');await bootstrap.query(sql);
 }
 await bootstrap.query(`DO $$ DECLARE x record; BEGIN
 FOR x IN SELECT oid,relname,relkind FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','S') ORDER BY relkind DESC LOOP EXECUTE format('ALTER %s public.%I OWNER TO postgres',CASE WHEN x.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END,x.relname); END LOOP;
 FOR x IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',x.oid::regprocedure); END LOOP;
 END $$; ALTER SCHEMA extensions OWNER TO postgres; REVOKE CREATE ON SCHEMA public FROM PUBLIC;`);
 const db=await connect('postgres',database);const before=await rows(bootstrap);
 const privileges=(await db.query(`SELECT current_user,session_user,current_setting('server_version') version,current_setting('transaction_isolation') isolation,
 (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) superuser,has_schema_privilege(current_user,'public','CREATE') public_create,
 has_table_privilege(current_user,'pg_catalog.pg_namespace','SELECT') catalog_select,
 has_table_privilege(current_user,'pg_catalog.pg_namespace','MAINTAIN,UPDATE,DELETE,TRUNCATE') catalog_strong_lock,
 has_table_privilege(current_user,'public.contratos','MAINTAIN,UPDATE,DELETE,TRUNCATE') application_strong_lock`)).rows[0];
 expect(privileges).toMatchObject({current_user:'postgres',session_user:'postgres',superuser:false,public_create:false,catalog_select:true,catalog_strong_lock:false,application_strong_lock:true,isolation:'read committed'});
 evidence.push('PRIVILEGES '+JSON.stringify(privileges));
 await db.query('BEGIN');await expect(db.query('LOCK TABLE pg_catalog.pg_namespace IN SHARE ROW EXCLUSIVE MODE')).rejects.toMatchObject({code:'42501'});await db.query('ROLLBACK');
 for(const sql of [m31,m33]) {await expect(db.query(sql)).rejects.toMatchObject({code:'42501'});await db.query('ROLLBACK');expect(await rows(bootstrap)).toEqual(before);}
 evidence.push(`PASS perfil${i}: postgres NOSUPERUSER catalog LOCK negado 42501; CREATE public negado recusa ambas sem linhas alteradas`);
 // Fixture owner adequado é condição necessária; NÃO SET ROLE dentro da migration.
 await bootstrap.query('ALTER SCHEMA public OWNER TO postgres');
 const attrs=(await db.query("SELECT to_jsonb(r) attrs FROM pg_roles r WHERE rolname IN('postgres','anon','authenticated','service_role') ORDER BY rolname")).rows;
 if(renewal) {
 // Advisory adquirido antes da mudança, migration espera de verdade; o DO separado
 // deve enxergar ALTER recém-commitado mesmo quando enviado como SQL multistatement.
 await bootstrap.query("BEGIN; SELECT pg_advisory_xact_lock(20261112,3133); ALTER FUNCTION public.ciclo_guardar() SET search_path=public");
 const pending=db.query(m31).then(()=>({ok:true}),e=>({code:e.code}));await wait(bootstrap,db);
 expect((await bootstrap.query("SELECT count(*)::int n FROM pg_locks WHERE pid=$1 AND mode='AccessExclusiveLock' AND granted",[db.processID])).rows[0].n).toBe(0);
 await bootstrap.query('COMMIT');expect(await pending).toEqual({code:'P0001'});await db.query('ROLLBACK');await bootstrap.query('ALTER FUNCTION public.ciclo_guardar() SET search_path=pg_catalog,pg_temp');
 evidence.push('PASS advisory antes de relações + snapshot fresco após espera observa drift recém-commitado e recusa');
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await expect(db.query(m31.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''))).rejects.toMatchObject({code:'55000'});await db.query('ROLLBACK');
 // Um erro pós-DDL reverte toda instalação.
 const bad=m31.replace('-- Pós-DDL: conjunto completo',"ALTER FUNCTION public.ciclo_guardar() SET search_path=public;\n-- Pós-DDL: conjunto completo");
 await expect(db.query(bad)).rejects.toMatchObject({code:'55000'});await db.query('ROLLBACK');expect((await db.query("SELECT to_regclass('public.renovacao_operacoes') r")).rows[0].r).toBeNull();expect(await rows(bootstrap)).toEqual(before);
 await db.query(m31.replace(/^COMMIT;$/m,''));
 const locks=(await bootstrap.query(`SELECT c.relname,l.mode,l.granted FROM pg_locks l JOIN pg_class c ON c.oid=l.relation WHERE l.pid=$1 AND c.relnamespace='public'::regnamespace AND l.mode='AccessExclusiveLock' ORDER BY c.relname`,[db.processID])).rows;
 expect(locks.filter(x=>['contratos','parcelas','transacoes_caixa','contrato_historico','users','contas_caixa','clientes','koletores','contas_pagar','ciclo_despesas_autorizacoes','despesas_rpc_operacoes','despesas_rpc_origens','despesas_rpc_pagamentos','ciclo_estados','ciclo_operacoes','ciclo_autorizacoes','ciclo_pernas','emprestimos_rpc_operacoes','emprestimos_rpc_origens'].includes(x.relname))).toHaveLength(19);
 evidence.push('LOCKS31 '+JSON.stringify(locks));
 const contender=await connect('postgres',database);const duplicate=contender.query(m31).then(()=>({ok:true}),e=>({code:e.code}));await wait(bootstrap,contender);await db.query('COMMIT');expect(await duplicate).toEqual({code:'P0001'});await contender.query('ROLLBACK');
 evidence.push('PASS dois instaladores 31 serializados; segundo recusa one-shot após COMMIT');
 }
 await db.query(m33.replace(/^COMMIT;$/m,''));
 if(renewal) expect((await bootstrap.query("SELECT count(*)::int n FROM pg_locks l JOIN pg_class c ON c.oid=l.relation WHERE l.pid=$1 AND c.relname IN('renovacao_capacidades','renovacao_operacoes','renovacao_provas') AND l.mode='AccessExclusiveLock' AND l.granted",[db.processID])).rows[0].n).toBe(3);
 await db.query('COMMIT');expect(await rows(bootstrap)).toEqual(before);
 expect((await db.query("SELECT to_jsonb(r) attrs FROM pg_roles r WHERE rolname IN('postgres','anon','authenticated','service_role') ORDER BY rolname")).rows).toEqual(attrs);
 evidence.push(`PASS perfil${i}: SQL completo postgres NOSUPERUSER ${renewal?'31+33':'33 sobre25'}, owners/ACL/source pós-DDL exatos, roles e todas linhas legadas inalterados`);
 }
 } finally {
 for(const c of clients)await c.end().catch(()=>{});
 if(started){run(`${bin}/pg_ctl`,['-D',`${root}/data`,'-m','fast','-w','stop']);let status=0;try{run(`${bin}/pg_ctl`,['-D',`${root}/data`,'status']);}catch(e){status=(e as {status:number}).status;}expect(status).toBe(3);evidence.push('STOP_EXIT=0 FINAL_STATUS=3');}
 writeFileSync(`${root}/evidence.log`,evidence.join('\n')+'\n');console.log(`OPERATIONAL_EVIDENCE=${root}/evidence.log\n${evidence.join('\n')}`);
 }
},120000);
