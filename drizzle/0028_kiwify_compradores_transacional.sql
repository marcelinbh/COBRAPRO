-- LOCAL ONLY / PG17. Requires 0027; backend MUST verify raw HMAC + GET sale + allowlist.
-- No adoption/backfill/unique index on legacy users, no financial/onboarding changes.
BEGIN;
DO $install$
DECLARE
  owner_oid oid := current_user::regrole::oid;
  t text; ddl text; f record; existing oid; installing boolean; actual jsonb; expected jsonb;
  table_ddl text := $ddl$(
    order_id text PRIMARY KEY CHECK(order_id ~ '^[A-Za-z0-9_-]{1,128}$'),
    subscription_id text NOT NULL REFERENCES public.kiwify_blacklist_subscriptions(subscription_id) ON DELETE RESTRICT,
    product_id text NOT NULL REFERENCES public.kiwify_blacklist_products(product_id) ON DELETE RESTRICT,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT CHECK(user_id>0),
    email text NOT NULL CHECK(length(email) BETWEEN 3 AND 320 AND email=lower(btrim(email)) AND email !~ '[[:space:][:cntrl:]]' AND email ~ '^[^@]+@[^@.]+(\.[^@.]+)+$'),
    created_user boolean NOT NULL,
    invite_state text NOT NULL CHECK(invite_state IN ('not_needed','pending','sending','accepted','retryable','unknown','blocked')),
    token_hash text CHECK(token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(created_at)),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(updated_at)),
    CHECK(created_user=(invite_state<>'not_needed')),
    CHECK((invite_state IN ('sending','accepted','retryable','unknown','blocked'))=(token_hash IS NOT NULL))
  )$ddl$;
  identity_body text := $fn$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN
    RAISE EXCEPTION 'Vínculo Kiwify imutável' USING ERRCODE='23514';
  END IF;
  IF NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
    OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.email IS DISTINCT FROM OLD.email OR NEW.created_user IS DISTINCT FROM OLD.created_user
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Identidade de comprador imutável' USING ERRCODE='23514';
  END IF;
  IF NOT ((OLD.invite_state IN ('pending','retryable') AND NEW.invite_state='sending' AND NEW.token_hash IS NOT NULL
      AND NEW.token_hash IS DISTINCT FROM OLD.token_hash)
    OR (OLD.invite_state='sending' AND NEW.invite_state IN ('accepted','retryable','unknown','blocked')
      AND NEW.token_hash IS NOT DISTINCT FROM OLD.token_hash)) THEN
    RAISE EXCEPTION 'Transição de convite inválida' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$fn$;
  provision_body text := $fn$
DECLARE
  e jsonb; v_email text; v_hash text; v_open text; k text; v_order text; v_sub text; v_product text;
  v_start timestamptz; v_until timestamptz; v_at timestamptz; v_now timestamptz := clock_timestamp();
  v_user integer; matches integer[]; created boolean := false; b public.kiwify_buyers%ROWTYPE; receipt jsonb;
BEGIN
  IF jsonb_typeof(p_buyer) IS DISTINCT FROM 'object' OR pg_column_size(p_buyer)>8192
    OR NOT p_buyer ?& ARRAY['email','password_hash','open_id','event']
    OR (SELECT count(*) FROM jsonb_object_keys(p_buyer))<>4 THEN
    RAISE EXCEPTION 'DTO comprador inválido' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['email','password_hash','open_id'] LOOP
    IF jsonb_typeof(p_buyer->k) IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'DTO comprador inválido' USING ERRCODE='22023';
    END IF;
  END LOOP;
  v_email:=lower(btrim(p_buyer->>'email')); v_hash:=p_buyer->>'password_hash'; v_open:=p_buyer->>'open_id';
  IF length(v_email) NOT BETWEEN 3 AND 320 OR v_email ~ '[[:space:][:cntrl:]]'
    OR v_email !~ '^[^@]+@[^@.]+(\.[^@.]+)+$'
    OR v_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$'
    OR v_open !~ '^kiwify_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Identidade/hash comprador inválidos' USING ERRCODE='22023';
  END IF;
  e:=p_buyer->'event';
  IF jsonb_typeof(e) IS DISTINCT FROM 'object'
    OR NOT e ?& ARRAY['event_fingerprint','order_id','event_type','subscription_id','product_id','status','start_date','has_access','active_period','access_until','verified_sale_status','event_at']
    OR (SELECT count(*) FROM jsonb_object_keys(e))<>12 THEN
    RAISE EXCEPTION 'DTO paid_period inválido' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['event_fingerprint','order_id','event_type','subscription_id','product_id','status','start_date','access_until','verified_sale_status','event_at'] LOOP
    IF jsonb_typeof(e->k) IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'DTO paid_period inválido' USING ERRCODE='22023';
    END IF;
  END LOOP;
  v_order:=e->>'order_id'; v_sub:=e->>'subscription_id'; v_product:=e->>'product_id';
  IF v_order !~ '^[A-Za-z0-9_-]{1,128}$' OR v_sub !~ '^[A-Za-z0-9_-]{1,128}$'
    OR v_product !~ '^[A-Za-z0-9_-]{1,128}$' OR (e->>'event_fingerprint') !~ '^[0-9a-f]{64}$'
    OR (e->>'event_type') NOT IN ('order_approved','subscription_renewed')
    OR (e->>'verified_sale_status')<>'paid' OR (e->>'status') NOT IN ('active','canceled')
    OR e->'has_access' IS DISTINCT FROM 'true'::jsonb OR e->'active_period' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Somente paid_period pode provisionar' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['start_date','access_until','event_at'] LOOP
    IF (e->>k) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$' THEN
      RAISE EXCEPTION 'Data UTC inválida' USING ERRCODE='22023';
    END IF;
    IF left(e->>k,19)<>to_char((e->>k)::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS')
      OR left(e->>k,4)::integer<1970 THEN
      RAISE EXCEPTION 'Data UTC com rollover inválida' USING ERRCODE='22023';
    END IF;
  END LOOP;
  v_start:=(e->>'start_date')::timestamptz; v_until:=(e->>'access_until')::timestamptz; v_at:=(e->>'event_at')::timestamptz;
  IF NOT isfinite(v_start) OR NOT isfinite(v_until) OR NOT isfinite(v_at)
    OR v_start>v_now OR v_until<=v_now OR v_until<=v_start OR v_until<=v_at
    OR v_until>v_at+interval '367 days' OR v_at>v_now+interval '30 seconds' THEN
    RAISE EXCEPTION 'Período pago completo inválido' USING ERRCODE='22023';
  END IF;
  PERFORM set_config('lock_timeout','5s',true);
  -- Short critical section excludes concurrent REST INSERT/UPDATE/DELETE until
  -- lookup+create+binding+ledger commit. No slow bcrypt/API/email inside SQL.
  LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
  PERFORM 1 FROM public.kiwify_blacklist_products WHERE product_id=v_product AND enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não habilitado' USING ERRCODE='42501'; END IF;
  SELECT array_agg(id ORDER BY id) INTO matches FROM
    (SELECT id FROM public.users WHERE lower(btrim(email))=v_email ORDER BY id LIMIT 2) u;
  IF coalesce(cardinality(matches),0)>1 THEN
    RAISE EXCEPTION 'Email ambíguo' USING ERRCODE='23505';
  END IF;
  SELECT * INTO b FROM public.kiwify_buyers WHERE order_id=v_order FOR UPDATE;
  IF FOUND THEN
    IF b.email<>v_email OR b.subscription_id<>v_sub OR b.product_id<>v_product
      OR cardinality(matches) IS DISTINCT FROM 1 OR matches[1]<>b.user_id THEN
      RAISE EXCEPTION 'Pedido/titular divergentes' USING ERRCODE='23505';
    END IF;
    v_user:=b.user_id; created:=b.created_user;
  ELSE
    IF coalesce(cardinality(matches),0)=1 THEN v_user:=matches[1];
    ELSE
      INSERT INTO public.users("openId",name,email,"passwordHash","loginMethod",role)
        VALUES(v_open,'Cliente CobraPro',v_email,v_hash,'kiwify','user') RETURNING id INTO v_user;
      created:=true;
    END IF;
  END IF;
  -- 0027 independently rechecks immutable subscription/order identity, sticky
  -- refund and full period. Any failure rolls back the brand-new user too.
  receipt:=public.rpc_kiwify_blacklist_consume(e||jsonb_build_object('user_id',v_user));
  IF receipt->'accepted' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Ledger indisponível' USING ERRCODE='23514';
  END IF;
  IF b.order_id IS NULL THEN
    IF created AND (receipt->>'outcome'<>'paid_period' OR receipt->'eligible' IS DISTINCT FROM 'true'::jsonb) THEN
      RAISE EXCEPTION 'Novo comprador sem período pago aprovado' USING ERRCODE='23514';
    END IF;
    INSERT INTO public.kiwify_buyers(order_id,subscription_id,product_id,user_id,email,created_user,invite_state)
      VALUES(v_order,v_sub,v_product,v_user,v_email,created,CASE WHEN created THEN 'pending' ELSE 'not_needed' END)
      RETURNING * INTO b;
  END IF;
  RETURN jsonb_build_object('user_id',v_user,'email',v_email,'created',created,
    'applied',NOT (receipt->>'duplicate')::boolean OR receipt->>'outcome' IN ('financial_revoked','sticky_revocation'),
    'invite_state',b.invite_state);
END;
$fn$;
  claim_body text := $fn$
DECLARE b public.kiwify_buyers%ROWTYPE; v_email text; v_order text; v_token text; matches integer[];
BEGIN
  IF jsonb_typeof(p_claim) IS DISTINCT FROM 'object' OR pg_column_size(p_claim)>2048
    OR NOT p_claim ?& ARRAY['order_id','email','token_hash'] OR (SELECT count(*) FROM jsonb_object_keys(p_claim))<>3
    OR jsonb_typeof(p_claim->'order_id') IS DISTINCT FROM 'string' OR jsonb_typeof(p_claim->'email') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_claim->'token_hash') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'DTO claim inválido' USING ERRCODE='22023';
  END IF;
  v_order:=p_claim->>'order_id'; v_email:=p_claim->>'email'; v_token:=p_claim->>'token_hash';
  IF v_order !~ '^[A-Za-z0-9_-]{1,128}$' OR v_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'DTO claim inválido' USING ERRCODE='22023';
  END IF;
  PERFORM set_config('lock_timeout','5s',true);
  LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO b FROM public.kiwify_buyers WHERE order_id=v_order FOR UPDATE;
  SELECT array_agg(id) INTO matches FROM
    (SELECT id FROM public.users WHERE lower(btrim(email))=v_email ORDER BY id LIMIT 2) u;
  IF b.order_id IS NULL OR b.email<>v_email OR cardinality(matches) IS DISTINCT FROM 1 OR matches[1]<>b.user_id THEN
    RAISE EXCEPTION 'Convite/titular divergentes' USING ERRCODE='23505';
  END IF;
  IF b.invite_state NOT IN ('pending','retryable') OR NOT b.created_user THEN
    RETURN jsonb_build_object('claimed',false,'user_id',b.user_id,'invite_state',b.invite_state);
  END IF;
  PERFORM 1 FROM public.kiwify_blacklist_subscriptions s JOIN public.kiwify_blacklist_products p ON p.product_id=s.product_id
    WHERE s.subscription_id=b.subscription_id AND s.user_id=b.user_id AND s.product_id=b.product_id
      AND p.enabled AND NOT s.financial_revoked AND NOT s.review_required
      AND s.has_access AND s.active_period AND s.status IN ('active','canceled') AND s.access_until>clock_timestamp() FOR SHARE OF s,p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite sem período vigente' USING ERRCODE='42501'; END IF;
  IF v_token IS NOT DISTINCT FROM b.token_hash THEN RAISE EXCEPTION 'Token repetido' USING ERRCODE='22023'; END IF;
  -- A known failed POST permits a NEW token, not a second user. Revoke only the
  -- old invitation token, never another reset or the user's password/session.
  IF b.token_hash IS NOT NULL THEN
    UPDATE public.password_resets SET used=true WHERE user_id=b.user_id AND token=b.token_hash AND NOT used;
  END IF;
  INSERT INTO public.password_resets(user_id,token,expires_at,used)
    VALUES(b.user_id,v_token,clock_timestamp()+interval '1 hour',false);
  UPDATE public.kiwify_buyers SET invite_state='sending',token_hash=v_token,updated_at=clock_timestamp() WHERE order_id=v_order;
  RETURN jsonb_build_object('claimed',true,'user_id',b.user_id,'invite_state','sending');
END;
$fn$;
  finish_body text := $fn$
DECLARE b public.kiwify_buyers%ROWTYPE; v_state text;
BEGIN
  IF jsonb_typeof(p_result) IS DISTINCT FROM 'object' OR pg_column_size(p_result)>2048
    OR NOT p_result ?& ARRAY['order_id','email','token_hash','state'] OR (SELECT count(*) FROM jsonb_object_keys(p_result))<>4
    OR jsonb_typeof(p_result->'order_id') IS DISTINCT FROM 'string' OR jsonb_typeof(p_result->'email') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_result->'token_hash') IS DISTINCT FROM 'string' OR jsonb_typeof(p_result->'state') IS DISTINCT FROM 'string'
    OR (p_result->>'order_id') !~ '^[A-Za-z0-9_-]{1,128}$' OR (p_result->>'token_hash') !~ '^[0-9a-f]{64}$'
    OR (p_result->>'state') NOT IN ('accepted','retryable','unknown','blocked') THEN
    RAISE EXCEPTION 'DTO resultado inválido' USING ERRCODE='22023';
  END IF;
  v_state:=p_result->>'state';
  SELECT * INTO b FROM public.kiwify_buyers WHERE order_id=p_result->>'order_id' FOR UPDATE;
  IF b.order_id IS NULL OR b.email<>p_result->>'email' OR b.token_hash IS DISTINCT FROM p_result->>'token_hash'
    OR NOT b.created_user THEN RAISE EXCEPTION 'Resultado/titular divergentes' USING ERRCODE='23505'; END IF;
  IF b.invite_state='sending' THEN
    UPDATE public.kiwify_buyers SET invite_state=v_state,updated_at=clock_timestamp() WHERE order_id=b.order_id;
  ELSIF b.invite_state<>v_state THEN
    RAISE EXCEPTION 'Resultado CAS divergente' USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object('finished',true,'invite_state',v_state);
END;
$fn$;
BEGIN
  PERFORM set_config('search_path','pg_catalog',true);
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM pg_advisory_xact_lock(190028,1);
  IF current_setting('server_version_num')::integer/10000<>17 THEN RAISE EXCEPTION '0028 exige PG17'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon' AND NOT rolbypassrls AND NOT rolsuper)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolbypassrls AND NOT rolsuper)
    OR current_user IN ('service_role','anon','authenticated') OR pg_has_role('service_role',current_user,'MEMBER')
    OR pg_has_role('anon',current_user,'MEMBER') OR pg_has_role('authenticated',current_user,'MEMBER')
    OR pg_has_role('anon','service_role','MEMBER') OR pg_has_role('authenticated','service_role','MEMBER') THEN
    RAISE EXCEPTION '0028 roles/owner incompatíveis';
  END IF;
  FOR f IN SELECT * FROM (VALUES
    ('users','id','integer',true),('users','openId','character varying(64)',true),('users','name','text',false),
    ('users','email','character varying(320)',false),('users','passwordHash','character varying(255)',false),
    ('users','loginMethod','character varying(64)',false),('users','role','character varying(20)',true),
    ('users','createdAt','timestamp with time zone',true),('users','updatedAt','timestamp with time zone',true),
    ('users','lastSignedIn','timestamp with time zone',true),('users','session_version','integer',true),
    ('users','onboarding_completo','boolean',true),('users','nome_empresa','character varying(255)',false),
    ('password_resets','id','integer',true),('password_resets','user_id','integer',true),
    ('password_resets','token','character varying(255)',true),('password_resets','expires_at','timestamp with time zone',true),
    ('password_resets','used','boolean',true),('password_resets','createdAt','timestamp with time zone',true)
  ) x(tbl,col,typ,nn) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=to_regclass('public.'||f.tbl) AND c.relkind='r' AND c.relpersistence='p'
      AND NOT c.relispartition AND c.relrowsecurity)
      OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=to_regclass('public.'||f.tbl) OR inhparent=to_regclass('public.'||f.tbl))
      OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.'||f.tbl) AND attname=f.col
        AND format_type(atttypid,atttypmod)=f.typ AND attnotnull=f.nn AND NOT attisdropped AND attgenerated='')
      OR NOT has_column_privilege(current_user,'public.'||f.tbl,f.col,'SELECT,INSERT')
      OR NOT (EXISTS(SELECT 1 FROM pg_roles WHERE oid=owner_oid AND (rolsuper OR rolbypassrls))
        OR EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||f.tbl) AND relowner=owner_oid AND NOT relforcerowsecurity)) THEN
      RAISE EXCEPTION '0028 catálogo/owner incompatível: %.%',f.tbl,f.col;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.password_resets'::regclass AND attname='usado' AND NOT attisdropped)
    OR NOT has_column_privilege(current_user,'public.password_resets','used','UPDATE')
    OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='p'
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='id')]::smallint[])
    OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indrelid='public.password_resets'::regclass AND indisunique AND indisvalid AND indisready
      AND indpred IS NULL AND indexprs IS NULL AND indnkeyatts=1 AND NOT indnullsnotdistinct
      AND indkey::text=(SELECT attnum::text FROM pg_attribute WHERE attrelid='public.password_resets'::regclass AND attname='token'))
    OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='rpc_kiwify_blacklist_consume')<>1
    OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_kiwify_blacklist_consume(jsonb)') AND proowner=owner_oid
      AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog']::text[]
      AND obj_description(oid,'pg_proc')='0027_kiwify_assinaturas_blacklist:v1:sha256='||encode(sha256(convert_to(prosrc,'UTF8')),'hex')) THEN
    RAISE EXCEPTION '0028 pré-requisitos 0027/users/reset incompatíveis';
  END IF;
  FOREACH t IN ARRAY ARRAY['users','password_resets'] LOOP
    IF pg_get_serial_sequence('public.'||t,'id') IS NULL THEN RAISE EXCEPTION '0028 id serial requerido: %',t; END IF;
  END LOOP;
  FOR f IN SELECT * FROM (VALUES ('users','createdAt','now()'),('users','updatedAt','now()'),('users','lastSignedIn','now()'),
    ('users','onboarding_completo','false'),('users','session_version','0'),('password_resets','used','false'),('password_resets','createdAt','now()')) x(tbl,col,def) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=to_regclass('public.'||f.tbl) AND a.attname=f.col AND pg_get_expr(d.adbin,d.adrelid)=f.def) THEN
      RAISE EXCEPTION '0028 default incompatível: %.%',f.tbl,f.col;
    END IF;
  END LOOP;
  t:='kiwify_buyers'; ddl:=table_ddl; installing:=to_regclass('public.'||t) IS NULL;
  IF installing THEN
    IF to_regtype('public.'||t) IS NOT NULL THEN RAISE EXCEPTION '0028 tipo homônimo'; END IF;
    IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
      ('kiwify_buyer_identity','rpc_kiwify_buyer_provision','rpc_kiwify_buyer_invite_claim','rpc_kiwify_buyer_invite_finish')) THEN
      RAISE EXCEPTION '0028 pacote parcial/função homônima não pode ser adotado';
    END IF;
    EXECUTE format('CREATE TABLE public.%I %s',t,ddl);
    EXECUTE format('COMMENT ON TABLE public.%I IS %L',t,'0028_kiwify_compradores_transacional:v1:sha256='||encode(sha256(convert_to(ddl,'UTF8')),'hex'));
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    -- Supabase fresh table default ACL includes MAINTAIN in PG17. Strip ONLY
    -- known roles on first creation; unknown defaults and reapply drift refuse.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||t) AND relkind='r' AND relpersistence='p'
    AND NOT relispartition AND relowner=owner_oid AND relrowsecurity AND NOT relforcerowsecurity
    AND obj_description(oid,'pg_class')='0028_kiwify_compradores_transacional:v1:sha256='||encode(sha256(convert_to(ddl,'UTF8')),'hex'))
    OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('public.'||t))
    OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=to_regclass('public.'||t))
    OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=to_regclass('public.'||t) OR inhparent=to_regclass('public.'||t)) THEN
    RAISE EXCEPTION '0028 tabela/proveniência/RLS incompatíveis';
  END IF;
  EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
  CREATE TEMP TABLE expected_buyer_users(id integer PRIMARY KEY) ON COMMIT DROP;
  CREATE TEMP TABLE expected_buyer_products(product_id text PRIMARY KEY) ON COMMIT DROP;
  CREATE TEMP TABLE expected_buyer_subscriptions(subscription_id text PRIMARY KEY) ON COMMIT DROP;
  EXECUTE format('CREATE TEMP TABLE expected_%I %s ON COMMIT DROP',t,
    replace(replace(replace(ddl,'REFERENCES public.users','REFERENCES pg_temp.expected_buyer_users'),
    'REFERENCES public.kiwify_blacklist_products','REFERENCES pg_temp.expected_buyer_products'),
    'REFERENCES public.kiwify_blacklist_subscriptions','REFERENCES pg_temp.expected_buyer_subscriptions'));
  SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated,a.attcollation) ORDER BY a.attnum)
    INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=to_regclass('public.'||t) AND a.attnum>0 AND NOT a.attisdropped;
  SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated,a.attcollation) ORDER BY a.attnum)
    INTO expected FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=to_regclass('pg_temp.expected_'||t) AND a.attnum>0 AND NOT a.attisdropped;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0028 colunas/defaults incompatíveis'; END IF;
  SELECT jsonb_agg(jsonb_build_array(pg_get_constraintdef(oid),convalidated,condeferrable,condeferred) ORDER BY pg_get_constraintdef(oid)) INTO actual FROM pg_constraint WHERE conrelid=to_regclass('public.'||t);
  SELECT jsonb_agg(jsonb_build_array(def,convalidated,condeferrable,condeferred) ORDER BY def) INTO expected FROM (
    SELECT replace(replace(replace(pg_get_constraintdef(oid),'expected_buyer_users','public.users'),
      'expected_buyer_products','public.kiwify_blacklist_products'),
      'expected_buyer_subscriptions','public.kiwify_blacklist_subscriptions') def,
      convalidated,condeferrable,condeferred FROM pg_constraint WHERE conrelid=to_regclass('pg_temp.expected_'||t)) normalized;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0028 constraints incompatíveis'; END IF;
  IF (SELECT count(*) FROM pg_index WHERE indrelid=to_regclass('public.'||t))<>1
    OR EXISTS(SELECT 1 FROM pg_index WHERE indrelid=to_regclass('public.'||t) AND (NOT indisprimary OR NOT indisvalid OR NOT indisready OR indpred IS NOT NULL OR indexprs IS NOT NULL))
    OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid=to_regclass('public.'||t) AND (a.grantee<>owner_oid OR a.grantor<>owner_oid OR a.is_grantable))
    OR EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x WHERE a.attrelid=to_regclass('public.'||t) AND (x.grantee<>owner_oid OR x.grantor<>owner_oid OR x.is_grantable)) THEN
    RAISE EXCEPTION '0028 índices/ACL incompatíveis';
  END IF;
  FOREACH t IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(t,'public.kiwify_buyers','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(t,'public.kiwify_buyers','SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION '0028 ACL efetiva incompatível'; END IF;
  END LOOP;
  FOR f IN SELECT * FROM (VALUES
    ('kiwify_buyer_identity','',NULL::text[],'trigger',identity_body,false),
    ('rpc_kiwify_buyer_provision','p_buyer jsonb',ARRAY['p_buyer']::text[],'jsonb',provision_body,true),
    ('rpc_kiwify_buyer_invite_claim','p_claim jsonb',ARRAY['p_claim']::text[],'jsonb',claim_body,true),
    ('rpc_kiwify_buyer_invite_finish','p_result jsonb',ARRAY['p_result']::text[],'jsonb',finish_body,true)
  ) x(name,args,argnames,ret,body,executable) LOOP
    SELECT p.oid INTO existing FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=f.name;
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=f.name)>1 THEN RAISE EXCEPTION '0028 overload homônimo: %',f.name; END IF;
    IF existing IS NULL THEN
      IF NOT installing THEN RAISE EXCEPTION '0028 função ausente não pode reparar: %',f.name; END IF;
      EXECUTE format('CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql VOLATILE SECURITY DEFINER PARALLEL UNSAFE SET search_path=pg_catalog AS %L',f.name,f.args,f.ret,f.body);
      SELECT oid INTO existing FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=f.name;
      EXECUTE format('COMMENT ON FUNCTION %s IS %L',existing::regprocedure,'0028_kiwify_compradores_transacional:v1:sha256='||encode(sha256(convert_to(f.body,'UTF8')),'hex'));
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',existing::regprocedure);
      IF f.executable THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',existing::regprocedure); END IF;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=existing AND p.proowner=owner_oid AND p.prosrc=f.body
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql') AND p.prorettype=f.ret::regtype
      AND p.proargtypes=CASE WHEN f.executable THEN '3802'::oidvector ELSE ''::oidvector END
      AND p.proargnames IS NOT DISTINCT FROM f.argnames AND p.proallargtypes IS NULL AND p.proargmodes IS NULL
      AND p.pronargdefaults=0 AND p.provariadic=0 AND p.prokind='f' AND NOT p.proretset
      AND p.prosecdef AND NOT p.proleakproof AND NOT p.proisstrict AND p.provolatile='v' AND p.proparallel='u'
      AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND p.procost=100 AND p.prorows=0 AND p.prosupport=0
      AND obj_description(p.oid,'pg_proc')='0028_kiwify_compradores_transacional:v1:sha256='||encode(sha256(convert_to(f.body,'UTF8')),'hex')
      AND NOT EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantor<>owner_oid
        OR a.grantee NOT IN(owner_oid,CASE WHEN f.executable THEN 'service_role'::regrole::oid ELSE owner_oid END))
      AND (NOT f.executable OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee='service_role'::regrole::oid AND a.privilege_type='EXECUTE')))
      OR has_function_privilege('anon',existing,'EXECUTE') OR has_function_privilege('authenticated',existing,'EXECUTE')
      OR (NOT f.executable AND has_function_privilege('service_role',existing,'EXECUTE')) THEN
      RAISE EXCEPTION '0028 função/hash/metadata/ACL incompatíveis: %',f.name;
    END IF;
  END LOOP;
  FOR f IN SELECT * FROM (VALUES ('kiwify_buyers_identity',27,'BEFORE UPDATE OR DELETE','FOR EACH ROW'),
    ('kiwify_buyers_no_truncate',34,'BEFORE TRUNCATE','FOR EACH STATEMENT')) x(name,typ,timing,scope) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.kiwify_buyers'::regclass AND tgname=f.name) THEN
      IF NOT installing THEN RAISE EXCEPTION '0028 gatilho ausente'; END IF;
      EXECUTE format('CREATE TRIGGER %I %s ON public.kiwify_buyers %s EXECUTE FUNCTION public.kiwify_buyer_identity()',f.name,f.timing,f.scope);
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.kiwify_buyers'::regclass AND tgname=f.name
      AND tgfoid=to_regprocedure('public.kiwify_buyer_identity()') AND tgtype=f.typ AND tgenabled='O' AND NOT tgisinternal
      AND tgqual IS NULL AND tgnargs=0 AND tgattr=''::int2vector AND tgconstraint=0) THEN RAISE EXCEPTION '0028 gatilho incompatível'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.kiwify_buyers'::regclass AND NOT tgisinternal)<>2 THEN
    RAISE EXCEPTION '0028 gatilho extra';
  END IF;
  GRANT USAGE ON SCHEMA public TO service_role;
END;
$install$;
COMMIT;
