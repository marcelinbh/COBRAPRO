-- ADITIVA one-shot. LOCAL: requer revisão/backup/ensaio antes de qualquer produção.
-- v1: apenas PRIMEIRA renovação de contrato 0021 criado sob 0022, uma parcela mensal intacta.
-- Nunca adota legado, parciais, descontos ou encargos manuais. Não backfill/repara dados.
-- 'renovada' NÃO quita principal: saldo_residual é principal TRANSFERIDO, não nova dívida acumulada.
-- Sucessor no mesmo contrato; total_contrato/valor_parcela representam a obrigação corrente,
-- num_parcelas/numero_parcelas contam linhas geradas (inclui anterior renovada); prova conserva história.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
-- DDL cooperativa: TODOS os instaladores devem adquirir (20261112,3133) primeiro.
-- LOCK de catálogo exige privilégios indisponíveis no postgres NOSUPERUSER managed.
-- Advisory NÃO bloqueia DDL privilegiada externa: janela exclusiva de governança obrigatória.
-- Read Committed: preflight separado começa com snapshot fresco APÓS todas as esperas.
DO $isolation3133$ BEGIN
 IF current_setting('transaction_isolation') <> 'read committed' THEN
  RAISE EXCEPTION '0031/0033: instalação exige Read Committed e DDL cooperativa exclusiva' USING ERRCODE='55000';
 END IF;
END $isolation3133$;
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
DO $privileges3133$ DECLARE n text; BEGIN
 IF NOT has_schema_privilege(current_user,'public','CREATE')
 OR NOT has_database_privilege(current_user,current_database(),'TEMP')
 OR NOT has_schema_privilege(current_user,'extensions','USAGE') THEN
  RAISE EXCEPTION '0031/0033: instalador sem CREATE public/TEMP database/USAGE extensions; não conceder automaticamente' USING ERRCODE='42501'; END IF;
 FOREACH n IN ARRAY ARRAY['contratos','parcelas','transacoes_caixa','contrato_historico','ciclo_estados','ciclo_operacoes','ciclo_autorizacoes','ciclo_pernas','emprestimos_rpc_operacoes','emprestimos_rpc_origens','users','contas_caixa','clientes','koletores','contas_pagar','ciclo_despesas_autorizacoes','despesas_rpc_operacoes','despesas_rpc_origens','despesas_rpc_pagamentos'] LOOP
  IF NOT has_table_privilege(current_user,'public.'||n,'MAINTAIN,UPDATE,DELETE,TRUNCATE') THEN
   RAISE EXCEPTION '0031/0033: privilégio efetivo ACCESS EXCLUSIVE ausente: %',n USING ERRCODE='42501'; END IF;
 END LOOP;
END $privileges3133$;
LOCK TABLE public.contratos,public.parcelas,public.transacoes_caixa,public.contrato_historico,
 public.ciclo_estados,public.ciclo_operacoes,public.ciclo_autorizacoes,public.ciclo_pernas,
 public.emprestimos_rpc_operacoes,public.emprestimos_rpc_origens,
 public.users,public.contas_caixa,public.clientes,public.koletores,public.contas_pagar,
 public.ciclo_despesas_autorizacoes,public.despesas_rpc_operacoes,
 public.despesas_rpc_origens,public.despesas_rpc_pagamentos IN ACCESS EXCLUSIVE MODE;
-- build.mjs acrescenta advisory reservado, privilégios efetivos e pós-DDL de fontes conhecidas.
-- Sem locks de catálogo: DDL privilegiada externa exige janela exclusiva de governança.
DO $preflight$
DECLARE x record; actual text; expected text; tab text; a jsonb; b jsonb;
 known jsonb; observed jsonb; names text[]; owner_oid oid; service_oid oid; roles oid[];
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION '0031 requer PostgreSQL17'; END IF;
 IF to_regprocedure('extensions.digest(text,text)') IS NULL THEN RAISE EXCEPTION 'pgcrypto extensions obrigatório'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE (p.proname LIKE 'renovacao\_%' ESCAPE '\' OR p.proname IN('rpc_cotar_renovacao_prospectiva','rpc_renovar_emprestimo_prospectivo')))
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE c.relname LIKE 'renovacao\_%' ESCAPE '\') THEN RAISE EXCEPTION 'Objetos 0031 homônimos; one-shot fechado'; END IF;
 -- Somente baseline integral 0020/21/22/25 comprovado, ambos overloads privados.
 SELECT proowner INTO owner_oid FROM pg_proc WHERE oid=to_regprocedure('public.ciclo_guardar()');
 IF owner_oid IS NULL OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=owner_oid AND rolname IN(current_user,'postgres'))
 OR (owner_oid<>(SELECT oid FROM pg_roles WHERE rolname=current_user) AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)) THEN
  RAISE EXCEPTION '0031: owner/instalador predecessor incompatível'; END IF;
 SELECT oid INTO service_oid FROM pg_roles WHERE rolname='service_role';
 SELECT array_agg(oid) INTO roles FROM pg_roles WHERE rolname IN('anon','authenticated','service_role');
 IF cardinality(roles) IS DISTINCT FROM 3 OR EXISTS(SELECT 1 FROM pg_roles WHERE oid=ANY(roles) AND (rolsuper OR rolcreaterole OR pg_has_role(oid,owner_oid,'MEMBER'))) THEN
  RAISE EXCEPTION '0031: roles ausentes/privilegiadas/owner membership'; END IF;
 known := $known0031$[{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_user integer, p_despesa integer, p_operacao uuid, p_valor numeric, p_data date, p_descricao text","types":"text, integer, integer, integer, uuid, numeric, date, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"0dde5572cd444d7514201e1585136ba847fd74aefd7ddea0245a2ae25f2cd753"},{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_contrato integer","types":"text, integer, integer","result":"void","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4d0e4fab1cee716b3eca5dbb261f36e47383276b9982dbc2c4629b7917348729"},{"proname":"ciclo_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2014f6ae985ced68bc9f5edb938763b3edbf021d0cde91406fb4746f9dee96ae"},{"proname":"ciclo_encargos","args":"p_original numeric, p_multa numeric, p_mora numeric, p_vencimento date, p_instante timestamp with time zone","types":"numeric, numeric, numeric, date, timestamp with time zone","result":"jsonb","lang":"sql","prosecdef":false,"provolatile":"i","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d3487e4663c8d2a5f917cf1e61a9d00c4314de10e48c5c2db0da40155c227dd1"},{"proname":"ciclo_finalizar_criacao","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"876c462d273e641da7351f56fcd4608939c4c76d7a424d83774f913426974b3b"},{"proname":"ciclo_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"c2494fc28f08808c4f975800c102af113bc53a0042c3821c916dce17ca233604"},{"proname":"ciclo_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"673632820324638377f46d8b4011c35249c59001ff878d03880cb586f728c434"},{"proname":"ciclo_snapshot","args":"p_contrato integer","types":"integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd"},{"proname":"ciclo_validar","args":"p_user integer, p_contrato integer","types":"integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2"},{"proname":"despesas_rpc_executar","args":"p_user_id integer, p_chave_idempotencia uuid, p_tipo text, p_payload jsonb","types":"integer, uuid, text, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"f7315aaa69cd265cdfc1b6adf1cdf29ec7ed6f933de18aef3c8f072046882f1b"},{"proname":"rpc_cotar_emprestimo_prospectivo","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"03f44f5198c9b8360458158aa07dd8961d6a58abfe86efdaacfca76ced6eed31"},{"proname":"rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"5ec9afba4e0fc002b2a35668fb051ddbeb4928b07ce5cbd9193de6ddc2ce0c2f"},{"proname":"rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"da42793f843737e74b52111a9e1db50d15a11f7f5bb1fc23d3257cc4df245d38"},{"proname":"rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"21e8ef83b6e15bf4ea6b95da37d5c53066976398569a54caabc1e8f727b9ce52"},{"proname":"rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"4141fda7c7b4710e9b8d5ad1e89ab6ff6beb1e273ecc59c3ee2ac582dfa942ac"},{"proname":"rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"59446e73faf55c1dce25c38d833182bd79f15551b1914550d588736773b6bf4f"}]$known0031$::jsonb;
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(known) f;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname=ANY(names) AND (pronamespace<>'public'::regnamespace OR proowner<>owner_oid)) THEN
  RAISE EXCEPTION '0031: schema/owner predecessor incompatível'; END IF;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO observed FROM (
  SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),
   'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,
   'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,
   'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,
   'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),
   'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j
  FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)
 ) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO known FROM jsonb_array_elements(known) f;
 IF observed IS DISTINCT FROM known THEN RAISE EXCEPTION '0031: corpo/hash/assinatura/language/configuração/overload predecessor incompatível'; END IF;
 FOR x IN SELECT * FROM pg_proc WHERE proname=ANY(names) LOOP
  IF EXISTS(SELECT 1 FROM aclexplode(coalesce(x.proacl,acldefault('f',x.proowner))) a
    WHERE a.grantee<>owner_oid AND NOT(x.proname LIKE 'rpc\_%' ESCAPE '\' AND a.grantee=service_oid AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
   OR (x.proname LIKE 'rpc\_%' ESCAPE '\' AND NOT has_function_privilege(service_oid,x.oid,'EXECUTE'))
   OR EXISTS(SELECT 1 FROM unnest(roles) r WHERE r<>service_oid AND has_function_privilege(r,x.oid,'EXECUTE'))
   OR (x.proname NOT LIKE 'rpc\_%' ESCAPE '\' AND has_function_privilege(service_oid,x.oid,'EXECUTE'))
   OR EXISTS(SELECT 1 FROM pg_depend WHERE classid='pg_proc'::regclass AND objid=x.oid AND deptype='e') THEN
   RAISE EXCEPTION '0031: ACL/capability/dependência predecessora incompatível: %',x.proname; END IF;
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['ciclo_autorizacoes','ciclo_despesas_autorizacoes','ciclo_estados','ciclo_operacoes','ciclo_pernas','emprestimos_rpc_operacoes','emprestimos_rpc_origens'] LOOP
  IF (SELECT count(*) FROM pg_class WHERE relname=tab)<>1 THEN RAISE EXCEPTION '0031: tabela privada ausente/homônima: %',tab; END IF;
  SELECT * INTO x FROM pg_class WHERE relname=tab;
  IF x.relnamespace<>'public'::regnamespace OR x.relowner<>owner_oid OR x.relkind<>'r' OR x.relpersistence<>'p'
   OR NOT x.relrowsecurity OR x.relforcerowsecurity
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(x.relacl,acldefault('r',x.relowner))) a WHERE a.grantee<>owner_oid)
   OR EXISTS(SELECT 1 FROM pg_attribute z,LATERAL aclexplode(z.attacl) a WHERE z.attrelid=x.oid AND a.grantee<>owner_oid)
   OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=x.oid) THEN RAISE EXCEPTION '0031: owner/RLS/ACL/policy privada incompatível: %',tab; END IF;
 END LOOP;
 FOR x IN SELECT * FROM (VALUES ('contratos','ciclo_contrato',27),('parcelas','ciclo_parcela',31),('transacoes_caixa','ciclo_ledger',31),('contrato_historico','ciclo_historico',31),('contas_caixa','ciclo_conta',27)) v(t,n,b) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||x.t)::regclass AND tgname=x.n AND tgfoid='public.ciclo_guardar()'::regprocedure AND tgtype=x.b AND tgenabled='O' AND NOT tgisinternal AND tgconstraint=0 AND tgnargs=0 AND tgqual IS NULL AND tgattr=''::int2vector)
    OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||x.t)::regclass AND NOT tgisinternal AND tgname<>x.n) THEN RAISE EXCEPTION 'Guard/trigger desconhecido: %',x.t; END IF;
 END LOOP;
 FOR x IN SELECT * FROM (VALUES ('contratos','valor_principal','numeric(15,2)'),('contratos','taxa_juros','numeric(5,2)'),('contratos','multa_atraso','numeric(8,4)'),('contratos','juros_mora_diario','numeric(8,4)'),('parcelas','valor_original','numeric(15,2)'),('parcelas','valor_pago','numeric(15,2)'),('parcelas','saldo_residual','numeric(15,2)'),('parcelas','status','character varying(20)'),('contratos','status','character varying(20)'),('transacoes_caixa','valor','numeric(15,2)'),('contrato_historico','valor_novo','numeric(12,2)')) v(t,c,typ) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=('public.'||x.t)::regclass AND attname=x.c AND NOT attisdropped AND format_type(atttypid,atttypmod)=x.typ) THEN RAISE EXCEPTION 'Schema incompatible %.%',x.t,x.c; END IF;
 END LOOP;
 -- Rowtypes inteiros usados para capabilities: desconhecido NÃO ganha permissão nem
 -- é truncado. Modelo sintético conhecido (fixture, nunca dump de dados produtivos).
 CREATE TEMP TABLE renovacao_modelo_contratos (
  "id" serial NOT NULL,
  "cliente_id" integer NOT NULL,
  "koletor_id" integer,
  "modalidade" character varying(30) NOT NULL,
  "valor_principal" numeric(15,2) NOT NULL,
  "taxa_juros" numeric(5,2) NOT NULL DEFAULT 0,
  "num_parcelas" integer NOT NULL DEFAULT 1,
  "valor_parcela" numeric(15,2) NOT NULL,
  "total_contrato" numeric(15,2) NOT NULL,
  "data_inicio" date NOT NULL,
  "data_vencimento" date,
  "status" character varying(20) NOT NULL DEFAULT 'ativo'::character varying,
  "conta_caixa_id" integer,
  "observacoes" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "tipo_taxa" character varying(20) DEFAULT 'mensal'::character varying,
  "numero_parcelas" integer,
  "multa_atraso" numeric(8,4) DEFAULT 2.00,
  "juros_mora_diario" numeric(8,4) DEFAULT 0.033,
  "data_vencimento_primeira" date,
  "dia_vencimento" integer,
  "descricao" text,
  "contrato_origem_id" integer,
  "contrato_assinado" boolean DEFAULT false,
  "contrato_url" character varying(500),
  "etiquetas" text,
  "user_id" integer
);
CREATE TEMP TABLE renovacao_modelo_parcelas (
  "id" serial NOT NULL,
  "contrato_id" integer NOT NULL,
  "numero" integer NOT NULL,
  "valor" numeric(15,2) NOT NULL,
  "data_vencimento" date NOT NULL,
  "data_pagamento" date,
  "valor_pago" numeric(15,2),
  "status" character varying(20) NOT NULL DEFAULT 'pendente'::character varying,
  "conta_caixa_id" integer,
  "observacoes" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "cliente_id" integer,
  "koletor_id" integer,
  "numero_parcela" integer,
  "valor_original" numeric(15,2),
  "valor_juros" numeric(15,2) DEFAULT 0.00,
  "valor_multa" numeric(15,2) DEFAULT 0.00,
  "valor_desconto" numeric(15,2) DEFAULT 0.00,
  "multa_manual" numeric(15,2) DEFAULT 0.00,
  "user_id" integer,
  "saldo_residual" numeric(15,2) NOT NULL DEFAULT 0.00,
  "multa_diaria_usada" numeric(15,2) DEFAULT 0.00
);
CREATE TEMP TABLE renovacao_modelo_transacoes_caixa (
  "id" serial NOT NULL,
  "conta_caixa_id" integer NOT NULL,
  "tipo" character varying(10) NOT NULL,
  "categoria" character varying(50),
  "descricao" text NOT NULL,
  "valor" numeric(15,2) NOT NULL,
  "data_transacao" date NOT NULL,
  "contrato_id" integer,
  "parcela_id" integer,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id" integer
);
CREATE TEMP TABLE renovacao_modelo_contrato_historico (
  "id" bigserial NOT NULL,
  "contrato_id" bigint NOT NULL,
  "user_id" text NOT NULL,
  "tipo" text NOT NULL,
  "descricao" text NOT NULL,
  "valor_anterior" numeric(12,2),
  "valor_novo" numeric(12,2),
  "created_at" timestamp with time zone DEFAULT now()
);
 FOREACH tab IN ARRAY ARRAY['contratos','parcelas','transacoes_caixa','contrato_historico'] LOOP
  SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,attidentity,attgenerated,
    CASE WHEN pg_get_expr(d.adbin,d.adrelid) LIKE 'nextval(%' THEN 'serial' ELSE pg_get_expr(d.adbin,d.adrelid) END) ORDER BY attnum)
  INTO a FROM pg_attribute z LEFT JOIN pg_attrdef d ON d.adrelid=z.attrelid AND d.adnum=z.attnum
  WHERE z.attrelid=('public.'||tab)::regclass AND z.attnum>0 AND NOT z.attisdropped;
  SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,attidentity,attgenerated,
    CASE WHEN pg_get_expr(d.adbin,d.adrelid) LIKE 'nextval(%' THEN 'serial' ELSE pg_get_expr(d.adbin,d.adrelid) END) ORDER BY attnum)
  INTO b FROM pg_attribute z LEFT JOIN pg_attrdef d ON d.adrelid=z.attrelid AND d.adnum=z.attnum
  WHERE z.attrelid=('renovacao_modelo_'||tab)::regclass AND z.attnum>0 AND NOT z.attisdropped;
  IF a IS DISTINCT FROM b THEN RAISE EXCEPTION '0031 rowtype/default incompatível: %',tab; END IF;
  EXECUTE format('DROP TABLE renovacao_modelo_%I',tab);
 END LOOP;
 CREATE TEMP TABLE renovacao_check_modelo(status varchar(20),valor numeric(15,2),valor_pago numeric(15,2),saldo_residual numeric(15,2)) ON COMMIT DROP;
 ALTER TABLE renovacao_check_modelo ADD CONSTRAINT esperado CHECK (status::text = ANY (ARRAY['pendente'::varchar,'paga'::varchar,'pago'::varchar,'atrasada'::varchar,'atrasado'::varchar,'cancelada'::varchar,'cancelado'::varchar,'parcial'::varchar,'vencendo_hoje'::varchar]::text[]));
 SELECT pg_get_expr(conbin,conrelid) INTO expected FROM pg_constraint WHERE conrelid='renovacao_check_modelo'::regclass AND conname='esperado';
 SELECT pg_get_expr(conbin,conrelid) INTO actual FROM pg_constraint WHERE conrelid='public.parcelas'::regclass AND conname='parcelas_status_check' AND contype='c' AND convalidated AND NOT connoinherit;
 -- Duas representações da mesma expressão, sem normalizar/remover SQL arbitrário.
 -- A variante abaixo foi comprovada em 17.6: mesmos nove valores e casts exatos.
 IF (actual IS DISTINCT FROM expected AND actual IS DISTINCT FROM $check176$((status)::text = ANY ((ARRAY['pendente'::character varying, 'paga'::character varying, 'pago'::character varying, 'atrasada'::character varying, 'atrasado'::character varying, 'cancelada'::character varying, 'cancelado'::character varying, 'parcial'::character varying, 'vencendo_hoje'::character varying])::text[]))$check176$)
 OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.parcelas'::regclass AND contype='c' AND conname<>'parcelas_status_check') THEN RAISE EXCEPTION 'CHECK parcelas desconhecido; não ampliar cegamente'; END IF;
 IF EXISTS(SELECT 1 FROM public.parcelas WHERE status='renovada') THEN RAISE EXCEPTION 'Dados status reservado existem'; END IF;
END;
$preflight$;
-- Snapshot TEMP de metadados externos estáveis, não baseline permissivo de funções.
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
-- Sem GRANT, SET ROLE, elevação ou modificação de default ACL.
CREATE TEMP TABLE migration_3133_relations ON COMMIT DROP AS
 SELECT c.oid FROM pg_class c JOIN pg_locks l ON l.relation=c.oid
 WHERE l.pid=pg_backend_pid() AND l.mode='AccessExclusiveLock' AND l.granted AND c.relnamespace='public'::regnamespace;
CREATE TEMP TABLE migration_3133_application ON COMMIT DROP AS
SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relnamespace,c.reltype,c.relowner,c.relkind,c.relpersistence,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) ORDER BY c.oid) FROM pg_class c WHERE c.oid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'defaults',(SELECT jsonb_agg(jsonb_build_array(adrelid,adnum,pg_get_expr(adbin,adrelid)) ORDER BY adrelid,adnum) FROM pg_attrdef WHERE adrelid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE conrelid IN(SELECT oid FROM pg_temp.migration_3133_relations) AND NOT(conrelid='public.parcelas'::regclass AND conname='parcelas_status_check')),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM pg_temp.migration_3133_relations) AND NOT tgisinternal),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid IN(SELECT oid FROM pg_temp.migration_3133_relations))
 ) AS metadata;
ALTER TABLE public.parcelas DROP CONSTRAINT parcelas_status_check;
ALTER TABLE public.parcelas ADD CONSTRAINT parcelas_status_check CHECK (status::text = ANY (ARRAY['pendente'::varchar,'paga'::varchar,'pago'::varchar,'atrasada'::varchar,'atrasado'::varchar,'cancelada'::varchar,'cancelado'::varchar,'parcial'::varchar,'vencendo_hoje'::varchar,'renovada'::varchar]::text[]));

CREATE TABLE public.renovacao_operacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id integer NOT NULL REFERENCES public.users(id),
 chave_idempotencia uuid NOT NULL, hash_payload text NOT NULL CHECK(hash_payload ~ '^[0-9a-f]{64}$'),
 contrato_id integer NOT NULL REFERENCES public.emprestimos_rpc_origens(contrato_id) ON DELETE RESTRICT,
 parcela_id integer NOT NULL REFERENCES public.parcelas(id) ON DELETE RESTRICT,
 payload jsonb NOT NULL, resultado jsonb, auditoria jsonb, concluida_em timestamptz,
 UNIQUE(user_id,chave_idempotencia), UNIQUE(user_id,id),
 CHECK((resultado IS NULL AND auditoria IS NULL AND concluida_em IS NULL) OR (resultado IS NOT NULL AND auditoria IS NOT NULL AND concluida_em IS NOT NULL))
);
CREATE TABLE public.renovacao_provas (
 operacao_id uuid PRIMARY KEY, user_id integer NOT NULL, contrato_id integer NOT NULL UNIQUE REFERENCES public.contratos(id) ON DELETE RESTRICT,
 parcela_anterior_id integer NOT NULL UNIQUE REFERENCES public.parcelas(id) ON DELETE RESTRICT,
 parcela_sucessora_id integer NOT NULL UNIQUE REFERENCES public.parcelas(id) ON DELETE RESTRICT,
 transacao_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id) ON DELETE RESTRICT,
 principal_antes numeric(15,2) NOT NULL CHECK(principal_antes>0), principal_depois numeric(15,2) NOT NULL,
 principal_pago numeric(15,2) NOT NULL CHECK(principal_pago=0), juros_pagos numeric(15,2) NOT NULL CHECK(juros_pagos>0),
 multa_paga numeric(15,2) NOT NULL CHECK(multa_paga>=0), mora_paga numeric(15,2) NOT NULL CHECK(mora_paga>=0),
 valor_recebido numeric(15,2) NOT NULL, cotacao jsonb NOT NULL, perna_snapshot jsonb NOT NULL,
 regra text NOT NULL CHECK(regra='renovacao_juros_mensal_brt_v1'),
 CHECK(principal_antes=principal_depois AND parcela_anterior_id<>parcela_sucessora_id AND valor_recebido=juros_pagos+multa_paga+mora_paga),
 FOREIGN KEY(user_id,operacao_id) REFERENCES public.renovacao_operacoes(user_id,id) ON DELETE RESTRICT
);
-- Capacidade de USO ÚNICO, por linha e operação. Não aceita caller GUC, tabela/ação genérica.
CREATE TABLE public.renovacao_capacidades (
 xid bigint NOT NULL, pid integer NOT NULL, operacao_id uuid NOT NULL REFERENCES public.renovacao_operacoes(id),
 tabela text NOT NULL CHECK(tabela IN('contratos','parcelas','transacoes_caixa','contrato_historico')),
 evento text NOT NULL CHECK(evento IN('INSERT','UPDATE')), anterior jsonb, posterior jsonb NOT NULL,
 PRIMARY KEY(xid,pid), CHECK((evento='INSERT' AND anterior IS NULL) OR (evento='UPDATE' AND anterior IS NOT NULL))
);
ALTER TABLE public.renovacao_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renovacao_provas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renovacao_capacidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.renovacao_operacoes,public.renovacao_provas,public.renovacao_capacidades FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.renovacao_consumir_capacidade(p_tabela text,p_evento text,p_old jsonb,p_new jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cap public.renovacao_capacidades%ROWTYPE;
BEGIN
 DELETE FROM public.renovacao_capacidades a USING public.renovacao_operacoes o
 WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.tabela=p_tabela AND a.evento=p_evento
 AND a.anterior IS NOT DISTINCT FROM p_old AND a.posterior IS NOT DISTINCT FROM p_new
 AND o.id=a.operacao_id AND o.resultado IS NULL AND (p_new->>'user_id')=o.user_id::text
 AND (CASE WHEN p_tabela='contratos' THEN (p_new->>'id')::integer ELSE (p_new->>'contrato_id')::integer END)=o.contrato_id
 RETURNING a.* INTO cap;
 IF FOUND THEN RETURN true; END IF;
 -- O novo status não fica disponível para escrita manual no legado.
 IF p_tabela='parcelas' AND p_new->>'status'='renovada' THEN RAISE EXCEPTION 'Status renovada exige capacidade exata' USING ERRCODE='42501'; END IF;
 RETURN false;
END;
$$;
-- Somente esta extensão, código original abaixo permanece integralmente preservado.
CREATE OR REPLACE FUNCTION public.ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oldj jsonb; newj jsonb; cid integer; aid integer; protegido boolean; autorizado boolean; despesa_autorizada boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 IF public.renovacao_consumir_capacidade(TG_TABLE_NAME,TG_OP,oldj,newj) THEN
   IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='contas_caixa' THEN
   aid:=(oldj->>'id')::int; PERFORM pg_advisory_xact_lock(22022,aid);
   IF EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens o JOIN public.contratos c ON c.id=o.contrato_id WHERE c.conta_caixa_id=aid)
     AND (TG_OP='DELETE' OR oldj->'user_id' IS DISTINCT FROM newj->'user_id' OR oldj->'saldo' IS DISTINCT FROM newj->'saldo') THEN
     RAISE EXCEPTION 'Conta protegida: owner/saldo-base/exclusão imutáveis' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='transacoes_caixa' THEN
   aid:=coalesce((newj->>'conta_caixa_id')::int,(oldj->>'conta_caixa_id')::int);
   PERFORM pg_advisory_xact_lock(22022,aid);
   IF TG_OP='UPDATE' AND (oldj->>'conta_caixa_id')::int IS DISTINCT FROM aid THEN PERFORM pg_advisory_xact_lock(22022,(oldj->>'conta_caixa_id')::int); END IF;
   protegido:=EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens o JOIN public.contratos c ON c.id=o.contrato_id WHERE c.conta_caixa_id IN(aid,(oldj->>'conta_caixa_id')::int) OR o.contrato_id IN((newj->>'contrato_id')::int,(oldj->>'contrato_id')::int))
     OR EXISTS(SELECT 1 FROM public.parcelas p JOIN public.emprestimos_rpc_origens o ON o.contrato_id=p.contrato_id WHERE p.id IN((newj->>'parcela_id')::int,(oldj->>'parcela_id')::int));
   autorizado:=EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND conta_id=aid
     AND ((acao='criar' AND newj->>'tipo'='saida' AND newj->>'categoria'='emprestimo_liberado') OR (acao='receber' AND contrato_id=(newj->>'contrato_id')::int AND newj->>'tipo'='entrada' AND newj->>'categoria'='pagamento_parcela')));
   -- 0025: consumo atômico de UMA linha exata; sem bypass de outros triggers/tabelas.
   IF TG_OP='INSERT' THEN
     DELETE FROM public.ciclo_despesas_autorizacoes a
      WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.conta_id=aid
        AND a.user_id=(newj->>'user_id')::integer AND a.esperado=newj-'id'
        AND newj->>'categoria'='despesa_operacional'
        AND newj->'contrato_id'='null'::jsonb AND newj->'parcela_id'='null'::jsonb
      RETURNING true INTO despesa_autorizada;
     IF NOT coalesce(despesa_autorizada,false) AND EXISTS(SELECT 1 FROM public.ciclo_despesas_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN
       RAISE EXCEPTION '0025: lançamento diferente da capability exata' USING ERRCODE='42501';
     END IF;
     autorizado:=autorizado OR coalesce(despesa_autorizada,false);
   END IF;
   IF protegido AND (TG_OP<>'INSERT' OR NOT autorizado) THEN RAISE EXCEPTION 'Livro protegido: somente RPC append-only' USING ERRCODE='42501'; END IF;
 ELSE
   cid:=CASE WHEN TG_TABLE_NAME='contratos' THEN coalesce((newj->>'id')::int,(oldj->>'id')::int) ELSE coalesce((newj->>'contrato_id')::int,(oldj->>'contrato_id')::int) END;
   protegido:=EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id IN(cid,(oldj->>'contrato_id')::int));
   autorizado:=EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND acao='receber' AND contrato_id=cid);
   IF protegido AND (TG_OP='DELETE' OR NOT autorizado OR (TG_TABLE_NAME='parcelas' AND TG_OP='INSERT')) THEN RAISE EXCEPTION 'Contrato/parcelas/trilha protegidos' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE FUNCTION public.renovacao_cotacao(p_user integer,p_contrato integer,p_parcela integer,p_instante timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' AS $$
DECLARE s jsonb; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; op public.emprestimos_rpc_operacoes%ROWTYPE;
 q jsonb; enc jsonb; hoje date:=(p_instante AT TIME ZONE 'America/Sao_Paulo')::date; venc date;
 total numeric; juros numeric; multa numeric; mora numeric;
BEGIN
 s:=public.ciclo_validar(p_user,p_contrato);
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato;
 SELECT * INTO p FROM public.parcelas WHERE id=p_parcela AND contrato_id=p_contrato AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Parcela indisponível' USING ERRCODE='42501'; END IF;
 SELECT o.* INTO STRICT op FROM public.emprestimos_rpc_operacoes o JOIN public.emprestimos_rpc_origens r ON r.operacao_id=o.id WHERE r.contrato_id=p_contrato;
 IF NOT EXISTS(SELECT 1 FROM public.ciclo_estados WHERE contrato_id=p_contrato AND user_id=p_user AND origem_completa)
 OR op.auditoria->'contrato' IS DISTINCT FROM s->'contrato' OR op.auditoria->'parcelas' IS DISTINCT FROM s->'parcelas'
 OR c.status IS DISTINCT FROM 'ativo' OR c.modalidade IS DISTINCT FROM 'mensal' OR c.tipo_taxa IS DISTINCT FROM 'mensal'
 OR c.num_parcelas IS DISTINCT FROM 1 OR c.numero_parcelas IS DISTINCT FROM 1 OR (op.payload->>'numeroParcelas')::int IS DISTINCT FROM 1
 OR jsonb_array_length(s->'parcelas')<>1 OR jsonb_array_length(s->'ledger')<>1 OR jsonb_array_length(s->'historico')<>1
 OR EXISTS(SELECT 1 FROM public.ciclo_operacoes WHERE contrato_id=p_contrato) OR EXISTS(SELECT 1 FROM public.renovacao_provas WHERE contrato_id=p_contrato)
 OR p.status NOT IN('pendente','atrasada','vencendo_hoje') OR p.valor_pago IS DISTINCT FROM 0::numeric OR p.saldo_residual IS DISTINCT FROM 0::numeric
 OR p.valor_desconto IS DISTINCT FROM 0::numeric OR p.valor_multa IS DISTINCT FROM 0::numeric OR p.multa_diaria_usada IS DISTINCT FROM 0::numeric OR p.multa_manual IS DISTINCT FROM 0::numeric
 OR p.data_pagamento IS NOT NULL OR p.valor IS DISTINCT FROM p.valor_original OR p.valor_juros<=0 OR p.valor_original-p.valor_juros IS DISTINCT FROM c.valor_principal
 OR p.valor_juros IS DISTINCT FROM round(c.valor_principal*c.taxa_juros/100,2) THEN
 RAISE EXCEPTION 'v1 exige criação 0021/0022 completa, UMA parcela mensal intacta; sem legado, parcial, desconto/amortização ou segunda renovação' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=p_user)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=c.conta_caixa_id AND user_id=p_user AND ativo)
 OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=p_user AND ativo))
 OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE conta_caixa_id=c.conta_caixa_id AND user_id IS DISTINCT FROM p_user) THEN RAISE EXCEPTION 'Vínculos/conta não disponíveis' USING ERRCODE='42501'; END IF;
 -- Um mês civil a partir do MAIOR entre vencimento anterior e data BRT de recebimento.
 -- Clamp explícito: 31/jan -> último dia de fevereiro. Não usa 30 dias, não backdate.
 venc:=(greatest(p.data_vencimento,hoje)+interval '1 month')::date;
 IF venc>DATE '9999-12-31' THEN RAISE EXCEPTION 'Calendário fora da faixa' USING ERRCODE='22023'; END IF;
 enc:=public.ciclo_encargos(p.valor_original,c.multa_atraso,c.juros_mora_diario,p.data_vencimento,p_instante);
 juros:=p.valor_juros; multa:=(enc->>'multa')::numeric; mora:=(enc->>'mora')::numeric; total:=juros+multa+mora;
 IF total>9999999999.99 OR c.valor_principal+juros>9999999999.99 THEN RAISE EXCEPTION 'Valores fora da faixa de histórico' USING ERRCODE='22023'; END IF;
 q:=jsonb_build_object('elegivel',true,'contratoId',p_contrato,'parcelaId',p_parcela,'contaCaixaId',c.conta_caixa_id,
 'jurosEmbutidos',juros::numeric(15,2)::text,'multa',multa::numeric(15,2)::text,'mora',mora::numeric(15,2)::text,'totalExigido',total::numeric(15,2)::text,
 'principalAntes',c.valor_principal::numeric(15,2)::text,'principalDepois',c.valor_principal::numeric(15,2)::text,'principalPago','0.00',
 'novoJuros',juros::numeric(15,2)::text,'novoTotal',(c.valor_principal+juros)::numeric(15,2)::text,'novoVencimento',venc,
 'vencimento',p.data_vencimento,'dataPagamento',hoje,'expiraEm',to_char(hoje+1,'YYYY-MM-DD')||'T00:00:00-03:00',
 'estadoHash',encode(extensions.digest(s::text,'sha256'),'hex'),'regra','renovacao_juros_mensal_brt_v1');
 RETURN q||jsonb_build_object('cotacaoHash',encode(extensions.digest(q::text,'sha256'),'hex'));
END;
$$;
CREATE FUNCTION public.rpc_cotar_renovacao_prospectiva(p_user_id integer,p_contrato_id integer,p_parcela_id integer) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT public.renovacao_cotacao(p_user_id,p_contrato_id,p_parcela_id,clock_timestamp());
$$;
CREATE FUNCTION public.rpc_renovar_emprestimo_prospectivo(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_parcela_id integer,
 p_valor_recebido numeric,p_total_exigido numeric,p_data_pagamento date,p_estado_hash text,p_cotacao_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' AS $$
DECLARE v_payload jsonb; hash text; op public.renovacao_operacoes%ROWTYPE; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE;
 novo public.parcelas%ROWTYPE; tc public.transacoes_caixa%ROWTYPE; h public.contrato_historico%ROWTYPE;
 antes jsonb; depois jsonb; oldrow jsonb; q jsonb; conta integer; instante timestamptz; result jsonb;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave_idempotencia IS NULL OR p_contrato_id IS NULL OR p_contrato_id<=0 OR p_parcela_id IS NULL OR p_parcela_id<=0
 OR p_valor_recebido IS NULL OR p_valor_recebido::text IN('NaN','Infinity','-Infinity') OR p_valor_recebido<=0 OR p_valor_recebido<>round(p_valor_recebido,2) OR p_valor_recebido>9999999999.99
 OR p_total_exigido IS NULL OR p_total_exigido IS DISTINCT FROM p_valor_recebido
 OR p_estado_hash IS NULL OR p_estado_hash !~ '^[0-9a-f]{64}$' OR p_cotacao_hash IS NULL OR p_cotacao_hash !~ '^[0-9a-f]{64}$'
 OR p_data_pagamento IS NULL OR NOT isfinite(p_data_pagamento) OR p_data_pagamento NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' THEN
 RAISE EXCEPTION 'Intenção inválida: valor EXATO em centavos, UUID, DATE/hash' USING ERRCODE='22023'; END IF;
 v_payload:=jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,'valorRecebido',p_valor_recebido::numeric(15,2)::text,
 'totalExigido',p_total_exigido::numeric(15,2)::text,'dataPagamento',p_data_pagamento,'estadoHash',p_estado_hash,'cotacaoHash',p_cotacao_hash,'regra','renovacao_juros_mensal_brt_v1');
 hash:=encode(extensions.digest(v_payload::text,'sha256'),'hex');
 IF NOT EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=p_contrato_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Origem não disponível' USING ERRCODE='42501'; END IF;
 INSERT INTO public.renovacao_operacoes(user_id,chave_idempotencia,hash_payload,contrato_id,parcela_id,payload)
 VALUES(p_user_id,p_chave_idempotencia,hash,p_contrato_id,p_parcela_id,v_payload) ON CONFLICT(user_id,chave_idempotencia) DO NOTHING;
 SELECT * INTO STRICT op FROM public.renovacao_operacoes WHERE user_id=p_user_id AND chave_idempotencia=p_chave_idempotencia FOR UPDATE;
 IF op.hash_payload<>hash THEN RAISE EXCEPTION 'UUID reutilizado com intenção divergente' USING ERRCODE='23505'; END IF;
 IF op.resultado IS NOT NULL THEN RETURN op.resultado||jsonb_build_object('repetida',true); END IF;
 SELECT conta_caixa_id INTO conta FROM public.contratos WHERE id=p_contrato_id;
 -- MESMA ordem 0022; NO KEY UPDATE evita upgrade deadlock de reservas/FK concorrentes.
 PERFORM pg_advisory_xact_lock(22022,conta);
 PERFORM 1 FROM public.contas_caixa WHERE id=conta FOR UPDATE;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato_id;
 PERFORM 1 FROM public.clientes WHERE id=c.cliente_id FOR UPDATE;
 PERFORM 1 FROM public.koletores WHERE id=c.koletor_id FOR UPDATE;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato_id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.parcelas WHERE contrato_id=p_contrato_id ORDER BY id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.transacoes_caixa WHERE conta_caixa_id=conta OR contrato_id=p_contrato_id OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=p_contrato_id) ORDER BY id FOR UPDATE;
 instante:=clock_timestamp(); -- revalidar APÓS esperas, não statement_timestamp antes do lock.
 antes:=public.ciclo_validar(p_user_id,p_contrato_id); q:=public.renovacao_cotacao(p_user_id,p_contrato_id,p_parcela_id,instante);
 IF c.conta_caixa_id IS DISTINCT FROM conta OR q->>'estadoHash' IS DISTINCT FROM p_estado_hash OR q->>'cotacaoHash' IS DISTINCT FROM p_cotacao_hash
 OR (q->>'dataPagamento')::date IS DISTINCT FROM p_data_pagamento OR (q->>'totalExigido')::numeric IS DISTINCT FROM p_total_exigido THEN
 RAISE EXCEPTION 'Cotação/estado/data expirou ou divergiu' USING ERRCODE='40001'; END IF;
 SELECT * INTO STRICT p FROM public.parcelas WHERE id=p_parcela_id;
 oldrow:=to_jsonb(p);
 p.valor_pago:=p_valor_recebido; p.valor_multa:=(q->>'multa')::numeric; p.multa_diaria_usada:=(q->>'mora')::numeric;
 p.saldo_residual:=c.valor_principal; p.data_pagamento:=p_data_pagamento; p.status:='renovada'; p."updatedAt":=instante;
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'parcelas','UPDATE',oldrow,to_jsonb(p));
 UPDATE public.parcelas SET valor_pago=p.valor_pago,valor_multa=p.valor_multa,multa_diaria_usada=p.multa_diaria_usada,
 saldo_residual=p.saldo_residual,data_pagamento=p.data_pagamento,status=p.status,"updatedAt"=p."updatedAt" WHERE id=p.id;
 -- Construir linha inteira antes da capability: nenhum INSERT genérico liberado.
 novo:=p; novo.id:=nextval(pg_get_serial_sequence('public.parcelas','id')); novo.numero:=2; novo.numero_parcela:=2;
 novo.valor:=(q->>'novoTotal')::numeric; novo.valor_original:=novo.valor; novo.valor_juros:=(q->>'novoJuros')::numeric;
 novo.valor_pago:=0; novo.valor_multa:=0; novo.multa_diaria_usada:=0; novo.saldo_residual:=0; novo.data_pagamento:=NULL;
 novo.data_vencimento:=(q->>'novoVencimento')::date; novo.status:='pendente'; novo.observacoes:=NULL;
 novo."createdAt":=instante; novo."updatedAt":=instante;
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'parcelas','INSERT',NULL,to_jsonb(novo));
 INSERT INTO public.parcelas SELECT (novo).*;
 -- Categoria específica: não há segundo desembolso nem receita de principal.
 tc.id:=nextval(pg_get_serial_sequence('public.transacoes_caixa','id')); tc.user_id:=p_user_id; tc.conta_caixa_id:=conta;
 tc.contrato_id:=p_contrato_id; tc.parcela_id:=p_parcela_id; tc.tipo:='entrada'; tc.categoria:='renovacao_juros'; tc.valor:=p_valor_recebido;
 tc.descricao:='Renovação prospectiva '||op.id::text; tc.data_transacao:=p_data_pagamento; tc."createdAt":=instante;
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'transacoes_caixa','INSERT',NULL,to_jsonb(tc));
 INSERT INTO public.transacoes_caixa SELECT (tc).*;
 INSERT INTO public.renovacao_provas(operacao_id,user_id,contrato_id,parcela_anterior_id,parcela_sucessora_id,transacao_id,
 principal_antes,principal_depois,principal_pago,juros_pagos,multa_paga,mora_paga,valor_recebido,cotacao,perna_snapshot,regra)
 VALUES(op.id,p_user_id,p_contrato_id,p.id,novo.id,tc.id,c.valor_principal,c.valor_principal,0,p.valor_juros,p.valor_multa,p.multa_diaria_usada,p_valor_recebido,q,to_jsonb(tc),'renovacao_juros_mensal_brt_v1');
 oldrow:=to_jsonb(c); c.num_parcelas:=2; c.numero_parcelas:=2; c.valor_parcela:=novo.valor; c.total_contrato:=novo.valor;
 c.data_vencimento:=novo.data_vencimento; c.dia_vencimento:=extract(day FROM novo.data_vencimento)::int; c."updatedAt":=instante;
 -- data_vencimento_primeira/data_inicio/encargos históricos permanecem originais.
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'contratos','UPDATE',oldrow,to_jsonb(c));
 UPDATE public.contratos SET num_parcelas=c.num_parcelas,numero_parcelas=c.numero_parcelas,valor_parcela=c.valor_parcela,total_contrato=c.total_contrato,
 data_vencimento=c.data_vencimento,dia_vencimento=c.dia_vencimento,"updatedAt"=c."updatedAt" WHERE id=c.id;
 h.id:=nextval(pg_get_serial_sequence('public.contrato_historico','id')); h.user_id:=p_user_id::text; h.contrato_id:=p_contrato_id;
 h.tipo:='renovacao'; h.descricao:='Renovação prospectiva '||op.id::text||'; principal transferido, não quitado';
 h.valor_anterior:=0; h.valor_novo:=p_valor_recebido; h.created_at:=instante;
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'contrato_historico','INSERT',NULL,to_jsonb(h));
 INSERT INTO public.contrato_historico SELECT (h).*;
 depois:=public.ciclo_snapshot(p_contrato_id);
 UPDATE public.ciclo_estados SET snapshot=depois WHERE contrato_id=p_contrato_id;
 result:=jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'contratoId',p_contrato_id,'parcelaId',p.id,'sucessoraId',novo.id,
 'transacaoCaixaId',tc.id::text,'contaCaixaId',conta,'valorRecebido',p_valor_recebido::numeric(15,2)::text,'totalExigido',p_total_exigido::numeric(15,2)::text,
 'jurosPagos',p.valor_juros::numeric(15,2)::text,'multaPaga',p.valor_multa::numeric(15,2)::text,'moraPaga',p.multa_diaria_usada::numeric(15,2)::text,
 'principalPago','0.00','principalAntes',c.valor_principal::numeric(15,2)::text,'principalDepois',c.valor_principal::numeric(15,2)::text,
 'status','renovada','contratoStatus','ativo','novoTotal',novo.valor::numeric(15,2)::text,'novoJuros',novo.valor_juros::numeric(15,2)::text,
 'novoVencimento',novo.data_vencimento,'dataPagamento',p_data_pagamento,'estadoHash',p_estado_hash,'cotacaoHash',p_cotacao_hash,'regra','renovacao_juros_mensal_brt_v1');
 UPDATE public.renovacao_operacoes SET resultado=result,concluida_em=clock_timestamp(),auditoria=jsonb_build_object('antes',antes,'depois',depois,
 'payload',v_payload,'hashPayload',hash,'cotacao',q,'prova',(SELECT to_jsonb(x) FROM public.renovacao_provas x WHERE operacao_id=op.id),'historicoId',h.id::text,'resultado',result) WHERE id=op.id;
 IF EXISTS(SELECT 1 FROM public.renovacao_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN RAISE EXCEPTION 'Capacidade não consumida' USING ERRCODE='23514'; END IF;
 IF (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date IS DISTINCT FROM p_data_pagamento THEN RAISE EXCEPTION 'Cotação expirou durante execução' USING ERRCODE='40001'; END IF;
 RETURN result;
END;
$$;
CREATE FUNCTION public.renovacao_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='renovacao_operacoes' AND TG_OP='UPDATE' THEN
  IF OLD.resultado IS NULL AND NEW.resultado IS NOT NULL
  AND (to_jsonb(OLD)-ARRAY['resultado','auditoria','concluida_em'])=(to_jsonb(NEW)-ARRAY['resultado','auditoria','concluida_em']) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Prova/operação concluída imutável' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER renovacao_prova_imutavel BEFORE UPDATE OR DELETE ON public.renovacao_provas FOR EACH ROW EXECUTE FUNCTION public.renovacao_imutavel();
CREATE TRIGGER renovacao_operacao_imutavel BEFORE UPDATE OR DELETE ON public.renovacao_operacoes FOR EACH ROW EXECUTE FUNCTION public.renovacao_imutavel();
-- Única extensão de recebimento: desconsidera na quitação SOMENTE antecessor cuja
-- dívida de principal foi transferida para sucessor com prova completa. Não 'status pago'.
CREATE FUNCTION public.renovacao_antecessor_transferido(p_user integer,p_contrato integer,p_parcela integer) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.renovacao_provas r
 JOIN public.renovacao_operacoes o ON o.id=r.operacao_id AND o.user_id=r.user_id
 JOIN public.parcelas p ON p.id=r.parcela_anterior_id AND p.contrato_id=r.contrato_id AND p.user_id=r.user_id
 JOIN public.parcelas n ON n.id=r.parcela_sucessora_id AND n.contrato_id=r.contrato_id AND n.user_id=r.user_id
 JOIN public.transacoes_caixa t ON t.id=r.transacao_id
 WHERE r.user_id=p_user AND r.contrato_id=p_contrato AND r.parcela_anterior_id=p_parcela
 AND o.resultado IS NOT NULL AND o.auditoria IS NOT NULL AND o.concluida_em IS NOT NULL
 AND o.auditoria->'prova'=to_jsonb(r) AND r.perna_snapshot=to_jsonb(t)
 AND p.status='renovada' AND p.valor_pago=r.valor_recebido AND p.saldo_residual=r.principal_antes
 AND p.valor_juros=r.juros_pagos AND p.valor_multa=r.multa_paga AND p.multa_diaria_usada=r.mora_paga
 AND n.valor_original-n.valor_juros=r.principal_depois AND r.principal_pago=0);
$$;
CREATE OR REPLACE FUNCTION public.rpc_receber_emprestimo_prospectivo(
 p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_parcela_id integer,
 p_valor_recebido numeric,p_total_exigido numeric,p_data_pagamento date,p_estado_hash text,p_modo text,p_observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v_payload jsonb; hash text; op public.ciclo_operacoes%ROWTYPE; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE;
 s jsonb; depois jsonb; q jsonb; conta integer; cx integer; hi bigint; residual numeric; pago numeric; v_resultado jsonb;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave_idempotencia IS NULL OR p_contrato_id IS NULL OR p_contrato_id<=0 OR p_parcela_id IS NULL OR p_parcela_id<=0
   OR p_valor_recebido IS NULL OR p_valor_recebido::text IN('NaN','Infinity','-Infinity') OR p_valor_recebido<=0 OR p_valor_recebido<>round(p_valor_recebido,2) OR p_valor_recebido>9999999999.99
   OR p_total_exigido IS NULL OR p_total_exigido::text IN('NaN','Infinity','-Infinity') OR p_total_exigido<=0 OR p_total_exigido<>round(p_total_exigido,2) OR p_total_exigido>9999999999.99
   OR p_estado_hash IS NULL OR p_estado_hash !~ '^[0-9a-f]{64}$' OR p_modo IS NULL OR p_modo NOT IN('integral','parcial')
   OR p_data_pagamento IS NULL OR NOT isfinite(p_data_pagamento) OR length(p_observacoes)>1000 THEN
   RAISE EXCEPTION 'Intenção inválida: centavos, UUID, modo, estado e DATE obrigatórios' USING ERRCODE='22023'; END IF;
 v_payload:=jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,
   'valorRecebido',p_valor_recebido::numeric(15,2)::text,'totalExigido',p_total_exigido::numeric(15,2)::text,
   'dataPagamento',p_data_pagamento,'estadoHash',p_estado_hash,'modo',p_modo,'observacoes',nullif(btrim(p_observacoes),''),'regra','recebimento_defaults_brt_v1');
 hash:=encode(extensions.digest(v_payload::text,'sha256'),'hex');
 -- Sem origem não há reserva, FK não serve como prova de tenant.
 IF NOT EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=p_contrato_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Origem 0021 indisponível' USING ERRCODE='42501'; END IF;
 INSERT INTO public.ciclo_operacoes(user_id,chave_idempotencia,hash_payload,contrato_id,parcela_id,payload)
 VALUES(p_user_id,p_chave_idempotencia,hash,p_contrato_id,p_parcela_id,v_payload) ON CONFLICT(user_id,chave_idempotencia) DO NOTHING;
 SELECT * INTO STRICT op FROM public.ciclo_operacoes WHERE user_id=p_user_id AND chave_idempotencia=p_chave_idempotencia FOR UPDATE;
 IF op.hash_payload<>hash THEN RAISE EXCEPTION 'UUID reutilizado com intenção divergente' USING ERRCODE='23505'; END IF;
 IF op.resultado IS NOT NULL THEN RETURN op.resultado||jsonb_build_object('repetida',true); END IF;
 SELECT conta_caixa_id INTO conta FROM public.contratos WHERE id=p_contrato_id;
 -- Ordem global: operação -> lock ledger/conta -> conta -> cliente -> koletor -> contrato -> parcelas IDs.
 PERFORM pg_advisory_xact_lock(22022,conta);
 PERFORM 1 FROM public.contas_caixa WHERE id=conta FOR UPDATE;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato_id;
 PERFORM 1 FROM public.clientes WHERE id=c.cliente_id FOR UPDATE;
 PERFORM 1 FROM public.koletores WHERE id=c.koletor_id FOR UPDATE;
 -- NO KEY UPDATE é exclusivo entre writers, mas compatível com KEY SHARE das FKs
 -- das reservas concorrentes. FOR UPDATE criaria upgrade deadlock antes da cotação.
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato_id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.parcelas WHERE contrato_id=p_contrato_id ORDER BY id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.transacoes_caixa WHERE conta_caixa_id=conta OR contrato_id=p_contrato_id OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=p_contrato_id) ORDER BY id FOR UPDATE;
 s:=public.ciclo_validar(p_user_id,p_contrato_id); q:=public.ciclo_cotacao(p_user_id,p_contrato_id,p_parcela_id);
 IF c.conta_caixa_id IS DISTINCT FROM conta OR q->>'estadoHash' IS DISTINCT FROM p_estado_hash OR (q->>'totalExigido')::numeric IS DISTINCT FROM p_total_exigido
   OR (q->>'dataPagamento')::date IS DISTINCT FROM p_data_pagamento OR q->'elegivel' IS DISTINCT FROM 'true'::jsonb THEN
   RAISE EXCEPTION 'Cotação/estado/data divergente; conferir antes de nova intenção' USING ERRCODE='40001'; END IF;
 IF (p_modo='integral' AND p_valor_recebido<>p_total_exigido) OR (p_modo='parcial' AND p_valor_recebido>=p_total_exigido) THEN
   RAISE EXCEPTION 'Integral exige valor exato; parcial positivo menor, sem desconto' USING ERRCODE='22023'; END IF;
 SELECT * INTO STRICT p FROM public.parcelas WHERE id=p_parcela_id;
 residual:=p_total_exigido-p_valor_recebido; pago:=p.valor_pago+p_valor_recebido;
 INSERT INTO public.ciclo_estados(contrato_id,user_id,snapshot,origem_completa) VALUES(p_contrato_id,p_user_id,s,false) ON CONFLICT(contrato_id) DO NOTHING;
 PERFORM public.ciclo_autorizar('receber',conta,p_contrato_id);
 UPDATE public.parcelas SET valor_pago=pago,valor_multa=(q->>'multa')::numeric,multa_diaria_usada=(q->>'mora')::numeric,
   valor_desconto=0,saldo_residual=residual,data_pagamento=p_data_pagamento,status=CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,"updatedAt"=clock_timestamp()
 WHERE id=p_parcela_id;
 INSERT INTO public.transacoes_caixa(user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor,descricao,data_transacao)
 VALUES(p_user_id,conta,p_contrato_id,p_parcela_id,'entrada','pagamento_parcela',p_valor_recebido,'Recebimento prospectivo '||op.id::text,p_data_pagamento) RETURNING id INTO cx;
 INSERT INTO public.ciclo_pernas(operacao_id,user_id,transacao_id,snapshot) VALUES(op.id,p_user_id,cx,(SELECT to_jsonb(t) FROM public.transacoes_caixa t WHERE id=cx));
 UPDATE public.contratos SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=p_contrato_id AND status IS DISTINCT FROM 'paga' AND NOT public.renovacao_antecessor_transferido(p_user_id,p_contrato_id,id)) THEN 'quitado' ELSE 'ativo' END,"updatedAt"=clock_timestamp() WHERE id=p_contrato_id;
 INSERT INTO public.contrato_historico(user_id,contrato_id,tipo,descricao,valor_anterior,valor_novo)
 VALUES(p_user_id::text,p_contrato_id,'pagamento','Recebimento prospectivo '||op.id::text,p.valor_pago,pago) RETURNING id INTO hi;
 depois:=public.ciclo_snapshot(p_contrato_id);
 UPDATE public.ciclo_estados SET snapshot=depois WHERE contrato_id=p_contrato_id;
 v_resultado:=jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,
  'transacaoCaixaId',cx::text,'contaCaixaId',conta,'valorRecebido',p_valor_recebido::numeric(15,2)::text,
  'totalExigido',p_total_exigido::numeric(15,2)::text,'saldoResidual',residual::numeric(15,2)::text,'valorPagoAcumulado',pago::numeric(15,2)::text,
  'status',CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'contratoStatus',(SELECT status FROM public.contratos WHERE id=p_contrato_id),
  'dataPagamento',p_data_pagamento,'regra','recebimento_defaults_brt_v1');
 UPDATE public.ciclo_operacoes SET resultado=v_resultado,concluida_em=clock_timestamp(),auditoria=jsonb_build_object('hashPayload',hash,'payload',v_payload,'antes',s,'depois',depois,'cotacao',q,'pernaId',cx::text,'historicoId',hi::text,'resultado',v_resultado) WHERE id=op.id;
 DELETE FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid();
 RETURN v_resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.renovacao_antecessor_transferido(integer,integer,integer),public.renovacao_consumir_capacidade(text,text,jsonb,jsonb),public.renovacao_cotacao(integer,integer,integer,timestamptz),public.renovacao_imutavel() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_cotar_renovacao_prospectiva(integer,integer,integer),public.rpc_renovar_emprestimo_prospectivo(integer,uuid,integer,integer,numeric,numeric,date,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cotar_renovacao_prospectiva(integer,integer,integer),public.rpc_renovar_emprestimo_prospectivo(integer,uuid,integer,integer,numeric,numeric,date,text,text) TO service_role;
-- Preserva owner confiável nos objetos NOVOS; substituições retêm owner original.
-- Operador superuser do clone não é adotado como owner financeiro; nenhum GRANT extra.
DO $owners$ DECLARE own text; x record; BEGIN
 SELECT r.rolname INTO STRICT own FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='public.ciclo_guardar()'::regprocedure;
 FOR x IN SELECT oid,relname,relkind FROM pg_class WHERE relnamespace='public'::regnamespace
  AND relname LIKE 'renovacao\_%' ESCAPE '\' AND relkind IN('r','S') ORDER BY relkind DESC LOOP
  EXECUTE format('ALTER %s public.%I OWNER TO %I',CASE WHEN x.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END,x.relname,own);
 END LOOP;
 FOR x IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND (proname LIKE 'renovacao\_%' ESCAPE '\' OR proname IN('rpc_cotar_renovacao_prospectiva','rpc_renovar_emprestimo_prospectivo')) LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO %I',x.oid::regprocedure,own);
 END LOOP;
END $owners$;
-- Pós-DDL: conjunto completo de funções, metadados e hashes de fontes LOCAIS conhecidas.
DO $postflight31$
DECLARE known jsonb := $knownpost31$[{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_user integer, p_despesa integer, p_operacao uuid, p_valor numeric, p_data date, p_descricao text","types":"text, integer, integer, integer, uuid, numeric, date, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"0dde5572cd444d7514201e1585136ba847fd74aefd7ddea0245a2ae25f2cd753"},{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_contrato integer","types":"text, integer, integer","result":"void","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4d0e4fab1cee716b3eca5dbb261f36e47383276b9982dbc2c4629b7917348729"},{"proname":"ciclo_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2014f6ae985ced68bc9f5edb938763b3edbf021d0cde91406fb4746f9dee96ae"},{"proname":"ciclo_encargos","args":"p_original numeric, p_multa numeric, p_mora numeric, p_vencimento date, p_instante timestamp with time zone","types":"numeric, numeric, numeric, date, timestamp with time zone","result":"jsonb","lang":"sql","prosecdef":false,"provolatile":"i","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d3487e4663c8d2a5f917cf1e61a9d00c4314de10e48c5c2db0da40155c227dd1"},{"proname":"ciclo_finalizar_criacao","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"876c462d273e641da7351f56fcd4608939c4c76d7a424d83774f913426974b3b"},{"proname":"ciclo_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"abb1861eeed697f1e011ec3e346169131286fd9b0a0e33ec84be3b13ba859ccc"},{"proname":"ciclo_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"673632820324638377f46d8b4011c35249c59001ff878d03880cb586f728c434"},{"proname":"ciclo_snapshot","args":"p_contrato integer","types":"integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd"},{"proname":"ciclo_validar","args":"p_user integer, p_contrato integer","types":"integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2"},{"proname":"despesas_rpc_executar","args":"p_user_id integer, p_chave_idempotencia uuid, p_tipo text, p_payload jsonb","types":"integer, uuid, text, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"f7315aaa69cd265cdfc1b6adf1cdf29ec7ed6f933de18aef3c8f072046882f1b"},{"proname":"rpc_cotar_emprestimo_prospectivo","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"03f44f5198c9b8360458158aa07dd8961d6a58abfe86efdaacfca76ced6eed31"},{"proname":"rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"5ec9afba4e0fc002b2a35668fb051ddbeb4928b07ce5cbd9193de6ddc2ce0c2f"},{"proname":"rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"da42793f843737e74b52111a9e1db50d15a11f7f5bb1fc23d3257cc4df245d38"},{"proname":"rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"21e8ef83b6e15bf4ea6b95da37d5c53066976398569a54caabc1e8f727b9ce52"},{"proname":"rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"4141fda7c7b4710e9b8d5ad1e89ab6ff6beb1e273ecc59c3ee2ac582dfa942ac"},{"proname":"rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"3d0f95b13f95d3d0cd728c5f02fbee87b18a7131c48097702a9aa3bbea351f77"},{"proname":"renovacao_consumir_capacidade","args":"p_tabela text, p_evento text, p_old jsonb, p_new jsonb","types":"text, text, jsonb, jsonb","result":"boolean","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"f0c947a4a4e32823553a8c9cc98629278f72e55cae80fb1c824c024450916a54"},{"proname":"renovacao_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer, p_instante timestamp with time zone","types":"integer, integer, integer, timestamp with time zone","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"23ba48aab145ba0f40f2c2f15b05d9524beb99aad7da8b309e25a5e22a39c3c2"},{"proname":"rpc_cotar_renovacao_prospectiva","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"3d8cf50980e68153d0d0bc83f835ec775cfe25d9901db3e35eb9948e276399d9"},{"proname":"rpc_renovar_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_cotacao_hash text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"3cca3dbade227ccc08c178430e2484734948a93c63716d051eb17335a14bed4a"},{"proname":"renovacao_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"db76cdf874edeb7eda6837249f32b178b82f515feea9e3731298807c6a569a6c"},{"proname":"renovacao_antecessor_transferido","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"boolean","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"6ffe61ce6b1335a34169196c058a6c93764dcb11cb586da3ebb7b177b4304d7f"}]$knownpost31$::jsonb;
 actual jsonb; names text[]; x record; owner_oid oid; service_oid oid; roles oid[];
BEGIN
 
 SELECT proowner INTO STRICT owner_oid FROM pg_proc WHERE oid='public.ciclo_guardar()'::regprocedure;
 SELECT oid INTO STRICT service_oid FROM pg_roles WHERE rolname='service_role';
 SELECT array_agg(oid) INTO roles FROM pg_roles WHERE rolname IN('anon','authenticated','service_role');
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(known) f;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname=ANY(names) AND (pronamespace<>'public'::regnamespace OR proowner<>owner_oid)) THEN
  RAISE EXCEPTION '31: pós-DDL owner/namespace incompatível' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO actual FROM (
 SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),
 'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,
 'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,
 'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,
 'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),
 'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO known FROM jsonb_array_elements(known) f;
 IF actual IS DISTINCT FROM known THEN RAISE EXCEPTION '31: pós-DDL source/hash/metadados incompatíveis' USING ERRCODE='55000'; END IF;
 FOR x IN SELECT * FROM pg_proc WHERE proname=ANY(names) LOOP
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce(x.proacl,acldefault('f',x.proowner))) a
 WHERE a.grantee<>owner_oid AND NOT(x.proname LIKE 'rpc\_%' ESCAPE '\' AND a.grantee=service_oid AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
 OR (x.proname LIKE 'rpc\_%' ESCAPE '\' AND NOT has_function_privilege(service_oid,x.oid,'EXECUTE'))
 OR EXISTS(SELECT 1 FROM unnest(roles) r WHERE r<>service_oid AND has_function_privilege(r,x.oid,'EXECUTE'))
 OR (x.proname NOT LIKE 'rpc\_%' ESCAPE '\' AND has_function_privilege(service_oid,x.oid,'EXECUTE')) THEN
 RAISE EXCEPTION '31: pós-DDL ACL incompatível: %',x.proname USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR x IN SELECT * FROM pg_class WHERE relname=ANY(ARRAY['renovacao_capacidades','renovacao_operacoes','renovacao_provas']) LOOP
 IF x.relnamespace<>'public'::regnamespace OR x.relowner<>owner_oid OR x.relkind<>'r' OR x.relpersistence<>'p'
 OR NOT x.relrowsecurity OR x.relforcerowsecurity
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(x.relacl,acldefault('r',x.relowner))) a WHERE a.grantee<>owner_oid)
 OR EXISTS(SELECT 1 FROM pg_attribute z,LATERAL aclexplode(z.attacl) a WHERE z.attrelid=x.oid AND a.grantee<>owner_oid)
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=x.oid) THEN
 RAISE EXCEPTION '31: pós-DDL relação privada incompatível: %',x.relname USING ERRCODE='55000'; END IF;
 END LOOP;
END $postflight31$;
DO $application3133$ DECLARE actual jsonb; expected jsonb; BEGIN
 SELECT metadata INTO STRICT expected FROM pg_temp.migration_3133_application;
 SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relnamespace,c.reltype,c.relowner,c.relkind,c.relpersistence,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) ORDER BY c.oid) FROM pg_class c WHERE c.oid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'defaults',(SELECT jsonb_agg(jsonb_build_array(adrelid,adnum,pg_get_expr(adbin,adrelid)) ORDER BY adrelid,adnum) FROM pg_attrdef WHERE adrelid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE conrelid IN(SELECT oid FROM pg_temp.migration_3133_relations) AND NOT(conrelid='public.parcelas'::regclass AND conname='parcelas_status_check')),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM pg_temp.migration_3133_relations) AND NOT tgisinternal),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid IN(SELECT oid FROM pg_temp.migration_3133_relations))
 ) INTO actual;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0031/0033: metadados de relações protegidas mudaram durante DDL' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.migration_3133_relations r WHERE NOT EXISTS(
  SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND relation=r.oid AND mode='AccessExclusiveLock' AND granted)) THEN
  RAISE EXCEPTION '0031/0033: lock de aplicação ausente' USING ERRCODE='55000'; END IF;
 END $application3133$;
DO $environment3133$
DECLARE observed jsonb; expected jsonb;
BEGIN
 SELECT metadata INTO STRICT expected FROM pg_temp.migration_3133_environment;
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
) INTO observed;
 IF observed IS DISTINCT FROM expected THEN
  RAISE EXCEPTION '0031/0033: roles/memberships/schema/extension/language/defaultACL mudou durante instalação' USING ERRCODE='55000';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory'
   AND classid=20261112 AND objid=3133 AND objsubid=2 AND granted AND mode='ExclusiveLock') THEN
  RAISE EXCEPTION '0031/0033: advisory reservado ausente' USING ERRCODE='55000';
 END IF;
END $environment3133$;
COMMIT;
