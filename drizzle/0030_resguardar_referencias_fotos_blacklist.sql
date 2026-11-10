-- LOCAL ONLY / revisão: metadata live confirmada pelo parent, blacklist_fotos só PK/FK.
-- Aplicar 0030 ANTES de 0029 (dependência explícita, ordem numérica não é execução).
-- Adiciona SOMENTE CHECK validada private_storage_path; nunca reescreve linhas.
-- Requer freeze 0026 íntegro, bucket privado pré-configurado e base 0019 auditada.
-- A CHECK garante formato/referência; autoria/tenant requer backend validado por acesso.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$
DECLARE
  owner_oid oid := current_user::regrole::oid;
  service_oid oid;
  expected_expr text := $expr$(((url)::text = ('storage://cobrapro-blacklist-private/'::text || (file_key)::text)) AND ((file_key)::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[1-9][0-9]*/[1-9][0-9]*\.(jpg|png|webp)$'::text))$expr$;
  t text; r record; actual jsonb; expected jsonb;
BEGIN
  PERFORM set_config('search_path','pg_catalog',true);
  PERFORM pg_advisory_xact_lock(190019,5);
  PERFORM pg_advisory_xact_lock(190023,1);
  PERFORM pg_advisory_xact_lock(190029,1);
  PERFORM pg_advisory_xact_lock(190030,1);
  IF current_setting('server_version_num')::integer/10000<>17 THEN RAISE EXCEPTION '0030 exige PG17'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon' AND NOT rolbypassrls AND NOT rolsuper)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolbypassrls AND NOT rolsuper)
    OR current_user IN ('service_role','anon','authenticated')
    OR pg_has_role('service_role',current_user,'MEMBER') OR pg_has_role('anon',current_user,'MEMBER')
    OR pg_has_role('authenticated',current_user,'MEMBER')
    OR pg_has_role('anon','service_role','MEMBER') OR pg_has_role('authenticated','service_role','MEMBER') THEN
    RAISE EXCEPTION '0030 roles/owner incompatíveis';
  END IF;
  service_oid := 'service_role'::regrole::oid;
  FOREACH t IN ARRAY ARRAY['blacklist','blacklist_fotos'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||t) AND relkind='r' AND relpersistence='p'
      AND NOT relispartition AND relowner=owner_oid AND relrowsecurity AND NOT relforcerowsecurity)
      OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=to_regclass('public.'||t) OR inhparent=to_regclass('public.'||t))
      OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('public.'||t))
      OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=to_regclass('public.'||t)) THEN
      RAISE EXCEPTION '0030 relação/owner/RLS/policy incompatível: %',t;
    END IF;
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
    IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=to_regclass('public.'||t) AND (a.grantee NOT IN(owner_oid,service_oid) OR a.grantor<>owner_oid
        OR (a.grantee=service_oid AND (a.privilege_type<>'SELECT' OR a.is_grantable))))
      OR EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
        WHERE a.attrelid=to_regclass('public.'||t) AND (x.grantee<>owner_oid OR x.grantor<>owner_oid))
      OR NOT has_table_privilege('service_role','public.'||t,'SELECT')
      OR has_table_privilege('service_role','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,REFERENCES')
      OR has_any_column_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION '0030 requer freeze 0026, sem ACL estrangeira/frontend/coluna';
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.blacklist_delete_empty_owned(integer,integer)')
      AND proowner=owner_oid AND NOT prosecdef AND proconfig=ARRAY['search_path=pg_catalog']
      AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='65e60515ea19f3669bb51e53de8ca2abe3df7a7a07bd09ff8de9491550f9647f')
    OR has_function_privilege('service_role','public.blacklist_delete_empty_owned(integer,integer)','EXECUTE')
    OR has_function_privilege('anon','public.blacklist_delete_empty_owned(integer,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.blacklist_delete_empty_owned(integer,integer)','EXECUTE')
    OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid=to_regprocedure('public.blacklist_delete_empty_owned(integer,integer)') AND (a.grantee<>owner_oid OR a.grantor<>owner_oid)) THEN
    RAISE EXCEPTION '0030 RPC exclusão fora do freeze/contrato';
  END IF;
  SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
    pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) ORDER BY a.attname) INTO actual
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.blacklist_fotos'::regclass AND a.attnum>0 AND NOT a.attisdropped;
  SELECT jsonb_agg(jsonb_build_array(col,typ,nn,def,'','') ORDER BY col) INTO expected FROM (VALUES
    ('id','integer',true,'nextval(''public.blacklist_fotos_id_seq''::regclass)'),
    ('blacklist_id','integer',true,NULL),('url','character varying(500)',true,NULL),
    ('file_key','character varying(500)',true,NULL),('createdAt','timestamp with time zone',true,'now()')
  ) v(col,typ,nn,def);
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0030 colunas/defaults/tipo/NN incompatíveis'; END IF;
  SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid),convalidated,condeferrable,condeferred) ORDER BY conname)
    INTO actual FROM pg_constraint WHERE conrelid='public.blacklist_fotos'::regclass AND conname<>'private_storage_path';
  SELECT jsonb_agg(jsonb_build_array(name,def,true,false,false) ORDER BY name) INTO expected FROM (VALUES
    ('blacklist_fotos_pkey','PRIMARY KEY (id)'),
    ('blacklist_fotos_blacklist_fk','FOREIGN KEY (blacklist_id) REFERENCES public.blacklist(id) ON DELETE CASCADE')
  ) v(name,def);
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0030 constraints desconhecidas/divergentes'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('storage.buckets') AND relkind='r' AND relpersistence='p' AND relrowsecurity)
    OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('storage.objects') AND relkind='r' AND relpersistence='p' AND relrowsecurity)
    OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('storage.objects')) THEN
    RAISE EXCEPTION '0030 Storage ausente/RLS/policy inesperada';
  END IF;
  IF (SELECT count(*) FROM storage.buckets WHERE id='cobrapro-blacklist-private' AND name=id AND public=false
      AND file_size_limit=2097152 AND
      (SELECT array_agg(m ORDER BY m) FROM unnest(allowed_mime_types) m)=ARRAY['image/jpeg','image/png','image/webp'])<>1 THEN
    RAISE EXCEPTION '0030 bucket privado/2MB/MIME incompatível';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.blacklist_fotos'::regclass AND conname='private_storage_path') THEN
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.blacklist_fotos'::regclass
      AND conname='private_storage_path' AND contype='c' AND convalidated AND NOT condeferrable AND NOT condeferred
      AND pg_get_expr(conbin,conrelid)=expected_expr) THEN
      RAISE EXCEPTION '0030 private_storage_path existente divergente: não reparar';
    END IF;
  ELSE
    -- PostgreSQL valida TODAS as linhas atomicamente; qualquer legado inválido aborta.
    ALTER TABLE public.blacklist_fotos ADD CONSTRAINT private_storage_path CHECK (
      url = 'storage://cobrapro-blacklist-private/' || file_key AND
      file_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[1-9][0-9]*/[1-9][0-9]*\.(jpg|png|webp)$'
    );
  END IF;
END;
$guard$;
COMMIT;
