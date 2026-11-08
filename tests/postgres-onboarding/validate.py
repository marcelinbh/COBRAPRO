#!/usr/bin/env python3
"""PostgreSQL17 efêmero: fixtures sintéticas; nenhum segredo, TCP, dotenv ou produção."""
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import time

BASE, RUN, OWNER = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3]
BIN = '/usr/lib/postgresql/17/bin'
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': str(RUN)}
ROOT = BASE.parents[1]
MIGRATION = ROOT/'drizzle/0024_onboarding_transacional.sql'
RESULTS = []
SEQ = 0


def command(db, sql=None, file=None, app=None):
    args = [BIN+'/psql', '-X', '-q', '-h', str(RUN/'socket'), '-p', '55439', '-U', OWNER,
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
    (RUN/'logs/results.json').write_text(json.dumps(RESULTS, indent=2, ensure_ascii=False)+'\n')


def clone(name, template='ready'):
    scalar('postgres', f'CREATE DATABASE {name} TEMPLATE {template}')
    return name


def call(user=1, empresa="'Sintética'", nome="'Caixa Principal'", tipo="'caixa'"):
    return f'SELECT public.rpc_concluir_onboarding({user},{empresa},{nome},{tipo})'


def rpc(db, sql):
    return json.loads(scalar(db, 'SET ROLE service_role; '+sql))


def state(db):
    return scalar(db, "SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM public.users u),(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.contas_caixa c),(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.clientes c),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transacoes_caixa t))")


def immutable(db):
    # Todas contas preexistentes, cliente/ledger e usuário legado devem ser bit-a-bit iguais.
    return scalar(db, "SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.contas_caixa c WHERE id<=1000),(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.clientes c),(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transacoes_caixa t),(SELECT to_jsonb(u) FROM public.users u WHERE id=900))")


def catalog(db):
    return scalar(db, "SELECT jsonb_build_array((SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proacl::text,p.proowner::regrole::text,p.proargnames,p.proconfig,obj_description(p.oid,'pg_proc')) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'),(SELECT jsonb_agg(jsonb_build_array(relname,relacl::text,relrowsecurity,relforcerowsecurity) ORDER BY relname) FROM pg_class WHERE relnamespace='public'::regnamespace),(SELECT jsonb_agg(jsonb_build_array(table_name,column_name,data_type,character_maximum_length,numeric_precision,numeric_scale,is_nullable,column_default) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'))")


def isolated():
    version = scalar('postgres', "SELECT current_setting('server_version_num')::int/10000||'|'||current_setting('listen_addresses')||'|'||current_setting('unix_socket_directories')")
    equal(version, '17||'+str(RUN/'socket'))
    equal(os.stat(RUN/'socket').st_mode & 0o777, 0o700)
    assert not any(k in os.environ for k in ['DATABASE_URL','SUPABASE_URL','PGHOST','PGSERVICE','PGPASSWORD'])
    return {'postgres_major':17,'listen_addresses':'','private_socket':True,'clean_environment':True}


def fixture_metadata():
    db = 'ready'
    actual = json.loads(scalar(db, "SELECT jsonb_object_agg(t||'.'||c,jsonb_build_array(typ,nn,def)) FROM (SELECT cl.relname t,a.attname c,format_type(a.atttypid,a.atttypmod) typ,a.attnotnull nn,pg_get_expr(d.adbin,d.adrelid) def FROM pg_attribute a JOIN pg_class cl ON cl.oid=a.attrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE ns.nspname='public' AND cl.relname IN('users','contas_caixa') AND a.attnum>0 AND NOT a.attisdropped) m"))
    expected = {
        'users.id':['integer',True,None], 'users.onboarding_completo':['boolean',True,'false'],
        'users.nome_empresa':['character varying(255)',False,None], 'users.updatedAt':['timestamp with time zone',True,None],
        'contas_caixa.id':['integer',True,"nextval('contas_caixa_id_seq'::regclass)"],
        'contas_caixa.nome':['character varying(255)',True,None],
        'contas_caixa.tipo':['character varying(20)',True,"'caixa'::character varying"],
        'contas_caixa.saldo':['numeric(15,2)',True,'0'], 'contas_caixa.ativo':['boolean',True,'true'],
        'contas_caixa.createdAt':['timestamp with time zone',True,'now()'],
        'contas_caixa.updatedAt':['timestamp with time zone',True,'now()'],
        'contas_caixa.user_id':['integer',False,None],
    }
    equal(actual, expected)
    check = scalar(db,"SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.contas_caixa'::regclass AND contype='c'")
    for tipo in ['caixa','banco','digital']:
        assert tipo in check
    (BASE/'metadata-producao-fixture.json').write_text(json.dumps({'source':'Metadados fornecidos pelo usuário; fixture sintética, não dump de produção','postgres_major':17,'notes':['Default de users.updatedAt não informado; fixture sem default, seed explícito. A RPC escreve o timestamp.'],'columns':actual,'tipo_check':check},indent=2,ensure_ascii=False)+'\n')
    return {'columns':len(actual),'defaults_nullability_typmods_exact':True,'tipo_check':check}


def reapply():
    db = clone('reapply')
    before, data = catalog(db), state(db)
    for _ in range(3):
        ok(query(db,file=MIGRATION))
        equal(catalog(db),before)
        equal(state(db),data)
    return {'reapplications':3,'catalog_data_identical':True}


def first_and_replay():
    db = clone('first')
    before = immutable(db)
    r = rpc(db,call(empresa="E' \\tSintética\\n '",nome="' Caixa Principal '",tipo="' caixa '"))
    equal(r,{'success':True,'id':1,'conta_id':1001,'onboardingCompleto':True,'nomeEmpresa':'Sintética','nomeConta':'Caixa Principal','tipoConta':'caixa','repetida':False,'contaCriada':True})
    equal(scalar(db,"SELECT saldo::text||'|'||ativo||'|'||user_id FROM public.contas_caixa WHERE id=1001"),'0.00|true|1')
    after = state(db)
    replay = rpc(db,call())
    equal(replay,{**r,'repetida':True,'contaCriada':False})
    equal(state(db),after)
    for sql in [call(empresa="'Outra'"),call(nome="'Outra'"),call(tipo="'banco'")]:
        expect(query(db,'SET ROLE service_role; '+sql),'23505')
        equal(state(db),after)
    equal(immutable(db),before)
    equal(scalar(db,'SELECT count(*) FROM public.contas_caixa WHERE user_id=1'),'1')
    return {'account':r['conta_id'],'exact_replay_without_write':True,'three_payload_conflicts':True,'financial_legacy_unchanged':True}


def existing_accounts():
    db = clone('existing')
    before = immutable(db)
    r = rpc(db,call(2,nome="'Banco Existente'",tipo="'banco'"))
    equal(r['conta_id'],20); equal(r['contaCriada'],False)
    after = state(db)
    expect(query(db,'SET ROLE service_role; '+call(2,nome="'Segunda Ativa'")),'23505')
    equal(state(db),after)
    equal(rpc(db,call(2,nome="'Banco Existente'",tipo="'banco'"))['conta_id'],20)
    # Conta ativa alheia, homônima ou owner NULL nunca é adotada.
    equal(rpc(db,call(6,nome="'Banco Existente'",tipo="'banco'"))['contaCriada'],True)
    equal(rpc(db,call(7,nome="'Órfã'"))['contaCriada'],True)
    equal(immutable(db),before)
    return {'deterministic_min_active_id':20,'balances_timestamps_untouched':True,'foreign_null_owner_not_adopted':True}


def inactive_and_completed():
    db = clone('inactive')
    before = immutable(db)
    r = rpc(db,call(3))
    equal(r['contaCriada'],True)
    after = state(db)
    expect(query(db,'SET ROLE service_role; '+call(4,empresa="'Concluída'")),'23505')
    equal(state(db),after)
    r = rpc(db,call(5,empresa="'Concluída'"))
    equal(r['repetida'],True); equal(r['contaCriada'],False); equal(r['conta_id'],50)
    equal(state(db),after)
    equal(immutable(db),before)
    return {'incomplete_inactive_creates_explicit_new':True,'completed_inactive_conflict_no_reactivation':True,'completed_active_exact_no_update':True}


def validation():
    db = clone('invalid')
    before = state(db)
    invalid = [call(user='NULL'),call(user=0),call(user=-1),call(user=999),
        call(empresa='NULL'),call(empresa="' '"),call(empresa="repeat('x',256)"),
        call(nome='NULL'),call(nome="E'\\n\\t'"),call(nome="repeat('x',256)"),
        call(tipo='NULL'),call(tipo="'crypto'"),call(empresa="U&'\\00A0\\2000'")]
    for sql in invalid:
        expect(query(db,'SET ROLE service_role; '+sql),'42501' if '999,' in sql else '22023')
        equal(state(db),before)
    expect(query(db,"SET ROLE service_role; SELECT public.rpc_concluir_onboarding(p_owner_id=>1,p_nome_empresa=>'X',p_nome_conta=>'X',p_tipo_conta=>'caixa')"),'42883')
    for i,tipo in [(8,'caixa'),(9,'banco'),(10,'digital')]:
        r = rpc(db,call(i,empresa="repeat('😀',255)",tipo=f"'{tipo}'"))
        equal(len(r['nomeEmpresa']),255); equal(r['tipoConta'],tipo)
    return {'invalid_payloads_no_writes':len(invalid),'255_unicode_codepoints':True,'all_types':True,'unknown_named_owner_fails':True}


def grants_rls_searchpath():
    db = clone('security')
    oid = "'public.rpc_concluir_onboarding(integer,text,text,text)'::regprocedure"
    equal(scalar(db,f"SELECT prosecdef||'|'||array_to_string(proconfig,';')||'|'||proargnames::text FROM pg_proc WHERE oid={oid}"),'true|search_path=pg_catalog, pg_temp|{p_user_id,p_nome_empresa,p_nome_conta,p_tipo_conta}')
    equal(scalar(db,f"SELECT has_function_privilege('service_role',{oid},'EXECUTE') AND NOT has_function_privilege('anon',{oid},'EXECUTE') AND NOT has_function_privilege('authenticated',{oid},'EXECUTE')"),'t')
    for role in ['anon','authenticated']:
        before = state(db)
        expect(query(db,f'SET ROLE {role}; '+call()),'42501')
        equal(state(db),before)
    for table in ['users','contas_caixa','clientes','transacoes_caixa']:
        for privilege in ['SELECT','INSERT','UPDATE','DELETE']:
            equal(scalar(db,f"SELECT has_table_privilege('service_role','public.{table}','{privilege}')"),'f')
    equal(scalar(db,"SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN('public.users'::regclass,'public.contas_caixa'::regclass)"),'t')
    # Temp/public homonyms não entram no search_path nem substituem tabelas qualificadas.
    sql = """BEGIN; CREATE TEMP TABLE users(id integer); CREATE TEMP TABLE contas_caixa(id integer);
CREATE FUNCTION public.jsonb_build_object(VARIADIC text[]) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"success":false}'::jsonb $$;
SET search_path=pg_temp,public; SET ROLE service_role; """+call()+"; COMMIT;"
    r = json.loads(ok(query(db,sql)))
    equal(r['success'],True); equal(r['id'],1)
    return {'service_role_only_execute':True,'table_grants_unchanged':True,'rls_on':True,'temp_public_shadowing_safe':True}


def rollback_case(name, table, timing, event, trigger_body, error='23514'):
    db = clone(name)
    # Triggers e DML somente sobre fixture sintética. Ledger/cliente legado não têm DML.
    scalar(db,f"CREATE FUNCTION public.inject_failure() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN {trigger_body} END; $f$; CREATE TRIGGER injected {timing} {event} ON public.{table} FOR EACH ROW EXECUTE FUNCTION public.inject_failure()")
    before = state(db)
    expect(query(db,'SET ROLE service_role; '+call()),error)
    equal(state(db),before)
    return {'timing':timing,'event':event,'table':table,'all_business_rows_rolled_back':True}


def update_order():
    db = clone('write_order')
    scalar(db,"""CREATE FUNCTION public.require_saved_account() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE user_id=NEW.id AND ativo=true AND saldo=0) THEN RAISE EXCEPTION 'account missing'; END IF; RETURN NEW; END $$;
CREATE TRIGGER require_account BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.require_saved_account()""")
    equal(rpc(db,call())['success'],True)
    return {'user_completed_only_after_account_saved':True}


def race(db, different=False):
    app = db+'-race'
    args, env = command(db,'BEGIN; SET ROLE service_role; '+call()+'; SELECT pg_sleep(1.5); COMMIT;',app=app+'-holder')
    p1 = subprocess.Popen(args,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    p2 = None
    try:
        deadline = time.monotonic()+5
        while time.monotonic()<deadline:
            if scalar(db,f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}-holder' AND wait_event='PgSleep'") == '1':
                break
            time.sleep(.02)
        else:
            raise AssertionError('Holder did not reach transactional sleep')
        args, env = command(db,'SET ROLE service_role; '+call(empresa="'Diferente'" if different else "'Sintética'"),app=app+'-follower')
        p2 = subprocess.Popen(args,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        blocked = False
        deadline = time.monotonic()+1
        while time.monotonic()<deadline:
            if scalar(db,f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{app}-follower' AND wait_event_type='Lock'") == '1':
                blocked = True
                break
            time.sleep(.02)
        o1,e1 = p1.communicate(timeout=8); o2,e2 = p2.communicate(timeout=8)
        (RUN/'logs'/f'{app}.log').write_text(f'FIRST {p1.returncode}\n{o1}\n{e1}\nSECOND {p2.returncode}\n{o2}\n{e2}\nBLOCKED {blocked}')
        assert blocked, 'No actual row lock wait observed'
        assert p1.returncode == 0, e1
        first = json.loads(next(line for line in o1.splitlines() if line.startswith('{')))
        if different:
            assert p2.returncode != 0 and '23505' in e2, e2
        else:
            assert p2.returncode == 0, e2
            second = json.loads(o2.strip())
            equal(second,{**first,'repetida':True,'contaCriada':False})
        equal(scalar(db,'SELECT count(*) FROM public.contas_caixa WHERE user_id=1'),'1')
        return {'actual_lock_wait':True,'same_account':first['conta_id'],'account_count':1,'different_payload_conflict':different}
    finally:
        for p in (p1,p2):
            if p and p.poll() is None:
                p.kill(); p.wait()


def tamper(name, setup, template='ready'):
    db = clone(name,template)
    scalar(db,setup)
    before, data = catalog(db),state(db)
    expect(query(db,file=MIGRATION),'P0001')
    equal(catalog(db),before); equal(state(db),data)
    return {'installation_rejected_atomically':True,'catalog_data_preserved':True}


def no_financial_dml():
    source = MIGRATION.read_text()
    assert not re.search(r'\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.(?:clientes|transacoes_caixa)',source,re.I)
    assert not re.search(r'\b(?:UPDATE|DELETE\s+FROM)\s+public\.contas_caixa',source,re.I)
    equal(len(re.findall(r'\bINSERT INTO public\.contas_caixa',source)),1)
    equal(len(re.findall(r'\bUPDATE public\.users',source)),1)
    for forbidden in ['saldo_inicial','ativa:','ENABLE_RPC_ONBOARDING']:
        assert forbidden not in source
    return {'no_ledger_client_existing_account_dml':True,'only_one_insert_one_update_in_rpc':True}


record('isolated_socket_env_pg17', isolated)
ok(query('postgres',"CREATE ROLE service_role NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN"))
ok(query('postgres','CREATE DATABASE pristine'))
ok(query('pristine',file=BASE/'fixture.sql'))
clone('ready','pristine')
before = state('ready')
ok(query('ready',file=MIGRATION))
equal(state('ready'),before)
record('fixture_metadata_production_contract',fixture_metadata)
record('migration_reapply_hash_metadata_no_dml',reapply)
record('first_use_replay_exact_conflicts_legacy_immutable',first_and_replay)
record('deterministic_owner_active_account_no_balance_changes',existing_accounts)
record('inactive_preservation_and_completed_conflict',inactive_and_completed)
record('validation_trim_unicode_types_named_parameters',validation)
record('service_role_rls_grants_safe_searchpath',grants_rls_searchpath)
record('account_saved_before_user_update',update_order)

for name,table,timing,event,body in [
    ('insert_before_error','contas_caixa','BEFORE','INSERT',"RAISE EXCEPTION 'injected' USING ERRCODE='23514';"),
    ('insert_after_error','contas_caixa','AFTER','INSERT',"RAISE EXCEPTION 'injected' USING ERRCODE='23514';"),
    ('insert_suppressed','contas_caixa','BEFORE','INSERT','RETURN NULL;'),
    ('insert_owner_tamper','contas_caixa','BEFORE','INSERT','NEW.user_id:=2; RETURN NEW;'),
    ('insert_balance_tamper','contas_caixa','BEFORE','INSERT','NEW.saldo:=1; RETURN NEW;'),
    ('insert_inactive_tamper','contas_caixa','AFTER','INSERT','UPDATE public.contas_caixa SET ativo=false WHERE id=NEW.id; RETURN NEW;'),
    ('update_before_error','users','BEFORE','UPDATE',"RAISE EXCEPTION 'injected' USING ERRCODE='23514';"),
    ('update_after_error','users','AFTER','UPDATE',"RAISE EXCEPTION 'injected' USING ERRCODE='23514';"),
    ('update_suppressed','users','BEFORE','UPDATE','RETURN NULL;'),
    ('update_id_tamper','users','BEFORE','UPDATE','NEW.id:=99; RETURN NEW;'),
    ('update_company_tamper','users','BEFORE','UPDATE',"NEW.nome_empresa:='Adulterada'; RETURN NEW;"),
    ('update_account_tamper','users','AFTER','UPDATE','UPDATE public.contas_caixa SET ativo=false WHERE user_id=NEW.id; RETURN NEW;'),
]:
    record('rollback_'+name,lambda name=name,table=table,timing=timing,event=event,body=body:rollback_case(name,table,timing,event,body))
record('concurrent_identical_real_calls_one_account',lambda:race(clone('race_same')))
record('concurrent_divergent_payload_preserves_winner',lambda:race(clone('race_different'),True))

for name,setup,template in [
    ('homonym_body',"CREATE FUNCTION public.rpc_concluir_onboarding(p_user_id integer,p_nome_empresa text,p_nome_conta text,p_tipo_conta text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$",'pristine'),
    ('homonym_names',"CREATE FUNCTION public.rpc_concluir_onboarding(owner_id integer,company text,account text,kind text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$",'pristine'),
    ('wrong_signature',"CREATE FUNCTION public.rpc_concluir_onboarding(text,text,text,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$",'pristine'),
    ('overload',"CREATE FUNCTION public.rpc_concluir_onboarding(integer,text,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$",'ready'),
    ('security_invoker',"ALTER FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) SECURITY INVOKER",'ready'),
    ('unsafe_searchpath',"ALTER FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) SET search_path=public",'ready'),
    ('hash_comment',"COMMENT ON FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) IS 'forged'",'ready'),
    ('hash_body',"CREATE OR REPLACE FUNCTION public.rpc_concluir_onboarding(p_user_id integer,p_nome_empresa text,p_nome_conta text,p_tipo_conta text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN RETURN '{}'::jsonb; END; $$",'ready'),
    ('acl_anon',"GRANT EXECUTE ON FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) TO anon",'ready'),
    ('acl_public',"GRANT EXECUTE ON FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) TO PUBLIC",'ready'),
    ('acl_grant_option',"GRANT EXECUTE ON FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) TO service_role WITH GRANT OPTION",'ready'),
    ('owner',"ALTER FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) OWNER TO service_role",'ready'),
    ('volatility',"ALTER FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) IMMUTABLE",'ready'),
    ('strictness',"ALTER FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) STRICT",'ready'),
    ('parallelism',"ALTER FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) PARALLEL SAFE",'ready'),
    ('cost',"ALTER FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) COST 42",'ready'),
    ('unknown_default_grant',"ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO authenticated; CREATE ROLE onboarding_auditor NOLOGIN; ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO onboarding_auditor",'pristine'),
    ('leakproof',"ALTER FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) LEAKPROOF",'ready'),
    ('extra_config',"ALTER FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) SET statement_timeout='5s'",'ready'),
    ('table_homonym',"ALTER TABLE public.users RENAME TO users_real; CREATE VIEW public.users AS SELECT * FROM public.users_real",'pristine'),
    ('schema_typmod',"ALTER TABLE public.users ALTER COLUMN nome_empresa TYPE varchar(254)",'pristine'),
    ('schema_nullability',"ALTER TABLE public.users ALTER COLUMN onboarding_completo DROP NOT NULL",'pristine'),
]:
    record('failclosed_'+name,lambda name=name,setup=setup,template=template:tamper(name,setup,template))
record('static_no_financial_legacy_dml',no_financial_dml)

summary = {'suite':'onboarding-transacional-0024','postgres_major':17,'passed':sum(r['status']=='PASS' for r in RESULTS),
    'failed':sum(r['status']=='FAIL' for r in RESULTS),'results':RESULTS,'local_logs':str(RUN/'logs')}
summary['sha256_artifacts'] = {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [MIGRATION,ROOT/'server/services/onboardingRpc.ts',ROOT/'server/services/onboardingRpc.test.ts',BASE/'fixture.sql',BASE/'run.sh',BASE/'validate.py']}
canonical = json.dumps(summary,sort_keys=True,ensure_ascii=False).encode()
summary['sha256_result_signature'] = hashlib.sha256(canonical).hexdigest()
(BASE/'results-pg17.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n')
print(f"SUMMARY PG17 PASS={summary['passed']} FAIL={summary['failed']} SIGNATURE={summary['sha256_result_signature']}",flush=True)
sys.exit(1 if summary['failed'] else 0)
