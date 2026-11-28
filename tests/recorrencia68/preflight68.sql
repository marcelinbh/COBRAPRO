-- Run only on isolated PG17 after real20/25/35/37/38c/49/51->54->52->53->58->60->67.
DO $$ BEGIN
 IF current_setting('server_version_num')::integer/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION '68 PG17/Read Committed required';END IF;
 IF to_regnamespace('despesas68') IS NOT NULL THEN RAISE EXCEPTION '68 must be absent before installation';END IF;
 PERFORM public.caixa37_verificar();PERFORM despesas49.verificar();PERFORM obrigacoes51.verificar();PERFORM inclusao52.verificar();PERFORM sucessores53.verificar();PERFORM emprestimos_lista60.verificar();
 IF (SELECT assinatura FROM public.caixa37_manifesto WHERE id=1) IS DISTINCT FROM public.caixa37_metadata() THEN RAISE EXCEPTION '68 current preimage not valid';END IF;
END $$;
