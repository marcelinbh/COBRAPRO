-- CANDIDATO LOCAL, NÃO APLICADO EM PRODUÇÃO. Não substitui despesas38_v1.
-- Menor incremento: somente cancelar obrigação20 pendente e byte-exata, sem Caixa.
-- Baseline: predecessores20..37 congelados, mais42final e41final quando presentes.
-- Sem ponte, CREATE OR REPLACE predecessor, alteração de exposed schemas ou runtime reseal.
-- Facades public exatas: somente service_role. Janela DDL exclusiva obrigatória.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
DO $preflight$
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'Cancelamento exige PostgreSQL17/Read Committed' USING ERRCODE='55000'; END IF;
 -- Nunca adotar/reconstruir o namespace38 privado histórico incompleto.
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='despesa_cancelamento_v1')
 OR EXISTS(SELECT 1 FROM pg_class WHERE relname LIKE 'despesas38\_%' ESCAPE '\')
 OR EXISTS(SELECT 1 FROM pg_proc WHERE proname LIKE 'despesas38\_%' ESCAPE '\') THEN
  RAISE EXCEPTION 'Namespace existente: revisão independente necessária' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND NOT rolsuper AND NOT rolcreaterole)
 OR pg_has_role('service_role',current_user,'MEMBER') THEN
  RAISE EXCEPTION 'Backend/owner incompatível' USING ERRCODE='55000'; END IF;
 PERFORM public.legados_verificar();
 PERFORM public.multimodal_verificar();
 PERFORM public.multa36_verificar();
 PERFORM public.caixa37_verificar();
END $preflight$;
CREATE TEMP TABLE despesas38c_witness ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p) snapshot,CASE WHEN p.prokind IN('f','p','w') THEN pg_get_functiondef(p.oid) END definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_temp_%';
CREATE TEMP TABLE despesas38c_environment ON COMMIT DROP AS SELECT jsonb_build_object(
 'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY oid) FROM pg_namespace n WHERE nspname NOT LIKE 'pg_temp_%' AND nspname NOT LIKE 'pg_toast_temp_%'),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_default_acl d),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r),
 'members',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m),
 'settings',(SELECT jsonb_agg(to_jsonb(d) ORDER BY setdatabase,setrole) FROM pg_db_role_setting d),
 'classes',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname NOT LIKE 'pg_temp_%' AND ns.nspname NOT LIKE 'pg_toast_temp_%'),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT c.oid FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname NOT LIKE 'pg_temp_%' AND ns.nspname NOT LIKE 'pg_toast_temp_%'))
 ) snapshot;
CREATE SCHEMA despesa_cancelamento_v1;
REVOKE ALL ON SCHEMA despesa_cancelamento_v1 FROM PUBLIC,anon,authenticated,service_role;
-- Nenhum acesso direto: service_role usa somente as facades public.
-- Sem FK para public: seus triggers internos invalidariam o selo37.
-- Vínculos owner/despesa/origem são revalidados sob locks na transação real.
CREATE TABLE despesa_cancelamento_v1.operacoes (
 user_id integer NOT NULL CHECK(user_id>0),
 chave uuid NOT NULL,
 operacao_id uuid NOT NULL UNIQUE,
 despesa_id integer NOT NULL CHECK(despesa_id>0),
 request jsonb NOT NULL CHECK(jsonb_typeof(request)='object'),
 hash_request bytea NOT NULL CHECK(octet_length(hash_request)=32),
 origem_operation_id uuid NOT NULL,
 antes jsonb NOT NULL CHECK(jsonb_typeof(antes)='object'),
 depois jsonb NOT NULL CHECK(jsonb_typeof(depois)='object'),
 resultado jsonb NOT NULL CHECK(jsonb_typeof(resultado)='object'),
 instante timestamptz NOT NULL,
 PRIMARY KEY(user_id,chave), UNIQUE(despesa_id)
);
ALTER TABLE despesa_cancelamento_v1.operacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE despesa_cancelamento_v1.operacoes FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE despesa_cancelamento_v1.fences (
 user_id integer NOT NULL CHECK(user_id>0), chave uuid NOT NULL, request jsonb NOT NULL,
 hash_request bytea NOT NULL CHECK(octet_length(hash_request)=32), fence_id uuid NOT NULL UNIQUE,
 instante timestamptz NOT NULL, PRIMARY KEY(user_id,chave)
);
CREATE TABLE despesa_cancelamento_v1.flags (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, habilitado boolean NOT NULL,
 ator name NOT NULL DEFAULT session_user, instante timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE despesa_cancelamento_v1.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);
ALTER TABLE despesa_cancelamento_v1.fences ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesa_cancelamento_v1.flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesa_cancelamento_v1.manifesto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA despesa_cancelamento_v1 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA despesa_cancelamento_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION despesa_cancelamento_v1.imutavel() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Cancelamento auditado append-only' USING ERRCODE='42501'; END $$;
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON despesa_cancelamento_v1.operacoes FOR EACH ROW EXECUTE FUNCTION despesa_cancelamento_v1.imutavel();
CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON despesa_cancelamento_v1.operacoes FOR EACH STATEMENT EXECUTE FUNCTION despesa_cancelamento_v1.imutavel();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON despesa_cancelamento_v1.fences FOR EACH ROW EXECUTE FUNCTION despesa_cancelamento_v1.imutavel();
CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON despesa_cancelamento_v1.fences FOR EACH STATEMENT EXECUTE FUNCTION despesa_cancelamento_v1.imutavel();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON despesa_cancelamento_v1.flags FOR EACH ROW EXECUTE FUNCTION despesa_cancelamento_v1.imutavel();
CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON despesa_cancelamento_v1.flags FOR EACH STATEMENT EXECUTE FUNCTION despesa_cancelamento_v1.imutavel();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON despesa_cancelamento_v1.manifesto FOR EACH ROW EXECUTE FUNCTION despesa_cancelamento_v1.imutavel();
CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON despesa_cancelamento_v1.manifesto FOR EACH STATEMENT EXECUTE FUNCTION despesa_cancelamento_v1.imutavel();
CREATE FUNCTION despesa_cancelamento_v1.metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(extensions.digest(jsonb_build_object(
 'schema',(SELECT to_jsonb(n) FROM pg_namespace n WHERE nspname='despesa_cancelamento_v1'),
 'functions',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE pronamespace='despesa_cancelamento_v1'::regnamespace),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY oid) FROM pg_class c WHERE relnamespace='despesa_cancelamento_v1'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='despesa_cancelamento_v1'::regnamespace AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY oid) FROM pg_constraint k WHERE connamespace='despesa_cancelamento_v1'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesa_cancelamento_v1'::regnamespace)),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesa_cancelamento_v1'::regnamespace))
 )::text,'sha256'),'hex')
$$;
CREATE FUNCTION despesa_cancelamento_v1.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.caixa37_verificar();
 IF (SELECT assinatura FROM despesa_cancelamento_v1.manifesto WHERE id=1) IS DISTINCT FROM despesa_cancelamento_v1.metadata() THEN
 RAISE EXCEPTION 'Metadata38c divergente; não reseal runtime' USING ERRCODE='55000'; END IF;
END $$;
CREATE FUNCTION despesa_cancelamento_v1.habilitado() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT coalesce((SELECT habilitado FROM despesa_cancelamento_v1.flags ORDER BY id DESC LIMIT 1),false)
$$;
CREATE FUNCTION despesa_cancelamento_v1.configurar(p_habilitado boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM despesa_cancelamento_v1.verificar();
 IF p_habilitado IS NULL THEN RAISE EXCEPTION 'Flag booleana obrigatória' USING ERRCODE='22023'; END IF;
 INSERT INTO despesa_cancelamento_v1.flags(habilitado) VALUES(p_habilitado);
END $$;
CREATE FUNCTION despesa_cancelamento_v1.request(p_despesa integer,p_origem uuid,p_motivo text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF p_despesa IS NULL OR p_despesa<=0 OR p_origem IS NULL OR p_motivo IS NULL
 OR length(p_motivo) NOT BETWEEN 1 AND 2000 OR p_motivo<>btrim(p_motivo) THEN
  RAISE EXCEPTION 'Cancelamento: intenção inválida' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('despesaId',p_despesa,'origemOperationId',p_origem,'motivo',p_motivo);
END $$;
CREATE FUNCTION despesa_cancelamento_v1.hash(p_user integer,p_request jsonb) RETURNS bytea
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT extensions.digest(convert_to(jsonb_build_object('contrato','despesa_cancelamento_pendente_v1','userId',p_user,'request',p_request)::text,'UTF8'),'sha256')
$$;
CREATE FUNCTION despesa_cancelamento_v1.barreira(p_user integer,p_chave uuid,p_request jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE f public.financial_intent_fences%ROWTYPE;
BEGIN
 IF p_user IS NULL OR p_user<=0 OR p_chave IS NULL THEN
  RAISE EXCEPTION 'Owner/UUID inválido' USING ERRCODE='22023'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'Read Committed obrigatório' USING ERRCODE='55000'; END IF;
 -- Mesma ordem33 ->20 dos writers/recovery publicados. Fence33 não é ignorada.
 PERFORM pg_advisory_xact_lock(hashtextextended('despesa:'||p_user::text||':'||p_chave::text,33));
 SELECT id,user_id,scope,chave,family,request,payload_hash,created_at INTO f FROM public.financial_intent_fences WHERE user_id=p_user AND scope='despesa' AND chave=p_chave;
 IF FOUND THEN
  -- A única fence admitida é a reserva exata criada junto à operação deste contrato.
  -- Não é prova de não execução deste contrato; bloqueia somente writers antigos20/33.
  IF f.family NOT IN('despesa_cancelamento_pendente_v1','despesa_cancelamento_pendente_fenced_v1') THEN
   RAISE EXCEPTION 'UUID já encerrado pelo trilho33' USING ERRCODE='55000'; END IF;
  IF f.request IS DISTINCT FROM p_request OR f.payload_hash IS DISTINCT FROM encode(despesa_cancelamento_v1.hash(p_user,p_request),'hex') THEN
   RAISE EXCEPTION 'UUID reservado com payload divergente' USING ERRCODE='23505'; END IF;
  IF (f.family='despesa_cancelamento_pendente_v1' AND NOT EXISTS(SELECT 1 FROM despesa_cancelamento_v1.operacoes WHERE user_id=p_user AND chave=p_chave))
   OR (f.family='despesa_cancelamento_pendente_fenced_v1' AND NOT EXISTS(SELECT 1 FROM despesa_cancelamento_v1.fences WHERE user_id=p_user AND chave=p_chave AND request=p_request AND hash_request=despesa_cancelamento_v1.hash(p_user,p_request))) THEN
   RAISE EXCEPTION 'Reserva sem operação: conferência necessária' USING ERRCODE='55000'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_chave::text,20));
 PERFORM id FROM public.users WHERE id=p_user FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner indisponível' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.despesas_rpc_operacoes WHERE user_id=p_user AND chave_idempotencia=p_chave) THEN
  RAISE EXCEPTION 'UUID já pertence ao trilho20' USING ERRCODE='23505'; END IF;
 PERFORM despesa_cancelamento_v1.verificar();
 -- Zero ALTER/resselo runtime. Qualquer drift dos predecessores continua fechado.
 PERFORM public.legados_verificar(); PERFORM public.multimodal_verificar();
 PERFORM public.multa36_verificar(); PERFORM public.caixa37_verificar();
END $$;
CREATE FUNCTION despesa_cancelamento_v1.cancelar_pendente(
 p_user_id integer,p_chave uuid,p_despesa_id integer,p_origem_operation_id uuid,p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE
 req jsonb:=despesa_cancelamento_v1.request(p_despesa_id,p_origem_operation_id,p_motivo);
 h bytea; op despesa_cancelamento_v1.operacoes%ROWTYPE;
 d public.contas_pagar%ROWTYPE; origem public.despesas_rpc_origens%ROWTYPE;
 criacao public.despesas_rpc_operacoes%ROWTYPE;
 b jsonb; a jsonb; result jsonb; oid uuid:=gen_random_uuid(); ts timestamptz:=clock_timestamp();
BEGIN
 PERFORM despesa_cancelamento_v1.barreira(p_user_id,p_chave,req);
 h:=despesa_cancelamento_v1.hash(p_user_id,req);
 SELECT user_id,chave,operacao_id,despesa_id,request,hash_request,origem_operation_id,antes,depois,resultado,instante INTO op FROM despesa_cancelamento_v1.operacoes WHERE user_id=p_user_id AND chave=p_chave;
 IF FOUND THEN
  IF op.request IS DISTINCT FROM req OR op.hash_request IS DISTINCT FROM h THEN
   RAISE EXCEPTION 'UUID reutilizado com payload diferente' USING ERRCODE='23505'; END IF;
  RETURN op.resultado; -- resposta perdida: exata operação original, nunca estado corrente
 END IF;
 IF EXISTS(SELECT 1 FROM despesa_cancelamento_v1.fences WHERE user_id=p_user_id AND chave=p_chave) THEN
 RAISE EXCEPTION 'Intenção38c definitivamente não executada; fence durável' USING ERRCODE='23514'; END IF;
 IF NOT despesa_cancelamento_v1.habilitado() THEN RAISE EXCEPTION 'Cancelamento38c desabilitado' USING ERRCODE='55000'; END IF;
 -- Coexistência com20/25: linha física da despesa -> origem -> pagamento.
 -- Não há entidade financeira/conta/ledger a bloquear: este writer NÃO acessa Caixa.
 SELECT id,descricao,categoria,valor,data_vencimento,data_pagamento,status,recorrente,frequencia,conta_caixa_id,observacoes,"createdAt","updatedAt",user_id INTO d FROM public.contas_pagar WHERE id=p_despesa_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Despesa indisponível' USING ERRCODE='42501'; END IF;
 SELECT despesa_id,user_id,operacao_id,snapshot,criado_em INTO origem FROM public.despesas_rpc_origens WHERE despesa_id=d.id FOR UPDATE;
 IF NOT FOUND OR origem.user_id IS DISTINCT FROM p_user_id OR origem.operacao_id IS DISTINCT FROM p_origem_operation_id THEN
  RAISE EXCEPTION 'Origem20 incompatível/legado' USING ERRCODE='23514'; END IF;
 PERFORM despesa_id FROM public.despesas_rpc_pagamentos WHERE despesa_id=d.id FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION 'Despesa com baixa não admite cancelamento' USING ERRCODE='23514'; END IF;
 b:=to_jsonb(d);
 IF d.status IS DISTINCT FROM 'pendente' OR d.recorrente IS DISTINCT FROM false OR d.frequencia IS NOT NULL
 OR d.conta_caixa_id IS NOT NULL OR d.data_pagamento IS NOT NULL OR b IS DISTINCT FROM origem.snapshot
 OR d.valor<=0 OR d.valor::text IN('NaN','Infinity','-Infinity') THEN
  RAISE EXCEPTION 'Somente obrigação pendente20 intacta, sem recorrência/conta' USING ERRCODE='23514'; END IF;
 SELECT id,user_id,chave_idempotencia,tipo,payload,hash_payload,resultado,auditoria,criado_em INTO criacao FROM public.despesas_rpc_operacoes WHERE id=origem.operacao_id FOR SHARE;
 IF NOT FOUND OR criacao.user_id IS DISTINCT FROM p_user_id OR criacao.tipo IS DISTINCT FROM 'criar'
 OR criacao.hash_payload IS DISTINCT FROM extensions.digest(convert_to(jsonb_build_object('tipo','criar','userId',p_user_id,'payload',criacao.payload)::text,'UTF8'),'sha256')
 OR criacao.payload IS DISTINCT FROM jsonb_build_object('descricao',d.descricao,'categoria',d.categoria,'valor',d.valor,'dataVencimento',d.data_vencimento,'observacoes',d.observacoes)
 OR criacao.auditoria IS DISTINCT FROM jsonb_build_object('antes',NULL,'depois',b,'origemOperationId',criacao.id,'saida',NULL,'estorno',NULL,'motivo',NULL)
 OR criacao.resultado IS DISTINCT FROM jsonb_build_object('success',true,'acao','criar','operationId',criacao.id,'userId',p_user_id,'chaveIdempotencia',criacao.chave_idempotencia,
  'despesaId',d.id,'status','pendente','valor',d.valor::text,'contaCaixaId',NULL,'dataVencimento',d.data_vencimento,'dataPagamento',NULL,'dataEstorno',NULL,
  'pagamentoOperationId',NULL,'transacaoSaidaId',NULL,'transacaoEstornoId',NULL) THEN
  RAISE EXCEPTION 'Auditoria20 de criação incompatível' USING ERRCODE='23514'; END IF;
 UPDATE public.contas_pagar SET status='cancelado',"updatedAt"=ts WHERE id=d.id AND user_id=p_user_id RETURNING to_jsonb(contas_pagar) INTO a;
 IF a IS DISTINCT FROM jsonb_set(jsonb_set(b,'{status}','"cancelado"'),'{updatedAt}',to_jsonb(ts)) THEN
  RAISE EXCEPTION 'Pós-imagem inesperada: rollback integral' USING ERRCODE='23514'; END IF;
 result:=jsonb_build_object('contrato','despesa_cancelamento_pendente_v1','success',true,'acao','cancelarPendente','userId',p_user_id,
  'idempotencyKey',p_chave,'operationId',oid,'despesaId',d.id,'origemOperationId',p_origem_operation_id,'motivo',p_motivo,
  'status','cancelado','valor',d.valor::text,'instante',ts,'semMovimentoCaixa',true);
 INSERT INTO despesa_cancelamento_v1.operacoes(user_id,chave,operacao_id,despesa_id,request,hash_request,origem_operation_id,antes,depois,resultado,instante)
 VALUES(p_user_id,p_chave,oid,d.id,req,h,p_origem_operation_id,b,a,result,ts);
 -- Reserva transacional no protocolo33 existente: impede que a UUID cancelada
 -- seja reaproveitada por criar/pagar/estornar20, sem alterar qualquer corpo/ACL/selo.
 INSERT INTO public.financial_intent_fences(user_id,scope,chave,family,request,payload_hash)
 VALUES(p_user_id,'despesa',p_chave,'despesa_cancelamento_pendente_v1',req,encode(h,'hex'));
 RETURN result;
END $$;
CREATE FUNCTION despesa_cancelamento_v1.recuperar_cancelamento(
 p_user_id integer,p_chave uuid,p_despesa_id integer,p_origem_operation_id uuid,p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE req jsonb:=despesa_cancelamento_v1.request(p_despesa_id,p_origem_operation_id,p_motivo); op despesa_cancelamento_v1.operacoes%ROWTYPE; f despesa_cancelamento_v1.fences%ROWTYPE;
BEGIN
 PERFORM despesa_cancelamento_v1.barreira(p_user_id,p_chave,req);
 SELECT user_id,chave,operacao_id,despesa_id,request,hash_request,origem_operation_id,antes,depois,resultado,instante INTO op FROM despesa_cancelamento_v1.operacoes WHERE user_id=p_user_id AND chave=p_chave;
 IF NOT FOUND THEN
  -- Sob O MESMO lock33/20 do writer, espera commit/rollback e fecha ausência de forma durável.
  SELECT user_id,chave,request,hash_request,fence_id,instante INTO f FROM despesa_cancelamento_v1.fences WHERE user_id=p_user_id AND chave=p_chave;
  IF NOT FOUND THEN
   INSERT INTO despesa_cancelamento_v1.fences VALUES(p_user_id,p_chave,req,despesa_cancelamento_v1.hash(p_user_id,req),gen_random_uuid(),clock_timestamp()) RETURNING user_id,chave,request,hash_request,fence_id,instante INTO f;
   INSERT INTO public.financial_intent_fences(user_id,scope,chave,family,request,payload_hash)
   VALUES(p_user_id,'despesa',p_chave,'despesa_cancelamento_pendente_fenced_v1',req,encode(despesa_cancelamento_v1.hash(p_user_id,req),'hex'));
  END IF;
  IF f.request IS DISTINCT FROM req OR f.hash_request IS DISTINCT FROM despesa_cancelamento_v1.hash(p_user_id,req) THEN RAISE EXCEPTION 'Fence divergente' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('contrato','despesa_cancelamento_pendente_v1','userId',p_user_id,'idempotencyKey',p_chave,'request',req,'status','not_executed','result',NULL,'fence',jsonb_build_object('fenceId',f.fence_id,'instante',f.instante));
 END IF;
 IF op.request IS DISTINCT FROM req OR op.hash_request IS DISTINCT FROM despesa_cancelamento_v1.hash(p_user_id,req) THEN
  RAISE EXCEPTION 'Recovery UUID/payload divergente' USING ERRCODE='23505'; END IF;
 RETURN jsonb_build_object('contrato','despesa_cancelamento_pendente_v1','userId',p_user_id,'idempotencyKey',p_chave,'request',req,'status','confirmed','result',op.resultado,'fence',NULL);
END $$;
CREATE FUNCTION public.rpc_cancelar_despesa_pendente38c(p_user_id integer,p_chave uuid,p_despesa_id integer,p_origem_operation_id uuid,p_motivo text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT despesa_cancelamento_v1.cancelar_pendente(p_user_id,p_chave,p_despesa_id,p_origem_operation_id,p_motivo)
$$;
CREATE FUNCTION public.rpc_recuperar_cancelamento_despesa38c(p_user_id integer,p_chave uuid,p_despesa_id integer,p_origem_operation_id uuid,p_motivo text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT despesa_cancelamento_v1.recuperar_cancelamento(p_user_id,p_chave,p_despesa_id,p_origem_operation_id,p_motivo)
$$;
CREATE FUNCTION public.rpc_capacidades_cancelamento_despesa38c() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM despesa_cancelamento_v1.verificar();
 RETURN jsonb_build_object('contrato','despesa_cancelamento_pendente_v1','habilitado',despesa_cancelamento_v1.habilitado(),'somentePendente20',true,'edicao',false,'exclusao',false,'recorrencia',false);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA despesa_cancelamento_v1 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_cancelar_despesa_pendente38c(integer,uuid,integer,uuid,text),public.rpc_recuperar_cancelamento_despesa38c(integer,uuid,integer,uuid,text),public.rpc_capacidades_cancelamento_despesa38c() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_despesa_pendente38c(integer,uuid,integer,uuid,text),public.rpc_recuperar_cancelamento_despesa38c(integer,uuid,integer,uuid,text),public.rpc_capacidades_cancelamento_despesa38c() TO service_role;
DO $after38c$ DECLARE w record; e jsonb; p record; current_environment jsonb; BEGIN
 FOR w IN SELECT oid,snapshot,definition FROM despesas38c_witness LOOP
 IF (SELECT to_jsonb(pr) FROM pg_proc pr WHERE oid=w.oid) IS DISTINCT FROM w.snapshot
 OR (w.definition IS NOT NULL AND pg_get_functiondef(w.oid) IS DISTINCT FROM w.definition) THEN
 RAISE EXCEPTION '38c predecessor fonte/ACL/config alterado' USING ERRCODE='55000'; END IF; END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"despesa_cancelamento_v1.imutavel","hash":"cbd372a26a9795976086b6f2e88cea52634704df177d0dd6ecbeae4fb1d897ef","definer":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesa_cancelamento_v1.metadata","hash":"6583e3fc4dd7829bcf3c8dccb8c20ac5e09b26fe7e940d45ca12e9a277a72bdf","definer":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesa_cancelamento_v1.verificar","hash":"9841c58a9e7496dd7008695ca235d15205ff12cf5f44c72b6bada3016d96b277","definer":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesa_cancelamento_v1.habilitado","hash":"d64a146e2b2c8d3248ed41d24f8e4ab5b7b58af9f90a73b404afc628155d5c86","definer":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesa_cancelamento_v1.configurar","hash":"31ae0a7ec6804623e5b56c763cd3f4b2d09a5949c7db1988575d966d60495611","definer":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesa_cancelamento_v1.request","hash":"125ba8331506be24504c7b426048ceb135f4191d52a57f4047eb6fc626e6a8f0","definer":false,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesa_cancelamento_v1.hash","hash":"2e7cfc57a451d8ed27b21f5bd8a8a47a68292eea149c65f9c12c1f0c248a9378","definer":false,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesa_cancelamento_v1.barreira","hash":"ef0842db649a3dabff191615e67e8235329fa16cce70405ba162f7c0ef85c7f9","definer":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesa_cancelamento_v1.cancelar_pendente","hash":"27f66b064953c163342d54b5d8384cd02940e94d15ea235316f59e20556b9018","definer":true,"config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"despesa_cancelamento_v1.recuperar_cancelamento","hash":"db1d54810297163332795f7b584602da13a653ed342c0e86b09ca45529361248","definer":true,"config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"public.rpc_cancelar_despesa_pendente38c","hash":"aa13493e6fa14a286ad8c1205a06229ad4f198505ebe876f37e2e9304281b008","definer":true,"config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"public.rpc_recuperar_cancelamento_despesa38c","hash":"cad1916a06e36b255ce52d55c772f98ebbd98a1fe6d4838cb4f0d3b358d9fcfd","definer":true,"config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"public.rpc_capacidades_cancelamento_despesa38c","hash":"fe49acf4d5d4e5e04b3cc608248c2e91c1f1f11f81f00197c31aa62faa6f3c8c","definer":true,"config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace WHERE n.nspname||'.'||pr.proname=e->>'name')<>1 THEN RAISE EXCEPTION '38c overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT pr.* INTO STRICT p FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace WHERE n.nspname||'.'||pr.proname=e->>'name';
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR p.prosecdef IS DISTINCT FROM (e->>'definer')::boolean OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner AND NOT(a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role') AND (e->>'name') LIKE 'public.rpc_%' AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
 OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 OR has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM ((e->>'name') LIKE 'public.rpc_%')
 THEN RAISE EXCEPTION '38c nova fonte/config/ACL/owner incompatível: %',e->>'name' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc pr WHERE NOT EXISTS(SELECT 1 FROM despesas38c_witness ww WHERE ww.oid=pr.oid))<>13 THEN RAISE EXCEPTION '38c função extra desconhecida' USING ERRCODE='55000'; END IF;
 SELECT jsonb_build_object(
 'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY oid) FROM pg_namespace n WHERE nspname NOT LIKE 'pg_temp_%' AND nspname NOT LIKE 'pg_toast_temp_%' AND nspname<>'despesa_cancelamento_v1'),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_default_acl d),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r),
 'members',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m),
 'settings',(SELECT jsonb_agg(to_jsonb(d) ORDER BY setdatabase,setrole) FROM pg_db_role_setting d),
 'classes',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname NOT LIKE 'pg_temp_%' AND ns.nspname NOT LIKE 'pg_toast_temp_%' AND c.oid IN(SELECT (v->>'oid')::oid FROM jsonb_array_elements((SELECT snapshot->'classes' FROM despesas38c_environment)) v)),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT c.oid FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname NOT LIKE 'pg_temp_%' AND ns.nspname NOT LIKE 'pg_toast_temp_%' AND ns.nspname<>'despesa_cancelamento_v1'))
 ) INTO current_environment;
 IF current_environment IS DISTINCT FROM (SELECT snapshot FROM despesas38c_environment) THEN RAISE EXCEPTION '38c ambiente/ACL/config/relations predecessor alterado' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='despesa_cancelamento_v1' AND a.grantee<>n.nspowner) THEN RAISE EXCEPTION '38c grant herdado em schema' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a WHERE c.relnamespace='despesa_cancelamento_v1'::regnamespace AND a.grantee<>c.relowner) THEN RAISE EXCEPTION '38c grant herdado em tabela/sequence' USING ERRCODE='55000'; END IF;
END $after38c$;
-- SOMENTE INSTALAÇÃO, após testemunhos de todos predecessores e fontes novas exatas.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
INSERT INTO despesa_cancelamento_v1.manifesto VALUES(1,despesa_cancelamento_v1.metadata());
DO $verify38c$ BEGIN PERFORM despesa_cancelamento_v1.verificar(); PERFORM public.legados_verificar(); PERFORM public.multimodal_verificar(); END $verify38c$;
NOTIFY pgrst,'reload schema';
COMMIT;
