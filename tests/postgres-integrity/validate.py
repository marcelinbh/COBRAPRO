#!/usr/bin/env python3
"""PostgreSQL 16 LOCAL apenas; psql usa socket absoluto e ambiente limpo."""
import concurrent.futures
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import traceback

BASE, RUN, OWNER = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3]
BIN = '/usr/lib/postgresql/16/bin'
LOG = RUN / 'logs'
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': str(RUN)}
RESULTS = []
SEQ = 0
M14 = '0014_integridade_assinaturas_financeiras.sql'
M16 = '0016_revogacao_sessoes_reset_senha.sql'
M17 = '0017_integridade_webhook_kiwify.sql'


def cmd(db, sql=None, file=None, transaction=False, app=None):
    c = [BIN+'/psql', '-X', '-h', str(RUN/'socket'), '-p', '55436', '-U', OWNER,
         '-d', db, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At']
    if transaction:
        c += ['-1']
    if file:
        c += ['-f', str(file)]
    else:
        c += ['-c', sql]
    env = dict(ENV)
    if app:
        env['PGAPPNAME'] = app
    return c, env


def query(db, sql=None, file=None, transaction=False):
    global SEQ
    SEQ += 1
    c, env = cmd(db, sql, file, transaction)
    r = subprocess.run(c, env=env, cwd=str(BASE), capture_output=True, text=True, timeout=30)
    path = LOG / f'{SEQ:03d}-{db}.log'
    path.write_text('COMMAND: '+repr(c)+'\nSQL: '+str(sql)+'\nEXIT: '+str(r.returncode)+'\nSTDOUT:\n'+r.stdout+'\nSTDERR:\n'+r.stderr)
    r.log_path = str(path)
    return r


def ok(r):
    assert r.returncode == 0, f'Unexpected SQL error: {r.stderr} ({r.log_path})'
    return r.stdout.strip()


def scalar(db, sql):
    return ok(query(db, sql))


def expect_error(r, state):
    assert r.returncode != 0 and re.search(r'\b'+state+r'\b', r.stderr), f'Expected {state}: {r.stdout} {r.stderr}'
    return {'sqlstate': state, 'log': r.log_path, 'error': r.stderr.strip()}


def record(name, function, category='test'):
    try:
        detail = function()
        entry = {'name': name, 'status': 'PASS', 'category': category, 'detail': detail}
        print('PASS '+name, flush=True)
    except Exception as e:
        entry = {'name': name, 'status': 'FAIL', 'category': category, 'error': str(e)}
        print('FAIL '+name+': '+str(e), flush=True)
    RESULTS.append(entry)
    (LOG/'results.json').write_text(json.dumps(RESULTS, indent=2, ensure_ascii=False)+'\n')


def equal(actual, expected):
    assert actual == expected, f'Expected {expected!r}, got {actual!r}'
    return actual


def clone(name):
    ok(query('postgres', f'CREATE DATABASE {name} TEMPLATE fixture_base'))
    return name


def apply(db, migration, source=None):
    return query(db, file=BASE.parents[1]/'drizzle'/migration, transaction=True)


def catalog(db):
    return scalar(db, "SELECT string_agg(x, E'\\n' ORDER BY x) FROM (SELECT conrelid::regclass::text||':'||conname||':'||pg_get_constraintdef(oid) x FROM pg_constraint WHERE connamespace='public'::regnamespace UNION ALL SELECT tablename||':'||indexname||':'||indexdef FROM pg_indexes WHERE schemaname='public' UNION ALL SELECT table_name||':'||column_name||':'||udt_name||':'||is_nullable||':'||coalesce(column_default,'') FROM information_schema.columns WHERE table_schema='public' UNION ALL SELECT t.typname||':'||e.enumlabel||':'||e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace UNION ALL SELECT 'function:'||p.oid::regprocedure::text||':'||pg_get_functiondef(p.oid)||':'||coalesce(p.proacl::text,'') FROM pg_proc p WHERE p.pronamespace='public'::regnamespace UNION ALL SELECT 'trigger:'||tgname||':'||pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)) s")


def token(n):
    return f'{n:064x}'


def seed_reset(db, n, uid=1, expired=False):
    delta = '-1 hour' if expired else '1 hour'
    ok(query(db, f"INSERT INTO password_resets(user_id,token,expires_at) VALUES({uid},'{token(n)}',now()+interval '{delta}')"))


def consume(n, password='nova-hash-local-000000000000001'):
    return f"SELECT * FROM public.consume_password_reset_and_revoke_sessions('{token(n)}','{password}')"


def blocked_race(db, holder_sql, follower_sql, expected_follower, app):
    """Hold first mutation uncommitted; prove second backend waiting on Lock."""
    c1, env1 = cmd(db, 'BEGIN; '+holder_sql+'; SELECT pg_sleep(2); COMMIT;', app=app+'-holder')
    p1 = subprocess.Popen(c1, env=env1, cwd=str(BASE), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    p2 = None
    try:
        deadline = time.monotonic()+8
        while time.monotonic() < deadline:
            state = scalar(db, f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}-holder' AND wait_event='PgSleep'")
            if state == '1':
                break
            time.sleep(0.025)
        else:
            raise AssertionError('Holder did not reach PgSleep')
        c2, env2 = cmd(db, follower_sql, app=app+'-follower')
        p2 = subprocess.Popen(c2, env=env2, cwd=str(BASE), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        blocked = False
        deadline = time.monotonic()+1.5
        while time.monotonic() < deadline:
            state = scalar(db, f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}-follower' AND wait_event_type='Lock'")
            if state == '1':
                blocked = True
                break
            time.sleep(0.025)
        o1,e1 = p1.communicate(timeout=10)
        o2,e2 = p2.communicate(timeout=10)
        logpath = LOG/(app+'.log')
        logpath.write_text(f'HOLDER: {holder_sql}\nEXIT={p1.returncode}\n{o1}\n{e1}\nFOLLOWER: {follower_sql}\nEXIT={p2.returncode}\n{o2}\n{e2}\nLOCK_WAIT_OBSERVED={blocked}\n')
        assert blocked, 'No real lock contention observed'
        assert p1.returncode == 0, e1
        if expected_follower == 'empty':
            assert p2.returncode == 0 and o2.strip() == '', f'{o2} {e2}'
        elif expected_follower == '23505':
            assert p2.returncode != 0 and '23505' in e2, e2
        return {'lock_wait_observed': blocked, 'holder_exit': p1.returncode, 'follower_exit': p2.returncode, 'log': str(logpath)}
    finally:
        for p in (p1,p2):
            if p is not None and p.poll() is None:
                p.kill(); p.wait()


def gate_test(name, setup, migration, state='P0001'):
    db = clone(name)
    ok(query(db, setup))
    before = catalog(db)
    detail = expect_error(apply(db,migration), state)
    equal(catalog(db), before)
    return detail


# CREATE DATABASE cannot occur in multi-statement transaction implied by psql -c.
# Perform independent calls explicitly to avoid disguising fixture failures.
def execute_suite():
    ok(query('postgres','CREATE ROLE service_role NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE unprivileged NOLOGIN;'))
    ok(query('postgres','CREATE DATABASE fixture_base'))
    ok(query('fixture_base', file=BASE/'fixture.sql', transaction=True))
    record('isolation PostgreSQL16 socket-only', lambda: equal(scalar('fixture_base',"SELECT current_setting('server_version_num')::int/10000||'|'||current_setting('listen_addresses')||'|'||current_setting('unix_socket_directories')"), '16||'+str(RUN/'socket')))
    db = clone('original')
    record('0014 repository first transactional execution', lambda: ok(apply(db,M14)))
    before = catalog(db)
    def reapply14():
        detail = ok(apply(db,M14))
        equal(catalog(db),before)
        return detail
    record('0014 corrected reapply retains identical catalog',reapply14,'regression')
    record('0016 repository first transactional execution', lambda: ok(apply(db,M16)))
    record('0016 repository second transactional execution', lambda: ok(apply(db,M16)))
    record('0017 repository first transactional execution', lambda: ok(apply(db,M17)))
    record('0017 repository second transactional execution', lambda: ok(apply(db,M17)))
    record('0014 inferred payment tenant only from owner', lambda: equal(scalar(db,'SELECT user_id FROM pagamentos_assinatura WHERE id=1'),'1'))
    record('0014 payment belongs to another tenant forbidden', lambda: expect_error(query(db,"INSERT INTO pagamentos_assinatura(assinatura_id,user_id,cliente_id,valor_pago,mes_referencia,conta_caixa_id) VALUES(1,2,1,100,'2026-02',2)"),'23503'))
    record('0014 wrong client forbidden', lambda: expect_error(query(db,"INSERT INTO pagamentos_assinatura(assinatura_id,user_id,cliente_id,valor_pago,mes_referencia,conta_caixa_id) VALUES(1,1,3,100,'2026-02',1)"),'23503'))
    record('0014 another tenant cash account forbidden', lambda: expect_error(query(db,"INSERT INTO pagamentos_assinatura(assinatura_id,user_id,cliente_id,valor_pago,mes_referencia,conta_caixa_id) VALUES(1,1,1,100,'2026-02',2)"),'23503'))
    record('0014 duplicate subscription month forbidden', lambda: expect_error(query(db,"INSERT INTO pagamentos_assinatura(assinatura_id,user_id,cliente_id,valor_pago,mes_referencia,conta_caixa_id) VALUES(1,1,1,100,'2026-01',1)"),'23505'))
    record('0014 transaction wrong tenant forbidden', lambda: expect_error(query(db,"INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,pagamento_assinatura_id) VALUES(2,2,'entrada','pagamento_assinatura',100,1)"),'23503'))
    record('0014 transaction null tenant forbidden', lambda: expect_error(query(db,"INSERT INTO transacoes_caixa(conta_caixa_id,tipo,categoria,valor,pagamento_assinatura_id) VALUES(1,'entrada','pagamento_assinatura',100,1)"),'23514'))
    def duplicate_tx():
        ok(query(db,"INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,pagamento_assinatura_id) VALUES(1,1,'entrada','pagamento_assinatura',100,1)"))
        return expect_error(query(db,"INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,pagamento_assinatura_id) VALUES(1,1,'entrada','pagamento_assinatura',100,1)"),'23505')
    record('0014 only one cash transaction per payment',duplicate_tx)
    record('0014 restrict delete referenced subscription', lambda: expect_error(query(db,'DELETE FROM assinaturas WHERE id=1'),'23503'))
    record('0014 recognized financial operation now accepted', lambda: ok(query(db,"INSERT INTO operacoes_financeiras(id,user_id,tipo,chave_idempotencia,hash_requisicao) VALUES(gen_random_uuid(),1,'pagamento_assinatura',gen_random_uuid(),'local')")))
    record('0014 unknown financial operation rejected', lambda: expect_error(query(db,"INSERT INTO operacoes_financeiras(id,user_id,tipo,chave_idempotencia,hash_requisicao) VALUES(gen_random_uuid(),1,'unknown',gen_random_uuid(),'local')"),'23514'))
    record('0016 initial session_version default zero', lambda: equal(scalar(db,'SELECT session_version FROM users WHERE id=1'),'0'))
    record('0016 profile edit does not revoke sessions', lambda: equal(scalar(db,"UPDATE users SET name='novo perfil' WHERE id=1 RETURNING session_version").splitlines()[0],'0'))
    record('0016 unchanged hash does not revoke sessions', lambda: equal(scalar(db,'UPDATE users SET "passwordHash"="passwordHash" WHERE id=1 RETURNING session_version').splitlines()[0],'0'))
    record('0016 changed hash overrides injected session_version and revokes', lambda: equal(scalar(db,"UPDATE users SET \"passwordHash\"='hash-local-direta-00000000001',session_version=999 WHERE id=1 RETURNING session_version").splitlines()[0],'1'))
    record('0016 negative session_version forbidden', lambda: expect_error(query(db,'UPDATE users SET session_version=-1 WHERE id=1'),'23514'))
    record('0016 null session_version forbidden on fresh schema', lambda: expect_error(query(db,'UPDATE users SET session_version=NULL WHERE id=1'),'23502'))
    for role in ('anon','authenticated','unprivileged'):
        record('0016 ACL execute denied '+role, lambda role=role: expect_error(query(db,f"SET ROLE {role}; "+consume(900)),'42501'))
    record('0016 ACL service has execute but no direct tables',lambda: equal(scalar(db,"SELECT has_function_privilege('service_role','public.consume_password_reset_and_revoke_sessions(text,text)','EXECUTE')||'|'||has_table_privilege('service_role','public.users','UPDATE')||'|'||has_table_privilege('service_role','public.password_resets','UPDATE')"),'true|false|false'))
    record('0016 invalid token length SQLSTATE 22023',lambda: expect_error(query(db,"SET ROLE service_role; SELECT * FROM consume_password_reset_and_revoke_sessions('short','hash-nova-local-000000000000')"),'22023'))
    record('0016 password too short SQLSTATE 22023',lambda: expect_error(query(db,f"SET ROLE service_role; SELECT * FROM consume_password_reset_and_revoke_sessions('{token(901)}','short')"),'22023'))
    def valid_reset():
        seed_reset(db,100)
        before=int(scalar(db,'SELECT session_version FROM users WHERE id=1'))
        output=ok(query(db,'SET ROLE service_role; '+consume(100)))
        assert f'1|{before+1}' in output, output
        equal(scalar(db,f"SELECT usado FROM password_resets WHERE token='{token(100)}'"),'t')
        equal(scalar(db,'SELECT "passwordHash" FROM users WHERE id=1'),'nova-hash-local-000000000000001')
        return {'returned':output,'session_version':before+1}
    record('0016 service real reset consumes token and revokes atomically',valid_reset)
    record('0016 token replay returns no row', lambda: equal(scalar(db,consume(100)),''))
    def expired():
        seed_reset(db,101,expired=True)
        equal(scalar(db,consume(101)),'')
        return equal(scalar(db,f"SELECT usado FROM password_resets WHERE token='{token(101)}'"),'f')
    record('0016 expired token not consumed',expired)
    record('0016 nonexistent token returns no row', lambda: equal(scalar(db,consume(999)),''))
    def reset_rollback():
        seed_reset(db,102)
        before=scalar(db,'SELECT "passwordHash"||\'|\'||session_version FROM users WHERE id=1')
        ok(query(db,'BEGIN; '+consume(102,'hash-transacao-rollback-00000001')+'; ROLLBACK;'))
        equal(scalar(db,'SELECT "passwordHash"||\'|\'||session_version FROM users WHERE id=1'),before)
        return equal(scalar(db,f"SELECT usado FROM password_resets WHERE token='{token(102)}'"),'f')
    record('0016 explicit transaction rollback restores token hash version',reset_rollback)
    def orphan():
        seed_reset(db,103,uid=99999)
        detail=expect_error(query(db,consume(103)),'23503')
        equal(scalar(db,f"SELECT usado FROM password_resets WHERE token='{token(103)}'"),'f')
        return detail
    record('0016 nonexistent user rollback preserves token',orphan)
    def failure_after_consume():
        seed_reset(db,104)
        before=scalar(db,'SELECT "passwordHash"||\'|\'||session_version FROM users WHERE id=1')
        ok(query(db,'ALTER TABLE users ADD CONSTRAINT local_fail_hash CHECK ("passwordHash" <> \'hash-forced-failure-0000000001\')'))
        detail=expect_error(query(db,consume(104,'hash-forced-failure-0000000001')),'23514')
        equal(scalar(db,f"SELECT usado FROM password_resets WHERE token='{token(104)}'"),'f')
        equal(scalar(db,'SELECT "passwordHash"||\'|\'||session_version FROM users WHERE id=1'),before)
        ok(query(db,'ALTER TABLE users DROP CONSTRAINT local_fail_hash'))
        return detail
    record('0016 failure during user update rolls back prior token UPDATE',failure_after_consume)
    def reset_race():
        seed_reset(db,105)
        before=int(scalar(db,'SELECT session_version FROM users WHERE id=1'))
        detail=blocked_race(db,consume(105,'hash-concorrencia-primeira-00001'),consume(105,'hash-concorrencia-segunda-000001'),'empty','reset-race')
        equal(scalar(db,'SELECT session_version FROM users WHERE id=1'),str(before+1))
        equal(scalar(db,'SELECT "passwordHash" FROM users WHERE id=1'),'hash-concorrencia-primeira-00001')
        return detail
    record('0016 real concurrent same token exactly one winner',reset_race)
    record('0017 duplicate order forbidden',lambda: expect_error(query(db,"INSERT INTO kiwify_webhooks(order_id) VALUES('pedido-base')"),'23505'))
    record('0017 real concurrent order reservation exactly one winner',lambda: blocked_race(db,"INSERT INTO kiwify_webhooks(order_id) VALUES('pedido-concorrente')","INSERT INTO kiwify_webhooks(order_id) VALUES('pedido-concorrente')",'23505','kiwify-race'))
    record('0014 gate tenantless subscription + DDL rollback',lambda: gate_test('gate14null','UPDATE assinaturas SET user_id=NULL WHERE id=1',M14))
    record('0014 gate wrong cash tenant + DDL rollback',lambda: gate_test('gate14tenant','UPDATE pagamentos_assinatura SET conta_caixa_id=2 WHERE id=1',M14))
    record('0014 gate duplicate month + DDL rollback',lambda: gate_test('gate14dup',"INSERT INTO pagamentos_assinatura(assinatura_id,cliente_id,valor_pago,mes_referencia,conta_caixa_id) VALUES(1,1,100,'2026-01',1)",M14))
    record('0016 gate ambiguous hash columns + DDL rollback',lambda: gate_test('gate16amb','ALTER TABLE users ADD COLUMN password_hash text',M16))
    record('0016 gate missing reset column + DDL rollback',lambda: gate_test('gate16missing','ALTER TABLE password_resets DROP COLUMN usado',M16))
    record('0016 gate invalid legacy session version + rollback',lambda: gate_test('gate16negative','ALTER TABLE users ADD COLUMN session_version integer; UPDATE users SET session_version=-1',M16))
    record('0017 gate null existing order + rollback',lambda: gate_test('gate17null','INSERT INTO kiwify_webhooks(order_id) VALUES(NULL)',M17))
    record('0017 gate blank existing order + rollback',lambda: gate_test('gate17blank',"INSERT INTO kiwify_webhooks(order_id) VALUES('   ')",M17))
    record('0017 gate duplicate existing order + rollback',lambda: gate_test('gate17dup',"INSERT INTO kiwify_webhooks(order_id) VALUES('pedido-base')",M17))
    record('0017 gate nonunique namesake index + rollback',lambda: gate_test('gate17index','CREATE INDEX kiwify_webhooks_order_id_uk ON kiwify_webhooks(order_id)',M17))
    def snake():
        sdb=clone('snake')
        ok(query(sdb,'ALTER TABLE users RENAME COLUMN "passwordHash" TO password_hash; ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at'))
        ok(apply(sdb,M16)); ok(apply(sdb,M16)); seed_reset(sdb,200)
        equal(scalar(sdb,consume(200)),'1|1')
        return equal(scalar(sdb,'SELECT password_hash FROM users WHERE id=1'),'nova-hash-local-000000000000001')
    record('0016 snake_case DDL twice and functional reset',snake)
    def post_nulls():
        expect_error(query(db,"INSERT INTO kiwify_webhooks(order_id) VALUES(NULL)"),'23502')
        expect_error(query(db,"INSERT INTO kiwify_webhooks(order_id) VALUES('')"),'23514')
        expect_error(query(db,"INSERT INTO kiwify_webhooks(order_id) VALUES('   ')"),'23514')
        return equal(scalar(db,"SELECT count(*) FROM kiwify_webhooks WHERE order_id IS NULL OR btrim(order_id)=''"),'0')
    record('0017 future null/blank orders rejected',post_nulls,'regression')
    record('0017 wrong unique namesake rejected + catalog rollback',lambda: gate_test('wrongunique','CREATE UNIQUE INDEX kiwify_webhooks_order_id_uk ON kiwify_webhooks(id)',M17),'regression')
    record('0017 table namesake rejected + catalog rollback',lambda: gate_test('wrongtable','CREATE TABLE kiwify_webhooks_order_id_uk (id integer)',M17),'regression')
    def legacy_nullable():
        ndb=clone('nullableversion')
        ok(query(ndb,'ALTER TABLE users ADD COLUMN session_version integer; UPDATE users SET session_version=0'))
        ok(apply(ndb,M16));ok(apply(ndb,M16))
        expect_error(query(ndb,'UPDATE users SET session_version=NULL WHERE id=1'),'23502')
        seed_reset(ndb,201)
        equal(scalar(ndb,consume(201)),'1|1')
        return equal(scalar(ndb,"SELECT is_nullable||'|'||column_default FROM information_schema.columns WHERE table_name='users' AND column_name='session_version'"),'NO|0')
    record('0016 existing nullable version hardened + reset increments',legacy_nullable,'regression')
    ok(query('original','SELECT version()'))
    counts={category:{status:sum(r['category']==category and r['status']==status for r in RESULTS) for status in ('PASS','FAIL')} for category in ('test','regression')}
    summary={'local_only':True,'counts':counts,'total':len(RESULTS),'run':str(RUN),'repo_ddl_twice':{'0014':True,'0016':True,'0017':True}}
    (LOG/'summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(summary,ensure_ascii=False),flush=True)
    return 1 if any(r['status']=='FAIL' for r in RESULTS) else 0

if __name__=='__main__':
    try:
        sys.exit(execute_suite())
    except Exception:
        traceback.print_exc()
        sys.exit(2)
