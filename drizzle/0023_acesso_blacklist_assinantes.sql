-- LOCAL / REVIEW: não aplicada à produção. Requer users INTEGER + role e base 0019.
-- Concessões SaaS explícitas, não assinaturas financeiras de clientes.
-- SQL humano aprovado informa granted_by (admin), evidência e motivo; nenhum seed.
DO $migration$
DECLARE
  t text;
  actual jsonb;
  expected jsonb;
  cols text;
  guard_body text := $guard$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Revogue a concessão; exclusão não permitida' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM public.users WHERE id=NEW.granted_by AND role::text='admin' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Concessor deve ser admin existente' USING ERRCODE='42501';
  END IF;
  NEW.updated_at := clock_timestamp();
  IF TG_OP='INSERT' THEN NEW.created_at := NEW.updated_at; END IF;
  IF TG_OP='UPDATE' AND (NEW.user_id <> OLD.user_id OR NEW.created_at <> OLD.created_at) THEN
    RAISE EXCEPTION 'Identidade/histórico de concessão imutáveis' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.blacklist_access_audit(user_id, actor_id, action, before_data, after_data)
  VALUES (NEW.user_id, NEW.granted_by, TG_OP,
          CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW));
  RETURN NEW;
END;
$guard$;
  delete_body text := $delete$
BEGIN
  PERFORM 1 FROM public.blacklist WHERE id=target_id AND cadastrado_por_user_id=owner_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.blacklist_fotos WHERE blacklist_id=target_id) THEN
    RAISE EXCEPTION 'Remova primeiro as fotos com compensação privada' USING ERRCODE='23514';
  END IF;
  DELETE FROM public.blacklist WHERE id=target_id AND cadastrado_por_user_id=owner_id;
  RETURN FOUND;
END;
$delete$;
BEGIN
  PERFORM set_config('search_path','pg_catalog',true);
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM pg_advisory_xact_lock(190023, 1);
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon' AND NOT rolbypassrls AND NOT rolsuper)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolbypassrls AND NOT rolsuper)
    OR pg_has_role('anon','service_role','MEMBER') OR pg_has_role('authenticated','service_role','MEMBER') THEN
    RAISE EXCEPTION 'Acesso blacklist bloqueado: papéis incompatíveis';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.users'::regclass
                AND attname='id' AND atttypid='integer'::regtype AND attnotnull AND NOT attisdropped)
    OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='role' AND NOT attisdropped)
    OR to_regclass('public.blacklist_fotos') IS NULL OR to_regclass('public.blacklist') IS NULL THEN
    RAISE EXCEPTION 'Requer users id INTEGER/role e base 0019 revisada';
  END IF;
  IF to_regclass('public.blacklist_access_grants') IS NULL THEN
    IF to_regtype('public.blacklist_access_grants') IS NOT NULL THEN RAISE EXCEPTION 'Tipo homônimo incompatível'; END IF;
    CREATE TABLE public.blacklist_access_grants(
      user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
      status text NOT NULL CHECK(status IN ('ativo','suspenso','revogado')),
      starts_at timestamptz NOT NULL,
      ends_at timestamptz,
      lifetime boolean NOT NULL DEFAULT false,
      granted_by integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
      evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 3 AND 2000),
      reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 2000),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT blacklist_access_interval CHECK(isfinite(starts_at) AND
        ((lifetime AND ends_at IS NULL) OR (NOT lifetime AND ends_at IS NOT NULL AND isfinite(ends_at) AND ends_at > starts_at)))
    );
  END IF;
  IF to_regclass('public.blacklist_access_audit') IS NULL THEN
    IF to_regclass('public.blacklist_access_audit_id_seq') IS NOT NULL OR to_regtype('public.blacklist_access_audit') IS NOT NULL THEN
      RAISE EXCEPTION 'Sequência/tipo audit homônimo incompatível';
    END IF;
    CREATE TABLE public.blacklist_access_audit(
      id bigserial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
      actor_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
      action text NOT NULL CHECK(action IN ('INSERT','UPDATE')),
      before_data jsonb,
      after_data jsonb NOT NULL,
      occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
  END IF;
  FOREACH t IN ARRAY ARRAY['blacklist_access_grants','blacklist_access_audit'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass(format('public.%I',t)) AND relkind='r' AND relpersistence='p' AND NOT relispartition)
      OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=to_regclass(format('public.%I',t)) OR inhparent=to_regclass(format('public.%I',t))) THEN
      RAISE EXCEPTION 'Relação de acesso incompatível: %', t;
    END IF;
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
    SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attname)
      INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=to_regclass(format('public.%I',t)) AND a.attnum>0 AND NOT a.attisdropped;
    SELECT jsonb_agg(jsonb_build_array(v.col,v.typ,v.nn,v.def) ORDER BY v.col) INTO expected
      FROM (VALUES
        ('blacklist_access_grants','user_id','integer',true,NULL),
        ('blacklist_access_grants','status','text',true,NULL),
        ('blacklist_access_grants','starts_at','timestamp with time zone',true,NULL),
        ('blacklist_access_grants','ends_at','timestamp with time zone',false,NULL),
        ('blacklist_access_grants','lifetime','boolean',true,'false'),
        ('blacklist_access_grants','granted_by','integer',true,NULL),
        ('blacklist_access_grants','evidence','text',true,NULL),
        ('blacklist_access_grants','reason','text',true,NULL),
        ('blacklist_access_grants','created_at','timestamp with time zone',true,'now()'),
        ('blacklist_access_grants','updated_at','timestamp with time zone',true,'now()'),
        ('blacklist_access_audit','id','bigint',true,'nextval(''public.blacklist_access_audit_id_seq''::regclass)'),
        ('blacklist_access_audit','user_id','integer',true,NULL),
        ('blacklist_access_audit','actor_id','integer',true,NULL),
        ('blacklist_access_audit','action','text',true,NULL),
        ('blacklist_access_audit','before_data','jsonb',false,NULL),
        ('blacklist_access_audit','after_data','jsonb',true,NULL),
        ('blacklist_access_audit','occurred_at','timestamp with time zone',true,'clock_timestamp()')
      ) v(tbl,col,typ,nn,def) WHERE v.tbl=t;
    IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Colunas/defaults acesso incompatíveis: %',t; END IF;
    IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=to_regclass(format('public.%I',t)))
      OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=to_regclass(format('public.%I',t))) THEN
      RAISE EXCEPTION 'Policies/rules preexistentes de acesso não aprovadas';
    END IF;
  END LOOP;
  -- Validar estrutura de constraints de homônimos por comparação com contrato
  -- numa tabela temporária. Nenhuma correção/descarte de objeto público divergente.
  CREATE TEMP TABLE expected_blacklist_users(id integer PRIMARY KEY) ON COMMIT DROP;
  CREATE TEMP TABLE expected_blacklist_grants(
    user_id integer PRIMARY KEY REFERENCES pg_temp.expected_blacklist_users(id) ON DELETE RESTRICT,
    status text NOT NULL CHECK(status IN ('ativo','suspenso','revogado')),
    starts_at timestamptz NOT NULL, ends_at timestamptz, lifetime boolean NOT NULL DEFAULT false,
    granted_by integer NOT NULL REFERENCES pg_temp.expected_blacklist_users(id) ON DELETE RESTRICT,
    evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 3 AND 2000),
    reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK(isfinite(starts_at) AND ((lifetime AND ends_at IS NULL) OR (NOT lifetime AND ends_at IS NOT NULL AND isfinite(ends_at) AND ends_at>starts_at)))
  ) ON COMMIT DROP;
  CREATE TEMP TABLE expected_blacklist_audit(
    id bigint PRIMARY KEY, user_id integer NOT NULL REFERENCES pg_temp.expected_blacklist_users(id) ON DELETE RESTRICT,
    actor_id integer NOT NULL REFERENCES pg_temp.expected_blacklist_users(id) ON DELETE RESTRICT,
    action text NOT NULL CHECK(action IN ('INSERT','UPDATE')), before_data jsonb,
    after_data jsonb NOT NULL, occurred_at timestamptz NOT NULL
  ) ON COMMIT DROP;
  FOREACH t IN ARRAY ARRAY['blacklist_access_grants','blacklist_access_audit'] LOOP
    SELECT jsonb_agg(jsonb_build_array(replace(pg_get_constraintdef(oid), 'REFERENCES expected_blacklist_users', 'REFERENCES public.users'),convalidated,condeferrable,condeferred) ORDER BY replace(pg_get_constraintdef(oid), 'REFERENCES expected_blacklist_users', 'REFERENCES public.users')) INTO actual
      FROM pg_constraint WHERE conrelid=to_regclass(format('public.%I',t));
    SELECT jsonb_agg(jsonb_build_array(replace(pg_get_constraintdef(oid), 'REFERENCES expected_blacklist_users', 'REFERENCES public.users'),convalidated,condeferrable,condeferred) ORDER BY replace(pg_get_constraintdef(oid), 'REFERENCES expected_blacklist_users', 'REFERENCES public.users')) INTO expected
      FROM pg_constraint WHERE conrelid=to_regclass(CASE WHEN t='blacklist_access_grants' THEN 'pg_temp.expected_blacklist_grants' ELSE 'pg_temp.expected_blacklist_audit' END);
    IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Constraints acesso incompatíveis: %',t; END IF;
    IF (SELECT count(*) FROM pg_index WHERE indrelid=to_regclass(format('public.%I',t))) <> 1
      OR EXISTS(SELECT 1 FROM pg_index WHERE indrelid=to_regclass(format('public.%I',t)) AND (NOT indisprimary OR NOT indisvalid OR NOT indisready)) THEN
      RAISE EXCEPTION 'Índices acesso incompatíveis';
    END IF;
  END LOOP;
  IF to_regprocedure('public.blacklist_access_guard()') IS NULL THEN
    EXECUTE format('CREATE FUNCTION public.blacklist_access_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS %L',guard_body);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.blacklist_access_guard()'::regprocedure
    AND prosrc=guard_body AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog'] AND prorettype='trigger'::regtype AND provolatile='v'
    AND proowner=(SELECT relowner FROM pg_class WHERE oid='public.blacklist_access_audit'::regclass)) THEN
    RAISE EXCEPTION 'Função auditoria incompatível';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.blacklist_access_grants'::regclass AND tgname='blacklist_access_guard_trg') THEN
    CREATE TRIGGER blacklist_access_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.blacklist_access_grants
      FOR EACH ROW EXECUTE FUNCTION public.blacklist_access_guard();
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.blacklist_access_grants'::regclass AND NOT tgisinternal) <> 1
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.blacklist_access_grants'::regclass AND tgname='blacklist_access_guard_trg'
      AND tgfoid='public.blacklist_access_guard()'::regprocedure AND tgtype=31 AND tgenabled='O' AND NOT tgisinternal AND tgqual IS NULL AND tgnargs=0)
    OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.blacklist_access_audit'::regclass AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Gatilhos acesso incompatíveis';
  END IF;
  IF to_regprocedure('public.blacklist_delete_empty_owned(integer,integer)') IS NULL THEN
    EXECUTE format('CREATE FUNCTION public.blacklist_delete_empty_owned(target_id integer, owner_id integer) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS %L',delete_body);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.blacklist_delete_empty_owned(integer,integer)'::regprocedure
    AND prosrc=delete_body AND NOT prosecdef AND proconfig=ARRAY['search_path=pg_catalog'] AND prorettype='boolean'::regtype AND provolatile='v') THEN
    RAISE EXCEPTION 'Função exclusão incompatível';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    AND p.proname IN('blacklist_access_guard','blacklist_delete_empty_owned')
    AND p.oid NOT IN('public.blacklist_access_guard()'::regprocedure,'public.blacklist_delete_empty_owned(integer,integer)'::regprocedure)) THEN
    RAISE EXCEPTION 'Sobrecarga homônima de acesso não aprovada';
  END IF;
  IF pg_get_serial_sequence('public.blacklist_access_audit','id')::regclass IS DISTINCT FROM 'public.blacklist_access_audit_id_seq'::regclass
    OR NOT EXISTS(SELECT 1 FROM pg_sequence WHERE seqrelid='public.blacklist_access_audit_id_seq'::regclass
      AND seqtypid='bigint'::regtype AND seqstart=1 AND seqincrement=1 AND seqmin=1 AND seqcache=1 AND NOT seqcycle)
    OR NOT EXISTS(SELECT 1 FROM pg_depend d JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid
      WHERE d.classid='pg_class'::regclass AND d.objid='public.blacklist_access_audit_id_seq'::regclass
        AND d.refclassid='pg_class'::regclass AND d.deptype='a' AND d.refobjid='public.blacklist_access_audit'::regclass AND a.attname='id') THEN
    RAISE EXCEPTION 'Sequência auditoria incompatível';
  END IF;
  GRANT USAGE ON SCHEMA public TO service_role;
  FOREACH t IN ARRAY ARRAY['blacklist_access_grants','blacklist_access_audit'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated,service_role',t);
    SELECT string_agg(quote_ident(attname),', ') INTO cols FROM pg_attribute WHERE attrelid=to_regclass(format('public.%I',t)) AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM PUBLIC,anon,authenticated,service_role',cols,t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role',t);
    IF t='blacklist_access_grants' THEN EXECUTE format('GRANT INSERT, UPDATE ON TABLE public.%I TO service_role',t); END IF;
    IF has_table_privilege('anon',format('public.%I',t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege('anon',format('public.%I',t),'SELECT,INSERT,UPDATE,REFERENCES')
      OR has_table_privilege('authenticated',format('public.%I',t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege('authenticated',format('public.%I',t),'SELECT,INSERT,UPDATE,REFERENCES')
      OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid=to_regclass(format('public.%I',t))
        AND a.grantee NOT IN(c.relowner,(SELECT oid FROM pg_roles WHERE rolname='service_role')))
      OR EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x WHERE a.attrelid=to_regclass(format('public.%I',t))
        AND x.grantee<>(SELECT relowner FROM pg_class WHERE oid=a.attrelid)) THEN
      RAISE EXCEPTION 'ACL de acesso residual/herdada';
    END IF;
  END LOOP;
  REVOKE ALL ON SEQUENCE public.blacklist_access_audit_id_seq FROM PUBLIC,anon,authenticated,service_role;
  IF has_sequence_privilege('anon','public.blacklist_access_audit_id_seq','USAGE,SELECT,UPDATE')
    OR has_sequence_privilege('authenticated','public.blacklist_access_audit_id_seq','USAGE,SELECT,UPDATE')
    OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid='public.blacklist_access_audit_id_seq'::regclass AND a.grantee<>c.relowner) THEN
    RAISE EXCEPTION 'ACL audit seq residual/herdada';
  END IF;
  REVOKE ALL ON FUNCTION public.blacklist_access_guard(), public.blacklist_delete_empty_owned(integer,integer) FROM PUBLIC,anon,authenticated,service_role;
  GRANT EXECUTE ON FUNCTION public.blacklist_delete_empty_owned(integer,integer) TO service_role;
  IF has_function_privilege('anon','public.blacklist_access_guard()','EXECUTE')
    OR has_function_privilege('authenticated','public.blacklist_access_guard()','EXECUTE')
    OR has_function_privilege('anon','public.blacklist_delete_empty_owned(integer,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.blacklist_delete_empty_owned(integer,integer)','EXECUTE')
    OR has_function_privilege('service_role','public.blacklist_access_guard()','EXECUTE')
    OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
      WHERE p.oid IN('public.blacklist_access_guard()'::regprocedure,'public.blacklist_delete_empty_owned(integer,integer)'::regprocedure)
        AND a.grantee NOT IN(p.proowner, CASE WHEN p.proname='blacklist_delete_empty_owned' THEN (SELECT oid FROM pg_roles WHERE rolname='service_role') ELSE p.proowner END)) THEN
    RAISE EXCEPTION 'ACL função acesso residual/herdada';
  END IF;
END;
$migration$;
