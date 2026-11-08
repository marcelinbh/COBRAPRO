#!/usr/bin/env python3
"""Fixture sintético fiel; apenas socket privado, ambiente limpo e PostgreSQL local."""
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
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': str(RUN)}
MIGRATION = BASE.parents[1]/'drizzle/0020_rpc_despesas_prospectivas.sql'
RESULTS = []
SEQ = 0
KEY = 0

def key():
    global KEY
    KEY += 1
    return f'00000000-0000-4000-8000-{KEY:012d}'

def command(db, sql=None, file=None, app=None):
    args = [BIN+'/psql', '-X', '-q', '-h', str(RUN/'socket'), '-p', '55437', '-U', OWNER,
            '-d', db, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At']
    args += ['-f', str(file)] if file else ['-c', sql]
    env = dict(ENV)
    if app:
        env['PGAPPNAME'] = app
    return args, env

def query(db, sql=None, file=None):
    global SEQ
    SEQ += 1
    args, env = command(db, sql, file)
    r = subprocess.run(args, env=env, capture_output=True, text=True, timeout=25)
    r.log = str(RUN/'logs'/f'{SEQ:03d}-{db}.log')
    pathlib.Path(r.log).write_text(f'SQL: {sql}\nFILE: {file}\nEXIT={r.returncode}\n{r.stdout}\n{r.stderr}')
    return r

def ok(r):
    assert r.returncode == 0, f'{r.stderr} ({r.log})'
    return r.stdout.strip()

def scalar(db, sql):
    return ok(query(db, sql))

def expect(r, state):
    assert r.returncode != 0 and re.search(r'\b'+state+r'\b', r.stderr), f'Expected {state}: {r.stdout} {r.stderr}'
    return {'sqlstate': state, 'log': r.log}

def equal(a, b):
    assert a == b, f'{a!r} != {b!r}'
    return a

def record(name, fn):
    try:
        detail = fn()
        RESULTS.append({'name': name, 'status': 'PASS', 'detail': detail})
        print('PASS '+name, flush=True)
    except Exception as e:
        RESULTS.append({'name': name, 'status': 'FAIL', 'error': str(e)})
        print('FAIL '+name+': '+str(e), flush=True)
    (RUN/'logs/results.json').write_text(json.dumps(RESULTS, indent=2)+'\n')

def clone(name, template='ready'):
    name = name.lower()
    scalar('postgres', f'CREATE DATABASE {name} TEMPLATE {template}')
    return name

def create(k=None, user=1, value='100.01', due='2026-11-07', desc='Sintetica'):
    return f"SELECT public.rpc_criar_despesa_prospectiva({user},'{desc}','outros',{value},'{due}',NULL,'{k or key()}')"

def pay(d, k=None, user=1, account=1, date='2026-11-07'):
    return f"SELECT public.rpc_pagar_despesa_prospectiva({user},{d},{account},'{date}','{k or key()}')"

def reverse(d, p, k=None, user=1, date='2026-11-08'):
    return f"SELECT public.rpc_estornar_despesa_prospectiva({user},{d},'{p}','{date}','Estorno sintetico','{k or key()}')"

def rpc(db, sql):
    return json.loads(scalar(db, 'SET ROLE service_role; '+sql))

def seed(db):
    return rpc(db, create())['despesaId']

def business_state(db):
    return scalar(db, "SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM contas_pagar x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM transacoes_caixa x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM contas_caixa x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM despesas_rpc_operacoes x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY despesa_id) FROM despesas_rpc_origens x),(SELECT jsonb_agg(to_jsonb(x) ORDER BY despesa_id) FROM despesas_rpc_pagamentos x))")

def catalog(db):
    return scalar(db, "SELECT string_agg(x,E'\\n' ORDER BY x) FROM (SELECT conrelid::regclass::text||':'||conname||':'||pg_get_constraintdef(oid) x FROM pg_constraint WHERE connamespace='public'::regnamespace UNION ALL SELECT tablename||':'||indexname||':'||indexdef FROM pg_indexes WHERE schemaname='public' UNION ALL SELECT table_name||':'||column_name||':'||udt_name||':'||is_nullable||':'||coalesce(column_default,'') FROM information_schema.columns WHERE table_schema='public' UNION ALL SELECT 'function:'||p.oid::regprocedure::text||':'||pg_get_functiondef(p.oid)||':'||coalesce(p.proacl::text,'') FROM pg_proc p WHERE p.pronamespace='public'::regnamespace UNION ALL SELECT 'acl:'||relname||':'||coalesce(relacl::text,'')||':'||relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace) s")

def race(db, first, second, second_state=None):
    app = db+'-race'
    c, env = command(db, 'BEGIN; SET ROLE service_role; '+first+'; SELECT pg_sleep(1.5); COMMIT;', app=app+'-holder')
    p1 = subprocess.Popen(c, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    p2 = None
    try:
        deadline = time.monotonic()+5
        while time.monotonic()<deadline:
            if scalar(db, f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}-holder' AND wait_event='PgSleep'") == '1':
                break
            time.sleep(.02)
        else:
            raise AssertionError('Holder failed to reach sleep')
        c, env = command(db, 'SET ROLE service_role; '+second, app=app+'-follower')
        p2 = subprocess.Popen(c, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        blocked = False
        deadline = time.monotonic()+1
        while time.monotonic()<deadline:
            if scalar(db, f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}-follower' AND wait_event_type='Lock'") == '1':
                blocked = True
                break
            time.sleep(.02)
        o1,e1 = p1.communicate(timeout=8)
        o2,e2 = p2.communicate(timeout=8)
        (RUN/'logs'/f'{app}.log').write_text(f'FIRST {p1.returncode}\n{o1}\n{e1}\nSECOND {p2.returncode}\n{o2}\n{e2}\nBLOCKED {blocked}')
        assert blocked, 'No actual lock contention observed'
        assert p1.returncode == 0, e1
        if second_state:
            assert p2.returncode != 0 and second_state in e2, e2
        else:
            assert p2.returncode == 0, e2
        return {'lock_wait_observed': True, 'first_exit': p1.returncode, 'second_exit': p2.returncode}
    finally:
        for p in (p1,p2):
            if p and p.poll() is None:
                p.kill()
                p.wait()

def full_flow():
    db=clone('full_flow')
    historical=scalar(db,"SELECT to_jsonb(d)::text FROM contas_pagar d WHERE id=900")
    base=scalar(db,'SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contas_caixa c')
    k=key(); sql=create(k); d=rpc(db,sql)
    equal(rpc(db,sql),d)
    pk=key(); sqlp=pay(d['despesaId'],pk); p=rpc(db,sqlp)
    equal(rpc(db,sqlp),p)
    equal(p['valor'],'100.01'); equal(p['status'],'pago')
    equal(scalar(db,"SELECT 1000+sum(CASE tipo WHEN 'entrada' THEN valor ELSE -valor END) FROM transacoes_caixa WHERE conta_caixa_id=1"),'899.99')
    rk=key(); sqlr=reverse(d['despesaId'],p['operationId'],rk); r=rpc(db,sqlr)
    equal(rpc(db,sqlr),r)
    equal(r['status'],'cancelado'); equal(r['dataPagamento'],'2026-11-07')
    equal(scalar(db,'SELECT sum(CASE tipo WHEN \'entrada\' THEN valor ELSE -valor END) FROM transacoes_caixa WHERE conta_caixa_id=1'),'0.00')
    equal(scalar(db,'SELECT count(*) FROM transacoes_caixa WHERE conta_caixa_id=1'),'2')
    equal(scalar(db,"SELECT count(*) FROM despesas_rpc_operacoes WHERE auditoria ? 'depois' AND octet_length(hash_payload)=32"),'3')
    equal(scalar(db,'SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contas_caixa c'),base)
    equal(scalar(db,"SELECT to_jsonb(d)::text FROM contas_pagar d WHERE id=900"),historical)
    expect(query(db, pay(d['despesaId'])), '23514')
    expect(query(db, reverse(d['despesaId'],p['operationId'])), '23514')
    return {'create_pay_reverse_replay_exact':True,'base_unchanged':True,'ledger_net':'0.00','audits':3}

def conflicts():
    db=clone('conflicts')
    k=key(); d=rpc(db,create(k))
    before=business_state(db)
    expect(query(db,create(k,value='100.02')),'23505')
    expect(query(db,pay(d['despesaId'],k)),'23505')
    equal(business_state(db),before)
    return 'same key/different payload or action: no effects'

def cross_tenant():
    db=clone('tenants'); d=seed(db)
    for sql,state in [(pay(d,user=2,account=2),'42501'),(pay(d,account=2),'42501'),(pay(d,account=4),'42501'),(create(user=999),'42501'),(pay(900),'23514'),(pay(d,account=3),'23514')]:
        before=business_state(db); expect(query(db,sql),state); equal(business_state(db),before)
    p=rpc(db,pay(d)); before=business_state(db)
    expect(query(db,reverse(d,p['operationId'],user=2)),'42501'); equal(business_state(db),before)
    return 'legacy, other owner/user, inactive and divergent-owner accounts fail closed'

def monetary():
    db=clone('money')
    for value in ['0','-1','0.001','1.230',"'NaN'::numeric","'Infinity'::numeric",'10000000000000']:
        before=business_state(db); expect(query(db,create(value=value)),'22023'); equal(business_state(db),before)
    d=rpc(db,create(value='9999999999999.99')); equal(d['valor'],'9999999999999.99')
    rpc(db,pay(d['despesaId']))
    expect(query(db,create(due='infinity')),'22023')
    expect(query(db,create(due='2026-02-30')),'22008')
    return 'scale/finite/positive/bounds/date checked; exact maximum accepted'

def tamper(which, mutation, after_pay=False):
    db=clone('tamper_'+which); d=seed(db)
    p=rpc(db,pay(d)) if after_pay else None
    scalar(db, mutation.format(d=d,p=p['operationId'] if p else ''))
    before=business_state(db)
    expect(query(db,reverse(d,p['operationId']) if p else pay(d)),'23514')
    equal(business_state(db),before)
    return 'no new debit/credit; transaction fully unchanged'

def no_original():
    db=clone('no_original'); d=seed(db)
    before=business_state(db); expect(query(db,reverse(d,key())),'23514'); equal(business_state(db),before)
    p=rpc(db,pay(d)); before=business_state(db)
    expect(query(db,reverse(d,key())),'23514'); equal(business_state(db),before)
    # FK prevents original deletion even by legacy DELETE path. Prove RPC also rejects
    # a missing original after privileged, test-only corruption bypassing the FK.
    expect(query(db,f"DELETE FROM transacoes_caixa WHERE id={p['transacaoSaidaId']}"),'23503')
    scalar(db,f"SET session_replication_role=replica; DELETE FROM transacoes_caixa WHERE id={p['transacaoSaidaId']}; RESET session_replication_role")
    before=business_state(db); expect(query(db,reverse(d,p['operationId'])),'23514'); equal(business_state(db),before)
    return 'no payment/wrong payment/missing original cannot create credit; normal DELETE FK blocked'

def induced(action, table, event):
    db=clone(f'failure_{action}_{table}_{event}')
    d=seed(db) if action!='criar' else None
    p=rpc(db,pay(d)) if action=='estornar' else None
    scalar(db,f"CREATE FUNCTION test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'induced failure' USING ERRCODE='P0001'; END $$; CREATE TRIGGER test_fail AFTER {event} ON {table} FOR EACH ROW EXECUTE FUNCTION test_fail()")
    before=business_state(db)
    sql=create() if action=='criar' else pay(d) if action=='pagar' else reverse(d,p['operationId'])
    expect(query(db,sql),'P0001'); equal(business_state(db),before)
    scalar(db,f'DROP TRIGGER test_fail ON {table}')
    rpc(db,sql)  # same key after rollback succeeds
    return 'zero persisted writes, same-key retry succeeds'

def migration_twice():
    db=clone('twice')
    d=seed(db); rpc(db,pay(d)); before=business_state(db); c=catalog(db)
    ok(query(db,file=MIGRATION)); equal(catalog(db),c); equal(business_state(db),before)
    return 'catalog/data preserved exactly on reapply'

def bad_contract(name, setup, template='fixture_base'):
    db=clone('gate_'+name,template); scalar(db,setup); before=catalog(db)
    expect(query(db,file=MIGRATION),'P0001'); equal(catalog(db),before)
    return 'migration refuses incompatible namesake; all DDL rolled back'

def acl():
    db=clone('acl')
    for role in ('anon','authenticated','unprivileged'):
        for sql in (create(),pay(900),reverse(900,key()),"SELECT * FROM despesas_rpc_origens", "INSERT INTO despesas_rpc_origens VALUES(900,1,gen_random_uuid(),'{}',now())", "SELECT despesas_rpc_executar(1,gen_random_uuid(),'criar','{}')", "SELECT nextval('contas_pagar_id_seq')"):
            expect(query(db,f'SET ROLE {role}; '+sql),'42501')
    for table in ('despesas_rpc_origens','despesas_rpc_pagamentos','despesas_rpc_operacoes'):
        equal(scalar(db,f"SELECT relrowsecurity FROM pg_class WHERE oid='public.{table}'::regclass"),'t')
        expect(query(db,f'SET ROLE service_role; DELETE FROM {table}'),'42501')
    expect(query(db,"SET ROLE service_role; SELECT despesas_rpc_executar(1,gen_random_uuid(),'criar','{}')"),'42501')
    d=rpc(db,create()); p=rpc(db,pay(d['despesaId'])); rpc(db,reverse(d['despesaId'],p['operationId']))
    return 'three wrappers service_role allowed; clients/internal/direct writes denied; RLS enabled'

def concurrent_payment():
    db=clone('concurrent_pay'); d=seed(db)
    result=race(db,pay(d),pay(d),'23514')
    equal(scalar(db,'SELECT count(*) FROM transacoes_caixa WHERE conta_caixa_id=1'),'1')
    return result

def concurrent_replay():
    db=clone('concurrent_replay'); d=seed(db); sql=pay(d)
    result=race(db,sql,sql)
    equal(scalar(db,'SELECT count(*) FROM transacoes_caixa WHERE conta_caixa_id=1'),'1')
    return result

def concurrent_reverse():
    db=clone('concurrent_reverse'); d=seed(db); p=rpc(db,pay(d))
    result=race(db,reverse(d,p['operationId']),reverse(d,p['operationId']),'23514')
    equal(scalar(db,"SELECT sum(CASE tipo WHEN 'entrada' THEN valor ELSE -valor END) FROM transacoes_caixa WHERE conta_caixa_id=1"),'0.00')
    return result

def uncommitted_payment_reverse():
    db=clone('uncommitted_pay_reverse'); d=seed(db)
    # psql flushes each completed query result. Read the new UUID before COMMIT,
    # while a separate connection cannot yet see the payment row.
    args,env=command(db,'',app=db+'-holder')
    args=args[:-2]+['-c','BEGIN; SET ROLE service_role;','-c',pay(d),'-c','SELECT pg_sleep(1.5); COMMIT;']
    p1=subprocess.Popen(['/usr/bin/stdbuf','-oL']+args,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    p2=None
    try:
        first=p1.stdout.readline().strip()
        payment=json.loads(first)
        args,env=command(db,'SET ROLE service_role; '+reverse(d,payment['operationId']),app=db+'-follower')
        p2=subprocess.Popen(args,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        blocked=False; deadline=time.monotonic()+1
        while time.monotonic()<deadline:
            if scalar(db,f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{db}-follower' AND wait_event_type='Lock'")=='1':
                blocked=True;break
            time.sleep(.02)
        o1,e1=p1.communicate(timeout=8);o2,e2=p2.communicate(timeout=8)
        assert blocked, 'Reverser did not wait for uncommitted payment'
        assert p1.returncode==0 and p2.returncode==0, e1+e2
        equal(json.loads(o2)['pagamentoOperationId'],payment['operationId'])
        equal(scalar(db,"SELECT sum(CASE tipo WHEN 'entrada' THEN valor ELSE -valor END) FROM transacoes_caixa WHERE conta_caixa_id=1"),'0.00')
        return {'uncommitted_payment_lock_wait_observed':True,'net':'0.00'}
    finally:
        for p in (p1,p2):
            if p and p.poll() is None:p.kill();p.wait()

def timezones():
    db=clone('timezones')
    d=json.loads(scalar(db,"SET TimeZone='Pacific/Kiritimati'; SET ROLE service_role; "+create()))
    p=json.loads(scalar(db,"SET TimeZone='America/Sao_Paulo'; SET ROLE service_role; "+pay(d['despesaId'])))
    r=json.loads(scalar(db,"SET TimeZone='Pacific/Honolulu'; SET ROLE service_role; "+reverse(d['despesaId'],p['operationId'])))
    equal(r['dataPagamento'],'2026-11-07');equal(r['dataEstorno'],'2026-11-08')
    return 'snapshots UTC stable across sessions; civil dates unchanged'

def payment_reverse_race():
    db=clone('pay_reverse'); d=seed(db); sql=pay(d)
    # Obtain the future payment operation UUID inside a holder, then hold it uncommitted.
    # The reverser cannot read it yet: communicate via psql output before sleep.
    # Preallocate deterministically via actual SQL returning operation and use a reverse
    # in the holder first (payment already committed); this still exercises the shared
    # expense lock against a concurrent second payment with another key.
    p=rpc(db,sql)
    result=race(db,reverse(d,p['operationId']),pay(d),'23514')
    equal(scalar(db,"SELECT count(*) FROM transacoes_caixa WHERE conta_caixa_id=1"),'2')
    return result

def cancel_race():
    db=clone('cancel_race'); d=seed(db)
    # A legacy conditional cancel that wins first invalidates the full origin snapshot.
    app=db+'-race'
    # Run direct cancellation as owner, then payment must wait and fail snapshot/state.
    c,env=command(db,f"BEGIN; UPDATE contas_pagar SET status='cancelado' WHERE id={d} AND status='pendente'; SELECT pg_sleep(1.5); COMMIT;",app=app)
    p=subprocess.Popen(c,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            if scalar(db,f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}' AND wait_event='PgSleep'")=='1':break
            time.sleep(.02)
        expect(query(db,pay(d)),'23514'); o,e=p.communicate(timeout=5); equal(p.returncode,0)
        equal(scalar(db,'SELECT count(*) FROM transacoes_caixa WHERE conta_caixa_id=1'),'0')
    finally:
        if p.poll() is None:p.kill();p.wait()
    expect(query(db,f'DELETE FROM contas_pagar WHERE id={d}'),'23503')
    return 'cancel winner blocks payment; FK blocks legacy physical deletion of new expense'

def main():
    scalar('postgres','CREATE ROLE service_role NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE unprivileged NOLOGIN')
    scalar('postgres','CREATE DATABASE fixture_base')
    ok(query('fixture_base',file=BASE/'fixture.sql'))
    record('isolated socket-only PostgreSQL16',lambda:equal(scalar('fixture_base',"SELECT current_setting('server_version_num')::int/10000||'|'||current_setting('listen_addresses')||'|'||current_setting('unix_socket_directories')"),'16||'+str(RUN/'socket')))
    clone('ready','fixture_base')
    record('0020 installs on production expense shape without 0013/0015',lambda:ok(query('ready',file=MIGRATION)))
    # No other migration is read/executed in this test suite.
    if any(r['status']=='FAIL' for r in RESULTS):return 1
    record('0020 reapply catalog and data identical',migration_twice)
    record('integral create/pay/reverse, lost-response exact replay and preserved base/history',full_flow)
    record('payload/action conflict has no effects',conflicts)
    record('tenant/provenance/inactive/divergent-owner gates',cross_tenant)
    record('numeric positive scale finite maximum and civil dates',monetary)
    record('backend-only ACL and RLS real execution',acl)
    record('tamper original expense value',lambda:tamper('value','UPDATE contas_pagar SET valor=101 WHERE id={d}'))
    record('tamper original expense description',lambda:tamper('description',"UPDATE contas_pagar SET descricao='alterada' WHERE id={d}"))
    record('tamper origin snapshot',lambda:tamper('origin',"UPDATE despesas_rpc_origens SET snapshot=jsonb_set(snapshot,'{{descricao}}','\"adulterada\"') WHERE despesa_id={d}"))
    record('tamper paid expense account',lambda:tamper('account','UPDATE contas_pagar SET conta_caixa_id=3 WHERE id={d}',True))
    record('tamper original debit value',lambda:tamper('debit','UPDATE transacoes_caixa SET valor=101 WHERE id=(SELECT saida_id FROM despesas_rpc_pagamentos WHERE despesa_id={d})',True))
    record('tamper payment audit',lambda:tamper('audit',"UPDATE despesas_rpc_operacoes SET auditoria=jsonb_set(auditoria,'{{saida,descricao}}','\"alterada\"') WHERE id='{p}'",True))
    record('reversal without original debit / deleted debit',no_original)
    for action,events in {
        'criar':[('contas_pagar','INSERT'),('despesas_rpc_origens','INSERT'),('despesas_rpc_operacoes','INSERT')],
        'pagar':[('transacoes_caixa','INSERT'),('contas_pagar','UPDATE'),('despesas_rpc_pagamentos','INSERT'),('despesas_rpc_operacoes','INSERT')],
        'estornar':[('transacoes_caixa','INSERT'),('contas_pagar','UPDATE'),('despesas_rpc_pagamentos','UPDATE'),('despesas_rpc_operacoes','INSERT')],
    }.items():
        for table,event in events:
            record(f'rollback after {action} {table} {event}',lambda a=action,t=table,e=event:induced(a,t,e))
    record('real concurrent payment distinct keys one debit',concurrent_payment)
    record('real concurrent same-key replay one debit',concurrent_replay)
    record('real concurrent reversals one credit',concurrent_reverse)
    record('real uncommitted payment vs reversal waits then credits exact debit',uncommitted_payment_reverse)
    record('real concurrent reversal vs payment no second debit',payment_reverse_race)
    record('snapshot timezone and civil-date stability',timezones)
    record('legacy cancel/delete races preserve prospective guards',cancel_race)
    gates=[
        ('wrong_type',"CREATE TABLE despesas_rpc_operacoes(id integer)"),
        ('wrong_schema',"CREATE SCHEMA alternate; CREATE TABLE alternate.despesas_rpc_origens(id integer)"),
        ('wrong_check',"ALTER TABLE contas_pagar DROP CONSTRAINT contas_pagar_status_check; ALTER TABLE contas_pagar ADD CONSTRAINT contas_pagar_status_check CHECK(status IN ('pendente','paga','cancelado'))"),
        ('wrong_date',"ALTER TABLE contas_pagar ALTER COLUMN data_pagamento TYPE timestamp USING data_pagamento::timestamp"),
        ('wrong_index',"CREATE INDEX despesas_rpc_operacoes_user_chave_uk ON contas_pagar(id)"),
    ]
    for name,setup in gates:
        state={'wrong_index':'42P07','wrong_type':'42830'}.get(name,'P0001')
        def test(n=name,s=setup,st=state):
            if st=='P0001':return bad_contract(n,s)
            db=clone('gate_'+n,'fixture_base');scalar(db,s);before=catalog(db)
            expect(query(db,file=MIGRATION),st);equal(catalog(db),before)
        record('migration fail-closed '+name,test)
    for name,setup in [
        ('missing_check','ALTER TABLE despesas_rpc_pagamentos DROP CONSTRAINT despesas_rpc_pagamentos_valor_check'),
        ('missing_fk','ALTER TABLE despesas_rpc_pagamentos DROP CONSTRAINT despesas_rpc_pagamentos_saida_id_fkey'),
        ('wrong_unique','ALTER TABLE despesas_rpc_operacoes DROP CONSTRAINT despesas_rpc_operacoes_user_chave_uk; ALTER TABLE despesas_rpc_operacoes ADD CONSTRAINT despesas_rpc_operacoes_user_chave_uk UNIQUE(chave_idempotencia)'),
        ('extra_column','ALTER TABLE despesas_rpc_origens ADD COLUMN unsafe text'),
        ('extra_policy','CREATE POLICY unsafe ON despesas_rpc_origens FOR ALL TO authenticated USING(true)'),
        ('table_grant','GRANT UPDATE ON despesas_rpc_origens TO unprivileged'),
        ('function_grant','GRANT EXECUTE ON FUNCTION rpc_pagar_despesa_prospectiva(integer,integer,integer,date,uuid) TO unprivileged'),
        ('function_overload',"CREATE FUNCTION rpc_pagar_despesa_prospectiva(text) RETURNS text LANGUAGE sql AS $$ SELECT $1 $$"),
    ]:
        record('reapply fail-closed '+name,lambda n=name,s=setup:bad_contract(n,s,'ready'))
    def column_grant_revoked():
        db=clone('column_grant')
        scalar(db,'GRANT UPDATE(snapshot) ON despesas_rpc_origens TO authenticated')
        ok(query(db,file=MIGRATION))
        equal(scalar(db,"SELECT has_column_privilege('authenticated','despesas_rpc_origens','snapshot','UPDATE')"),'f')
        return 'REVOKE ALL table also revokes client column grant; no effective access'
    record('reapply revokes client column ACL rather than leaving a bypass',column_grant_revoked)
    summary={'local_only':True,'postgres_major':16,'passed':sum(r['status']=='PASS' for r in RESULTS),'failed':sum(r['status']=='FAIL' for r in RESULTS),'total':len(RESULTS),'run':str(RUN)}
    (RUN/'logs/summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary),flush=True)
    return 1 if summary['failed'] else 0

if __name__=='__main__':
    try:sys.exit(main())
    except Exception:traceback.print_exc();sys.exit(2)
