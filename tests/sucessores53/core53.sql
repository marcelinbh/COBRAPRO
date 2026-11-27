-- Core53 compiled into the NEW migration only. No runtime reseal.
CREATE SCHEMA sucessores53;
REVOKE ALL ON SCHEMA sucessores53 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sucessores53.operacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id integer NOT NULL REFERENCES public.users(id),chave uuid NOT NULL,
 contrato_id integer NOT NULL REFERENCES public.contratos(id),request jsonb NOT NULL,hash_request text NOT NULL,
 antes jsonb NOT NULL,instante timestamptz NOT NULL,depois jsonb,resultado jsonb,hash_resultado text,concluida_em timestamptz,
 UNIQUE(user_id,chave),CHECK(hash_request ~ '^[a-f0-9]{64}$'),
 CHECK((resultado IS NULL AND depois IS NULL AND hash_resultado IS NULL AND concluida_em IS NULL) OR
 (resultado IS NOT NULL AND depois IS NOT NULL AND hash_resultado ~ '^[a-f0-9]{64}$' AND concluida_em IS NOT NULL)));
CREATE TABLE sucessores53.fences(user_id integer NOT NULL REFERENCES public.users(id),chave uuid NOT NULL,request jsonb NOT NULL,hash_request text NOT NULL,PRIMARY KEY(user_id,chave));
CREATE TABLE sucessores53.capacidades(xid bigint NOT NULL,pid integer NOT NULL,operacao_id uuid NOT NULL REFERENCES sucessores53.operacoes(id),guard text NOT NULL,tabela text NOT NULL CHECK(tabela IN('contratos','parcelas','contrato_historico')),evento text NOT NULL CHECK(evento IN('INSERT','UPDATE')),anterior jsonb,posterior jsonb NOT NULL,PRIMARY KEY(xid,pid));
CREATE TABLE sucessores53.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);
CREATE FUNCTION sucessores53.hash(j jsonb) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT encode(extensions.digest(j::text,'sha256'),'hex') $$;
CREATE FUNCTION sucessores53.proposta(v jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r jsonb; d date; m numeric;
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'object' OR v->>'versao' IS DISTINCT FROM 'sucessores53_editar_v1' OR v->>'acao' IS DISTINCT FROM 'editar' OR NOT(v?'parcelaId') OR (v-ARRAY['versao','acao','parcelaId','novaDataVencimento','novoValor'])<>'{}'::jsonb OR NOT(v?'novaDataVencimento' OR v?'novoValor') THEN RAISE EXCEPTION '53 proposta fechada obrigatória' USING ERRCODE='22023';END IF;
 r:=jsonb_build_object('versao','sucessores53_editar_v1','acao','editar','parcelaId',obrigacoes51.id(v->'parcelaId'));
 IF v?'novaDataVencimento' THEN d:=obrigacoes51.dia(v->>'novaDataVencimento');r:=r||jsonb_build_object('novaDataVencimento',d);END IF;
 IF v?'novoValor' THEN m:=obrigacoes51.dinheiro(v->>'novoValor');r:=r||jsonb_build_object('novoValor',m::numeric(12,2)::text);END IF;
 IF r IS DISTINCT FROM v THEN RAISE EXCEPTION '53 proposta não canônica' USING ERRCODE='22023';END IF;RETURN r;
END $$;
CREATE FUNCTION sucessores53.request(r jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid integer; d date; v jsonb;
BEGIN
 IF r IS NULL OR jsonb_typeof(r)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(r))<>5 OR (r-ARRAY['contratoId','proposta','estadoHash','dataCalculo','motivo'])<>'{}'::jsonb OR coalesce(r->>'estadoHash','') !~ '^[a-f0-9]{64}$' OR jsonb_typeof(r->'motivo') IS DISTINCT FROM 'string' OR length(r->>'motivo') NOT BETWEEN 3 AND 500 OR btrim(r->>'motivo')<>r->>'motivo' THEN RAISE EXCEPTION '53 request inválido' USING ERRCODE='22023';END IF;
 cid:=obrigacoes51.id(r->'contratoId');d:=obrigacoes51.dia(r->>'dataCalculo');v:=sucessores53.proposta(r->'proposta');RETURN r;
END $$;
CREATE FUNCTION sucessores53.abertas(uid integer,s jsonb,stamp timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid integer:=(s->'contrato'->>'id')::int;n integer:=jsonb_array_length(s->'parcelas');p jsonb;i integer:=0;
BEGIN
 PERFORM obrigacoes51.vinculos(uid,cid);
 IF s->'contrato'->>'status' IS DISTINCT FROM 'ativo' OR n NOT BETWEEN 1 AND 60 OR s->'contrato'->>'num_parcelas' IS DISTINCT FROM n::text OR s->'contrato'->>'numero_parcelas' IS DISTINCT FROM n::text OR s->'renovacoes'<>'[]'::jsonb OR EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.encerramentos WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid LIMIT 1) OR s->'ledger'<>'[]'::jsonb THEN RAISE EXCEPTION '53 manutenção apenas folha47 inteira aberta; baixa/renúncia/encargo excluído' USING ERRCODE='0A000';END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'numero')::int LOOP
 i:=i+1;
 IF p->>'numero' IS DISTINCT FROM i::text OR p->>'numero_parcela' IS DISTINCT FROM i::text OR p->>'status' IS DISTINCT FROM 'pendente' OR (p->>'valor_pago')::numeric IS DISTINCT FROM 0::numeric OR (p->>'saldo_residual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_multa')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_manual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_diaria_usada')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_desconto')::numeric IS DISTINCT FROM 0::numeric OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb OR (p->>'data_vencimento')::date<=(stamp AT TIME ZONE 'America/Sao_Paulo')::date OR (p->>'valor')::numeric IS DISTINCT FROM (p->>'valor_original')::numeric OR (p->>'valor_original')::numeric-(p->>'valor_juros')::numeric<=0 THEN RAISE EXCEPTION '53 parcelas completas futuras sem baixa obrigatórias' USING ERRCODE='23514';END IF;
 END LOOP;
END $$;
CREATE FUNCTION sucessores53.plano(uid integer,s jsonb,v jsonb,stamp timestamptz,oid53 uuid,motivo text,h jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE target integer; p jsonb; np jsonb; ps jsonb; c jsonb; d date; low date; high date; b numeric; value53 numeric;total53 numeric;first53 date;last53 date;
BEGIN
 v:=sucessores53.proposta(v);target:=(v->>'parcelaId')::int;PERFORM sucessores53.abertas(uid,s,stamp);
 SELECT value INTO p FROM jsonb_array_elements(s->'parcelas') WHERE value->>'id'=target::text;
 IF NOT FOUND THEN RAISE EXCEPTION '53 parcela própria indisponível' USING ERRCODE='42501';END IF;
 np:=p;
 IF v?'novaDataVencimento' THEN
 d:=(v->>'novaDataVencimento')::date;
 SELECT max((j->>'data_vencimento')::date) INTO low FROM jsonb_array_elements(s->'parcelas') j WHERE (j->>'numero')::int<(p->>'numero')::int;
 SELECT min((j->>'data_vencimento')::date) INTO high FROM jsonb_array_elements(s->'parcelas') j WHERE (j->>'numero')::int>(p->>'numero')::int;
 IF d<=(stamp AT TIME ZONE 'America/Sao_Paulo')::date OR d<(s->'contrato'->>'data_inicio')::date OR (low IS NOT NULL AND d<=low) OR (high IS NOT NULL AND d>=high) THEN RAISE EXCEPTION '53 data futura entre vizinhas estritas' USING ERRCODE='22023';END IF;
 np:=np||jsonb_build_object('data_vencimento',d);
 END IF;
 IF v?'novoValor' THEN
 b:=(p->>'valor_original')::numeric-(p->>'valor_juros')::numeric;value53:=(v->>'novoValor')::numeric;
 IF value53<b THEN RAISE EXCEPTION '53 novo valor menor que base transferida Bi' USING ERRCODE='22023';END IF;
 np:=np||jsonb_build_object('valor',value53,'valor_original',value53,'valor_juros',value53-b);
 END IF;
 IF np=p THEN RAISE EXCEPTION '53 alteração vazia' USING ERRCODE='22023';END IF;
 np:=np||jsonb_build_object('updatedAt',stamp);
 SELECT jsonb_agg(CASE WHEN j->>'id'=target::text THEN np ELSE j END ORDER BY (j->>'id')::int) INTO ps FROM jsonb_array_elements(s->'parcelas') j;
 SELECT sum((j->>'valor_original')::numeric),min((j->>'data_vencimento')::date),max((j->>'data_vencimento')::date) INTO total53,first53,last53 FROM jsonb_array_elements(ps) j;
 IF NOT public.multimodal_moeda(total53) THEN RAISE EXCEPTION '53 total fora writer' USING ERRCODE='22023';END IF;
 c:=(s->'contrato')||jsonb_build_object('total_contrato',total53,'valor_parcela',round(total53/jsonb_array_length(ps),2),'data_vencimento_primeira',first53,'data_vencimento',last53,'dia_vencimento',extract(day FROM first53)::int,'updatedAt',stamp);
 IF h IS NOT NULL THEN
 IF h->>'contrato_id' IS DISTINCT FROM s->'contrato'->>'id' OR h->>'user_id' IS DISTINCT FROM uid::text OR h->>'tipo' IS DISTINCT FROM 'edicao_parcela' OR h->>'descricao' IS DISTINCT FROM 'Manutenção sucessor53 '||oid53::text||': '||motivo OR (h->>'created_at')::timestamptz IS DISTINCT FROM stamp OR h->'valor_anterior' IS DISTINCT FROM 'null'::jsonb OR h->'valor_novo' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION '53 histórico delta inválido' USING ERRCODE='23514';END IF;
 END IF;
 RETURN jsonb_set(jsonb_set(jsonb_set(s,'{parcelas}',ps),'{contrato}',c),'{historico}',s->'historico'||CASE WHEN h IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(h) END);
END $$;
CREATE FUNCTION sucessores53.recebimento(uid integer,cid integer,s jsonb,o public.multimodal_operacoes) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a jsonb:=o.auditoria->'depois';p jsonb;np jsonb;c jsonb:=s->'contrato';h jsonb;t jsonb;stamp timestamptz;day53 date;due numeric;fine numeric;mora numeric;cash numeric;paid numeric;residual numeric;enc jsonb;status53 text;r jsonb;extra jsonb;pid53 integer;
BEGIN
 pid53:=(o.payload->>'parcelaId')::int;SELECT value INTO p FROM jsonb_array_elements(s->'parcelas') WHERE value->>'id'=pid53::text;
 stamp:=(a->'contrato'->>'updatedAt')::timestamptz;day53:=(stamp AT TIME ZONE 'America/Sao_Paulo')::date;
 IF p IS NULL OR o.family IS DISTINCT FROM 'multimodal_receber' OR o.payload->>'modo' NOT IN('integral','parcial') OR o.payload->>'dataPagamento' IS DISTINCT FROM day53::text OR stamp IS NULL OR o.concluida_em<stamp OR p->>'status' NOT IN('pendente','parcial','atrasada','vencendo_hoje') THEN RAISE EXCEPTION '53 replay recebimento35 indisponível' USING ERRCODE='23514';END IF;
 IF p->>'status'='parcial' THEN due:=(p->>'saldo_residual')::numeric;fine:=(p->>'valor_multa')::numeric;mora:=(p->>'multa_diaria_usada')::numeric;
 ELSE enc:=public.ciclo_encargos((p->>'valor_original')::numeric,(c->>'multa_atraso')::numeric,(c->>'juros_mora_diario')::numeric,(p->>'data_vencimento')::date,stamp);fine:=(enc->>'multa')::numeric;mora:=(enc->>'mora')::numeric;due:=(p->>'valor_original')::numeric+fine+mora;END IF;
 cash:=(o.payload->>'valorRecebido')::numeric;paid:=(p->>'valor_pago')::numeric+cash;residual:=due-cash;
 IF cash<=0 OR due<=0 OR o.payload->>'totalExigido' IS DISTINCT FROM due::numeric(15,2)::text OR (o.payload->>'modo'='integral' AND cash<>due) OR (o.payload->>'modo'='parcial' AND cash>=due) THEN RAISE EXCEPTION '53 replay recebimento35 valores inválidos' USING ERRCODE='23514';END IF;
 np:=p||jsonb_build_object('valor_pago',paid,'valor_multa',fine,'multa_diaria_usada',mora,'saldo_residual',residual,'valor_desconto',0,'data_pagamento',day53,'status',CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'updatedAt',stamp,'observacoes',nullif(btrim(o.payload->>'observacoes'),''));
 s:=jsonb_set(s,'{parcelas}',(SELECT jsonb_agg(CASE WHEN j->>'id'=pid53::text THEN np ELSE j END ORDER BY (j->>'id')::int) FROM jsonb_array_elements(s->'parcelas') j));
 status53:=CASE WHEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'parcelas') j WHERE j->>'status'<>'paga') THEN 'quitado' ELSE 'ativo' END;
 s:=jsonb_set(s,'{contrato}',c||jsonb_build_object('status',status53,'updatedAt',stamp));
 t:=a->'ledger'->jsonb_array_length(s->'ledger');h:=a->'historico'->jsonb_array_length(s->'historico');
 IF t IS NULL OR h IS NULL OR t->>'user_id' IS DISTINCT FROM uid::text OR t->>'contrato_id' IS DISTINCT FROM cid::text OR t->>'parcela_id' IS DISTINCT FROM pid53::text OR t->'conta_caixa_id' IS DISTINCT FROM c->'conta_caixa_id' OR t->>'tipo' IS DISTINCT FROM 'entrada' OR t->>'categoria' IS DISTINCT FROM 'pagamento_parcela' OR (t->>'valor')::numeric IS DISTINCT FROM cash OR t->>'descricao' IS DISTINCT FROM 'Recebimento multimodal '||o.id::text OR t->>'data_transacao' IS DISTINCT FROM day53::text OR (t->>'createdAt')::timestamptz IS DISTINCT FROM stamp OR h->>'contrato_id' IS DISTINCT FROM cid::text OR h->>'user_id' IS DISTINCT FROM uid::text OR h->>'tipo' IS DISTINCT FROM 'pagamento' OR h->>'descricao' IS DISTINCT FROM 'Recebimento multimodal '||o.id::text OR (h->>'valor_anterior')::numeric IS DISTINCT FROM paid-cash OR (h->>'valor_novo')::numeric IS DISTINCT FROM paid OR (h->>'created_at')::timestamptz IS DISTINCT FROM stamp OR (SELECT count(*) FROM public.multimodal_pernas WHERE operacao_id=o.id)<>1 OR NOT EXISTS(SELECT 1 FROM public.multimodal_pernas leg JOIN public.transacoes_caixa physical ON physical.id=leg.transacao_id WHERE leg.operacao_id=o.id AND leg.snapshot=t AND to_jsonb(physical)=t) THEN RAISE EXCEPTION '53 perna35/histórico completo divergente' USING ERRCODE='23514';END IF;
 r:=jsonb_build_object('success',true,'repetida',false,'operationId',o.id,'contratoId',cid,'parcelaId',pid53,'transacaoCaixaId',t->>'id','contaCaixaId',(c->>'conta_caixa_id')::int,'valorRecebido',cash::numeric(15,2)::text,'totalExigido',due::numeric(15,2)::text,'saldoResidual',residual::numeric(15,2)::text,'valorPagoAcumulado',paid::numeric(15,2)::text,'dataPagamento',day53,'status',CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'contratoStatus',status53,'regra','recebimento_multimodal_brt_v1');
 IF o.resultado IS DISTINCT FROM r THEN RAISE EXCEPTION '53 resultado35 divergente' USING ERRCODE='23514';END IF;
 RETURN jsonb_set(jsonb_set(s,'{ledger}',s->'ledger'||jsonb_build_array(t)),'{historico}',s->'historico'||jsonb_build_array(h));
END $$;
CREATE FUNCTION sucessores53.replay(uid integer,cid integer,target jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE ch private47.cadeia%ROWTYPE;s jsonb;ownop sucessores53.operacoes%ROWTYPE;mop public.multimodal_operacoes%ROWTYPE;x record;seen uuid[]:='{}';n integer;candidates integer;applied integer:=0;h jsonb;expected jsonb;
BEGIN
 PERFORM sucessores53.verificar();
 SELECT * INTO ch FROM private47.cadeia WHERE sucessor_id=cid;
 IF NOT FOUND OR ch.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION '53 exige sucessor47 nativo real' USING ERRCODE='42501';END IF;
 PERFORM private47.validar_op(ch.operacao_id);PERFORM obrigacoes51.vinculos(uid,cid);
 SELECT auditoria->'sucessor' INTO STRICT s FROM private47.operacoes WHERE id=ch.operacao_id;
 IF EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM private47.cadeia WHERE origem_id=cid) OR target->'contrato'->>'contrato_origem_id' IS DISTINCT FROM ch.origem_id::text OR target->'origem' IS DISTINCT FROM 'null'::jsonb OR target->'renovacoes' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION '53 proveniência dupla/alterada' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM sucessores53.operacoes WHERE contrato_id=cid AND (user_id IS DISTINCT FROM uid OR (resultado IS NULL AND (xmin::text::xid8 IS DISTINCT FROM pg_current_xact_id_if_assigned()))) LIMIT 1) OR EXISTS(SELECT 1 FROM public.multimodal_operacoes WHERE (payload->>'contratoId'=cid::text OR resultado->>'contratoId'=cid::text OR auditoria->'antes'->'contrato'->>'id'=cid::text OR auditoria->'depois'->'contrato'->>'id'=cid::text) AND (user_id IS DISTINCT FROM uid OR family IS DISTINCT FROM 'multimodal_receber' OR (resultado IS NULL AND xmin::text::xid8 IS DISTINCT FROM pg_current_xact_id_if_assigned())) LIMIT 1) THEN RAISE EXCEPTION '53 operação órfã/owner/família inválida' USING ERRCODE='23514';END IF;
 SELECT (SELECT count(*) FROM sucessores53.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL)+(SELECT count(*) FROM public.multimodal_operacoes WHERE payload->>'contratoId'=cid::text AND resultado IS NOT NULL) INTO n;
 IF n>1024 THEN RAISE EXCEPTION '53 replay limite fechado' USING ERRCODE='54000';END IF;
 WHILE applied<n LOOP
 SELECT count(*) INTO candidates FROM (
 SELECT id FROM sucessores53.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL AND NOT(id=ANY(seen)) AND antes=s
 UNION ALL SELECT id FROM public.multimodal_operacoes WHERE payload->>'contratoId'=cid::text AND resultado IS NOT NULL AND NOT(id=ANY(seen)) AND auditoria->'antes'=s) a;
 IF candidates<>1 THEN RAISE EXCEPTION '53 predecessor omitido/duplicado/bifurcado' USING ERRCODE='23514';END IF;
 SELECT id,kind INTO x FROM (SELECT id,'own' kind FROM sucessores53.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL AND NOT(id=ANY(seen)) AND antes=s UNION ALL SELECT id,'receipt' kind FROM public.multimodal_operacoes WHERE payload->>'contratoId'=cid::text AND resultado IS NOT NULL AND NOT(id=ANY(seen)) AND auditoria->'antes'=s) a;
 IF x.kind='own' THEN
 SELECT * INTO STRICT ownop FROM sucessores53.operacoes WHERE id=x.id;
 h:=ownop.depois->'historico'->jsonb_array_length(s->'historico');
 IF ownop.user_id IS DISTINCT FROM uid OR ownop.hash_request IS DISTINCT FROM sucessores53.hash(ownop.request) OR ownop.request IS DISTINCT FROM sucessores53.request(ownop.request) OR ownop.request->>'estadoHash' IS DISTINCT FROM sucessores53.hash(s) OR ownop.request->>'dataCalculo' IS DISTINCT FROM (ownop.instante AT TIME ZONE 'America/Sao_Paulo')::date::text OR ownop.concluida_em<ownop.instante OR ownop.hash_resultado IS DISTINCT FROM sucessores53.hash(ownop.resultado) OR ownop.resultado IS DISTINCT FROM sucessores53.closure(uid,ownop.chave,ownop.request,ownop.id,'confirmed') THEN RAISE EXCEPTION '53 replay request/closure inválido' USING ERRCODE='23514';END IF;
 expected:=sucessores53.plano(uid,s,ownop.request->'proposta',ownop.instante,ownop.id,ownop.request->>'motivo',h);
 IF expected IS DISTINCT FROM ownop.depois THEN RAISE EXCEPTION '53 replay plano/delta financeiro divergente' USING ERRCODE='23514';END IF;s:=ownop.depois;
 ELSE
 SELECT * INTO STRICT mop FROM public.multimodal_operacoes WHERE id=x.id;
 IF mop.payload IS DISTINCT FROM public.multimodal_payload(uid,mop.family,mop.request) OR mop.hash_payload IS DISTINCT FROM sucessores53.hash(mop.payload) OR mop.auditoria->'payload' IS DISTINCT FROM mop.payload OR mop.auditoria->>'hashPayload' IS DISTINCT FROM mop.hash_payload OR mop.auditoria->'resultado' IS DISTINCT FROM mop.resultado OR mop.request->>'estadoHash' IS DISTINCT FROM sucessores53.hash(s) OR NOT EXISTS(SELECT 1 FROM private47.recebimentos WHERE operacao_id=mop.id AND contrato_id=cid AND user_id=uid AND snapshot=mop.auditoria->'depois' AND hash_snapshot=sucessores53.hash(snapshot)) THEN RAISE EXCEPTION '53 recebimento35/prova divergente' USING ERRCODE='23514';END IF;
 expected:=sucessores53.recebimento(uid,cid,s,mop);IF expected IS DISTINCT FROM mop.auditoria->'depois' THEN RAISE EXCEPTION '53 replay recebimento35 delta divergente' USING ERRCODE='23514';END IF;s:=mop.auditoria->'depois';
 END IF;
 seen:=array_append(seen,x.id);applied:=applied+1;
 END LOOP;
 IF (SELECT count(*) FROM private47.recebimentos WHERE contrato_id=cid) IS DISTINCT FROM (SELECT count(*) FROM public.multimodal_operacoes WHERE payload->>'contratoId'=cid::text AND resultado IS NOT NULL) OR s IS DISTINCT FROM target THEN RAISE EXCEPTION '53 terminal físico/eventos órfãos divergentes' USING ERRCODE='23514';END IF;RETURN s;
END $$;
CREATE FUNCTION sucessores53.closure(uid integer,k uuid,r jsonb,oid53 uuid,status53 text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE ch private47.cadeia%ROWTYPE;out53 jsonb;
BEGIN
 SELECT * INTO STRICT ch FROM private47.cadeia WHERE sucessor_id=(r->>'contratoId')::int AND user_id=uid;
 out53:=jsonb_build_object('versao','sucessores53_v1','status',status53,'sameIntentOnly',true,'userId',uid,'idempotencyKey',k,'request',r);
 IF status53='confirmed' THEN out53:=out53||jsonb_build_object('resultado',jsonb_build_object('operationId',oid53,'contratoId',ch.sucessor_id,'paiId',ch.origem_id,'raizId',ch.origem_id,'parcelaId',(r->'proposta'->>'parcelaId')::int,'caixaPreservado',true,'semantica','Bi_preservada_Jn_apenas'));END IF;RETURN out53;
END $$;
CREATE FUNCTION sucessores53.cotar(uid integer,cid integer,v jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s jsonb;plan53 jsonb;stamp timestamptz:=clock_timestamp();ch private47.cadeia%ROWTYPE;
BEGIN
 PERFORM sucessores53.verificar();v:=sucessores53.proposta(v);PERFORM private47.travar(uid,cid);s:=sucessores53.replay(uid,cid,public.multimodal_snapshot(cid));plan53:=sucessores53.plano(uid,s,v,stamp,NULL,NULL,NULL);
 SELECT * INTO STRICT ch FROM private47.cadeia WHERE sucessor_id=cid AND user_id=uid;
 RETURN jsonb_build_object('versao','sucessores53_v1','userId',uid,'contratoId',cid,'paiId',ch.origem_id,'raizId',ch.origem_id,'proposta',v,'estadoHash',sucessores53.hash(s),'dataCalculo',(stamp AT TIME ZONE 'America/Sao_Paulo')::date,'caixaPreservado',true,'semantica','Bi_preservada_Jn_apenas','baseTransferida',(SELECT (j->>'valor_original')::numeric-(j->>'valor_juros')::numeric FROM jsonb_array_elements(s->'parcelas') j WHERE j->>'id'=v->>'parcelaId')::numeric(15,2)::text,'totalDepois',(plan53->'contrato'->>'total_contrato')::numeric(15,2)::text);
END $$;
CREATE FUNCTION sucessores53.consumir(g text,t text,e text,a jsonb,b jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cap sucessores53.capacidades%ROWTYPE;o sucessores53.operacoes%ROWTYPE;h jsonb;plan53 jsonb;
BEGIN
 SELECT * INTO cap FROM sucessores53.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid();IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO STRICT o FROM sucessores53.operacoes WHERE id=cap.operacao_id;
 IF cap.guard IS DISTINCT FROM g OR cap.tabela IS DISTINCT FROM t OR cap.evento IS DISTINCT FROM e OR cap.anterior IS DISTINCT FROM a OR cap.posterior IS DISTINCT FROM b OR o.resultado IS NOT NULL OR NOT EXISTS(SELECT 1 FROM sucessores53.operacoes z WHERE z.id=o.id AND z.xmin::text::xid8=pg_current_xact_id()) OR NOT EXISTS(SELECT 1 FROM sucessores53.capacidades z WHERE z.operacao_id=o.id AND z.xid=txid_current() AND z.pid=pg_backend_pid() AND z.xmin::text::xid8=pg_current_xact_id()) OR o.hash_request IS DISTINCT FROM sucessores53.hash(o.request) OR b->>'user_id' IS DISTINCT FROM o.user_id::text THEN RAISE EXCEPTION '53 capacidade exata própria pendente obrigatória' USING ERRCODE='42501';END IF;
 IF t='contrato_historico' THEN h:=b;ELSE h:=NULL;END IF;
 plan53:=sucessores53.plano(o.user_id,o.antes,o.request->'proposta',o.instante,o.id,o.request->>'motivo',h);
 IF (t='parcelas' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.antes->'parcelas') oldp JOIN jsonb_array_elements(plan53->'parcelas') newp ON oldp->>'id'=newp->>'id' WHERE oldp=a AND newp=b AND oldp IS DISTINCT FROM newp)) OR (t='contratos' AND (a IS DISTINCT FROM o.antes->'contrato' OR b IS DISTINCT FROM plan53->'contrato')) OR (t='contrato_historico' AND (a IS NOT NULL OR e<>'INSERT')) OR g IS DISTINCT FROM (CASE t WHEN 'parcelas' THEN 'multimodal_parcela' WHEN 'contratos' THEN 'multimodal_contrato' ELSE 'multimodal_historico' END) THEN RAISE EXCEPTION '53 delta não previsto pelo plano fechado' USING ERRCODE='42501';END IF;
 DELETE FROM sucessores53.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid();RETURN true;
END $$;
CREATE FUNCTION sucessores53.escrever(oid53 uuid,t text,a jsonb,b jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cols text;vals text;actual jsonb;
BEGIN
 IF t NOT IN('contratos','parcelas','contrato_historico') THEN RAISE EXCEPTION '53 não escreve Caixa' USING ERRCODE='42501';END IF;
 INSERT INTO sucessores53.capacidades VALUES(txid_current(),pg_backend_pid(),oid53,CASE t WHEN 'parcelas' THEN 'multimodal_parcela' WHEN 'contratos' THEN 'multimodal_contrato' ELSE 'multimodal_historico' END,t,CASE WHEN a IS NULL THEN 'INSERT' ELSE 'UPDATE' END,a,b);
 IF a IS NULL THEN EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I,$1)).*',t,t) USING b;
 ELSE SELECT string_agg(format('%I',attname),',' ORDER BY attnum),string_agg(format('r.%I',attname),',' ORDER BY attnum) INTO cols,vals FROM pg_attribute WHERE attrelid=to_regclass('public.'||t) AND attnum>0 AND NOT attisdropped;
 EXECUTE format('UPDATE public.%I x SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r) WHERE x.id=($1->>''id'')::int',t,cols,vals,t) USING b;END IF;
 EXECUTE format('SELECT to_jsonb(x) FROM public.%I x WHERE id=($1->>''id'')::int',t) INTO actual USING b;
 IF actual IS DISTINCT FROM b OR EXISTS(SELECT 1 FROM sucessores53.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN RAISE EXCEPTION '53 DML/readback/cap residual divergente' USING ERRCODE='23514';END IF;
END $$;
CREATE FUNCTION sucessores53.executar(uid integer,k uuid,r jsonb,recovery boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o sucessores53.operacoes%ROWTYPE;f sucessores53.fences%ROWTYPE;s jsonb;plan53 jsonb;h jsonb;p jsonb;np jsonb;cid integer;stamp timestamptz;closed jsonb;cashBefore jsonb;cashAfter jsonb;
BEGIN
 PERFORM sucessores53.verificar();r:=sucessores53.request(r);cid:=(r->>'contratoId')::int;
 IF uid IS NULL OR uid<=0 OR k IS NULL THEN RAISE EXCEPTION '53 owner/UUID obrigatório' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sucessores53:'||uid::text||':'||k::text,53));
 SELECT * INTO o FROM sucessores53.operacoes WHERE user_id=uid AND chave=k FOR UPDATE;
 IF FOUND THEN IF o.request IS DISTINCT FROM r THEN RAISE EXCEPTION '53 UUID request conflitante' USING ERRCODE='23505';END IF;IF o.resultado IS NULL THEN RAISE EXCEPTION '53 pendência não recuperável' USING ERRCODE='23514';END IF;IF o.hash_resultado IS DISTINCT FROM sucessores53.hash(o.resultado) OR o.resultado IS DISTINCT FROM sucessores53.closure(uid,k,r,o.id,'confirmed') THEN RAISE EXCEPTION '53 closure divergente' USING ERRCODE='23514';END IF;RETURN o.resultado;END IF;
 SELECT * INTO f FROM sucessores53.fences WHERE user_id=uid AND chave=k;
 IF FOUND THEN IF f.request IS DISTINCT FROM r THEN RAISE EXCEPTION '53 fence request conflitante' USING ERRCODE='23505';END IF;IF recovery THEN RETURN sucessores53.closure(uid,k,r,NULL,'fenced');END IF;RAISE EXCEPTION '53 fence irrevogável' USING ERRCODE='23514';END IF;
 PERFORM private47.travar(uid,cid);
 IF recovery THEN INSERT INTO sucessores53.fences VALUES(uid,k,r,sucessores53.hash(r));RETURN sucessores53.closure(uid,k,r,NULL,'fenced');END IF;
 s:=sucessores53.replay(uid,cid,public.multimodal_snapshot(cid));stamp:=clock_timestamp();
 IF sucessores53.hash(s) IS DISTINCT FROM r->>'estadoHash' OR r->>'dataCalculo' IS DISTINCT FROM (stamp AT TIME ZONE 'America/Sao_Paulo')::date::text THEN RAISE EXCEPTION '53 cotação stale/dia civil' USING ERRCODE='40001';END IF;
 SELECT jsonb_build_object('conta',to_jsonb(a),'livro',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transacoes_caixa t WHERE conta_caixa_id=a.id)) INTO cashBefore FROM public.contas_caixa a WHERE id=(s->'contrato'->>'conta_caixa_id')::int;
 INSERT INTO sucessores53.operacoes(user_id,chave,contrato_id,request,hash_request,antes,instante) VALUES(uid,k,cid,r,sucessores53.hash(r),s,stamp) RETURNING * INTO o;
 h:=public.multimodal_nova_linha('contrato_historico')||jsonb_build_object('contrato_id',cid,'user_id',uid::text,'tipo','edicao_parcela','descricao','Manutenção sucessor53 '||o.id::text||': '||(r->>'motivo'),'created_at',stamp);
 plan53:=sucessores53.plano(uid,s,r->'proposta',stamp,o.id,r->>'motivo',h);
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'id')::int LOOP SELECT value INTO STRICT np FROM jsonb_array_elements(plan53->'parcelas') WHERE value->'id'=p->'id';IF np IS DISTINCT FROM p THEN PERFORM sucessores53.escrever(o.id,'parcelas',p,np);END IF;END LOOP;
 PERFORM sucessores53.escrever(o.id,'contratos',s->'contrato',plan53->'contrato');PERFORM sucessores53.escrever(o.id,'contrato_historico',NULL,h);
 SELECT jsonb_build_object('conta',to_jsonb(a),'livro',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transacoes_caixa t WHERE conta_caixa_id=a.id)) INTO cashAfter FROM public.contas_caixa a WHERE id=(s->'contrato'->>'conta_caixa_id')::int;
 IF cashAfter IS DISTINCT FROM cashBefore OR public.multimodal_snapshot(cid) IS DISTINCT FROM plan53 OR (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text IS DISTINCT FROM r->>'dataCalculo' THEN RAISE EXCEPTION '53 caixa/delta/dia divergente' USING ERRCODE='23514';END IF;
 closed:=sucessores53.closure(uid,k,r,o.id,'confirmed');UPDATE sucessores53.operacoes SET depois=public.multimodal_snapshot(cid),resultado=closed,hash_resultado=sucessores53.hash(closed),concluida_em=clock_timestamp() WHERE id=o.id;
 PERFORM sucessores53.replay(uid,cid,public.multimodal_snapshot(cid));RETURN closed;
END $$;
CREATE FUNCTION sucessores53.estado(uid integer,cid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE ch private47.cadeia%ROWTYPE;s jsonb;initial jsonb;ps jsonb;jn numeric;received boolean;available53 boolean:=false;
BEGIN
 PERFORM sucessores53.verificar();PERFORM private47.travar(uid,cid);s:=sucessores53.replay(uid,cid,public.multimodal_snapshot(cid));SELECT * INTO STRICT ch FROM private47.cadeia WHERE sucessor_id=cid AND user_id=uid;
 SELECT auditoria->'sucessor' INTO STRICT initial FROM private47.operacoes WHERE id=ch.operacao_id;
 received:=s->'ledger'<>'[]'::jsonb;
 -- Replay/ownership/catalog are already certified above. Ineligible dates/paid cohort
 -- remain readable, but can never advertise a maintenance capability.
 BEGIN
  PERFORM sucessores53.abertas(uid,s,clock_timestamp());available53:=true;
 EXCEPTION WHEN SQLSTATE '0A000' OR SQLSTATE '23514' THEN available53:=false;
 END;
 SELECT sum((j->>'valor_juros')::numeric),jsonb_agg(jsonb_build_object('parcelaId',(j->>'id')::int,'B',((j->>'valor_original')::numeric-(j->>'valor_juros')::numeric)::numeric(15,2)::text,'Jn',(j->>'valor_juros')::numeric(15,2)::text,'P',NULL,'Jt',NULL,'A',NULL,'U',NULL,'alocacaoIndividual','indisponivel_historica','dataVencimento',j->>'data_vencimento','valor',(j->>'valor_original')::numeric(15,2)::text) ORDER BY (j->>'numero')::int) INTO jn,ps FROM jsonb_array_elements(s->'parcelas') j;
 RETURN jsonb_build_object('versao','sucessores53_composicao_v1','userId',uid,'contratoId',cid,'paiId',ch.origem_id,'raizId',ch.origem_id,'proveniencia','sucessor47','P',ch.principal_original::text,'Jt',ch.juros_embutidos::text,'A',ch.obrigacao_adicional::text,'U','0.00','B',ch.saldo_transferido::text,'Jn',jn::numeric(15,2)::text,'total',(ch.saldo_transferido+jn)::numeric(15,2)::text,'componentesGlobais','obrigacao_acordada_nao_saldo_por_componente','saldoPorComponenteDisponivel',NOT received,'manutencaoDisponivel',available53,'parcelas',ps);
END $$;
CREATE FUNCTION sucessores53.imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='operacoes' AND TG_OP='UPDATE' THEN
  IF OLD.resultado IS NULL AND NEW.resultado IS NOT NULL AND OLD.xmin::text::xid8=pg_current_xact_id() AND (to_jsonb(OLD)-ARRAY['depois','resultado','hash_resultado','concluida_em'])=(to_jsonb(NEW)-ARRAY['depois','resultado','hash_resultado','concluida_em']) THEN RETURN NEW;END IF;
 END IF;
 RAISE EXCEPTION '53 prova/capacidade imutável' USING ERRCODE='42501';
END $$;
CREATE FUNCTION sucessores53.commit_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM sucessores53.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) OR NOT EXISTS(SELECT 1 FROM sucessores53.operacoes WHERE id=NEW.id AND resultado IS NOT NULL) THEN RAISE EXCEPTION '53 commit incompleto' USING ERRCODE='23514';END IF;
 PERFORM sucessores53.replay(NEW.user_id,NEW.contrato_id,public.multimodal_snapshot(NEW.contrato_id));RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER commit_check53 AFTER INSERT OR UPDATE ON sucessores53.operacoes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sucessores53.commit_check();
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['operacoes','fences','manifesto'] LOOP EXECUTE format('CREATE TRIGGER imutavel53 BEFORE UPDATE OR DELETE ON sucessores53.%I FOR EACH ROW EXECUTE FUNCTION sucessores53.imutavel()',t);EXECUTE format('CREATE TRIGGER no_truncate53 BEFORE TRUNCATE ON sucessores53.%I FOR EACH STATEMENT EXECUTE FUNCTION sucessores53.imutavel()',t);END LOOP;
 FOREACH t IN ARRAY ARRAY['operacoes','fences','manifesto','capacidades'] LOOP EXECUTE format('ALTER TABLE sucessores53.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON TABLE sucessores53.%I FROM PUBLIC,anon,authenticated,service_role',t);END LOOP;
END $$;
CREATE FUNCTION sucessores53.metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT sucessores53.hash(jsonb_build_object('schema',(SELECT to_jsonb(n) FROM pg_namespace n WHERE nspname='sucessores53'),
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='sucessores53'::regnamespace OR proname IN('rpc_cotar_sucessores53','rpc_executar_sucessores53','rpc_conferir_sucessores53','rpc_estado_sucessores53')),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY oid) FROM pg_class c WHERE relnamespace='sucessores53'::regnamespace),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE relnamespace='sucessores53'::regnamespace),
 'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY oid) FROM pg_constraint k WHERE connamespace='sucessores53'::regnamespace),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE relnamespace='sucessores53'::regnamespace),
 'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE relnamespace='sucessores53'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE relnamespace='sucessores53'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE relnamespace='sucessores53'::regnamespace)));
$$;
CREATE FUNCTION sucessores53.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM obrigacoes51.verificar();IF (SELECT assinatura FROM sucessores53.manifesto WHERE id=1) IS DISTINCT FROM sucessores53.metadata() THEN RAISE EXCEPTION '53 metadata divergente; sem reseal runtime' USING ERRCODE='55000';END IF;
END $$;
CREATE FUNCTION public.rpc_cotar_sucessores53(p_user_id integer,p_contrato_id integer,p_proposta jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT sucessores53.cotar(p_user_id,p_contrato_id,p_proposta) $$;
CREATE FUNCTION public.rpc_executar_sucessores53(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT sucessores53.executar(p_user_id,p_chave,p_request,false) $$;
CREATE FUNCTION public.rpc_conferir_sucessores53(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT sucessores53.executar(p_user_id,p_chave,p_request,true) $$;
CREATE FUNCTION public.rpc_estado_sucessores53(p_user_id integer,p_contrato_id integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT sucessores53.estado(p_user_id,p_contrato_id) $$;
DO $$ DECLARE p record;BEGIN
 FOR p IN SELECT pp.oid,n.nspname,pp.proname,pg_get_function_identity_arguments(pp.oid) args FROM pg_proc pp JOIN pg_namespace n ON n.oid=pp.pronamespace WHERE n.nspname='sucessores53' OR pp.proname IN('rpc_cotar_sucessores53','rpc_executar_sucessores53','rpc_conferir_sucessores53','rpc_estado_sucessores53') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated,service_role',p.nspname,p.proname,p.args);IF p.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',p.nspname,p.proname,p.args);END IF;END LOOP;
END $$;
