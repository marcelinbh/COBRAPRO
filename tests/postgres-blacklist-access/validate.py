#!/usr/bin/env python3
import json, pathlib, subprocess, sys, time
PSQL, SOCKET, PORT, USER, PROJECT, EVIDENCE = sys.argv[1:]
assert SOCKET.startswith('/tmp/cobrapro-blacklist-access-') and SOCKET.endswith('/socket')
E = pathlib.Path(EVIDENCE); P = pathlib.Path(PROJECT)
BASE = [PSQL,'-X','-q','-At','-h',SOCKET,'-p',PORT,'-U',USER,'-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
checks=0
def sql(q,error=None):
 r=subprocess.run(BASE+['-c',q],text=True,capture_output=True,timeout=25)
 with (E/'queries.log').open('a') as f: f.write(q+'\n'+r.stdout+r.stderr+'\n')
 assert (r.returncode!=0 and error in r.stderr) if error else r.returncode==0, (q,r.stdout,r.stderr)
 return r.stdout.strip()
def apply(name,error=None):
 r=subprocess.run(BASE+['-f',str(P/'drizzle'/name)],text=True,capture_output=True,timeout=25)
 with (E/'migrations.log').open('a') as f:f.write(name+'\n'+r.stdout+r.stderr)
 assert (r.returncode!=0 and error in r.stderr) if error else r.returncode==0,(r.stdout,r.stderr)
def check(label):
 global checks;checks+=1;print(f'PASS {checks:02}: {label}',flush=True)
sql("CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS; CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE outsider NOLOGIN; CREATE TABLE public.users(id integer PRIMARY KEY, role text NOT NULL); INSERT INTO users VALUES(1,'user'),(2,'admin'),(3,'user');")
apply('0019_base_blacklist_backend_only.sql');apply('0023_acesso_blacklist_assinantes.sql')
assert sql('SELECT count(*) FROM public.blacklist_access_grants')=='0'
assert sql('SELECT count(*) FROM public.blacklist_access_audit')=='0'
check('base vazia não concede acesso para usuário ou admin')
for role in ['anon','authenticated','outsider']:
 for table in ['blacklist_access_grants','blacklist_access_audit']:
  for q in [f'SELECT * FROM public.{table}',f'UPDATE public.{table} SET user_id=user_id',f'DELETE FROM public.{table}',f'TRUNCATE public.{table}']:
   sql(f'SET ROLE {role}; {q}', '42501')
 sql(f"SET ROLE {role}; SELECT nextval('public.blacklist_access_audit_id_seq')",'42501')
 sql(f'SET ROLE {role}; SELECT public.blacklist_delete_empty_owned(1,1)','42501')
check('anon/authenticated/outsider sem SELECT/DML/seq/RPC')
assert sql("SELECT count(*) FROM pg_class WHERE relname IN ('blacklist_access_grants','blacklist_access_audit') AND relrowsecurity")=='2'
assert sql("SELECT count(*) FROM pg_policy WHERE polrelid IN ('public.blacklist_access_grants'::regclass,'public.blacklist_access_audit'::regclass)")=='0'
check('duas tabelas RLS sem policies')
insert="INSERT INTO public.blacklist_access_grants(user_id,status,starts_at,ends_at,granted_by,evidence,reason) VALUES({user},'ativo',now()-interval '1 day',now()+interval '30 days',{actor},'Evidência sintética aprovada','Teste de acesso')"
sql('SET ROLE service_role; '+insert.format(user=1,actor=1),'42501')
sql('SET ROLE service_role; '+insert.format(user=1,actor=999),'42501')
sql('SET ROLE service_role; '+insert.format(user=999,actor=2),'23503')
check('concessor user/inexistente e titular inexistente recusados')
sql('SET ROLE service_role; '+insert.format(user=1,actor=2))
assert sql('SELECT count(*) FROM public.blacklist_access_audit')=='1'
assert sql("SELECT before_data IS NULL AND after_data->>'status'='ativo' AND actor_id=2 FROM public.blacklist_access_audit")=='t'
sql('SET ROLE service_role; '+insert.format(user=1,actor=2),'23505')
check('grant único por user e INSERT gera auditoria com evidência/admin')
for q in ["UPDATE public.blacklist_access_grants SET ends_at=NULL WHERE user_id=1", "UPDATE public.blacklist_access_grants SET ends_at=starts_at WHERE user_id=1", "UPDATE public.blacklist_access_grants SET starts_at='-infinity' WHERE user_id=1", "UPDATE public.blacklist_access_grants SET lifetime=true WHERE user_id=1", "UPDATE public.blacklist_access_grants SET evidence=' ' WHERE user_id=1", "UPDATE public.blacklist_access_grants SET status='trial' WHERE user_id=1", "UPDATE public.blacklist_access_grants SET user_id=3 WHERE user_id=1"]:
 sql('SET ROLE service_role; '+q,'23514')
check('sem false-active/trial/intervalo inválido/vitalício implícito/evidência vazia/mudar titular')
sql("SET ROLE service_role; UPDATE public.blacklist_access_grants SET lifetime=true,ends_at=NULL,reason='Vitalício aprovado sintético' WHERE user_id=1; UPDATE public.blacklist_access_grants SET status='suspenso',reason='Suspensão sintética' WHERE user_id=1; UPDATE public.blacklist_access_grants SET status='revogado',reason='Revogação sintética' WHERE user_id=1")
assert sql('SELECT count(*) FROM public.blacklist_access_audit')=='4'
assert sql("SELECT before_data->>'status'='suspenso' AND after_data->>'status'='revogado' FROM public.blacklist_access_audit ORDER BY id DESC LIMIT 1")=='t'
check('vitalício explícito, suspensão/revogação com before/after e motivo')
for q in ['DELETE FROM public.blacklist_access_grants','DELETE FROM public.blacklist_access_audit','UPDATE public.blacklist_access_audit SET action=action','INSERT INTO public.blacklist_access_audit(user_id,actor_id,action,after_data) VALUES(1,2,\'UPDATE\',\'{}\')','TRUNCATE public.blacklist_access_grants',"SELECT nextval('public.blacklist_access_audit_id_seq')"]:
 sql('SET ROLE service_role; '+q,'42501')
check('service_role não apaga grant nem altera/forja/apaga audit trail')
snapshot=sql("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(g)) FROM public.blacklist_access_grants g),(SELECT jsonb_agg(to_jsonb(a)) FROM public.blacklist_access_audit a),(SELECT last_value FROM public.blacklist_access_audit_id_seq))")
apply('0023_acesso_blacklist_assinantes.sql')
assert snapshot==sql("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(g)) FROM public.blacklist_access_grants g),(SELECT jsonb_agg(to_jsonb(a)) FROM public.blacklist_access_audit a),(SELECT last_value FROM public.blacklist_access_audit_id_seq))")
check('reaplicação idempotente preserva grants/auditoria/sequência')
sql('CREATE POLICY leak ON public.blacklist_access_grants TO anon USING(true)');apply('0023_acesso_blacklist_assinantes.sql','Policies/rules');sql('DROP POLICY leak ON public.blacklist_access_grants')
sql('GRANT SELECT ON public.blacklist_access_audit TO outsider');apply('0023_acesso_blacklist_assinantes.sql','ACL');sql('REVOKE SELECT ON public.blacklist_access_audit FROM outsider')
sql('ALTER TABLE public.blacklist_access_grants DROP CONSTRAINT blacklist_access_interval');apply('0023_acesso_blacklist_assinantes.sql','Constraints')
sql("ALTER TABLE public.blacklist_access_grants ADD CONSTRAINT blacklist_access_interval CHECK(isfinite(starts_at) AND ((lifetime AND ends_at IS NULL) OR (NOT lifetime AND ends_at IS NOT NULL AND isfinite(ends_at) AND ends_at > starts_at)))")
check('policy/ACL residual/constraint adulterada falham fechado')
sql('GRANT EXECUTE ON FUNCTION public.blacklist_delete_empty_owned(integer,integer) TO outsider; GRANT outsider TO anon')
apply('0023_acesso_blacklist_assinantes.sql','ACL função')
sql('REVOKE outsider FROM anon; REVOKE EXECUTE ON FUNCTION public.blacklist_delete_empty_owned(integer,integer) FROM outsider')
sql('ALTER SEQUENCE public.blacklist_access_audit_id_seq INCREMENT BY 2')
apply('0023_acesso_blacklist_assinantes.sql','Sequência auditoria')
sql('ALTER SEQUENCE public.blacklist_access_audit_id_seq INCREMENT BY 1')
check('função herdada e sequência audit adulterada bloqueadas')
sql("UPDATE public.users SET role='user' WHERE id=2")
sql("SET ROLE service_role; UPDATE public.blacklist_access_grants SET status='ativo' WHERE user_id=1",'42501')
sql("UPDATE public.users SET role='admin' WHERE id=2")
assert sql('SELECT count(*) FROM public.blacklist_access_audit')=='4'
check('concessor deixou admin: alteração recusada e sem auditoria parcial')
sql("SET ROLE service_role; INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(1,'SYNTHETIC','Sintético','Fixture')")
assert sql('SET ROLE service_role; SELECT public.blacklist_delete_empty_owned(1,3)')=='f'
sql("SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(1,'storage://synthetic','synthetic')")
sql('SET ROLE service_role; SELECT public.blacklist_delete_empty_owned(1,1)','23514')
assert sql('SELECT count(*) FROM public.blacklist_fotos')=='1'
sql('SET ROLE service_role; DELETE FROM public.blacklist_fotos WHERE blacklist_id=1')
assert sql('SET ROLE service_role; SELECT public.blacklist_delete_empty_owned(1,1)')=='t'
check('RPC de exclusão owner-only rejeita foto existente e não faz CASCADE silencioso')
sql("SET ROLE service_role; INSERT INTO public.blacklist(cadastrado_por_user_id,cpf_cnpj,nome,motivo) VALUES(1,'SYNTH-RACE','Sintético','Fixture')")
a=subprocess.Popen(BASE+['-c',"BEGIN; SET ROLE service_role; INSERT INTO public.blacklist_fotos(blacklist_id,url,file_key) VALUES(2,'storage://synthetic','synthetic'); SELECT pg_sleep(2); COMMIT"],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
time.sleep(.3)
b=subprocess.Popen(BASE+['-c','SET ROLE service_role; SELECT public.blacklist_delete_empty_owned(2,1)'],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
oa,ea=a.communicate(timeout=10);ob,eb=b.communicate(timeout=10)
assert a.returncode==0 and b.returncode!=0 and '23514' in eb,(oa,ea,ob,eb)
assert sql('SELECT count(*) FROM public.blacklist_fotos WHERE blacklist_id=2')=='1'
check('upload concorrente vs exclusão: pai bloqueado, exclusão rejeitada, foto preservada')
apply('0023_acesso_blacklist_assinantes.sql')
(E/'result.json').write_text(json.dumps({'status':'PASS','checks':checks,'postgres':sql('SELECT version()'),'scope':'local-only','production_ready':False},indent=2)+'\n')
print(f'PASS: {checks} verificações; zero produção/remoto.',flush=True)
