#!/usr/bin/env python3
"""PG17 descartável; usa ../fixture.sql e migrações reais. Nunca lê .env/URLs."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys

PSQL, SOCKET, PORT, USER, PROJECT, EVIDENCE = sys.argv[1:]
assert SOCKET.startswith('/tmp/cobrapro-blacklist-reopen-') and SOCKET.endswith('/socket')
P, E = pathlib.Path(PROJECT), pathlib.Path(EVIDENCE)
S = P / 'tests/postgres-blacklist/private-reopen'
BASE = [PSQL, '-X', '-q', '-h', SOCKET, '-p', PORT, '-U', USER,
        '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At']
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'}
ACK = "SET cobrapro.blacklist_private_backend_live='d458e684d574b56aac3e6c7c73c88b133acaa29d';"
M = P / 'drizzle/0029_reabrir_blacklist_backend_privado.sql'
checks = 0
operations = 0

def query(q='', db='ready', error=None, file=None):
    global operations
    operations += 1
    cmd = BASE + ['-d', db] + (['-f', str(file)] if file else ['-c', q])
    r = subprocess.run(cmd, text=True, capture_output=True, timeout=30, env=ENV)
    with (E / 'queries.log').open('a') as log:
        log.write(f'[{db}] {file or q}\n{r.stdout}{r.stderr}\n')
    assert (r.returncode != 0 and error in r.stderr) if error else r.returncode == 0, (file or q, r.stdout, r.stderr)
    return r.stdout.strip()

def apply(db='ready', error=None, ack=ACK):
    return query(ack + '\n' + M.read_text(), db, error)

def check(label):
    global checks
    checks += 1
    print(f'PASS {checks:02}: {label}', flush=True)

def clone(name, source='frozen'):
    query(f'CREATE DATABASE {name} TEMPLATE {source}', 'postgres')

def snapshot(db='ready', catalog=False):
    tables = ['users', 'password_resets', 'synthetic_financial', 'blacklist', 'blacklist_fotos',
              'blacklist_access_grants', 'blacklist_access_audit', 'kiwify_blacklist_products',
              'kiwify_blacklist_subscriptions', 'kiwify_blacklist_events', 'kiwify_buyers']
    parts = [f"(SELECT coalesce(jsonb_agg(j ORDER BY j::text),'[]'::jsonb) FROM (SELECT to_jsonb(t) j FROM public.{t} t) x)" for t in tables]
    parts += ["(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM storage.buckets t)",
              "(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM storage.objects t)"]
    for name in ['blacklist_id_seq', 'blacklist_fotos_id_seq', 'blacklist_access_audit_id_seq', 'users_id_seq', 'password_resets_id_seq']:
        parts.append(f'(SELECT jsonb_build_array(last_value,log_cnt,is_called) FROM public.{name})')
    if catalog:
        parts += ["(SELECT jsonb_agg(jsonb_build_array(oid,relname,relowner,relacl::text,relrowsecurity,relforcerowsecurity,obj_description(oid,'pg_class')) ORDER BY oid) FROM pg_class WHERE relnamespace IN ('public'::regnamespace,'storage'::regnamespace))",
                  "(SELECT jsonb_agg(jsonb_build_array(oid,pg_get_functiondef(oid),proacl::text,obj_description(oid,'pg_proc')) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace)",
                  "(SELECT jsonb_agg(jsonb_build_array(oid,pg_get_constraintdef(oid),convalidated) ORDER BY oid) FROM pg_constraint WHERE connamespace IN ('public'::regnamespace,'storage'::regnamespace))",
                  "(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p)",
                  "(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid IN (SELECT oid FROM pg_class WHERE relnamespace IN ('public'::regnamespace,'storage'::regnamespace)))",
                  "(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t)"]
    return query('SELECT jsonb_build_array(' + ','.join(parts) + ')', db)

query('CREATE DATABASE ready', 'postgres')
query(file=P / 'tests/postgres-blacklist/fixture.sql')
query(file=S / 'fixture.sql')
for name in ['0019_base_blacklist_backend_only.sql', '0023_acesso_blacklist_assinantes.sql',
             '0026_congelar_blacklist_ate_backend_privado.sql', '0027_kiwify_assinaturas_blacklist.sql',
             '0028_kiwify_compradores_transacional.sql']:
    query(file=P / 'drizzle' / name)
# Real parent-confirmed catalog only PK/FK -> authorized 0030 -> 0029.
s = snapshot(catalog=True)
apply(error='requer private_storage_path')
assert snapshot(catalog=True) == s
check('0029 antes da 0030 recusa atomicamente; base real possui só PK/FK')
clone('before30', 'ready')
M30 = P / 'drizzle/0030_resguardar_referencias_fotos_blacklist.sql'
s = snapshot()
query(file=M30)
assert snapshot() == s
s = snapshot(catalog=True)
query(file=M30)
assert snapshot(catalog=True) == s
check('0030 cria SOMENTE CHECK validada; reaplicação idêntica, todas linhas/seq/ACL preservadas')
for name,mutation,error in [
 ('legacy', "INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(1,'SYNTH','Sintético','Teste'); INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(1,'https://example.invalid/legacy','legacy')", '23514'),
 ('foreign', 'GRANT SELECT ON public.blacklist_fotos TO outsider', 'freeze 0026'),
 ('unknown', 'ALTER TABLE public.blacklist_fotos ADD CONSTRAINT unknown_check CHECK(true)', 'constraints desconhecidas'),
 ('wrong_check', 'ALTER TABLE public.blacklist_fotos ADD CONSTRAINT private_storage_path CHECK(true)', 'existente divergente'),
 ('nn', 'ALTER TABLE public.blacklist_fotos ALTER COLUMN url DROP NOT NULL', 'tipo/NN'),
 ('bucket', 'UPDATE storage.buckets SET public=true', 'bucket privado'),
]:
    db = 'bad30_' + name
    clone(db,'before30')
    query(mutation,db)
    s = snapshot(db,catalog=True)
    query(db=db,file=M30,error=error)
    assert snapshot(db,catalog=True) == s
    check(f'0030 {name} falha fechado sem reparo/linhas/ACL modificadas')
clone('frozen', 'ready')
for q in ["INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(1,'SYNTH','Sintético','Teste')",
          "UPDATE public.blacklist SET nome=nome", "DELETE FROM public.blacklist",
          "INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(1,'x','x')",
          "UPDATE public.blacklist_fotos SET url=url", "DELETE FROM public.blacklist_fotos",
          "SELECT public.blacklist_delete_empty_owned(1,1)"]:
    query('SET ROLE service_role; ' + q, error='42501')
check('freeze 0026 nega todo DML de blacklist/fotos e EXECUTE RPC ao service_role')
s = snapshot(catalog=True)
for ack in ['', "SET cobrapro.blacklist_private_backend_live='wrong-sha';"]:
    apply(error='confirmação EXTERNA', ack=ack)
    assert snapshot(catalog=True) == s
check('sem ACK externo explícito ou SHA errado falha fechado e não altera estado')
s = snapshot()
apply()
assert snapshot() == s
for table in ['blacklist','blacklist_fotos','blacklist_access_grants','blacklist_access_audit',
              'kiwify_blacklist_subscriptions','kiwify_blacklist_events','kiwify_buyers']:
    assert query(f'SELECT count(*) FROM public.{table}') == '0'
check('primeira reabertura preserva todas as linhas e sequências; blacklist/fotos/grants/ledger/buyers zero')
expected = {'blacklist': ['DELETE','INSERT','SELECT','UPDATE'], 'blacklist_fotos': ['DELETE','INSERT','SELECT']}
for table, permissions in expected.items():
    assert json.loads(query(f"SELECT jsonb_agg(privilege_type ORDER BY privilege_type) FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid='public.{table}'::regclass AND a.grantee='service_role'::regrole")) == permissions
check('ACL exata: blacklist SELECT/INSERT/UPDATE/DELETE; fotos SELECT/INSERT/DELETE (sem UPDATE)')
s = snapshot(catalog=True)
apply()
assert snapshot(catalog=True) == s
check('reaplicação sem qualquer grant extra: catálogos/linhas/seq idênticos')
for role in ['anon', 'authenticated', 'outsider']:
    for table in ['blacklist', 'blacklist_fotos']:
        for q in [f'SELECT id FROM public.{table}', f'UPDATE public.{table} SET id=id',
                  f'DELETE FROM public.{table}', f'TRUNCATE public.{table}']:
            query(f'SET ROLE {role}; {q}', error='42501')
    query(f"SET ROLE {role}; INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(1,'SYNTH','Sintético','Teste')", error='42501')
    query(f"SET ROLE {role}; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(1,'x','x')", error='42501')
    query(f'SET ROLE {role}; SELECT public.blacklist_delete_empty_owned(1,1)', error='42501')
    query(f"SET ROLE {role}; SELECT nextval('public.blacklist_id_seq')", error='42501')
check('anon/authenticated/outsider bloqueados em tabela/coluna/DML/RPC/seq após reabertura')
for table in ['blacklist','blacklist_fotos']:
    query(f'SET ROLE service_role; TRUNCATE public.{table}', error='42501')
    assert query(f"SELECT has_table_privilege('service_role','public.{table}','REFERENCES,TRIGGER,MAINTAIN')") == 'f'
query('SET ROLE service_role; UPDATE public.blacklist_fotos SET url=url', error='42501')
query("SET ROLE service_role; SELECT setval('public.blacklist_id_seq',9)", error='42501')
check('service_role sem fotos.UPDATE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN/seq.setval')
for name in ['rpc_kiwify_blacklist_consume(jsonb)','rpc_kiwify_blacklist_access(integer)',
             'rpc_kiwify_blacklist_order_binding(text)','rpc_kiwify_blacklist_find_users(text)',
             'rpc_kiwify_buyer_provision(jsonb)','rpc_kiwify_buyer_invite_claim(jsonb)','rpc_kiwify_buyer_invite_finish(jsonb)',
             'blacklist_delete_empty_owned(integer,integer)']:
    for role in ['anon','authenticated','service_role']:
        assert query(f"SELECT has_function_privilege('{role}','public.{name}','EXECUTE')") == ('t' if role == 'service_role' else 'f')
for name in ['blacklist_fotos_guard()', 'blacklist_access_guard()', 'kiwify_blacklist_immutable()',
             'kiwify_blacklist_identity()', 'kiwify_buyer_identity()']:
    assert query(f"SELECT has_function_privilege('service_role','public.{name}','EXECUTE')") == 'f'
check('7 RPCs Kiwify e exclusão só EXECUTE service; 5 guards sem EXECUTE service/frontend')
assert json.loads(query('SET ROLE service_role; SELECT public.rpc_kiwify_blacklist_access(1)'))['eligible'] is False
check('usuário manual/admin sem ledger vigente NÃO se torna elegível por SQL 0029')
# Workloads only synthetic, no entitlement claim: privileged SQL does not implement HTTP gate.
parent = int(query("SET ROLE service_role; INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(1,'SYNTH','Pessoa sintética','Fixture sem PII') RETURNING id"))
query(f"SET ROLE service_role; UPDATE public.blacklist SET nome='Nome sintético editado' WHERE id={parent}")
key = f'12345678-1234-4123-8123-123456789012/1/{parent}.jpg'
photo = int(query(f"SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES({parent},'storage://cobrapro-blacklist-private/{key}','{key}') RETURNING id"))
query(f'SET ROLE service_role; SELECT public.blacklist_delete_empty_owned({parent},1)', error='23514')
assert query(f'SET ROLE service_role; SELECT public.blacklist_delete_empty_owned({parent},2)') == 'f'
assert query(f'SELECT count(*) FROM public.blacklist WHERE id={parent}') == '1'
check('DML backend sintético funciona; RPC recusa pai com fotos e proprietário errado')
query(f'SET ROLE service_role; DELETE FROM public.blacklist_fotos WHERE id={photo}')
assert query(f'SET ROLE service_role; SELECT public.blacklist_delete_empty_owned({parent},1)') == 't'
assert query(f'SELECT count(*) FROM public.blacklist WHERE id={parent}') == '0'
check('remover metadado de foto e RPC pai vazio preserva o contrato do router/guard')
# Nonempty synthetic first application: the migration must not rewrite existing rows.
clone('existing_rows')
query("INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(1,'SYNTH-EXISTING','Sintético preexistente','Histórico sintético')", 'existing_rows')
query("INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(1,'storage://cobrapro-blacklist-private/12345678-1234-4123-8123-123456789012/1/1.png','12345678-1234-4123-8123-123456789012/1/1.png')", 'existing_rows')
s = snapshot('existing_rows')
apply('existing_rows')
assert snapshot('existing_rows') == s
s = snapshot('existing_rows', catalog=True)
apply('existing_rows')
assert snapshot('existing_rows', catalog=True) == s
check('first apply e reapply com pai/foto já existentes preservam todas as colunas/seq sem DML')
# No repair: each failure must preserve catalog/ACL/data/sequence exactly.
CASES = [
 ('foreign_table', 'GRANT SELECT ON public.blacklist TO outsider', 'ACL estrangeira'),
 ('foreign_column', 'GRANT SELECT(nome) ON public.blacklist TO outsider', 'ACL estrangeira'),
 ('foreign_sequence', 'GRANT USAGE ON public.blacklist_id_seq TO outsider', 'sequência/ACL'),
 ('foreign_function', 'GRANT EXECUTE ON FUNCTION public.blacklist_delete_empty_owned(integer,integer) TO outsider', 'função/proveniência'),
 ('public_table', 'GRANT SELECT ON public.blacklist TO PUBLIC', 'ACL estrangeira'),
 ('frontend_table', 'GRANT SELECT ON public.blacklist TO authenticated', 'ACL estrangeira'),
 ('frontend_function', 'GRANT EXECUTE ON FUNCTION public.rpc_kiwify_blacklist_access(integer) TO anon', 'função/proveniência'),
 ('grant_option', 'GRANT SELECT ON public.blacklist TO service_role WITH GRANT OPTION', 'ACL estrangeira'),
 ('maintain', 'GRANT MAINTAIN ON public.blacklist TO service_role', 'excede mínimo'),
 ('partial_dml', 'GRANT INSERT ON public.blacklist TO service_role', 'estado ACL'),
 ('partial_rpc', 'GRANT EXECUTE ON FUNCTION public.blacklist_delete_empty_owned(integer,integer) TO service_role', 'estado ACL'),
 ('missing_select', 'REVOKE SELECT ON public.blacklist FROM service_role', 'estado ACL'),
 ('missing_photos_select', 'REVOKE SELECT ON public.blacklist_fotos FROM service_role', 'estado ACL'),
 ('grants_extra', 'GRANT DELETE ON public.blacklist_access_grants TO service_role', 'ACL existente 0023'),
 ('audit_extra', 'GRANT INSERT ON public.blacklist_access_audit TO service_role', 'ACL existente 0023'),
 ('audit_sequence', 'GRANT USAGE ON public.blacklist_access_audit_id_seq TO service_role', 'ACL sequência audit'),
 ('policy', 'CREATE POLICY leak ON public.blacklist TO anon USING(true)', 'RLS/policy'),
 ('rls', 'ALTER TABLE public.blacklist DISABLE ROW LEVEL SECURITY', 'RLS/policy'),
 ('column', 'ALTER TABLE public.blacklist ALTER COLUMN nome TYPE text', 'colunas/defaults'),
 ('seq', 'ALTER SEQUENCE public.blacklist_fotos_id_seq INCREMENT BY 2', 'sequência'),
 ('guard', "CREATE OR REPLACE FUNCTION public.blacklist_fotos_guard() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END'", 'função/proveniência'),
 ('delete_owner', 'ALTER FUNCTION public.blacklist_delete_empty_owned(integer,integer) OWNER TO outsider', 'função/proveniência'),
 ('trigger', 'ALTER TABLE public.blacklist_fotos DISABLE TRIGGER blacklist_fotos_guard_trg', 'gatilho da base'),
 ('kiwify_metadata', 'ALTER FUNCTION public.rpc_kiwify_blacklist_access(integer) SECURITY INVOKER', 'função/proveniência'),
 ('kiwify_marker', "COMMENT ON FUNCTION public.rpc_kiwify_blacklist_access(integer) IS 'foreign'", 'função/proveniência'),
 ('kiwify_missing', 'DROP FUNCTION public.rpc_kiwify_blacklist_find_users(text)', 'função/proveniência'),
 ('kiwify_execute', 'REVOKE EXECUTE ON FUNCTION public.rpc_kiwify_blacklist_access(integer) FROM service_role', 'função/proveniência'),
 ('kiwify_direct', 'GRANT SELECT ON public.kiwify_blacklist_events TO service_role', 'proveniência/ACL de pacote'),
 ('kiwify_table_marker', "COMMENT ON TABLE public.kiwify_buyers IS 'foreign'", 'proveniência/ACL de pacote'),
 ('private_path', 'ALTER TABLE public.blacklist_fotos DROP CONSTRAINT private_storage_path; ALTER TABLE public.blacklist_fotos ADD CONSTRAINT private_storage_path CHECK(true)', 'requer private_storage_path'),
 ('bucket_public', "UPDATE storage.buckets SET public=true", 'bucket privado'),
 ('bucket_size', 'UPDATE storage.buckets SET file_size_limit=999999', 'bucket privado'),
 ('bucket_mime', "UPDATE storage.buckets SET allowed_mime_types=ARRAY['image/svg+xml']", 'bucket privado'),
 ('storage_policy', 'CREATE POLICY leak ON storage.objects TO authenticated USING(true)', 'Storage ausente'),
]
for name, mutation, error in CASES:
    db = 'bad_' + name
    clone(db)
    query(mutation, db)
    s = snapshot(db, catalog=True)
    apply(db, error)
    assert snapshot(db, catalog=True) == s, name
    check(f'drift {name}: rejeitado sem reparo, perda de linha ou mudança ACL')
clone('bad_reapply_photos_update', 'ready')
query('GRANT UPDATE ON public.blacklist_fotos TO service_role', 'bad_reapply_photos_update')
s = snapshot('bad_reapply_photos_update', catalog=True)
apply('bad_reapply_photos_update', 'estado ACL')
assert snapshot('bad_reapply_photos_update', catalog=True) == s
check('reaplicação com fotos.UPDATE extra rejeita em vez de normalizar permissões')
# Role membership is cluster-wide; revoke immediately after each isolated case.
for name, mutation, undo in [
 ('membership', 'GRANT service_role TO authenticated', 'REVOKE service_role FROM authenticated'),
 ('owner_membership', f'GRANT {USER} TO service_role', f'REVOKE {USER} FROM service_role')]:
    query(mutation, 'postgres')
    try:
        s = snapshot(catalog=True)
        apply(error='roles/owner')
        assert snapshot(catalog=True) == s
    finally:
        query(undo, 'postgres')
    check(f'role {name}: negada sem normalização implícita')
s = snapshot(catalog=True)
apply()
assert snapshot(catalog=True) == s
check('reaplicação final com histórico sintético preservado; nenhuma concessão/evento/comprador/reset criado')
result = {'status':'PASS', 'checks':checks, 'psql_operations':operations, 'drift_cases':len(CASES),
          'postgres':query('SELECT version()'), 'tcp_listeners':query('SHOW listen_addresses'),
          'scope':'cluster-local-descartavel-sintetico', 'production_applied':False,
          'real_customer_operations':0, 'live_private_storage_path_verified':False,
          'migration_sha256':hashlib.sha256(M.read_bytes()).hexdigest(), 'migration30_sha256':hashlib.sha256(M30.read_bytes()).hexdigest()}
(E / 'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f'PASS: {checks} verificações; zero acesso remoto; sem clientes reais.', flush=True)
