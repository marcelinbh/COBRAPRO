-- PROSPECTIVA / LOCAL ONLY. Não adota origem 0021, não altera dados legados.
-- Requer 0020/21/22/25/31/33/34 exatas, PG17 e janela exclusiva de DDL cooperativa.
-- Ajuste documentado: antecessor transferido usa status físico cancelada (0031 reserva
-- renovada exclusivamente à sua origem 0021); resposta/prova multimodal = renovada.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
DO $isolation35$ BEGIN IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION '0035: Read Committed obrigatório' USING ERRCODE='55000'; END IF; END $isolation35$;
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
DO $relations35$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['users','clientes','koletores','contas_caixa','contratos','parcelas','transacoes_caixa','contrato_historico','ciclo_autorizacoes','ciclo_despesas_autorizacoes','emprestimos_rpc_origens','emprestimos_rpc_operacoes','ciclo_estados','ciclo_operacoes','ciclo_pernas','renovacao_capacidades','renovacao_operacoes','renovacao_provas','financial_intent_fences','legados_manifesto','legados_operacoes','legados_auditoria','legados_estados','legados_capacidades'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||n) AND relkind='r') THEN RAISE EXCEPTION '0035: pré-requisito físico ausente %',n USING ERRCODE='55000'; END IF;
 END LOOP;
END $relations35$;
LOCK TABLE public.users,public.clientes,public.koletores,public.contas_caixa,public.contratos,public.parcelas,public.transacoes_caixa,public.contrato_historico,
 public.ciclo_autorizacoes,public.ciclo_despesas_autorizacoes,public.emprestimos_rpc_origens,public.emprestimos_rpc_operacoes,
 public.ciclo_estados,public.ciclo_operacoes,public.ciclo_pernas,public.renovacao_capacidades,public.renovacao_operacoes,public.renovacao_provas,
 public.financial_intent_fences,public.legados_manifesto,public.legados_operacoes,public.legados_auditoria,public.legados_estados,public.legados_capacidades IN ACCESS EXCLUSIVE MODE;
DO $gate35$
DECLARE n text; x record; expected jsonb; actual jsonb; names text[];
 own oid; svc oid; roles oid[];
 session_password text; session_function oid; session_trigger oid;
 -- Fonte VERSIONADA (não extraída do banco): drizzle/0016_revogacao_sessoes_reset_senha.sql
 -- SHA-256 do arquivo: 899156853431a0fa01e3844fa69cd6a1d853c0177cb3fed2a7945392f739ebb6
 -- Template literal entre $body$ da 0016, linhas 109-116; format(%L,%L) seleciona
 -- UMA coluna física. SHA passwordHash=4407ad666c206b34f22ce3ef7d818dbb30160ee165c9893b4379c95bcf5df55c;
 -- password_hash=650241edc2835f40e9005dcf88f7fe16a2ff390a2751d0cef93179ef6b1b77d0.
 session_body text := $session_body35$
    BEGIN
      IF (to_jsonb(OLD) ->> %L) IS DISTINCT FROM (to_jsonb(NEW) ->> %L) THEN
        NEW.session_version := OLD.session_version + 1;
      END IF;
      RETURN NEW;
    END;
    $session_body35$;
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed'
  OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN RAISE EXCEPTION '0035: PG17/read committed/pgcrypto extensions obrigatórios' USING ERRCODE='55000'; END IF;
 SELECT oid INTO own FROM pg_roles WHERE rolname=current_user;
 SELECT proowner INTO svc FROM pg_proc WHERE oid=to_regprocedure('public.ciclo_guardar()');
 IF svc IS DISTINCT FROM own OR current_user IN('service_role','anon','authenticated') THEN RAISE EXCEPTION '0035: instalador deve ser owner confiável predecessor' USING ERRCODE='55000'; END IF;
 SELECT array_agg(oid) INTO roles FROM pg_roles WHERE rolname IN('service_role','anon','authenticated');
 SELECT oid INTO svc FROM pg_roles WHERE rolname='service_role';
 IF cardinality(roles) IS DISTINCT FROM 3 OR EXISTS(SELECT 1 FROM pg_roles WHERE oid=ANY(roles) AND (rolsuper OR rolcreaterole OR pg_has_role(oid,own,'MEMBER'))) THEN RAISE EXCEPTION '0035: roles inseguras' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname LIKE 'multimodal\_%' ESCAPE '\' OR proname IN('rpc_criar_emprestimo_multimodal','rpc_cotar_emprestimo_multimodal','rpc_receber_emprestimo_multimodal','rpc_cotar_renovacao_multimodal','rpc_renovar_emprestimo_multimodal','rpc_reconciliar_multimodal'))
 OR EXISTS(SELECT 1 FROM pg_class WHERE (relname LIKE 'multimodal\_%' ESCAPE '\' OR relname LIKE 'rpc\_%multimodal' ESCAPE '\'))
 OR EXISTS(SELECT 1 FROM pg_type WHERE (typname LIKE 'multimodal\_%' ESCAPE '\' OR typname LIKE 'rpc\_%multimodal' ESCAPE '\'))
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE (nspname LIKE 'multimodal\_%' ESCAPE '\' OR nspname LIKE 'rpc\_%multimodal' ESCAPE '\'))
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname LIKE 'multimodal\_%' ESCAPE '\') THEN RAISE EXCEPTION '0035: homônimo/reaplicação recusado antes DDL' USING ERRCODE='55000'; END IF;
-- MULTIMODAL SOURCE MANIFEST BEGIN
-- drizzle/0020_rpc_despesas_prospectivas.sql: a6852e4160dcadf21f81029daf231af6d308fab7f8733b3e16769d03923bc452
-- drizzle/0021_rpc_emprestimos_prospectivos.sql: 08b05165412c8f6259db98d70c8d220c6f99c7a3a6bc7866aa86cc00b0558a82
-- drizzle/0022_rpc_ciclo_emprestimos_prospectivos.sql: abce663253f85eafe03d3c4f9a81d601941164bba7ef4d0d8024b892be88f64c
-- drizzle/0025_integrar_rpc_despesas_ciclo.sql: 63c5a3afbf86e7dbd67a726368d0dcac04a51c90200f797f1f9d35af10259199
-- drizzle/0031_rpc_renovacao_juros_prospectiva.sql: f0d0db2cafecd39c7f9ce0296683e66141ee8bbad4243b079b5994244f02db7f
-- drizzle/0033_rpc_reconciliacao_intencoes_financeiras.sql: 7ec52905fa260dc6d14af5fabcef74a2a1a7f0fa65874e15d3bd8358cadc5827
-- drizzle/0034_rpc_recebimento_legado_validado.sql: 615d0b81fb1a41b5dd205214ebddc7e32f0d75576022df66905bc90396959ad0
 expected := $known35$[{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_user integer, p_despesa integer, p_operacao uuid, p_valor numeric, p_data date, p_descricao text","types":"text, integer, integer, integer, uuid, numeric, date, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"0dde5572cd444d7514201e1585136ba847fd74aefd7ddea0245a2ae25f2cd753"},{"proname":"ciclo_autorizar","args":"p_acao text, p_conta integer, p_contrato integer","types":"text, integer, integer","result":"void","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4d0e4fab1cee716b3eca5dbb261f36e47383276b9982dbc2c4629b7917348729"},{"proname":"ciclo_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2014f6ae985ced68bc9f5edb938763b3edbf021d0cde91406fb4746f9dee96ae"},{"proname":"ciclo_encargos","args":"p_original numeric, p_multa numeric, p_mora numeric, p_vencimento date, p_instante timestamp with time zone","types":"numeric, numeric, numeric, date, timestamp with time zone","result":"jsonb","lang":"sql","prosecdef":false,"provolatile":"i","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d3487e4663c8d2a5f917cf1e61a9d00c4314de10e48c5c2db0da40155c227dd1"},{"proname":"ciclo_finalizar_criacao","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"876c462d273e641da7351f56fcd4608939c4c76d7a424d83774f913426974b3b"},{"proname":"ciclo_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"abb1861eeed697f1e011ec3e346169131286fd9b0a0e33ec84be3b13ba859ccc"},{"proname":"ciclo_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"673632820324638377f46d8b4011c35249c59001ff878d03880cb586f728c434"},{"proname":"ciclo_snapshot","args":"p_contrato integer","types":"integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd"},{"proname":"ciclo_validar","args":"p_user integer, p_contrato integer","types":"integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"d7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2"},{"proname":"despesas_rpc_executar","args":"p_user_id integer, p_chave_idempotencia uuid, p_tipo text, p_payload jsonb","types":"integer, uuid, text, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"f7315aaa69cd265cdfc1b6adf1cdf29ec7ed6f933de18aef3c8f072046882f1b"},{"proname":"financial_intent_gate","args":"p_user integer, p_key uuid, p_family text","types":"integer, uuid, text","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"54ba8381689dd7f2c38cc63857481628d3e03730a87f925427a6c3afd79a69fd"},{"proname":"financial_intent_original_rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"5ec9afba4e0fc002b2a35668fb051ddbeb4928b07ce5cbd9193de6ddc2ce0c2f"},{"proname":"financial_intent_original_rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"da42793f843737e74b52111a9e1db50d15a11f7f5bb1fc23d3257cc4df245d38"},{"proname":"financial_intent_original_rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"21e8ef83b6e15bf4ea6b95da37d5c53066976398569a54caabc1e8f727b9ce52"},{"proname":"financial_intent_original_rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"4141fda7c7b4710e9b8d5ad1e89ab6ff6beb1e273ecc59c3ee2ac582dfa942ac"},{"proname":"financial_intent_original_rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"3d0f95b13f95d3d0cd728c5f02fbee87b18a7131c48097702a9aa3bbea351f77"},{"proname":"legados_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"59432d3f72c5f657c153fa8ff175112f8c6f9a6b19276a4c35a1a0cf5c3aca30"},{"proname":"legados_identificar_trilho","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"f29e770c46bb920ddc89a8fb1c0f900b3acc5db34581d3f9747a6387ca24b4c4"},{"proname":"legados_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2a03581e2525c9b63f5f988ce8347cf1f073b9f82e3bb06564461c8e4f1a2f64"},{"proname":"legados_metadata","args":"","types":"","result":"text","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"e9a97c94c0c78dcc4f6561aae152cddc501ab6aff7ebe6312c3a7e035e6c5039"},{"proname":"legados_moeda","args":"v numeric","types":"numeric","result":"boolean","lang":"sql","prosecdef":false,"provolatile":"i","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"138548e69af88ca3fd6d0b3d989f8dfe0e2ce21b95c9cfc8600c72fda852dcbe"},{"proname":"legados_operacao_guardar","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"f7a307c293d1f803c6dc8d79d1614d2e32c08bd47385038da4944950301edbeb"},{"proname":"legados_prova_pagamento","args":"p_user_id integer, p_fonte text, p_operacao_id uuid","types":"integer, text, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"s","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC","DateStyle=ISO, YMD"],"body_hash":"6790b53bc41cc87d68780c175a015863e9429f58793445031ab05625ccac3025"},{"proname":"legados_snapshot","args":"cid integer","types":"integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"22c82078375404e314bbcf5b6385e645d4580b6461f8e27ccba85e77191e5755"},{"proname":"legados_travar","args":"uid integer, cid integer, aid integer","types":"integer, integer, integer","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"337b29fbced4efdec5a45f152720e03281e69f2687ab1e4764b05add41f18474"},{"proname":"legados_validar","args":"uid integer, cid integer, pid integer, aid integer","types":"integer, integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"64bc019483871be2162b9706bbd809fa1d75f8ca666fbad618c4dae520b78095"},{"proname":"legados_verificar","args":"","types":"","result":"void","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4bb4925e1a76510f7f2f41a911892c6eb24ce26464c4e19699bbc4cb14bb49c3"},{"proname":"renovacao_antecessor_transferido","args":"p_user integer, p_contrato integer, p_parcela integer","types":"integer, integer, integer","result":"boolean","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"6ffe61ce6b1335a34169196c058a6c93764dcb11cb586da3ebb7b177b4304d7f"},{"proname":"renovacao_consumir_capacidade","args":"p_tabela text, p_evento text, p_old jsonb, p_new jsonb","types":"text, text, jsonb, jsonb","result":"boolean","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"f0c947a4a4e32823553a8c9cc98629278f72e55cae80fb1c824c024450916a54"},{"proname":"renovacao_cotacao","args":"p_user integer, p_contrato integer, p_parcela integer, p_instante timestamp with time zone","types":"integer, integer, integer, timestamp with time zone","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"23ba48aab145ba0f40f2c2f15b05d9524beb99aad7da8b309e25a5e22a39c3c2"},{"proname":"renovacao_imutavel","args":"","types":"","result":"trigger","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"db76cdf874edeb7eda6837249f32b178b82f515feea9e3731298807c6a569a6c"},{"proname":"rpc_cotar_emprestimo_prospectivo","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"03f44f5198c9b8360458158aa07dd8961d6a58abfe86efdaacfca76ced6eed31"},{"proname":"rpc_cotar_recebimento_legado","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer, p_conta_caixa_id integer","types":"integer, integer, integer, integer","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"09cfce480944bd8b476642d17218ed9386c0e267ca1aed448ec6e55f0b53a34c"},{"proname":"rpc_cotar_renovacao_prospectiva","args":"p_user_id integer, p_contrato_id integer, p_parcela_id integer","types":"integer, integer, integer","result":"jsonb","lang":"sql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"3d8cf50980e68153d0d0bc83f835ec775cfe25d9901db3e35eb9948e276399d9"},{"proname":"rpc_criar_despesa_prospectiva","args":"p_user_id integer, p_descricao text, p_categoria text, p_valor numeric, p_data_vencimento date, p_observacoes text, p_chave_idempotencia uuid","types":"integer, text, text, numeric, date, text, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"df0019abfb4be9d92080c656fabd7a37b2749e9387cb8a7b2ac8abdf0b54b652"},{"proname":"rpc_criar_emprestimo","args":"p_user_id integer, p_chave_idempotencia uuid, p_cliente_id integer, p_conta_caixa_id integer, p_modalidade text, p_tipo_taxa text, p_valor_principal numeric, p_taxa_juros numeric, p_numero_parcelas integer, p_data_inicio date, p_data_desembolso date, p_vencimentos date[], p_descricao text, p_observacoes text","types":"integer, uuid, integer, integer, text, text, numeric, numeric, integer, date, date, date[], text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":2,"defaults":"NULL::text, NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"42080f1559d4ebfa19b32d82b336ae0cb134ac02f791043aa81f863bd4d854cf"},{"proname":"rpc_estornar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_pagamento_operation_id uuid, p_data_estorno date, p_motivo text, p_chave_idempotencia uuid","types":"integer, integer, uuid, date, text, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"2cb58a412b65ab18cf113652ced290da8488dcebc4d1b06d0fe9e61ebe5c3944"},{"proname":"rpc_pagar_despesa_prospectiva","args":"p_user_id integer, p_despesa_id integer, p_conta_caixa_id integer, p_data_pagamento date, p_chave_idempotencia uuid","types":"integer, integer, integer, date, uuid","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4e9aa03ddf097445cf9f74e5e224f31671ac9a159a7bcf752db31b5d166f04f3"},{"proname":"rpc_receber_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_modo text, p_observacoes text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"4c66a5d77bce0fe2742d5e2e1bde09f0c126d6260ea7661613a06d0bcba4f090"},{"proname":"rpc_receber_legado","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_conta_caixa_id integer, p_valor_recebido text, p_total_exigido text, p_data_pagamento date, p_estado_hash text, p_regra text, p_observacoes text","types":"integer, uuid, integer, integer, integer, text, text, date, text, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":1,"defaults":"NULL::text","proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"f9444c93ee7c414a1d9f2ffa3b26b4575a2410241f8452d24adbd2f43a420cc7"},{"proname":"rpc_reconciliar_intencao_financeira","args":"p_user_id integer, p_family text, p_chave uuid, p_request jsonb","types":"integer, text, uuid, jsonb","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp"],"body_hash":"76affd80dafe75b98a91e779f6966217953ff9b984abfa49ac0e9344595f6425"},{"proname":"rpc_renovar_emprestimo_prospectivo","args":"p_user_id integer, p_chave_idempotencia uuid, p_contrato_id integer, p_parcela_id integer, p_valor_recebido numeric, p_total_exigido numeric, p_data_pagamento date, p_estado_hash text, p_cotacao_hash text","types":"integer, uuid, integer, integer, numeric, numeric, date, text, text","result":"jsonb","lang":"plpgsql","prosecdef":true,"provolatile":"v","proparallel":"u","proisstrict":false,"proleakproof":false,"prokind":"f","pronargdefaults":0,"defaults":null,"proconfig":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"body_hash":"3cca3dbade227ccc08c178430e2484734948a93c63716d051eb17335a14bed4a"}]$known35$::jsonb;
-- MULTIMODAL SOURCE MANIFEST END
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(expected) f;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname=ANY(names) AND (pronamespace<>'public'::regnamespace OR proowner<>own)) THEN RAISE EXCEPTION '0035: owner/schema predecessor incompatível' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO actual FROM (
 SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),'types',oidvectortypes(p.proargtypes),
 'result',pg_get_function_result(p.oid),'lang',l.lanname,'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,
 'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,'pronargdefaults',p.pronargdefaults,
 'defaults',pg_get_expr(p.proargdefaults,0),'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO expected FROM jsonb_array_elements(expected) f;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '0035: source/assinatura/metadata/overload predecessor incompatível' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE (proname LIKE 'ciclo\_%' ESCAPE '\' OR proname LIKE 'renovacao\_%' ESCAPE '\' OR proname LIKE 'financial\_intent\_%' ESCAPE '\' OR proname LIKE 'legados\_%' ESCAPE '\') AND NOT(proname=ANY(names))) THEN RAISE EXCEPTION '0035: função predecessora extra desconhecida' USING ERRCODE='55000'; END IF;
 FOR x IN SELECT * FROM pg_proc WHERE proname=ANY(names) LOOP
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce(x.proacl,acldefault('f',x.proowner))) a WHERE a.grantee<>own AND NOT(x.proname LIKE 'rpc\_%' ESCAPE '\' OR x.proname IN('legados_prova_pagamento','legados_identificar_trilho')) AND a.grantee=svc)
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(x.proacl,acldefault('f',x.proowner))) a WHERE a.grantee<>own AND NOT(a.grantee=svc AND (x.proname LIKE 'rpc\_%' ESCAPE '\' OR x.proname IN('legados_prova_pagamento','legados_identificar_trilho')) AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
 OR ((x.proname LIKE 'rpc\_%' ESCAPE '\' OR x.proname IN('legados_prova_pagamento','legados_identificar_trilho')) AND NOT has_function_privilege(svc,x.oid,'EXECUTE')) OR EXISTS(SELECT 1 FROM unnest(roles) r WHERE r<>svc AND has_function_privilege(r,x.oid,'EXECUTE')) THEN RAISE EXCEPTION '0035: ACL predecessor incompatível %',x.proname USING ERRCODE='55000'; END IF;
 END LOOP;
 FOREACH n IN ARRAY ARRAY['ciclo_autorizacoes','ciclo_despesas_autorizacoes','ciclo_estados','ciclo_operacoes','ciclo_pernas','emprestimos_rpc_origens','emprestimos_rpc_operacoes','renovacao_capacidades','renovacao_operacoes','renovacao_provas','financial_intent_fences','legados_capacidades','legados_operacoes','legados_estados','legados_auditoria','legados_manifesto'] LOOP
 IF (SELECT count(*) FROM pg_class WHERE relname=n)<>1 THEN RAISE EXCEPTION '0035: tabela privada ausente/homônima %',n USING ERRCODE='55000'; END IF;
 SELECT * INTO x FROM pg_class WHERE relname=n;
 IF x.relowner<>own OR x.relnamespace<>'public'::regnamespace OR x.relkind<>'r' OR NOT x.relrowsecurity OR x.relforcerowsecurity
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(x.relacl,acldefault('r',own))) a WHERE a.grantee<>own)
 OR EXISTS(SELECT 1 FROM pg_attribute z,LATERAL aclexplode(z.attacl) a WHERE z.attrelid=x.oid AND a.grantee<>own)
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=x.oid) THEN RAISE EXCEPTION '0035: tabela privada ACL/RLS/owner %',n USING ERRCODE='55000'; END IF;
 END LOOP;
 -- 0016 é opcional somente quando função E trigger estão ausentes. Nenhum DDL,
 -- adoção de source produtiva, remoção de trigger ou pré-requisito password_resets.
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname='revogar_sessoes_ao_alterar_senha')
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='users_revogar_sessoes_ao_alterar_senha') THEN
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.users'::regclass AND attnum>0 AND NOT attisdropped AND attname IN('passwordHash','password_hash'))<>1 THEN
   RAISE EXCEPTION '0035: coluna física de senha 0016 ausente/ambígua' USING ERRCODE='55000';
  END IF;
  SELECT attname INTO session_password FROM pg_attribute WHERE attrelid='public.users'::regclass AND attnum>0 AND NOT attisdropped AND attname IN('passwordHash','password_hash');
  session_function := to_regprocedure('public.revogar_sessoes_ao_alterar_senha()');
  IF (SELECT count(*) FROM pg_proc WHERE proname='revogar_sessoes_ao_alterar_senha')<>1
  OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=session_function
    AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND l.lanname='plpgsql'
    AND p.prokind='f' AND p.pronargs=0 AND p.prorettype='trigger'::regtype AND NOT p.proretset
    AND p.proallargtypes IS NULL AND p.proargnames IS NULL AND p.provariadic=0 AND p.pronargdefaults=0 AND p.proargdefaults IS NULL
    AND NOT p.prosecdef AND p.provolatile='v' AND p.proparallel='u' AND NOT p.proisstrict AND NOT p.proleakproof
    AND p.proconfig=ARRAY['search_path=pg_catalog, public']::text[]
    AND encode(extensions.digest(p.prosrc,'sha256'),'hex')=encode(extensions.digest(format(session_body,session_password,session_password),'sha256'),'hex')) THEN
   RAISE EXCEPTION '0035: função/source/config/owner/overload 0016 incompatível' USING ERRCODE='55000';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.users'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attname='session_version'
    AND a.atttypid='integer'::regtype AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='0')
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='users_session_version_nonnegative'
    AND contype='c' AND convalidated AND NOT condeferrable AND NOT condeferred AND pg_get_expr(conbin,conrelid)='(session_version >= 0)') THEN
   RAISE EXCEPTION '0035: session_version 0016 incompatível' USING ERRCODE='55000';
  END IF;
  SELECT oid INTO session_trigger FROM pg_trigger WHERE tgrelid='public.users'::regclass AND tgname='users_revogar_sessoes_ao_alterar_senha'
    AND tgfoid=session_function AND tgtype=19 AND tgenabled='O' AND NOT tgisinternal AND tgnargs=0
    AND tgargs=''::bytea AND tgattr=''::int2vector AND tgqual IS NULL AND tgconstraint=0 AND tgparentid=0 AND NOT tgdeferrable AND NOT tginitdeferred;
  IF session_trigger IS NULL OR (SELECT count(*) FROM pg_trigger WHERE tgname='users_revogar_sessoes_ao_alterar_senha' OR tgfoid=session_function)<>1 THEN
   RAISE EXCEPTION '0035: trigger/binding/type/coluna/qual/enabled 0016 incompatível' USING ERRCODE='55000';
  END IF;
 END IF;
 -- Guards legados continuam intocados. Requer exatamente ciclo + protocolo 0034.
 FOREACH n IN ARRAY ARRAY['users','clientes','koletores','contas_caixa','contratos','parcelas','transacoes_caixa','contrato_historico','emprestimos_rpc_origens','emprestimos_rpc_operacoes','ciclo_estados','ciclo_operacoes'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||n) AND tgname='a_legados_protocolo_'||n AND tgfoid=to_regprocedure('public.legados_guardar()') AND tgtype=31 AND tgenabled='O' AND NOT tgisinternal AND tgqual IS NULL AND tgnargs=0) THEN RAISE EXCEPTION '0035: protocolo34 divergente %',n USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR x IN SELECT * FROM (VALUES ('contas_caixa','ciclo_conta','ciclo_guardar()',27),('contratos','ciclo_contrato','ciclo_guardar()',27),('parcelas','ciclo_parcela','ciclo_guardar()',31),('transacoes_caixa','ciclo_ledger','ciclo_guardar()',31),('contrato_historico','ciclo_historico','ciclo_guardar()',31),('emprestimos_rpc_operacoes','ciclo_criacao_snapshot','ciclo_finalizar_criacao()',17),('emprestimos_rpc_origens','ciclo_origem_imutavel','ciclo_imutavel()',27),('ciclo_pernas','ciclo_perna_imutavel','ciclo_imutavel()',27),('renovacao_provas','renovacao_prova_imutavel','renovacao_imutavel()',27),('renovacao_operacoes','renovacao_operacao_imutavel','renovacao_imutavel()',27)) v(t,n,f,b) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||x.t) AND tgname=x.n AND tgfoid=to_regprocedure('public.'||x.f) AND tgtype=x.b AND tgenabled='O' AND NOT tgisinternal AND tgqual IS NULL AND tgnargs=0) THEN RAISE EXCEPTION '0035: trigger predecessor divergente %',x.n USING ERRCODE='55000'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND c.relname IN('users','clientes','koletores','contas_caixa','contratos','parcelas','transacoes_caixa','contrato_historico','emprestimos_rpc_origens','emprestimos_rpc_operacoes','ciclo_estados','ciclo_operacoes') AND NOT t.tgisinternal AND t.oid IS DISTINCT FROM session_trigger AND t.tgname NOT IN('a_legados_protocolo_'||c.relname,'ciclo_conta','ciclo_contrato','ciclo_parcela','ciclo_ledger','ciclo_historico','ciclo_criacao_snapshot','ciclo_origem_imutavel')) THEN RAISE EXCEPTION '0035: trigger extra desconhecido' USING ERRCODE='55000'; END IF;
 -- ROWTYPE MANIFEST BEGIN
 expected := $rows35${"contratos":[[1,"id","integer",true,"serial"],[2,"cliente_id","integer",true,null],[3,"koletor_id","integer",false,null],[4,"modalidade","character varying(30)",true,null],[5,"valor_principal","numeric(15,2)",true,null],[6,"taxa_juros","numeric(5,2)",true,"0"],[7,"num_parcelas","integer",true,"1"],[8,"valor_parcela","numeric(15,2)",true,null],[9,"total_contrato","numeric(15,2)",true,null],[10,"data_inicio","date",true,null],[11,"data_vencimento","date",false,null],[12,"status","character varying(20)",true,"'ativo'::character varying"],[13,"conta_caixa_id","integer",false,null],[14,"observacoes","text",false,null],[15,"createdAt","timestamp with time zone",true,"now()"],[16,"updatedAt","timestamp with time zone",true,"now()"],[17,"tipo_taxa","character varying(20)",false,"'mensal'::character varying"],[18,"numero_parcelas","integer",false,null],[19,"multa_atraso","numeric(8,4)",false,"2.00"],[20,"juros_mora_diario","numeric(8,4)",false,"0.033"],[21,"data_vencimento_primeira","date",false,null],[22,"dia_vencimento","integer",false,null],[23,"descricao","text",false,null],[24,"contrato_origem_id","integer",false,null],[25,"contrato_assinado","boolean",false,"false"],[26,"contrato_url","character varying(500)",false,null],[27,"etiquetas","text",false,null],[28,"user_id","integer",false,null]],"parcelas":[[1,"id","integer",true,"serial"],[2,"contrato_id","integer",true,null],[3,"numero","integer",true,null],[4,"valor","numeric(15,2)",true,null],[5,"data_vencimento","date",true,null],[6,"data_pagamento","date",false,null],[7,"valor_pago","numeric(15,2)",false,null],[8,"status","character varying(20)",true,"'pendente'::character varying"],[9,"conta_caixa_id","integer",false,null],[10,"observacoes","text",false,null],[11,"createdAt","timestamp with time zone",true,"now()"],[12,"updatedAt","timestamp with time zone",true,"now()"],[13,"cliente_id","integer",false,null],[14,"koletor_id","integer",false,null],[15,"numero_parcela","integer",false,null],[16,"valor_original","numeric(15,2)",false,null],[17,"valor_juros","numeric(15,2)",false,"0.00"],[18,"valor_multa","numeric(15,2)",false,"0.00"],[19,"valor_desconto","numeric(15,2)",false,"0.00"],[20,"multa_manual","numeric(15,2)",false,"0.00"],[21,"user_id","integer",false,null],[22,"saldo_residual","numeric(15,2)",true,"0.00"],[23,"multa_diaria_usada","numeric(15,2)",false,"0.00"]],"transacoes_caixa":[[1,"id","integer",true,"serial"],[2,"conta_caixa_id","integer",true,null],[3,"tipo","character varying(10)",true,null],[4,"categoria","character varying(50)",false,null],[5,"descricao","text",true,null],[6,"valor","numeric(15,2)",true,null],[7,"data_transacao","date",true,null],[8,"contrato_id","integer",false,null],[9,"parcela_id","integer",false,null],[10,"createdAt","timestamp with time zone",true,"now()"],[11,"user_id","integer",false,null]],"contrato_historico":[[1,"id","bigint",true,"serial"],[2,"contrato_id","bigint",true,null],[3,"user_id","text",true,null],[4,"tipo","text",true,null],[5,"descricao","text",true,null],[6,"valor_anterior","numeric(12,2)",false,null],[7,"valor_novo","numeric(12,2)",false,null],[8,"created_at","timestamp with time zone",false,"now()"]],"contas_caixa":[[1,"id","integer",true,"serial"],[2,"nome","character varying(255)",true,null],[3,"tipo","character varying(20)",true,"'caixa'::character varying"],[4,"saldo","numeric(15,2)",true,"0"],[5,"ativo","boolean",true,"true"],[6,"createdAt","timestamp with time zone",true,"now()"],[7,"updatedAt","timestamp with time zone",true,"now()"],[8,"user_id","integer",false,null]],"clientes":[[1,"id","integer",true,"serial"],[2,"nome","character varying(255)",true,null],[3,"cpf_cnpj","character varying(20)",false,null],[4,"telefone","character varying(20)",false,null],[5,"whatsapp","character varying(20)",false,null],[6,"email","character varying(320)",false,null],[7,"chave_pix","character varying(255)",false,null],[8,"tipo_chave_pix","character varying(20)",false,null],[9,"endereco","text",false,null],[10,"cidade","character varying(100)",false,null],[11,"estado","character varying(2)",false,null],[12,"cep","character varying(9)",false,null],[13,"observacoes","text",false,null],[14,"score","integer",false,"100"],[15,"foto_url","character varying(500)",false,null],[16,"categoria","character varying(20)",false,"'padrao'::character varying"],[17,"qualificacao","character varying(10)",false,"'bom'::character varying"],[18,"koletor_id","integer",false,null],[19,"banco","character varying(100)",false,null],[20,"agencia","character varying(20)",false,null],[21,"numero_conta","character varying(30)",false,null],[22,"ativo","boolean",true,"true"],[23,"rg","character varying(20)",false,null],[24,"cnpj","character varying(20)",false,null],[25,"instagram","character varying(100)",false,null],[26,"facebook","character varying(255)",false,null],[27,"profissao","character varying(100)",false,null],[28,"numero","character varying(20)",false,null],[29,"complemento","character varying(100)",false,null],[30,"bairro","character varying(100)",false,null],[31,"createdAt","timestamp with time zone",true,"now()"],[32,"updatedAt","timestamp with time zone",true,"now()"],[33,"sexo","character varying(20)",false,null],[34,"estado_civil","character varying(20)",false,null],[35,"nome_mae","character varying(255)",false,null],[36,"nome_pai","character varying(255)",false,null],[37,"data_nascimento","date",false,null],[38,"limite_credito","numeric(15,2)",false,"0"],[39,"limite_disponivel","numeric(15,2)",false,"0"],[40,"documentos_urls","text",false,null],[41,"user_id","integer",false,null],[42,"is_referral","boolean",false,"false"],[43,"tipo_cliente","character varying(50)",false,"'emprestimo'::character varying"]],"koletores":[[1,"id","integer",true,"serial"],[2,"user_id","integer",false,null],[3,"nome","character varying(255)",true,null],[4,"email","character varying(320)",false,null],[5,"telefone","character varying(20)",false,null],[6,"whatsapp","character varying(20)",false,null],[7,"perfil","character varying(20)",true,"'koletor'::character varying"],[8,"comissao_percentual","numeric(5,2)",false,"0"],[9,"ativo","boolean",true,"true"],[10,"observacoes","text",false,null],[11,"createdAt","timestamp with time zone",true,"now()"],[12,"updatedAt","timestamp with time zone",true,"now()"]]}$rows35$::jsonb;
 FOREACH n IN ARRAY ARRAY['contratos','parcelas','transacoes_caixa','contrato_historico','contas_caixa','clientes','koletores'] LOOP
 SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,CASE WHEN pg_get_expr(d.adbin,d.adrelid) LIKE 'nextval(%' THEN 'serial' ELSE pg_get_expr(d.adbin,d.adrelid) END) ORDER BY a.attnum) INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=to_regclass('public.'||n) AND a.attnum>0 AND NOT a.attisdropped;
 IF actual IS DISTINCT FROM expected->n THEN RAISE EXCEPTION '0035: rowtype/default incompatível %',n USING ERRCODE='55000'; END IF;
 END LOOP;
 -- ROWTYPE MANIFEST END
END $gate35$;


CREATE TABLE public.multimodal_operacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id integer NOT NULL REFERENCES public.users(id),
 family text NOT NULL CHECK(family IN('multimodal_criar','multimodal_receber','multimodal_renovar')),
 chave uuid NOT NULL, request jsonb NOT NULL, payload jsonb NOT NULL, hash_payload text NOT NULL CHECK(hash_payload ~ '^[a-f0-9]{64}$'),
 resultado jsonb, auditoria jsonb, concluida_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,family,chave), UNIQUE(user_id,id),
 CHECK((resultado IS NULL AND auditoria IS NULL AND concluida_em IS NULL) OR (resultado IS NOT NULL AND auditoria IS NOT NULL AND concluida_em IS NOT NULL)));
CREATE TABLE public.multimodal_origens(
 contrato_id integer PRIMARY KEY REFERENCES public.contratos(id) ON DELETE RESTRICT,
 user_id integer NOT NULL REFERENCES public.users(id), conta_id integer NOT NULL REFERENCES public.contas_caixa(id),
 cliente_id integer NOT NULL REFERENCES public.clientes(id), koletor_id integer REFERENCES public.koletores(id),
 operacao_id uuid NOT NULL UNIQUE, transacao_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id),
 numero_inicial integer NOT NULL, modalidade text NOT NULL, tipo_taxa text NOT NULL, regra text NOT NULL CHECK(regra='multimodal_v1'),
 FOREIGN KEY(user_id,operacao_id) REFERENCES public.multimodal_operacoes(user_id,id));
CREATE TABLE public.multimodal_estados(
 contrato_id integer PRIMARY KEY REFERENCES public.multimodal_origens(contrato_id), user_id integer NOT NULL,
 operacao_id uuid NOT NULL REFERENCES public.multimodal_operacoes(id), snapshot jsonb NOT NULL, hash_snapshot text NOT NULL);
CREATE TABLE public.multimodal_pernas(
 operacao_id uuid PRIMARY KEY REFERENCES public.multimodal_operacoes(id), transacao_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id), snapshot jsonb NOT NULL);
CREATE TABLE public.multimodal_renovacoes(
 operacao_id uuid PRIMARY KEY REFERENCES public.multimodal_operacoes(id), contrato_id integer NOT NULL REFERENCES public.multimodal_origens(contrato_id),
 anterior_id integer NOT NULL UNIQUE REFERENCES public.parcelas(id), nova_id integer NOT NULL UNIQUE REFERENCES public.parcelas(id),
 principal numeric(15,2) NOT NULL CHECK(principal>0), juros numeric(15,2) NOT NULL CHECK(juros>0),
 multa numeric(15,2) NOT NULL CHECK(multa>=0), mora numeric(15,2) NOT NULL CHECK(mora>=0),
 CHECK(anterior_id<>nova_id));
CREATE TABLE public.multimodal_autorizacoes(
 xid bigint NOT NULL, pid integer NOT NULL, operacao_id uuid NOT NULL REFERENCES public.multimodal_operacoes(id),
 tabela text NOT NULL CHECK(tabela IN('contratos','parcelas','transacoes_caixa','contrato_historico')),
 evento text NOT NULL CHECK(evento IN('INSERT','UPDATE')), anterior jsonb, posterior jsonb NOT NULL,
 PRIMARY KEY(xid,pid));
CREATE TABLE public.multimodal_fences(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id integer NOT NULL REFERENCES public.users(id), family text NOT NULL,
 chave uuid NOT NULL, request jsonb NOT NULL, hash_request text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,family,chave), CHECK(family IN('multimodal_criar','multimodal_receber','multimodal_renovar')));
CREATE TABLE public.multimodal_manifesto(id integer PRIMARY KEY CHECK(id=1), assinatura text NOT NULL);

CREATE FUNCTION public.multimodal_moeda(v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT v IS NOT NULL AND v::text NOT IN('NaN','Infinity','-Infinity') AND v=round(v,2) AND v BETWEEN 0 AND 9999999999.99;
$$;
CREATE FUNCTION public.multimodal_data(p_primeira date,p_modalidade text,p_indice integer) RETURNS date
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT CASE WHEN p_modalidade IN('mensal','tabela_price') THEN
 ((date_trunc('month',p_primeira::timestamp)+make_interval(months=>p_indice))::date +
 (least(extract(day FROM p_primeira)::int,extract(day FROM date_trunc('month',p_primeira::timestamp)+make_interval(months=>p_indice+1)-interval '1 day')::int)-1))
 ELSE p_primeira+p_indice*CASE p_modalidade WHEN 'semanal' THEN 7 WHEN 'quinzenal' THEN 15 WHEN 'diario' THEN 1 END END;
$$;
-- Price em centavos inteiros e razão exata. Sem double precision, power fracionário ou PMT aproximada.
CREATE FUNCTION public.multimodal_calcular(p_modalidade text,p_principal numeric,p_taxa numeric,p_n integer) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE j numeric; tot numeric; ref numeric; jr numeric; vl numeric; jl numeric; saldo numeric; amort numeric;
 a numeric; b numeric:=10000; ap numeric:=1; bp numeric:=1; numer numeric; denom numeric; cents numeric; linhas jsonb:='[]'; i integer;
BEGIN
 IF p_modalidade IS NULL OR p_modalidade NOT IN('mensal','semanal','quinzenal','diario','tabela_price') OR p_n IS NULL OR p_n NOT BETWEEN 1 AND 60
 OR NOT public.multimodal_moeda(p_principal) OR p_principal<=0 OR NOT public.multimodal_moeda(p_taxa) OR p_taxa>999.99 THEN RAISE EXCEPTION 'Cálculo fora da faixa/precisão' USING ERRCODE='22023'; END IF;
 IF p_modalidade='tabela_price' THEN
 a:=10000+p_taxa*100;
 FOR i IN 1..p_n LOOP ap:=ap*a; bp:=bp*b; END LOOP;
 IF p_taxa=0 THEN numer:=p_principal*100; denom:=p_n;
 ELSE numer:=p_principal*100*(a-b)*ap; denom:=b*(ap-bp); END IF;
 -- round(numer/denom) sem divisão NUMERIC arredondada em ponto de empate.
 cents:=div(2*numer+denom,2*denom); ref:=cents/100; saldo:=p_principal; tot:=0; j:=0;
 FOR i IN 1..p_n LOOP
 jl:=round(saldo*p_taxa/100,2); amort:=CASE WHEN i=p_n THEN saldo ELSE ref-jl END;
 vl:=amort+jl;
 IF amort<=0 OR amort>saldo OR vl<=0 THEN RAISE EXCEPTION 'Price com amortização negativa/parcela nula' USING ERRCODE='22023'; END IF;
 linhas:=linhas||jsonb_build_array(jsonb_build_object('valor',vl,'juros',jl,'principal',amort));
 saldo:=saldo-amort; tot:=tot+vl; j:=j+jl;
 END LOOP;
 IF saldo<>0 THEN RAISE EXCEPTION 'Price não fecha principal' USING ERRCODE='23514'; END IF;
 ELSE
 j:=round(p_principal*p_taxa/100*CASE WHEN p_modalidade='diario' THEN 1 ELSE p_n END,2);
 tot:=p_principal+j; ref:=round(tot/p_n,2); jr:=round(j/p_n,2);
 FOR i IN 1..p_n LOOP
 vl:=CASE WHEN i=p_n THEN tot-ref*(p_n-1) ELSE ref END;
 jl:=CASE WHEN i=p_n THEN j-jr*(p_n-1) ELSE jr END;
 IF vl<=0 OR jl<0 OR jl>vl THEN RAISE EXCEPTION 'Rateio com amortização negativa/parcela nula' USING ERRCODE='22023'; END IF;
 linhas:=linhas||jsonb_build_array(jsonb_build_object('valor',vl,'juros',jl,'principal',vl-jl));
 END LOOP;
 END IF;
 IF NOT public.multimodal_moeda(tot) THEN RAISE EXCEPTION 'Total excede NUMERIC(12,2)' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('linhas',linhas,'total',tot,'juros',j,'referencia',ref);
END $$;

CREATE FUNCTION public.multimodal_barreira(p_user integer,p_family text,p_key uuid,p_verificar_fence boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF p_user IS NULL OR p_user<=0 OR p_key IS NULL OR p_family IS NULL OR p_family NOT IN('multimodal_criar','multimodal_receber','multimodal_renovar') THEN RAISE EXCEPTION 'Intenção inválida' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_family||':'||p_user::text||':'||p_key::text,35));
 IF p_verificar_fence AND EXISTS(SELECT 1 FROM public.multimodal_fences WHERE user_id=p_user AND family=p_family AND chave=p_key) THEN RAISE EXCEPTION 'UUID fenced permanentemente' USING ERRCODE='55000'; END IF;
END $$;
CREATE FUNCTION public.multimodal_payload(p_user integer,p_family text,r jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb;
BEGIN
 IF r IS NULL OR jsonb_typeof(r)<>'object' OR r ? 'userId' OR r ? 'p_user_id' OR r ? 'idempotencyKey' THEN RAISE EXCEPTION 'Request original sem user/key obrigatória' USING ERRCODE='22023'; END IF;
 IF p_family='multimodal_criar' THEN
 v:=jsonb_build_object('regra','multimodal_v1','userId',p_user,'clienteId',(r->>'clienteId')::integer,'contaCaixaId',(r->>'contaCaixaId')::integer,
 'modalidade',r->>'modalidade','tipoTaxa',r->>'tipoTaxa','valorPrincipal',(r->>'valorPrincipal')::numeric(15,2)::text,'taxaJuros',(r->>'taxaJuros')::numeric(5,2)::text,
 'numeroParcelas',(r->>'numeroParcelas')::integer,'dataInicio',(r->>'dataInicio')::date,'dataDesembolso',(r->>'dataDesembolso')::date,
 'vencimentos',r->'vencimentos','descricao',nullif(btrim(r->>'descricao'),''),'observacoes',nullif(btrim(r->>'observacoes'),''),
 'multaAtraso',coalesce((r->>'multaAtraso')::numeric,2)::numeric(8,4)::text,'jurosMoraDiario',coalesce((r->>'jurosMoraDiario')::numeric,0.033)::numeric(8,4)::text);
 ELSE
 v:=jsonb_build_object('regra',CASE p_family WHEN 'multimodal_receber' THEN 'recebimento_multimodal_brt_v1' ELSE 'renovacao_multimodal_brt_v1' END,
 'userId',p_user,'contratoId',(r->>'contratoId')::integer,'parcelaId',(r->>'parcelaId')::integer,
 'valorRecebido',(r->>'valorRecebido')::numeric(15,2)::text,'totalExigido',(r->>'totalExigido')::numeric(15,2)::text,
 'dataPagamento',(r->>'dataPagamento')::date,'estadoHash',r->>'estadoHash','observacoes',nullif(btrim(r->>'observacoes'),''));
 IF p_family='multimodal_receber' THEN v:=v||jsonb_build_object('modo',r->>'modo'); ELSE v:=v||jsonb_build_object('novoVencimento',(r->>'novoVencimento')::date); END IF;
 END IF;
 RETURN v;
END $$;
CREATE FUNCTION public.multimodal_reservar(p_user integer,p_family text,p_key uuid,p_request jsonb) RETURNS public.multimodal_operacoes
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v jsonb; h text; o public.multimodal_operacoes%ROWTYPE;
BEGIN
 PERFORM public.multimodal_barreira(p_user,p_family,p_key,true);
 v:=public.multimodal_payload(p_user,p_family,p_request); h:=encode(extensions.digest(v::text,'sha256'),'hex');
 INSERT INTO public.multimodal_operacoes(user_id,family,chave,request,payload,hash_payload) VALUES(p_user,p_family,p_key,p_request,v,h) ON CONFLICT(user_id,family,chave) DO NOTHING;
 SELECT * INTO STRICT o FROM public.multimodal_operacoes WHERE user_id=p_user AND family=p_family AND chave=p_key FOR UPDATE;
 IF o.payload IS DISTINCT FROM v OR o.hash_payload IS DISTINCT FROM h THEN RAISE EXCEPTION 'UUID/payload divergente' USING ERRCODE='23505'; END IF;
 IF o.resultado IS NOT NULL AND (o.auditoria->'resultado' IS DISTINCT FROM o.resultado OR o.auditoria->'payload' IS DISTINCT FROM o.payload OR o.resultado->>'operationId' IS DISTINCT FROM o.id::text OR o.resultado->'success' IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Replay não comprovado' USING ERRCODE='23514'; END IF;
 RETURN o;
END $$;

CREATE TABLE public.multimodal_coexistencia(xid bigint NOT NULL,pid integer NOT NULL,posterior jsonb NOT NULL,PRIMARY KEY(xid,pid));
-- Captura SOMENTE capacidades já emitidas por helpers privados legados, antes que
-- ciclo_guardar as consuma. Não dá GRANT, não confia em GUC nem em pilha/caller flag.
CREATE FUNCTION public.multimodal_ponte() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='ciclo_despesas_autorizacoes' THEN
 INSERT INTO public.multimodal_coexistencia VALUES(NEW.xid,NEW.pid,NEW.esperado);
 ELSIF NEW.tabela='transacoes_caixa' AND NEW.evento='INSERT' THEN
 INSERT INTO public.multimodal_coexistencia VALUES(NEW.xid,NEW.pid,NEW.posterior-'id');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER multimodal_ponte_despesa AFTER INSERT ON public.ciclo_despesas_autorizacoes FOR EACH ROW EXECUTE FUNCTION public.multimodal_ponte();
CREATE TRIGGER multimodal_ponte_renovacao AFTER INSERT ON public.renovacao_capacidades FOR EACH ROW EXECUTE FUNCTION public.multimodal_ponte();

-- A 0034 não fornece posterior na capacidade: reconstruir SOMENTE o INSERT que
-- sua operação privada pendente desta transação determina. Nenhuma origem antiga
-- é fabricada. O guard antigo consome a capacidade; o novo consome a cópia exata.
CREATE FUNCTION public.multimodal_ponte_legados() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op public.legados_operacoes%ROWTYPE; t public.transacoes_caixa%ROWTYPE; n integer;
BEGIN
 PERFORM public.multimodal_verificar();
 IF TG_OP<>'INSERT' OR NEW.etapa IS DISTINCT FROM 'ledger' OR NEW.xid IS DISTINCT FROM txid_current() OR NEW.pid IS DISTINCT FROM pg_backend_pid()
 OR EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=NEW.contrato_id OR contrato_id IN(SELECT contrato_id FROM public.parcelas WHERE id=NEW.parcela_id)) THEN
 RAISE EXCEPTION 'Ponte legado não autoriza cohort/vínculo multimodal' USING ERRCODE='42501'; END IF;
 -- MVCC só torna visíveis as linhas in-progress da própria transação (inclusive
 -- subtransações). Operações pendentes já COMMITADAS não conferem autorização.
 SELECT count(*) INTO n FROM public.legados_operacoes o WHERE o.contrato_id=NEW.contrato_id AND o.parcela_id=NEW.parcela_id AND o.conta_id=NEW.conta_id
 AND o.resultado IS NULL AND o.concluida_em IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress';
 IF n<>1 THEN RAISE EXCEPTION 'Ponte legado exige operação própria pendente única' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT op FROM public.legados_operacoes o WHERE o.contrato_id=NEW.contrato_id AND o.parcela_id=NEW.parcela_id AND o.conta_id=NEW.conta_id
 AND o.resultado IS NULL AND o.concluida_em IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress';
 IF op.hash_payload IS DISTINCT FROM encode(extensions.digest(op.payload::text,'sha256'),'hex')
 OR op.payload->'userId' IS DISTINCT FROM to_jsonb(op.user_id) OR op.payload->'contratoId' IS DISTINCT FROM to_jsonb(NEW.contrato_id)
 OR op.payload->'parcelaId' IS DISTINCT FROM to_jsonb(NEW.parcela_id) OR op.payload->'contaCaixaId' IS DISTINCT FROM to_jsonb(NEW.conta_id)
 OR op.payload->>'regra' IS DISTINCT FROM 'recebimento_legado_sem_recalculo_v1'
 OR coalesce(op.payload->>'totalExigido','') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' OR op.payload->>'totalExigido'='0.00'
 OR op.payload->>'valorRecebido' IS DISTINCT FROM op.payload->>'totalExigido'
 OR coalesce(op.payload->>'estadoHash','') !~ '^[0-9a-f]{64}$' THEN
 RAISE EXCEPTION 'Ponte legado payload privado divergente' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.parcelas p ON p.contrato_id=c.id
 JOIN public.clientes cl ON cl.id=c.cliente_id JOIN public.contas_caixa a ON a.id=NEW.conta_id
 WHERE c.id=NEW.contrato_id AND p.id=NEW.parcela_id AND c.user_id=op.user_id AND p.user_id=op.user_id AND cl.user_id=op.user_id
 AND p.cliente_id=c.cliente_id AND a.user_id=op.user_id AND a.ativo IS TRUE
 AND (c.conta_caixa_id IS NULL OR EXISTS(SELECT 1 FROM public.contas_caixa ac WHERE ac.id=c.conta_caixa_id AND ac.user_id=op.user_id AND ac.ativo IS TRUE))
 AND (p.conta_caixa_id IS NULL OR EXISTS(SELECT 1 FROM public.contas_caixa ac WHERE ac.id=p.conta_caixa_id AND ac.user_id=op.user_id AND ac.ativo IS TRUE))
 AND (c.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores k WHERE k.id=c.koletor_id AND k.user_id=op.user_id))
 AND (p.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores k WHERE k.id=p.koletor_id AND k.user_id=op.user_id))
 AND p.status='paga' AND p.valor=(op.payload->>'totalExigido')::numeric AND p.valor_pago=p.valor AND p.saldo_residual=0
 AND p.data_pagamento IS NOT NULL AND isfinite(p.data_pagamento) AND op.payload->'dataPagamento'=to_jsonb(p.data_pagamento)) THEN
 RAISE EXCEPTION 'Ponte legado vínculo/owner/parcela divergente' USING ERRCODE='42501'; END IF;
 t.user_id:=op.user_id; t.conta_caixa_id:=NEW.conta_id; t.contrato_id:=NEW.contrato_id; t.parcela_id:=NEW.parcela_id;
 t.tipo:='entrada'; t.categoria:='pagamento_parcela'; t.valor:=(op.payload->>'totalExigido')::numeric;
 t.descricao:='Recebimento legado '||op.id::text; t.data_transacao:=(op.payload->>'dataPagamento')::date;
 t."createdAt":=transaction_timestamp(); -- now(), default exato do INSERT preservado da 0034, NÃO clock_timestamp().
 INSERT INTO public.multimodal_coexistencia VALUES(NEW.xid,NEW.pid,to_jsonb(t)-'id');
 RETURN NEW;
END $$;
CREATE TRIGGER multimodal_ponte_legados AFTER INSERT ON public.legados_capacidades FOR EACH ROW WHEN(NEW.etapa='ledger') EXECUTE FUNCTION public.multimodal_ponte_legados();

CREATE FUNCTION public.multimodal_snapshot(cid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT jsonb_build_object('contrato',(SELECT to_jsonb(c) FROM public.contratos c WHERE c.id=cid),
 'parcelas',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.parcelas p WHERE p.contrato_id=cid),'[]'::jsonb),
 'ledger',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.transacoes_caixa t WHERE t.contrato_id=cid OR t.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)),'[]'::jsonb),
 'historico',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.contrato_historico h WHERE h.contrato_id=cid),'[]'::jsonb),
 'origem',(SELECT to_jsonb(o) FROM public.multimodal_origens o WHERE o.contrato_id=cid),
 'renovacoes',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.anterior_id) FROM public.multimodal_renovacoes r WHERE r.contrato_id=cid),'[]'::jsonb));
$$;
CREATE FUNCTION public.multimodal_validar(uid integer,cid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE o public.multimodal_origens%ROWTYPE; e public.multimodal_estados%ROWTYPE; op public.multimodal_operacoes%ROWTYPE; s jsonb;
BEGIN
 SELECT * INTO o FROM public.multimodal_origens WHERE contrato_id=cid;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Origem multimodal indisponível' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT e FROM public.multimodal_estados WHERE contrato_id=cid;
 SELECT * INTO STRICT op FROM public.multimodal_operacoes WHERE id=e.operacao_id;
 s:=public.multimodal_snapshot(cid);
 IF e.user_id IS DISTINCT FROM uid OR e.snapshot IS DISTINCT FROM s OR e.hash_snapshot IS DISTINCT FROM encode(extensions.digest(s::text,'sha256'),'hex')
 OR op.resultado IS NULL OR op.auditoria->'depois' IS DISTINCT FROM s OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado
 OR op.hash_payload IS DISTINCT FROM encode(extensions.digest(op.payload::text,'sha256'),'hex') OR op.auditoria->'payload' IS DISTINCT FROM op.payload
 OR NOT EXISTS(SELECT 1 FROM public.contratos WHERE id=cid AND user_id=uid AND cliente_id=o.cliente_id AND conta_caixa_id=o.conta_id AND koletor_id IS NOT DISTINCT FROM o.koletor_id)
 OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=o.cliente_id AND user_id=uid)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=o.conta_id AND user_id=uid AND ativo)
 OR (o.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=o.koletor_id AND user_id=uid AND ativo))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND (user_id IS DISTINCT FROM uid OR cliente_id IS DISTINCT FROM o.cliente_id OR conta_caixa_id IS DISTINCT FROM o.conta_id OR koletor_id IS DISTINCT FROM o.koletor_id))
 OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE (conta_caixa_id=o.conta_id OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND user_id IS DISTINCT FROM uid)
 OR EXISTS(SELECT 1 FROM public.contrato_historico WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid::text)
 OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid) THEN RAISE EXCEPTION 'Snapshot/proveniência/vínculos multimodais divergentes' USING ERRCODE='23514'; END IF;
 -- Toda perna física íntegra; snapshots não filtram owner NULL ou externo.
 IF EXISTS(SELECT 1 FROM public.multimodal_pernas m JOIN public.multimodal_operacoes p ON p.id=m.operacao_id LEFT JOIN public.transacoes_caixa t ON t.id=m.transacao_id
 WHERE (p.resultado->>'contratoId')::integer=cid OR (p.resultado->>'id')::integer=cid
 GROUP BY m.operacao_id,m.snapshot,t.id HAVING m.snapshot IS DISTINCT FROM to_jsonb(t)) THEN RAISE EXCEPTION 'Perna multimodal divergente' USING ERRCODE='23514'; END IF;
 RETURN s;
END $$;
CREATE FUNCTION public.multimodal_travar(uid integer,cid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.multimodal_origens%ROWTYPE;
BEGIN
 SELECT * INTO o FROM public.multimodal_origens WHERE contrato_id=cid;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Origem indisponível' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(22022,o.conta_id);
 PERFORM pg_advisory_xact_lock(34034,uid);
 PERFORM pg_advisory_xact_lock(34035,cid);
 PERFORM 1 FROM public.contas_caixa WHERE id=o.conta_id FOR UPDATE;
 PERFORM 1 FROM public.clientes WHERE id=o.cliente_id FOR UPDATE;
 PERFORM 1 FROM public.koletores WHERE id=o.koletor_id FOR UPDATE;
 PERFORM 1 FROM public.contratos WHERE id=cid FOR NO KEY UPDATE;
 PERFORM 1 FROM public.parcelas WHERE contrato_id=cid ORDER BY id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.transacoes_caixa WHERE conta_caixa_id=o.conta_id OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid) ORDER BY id FOR UPDATE;
END $$;
CREATE FUNCTION public.multimodal_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a jsonb; b jsonb; cids integer[]; aids integer[]; cid integer; aid integer; protegido boolean; autorizado boolean:=false; cap public.multimodal_autorizacoes%ROWTYPE; j jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN a:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN b:=to_jsonb(NEW); END IF;
 cids:=ARRAY[(a->>'contrato_id')::integer,(b->>'contrato_id')::integer];
 IF TG_TABLE_NAME='contratos' THEN cids:=ARRAY[(a->>'id')::integer,(b->>'id')::integer]; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' THEN cids:=cids||ARRAY(SELECT contrato_id FROM public.parcelas WHERE id IN((a->>'parcela_id')::integer,(b->>'parcela_id')::integer)); END IF;
 aids:=ARRAY[(a->>'conta_caixa_id')::integer,(b->>'conta_caixa_id')::integer]||ARRAY(SELECT conta_id FROM public.multimodal_origens WHERE contrato_id=ANY(cids));
 IF TG_TABLE_NAME='contas_caixa' THEN aids:=ARRAY[(a->>'id')::integer,(b->>'id')::integer]; END IF;
 FOR aid IN SELECT DISTINCT v FROM unnest(aids) v WHERE v IS NOT NULL ORDER BY v LOOP
 IF NOT pg_try_advisory_xact_lock(22022,aid) THEN RAISE EXCEPTION 'Conta concorrente' USING ERRCODE='40001'; END IF;
 END LOOP;
 FOR cid IN SELECT DISTINCT v FROM unnest(cids) v WHERE v IS NOT NULL ORDER BY v LOOP
 IF NOT pg_try_advisory_xact_lock(34035,cid) THEN RAISE EXCEPTION 'Contrato concorrente' USING ERRCODE='40001'; END IF;
 END LOOP;
 IF TG_TABLE_NAME IN('clientes','koletores') AND TG_OP<>'INSERT' AND (TG_OP='DELETE' OR a->'user_id' IS DISTINCT FROM b->'user_id') AND EXISTS(SELECT 1 FROM public.multimodal_origens WHERE (TG_TABLE_NAME='clientes' AND cliente_id=(a->>'id')::integer) OR (TG_TABLE_NAME='koletores' AND koletor_id=(a->>'id')::integer)) THEN RAISE EXCEPTION 'Owner vínculo multimodal imutável' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='contas_caixa' AND TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.multimodal_origens WHERE conta_id=ANY(aids)) AND (TG_OP='DELETE' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR a->'saldo' IS DISTINCT FROM b->'saldo' OR a->'id' IS DISTINCT FROM b->'id') THEN RAISE EXCEPTION 'Conta multimodal imutável' USING ERRCODE='42501'; END IF;
 protegido:=EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=ANY(cids));
 IF TG_TABLE_NAME='transacoes_caixa' THEN protegido:=protegido OR EXISTS(SELECT 1 FROM public.multimodal_origens WHERE conta_id=ANY(aids)); END IF;
 SELECT * INTO cap FROM public.multimodal_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid();
 IF FOUND AND cap.tabela=TG_TABLE_NAME THEN
 IF TG_OP IS DISTINCT FROM cap.evento OR a IS DISTINCT FROM cap.anterior OR b IS DISTINCT FROM cap.posterior THEN RAISE EXCEPTION 'Escrita diferente da capacidade exata' USING ERRCODE='42501'; END IF;
 DELETE FROM public.multimodal_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid(); autorizado:=true;
 END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND NOT autorizado THEN
 -- Ponte exata 0025/0031/0034: só contratos E parcelas físicas NÃO multimodais.
 DELETE FROM public.multimodal_coexistencia WHERE xid=txid_current() AND pid=pg_backend_pid() AND posterior=b-'id' RETURNING posterior INTO j;
 autorizado:=FOUND AND NOT EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=ANY(cids));
 IF NOT autorizado THEN
 autorizado:=EXISTS(SELECT 1 FROM public.ciclo_autorizacoes ca WHERE ca.xid=txid_current() AND ca.pid=pg_backend_pid() AND ca.conta_id=(b->>'conta_caixa_id')::integer
 AND NOT EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=ANY(cids))
 AND ((ca.acao='criar' AND b->>'tipo'='saida' AND b->>'categoria'='emprestimo_liberado' AND b->'parcela_id'='null'::jsonb AND EXISTS(SELECT 1 FROM public.contratos c WHERE c.id=(b->>'contrato_id')::integer AND c.user_id=(b->>'user_id')::integer AND c.valor_principal=(b->>'valor')::numeric AND c.conta_caixa_id=ca.conta_id))
 OR (ca.acao='receber' AND ca.contrato_id=(b->>'contrato_id')::integer AND b->>'tipo'='entrada' AND b->>'categoria'='pagamento_parcela' AND EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=ca.contrato_id AND user_id=(b->>'user_id')::integer))));
 END IF;
 END IF;
 IF protegido AND (TG_OP='DELETE' OR (TG_TABLE_NAME='transacoes_caixa' AND TG_OP<>'INSERT') OR NOT autorizado) AND TG_TABLE_NAME NOT IN('contas_caixa','clientes','koletores') THEN RAISE EXCEPTION 'Cohort/livro multimodal somente RPC privada' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
-- Toda linha financeira é construída INTEIRA antes de DML. Confere depois de todos
-- triggers (inclusive AFTER), antes de snapshot: não certifica corrupção de inserção.
CREATE FUNCTION public.multimodal_escrever(p_op uuid,p_tabela text,p_anterior jsonb,p_posterior jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE cols text; vals text; atual jsonb; cid integer; aid integer; uid integer;
BEGIN
 IF p_tabela NOT IN('contratos','parcelas','transacoes_caixa','contrato_historico') OR p_posterior IS NULL OR NOT EXISTS(SELECT 1 FROM public.multimodal_operacoes WHERE id=p_op AND resultado IS NULL) THEN RAISE EXCEPTION 'Capacidade inválida' USING ERRCODE='42501'; END IF;
 INSERT INTO public.multimodal_autorizacoes VALUES(txid_current(),pg_backend_pid(),p_op,p_tabela,CASE WHEN p_anterior IS NULL THEN 'INSERT' ELSE 'UPDATE' END,p_anterior,p_posterior);
 -- Interop ledger 0022: usa autorização PRÓPRIA antiga somente para liberar o guard
 -- da conta, nunca cria origem/estado antigo. categoria de renovação = pagamento_parcela.
 aid:=(p_posterior->>'conta_caixa_id')::integer; cid:=(p_posterior->>'contrato_id')::integer;
 IF p_tabela='transacoes_caixa' THEN PERFORM public.ciclo_autorizar(CASE WHEN p_posterior->>'tipo'='saida' THEN 'criar' ELSE 'receber' END,aid,cid); END IF;
 IF p_anterior IS NULL THEN
 EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I,$1)).*',p_tabela,p_tabela) USING p_posterior;
 ELSE
 SELECT string_agg(format('%I',attname),',' ORDER BY attnum),string_agg(format('r.%I',attname),',' ORDER BY attnum) INTO cols,vals FROM pg_attribute WHERE attrelid=to_regclass('public.'||p_tabela) AND attnum>0 AND NOT attisdropped;
 EXECUTE format('UPDATE public.%I t SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r) WHERE t.id=($1->>''id'')::bigint',p_tabela,cols,vals,p_tabela) USING p_posterior;
 END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=($1->>''id'')::bigint',p_tabela) INTO atual USING p_posterior;
 IF atual IS DISTINCT FROM p_posterior OR EXISTS(SELECT 1 FROM public.multimodal_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN RAISE EXCEPTION 'Trigger/DML alterou campos esperados; não selar snapshot' USING ERRCODE='23514'; END IF;
 IF p_tabela='transacoes_caixa' THEN DELETE FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid(); END IF;
END $$;
CREATE FUNCTION public.multimodal_selar(p_op uuid,p_cid integer,p_antes jsonb,p_esperado jsonb,p_resultado jsonb,p_extra jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; o public.multimodal_operacoes%ROWTYPE;
BEGIN
 SELECT * INTO STRICT o FROM public.multimodal_operacoes WHERE id=p_op;
 s:=public.multimodal_snapshot(p_cid);
 IF s IS DISTINCT FROM p_esperado THEN RAISE EXCEPTION 'Trilha física diferente do cálculo/transição; não selar' USING ERRCODE='23514'; END IF;
 UPDATE public.multimodal_operacoes SET resultado=p_resultado,concluida_em=clock_timestamp(),auditoria=jsonb_build_object('payload',o.payload,'hashPayload',o.hash_payload,'resultado',p_resultado,'antes',p_antes,'depois',s,'extra',p_extra) WHERE id=p_op;
 INSERT INTO public.multimodal_estados VALUES(p_cid,o.user_id,p_op,s,encode(extensions.digest(s::text,'sha256'),'hex')) ON CONFLICT(contrato_id) DO UPDATE SET operacao_id=excluded.operacao_id,snapshot=excluded.snapshot,hash_snapshot=excluded.hash_snapshot;
 PERFORM public.multimodal_validar(o.user_id,p_cid);
 RETURN p_resultado;
END $$;

CREATE FUNCTION public.multimodal_nova_linha(p_tabela text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE x record; v jsonb; r jsonb:='{}';
BEGIN
 IF p_tabela NOT IN('contratos','parcelas','transacoes_caixa','contrato_historico') THEN RAISE EXCEPTION 'Tabela inválida' USING ERRCODE='42501'; END IF;
 FOR x IN SELECT a.attname,pg_get_expr(d.adbin,d.adrelid) def FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=to_regclass('public.'||p_tabela) AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum LOOP
 IF x.def IS NULL THEN v:='null'::jsonb; ELSE EXECUTE 'SELECT to_jsonb('||x.def||')' INTO v; END IF;
 r:=r||jsonb_build_object(x.attname,v);
 END LOOP;
 RETURN r;
END $$;
CREATE FUNCTION public.rpc_criar_emprestimo_multimodal(
 p_user_id integer,p_chave_idempotencia uuid,p_cliente_id integer,p_conta_caixa_id integer,p_modalidade text,p_tipo_taxa text,
 p_valor_principal numeric,p_taxa_juros numeric,p_numero_parcelas integer,p_data_inicio date,p_data_desembolso date,p_vencimentos date[],
 p_descricao text DEFAULT NULL,p_observacoes text DEFAULT NULL,p_multa_atraso numeric DEFAULT 2,p_juros_mora_diario numeric DEFAULT 0.033)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE req jsonb; op public.multimodal_operacoes%ROWTYPE; calc jsonb; c jsonb; p jsonb; t jsonb; h jsonb; o jsonb; esperado jsonb; result jsonb;
 ps jsonb:='[]'; ids integer[]:='{}'; cid integer; kid integer; i integer; instante timestamptz; hoje date;
BEGIN
 PERFORM public.multimodal_verificar();
 PERFORM public.multimodal_barreira(p_user_id,'multimodal_criar',p_chave_idempotencia,true);
 calc:=public.multimodal_calcular(p_modalidade,p_valor_principal,p_taxa_juros,p_numero_parcelas);
 IF p_cliente_id IS NULL OR p_cliente_id<=0 OR p_conta_caixa_id IS NULL OR p_conta_caixa_id<=0 OR p_tipo_taxa IS DISTINCT FROM (CASE p_modalidade WHEN 'diario' THEN 'diaria' WHEN 'tabela_price' THEN 'mensal' ELSE p_modalidade END)
 OR p_multa_atraso IS NULL OR p_multa_atraso::text IN('NaN','Infinity','-Infinity') OR p_multa_atraso<0 OR p_multa_atraso>9999.9999 OR p_multa_atraso<>round(p_multa_atraso,4)
 OR p_juros_mora_diario IS NULL OR p_juros_mora_diario::text IN('NaN','Infinity','-Infinity') OR p_juros_mora_diario<0 OR p_juros_mora_diario>9999.9999 OR p_juros_mora_diario<>round(p_juros_mora_diario,4)
 OR p_data_inicio IS NULL OR NOT isfinite(p_data_inicio) OR p_data_inicio NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' OR p_data_desembolso IS DISTINCT FROM p_data_inicio
 OR p_vencimentos IS NULL OR array_ndims(p_vencimentos) IS DISTINCT FROM 1 OR array_lower(p_vencimentos,1) IS DISTINCT FROM 1 OR cardinality(p_vencimentos) IS DISTINCT FROM p_numero_parcelas
 OR length(p_descricao)>2000 OR length(p_observacoes)>4000 THEN RAISE EXCEPTION 'Modalidade/taxa/encargos/agenda inválida' USING ERRCODE='22023'; END IF;
 FOR i IN 1..p_numero_parcelas LOOP
 IF p_vencimentos[i] IS NULL OR NOT isfinite(p_vencimentos[i]) OR p_vencimentos[i]<p_data_inicio OR p_vencimentos[i]>DATE '9999-12-31'
 OR p_vencimentos[i] IS DISTINCT FROM public.multimodal_data(p_vencimentos[1],p_modalidade,i-1)
 OR (i>1 AND p_vencimentos[i]<=p_vencimentos[i-1]) THEN RAISE EXCEPTION 'Agenda explícita não corresponde ao período civil ancorado' USING ERRCODE='22023'; END IF;
 END LOOP;
 req:=jsonb_build_object('clienteId',p_cliente_id,'contaCaixaId',p_conta_caixa_id,'modalidade',p_modalidade,'tipoTaxa',p_tipo_taxa,
 'valorPrincipal',p_valor_principal::numeric(15,2)::text,'taxaJuros',p_taxa_juros::numeric(5,2)::text,'numeroParcelas',p_numero_parcelas,
 'dataInicio',p_data_inicio,'dataDesembolso',p_data_desembolso,'vencimentos',to_jsonb(p_vencimentos),'descricao',p_descricao,'observacoes',p_observacoes,
 'multaAtraso',p_multa_atraso::numeric(8,4)::text,'jurosMoraDiario',p_juros_mora_diario::numeric(8,4)::text);
 op:=public.multimodal_reservar(p_user_id,'multimodal_criar',p_chave_idempotencia,req);
 IF op.resultado IS NOT NULL THEN RETURN op.resultado||jsonb_build_object('repetida',true); END IF;
 PERFORM pg_advisory_xact_lock(22022,p_conta_caixa_id);
 PERFORM pg_advisory_xact_lock(34034,p_user_id);
 PERFORM 1 FROM public.contas_caixa WHERE id=p_conta_caixa_id AND user_id=p_user_id AND ativo FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conta indisponível' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.clientes WHERE id=p_cliente_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente indisponível' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE conta_caixa_id=p_conta_caixa_id AND user_id IS DISTINCT FROM p_user_id) THEN RAISE EXCEPTION 'Livro com owner nulo/externo' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.koletores WHERE user_id=p_user_id ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM public.koletores WHERE user_id=p_user_id)>1 OR EXISTS(SELECT 1 FROM public.koletores WHERE user_id=p_user_id AND ativo IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Koletor ambíguo/inativo' USING ERRCODE='23514'; END IF;
 SELECT id INTO kid FROM public.koletores WHERE user_id=p_user_id;
 instante:=clock_timestamp(); hoje:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
 c:=public.multimodal_nova_linha('contratos')||jsonb_build_object('user_id',p_user_id,'cliente_id',p_cliente_id,'koletor_id',kid,
 'modalidade',p_modalidade,'tipo_taxa',p_tipo_taxa,'valor_principal',p_valor_principal,'taxa_juros',p_taxa_juros,'num_parcelas',p_numero_parcelas,'numero_parcelas',p_numero_parcelas,
 'valor_parcela',(calc->>'referencia')::numeric,'total_contrato',(calc->>'total')::numeric,'data_inicio',p_data_inicio,'data_vencimento_primeira',p_vencimentos[1],
 'data_vencimento',p_vencimentos[p_numero_parcelas],'dia_vencimento',extract(day FROM p_vencimentos[1])::integer,'conta_caixa_id',p_conta_caixa_id,
 'descricao',op.payload->>'descricao','observacoes',op.payload->>'observacoes','multa_atraso',p_multa_atraso,'juros_mora_diario',p_juros_mora_diario,
 'status','ativo','createdAt',instante,'updatedAt',instante);
 cid:=(c->>'id')::integer;
 PERFORM public.multimodal_escrever(op.id,'contratos',NULL,c);
 FOR i IN 1..p_numero_parcelas LOOP
 p:=public.multimodal_nova_linha('parcelas')||jsonb_build_object('user_id',p_user_id,'contrato_id',cid,'cliente_id',p_cliente_id,'koletor_id',kid,'conta_caixa_id',p_conta_caixa_id,
 'numero',i,'numero_parcela',i,'valor',(calc->'linhas'->(i-1)->>'valor')::numeric,'valor_original',(calc->'linhas'->(i-1)->>'valor')::numeric,
 'valor_juros',(calc->'linhas'->(i-1)->>'juros')::numeric,'valor_pago',0,'valor_multa',0,'valor_desconto',0,'saldo_residual',0,
 'data_vencimento',p_vencimentos[i],'data_pagamento',NULL,'status',CASE WHEN p_vencimentos[i]<hoje THEN 'atrasada' WHEN p_vencimentos[i]=hoje THEN 'vencendo_hoje' ELSE 'pendente' END,
 'createdAt',instante,'updatedAt',instante);
 PERFORM public.multimodal_escrever(op.id,'parcelas',NULL,p); ps:=ps||jsonb_build_array(p); ids:=array_append(ids,(p->>'id')::integer);
 END LOOP;
 t:=public.multimodal_nova_linha('transacoes_caixa')||jsonb_build_object('user_id',p_user_id,'conta_caixa_id',p_conta_caixa_id,'contrato_id',cid,'parcela_id',NULL,
 'tipo','saida','categoria','emprestimo_liberado','valor',p_valor_principal,'descricao','Criação multimodal '||op.id::text,'data_transacao',p_data_desembolso,'createdAt',instante);
 PERFORM public.multimodal_escrever(op.id,'transacoes_caixa',NULL,t);
 h:=public.multimodal_nova_linha('contrato_historico')||jsonb_build_object('user_id',p_user_id::text,'contrato_id',cid,'tipo','criacao','descricao','Criação multimodal '||op.id::text,'valor_novo',(calc->>'total')::numeric,'created_at',instante);
 PERFORM public.multimodal_escrever(op.id,'contrato_historico',NULL,h);
 INSERT INTO public.multimodal_origens VALUES(cid,p_user_id,p_conta_caixa_id,p_cliente_id,kid,op.id,(t->>'id')::integer,p_numero_parcelas,p_modalidade,p_tipo_taxa,'multimodal_v1') RETURNING to_jsonb(multimodal_origens) INTO o;
 INSERT INTO public.multimodal_pernas VALUES(op.id,(t->>'id')::integer,t);
 esperado:=jsonb_build_object('contrato',c,'parcelas',ps,'ledger',jsonb_build_array(t),'historico',jsonb_build_array(h),'origem',o,'renovacoes','[]'::jsonb);
 result:=jsonb_build_object('success',true,'repetida',false,'id',cid,'operationId',op.id,'parcelasIds',to_jsonb(ids),'transacaoCaixaId',t->>'id',
 'valorParcela',(calc->>'referencia')::numeric(15,2)::text,'totalContrato',(calc->>'total')::numeric(15,2)::text,'jurosTotal',(calc->>'juros')::numeric(15,2)::text,
 'numeroParcelas',p_numero_parcelas,'dataDesembolso',p_data_desembolso,'vencimentos',to_jsonb(p_vencimentos),'status','ativo','regra','multimodal_v1',
 'modalidade',p_modalidade,'tipoTaxa',p_tipo_taxa,'multaAtraso',p_multa_atraso::numeric(8,4)::text,'jurosMoraDiario',p_juros_mora_diario::numeric(8,4)::text);
 RETURN public.multimodal_selar(op.id,cid,NULL,esperado,result,calc);
END $$;

CREATE FUNCTION public.multimodal_cotacao(uid integer,cid integer,pid integer,instante timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; enc jsonb; multa numeric; mora numeric; devido numeric; hoje date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 s:=public.multimodal_validar(uid,cid); SELECT * INTO STRICT c FROM public.contratos WHERE id=cid;
 SELECT * INTO p FROM public.parcelas WHERE id=pid AND contrato_id=cid;
 IF NOT FOUND OR p.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Parcela indisponível' USING ERRCODE='42501'; END IF;
 IF c.status NOT IN('ativo','quitado') THEN RAISE EXCEPTION 'Contrato não elegível' USING ERRCODE='23514'; END IF;
 IF p.status='parcial' THEN multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=p.saldo_residual;
 IF devido<=0 OR p.valor_pago<=0 OR p.valor_original+multa+mora-p.valor_pago<>devido OR p.valor_desconto<>0 THEN RAISE EXCEPTION 'Residual inconsistente' USING ERRCODE='23514'; END IF;
 ELSIF p.status='paga' THEN multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=0;
 ELSIF p.status IN('pendente','atrasada','vencendo_hoje') AND p.valor_pago=0 THEN
 enc:=public.ciclo_encargos(p.valor_original,c.multa_atraso,c.juros_mora_diario,p.data_vencimento,instante);
 multa:=(enc->>'multa')::numeric; mora:=(enc->>'mora')::numeric; devido:=p.valor_original+multa+mora;
 ELSE RAISE EXCEPTION 'Parcela transferida/não elegível' USING ERRCODE='23514'; END IF;
 IF NOT public.multimodal_moeda(devido) OR NOT public.multimodal_moeda(multa) OR NOT public.multimodal_moeda(mora) THEN RAISE EXCEPTION 'Encargos fora da faixa' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('elegivel',devido>0,'contratoId',cid,'parcelaId',pid,'contaCaixaId',c.conta_caixa_id,'totalExigido',devido::numeric(15,2)::text,
 'multa',multa::numeric(15,2)::text,'mora',mora::numeric(15,2)::text,'jurosEmbutidos',p.valor_juros::numeric(15,2)::text,'valorPagoAcumulado',p.valor_pago::numeric(15,2)::text,
 'dataPagamento',hoje,'vencimento',p.data_vencimento,'status',p.status,'estadoHash',encode(extensions.digest(s::text,'sha256'),'hex'),'regra','recebimento_multimodal_brt_v1');
END $$;
CREATE FUNCTION public.rpc_cotar_emprestimo_multimodal(p_user_id integer,p_contrato_id integer,p_parcela_id integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN
 PERFORM public.multimodal_verificar(); PERFORM public.multimodal_travar(p_user_id,p_contrato_id);
 RETURN public.multimodal_cotacao(p_user_id,p_contrato_id,p_parcela_id,clock_timestamp());
END $$;
CREATE FUNCTION public.multimodal_cotacao_renovacao(uid integer,cid integer,pid integer,novo_vencimento date,instante timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE q jsonb; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; o public.multimodal_origens%ROWTYPE; elegivel boolean; total numeric; hoje date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date; pos integer;
BEGIN
 q:=public.multimodal_cotacao(uid,cid,pid,instante);
 SELECT * INTO STRICT c FROM public.contratos WHERE id=cid; SELECT * INTO STRICT p FROM public.parcelas WHERE id=pid;
 SELECT * INTO STRICT o FROM public.multimodal_origens WHERE contrato_id=cid;
 pos:=(SELECT count(*) FROM public.multimodal_renovacoes WHERE contrato_id=cid)+1;
 IF novo_vencimento IS NULL OR NOT isfinite(novo_vencimento) OR novo_vencimento>DATE '9999-12-31' OR novo_vencimento<=p.data_vencimento OR novo_vencimento<hoje
 OR novo_vencimento IS DISTINCT FROM public.multimodal_data(c.data_vencimento_primeira,c.modalidade,pos) THEN RAISE EXCEPTION 'Novo vencimento exige próximo período ancorado, posterior e >= hoje' USING ERRCODE='22023'; END IF;
 elegivel:=o.numero_inicial=1 AND c.modalidade<>'tabela_price' AND c.status='ativo' AND p.status IN('pendente','atrasada','vencendo_hoje')
 AND p.valor_pago=0 AND p.valor_desconto=0 AND p.valor_multa=0 AND p.multa_diaria_usada=0 AND p.multa_manual=0 AND p.saldo_residual=0 AND p.data_pagamento IS NULL
 AND p.valor=p.valor_original AND p.valor_juros>0 AND p.valor_original-p.valor_juros=c.valor_principal
 AND p.valor_juros=round(c.valor_principal*c.taxa_juros/100,2)
 AND p.numero=pos AND p.numero_parcela=pos AND c.num_parcelas=pos AND c.numero_parcelas=pos
 AND c.data_vencimento=p.data_vencimento AND p.data_vencimento=public.multimodal_data(c.data_vencimento_primeira,c.modalidade,pos-1)
 AND (SELECT count(*) FROM public.parcelas WHERE contrato_id=cid)=pos
 AND (SELECT count(*) FROM public.parcelas WHERE contrato_id=cid AND status IN('pendente','atrasada','vencendo_hoje','parcial'))=1
 AND NOT EXISTS(SELECT 1 FROM public.multimodal_operacoes WHERE family='multimodal_receber' AND (payload->>'contratoId')::integer=cid AND resultado IS NOT NULL);
 total:=p.valor_juros+(q->>'multa')::numeric+(q->>'mora')::numeric;
 IF NOT public.multimodal_moeda(total) THEN RAISE EXCEPTION 'Total renovação fora da faixa' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('renovavel',coalesce(elegivel,false),'contratoId',cid,'parcelaId',pid,'contaCaixaId',c.conta_caixa_id,'totalExigido',total::numeric(15,2)::text,
 'juros',p.valor_juros::numeric(15,2)::text,'multa',q->>'multa','mora',q->>'mora','principalPreservado',c.valor_principal::numeric(15,2)::text,
 'dataPagamento',hoje,'novoVencimento',novo_vencimento,'estadoHash',q->>'estadoHash','regra','renovacao_multimodal_brt_v1');
END $$;
CREATE FUNCTION public.rpc_cotar_renovacao_multimodal(p_user_id integer,p_contrato_id integer,p_parcela_id integer,p_novo_vencimento date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN
 PERFORM public.multimodal_verificar(); PERFORM public.multimodal_travar(p_user_id,p_contrato_id);
 RETURN public.multimodal_cotacao_renovacao(p_user_id,p_contrato_id,p_parcela_id,p_novo_vencimento,clock_timestamp());
END $$;

CREATE FUNCTION public.multimodal_mutar(uid integer,chave uuid,cid integer,pid integer,valor numeric,total numeric,dia date,estado text,modo text,novo_venc date,obs text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE family text:=CASE WHEN modo='renovar' THEN 'multimodal_renovar' ELSE 'multimodal_receber' END;
 req jsonb; op public.multimodal_operacoes%ROWTYPE; antes jsonb; esperado jsonb; c jsonb; p jsonb; n jsonb; t jsonb; h jsonb; prova jsonb; q jsonb; result jsonb;
 instante timestamptz; residual numeric; pago numeric; conta integer; cs text;
BEGIN
 PERFORM public.multimodal_verificar(); PERFORM public.multimodal_barreira(uid,family,chave,true);
 IF cid IS NULL OR cid<=0 OR pid IS NULL OR pid<=0 OR NOT public.multimodal_moeda(valor) OR valor<=0 OR NOT public.multimodal_moeda(total) OR total<=0
 OR dia IS NULL OR NOT isfinite(dia) OR dia NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' OR estado IS NULL OR estado !~ '^[a-f0-9]{64}$'
 OR modo IS NULL OR modo NOT IN('integral','parcial','renovar') OR length(obs)>1000 THEN RAISE EXCEPTION 'Intenção inválida: UUID/centavos/modo/DATE/hash' USING ERRCODE='22023'; END IF;
 req:=jsonb_build_object('contratoId',cid,'parcelaId',pid,'valorRecebido',valor::numeric(15,2)::text,'totalExigido',total::numeric(15,2)::text,'dataPagamento',dia,'estadoHash',estado,'observacoes',obs);
 req:=req||CASE WHEN modo='renovar' THEN jsonb_build_object('novoVencimento',novo_venc) ELSE jsonb_build_object('modo',modo) END;
 op:=public.multimodal_reservar(uid,family,chave,req);
 IF op.resultado IS NOT NULL THEN RETURN op.resultado||jsonb_build_object('repetida',true); END IF;
 PERFORM public.multimodal_travar(uid,cid); instante:=clock_timestamp();
 antes:=public.multimodal_validar(uid,cid); esperado:=antes;
 IF modo='renovar' THEN q:=public.multimodal_cotacao_renovacao(uid,cid,pid,novo_venc,instante);
 ELSE q:=public.multimodal_cotacao(uid,cid,pid,instante); END IF;
 IF q->>'estadoHash' IS DISTINCT FROM estado OR (q->>'dataPagamento')::date IS DISTINCT FROM dia OR (q->>'totalExigido')::numeric IS DISTINCT FROM total
 OR (q->(CASE WHEN modo='renovar' THEN 'renovavel' ELSE 'elegivel' END)) IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Cotação/estado/data expirou/divergiu' USING ERRCODE='40001'; END IF;
 IF (modo IN('integral','renovar') AND valor<>total) OR (modo='parcial' AND valor>=total) THEN RAISE EXCEPTION 'Integral/renovação valor exato; parcial positivo menor' USING ERRCODE='22023'; END IF;
 c:=antes->'contrato'; SELECT to_jsonb(x) INTO STRICT p FROM public.parcelas x WHERE id=pid;
 conta:=(c->>'conta_caixa_id')::integer; residual:=total-valor; pago:=(p->>'valor_pago')::numeric+valor;
 IF modo='renovar' THEN residual:=(q->>'principalPreservado')::numeric; END IF;
 p:=p||jsonb_build_object('valor_pago',pago,'valor_multa',(q->>'multa')::numeric,'multa_diaria_usada',(q->>'mora')::numeric,'saldo_residual',residual,
 'valor_desconto',0,'data_pagamento',dia,'status',CASE WHEN modo='renovar' THEN 'cancelada' WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'updatedAt',instante,
 'observacoes',nullif(btrim(obs),''));
 PERFORM public.multimodal_escrever(op.id,'parcelas',(SELECT to_jsonb(x) FROM public.parcelas x WHERE id=pid),p);
 esperado:=jsonb_set(esperado,'{parcelas}',(SELECT jsonb_agg(CASE WHEN (v->>'id')::integer=pid THEN p ELSE v END ORDER BY (v->>'id')::integer) FROM jsonb_array_elements(antes->'parcelas') v));
 IF modo='renovar' THEN
 n:=public.multimodal_nova_linha('parcelas')||jsonb_build_object('user_id',uid,'contrato_id',cid,'cliente_id',(c->>'cliente_id')::integer,'koletor_id',(c->>'koletor_id')::integer,
 'conta_caixa_id',conta,'numero',(p->>'numero')::integer+1,'numero_parcela',(p->>'numero')::integer+1,'valor',(p->>'valor_original')::numeric,'valor_original',(p->>'valor_original')::numeric,
 'valor_juros',(q->>'juros')::numeric,'valor_pago',0,'valor_multa',0,'valor_desconto',0,'saldo_residual',0,'data_vencimento',novo_venc,'data_pagamento',NULL,
 'status',CASE WHEN novo_venc=dia THEN 'vencendo_hoje' ELSE 'pendente' END,'createdAt',instante,'updatedAt',instante);
 PERFORM public.multimodal_escrever(op.id,'parcelas',NULL,n);
 esperado:=jsonb_set(esperado,'{parcelas}',esperado->'parcelas'||jsonb_build_array(n));
 INSERT INTO public.multimodal_renovacoes VALUES(op.id,cid,pid,(n->>'id')::integer,(q->>'principalPreservado')::numeric,(q->>'juros')::numeric,(q->>'multa')::numeric,(q->>'mora')::numeric) RETURNING to_jsonb(multimodal_renovacoes) INTO prova;
 esperado:=jsonb_set(esperado,'{renovacoes}',esperado->'renovacoes'||jsonb_build_array(prova));
 c:=c||jsonb_build_object('num_parcelas',(n->>'numero')::integer,'numero_parcelas',(n->>'numero')::integer,'valor_parcela',(n->>'valor')::numeric,'total_contrato',(n->>'valor')::numeric,
 'data_vencimento',novo_venc,'dia_vencimento',extract(day FROM novo_venc)::integer,'status','ativo','updatedAt',instante); cs:='ativo';
 ELSE
 cs:=CASE WHEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(esperado->'parcelas') v WHERE v->>'status'<>'paga' AND NOT EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE contrato_id=cid AND anterior_id=(v->>'id')::integer)) THEN 'quitado' ELSE 'ativo' END;
 c:=c||jsonb_build_object('status',cs,'updatedAt',instante);
 END IF;
 PERFORM public.multimodal_escrever(op.id,'contratos',antes->'contrato',c); esperado:=jsonb_set(esperado,'{contrato}',c);
 t:=public.multimodal_nova_linha('transacoes_caixa')||jsonb_build_object('user_id',uid,'conta_caixa_id',conta,'contrato_id',cid,'parcela_id',pid,
 'tipo','entrada','categoria','pagamento_parcela','valor',valor,'descricao',CASE WHEN modo='renovar' THEN 'Renovação multimodal ' ELSE 'Recebimento multimodal ' END||op.id::text,'data_transacao',dia,'createdAt',instante);
 PERFORM public.multimodal_escrever(op.id,'transacoes_caixa',NULL,t);
 INSERT INTO public.multimodal_pernas VALUES(op.id,(t->>'id')::integer,t);
 esperado:=jsonb_set(esperado,'{ledger}',esperado->'ledger'||jsonb_build_array(t));
 h:=public.multimodal_nova_linha('contrato_historico')||jsonb_build_object('user_id',uid::text,'contrato_id',cid,'tipo',CASE WHEN modo='renovar' THEN 'renovacao' ELSE 'pagamento' END,
 'descricao',CASE WHEN modo='renovar' THEN 'Renovação multimodal ' ELSE 'Recebimento multimodal ' END||op.id::text,'valor_anterior',pago-valor,'valor_novo',pago,'created_at',instante);
 PERFORM public.multimodal_escrever(op.id,'contrato_historico',NULL,h); esperado:=jsonb_set(esperado,'{historico}',esperado->'historico'||jsonb_build_array(h));
 IF modo='renovar' THEN
 result:=jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'contratoId',cid,'parcelaId',pid,'novaParcelaId',(n->>'id')::integer,'transacaoCaixaId',t->>'id','contaCaixaId',conta,
 'valorRecebido',valor::numeric(15,2)::text,'dataPagamento',dia,'novoVencimento',novo_venc,'contratoStatus','ativo','status','renovada','regra','renovacao_multimodal_brt_v1');
 ELSE
 result:=jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'contratoId',cid,'parcelaId',pid,'transacaoCaixaId',t->>'id','contaCaixaId',conta,
 'valorRecebido',valor::numeric(15,2)::text,'totalExigido',total::numeric(15,2)::text,'saldoResidual',residual::numeric(15,2)::text,'valorPagoAcumulado',pago::numeric(15,2)::text,
 'dataPagamento',dia,'status',CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'contratoStatus',cs,'regra','recebimento_multimodal_brt_v1');
 END IF;
 IF (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date IS DISTINCT FROM dia THEN RAISE EXCEPTION 'Virada civil durante escrita' USING ERRCODE='40001'; END IF;
 RETURN public.multimodal_selar(op.id,cid,antes,esperado,result,q);
END $$;
CREATE FUNCTION public.rpc_receber_emprestimo_multimodal(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_parcela_id integer,
 p_valor_recebido numeric,p_total_exigido numeric,p_data_pagamento date,p_estado_hash text,p_modo text,p_observacoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF p_modo IS NULL OR p_modo NOT IN('integral','parcial') THEN RAISE EXCEPTION 'Modo recebimento inválido' USING ERRCODE='22023'; END IF;
 RETURN public.multimodal_mutar(p_user_id,p_chave_idempotencia,p_contrato_id,p_parcela_id,p_valor_recebido,p_total_exigido,p_data_pagamento,p_estado_hash,p_modo,NULL,p_observacoes);
END $$;
CREATE FUNCTION public.rpc_renovar_emprestimo_multimodal(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_parcela_id integer,
 p_valor_recebido numeric,p_total_exigido numeric,p_data_pagamento date,p_estado_hash text,p_novo_vencimento date,p_observacoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT public.multimodal_mutar(p_user_id,p_chave_idempotencia,p_contrato_id,p_parcela_id,p_valor_recebido,p_total_exigido,p_data_pagamento,p_estado_hash,'renovar',p_novo_vencimento,p_observacoes);
$$;
CREATE FUNCTION public.rpc_reconciliar_multimodal(p_user_id integer,p_family text,p_chave uuid,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE op public.multimodal_operacoes%ROWTYPE; f public.multimodal_fences%ROWTYPE; payload jsonb; h text;
BEGIN
 PERFORM public.multimodal_verificar(); PERFORM public.multimodal_barreira(p_user_id,p_family,p_chave,false);
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Owner indisponível' USING ERRCODE='42501'; END IF;
 payload:=public.multimodal_payload(p_user_id,p_family,p_request);
 -- O hash público é do request ORIGINAL sem user, não do payload normalizado SQL.
 h:=encode(extensions.digest(p_request::text,'sha256'),'hex');
 SELECT * INTO op FROM public.multimodal_operacoes WHERE user_id=p_user_id AND family=p_family AND chave=p_chave FOR UPDATE;
 IF FOUND THEN
 IF op.payload IS DISTINCT FROM payload OR op.hash_payload IS DISTINCT FROM encode(extensions.digest(payload::text,'sha256'),'hex') OR op.resultado IS NULL
 OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado OR op.auditoria->'payload' IS DISTINCT FROM op.payload OR op.resultado->>'operationId' IS DISTINCT FROM op.id::text OR op.resultado->'success' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Operação/hash/resultado não comprovado' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('userId',p_user_id,'family',p_family,'idempotencyKey',p_chave,'payload',p_request,'payloadHash',h,'proof','uuid_fenced_v1','status','confirmed','fenceId',NULL,'result',op.resultado,'quote',NULL);
 END IF;
 SELECT * INTO f FROM public.multimodal_fences WHERE user_id=p_user_id AND family=p_family AND chave=p_chave FOR UPDATE;
 IF FOUND THEN
 IF f.request IS DISTINCT FROM p_request OR f.hash_request IS DISTINCT FROM h THEN RAISE EXCEPTION 'UUID fenced request divergente' USING ERRCODE='23505'; END IF;
 ELSE INSERT INTO public.multimodal_fences(user_id,family,chave,request,hash_request) VALUES(p_user_id,p_family,p_chave,p_request,h) RETURNING * INTO f; END IF;
 RETURN jsonb_build_object('userId',p_user_id,'family',p_family,'idempotencyKey',p_chave,'payload',p_request,'payloadHash',h,'proof','uuid_fenced_v1','status','not_executed','fenceId',f.id,'result',NULL,'quote',NULL);
END $$;
CREATE FUNCTION public.rpc_identificar_emprestimo_multimodal(p_user_id integer,p_contrato_id integer,p_parcela_id integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s text; own integer;
BEGIN
 PERFORM public.multimodal_verificar();
 IF p_user_id IS NULL OR p_user_id<=0 OR p_contrato_id IS NULL OR p_parcela_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.parcelas p ON p.contrato_id=c.id WHERE c.id=p_contrato_id AND p.id=p_parcela_id AND c.user_id=p_user_id AND p.user_id=p_user_id) THEN RAISE EXCEPTION 'Registro indisponível' USING ERRCODE='42501'; END IF;
 SELECT user_id INTO own FROM public.multimodal_origens WHERE contrato_id=p_contrato_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF own IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Origem divergente' USING ERRCODE='42501'; END IF;
 PERFORM public.multimodal_travar(p_user_id,p_contrato_id); PERFORM public.multimodal_validar(p_user_id,p_contrato_id);
 SELECT status INTO s FROM public.parcelas WHERE id=p_parcela_id;
 IF EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE contrato_id=p_contrato_id AND anterior_id=p_parcela_id) THEN s:='renovada'; END IF;
 RETURN jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,'trilho','multimodal','status',s);
END $$;
CREATE FUNCTION public.rpc_capacidades_emprestimos_multimodal() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.multimodal_verificar();
 RETURN jsonb_build_object('disponivel',true,'regra','multimodal_v1','modalidades',jsonb_build_array('mensal','semanal','quinzenal','diario','tabela_price'),'recebimento',true,'renovacao',true);
END $$;
CREATE FUNCTION public.multimodal_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='multimodal_operacoes' AND TG_OP='UPDATE' AND OLD.resultado IS NULL AND NEW.resultado IS NOT NULL
 AND (to_jsonb(OLD)-ARRAY['resultado','auditoria','concluida_em']) IS NOT DISTINCT FROM (to_jsonb(NEW)-ARRAY['resultado','auditoria','concluida_em']) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Proveniência/perna/fence multimodal imutável' USING ERRCODE='42501';
END $$;
CREATE FUNCTION public.multimodal_metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(extensions.digest(jsonb_build_object(
 'funcoes',(SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_functiondef(p.oid),p.proowner,p.proacl) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND (p.proname LIKE 'multimodal\_%' ESCAPE '\' OR p.proname LIKE 'rpc\_%multimodal' ESCAPE '\' OR p.proname IN('ciclo_guardar','ciclo_autorizar','renovacao_consumir_capacidade','legados_guardar'))),
 'tabelas',(SELECT jsonb_agg(jsonb_build_array(c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'multimodal\_%' ESCAPE '\'),
 -- Superfície 0016 somente: presença/binding/def/enabled, source/signature/config,
 -- owner/ACL da função e colunas físicas usadas. Não sela perfil, linhas de users
 -- nem altera/ressela qualquer manifesto predecessor.
 'session_revocation',jsonb_build_object(
  'functions',(SELECT jsonb_agg(jsonb_build_array(p.pronamespace,p.proname,pg_get_function_identity_arguments(p.oid),p.prorettype,p.prokind,p.prosrc,p.proconfig,p.prosecdef,p.proowner,p.proacl,p.provolatile,p.proparallel,p.proisstrict,p.proleakproof,p.proargtypes,p.proallargtypes,p.proargnames,p.provariadic,p.proretset,p.pronargdefaults,p.proargdefaults) ORDER BY p.oid) FROM pg_proc p WHERE p.proname='revogar_sessoes_ao_alterar_senha'),
  'triggers',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(t),pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t WHERE t.tgname='users_revogar_sessoes_ao_alterar_senha' OR t.tgfoid IN(SELECT oid FROM pg_proc WHERE proname='revogar_sessoes_ao_alterar_senha')),
  'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.users'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attname IN('passwordHash','password_hash','session_version')),
  'constraint',(SELECT jsonb_agg(jsonb_build_array(pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred) ORDER BY k.oid) FROM pg_constraint k WHERE k.conrelid='public.users'::regclass AND k.conname='users_session_version_nonnegative')),
 'colunas',(SELECT jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum JOIN pg_class c ON c.oid=a.attrelid WHERE a.attnum>0 AND NOT a.attisdropped AND c.relnamespace='public'::regnamespace AND (c.relname LIKE 'multimodal\_%' ESCAPE '\' OR c.relname IN('contratos','parcelas','transacoes_caixa','contrato_historico','contas_caixa','clientes','koletores','ciclo_autorizacoes','ciclo_despesas_autorizacoes','renovacao_capacidades','legados_capacidades','legados_operacoes'))),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname LIKE 'multimodal\_%' ESCAPE '\'),
 'roles',(SELECT jsonb_agg(jsonb_build_array(r.oid,r.rolname,r.rolsuper,r.rolcreaterole,r.rolbypassrls) ORDER BY r.oid) FROM pg_roles r WHERE r.rolname IN(current_user,'service_role','anon','authenticated')),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m WHERE m.member IN(SELECT oid FROM pg_roles WHERE rolname IN('service_role','anon','authenticated'))),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conrelid,k.conname,pg_get_constraintdef(k.oid),k.convalidated,k.condeferrable,k.condeferred) ORDER BY k.oid) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid WHERE c.relnamespace='public'::regnamespace AND (c.relname LIKE 'multimodal\_%' ESCAPE '\' OR c.relname IN('contratos','parcelas','transacoes_caixa','contrato_historico','contas_caixa','clientes','koletores','ciclo_autorizacoes','ciclo_despesas_autorizacoes','renovacao_capacidades','legados_capacidades','legados_operacoes'))),
 'external_acl',(SELECT jsonb_agg(jsonb_build_array(c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN('ciclo_autorizacoes','ciclo_despesas_autorizacoes','renovacao_capacidades','legados_capacidades','legados_operacoes')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace AND (c.relname LIKE 'multimodal\_%' ESCAPE '\' OR c.relname IN('contratos','parcelas','transacoes_caixa','contrato_historico','contas_caixa','clientes','koletores','ciclo_autorizacoes','ciclo_despesas_autorizacoes','renovacao_capacidades','legados_capacidades','legados_operacoes')))
 )::text,'sha256'),'hex');
$$;
CREATE FUNCTION public.multimodal_verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF (SELECT assinatura FROM public.multimodal_manifesto WHERE id=1) IS DISTINCT FROM public.multimodal_metadata() THEN RAISE EXCEPTION 'Metadata/ACL/trigger multimodal incompatível' USING ERRCODE='55000'; END IF;
END $$;
DO $acl35$ DECLARE x record; BEGIN
 FOR x IN SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'multimodal\_%' ESCAPE '\' LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',x.relname);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',x.relname);
 END LOOP;
 FOR x IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'multimodal\_%' ESCAPE '\' OR proname LIKE 'rpc\_%multimodal' ESCAPE '\') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',x.oid::regprocedure);
 IF x.proname LIKE 'rpc\_%' ESCAPE '\' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',x.oid::regprocedure); END IF;
 END LOOP;
END $acl35$;
CREATE TRIGGER multimodal_conta BEFORE INSERT OR UPDATE OR DELETE ON public.contas_caixa FOR EACH ROW EXECUTE FUNCTION public.multimodal_guardar();
CREATE TRIGGER multimodal_cliente BEFORE INSERT OR UPDATE OR DELETE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.multimodal_guardar();
CREATE TRIGGER multimodal_koletor BEFORE INSERT OR UPDATE OR DELETE ON public.koletores FOR EACH ROW EXECUTE FUNCTION public.multimodal_guardar();
CREATE TRIGGER multimodal_contrato BEFORE INSERT OR UPDATE OR DELETE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.multimodal_guardar();
CREATE TRIGGER multimodal_parcela BEFORE INSERT OR UPDATE OR DELETE ON public.parcelas FOR EACH ROW EXECUTE FUNCTION public.multimodal_guardar();
CREATE TRIGGER multimodal_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.transacoes_caixa FOR EACH ROW EXECUTE FUNCTION public.multimodal_guardar();
CREATE TRIGGER multimodal_historico BEFORE INSERT OR UPDATE OR DELETE ON public.contrato_historico FOR EACH ROW EXECUTE FUNCTION public.multimodal_guardar();
CREATE TRIGGER multimodal_operacao_imutavel BEFORE UPDATE OR DELETE ON public.multimodal_operacoes FOR EACH ROW EXECUTE FUNCTION public.multimodal_imutavel();
CREATE TRIGGER multimodal_origem_imutavel BEFORE UPDATE OR DELETE ON public.multimodal_origens FOR EACH ROW EXECUTE FUNCTION public.multimodal_imutavel();
CREATE TRIGGER multimodal_perna_imutavel BEFORE UPDATE OR DELETE ON public.multimodal_pernas FOR EACH ROW EXECUTE FUNCTION public.multimodal_imutavel();
CREATE TRIGGER multimodal_renovacao_imutavel BEFORE UPDATE OR DELETE ON public.multimodal_renovacoes FOR EACH ROW EXECUTE FUNCTION public.multimodal_imutavel();
CREATE TRIGGER multimodal_fence_imutavel BEFORE UPDATE OR DELETE ON public.multimodal_fences FOR EACH ROW EXECUTE FUNCTION public.multimodal_imutavel();
INSERT INTO public.multimodal_manifesto VALUES(1,public.multimodal_metadata());
COMMIT;
