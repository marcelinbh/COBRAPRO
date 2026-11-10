-- LOCAL ONLY / PostgreSQL 17. Não adota grants/cadastro/assinaturas financeiras legados.
-- Backend: HMAC-SHA1(raw bytes) + GET /sales/{order_id} reais ANTES da RPC.
-- O banco recebe apenas DTO normalizado; não verifica HMAC/API upstream. Email só no reader service-only.
BEGIN;
DO $install$
DECLARE
  t text; ddl text; actual jsonb; expected jsonb; f record; existing oid;
  fresh boolean; owner_oid oid := current_user::regrole::oid;
  installing boolean; table_count integer;
  products_ddl text := $ddl$(
    product_id text PRIMARY KEY CHECK(product_id ~ '^[A-Za-z0-9_-]{1,128}$'),
    enabled boolean NOT NULL DEFAULT false
  )$ddl$;
  subscriptions_ddl text := $ddl$(
    subscription_id text PRIMARY KEY CHECK(subscription_id ~ '^[A-Za-z0-9_-]{1,128}$'),
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT CHECK(user_id > 0),
    product_id text NOT NULL REFERENCES public.kiwify_blacklist_products(product_id) ON DELETE RESTRICT,
    start_date timestamptz CHECK(start_date IS NULL OR isfinite(start_date)),
    access_until timestamptz CHECK(access_until IS NULL OR (isfinite(access_until) AND start_date IS NOT NULL AND access_until > start_date)),
    last_paid_order_id text CHECK(last_paid_order_id IS NULL OR last_paid_order_id ~ '^[A-Za-z0-9_-]{1,128}$'),
    status text CHECK(status IS NULL OR status IN ('active','waiting_payment','canceled','ended')),
    has_access boolean NOT NULL DEFAULT false,
    active_period boolean NOT NULL DEFAULT false,
    financial_revoked boolean NOT NULL DEFAULT false,
    review_required boolean NOT NULL DEFAULT false,
    latest_event_at timestamptz CHECK(latest_event_at IS NULL OR isfinite(latest_event_at)),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(created_at)),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(updated_at)),
    CHECK(NOT (has_access OR active_period) OR (access_until IS NOT NULL AND last_paid_order_id IS NOT NULL)),
    CHECK(NOT financial_revoked OR (NOT has_access AND NOT active_period))
  )$ddl$;
  events_ddl text := $ddl$(
    order_id text NOT NULL CHECK(order_id ~ '^[A-Za-z0-9_-]{1,128}$'),
    event_type text NOT NULL CHECK(event_type IN ('order_approved','subscription_renewed','subscription_canceled','subscription_late','order_refunded','chargeback','order_rejected','billet_created','pix_created')),
    event_fingerprint text NOT NULL CHECK(event_fingerprint ~ '^[0-9a-f]{64}$'),
    subscription_id text NOT NULL REFERENCES public.kiwify_blacklist_subscriptions(subscription_id) ON DELETE RESTRICT,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT CHECK(user_id > 0),
    product_id text NOT NULL REFERENCES public.kiwify_blacklist_products(product_id) ON DELETE RESTRICT,
    event_at timestamptz CHECK(event_at IS NULL OR isfinite(event_at)),
    status text CHECK(status IS NULL OR status IN ('active','waiting_payment','canceled','ended')),
    start_date timestamptz CHECK(start_date IS NULL OR isfinite(start_date)),
    has_access boolean,
    active_period boolean,
    access_until timestamptz CHECK(access_until IS NULL OR isfinite(access_until)),
    verified_sale_status text NOT NULL CHECK(verified_sale_status IN ('paid','waiting_payment','refused','refunded','chargedback')),
    outcome text NOT NULL CHECK(outcome IN ('paid_period','financial_revoked','sticky_revocation','stale','same_paid_order','observed_no_grant')),
    received_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK(isfinite(received_at)),
    PRIMARY KEY(order_id,event_type,event_fingerprint)
  )$ddl$;
  immutable_body text := $fn$
BEGIN
  RAISE EXCEPTION 'Ledger Kiwify append-only: alteração/exclusão/truncate proibidos' USING ERRCODE='23514';
END;
$fn$;
  identity_body text := $fn$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Assinatura Kiwify não pode ser excluída' USING ERRCODE='23514';
  END IF;
  IF NEW.subscription_id IS DISTINCT FROM OLD.subscription_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.financial_revoked AND NOT NEW.financial_revoked)
     OR (OLD.review_required AND NOT NEW.review_required)
     OR (OLD.access_until IS NOT NULL AND (NEW.access_until IS NULL OR NEW.access_until < OLD.access_until))
     OR (OLD.latest_event_at IS NOT NULL AND (NEW.latest_event_at IS NULL OR NEW.latest_event_at < OLD.latest_event_at)) THEN
    RAISE EXCEPTION 'Identidade/período/watermark/revogação Kiwify imutáveis ou monotônicos' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$fn$;
  consume_body text := $fn$
DECLARE
  v_order text; v_type text; v_fp text; v_sub text; v_user integer; v_product text; v_sale text;
  v_status text; v_start timestamptz; v_until timestamptz; v_at timestamptz;
  v_has boolean; v_active boolean; v_financial boolean; v_positive boolean;
  v_now timestamptz := clock_timestamp(); v_value text; k text;
  s public.kiwify_blacklist_subscriptions%ROWTYPE;
  e public.kiwify_blacklist_events%ROWTYPE;
  v_duplicate boolean := false; v_outcome text := 'observed_no_grant';
BEGIN
  -- Privileged DTO only: reject extra keys to avoid storing PII/secrets or frontend assertions.
  IF jsonb_typeof(p_event) IS DISTINCT FROM 'object' OR pg_column_size(p_event)>8192
     OR NOT p_event ?& ARRAY['event_fingerprint','order_id','event_type','subscription_id','user_id','product_id','verified_sale_status']
     OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_event) x(key) WHERE x.key NOT IN
       ('event_fingerprint','order_id','event_type','subscription_id','user_id','product_id','status','start_date','has_access','active_period','access_until','verified_sale_status','event_at')) THEN
    RAISE EXCEPTION 'DTO Kiwify inválido/chaves não aprovadas' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['event_fingerprint','order_id','event_type','subscription_id','product_id','verified_sale_status'] LOOP
    IF jsonb_typeof(p_event->k) IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Identidade Kiwify inválida' USING ERRCODE='22023';
    END IF;
  END LOOP;
  v_order:=p_event->>'order_id'; v_type:=p_event->>'event_type'; v_fp:=p_event->>'event_fingerprint';
  v_sub:=p_event->>'subscription_id'; v_product:=p_event->>'product_id'; v_sale:=p_event->>'verified_sale_status';
  IF v_order !~ '^[A-Za-z0-9_-]{1,128}$' OR v_sub !~ '^[A-Za-z0-9_-]{1,128}$'
     OR v_product !~ '^[A-Za-z0-9_-]{1,128}$' OR v_fp !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(p_event->'user_id') IS DISTINCT FROM 'number'
     OR (p_event->>'user_id') !~ '^[1-9][0-9]{0,9}$'
     OR (p_event->>'user_id')::numeric > 2147483647
     OR v_type NOT IN ('order_approved','subscription_renewed','subscription_canceled','subscription_late','order_refunded','chargeback','order_rejected','billet_created','pix_created')
     OR v_sale NOT IN ('paid','waiting_payment','refused','refunded','chargedback') THEN
    RAISE EXCEPTION 'Identidade/tipo/venda Kiwify inválidos' USING ERRCODE='22023';
  END IF;
  v_user:=(p_event->>'user_id')::integer;
  v_financial:=v_type IN ('order_refunded','chargeback') OR v_sale IN ('refunded','chargedback');
  -- Financial evidence MUST revoke even without/malformed customer_access or dates.
  IF NOT v_financial THEN
    v_status:=p_event->>'status';
    IF v_status IS NOT NULL AND (jsonb_typeof(p_event->'status')<>'string' OR v_status NOT IN ('active','waiting_payment','canceled','ended')) THEN
      RAISE EXCEPTION 'Status Kiwify inválido' USING ERRCODE='22023';
    END IF;
    FOREACH k IN ARRAY ARRAY['has_access','active_period'] LOOP
      IF p_event ? k AND p_event->k <> 'null'::jsonb AND jsonb_typeof(p_event->k)<>'boolean' THEN
        RAISE EXCEPTION 'Flag Kiwify inválida' USING ERRCODE='22023';
      END IF;
    END LOOP;
    v_has:=(p_event->>'has_access')::boolean; v_active:=(p_event->>'active_period')::boolean;
    FOREACH k IN ARRAY ARRAY['start_date','access_until','event_at'] LOOP
      v_value:=p_event->>k;
      IF v_value IS NOT NULL THEN
        IF jsonb_typeof(p_event->k)<>'string' OR v_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z?$' THEN
          RAISE EXCEPTION 'Data Kiwify deve ser UTC documentada' USING ERRCODE='22023';
        END IF;
        BEGIN
          IF right(v_value,1)='Z' THEN v_value:=left(v_value,length(v_value)-1); END IF;
          CASE k
            WHEN 'start_date' THEN v_start:=v_value::timestamp AT TIME ZONE 'UTC';
            WHEN 'access_until' THEN v_until:=v_value::timestamp AT TIME ZONE 'UTC';
            WHEN 'event_at' THEN v_at:=v_value::timestamp AT TIME ZONE 'UTC';
          END CASE;
        EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
          RAISE EXCEPTION 'Data Kiwify inválida' USING ERRCODE='22023';
        END;
      END IF;
    END LOOP;
    IF v_at IS NULL OR NOT isfinite(v_at) OR v_at > v_now+interval '30 seconds'
       OR (v_start IS NOT NULL AND NOT isfinite(v_start)) OR (v_until IS NOT NULL AND NOT isfinite(v_until)) THEN
      RAISE EXCEPTION 'Timestamp do evento ausente/futuro/não finito' USING ERRCODE='22023';
    END IF;
  END IF;
  -- Lock order first, subscription second: concurrent order reuse cannot cross identities.
  PERFORM pg_advisory_xact_lock(hashtextextended('0027:order:'||v_order,27001));
  PERFORM pg_advisory_xact_lock(hashtextextended('0027:subscription:'||v_sub,27002));
  -- Product exists even if disabled; disabled product cannot grant, but MUST still revoke.
  PERFORM 1 FROM public.kiwify_blacklist_products WHERE product_id=v_product FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto Kiwify não aprovado' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.users WHERE id=v_user FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário Kiwify indisponível' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.kiwify_blacklist_events WHERE order_id=v_order LIMIT 1;
  IF FOUND AND (e.subscription_id<>v_sub OR e.user_id<>v_user OR e.product_id<>v_product) THEN
    RAISE EXCEPTION 'Pedido Kiwify já vinculado a outra identidade' USING ERRCODE='23505';
  END IF;
  SELECT * INTO s FROM public.kiwify_blacklist_subscriptions WHERE subscription_id=v_sub FOR UPDATE;
  IF FOUND AND (s.user_id<>v_user OR s.product_id<>v_product) THEN
    RAISE EXCEPTION 'Assinatura Kiwify possui titular/produto imutáveis' USING ERRCODE='23505';
  END IF;
  IF NOT FOUND THEN
    INSERT INTO public.kiwify_blacklist_subscriptions(subscription_id,user_id,product_id)
      VALUES(v_sub,v_user,v_product) RETURNING * INTO s;
  END IF;
  SELECT * INTO e FROM public.kiwify_blacklist_events
    WHERE order_id=v_order AND event_type=v_type AND event_fingerprint=v_fp;
  v_duplicate:=FOUND;
  v_positive:=v_type IN ('order_approved','subscription_renewed') AND v_sale='paid';
  IF v_financial THEN
    -- A replay whose API sale is NOW refunded must also revoke; original ledger row is never rewritten.
    v_outcome:='financial_revoked';
    IF NOT s.financial_revoked THEN
      UPDATE public.kiwify_blacklist_subscriptions SET financial_revoked=true,has_access=false,active_period=false,
        updated_at=v_now WHERE subscription_id=v_sub;
    END IF;
  ELSIF s.financial_revoked THEN
    v_outcome:='sticky_revocation';
    IF v_positive AND NOT s.review_required THEN
      UPDATE public.kiwify_blacklist_subscriptions SET review_required=true,updated_at=v_now WHERE subscription_id=v_sub;
    END IF;
  ELSIF v_duplicate THEN
    v_outcome:=e.outcome;
  ELSIF s.latest_event_at IS NOT NULL AND v_at<=s.latest_event_at THEN
    v_outcome:='stale';
  ELSE
    -- Old paid order cannot extend again under a different event type/raw body or fabricated newer date.
    IF v_positive AND EXISTS(SELECT 1 FROM public.kiwify_blacklist_events
        WHERE order_id=v_order AND outcome='paid_period') THEN
      v_outcome:='same_paid_order';
    ELSIF v_positive AND v_status IN ('active','canceled') AND v_has AND v_active
        AND v_start IS NOT NULL AND v_start<=v_now AND v_until IS NOT NULL
        AND v_until>v_now AND v_until>v_start AND v_until>v_at
        -- Explicit safety ceiling: documented longest cycle is annual, not lifetime.
        AND v_until<=v_at+interval '367 days'
        AND EXISTS(SELECT 1 FROM public.kiwify_blacklist_products WHERE product_id=v_product AND enabled)
        AND (s.access_until IS NULL OR v_until>s.access_until)
        AND (s.start_date IS NULL OR s.start_date=v_start) THEN
      v_outcome:='paid_period';
      UPDATE public.kiwify_blacklist_subscriptions SET start_date=v_start,
        access_until=CASE WHEN access_until IS NULL THEN v_until ELSE greatest(access_until,v_until) END,
        last_paid_order_id=v_order,status=v_status,has_access=true,active_period=true,latest_event_at=v_at,
        updated_at=v_now WHERE subscription_id=v_sub;
    ELSE
      -- Observation can close but NEVER reopen/extend a paid period. Canceled retains current paid flags.
      UPDATE public.kiwify_blacklist_subscriptions SET status=coalesce(v_status,status),
        has_access=has_access AND coalesce(v_has,true) AND coalesce(v_status NOT IN ('waiting_payment','ended'),true),
        active_period=active_period AND coalesce(v_active,true) AND coalesce(v_status NOT IN ('waiting_payment','ended'),true),
        latest_event_at=v_at,updated_at=v_now WHERE subscription_id=v_sub;
    END IF;
    IF v_outcome='same_paid_order' THEN
      UPDATE public.kiwify_blacklist_subscriptions SET latest_event_at=v_at,updated_at=v_now WHERE subscription_id=v_sub;
    END IF;
  END IF;
  IF NOT v_duplicate THEN
    INSERT INTO public.kiwify_blacklist_events(order_id,event_type,event_fingerprint,subscription_id,user_id,product_id,
      event_at,status,start_date,has_access,active_period,access_until,verified_sale_status,outcome)
      VALUES(v_order,v_type,v_fp,v_sub,v_user,v_product,v_at,v_status,v_start,v_has,v_active,v_until,v_sale,v_outcome);
  END IF;
  SELECT * INTO STRICT s FROM public.kiwify_blacklist_subscriptions WHERE subscription_id=v_sub;
  RETURN jsonb_build_object('accepted',true,'duplicate',v_duplicate,'outcome',v_outcome,'subscription_id',v_sub,
    'eligible',NOT s.financial_revoked AND NOT s.review_required AND s.has_access AND s.active_period
      AND coalesce(s.status IN ('active','canceled'),false) AND coalesce(s.access_until>clock_timestamp(),false)
      AND EXISTS(SELECT 1 FROM public.kiwify_blacklist_products WHERE product_id=v_product AND enabled),
    'access_until',CASE WHEN s.access_until IS NULL THEN NULL ELSE to_char(s.access_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
    'financial_revoked',s.financial_revoked,'review_required',s.review_required);
END;
$fn$;
  access_body text := $fn$
DECLARE s record;
BEGIN
  IF p_user_id IS NULL OR p_user_id<=0 THEN
    RAISE EXCEPTION 'Usuário inválido para gate Kiwify' USING ERRCODE='22023';
  END IF;
  -- Evaluate time on EVERY read. No cron, user role, manual/lifetime grant or legacy fallback.
  SELECT k.subscription_id,k.user_id,k.product_id,k.last_paid_order_id,k.status,k.start_date,
      k.has_access,k.active_period,k.access_until,k.financial_revoked,k.review_required INTO s
    FROM public.kiwify_blacklist_subscriptions k
    JOIN public.kiwify_blacklist_products p ON p.product_id=k.product_id AND p.enabled
    JOIN public.users u ON u.id=k.user_id
    WHERE k.user_id=p_user_id AND NOT k.financial_revoked AND NOT k.review_required
      AND k.has_access AND k.active_period AND k.status IN ('active','canceled')
      AND k.start_date<=clock_timestamp() AND isfinite(k.start_date) AND k.last_paid_order_id IS NOT NULL
      AND k.access_until>clock_timestamp() AND isfinite(k.access_until)
    ORDER BY k.access_until DESC,k.subscription_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible',false,'subscription_id',NULL,'user_id',NULL,'product_id',NULL,
      'last_paid_order_id',NULL,'status',NULL,'start_date',NULL,'has_access',NULL,'active_period',NULL,
      'access_until',NULL,'financial_revoked',NULL,'review_required',NULL);
  END IF;
  RETURN jsonb_build_object('eligible',true,'subscription_id',s.subscription_id,'user_id',s.user_id,
    'product_id',s.product_id,'last_paid_order_id',s.last_paid_order_id,'status',s.status,
    'start_date',to_char(s.start_date AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'has_access',s.has_access,'active_period',s.active_period,
    'access_until',to_char(s.access_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'financial_revoked',s.financial_revoked,'review_required',s.review_required);
END;
$fn$;
  order_binding_body text := $fn$
DECLARE s record;
BEGIN
  IF p_order_id IS NULL OR p_order_id !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RAISE EXCEPTION 'Pedido inválido para reader Kiwify' USING ERRCODE='22023';
  END IF;
  -- Existing immutable order identity only. Never infer by email/product/current eligibility.
  SELECT e.subscription_id,e.user_id,e.product_id INTO s
    FROM public.kiwify_blacklist_events e
    JOIN public.kiwify_blacklist_subscriptions k ON k.subscription_id=e.subscription_id
      AND k.user_id=e.user_id AND k.product_id=e.product_id
    WHERE e.order_id=p_order_id AND NOT EXISTS(
      SELECT 1 FROM public.kiwify_blacklist_events other WHERE other.order_id=e.order_id
        AND (other.subscription_id<>e.subscription_id OR other.user_id<>e.user_id OR other.product_id<>e.product_id))
    ORDER BY e.event_type,e.event_fingerprint LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('subscription_id',s.subscription_id,'user_id',s.user_id,'product_id',s.product_id);
END;
$fn$;
  find_users_body text := $fn$
DECLARE v_email text;
BEGIN
  IF p_email IS NULL OR octet_length(p_email)>8192 THEN
    RAISE EXCEPTION 'Email inválido para reader Kiwify' USING ERRCODE='22023';
  END IF;
  v_email:=lower(btrim(p_email));
  IF length(v_email) NOT BETWEEN 3 AND 320 OR v_email ~ '[[:space:][:cntrl:]]'
     OR v_email !~ '^[^@]+@[^@.]+(\.[^@.]+)+$' THEN
    RAISE EXCEPTION 'Email inválido para reader Kiwify' USING ERRCODE='22023';
  END IF;
  -- Server-only users PII, not ledger. Keep two candidates: ambiguity MUST deny in backend.
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'email',u.email) ORDER BY u.id)
    FROM (SELECT id,email FROM public.users WHERE lower(btrim(email))=v_email ORDER BY id LIMIT 2) u),'[]'::jsonb);
END;
$fn$;
BEGIN
  PERFORM set_config('search_path','pg_catalog',true);
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM pg_advisory_xact_lock(190027,1);
  IF current_setting('server_version_num')::integer/10000<>17 THEN RAISE EXCEPTION '0027 exige PG17'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper)
     OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon' AND NOT rolbypassrls AND NOT rolsuper)
     OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolbypassrls AND NOT rolsuper) THEN
    RAISE EXCEPTION '0027 roles ausentes/incompatíveis';
  END IF;
  IF current_user IN ('service_role','anon','authenticated') OR pg_has_role('service_role',current_user,'MEMBER')
     OR pg_has_role('anon',current_user,'MEMBER') OR pg_has_role('authenticated',current_user,'MEMBER')
     OR pg_has_role('anon','service_role','MEMBER') OR pg_has_role('authenticated','service_role','MEMBER') THEN
    RAISE EXCEPTION '0027 owner/roles inseguros';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.users') AND relkind='r' AND relpersistence='p' AND NOT relispartition AND relrowsecurity)
     OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.users') AND attname='id' AND atttypid='integer'::regtype AND attnotnull AND NOT attisdropped)
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.users') AND contype='p'
       AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=to_regclass('public.users') AND attname='id' AND NOT attisdropped)]::smallint[])
     OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=to_regclass('public.users') OR inhparent=to_regclass('public.users')) THEN
    RAISE EXCEPTION '0027 requer users(id integer PK), RLS e tabela produtiva simples';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.users') AND attname='email'
       AND atttypid IN ('text'::regtype,'varchar'::regtype) AND NOT attisdropped AND attgenerated='')
     OR NOT has_column_privilege(current_user,'public.users','id','SELECT')
     OR NOT has_column_privilege(current_user,'public.users','email','SELECT')
     OR NOT (EXISTS(SELECT 1 FROM pg_roles WHERE oid=owner_oid AND (rolsuper OR rolbypassrls))
       OR EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.users') AND relowner=owner_oid AND NOT relforcerowsecurity)) THEN
    RAISE EXCEPTION '0027 requer users.email text/varchar e owner leitor id/email sem filtro RLS';
  END IF;
  -- Public homonyms are never adopted: require provenance marker + exact structure/owner/ACL.
  SELECT count(*) INTO table_count FROM pg_class WHERE relnamespace='public'::regnamespace
    AND relname IN ('kiwify_blacklist_products','kiwify_blacklist_subscriptions','kiwify_blacklist_events');
  IF table_count NOT IN (0,3) THEN RAISE EXCEPTION '0027 pacote parcial não pode ser reparado'; END IF;
  installing:=table_count=0;
  -- Temp expected tables permit comparison of normalized constraints/indexes without correcting public tables.
  CREATE TEMP TABLE expected_kiwify_users(id integer PRIMARY KEY) ON COMMIT DROP;
  FOREACH t IN ARRAY ARRAY['kiwify_blacklist_products','kiwify_blacklist_subscriptions','kiwify_blacklist_events'] LOOP
    ddl:=CASE t WHEN 'kiwify_blacklist_products' THEN products_ddl WHEN 'kiwify_blacklist_subscriptions' THEN subscriptions_ddl ELSE events_ddl END;
    fresh:=to_regclass('public.'||t) IS NULL;
    IF fresh THEN
      IF to_regtype('public.'||t) IS NOT NULL THEN RAISE EXCEPTION '0027 tipo homônimo: %',t; END IF;
      EXECUTE format('CREATE TABLE public.%I %s',t,ddl);
      EXECUTE format('COMMENT ON TABLE public.%I IS %L',t,'0027_kiwify_assinaturas_blacklist:v1:sha256='||encode(sha256(convert_to(ddl,'UTF8')),'hex'));
      -- Supabase default ACL grants ALL (including PG17 MAINTAIN) to these roles.
      -- Normalize ONLY this package's freshly created tables; never repair reapply drift
      -- or revoke an unknown principal. Residual ACL below must still fail closed.
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated,service_role',t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||t) AND relkind='r' AND relpersistence='p'
       AND NOT relispartition AND relowner=owner_oid AND relrowsecurity AND NOT relforcerowsecurity
       AND obj_description(oid,'pg_class')='0027_kiwify_assinaturas_blacklist:v1:sha256='||encode(sha256(convert_to(ddl,'UTF8')),'hex'))
       OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=to_regclass('public.'||t) OR inhparent=to_regclass('public.'||t))
       OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('public.'||t))
       OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=to_regclass('public.'||t)) THEN
      RAISE EXCEPTION '0027 relação/proveniência/RLS/policy/rule incompatível: %',t;
    END IF;
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
    EXECUTE format('CREATE TEMP TABLE expected_%I %s ON COMMIT DROP',t,
      replace(replace(replace(ddl,'REFERENCES public.users','REFERENCES pg_temp.expected_kiwify_users'),
      'REFERENCES public.kiwify_blacklist_products','REFERENCES pg_temp.expected_kiwify_blacklist_products'),
      'REFERENCES public.kiwify_blacklist_subscriptions','REFERENCES pg_temp.expected_kiwify_blacklist_subscriptions'));
    SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
      pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated,a.attcollation) ORDER BY a.attnum)
      INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=to_regclass('public.'||t) AND a.attnum>0 AND NOT a.attisdropped;
    SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
      pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated,a.attcollation) ORDER BY a.attnum)
      INTO expected FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=to_regclass('pg_temp.expected_'||t) AND a.attnum>0 AND NOT a.attisdropped;
    IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0027 colunas/defaults/types incompatíveis: %',t; END IF;
    SELECT jsonb_agg(jsonb_build_array(pg_get_constraintdef(oid),convalidated,condeferrable,condeferred) ORDER BY pg_get_constraintdef(oid)) INTO actual
      FROM pg_constraint WHERE conrelid=to_regclass('public.'||t);
    SELECT jsonb_agg(jsonb_build_array(def,convalidated,condeferrable,condeferred) ORDER BY def) INTO expected FROM (
      SELECT replace(replace(replace(pg_get_constraintdef(oid),'expected_kiwify_users','public.users'),
        'expected_kiwify_blacklist_products','public.kiwify_blacklist_products'),
        'expected_kiwify_blacklist_subscriptions','public.kiwify_blacklist_subscriptions') def,
        convalidated,condeferrable,condeferred FROM pg_constraint
        WHERE conrelid=to_regclass('pg_temp.expected_'||t)) normalized;
    IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0027 constraints incompatíveis: %',t; END IF;
    IF (SELECT count(*) FROM pg_index WHERE indrelid=to_regclass('public.'||t))<>1
       OR EXISTS(SELECT 1 FROM pg_index WHERE indrelid=to_regclass('public.'||t) AND (NOT indisprimary OR NOT indisvalid OR NOT indisready OR indpred IS NOT NULL OR indexprs IS NOT NULL)) THEN
      RAISE EXCEPTION '0027 índices incompatíveis: %',t;
    END IF;
    IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid=to_regclass('public.'||t)
         AND (a.grantee<>owner_oid OR a.grantor<>owner_oid))
       OR EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
         WHERE a.attrelid=to_regclass('public.'||t) AND (x.grantee<>owner_oid OR x.grantor<>owner_oid))
       OR has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,REFERENCES')
       OR has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,REFERENCES')
       OR has_table_privilege('service_role','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege('service_role','public.'||t,'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION '0027 ACL residual/herdada incompatível: %',t;
    END IF;
  END LOOP;
  FOR f IN SELECT * FROM (VALUES
    ('kiwify_blacklist_immutable','',NULL::text[], 'trigger',immutable_body,false),
    ('kiwify_blacklist_identity','',NULL::text[], 'trigger',identity_body,false),
    ('rpc_kiwify_blacklist_consume','p_event jsonb',ARRAY['p_event']::text[],'jsonb',consume_body,true),
    ('rpc_kiwify_blacklist_access','p_user_id integer',ARRAY['p_user_id']::text[],'jsonb',access_body,true),
    ('rpc_kiwify_blacklist_order_binding','p_order_id text',ARRAY['p_order_id']::text[],'jsonb',order_binding_body,true),
    ('rpc_kiwify_blacklist_find_users','p_email text',ARRAY['p_email']::text[],'jsonb',find_users_body,true)
  ) v(name,args,argnames,ret,body,executable) LOOP
    SELECT p.oid INTO existing FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=f.name;
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=f.name)>1 THEN RAISE EXCEPTION '0027 overload homônimo: %',f.name; END IF;
    IF existing IS NULL THEN
      IF NOT installing THEN RAISE EXCEPTION '0027 função ausente não pode ser reparada: %',f.name; END IF;
      EXECUTE format('CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql VOLATILE SECURITY DEFINER PARALLEL UNSAFE SET search_path=pg_catalog AS %L',f.name,f.args,f.ret,f.body);
      SELECT p.oid INTO existing FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=f.name;
      EXECUTE format('COMMENT ON FUNCTION %s IS %L',existing::regprocedure,'0027_kiwify_assinaturas_blacklist:v1:sha256='||encode(sha256(convert_to(f.body,'UTF8')),'hex'));
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',existing::regprocedure);
      IF f.executable THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',existing::regprocedure); END IF;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=existing AND p.proowner=owner_oid AND p.prosrc=f.body
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql') AND p.prorettype=f.ret::regtype
      AND p.proargtypes=CASE f.name WHEN 'rpc_kiwify_blacklist_consume' THEN '3802'::oidvector WHEN 'rpc_kiwify_blacklist_access' THEN '23'::oidvector
        WHEN 'rpc_kiwify_blacklist_order_binding' THEN '25'::oidvector WHEN 'rpc_kiwify_blacklist_find_users' THEN '25'::oidvector ELSE ''::oidvector END
      AND p.proargnames IS NOT DISTINCT FROM f.argnames AND p.proallargtypes IS NULL AND p.proargmodes IS NULL
      AND p.pronargdefaults=0 AND p.provariadic=0 AND p.prokind='f' AND NOT p.proretset
      AND p.prosecdef AND NOT p.proleakproof AND NOT p.proisstrict AND p.provolatile='v' AND p.proparallel='u'
      AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND p.procost=100 AND p.prorows=0 AND p.prosupport=0
      AND obj_description(p.oid,'pg_proc')='0027_kiwify_assinaturas_blacklist:v1:sha256='||encode(sha256(convert_to(f.body,'UTF8')),'hex')
      AND NOT EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantor<>owner_oid
        OR a.grantee NOT IN(owner_oid,CASE WHEN f.executable THEN 'service_role'::regrole::oid ELSE owner_oid END))
      AND (NOT f.executable OR EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee='service_role'::regrole::oid AND a.privilege_type='EXECUTE'))
    ) OR has_function_privilege('anon',existing,'EXECUTE') OR has_function_privilege('authenticated',existing,'EXECUTE')
      OR (NOT f.executable AND has_function_privilege('service_role',existing,'EXECUTE')) THEN
      RAISE EXCEPTION '0027 função/hash/metadata/ACL incompatível: %',f.name;
    END IF;
  END LOOP;
  -- Exact triggers; no repair of disabled/adulterated/extra triggers on reapply.
  FOR f IN SELECT * FROM (VALUES
    ('kiwify_blacklist_events','kiwify_blacklist_events_immutable','kiwify_blacklist_immutable',27,'BEFORE UPDATE OR DELETE','FOR EACH ROW'),
    ('kiwify_blacklist_events','kiwify_blacklist_events_no_truncate','kiwify_blacklist_immutable',34,'BEFORE TRUNCATE','FOR EACH STATEMENT'),
    ('kiwify_blacklist_subscriptions','kiwify_blacklist_subscriptions_identity','kiwify_blacklist_identity',27,'BEFORE UPDATE OR DELETE','FOR EACH ROW'),
    ('kiwify_blacklist_subscriptions','kiwify_blacklist_subscriptions_no_truncate','kiwify_blacklist_immutable',34,'BEFORE TRUNCATE','FOR EACH STATEMENT')
  ) v(tbl,name,fn,typ,timing,scope) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||f.tbl) AND tgname=f.name) THEN
      -- Only freshly created table may gain triggers; provenance is otherwise insufficient.
      IF NOT installing THEN
        RAISE EXCEPTION '0027 gatilho ausente: %',f.name;
      END IF;
      EXECUTE format('CREATE TRIGGER %I %s ON public.%I %s EXECUTE FUNCTION public.%I()',f.name,f.timing,f.tbl,f.scope,f.fn);
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||f.tbl) AND tgname=f.name
      AND tgfoid=to_regprocedure('public.'||f.fn||'()') AND tgtype=f.typ AND tgenabled='O' AND NOT tgisinternal
      AND tgqual IS NULL AND tgnargs=0 AND tgattr=''::int2vector AND tgconstraint=0) THEN
      RAISE EXCEPTION '0027 gatilho incompatível: %',f.name;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.kiwify_blacklist_events'::regclass AND NOT tgisinternal)<>2
     OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.kiwify_blacklist_subscriptions'::regclass AND NOT tgisinternal)<>2
     OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.kiwify_blacklist_products'::regclass AND NOT tgisinternal) THEN
    RAISE EXCEPTION '0027 gatilhos extras não aprovados';
  END IF;
  GRANT USAGE ON SCHEMA public TO service_role;
END;
$install$;
COMMIT;
