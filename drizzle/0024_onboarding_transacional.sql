-- PostgreSQL 17. Instalar ANTES de integrar onboarding.complete ao adaptador RPC.
-- DDL apenas: não corrige/adota clientes, saldos, ledger ou usuários antigos.
-- Reaplicação exige corpo/hash, assinatura, owner, ACL e metadata exatamente conhecidos.
BEGIN;
DO $install$
DECLARE
  fn oid;
  body text := $body$
DECLARE
  v_empresa text;
  v_nome text;
  v_tipo text;
  v_completed boolean;
  v_empresa_salva text;
  v_conta_id integer;
  v_nome_salvo text;
  v_tipo_salvo text;
  v_created boolean := false;
  v_user_confirmado integer;
  v_conta_confirmada integer;
  v_trim text := E' \t\n\r\f\013' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
  v_empresa := pg_catalog.btrim(p_nome_empresa, v_trim);
  v_nome := pg_catalog.btrim(p_nome_conta, v_trim);
  v_tipo := pg_catalog.btrim(p_tipo_conta, v_trim);
  IF p_user_id IS NULL OR p_user_id <= 0
     OR v_empresa IS NULL OR pg_catalog.char_length(v_empresa) NOT BETWEEN 1 AND 255
     OR v_nome IS NULL OR pg_catalog.char_length(v_nome) NOT BETWEEN 1 AND 255
     OR v_tipo IS NULL OR v_tipo NOT IN ('caixa','banco','digital') THEN
    RAISE EXCEPTION 'Dados de onboarding inválidos' USING ERRCODE='22023';
  END IF;

  -- Serializa primeira conclusão e retries. Owner vem do servidor, não do formulário.
  SELECT u.onboarding_completo, u.nome_empresa
    INTO v_completed, v_empresa_salva
    FROM public.users AS u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário indisponível' USING ERRCODE='42501';
  END IF;
  IF v_completed AND v_empresa_salva IS DISTINCT FROM v_empresa THEN
    RAISE EXCEPTION 'Onboarding já concluído com dados diferentes' USING ERRCODE='23505';
  END IF;

  SELECT c.id, c.nome, c.tipo INTO v_conta_id, v_nome_salvo, v_tipo_salvo
    FROM public.contas_caixa AS c
    WHERE c.user_id = p_user_id AND c.ativo = true
    ORDER BY c.id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    -- Sem tabela de intenção: o preset precisa coincidir exatamente com a conta escolhida.
    -- Nunca renomear/ativar/alterar saldo para fazer um replay parecer válido.
    IF v_nome_salvo IS DISTINCT FROM v_nome OR v_tipo_salvo IS DISTINCT FROM v_tipo THEN
      RAISE EXCEPTION 'Conta ativa incompatível com a intenção de onboarding' USING ERRCODE='23505';
    END IF;
  ELSE
    IF v_completed THEN
      RAISE EXCEPTION 'Onboarding concluído sem conta ativa; exige revisão explícita' USING ERRCODE='23505';
    END IF;
    -- Inativas permanecem intocadas. O resultado informa explicitamente a nova conta.
    INSERT INTO public.contas_caixa (user_id, nome, tipo, saldo, ativo)
      VALUES (p_user_id, v_nome, v_tipo, 0, true) RETURNING id INTO v_conta_id;
    IF v_conta_id IS NULL OR v_conta_id <= 0 THEN
      RAISE EXCEPTION 'Conta não confirmada' USING ERRCODE='23514';
    END IF;
    v_created := true;
  END IF;

  -- Releitura detecta INSERT suprimido ou adulterado por triggers, inclusive AFTER.
  SELECT c.id INTO v_conta_confirmada FROM public.contas_caixa AS c
    WHERE c.id = v_conta_id AND c.id > 0 AND c.user_id = p_user_id
      AND c.ativo = true AND c.nome = v_nome AND c.tipo = v_tipo
      AND (NOT v_created OR c.saldo = 0) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não confirmada' USING ERRCODE='23514';
  END IF;

  IF NOT v_completed THEN
    UPDATE public.users AS u
      SET onboarding_completo = true, nome_empresa = v_empresa, "updatedAt" = pg_catalog.clock_timestamp()
      WHERE u.id = p_user_id AND u.onboarding_completo = false
      RETURNING u.id INTO v_user_confirmado;
    IF v_user_confirmado IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'Usuário não confirmado' USING ERRCODE='23514';
    END IF;
  END IF;
  SELECT u.id INTO v_user_confirmado FROM public.users AS u
    WHERE u.id = p_user_id AND u.onboarding_completo = true AND u.nome_empresa = v_empresa;
  IF NOT FOUND OR v_user_confirmado IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Usuário não confirmado' USING ERRCODE='23514';
  END IF;
  -- Confirma também a conta depois do UPDATE de users (triggers podem ter efeitos laterais).
  PERFORM c.id FROM public.contas_caixa AS c
    WHERE c.id = v_conta_confirmada AND c.user_id = p_user_id AND c.ativo = true
      AND c.nome = v_nome AND c.tipo = v_tipo AND (NOT v_created OR c.saldo = 0);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não confirmada' USING ERRCODE='23514';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'success', true, 'id', v_user_confirmado, 'conta_id', v_conta_confirmada,
    'onboardingCompleto', true, 'nomeEmpresa', v_empresa, 'nomeConta', v_nome,
    'tipoConta', v_tipo, 'repetida', v_completed, 'contaCriada', v_created);
END;
$body$;
  x record;
  n text;
BEGIN
  IF pg_catalog.current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'Migração 0024 exige PostgreSQL 17';
  END IF;
  FOREACH n IN ARRAY ARRAY['service_role','anon','authenticated'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=n) THEN
      RAISE EXCEPTION 'Roles obrigatórias ausentes';
    END IF;
  END LOOP;
  IF current_user IN ('service_role','anon','authenticated')
     OR pg_catalog.pg_has_role('service_role',current_user,'MEMBER')
     OR pg_catalog.pg_has_role('anon','service_role','MEMBER')
     OR pg_catalog.pg_has_role('authenticated','service_role','MEMBER') THEN
    RAISE EXCEPTION 'Owner/roles inseguros para SECURITY DEFINER';
  END IF;
  FOREACH n IN ARRAY ARRAY['users','contas_caixa'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace s ON s.oid=c.relnamespace
      WHERE s.nspname='public' AND c.relname=n AND c.relkind='r') THEN
      RAISE EXCEPTION 'Schema de onboarding incompatível';
    END IF;
  END LOOP;
  FOR x IN SELECT * FROM (VALUES
    ('users','id','integer',true),('users','onboarding_completo','boolean',true),
    ('users','nome_empresa','character varying(255)',false),('users','updatedAt','timestamp with time zone',true),
    ('contas_caixa','id','integer',true),('contas_caixa','nome','character varying(255)',true),
    ('contas_caixa','tipo','character varying(20)',true),('contas_caixa','saldo','numeric(15,2)',true),
    ('contas_caixa','ativo','boolean',true),('contas_caixa','createdAt','timestamp with time zone',true),
    ('contas_caixa','updatedAt','timestamp with time zone',true),('contas_caixa','user_id','integer',false)
  ) AS v(t,c,typ,nn) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid=('public.'||x.t)::regclass AND a.attname=x.c AND NOT a.attisdropped
        AND pg_catalog.format_type(a.atttypid,a.atttypmod)=x.typ AND a.attnotnull=x.nn) THEN
      RAISE EXCEPTION 'Schema de onboarding incompatível';
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.users'::regclass AND contype='p'
      AND conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.users'::regclass AND attname='id')]::smallint[])
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.contas_caixa'::regclass AND contype='p'
      AND conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='public.contas_caixa'::regclass AND attname='id')]::smallint[])
     OR pg_catalog.pg_get_serial_sequence('public.contas_caixa','id') IS NULL THEN
    RAISE EXCEPTION 'Identidade de onboarding incompatível';
  END IF;

  SELECT p.oid INTO fn FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace s ON s.oid=p.pronamespace
    WHERE s.nspname='public' AND p.proname='rpc_concluir_onboarding';
  IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace s ON s.oid=p.pronamespace
      WHERE s.nspname='public' AND p.proname='rpc_concluir_onboarding') > 1 THEN
    RAISE EXCEPTION 'Overload de onboarding desconhecido';
  END IF;
  IF fn IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=fn AND p.oid=pg_catalog.to_regprocedure('public.rpc_concluir_onboarding(integer,text,text,text)')
      AND p.prosrc=body AND pg_catalog.md5(p.prosrc)=pg_catalog.md5(body)
      AND p.proowner=current_user::regrole AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
      AND p.prorettype='jsonb'::regtype AND p.proretset=false AND p.prokind='f'
      AND p.prosecdef AND NOT p.proleakproof AND NOT p.proisstrict AND p.provolatile='v' AND p.proparallel='u'
      AND p.pronargs=4 AND p.pronargdefaults=0 AND p.provariadic=0 AND p.proargmodes IS NULL AND p.proallargtypes IS NULL
      AND p.proargnames=ARRAY['p_user_id','p_nome_empresa','p_nome_conta','p_tipo_conta']::text[]
      AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.procost=100 AND p.prorows=0 AND p.prosupport=0
      AND pg_catalog.obj_description(p.oid,'pg_proc')='0024_onboarding_transacional:v1:md5='||pg_catalog.md5(body)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(p.proacl) a
        WHERE a.privilege_type <> 'EXECUTE' OR a.is_grantable OR a.grantor <> p.proowner
          OR a.grantee NOT IN (p.proowner,'service_role'::regrole::oid))
      AND EXISTS (SELECT 1 FROM pg_catalog.aclexplode(p.proacl) a
        WHERE a.grantee='service_role'::regrole::oid AND a.privilege_type='EXECUTE' AND NOT a.is_grantable)
  ) THEN
    RAISE EXCEPTION 'RPC de onboarding homônima ou metadata/hash adulterados';
  END IF;

  EXECUTE pg_catalog.format('CREATE OR REPLACE FUNCTION public.rpc_concluir_onboarding(p_user_id integer,p_nome_empresa text,p_nome_conta text,p_tipo_conta text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER VOLATILE PARALLEL UNSAFE SET search_path=pg_catalog,pg_temp AS %L',body);
  EXECUTE pg_catalog.format('COMMENT ON FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) IS %L',
    '0024_onboarding_transacional:v1:md5='||pg_catalog.md5(body));
END;
$install$;
REVOKE ALL ON FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_concluir_onboarding(integer,text,text,text) TO service_role;
-- Default privileges desconhecidos não podem conceder execução a outro principal.
DO $acl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
    WHERE p.oid='public.rpc_concluir_onboarding(integer,text,text,text)'::regprocedure
      AND (a.privilege_type <> 'EXECUTE' OR a.is_grantable OR a.grantor <> p.proowner
        OR a.grantee NOT IN (p.proowner,'service_role'::regrole::oid))) THEN
    RAISE EXCEPTION 'Default privileges inseguros para onboarding';
  END IF;
END;
$acl$;
COMMIT;
