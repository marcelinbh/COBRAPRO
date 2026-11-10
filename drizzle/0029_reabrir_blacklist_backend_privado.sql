-- LOCAL / REVIEW ONLY — reabertura mínima, NÃO executar antes do backend privado LIVE.
-- Pré-condição EXTERNA: operador confirmou o backend privado d458e684d574b56aac3e6c7c73c88b133acaa29d LIVE,
-- fotos antes da SPA, entitlement Kiwify vigente em CADA acesso (incluindo admin/manual),
-- HMAC raw + API sale/allowlist verificados no backend e bucket privado validado.
-- A declaração abaixo é um ACK do operador, NÃO prova deploy, autenticidade Kiwify,
-- cadastro, compra, concessão ou elegibilidade. Nenhum grant/manual/lifetime é criado.
-- Na MESMA sessão, somente após essa confirmação externa:
-- SET cobrapro.blacklist_private_backend_live = 'd458e684d574b56aac3e6c7c73c88b133acaa29d';
-- Requer 0019/0023 auditadas, freeze 0026 OU estado mínimo já reaberto, 0027/0028.
-- Não cria/repara objetos, não altera linhas/Storage/grants; rejeita drift e ACL estrangeira.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $reopen$
DECLARE
  t text; r record; f record; role_name text; actual jsonb; expected jsonb;
  seq_oid oid; fn_oid oid; owner_oid oid := current_user::regrole::oid;
  service_oid oid; mode_blacklist text[]; mode_photos text[]; delete_execute boolean;
BEGIN
  PERFORM set_config('search_path','pg_catalog',true);
  PERFORM pg_advisory_xact_lock(190019,5);
  PERFORM pg_advisory_xact_lock(190023,1);
  PERFORM pg_advisory_xact_lock(190027,1);
  PERFORM pg_advisory_xact_lock(190028,1);
  PERFORM pg_advisory_xact_lock(190029,1);
  IF current_setting('cobrapro.blacklist_private_backend_live',true) IS DISTINCT FROM
     'd458e684d574b56aac3e6c7c73c88b133acaa29d' THEN
    RAISE EXCEPTION '0029 requer confirmação EXTERNA do backend privado LIVE no SHA aprovado';
  END IF;
  IF current_setting('server_version_num')::integer/10000<>17 THEN RAISE EXCEPTION '0029 exige PG17'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon' AND NOT rolbypassrls AND NOT rolsuper)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolbypassrls AND NOT rolsuper)
    OR current_user IN ('service_role','anon','authenticated')
    OR pg_has_role('service_role',current_user,'MEMBER') OR pg_has_role('anon',current_user,'MEMBER')
    OR pg_has_role('authenticated',current_user,'MEMBER')
    OR pg_has_role('anon','service_role','MEMBER') OR pg_has_role('authenticated','service_role','MEMBER') THEN
    RAISE EXCEPTION '0029 roles/owner inseguros';
  END IF;
  service_oid := 'service_role'::regrole::oid;
  IF NOT has_schema_privilege('service_role','public','USAGE') THEN RAISE EXCEPTION '0029 schema USAGE ausente'; END IF;
  FOR r IN SELECT * FROM (VALUES
    ('status_blacklist',ARRAY['ativo','resolvido','em_negociacao']::text[]),
    ('tipo_divida_blacklist',ARRAY['emprestimo','servico','produto','aluguel','cheque','outros']::text[])
  ) v(name,labels) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_type WHERE oid=to_regtype('public.'||r.name) AND typtype='e' AND typowner=owner_oid
      AND (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=pg_type.oid)=r.labels)
      OR NOT has_type_privilege('service_role','public.'||r.name,'USAGE')
      OR has_type_privilege('anon','public.'||r.name,'USAGE') OR has_type_privilege('authenticated','public.'||r.name,'USAGE')
      OR EXISTS(SELECT 1 FROM pg_type p CROSS JOIN LATERAL aclexplode(coalesce(p.typacl,acldefault('T',p.typowner))) a
        WHERE p.oid=to_regtype('public.'||r.name) AND (a.grantee NOT IN(owner_oid,service_oid) OR a.grantor<>owner_oid
          OR (a.grantee=service_oid AND a.is_grantable))) THEN
      RAISE EXCEPTION '0029 enum/owner/ACL incompatível: %',r.name;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['blacklist','blacklist_fotos','blacklist_access_grants','blacklist_access_audit',
    'kiwify_blacklist_products','kiwify_blacklist_subscriptions','kiwify_blacklist_events','kiwify_buyers'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||t) AND relkind='r' AND relpersistence='p'
      AND NOT relispartition AND relowner=owner_oid AND relrowsecurity AND NOT relforcerowsecurity)
      OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=to_regclass('public.'||t) OR inhparent=to_regclass('public.'||t))
      OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('public.'||t))
      OR EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=to_regclass('public.'||t)) THEN
      RAISE EXCEPTION '0029 relação/owner/RLS/policy/rule incompatível: %',t;
    END IF;
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t);
    IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=to_regclass('public.'||t) AND (a.grantee NOT IN(owner_oid,service_oid) OR a.grantor<>owner_oid
        OR (a.grantee=service_oid AND a.is_grantable)))
      OR EXISTS(SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
        WHERE a.attrelid=to_regclass('public.'||t) AND (x.grantee<>owner_oid OR x.grantor<>owner_oid)) THEN
      RAISE EXCEPTION '0029 ACL estrangeira/coluna/grant option: %',t;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(role_name,'public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(role_name,'public.'||t,'SELECT,INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION '0029 privilégio frontend efetivo/herdado: %.%',role_name,t;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['blacklist','blacklist_fotos'] LOOP
    -- Exata correspondência de colunas, tipos, nullability e defaults físicos.
    SELECT jsonb_agg(jsonb_build_array(a.attname, format_type(a.atttypid, a.atttypmod),
           a.attnotnull, pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attname)
      INTO actual
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = to_regclass(format('public.%I', t)) AND a.attnum > 0 AND NOT a.attisdropped;
    SELECT jsonb_agg(jsonb_build_array(v.col, v.typ, v.nn, v.def) ORDER BY v.col) INTO expected
    FROM (VALUES
      ('blacklist', 'id', 'integer', true, 'nextval(''public.blacklist_id_seq''::regclass)'),
      ('blacklist', 'cadastrado_por_user_id', 'integer', true, NULL),
      ('blacklist', 'cadastrado_por_empresa', 'character varying(255)', false, NULL),
      ('blacklist', 'cpf_cnpj', 'character varying(20)', true, NULL),
      ('blacklist', 'nome', 'character varying(255)', true, NULL),
      ('blacklist', 'telefone', 'character varying(20)', false, NULL),
      ('blacklist', 'email', 'character varying(320)', false, NULL),
      ('blacklist', 'endereco', 'character varying(300)', false, NULL),
      ('blacklist', 'numero', 'character varying(20)', false, NULL),
      ('blacklist', 'complemento', 'character varying(100)', false, NULL),
      ('blacklist', 'bairro', 'character varying(100)', false, NULL),
      ('blacklist', 'cidade', 'character varying(100)', false, NULL),
      ('blacklist', 'estado', 'character varying(2)', false, NULL),
      ('blacklist', 'cep', 'character varying(9)', false, NULL),
      ('blacklist', 'motivo', 'text', true, NULL),
      ('blacklist', 'tipo_divida', 'public.tipo_divida_blacklist', true, '''outros''::public.tipo_divida_blacklist'),
      ('blacklist', 'valor_divida', 'numeric(15,2)', false, NULL),
      ('blacklist', 'data_ocorrencia', 'date', false, NULL),
      ('blacklist', 'status', 'public.status_blacklist', true, '''ativo''::public.status_blacklist'),
      ('blacklist', 'observacoes', 'text', false, NULL),
      ('blacklist', 'foto_url', 'character varying(500)', false, NULL),
      ('blacklist', 'createdAt', 'timestamp with time zone', true, 'now()'),
      ('blacklist', 'updatedAt', 'timestamp with time zone', true, 'now()'),
      ('blacklist_fotos', 'id', 'integer', true, 'nextval(''public.blacklist_fotos_id_seq''::regclass)'),
      ('blacklist_fotos', 'blacklist_id', 'integer', true, NULL),
      ('blacklist_fotos', 'url', 'character varying(500)', true, NULL),
      ('blacklist_fotos', 'file_key', 'character varying(500)', true, NULL),
      ('blacklist_fotos', 'createdAt', 'timestamp with time zone', true, 'now()')
    ) AS v(tbl, col, typ, nn, def) WHERE v.tbl = t;
    IF actual IS DISTINCT FROM expected OR EXISTS (
      SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass(format('public.%I', t))
      AND attnum > 0 AND NOT attisdropped AND (attidentity <> '' OR attgenerated <> '')
    ) THEN RAISE EXCEPTION 'Blacklist bloqueada: colunas/defaults de public.% incompatíveis.', t; END IF;

    SELECT jsonb_agg(jsonb_build_array(conname, pg_get_constraintdef(oid), convalidated,
                    condeferrable, condeferred) ORDER BY conname) INTO actual
      FROM pg_constraint WHERE conrelid = to_regclass(format('public.%I', t)) AND conname <> 'private_storage_path';
    SELECT jsonb_agg(jsonb_build_array(v.name, v.def, true, false, false) ORDER BY v.name) INTO expected
    FROM (VALUES
      ('blacklist', 'blacklist_pkey', 'PRIMARY KEY (id)'),
      ('blacklist', 'blacklist_autor_users_fk', 'FOREIGN KEY (cadastrado_por_user_id) REFERENCES public.users(id) ON DELETE RESTRICT'),
      ('blacklist_fotos', 'blacklist_fotos_pkey', 'PRIMARY KEY (id)'),
      ('blacklist_fotos', 'blacklist_fotos_blacklist_fk', 'FOREIGN KEY (blacklist_id) REFERENCES public.blacklist(id) ON DELETE CASCADE')
    ) AS v(tbl, name, def) WHERE v.tbl = t;
    IF actual IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'Blacklist bloqueada: constraints de public.% incompatíveis.', t;
    END IF;

    seq_oid := to_regclass(format('public.%I', t || '_id_seq'));
    IF seq_oid IS NULL OR pg_get_serial_sequence(format('public.%I', t), 'id')::regclass IS DISTINCT FROM seq_oid
       OR NOT EXISTS (SELECT 1 FROM pg_sequence WHERE seqrelid = seq_oid AND seqtypid = 'integer'::regtype
                      AND seqstart = 1 AND seqincrement = 1 AND seqmin = 1 AND seqmax = 2147483647
                      AND seqcache = 1 AND NOT seqcycle)
       OR NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_attribute a
                      ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
                      WHERE d.classid = 'pg_class'::regclass AND d.objid = seq_oid
                        AND d.refclassid = 'pg_class'::regclass AND d.deptype = 'a'
                        AND d.refobjid = to_regclass(format('public.%I', t)) AND a.attname = 'id') THEN
      RAISE EXCEPTION 'Blacklist bloqueada: sequência de public.% incompatível.', t;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=seq_oid AND relowner=owner_oid AND relkind='S')
      OR NOT has_sequence_privilege('service_role',seq_oid,'USAGE')
      OR has_sequence_privilege('service_role',seq_oid,'SELECT,UPDATE')
      OR has_sequence_privilege('anon',seq_oid,'USAGE,SELECT,UPDATE')
      OR has_sequence_privilege('authenticated',seq_oid,'USAGE,SELECT,UPDATE')
      OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('S',c.relowner))) a
        WHERE c.oid=seq_oid AND (a.grantee NOT IN(owner_oid,service_oid) OR a.grantor<>owner_oid
          OR (a.grantee=service_oid AND (a.is_grantable OR a.privilege_type<>'USAGE')))) THEN
      RAISE EXCEPTION '0029 sequência/ACL incompatível: %',t;
    END IF;
    IF has_table_privilege('service_role','public.'||t,'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') THEN
      RAISE EXCEPTION '0029 service_role excede mínimo: %',t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['blacklist', 'blacklist_fotos'] LOOP
    SELECT jsonb_agg(jsonb_build_array(pg_get_indexdef(i.indexrelid), i.indisvalid,
                    i.indisready, i.indislive) ORDER BY idx.relname) INTO actual
      FROM pg_index i JOIN pg_class idx ON idx.oid = i.indexrelid
      WHERE i.indrelid = to_regclass(format('public.%I', t));
    SELECT jsonb_agg(jsonb_build_array(v.def, true, true, true) ORDER BY v.name) INTO expected
    FROM (VALUES
      ('blacklist', 'blacklist_pkey', 'CREATE UNIQUE INDEX blacklist_pkey ON public.blacklist USING btree (id)'),
      ('blacklist', 'blacklist_autor_idx', 'CREATE INDEX blacklist_autor_idx ON public.blacklist USING btree (cadastrado_por_user_id)'),
      ('blacklist', 'blacklist_cpf_cnpj_idx', 'CREATE INDEX blacklist_cpf_cnpj_idx ON public.blacklist USING btree (cpf_cnpj)'),
      ('blacklist', 'blacklist_status_idx', 'CREATE INDEX blacklist_status_idx ON public.blacklist USING btree (status)'),
      ('blacklist_fotos', 'blacklist_fotos_pkey', 'CREATE UNIQUE INDEX blacklist_fotos_pkey ON public.blacklist_fotos USING btree (id)'),
      ('blacklist_fotos', 'blacklist_fotos_blacklist_idx', 'CREATE INDEX blacklist_fotos_blacklist_idx ON public.blacklist_fotos USING btree (blacklist_id)')
    ) AS v(tbl, name, def) WHERE v.tbl = t;
    IF actual IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'Blacklist bloqueada: índices de public.% incompatíveis (inclusive unicidade extra).', t;
    END IF;
  END LOOP;

  -- 0030 foi autorizada APÓS metadata live confirmar só PK/FK; aplicar ANTES 0029.
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.blacklist_fotos'::regclass
    AND conname='private_storage_path' AND contype='c' AND convalidated AND NOT condeferrable AND NOT condeferred
    AND pg_get_expr(conbin,conrelid) =
      '(((url)::text = (''storage://cobrapro-blacklist-private/''::text || (file_key)::text)) AND ((file_key)::text ~ ''^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[1-9][0-9]*/[1-9][0-9]*\.(jpg|png|webp)$''::text))')
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.blacklist'::regclass AND conname='private_storage_path') THEN
    RAISE EXCEPTION '0029 requer private_storage_path validada da 0030, sem drift';
  END IF;
  FOR f IN SELECT * FROM (VALUES
    ('blacklist_fotos_guard','','c0b4f192a1b00691c1e6e258a2e1c9ee5dbea08a54748d1623e804dba5aa995c','trigger','',NULL::text[],false,false,''),
    ('blacklist_access_guard','','e5e0175dcb68fcb5dc659d1435499c910c037e360ec6c128125783cacd650f11','trigger','',NULL::text[],true,false,''),
    ('blacklist_delete_empty_owned','integer,integer','65e60515ea19f3669bb51e53de8ca2abe3df7a7a07bd09ff8de9491550f9647f','boolean','23 23',ARRAY['target_id','owner_id']::text[],false,true,''),
    ('kiwify_blacklist_immutable','','c904bf80dddcba0906ce18c51f00099185fc0252b6d055e1852a49fce0affcda','trigger','',NULL::text[],true,false,'0027_kiwify_assinaturas_blacklist:v1:sha256='),
    ('kiwify_blacklist_identity','','e3cf72d59b128b5a39ef91f89ae96606f187364c764d62ca362c478fa1d61b66','trigger','',NULL::text[],true,false,'0027_kiwify_assinaturas_blacklist:v1:sha256='),
    ('rpc_kiwify_blacklist_consume','jsonb','bc3323053a8a5b8822d41e20176093079d92c00d996e17e7170dfc5f9370c2ac','jsonb','3802',ARRAY['p_event']::text[],true,true,'0027_kiwify_assinaturas_blacklist:v1:sha256='),
    ('rpc_kiwify_blacklist_access','integer','722adf8671214f17bb526716165cc86b31529130176767905b7a208291948d6c','jsonb','23',ARRAY['p_user_id']::text[],true,true,'0027_kiwify_assinaturas_blacklist:v1:sha256='),
    ('rpc_kiwify_blacklist_order_binding','text','ce31a020d6dc6e65ce50bd3176b7dbd7e132bf41cd47081630a07dbccf4f1fdd','jsonb','25',ARRAY['p_order_id']::text[],true,true,'0027_kiwify_assinaturas_blacklist:v1:sha256='),
    ('rpc_kiwify_blacklist_find_users','text','98e4f27297ed4275c9c223261a53326ab8c0d16f1ec6a545c4c2117ed8edc3fe','jsonb','25',ARRAY['p_email']::text[],true,true,'0027_kiwify_assinaturas_blacklist:v1:sha256='),
    ('kiwify_buyer_identity','','68dd9dabba58d9dbc79afe24fb9454ce54ebef571aa18506cdc61adf18ae990b','trigger','',NULL::text[],true,false,'0028_kiwify_compradores_transacional:v1:sha256='),
    ('rpc_kiwify_buyer_provision','jsonb','f2653c3688cfe2175c9c9d085a055023d41c054e89243bc06f73ffe658646662','jsonb','3802',ARRAY['p_buyer']::text[],true,true,'0028_kiwify_compradores_transacional:v1:sha256='),
    ('rpc_kiwify_buyer_invite_claim','jsonb','4438d362a6cadd79b0b280355049f26b69e62d17b59008175f76696378b6e096','jsonb','3802',ARRAY['p_claim']::text[],true,true,'0028_kiwify_compradores_transacional:v1:sha256='),
    ('rpc_kiwify_buyer_invite_finish','jsonb','0dbe734de60744b1d072e174b1dbe082d227ceea38294821b16a4eef37e3c3d8','jsonb','3802',ARRAY['p_result']::text[],true,true,'0028_kiwify_compradores_transacional:v1:sha256=')
  ) v(name,sig,hash,ret,args,argnames,sec,executable,marker) LOOP
    fn_oid := to_regprocedure('public.'||f.name||'('||f.sig||')');
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=f.name)<>1
      OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=fn_oid AND p.proowner=owner_oid
        AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=f.hash
        AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql') AND p.prorettype=f.ret::regtype
        AND p.proargtypes=f.args::oidvector AND p.proargnames IS NOT DISTINCT FROM f.argnames
        AND p.proallargtypes IS NULL AND p.proargmodes IS NULL AND p.pronargdefaults=0 AND p.provariadic=0
        AND p.prokind='f' AND NOT p.proretset AND p.prosecdef=f.sec AND NOT p.proleakproof AND NOT p.proisstrict
        AND p.provolatile='v' AND p.proparallel='u' AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
        AND p.procost=100 AND p.prorows=0 AND p.prosupport=0
        AND (f.marker='' OR obj_description(p.oid,'pg_proc')=f.marker||f.hash)
        AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          WHERE a.privilege_type<>'EXECUTE' OR a.grantor<>owner_oid
            OR a.grantee NOT IN(owner_oid,CASE WHEN f.executable THEN service_oid ELSE owner_oid END)
            OR (a.grantee=service_oid AND a.is_grantable)))
      OR has_function_privilege('anon',fn_oid,'EXECUTE') OR has_function_privilege('authenticated',fn_oid,'EXECUTE')
      OR (NOT f.executable AND has_function_privilege('service_role',fn_oid,'EXECUTE'))
      OR (f.executable AND f.name<>'blacklist_delete_empty_owned' AND NOT has_function_privilege('service_role',fn_oid,'EXECUTE')) THEN
      RAISE EXCEPTION '0029 função/proveniência/hash/metadata/ACL incompatível: %',f.name;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.blacklist'::regclass AND NOT tgisinternal)
    OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.blacklist_fotos'::regclass AND NOT tgisinternal)<>1
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.blacklist_fotos'::regclass AND tgname='blacklist_fotos_guard_trg'
      AND tgfoid='public.blacklist_fotos_guard()'::regprocedure AND tgtype=31 AND tgenabled='O' AND NOT tgisinternal
      AND tgconstraint=0 AND tgnargs=0 AND tgattr=''::int2vector AND tgqual IS NULL) THEN
    RAISE EXCEPTION '0029 gatilho da base incompatível';
  END IF;
  -- ACL service direta é a fonte de verdade; nenhum estado parcial é reparado.
  SELECT array_agg(a.privilege_type ORDER BY a.privilege_type) INTO mode_blacklist
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid='public.blacklist'::regclass AND a.grantee=service_oid;
  SELECT array_agg(a.privilege_type ORDER BY a.privilege_type) INTO mode_photos
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid='public.blacklist_fotos'::regclass AND a.grantee=service_oid;
  delete_execute := has_function_privilege('service_role','public.blacklist_delete_empty_owned(integer,integer)','EXECUTE');
  IF ((mode_blacklist=ARRAY['SELECT'] AND mode_photos=ARRAY['SELECT'] AND NOT delete_execute)
    OR (mode_blacklist=ARRAY['DELETE','INSERT','SELECT','UPDATE'] AND mode_photos=ARRAY['DELETE','INSERT','SELECT'] AND delete_execute)) IS DISTINCT FROM true THEN
    RAISE EXCEPTION '0029 estado ACL não é freeze 0026 nem reabertura mínima exata';
  END IF;
  -- 0023 permanece intocada: comparar ACL exata, nunca conceder/revogar grants/audit.
  FOR r IN SELECT * FROM (VALUES
    ('blacklist_access_grants',ARRAY['INSERT','SELECT','UPDATE']::text[]),
    ('blacklist_access_audit',ARRAY['SELECT']::text[])
  ) v(name,privileges) LOOP
    SELECT to_jsonb(array_agg(a.privilege_type ORDER BY a.privilege_type)) INTO actual
      FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
      WHERE c.oid=to_regclass('public.'||r.name) AND a.grantee=service_oid;
    IF actual IS DISTINCT FROM to_jsonb(r.privileges) THEN
      RAISE EXCEPTION '0029 ACL existente 0023 divergente: %',r.name;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('S',c.relowner))) a
      WHERE c.oid=to_regclass('public.blacklist_access_audit_id_seq') AND (a.grantee<>owner_oid OR a.grantor<>owner_oid))
    OR has_sequence_privilege('service_role','public.blacklist_access_audit_id_seq','USAGE,SELECT,UPDATE')
    OR has_sequence_privilege('anon','public.blacklist_access_audit_id_seq','USAGE,SELECT,UPDATE')
    OR has_sequence_privilege('authenticated','public.blacklist_access_audit_id_seq','USAGE,SELECT,UPDATE') THEN
    RAISE EXCEPTION '0029 ACL sequência audit divergente';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('kiwify_blacklist_products','0027_kiwify_assinaturas_blacklist:v1:sha256=de03159fbcb82cf1c10eac339dd677433c1c29a1e6a0ac49b06d341fef321e58'),
    ('kiwify_blacklist_subscriptions','0027_kiwify_assinaturas_blacklist:v1:sha256=1438d345d1d01e6d0dca9a6bbffcb8c4617ae5114d1097768dd4b1517d59a4fd'),
    ('kiwify_blacklist_events','0027_kiwify_assinaturas_blacklist:v1:sha256=2c3ef92b30c7fb8e4403ccb71b220fccd8b908dae520544e4237f33ef4645495'),
    ('kiwify_buyers','0028_kiwify_compradores_transacional:v1:sha256=0f814f541eacf1eebb87a82059daad45f81b46d95c3177f6cf04580e71e89440')
  ) v(name,marker) LOOP
    IF obj_description(to_regclass('public.'||r.name),'pg_class') IS DISTINCT FROM r.marker
      OR has_table_privilege('service_role','public.'||r.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege('service_role','public.'||r.name,'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION '0029 proveniência/ACL de pacote Kiwify incompatível: %',r.name;
    END IF;
  END LOOP;
  -- Storage somente INSPEÇÃO: nenhuma policy/grant/objeto alterado. Catálogo externo obrigatório.
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('storage.buckets') AND relkind='r' AND relpersistence='p' AND relrowsecurity)
    OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('storage.objects') AND relkind='r' AND relpersistence='p' AND relrowsecurity)
    OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('storage.objects')) THEN
    RAISE EXCEPTION '0029 Storage ausente/RLS/policies diretas inesperadas; review externo necessário';
  END IF;
  IF (SELECT count(*) FROM storage.buckets WHERE id='cobrapro-blacklist-private' AND name=id AND public=false
      AND file_size_limit=2097152 AND
      (SELECT array_agg(m ORDER BY m) FROM unnest(allowed_mime_types) m)=ARRAY['image/jpeg','image/png','image/webp'])<>1 THEN
    RAISE EXCEPTION '0029 bucket privado/2MB/MIME incompatível';
  END IF;
  -- ÚNICAS mutações: ACL mínima exigida pelo router/guard invoker; SELECT/USAGE existentes permanecem.
  GRANT INSERT, UPDATE, DELETE ON TABLE public.blacklist TO service_role;
  GRANT INSERT, DELETE ON TABLE public.blacklist_fotos TO service_role;
  GRANT EXECUTE ON FUNCTION public.blacklist_delete_empty_owned(integer,integer) TO service_role;
END;
$reopen$;
COMMIT;
