-- Read-only preflight; PG17 / READ COMMITTED after composed60 (+67/68).
DO $$ BEGIN
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR to_regnamespace('despesas69') IS NOT NULL THEN RAISE EXCEPTION '69 preflight contexto inválido' USING ERRCODE='55000'; END IF;
 PERFORM public.caixa37_verificar(); PERFORM despesas49.verificar(); PERFORM obrigacoes51.verificar(); PERFORM inclusao52.verificar(); PERFORM sucessores53.verificar(); PERFORM emprestimos_lista60.verificar();
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.verificar()'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8f587261d12bad22e26b6a3381f2c8004c6ab950faf1a9c3dd5e6932778e7074' THEN RAISE EXCEPTION '69 compiled54 divergente' USING ERRCODE='55000'; END IF;
END $$;
