CREATE FUNCTION obrigacoes51.validar_livro_recebimento(uid integer,aid integer,cid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a public.contas_caixa%ROWTYPE; t public.transacoes_caixa%ROWTYPE; oid37 uuid;
BEGIN
 IF uid IS NULL OR uid<=0 OR aid IS NULL OR aid<=0 OR cid IS NULL OR cid<=0 THEN RAISE EXCEPTION '58 alvo inválido' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=aid AND user_id=uid AND ativo IS TRUE)
 OR NOT EXISTS(SELECT 1 FROM public.contratos WHERE id=cid AND user_id=uid AND conta_caixa_id=aid) THEN RAISE EXCEPTION '58 alvo próprio ativo/vínculo necessário' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND classid=22022 AND objid=aid AND objsubid=2)
 OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND classid=34034 AND objid=uid AND objsubid=2)
 OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND classid=34035 AND objid=cid AND objsubid=2) THEN RAISE EXCEPTION '58 locks necessários' USING ERRCODE='42501';END IF;
 FOR a IN SELECT * FROM public.contas_caixa WHERE user_id=uid LOOP
 IF a.id<=0 OR a.saldo::text IN('NaN','Infinity','-Infinity') OR a.saldo<>round(a.saldo,2) OR abs(a.saldo)>9999999999999.99 THEN RAISE EXCEPTION 'Saldo-base37 inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR t IN SELECT * FROM public.transacoes_caixa WHERE conta_caixa_id=aid OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid) ORDER BY id LOOP
 IF t.id<=0 OR t.user_id IS DISTINCT FROM uid OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=t.conta_caixa_id AND user_id=uid)
 OR t.tipo IS NULL OR t.valor IS NULL OR t.data_transacao IS NULL OR t.tipo NOT IN('entrada','saida') OR t.valor::text IN('NaN','Infinity','-Infinity') OR t.valor<=0 OR t.valor<>round(t.valor,2) OR NOT isfinite(t.data_transacao)
 OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.clientes cl ON cl.id=c.cliente_id WHERE c.id=t.contrato_id AND c.user_id=uid AND cl.user_id=uid AND c.conta_caixa_id=t.conta_caixa_id AND (c.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid))))
 OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id JOIN public.clientes cl ON cl.id=p.cliente_id WHERE p.id=t.parcela_id AND p.user_id=uid AND c.user_id=uid AND cl.user_id=uid AND p.cliente_id=c.cliente_id AND p.contrato_id=t.contrato_id AND p.conta_caixa_id=t.conta_caixa_id AND (p.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=p.koletor_id AND user_id=uid)))) THEN RAISE EXCEPTION 'Ledger37 whole-owner crossowner/estrutura inválida' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.caixa37_contas WHERE conta_id=aid AND user_id IS DISTINCT FROM uid) THEN RAISE EXCEPTION '58 pin alvo alheio' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM public.caixa37_operacoes o WHERE o.user_id IS DISTINCT FROM uid AND
 (o.request->'contaOrigemId'=to_jsonb(aid) OR o.request->'contaDestinoId'=to_jsonb(aid)
 OR o.id IN(SELECT primeira_op FROM public.caixa37_contas WHERE conta_id=aid)
 OR EXISTS(SELECT 1 FROM public.caixa37_pernas p LEFT JOIN public.transacoes_caixa l ON l.id=p.transacao_id WHERE p.operacao_id=o.id AND (l.conta_caixa_id=aid OR l.contrato_id=cid OR l.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid) OR p.snapshot->'conta_caixa_id'=to_jsonb(aid))))) THEN RAISE EXCEPTION '58 operação ligada alheia' USING ERRCODE='23514';END IF;
 FOR oid37 IN SELECT id FROM public.caixa37_operacoes WHERE user_id=uid LOOP PERFORM public.caixa37_validar_op(oid37); END LOOP;
 IF EXISTS(SELECT 1 FROM public.caixa37_contas p LEFT JOIN public.contas_caixa ac ON ac.id=p.conta_id WHERE p.user_id=uid AND (ac.id IS NULL OR ac.user_id IS DISTINCT FROM p.user_id OR ac.saldo IS DISTINCT FROM p.saldo_base)) THEN RAISE EXCEPTION 'Pin37 divergente' USING ERRCODE='23514'; END IF;
END $$;
REVOKE ALL ON FUNCTION obrigacoes51.validar_livro_recebimento(integer,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
