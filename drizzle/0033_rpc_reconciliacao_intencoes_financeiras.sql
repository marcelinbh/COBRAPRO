-- LOCAL ONLY. Requer revisão/rollout separado; esta tarefa não instala nada em produção.
-- Barreira de UUID, não SELECT ausente: wrappers e reconciliação serializam ANTES
-- dos locks originais. Depois da barreira a ordem 0021/0022/0025 fica intacta.
BEGIN;
-- Janela de manutenção: locks de aplicação drenam writers; DDL externa exige governança exclusiva.
-- Não UPDATE financeiro e não LOCK apenas a função (não cobre CREATE overload).
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
SELECT pg_catalog.pg_advisory_xact_lock(20261107,20);
SELECT pg_catalog.pg_advisory_xact_lock(20261108,25);
SELECT pg_catalog.pg_advisory_xact_lock(20261110,33);
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
LOCK TABLE public.users,public.contas_caixa,public.clientes,public.koletores,
 public.contratos,public.parcelas,public.transacoes_caixa,public.contrato_historico,
 public.contas_pagar,public.emprestimos_rpc_operacoes,public.emprestimos_rpc_origens,
 public.ciclo_estados,public.ciclo_operacoes,public.ciclo_autorizacoes,public.ciclo_pernas,
 public.ciclo_despesas_autorizacoes,public.despesas_rpc_operacoes,
 public.despesas_rpc_origens,public.despesas_rpc_pagamentos IN ACCESS EXCLUSIVE MODE;
DO $preflight0033$
DECLARE expected jsonb; actual jsonb; known jsonb; renewal boolean; x record;
 owner_oid oid; service_oid oid; public_oid oid; names text[]; n text; roles oid[];
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 THEN
  RAISE EXCEPTION '0033: requer PostgreSQL17' USING ERRCODE='55000'; END IF;
 SELECT proowner INTO owner_oid FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ciclo_guardar()');
 IF owner_oid IS NULL OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=owner_oid AND rolname IN(current_user,'postgres'))
  OR (owner_oid<>(SELECT oid FROM pg_roles WHERE rolname=current_user) AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)) THEN
  RAISE EXCEPTION '0033: owner/instalador predecessor incompatível' USING ERRCODE='55000'; END IF;
 SELECT oid INTO public_oid FROM pg_catalog.pg_namespace WHERE nspname='public';
 SELECT array_agg(oid ORDER BY rolname) INTO roles FROM pg_catalog.pg_roles
  WHERE rolname IN('anon','authenticated','service_role');
 SELECT oid INTO service_oid FROM pg_catalog.pg_roles WHERE rolname='service_role';
 IF cardinality(roles) IS DISTINCT FROM 3 OR EXISTS(
  SELECT 1 FROM pg_catalog.pg_roles WHERE oid=ANY(roles) AND
   (rolsuper OR rolcreaterole OR pg_has_role(oid,owner_oid,'MEMBER')))
 THEN RAISE EXCEPTION '0033: roles ausentes/privilegiadas/owner membership' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace s ON s.oid=e.extnamespace
  WHERE e.extname='pgcrypto' AND s.nspname='extensions')
  OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN
  RAISE EXCEPTION '0033: pgcrypto extensions obrigatório' USING ERRCODE='55000'; END IF;
 -- Reserva TODOS os nomes novos em todos os schemas: função, relação e tipo,
 -- incluindo índices/rowtypes automáticos. Nenhum IF NOT EXISTS ou adoção de homônimo.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE
   proname LIKE 'financial\_intent\_%' ESCAPE '\' OR proname='rpc_reconciliar_intencao_financeira')
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE
   relname LIKE 'financial\_intent\_%' ESCAPE '\' OR relname='rpc_reconciliar_intencao_financeira')
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_type WHERE
   typname LIKE 'financial\_intent\_%' ESCAPE '\' OR typname='rpc_reconciliar_intencao_financeira')
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE
   nspname LIKE 'financial\_intent\_%' ESCAPE '\' OR nspname='rpc_reconciliar_intencao_financeira') THEN
  RAISE EXCEPTION '0033: homônimo/reaplicação recusado' USING ERRCODE='55000'; END IF;
-- 0033 SOURCE MANIFEST BEGIN
-- SHA-256 de prosrc (bytes AS delimitados), metadados das DDLs; não do catálogo sob teste.
-- drizzle/0020_rpc_despesas_prospectivas.sql: a6852e4160dcadf21f81029daf231af6d308fab7f8733b3e16769d03923bc452
-- drizzle/0021_rpc_emprestimos_prospectivos.sql: 08b05165412c8f6259db98d70c8d220c6f99c7a3a6bc7866aa86cc00b0558a82
-- drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql: abce663253f85eafe03d3c4f9a81d601941164bba7ef4d0d8024b892be88f64c
-- drizzle/0025_integrar_rpc_despesas_ciclo.sql: 63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199
-- drizzle/0031_rpc_renovacao_juros_prospectiva.sql: f0d0db2cafecd39c7f9ce0296683e66141ee8bbad4243b079b5994244f02db7f
 expected := $known0033${"baseline":[{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_user integer, p_despesa integer, p_operacao uuid, p_valor numeric, p_data date, p_descricao text","types":"text, integer, integer, integer, uuid, numeric, date, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"0dde5572cd444d7514201e1585136ba847fd74aefd7ddea0245a2ae25f2cd753"},{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_contrato integer","types":"text, integer, integer","result":"void","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4d0e4fab1cee716b3eca5dbb261f36e47383276b9982dbc2c4629b7917348729"},{"proname":"ciclo_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2014f6ae985ced68bc9f5edb938763b3edbf021d0cde91406fb4746f9dee96ae"},{"proname":"ciclo_encargos","args":"p_original numeric, p_multa numeric, p_mora numeric, p_vencimento date, p_instante timestamp with time zone","types":"numeric, numeric, numeric, date, timestamp with time zone","result":"jsonb","lang":"sql","prosecdef":false,"provolatile":"i","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d3487e4663c8d2a5f917cf1e61a9d00c4314de10e48c5c2db0da40155c227dd1"},{"proname":"ciclo_finalizar_criacao","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"876c462d273e641da7351f56fcd4608939c4c76d7a424d83774f913426974b3b"},{"proname":"ciclo_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"c2494fc28f08808c4f975800c102af113bc53a0042c3821c916dce17ca233604"},{"proname":"ciclo_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"673632820324638377f46d8b4011c35249c59001ff878d03880cb586f728c434"},{"proname":"ciclo_snapshot","args":"p_contrato integer","types":"integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd"},{"proname":"ciclo_validar","args":"p_user integer, p_contrato integer","types":"integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2"},{"proname":"despesas_rpc_executar","args":"p_user_id integer, p_chave_idempotencia uuid, p_tipo text, p_payload jsonb","types":"integer, uuid, text, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"f7315aaa69cd265cdfc1b6adf1cdf29ec7ed6f933de18aef3c8f072046882f1b"},{"proname":"rpc_cotar_emprestimo_prospectivo","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"03f44f5198c9b8360458158aa07dd8961d6a58abfe86efdaacfca76ced6eed31"},{"proname":"rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"5ec9afba4e0fc002b2a35668fb051ddbeb4928b07ce5cbd9193de6ddc2ce0c2f"},{"proname":"rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"da42793f843737e74b52111a9e1db50d15a11f7f5bb1fc23d3257cc4df245d38"},{"proname":"rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"21e8ef83b6e15bf4ea6b95da37d5c53066976398569a54caabc1e8f727b9ce52"},{"proname":"rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"4141fda7c7b4710e9b8d5ad1e89ab6ff6beb1e273ecc59c3ee2ac582dfa942ac"},{"proname":"rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"59446e73faf55c1dce25c38d833182bd79f15551b1914550d588736773b6bf4f"}],"renewal":[{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_user integer, p_despesa integer, p_operacao uuid, p_valor numeric, p_data date, p_descricao text","types":"text, integer, integer, integer, uuid, numeric, date, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"0dde5572cd444d7514201e1585136ba847fd74aefd7ddea0245a2ae25f2cd753"},{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_contrato integer","types":"text, integer, integer","result":"void","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4d0e4fab1cee716b3eca5dbb261f36e47383276b9982dbc2c4629b7917348729"},{"proname":"ciclo_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2014f6ae985ced68bc9f5edb938763b3edbf021d0cde91406fb4746f9dee96ae"},{"proname":"ciclo_encargos","args":"p_original numeric, p_multa numeric, p_mora numeric, p_vencimento date, p_instante timestamp with time zone","types":"numeric, numeric, numeric, date, timestamp with time zone","result":"jsonb","lang":"sql","prosecdef":false,"provolatile":"i","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d3487e4663c8d2a5f917cf1e61a9d00c4314de10e48c5c2db0da40155c227dd1"},{"proname":"ciclo_finalizar_criacao","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"876c462d273e641da7351f56fcd4608939c4c76d7a424d83774f913426974b3b"},{"proname":"ciclo_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"abb1861eeed697f1e011ec3e346169131286fd9b0a0e33ec84be3b13ba859ccc"},{"proname":"ciclo_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"673632820324638377f46d8b4011c35249c59001ff878d03880cb586f728c434"},{"proname":"ciclo_snapshot","args":"p_contrato integer","types":"integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd"},{"proname":"ciclo_validar","args":"p_user integer, p_contrato integer","types":"integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2"},{"proname":"despesas_rpc_executar","args":"p_user_id integer, p_chave_idempotencia uuid, p_tipo text, p_payload jsonb","types":"integer, uuid, text, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"f7315aaa69cd265cdfc1b6adf1cdf29ec7ed6f933de18aef3c8f072046882f1b"},{"proname":"renovacao_antecessor_transferido","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"boolean","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"6ffe61ce6b1335a34169196c058a6c93764dcb11cb586da3ebb7b177b4304d7f"},{"proname":"renovacao_consumir_capacidade","args":"p_tabela text, p_evento text, p_old jsonb, p_new jsonb","types":"text, text, jsonb, jsonb","result":"boolean","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"f0c947a4a4e32823553a8c9cc98629278f72e55cae80fb1c824c024450916a54"},{"proname":"renovacao_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer, p_instante timestamp with time zone","types":"integer, integer, integer, timestamp with time zone","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"23ba48aab145ba0f40f2c2f15b05d9524beb99aad7da8b309e25a5e22a39c3c2"},{"proname":"renovacao_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"db76cdf874edeb7eda6837249f32b178b82f515feea9e3731298807c6a569a6c"},{"proname":"rpc_cotar_emprestimo_prospectivo","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"03f44f5198c9b8360458158aa07dd8961d6a58abfe86efdaacfca76ced6eed31"},{"proname":"rpc_cotar_renovacao_prospectiva","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"3d8cf50980e68153d0d0bc83f835ec775cfe25d9901db3e35eb9948e276399d9"},{"proname":"rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"5ec9afba4e0fc002b2a35668fb051ddbeb4928b07ce5cbd9193de6ddc2ce0c2f"},{"proname":"rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"da42793f843737e74b52111a9e1db50d15a11f7f5bb1fc23d3257cc4df245d38"},{"proname":"rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"21e8ef83b6e15bf4ea6b95da37d5c53066976398569a54caabc1e8f727b9ce52"},{"proname":"rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"4141fda7c7b4710e9b8d5ad1e89ab6ff6beb1e273ecc59c3ee2ac582dfa942ac"},{"proname":"rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"3d0f95b13f95d3d0cd728c5f02fbee87b18a7131c48097702a9aa3bbea351f77"},{"proname":"rpc_renovar_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_cotacao_hash text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"3cca3dbade227ccc08c178430e2484734948a93c63716d051eb17335a14bed4a"}]}$known0033$::jsonb;
-- 0033 SOURCE MANIFEST END
 -- Perfis ACOPLADOS: 0020/21/22/25; ou esse baseline com as definições 0031
 -- conhecidas já instaladas ANTES33. Não aceita só receive31, só guard31 ou híbrido.
 renewal:=EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE proname LIKE 'renovacao\_%' ESCAPE '\'
  OR proname IN('rpc_cotar_renovacao_prospectiva','rpc_renovar_emprestimo_prospectivo'))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relname LIKE 'renovacao\_%' ESCAPE '\');
 known:=expected->CASE WHEN renewal THEN 'renewal' ELSE 'baseline' END;
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(known) f;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE (proname LIKE 'renovacao\_%' ESCAPE '\'
  OR proname IN('rpc_cotar_renovacao_prospectiva','rpc_renovar_emprestimo_prospectivo')) AND NOT(proname=ANY(names)))
  OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname LIKE 'renovacao\_%' ESCAPE '\') THEN
  RAISE EXCEPTION '0033: objeto de renovação desconhecido/adicional' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE proname=ANY(names)
   AND (pronamespace<>public_oid OR proowner<>owner_oid)) THEN
  RAISE EXCEPTION '0033: schema/owner predecessor incompatível' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO actual FROM (
  SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),
   'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,
   'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,
   'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,
   'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),
   'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)
 ) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO known FROM jsonb_array_elements(known) f;
 IF actual IS DISTINCT FROM known THEN
  RAISE EXCEPTION '0033: corpo/hash/assinatura/language/configuração/overload predecessor incompatível' USING ERRCODE='55000'; END IF;
 FOR x IN SELECT * FROM pg_catalog.pg_proc WHERE proname=ANY(names) LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(x.proacl,pg_catalog.acldefault('f',x.proowner))) a
   WHERE a.grantee<>owner_oid AND NOT(x.proname LIKE 'rpc\_%' ESCAPE '\' AND
    a.grantee=service_oid AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
   OR (x.proname LIKE 'rpc\_%' ESCAPE '\' AND NOT has_function_privilege(service_oid,x.oid,'EXECUTE'))
   OR EXISTS(SELECT 1 FROM unnest(roles) r WHERE r<>service_oid AND has_function_privilege(r,x.oid,'EXECUTE'))
   OR (x.proname NOT LIKE 'rpc\_%' ESCAPE '\' AND has_function_privilege(service_oid,x.oid,'EXECUTE'))
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_depend WHERE classid='pg_proc'::regclass AND objid=x.oid AND deptype='e') THEN
   RAISE EXCEPTION '0033: ACL/capability/dependência predecessora incompatível: %',x.proname USING ERRCODE='55000'; END IF;
 END LOOP;
 -- Capability tables precisam continuar privadas inclusive grants de coluna/policies.
 FOREACH n IN ARRAY ARRAY['ciclo_autorizacoes','ciclo_despesas_autorizacoes','ciclo_estados',
  'ciclo_operacoes','ciclo_pernas','emprestimos_rpc_operacoes','emprestimos_rpc_origens']
  || CASE WHEN renewal THEN ARRAY['renovacao_capacidades','renovacao_operacoes','renovacao_provas'] ELSE ARRAY[]::text[] END LOOP
  IF (SELECT count(*) FROM pg_catalog.pg_class WHERE relname=n)<>1 THEN
   RAISE EXCEPTION '0033: tabela privada ausente/homônima: %',n USING ERRCODE='55000'; END IF;
  SELECT * INTO x FROM pg_catalog.pg_class WHERE relname=n;
  IF x.relnamespace<>public_oid OR x.relowner<>owner_oid OR x.relkind<>'r'
   OR x.relpersistence<>'p' OR NOT x.relrowsecurity OR x.relforcerowsecurity
   OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(x.relacl,pg_catalog.acldefault('r',x.relowner))) a WHERE a.grantee<>owner_oid)
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute z,LATERAL pg_catalog.aclexplode(z.attacl) a WHERE z.attrelid=x.oid AND a.grantee<>owner_oid)
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=x.oid) THEN
   RAISE EXCEPTION '0033: owner/RLS/ACL/policy de tabela privada incompatível: %',n USING ERRCODE='55000'; END IF;
  IF renewal AND n LIKE 'renovacao\_%' ESCAPE '\' THEN
   EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',n);
  END IF;
 END LOOP;
 -- Exatos guards 0022/25 ou 0031: não basta prosrc se trigger foi desligado/reapontado.
 FOR x IN SELECT * FROM (VALUES
  ('contas_caixa','ciclo_conta','ciclo_guardar()',27),
  ('contratos','ciclo_contrato','ciclo_guardar()',27),
  ('parcelas','ciclo_parcela','ciclo_guardar()',31),
  ('transacoes_caixa','ciclo_ledger','ciclo_guardar()',31),
  ('contrato_historico','ciclo_historico','ciclo_guardar()',31),
  ('emprestimos_rpc_operacoes','ciclo_criacao_snapshot','ciclo_finalizar_criacao()',17),
  ('emprestimos_rpc_origens','ciclo_origem_imutavel','ciclo_imutavel()',27),
  ('ciclo_pernas','ciclo_perna_imutavel','ciclo_imutavel()',27),
  ('renovacao_provas','renovacao_prova_imutavel','renovacao_imutavel()',27),
  ('renovacao_operacoes','renovacao_operacao_imutavel','renovacao_imutavel()',27)
 ) v(t,n,f,b) WHERE renewal OR t NOT LIKE 'renovacao\_%' ESCAPE '\' LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=('public.'||x.t)::regclass
   AND tgname=x.n AND tgfoid=to_regprocedure('public.'||x.f) AND tgtype=x.b AND tgenabled='O'
   AND NOT tgisinternal AND tgconstraint=0 AND tgnargs=0 AND tgqual IS NULL AND tgattr=''::int2vector)
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=('public.'||x.t)::regclass AND NOT tgisinternal AND tgname<>x.n) THEN
   RAISE EXCEPTION '0033: guard/trigger incompatível: %',x.t USING ERRCODE='55000'; END IF;
 END LOOP;
END;
$preflight0033$;
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
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE conrelid IN(SELECT oid FROM pg_temp.migration_3133_relations) ),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM pg_temp.migration_3133_relations) AND NOT tgisinternal),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid IN(SELECT oid FROM pg_temp.migration_3133_relations))
 ) AS metadata;
CREATE TABLE public.financial_intent_fences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id integer NOT NULL REFERENCES public.users(id),
 scope text NOT NULL CHECK(scope IN ('emprestimo_criar','emprestimo_receber','despesa')),
 chave uuid NOT NULL, family text NOT NULL, request jsonb NOT NULL, payload_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,scope,chave)
);
ALTER TABLE public.financial_intent_fences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_intent_fences FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.financial_intent_gate(p_user integer,p_key uuid,p_family text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s text:=CASE WHEN p_family LIKE 'despesa_%' THEN 'despesa' ELSE p_family END;
BEGIN
 IF p_user IS NULL OR p_user<=0 OR p_key IS NULL OR s NOT IN ('emprestimo_criar','emprestimo_receber','despesa') THEN
   RAISE EXCEPTION 'Escopo de intenção inválido' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(s||':'||p_user::text||':'||p_key::text,33));
 IF EXISTS(SELECT 1 FROM public.financial_intent_fences WHERE user_id=p_user AND scope=s AND chave=p_key) THEN
   RAISE EXCEPTION 'UUID encerrado autoritativamente sem execução; não reenviar' USING ERRCODE='55000'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.financial_intent_gate(integer,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
-- Preserva corpos, defaults e assinaturas dos wrappers originais; nenhuma fórmula/ledger alterado.
DO $$
DECLARE spec text[]; sig text; family text; old_name text; name text; args text; callargs text; oid0 oid;
BEGIN
 FOREACH spec SLICE 1 IN ARRAY ARRAY[
 ['rpc_criar_emprestimo(integer,uuid,integer,integer,text,text,numeric,numeric,integer,date,date,date[],text,text)','emprestimo_criar'],
 ['rpc_receber_emprestimo_prospectivo(integer,uuid,integer,integer,numeric,numeric,date,text,text,text)','emprestimo_receber'],
 ['rpc_criar_despesa_prospectiva(integer,text,text,numeric,date,text,uuid)','despesa_criar'],
 ['rpc_pagar_despesa_prospectiva(integer,integer,integer,date,uuid)','despesa_pagar'],
 ['rpc_estornar_despesa_prospectiva(integer,integer,uuid,date,text,uuid)','despesa_estornar']
 ] LOOP
  sig:=spec[1]; family:=spec[2]; oid0:=to_regprocedure('public.'||sig);
  IF oid0 IS NULL THEN RAISE EXCEPTION 'RPC pré-requisito ausente: %',sig; END IF;
  SELECT proname,pg_get_function_arguments(oid0),array_to_string(proargnames,',') INTO name,args,callargs FROM pg_proc WHERE oid=oid0;
  old_name:='financial_intent_original_'||name;
  EXECUTE format('ALTER FUNCTION public.%s RENAME TO %I',sig,old_name);
  EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated,service_role',old_name,pg_get_function_identity_arguments(oid0));
  EXECUTE format('CREATE FUNCTION public.%I(%s) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $wrapper$ BEGIN PERFORM public.financial_intent_gate(p_user_id,p_chave_idempotencia,%L); RETURN public.%I(%s); END $wrapper$',name,args,family,old_name,callargs);
  EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC,anon,authenticated',sig);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role',sig);
 END LOOP;
END $$;
CREATE FUNCTION public.rpc_reconciliar_intencao_financeira(p_user_id integer,p_family text,p_chave uuid,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s text:=CASE WHEN p_family LIKE 'despesa_%' THEN 'despesa' ELSE p_family END;
 expected jsonb; actual jsonb; stored_hash text; digest_hash text; result jsonb; op_id uuid; op_type text;
 fence public.financial_intent_fences%ROWTYPE; quote jsonb; account integer; c public.contratos%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave IS NULL OR p_request IS NULL OR jsonb_typeof(p_request)<>'object'
 OR p_family NOT IN ('emprestimo_criar','emprestimo_receber','despesa_criar','despesa_pagar','despesa_estornar') THEN
   RAISE EXCEPTION 'Reconciliação inválida' USING ERRCODE='22023'; END IF;
 -- Mesma primeira barreira dos wrappers. Inclusive POST ainda não iniciado ficará fenced.
 PERFORM pg_advisory_xact_lock(hashtextextended(s||':'||p_user_id::text||':'||p_chave::text,33));
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Owner indisponível' USING ERRCODE='42501'; END IF;
 IF p_family='emprestimo_criar' THEN
  expected:=jsonb_build_object('regra','mensal_simples_v1','userId',p_user_id,'clienteId',(p_request->>'clienteId')::integer,
   'contaCaixaId',(p_request->>'contaCaixaId')::integer,'modalidade',p_request->>'modalidade','tipoTaxa',p_request->>'tipoTaxa',
   'valorPrincipal',(p_request->>'valorPrincipal')::numeric(15,2)::text,'taxaJuros',(p_request->>'taxaJuros')::numeric(5,2)::text,
   'numeroParcelas',(p_request->>'numeroParcelas')::integer,'dataInicio',(p_request->>'dataInicio')::date,
   'dataDesembolso',(p_request->>'dataDesembolso')::date,'vencimentos',p_request->'vencimentos',
   'descricao',nullif(btrim(p_request->>'descricao'),''),'observacoes',nullif(btrim(p_request->>'observacoes'),''),'encargos','defaults_catalogo');
  SELECT payload,hash_payload,resultado,id INTO actual,stored_hash,result,op_id FROM public.emprestimos_rpc_operacoes
   WHERE user_id=p_user_id AND chave_idempotencia=p_chave FOR UPDATE;
 ELSIF p_family='emprestimo_receber' THEN
  expected:=jsonb_build_object('userId',p_user_id,'contratoId',(p_request->>'contratoId')::integer,'parcelaId',(p_request->>'parcelaId')::integer,
   'valorRecebido',(p_request->>'valorRecebido')::numeric(15,2)::text,'totalExigido',(p_request->>'totalExigido')::numeric(15,2)::text,
   'dataPagamento',(p_request->>'dataPagamento')::date,'estadoHash',p_request->>'estadoHash','modo',p_request->>'modo',
   'observacoes',nullif(btrim(p_request->>'observacoes'),''),'regra','recebimento_defaults_brt_v1');
  SELECT payload,hash_payload,resultado,id INTO actual,stored_hash,result,op_id FROM public.ciclo_operacoes
   WHERE user_id=p_user_id AND chave_idempotencia=p_chave FOR UPDATE;
 ELSE
  op_type:=substring(p_family FROM 9);
  IF op_type='criar' THEN
   expected:=jsonb_build_object('descricao',btrim(p_request->>'descricao'),'categoria',coalesce(p_request->>'categoria','outros'),
    'valor',(p_request->>'valor')::numeric(15,2),'dataVencimento',(p_request->>'dataVencimento')::date,'observacoes',p_request->>'observacoes');
  ELSIF op_type='pagar' THEN
   expected:=jsonb_build_object('despesaId',(p_request->>'id')::integer,'contaCaixaId',(p_request->>'contaCaixaId')::integer,'data',(p_request->>'dataPagamento')::date);
  ELSE
   expected:=jsonb_build_object('despesaId',(p_request->>'id')::integer,'pagamentoOperationId',(p_request->>'pagamentoOperationId')::uuid,
    'data',(p_request->>'dataEstorno')::date,'motivo',btrim(p_request->>'motivo'));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_chave::text,20));
  PERFORM id FROM public.users WHERE id=p_user_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owner indisponível' USING ERRCODE='42501'; END IF;
  SELECT payload,encode(hash_payload,'hex'),resultado,id,tipo INTO actual,stored_hash,result,op_id,op_type FROM public.despesas_rpc_operacoes
   WHERE user_id=p_user_id AND chave_idempotencia=p_chave FOR UPDATE;
  IF FOUND AND op_type IS DISTINCT FROM substring(p_family FROM 9) THEN RAISE EXCEPTION 'Ação divergente' USING ERRCODE='23505'; END IF;
 END IF;
 digest_hash:=encode(extensions.digest(CASE WHEN s='despesa' THEN jsonb_build_object('tipo',substring(p_family FROM 9),'userId',p_user_id,'payload',expected)::text ELSE expected::text END,'sha256'),'hex');
 IF actual IS NOT NULL THEN
  IF actual IS DISTINCT FROM expected OR stored_hash IS DISTINCT FROM digest_hash OR result IS NULL OR result->>'success' IS DISTINCT FROM 'true'
   OR result->>'operationId' IS DISTINCT FROM op_id::text THEN RAISE EXCEPTION 'Operação/hash/resultado não comprovados' USING ERRCODE='23514'; END IF;
  RETURN jsonb_build_object('userId',p_user_id,'family',p_family,'idempotencyKey',p_chave,'payload',p_request,'payloadHash',digest_hash,
   'proof','uuid_fenced_v1','status','confirmed','fenceId',NULL,'result',result,'quote',NULL);
 END IF;
 -- Com a primeira barreira exclusiva, ausência + fence durável é prova; ausência isolada NÃO.
 SELECT * INTO fence FROM public.financial_intent_fences WHERE user_id=p_user_id AND scope=s AND chave=p_chave FOR UPDATE;
 IF FOUND THEN
  IF fence.family IS DISTINCT FROM p_family OR fence.request IS DISTINCT FROM p_request OR fence.payload_hash IS DISTINCT FROM digest_hash THEN
   RAISE EXCEPTION 'UUID fenced com payload divergente' USING ERRCODE='23505'; END IF;
 ELSE
  INSERT INTO public.financial_intent_fences(user_id,scope,chave,family,request,payload_hash)
   VALUES(p_user_id,s,p_chave,p_family,p_request,digest_hash) RETURNING * INTO fence;
 END IF;
 IF p_family='emprestimo_receber' THEN
  -- Ordem original 0022 depois da operação: advisory ledger -> conta -> cliente ->
  -- koletor -> contrato NO KEY UPDATE -> parcelas IDs -> ledger IDs. Cotação sob locks.
  SELECT conta_caixa_id INTO account FROM public.contratos WHERE id=(p_request->>'contratoId')::integer AND user_id=p_user_id;
  IF account IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(22022,account);
   PERFORM 1 FROM public.contas_caixa WHERE id=account FOR UPDATE;
   SELECT * INTO c FROM public.contratos WHERE id=(p_request->>'contratoId')::integer;
   PERFORM 1 FROM public.clientes WHERE id=c.cliente_id FOR UPDATE;
   PERFORM 1 FROM public.koletores WHERE id=c.koletor_id FOR UPDATE;
   PERFORM 1 FROM public.contratos WHERE id=c.id FOR NO KEY UPDATE;
   PERFORM 1 FROM public.parcelas WHERE contrato_id=c.id ORDER BY id FOR NO KEY UPDATE;
   PERFORM 1 FROM public.transacoes_caixa WHERE conta_caixa_id=account OR contrato_id=c.id OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=c.id) ORDER BY id FOR UPDATE;
   -- Cotação indisponível não cancela a barreira: não fabricar elegibilidade.
   BEGIN quote:=public.ciclo_cotacao(p_user_id,c.id,(p_request->>'parcelaId')::integer);
   EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '23514' THEN quote:=NULL; END;
  END IF;
 END IF;
 RETURN jsonb_build_object('userId',p_user_id,'family',p_family,'idempotencyKey',p_chave,'payload',p_request,'payloadHash',digest_hash,
  'proof','uuid_fenced_v1','status','not_executed','fenceId',fence.id,'result',NULL,'quote',quote);
END $$;
REVOKE ALL ON FUNCTION public.rpc_reconciliar_intencao_financeira(integer,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reconciliar_intencao_financeira(integer,text,uuid,jsonb) TO service_role;
-- Preserva owner confiável nos objetos NOVOS; substituições retêm owner original.
-- Operador superuser do clone não é adotado como owner financeiro; nenhum GRANT extra.
DO $owners$ DECLARE own text; x record; BEGIN
 SELECT r.rolname INTO STRICT own FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='public.ciclo_guardar()'::regprocedure;
 FOR x IN SELECT oid,relname,relkind FROM pg_class WHERE relnamespace='public'::regnamespace
  AND relname LIKE 'financial\_intent\_%' ESCAPE '\' AND relkind IN('r','S') ORDER BY relkind DESC LOOP
  EXECUTE format('ALTER %s public.%I OWNER TO %I',CASE WHEN x.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END,x.relname,own);
 END LOOP;
 FOR x IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND (proname LIKE 'financial\_intent\_%' ESCAPE '\' OR proname IN('rpc_reconciliar_intencao_financeira','rpc_criar_emprestimo','rpc_receber_emprestimo_prospectivo','rpc_criar_despesa_prospectiva','rpc_pagar_despesa_prospectiva','rpc_estornar_despesa_prospectiva')) LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO %I',x.oid::regprocedure,own);
 END LOOP;
END $owners$;
-- 0033 OPERATIONAL POST BEGIN
-- Pós-DDL: conjunto completo de funções, metadados e hashes de fontes LOCAIS conhecidas.
DO $postflight33$
DECLARE known jsonb := $knownpost33${"baseline":[{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_user integer, p_despesa integer, p_operacao uuid, p_valor numeric, p_data date, p_descricao text","types":"text, integer, integer, integer, uuid, numeric, date, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"0dde5572cd444d7514201e1585136ba847fd74aefd7ddea0245a2ae25f2cd753"},{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_contrato integer","types":"text, integer, integer","result":"void","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4d0e4fab1cee716b3eca5dbb261f36e47383276b9982dbc2c4629b7917348729"},{"proname":"ciclo_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2014f6ae985ced68bc9f5edb938763b3edbf021d0cde91406fb4746f9dee96ae"},{"proname":"ciclo_encargos","args":"p_original numeric, p_multa numeric, p_mora numeric, p_vencimento date, p_instante timestamp with time zone","types":"numeric, numeric, numeric, date, timestamp with time zone","result":"jsonb","lang":"sql","prosecdef":false,"provolatile":"i","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d3487e4663c8d2a5f917cf1e61a9d00c4314de10e48c5c2db0da40155c227dd1"},{"proname":"ciclo_finalizar_criacao","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"876c462d273e641da7351f56fcd4608939c4c76d7a424d83774f913426974b3b"},{"proname":"ciclo_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"c2494fc28f08808c4f975800c102af113bc53a0042c3821c916dce17ca233604"},{"proname":"ciclo_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"673632820324638377f46d8b4011c35249c59001ff878d03880cb586f728c434"},{"proname":"ciclo_snapshot","args":"p_contrato integer","types":"integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd"},{"proname":"ciclo_validar","args":"p_user integer, p_contrato integer","types":"integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2"},{"proname":"despesas_rpc_executar","args":"p_user_id integer, p_chave_idempotencia uuid, p_tipo text, p_payload jsonb","types":"integer, uuid, text, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"f7315aaa69cd265cdfc1b6adf1cdf29ec7ed6f933de18aef3c8f072046882f1b"},{"proname":"rpc_cotar_emprestimo_prospectivo","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"03f44f5198c9b8360458158aa07dd8961d6a58abfe86efdaacfca76ced6eed31"},{"proname":"financial_intent_original_rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"5ec9afba4e0fc002b2a35668fb051ddbeb4928b07ce5cbd9193de6ddc2ce0c2f"},{"proname":"rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"df0019abfb4be9d92080c656fabd7a37b2749e9387cb8a7b2ac8abdf0b54b652"},{"proname":"financial_intent_original_rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"da42793f843737e74b52111a9e1db50d15a11f7f5bb1fc23d3257cc4df245d38"},{"proname":"rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"42080f1559d4ebfa19b32d82b336ae0cb134ac02f791043aa81f863bd4d854cf"},{"proname":"financial_intent_original_rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"21e8ef83b6e15bf4ea6b95da37d5c53066976398569a54caabc1e8f727b9ce52"},{"proname":"rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2cb58a412b65ab18cf113652ced290da8488dcebc4d1b06d0fe9e61ebe5c3944"},{"proname":"financial_intent_original_rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"4141fda7c7b4710e9b8d5ad1e89ab6ff6beb1e273ecc59c3ee2ac582dfa942ac"},{"proname":"rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4e9aa03ddf097445cf9f74e5e224f31671ac9a159a7bcf752db31b5d166f04f3"},{"proname":"financial_intent_original_rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"59446e73faf55c1dce25c38d833182bd79f15551b1914550d588736773b6bf4f"},{"proname":"rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4c66a5d77bce0fe2742d5e2e1bde09f0c126d6260ea7661613a06d0bcba4f090"},{"proname":"financial_intent_gate","args":"p_user integer, p_key uuid, p_family text","types":"integer, uuid, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"54ba8381689dd7f2c38cc63857481628d3e03730a87f925427a6c3afd79a69fd"},{"proname":"rpc_reconciliar_intencao_financeira","args":"p_user_id integer, p_family text, p_chave uuid, p_request jsonb","types":"integer, text, uuid, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"76affd80dafe75b98a91e779f6966217953ff9b984abfa49ac0e9344595f6425"}],"renewal":[{"proname":"despesas_rpc_executar","args":"p_user_id integer, p_chave_idempotencia uuid, p_tipo text, p_payload jsonb","types":"integer, uuid, text, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"f7315aaa69cd265cdfc1b6adf1cdf29ec7ed6f933de18aef3c8f072046882f1b"},{"proname":"financial_intent_original_rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"5ec9afba4e0fc002b2a35668fb051ddbeb4928b07ce5cbd9193de6ddc2ce0c2f"},{"proname":"rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"df0019abfb4be9d92080c656fabd7a37b2749e9387cb8a7b2ac8abdf0b54b652"},{"proname":"financial_intent_original_rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"4141fda7c7b4710e9b8d5ad1e89ab6ff6beb1e273ecc59c3ee2ac582dfa942ac"},{"proname":"rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4e9aa03ddf097445cf9f74e5e224f31671ac9a159a7bcf752db31b5d166f04f3"},{"proname":"financial_intent_original_rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"21e8ef83b6e15bf4ea6b95da37d5c53066976398569a54caabc1e8f727b9ce52"},{"proname":"rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2cb58a412b65ab18cf113652ced290da8488dcebc4d1b06d0fe9e61ebe5c3944"},{"proname":"financial_intent_original_rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"da42793f843737e74b52111a9e1db50d15a11f7f5bb1fc23d3257cc4df245d38"},{"proname":"rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"42080f1559d4ebfa19b32d82b336ae0cb134ac02f791043aa81f863bd4d854cf"},{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_contrato integer","types":"text, integer, integer","result":"void","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4d0e4fab1cee716b3eca5dbb261f36e47383276b9982dbc2c4629b7917348729"},{"proname":"ciclo_snapshot","args":"p_contrato integer","types":"integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd"},{"proname":"ciclo_validar","args":"p_user integer, p_contrato integer","types":"integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2"},{"proname":"ciclo_encargos","args":"p_original numeric, p_multa numeric, p_mora numeric, p_vencimento date, p_instante timestamp with time zone","types":"numeric, numeric, numeric, date, timestamp with time zone","result":"jsonb","lang":"sql","prosecdef":false,"provolatile":"i","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d3487e4663c8d2a5f917cf1e61a9d00c4314de10e48c5c2db0da40155c227dd1"},{"proname":"ciclo_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2014f6ae985ced68bc9f5edb938763b3edbf021d0cde91406fb4746f9dee96ae"},{"proname":"rpc_cotar_emprestimo_prospectivo","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"03f44f5198c9b8360458158aa07dd8961d6a58abfe86efdaacfca76ced6eed31"},{"proname":"financial_intent_original_rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"3d0f95b13f95d3d0cd728c5f02fbee87b18a7131c48097702a9aa3bbea351f77"},{"proname":"rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4c66a5d77bce0fe2742d5e2e1bde09f0c126d6260ea7661613a06d0bcba4f090"},{"proname":"ciclo_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"abb1861eeed697f1e011ec3e346169131286fd9b0a0e33ec84be3b13ba859ccc"},{"proname":"ciclo_finalizar_criacao","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"876c462d273e641da7351f56fcd4608939c4c76d7a424d83774f913426974b3b"},{"proname":"ciclo_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"673632820324638377f46d8b4011c35249c59001ff878d03880cb586f728c434"},{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_user integer, p_despesa integer, p_operacao uuid, p_valor numeric, p_data date, p_descricao text","types":"text, integer, integer, integer, uuid, numeric, date, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"0dde5572cd444d7514201e1585136ba847fd74aefd7ddea0245a2ae25f2cd753"},{"proname":"renovacao_consumir_capacidade","args":"p_tabela text, p_evento text, p_old jsonb, p_new jsonb","types":"text, text, jsonb, jsonb","result":"boolean","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"f0c947a4a4e32823553a8c9cc98629278f72e55cae80fb1c824c024450916a54"},{"proname":"renovacao_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer, p_instante timestamp with time zone","types":"integer, integer, integer, timestamp with time zone","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"23ba48aab145ba0f40f2c2f15b05d9524beb99aad7da8b309e25a5e22a39c3c2"},{"proname":"rpc_cotar_renovacao_prospectiva","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"3d8cf50980e68153d0d0bc83f835ec775cfe25d9901db3e35eb9948e276399d9"},{"proname":"rpc_renovar_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_cotacao_hash text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"3cca3dbade227ccc08c178430e2484734948a93c63716d051eb17335a14bed4a"},{"proname":"renovacao_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"db76cdf874edeb7eda6837249f32b178b82f515feea9e3731298807c6a569a6c"},{"proname":"renovacao_antecessor_transferido","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"boolean","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"6ffe61ce6b1335a34169196c058a6c93764dcb11cb586da3ebb7b177b4304d7f"},{"proname":"financial_intent_gate","args":"p_user integer, p_key uuid, p_family text","types":"integer, uuid, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"54ba8381689dd7f2c38cc63857481628d3e03730a87f925427a6c3afd79a69fd"},{"proname":"rpc_reconciliar_intencao_financeira","args":"p_user_id integer, p_family text, p_chave uuid, p_request jsonb","types":"integer, text, uuid, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"76affd80dafe75b98a91e779f6966217953ff9b984abfa49ac0e9344595f6425"}]}$knownpost33$::jsonb;
 actual jsonb; names text[]; x record; owner_oid oid; service_oid oid; roles oid[];
BEGIN
 known:=known->CASE WHEN to_regprocedure('public.renovacao_imutavel()') IS NOT NULL THEN 'renewal' ELSE 'baseline' END;
 SELECT proowner INTO STRICT owner_oid FROM pg_proc WHERE oid='public.ciclo_guardar()'::regprocedure;
 SELECT oid INTO STRICT service_oid FROM pg_roles WHERE rolname='service_role';
 SELECT array_agg(oid) INTO roles FROM pg_roles WHERE rolname IN('anon','authenticated','service_role');
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(known) f;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname=ANY(names) AND (pronamespace<>'public'::regnamespace OR proowner<>owner_oid)) THEN
  RAISE EXCEPTION '33: pós-DDL owner/namespace incompatível' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO actual FROM (
 SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),
 'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,
 'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,
 'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,
 'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),
 'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO known FROM jsonb_array_elements(known) f;
 IF actual IS DISTINCT FROM known THEN RAISE EXCEPTION '33: pós-DDL source/hash/metadados incompatíveis' USING ERRCODE='55000'; END IF;
 FOR x IN SELECT * FROM pg_proc WHERE proname=ANY(names) LOOP
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce(x.proacl,acldefault('f',x.proowner))) a
 WHERE a.grantee<>owner_oid AND NOT(x.proname LIKE 'rpc\_%' ESCAPE '\' AND a.grantee=service_oid AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
 OR (x.proname LIKE 'rpc\_%' ESCAPE '\' AND NOT has_function_privilege(service_oid,x.oid,'EXECUTE'))
 OR EXISTS(SELECT 1 FROM unnest(roles) r WHERE r<>service_oid AND has_function_privilege(r,x.oid,'EXECUTE'))
 OR (x.proname NOT LIKE 'rpc\_%' ESCAPE '\' AND has_function_privilege(service_oid,x.oid,'EXECUTE')) THEN
 RAISE EXCEPTION '33: pós-DDL ACL incompatível: %',x.proname USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR x IN SELECT * FROM pg_class WHERE relname=ANY(ARRAY['financial_intent_fences']) LOOP
 IF x.relnamespace<>'public'::regnamespace OR x.relowner<>owner_oid OR x.relkind<>'r' OR x.relpersistence<>'p'
 OR NOT x.relrowsecurity OR x.relforcerowsecurity
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(x.relacl,acldefault('r',x.relowner))) a WHERE a.grantee<>owner_oid)
 OR EXISTS(SELECT 1 FROM pg_attribute z,LATERAL aclexplode(z.attacl) a WHERE z.attrelid=x.oid AND a.grantee<>owner_oid)
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=x.oid) THEN
 RAISE EXCEPTION '33: pós-DDL relação privada incompatível: %',x.relname USING ERRCODE='55000'; END IF;
 END LOOP;
END $postflight33$;
DO $application3133$ DECLARE actual jsonb; expected jsonb; BEGIN
 SELECT metadata INTO STRICT expected FROM pg_temp.migration_3133_application;
 SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relnamespace,c.reltype,c.relowner,c.relkind,c.relpersistence,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) ORDER BY c.oid) FROM pg_class c WHERE c.oid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'defaults',(SELECT jsonb_agg(jsonb_build_array(adrelid,adnum,pg_get_expr(adbin,adrelid)) ORDER BY adrelid,adnum) FROM pg_attrdef WHERE adrelid IN(SELECT oid FROM pg_temp.migration_3133_relations)),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE conrelid IN(SELECT oid FROM pg_temp.migration_3133_relations) ),
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
-- 0033 OPERATIONAL POST END
COMMIT;
