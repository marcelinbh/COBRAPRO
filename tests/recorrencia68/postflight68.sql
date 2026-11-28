DO $$ BEGIN
 PERFORM despesas68.verificar();PERFORM despesas49.verificar();PERFORM despesa_cancelamento_v1.verificar();PERFORM obrigacoes51.verificar();PERFORM inclusao52.verificar();PERFORM sucessores53.verificar();PERFORM emprestimos_lista60.verificar();
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE connamespace='despesas68'::regnamespace AND contype='f' AND confrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)) THEN RAISE EXCEPTION '68 FK must not add public triggers';END IF;
 IF EXISTS(SELECT 1 FROM despesas68.series) OR EXISTS(SELECT 1 FROM despesas68.agenda) OR EXISTS(SELECT 1 FROM despesas68.ocorrencias) THEN RAISE EXCEPTION '68 installer must not adopt/create historical data or provision cron';END IF;
 IF despesas68.data('2030-01-31','mensal',1)<>DATE '2030-02-28' OR despesas68.data('2030-01-31','mensal',2)<>DATE '2030-03-31' OR despesas68.data('2028-02-29','anual',4)<>DATE '2032-02-29' OR despesas68.data('2030-12-31','quinzenal',1)<>DATE '2031-01-15' THEN RAISE EXCEPTION '68 calendar drift';END IF;
 IF has_function_privilege('authenticated','public.rpc_gerar_despesas68(text,uuid)','EXECUTE') OR has_function_privilege('anon','public.rpc_configurar_despesas68(integer,uuid,jsonb)','EXECUTE') OR has_function_privilege('service_role','despesas68.gerar(text,uuid)','EXECUTE') THEN RAISE EXCEPTION '68 backend/privateACL drift';END IF;
END $$;
