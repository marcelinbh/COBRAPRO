-- 0069: substituir somente uma pendente20 intacta, inclusive ocorrência overlay68.
-- Instalar após 51->54->52->53->58->60 (+67/68 aditivos legítimos).
-- Sem UPDATE de valor/snapshot original, sem FK para public, sem fluxo38c/flag49.
-- PG17/Read Committed, instalador postgres, janela DDL cooperativa exclusiva.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.users,public.contas_pagar,public.despesas_rpc_origens,public.despesas_rpc_operacoes,public.despesas_rpc_pagamentos,public.financial_intent_fences,public.contas_caixa,public.transacoes_caixa,public.caixa37_manifesto IN SHARE ROW EXCLUSIVE MODE;
DO $pre69$ BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR to_regnamespace('despesas69') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_proc WHERE proname IN('rpc_cotar_edicao_despesa69','rpc_editar_despesa69','rpc_recuperar_edicao_despesa69','rpc_capacidades_despesas69','rpc_linhagem_despesas69')) THEN RAISE EXCEPTION '69 baseline/contexto/namespace incompatível' USING ERRCODE='55000'; END IF;
PERFORM public.legados_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.multa36_verificar(); PERFORM public.caixa37_verificar(); PERFORM despesa_cancelamento_v1.verificar(); PERFORM telefone41.verificar(); PERFORM manutencao44.verificar(); PERFORM caixa_manutencao45.verificar(); PERFORM calendario46.verificar(); PERFORM private47.verificar(); PERFORM manutencao48.verificar(); PERFORM despesas49.verificar(); PERFORM obrigacoes51.verificar(); PERFORM inclusao52.verificar(); PERFORM sucessores53.verificar(); PERFORM emprestimos_lista60.verificar();
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.caixa37_metadata()'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '088bced7e8df832b95b32a44f83c2d19450eaa076c487179df54b410dd224280' THEN RAISE EXCEPTION '69 predecessor pinado divergente' USING ERRCODE='55000'; END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.verificar()'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8f587261d12bad22e26b6a3381f2c8004c6ab950faf1a9c3dd5e6932778e7074' THEN RAISE EXCEPTION '69 predecessor pinado divergente' USING ERRCODE='55000'; END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='despesas49.validar(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '95551d42ebf9d0d7a6a70e8fe885f59dff0ec3bb35579faec81244afcaef4c70' THEN RAISE EXCEPTION '69 predecessor pinado divergente' USING ERRCODE='55000'; END IF;
END $pre69$;
CREATE TEMP TABLE witness69_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) snapshot FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_temp_%';
CREATE TEMP TABLE witness69_catalog ON COMMIT DROP AS SELECT 'class' kind,c.oid::text k,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] snapshot FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'attribute',a.attrelid::text||':'||a.attnum,to_jsonb(a) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'constraint',c.oid::text,to_jsonb(c) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'trigger',t.oid::text,to_jsonb(t) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'policy',p.oid::text,to_jsonb(p) FROM pg_policy p
 UNION ALL SELECT 'default',d.oid::text,to_jsonb(d) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'index',i.indexrelid::text,to_jsonb(i) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'namespace',oid::text,to_jsonb(n) FROM pg_namespace n WHERE nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'role',oid::text,to_jsonb(r) FROM pg_roles r
 UNION ALL SELECT 'member',roleid::text||':'||member,to_jsonb(m) FROM pg_auth_members m
 UNION ALL SELECT 'defaultacl',oid::text,to_jsonb(d) FROM pg_default_acl d
 UNION ALL SELECT 'type',t.oid::text,to_jsonb(t) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'setting',setdatabase::text||':'||setrole,to_jsonb(d) FROM pg_db_role_setting d;
CREATE TEMP TABLE witness69_data(rel oid PRIMARY KEY,snapshot jsonb) ON COMMIT DROP;
DO $data69$ DECLARE r record;j jsonb;projection text; BEGIN
 FOR r IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','extensions') LOOP
  -- Exceção fechada: somente cinco managed tables autenticadas; nunca fallback por falta de ACL.
  IF (r.nspname,r.relname) IN (('auth','schema_migrations'),('realtime','schema_migrations'),('storage','buckets_vectors'),('storage','migrations'),('storage','vector_indexes')) THEN
   EXECUTE format('LOCK TABLE %I.%I IN ACCESS SHARE MODE',r.nspname,r.relname);
   IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=r.oid) IS DISTINCT FROM
      (CASE r.nspname WHEN 'auth' THEN 'supabase_auth_admin' WHEN 'realtime' THEN 'supabase_admin' WHEN 'storage' THEN 'supabase_storage_admin' END)
      OR NOT has_table_privilege(current_user,r.oid,'SELECT')
      OR has_table_privilege(current_user,r.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(current_user,r.oid,'INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION '69 managed readonly/owner/ACL divergente: %.%',r.nspname,r.relname USING ERRCODE='55000';
   END IF;
  ELSE
  EXECUTE format('LOCK TABLE %s IN SHARE MODE',r.oid::regclass);
  END IF;
  projection:=CASE WHEN r.oid='public.caixa37_manifesto'::regclass THEN 'to_jsonb(x)-''assinatura''' ELSE 'to_jsonb(x)' END;
  EXECUTE format('SELECT coalesce(jsonb_agg(%s ORDER BY (%s)::text),''[]''::jsonb) FROM %s x',projection,projection,r.oid::regclass) INTO j;
  INSERT INTO witness69_data VALUES(r.oid,j);
 END LOOP;
END $data69$;
CREATE TEMP TABLE witness69_seal ON COMMIT DROP AS SELECT assinatura FROM public.caixa37_manifesto WHERE id=1;
CREATE SCHEMA despesas69 AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA despesas69 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE despesas69.operacoes(
 user_id integer NOT NULL CHECK(user_id>0), chave uuid NOT NULL, operation_id uuid NOT NULL UNIQUE,
 despesa_id integer NOT NULL CHECK(despesa_id>0), raiz_id integer NOT NULL CHECK(raiz_id=despesa_id),
 sucessora_id integer, sucessora_operation_id uuid, filha_chave uuid,
 status text NOT NULL CHECK(status IN('confirmed','not_executed')),
 request jsonb NOT NULL, hash_request bytea NOT NULL CHECK(octet_length(hash_request)=32),
 antes jsonb, depois jsonb, sucessora jsonb, valor_anterior numeric(15,2), valor_novo numeric(15,2) NOT NULL CHECK(valor_novo>0),
 motivo text NOT NULL, resultado jsonb NOT NULL, instante timestamptz NOT NULL,
 PRIMARY KEY(user_id,chave),
 CHECK((status='confirmed' AND sucessora_id IS NOT NULL AND sucessora_id<>despesa_id AND sucessora_operation_id IS NOT NULL AND filha_chave IS NOT NULL AND antes IS NOT NULL AND depois IS NOT NULL AND sucessora IS NOT NULL AND valor_anterior IS NOT NULL)
 OR (status='not_executed' AND sucessora_id IS NULL AND sucessora_operation_id IS NULL AND filha_chave IS NULL AND antes IS NULL AND depois IS NULL AND sucessora IS NULL AND valor_anterior IS NULL))
);
CREATE UNIQUE INDEX unica_substituicao69 ON despesas69.operacoes(user_id,despesa_id) WHERE status='confirmed';
CREATE UNIQUE INDEX unica_sucessora69 ON despesas69.operacoes(user_id,sucessora_id) WHERE status='confirmed';
CREATE TABLE despesas69.flags(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,habilitado boolean NOT NULL,ator name NOT NULL DEFAULT session_user,instante timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE despesas69.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);
ALTER TABLE despesas69.operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas69.flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas69.manifesto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA despesas69 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA despesas69 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION despesas69.imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION '69 append-only' USING ERRCODE='42501'; END $$;
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON despesas69.operacoes FOR EACH ROW EXECUTE FUNCTION despesas69.imutavel();
CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON despesas69.operacoes FOR EACH STATEMENT EXECUTE FUNCTION despesas69.imutavel();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON despesas69.flags FOR EACH ROW EXECUTE FUNCTION despesas69.imutavel();
CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON despesas69.flags FOR EACH STATEMENT EXECUTE FUNCTION despesas69.imutavel();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON despesas69.manifesto FOR EACH ROW EXECUTE FUNCTION despesas69.imutavel();
CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON despesas69.manifesto FOR EACH STATEMENT EXECUTE FUNCTION despesas69.imutavel();
CREATE FUNCTION despesas69.metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(extensions.digest(jsonb_build_object(
 'schema',(SELECT to_jsonb(n) FROM pg_namespace n WHERE nspname='despesas69'),
 'functions',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE pronamespace='despesas69'::regnamespace OR proname IN('rpc_cotar_edicao_despesa69','rpc_editar_despesa69','rpc_recuperar_edicao_despesa69','rpc_capacidades_despesas69','rpc_linhagem_despesas69')),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY oid) FROM pg_class c WHERE relnamespace='despesas69'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='despesas69'::regnamespace AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY oid) FROM pg_constraint k WHERE connamespace='despesas69'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas69'::regnamespace)),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas69'::regnamespace))
 )::text,'sha256'),'hex')
$$;
CREATE FUNCTION despesas69.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM despesas49.verificar(); PERFORM obrigacoes51.verificar(); PERFORM inclusao52.verificar(); PERFORM sucessores53.verificar(); PERFORM emprestimos_lista60.verificar();
 IF (SELECT assinatura FROM despesas69.manifesto WHERE id=1) IS DISTINCT FROM despesas69.metadata() THEN RAISE EXCEPTION 'Metadata69 divergente; sem reseal runtime' USING ERRCODE='55000'; END IF;
END $$;
CREATE FUNCTION despesas69.habilitado() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT coalesce((SELECT habilitado FROM despesas69.flags ORDER BY id DESC LIMIT 1),false)
$$;
CREATE FUNCTION despesas69.configurar(b boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN PERFORM despesas69.verificar(); IF b IS NULL THEN RAISE EXCEPTION 'Boolean obrigatório' USING ERRCODE='22023'; END IF; INSERT INTO despesas69.flags(habilitado) VALUES(b); END $$;
CREATE FUNCTION despesas69.request(r jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM despesas49.request(r-'valor');
 IF jsonb_typeof(r->'valor') IS DISTINCT FROM 'string' OR coalesce(r->>'valor','')!~'^(0|[1-9][0-9]{0,12})\.[0-9]{2}$' OR (r->>'valor')::numeric<=0 OR (r->>'valor')::numeric>9999999999999.99 THEN RAISE EXCEPTION '69 valor textual positivo exato obrigatório' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION despesas69.hash(uid integer,r jsonb) RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT extensions.digest(jsonb_build_object('contrato','despesas69_v1','userId',uid,'request',r)::text,'sha256')
$$;
CREATE FUNCTION despesas69.recibo(op despesas69.operacoes) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT jsonb_build_object('contrato','despesas69_v1','success',true,'acao','editarPendenteComValor','userId',(op).user_id,'idempotencyKey',(op).chave,'request',(op).request,'operationId',(op).operation_id,'despesaId',(op).despesa_id,'raizId',(op).raiz_id,'sucessoraId',(op).sucessora_id,'sucessoraOperationId',(op).sucessora_operation_id,'valorAnterior',(op).valor_anterior::text,'valorNovo',(op).valor_novo::text,'statusOriginal','cancelado','statusSucessora','pendente','semMovimentoCaixa',true,'somenteEstaOcorrencia',true,'instante',(op).instante)
$$;
CREATE FUNCTION despesas69.recovery(op despesas69.operacoes) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT jsonb_build_object('contrato','despesas69_v1','userId',(op).user_id,'idempotencyKey',(op).chave,'request',(op).request,'status',(op).status,'result',CASE WHEN (op).status='confirmed' THEN despesas69.recibo(op) ELSE NULL END,'fence',CASE WHEN (op).status='not_executed' THEN jsonb_build_object('fenceId',(op).operation_id,'instante',(op).instante) ELSE NULL END)
$$;
CREATE FUNCTION despesas69.provar(oid69 uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op despesas69.operacoes%ROWTYPE; orig public.despesas_rpc_origens%ROWTYPE; child public.despesas_rpc_operacoes%ROWTYPE; source public.despesas_rpc_operacoes%ROWTYPE; f public.financial_intent_fences%ROWTYPE; w jsonb;
BEGIN
 SELECT * INTO STRICT op FROM despesas69.operacoes WHERE operation_id=oid69;
 PERFORM despesas69.request(op.request);
 SELECT * INTO STRICT f FROM public.financial_intent_fences WHERE user_id=op.user_id AND scope='despesa' AND chave=op.chave;
 IF op.hash_request IS DISTINCT FROM despesas69.hash(op.user_id,op.request) OR op.despesa_id IS DISTINCT FROM (op.request->>'despesaId')::int OR op.raiz_id IS DISTINCT FROM op.despesa_id OR op.valor_novo IS DISTINCT FROM (op.request->>'valor')::numeric OR op.motivo IS DISTINCT FROM op.request->>'motivo'
 OR f.family IS DISTINCT FROM 'despesas69_v1' OR f.request IS DISTINCT FROM op.request OR f.payload_hash IS DISTINCT FROM encode(op.hash_request,'hex') THEN RAISE EXCEPTION '69 UUID/request/owner/fence divergente' USING ERRCODE='23514'; END IF;
 IF op.status='not_executed' THEN
  IF op.resultado IS DISTINCT FROM despesas69.recovery(op) THEN RAISE EXCEPTION '69 terminal sem prova exata' USING ERRCODE='23514'; END IF;
  RETURN;
 END IF;
 SELECT * INTO STRICT source FROM public.despesas_rpc_operacoes WHERE id=(op.request->>'origemOperationId')::uuid;
 SELECT * INTO STRICT orig FROM public.despesas_rpc_origens WHERE despesa_id=op.despesa_id;
 w:=jsonb_build_object('original',op.antes,'origemOperationId',orig.operacao_id);
 IF source.user_id IS DISTINCT FROM op.user_id OR source.tipo IS DISTINCT FROM 'criar' OR orig.user_id IS DISTINCT FROM op.user_id OR orig.operacao_id IS DISTINCT FROM source.id OR orig.snapshot IS DISTINCT FROM op.antes
 OR source.hash_payload IS DISTINCT FROM extensions.digest(convert_to(jsonb_build_object('tipo','criar','userId',op.user_id,'payload',source.payload)::text,'UTF8'),'sha256')
 OR source.payload IS DISTINCT FROM jsonb_build_object('descricao',op.antes->>'descricao','categoria',op.antes->>'categoria','valor',(op.antes->>'valor')::numeric,'dataVencimento',(op.antes->>'data_vencimento')::date,'observacoes',op.antes->'observacoes')
 OR source.auditoria IS DISTINCT FROM jsonb_build_object('antes',NULL,'depois',op.antes,'origemOperationId',source.id,'saida',NULL,'estorno',NULL,'motivo',NULL) OR op.antes->>'id' IS DISTINCT FROM op.despesa_id::text OR op.antes->>'user_id' IS DISTINCT FROM op.user_id::text
 OR op.antes->'recorrente' IS DISTINCT FROM 'false'::jsonb OR op.antes->'frequencia' IS DISTINCT FROM 'null'::jsonb OR op.antes->'conta_caixa_id' IS DISTINCT FROM 'null'::jsonb OR op.antes->'data_pagamento' IS DISTINCT FROM 'null'::jsonb
 OR source.resultado IS DISTINCT FROM jsonb_build_object('success',true,'acao','criar','operationId',source.id,'userId',op.user_id,'chaveIdempotencia',source.chave_idempotencia,'despesaId',op.despesa_id,'status','pendente','valor',op.valor_anterior::text,'contaCaixaId',NULL,'dataVencimento',(op.antes->>'data_vencimento')::date,'dataPagamento',NULL,'dataEstorno',NULL,'pagamentoOperationId',NULL,'transacaoSaidaId',NULL,'transacaoEstornoId',NULL)
 OR op.antes->>'status' IS DISTINCT FROM 'pendente' OR op.valor_anterior IS DISTINCT FROM (op.antes->>'valor')::numeric
 OR encode(extensions.digest(w::text,'sha256'),'hex') IS DISTINCT FROM op.request->>'estadoHash'
 OR op.depois IS DISTINCT FROM jsonb_set(jsonb_set(op.antes,'{status}','"cancelado"'),'{updatedAt}',to_jsonb(op.instante))
 OR op.depois IS DISTINCT FROM (SELECT to_jsonb(d) FROM public.contas_pagar d WHERE id=op.despesa_id AND user_id=op.user_id)
 OR EXISTS(SELECT 1 FROM public.despesas_rpc_pagamentos WHERE despesa_id=op.despesa_id) THEN RAISE EXCEPTION '69 preimagem/proveniência/delta original divergente' USING ERRCODE='23514'; END IF;
 SELECT * INTO STRICT child FROM public.despesas_rpc_operacoes WHERE id=op.sucessora_operation_id;
 SELECT * INTO STRICT orig FROM public.despesas_rpc_origens WHERE despesa_id=op.sucessora_id;
 IF child.user_id IS DISTINCT FROM op.user_id OR child.tipo IS DISTINCT FROM 'criar' OR child.chave_idempotencia IS DISTINCT FROM op.filha_chave OR orig.user_id IS DISTINCT FROM op.user_id OR orig.operacao_id IS DISTINCT FROM child.id OR orig.snapshot IS DISTINCT FROM op.sucessora
 OR child.payload IS DISTINCT FROM jsonb_build_object('descricao',op.request->>'descricao','categoria',op.request->>'categoria','valor',op.valor_novo,'dataVencimento',(op.request->>'dataVencimento')::date,'observacoes',op.request->>'observacoes')
 OR child.hash_payload IS DISTINCT FROM extensions.digest(convert_to(jsonb_build_object('tipo','criar','userId',op.user_id,'payload',child.payload)::text,'UTF8'),'sha256')
 OR child.auditoria IS DISTINCT FROM jsonb_build_object('antes',NULL,'depois',op.sucessora,'origemOperationId',child.id,'saida',NULL,'estorno',NULL,'motivo',NULL)
 OR child.resultado IS DISTINCT FROM jsonb_build_object('success',true,'acao','criar','operationId',child.id,'userId',op.user_id,'chaveIdempotencia',op.filha_chave,'despesaId',op.sucessora_id,'status','pendente','valor',op.valor_novo::text,'contaCaixaId',NULL,'dataVencimento',(op.request->>'dataVencimento')::date,'dataPagamento',NULL,'dataEstorno',NULL,'pagamentoOperationId',NULL,'transacaoSaidaId',NULL,'transacaoEstornoId',NULL)
 OR (op.sucessora->>'valor')::numeric IS DISTINCT FROM op.valor_novo OR op.sucessora->>'descricao' IS DISTINCT FROM op.request->>'descricao' OR op.sucessora->>'categoria' IS DISTINCT FROM op.request->>'categoria' OR op.sucessora->>'data_vencimento' IS DISTINCT FROM op.request->>'dataVencimento' OR op.sucessora->>'observacoes' IS DISTINCT FROM op.request->>'observacoes'
 OR op.sucessora->>'id' IS DISTINCT FROM op.sucessora_id::text OR op.sucessora->>'user_id' IS DISTINCT FROM op.user_id::text OR op.sucessora->>'status' IS DISTINCT FROM 'pendente'
 OR op.sucessora->'recorrente' IS DISTINCT FROM 'false'::jsonb OR op.sucessora->'frequencia' IS DISTINCT FROM 'null'::jsonb OR op.sucessora->'data_pagamento' IS DISTINCT FROM 'null'::jsonb OR op.sucessora->'conta_caixa_id' IS DISTINCT FROM 'null'::jsonb
 OR op.resultado IS DISTINCT FROM despesas69.recibo(op) THEN RAISE EXCEPTION '69 sucessora20/recibo divergente' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION despesas69.commit_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN PERFORM despesas69.provar(NEW.operation_id); RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER commit69 AFTER INSERT ON despesas69.operacoes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION despesas69.commit_check();
CREATE FUNCTION despesas69.barreira(uid integer,k uuid,r jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE f public.financial_intent_fences%ROWTYPE;
BEGIN
 PERFORM despesas69.request(r);
 IF uid IS NULL OR uid<=0 OR k IS NULL THEN RAISE EXCEPTION '69 owner/UUID obrigatório' USING ERRCODE='22023'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION '69 Read Committed obrigatório' USING ERRCODE='55000'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('despesa:'||uid::text||':'||k::text,33));
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||':'||k::text,20));
 PERFORM id FROM public.users WHERE id=uid FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION '69 owner indisponível' USING ERRCODE='42501'; END IF;
 PERFORM despesas69.verificar();
 SELECT * INTO f FROM public.financial_intent_fences WHERE user_id=uid AND scope='despesa' AND chave=k;
 IF FOUND AND (f.family IS DISTINCT FROM 'despesas69_v1' OR f.request IS DISTINCT FROM r OR f.payload_hash IS DISTINCT FROM encode(despesas69.hash(uid,r),'hex') OR NOT EXISTS(SELECT 1 FROM despesas69.operacoes WHERE user_id=uid AND chave=k)) THEN RAISE EXCEPTION '69 UUID reservado/encerrado/payload divergente' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT 1 FROM public.despesas_rpc_operacoes WHERE user_id=uid AND chave_idempotencia=k) THEN RAISE EXCEPTION '69 UUID pertence20' USING ERRCODE='23505'; END IF;
END $$;
CREATE FUNCTION despesas69.cotar(uid integer,did integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM despesas69.verificar();
 RETURN jsonb_build_object('contrato','despesas69_v1','quote49',despesas49.cotar(uid,did),'habilitado',despesas69.habilitado(),'somenteEstaOcorrencia',true);
END $$;
CREATE FUNCTION despesas69.executar(uid integer,k uuid,r jsonb,recover boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op despesas69.operacoes%ROWTYPE; w jsonb; a jsonb; child jsonb; successor jsonb;
BEGIN
 PERFORM despesas69.barreira(uid,k,r);
 SELECT * INTO op FROM despesas69.operacoes WHERE user_id=uid AND chave=k;
 IF FOUND THEN
  IF op.request IS DISTINCT FROM r OR op.hash_request IS DISTINCT FROM despesas69.hash(uid,r) THEN RAISE EXCEPTION '69 UUID/payload divergente' USING ERRCODE='23505'; END IF;
  PERFORM despesas69.provar(op.operation_id);
  IF recover THEN RETURN despesas69.recovery(op); END IF;
  IF op.status='not_executed' THEN RAISE EXCEPTION '69 UUID terminal fenced' USING ERRCODE='23514'; END IF;
  RETURN op.resultado;
 END IF;
 op.user_id:=uid; op.chave:=k; op.operation_id:=gen_random_uuid(); op.despesa_id:=(r->>'despesaId')::int; op.raiz_id:=op.despesa_id; op.request:=r; op.hash_request:=despesas69.hash(uid,r); op.valor_novo:=(r->>'valor')::numeric; op.motivo:=r->>'motivo'; op.instante:=clock_timestamp();
 IF recover THEN
  -- Recovery próprio sempre disponível, inclusive capacidade69 OFF. Ausência fecha UUID sob lock33/20.
  op.status:='not_executed'; op.resultado:=despesas69.recovery(op);
 ELSE
  IF NOT despesas69.habilitado() THEN RAISE EXCEPTION '69 desabilitado' USING ERRCODE='55000'; END IF;
  -- Ordem física dos writers20/38c/49: owner -> despesa -> origem -> pagamento.
  PERFORM id FROM public.contas_pagar WHERE id=op.despesa_id AND user_id=uid FOR UPDATE;
  IF EXISTS(SELECT 1 FROM despesas69.operacoes WHERE user_id=uid AND despesa_id=op.despesa_id AND status='confirmed') THEN RAISE EXCEPTION '69 cotação já substituída' USING ERRCODE='40001'; END IF;
  w:=despesas49.validar(uid,op.despesa_id);
  IF w->>'origemOperationId' IS DISTINCT FROM r->>'origemOperationId' OR encode(extensions.digest(w::text,'sha256'),'hex') IS DISTINCT FROM r->>'estadoHash' THEN RAISE EXCEPTION '69 cotação stale/origem divergente' USING ERRCODE='40001'; END IF;
  IF w->'original'->>'descricao'=r->>'descricao' AND w->'original'->>'categoria'=r->>'categoria' AND w->'original'->>'data_vencimento'=r->>'dataVencimento' AND coalesce(w->'original'->>'observacoes','')=r->>'observacoes' AND (w->'original'->>'valor')::numeric=op.valor_novo THEN RAISE EXCEPTION '69 edição sem alteração' USING ERRCODE='22023'; END IF;
  op.antes:=w->'original'; op.valor_anterior:=(op.antes->>'valor')::numeric;
  UPDATE public.contas_pagar SET status='cancelado',"updatedAt"=op.instante WHERE id=op.despesa_id AND user_id=uid RETURNING to_jsonb(contas_pagar) INTO a;
  IF a IS DISTINCT FROM jsonb_set(jsonb_set(op.antes,'{status}','"cancelado"'),'{updatedAt}',to_jsonb(op.instante)) THEN RAISE EXCEPTION '69 pós-imagem original divergente' USING ERRCODE='23514'; END IF;
  op.depois:=a; op.filha_chave:=gen_random_uuid();
  -- ÚNICA inclusão financeira: writer público20 vigente, na MESMA transação e novo valor só na sucessora.
  child:=public.rpc_criar_despesa_prospectiva(uid,r->>'descricao',r->>'categoria',op.valor_novo,(r->>'dataVencimento')::date,r->>'observacoes',op.filha_chave);
  op.sucessora_id:=(child->>'despesaId')::int; op.sucessora_operation_id:=(child->>'operationId')::uuid;
  successor:=despesas49.validar(uid,op.sucessora_id);
  op.sucessora:=successor->'original';
  IF successor->>'origemOperationId' IS DISTINCT FROM op.sucessora_operation_id::text OR (op.sucessora->>'valor')::numeric IS DISTINCT FROM op.valor_novo THEN RAISE EXCEPTION '69 sucessora divergente' USING ERRCODE='23514'; END IF;
  op.status:='confirmed'; op.resultado:=despesas69.recibo(op);
 END IF;
 INSERT INTO despesas69.operacoes SELECT (op).*;
 INSERT INTO public.financial_intent_fences(user_id,scope,chave,family,request,payload_hash) VALUES(uid,'despesa',k,'despesas69_v1',r,encode(op.hash_request,'hex'));
 PERFORM despesas69.provar(op.operation_id);
 RETURN op.resultado;
END $$;
CREATE FUNCTION despesas69.linhagem(uid integer,did integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE op despesas69.operacoes%ROWTYPE;
BEGIN
 PERFORM despesas69.verificar();
 IF uid IS NULL OR uid<=0 OR did IS NULL OR did<=0 THEN RAISE EXCEPTION '69 owner/despesa inválido' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contas_pagar WHERE id=did AND user_id=uid) THEN RAISE EXCEPTION '69 despesa indisponível' USING ERRCODE='42501'; END IF;
 SELECT * INTO op FROM despesas69.operacoes WHERE user_id=uid AND despesa_id=did AND status='confirmed';
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM despesas69.provar(op.operation_id);
 RETURN jsonb_build_object('contrato','despesas69_v1','userId',uid,'despesaId',did,'sucessoraId',op.sucessora_id,'status','confirmed','antes',op.antes,'depois',op.depois,'sucessora',op.sucessora,'recibo',op.resultado);
END $$;
CREATE FUNCTION despesas69.sucessora68(uid integer,did integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE proof jsonb;
BEGIN
 -- linhagem revalida manifesto69, owner e prova interna69; não lê snapshot como autoridade.
 proof:=despesas69.linhagem(uid,did);
 IF proof IS NULL THEN RETURN NULL; END IF;
 IF proof->>'status' IS DISTINCT FROM 'confirmed' OR proof->'userId' IS DISTINCT FROM to_jsonb(uid) OR proof->'despesaId' IS DISTINCT FROM to_jsonb(did) THEN RAISE EXCEPTION '69 adaptador68 prova divergente' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('userId',uid,'despesaId',did,'sucessoraId',(proof->>'sucessoraId')::integer,'confirmed',true);
END $$;
CREATE FUNCTION public.rpc_cotar_edicao_despesa69(p_user_id integer,p_despesa_id integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT despesas69.cotar(p_user_id,p_despesa_id) $$;
CREATE FUNCTION public.rpc_editar_despesa69(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT despesas69.executar(p_user_id,p_chave,p_request,false) $$;
CREATE FUNCTION public.rpc_recuperar_edicao_despesa69(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE op despesas69.operacoes%ROWTYPE;
BEGIN
 PERFORM despesas69.executar(p_user_id,p_chave,p_request,true);
 SELECT * INTO STRICT op FROM despesas69.operacoes WHERE user_id=p_user_id AND chave=p_chave;
 RETURN despesas69.recovery(op);
END $$;
CREATE FUNCTION public.rpc_capacidades_despesas69() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN PERFORM despesas69.verificar(); RETURN jsonb_build_object('contrato','despesas69_v1','habilitado',despesas69.habilitado(),'edicaoPendente20',true,'valorEditavel',true,'somenteEstaOcorrencia',true,'recovery',true,'legado',false,'posBaixa',false); END $$;
CREATE FUNCTION public.rpc_linhagem_despesas69(p_user_id integer,p_despesa_id integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT despesas69.linhagem(p_user_id,p_despesa_id) $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA despesas69 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_cotar_edicao_despesa69(integer,integer),public.rpc_editar_despesa69(integer,uuid,jsonb),public.rpc_recuperar_edicao_despesa69(integer,uuid,jsonb),public.rpc_capacidades_despesas69(),public.rpc_linhagem_despesas69(integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cotar_edicao_despesa69(integer,integer),public.rpc_editar_despesa69(integer,uuid,jsonb),public.rpc_recuperar_edicao_despesa69(integer,uuid,jsonb),public.rpc_capacidades_despesas69(),public.rpc_linhagem_despesas69(integer,integer) TO service_role;
DO $post69$ DECLARE old text;derived text;expected text;nr integer;witness_row record;j jsonb;projection text;e jsonb; BEGIN
 SELECT assinatura INTO STRICT old FROM witness69_seal;
 IF EXISTS(SELECT 1 FROM witness69_functions w LEFT JOIN pg_proc p ON p.oid=w.oid WHERE p.oid IS NULL OR to_jsonb(p) IS DISTINCT FROM w.snapshot) THEN RAISE EXCEPTION '69 old functions changed' USING ERRCODE='55000'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"despesas69.imutavel","sha256":"96b0e1c1e3e512f0c44e89f5bf66988fcf219d047c2cee386245576361e97409","argtypes":"","result":"trigger","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.metadata","sha256":"2da16cad3271cba7eff83a97f28af57a0b2ee5b53bc8cd81d439d4644ccac9c0","argtypes":"","result":"text","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.verificar","sha256":"91567de21a02b8aef6c51125426f55e7ccc3daa689f71d4f8cdb4bda243d477a","argtypes":"","result":"void","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.habilitado","sha256":"773d521b50524f9a4702893e5c32718caa540081bfbab8e6f8b0b0975492b4e4","argtypes":"","result":"boolean","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.configurar","sha256":"0d5ee8da34e057910600fbdacc35c8bf8bf43271cd23d468edce07448b5ad543","argtypes":"boolean","result":"void","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.request","sha256":"d0fea3330a41ba15fda52b172fbd792d23d41748a60a66f5f52b63403d44ac90","argtypes":"jsonb","result":"void","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.hash","sha256":"59970923ab8318bd857604eac23403803577b60120bf46b5ba73a7b564892981","argtypes":"integer, jsonb","result":"bytea","secdef":false,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.recibo","sha256":"18962d897c274e0ccd847cba7b831a05e370da55acbc35ff3ec63dabcfe5cca4","argtypes":"despesas69.operacoes","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"despesas69.recovery","sha256":"4af91714d56d53cb3a8fcb0bc4b9ef29edca2dbac5f69dc9aa4ee9b5d9088c49","argtypes":"despesas69.operacoes","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"despesas69.provar","sha256":"b8fe9b3a0b82459c01e413de74a3e6aa4b474d360b3a7d99553e9ab3a51771a0","argtypes":"uuid","result":"void","secdef":true,"config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"despesas69.commit_check","sha256":"8204c50c913a6e3f84c10abc3c68096f85780bbe271fc213a9b97ce1ca6b42fc","argtypes":"","result":"trigger","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.barreira","sha256":"879802a645bfb88e832c110b039066225ee86c56603e01d1e9b5ae78a0acccb3","argtypes":"integer, uuid, jsonb","result":"void","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.cotar","sha256":"21b91a0962ddfed4ff885f7fc53a43d8103a5450a067cac354c836602fab2015","argtypes":"integer, integer","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.executar","sha256":"5e6de118443725e1e61ec862f78747b6593a5b26298615211e1c6b63ce84a77c","argtypes":"integer, uuid, jsonb, boolean","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"despesas69.linhagem","sha256":"c6f6252afc540496689faf56e0b70bb8b6060cc95c0dc918c54a53876d1f5fa9","argtypes":"integer, integer","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas69.sucessora68","sha256":"e1d05d5789a5517cbea8acfd6b7efa9ff436f17915c1bb7a6251a7fe58477ff9","argtypes":"integer, integer","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_cotar_edicao_despesa69","sha256":"703ab6399f999ef6ae085d93a68d67085dbfbf1a2714a6378e3cc7feae51d382","argtypes":"integer, integer","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_editar_despesa69","sha256":"91b5c0013e9bed2565ae7ef3bc2ff91583f383ebdf5ba6d00937db18f4820758","argtypes":"integer, uuid, jsonb","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_recuperar_edicao_despesa69","sha256":"96de8c35851c907622a8bfe78abf4ecba579891c13afed35e6ce10d85d28a30f","argtypes":"integer, uuid, jsonb","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_capacidades_despesas69","sha256":"cd1e402607325bacd7648d68349cc1fd373e95794b205280fba8dc4020be68ed","argtypes":"","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_linhagem_despesas69","sha256":"1f7b995c27ccdc427349614cfba3a54f5135f94e27362b30745d363aee7d13e5","argtypes":"integer, integer","result":"jsonb","secdef":true,"config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name')<>1 OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=e->>'name' AND p.proowner='postgres'::regrole AND p.prosecdef=(e->>'secdef')::boolean AND oidvectortypes(p.proargtypes)=e->>'argtypes' AND pg_get_function_result(p.oid)=e->>'result' AND p.prokind='f' AND p.prolang IN(SELECT oid FROM pg_language WHERE lanname IN('sql','plpgsql')) AND to_jsonb(p.proconfig)=e->'config' AND encode(extensions.digest(p.prosrc,'sha256'),'hex')=e->>'sha256') THEN RAISE EXCEPTION '69 new function unknown %',e->>'name' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_temp_%' AND NOT EXISTS(SELECT 1 FROM witness69_functions w WHERE w.oid=p.oid))<>21 THEN RAISE EXCEPTION '69 extra function' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM witness69_catalog w LEFT JOIN (SELECT 'class' kind,c.oid::text k,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] snapshot FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'attribute',a.attrelid::text||':'||a.attnum,to_jsonb(a) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'constraint',c.oid::text,to_jsonb(c) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'trigger',t.oid::text,to_jsonb(t) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'policy',p.oid::text,to_jsonb(p) FROM pg_policy p
 UNION ALL SELECT 'default',d.oid::text,to_jsonb(d) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'index',i.indexrelid::text,to_jsonb(i) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'namespace',oid::text,to_jsonb(n) FROM pg_namespace n WHERE nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'role',oid::text,to_jsonb(r) FROM pg_roles r
 UNION ALL SELECT 'member',roleid::text||':'||member,to_jsonb(m) FROM pg_auth_members m
 UNION ALL SELECT 'defaultacl',oid::text,to_jsonb(d) FROM pg_default_acl d
 UNION ALL SELECT 'type',t.oid::text,to_jsonb(t) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_'
 UNION ALL SELECT 'setting',setdatabase::text||':'||setrole,to_jsonb(d) FROM pg_db_role_setting d) a ON a.kind=w.kind AND a.k=w.k WHERE a.snapshot IS DISTINCT FROM w.snapshot) THEN RAISE EXCEPTION '69 old catalog changed' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='despesas69' AND a.grantee<>n.nspowner)
 OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a WHERE c.relnamespace='despesas69'::regnamespace AND a.grantee<>c.relowner)
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE (n.nspname='despesas69' OR p.oid=ANY(ARRAY['public.rpc_cotar_edicao_despesa69(integer,integer)'::regprocedure,'public.rpc_editar_despesa69(integer,uuid,jsonb)'::regprocedure,'public.rpc_recuperar_edicao_despesa69(integer,uuid,jsonb)'::regprocedure,'public.rpc_capacidades_despesas69()'::regprocedure,'public.rpc_linhagem_despesas69(integer,integer)'::regprocedure])) AND a.grantee<>p.proowner AND NOT(n.nspname='public' AND a.grantee='service_role'::regrole AND a.privilege_type='EXECUTE' AND NOT a.is_grantable)) THEN RAISE EXCEPTION '69 inherited/extra ACL unknown' USING ERRCODE='55000'; END IF;
 SELECT public.caixa37_hash(jsonb_build_object(
 'funcoes',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE (p.pronamespace='public'::regnamespace OR p.proname LIKE 'caixa37\_%' ESCAPE '\' OR p.proname LIKE 'rpc\_%caixa37' ESCAPE '\') AND p.oid<>ALL(ARRAY['public.rpc_cotar_edicao_despesa69(integer,integer)'::regprocedure,'public.rpc_editar_despesa69(integer,uuid,jsonb)'::regprocedure,'public.rpc_recuperar_edicao_despesa69(integer,uuid,jsonb)'::regprocedure,'public.rpc_capacidades_despesas69()'::regprocedure,'public.rpc_linhagem_despesas69(integer,integer)'::regprocedure])),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='public'::regnamespace AND a.attnum>0),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(t),pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) ORDER BY oid) FROM pg_roles WHERE rolname IN('service_role','anon','authenticated',current_user)),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m WHERE member IN(SELECT oid FROM pg_roles WHERE rolname IN('service_role','anon','authenticated'))))) INTO derived;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_(temp|toast_temp)_' AND NOT EXISTS(SELECT 1 FROM witness69_catalog w WHERE w.kind='class' AND w.k=c.oid::text) AND c.relnamespace<>'despesas69'::regnamespace AND NOT(c.oid IN(SELECT reltoastrelid FROM pg_class WHERE relnamespace='despesas69'::regnamespace) OR c.oid IN(SELECT indexrelid FROM pg_index WHERE indrelid IN(SELECT reltoastrelid FROM pg_class WHERE relnamespace='despesas69'::regnamespace)))) THEN RAISE EXCEPTION '69 relation outside exact allowlist' USING ERRCODE='55000'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='despesas69'::regnamespace AND relkind='r')<>3 OR (SELECT count(*) FROM pg_class WHERE relnamespace='despesas69'::regnamespace)<>10
 OR (SELECT count(*) FROM pg_constraint WHERE connamespace='despesas69'::regnamespace)<>13
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas69'::regnamespace))<>7
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas69'::regnamespace))
 OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='despesas69'::regnamespace AND relkind='r' AND (NOT relrowsecurity OR relowner<>'postgres'::regrole))
 OR (SELECT array_agg(attname ORDER BY attnum) FROM pg_attribute WHERE attrelid='despesas69.operacoes'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM ARRAY['user_id','chave','operation_id','despesa_id','raiz_id','sucessora_id','sucessora_operation_id','filha_chave','status','request','hash_request','antes','depois','sucessora','valor_anterior','valor_novo','motivo','resultado','instante']::name[] THEN RAISE EXCEPTION '69 new object shape/allowlist unknown' USING ERRCODE='55000',DETAIL=jsonb_build_object('tables',(SELECT count(*) FROM pg_class WHERE relnamespace='despesas69'::regnamespace AND relkind='r'),'classes',(SELECT count(*) FROM pg_class WHERE relnamespace='despesas69'::regnamespace),'constraints',(SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE connamespace='despesas69'::regnamespace),'triggers',(SELECT count(*) FROM pg_trigger WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas69'::regnamespace)),'columns',(SELECT array_agg(attname ORDER BY attnum) FROM pg_attribute WHERE attrelid='despesas69.operacoes'::regclass AND attnum>0 AND NOT attisdropped))::text; END IF;
 IF derived IS DISTINCT FROM old THEN RAISE EXCEPTION '69 exact delta37 failed; cannot reseal drift' USING ERRCODE='55000'; END IF;
 expected:=public.caixa37_metadata();
 UPDATE public.caixa37_manifesto SET assinatura=expected WHERE id=1 AND assinatura=old;
 GET DIAGNOSTICS nr=ROW_COUNT; IF nr<>1 THEN RAISE EXCEPTION '69 CAS37 failed' USING ERRCODE='55000'; END IF;
 FOR witness_row IN SELECT * FROM witness69_data LOOP
  projection:=CASE WHEN witness_row.rel='public.caixa37_manifesto'::regclass THEN 'to_jsonb(x)-''assinatura''' ELSE 'to_jsonb(x)' END;
  EXECUTE format('SELECT coalesce(jsonb_agg(%s ORDER BY (%s)::text),''[]''::jsonb) FROM %s x',projection,projection,witness_row.rel::regclass) INTO j;
  IF j IS DISTINCT FROM witness_row.snapshot THEN RAISE EXCEPTION '69 changed existing data %',witness_row.rel::regclass USING ERRCODE='55000'; END IF;
 END LOOP;
 INSERT INTO despesas69.manifesto VALUES(1,despesas69.metadata());
PERFORM public.legados_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.multa36_verificar(); PERFORM public.caixa37_verificar(); PERFORM despesa_cancelamento_v1.verificar(); PERFORM telefone41.verificar(); PERFORM manutencao44.verificar(); PERFORM caixa_manutencao45.verificar(); PERFORM calendario46.verificar(); PERFORM private47.verificar(); PERFORM manutencao48.verificar(); PERFORM despesas49.verificar(); PERFORM obrigacoes51.verificar(); PERFORM inclusao52.verificar(); PERFORM sucessores53.verificar(); PERFORM emprestimos_lista60.verificar();
 PERFORM despesas69.verificar();
 -- Own capability ON only after intact metadata/postflight, no old flag flips.
 PERFORM despesas69.configurar(true);
 IF EXISTS(SELECT 1 FROM despesas69.operacoes) OR NOT despesas69.habilitado() THEN RAISE EXCEPTION '69 installation state invalid' USING ERRCODE='55000'; END IF;
END $post69$;
NOTIFY pgrst,'reload schema';
COMMIT;
