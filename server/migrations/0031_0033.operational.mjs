// Controles de instalação somente: nenhum objeto persistente, RPC ou fonte de catálogo adotada.
export const reservedMigrationLock = 'SELECT pg_advisory_xact_lock(20261112,3133);';
export const operationalHeader = `-- DDL cooperativa: TODOS os instaladores devem adquirir (20261112,3133) primeiro.
-- LOCK de catálogo exige privilégios indisponíveis no postgres NOSUPERUSER managed.
-- Advisory NÃO bloqueia DDL privilegiada externa: janela exclusiva de governança obrigatória.
-- Read Committed: preflight separado começa com snapshot fresco APÓS todas as esperas.
DO $isolation3133$ BEGIN
 IF current_setting('transaction_isolation') <> 'read committed' THEN
  RAISE EXCEPTION '0031/0033: instalação exige Read Committed e DDL cooperativa exclusiva' USING ERRCODE='55000';
 END IF;
END $isolation3133$;
${reservedMigrationLock}`;
export const installPrivileges = `DO $privileges3133$ DECLARE n text; BEGIN
 IF NOT has_schema_privilege(current_user,'public','CREATE')
 OR NOT has_database_privilege(current_user,current_database(),'TEMP')
 OR NOT has_schema_privilege(current_user,'extensions','USAGE') THEN
  RAISE EXCEPTION '0031/0033: instalador sem CREATE public/TEMP database/USAGE extensions; não conceder automaticamente' USING ERRCODE='42501'; END IF;
 FOREACH n IN ARRAY ARRAY['contratos','parcelas','transacoes_caixa','contrato_historico','ciclo_estados','ciclo_operacoes','ciclo_autorizacoes','ciclo_pernas','emprestimos_rpc_operacoes','emprestimos_rpc_origens','users','contas_caixa','clientes','koletores','contas_pagar','ciclo_despesas_autorizacoes','despesas_rpc_operacoes','despesas_rpc_origens','despesas_rpc_pagamentos'] LOOP
  IF NOT has_table_privilege(current_user,'public.'||n,'MAINTAIN,UPDATE,DELETE,TRUNCATE') THEN
   RAISE EXCEPTION '0031/0033: privilégio efetivo ACCESS EXCLUSIVE ausente: %',n USING ERRCODE='42501'; END IF;
 END LOOP;
END $privileges3133$;`;
export const witnessBefore = `-- Snapshot TEMP de metadados externos estáveis, não baseline permissivo de funções.
CREATE TEMP TABLE migration_3133_environment ON COMMIT DROP AS
SELECT jsonb_build_object(
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r
   WHERE rolname IN(current_user,'postgres','anon','authenticated','service_role')),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m
   WHERE roleid IN(SELECT oid FROM pg_roles WHERE rolname IN(current_user,'postgres','anon','authenticated','service_role'))
      OR member IN(SELECT oid FROM pg_roles WHERE rolname IN(current_user,'postgres','anon','authenticated','service_role'))),
 'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY oid) FROM pg_namespace n WHERE nspname IN('public','extensions')),
 'extensions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY oid) FROM pg_extension e WHERE extname='pgcrypto'),
 'languages',(SELECT jsonb_agg(to_jsonb(l) ORDER BY oid) FROM pg_language l WHERE lanname IN('sql','plpgsql')),
 'default_acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY oid) FROM pg_default_acl a
   WHERE defaclrole IN(SELECT oid FROM pg_roles WHERE rolname IN(current_user,'postgres')))
) AS metadata;
-- Sem GRANT, SET ROLE, elevação ou modificação de default ACL.`;
export const witnessAfter = `DO $environment3133$
DECLARE observed jsonb; expected jsonb;
BEGIN
 SELECT metadata INTO STRICT expected FROM pg_temp.migration_3133_environment;
 ${witnessBefore.split('SELECT jsonb_build_object(')[1].split(') AS metadata;')[0] ? 'SELECT jsonb_build_object(' + witnessBefore.split('SELECT jsonb_build_object(')[1].split(') AS metadata;')[0] + ') INTO observed;' : ''}
 IF observed IS DISTINCT FROM expected THEN
  RAISE EXCEPTION '0031/0033: roles/memberships/schema/extension/language/defaultACL mudou durante instalação' USING ERRCODE='55000';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'
   AND classid=20261112 AND objid=3133 AND objsubid=2 AND granted AND mode='ExclusiveLock') THEN
  RAISE EXCEPTION '0031/0033: advisory reservado ausente' USING ERRCODE='55000';
 END IF;
END $environment3133$;`;
export function stripCatalogLocks(sql) {
 return sql.replace(/LOCK TABLE pg_catalog\.pg_namespace,[\s\S]*? IN SHARE ROW EXCLUSIVE MODE;\n/, '');
}
export function assertApplicationLocks(sql) {
 const required = ['contratos','parcelas','transacoes_caixa','contrato_historico','ciclo_estados','ciclo_operacoes','ciclo_autorizacoes','ciclo_pernas','emprestimos_rpc_operacoes','emprestimos_rpc_origens','users','contas_caixa','clientes','koletores','contas_pagar','ciclo_despesas_autorizacoes','despesas_rpc_operacoes','despesas_rpc_origens','despesas_rpc_pagamentos'];
 const lock = sql.match(/LOCK TABLE public\.\w+,[\s\S]*? IN ACCESS EXCLUSIVE MODE;/)?.[0];
 if (!lock || required.some(n=>!lock.includes('public.'+n))) throw new Error('Lock explícito de relação da aplicação ausente');
 if (/LOCK TABLE pg_catalog\./.test(sql)) throw new Error('LOCK de catálogo não suportado');
 if (!sql.includes(operationalHeader)) throw new Error('Protocolo operacional ausente');
}

export function applicationWitness(before, migration) {
 const select = `SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relnamespace,c.reltype,c.relowner,c.relkind,c.relpersistence,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) ORDER BY c.oid) FROM pg_class c WHERE c.oid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'defaults',(SELECT jsonb_agg(jsonb_build_array(adrelid,adnum,pg_get_expr(adbin,adrelid)) ORDER BY adrelid,adnum) FROM pg_attrdef WHERE adrelid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE conrelid IN(SELECT oid FROM pg_temp.migration_3133_relations) ${migration === 31 ? "AND NOT(conrelid='public.parcelas'::regclass AND conname='parcelas_status_check')" : ''}),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM pg_temp.migration_3133_relations) AND NOT tgisinternal),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid IN(SELECT oid FROM pg_temp.migration_3133_relations))
 )`;
if (before) return `CREATE TEMP TABLE migration_3133_relations ON COMMIT DROP AS
 SELECT c.oid FROM pg_class c JOIN pg_locks l ON l.relation=c.oid
 WHERE l.pid=pg_backend_pid() AND l.mode='AccessExclusiveLock' AND l.granted AND c.relnamespace='public'::regnamespace;
CREATE TEMP TABLE migration_3133_application ON COMMIT DROP AS
${select} AS metadata;`;
 return `DO $application3133$ DECLARE actual jsonb; expected jsonb; BEGIN
 SELECT metadata INTO STRICT expected FROM pg_temp.migration_3133_application;
 ${select} INTO actual;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0031/0033: metadados de relações protegidas mudaram durante DDL' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.migration_3133_relations r WHERE NOT EXISTS(
  SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND relation=r.oid AND mode='AccessExclusiveLock' AND granted)) THEN
  RAISE EXCEPTION '0031/0033: lock de aplicação ausente' USING ERRCODE='55000'; END IF;
 END $application3133$;`;
}
export function postflightFunctions(manifest, migration) {
 const clean = f => Object.fromEntries(Object.entries(f).filter(([k])=>!['ddl','body'].includes(k)));
 const profiles = !Array.isArray(manifest);
 const encoded = profiles ? Object.fromEntries(Object.entries(manifest).map(([k,v])=>[k,v.map(clean)])) : manifest.map(clean);
 return `-- Pós-DDL: conjunto completo de funções, metadados e hashes de fontes LOCAIS conhecidas.
DO $postflight${migration}$
DECLARE known jsonb := $knownpost${migration}$${JSON.stringify(encoded)}$knownpost${migration}$::jsonb;
 actual jsonb; names text[]; x record; owner_oid oid; service_oid oid; roles oid[];
BEGIN
 ${profiles ? "known:=known->CASE WHEN to_regprocedure('public.renovacao_imutavel()') IS NOT NULL THEN 'renewal' ELSE 'baseline' END;" : ''}
 SELECT proowner INTO STRICT owner_oid FROM pg_proc WHERE oid='public.ciclo_guardar()'::regprocedure;
 SELECT oid INTO STRICT service_oid FROM pg_roles WHERE rolname='service_role';
 SELECT array_agg(oid) INTO roles FROM pg_roles WHERE rolname IN('anon','authenticated','service_role');
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(known) f;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname=ANY(names) AND (pronamespace<>'public'::regnamespace OR proowner<>owner_oid)) THEN
  RAISE EXCEPTION '${migration}: pós-DDL owner/namespace incompatível' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO actual FROM (
 SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),
 'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,
 'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,
 'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,
 'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),
 'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO known FROM jsonb_array_elements(known) f;
 IF actual IS DISTINCT FROM known THEN RAISE EXCEPTION '${migration}: pós-DDL source/hash/metadados incompatíveis' USING ERRCODE='55000'; END IF;
 FOR x IN SELECT * FROM pg_proc WHERE proname=ANY(names) LOOP
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce(x.proacl,acldefault('f',x.proowner))) a
 WHERE a.grantee<>owner_oid AND NOT(x.proname LIKE 'rpc\\_%' ESCAPE '\\' AND a.grantee=service_oid AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
 OR (x.proname LIKE 'rpc\\_%' ESCAPE '\\' AND NOT has_function_privilege(service_oid,x.oid,'EXECUTE'))
 OR EXISTS(SELECT 1 FROM unnest(roles) r WHERE r<>service_oid AND has_function_privilege(r,x.oid,'EXECUTE'))
 OR (x.proname NOT LIKE 'rpc\\_%' ESCAPE '\\' AND has_function_privilege(service_oid,x.oid,'EXECUTE')) THEN
 RAISE EXCEPTION '${migration}: pós-DDL ACL incompatível: %',x.proname USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR x IN SELECT * FROM pg_class WHERE relname=ANY(ARRAY[${(migration === 31 ? ['renovacao_capacidades','renovacao_operacoes','renovacao_provas'] : ['financial_intent_fences']).map(n=>`'${n}'`).join(',')}]) LOOP
 IF x.relnamespace<>'public'::regnamespace OR x.relowner<>owner_oid OR x.relkind<>'r' OR x.relpersistence<>'p'
 OR NOT x.relrowsecurity OR x.relforcerowsecurity
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(x.relacl,acldefault('r',x.relowner))) a WHERE a.grantee<>owner_oid)
 OR EXISTS(SELECT 1 FROM pg_attribute z,LATERAL aclexplode(z.attacl) a WHERE z.attrelid=x.oid AND a.grantee<>owner_oid)
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=x.oid) THEN
 RAISE EXCEPTION '${migration}: pós-DDL relação privada incompatível: %',x.relname USING ERRCODE='55000'; END IF;
 END LOOP;
END $postflight${migration}$;`;
}
