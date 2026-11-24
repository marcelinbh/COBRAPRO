-- 0045 final: observação adicional, NUNCA estorno monetário nem saneamento histórico.
-- Baseline financeiro: SQL36/36a/37 congelados + 42final SHA256 0df0301ade56145681b721da149fc3048a46ed630cfe1be771c0bcfcf25c83fb.
-- Nenhuma ponte8 é substituída; delta42 e demais funções existentes permanecem byte a byte.
-- Aplicar one-shot em janela DDL exclusiva. Somente três facades específicas service_role em public.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.users,public.clientes,public.contas_caixa,public.contratos,public.parcelas,public.transacoes_caixa IN SHARE ROW EXCLUSIVE MODE;
DO $gate45$ BEGIN
 PERFORM public.caixa37_verificar();
 IF current_user<>'postgres' OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='caixa_manutencao45')
 OR to_regprocedure('public.assinaturas42_validar(uuid)') IS NULL
 OR EXISTS(SELECT 1 FROM pg_proc WHERE proname IN('rpc_consultar_observacao45','rpc_corrigir_observacao45','rpc_reconciliar_observacao45')) THEN
  RAISE EXCEPTION '0045 exige postgres, baseline42final e nomes45 novos' USING ERRCODE='55000'; END IF;
END $gate45$;
-- TODAS fontes/ACL/config preexistentes, não apenas lista parcial de predecessores.
CREATE TEMP TABLE caixa45_function_witness ON COMMIT DROP AS SELECT oid,to_jsonb(p) snapshot FROM pg_proc p;
CREATE TEMP TABLE caixa45_catalog_witness ON COMMIT DROP AS SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.oid IN(SELECT oid FROM caixa45_function_witness)),
 'publicRelations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
 'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'namespace',(SELECT to_jsonb(n) FROM pg_namespace n WHERE n.oid='public'::regnamespace),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m),
 'config',(SELECT jsonb_agg(to_jsonb(s) ORDER BY setdatabase,setrole) FROM pg_db_role_setting s)) snapshot;
CREATE SCHEMA caixa_manutencao45 AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA caixa_manutencao45 FROM PUBLIC,anon,authenticated,service_role;
-- Somente facades public têm EXECUTE; schema privado NÃO exposto.
CREATE TABLE caixa_manutencao45.operacoes(
  id uuid PRIMARY KEY,
  user_id integer NOT NULL CHECK(user_id>0),
  chave uuid NOT NULL,
  transacao_id integer NOT NULL CHECK(transacao_id>0),
  request jsonb NOT NULL,
  estado text NOT NULL CHECK(estado IN('confirmed','not_executed')),
  original jsonb,
  original_hash text,
  anterior uuid REFERENCES caixa_manutencao45.operacoes(id),
  resultado jsonb NOT NULL,
  instante timestamptz NOT NULL,
  UNIQUE(user_id,chave),
  CHECK((estado='not_executed' AND original IS NULL AND original_hash IS NULL AND anterior IS NULL)
     OR (estado='confirmed' AND original IS NOT NULL AND original_hash ~ '^[a-f0-9]{64}$'))
);
-- Nenhuma FK para public: verificações/locks são explícitos e não invalidam selos37.
CREATE INDEX operacoes_movimento45 ON caixa_manutencao45.operacoes(user_id,transacao_id) WHERE estado='confirmed';
ALTER TABLE caixa_manutencao45.operacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE caixa_manutencao45.operacoes FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION caixa_manutencao45.imutavel() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Auditoria45 append-only' USING ERRCODE='42501'; END $$;
CREATE TRIGGER auditoria45_imutavel BEFORE UPDATE OR DELETE ON caixa_manutencao45.operacoes
FOR EACH ROW EXECUTE FUNCTION caixa_manutencao45.imutavel();
CREATE FUNCTION caixa_manutencao45.request_valido(r jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE k text; v text;
BEGIN
 IF r IS NULL OR jsonb_typeof(r) IS DISTINCT FROM 'object'
 OR r-ARRAY['transacaoId','estadoHash','observacao','motivo']<>'{}'::jsonb
 OR (SELECT count(*) FROM jsonb_object_keys(r))<>4
 OR jsonb_typeof(r->'transacaoId') IS DISTINCT FROM 'number'
 OR coalesce(r->>'transacaoId','') !~ '^[1-9][0-9]{0,9}$'
 OR (r->>'transacaoId')::bigint>2147483647
 OR jsonb_typeof(r->'estadoHash') IS DISTINCT FROM 'string'
 OR coalesce(r->>'estadoHash','') !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Request45 fechado obrigatório' USING ERRCODE='22023';
 END IF;
 FOREACH k IN ARRAY ARRAY['observacao','motivo'] LOOP
   v:=r->>k;
   IF jsonb_typeof(r->k) IS DISTINCT FROM 'string' OR length(v) NOT BETWEEN 1 AND 500
   OR v<>btrim(v) OR v ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' THEN
     RAISE EXCEPTION 'Texto45 inválido' USING ERRCODE='22023';
   END IF;
 END LOOP;
END $$;
CREATE FUNCTION caixa_manutencao45.barreira(uid integer,k uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM caixa_manutencao45.verificar();
 IF uid IS NULL OR uid<=0 OR k IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid) THEN
   RAISE EXCEPTION 'Owner/UUID45 inválido' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('caixa45:'||uid::text||':'||k::text,45));
END $$;
CREATE FUNCTION caixa_manutencao45.conjunto(aid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object(
 'contas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contas_caixa WHERE id=aid),'[]'::jsonb),
 'contratos',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contratos WHERE id IN(SELECT contrato_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid) OR id IN(SELECT contrato_id FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid))),'[]'::jsonb),
 'parcelas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid)),'[]'::jsonb));
$$;
CREATE FUNCTION caixa_manutencao45.travar_conta(uid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s jsonb; n integer; aids integer[]; cids integer[]; pids integer[]; clients integer[]; collectors integer[];
BEGIN
 IF uid IS NULL OR uid<=0 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid) THEN RAISE EXCEPTION 'Owner37 indisponível' USING ERRCODE='42501'; END IF;
 s:=caixa_manutencao45.conjunto(aid);
 SELECT coalesce(array_agg(v::text::int),'{}') INTO aids FROM jsonb_array_elements(s->'contas') v;
 SELECT coalesce(array_agg(v::text::int),'{}') INTO cids FROM jsonb_array_elements(s->'contratos') v;
 SELECT coalesce(array_agg(v::text::int),'{}') INTO pids FROM jsonb_array_elements(s->'parcelas') v;
 SELECT array_agg(DISTINCT cliente_id) INTO clients FROM public.contratos WHERE id=ANY(cids);
 SELECT array_agg(DISTINCT v) INTO collectors FROM (SELECT koletor_id v FROM public.contratos WHERE id=ANY(cids) UNION SELECT koletor_id FROM public.parcelas WHERE id=ANY(pids)) q;
 -- Try-lock não introduz espera circular com barreiras financeiras predecessoras.
 FOREACH n IN ARRAY aids LOOP IF NOT pg_try_advisory_xact_lock(22022,n) THEN RAISE EXCEPTION 'Conta37 concorrente' USING ERRCODE='40001'; END IF; END LOOP;
 IF NOT pg_try_advisory_xact_lock(34034,uid) THEN RAISE EXCEPTION 'Owner37 concorrente' USING ERRCODE='40001'; END IF;
 FOREACH n IN ARRAY cids LOOP IF NOT pg_try_advisory_xact_lock(34035,n) THEN RAISE EXCEPTION 'Contrato37 concorrente' USING ERRCODE='40001'; END IF; END LOOP;
 PERFORM 1 FROM public.contas_caixa WHERE id=ANY(aids) ORDER BY id FOR NO KEY UPDATE NOWAIT;
 PERFORM 1 FROM public.clientes WHERE id=ANY(clients) ORDER BY id FOR NO KEY UPDATE NOWAIT;
 PERFORM 1 FROM public.koletores WHERE id=ANY(collectors) ORDER BY id FOR NO KEY UPDATE NOWAIT;
 PERFORM 1 FROM public.contratos WHERE id=ANY(cids) ORDER BY id FOR NO KEY UPDATE NOWAIT;
 PERFORM 1 FROM public.parcelas WHERE id=ANY(pids) ORDER BY id FOR NO KEY UPDATE NOWAIT;
 PERFORM 1 FROM public.transacoes_caixa WHERE conta_caixa_id=aid ORDER BY id FOR NO KEY UPDATE NOWAIT;
 IF caixa_manutencao45.conjunto(aid) IS DISTINCT FROM s OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND NOT cliente_id=ANY(clients))
 OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE id=ANY(pids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors)) THEN RAISE EXCEPTION 'Conjunto37 mudou durante locks' USING ERRCODE='40001'; END IF;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Row37 concorrente' USING ERRCODE='40001';
END $$;
CREATE FUNCTION caixa_manutencao45.validar_conta(uid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a public.contas_caixa%ROWTYPE; t public.transacoes_caixa%ROWTYPE; oid37 uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=aid AND user_id=uid) THEN RAISE EXCEPTION 'Conta45 indisponível' USING ERRCODE='42501'; END IF;
 FOR a IN SELECT * FROM public.contas_caixa WHERE id=aid AND user_id=uid LOOP
 IF a.id<=0 OR a.saldo::text IN('NaN','Infinity','-Infinity') OR a.saldo<>round(a.saldo,2) OR abs(a.saldo)>9999999999999.99 THEN RAISE EXCEPTION 'Saldo-base37 inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR t IN SELECT * FROM public.transacoes_caixa WHERE conta_caixa_id=aid ORDER BY id LOOP
 IF t.id<=0 OR t.user_id IS DISTINCT FROM uid OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=t.conta_caixa_id AND user_id=uid)
 OR t.tipo NOT IN('entrada','saida') OR t.valor::text IN('NaN','Infinity','-Infinity') OR t.valor<=0 OR t.valor<>round(t.valor,2) OR NOT isfinite(t.data_transacao)
 OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.clientes cl ON cl.id=c.cliente_id WHERE c.id=t.contrato_id AND c.user_id=uid AND cl.user_id=uid AND c.conta_caixa_id=t.conta_caixa_id AND (c.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid))))
 OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id JOIN public.clientes cl ON cl.id=p.cliente_id WHERE p.id=t.parcela_id AND p.user_id=uid AND c.user_id=uid AND cl.user_id=uid AND p.cliente_id=c.cliente_id AND p.contrato_id=t.contrato_id AND p.conta_caixa_id=t.conta_caixa_id AND (p.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=p.koletor_id AND user_id=uid)))) THEN RAISE EXCEPTION 'Ledger45 conta selecionada crossowner/estrutura inválida' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR oid37 IN SELECT id FROM public.caixa37_operacoes o WHERE o.user_id=uid AND (o.request->>'contaOrigemId'=aid::text OR o.request->>'contaDestinoId'=aid::text OR EXISTS(SELECT 1 FROM public.caixa37_pernas p JOIN public.transacoes_caixa leg ON leg.id=p.transacao_id WHERE p.operacao_id=o.id AND leg.conta_caixa_id=aid)) LOOP PERFORM public.caixa37_validar_op(oid37); END LOOP;
 IF EXISTS(SELECT 1 FROM public.caixa37_contas p LEFT JOIN public.contas_caixa ac ON ac.id=p.conta_id WHERE p.conta_id=aid AND (p.user_id IS DISTINCT FROM uid OR ac.id IS NULL OR ac.user_id IS DISTINCT FROM p.user_id OR ac.saldo IS DISTINCT FROM p.saldo_base)) THEN RAISE EXCEPTION 'Pin37 divergente' USING ERRCODE='23514'; END IF;
 FOR oid37 IN SELECT id FROM public.assinaturas42_operacoes WHERE conta_id=aid LOOP PERFORM public.assinaturas42_validar(oid37); END LOOP;
END $$;
CREATE FUNCTION caixa_manutencao45.original(uid integer,tid integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE j jsonb; aid integer;
BEGIN
 SELECT conta_caixa_id INTO aid FROM public.transacoes_caixa WHERE id=tid AND user_id=uid;
 IF aid IS NULL OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=aid AND user_id=uid AND ativo IS TRUE) THEN
  RAISE EXCEPTION 'Movimento45 indisponível' USING ERRCODE='42501'; END IF;
 PERFORM caixa_manutencao45.travar_conta(uid,aid);
 PERFORM caixa_manutencao45.validar_conta(uid,aid);
 SELECT jsonb_build_object('id',t.id,'user_id',t.user_id,'conta_caixa_id',t.conta_caixa_id,
   'contrato_id',t.contrato_id,'parcela_id',t.parcela_id,'tipo',t.tipo,'categoria',t.categoria,
   'valor',public.caixa37_decimal(t.valor),'descricao',t.descricao,
   'data_transacao',t.data_transacao,'createdAt',t."createdAt") INTO j
 FROM public.transacoes_caixa t JOIN public.contas_caixa c ON c.id=t.conta_caixa_id
 WHERE t.id=tid AND t.user_id=uid AND t.conta_caixa_id=aid AND c.user_id=uid AND c.ativo IS TRUE;
 IF j IS NULL THEN RAISE EXCEPTION 'Movimento45 indisponível' USING ERRCODE='42501'; END IF;
 RETURN j;
END $$;
CREATE FUNCTION caixa_manutencao45.consultar(p_user_id integer,p_transacao_id integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE j jsonb; h text; lastop caixa_manutencao45.operacoes%ROWTYPE; n integer;
BEGIN
 PERFORM public.caixa37_verificar();
 j:=caixa_manutencao45.original(p_user_id,p_transacao_id); h:=public.caixa37_hash(j);
 SELECT o.id,o.user_id,o.chave,o.transacao_id,o.request,o.estado,o.original,o.original_hash,o.anterior,o.resultado,o.instante INTO lastop
 FROM caixa_manutencao45.operacoes o WHERE o.user_id=p_user_id AND o.transacao_id=p_transacao_id AND o.estado='confirmed'
 AND NOT EXISTS(SELECT 1 FROM caixa_manutencao45.operacoes n WHERE n.anterior=o.id) LIMIT 1;
 SELECT count(*)::int INTO n FROM caixa_manutencao45.operacoes WHERE user_id=p_user_id AND transacao_id=p_transacao_id AND estado='confirmed';
 IF lastop.id IS NOT NULL AND lastop.original IS DISTINCT FROM j THEN
   RAISE EXCEPTION 'Original45 mudou; não corrigir origem financeira' USING ERRCODE='23514';
 END IF;
 RETURN jsonb_build_object('regra','correcao_observacao45_v1','empresaId',p_user_id,'transacaoId',p_transacao_id,
 'originalHash',h,'estadoHash',public.caixa37_hash(jsonb_build_object('original',j,'ultima',lastop.id)),
 'observacaoAtual',lastop.request->>'observacao','ultimaCorrecao',lastop.resultado,'correcoes',n);
END $$;
CREATE FUNCTION caixa_manutencao45.corrigir(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE oldop caixa_manutencao45.operacoes%ROWTYPE; q jsonb; j jsonb; r jsonb; oid45 uuid:=gen_random_uuid(); inst timestamptz:=clock_timestamp(); tid integer;
BEGIN
 PERFORM caixa_manutencao45.request_valido(p_request);
 PERFORM caixa_manutencao45.barreira(p_user_id,p_chave);
 SELECT o.id,o.user_id,o.chave,o.transacao_id,o.request,o.estado,o.original,o.original_hash,o.anterior,o.resultado,o.instante INTO oldop
 FROM caixa_manutencao45.operacoes o WHERE o.user_id=p_user_id AND o.chave=p_chave;
 IF FOUND THEN
   IF oldop.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'UUID45 outro payload' USING ERRCODE='23505'; END IF;
   IF oldop.estado='not_executed' THEN RAISE EXCEPTION 'UUID45 fechado por recovery; não executar tardiamente' USING ERRCODE='55000'; END IF;
   RETURN oldop.resultado;
 END IF;
 tid:=(p_request->>'transacaoId')::int;
 q:=caixa_manutencao45.consultar(p_user_id,tid);
 IF q->>'estadoHash' IS DISTINCT FROM p_request->>'estadoHash' THEN RAISE EXCEPTION 'Prévia45 alterada' USING ERRCODE='40001'; END IF;
 j:=caixa_manutencao45.original(p_user_id,tid);
 r:=jsonb_build_object('regra','correcao_observacao45_v1','empresaId',p_user_id,'idempotencyKey',p_chave,
 'transacaoId',tid,'request',p_request,'operacaoId',oid45,'originalHash',q->>'originalHash','instante',inst);
 INSERT INTO caixa_manutencao45.operacoes(id,user_id,chave,transacao_id,request,estado,original,original_hash,anterior,resultado,instante)
 VALUES(oid45,p_user_id,p_chave,tid,p_request,'confirmed',j,q->>'originalHash',(q->'ultimaCorrecao'->>'operacaoId')::uuid,r,inst);
 RETURN r;
END $$;
CREATE FUNCTION caixa_manutencao45.reconciliar(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE o caixa_manutencao45.operacoes%ROWTYPE; r jsonb;
BEGIN
 PERFORM caixa_manutencao45.request_valido(p_request);
 PERFORM caixa_manutencao45.barreira(p_user_id,p_chave);
 SELECT a.id,a.user_id,a.chave,a.transacao_id,a.request,a.estado,a.original,a.original_hash,a.anterior,a.resultado,a.instante INTO o
 FROM caixa_manutencao45.operacoes a WHERE a.user_id=p_user_id AND a.chave=p_chave;
 IF FOUND THEN
   IF o.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'UUID45 outro payload' USING ERRCODE='23505'; END IF;
   IF o.estado='confirmed' THEN RETURN jsonb_build_object('status','confirmed','result',o.resultado); END IF;
   RETURN o.resultado;
 END IF;
 -- Fence persistido sob mesma barreira: ausência agora impede execução tardia.
 r:=jsonb_build_object('status','not_executed','empresaId',p_user_id,'idempotencyKey',p_chave,'request',p_request);
 INSERT INTO caixa_manutencao45.operacoes(id,user_id,chave,transacao_id,request,estado,resultado,instante)
 VALUES(gen_random_uuid(),p_user_id,p_chave,(p_request->>'transacaoId')::int,p_request,'not_executed',r,clock_timestamp());
 RETURN r;
END $$;

CREATE TABLE caixa_manutencao45.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);
ALTER TABLE caixa_manutencao45.manifesto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON caixa_manutencao45.manifesto FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER manifesto45_imutavel BEFORE UPDATE OR DELETE ON caixa_manutencao45.manifesto FOR EACH ROW EXECUTE FUNCTION caixa_manutencao45.imutavel();
CREATE FUNCTION caixa_manutencao45.metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT public.caixa37_hash(jsonb_build_object(
 'namespace',(SELECT to_jsonb(n) FROM pg_namespace n WHERE n.oid='caixa_manutencao45'::regnamespace),
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='caixa_manutencao45'::regnamespace),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='caixa_manutencao45'::regnamespace),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='caixa_manutencao45'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='caixa_manutencao45'::regnamespace),
 'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='caixa_manutencao45'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='caixa_manutencao45'::regnamespace)));
$$;
CREATE FUNCTION caixa_manutencao45.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.caixa37_verificar();
 IF (SELECT assinatura FROM caixa_manutencao45.manifesto WHERE id=1) IS DISTINCT FROM caixa_manutencao45.metadata() THEN
  RAISE EXCEPTION 'Metadata45 desconhecida; não reseal runtime' USING ERRCODE='55000'; END IF;
END $$;
CREATE FUNCTION public.rpc_consultar_observacao45(p_user_id integer,p_transacao_id integer) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT caixa_manutencao45.consultar(p_user_id,p_transacao_id) $$;
CREATE FUNCTION public.rpc_corrigir_observacao45(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT caixa_manutencao45.corrigir(p_user_id,p_chave,p_request) $$;
CREATE FUNCTION public.rpc_reconciliar_observacao45(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT caixa_manutencao45.reconciliar(p_user_id,p_chave,p_request) $$;
REVOKE ALL ON FUNCTION public.rpc_consultar_observacao45(integer,integer),public.rpc_corrigir_observacao45(integer,uuid,jsonb),public.rpc_reconciliar_observacao45(integer,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_consultar_observacao45(integer,integer),public.rpc_corrigir_observacao45(integer,uuid,jsonb),public.rpc_reconciliar_observacao45(integer,uuid,jsonb) TO service_role;
DO $acl45$ DECLARE p record; BEGIN
 FOR p IN SELECT oid FROM pg_proc WHERE pronamespace='caixa_manutencao45'::regnamespace LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.oid::regprocedure);
 END LOOP;
END $acl45$;

DO $post45$
#variable_conflict use_column
DECLARE e jsonb; p record; actual jsonb; BEGIN
 IF (SELECT snapshot FROM caixa45_catalog_witness) IS DISTINCT FROM jsonb_build_object(
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.oid IN(SELECT oid FROM caixa45_function_witness)),
 'publicRelations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
 'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'namespace',(SELECT to_jsonb(n) FROM pg_namespace n WHERE n.oid='public'::regnamespace),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m),
 'config',(SELECT jsonb_agg(to_jsonb(s) ORDER BY setdatabase,setrole) FROM pg_db_role_setting s)) THEN
  RAISE EXCEPTION '0045 predecessor fonte/ACL/config/catálogo mudou' USING ERRCODE='55000'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"caixa_manutencao45.imutavel","args":"","hash":"f8df130810cfd88ddbfba3421eb8ed55b8be047d67af76ef7074a74a6cd8ac01","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"trigger"},{"name":"caixa_manutencao45.request_valido","args":"jsonb","hash":"fcfc28e08e1d2eba191592c0258096600438113731800b9c7d52e971a6148809","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"void"},{"name":"caixa_manutencao45.barreira","args":"integer, uuid","hash":"4021b4abcf73e040efd9faf9a6146d473965ab72c8e884b3bf940727e41f1c4b","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"void"},{"name":"caixa_manutencao45.conjunto","args":"integer","hash":"32ea04652ef20d0d0f7602d1e8fbd47e17d0bb960cb9f7d3a0caf3c82b77035b","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"jsonb"},{"name":"caixa_manutencao45.travar_conta","args":"integer, integer","hash":"ad71e38e6ec5fa3e72fc8edbb028f6feb1df44b3638836907b92da84d0f9580c","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"void"},{"name":"caixa_manutencao45.validar_conta","args":"integer, integer","hash":"361e279d0ee3d6267d2f4a1fe8a5c66ede13663a4eff8c2a9ba00fe327f392db","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"void"},{"name":"caixa_manutencao45.original","args":"integer, integer","hash":"f90d25e1dbb5583a3e7dd4fd0fa81bbd7d52da59c96923187e30e2440244a9a2","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"jsonb"},{"name":"caixa_manutencao45.consultar","args":"integer, integer","hash":"7b12f31e8d3f33e8a161e0feb3afe15f06778f9b891c6809cef760bf6049377f","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"jsonb"},{"name":"caixa_manutencao45.corrigir","args":"integer, uuid, jsonb","hash":"1081caa9513132af23457369e214c9e89e5702e72a04a4f5290a034ecf95caf1","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"jsonb"},{"name":"caixa_manutencao45.reconciliar","args":"integer, uuid, jsonb","hash":"9233dc3eae5acb3fba38dea6547e14b2791f18b3aeebdbef7306f1d1dc9810bd","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"jsonb"},{"name":"caixa_manutencao45.metadata","args":"","hash":"932d2a33e39e0fafff9ce180cb5f39787746fad4ba4080afd4cd74eb702e8c05","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"text"},{"name":"caixa_manutencao45.verificar","args":"","hash":"7fede673d9cc0d3fa53f27d5ef6b187c629861905d6e19aca0876a6146af37f6","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"void"},{"name":"public.rpc_consultar_observacao45","args":"integer, integer","hash":"7291ad86cb7b041fce2d3c5e970de5dd9b4cc3f48cc9ab94df9b0b70ef5d930f","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"jsonb"},{"name":"public.rpc_corrigir_observacao45","args":"integer, uuid, jsonb","hash":"07642370c47f1cbaab48f2345da66d66b752cafe9d53c91e9c8133f3a8a3163e","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"jsonb"},{"name":"public.rpc_reconciliar_observacao45","args":"integer, uuid, jsonb","hash":"eab34f80db2497302f9422cbf05784046aa881a09be32c528645501d97e07064","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"jsonb"}]'::jsonb) LOOP
  SELECT pp.*,l.lanname,pg_get_function_result(pp.oid) result INTO STRICT p FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure((e->>'name')||'('||(e->>'args')||')');
  IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
  OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user) OR NOT p.prosecdef OR p.prokind<>'f' OR p.provolatile<>'v' OR p.proparallel<>'u' OR p.proisstrict OR p.proleakproof OR p.pronargdefaults<>0 OR p.result IS DISTINCT FROM e->>'result' OR p.lanname IS DISTINCT FROM e->>'lang'
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner AND NOT(e->>'name' LIKE 'public.rpc_%' AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role') AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
  OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
  OR has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM (e->>'name' LIKE 'public.rpc_%') THEN
   RAISE EXCEPTION '0045 função nova fonte/ACL/config/owner divergente %',e->>'name' USING ERRCODE='55000'; END IF;
 END LOOP;
 SELECT jsonb_agg(p.oid ORDER BY p.oid) INTO actual FROM pg_proc p WHERE NOT EXISTS(SELECT 1 FROM caixa45_function_witness w WHERE w.oid=p.oid);
 IF jsonb_array_length(actual)<>15 OR EXISTS(SELECT 1 FROM pg_proc p WHERE NOT EXISTS(SELECT 1 FROM caixa45_function_witness w WHERE w.oid=p.oid) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements('[{"name":"caixa_manutencao45.imutavel","args":"","hash":"f8df130810cfd88ddbfba3421eb8ed55b8be047d67af76ef7074a74a6cd8ac01","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"trigger"},{"name":"caixa_manutencao45.request_valido","args":"jsonb","hash":"fcfc28e08e1d2eba191592c0258096600438113731800b9c7d52e971a6148809","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"void"},{"name":"caixa_manutencao45.barreira","args":"integer, uuid","hash":"4021b4abcf73e040efd9faf9a6146d473965ab72c8e884b3bf940727e41f1c4b","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"void"},{"name":"caixa_manutencao45.conjunto","args":"integer","hash":"32ea04652ef20d0d0f7602d1e8fbd47e17d0bb960cb9f7d3a0caf3c82b77035b","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"jsonb"},{"name":"caixa_manutencao45.travar_conta","args":"integer, integer","hash":"ad71e38e6ec5fa3e72fc8edbb028f6feb1df44b3638836907b92da84d0f9580c","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"void"},{"name":"caixa_manutencao45.validar_conta","args":"integer, integer","hash":"361e279d0ee3d6267d2f4a1fe8a5c66ede13663a4eff8c2a9ba00fe327f392db","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"void"},{"name":"caixa_manutencao45.original","args":"integer, integer","hash":"f90d25e1dbb5583a3e7dd4fd0fa81bbd7d52da59c96923187e30e2440244a9a2","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"jsonb"},{"name":"caixa_manutencao45.consultar","args":"integer, integer","hash":"7b12f31e8d3f33e8a161e0feb3afe15f06778f9b891c6809cef760bf6049377f","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"jsonb"},{"name":"caixa_manutencao45.corrigir","args":"integer, uuid, jsonb","hash":"1081caa9513132af23457369e214c9e89e5702e72a04a4f5290a034ecf95caf1","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"jsonb"},{"name":"caixa_manutencao45.reconciliar","args":"integer, uuid, jsonb","hash":"9233dc3eae5acb3fba38dea6547e14b2791f18b3aeebdbef7306f1d1dc9810bd","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"],"lang":"plpgsql","result":"jsonb"},{"name":"caixa_manutencao45.metadata","args":"","hash":"932d2a33e39e0fafff9ce180cb5f39787746fad4ba4080afd4cd74eb702e8c05","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"text"},{"name":"caixa_manutencao45.verificar","args":"","hash":"7fede673d9cc0d3fa53f27d5ef6b187c629861905d6e19aca0876a6146af37f6","config":["search_path=pg_catalog, pg_temp"],"lang":"plpgsql","result":"void"},{"name":"public.rpc_consultar_observacao45","args":"integer, integer","hash":"7291ad86cb7b041fce2d3c5e970de5dd9b4cc3f48cc9ab94df9b0b70ef5d930f","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"jsonb"},{"name":"public.rpc_corrigir_observacao45","args":"integer, uuid, jsonb","hash":"07642370c47f1cbaab48f2345da66d66b752cafe9d53c91e9c8133f3a8a3163e","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"jsonb"},{"name":"public.rpc_reconciliar_observacao45","args":"integer, uuid, jsonb","hash":"eab34f80db2497302f9422cbf05784046aa881a09be32c528645501d97e07064","config":["search_path=pg_catalog, pg_temp"],"lang":"sql","result":"jsonb"}]'::jsonb) e WHERE p.oid=to_regprocedure((e->>'name')||'('||(e->>'args')||')'))) THEN
  RAISE EXCEPTION '0045 função adicional desconhecida' USING ERRCODE='55000'; END IF;
END $post45$;
INSERT INTO caixa_manutencao45.manifesto VALUES(1,caixa_manutencao45.metadata());
-- APENAS instalação, após testemunhos intactos e novas fontes exatas; nunca runtime.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
SELECT caixa_manutencao45.verificar();
COMMIT;
