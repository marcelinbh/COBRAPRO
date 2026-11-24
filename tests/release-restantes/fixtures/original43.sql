-- CANDIDATO43 FINAL OFFLINE. Baseline obrigatório:37 + 42final SHA0df0301a (ponte8 intacta).
-- Incremento restrito: legado mensal não admitido pelos ciclos 21/22/34/35/36 e cadeia43.
-- Quatro funções35 recebem somente ramo43 exato. Ponte8 de42 final integralmente preservada.
-- Reparcelamento não movimenta Caixa; recebimento usa writer35 e suas pernas privadas existentes.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.users,public.clientes,public.koletores,public.contas_caixa,public.contratos,public.parcelas,public.transacoes_caixa,public.contrato_historico,
 public.ciclo_autorizacoes,public.ciclo_despesas_autorizacoes,public.emprestimos_rpc_origens,public.emprestimos_rpc_operacoes,public.ciclo_estados,public.ciclo_operacoes,public.ciclo_pernas,
 public.renovacao_capacidades,public.renovacao_operacoes,public.renovacao_provas,public.financial_intent_fences,
 public.legados_manifesto,public.legados_operacoes,public.legados_auditoria,public.legados_estados,public.legados_capacidades,
 public.multa36_manifesto,public.multa36_operacoes,public.multa36_origens,public.multa36_estados,public.multa36_encargos,public.multa36_pernas,public.multa36_renovacoes,public.multa36_capacidades,public.multa36_fences,public.multa36_coexistencia,
 public.multimodal_manifesto,public.multimodal_origens,public.multimodal_operacoes,public.multimodal_estados,public.multimodal_autorizacoes,public.multimodal_pernas,public.multimodal_renovacoes,public.multimodal_fences,
 public.caixa37_manifesto IN ACCESS EXCLUSIVE MODE;
DO $pre43$
DECLARE own oid; item record;
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed'
 OR current_user IN('service_role','anon','authenticated') THEN RAISE EXCEPTION '43 requer instalador confiável PG17/Read Committed' USING ERRCODE='55000'; END IF;
 SELECT oid INTO own FROM pg_roles WHERE rolname=current_user;
 IF (SELECT proowner FROM pg_proc WHERE oid='public.caixa37_verificar()'::regprocedure) IS DISTINCT FROM own THEN RAISE EXCEPTION 'Owner predecessor43 diferente' USING ERRCODE='55000'; END IF;
 -- SOURCE_PINS43: hashes de prosrc extraídos exclusivamente dos SQL versionados 34/35/36a/37.
 FOR item IN SELECT key,value FROM jsonb_each_text('{"legados_metadata":"e9a97c94c0c78dcc4f6561aae152cddc501ab6aff7ebe6312c3a7e035e6c5039","legados_verificar":"4bb4925e1a76510f7f2f41a911892c6eb24ce26464c4e19699bbc4cb14bb49c3","multimodal_metadata":"8d2b981d4b00180abfb8bd5ddebbb41d61cf06cde615e706389cd28738ff0e91","multimodal_verificar":"7dc7acd5a53f51f5f16c2702ee1bcd77344aa9eec436bac7c880b1c25ac0a3b0","multa36_metadata":"68804c8ee044c8d9776ee2b7749a8e661b3ac53aa5e4cafedd4e1e766e81fec1","multa36_verificar":"dbfaceb9994018331bd7308590e9f4cb597c3475452713d9d0cd45c4bd2dd45f","caixa37_metadata":"088bced7e8df832b95b32a44f83c2d19450eaa076c487179df54b410dd224280","caixa37_verificar":"9a5329cf96c4d571d59990cda6943906f77d3b7ff64b086a8a81971ac8abd581"}'::jsonb) LOOP
  IF (SELECT count(*) FROM pg_proc WHERE proname=item.key)<>1 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema') AND proname=item.key AND proowner=own AND prosecdef AND encode(extensions.digest(prosrc,'sha256'),'hex')=item.value) THEN RAISE EXCEPTION 'Fonte predecessora43 desconhecida %',item.key USING ERRCODE='55000'; END IF;
 END LOOP;
 PERFORM public.caixa37_verificar();
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname LIKE '%reparcelamento43%') OR EXISTS(SELECT 1 FROM pg_class WHERE relname LIKE 'reparcelamento43%') OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname LIKE 'reparcelamento43%') THEN RAISE EXCEPTION '43 one-shot/homônimo' USING ERRCODE='55000'; END IF;
END $pre43$;
DO $sources43before$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"multimodal_validar","args":"integer,integer","hash":"4b260a306bdea614a8562f2f5ef6d1665a8ba9ff8e3d3613478ee2548090b612","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multimodal_travar","args":"integer,integer","hash":"1f1fdf8b805cc395ebdb864f8afbbf406fc554a3f3cc87488c6ddf2e5ff5440a","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_selar","args":"uuid,integer,jsonb,jsonb,jsonb,jsonb","hash":"5863bf9fc4910298dcc9382e766b789ae0f7e9ebf60d85233efaa85d588afc49","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"rpc_identificar_emprestimo_multimodal","args":"integer,integer,integer","hash":"f90a2d10ee039b8d50a1c9459d545fa81917abaaa93a235c884e6fbbf7e75863","config":["search_path=pg_catalog, pg_temp"]},{"name":"ciclo_guardar","args":"","hash":"2f3fe701ead0b295f918bd768ba0df44d345d8d906030e4e494df9cfe9bfd2e9","config":["search_path=pg_catalog, pg_temp"]},{"name":"legados_guardar","args":"","hash":"122ec38128421f9687b4abe0f78d776e4e06b885fe795463b020498beb4db1d1","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_guardar","args":"","hash":"9a65fbcf387c22bc06253c1e445ec300fbba74dcbae5c17869a798dbb1b5064d","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multa36_guardar","args":"","hash":"8e4624de5ee678923c2ec07916381bf8121363e69221c2b816aa173d1b8a2223","config":["search_path=pg_catalog, pg_temp"]},{"name":"multa36_ponte","args":"","hash":"95a9c01b2f6ea9cf9c6b79525c4ab17bf519ac4f447aa7937600623c00687f98","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ponte","args":"","hash":"f56ab7b8f26b2caecb00d525374a16d6665316130b5508300f4a11860e736bb3","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ledger","args":"","hash":"0cc20d9f80098bfd377dc0ec3d344562c6d6e7f6644b92621dca5a527f8942f9","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_perna_comprovada","args":"integer,integer","hash":"5bd70c44eec12e5e6c3c52c94d41d292d3ae132c5ba16b40d7c119c84a844e3d","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '43 homônimo/overload %',e->>'name' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM ((e->>'name') LIKE 'rpc_%')
 OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') THEN RAISE EXCEPTION '43 fonte/config/ACL/owner divergente %',e->>'name' USING ERRCODE='55000'; END IF;
 END LOOP; END $sources43before$;
-- Witness integral dos objetos existentes, sem ler/exportar linhas financeiras.
CREATE TEMP TABLE witness43 ON COMMIT DROP AS SELECT
 (SELECT jsonb_object_agg(oid::text,to_jsonb(p)) FROM pg_proc p WHERE pronamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema') AND proname NOT IN('multimodal_validar','multimodal_travar','multimodal_selar','rpc_identificar_emprestimo_multimodal')) funcs,
 (SELECT jsonb_object_agg(oid::text,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']) FROM pg_class c WHERE relnamespace='public'::regnamespace) rels,
 (SELECT jsonb_object_agg(t.oid::text,to_jsonb(t)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace) trigs,
 (SELECT jsonb_object_agg(k.oid::text,to_jsonb(k)) FROM pg_constraint k WHERE connamespace='public'::regnamespace) cons;

CREATE TABLE public.reparcelamento43_operacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id integer NOT NULL,chave uuid NOT NULL,
 request jsonb NOT NULL,hash_request text NOT NULL,resultado jsonb,auditoria jsonb,concluida_em timestamptz,
 UNIQUE(user_id,chave), CHECK((resultado IS NULL)=(concluida_em IS NULL))
);
CREATE TABLE public.reparcelamento43_cadeia(
 origem_id integer PRIMARY KEY,sucessor_id integer NOT NULL UNIQUE,user_id integer NOT NULL,
 raiz_id integer NOT NULL,operacao_id uuid NOT NULL UNIQUE REFERENCES public.reparcelamento43_operacoes(id),
 CHECK(origem_id<>sucessor_id)
);
CREATE TABLE public.reparcelamento43_estados(contrato_id integer PRIMARY KEY,user_id integer NOT NULL,snapshot jsonb NOT NULL);
CREATE TABLE public.reparcelamento43_capacidades(xid bigint NOT NULL,pid integer NOT NULL,tabela text NOT NULL,evento text NOT NULL,anterior jsonb,posterior jsonb NOT NULL,PRIMARY KEY(xid,pid));
CREATE TABLE public.reparcelamento43_fences(user_id integer NOT NULL,chave uuid NOT NULL,request jsonb NOT NULL,PRIMARY KEY(user_id,chave));

CREATE FUNCTION public.reparcelamento43_request(r jsonb,confirmacao boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE keys text[]:=ARRAY['contratoId','numeroParcelas','taxaJuros','tipoTaxa','dataInicio','incluirMultas'];
BEGIN
 IF confirmacao THEN keys:=keys||ARRAY['estadoHash','cotacaoHash']; END IF;
 IF r IS NULL OR jsonb_typeof(r)<>'object' OR NOT r ?& keys OR r-keys<>'{}'::jsonb
 OR jsonb_typeof(r->'contratoId') IS DISTINCT FROM 'number' OR (r->>'contratoId')!~'^[1-9][0-9]{0,9}$' OR (r->>'contratoId')::numeric>2147483647
 OR jsonb_typeof(r->'numeroParcelas') IS DISTINCT FROM 'number' OR (r->>'numeroParcelas')!~'^[1-9][0-9]?$' OR (r->>'numeroParcelas')::int>60
 OR jsonb_typeof(r->'taxaJuros') IS DISTINCT FROM 'string' OR (r->>'taxaJuros')!~'^(0|[1-9][0-9]{0,2})\.[0-9]{2}$'
 OR r->>'tipoTaxa' IS DISTINCT FROM 'mensal' OR jsonb_typeof(r->'incluirMultas') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(r->'dataInicio') IS DISTINCT FROM 'string' OR (r->>'dataInicio')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 OR (r->>'dataInicio')::date NOT BETWEEN DATE '1900-01-01' AND DATE '9990-12-31'
 OR (confirmacao AND (jsonb_typeof(r->'estadoHash') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'cotacaoHash') IS DISTINCT FROM 'string' OR coalesce(r->>'estadoHash','')!~'^[a-f0-9]{64}$' OR coalesce(r->>'cotacaoHash','')!~'^[a-f0-9]{64}$')) THEN
 RAISE EXCEPTION 'Intenção43 inválida; mensal, taxa decimal canônica e campos fechados obrigatórios' USING ERRCODE='22023'; END IF;
 RETURN r;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Intenção43 fora da faixa' USING ERRCODE='22023';
END $$;

CREATE FUNCTION public.reparcelamento43_snapshot(cid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT public.legados_snapshot(cid);
$$;
CREATE FUNCTION public.reparcelamento43_validar(uid integer,cid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE s public.reparcelamento43_estados%ROWTYPE;
BEGIN
 SELECT contrato_id,user_id,snapshot INTO s FROM public.reparcelamento43_estados WHERE contrato_id=cid;
 IF s.contrato_id IS NULL OR s.user_id IS DISTINCT FROM uid OR s.snapshot IS DISTINCT FROM public.reparcelamento43_snapshot(cid)
 OR NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.clientes cl ON cl.id=c.cliente_id JOIN public.contas_caixa a ON a.id=c.conta_caixa_id WHERE c.id=cid AND c.user_id=uid AND cl.user_id=uid AND a.user_id=uid)
 OR EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id WHERE c.id=cid AND (p.user_id IS DISTINCT FROM uid OR p.cliente_id IS DISTINCT FROM c.cliente_id OR p.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id OR p.koletor_id IS DISTINCT FROM c.koletor_id)) THEN RAISE EXCEPTION 'Prova/vínculos43 divergentes' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION public.reparcelamento43_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a jsonb; b jsonb; cid integer; cids integer[]; aid integer; cap public.reparcelamento43_capacidades%ROWTYPE; protegido boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN a:=to_jsonb(OLD); END IF; IF TG_OP<>'DELETE' THEN b:=to_jsonb(NEW); END IF;
 cid:=CASE WHEN TG_TABLE_NAME='contratos' THEN coalesce((b->>'id')::int,(a->>'id')::int) ELSE coalesce((b->>'contrato_id')::int,(a->>'contrato_id')::int) END;
 IF TG_TABLE_NAME='transacoes_caixa' THEN cid:=coalesce(cid,(SELECT contrato_id FROM public.parcelas WHERE id=coalesce((b->>'parcela_id')::int,(a->>'parcela_id')::int))); END IF;
 aid:=CASE WHEN TG_TABLE_NAME='contas_caixa' THEN (a->>'id')::int ELSE coalesce((b->>'conta_caixa_id')::int,(a->>'conta_caixa_id')::int) END;
 IF aid IS NOT NULL AND NOT pg_try_advisory_xact_lock(22022,aid) THEN RAISE EXCEPTION 'Conta43 concorrente' USING ERRCODE='40001'; END IF;
 IF cid IS NOT NULL AND NOT pg_try_advisory_xact_lock(34035,cid) THEN RAISE EXCEPTION 'Contrato43 concorrente' USING ERRCODE='40001'; END IF;
 -- Vínculos/owner/base imutáveis após adesão. Não bloqueia cadastro ou edição não financeira.
 IF TG_TABLE_NAME IN('clientes','koletores','contas_caixa') AND TG_OP<>'INSERT' AND
 (TG_OP='DELETE' OR a->'id' IS DISTINCT FROM b->'id' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR (TG_TABLE_NAME='contas_caixa' AND a->'saldo' IS DISTINCT FROM b->'saldo')) AND EXISTS(
 SELECT 1 FROM public.reparcelamento43_estados e JOIN public.contratos c ON c.id=e.contrato_id WHERE
 (TG_TABLE_NAME='clientes' AND c.cliente_id=(a->>'id')::int) OR (TG_TABLE_NAME='koletores' AND c.koletor_id=(a->>'id')::int) OR (TG_TABLE_NAME='contas_caixa' AND c.conta_caixa_id=(a->>'id')::int)) THEN RAISE EXCEPTION 'Vínculo43 imutável' USING ERRCODE='42501'; END IF;
 cids:=ARRAY[cid,(a->>'contrato_id')::int,(b->>'contrato_id')::int];
 IF TG_TABLE_NAME='contratos' THEN cids:=ARRAY[(a->>'id')::int,(b->>'id')::int]; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' THEN cids:=cids||ARRAY(SELECT contrato_id FROM public.parcelas WHERE id IN((a->>'parcela_id')::int,(b->>'parcela_id')::int)); END IF;
 protegido:=EXISTS(SELECT 1 FROM public.reparcelamento43_estados WHERE contrato_id=ANY(cids));
 SELECT xid,pid,tabela,evento,anterior,posterior INTO cap FROM public.reparcelamento43_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid();
 IF cap.tabela=TG_TABLE_NAME THEN
  IF cap.evento IS DISTINCT FROM TG_OP OR cap.anterior IS DISTINCT FROM a OR cap.posterior IS DISTINCT FROM b THEN RAISE EXCEPTION 'Capacidade43 difere da linha inteira' USING ERRCODE='42501'; END IF;
  DELETE FROM public.reparcelamento43_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid();
 ELSIF protegido THEN RAISE EXCEPTION 'Cadeia43 exige transição auditada; REST/baixa antiga proibidos' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION public.reparcelamento43_escrever(t text,a jsonb,b jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE cols text; vals text; actual jsonb;
BEGIN
 IF t NOT IN('contratos','parcelas','contrato_historico') OR b IS NULL THEN RAISE EXCEPTION 'Tabela43 proibida' USING ERRCODE='42501'; END IF;
 INSERT INTO public.reparcelamento43_capacidades VALUES(txid_current(),pg_backend_pid(),t,CASE WHEN a IS NULL THEN 'INSERT' ELSE 'UPDATE' END,a,b);
 SELECT string_agg(format('%I',attname),',' ORDER BY attnum),string_agg(format('r.%I',attname),',' ORDER BY attnum) INTO cols,vals FROM pg_attribute WHERE attrelid=to_regclass('public.'||t) AND attnum>0 AND NOT attisdropped;
 IF a IS NULL THEN EXECUTE format('INSERT INTO public.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r',t,cols,vals,t) USING b;
 ELSE
 EXECUTE format('UPDATE public.%I t SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r) WHERE t.id=($1->>''id'')::bigint',t,cols,vals,t) USING b;
 END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=($1->>''id'')::bigint',t) INTO actual USING b;
 IF actual IS DISTINCT FROM b OR EXISTS(SELECT 1 FROM public.reparcelamento43_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN RAISE EXCEPTION 'DML/trigger43 diferente; rollback integral' USING ERRCODE='23514'; END IF;
END $$;

CREATE FUNCTION public.rpc_cotar_reparcelamento43(p_user_id integer,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE r jsonb; cid integer; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; s jsonb; hj date:=(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
 saldo numeric:=0; encargos numeric:=0; base numeric; multa numeric; mora numeric; total numeric; juros numeric; ref numeric; jr numeric; n integer; i integer; v numeric; j numeric; ds date; linhas jsonb:='[]'; q jsonb; state text; firstid integer;
BEGIN
 PERFORM public.caixa37_verificar(); r:=public.reparcelamento43_request(p_request,false); cid:=(r->>'contratoId')::int; n:=(r->>'numeroParcelas')::int;
 SELECT "id","cliente_id","koletor_id","modalidade","valor_principal","taxa_juros","num_parcelas","valor_parcela","total_contrato","data_inicio","data_vencimento","status","conta_caixa_id","observacoes","createdAt","updatedAt","tipo_taxa","numero_parcelas","multa_atraso","juros_mora_diario","data_vencimento_primeira","dia_vencimento","descricao","contrato_origem_id","contrato_assinado","contrato_url","etiquetas","user_id" INTO c FROM public.contratos WHERE id=cid AND user_id=p_user_id;
 IF c.id IS NULL OR p_user_id IS NULL OR p_user_id<=0 OR c.conta_caixa_id IS NULL THEN RAISE EXCEPTION 'Contrato43 indisponível' USING ERRCODE='42501'; END IF;
 PERFORM public.reparcelamento43_travar_conta(p_user_id,c.conta_caixa_id);
 PERFORM public.legados_travar(p_user_id,cid,c.conta_caixa_id);
 PERFORM public.reparcelamento43_validar_conta(p_user_id,c.conta_caixa_id);
 SELECT "id","cliente_id","koletor_id","modalidade","valor_principal","taxa_juros","num_parcelas","valor_parcela","total_contrato","data_inicio","data_vencimento","status","conta_caixa_id","observacoes","createdAt","updatedAt","tipo_taxa","numero_parcelas","multa_atraso","juros_mora_diario","data_vencimento_primeira","dia_vencimento","descricao","contrato_origem_id","contrato_assinado","contrato_url","etiquetas","user_id" INTO STRICT c FROM public.contratos WHERE id=cid;
 IF c.user_id IS DISTINCT FROM p_user_id OR c.status NOT IN('ativo','atrasado') OR EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE origem_id=cid)
 OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.ciclo_estados WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid) THEN RAISE EXCEPTION 'Origem43 já encerrada/protegida/não suportada' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_estados WHERE contrato_id=cid) THEN PERFORM public.reparcelamento43_validar(p_user_id,cid);
 ELSE
 SELECT min(id) INTO firstid FROM public.parcelas WHERE contrato_id=cid;
 PERFORM public.legados_validar(p_user_id,cid,firstid,c.conta_caixa_id);
 END IF;
 -- Coorte conservadora: só parcelas ainda inteiramente abertas; não infere parcial/paga/estorno.
 IF c.tipo_taxa IS DISTINCT FROM 'mensal' OR c.modalidade NOT IN('mensal','reparcelamento') OR c.num_parcelas IS DISTINCT FROM c.numero_parcelas
 OR c.num_parcelas IS DISTINCT FROM (SELECT count(*)::int FROM public.parcelas WHERE contrato_id=cid)
 OR c.total_contrato IS DISTINCT FROM (SELECT sum(valor_original) FROM public.parcelas WHERE contrato_id=cid)
 OR c.total_contrato<=0 OR c.multa_atraso IS NULL OR c.multa_atraso<0 OR c.multa_atraso>100 OR c.juros_mora_diario IS NULL OR c.juros_mora_diario<0 OR c.juros_mora_diario>100
 OR (c.contrato_origem_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE sucessor_id=cid AND origem_id=c.contrato_origem_id AND user_id=p_user_id))
 OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=p_user_id AND ativo)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=c.conta_caixa_id AND user_id=p_user_id AND ativo)
 OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=p_user_id AND ativo)) THEN RAISE EXCEPTION 'Contrato43 ambíguo' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT "id","contrato_id","numero","valor","data_vencimento","data_pagamento","valor_pago","status","conta_caixa_id","observacoes","createdAt","updatedAt","cliente_id","koletor_id","numero_parcela","valor_original","valor_juros","valor_multa","valor_desconto","multa_manual","user_id","saldo_residual","multa_diaria_usada" FROM public.parcelas WHERE contrato_id=cid ORDER BY id LOOP
 IF p.user_id IS DISTINCT FROM p_user_id OR p.cliente_id IS DISTINCT FROM c.cliente_id OR p.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id OR p.koletor_id IS DISTINCT FROM c.koletor_id
 OR p.status NOT IN('pendente','atrasada','atrasado','vencendo_hoje') OR p.numero IS DISTINCT FROM p.numero_parcela OR p.numero<1 OR p.numero>c.num_parcelas
 OR p.valor_original IS DISTINCT FROM p.valor OR p.valor<=0 OR p.valor_pago IS DISTINCT FROM 0::numeric AND p.valor_pago IS NOT NULL
 OR p.data_pagamento IS NOT NULL OR p.saldo_residual IS DISTINCT FROM 0::numeric OR p.valor_multa IS DISTINCT FROM 0::numeric OR p.multa_manual IS DISTINCT FROM 0::numeric
 OR p.valor_desconto IS DISTINCT FROM 0::numeric OR p.multa_diaria_usada IS DISTINCT FROM 0::numeric OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE parcela_id=p.id) THEN RAISE EXCEPTION 'Parcela43 ambígua/parcial/paga' USING ERRCODE='23514'; END IF;
 base:=p.valor_original; multa:=0; mora:=0;
 IF (r->>'incluirMultas')::boolean AND p.data_vencimento<hj THEN
 multa:=round(base*c.multa_atraso/100,2); mora:=round(base*c.juros_mora_diario*(hj-p.data_vencimento)/100,2);
 END IF;
 saldo:=saldo+base+multa+mora; encargos:=encargos+multa+mora;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid GROUP BY numero HAVING count(*)<>1) THEN RAISE EXCEPTION 'Sequência43 inválida' USING ERRCODE='23514'; END IF;
 -- Livro inteiro da conta, inclusive owner nulo/externo e referências cruzadas: nunca filtrado por owner.
 IF EXISTS(SELECT 1 FROM public.transacoes_caixa t WHERE (t.conta_caixa_id=c.conta_caixa_id OR t.contrato_id=cid OR t.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND
 (t.user_id IS DISTINCT FROM p_user_id OR t.valor<=0 OR NOT public.legados_moeda(t.valor) OR t.tipo NOT IN('entrada','saida') OR NOT isfinite(t.data_transacao)
 OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos cc WHERE cc.id=t.contrato_id AND cc.user_id=p_user_id AND cc.conta_caixa_id=t.conta_caixa_id))
 OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas pp JOIN public.contratos cc ON cc.id=pp.contrato_id WHERE pp.id=t.parcela_id AND pp.contrato_id=t.contrato_id AND pp.user_id=p_user_id AND cc.user_id=p_user_id AND pp.cliente_id=cc.cliente_id AND pp.conta_caixa_id=t.conta_caixa_id)))) THEN RAISE EXCEPTION 'Livro43 divergente' USING ERRCODE='23514'; END IF;
 juros:=round(saldo*(r->>'taxaJuros')::numeric*n/100,2); total:=saldo+juros; ref:=round(total/n,2); jr:=round(juros/n,2);
 IF saldo<=0 OR NOT public.legados_moeda(total) THEN RAISE EXCEPTION 'Total43 fora da faixa' USING ERRCODE='22023'; END IF;
 FOR i IN 1..n LOOP
 v:=CASE WHEN i=n THEN total-ref*(n-1) ELSE ref END; j:=CASE WHEN i=n THEN juros-jr*(n-1) ELSE jr END;
 ds:=public.multimodal_data((r->>'dataInicio')::date,'mensal',i-1);
 IF v<=0 OR j<0 OR j>v OR ds>DATE '9999-12-31' THEN RAISE EXCEPTION 'Rateio43 inválido' USING ERRCODE='22023'; END IF;
 linhas:=linhas||jsonb_build_array(jsonb_build_object('numero',i,'valor',v::numeric(12,2)::text,'juros',j::numeric(12,2)::text,'principal',(v-j)::numeric(12,2)::text,'vencimento',ds::text));
 END LOOP;
 s:=jsonb_build_object('origem',public.reparcelamento43_snapshot(cid),'conta',(SELECT to_jsonb(a) FROM public.contas_caixa a WHERE id=c.conta_caixa_id),
 'livro',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.transacoes_caixa t WHERE conta_caixa_id=c.conta_caixa_id),
 'cliente',(SELECT jsonb_build_array(id,user_id,ativo) FROM public.clientes WHERE id=c.cliente_id),'koletor',(SELECT jsonb_build_array(id,user_id,ativo) FROM public.koletores WHERE id=c.koletor_id),'dia',hj);
 state:=encode(extensions.digest(s::text,'sha256'),'hex');
 q:=jsonb_build_object('regra','reparcelamento43_v1','userId',p_user_id,'contratoId',cid,'contaCaixaId',c.conta_caixa_id,'dataCalculo',hj::text,'estadoHash',state,'request',r,
 'saldoDevedor',saldo::numeric(12,2)::text,'encargos',encargos::numeric(12,2)::text,'valorNovaParcela',ref::numeric(12,2)::text,'totalNovo',total::numeric(12,2)::text,'jurosNovos',juros::numeric(12,2)::text,'qtdParcelasAbertas',c.num_parcelas,'parcelas',linhas);
 RETURN q||jsonb_build_object('cotacaoHash',encode(extensions.digest(q::text,'sha256'),'hex'));
END $$;

CREATE FUNCTION public.rpc_executar_reparcelamento43(p_user_id integer,p_chave_idempotencia uuid,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE r jsonb; oldop public.reparcelamento43_operacoes%ROWTYPE; q jsonb; cid integer; nid integer; raiz integer; opid uuid; antes jsonb; depois jsonb; c jsonb; nc jsonb; np jsonb; p jsonb; line jsonb; hist jsonb; resposta jsonb; ids integer[]:='{}'; conta_antes jsonb; livro_antes jsonb;
BEGIN
 PERFORM public.caixa37_verificar(); r:=public.reparcelamento43_request(p_request,true);
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave_idempotencia IS NULL THEN RAISE EXCEPTION 'Owner/UUID43 obrigatório' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('reparcelamento43:'||p_user_id::text||':'||p_chave_idempotencia::text,43));
 SELECT id,user_id,chave,request,hash_request,resultado,auditoria,concluida_em INTO oldop FROM public.reparcelamento43_operacoes WHERE user_id=p_user_id AND chave=p_chave_idempotencia FOR UPDATE;
 IF FOUND THEN
 IF oldop.request IS DISTINCT FROM r OR oldop.hash_request IS DISTINCT FROM encode(extensions.digest(r::text,'sha256'),'hex') THEN RAISE EXCEPTION 'Replay43 com outra intenção' USING ERRCODE='23505'; END IF;
 IF oldop.resultado IS NULL OR oldop.auditoria->'resultado' IS DISTINCT FROM oldop.resultado OR oldop.auditoria->'request' IS DISTINCT FROM r THEN RAISE EXCEPTION 'Replay43 sem prova' USING ERRCODE='23514'; END IF;
 PERFORM public.legados_travar(p_user_id,(oldop.resultado->>'contratoOrigemId')::int,(oldop.auditoria->'antes'->'contrato'->>'conta_caixa_id')::int);
 PERFORM public.legados_travar(p_user_id,(oldop.resultado->>'contratoId')::int,(oldop.auditoria->'antes'->'contrato'->>'conta_caixa_id')::int);
 PERFORM public.reparcelamento43_validar(p_user_id,(oldop.resultado->>'contratoOrigemId')::int);
 PERFORM public.reparcelamento43_validar(p_user_id,(oldop.resultado->>'contratoId')::int);
 RETURN oldop.resultado||jsonb_build_object('repetida',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_fences WHERE user_id=p_user_id AND chave=p_chave_idempotencia) THEN
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_fences WHERE user_id=p_user_id AND chave=p_chave_idempotencia AND request IS DISTINCT FROM r) THEN RAISE EXCEPTION 'UUID43 fechado divergente' USING ERRCODE='23505'; END IF;
 RAISE EXCEPTION 'UUID43 encerrado sem execução' USING ERRCODE='55000'; END IF;
 cid:=(r->>'contratoId')::int; q:=public.rpc_cotar_reparcelamento43(p_user_id,r-ARRAY['estadoHash','cotacaoHash']);
 IF q->>'estadoHash' IS DISTINCT FROM r->>'estadoHash' OR q->>'cotacaoHash' IS DISTINCT FROM r->>'cotacaoHash' THEN RAISE EXCEPTION 'Simulação43 mudou; não executar outra intenção' USING ERRCODE='40001'; END IF;
 antes:=public.reparcelamento43_snapshot(cid); c:=antes->'contrato';
 SELECT to_jsonb(a) INTO conta_antes FROM public.contas_caixa a WHERE id=(q->>'contaCaixaId')::int;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) INTO livro_antes FROM public.transacoes_caixa t WHERE conta_caixa_id=(q->>'contaCaixaId')::int;
 INSERT INTO public.reparcelamento43_operacoes(user_id,chave,request,hash_request) VALUES(p_user_id,p_chave_idempotencia,r,encode(extensions.digest(r::text,'sha256'),'hex')) RETURNING id INTO opid;
 nc:=public.multimodal_nova_linha('contratos'); nid:=(nc->>'id')::int;
 SELECT coalesce((SELECT raiz_id FROM public.reparcelamento43_cadeia WHERE sucessor_id=cid),cid) INTO raiz;
 nc:=nc||jsonb_build_object('user_id',p_user_id,'cliente_id',c->'cliente_id','koletor_id',c->'koletor_id','conta_caixa_id',q->'contaCaixaId',
 'modalidade','reparcelamento','tipo_taxa','mensal','valor_principal',(q->>'saldoDevedor')::numeric,'taxa_juros',(r->>'taxaJuros')::numeric,
 'num_parcelas',(r->>'numeroParcelas')::int,'numero_parcelas',(r->>'numeroParcelas')::int,'valor_parcela',(q->>'valorNovaParcela')::numeric,'total_contrato',(q->>'totalNovo')::numeric,
 'data_inicio',q->>'dataCalculo','data_vencimento_primeira',r->>'dataInicio','data_vencimento',q->'parcelas'->-1->>'vencimento','contrato_origem_id',cid,'status','ativo',
 'multa_atraso',(c->>'multa_atraso')::numeric,'juros_mora_diario',(c->>'juros_mora_diario')::numeric,'descricao','Reparcelamento #'||cid::text||' — sem novo desembolso');
 PERFORM public.reparcelamento43_escrever('contratos',NULL,nc);
 FOR line IN SELECT value FROM jsonb_array_elements(q->'parcelas') LOOP
 np:=public.multimodal_nova_linha('parcelas'); ids:=ids||((np->>'id')::int);
 np:=np||jsonb_build_object('user_id',p_user_id,'contrato_id',nid,'cliente_id',c->'cliente_id','koletor_id',c->'koletor_id','conta_caixa_id',q->'contaCaixaId',
 'numero',(line->>'numero')::int,'numero_parcela',(line->>'numero')::int,'valor',(line->>'valor')::numeric,'valor_original',(line->>'valor')::numeric,'valor_juros',(line->>'juros')::numeric,
 'valor_pago',0,'saldo_residual',0,'data_vencimento',line->>'vencimento','status','pendente');
 PERFORM public.reparcelamento43_escrever('parcelas',NULL,np);
 END LOOP;
 -- Encerramento não é recebimento: não altera valor_pago/data_pagamento, nem fabrica entrada.
 FOR p IN SELECT value FROM jsonb_array_elements(antes->'parcelas') LOOP
 PERFORM public.reparcelamento43_escrever('parcelas',p,p||jsonb_build_object('status','cancelada','updatedAt',now()));
 END LOOP;
 PERFORM public.reparcelamento43_escrever('contratos',c,c||jsonb_build_object('status','renegociado','updatedAt',now()));
 INSERT INTO public.reparcelamento43_cadeia VALUES(cid,nid,p_user_id,raiz,opid);
 hist:=public.multimodal_nova_linha('contrato_historico')||jsonb_build_object('contrato_id',cid,'user_id',p_user_id::text,'tipo','reparcelamento',
 'descricao','Transferência integral para #'||nid::text||'; sem recebimento/desembolso; operação '||opid::text,'valor_anterior',(q->>'saldoDevedor')::numeric,'valor_novo',0);
 PERFORM public.reparcelamento43_escrever('contrato_historico',NULL,hist);
 hist:=public.multimodal_nova_linha('contrato_historico')||jsonb_build_object('contrato_id',nid,'user_id',p_user_id::text,'tipo','reparcelamento',
 'descricao','Origem #'||cid::text||'; raiz #'||raiz::text||'; sem novo capital; operação '||opid::text,'valor_anterior',0,'valor_novo',(q->>'totalNovo')::numeric);
 PERFORM public.reparcelamento43_escrever('contrato_historico',NULL,hist);
 IF conta_antes IS DISTINCT FROM (SELECT to_jsonb(a) FROM public.contas_caixa a WHERE id=(q->>'contaCaixaId')::int)
 OR livro_antes IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.transacoes_caixa t WHERE conta_caixa_id=(q->>'contaCaixaId')::int)
 OR (SELECT sum(valor_original) FROM public.parcelas WHERE contrato_id=nid) IS DISTINCT FROM (q->>'totalNovo')::numeric
 OR (SELECT sum(valor_original-valor_juros) FROM public.parcelas WHERE contrato_id=nid) IS DISTINCT FROM (q->>'saldoDevedor')::numeric
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND status<>'cancelada') THEN RAISE EXCEPTION 'Conservação43 falhou; rollback integral' USING ERRCODE='23514'; END IF;
 depois:=jsonb_build_object('origem',public.reparcelamento43_snapshot(cid),'sucessor',public.reparcelamento43_snapshot(nid));
 resposta:=jsonb_build_object('success',true,'regra','reparcelamento43_v1','operationId',opid,'idempotencyKey',p_chave_idempotencia,'userId',p_user_id,'contratoOrigemId',cid,'contratoId',nid,'raizId',raiz,
 'parcelasIds',ids,'principalTransferido',q->>'saldoDevedor','totalNovo',q->>'totalNovo','desembolso','0.00','estadoHash',r->>'estadoHash','cotacaoHash',r->>'cotacaoHash','repetida',false);
 UPDATE public.reparcelamento43_operacoes SET resultado=resposta,concluida_em=clock_timestamp(),auditoria=jsonb_build_object('request',r,'cotacao',q,'resultado',resposta,'antes',antes,'depois',depois,'contaAntes',conta_antes,'livroAntes',livro_antes) WHERE id=opid;
 INSERT INTO public.reparcelamento43_estados VALUES(cid,p_user_id,depois->'origem') ON CONFLICT(contrato_id) DO UPDATE SET snapshot=excluded.snapshot;
 INSERT INTO public.reparcelamento43_estados VALUES(nid,p_user_id,depois->'sucessor');
 PERFORM public.reparcelamento43_validar(p_user_id,cid); PERFORM public.reparcelamento43_validar(p_user_id,nid);
 RETURN resposta;
END $$;

CREATE FUNCTION public.rpc_reconciliar_reparcelamento43(p_user_id integer,p_chave_idempotencia uuid,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r jsonb; op public.reparcelamento43_operacoes%ROWTYPE;
BEGIN
 PERFORM public.caixa37_verificar(); r:=public.reparcelamento43_request(p_request,true);
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave_idempotencia IS NULL THEN RAISE EXCEPTION 'Owner/UUID43 obrigatório' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('reparcelamento43:'||p_user_id::text||':'||p_chave_idempotencia::text,43));
 SELECT id,user_id,chave,request,hash_request,resultado,auditoria,concluida_em INTO op FROM public.reparcelamento43_operacoes WHERE user_id=p_user_id AND chave=p_chave_idempotencia;
 IF FOUND THEN
 IF op.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'Recovery43 outra intenção' USING ERRCODE='23505'; END IF;
 -- Reexecução idempotente já concluída confere prova, não repete DML.
 PERFORM public.rpc_executar_reparcelamento43(p_user_id,p_chave_idempotencia,r);
 RETURN jsonb_build_object('status','confirmed','result',op.resultado);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Owner43 indisponível' USING ERRCODE='42501'; END IF;
 INSERT INTO public.reparcelamento43_fences VALUES(p_user_id,p_chave_idempotencia,r) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.reparcelamento43_fences WHERE user_id=p_user_id AND chave=p_chave_idempotencia AND request=r) THEN RAISE EXCEPTION 'Fence43 outra intenção' USING ERRCODE='23505'; END IF;
 RETURN jsonb_build_object('status','not_executed','idempotencyKey',p_chave_idempotencia);
END $$;
CREATE FUNCTION public.reparcelamento43_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='reparcelamento43_operacoes' AND TG_OP='UPDATE' THEN
 IF OLD.resultado IS NULL AND NEW.resultado IS NOT NULL AND NEW.auditoria IS NOT NULL
 AND (to_jsonb(OLD)-ARRAY['resultado','auditoria','concluida_em'])=(to_jsonb(NEW)-ARRAY['resultado','auditoria','concluida_em']) THEN RETURN NEW; END IF; END IF;
 RAISE EXCEPTION 'Prova43 imutável' USING ERRCODE='42501';
END $$;
CREATE FUNCTION public.reparcelamento43_concluida() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_operacoes WHERE id=NEW.id AND resultado IS NULL) THEN RAISE EXCEPTION 'Operação43 pendente no commit' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER reparcelamento43_complete AFTER INSERT OR UPDATE ON public.reparcelamento43_operacoes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.reparcelamento43_concluida();
CREATE FUNCTION public.reparcelamento43_conjunto(aid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object(
 'contas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contas_caixa WHERE id=aid),'[]'::jsonb),
 'contratos',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contratos WHERE id IN(SELECT contrato_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid) OR id IN(SELECT contrato_id FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid))),'[]'::jsonb),
 'parcelas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid)),'[]'::jsonb));
$$;
CREATE FUNCTION public.reparcelamento43_travar_conta(uid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s jsonb; n integer; aids integer[]; cids integer[]; pids integer[]; clients integer[]; collectors integer[];
BEGIN
 IF uid IS NULL OR uid<=0 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid) THEN RAISE EXCEPTION 'Owner37 indisponível' USING ERRCODE='42501'; END IF;
 s:=public.reparcelamento43_conjunto(aid);
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
 IF public.reparcelamento43_conjunto(aid) IS DISTINCT FROM s OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND NOT cliente_id=ANY(clients))
 OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE id=ANY(pids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors)) THEN RAISE EXCEPTION 'Conjunto37 mudou durante locks' USING ERRCODE='40001'; END IF;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Row37 concorrente' USING ERRCODE='40001';
END $$;
CREATE FUNCTION public.reparcelamento43_validar_conta(uid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a public.contas_caixa%ROWTYPE; t public.transacoes_caixa%ROWTYPE; oid37 uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=aid AND user_id=uid AND ativo) THEN RAISE EXCEPTION 'Conta43 indisponível' USING ERRCODE='42501'; END IF;
 FOR a IN SELECT * FROM public.contas_caixa WHERE id=aid AND user_id=uid LOOP
 IF a.id<=0 OR a.saldo::text IN('NaN','Infinity','-Infinity') OR a.saldo<>round(a.saldo,2) OR abs(a.saldo)>9999999999999.99 THEN RAISE EXCEPTION 'Saldo-base37 inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR t IN SELECT * FROM public.transacoes_caixa WHERE conta_caixa_id=aid ORDER BY id LOOP
 IF t.id<=0 OR t.user_id IS DISTINCT FROM uid OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=t.conta_caixa_id AND user_id=uid)
 OR t.tipo NOT IN('entrada','saida') OR t.valor::text IN('NaN','Infinity','-Infinity') OR t.valor<=0 OR t.valor<>round(t.valor,2) OR NOT isfinite(t.data_transacao)
 OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.clientes cl ON cl.id=c.cliente_id WHERE c.id=t.contrato_id AND c.user_id=uid AND cl.user_id=uid AND c.conta_caixa_id=t.conta_caixa_id AND (c.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid))))
 OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id JOIN public.clientes cl ON cl.id=p.cliente_id WHERE p.id=t.parcela_id AND p.user_id=uid AND c.user_id=uid AND cl.user_id=uid AND p.cliente_id=c.cliente_id AND p.contrato_id=t.contrato_id AND p.conta_caixa_id=t.conta_caixa_id AND (p.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=p.koletor_id AND user_id=uid)))) THEN RAISE EXCEPTION 'Ledger37 whole-owner crossowner/estrutura inválida' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR oid37 IN SELECT id FROM public.caixa37_operacoes o WHERE o.user_id=uid AND (o.request->>'contaOrigemId'=aid::text OR o.request->>'contaDestinoId'=aid::text OR EXISTS(SELECT 1 FROM public.caixa37_pernas p JOIN public.transacoes_caixa leg ON leg.id=p.transacao_id WHERE p.operacao_id=o.id AND leg.conta_caixa_id=aid)) LOOP PERFORM public.caixa37_validar_op(oid37); END LOOP;
 IF EXISTS(SELECT 1 FROM public.caixa37_contas p LEFT JOIN public.contas_caixa ac ON ac.id=p.conta_id WHERE p.conta_id=aid AND (p.user_id IS DISTINCT FROM uid OR ac.id IS NULL OR ac.user_id IS DISTINCT FROM p.user_id OR ac.saldo IS DISTINCT FROM p.saldo_base)) THEN RAISE EXCEPTION 'Pin37 divergente' USING ERRCODE='23514'; END IF;

END $$;
-- Registro de origem é reparcelamento43_cadeia + operação43 concluída, nunca origem35/saída fictícia.
CREATE TABLE public.reparcelamento43_recebimentos(
 operacao_id uuid PRIMARY KEY REFERENCES public.multimodal_operacoes(id), contrato_id integer NOT NULL REFERENCES public.contratos(id),
 user_id integer NOT NULL, snapshot jsonb NOT NULL, hash_snapshot text NOT NULL,
 CHECK(hash_snapshot=encode(extensions.digest(snapshot::text,'sha256'),'hex'))
);
ALTER TABLE public.reparcelamento43_recebimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reparcelamento43_recebimentos FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER reparcelamento43_recebimento_immutable BEFORE UPDATE OR DELETE ON public.reparcelamento43_recebimentos FOR EACH ROW EXECUTE FUNCTION public.reparcelamento43_imutavel();
CREATE FUNCTION public.reparcelamento43_travar_recebimento(uid integer,cid integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE aid integer;
BEGIN
 SELECT c.conta_caixa_id INTO aid FROM public.contratos c JOIN public.reparcelamento43_cadeia o ON o.sucessor_id=c.id WHERE c.id=cid AND c.user_id=uid AND o.user_id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Origem43 de recebimento indisponível' USING ERRCODE='42501'; END IF;
 PERFORM public.reparcelamento43_travar_conta(uid,aid);
 PERFORM public.legados_travar(uid,cid,aid);
END $$;
CREATE FUNCTION public.reparcelamento43_validar_recebimento(uid integer,cid integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op public.reparcelamento43_operacoes%ROWTYPE; ch public.reparcelamento43_cadeia%ROWTYPE;
 c public.contratos%ROWTYPE; rc record; p public.parcelas%ROWTYPE; origem jsonb; s jsonb; sum_total numeric;
BEGIN
 PERFORM public.caixa37_verificar();
 SELECT origem_id,sucessor_id,user_id,raiz_id,operacao_id INTO ch FROM public.reparcelamento43_cadeia WHERE sucessor_id=cid AND user_id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Origem43 de recebimento indisponível' USING ERRCODE='42501'; END IF;
 PERFORM public.reparcelamento43_validar(uid,cid);
 SELECT id,user_id,chave,request,hash_request,resultado,auditoria,concluida_em INTO STRICT op FROM public.reparcelamento43_operacoes WHERE id=ch.operacao_id;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=cid;
 origem:=op.auditoria->'depois'->'sucessor';
 IF op.user_id IS DISTINCT FROM uid OR op.resultado IS NULL OR op.concluida_em IS NULL
 OR op.hash_request IS DISTINCT FROM encode(extensions.digest(op.request::text,'sha256'),'hex')
 OR op.auditoria->'request' IS DISTINCT FROM op.request OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado
 OR op.resultado->>'contratoId' IS DISTINCT FROM cid::text OR op.resultado->>'contratoOrigemId' IS DISTINCT FROM ch.origem_id::text
 OR op.resultado->>'raizId' IS DISTINCT FROM ch.raiz_id::text OR op.resultado->>'desembolso' IS DISTINCT FROM '0.00'
 OR origem->'ledger' IS DISTINCT FROM '[]'::jsonb OR c.contrato_origem_id IS DISTINCT FROM ch.origem_id
 OR c.status NOT IN('ativo','quitado') OR c.modalidade IS DISTINCT FROM 'reparcelamento' OR c.tipo_taxa IS DISTINCT FROM 'mensal'
 OR EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE origem_id=cid)
 OR EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid)
 OR ((origem->'contrato')-ARRAY['status','updatedAt']) IS DISTINCT FROM (to_jsonb(c)-ARRAY['status','updatedAt'])
 OR (SELECT sum(valor_original-valor_juros) FROM public.parcelas WHERE contrato_id=cid) IS DISTINCT FROM (op.resultado->>'principalTransferido')::numeric
 OR (SELECT sum(valor_original) FROM public.parcelas WHERE contrato_id=cid) IS DISTINCT FROM (op.resultado->>'totalNovo')::numeric
 THEN RAISE EXCEPTION 'Origem/prova/conservação43 divergente' USING ERRCODE='23514'; END IF;
 PERFORM public.reparcelamento43_validar_conta(uid,c.conta_caixa_id);
 IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=uid AND ativo)
 OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid AND ativo))
 THEN RAISE EXCEPTION 'Vínculos43 indisponíveis' USING ERRCODE='42501'; END IF;
 FOR rc IN SELECT r.operacao_id,r.snapshot,r.hash_snapshot,o.user_id,o.family,o.request,o.payload,o.hash_payload,o.resultado,o.auditoria,o.concluida_em,t.snapshot perna,to_jsonb(tx) atual
 FROM public.reparcelamento43_recebimentos r JOIN public.multimodal_operacoes o ON o.id=r.operacao_id
 JOIN public.multimodal_pernas t ON t.operacao_id=o.id LEFT JOIN public.transacoes_caixa tx ON tx.id=t.transacao_id
 WHERE r.contrato_id=cid LOOP
 IF rc.user_id IS DISTINCT FROM uid OR rc.family IS DISTINCT FROM 'multimodal_receber' OR rc.resultado IS NULL OR rc.concluida_em IS NULL
 OR rc.hash_payload IS DISTINCT FROM encode(extensions.digest(rc.payload::text,'sha256'),'hex')
 OR rc.payload IS DISTINCT FROM public.multimodal_payload(uid,'multimodal_receber',rc.request)
 OR rc.auditoria->'payload' IS DISTINCT FROM rc.payload OR rc.auditoria->'resultado' IS DISTINCT FROM rc.resultado
 OR rc.auditoria->'depois' IS DISTINCT FROM rc.snapshot OR rc.hash_snapshot IS DISTINCT FROM encode(extensions.digest(rc.snapshot::text,'sha256'),'hex')
 OR rc.perna IS DISTINCT FROM rc.atual OR rc.resultado->>'contratoId' IS DISTINCT FROM cid::text
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rc.snapshot->'ledger') x WHERE x=rc.perna)
 THEN RAISE EXCEPTION 'Recibo/perna35 da origem43 divergente' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_recebimentos r LEFT JOIN public.multimodal_pernas mp ON mp.operacao_id=r.operacao_id WHERE r.contrato_id=cid AND mp.operacao_id IS NULL)
 OR EXISTS(SELECT 1 FROM public.transacoes_caixa t WHERE (t.contrato_id=cid OR t.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND
 (t.tipo IS DISTINCT FROM 'entrada' OR t.categoria IS DISTINCT FROM 'pagamento_parcela' OR NOT EXISTS(
 SELECT 1 FROM public.reparcelamento43_recebimentos r JOIN public.multimodal_pernas mp ON mp.operacao_id=r.operacao_id WHERE r.contrato_id=cid AND r.user_id=uid AND mp.transacao_id=t.id AND mp.snapshot=to_jsonb(t))))
 THEN RAISE EXCEPTION 'Livro43 sem prova35 exata' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT * FROM public.parcelas WHERE contrato_id=cid LOOP
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(origem->'parcelas') v WHERE
 v-ARRAY['status','valor_pago','saldo_residual','valor_multa','multa_diaria_usada','data_pagamento','observacoes','updatedAt'] =
 to_jsonb(p)-ARRAY['status','valor_pago','saldo_residual','valor_multa','multa_diaria_usada','data_pagamento','observacoes','updatedAt'])
 OR p.status NOT IN('pendente','atrasada','vencendo_hoje','parcial','paga') OR p.valor_pago<0
 OR p.valor_pago IS DISTINCT FROM (SELECT coalesce(sum(t.valor),0) FROM public.transacoes_caixa t WHERE t.parcela_id=p.id)
 OR (p.status IN('pendente','atrasada','vencendo_hoje') AND (p.valor_pago<>0 OR p.saldo_residual<>0 OR p.data_pagamento IS NOT NULL))
 OR (p.status='paga' AND (p.valor_pago<>p.valor_original+p.valor_multa+p.multa_diaria_usada OR p.saldo_residual<>0 OR p.data_pagamento IS NULL))
 OR (p.status='parcial' AND (p.valor_pago<=0 OR p.saldo_residual<=0 OR p.valor_pago+p.saldo_residual<>p.valor_original+p.valor_multa+p.multa_diaria_usada OR p.data_pagamento IS NULL))
 THEN RAISE EXCEPTION 'Conservação/descendente43 recebido divergente' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF (c.status='quitado') IS DISTINCT FROM NOT EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND status<>'paga')
 THEN RAISE EXCEPTION 'Quitação43 sem prova de todos descendentes' USING ERRCODE='23514'; END IF;
 s:=public.multimodal_snapshot(cid); RETURN s;
END $$;
-- O writer35 constrói a linha INTEIRA e verifica todos AFTER triggers. Só sua capability privada pode atravessar guard43.
CREATE FUNCTION public.reparcelamento43_ponte_recebimento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE op public.multimodal_operacoes%ROWTYPE; cid integer; uid integer; a jsonb;
BEGIN
 cid:=CASE WHEN NEW.tabela='contratos' THEN (NEW.posterior->>'id')::int ELSE (NEW.posterior->>'contrato_id')::int END;
 IF NOT EXISTS(SELECT 1 FROM public.reparcelamento43_estados WHERE contrato_id=cid) THEN RETURN NEW; END IF;
 PERFORM public.caixa37_verificar();
 SELECT * INTO STRICT op FROM public.multimodal_operacoes WHERE id=NEW.operacao_id;
 uid:=op.user_id;
 IF NEW.xid<>txid_current() OR NEW.pid<>pg_backend_pid() OR pg_xact_status(NEW.xmin::text::xid8)<>'in progress'
 OR op.family IS DISTINCT FROM 'multimodal_receber' OR op.resultado IS NOT NULL OR pg_xact_status(op.xmin::text::xid8)<>'in progress'
 OR op.hash_payload IS DISTINCT FROM encode(extensions.digest(op.payload::text,'sha256'),'hex')
 OR op.payload IS DISTINCT FROM public.multimodal_payload(uid,op.family,op.request)
 OR op.payload->>'contratoId' IS DISTINCT FROM cid::text OR op.payload->>'modo' NOT IN('integral','parcial')
 OR NOT EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE sucessor_id=cid AND user_id=uid)
 OR EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE origem_id=cid)
 OR (NEW.tabela IN('contratos','parcelas') AND NEW.evento<>'UPDATE')
 OR (NEW.tabela IN('transacoes_caixa','contrato_historico') AND NEW.evento<>'INSERT')
 OR (NEW.tabela='parcelas' AND NEW.posterior->>'id' IS DISTINCT FROM op.payload->>'parcelaId')
 OR (NEW.tabela='transacoes_caixa' AND (NEW.posterior->>'tipo' IS DISTINCT FROM 'entrada' OR NEW.posterior->>'categoria' IS DISTINCT FROM 'pagamento_parcela'
 OR NEW.posterior->>'parcela_id' IS DISTINCT FROM op.payload->>'parcelaId' OR (NEW.posterior->>'valor')::numeric IS DISTINCT FROM (op.payload->>'valorRecebido')::numeric))
 THEN RAISE EXCEPTION 'Ponte43 exige recebimento35 pendente/exato da própria origem' USING ERRCODE='42501'; END IF;
 INSERT INTO public.reparcelamento43_capacidades VALUES(NEW.xid,NEW.pid,NEW.tabela,NEW.evento,NEW.anterior,NEW.posterior);
 RETURN NEW;
END $$;
CREATE TRIGGER reparcelamento43_ponte_recebimento AFTER INSERT ON public.multimodal_autorizacoes FOR EACH ROW EXECUTE FUNCTION public.reparcelamento43_ponte_recebimento();
CREATE FUNCTION public.reparcelamento43_selar_recebimento(p_op uuid,p_cid integer,p_antes jsonb,p_esperado jsonb,p_resultado jsonb,p_extra jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; o public.multimodal_operacoes%ROWTYPE;
BEGIN
 SELECT * INTO STRICT o FROM public.multimodal_operacoes WHERE id=p_op;
 s:=public.multimodal_snapshot(p_cid);
 IF o.family IS DISTINCT FROM 'multimodal_receber' OR o.resultado IS NOT NULL OR pg_xact_status(o.xmin::text::xid8)<>'in progress'
 OR s IS DISTINCT FROM p_esperado OR NOT EXISTS(SELECT 1 FROM public.multimodal_pernas WHERE operacao_id=p_op AND snapshot=(SELECT to_jsonb(t) FROM public.transacoes_caixa t WHERE id=transacao_id))
 OR EXISTS(SELECT 1 FROM public.reparcelamento43_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid())
 THEN RAISE EXCEPTION 'Recebimento43 físico divergente do writer35' USING ERRCODE='23514'; END IF;
 UPDATE public.multimodal_operacoes SET resultado=p_resultado,concluida_em=clock_timestamp(),auditoria=jsonb_build_object('payload',o.payload,'hashPayload',o.hash_payload,'resultado',p_resultado,'antes',p_antes,'depois',s,'extra',p_extra) WHERE id=p_op;
 INSERT INTO public.reparcelamento43_recebimentos VALUES(p_op,p_cid,o.user_id,s,encode(extensions.digest(s::text,'sha256'),'hex'));
 UPDATE public.reparcelamento43_estados SET snapshot=public.reparcelamento43_snapshot(p_cid) WHERE contrato_id=p_cid AND user_id=o.user_id;
 PERFORM public.reparcelamento43_validar_recebimento(o.user_id,p_cid);
 RETURN p_resultado;
END $$;

CREATE OR REPLACE FUNCTION public.multimodal_validar(uid integer,cid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE o public.multimodal_origens%ROWTYPE; e public.multimodal_estados%ROWTYPE; op public.multimodal_operacoes%ROWTYPE; s jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_estados WHERE contrato_id=cid) THEN RETURN public.reparcelamento43_validar_recebimento(uid,cid); END IF;
 SELECT * INTO o FROM public.multimodal_origens WHERE contrato_id=cid;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Origem multimodal indisponível' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT e FROM public.multimodal_estados WHERE contrato_id=cid;
 SELECT * INTO STRICT op FROM public.multimodal_operacoes WHERE id=e.operacao_id;
 s:=public.multimodal_snapshot(cid);
 IF e.user_id IS DISTINCT FROM uid OR e.snapshot IS DISTINCT FROM s OR e.hash_snapshot IS DISTINCT FROM encode(extensions.digest(s::text,'sha256'),'hex')
 OR op.resultado IS NULL OR op.auditoria->'depois' IS DISTINCT FROM s OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado
 OR op.hash_payload IS DISTINCT FROM encode(extensions.digest(op.payload::text,'sha256'),'hex') OR op.auditoria->'payload' IS DISTINCT FROM op.payload
 OR NOT EXISTS(SELECT 1 FROM public.contratos WHERE id=cid AND user_id=uid AND cliente_id=o.cliente_id AND conta_caixa_id=o.conta_id AND koletor_id IS NOT DISTINCT FROM o.koletor_id)
 OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=o.cliente_id AND user_id=uid)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=o.conta_id AND user_id=uid AND ativo)
 OR (o.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=o.koletor_id AND user_id=uid AND ativo))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND (user_id IS DISTINCT FROM uid OR cliente_id IS DISTINCT FROM o.cliente_id OR conta_caixa_id IS DISTINCT FROM o.conta_id OR koletor_id IS DISTINCT FROM o.koletor_id))
 OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE (conta_caixa_id=o.conta_id OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND user_id IS DISTINCT FROM uid)
 OR EXISTS(SELECT 1 FROM public.contrato_historico WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid::text)
 OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid) THEN RAISE EXCEPTION 'Snapshot/proveniência/vínculos multimodais divergentes' USING ERRCODE='23514'; END IF;
 -- Toda perna física íntegra; snapshots não filtram owner NULL ou externo.
 IF EXISTS(SELECT 1 FROM public.multimodal_pernas m JOIN public.multimodal_operacoes p ON p.id=m.operacao_id LEFT JOIN public.transacoes_caixa t ON t.id=m.transacao_id
 WHERE (p.resultado->>'contratoId')::integer=cid OR (p.resultado->>'id')::integer=cid
 GROUP BY m.operacao_id,m.snapshot,t.id HAVING m.snapshot IS DISTINCT FROM to_jsonb(t)) THEN RAISE EXCEPTION 'Perna multimodal divergente' USING ERRCODE='23514'; END IF;
 RETURN s;
END $$;
CREATE OR REPLACE FUNCTION public.multimodal_travar(uid integer,cid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.multimodal_origens%ROWTYPE;
BEGIN
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_estados WHERE contrato_id=cid) THEN PERFORM public.reparcelamento43_travar_recebimento(uid,cid); RETURN; END IF;
 SELECT * INTO o FROM public.multimodal_origens WHERE contrato_id=cid;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Origem indisponível' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(22022,o.conta_id);
 PERFORM pg_advisory_xact_lock(34034,uid);
 PERFORM pg_advisory_xact_lock(34035,cid);
 PERFORM 1 FROM public.contas_caixa WHERE id=o.conta_id FOR UPDATE;
 PERFORM 1 FROM public.clientes WHERE id=o.cliente_id FOR UPDATE;
 PERFORM 1 FROM public.koletores WHERE id=o.koletor_id FOR UPDATE;
 PERFORM 1 FROM public.contratos WHERE id=cid FOR NO KEY UPDATE;
 PERFORM 1 FROM public.parcelas WHERE contrato_id=cid ORDER BY id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.transacoes_caixa WHERE conta_caixa_id=o.conta_id OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid) ORDER BY id FOR UPDATE;
END $$;
CREATE OR REPLACE FUNCTION public.multimodal_selar(p_op uuid,p_cid integer,p_antes jsonb,p_esperado jsonb,p_resultado jsonb,p_extra jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; o public.multimodal_operacoes%ROWTYPE;
BEGIN
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_estados WHERE contrato_id=p_cid) THEN RETURN public.reparcelamento43_selar_recebimento(p_op,p_cid,p_antes,p_esperado,p_resultado,p_extra); END IF;
 SELECT * INTO STRICT o FROM public.multimodal_operacoes WHERE id=p_op;
 s:=public.multimodal_snapshot(p_cid);
 IF s IS DISTINCT FROM p_esperado THEN RAISE EXCEPTION 'Trilha física diferente do cálculo/transição; não selar' USING ERRCODE='23514'; END IF;
 UPDATE public.multimodal_operacoes SET resultado=p_resultado,concluida_em=clock_timestamp(),auditoria=jsonb_build_object('payload',o.payload,'hashPayload',o.hash_payload,'resultado',p_resultado,'antes',p_antes,'depois',s,'extra',p_extra) WHERE id=p_op;
 INSERT INTO public.multimodal_estados VALUES(p_cid,o.user_id,p_op,s,encode(extensions.digest(s::text,'sha256'),'hex')) ON CONFLICT(contrato_id) DO UPDATE SET operacao_id=excluded.operacao_id,snapshot=excluded.snapshot,hash_snapshot=excluded.hash_snapshot;
 PERFORM public.multimodal_validar(o.user_id,p_cid);
 RETURN p_resultado;
END $$;
CREATE OR REPLACE FUNCTION public.rpc_identificar_emprestimo_multimodal(p_user_id integer,p_contrato_id integer,p_parcela_id integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s text; own integer;
BEGIN
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE sucessor_id=p_contrato_id) THEN
 PERFORM public.caixa37_verificar(); PERFORM public.reparcelamento43_travar_recebimento(p_user_id,p_contrato_id); PERFORM public.reparcelamento43_validar_recebimento(p_user_id,p_contrato_id);
 IF NOT EXISTS(SELECT 1 FROM public.parcelas WHERE id=p_parcela_id AND contrato_id=p_contrato_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Parcela43 indisponível' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,'trilho','multimodal','status',(SELECT status FROM public.parcelas WHERE id=p_parcela_id)); END IF;
 PERFORM public.multimodal_verificar();
 IF p_user_id IS NULL OR p_user_id<=0 OR p_contrato_id IS NULL OR p_parcela_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.parcelas p ON p.contrato_id=c.id WHERE c.id=p_contrato_id AND p.id=p_parcela_id AND c.user_id=p_user_id AND p.user_id=p_user_id) THEN RAISE EXCEPTION 'Registro indisponível' USING ERRCODE='42501'; END IF;
 SELECT user_id INTO own FROM public.multimodal_origens WHERE contrato_id=p_contrato_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF own IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Origem divergente' USING ERRCODE='42501'; END IF;
 PERFORM public.multimodal_travar(p_user_id,p_contrato_id); PERFORM public.multimodal_validar(p_user_id,p_contrato_id);
 SELECT status INTO s FROM public.parcelas WHERE id=p_parcela_id;
 IF EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE contrato_id=p_contrato_id AND anterior_id=p_parcela_id) THEN s:='renovada'; END IF;
 RETURN jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,'trilho','multimodal','status',s);
END $$;
DO $sources43after$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"multimodal_validar","args":"integer,integer","hash":"5f4de57e0e821a6f9b1b026146958eae9db18b608cd1082f8ba7dbe2b46db455","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multimodal_travar","args":"integer,integer","hash":"b08ee8f375f3072896acbc5d359eeea41c56017e92ba9304172bc74694bb7d76","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_selar","args":"uuid,integer,jsonb,jsonb,jsonb,jsonb","hash":"adbd15e55db96716c40d1d18b8270f99dd047991b98d8636e9fd8d5d4599478f","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"rpc_identificar_emprestimo_multimodal","args":"integer,integer,integer","hash":"950250a7104b4bad8cb514fd58defa5616bcd2b6c0ab7ff294599ca6b2d8f2ff","config":["search_path=pg_catalog, pg_temp"]},{"name":"ciclo_guardar","args":"","hash":"2f3fe701ead0b295f918bd768ba0df44d345d8d906030e4e494df9cfe9bfd2e9","config":["search_path=pg_catalog, pg_temp"]},{"name":"legados_guardar","args":"","hash":"122ec38128421f9687b4abe0f78d776e4e06b885fe795463b020498beb4db1d1","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_guardar","args":"","hash":"9a65fbcf387c22bc06253c1e445ec300fbba74dcbae5c17869a798dbb1b5064d","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multa36_guardar","args":"","hash":"8e4624de5ee678923c2ec07916381bf8121363e69221c2b816aa173d1b8a2223","config":["search_path=pg_catalog, pg_temp"]},{"name":"multa36_ponte","args":"","hash":"95a9c01b2f6ea9cf9c6b79525c4ab17bf519ac4f447aa7937600623c00687f98","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ponte","args":"","hash":"f56ab7b8f26b2caecb00d525374a16d6665316130b5508300f4a11860e736bb3","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ledger","args":"","hash":"0cc20d9f80098bfd377dc0ec3d344562c6d6e7f6644b92621dca5a527f8942f9","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_perna_comprovada","args":"integer,integer","hash":"5bd70c44eec12e5e6c3c52c94d41d292d3ae132c5ba16b40d7c119c84a844e3d","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '43 homônimo/overload %',e->>'name' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM ((e->>'name') LIKE 'rpc_%')
 OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') THEN RAISE EXCEPTION '43 fonte/config/ACL/owner divergente %',e->>'name' USING ERRCODE='55000'; END IF;
 END LOOP; END $sources43after$;

DO $acl43$ DECLARE n text; f regprocedure; BEGIN
 FOREACH n IN ARRAY ARRAY['contratos','parcelas','transacoes_caixa','contrato_historico','clientes','koletores','contas_caixa'] LOOP
 EXECUTE format('CREATE TRIGGER z_reparcelamento43_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reparcelamento43_guardar()',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['operacoes','cadeia','fences'] LOOP
 EXECUTE format('CREATE TRIGGER reparcelamento43_immutable BEFORE UPDATE OR DELETE ON public.reparcelamento43_%I FOR EACH ROW EXECUTE FUNCTION public.reparcelamento43_imutavel()',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['operacoes','cadeia','estados','capacidades','fences'] LOOP
 EXECUTE format('ALTER TABLE public.reparcelamento43_%I ENABLE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON public.reparcelamento43_%I FROM PUBLIC,anon,authenticated,service_role',n);
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.reparcelamento43_request(jsonb,boolean)'::regprocedure,'public.reparcelamento43_snapshot(integer)'::regprocedure,'public.reparcelamento43_validar(integer,integer)'::regprocedure,'public.reparcelamento43_guardar()'::regprocedure,'public.reparcelamento43_escrever(text,jsonb,jsonb)'::regprocedure,'public.reparcelamento43_imutavel()'::regprocedure,'public.reparcelamento43_concluida()'::regprocedure,
 'public.rpc_cotar_reparcelamento43(integer,jsonb)'::regprocedure,'public.rpc_executar_reparcelamento43(integer,uuid,jsonb)'::regprocedure,'public.rpc_reconciliar_reparcelamento43(integer,uuid,jsonb)'::regprocedure] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
 END LOOP;
END $acl43$;
DO $helpers43acl$ DECLARE p record; BEGIN
 FOR p IN SELECT oid::regprocedure f FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'reparcelamento43_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.f); END LOOP; END $helpers43acl$;
GRANT EXECUTE ON FUNCTION public.rpc_cotar_reparcelamento43(integer,jsonb),public.rpc_executar_reparcelamento43(integer,uuid,jsonb),public.rpc_reconciliar_reparcelamento43(integer,uuid,jsonb) TO service_role;
DO $new43sources$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"reparcelamento43_request","args":"jsonb,boolean","hash":"f74e08b0e7247fcc1b279f9185c8b7432b0ec2aeb9ea530279daf6febf84d149","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_snapshot","args":"integer","hash":"9598f6127c820c3ad7f0051a1e8f4aebb55e7ff854695262e6cb94fc0f712aa6","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"reparcelamento43_validar","args":"integer,integer","hash":"e3713f9e4b4c8b4bd555fe4f56cff05e9fc17484b8a0dfc4e51e91f5f420e2cb","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_guardar","args":"","hash":"6b9eba6639089a2593acf54236d3bf2d377d8884122529eb65ec79fba9aa050b","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_escrever","args":"text,jsonb,jsonb","hash":"c8faac8e56e58a87c653e5eb68b06f0ec3bcce37b54fdc64d8c716a06d44b37b","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"rpc_cotar_reparcelamento43","args":"integer,jsonb","hash":"aeecf51d3db3673e9eeedc988a2320f87909b2264c818d4fbf465910f951a85a","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"rpc_executar_reparcelamento43","args":"integer,uuid,jsonb","hash":"1b55063eff9e5184c1647e44a4f4920ac3970aafabd80f978acda9a415ee20c0","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"rpc_reconciliar_reparcelamento43","args":"integer,uuid,jsonb","hash":"ec1c7bf0451a9ec6d0360c83503259797747d7886e64e2ea45654eeb7c2e95e7","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_imutavel","args":"","hash":"5f0338d7b06f178a4798e72164f357c1317a119f2462e822039fcf3088d4f660","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_concluida","args":"","hash":"6cb7d11713a127217cdcbda76b9891c22bcb9604e2f08b3fce817efb1d272cf1","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_conjunto","args":"integer","hash":"32ea04652ef20d0d0f7602d1e8fbd47e17d0bb960cb9f7d3a0caf3c82b77035b","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_travar_conta","args":"integer,integer","hash":"eb99cb8d78dfb39b59ffccface0cde986d18805afc89b485fb8467f0438bb83b","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_validar_conta","args":"integer,integer","hash":"8fbd79d18bc582f4e689cbcf6f7ed32cbbae23e43a93a1f43e75c05eacd7824b","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"reparcelamento43_travar_recebimento","args":"integer,integer","hash":"8fb7429fe1a68d8dfb8432e073bbc0b27680be44fd4a7a050f5588723b878669","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_validar_recebimento","args":"integer,integer","hash":"85c05e352ae9d81e9fcc83a4b8b8c3aeb764acea262c349acb3a5541c773df66","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"reparcelamento43_ponte_recebimento","args":"","hash":"9a744df875c5ae14b6ac787447a8fccfedfc13da19a205f9d788b6812a638308","config":["search_path=pg_catalog, pg_temp"]},{"name":"reparcelamento43_selar_recebimento","args":"uuid,integer,jsonb,jsonb,jsonb,jsonb","hash":"6d35f06bd8ba19850fb53645e836a9781dd3df9f976220a35f9e1c18292a476d","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '43 homônimo/overload %',e->>'name' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM ((e->>'name') LIKE 'rpc_%')
 OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') THEN RAISE EXCEPTION '43 fonte/config/ACL/owner divergente %',e->>'name' USING ERRCODE='55000'; END IF;
 END LOOP; END $new43sources$;
DO $post43$ DECLARE w record; item record; actual jsonb; BEGIN
 SELECT funcs,rels,trigs,cons INTO STRICT w FROM witness43;
 FOR item IN SELECT key,value FROM jsonb_each(w.funcs) LOOP SELECT to_jsonb(p) INTO actual FROM pg_proc p WHERE oid=item.key::oid; IF actual IS DISTINCT FROM item.value THEN RAISE EXCEPTION '43 alterou função predecessora' USING ERRCODE='55000'; END IF; END LOOP;
 FOR item IN SELECT key,value FROM jsonb_each(w.rels) LOOP SELECT to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] INTO actual FROM pg_class c WHERE oid=item.key::oid; IF actual IS DISTINCT FROM item.value THEN RAISE EXCEPTION '43 alterou relação predecessora' USING ERRCODE='55000'; END IF; END LOOP;
 FOR item IN SELECT key,value FROM jsonb_each(w.trigs) LOOP SELECT to_jsonb(t) INTO actual FROM pg_trigger t WHERE oid=item.key::oid; IF actual IS DISTINCT FROM item.value THEN RAISE EXCEPTION '43 alterou trigger predecessor' USING ERRCODE='55000'; END IF; END LOOP;
 FOR item IN SELECT key,value FROM jsonb_each(w.cons) LOOP SELECT to_jsonb(k) INTO actual FROM pg_constraint k WHERE oid=item.key::oid; IF actual IS DISTINCT FROM item.value THEN RAISE EXCEPTION '43 alterou constraint predecessor' USING ERRCODE='55000'; END IF; END LOOP;
END $post43$;
-- Somente metadados de instalação, após witness provar zero alteração predecessora.
-- Adição de triggers reforça a proteção; 34/36/36a e todas provas financeiras intocadas.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
SELECT public.caixa37_verificar();
COMMIT;
