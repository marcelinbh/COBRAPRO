-- Read-only postflight; no flag changes and no reseal.
DO $$ DECLARE op record; BEGIN
 PERFORM public.caixa37_verificar(); PERFORM despesas49.verificar(); PERFORM obrigacoes51.verificar(); PERFORM inclusao52.verificar(); PERFORM sucessores53.verificar(); PERFORM emprestimos_lista60.verificar(); PERFORM despesas69.verificar();
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.verificar()'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8f587261d12bad22e26b6a3381f2c8004c6ab950faf1a9c3dd5e6932778e7074' THEN RAISE EXCEPTION '69 compiled54 divergente' USING ERRCODE='55000'; END IF;
 IF has_schema_privilege('service_role','despesas69','USAGE') OR has_schema_privilege('authenticated','despesas69','USAGE') OR has_table_privilege('service_role','despesas69.operacoes','INSERT,UPDATE,DELETE,SELECT') THEN RAISE EXCEPTION '69 private ACL aberta' USING ERRCODE='55000'; END IF;
 FOR op IN SELECT operation_id FROM despesas69.operacoes LIMIT 100000 LOOP PERFORM despesas69.provar(op.operation_id); END LOOP;
END $$;
