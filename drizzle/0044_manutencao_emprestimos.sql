-- CANDIDATO OFFLINE44 FINAL: agenda mensal prospectiva completa, N1..60, SEM valores/juros/exclusões.
-- Baseline certificado:20..37 congelados ->42final SHA0df0301ade56145681b721da149fc3048a46ed630cfe1be771c0bcfcf25c83fb
-- ->41final SHAdead49422eecd04c18b241dd0f4c4421f0e8edc1e5ccc9ecebda10adfc76bb6d.
-- Não substitui QUALQUER função predecessora, em especial ponte8; não apaga delta42/41.
-- Janela DDL exclusiva; só public é exposto PostgREST; manutencao44 fica privado.
-- Não habilitar flag/GOprod sem catálogo físico autorizado e prova REST real.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.contratos,public.parcelas,public.ciclo_estados,public.ciclo_autorizacoes,
 public.emprestimos_rpc_origens,public.emprestimos_rpc_operacoes,public.contrato_historico,
 public.contas_caixa,public.transacoes_caixa,public.clientes,public.koletores IN SHARE ROW EXCLUSIVE MODE;
DO $gate44$
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed'
 OR current_user IN('service_role','anon','authenticated') THEN RAISE EXCEPTION '0044 exige owner PG17/Read Committed' USING ERRCODE='55000'; END IF;
 IF to_regnamespace('manutencao44') IS NOT NULL THEN RAISE EXCEPTION '0044 one-shot/homônimo recusado' USING ERRCODE='55000'; END IF;
 PERFORM public.caixa37_verificar();
 IF to_regclass('public.assinaturas42_operacoes') IS NULL OR to_regnamespace('telefone41') IS NULL THEN RAISE EXCEPTION '0044 exige baseline42final ->41final' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname IN('rpc_cotar_calendario44','rpc_executar_calendario44','rpc_conferir_calendario44')) THEN RAISE EXCEPTION '0044 facade homônima/overload recusada' USING ERRCODE='55000'; END IF;
END $gate44$;
-- Testemunho de TODAS as fontes/ACL/config existentes (inclui42final e41final).
CREATE TEMP TABLE manutencao44_witness ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p) snapshot,CASE WHEN prokind IN('f','p') THEN pg_get_functiondef(p.oid) END definition
 FROM pg_proc p WHERE pronamespace NOT IN (SELECT oid FROM pg_namespace WHERE nspname LIKE 'pg_%' OR nspname='information_schema');
CREATE TEMP TABLE manutencao44_catalog_witness ON COMMIT DROP AS
 SELECT 'class' kind,c.oid::text oid,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] snapshot FROM pg_class c WHERE relnamespace='public'::regnamespace
 UNION ALL SELECT 'attribute',a.oid,to_jsonb(a) FROM (SELECT (attrelid::bigint*10000+attnum)::text oid,a.* FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND a.attnum>0) a
 UNION ALL SELECT 'trigger',t.oid::text,to_jsonb(t) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace
 UNION ALL SELECT 'constraint',k.oid::text,to_jsonb(k) FROM pg_constraint k WHERE connamespace='public'::regnamespace
 UNION ALL SELECT 'policy',p.oid::text,to_jsonb(p) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace;
CREATE SCHEMA manutencao44;
REVOKE ALL ON SCHEMA manutencao44 FROM PUBLIC,anon,authenticated,service_role;
-- Nenhum acesso ao namespace privado; somente facades public service_role-only.
CREATE TABLE manutencao44.operacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id integer NOT NULL CHECK(user_id>0),chave uuid NOT NULL,
 contrato_id integer NOT NULL CHECK(contrato_id>0),request jsonb NOT NULL,hash_payload text NOT NULL CHECK(hash_payload ~ '^[a-f0-9]{64}$'),
 antes jsonb NOT NULL,depois jsonb,resultado jsonb,concluida_em timestamptz,
 UNIQUE(user_id,chave),CHECK((depois IS NULL AND resultado IS NULL AND concluida_em IS NULL) OR (depois IS NOT NULL AND resultado IS NOT NULL AND concluida_em IS NOT NULL))
);
ALTER TABLE manutencao44.operacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON manutencao44.operacoes FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION manutencao44.imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_OP<>'UPDATE' OR OLD.resultado IS NOT NULL OR (to_jsonb(OLD)-ARRAY['depois','resultado','concluida_em']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['depois','resultado','concluida_em']) OR NEW.resultado IS NULL THEN
 RAISE EXCEPTION 'Operação44 concluída imutável' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER operacao_imutavel BEFORE UPDATE OR DELETE ON manutencao44.operacoes FOR EACH ROW EXECUTE FUNCTION manutencao44.imutavel();

-- Fence sem FK pública: fechar ausência não adota contrato nem exige vínculo elegível.
CREATE TABLE manutencao44.fences(
 user_id integer NOT NULL CHECK(user_id>0),chave uuid NOT NULL,request jsonb NOT NULL,
 hash_payload text NOT NULL CHECK(hash_payload=encode(extensions.digest(request::text,'sha256'),'hex')),
 fechado_em timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(user_id,chave)
);
ALTER TABLE manutencao44.fences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON manutencao44.fences FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION manutencao44.fence_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Fence44 fechado imutável' USING ERRCODE='42501'; END $$;
CREATE TRIGGER fence_imutavel BEFORE UPDATE OR DELETE ON manutencao44.fences FOR EACH ROW EXECUTE FUNCTION manutencao44.fence_imutavel();
CREATE TRIGGER fence_no_truncate BEFORE TRUNCATE ON manutencao44.fences FOR EACH STATEMENT EXECUTE FUNCTION manutencao44.fence_imutavel();
CREATE TRIGGER operacoes_no_truncate BEFORE TRUNCATE ON manutencao44.operacoes FOR EACH STATEMENT EXECUTE FUNCTION manutencao44.fence_imutavel();
CREATE FUNCTION manutencao44.agenda(cid integer,dias date[],inicio date,n integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE i integer;
BEGIN
 IF dias IS NULL OR array_ndims(dias) IS DISTINCT FROM 1 OR array_lower(dias,1) IS DISTINCT FROM 1 OR cardinality(dias) IS DISTINCT FROM n OR n NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Agenda44 exige exatamente N datas' USING ERRCODE='22023'; END IF;
 FOR i IN 1..n LOOP
 IF dias[i] IS NULL OR NOT isfinite(dias[i]) OR dias[i] NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' OR dias[i]<inicio
 OR (n>1 AND extract(day FROM dias[1])>28) OR dias[i] IS DISTINCT FROM (dias[1]+make_interval(months=>i-1))::date THEN RAISE EXCEPTION 'Agenda44 mensal consecutiva inválida' USING ERRCODE='22023'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION manutencao44.validar(uid integer,cid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; c jsonb; p jsonb; op jsonb; n integer; i integer:=0; juros numeric; total numeric; ref numeric; jr numeric;
BEGIN
 PERFORM public.caixa37_verificar();
 IF uid IS NULL OR uid<=0 OR cid IS NULL OR cid<=0 OR NOT EXISTS(SELECT 1 FROM public.contratos WHERE id=cid AND user_id=uid) THEN RAISE EXCEPTION 'Contrato44 indisponível' USING ERRCODE='42501'; END IF;
 -- NÃO adota legado, multimodal, multas ou recebimentos/renovações pré-existentes.
 IF NOT EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid AND user_id=uid)
 OR EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.ciclo_operacoes WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.renovacao_operacoes WHERE contrato_id=cid)
 THEN RAISE EXCEPTION 'Contrato44 fora do incremento sem pagamentos' USING ERRCODE='23514'; END IF;
 PERFORM public.multa36_vinculos(uid,cid);
 s:=public.ciclo_validar(uid,cid); c:=s->'contrato';
 SELECT to_jsonb(o) INTO op FROM public.emprestimos_rpc_operacoes o JOIN public.emprestimos_rpc_origens r ON r.operacao_id=o.id WHERE r.contrato_id=cid;
 n:=(op->'payload'->>'numeroParcelas')::int;
 -- Além do selo atual, conservar a criação inteira, exceto os únicos campos de calendário.
 IF c-ARRAY['data_vencimento','data_vencimento_primeira','dia_vencimento','updatedAt'] IS DISTINCT FROM (op->'auditoria'->'contrato')-ARRAY['data_vencimento','data_vencimento_primeira','dia_vencimento','updatedAt']
 OR c->>'status' IS DISTINCT FROM 'ativo' OR c->>'modalidade' IS DISTINCT FROM 'mensal' OR c->>'tipo_taxa' IS DISTINCT FROM 'mensal'
 OR jsonb_array_length(s->'parcelas') IS DISTINCT FROM n OR n NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Criação44 não conservada' USING ERRCODE='23514'; END IF;
 -- O snapshot de criação usa contrato/parcelas; livro deve ter APENAS o débito comprovado.
 IF jsonb_array_length(s->'ledger')<>1 OR NOT EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens o JOIN public.transacoes_caixa t ON t.id=o.transacao_caixa_id WHERE o.contrato_id=cid AND t.contrato_id=cid AND t.user_id=uid AND t.parcela_id IS NULL AND t.tipo='saida' AND t.categoria='emprestimo_liberado' AND t.valor=(c->>'valor_principal')::numeric AND t.conta_caixa_id=(c->>'conta_caixa_id')::int AND t.data_transacao=(c->>'data_inicio')::date) THEN RAISE EXCEPTION 'Livro44 não é apenas desembolso' USING ERRCODE='23514'; END IF;
 juros:=round((c->>'valor_principal')::numeric*(c->>'taxa_juros')::numeric/100*n,2); total:=(c->>'valor_principal')::numeric+juros; ref:=round(total/n,2); jr:=round(juros/n,2);
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') LOOP
 i:=i+1;
 IF p-ARRAY['data_vencimento','status','updatedAt'] IS DISTINCT FROM (op->'auditoria'->'parcelas'->(i-1))-ARRAY['data_vencimento','status','updatedAt']
 OR (p->>'numero')::int IS DISTINCT FROM i OR (p->>'numero_parcela')::int IS DISTINCT FROM i
 OR (p->>'valor')::numeric IS DISTINCT FROM (CASE WHEN i=n THEN total-ref*(n-1) ELSE ref END)
 OR (p->>'valor_original')::numeric IS DISTINCT FROM (p->>'valor')::numeric
 OR (p->>'valor_juros')::numeric IS DISTINCT FROM (CASE WHEN i=n THEN juros-jr*(n-1) ELSE jr END)
 OR p->>'status' NOT IN('pendente','atrasada','vencendo_hoje') OR (p->>'valor_pago')::numeric IS DISTINCT FROM 0::numeric
 OR (p->>'saldo_residual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_multa')::numeric IS DISTINCT FROM 0::numeric
 OR (p->>'multa_manual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_diaria_usada')::numeric IS DISTINCT FROM 0::numeric
 OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Parcela44 não conservada' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN s;
END $$;
CREATE FUNCTION manutencao44.cotar(p_user_id integer,p_contrato_id integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; aid integer;
BEGIN
 SELECT conta_caixa_id INTO aid FROM public.contratos WHERE id=p_contrato_id AND user_id=p_user_id;
 IF aid IS NULL THEN RAISE EXCEPTION 'Contrato44 indisponível' USING ERRCODE='42501'; END IF;
 PERFORM public.legados_travar(p_user_id,p_contrato_id,aid); s:=manutencao44.validar(p_user_id,p_contrato_id);
 RETURN jsonb_build_object('contratoId',p_contrato_id,'estadoHash',encode(extensions.digest(s::text,'sha256'),'hex'),'regra','calendario_mensal_sem_baixa_v1',
 'parcelasIds',(SELECT jsonb_agg((p->>'id')::int ORDER BY (p->>'numero')::int) FROM jsonb_array_elements(s->'parcelas') p),
 'vencimentos',(SELECT jsonb_agg(p->>'data_vencimento' ORDER BY (p->>'numero')::int) FROM jsonb_array_elements(s->'parcelas') p));
END $$;
CREATE FUNCTION manutencao44.request(cid integer,estado text,dias date[],motivo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF cid IS NULL OR cid<=0 OR estado IS NULL OR estado !~ '^[a-f0-9]{64}$' OR motivo IS NULL OR length(btrim(motivo)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Intenção44 inválida' USING ERRCODE='22023'; END IF;
 PERFORM manutencao44.agenda(cid,dias,DATE '1900-01-01',cardinality(dias));
 RETURN jsonb_build_object('contratoId',cid,'estadoHash',estado,'vencimentos',dias,'motivo',btrim(motivo));
END $$;
CREATE FUNCTION manutencao44.executar(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_estado_hash text,p_vencimentos date[],p_motivo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE req jsonb; o manutencao44.operacoes%ROWTYPE; antes jsonb; v_depois jsonb; esperado jsonb; ps jsonb:='[]'; p jsonb; c jsonb; h jsonb; r jsonb; aid integer; i integer:=0; hoje date; instante timestamptz;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave_idempotencia IS NULL THEN RAISE EXCEPTION 'Owner/UUID44 obrigatório' USING ERRCODE='22023'; END IF;
 req:=manutencao44.request(p_contrato_id,p_estado_hash,p_vencimentos,p_motivo);
 PERFORM pg_advisory_xact_lock(hashtextextended('manutencao44:'||p_user_id::text||':'||p_chave_idempotencia::text,44));
 PERFORM manutencao44.verificar();
 IF EXISTS(SELECT 1 FROM manutencao44.fences WHERE user_id=p_user_id AND chave=p_chave_idempotencia) THEN
  IF EXISTS(SELECT 1 FROM manutencao44.fences WHERE user_id=p_user_id AND chave=p_chave_idempotencia AND request IS DISTINCT FROM req) THEN RAISE EXCEPTION 'UUID44 fenced payload divergente' USING ERRCODE='23505'; END IF;
  RAISE EXCEPTION 'Intenção44 encerrada por fence durável' USING ERRCODE='23514';
 END IF;
 SELECT conta_caixa_id INTO aid FROM public.contratos WHERE id=p_contrato_id AND user_id=p_user_id;
 IF aid IS NULL THEN RAISE EXCEPTION 'Contrato44 indisponível' USING ERRCODE='42501'; END IF;
 PERFORM public.legados_travar(p_user_id,p_contrato_id,aid); PERFORM public.caixa37_verificar();
 SELECT id,user_id,chave,contrato_id,request,hash_payload,operacoes.antes,operacoes.depois,resultado,concluida_em INTO o FROM manutencao44.operacoes WHERE user_id=p_user_id AND chave=p_chave_idempotencia;
 IF FOUND THEN
 IF o.request IS DISTINCT FROM req OR o.hash_payload IS DISTINCT FROM encode(extensions.digest(req::text,'sha256'),'hex') THEN RAISE EXCEPTION 'UUID44 payload divergente' USING ERRCODE='23505'; END IF;
 IF o.resultado IS NULL THEN RAISE EXCEPTION 'Intenção44 incompleta' USING ERRCODE='23514'; END IF;
 RETURN o.resultado||jsonb_build_object('repetida',true);
 END IF;
 antes:=manutencao44.validar(p_user_id,p_contrato_id);
 IF encode(extensions.digest(antes::text,'sha256'),'hex') IS DISTINCT FROM p_estado_hash THEN RAISE EXCEPTION 'Cotação44 desatualizada' USING ERRCODE='40001'; END IF;
 PERFORM manutencao44.agenda(p_contrato_id,p_vencimentos,(antes->'contrato'->>'data_inicio')::date,jsonb_array_length(antes->'parcelas'));
 IF to_jsonb(p_vencimentos)=(SELECT jsonb_agg(j->>'data_vencimento' ORDER BY (j->>'numero')::int) FROM jsonb_array_elements(antes->'parcelas') j) THEN RAISE EXCEPTION 'Agenda44 sem alteração' USING ERRCODE='22023'; END IF;
 INSERT INTO manutencao44.operacoes(user_id,chave,contrato_id,request,hash_payload,antes) VALUES(p_user_id,p_chave_idempotencia,p_contrato_id,req,encode(extensions.digest(req::text,'sha256'),'hex'),antes) RETURNING id INTO o.id;
 instante:=clock_timestamp(); hoje:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
 -- Reusa capacidade privada existente: somente esta função tem EXECUTE de autorizar.
 -- Nenhum helper/triggers/selos predecessor é modificado ou re-selado.
 PERFORM public.ciclo_autorizar('receber',aid,p_contrato_id);
 FOR p IN SELECT value FROM jsonb_array_elements(antes->'parcelas') LOOP
 i:=i+1; p:=p||jsonb_build_object('data_vencimento',p_vencimentos[i],'status',CASE WHEN p_vencimentos[i]<hoje THEN 'atrasada' WHEN p_vencimentos[i]=hoje THEN 'vencendo_hoje' ELSE 'pendente' END,'updatedAt',instante);
 UPDATE public.parcelas SET data_vencimento=p_vencimentos[i],status=p->>'status',"updatedAt"=instante WHERE id=(p->>'id')::int AND contrato_id=p_contrato_id AND user_id=p_user_id;
 ps:=ps||jsonb_build_array(p);
 END LOOP;
 c:=(antes->'contrato')||jsonb_build_object('data_vencimento_primeira',p_vencimentos[1],'data_vencimento',p_vencimentos[cardinality(p_vencimentos)],'dia_vencimento',extract(day FROM p_vencimentos[1])::int,'updatedAt',instante);
 UPDATE public.contratos SET data_vencimento_primeira=p_vencimentos[1],data_vencimento=p_vencimentos[cardinality(p_vencimentos)],dia_vencimento=extract(day FROM p_vencimentos[1])::int,"updatedAt"=instante WHERE id=p_contrato_id AND user_id=p_user_id;
 INSERT INTO public.contrato_historico(contrato_id,user_id,tipo,descricao,created_at) VALUES(p_contrato_id,p_user_id::text,'edicao_calendario','Calendário auditado '||o.id::text||': '||btrim(p_motivo),instante) RETURNING to_jsonb(contrato_historico) INTO h;
 esperado:=antes||jsonb_build_object('contrato',c,'parcelas',ps,'historico',(antes->'historico')||jsonb_build_array(h));
 v_depois:=public.ciclo_snapshot(p_contrato_id);
 IF v_depois IS DISTINCT FROM esperado THEN RAISE EXCEPTION 'Delta44 fora do calendário previsto' USING ERRCODE='23514'; END IF;
 UPDATE public.ciclo_estados SET snapshot=v_depois WHERE contrato_id=p_contrato_id AND user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Selo44 predecessor ausente' USING ERRCODE='23514'; END IF;
 DELETE FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid();
 PERFORM manutencao44.validar(p_user_id,p_contrato_id);
 r:=jsonb_build_object('success',true,'repetida',false,'operationId',o.id,'idempotencyKey',p_chave_idempotencia,'contratoId',p_contrato_id,'vencimentos',p_vencimentos,'regra','calendario_mensal_sem_baixa_v1');
 UPDATE manutencao44.operacoes SET depois=v_depois,resultado=r,concluida_em=instante WHERE id=o.id;
 RETURN r;
END $$;
-- Conferência terminal: observa commit existente OU fecha ausência sob MESMO lock UUID.
CREATE FUNCTION manutencao44.conferir(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_estado_hash text,p_vencimentos date[],p_motivo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE req jsonb; op manutencao44.operacoes%ROWTYPE; f manutencao44.fences%ROWTYPE;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave_idempotencia IS NULL THEN RAISE EXCEPTION 'Owner/UUID44 obrigatório' USING ERRCODE='22023'; END IF;
 req:=manutencao44.request(p_contrato_id,p_estado_hash,p_vencimentos,p_motivo);
 PERFORM pg_advisory_xact_lock(hashtextextended('manutencao44:'||p_user_id::text||':'||p_chave_idempotencia::text,44));
 PERFORM manutencao44.verificar();
 SELECT * INTO op FROM manutencao44.operacoes WHERE user_id=p_user_id AND chave=p_chave_idempotencia;
 IF FOUND THEN
  IF op.request IS DISTINCT FROM req OR op.hash_payload IS DISTINCT FROM encode(extensions.digest(req::text,'sha256'),'hex') THEN RAISE EXCEPTION 'UUID44 payload divergente' USING ERRCODE='23505'; END IF;
  IF op.resultado IS NULL THEN RAISE EXCEPTION 'Operação44 sem prova' USING ERRCODE='23514'; END IF;
  RETURN jsonb_build_object('status','confirmed','sameIntentOnly',true,'resultado',op.resultado);
 END IF;
 SELECT * INTO f FROM manutencao44.fences WHERE user_id=p_user_id AND chave=p_chave_idempotencia;
 IF FOUND THEN
  IF f.request IS DISTINCT FROM req OR f.hash_payload IS DISTINCT FROM encode(extensions.digest(req::text,'sha256'),'hex') THEN RAISE EXCEPTION 'UUID44 fenced payload divergente' USING ERRCODE='23505'; END IF;
 ELSE
  INSERT INTO manutencao44.fences(user_id,chave,request,hash_payload) VALUES(p_user_id,p_chave_idempotencia,req,encode(extensions.digest(req::text,'sha256'),'hex'));
 END IF;
 RETURN req||jsonb_build_object('status','fenced','regra','calendario44_fence_v1','idempotencyKey',p_chave_idempotencia);
END $$;
CREATE TABLE manutencao44.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);
ALTER TABLE manutencao44.manifesto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON manutencao44.manifesto FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION manutencao44.metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(extensions.digest(jsonb_build_object(
 'schema',(SELECT to_jsonb(n) FROM pg_namespace n WHERE nspname='manutencao44'),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE pronamespace='manutencao44'::regnamespace),
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relkind,c.relpersistence) ORDER BY c.oid) FROM pg_class c WHERE relnamespace='manutencao44'::regnamespace),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='manutencao44'::regnamespace),
 'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='manutencao44'::regnamespace),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE c.relnamespace='manutencao44'::regnamespace),
 'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE connamespace='manutencao44'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='manutencao44'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='manutencao44'::regnamespace)
 )::text,'sha256'),'hex')
$$;
CREATE FUNCTION manutencao44.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.caixa37_verificar();
 IF (SELECT assinatura FROM manutencao44.manifesto WHERE id=1) IS DISTINCT FROM manutencao44.metadata() THEN RAISE EXCEPTION 'Selo44 divergente; nunca reseal runtime' USING ERRCODE='55000'; END IF;
END $$;
CREATE FUNCTION public.rpc_cotar_calendario44(p_user_id integer,p_contrato_id integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN PERFORM manutencao44.verificar(); RETURN manutencao44.cotar(p_user_id,p_contrato_id); END $$;
CREATE FUNCTION public.rpc_executar_calendario44(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_estado_hash text,p_vencimentos date[],p_motivo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN PERFORM manutencao44.verificar(); RETURN manutencao44.executar(p_user_id,p_chave_idempotencia,p_contrato_id,p_estado_hash,p_vencimentos,p_motivo); END $$;
CREATE FUNCTION public.rpc_conferir_calendario44(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_estado_hash text,p_vencimentos date[],p_motivo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN PERFORM manutencao44.verificar(); RETURN manutencao44.conferir(p_user_id,p_chave_idempotencia,p_contrato_id,p_estado_hash,p_vencimentos,p_motivo); END $$;
DO $acl44$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='manutencao44'::regnamespace LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f); END LOOP;
END $acl44$;
REVOKE ALL ON FUNCTION public.rpc_cotar_calendario44(integer,integer),public.rpc_executar_calendario44(integer,uuid,integer,text,date[],text),public.rpc_conferir_calendario44(integer,uuid,integer,text,date[],text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cotar_calendario44(integer,integer),public.rpc_executar_calendario44(integer,uuid,integer,text,date[],text),public.rpc_conferir_calendario44(integer,uuid,integer,text,date[],text) TO service_role;
-- Fonte/config/owner/ACL exatos de TODOS objetos novos, antes de qualquer selo.
DO $new44$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements($pins44$[{"signature":"manutencao44.imutavel()","hash":"209dddb51e1c5306dc04969a1ef0bb04ae4e4ef5649ecf4efe1c1f1543b9cba8","config":["search_path=pg_catalog, pg_temp"],"public":false},{"signature":"manutencao44.fence_imutavel()","hash":"135c7d79ac01fbbb63923a6c2c7c0360c92d21fee85f9123d46bc92c455e4daf","config":["search_path=pg_catalog, pg_temp"],"public":false},{"signature":"manutencao44.agenda(integer,date[],date,integer)","hash":"a41ea8cd91801a6b066ab8ee789935f6e39170c3ce62804a9ffb80ae2ebec9fc","config":["search_path=pg_catalog, pg_temp"],"public":false},{"signature":"manutencao44.validar(integer,integer)","hash":"b3313d4e132ec2d3b94719c71498ad8f9377177c2c588d44041cfbdd4c3f12e1","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"public":false},{"signature":"manutencao44.cotar(integer,integer)","hash":"b1775af387c779baa36125c386cbd7b0f329778f72a9ad89c082f1c22e7a551b","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"public":false},{"signature":"manutencao44.request(integer,text,date[],text)","hash":"9f00d4d0e8c807060493e6e2e015d50988ac28e5809d469eaa3469e4618fa786","config":["search_path=pg_catalog, pg_temp"],"public":false},{"signature":"manutencao44.executar(integer,uuid,integer,text,date[],text)","hash":"210248249ac8f1f8c9bc55400fc629bb3a2770768c3f35568b26e782aca1dbbe","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"public":false},{"signature":"manutencao44.conferir(integer,uuid,integer,text,date[],text)","hash":"9a1414d93b33e0dd373a4dc982058069bceb6f32a99a906b9e05c409975e87a7","config":["search_path=pg_catalog, pg_temp"],"public":false},{"signature":"manutencao44.metadata()","hash":"b21111e8daa53f740d0ebe97f8b892ec5dc2a95eb66e36d43bfee3fae6f3c7ec","config":["search_path=pg_catalog, pg_temp"],"public":false},{"signature":"manutencao44.verificar()","hash":"e1a7f5b3c6a0b138e428e12505f4681005cdf1c0d00c3f028cc4b1a65a6953ad","config":["search_path=pg_catalog, pg_temp"],"public":false},{"signature":"public.rpc_cotar_calendario44(integer,integer)","hash":"e9970839123534d48e29020fd7e57fcd8794df322552ad221a3ee470d3c9c9f2","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"public":true},{"signature":"public.rpc_executar_calendario44(integer,uuid,integer,text,date[],text)","hash":"d5494d6d077458d6bf92509471178bf93ce5c64398ae632bcdaf9c56566bb03e","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"public":true},{"signature":"public.rpc_conferir_calendario44(integer,uuid,integer,text,date[],text)","hash":"0baee9d1e75a61d0aff551b6b87cb4c09531ecec5517c161d4a247f6d21ebbcc","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"public":true}]$pins44$::jsonb) LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(e->>'signature');
  IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config' OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
   OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
   OR has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM (e->>'public')::boolean
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner AND NOT(a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role') AND (e->>'public')::boolean AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
  THEN RAISE EXCEPTION '0044 fonte/config/owner/ACL nova divergente %',e->>'signature' USING ERRCODE='55000'; END IF;
 END LOOP;
END $new44$;
DO $unchanged44$ DECLARE w record; actual jsonb; BEGIN
 FOR w IN SELECT oid,snapshot,definition FROM manutencao44_witness LOOP
  IF (SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid=w.oid) IS DISTINCT FROM w.snapshot OR (w.definition IS NOT NULL AND pg_get_functiondef(w.oid) IS DISTINCT FROM w.definition) THEN RAISE EXCEPTION '0044 predecessor alterado' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND NOT EXISTS(SELECT 1 FROM manutencao44_witness prior WHERE prior.oid=p.oid))<>3
 OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND NOT EXISTS(SELECT 1 FROM manutencao44_witness prior WHERE prior.oid=p.oid) AND p.proname NOT IN('rpc_cotar_calendario44','rpc_executar_calendario44','rpc_conferir_calendario44')) THEN RAISE EXCEPTION '0044 delta public fora da allowlist' USING ERRCODE='55000'; END IF;
 FOR w IN SELECT * FROM manutencao44_catalog_witness LOOP
  CASE w.kind
  WHEN 'class' THEN SELECT to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] INTO actual FROM pg_class c WHERE c.oid=w.oid::oid;
  WHEN 'attribute' THEN SELECT to_jsonb(a) INTO actual FROM (SELECT (attrelid::bigint*10000+attnum)::text oid,a.* FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND a.attnum>0) a WHERE a.oid=w.oid;
  WHEN 'trigger' THEN SELECT to_jsonb(t) INTO actual FROM pg_trigger t WHERE t.oid=w.oid::oid;
  WHEN 'constraint' THEN SELECT to_jsonb(k) INTO actual FROM pg_constraint k WHERE k.oid=w.oid::oid;
  WHEN 'policy' THEN SELECT to_jsonb(p) INTO actual FROM pg_policy p WHERE p.oid=w.oid::oid;
  END CASE;
  IF actual IS DISTINCT FROM w.snapshot THEN RAISE EXCEPTION '0044 catálogo predecessor alterado % %',w.kind,w.oid USING ERRCODE='55000'; END IF;
 END LOOP;
END $unchanged44$;
INSERT INTO manutencao44.manifesto VALUES(1,manutencao44.metadata());
-- SOMENTE instalação: original37 passou e fontes intactas+delta exato conferidos acima.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
SELECT manutencao44.verificar();
NOTIFY pgrst,'reload schema';
COMMIT;
