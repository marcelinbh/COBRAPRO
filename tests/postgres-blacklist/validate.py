#!/usr/bin/env python3
"""Testes sintéticos por psql; não aceita DATABASE_URL nem lê .env."""
import json
import pathlib
import subprocess
import sys
import time

PSQL, SOCKET, PORT, USER, MIGRATION, FIXTURE, EVIDENCE = sys.argv[1:]
assert SOCKET.startswith('/tmp/cobrapro-blacklist-') and SOCKET.endswith('/socket')
EVIDENCE = pathlib.Path(EVIDENCE)
BASE = [PSQL, '-X', '-q', '-h', SOCKET, '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At']
TOTAL = 0


def sql(query, db='blacklist_test', expected=None, label='sql'):
    result = subprocess.run(BASE + ['-d', db, '-c', query], text=True, capture_output=True, timeout=25)
    with (EVIDENCE / 'queries.log').open('a') as log:
        log.write(f'[{db}] {label}\n{query}\n{result.stdout}{result.stderr}\n')
    if expected:
        assert result.returncode != 0 and expected in result.stderr, (label, result.stdout, result.stderr)
    else:
        assert result.returncode == 0, (label, result.stdout, result.stderr)
    return result.stdout.strip()


def apply(db, expected=None, suffix=''):
    result = subprocess.run(BASE + ['-d', db, '-f', MIGRATION], text=True, capture_output=True, timeout=25)
    (EVIDENCE / f'migration-{db}{suffix}.log').write_text(result.stdout + result.stderr)
    if expected:
        assert result.returncode != 0 and expected in result.stderr, (db, result.stdout, result.stderr)
    else:
        assert result.returncode == 0, (db, result.stdout, result.stderr)


def check(label):
    global TOTAL
    TOTAL += 1
    print(f'PASS {TOTAL:02d}: {label}', flush=True)


def snapshot(db='blacklist_test'):
    return sql("SELECT jsonb_build_object('pais', (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM public.blacklist b), 'fotos', (SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.blacklist_fotos f), 'seq1', (SELECT jsonb_build_array(last_value,log_cnt,is_called) FROM public.blacklist_id_seq), 'seq2', (SELECT jsonb_build_array(last_value,log_cnt,is_called) FROM public.blacklist_fotos_id_seq))", db)


def start(query, name, db='blacklist_test'):
    return subprocess.Popen(BASE + ['-d', db, '-c', f"SET application_name = '{name}'; {query}"], text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def wait_activity(name, event):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        active = sql(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{name}' AND wait_event='{event}'")
        if active == '1':
            return
        time.sleep(0.03)
    raise AssertionError(f'{name} não alcançou wait_event={event}')


def finish(proc, label, error=None):
    try:
        out, err = proc.communicate(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.communicate()
        raise
    (EVIDENCE / f'{label}.log').write_text(out + err)
    if error:
        assert proc.returncode != 0 and error in err, (label, out, err)
    else:
        assert proc.returncode == 0, (label, out, err)


sql('CREATE DATABASE blacklist_test', 'postgres')
result = subprocess.run(BASE + ['-d', 'blacklist_test', '-f', FIXTURE], text=True, capture_output=True, timeout=25)
assert result.returncode == 0, result.stderr
(EVIDENCE / 'fixture.log').write_text(result.stdout + result.stderr)
apply('blacklist_test', suffix='-first')
check('base criada a partir de users INTEGER; pgcrypto permanece em extensions')
assert sql("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto'") == 'extensions'
sql("SET ROLE service_role; INSERT INTO public.blacklist(cadastrado_por_user_id, cpf_cnpj, nome, motivo) VALUES (1,'SYNTH-DOC-A','Pessoa Sintetica A','Fixture sem PII'), (2,'SYNTH-DOC-A','Pessoa Sintetica B','Fixture sem PII'); INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(1,'https://example.invalid/a','synthetic/a');")
check('mesmo documento sintético aceito para autores diferentes; service_role usa defaults/sequências')
before = snapshot()
apply('blacklist_test', suffix='-second')
assert snapshot() == before
check('segunda aplicação preserva todas as colunas, linhas e estados das sequências')
assert sql("SELECT count(*) FROM pg_policy WHERE polrelid IN ('public.blacklist'::regclass,'public.blacklist_fotos'::regclass)") == '0'
assert sql("SELECT count(*) FROM pg_class WHERE oid IN ('public.blacklist'::regclass,'public.blacklist_fotos'::regclass) AND relrowsecurity") == '2'
check('RLS habilitada nas duas tabelas sem nenhuma policy')
for role in ['anon', 'authenticated', 'outsider']:
    for table in ['blacklist', 'blacklist_fotos']:
        for query in [f'SELECT id FROM public.{table}', f'SELECT count(*) FROM public.{table}', f'DELETE FROM public.{table}', f'UPDATE public.{table} SET id=id', f'TRUNCATE public.{table}']:
            sql(f'SET ROLE {role}; {query}', expected='42501', label=f'deny-{role}-{table}')
    sql(f"SET ROLE {role}; SELECT nextval('public.blacklist_id_seq')", expected='42501')
    sql(f'SET ROLE {role}; SELECT public.blacklist_fotos_guard()', expected='42501')
check('anon/authenticated/outro papel: SELECT inclusive colunas, DML, TRUNCATE, sequência e função negados')
for table in ['blacklist', 'blacklist_fotos']:
    for query in [f'TRUNCATE public.{table}', f"CREATE TRIGGER illicit BEFORE INSERT ON public.{table} FOR EACH ROW EXECUTE FUNCTION public.blacklist_fotos_guard()"]:
        sql(f'SET ROLE service_role; {query}', expected='42501')
sql("SET ROLE service_role; SELECT setval('public.blacklist_id_seq', 500)", expected='42501')
check('service_role somente SELECT/INSERT/UPDATE/DELETE e USAGE de sequência; sem TRUNCATE/TRIGGER/setval')
sql("SET ROLE service_role; INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(999,'SYNTH-ORPHAN','Sintetico','Teste')", expected='23503')
sql("SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(999,'https://example.invalid/x','synthetic/x')", expected='23503')
sql("SET ROLE service_role; UPDATE public.blacklist_fotos SET blacklist_id=999 WHERE id=1", expected='23503')
sql('DELETE FROM public.users WHERE id=1', expected='23503')
sql("SET ROLE service_role; UPDATE public.blacklist SET \"createdAt\"=NULL WHERE id=1", expected='23502')
sql("SET ROLE service_role; UPDATE public.blacklist SET \"updatedAt\"=NULL WHERE id=1", expected='23502')
sql("SET ROLE service_role; UPDATE public.blacklist SET status='invalido' WHERE id=1", expected='22P02')
check('autoria/foto órfãs, exclusão de autor referenciado, timestamps NULL e enum inválido rejeitados')
sql("SET ROLE service_role; UPDATE public.blacklist SET status='em_negociacao' WHERE id=1; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) SELECT 1,'https://example.invalid/'||n,'synthetic/'||n FROM generate_series(2,5) n")
sql("SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(1,'https://example.invalid/6','synthetic/6')", expected='23514')
check('INSERT multi-row admite cinco e recusa sexta foto')
rollback_parent = int(sql("SET ROLE service_role; INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(2,'SYNTH-ROLLBACK','Sintetico','Rollback') RETURNING id"))
sql(f"BEGIN; SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) SELECT {rollback_parent},'https://example.invalid/batch/'||n,'synthetic/batch/'||n FROM generate_series(1,6) n; COMMIT", expected='23514')
assert sql(f'SELECT count(*) FROM public.blacklist_fotos WHERE blacklist_id={rollback_parent}') == '0'
sql(f'SET ROLE service_role; DELETE FROM public.blacklist WHERE id={rollback_parent}')
check('lote de seis aborta atomicamente: nenhuma das primeiras cinco fotos permanece')
sql("SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(2,'https://example.invalid/b','synthetic/b')")
sql('SET ROLE service_role; UPDATE public.blacklist_fotos SET blacklist_id=1 WHERE blacklist_id=2', expected='23514')
sql("SET ROLE service_role; UPDATE public.blacklist_fotos SET url='https://example.invalid/edited' WHERE id=1")
sql('SET ROLE service_role; DELETE FROM public.blacklist_fotos WHERE id=1; UPDATE public.blacklist_fotos SET blacklist_id=1 WHERE blacklist_id=2')
assert sql('SELECT count(*) FROM public.blacklist_fotos WHERE blacklist_id=1') == '5'
check('UPDATE de metadado permitido no teto; movimento recusado no teto e permitido após DELETE')
sql('SET ROLE service_role; DELETE FROM public.blacklist WHERE id=2')
assert sql('SELECT count(*) FROM public.blacklist_fotos f LEFT JOIN public.blacklist b ON b.id=f.blacklist_id WHERE b.id IS NULL') == '0'
check('DELETE do pai/cascade preserva ausência de órfãs')
# Clone contém DDL/dados após primeira aplicação; cada adulteração deve abortar
# sem corrigir o objeto incompatível ou perder dados/sequências.
sql('CREATE DATABASE blacklist_template TEMPLATE blacklist_test', 'postgres')
CASES = [
    ('enum_labels', "ALTER TYPE public.status_blacklist ADD VALUE 'divergente'", 'enum public.status_blacklist incompatível'),
    ('enum_order', "ALTER TYPE public.tipo_divida_blacklist ADD VALUE 'divergente' BEFORE 'emprestimo'", 'enum public.tipo_divida_blacklist incompatível'),
    ('column_type', 'ALTER TABLE public.blacklist ALTER COLUMN nome TYPE text', 'colunas/defaults'),
    ('timestamp_name', 'ALTER TABLE public.blacklist RENAME COLUMN "createdAt" TO created_at', 'colunas/defaults'),
    ('fk_homonym', 'ALTER TABLE public.blacklist_fotos DROP CONSTRAINT blacklist_fotos_blacklist_fk; ALTER TABLE public.blacklist_fotos ADD CONSTRAINT blacklist_fotos_blacklist_fk CHECK (blacklist_id>0)', 'constraints'),
    ('unique_cpf', 'CREATE UNIQUE INDEX global_cpf_wrong ON public.blacklist(cpf_cnpj)', 'índices'),
    ('index_homonym', 'DROP INDEX public.blacklist_cpf_cnpj_idx; CREATE INDEX blacklist_cpf_cnpj_idx ON public.blacklist(nome)', 'índices'),
    ('seq_divergent', 'ALTER SEQUENCE public.blacklist_id_seq INCREMENT BY 2', 'sequência'),
    ('permissive_policy', 'CREATE POLICY public_leak ON public.blacklist FOR SELECT TO anon USING(true)', 'policies/rules'),
    ('function_homonym', "CREATE OR REPLACE FUNCTION public.blacklist_fotos_guard() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END'", 'função de gatilho'),
    ('trigger_disabled', 'ALTER TABLE public.blacklist_fotos DISABLE TRIGGER blacklist_fotos_guard_trg', 'gatilhos'),
    ('existing_excess', "ALTER TABLE public.blacklist_fotos DISABLE TRIGGER blacklist_fotos_guard_trg; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(1,'https://example.invalid/excess','synthetic/excess'); ALTER TABLE public.blacklist_fotos ENABLE TRIGGER blacklist_fotos_guard_trg", 'excedem cinco'),
    ('residual_acl', 'GRANT SELECT ON public.blacklist TO outsider', 'ACL residual'),
]
for name, mutation, error in CASES:
    db = 'bad_' + name
    sql(f'CREATE DATABASE {db} TEMPLATE blacklist_template', 'postgres')
    sql(mutation, db)
    state = snapshot(db)
    apply(db, expected=error)
    assert snapshot(db) == state, name
check(f'{len(CASES)} divergências de enum/coluna/FK/índice/seq/policy/função/gatilho/dados/ACL falham fechado sem perder dados')
# Homônimos antes da base: enum não-enum, view e sequência solta.
for name, setup, error in [
    ('enum_not_enum', 'CREATE DOMAIN public.status_blacklist AS text', 'enum public.status_blacklist incompatível'),
    ('view_homonym', 'CREATE VIEW public.blacklist AS SELECT 1 AS id', 'relação public.blacklist incompatível'),
    ('seq_homonym', 'CREATE SEQUENCE public.blacklist_id_seq', 'sequência/tipo homônimo'),
    ('users_uuid', 'ALTER TABLE public.users ALTER COLUMN id TYPE uuid USING extensions.gen_random_uuid()', 'public.users.id deve ser INTEGER'),
]:
    db = 'bad_' + name
    sql(f'CREATE DATABASE {db}', 'postgres')
    sql('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE TABLE public.users(id integer PRIMARY KEY); ' + setup, db)
    apply(db, expected=error)
    assert sql("SELECT count(*) FROM pg_class WHERE relname='blacklist_fotos'", db) == '0'
    assert sql("SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='tipo_divida_blacklist'", db) == '0'
check('pré-base: enum de tipo errado, view, sequência solta e users UUID abortam atomicamente')
sql('CREATE DATABASE enum_compatible', 'postgres')
sql("CREATE TABLE public.users(id integer PRIMARY KEY); CREATE TYPE public.status_blacklist AS ENUM('ativo','resolvido','em_negociacao'); CREATE TYPE public.tipo_divida_blacklist AS ENUM('emprestimo','servico','produto','aluguel','cheque','outros')", 'enum_compatible')
apply('enum_compatible')
sql('CREATE DATABASE enum_reordered', 'postgres')
sql("CREATE TABLE public.users(id integer PRIMARY KEY); CREATE TYPE public.status_blacklist AS ENUM('resolvido','ativo','em_negociacao')", 'enum_reordered')
apply('enum_reordered', expected='enum public.status_blacklist incompatível')
assert sql("SELECT to_regclass('public.blacklist') IS NULL", 'enum_reordered') == 't'
check('enum pré-existente compatível reutilizado; mesmas labels em ordem diferente recusadas')
# Grants legados de tabela/coluna/PUBLIC devem ser removidos na reaplicação.
sql('GRANT SELECT ON public.blacklist TO PUBLIC; GRANT SELECT(nome), UPDATE(status) ON public.blacklist TO anon; GRANT SELECT(file_key) ON public.blacklist_fotos TO authenticated; GRANT ALL ON public.blacklist TO service_role; GRANT ALL ON public.blacklist_id_seq TO service_role')
state = snapshot()
apply('blacklist_test', suffix='-sanitize-acl')
assert snapshot() == state
for role in ['anon', 'authenticated']:
    assert sql(f"SELECT has_any_column_privilege('{role}','public.blacklist','SELECT,UPDATE') OR has_any_column_privilege('{role}','public.blacklist_fotos','SELECT,UPDATE')") == 'f'
assert sql("SELECT has_table_privilege('service_role','public.blacklist','TRUNCATE') OR has_sequence_privilege('service_role','public.blacklist_id_seq','UPDATE')") == 'f'
check('reaplicação revoga grants legados PUBLIC/tabela/coluna e reduz service_role sem perda')
sql('CREATE DATABASE bad_inherited TEMPLATE blacklist_template', 'postgres')
sql('GRANT SELECT(nome) ON public.blacklist TO outsider; GRANT outsider TO anon', 'bad_inherited')
state = snapshot('bad_inherited')
apply('bad_inherited', expected='acesso residual/herdado')
assert snapshot('bad_inherited') == state
sql('REVOKE outsider FROM anon', 'postgres')
sql('GRANT service_role TO authenticated', 'postgres')
try:
    apply('blacklist_test', expected='papel de cliente membro de service_role', suffix='-membership-deny')
finally:
    sql('REVOKE service_role FROM authenticated', 'postgres')
check('privilégio herdado de coluna e membership de service_role recusados em vez de aceitos silenciosamente')
# Concorrência real: duas conexões disputam o quinto slot (4 fotos preexistentes).
# READ COMMITTED: perdedor 23514. RR/SERIALIZABLE: perdedor 40001 (snapshot velho).
for isolation, code in [('READ COMMITTED', '23514'), ('REPEATABLE READ', '40001'), ('SERIALIZABLE', '40001')]:
    parent = int(sql("SET ROLE service_role; INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(1,'SYNTH-RACE','Sintetico','Concorrencia') RETURNING id").splitlines()[-1])
    sql(f"SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) SELECT {parent},'https://example.invalid/race/'||n,'synthetic/race/'||n FROM generate_series(1,4) n")
    name = isolation.lower().replace(' ', '_')
    a = start(f"BEGIN ISOLATION LEVEL {isolation}; SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES({parent},'https://example.invalid/a','synthetic/concurrent-a'); SELECT pg_sleep(2); COMMIT", 'race_a_' + name)
    wait_activity('race_a_' + name, 'PgSleep')
    b = start(f"BEGIN ISOLATION LEVEL {isolation}; SET ROLE service_role; SELECT count(*) FROM public.blacklist_fotos WHERE blacklist_id={parent}; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES({parent},'https://example.invalid/b','synthetic/concurrent-b'); COMMIT", 'race_b_' + name)
    try:
        wait_activity('race_b_' + name, 'transactionid')
        finish(a, name + '-winner')
        finish(b, name + '-loser', error=code)
    finally:
        for proc in [a, b]:
            if proc.poll() is None:
                proc.kill()
                proc.communicate()
    assert sql(f'SELECT count(*) FROM public.blacklist_fotos WHERE blacklist_id={parent}') == '5'
    check(f'concorrência {isolation}: bloqueio transactionid observado; somente quinta foto confirma, perdedor {code}')
# DELETE em paralelo com INSERT: o insert espera e nunca cria órfã após commit.
parent = int(sql("SET ROLE service_role; INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(1,'SYNTH-DELETE-RACE','Sintetico','Concorrencia') RETURNING id").splitlines()[-1])
sql(f"SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES({parent},'https://example.invalid/delete','synthetic/delete')")
a = start(f'BEGIN; SET ROLE service_role; DELETE FROM public.blacklist WHERE id={parent}; SELECT pg_sleep(2); COMMIT', 'delete_a')
wait_activity('delete_a', 'PgSleep')
b = start(f"BEGIN; SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES({parent},'https://example.invalid/delete-race','synthetic/delete-race'); COMMIT", 'delete_b')
try:
    wait_activity('delete_b', 'transactionid')
    finish(a, 'delete-winner')
    finish(b, 'delete-insert-loser', error='23503')
finally:
    for proc in [a, b]:
        if proc.poll() is None:
            proc.kill()
            proc.communicate()
assert sql(f'SELECT count(*) FROM public.blacklist_fotos WHERE blacklist_id={parent}') == '0'
assert sql('SELECT count(*) FROM public.blacklist_fotos f LEFT JOIN public.blacklist b ON b.id=f.blacklist_id WHERE b.id IS NULL') == '0'
check('concorrência DELETE pai / INSERT foto: cascade confirmado, insert 23503 e nenhuma órfã')
final = snapshot()
apply('blacklist_test', suffix='-final')
assert snapshot() == final
check('reaplicação final depois de todas as disputas preserva integralmente dados/sequências')
(EVIDENCE / 'result.json').write_text(json.dumps({'status': 'PASS', 'checks': TOTAL, 'postgres': sql('SELECT version()'), 'scope': 'cluster-local-descartavel', 'production_ready': False}, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {TOTAL} verificações; nenhuma conexão externa ou DDL fora do cluster local.', flush=True)
