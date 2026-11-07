-- CobraPro: base PostgreSQL exclusivamente backend; NÃO libera produção.
-- Contrato físico: drizzle/schema.ts, router blacklist e storage (sem alterar TS).
-- Um único DO é atômico mesmo sem wrapper de transação. Não corrige nem descarta
-- tabelas/enums/constraints homônimos incompatíveis; qualquer divergência aborta.
-- Não depende de pgcrypto nem muda sua instalação em extensions.
DO $migration$
DECLARE
  t text;
  e record;
  c record;
  actual jsonb;
  expected jsonb;
  seq_oid oid;
  fn_oid oid;
  cols text;
  body text := $guard$
DECLARE
  parent_id integer;
  target_id integer;
  previous_id integer;
BEGIN
  IF TG_OP <> 'DELETE' THEN target_id := NEW.blacklist_id; END IF;
  IF TG_OP <> 'INSERT' THEN previous_id := OLD.blacklist_id; END IF;

  -- Ordem estável para movimentos entre pais. DELETE CASCADE pode não encontrar
  -- o pai, pois este já foi removido pela própria transação; isso é intencional.
  FOR parent_id IN
    SELECT b.id FROM public.blacklist AS b
    WHERE b.id = target_id OR b.id = previous_id ORDER BY b.id FOR UPDATE
  LOOP
    -- Conflito MVCC real: em REPEATABLE READ/SERIALIZABLE um snapshot anterior
    -- deve abortar (40001), nunca admitir a sexta foto com contagem obsoleta.
    -- Preserva todos os valores, inclusive updatedAt (não é um timestamp hook).
    UPDATE public.blacklist SET "updatedAt" = "updatedAt" WHERE id = parent_id;
  END LOOP;

  IF TG_OP <> 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.blacklist WHERE id = target_id) THEN
      RAISE EXCEPTION 'blacklist_fotos: pai inexistente' USING ERRCODE = '23503';
    END IF;
    IF (SELECT count(*) FROM public.blacklist_fotos AS f
        WHERE f.blacklist_id = target_id
          AND (TG_OP = 'INSERT' OR f.id <> OLD.id)) >= 5 THEN
      RAISE EXCEPTION 'blacklist_fotos: limite de cinco fotos por registro'
        USING ERRCODE = '23514', CONSTRAINT = 'blacklist_fotos_max_five';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$guard$;
BEGIN
  PERFORM set_config('search_path', 'pg_catalog', true);
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(190019, 5);

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls AND NOT rolsuper)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon' AND NOT rolbypassrls AND NOT rolsuper)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated' AND NOT rolbypassrls AND NOT rolsuper) THEN
    RAISE EXCEPTION 'Blacklist bloqueada: requer service_role BYPASSRLS não-superuser e anon/authenticated sem bypass.';
  END IF;
  IF pg_has_role('anon', 'service_role', 'MEMBER') OR pg_has_role('authenticated', 'service_role', 'MEMBER') THEN
    RAISE EXCEPTION 'Blacklist bloqueada: papel de cliente membro de service_role.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class r JOIN pg_namespace n ON n.oid = r.relnamespace
    JOIN pg_attribute a ON a.attrelid = r.oid
    WHERE n.nspname = 'public' AND r.relname = 'users' AND r.relkind = 'r'
      AND a.attname = 'id' AND a.atttypid = 'integer'::regtype AND a.attnotnull AND NOT a.attisdropped
  ) THEN
    RAISE EXCEPTION 'Blacklist bloqueada: public.users.id deve ser INTEGER NOT NULL em tabela comum.';
  END IF;

  FOR e IN SELECT * FROM (VALUES
    ('status_blacklist', ARRAY['ativo', 'resolvido', 'em_negociacao']::text[]),
    ('tipo_divida_blacklist', ARRAY['emprestimo', 'servico', 'produto', 'aluguel', 'cheque', 'outros']::text[])
  ) AS enums(name, labels) LOOP
    IF EXISTS (SELECT 1 FROM pg_type p JOIN pg_namespace n ON n.oid = p.typnamespace
               WHERE n.nspname = 'public' AND p.typname = e.name) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type p JOIN pg_namespace n ON n.oid = p.typnamespace
        WHERE n.nspname = 'public' AND p.typname = e.name AND p.typtype = 'e'
          AND (SELECT array_agg(x.enumlabel::text ORDER BY x.enumsortorder)
               FROM pg_enum x WHERE x.enumtypid = p.oid) = e.labels
      ) THEN RAISE EXCEPTION 'Blacklist bloqueada: enum public.% incompatível (labels/ordem/tipo).', e.name; END IF;
    ELSE
      SELECT string_agg(quote_literal(v), ', ') INTO cols FROM unnest(e.labels) AS v;
      EXECUTE format('CREATE TYPE public.%I AS ENUM (%s)', e.name, cols);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['blacklist', 'blacklist_fotos'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      -- Não reutilizar sequência ou tipo composto homônimo de origem desconhecida.
      IF to_regclass(format('public.%I', t || '_id_seq')) IS NOT NULL
         OR EXISTS (SELECT 1 FROM pg_type p JOIN pg_namespace n ON n.oid = p.typnamespace
                    WHERE n.nspname = 'public' AND p.typname = t) THEN
        RAISE EXCEPTION 'Blacklist bloqueada: sequência/tipo homônimo de % já existe.', t;
      END IF;
      IF t = 'blacklist' THEN
        CREATE TABLE public.blacklist (
          id serial CONSTRAINT blacklist_pkey PRIMARY KEY,
          cadastrado_por_user_id integer NOT NULL,
          cadastrado_por_empresa varchar(255),
          cpf_cnpj varchar(20) NOT NULL,
          nome varchar(255) NOT NULL,
          telefone varchar(20), email varchar(320), endereco varchar(300),
          numero varchar(20), complemento varchar(100), bairro varchar(100),
          cidade varchar(100), estado varchar(2), cep varchar(9),
          motivo text NOT NULL,
          tipo_divida public.tipo_divida_blacklist NOT NULL DEFAULT 'outros',
          valor_divida numeric(15,2), data_ocorrencia date,
          status public.status_blacklist NOT NULL DEFAULT 'ativo',
          observacoes text, foto_url varchar(500),
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT blacklist_autor_users_fk FOREIGN KEY (cadastrado_por_user_id)
            REFERENCES public.users(id) ON DELETE RESTRICT
        );
      ELSE
        CREATE TABLE public.blacklist_fotos (
          id serial CONSTRAINT blacklist_fotos_pkey PRIMARY KEY,
          blacklist_id integer NOT NULL,
          url varchar(500) NOT NULL, file_key varchar(500) NOT NULL,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT blacklist_fotos_blacklist_fk FOREIGN KEY (blacklist_id)
            REFERENCES public.blacklist(id) ON DELETE CASCADE
        );
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass(format('public.%I', t))
                   AND relkind = 'r' AND relpersistence = 'p' AND NOT relispartition)
       OR EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = to_regclass(format('public.%I', t))
                  OR inhparent = to_regclass(format('public.%I', t))) THEN
      RAISE EXCEPTION 'Blacklist bloqueada: relação public.% incompatível.', t;
    END IF;

    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', t);

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
      FROM pg_constraint WHERE conrelid = to_regclass(format('public.%I', t));
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
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = to_regclass(format('public.%I', t)))
       OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class = to_regclass(format('public.%I', t))) THEN
      RAISE EXCEPTION 'Blacklist bloqueada: policies/rules preexistentes em public.%.', t;
    END IF;
  END LOOP;

  FOR e IN SELECT * FROM (VALUES
    ('blacklist_autor_idx', 'blacklist', 'cadastrado_por_user_id'),
    ('blacklist_cpf_cnpj_idx', 'blacklist', 'cpf_cnpj'),
    ('blacklist_status_idx', 'blacklist', 'status'),
    ('blacklist_fotos_blacklist_idx', 'blacklist_fotos', 'blacklist_id')
  ) AS indexes(name, tbl, col) LOOP
    IF to_regclass(format('public.%I', e.name)) IS NULL THEN
      EXECUTE format('CREATE INDEX %I ON public.%I (%I)', e.name, e.tbl, e.col);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['blacklist', 'blacklist_fotos'] LOOP
    SELECT jsonb_agg(jsonb_build_array(pg_get_indexdef(i.indexrelid), i.indisvalid,
                    i.indisready, i.indislive) ORDER BY r.relname) INTO actual
      FROM pg_index i JOIN pg_class r ON r.oid = i.indexrelid
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

  SELECT p.oid INTO fn_oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'blacklist_fotos_guard' AND p.pronargs = 0;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'blacklist_fotos_guard' AND p.pronargs <> 0) THEN
    RAISE EXCEPTION 'Blacklist bloqueada: sobrecarga homônima do gatilho.';
  END IF;
  IF fn_oid IS NULL THEN
    EXECUTE format('CREATE FUNCTION public.blacklist_fotos_guard() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = pg_catalog AS %L', body);
    fn_oid := 'public.blacklist_fotos_guard()'::regprocedure;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
                 WHERE p.oid = fn_oid AND p.prosrc = body AND p.prorettype = 'trigger'::regtype
                   AND p.prokind = 'f' AND l.lanname = 'plpgsql' AND p.provolatile = 'v'
                   AND NOT p.prosecdef AND NOT p.proleakproof AND NOT p.proretset
                   AND p.proconfig = ARRAY['search_path=pg_catalog']::text[]) THEN
    RAISE EXCEPTION 'Blacklist bloqueada: função de gatilho homônima incompatível.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.blacklist_fotos'::regclass
                 AND tgname = 'blacklist_fotos_guard_trg') THEN
    CREATE TRIGGER blacklist_fotos_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.blacklist_fotos
      FOR EACH ROW EXECUTE FUNCTION public.blacklist_fotos_guard();
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.blacklist'::regclass AND NOT tgisinternal)
     OR (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.blacklist_fotos'::regclass AND NOT tgisinternal) <> 1
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.blacklist_fotos'::regclass
                    AND tgname = 'blacklist_fotos_guard_trg' AND tgfoid = fn_oid AND tgtype = 31
                    AND tgenabled = 'O' AND NOT tgisinternal AND tgconstraint = 0
                    AND tgnargs = 0 AND tgattr = ''::int2vector AND tgqual IS NULL) THEN
    RAISE EXCEPTION 'Blacklist bloqueada: gatilhos homônimos/adicionais incompatíveis.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blacklist_fotos GROUP BY blacklist_id HAVING count(*) > 5) THEN
    RAISE EXCEPTION 'Blacklist bloqueada: dados existentes excedem cinco fotos.';
  END IF;

  GRANT USAGE ON SCHEMA public TO service_role;
  FOREACH t IN ARRAY ARRAY['blacklist', 'blacklist_fotos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO cols FROM pg_attribute
      WHERE attrelid = to_regclass(format('public.%I', t)) AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', cols, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
    EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated, service_role', t || '_id_seq');
    EXECUTE format('GRANT USAGE ON SEQUENCE public.%I TO service_role', t || '_id_seq');
    -- REVOKE direto não remove permissões herdadas de outros papéis; negar a
    -- instalação se qualquer privilégio efetivo ou grant residual persistir.
    FOREACH cols IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(cols, format('public.%I', t), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         OR has_any_column_privilege(cols, format('public.%I', t), 'SELECT,INSERT,UPDATE,REFERENCES')
         OR has_sequence_privilege(cols, format('public.%I', t || '_id_seq'), 'USAGE,SELECT,UPDATE') THEN
        RAISE EXCEPTION 'Blacklist bloqueada: acesso residual/herdado de % em %.', cols, t;
      END IF;
    END LOOP;
    IF has_table_privilege('service_role', format('public.%I', t), 'TRUNCATE,REFERENCES,TRIGGER')
       OR has_sequence_privilege('service_role', format('public.%I', t || '_id_seq'), 'SELECT,UPDATE') THEN
      RAISE EXCEPTION 'Blacklist bloqueada: service_role com privilégios além de DML/USAGE em %.', t;
    END IF;
    FOR c IN SELECT r.oid, r.relowner, r.relacl FROM pg_class r
      WHERE r.oid IN (to_regclass(format('public.%I', t)), to_regclass(format('public.%I', t || '_id_seq')))
    LOOP
      IF EXISTS (SELECT 1 FROM aclexplode(c.relacl) acl
                 WHERE acl.grantee NOT IN (c.relowner, (SELECT oid FROM pg_roles WHERE rolname = 'service_role')))
         OR EXISTS (SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) acl
                    WHERE a.attrelid = c.oid AND acl.grantee <> c.relowner) THEN
        RAISE EXCEPTION 'Blacklist bloqueada: ACL residual de outro papel em %.', c.oid::regclass;
      END IF;
    END LOOP;
  END LOOP;
  REVOKE ALL PRIVILEGES ON TYPE public.status_blacklist, public.tipo_divida_blacklist FROM PUBLIC, anon, authenticated, service_role;
  GRANT USAGE ON TYPE public.status_blacklist, public.tipo_divida_blacklist TO service_role;
  -- Não há RPC pública: execução direta desnecessária até para service_role.
  -- PostgreSQL verifica EXECUTE ao criar o trigger, não ao dispará-lo.
  REVOKE ALL PRIVILEGES ON FUNCTION public.blacklist_fotos_guard() FROM PUBLIC, anon, authenticated, service_role;
END;
$migration$;
