-- 0041 sucessora certificada: aplicar APÓS 0042 exata (ordem intencional 42 -> 41).
-- Prospectiva; não reescreve dados/histórico nem reserva contas para um único módulo.
-- Aplicação integral em janela DDL exclusiva por owner. Sem schema PostgREST adicional.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.users,public.vendas_telefone,public.parcelas_venda_telefone,public.contas_caixa,public.transacoes_caixa IN SHARE ROW EXCLUSIVE MODE;
DO $gate41$ DECLARE actual jsonb; BEGIN
 IF current_setting('server_version_num')::integer/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR current_user IN('service_role','anon','authenticated') OR to_regnamespace('telefone41') IS NOT NULL THEN RAISE EXCEPTION '0041 PG17/read committed/owner/one-shot' USING ERRCODE='55000'; END IF;
 PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();
 IF to_regclass('public.assinaturas42_operacoes') IS NULL THEN RAISE EXCEPTION '0042 deve preceder 0041' USING ERRCODE='55000'; END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN('service_role','anon','authenticated'))<>3 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('service_role','anon','authenticated') AND (rolsuper OR rolcreaterole OR pg_has_role(oid,(SELECT oid FROM pg_roles WHERE rolname=current_user),'MEMBER'))) THEN RAISE EXCEPTION 'Roles41 inseguras' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) INTO actual FROM pg_attribute WHERE attrelid='public.vendas_telefone'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM '[["id","bigint",true],["marca","character varying(100)",true],["modelo","character varying(200)",true],["imei","character varying(20)",false],["cor","character varying(50)",false],["armazenamento","character varying(20)",false],["custo","numeric(12,2)",true],["preco_venda","numeric(12,2)",true],["entrada_percentual","numeric(5,2)",true],["entrada_valor","numeric(12,2)",true],["num_parcelas","integer",true],["juros_mensal","numeric(5,2)",true],["valor_parcela","numeric(12,2)",true],["total_juros","numeric(12,2)",true],["total_a_receber","numeric(12,2)",true],["lucro_bruto","numeric(12,2)",true],["roi","numeric(8,2)",false],["payback_meses","numeric(5,2)",false],["comprador_nome","character varying(200)",true],["comprador_cpf","character varying(14)",false],["comprador_rg","character varying(20)",false],["comprador_telefone","character varying(20)",false],["comprador_email","character varying(320)",false],["comprador_estado_civil","character varying(30)",false],["comprador_profissao","character varying(100)",false],["comprador_instagram","character varying(100)",false],["comprador_cep","character varying(9)",false],["comprador_cidade","character varying(100)",false],["comprador_estado","character varying(2)",false],["comprador_endereco","character varying(300)",false],["comprador_local_trabalho","character varying(200)",false],["status","public.status_venda_telefone",true],["data_venda","timestamp with time zone",true],["createdAt","timestamp with time zone",true],["user_id","integer",false]]'::jsonb THEN RAISE EXCEPTION '0041 shape físico vendas_telefone desconhecido' USING ERRCODE='55000'; END IF;
 IF pg_get_serial_sequence('public.vendas_telefone','id') IS NULL OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.vendas_telefone'::regclass AND attnum>0 AND NOT attisdropped AND (attgenerated<>'' OR attidentity<>'')) THEN RAISE EXCEPTION '0041 sequence/geração incompatível vendas_telefone' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.vendas_telefone'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION '0041 trigger telefone prévia não certificada' USING ERRCODE='55000'; END IF;
SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) INTO actual FROM pg_attribute WHERE attrelid='public.parcelas_venda_telefone'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM '[["id","bigint",true],["venda_id","bigint",true],["numero","integer",true],["valor","numeric(12,2)",true],["vencimento","timestamp with time zone",true],["status","public.status_parcela",true],["pago_em","timestamp with time zone",false],["valor_pago","numeric(12,2)",false],["createdAt","timestamp with time zone",true],["user_id","integer",false]]'::jsonb THEN RAISE EXCEPTION '0041 shape físico parcelas_venda_telefone desconhecido' USING ERRCODE='55000'; END IF;
 IF pg_get_serial_sequence('public.parcelas_venda_telefone','id') IS NULL OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.parcelas_venda_telefone'::regclass AND attnum>0 AND NOT attisdropped AND (attgenerated<>'' OR attidentity<>'')) THEN RAISE EXCEPTION '0041 sequence/geração incompatível parcelas_venda_telefone' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.parcelas_venda_telefone'::regclass AND NOT tgisinternal) THEN RAISE EXCEPTION '0041 trigger telefone prévia não certificada' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid='public.status_venda_telefone'::regtype AND enumlabel='cancelado') OR NOT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid='public.status_parcela'::regtype AND enumlabel='paga') THEN RAISE EXCEPTION 'Enums41 incompatíveis' USING ERRCODE='55000'; END IF;
END $gate41$;
DO $before41$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"ciclo_guardar","args":"","hash":"2f3fe701ead0b295f918bd768ba0df44d345d8d906030e4e494df9cfe9bfd2e9","config":["search_path=pg_catalog, pg_temp"]},{"name":"legados_guardar","args":"","hash":"122ec38128421f9687b4abe0f78d776e4e06b885fe795463b020498beb4db1d1","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_guardar","args":"","hash":"9a65fbcf387c22bc06253c1e445ec300fbba74dcbae5c17869a798dbb1b5064d","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multa36_guardar","args":"","hash":"8e4624de5ee678923c2ec07916381bf8121363e69221c2b816aa173d1b8a2223","config":["search_path=pg_catalog, pg_temp"]},{"name":"multa36_ponte","args":"","hash":"95a9c01b2f6ea9cf9c6b79525c4ab17bf519ac4f447aa7937600623c00687f98","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ponte","args":"","hash":"f56ab7b8f26b2caecb00d525374a16d6665316130b5508300f4a11860e736bb3","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ledger","args":"","hash":"0cc20d9f80098bfd377dc0ec3d344562c6d6e7f6644b92621dca5a527f8942f9","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_perna_comprovada","args":"integer, integer","hash":"5bd70c44eec12e5e6c3c52c94d41d292d3ae132c5ba16b40d7c119c84a844e3d","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '0041 predecessor overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION '0041 predecessor fonte/config/ACL/owner divergente' USING ERRCODE='55000'; END IF;
 END LOOP; END $before41$;
CREATE TEMP TABLE telefone41_witness ON COMMIT DROP AS SELECT oid,to_jsonb(p) snapshot,pg_get_functiondef(oid) definition FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f' AND proname NOT IN('ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','caixa37_ponte','caixa37_ledger','caixa37_perna_comprovada');
CREATE TEMP TABLE telefone41_triggers_witness ON COMMIT DROP AS SELECT oid,to_jsonb(t) snapshot FROM pg_trigger t;
CREATE SCHEMA telefone41;
REVOKE ALL ON SCHEMA telefone41 FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE telefone41.operacoes(
 user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 chave uuid NOT NULL, acao text NOT NULL CHECK(acao IN('criar','receber','cancelar')),
 request jsonb NOT NULL, resultado jsonb, criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,chave)
);
CREATE TABLE telefone41.origens(
 venda_id bigint PRIMARY KEY REFERENCES public.vendas_telefone(id) ON DELETE RESTRICT,
 user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 criacao uuid NOT NULL, snapshot jsonb NOT NULL, parcelas jsonb NOT NULL,
 FOREIGN KEY(user_id,criacao) REFERENCES telefone41.operacoes(user_id,chave)
);
CREATE TABLE telefone41.pernas(
 transacao_id integer PRIMARY KEY REFERENCES public.transacoes_caixa(id) ON DELETE RESTRICT,
 user_id integer NOT NULL, chave uuid NOT NULL, venda_id bigint NOT NULL REFERENCES telefone41.origens(venda_id),
 parcela_id bigint REFERENCES public.parcelas_venda_telefone(id) ON DELETE RESTRICT,
 papel text NOT NULL CHECK(papel IN('entrada','recebimento','compensacao')),
 original_id integer UNIQUE REFERENCES telefone41.pernas(transacao_id),
 snapshot jsonb NOT NULL,
 FOREIGN KEY(user_id,chave) REFERENCES telefone41.operacoes(user_id,chave),
 CHECK((papel='compensacao')=(original_id IS NOT NULL))
);
CREATE UNIQUE INDEX telefone41_entrada_unica ON telefone41.pernas(venda_id) WHERE papel='entrada';
CREATE UNIQUE INDEX telefone41_baixa_unica ON telefone41.pernas(parcela_id) WHERE papel='recebimento';
CREATE TABLE telefone41.capacidades(
 xid bigint NOT NULL, pid integer NOT NULL, tabela text NOT NULL, evento text NOT NULL,
 anterior jsonb, posterior jsonb, PRIMARY KEY(xid,pid,tabela,evento)
);
CREATE TABLE telefone41.fences(user_id integer NOT NULL REFERENCES public.users(id),chave uuid NOT NULL,request jsonb NOT NULL,criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(user_id,chave));
CREATE TABLE telefone41.ponte_capacidades(xid bigint NOT NULL,pid integer NOT NULL,user_id integer NOT NULL,chave uuid NOT NULL,guarda text NOT NULL,posterior jsonb NOT NULL,PRIMARY KEY(xid,pid,guarda),FOREIGN KEY(user_id,chave) REFERENCES telefone41.operacoes(user_id,chave));
CREATE TABLE telefone41.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);
CREATE FUNCTION telefone41.moeda(v text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF v IS NULL OR v!~'^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' THEN RAISE EXCEPTION 'Moeda41 canônica obrigatória' USING ERRCODE='22023'; END IF;
 RETURN v::numeric;
END $$;
CREATE FUNCTION telefone41.imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='operacoes' AND TG_OP='UPDATE' AND OLD.resultado IS NULL AND NEW.resultado IS NOT NULL AND pg_xact_status(OLD.xmin::text::xid8)='in progress' AND to_jsonb(OLD)-'resultado'=to_jsonb(NEW)-'resultado' THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Auditoria41 imutável' USING ERRCODE='42501';
END $$;
CREATE FUNCTION telefone41.guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a jsonb; b jsonb; ok boolean; aid integer;
BEGIN
 IF TG_OP<>'INSERT' THEN a:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN b:=to_jsonb(NEW); END IF;
 DELETE FROM telefone41.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid() AND tabela=TG_TABLE_NAME AND evento=TG_OP AND anterior IS NOT DISTINCT FROM a AND posterior IS NOT DISTINCT FROM b RETURNING true INTO ok;
 IF coalesce(ok,false) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='vendas_telefone' THEN
  IF EXISTS(SELECT 1 FROM telefone41.origens WHERE venda_id=coalesce((a->>'id')::bigint,(b->>'id')::bigint)) THEN RAISE EXCEPTION 'Venda41 protegida' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='parcelas_venda_telefone' THEN
  IF EXISTS(SELECT 1 FROM telefone41.origens WHERE venda_id IN((a->>'venda_id')::bigint,(b->>'venda_id')::bigint)) THEN RAISE EXCEPTION 'Parcela41 protegida' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='transacoes_caixa' THEN
  IF TG_OP='INSERT' AND b->>'categoria'='venda_telefone' THEN RAISE EXCEPTION 'Ledger41 exige intenção exata' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM telefone41.pernas WHERE transacao_id=coalesce((a->>'id')::integer,(b->>'id')::integer)) THEN RAISE EXCEPTION 'Livro41 append-only' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='contas_caixa' THEN
  PERFORM pg_advisory_xact_lock(22022,(a->>'id')::integer);
  IF EXISTS(SELECT 1 FROM telefone41.pernas WHERE (snapshot->>'conta_caixa_id')::integer=(a->>'id')::integer) AND (TG_OP='DELETE' OR a->'id' IS DISTINCT FROM b->'id' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR a->'saldo' IS DISTINCT FROM b->'saldo') THEN RAISE EXCEPTION 'Base/owner41 imutáveis' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION telefone41.escrever(t text,a jsonb,b jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE atual jsonb;
BEGIN
 IF t NOT IN('vendas_telefone','parcelas_venda_telefone','transacoes_caixa') OR b IS NULL THEN RAISE EXCEPTION 'Writer41 fechado' USING ERRCODE='42501'; END IF;
 INSERT INTO telefone41.capacidades VALUES(txid_current(),pg_backend_pid(),t,CASE WHEN a IS NULL THEN 'INSERT' ELSE 'UPDATE' END,a,b);
 IF a IS NULL THEN EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I,$1)).*',t,t) USING b;
 ELSIF t='vendas_telefone' THEN
 EXECUTE format('UPDATE public.%I SET status=($1->>''status'')::%s WHERE id=($1->>''id'')::bigint',t,(SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='public.vendas_telefone'::regclass AND attname='status')) USING b;
 ELSE
 EXECUTE format('UPDATE public.parcelas_venda_telefone SET status=($1->>''status'')::%s,pago_em=($1->>''pago_em'')::timestamptz,valor_pago=($1->>''valor_pago'')::numeric WHERE id=($1->>''id'')::bigint',(SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='public.parcelas_venda_telefone'::regclass AND attname='status')) USING b;
 END IF;
 EXECUTE format('SELECT to_jsonb(x) FROM public.%I x WHERE id=($1->>''id'')::bigint',t) INTO atual USING b;
 IF atual IS DISTINCT FROM b OR EXISTS(SELECT 1 FROM telefone41.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN RAISE EXCEPTION 'Posterior41 inexato' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION telefone41.nova_linha(t text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE j jsonb; seq text; nid bigint; instante timestamptz:=clock_timestamp();
BEGIN
 IF t NOT IN('vendas_telefone','parcelas_venda_telefone','transacoes_caixa') THEN RAISE EXCEPTION 'Tabela41 fechada' USING ERRCODE='42501'; END IF;
 seq:=pg_get_serial_sequence('public.'||t,'id'); IF seq IS NULL THEN RAISE EXCEPTION 'Sequence41 ausente' USING ERRCODE='55000'; END IF;
 nid:=nextval(seq::regclass); IF nid<=0 OR nid>9007199254740991 THEN RAISE EXCEPTION 'ID41 fora do inteiro seguro' USING ERRCODE='22003'; END IF;
 SELECT jsonb_object_agg(attname,'null'::jsonb) INTO j FROM pg_attribute WHERE attrelid=to_regclass('public.'||t) AND attnum>0 AND NOT attisdropped;
 j:=j||jsonb_build_object('id',nid,'createdAt',instante);
 IF t='vendas_telefone' THEN j:=j||jsonb_build_object('data_venda',instante); END IF;
 RETURN j;
END $$;
CREATE FUNCTION telefone41.validar_request(r jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE ks text[]; k text; v numeric; dt date;
BEGIN
 IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR r->>'acao' IS NULL THEN RAISE EXCEPTION 'Request41 inválido' USING ERRCODE='22023'; END IF;
 ks:=CASE r->>'acao'
 WHEN 'criar' THEN ARRAY['acao','marca','modelo','imei','cor','armazenamento','custo','precoVenda','entradaPercentual','jurosMensal','numParcelas','dataPrimeiraParcela','contaCaixaId','compradorNome','compradorCpf','compradorRg','compradorTelefone','compradorEmail','compradorEstadoCivil','compradorProfissao','compradorInstagram','compradorCep','compradorCidade','compradorEstado','compradorEndereco','compradorLocalTrabalho']
 WHEN 'receber' THEN ARRAY['acao','vendaId','parcelaId','contaCaixaId','valorPago']
 WHEN 'cancelar' THEN ARRAY['acao','vendaId','motivo'] ELSE NULL END;
 IF ks IS NULL OR (SELECT count(*) FROM jsonb_object_keys(r))<>cardinality(ks) OR EXISTS(SELECT 1 FROM jsonb_object_keys(r) x WHERE NOT x=ANY(ks)) THEN RAISE EXCEPTION 'Campos41 fechados' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['vendaId','parcelaId','contaCaixaId','numParcelas'] LOOP
 IF r ? k AND r->k='null'::jsonb AND (k<>'contaCaixaId' OR r->>'acao'<>'criar') THEN RAISE EXCEPTION 'ID41 obrigatório' USING ERRCODE='22023'; END IF;
 IF r ? k AND r->k<>'null'::jsonb AND (jsonb_typeof(r->k)<>'number' OR r->>k!~'^[1-9][0-9]{0,15}$' OR (r->>k)::numeric>CASE WHEN k IN('vendaId','parcelaId') THEN 9007199254740991 ELSE 2147483647 END) THEN RAISE EXCEPTION 'ID41 inválido' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF r->>'acao'='criar' THEN
 FOREACH k IN ARRAY ARRAY['custo','precoVenda','entradaPercentual','jurosMensal'] LOOP
 IF jsonb_typeof(r->k)<>'string' THEN RAISE EXCEPTION 'Moeda41 exige string' USING ERRCODE='22023'; END IF; v:=telefone41.moeda(r->>k); END LOOP;
 IF telefone41.moeda(r->>'custo')<=0 OR telefone41.moeda(r->>'precoVenda')<=0 OR telefone41.moeda(r->>'entradaPercentual')>=100 OR telefone41.moeda(r->>'jurosMensal')>100 OR (r->>'numParcelas')::int NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Financiamento41 inválido (entrada 100%% não parcelável)' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['marca','modelo','compradorNome'] LOOP
 IF jsonb_typeof(r->k)<>'string' OR btrim(r->>k)='' OR r->>k<>btrim(r->>k) OR length(r->>k)>(CASE k WHEN 'marca' THEN 100 ELSE 200 END) THEN RAISE EXCEPTION 'Texto41 inválido' USING ERRCODE='22023'; END IF; END LOOP;
 FOREACH k IN ARRAY ARRAY['imei','cor','armazenamento','compradorCpf','compradorRg','compradorTelefone','compradorEmail','compradorEstadoCivil','compradorProfissao','compradorInstagram','compradorCep','compradorCidade','compradorEstado','compradorEndereco','compradorLocalTrabalho'] LOOP
 IF r->k<>'null'::jsonb AND (jsonb_typeof(r->k)<>'string' OR btrim(r->>k)='' OR r->>k<>btrim(r->>k) OR length(r->>k)>CASE k WHEN 'imei' THEN 20 WHEN 'cor' THEN 50 WHEN 'armazenamento' THEN 20 WHEN 'compradorCpf' THEN 14 WHEN 'compradorRg' THEN 20 WHEN 'compradorTelefone' THEN 20 WHEN 'compradorEmail' THEN 320 WHEN 'compradorEstadoCivil' THEN 30 WHEN 'compradorCep' THEN 9 WHEN 'compradorEstado' THEN 2 WHEN 'compradorEndereco' THEN 300 WHEN 'compradorLocalTrabalho' THEN 200 ELSE 100 END) THEN RAISE EXCEPTION 'Texto41 inválido' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF jsonb_typeof(r->'dataPrimeiraParcela') IS DISTINCT FROM 'string' OR r->>'dataPrimeiraParcela'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Data41 inválida' USING ERRCODE='22023'; END IF;
 dt:=(r->>'dataPrimeiraParcela')::date;
 IF NOT isfinite(dt) OR dt::text<>r->>'dataPrimeiraParcela' THEN RAISE EXCEPTION 'Data41 inválida' USING ERRCODE='22023'; END IF;
 ELSIF r->>'acao'='receber' THEN
 IF jsonb_typeof(r->'valorPago') IS DISTINCT FROM 'string' OR telefone41.moeda(r->>'valorPago')<=0 OR r->>'contaCaixaId' IS NULL OR r->>'vendaId' IS NULL OR r->>'parcelaId' IS NULL THEN RAISE EXCEPTION 'Recebimento41 inválido' USING ERRCODE='22023'; END IF;
 ELSE
 IF r->>'vendaId' IS NULL OR jsonb_typeof(r->'motivo')<>'string' OR btrim(r->>'motivo')='' OR r->>'motivo'<>btrim(r->>'motivo') OR length(r->>'motivo')>500 THEN RAISE EXCEPTION 'Motivo41 obrigatório' USING ERRCODE='22023'; END IF;
 END IF;
END $$;
CREATE FUNCTION telefone41.conta(uid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE saldo numeric;
BEGIN
 IF aid IS NULL OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=aid AND user_id=uid AND ativo IS TRUE) THEN RAISE EXCEPTION 'Conta41 indisponível' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE conta_caixa_id=aid AND (user_id IS DISTINCT FROM uid OR valor<=0 OR valor::text IN('NaN','Infinity','-Infinity') OR tipo NOT IN('entrada','saida') OR NOT isfinite(data_transacao))) THEN RAISE EXCEPTION 'Ledger41 inválido' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION telefone41.validar_venda(uid integer,vid bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE o telefone41.origens%ROWTYPE; v jsonb; p jsonb; leg record;
BEGIN
 SELECT venda_id,user_id,criacao,snapshot,parcelas INTO o FROM telefone41.origens WHERE venda_id=vid AND user_id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Somente venda41 prospectiva' USING ERRCODE='42501'; END IF;
 SELECT to_jsonb(x) INTO v FROM public.vendas_telefone x WHERE id=vid AND user_id=uid;
 IF v IS NULL OR v-'status' IS DISTINCT FROM o.snapshot-'status' OR v->>'status' NOT IN('ativo','quitado','cancelado') THEN RAISE EXCEPTION 'Venda41 divergente' USING ERRCODE='23514'; END IF;
 SELECT jsonb_agg(to_jsonb(x)-ARRAY['status','pago_em','valor_pago'] ORDER BY numero) INTO p FROM public.parcelas_venda_telefone x WHERE venda_id=vid;
 IF p IS DISTINCT FROM o.parcelas THEN RAISE EXCEPTION 'Bindings/parcelas41 divergentes' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.parcelas_venda_telefone x WHERE venda_id=vid AND (user_id IS DISTINCT FROM uid OR (status::text='paga') IS DISTINCT FROM EXISTS(SELECT 1 FROM telefone41.pernas l WHERE l.parcela_id=x.id AND l.papel='recebimento') OR (status::text='paga' AND (valor_pago IS DISTINCT FROM valor OR pago_em IS NULL)) OR (status::text<>'paga' AND (coalesce(valor_pago,0)<>0 OR pago_em IS NOT NULL)))) THEN RAISE EXCEPTION 'Baixa41 sem prova' USING ERRCODE='23514'; END IF;
 FOR leg IN SELECT l.snapshot,t.id,to_jsonb(t) atual FROM telefone41.pernas l LEFT JOIN public.transacoes_caixa t ON t.id=l.transacao_id WHERE l.venda_id=vid LOOP
 IF leg.atual IS DISTINCT FROM leg.snapshot THEN RAISE EXCEPTION 'Livro41 divergente' USING ERRCODE='23514'; END IF; END LOOP;
END $$;
CREATE FUNCTION telefone41.lancar(uid integer,k uuid,vid bigint,pid bigint,aid integer,v numeric,papel41 text,original41 integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE j jsonb; tid integer; g text;
BEGIN
 PERFORM telefone41.conta(uid,aid);
 j:=telefone41.nova_linha('transacoes_caixa')||jsonb_build_object('user_id',uid,'conta_caixa_id',aid,'tipo',CASE WHEN papel41='compensacao' THEN 'saida' ELSE 'entrada' END,'categoria','venda_telefone','valor',v,'descricao','Telefone41 '||papel41||' venda '||vid||' intenção '||k,'data_transacao',(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date,'contrato_id',NULL,'parcela_id',NULL);
 tid:=(j->>'id')::integer;
 INSERT INTO telefone41.pernas VALUES(tid,uid,k,vid,pid,papel41,original41,j); -- FK ledger deferred abaixo
 FOREACH g IN ARRAY ARRAY['a_legados_protocolo_transacoes_caixa','a0_multa36_ponte','a1_caixa37_ponte','ciclo_ledger','multa36_guard_transacoes_caixa','multimodal_ledger','z_caixa37_ledger'] LOOP
 INSERT INTO telefone41.ponte_capacidades VALUES(txid_current(),pg_backend_pid(),uid,k,g,j); END LOOP;
 PERFORM telefone41.escrever('transacoes_caixa',NULL,j);
 IF EXISTS(SELECT 1 FROM telefone41.ponte_capacidades pc WHERE pc.xid=txid_current() AND pc.pid=pg_backend_pid()) THEN RAISE EXCEPTION 'Ponte41 residual' USING ERRCODE='23514'; END IF;
 RETURN tid;
END $$;
-- Perna exata existe antes do INSERT e sua FK deve ser comprovada no commit.
ALTER TABLE telefone41.pernas ALTER CONSTRAINT pernas_transacao_id_fkey DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION telefone41.executar(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op telefone41.operacoes%ROWTYPE; j jsonb; pj jsonb; a jsonb; vid bigint; pid bigint; aid integer; n integer; i integer; v numeric; ent numeric; taxa numeric; pmt numeric; total numeric; principal numeric; parcela numeric; dia date; venc date; tid integer; ids jsonb:='[]'; tids jsonb:='[]'; leg record; resultado jsonb; saldo numeric; aids integer[]; aids_depois integer[];
BEGIN
 PERFORM telefone41.validar_request(p_request);
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Owner/UUID41 inválido' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('telefone41:'||p_user_id||':'||p_chave,41));
 SELECT x.user_id,x.chave,x.acao,x.request,x.resultado,x.criada_em INTO op FROM telefone41.operacoes x WHERE x.user_id=p_user_id AND x.chave=p_chave;
 IF FOUND THEN
 IF op.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'Replay41 divergente' USING ERRCODE='23505'; END IF;
 IF op.resultado IS NULL THEN RAISE EXCEPTION 'Intenção41 incompleta' USING ERRCODE='23514'; END IF;
 PERFORM telefone41.validar_venda(p_user_id,(op.resultado->>'vendaId')::bigint);
 RETURN op.resultado||'{"repetida":true}'::jsonb;
 END IF;
 IF EXISTS(SELECT 1 FROM telefone41.fences WHERE user_id=p_user_id AND chave=p_chave) THEN
 IF NOT EXISTS(SELECT 1 FROM telefone41.fences WHERE user_id=p_user_id AND chave=p_chave AND request=p_request) THEN RAISE EXCEPTION 'UUID41 fence divergente' USING ERRCODE='23505'; END IF;
 RAISE EXCEPTION 'UUID41 encerrado permanentemente' USING ERRCODE='55000',DETAIL='TELEFONE41_UUID_FENCED'; END IF;
 vid:=(p_request->>'vendaId')::bigint; pid:=(p_request->>'parcelaId')::bigint; aid:=(p_request->>'contaCaixaId')::integer;
 IF p_request->>'acao'='cancelar' THEN SELECT array_agg(DISTINCT (snapshot->>'conta_caixa_id')::integer ORDER BY (snapshot->>'conta_caixa_id')::integer) INTO aids FROM telefone41.pernas WHERE venda_id=vid AND user_id=p_user_id AND papel<>'compensacao'; ELSE aids:=ARRAY[aid]; END IF;
 -- Whole-owner como42: contas ordenadas antes de owner/entidade.

 FOREACH aid IN ARRAY coalesce(aids,'{}') LOOP
 IF aid IS NOT NULL AND NOT pg_try_advisory_xact_lock(22022,aid) THEN RAISE EXCEPTION 'Conta41 concorrente' USING ERRCODE='40001'; END IF;
 END LOOP;
 IF NOT pg_try_advisory_xact_lock(34034,p_user_id) THEN RAISE EXCEPTION 'Owner41 concorrente' USING ERRCODE='40001'; END IF;
 FOREACH aid IN ARRAY coalesce(aids,'{}') LOOP IF aid IS NOT NULL THEN PERFORM telefone41.conta(p_user_id,aid); PERFORM telefone41.travar_conta(p_user_id,aid); PERFORM telefone41.validar_conta(p_user_id,aid); END IF; END LOOP;
 PERFORM 1 FROM public.contas_caixa WHERE id=ANY(aids) ORDER BY id FOR NO KEY UPDATE NOWAIT;
 IF vid IS NOT NULL THEN
 IF NOT pg_try_advisory_xact_lock(41041,hashtext(vid::text)) THEN RAISE EXCEPTION 'Venda41 concorrente' USING ERRCODE='40001'; END IF;
 PERFORM 1 FROM public.vendas_telefone WHERE id=vid AND user_id=p_user_id FOR UPDATE NOWAIT;
 PERFORM telefone41.validar_venda(p_user_id,vid);
 IF p_request->>'acao'='cancelar' THEN
 SELECT array_agg(DISTINCT (snapshot->>'conta_caixa_id')::integer ORDER BY (snapshot->>'conta_caixa_id')::integer) INTO aids_depois FROM telefone41.pernas WHERE venda_id=vid AND user_id=p_user_id AND papel<>'compensacao';
 IF aids IS DISTINCT FROM aids_depois THEN RAISE EXCEPTION 'Contas41 mudaram durante locks' USING ERRCODE='40001'; END IF;
 END IF;
 END IF;
 INSERT INTO telefone41.operacoes(user_id,chave,acao,request) VALUES(p_user_id,p_chave,p_request->>'acao',p_request);
 aid:=(p_request->>'contaCaixaId')::integer;
 IF p_request->>'acao'='criar' THEN
 n:=(p_request->>'numParcelas')::integer; dia:=(p_request->>'dataPrimeiraParcela')::date;
 v:=telefone41.moeda(p_request->>'precoVenda'); ent:=round(v*telefone41.moeda(p_request->>'entradaPercentual')/100,2); principal:=v-ent; taxa:=telefone41.moeda(p_request->>'jurosMensal')/100;
 IF ent>0 THEN PERFORM telefone41.conta(p_user_id,aid); ELSIF aid IS NOT NULL THEN PERFORM telefone41.conta(p_user_id,aid); END IF;
 pmt:=CASE WHEN taxa=0 THEN principal/n ELSE principal*taxa*power(1+taxa,n)/(power(1+taxa,n)-1) END;
 total:=round(pmt*n,2); parcela:=trunc(total/n,2);
 IF parcela<=0 OR total+ent>9999999999.99 THEN RAISE EXCEPTION 'Valor41 fora do limite' USING ERRCODE='22023'; END IF;
 j:=telefone41.nova_linha('vendas_telefone')||jsonb_build_object('user_id',p_user_id,'marca',p_request->'marca','modelo',p_request->'modelo','imei',p_request->'imei','cor',p_request->'cor','armazenamento',p_request->'armazenamento','custo',telefone41.moeda(p_request->>'custo'),'preco_venda',v,'entrada_percentual',telefone41.moeda(p_request->>'entradaPercentual'),'entrada_valor',ent,'num_parcelas',n,'juros_mensal',telefone41.moeda(p_request->>'jurosMensal'),'valor_parcela',parcela,'total_juros',total-principal,'total_a_receber',ent+total,'lucro_bruto',ent+total-telefone41.moeda(p_request->>'custo'),'roi',NULL,'payback_meses',NULL,'status','ativo');
 FOR leg IN SELECT t.src,t.dst FROM (VALUES('compradorNome','comprador_nome'),('compradorCpf','comprador_cpf'),('compradorRg','comprador_rg'),('compradorTelefone','comprador_telefone'),('compradorEmail','comprador_email'),('compradorEstadoCivil','comprador_estado_civil'),('compradorProfissao','comprador_profissao'),('compradorInstagram','comprador_instagram'),('compradorCep','comprador_cep'),('compradorCidade','comprador_cidade'),('compradorEstado','comprador_estado'),('compradorEndereco','comprador_endereco'),('compradorLocalTrabalho','comprador_local_trabalho')) t(src,dst) LOOP j:=j||jsonb_build_object(leg.dst,p_request->leg.src); END LOOP;
 vid:=(j->>'id')::bigint; PERFORM telefone41.escrever('vendas_telefone',NULL,j);
 FOR i IN 1..n LOOP
 -- Âncora mensal: 31/jan -> fim/fev -> 31/mar, sem deriva de timezone/DST.
 venc:=(date_trunc('month',dia::timestamp)+make_interval(months=>i-1))::date;
 venc:=venc+least(extract(day FROM dia)::integer,extract(day FROM (venc+interval '1 month - 1 day'))::integer)-1;
 pj:=telefone41.nova_linha('parcelas_venda_telefone')||jsonb_build_object('user_id',p_user_id,'venda_id',vid,'numero',i,'valor',CASE WHEN i=n THEN total-parcela*(n-1) ELSE parcela END,'vencimento',venc::timestamp AT TIME ZONE 'America/Sao_Paulo','status','pendente','pago_em',NULL,'valor_pago',NULL);
 PERFORM telefone41.escrever('parcelas_venda_telefone',NULL,pj); ids:=ids||jsonb_build_array((pj->>'id')::bigint);
 END LOOP;
 SELECT jsonb_agg(to_jsonb(x)-ARRAY['status','pago_em','valor_pago'] ORDER BY numero) INTO a FROM public.parcelas_venda_telefone x WHERE venda_id=vid;
 INSERT INTO telefone41.origens VALUES(vid,p_user_id,p_chave,j,a);
 IF ent>0 THEN tid:=telefone41.lancar(p_user_id,p_chave,vid,NULL,aid,ent,'entrada',NULL); tids:=jsonb_build_array(tid); END IF;
 ELSIF p_request->>'acao'='receber' THEN
 PERFORM telefone41.conta(p_user_id,aid);
 SELECT to_jsonb(x) INTO pj FROM public.parcelas_venda_telefone x WHERE id=pid AND venda_id=vid AND user_id=p_user_id FOR UPDATE;
 IF pj IS NULL THEN RAISE EXCEPTION 'Parcela41 indisponível' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vendas_telefone WHERE id=vid AND status::text='ativo') OR pj->>'status' NOT IN('pendente','atrasada','vencendo_hoje') THEN RAISE EXCEPTION 'Parcela/venda41 processada' USING ERRCODE='23505'; END IF;
 v:=telefone41.moeda(p_request->>'valorPago'); IF v IS DISTINCT FROM (pj->>'valor')::numeric THEN RAISE EXCEPTION 'Exige parcela integral exata' USING ERRCODE='22023'; END IF;
 a:=pj; pj:=pj||jsonb_build_object('status','paga','pago_em',clock_timestamp(),'valor_pago',v);
 PERFORM telefone41.escrever('parcelas_venda_telefone',a,pj);
 tid:=telefone41.lancar(p_user_id,p_chave,vid,pid,aid,v,'recebimento',NULL); tids:=jsonb_build_array(tid);
 IF NOT EXISTS(SELECT 1 FROM public.parcelas_venda_telefone WHERE venda_id=vid AND status::text<>'paga') THEN
 SELECT to_jsonb(x) INTO j FROM public.vendas_telefone x WHERE id=vid; PERFORM telefone41.escrever('vendas_telefone',j,j||'{"status":"quitado"}'); END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM public.vendas_telefone WHERE id=vid AND status::text='cancelado') THEN RAISE EXCEPTION 'Venda41 já cancelada' USING ERRCODE='23505'; END IF;
 FOR aid IN SELECT DISTINCT (snapshot->>'conta_caixa_id')::integer FROM telefone41.pernas WHERE venda_id=vid AND papel<>'compensacao' ORDER BY 1 LOOP
 PERFORM telefone41.conta(p_user_id,aid);
 SELECT c.saldo+coalesce((SELECT sum(CASE tipo WHEN 'entrada' THEN valor ELSE -valor END) FROM public.transacoes_caixa WHERE conta_caixa_id=aid),0) INTO saldo FROM public.contas_caixa c WHERE c.id=aid AND c.user_id=p_user_id;
 SELECT sum((snapshot->>'valor')::numeric) INTO v FROM telefone41.pernas WHERE venda_id=vid AND papel<>'compensacao' AND (snapshot->>'conta_caixa_id')::integer=aid;
 IF saldo<v THEN RAISE EXCEPTION 'Compensação41 sem saldo' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR leg IN SELECT transacao_id,parcela_id,snapshot FROM telefone41.pernas WHERE venda_id=vid AND user_id=p_user_id AND papel<>'compensacao' ORDER BY transacao_id LOOP
 tid:=telefone41.lancar(p_user_id,p_chave,vid,leg.parcela_id,(leg.snapshot->>'conta_caixa_id')::integer,(leg.snapshot->>'valor')::numeric,'compensacao',leg.transacao_id); tids:=tids||jsonb_build_array(tid);
 END LOOP;
 SELECT to_jsonb(x) INTO j FROM public.vendas_telefone x WHERE id=vid; PERFORM telefone41.escrever('vendas_telefone',j,j||'{"status":"cancelado"}');
 END IF;
 PERFORM telefone41.validar_venda(p_user_id,vid);
 resultado:=jsonb_build_object('success',true,'repetida',false,'userId',p_user_id,'idempotencyKey',p_chave,'acao',p_request->>'acao','vendaId',vid,'parcelasIds',ids,'transacoesIds',tids,'status',(SELECT status::text FROM public.vendas_telefone WHERE id=vid));
 UPDATE telefone41.operacoes SET resultado=resultado41.r FROM (SELECT resultado r) resultado41 WHERE user_id=p_user_id AND chave=p_chave;
 RETURN resultado;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Row41 concorrente' USING ERRCODE='40001';
END $$;
CREATE FUNCTION telefone41.reconciliar(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE op telefone41.operacoes%ROWTYPE;
BEGIN
 IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR coalesce(p_request->>'acao','') NOT IN('criar','receber','cancelar') THEN RAISE EXCEPTION 'Request41 inválido para fence' USING ERRCODE='22023'; END IF;
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Owner/UUID41 inválido' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('telefone41:'||p_user_id||':'||p_chave,41));
 SELECT x.user_id,x.chave,x.acao,x.request,x.resultado,x.criada_em INTO op FROM telefone41.operacoes x WHERE x.user_id=p_user_id AND x.chave=p_chave;
 IF FOUND THEN
 IF op.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'Replay41 divergente' USING ERRCODE='23505'; END IF;
 IF op.resultado IS NULL THEN RAISE EXCEPTION 'Intenção41 incompleta' USING ERRCODE='23514'; END IF;
 PERFORM telefone41.validar_venda(p_user_id,(op.resultado->>'vendaId')::bigint);
 RETURN jsonb_build_object('status','confirmed','result',op.resultado);
 END IF;
 IF EXISTS(SELECT 1 FROM telefone41.fences WHERE user_id=p_user_id AND chave=p_chave) THEN
 IF NOT EXISTS(SELECT 1 FROM telefone41.fences WHERE user_id=p_user_id AND chave=p_chave AND request=p_request) THEN RAISE EXCEPTION 'UUID41 fence divergente' USING ERRCODE='23505'; END IF;
 RETURN jsonb_build_object('status','not_executed','result',NULL,'userId',p_user_id,'idempotencyKey',p_chave); END IF;
 -- Ausência sem fence permanece desconhecida.
 RETURN jsonb_build_object('status','unknown','result',NULL);
END $$;
CREATE FUNCTION telefone41.abandonar(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r jsonb;
BEGIN
 r:=telefone41.reconciliar(p_user_id,p_chave,p_request);
 IF r->>'status' IN('confirmed','not_executed') THEN RETURN r; END IF;
 -- reconciliar adquiriu o MESMO advisory UUID de executar, mantido até o commit.
 INSERT INTO telefone41.fences(user_id,chave,request) VALUES(p_user_id,p_chave,p_request);
 RETURN jsonb_build_object('status','not_executed','result',NULL,'userId',p_user_id,'idempotencyKey',p_chave);
END $$;
CREATE FUNCTION telefone41.commit_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM telefone41.operacoes WHERE user_id=NEW.user_id AND chave=NEW.chave AND resultado IS NULL) OR EXISTS(SELECT 1 FROM telefone41.capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) OR EXISTS(SELECT 1 FROM telefone41.ponte_capacidades pc WHERE pc.xid=txid_current() AND pc.pid=pg_backend_pid()) THEN RAISE EXCEPTION 'Intenção41 incompleta no commit' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER telefone41_complete AFTER INSERT OR UPDATE ON telefone41.operacoes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION telefone41.commit_check();
DO $security$
DECLARE t text; f regprocedure;
BEGIN
 FOREACH t IN ARRAY ARRAY['operacoes','origens','pernas','capacidades','ponte_capacidades','fences','manifesto'] LOOP
 EXECUTE format('ALTER TABLE telefone41.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON telefone41.%I FROM PUBLIC,anon,authenticated,service_role',t);
 IF t NOT IN('capacidades','ponte_capacidades') THEN EXECUTE format('CREATE TRIGGER telefone41_immutable BEFORE UPDATE OR DELETE ON telefone41.%I FOR EACH ROW EXECUTE FUNCTION telefone41.imutavel()',t); END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['vendas_telefone','parcelas_venda_telefone','transacoes_caixa','contas_caixa'] LOOP
 EXECUTE format('CREATE TRIGGER z_telefone41_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION telefone41.guardar()',t);
 END LOOP;
 FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='telefone41'::regnamespace LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f); END LOOP;
END $security$;

CREATE FUNCTION telefone41.conjunto(aid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object(
 'contas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contas_caixa WHERE id=aid),'[]'::jsonb),
 'contratos',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contratos WHERE id IN(SELECT contrato_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid) OR id IN(SELECT contrato_id FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid))),'[]'::jsonb),
 'parcelas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid)),'[]'::jsonb));
$$;
CREATE FUNCTION telefone41.travar_conta(uid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s jsonb; n integer; aids integer[]; cids integer[]; pids integer[]; clients integer[]; collectors integer[];
BEGIN
 IF uid IS NULL OR uid<=0 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid) THEN RAISE EXCEPTION 'Owner37 indisponível' USING ERRCODE='42501'; END IF;
 s:=telefone41.conjunto(aid);
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
 IF telefone41.conjunto(aid) IS DISTINCT FROM s OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND NOT cliente_id=ANY(clients))
 OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE id=ANY(pids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors)) THEN RAISE EXCEPTION 'Conjunto37 mudou durante locks' USING ERRCODE='40001'; END IF;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Row37 concorrente' USING ERRCODE='40001';
END $$;
CREATE FUNCTION telefone41.validar_conta(uid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a public.contas_caixa%ROWTYPE; t public.transacoes_caixa%ROWTYPE; oid37 uuid; vid41 bigint;
BEGIN
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
 FOR oid37 IN SELECT id FROM public.assinaturas42_operacoes WHERE conta_id=aid LOOP PERFORM public.assinaturas42_validar(oid37); END LOOP;
 FOR vid41 IN SELECT DISTINCT venda_id FROM telefone41.pernas WHERE user_id=uid AND (snapshot->>'conta_caixa_id')::integer=aid LOOP PERFORM telefone41.validar_venda(uid,vid41); END LOOP;
END $$;
CREATE FUNCTION telefone41.consumir(g text,t text,e text,a jsonb,b jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE ok boolean;
BEGIN
 DELETE FROM telefone41.ponte_capacidades cap USING telefone41.operacoes op,telefone41.pernas leg
 WHERE cap.xid=txid_current() AND cap.pid=pg_backend_pid() AND cap.guarda=g AND t='transacoes_caixa' AND e='INSERT' AND a IS NULL AND cap.posterior=b
 AND cap.user_id=op.user_id AND cap.chave=op.chave AND op.resultado IS NULL
 AND pg_xact_status(op.xmin::text::xid8)='in progress' AND pg_xact_status(cap.xmin::text::xid8)='in progress'
 AND leg.transacao_id=(b->>'id')::integer AND leg.user_id=op.user_id AND leg.chave=op.chave AND leg.snapshot=b
 AND b->>'user_id'=op.user_id::text AND b->>'categoria'='venda_telefone' AND b->'contrato_id'='null'::jsonb AND b->'parcela_id'='null'::jsonb
 AND (b->>'valor')::numeric>0 AND b->>'tipo'=CASE WHEN leg.papel='compensacao' THEN 'saida' ELSE 'entrada' END
 AND EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=(b->>'conta_caixa_id')::integer AND user_id=op.user_id AND ativo IS TRUE)
 AND EXISTS(SELECT 1 FROM telefone41.origens WHERE venda_id=leg.venda_id AND user_id=op.user_id)
 RETURNING true INTO ok;
 RETURN coalesce(ok,false);
END $$;
CREATE FUNCTION public.telefone41_consumir(g text,t text,e text,a jsonb,b jsonb) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT telefone41.consumir(g,t,e,a,b) $$;
CREATE FUNCTION telefone41.perna_comprovada(tid integer,uid integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE vid bigint;
BEGIN
 SELECT l.venda_id INTO vid FROM telefone41.pernas l JOIN telefone41.operacoes o ON o.user_id=l.user_id AND o.chave=l.chave
 WHERE l.transacao_id=tid AND l.user_id=uid AND o.resultado IS NOT NULL;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM telefone41.validar_venda(uid,vid); RETURN true;
END $$;
CREATE FUNCTION telefone41.metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(extensions.digest(jsonb_build_object(
 'schema',(SELECT to_jsonb(n) FROM pg_namespace n WHERE nspname='telefone41'),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE pronamespace='telefone41'::regnamespace),
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relkind,c.relpersistence) ORDER BY c.oid) FROM pg_class c WHERE relnamespace='telefone41'::regnamespace),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='telefone41'::regnamespace),
 'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='telefone41'::regnamespace),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE c.relnamespace='telefone41'::regnamespace),
 'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE connamespace='telefone41'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='telefone41'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='telefone41'::regnamespace)
 )::text,'sha256'),'hex')
$$;
CREATE FUNCTION telefone41.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.caixa37_verificar();
 IF (SELECT assinatura FROM telefone41.manifesto WHERE id=1) IS DISTINCT FROM telefone41.metadata() THEN RAISE EXCEPTION 'Selo41 divergente; nunca reseal runtime' USING ERRCODE='55000'; END IF;
END $$;
CREATE FUNCTION public.rpc_executar_telefone41(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN PERFORM telefone41.verificar(); RETURN telefone41.executar(p_user_id,p_chave,p_request); END $$;
CREATE FUNCTION public.rpc_reconciliar_telefone41(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN PERFORM telefone41.verificar(); RETURN telefone41.reconciliar(p_user_id,p_chave,p_request); END $$;
CREATE FUNCTION public.rpc_abandonar_telefone41(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN PERFORM telefone41.verificar(); RETURN telefone41.abandonar(p_user_id,p_chave,p_request); END $$;
REVOKE ALL ON FUNCTION public.telefone41_consumir(text,text,text,jsonb,jsonb),public.rpc_executar_telefone41(integer,uuid,jsonb),public.rpc_reconciliar_telefone41(integer,uuid,jsonb),public.rpc_abandonar_telefone41(integer,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
DO $acl41$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='telefone41'::regnamespace LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f); END LOOP;
END $acl41$;
GRANT EXECUTE ON FUNCTION public.rpc_executar_telefone41(integer,uuid,jsonb),public.rpc_reconciliar_telefone41(integer,uuid,jsonb),public.rpc_abandonar_telefone41(integer,uuid,jsonb) TO service_role;
INSERT INTO telefone41.manifesto VALUES(1,telefone41.metadata());

-- BEGIN PONTE41 COMPOSTA SOBRE42
CREATE OR REPLACE FUNCTION public.ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oldj jsonb; newj jsonb; cid integer; aid integer; protegido boolean; autorizado boolean; despesa_autorizada boolean;
BEGIN
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.caixa37_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF public.multa36_consumir('ciclo_guardar',TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 IF public.renovacao_consumir_capacidade(TG_TABLE_NAME,TG_OP,oldj,newj) THEN
   IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='contas_caixa' THEN
   aid:=(oldj->>'id')::int; PERFORM pg_advisory_xact_lock(22022,aid);
   IF EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens o JOIN public.contratos c ON c.id=o.contrato_id WHERE c.conta_caixa_id=aid)
     AND (TG_OP='DELETE' OR oldj->'user_id' IS DISTINCT FROM newj->'user_id' OR oldj->'saldo' IS DISTINCT FROM newj->'saldo') THEN
     RAISE EXCEPTION 'Conta protegida: owner/saldo-base/exclusão imutáveis' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='transacoes_caixa' THEN
   aid:=coalesce((newj->>'conta_caixa_id')::int,(oldj->>'conta_caixa_id')::int);
   PERFORM pg_advisory_xact_lock(22022,aid);
   IF TG_OP='UPDATE' AND (oldj->>'conta_caixa_id')::int IS DISTINCT FROM aid THEN PERFORM pg_advisory_xact_lock(22022,(oldj->>'conta_caixa_id')::int); END IF;
   protegido:=EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens o JOIN public.contratos c ON c.id=o.contrato_id WHERE c.conta_caixa_id IN(aid,(oldj->>'conta_caixa_id')::int) OR o.contrato_id IN((newj->>'contrato_id')::int,(oldj->>'contrato_id')::int))
     OR EXISTS(SELECT 1 FROM public.parcelas p JOIN public.emprestimos_rpc_origens o ON o.contrato_id=p.contrato_id WHERE p.id IN((newj->>'parcela_id')::int,(oldj->>'parcela_id')::int));
   autorizado:=EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND conta_id=aid
     AND ((acao='criar' AND newj->>'tipo'='saida' AND newj->>'categoria'='emprestimo_liberado') OR (acao='receber' AND contrato_id=(newj->>'contrato_id')::int AND newj->>'tipo'='entrada' AND newj->>'categoria'='pagamento_parcela')));
   -- 0025: consumo atômico de UMA linha exata; sem bypass de outros triggers/tabelas.
   IF TG_OP='INSERT' THEN
     DELETE FROM public.ciclo_despesas_autorizacoes a
      WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.conta_id=aid
        AND a.user_id=(newj->>'user_id')::integer AND a.esperado=newj-'id'
        AND newj->>'categoria'='despesa_operacional'
        AND newj->'contrato_id'='null'::jsonb AND newj->'parcela_id'='null'::jsonb
      RETURNING true INTO despesa_autorizada;
     IF NOT coalesce(despesa_autorizada,false) AND EXISTS(SELECT 1 FROM public.ciclo_despesas_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN
       RAISE EXCEPTION '0025: lançamento diferente da capability exata' USING ERRCODE='42501';
     END IF;
     autorizado:=autorizado OR coalesce(despesa_autorizada,false);
   END IF;
   IF protegido AND (TG_OP<>'INSERT' OR NOT autorizado) THEN RAISE EXCEPTION 'Livro protegido: somente RPC append-only' USING ERRCODE='42501'; END IF;
 ELSE
   cid:=CASE WHEN TG_TABLE_NAME='contratos' THEN coalesce((newj->>'id')::int,(oldj->>'id')::int) ELSE coalesce((newj->>'contrato_id')::int,(oldj->>'contrato_id')::int) END;
   protegido:=EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id IN(cid,(oldj->>'contrato_id')::int));
   autorizado:=EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND acao='receber' AND contrato_id=cid);
   IF protegido AND (TG_OP='DELETE' OR NOT autorizado OR (TG_TABLE_NAME='parcelas' AND TG_OP='INSERT')) THEN RAISE EXCEPTION 'Contrato/parcelas/trilha protegidos' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.legados_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE a jsonb; b jsonb; cids integer[]:='{}'; aids integer[]:='{}'; uids integer[]:='{}'; k integer; protegido boolean:=false; cap public.legados_capacidades%ROWTYPE; etapa text;
BEGIN
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.caixa37_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF public.multa36_consumir('legados_guardar',TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN a:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN b:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='contratos' THEN cids:=ARRAY[(a->>'id')::integer,(b->>'id')::integer];
 ELSE cids:=ARRAY[(a->>'contrato_id')::integer,(b->>'contrato_id')::integer]; END IF;
 IF TG_TABLE_NAME IN('parcelas','transacoes_caixa') THEN
  cids:=cids||ARRAY(SELECT contrato_id FROM public.parcelas WHERE id IN((a->>'parcela_id')::integer,(b->>'parcela_id')::integer));
 END IF;
 IF TG_TABLE_NAME='emprestimos_rpc_operacoes' THEN
  cids:=cids||ARRAY[(a->'resultado'->>'id')::integer,(b->'resultado'->>'id')::integer];
  aids:=aids||ARRAY[(a->'payload'->>'contaCaixaId')::integer,(b->'payload'->>'contaCaixaId')::integer];
  uids:=uids||ARRAY[(a->'payload'->>'userId')::integer,(b->'payload'->>'userId')::integer];
 END IF;
 aids:=aids||ARRAY[(a->>'conta_caixa_id')::integer,(b->>'conta_caixa_id')::integer];
 IF TG_TABLE_NAME='contas_caixa' THEN aids:=aids||ARRAY[(a->>'id')::integer,(b->>'id')::integer]; END IF;
 aids:=aids||ARRAY(SELECT conta_caixa_id FROM public.contratos WHERE id=ANY(cids));
 uids:=uids||ARRAY[(a->>'user_id')::integer,(b->>'user_id')::integer];
 IF TG_TABLE_NAME='users' THEN uids:=uids||ARRAY[(a->>'id')::integer,(b->>'id')::integer]; END IF;
 uids:=uids||ARRAY(SELECT user_id FROM public.contratos WHERE id=ANY(cids))||ARRAY(SELECT user_id FROM public.contas_caixa WHERE id=ANY(aids));
 FOR k IN SELECT DISTINCT v FROM unnest(aids) v WHERE v IS NOT NULL ORDER BY v LOOP
  IF NOT pg_try_advisory_xact_lock(22022,k) THEN RAISE EXCEPTION 'PROTOCOLO_CONCORRENTE' USING ERRCODE='40001'; END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT v FROM unnest(uids) v WHERE v IS NOT NULL ORDER BY v LOOP
  IF NOT pg_try_advisory_xact_lock(34034,k) THEN RAISE EXCEPTION 'PROTOCOLO_CONCORRENTE' USING ERRCODE='40001'; END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT v FROM unnest(cids) v WHERE v IS NOT NULL ORDER BY v LOOP
  IF NOT pg_try_advisory_xact_lock(34035,k) THEN RAISE EXCEPTION 'PROTOCOLO_CONCORRENTE' USING ERRCODE='40001'; END IF;
 END LOOP;
 -- Owners dos vínculos financeiros concluídos não mudam silenciosamente após o commit.
 IF TG_TABLE_NAME IN('clientes','koletores') AND TG_OP<>'INSERT' AND
  (TG_OP='DELETE' OR a->'user_id' IS DISTINCT FROM b->'user_id') AND EXISTS(
   SELECT 1 FROM public.legados_estados e JOIN public.contratos c ON c.id=e.contrato_id WHERE
    (TG_TABLE_NAME='clientes' AND c.cliente_id=(a->>'id')::integer) OR
    (TG_TABLE_NAME='koletores' AND (c.koletor_id=(a->>'id')::integer OR EXISTS(SELECT 1 FROM public.parcelas p WHERE p.contrato_id=c.id AND p.koletor_id=(a->>'id')::integer)))
  ) THEN RAISE EXCEPTION 'OWNER_LEGADO_IMUTAVEL' USING ERRCODE='42501'; END IF;
 -- Proteção pós-adesão é só novo estado financeiro, não origem e não saneamento.
 protegido:=EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=ANY(cids));
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP<>'INSERT' AND EXISTS(
  SELECT 1 FROM public.legados_auditoria au WHERE au.transacao_id=(a->>'id')::integer
 ) THEN protegido:=true; END IF;
 IF TG_TABLE_NAME='contas_caixa' AND TG_OP<>'INSERT' AND EXISTS(
  SELECT 1 FROM public.legados_estados e JOIN public.contratos c ON c.id=e.contrato_id WHERE c.conta_caixa_id=(a->>'id')::integer OR EXISTS(SELECT 1 FROM public.parcelas p WHERE p.contrato_id=c.id AND p.conta_caixa_id=(a->>'id')::integer)
  UNION ALL SELECT 1 FROM public.legados_auditoria au JOIN public.transacoes_caixa t ON t.id=au.transacao_id WHERE t.conta_caixa_id=(a->>'id')::integer
 ) AND (TG_OP='DELETE' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR a->'saldo' IS DISTINCT FROM b->'saldo') THEN
  RAISE EXCEPTION 'CONTA_LEGADA_IMUTAVEL' USING ERRCODE='42501'; END IF;
 IF protegido THEN
  etapa:=CASE TG_TABLE_NAME WHEN 'parcelas' THEN 'parcela' WHEN 'contratos' THEN 'contrato' WHEN 'transacoes_caixa' THEN 'ledger' WHEN 'contrato_historico' THEN 'historico' END;
  SELECT * INTO cap FROM public.legados_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid();
  IF etapa IS NULL OR cap.etapa IS DISTINCT FROM etapa OR TG_OP='DELETE'
   OR (TG_TABLE_NAME='parcelas' AND (TG_OP<>'UPDATE' OR (b->>'id')::integer IS DISTINCT FROM cap.parcela_id OR (b->>'contrato_id')::integer IS DISTINCT FROM cap.contrato_id))
   OR (TG_TABLE_NAME='contratos' AND (TG_OP<>'UPDATE' OR (b->>'id')::integer IS DISTINCT FROM cap.contrato_id))
   OR (TG_TABLE_NAME IN('transacoes_caixa','contrato_historico') AND (TG_OP<>'INSERT' OR (b->>'contrato_id')::integer IS DISTINCT FROM cap.contrato_id))
   OR (TG_TABLE_NAME='transacoes_caixa' AND ((b->>'conta_caixa_id')::integer IS DISTINCT FROM cap.conta_id OR (b->>'parcela_id')::integer IS DISTINCT FROM cap.parcela_id OR b->>'tipo' IS DISTINCT FROM 'entrada' OR b->>'categoria' IS DISTINCT FROM 'pagamento_parcela')) THEN
   RAISE EXCEPTION 'HISTORICO_LEGADO_PROTEGIDO' USING ERRCODE='42501'; END IF;
  DELETE FROM public.legados_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid();
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.multimodal_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a jsonb; b jsonb; cids integer[]; aids integer[]; cid integer; aid integer; protegido boolean; autorizado boolean:=false; cap public.multimodal_autorizacoes%ROWTYPE; j jsonb;
BEGIN
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.caixa37_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF public.multa36_consumir('multimodal_guardar',TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END) THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN a:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN b:=to_jsonb(NEW); END IF;
 cids:=ARRAY[(a->>'contrato_id')::integer,(b->>'contrato_id')::integer];
 IF TG_TABLE_NAME='contratos' THEN cids:=ARRAY[(a->>'id')::integer,(b->>'id')::integer]; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' THEN cids:=cids||ARRAY(SELECT contrato_id FROM public.parcelas WHERE id IN((a->>'parcela_id')::integer,(b->>'parcela_id')::integer)); END IF;
 aids:=ARRAY[(a->>'conta_caixa_id')::integer,(b->>'conta_caixa_id')::integer]||ARRAY(SELECT conta_id FROM public.multimodal_origens WHERE contrato_id=ANY(cids));
 IF TG_TABLE_NAME='contas_caixa' THEN aids:=ARRAY[(a->>'id')::integer,(b->>'id')::integer]; END IF;
 FOR aid IN SELECT DISTINCT v FROM unnest(aids) v WHERE v IS NOT NULL ORDER BY v LOOP
 IF NOT pg_try_advisory_xact_lock(22022,aid) THEN RAISE EXCEPTION 'Conta concorrente' USING ERRCODE='40001'; END IF;
 END LOOP;
 FOR cid IN SELECT DISTINCT v FROM unnest(cids) v WHERE v IS NOT NULL ORDER BY v LOOP
 IF NOT pg_try_advisory_xact_lock(34035,cid) THEN RAISE EXCEPTION 'Contrato concorrente' USING ERRCODE='40001'; END IF;
 END LOOP;
 IF TG_TABLE_NAME IN('clientes','koletores') AND TG_OP<>'INSERT' AND (TG_OP='DELETE' OR a->'user_id' IS DISTINCT FROM b->'user_id') AND EXISTS(SELECT 1 FROM public.multimodal_origens WHERE (TG_TABLE_NAME='clientes' AND cliente_id=(a->>'id')::integer) OR (TG_TABLE_NAME='koletores' AND koletor_id=(a->>'id')::integer)) THEN RAISE EXCEPTION 'Owner vínculo multimodal imutável' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='contas_caixa' AND TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.multimodal_origens WHERE conta_id=ANY(aids)) AND (TG_OP='DELETE' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR a->'saldo' IS DISTINCT FROM b->'saldo' OR a->'id' IS DISTINCT FROM b->'id') THEN RAISE EXCEPTION 'Conta multimodal imutável' USING ERRCODE='42501'; END IF;
 protegido:=EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=ANY(cids));
 IF TG_TABLE_NAME='transacoes_caixa' THEN protegido:=protegido OR EXISTS(SELECT 1 FROM public.multimodal_origens WHERE conta_id=ANY(aids)); END IF;
 SELECT * INTO cap FROM public.multimodal_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid();
 IF FOUND AND cap.tabela=TG_TABLE_NAME THEN
 IF TG_OP IS DISTINCT FROM cap.evento OR a IS DISTINCT FROM cap.anterior OR b IS DISTINCT FROM cap.posterior THEN RAISE EXCEPTION 'Escrita diferente da capacidade exata' USING ERRCODE='42501'; END IF;
 DELETE FROM public.multimodal_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid(); autorizado:=true;
 END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND NOT autorizado THEN
 -- Ponte exata 0025/0031/0034: só contratos E parcelas físicas NÃO multimodais.
 DELETE FROM public.multimodal_coexistencia WHERE xid=txid_current() AND pid=pg_backend_pid() AND posterior=b-'id' RETURNING posterior INTO j;
 autorizado:=FOUND AND NOT EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=ANY(cids));
 IF NOT autorizado THEN
 autorizado:=EXISTS(SELECT 1 FROM public.ciclo_autorizacoes ca WHERE ca.xid=txid_current() AND ca.pid=pg_backend_pid() AND ca.conta_id=(b->>'conta_caixa_id')::integer
 AND NOT EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=ANY(cids))
 AND ((ca.acao='criar' AND b->>'tipo'='saida' AND b->>'categoria'='emprestimo_liberado' AND b->'parcela_id'='null'::jsonb AND EXISTS(SELECT 1 FROM public.contratos c WHERE c.id=(b->>'contrato_id')::integer AND c.user_id=(b->>'user_id')::integer AND c.valor_principal=(b->>'valor')::numeric AND c.conta_caixa_id=ca.conta_id))
 OR (ca.acao='receber' AND ca.contrato_id=(b->>'contrato_id')::integer AND b->>'tipo'='entrada' AND b->>'categoria'='pagamento_parcela' AND EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=ca.contrato_id AND user_id=(b->>'user_id')::integer))));
 END IF;
 END IF;
 IF protegido AND (TG_OP='DELETE' OR (TG_TABLE_NAME='transacoes_caixa' AND TG_OP<>'INSERT') OR NOT autorizado) AND TG_TABLE_NAME NOT IN('contas_caixa','clientes','koletores') THEN RAISE EXCEPTION 'Cohort/livro multimodal somente RPC privada' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.multa36_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a jsonb; b jsonb; ids integer[]; aid integer; protegido boolean;
BEGIN
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.caixa37_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN a:=to_jsonb(OLD); END IF; IF TG_OP<>'DELETE' THEN b:=to_jsonb(NEW); END IF;
 ids:=ARRAY[(a->>'contrato_id')::int,(b->>'contrato_id')::int];
 IF TG_TABLE_NAME='contratos' THEN ids:=ARRAY[(a->>'id')::int,(b->>'id')::int]; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' THEN ids:=ids||ARRAY(SELECT contrato_id FROM public.parcelas WHERE id IN((a->>'parcela_id')::int,(b->>'parcela_id')::int)); END IF;
 IF TG_TABLE_NAME IN('clientes','koletores') AND TG_OP<>'INSERT' AND (TG_OP='DELETE' OR a->'user_id' IS DISTINCT FROM b->'user_id') AND EXISTS(SELECT 1 FROM public.multa36_origens o JOIN public.contratos c ON c.id=o.contrato_id WHERE (TG_TABLE_NAME='clientes' AND c.cliente_id=(a->>'id')::int) OR (TG_TABLE_NAME='koletores' AND (c.koletor_id=(a->>'id')::int OR EXISTS(SELECT 1 FROM public.parcelas p WHERE p.contrato_id=c.id AND p.koletor_id=(a->>'id')::int)))) THEN RAISE EXCEPTION 'Owner36 imutável' USING ERRCODE='42501'; END IF;
 aid:=CASE WHEN TG_TABLE_NAME='contas_caixa' THEN (a->>'id')::int ELSE coalesce((b->>'conta_caixa_id')::int,(a->>'conta_caixa_id')::int) END;
 IF TG_TABLE_NAME='contas_caixa' AND TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.multa36_origens WHERE conta_id=aid) AND (TG_OP='DELETE' OR a->'id' IS DISTINCT FROM b->'id' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR a->'saldo' IS DISTINCT FROM b->'saldo') THEN RAISE EXCEPTION 'Conta36 saldo-base/owner imutáveis' USING ERRCODE='42501'; END IF;
 protegido:=EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=ANY(ids));
 IF TG_TABLE_NAME='transacoes_caixa' THEN protegido:=protegido OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE conta_id IN(aid,(a->>'conta_caixa_id')::int)); END IF;
 IF public.multa36_consumir('multa36_guardar',TG_TABLE_NAME,TG_OP,a,b) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=ANY(ids)) THEN
 DELETE FROM public.multa36_coexistencia WHERE xid=txid_current() AND pid=pg_backend_pid() AND posterior=b RETURNING true INTO protegido;
 IF FOUND THEN RETURN NEW; END IF;
 protegido:=EXISTS(SELECT 1 FROM public.multa36_origens WHERE conta_id=aid);
 END IF;
 IF protegido AND TG_TABLE_NAME IN('contratos','parcelas','transacoes_caixa','contrato_historico') THEN RAISE EXCEPTION 'Financeiro36 exige transição exata; sem patch/exclusão' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.multa36_ponte() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE b jsonb:=to_jsonb(NEW); cid integer:=NEW.contrato_id; pid0 integer:=NEW.parcela_id; uid integer:=NEW.user_id; ok boolean:=false; op record; t public.transacoes_caixa%ROWTYPE; n integer;
BEGIN
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.caixa37_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 PERFORM public.multa36_verificar();
 IF NOT EXISTS(SELECT 1 FROM public.multa36_origens WHERE conta_id=NEW.conta_caixa_id) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid OR contrato_id IN(SELECT contrato_id FROM public.parcelas WHERE id=pid0)) THEN RETURN NEW; END IF;
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=NEW.conta_caixa_id AND user_id=uid AND ativo IS TRUE)
 OR (cid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.clientes cl ON cl.id=c.cliente_id WHERE c.id=cid AND c.user_id=uid AND cl.user_id=uid AND c.conta_caixa_id=NEW.conta_caixa_id))
 OR (pid0 IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id WHERE p.id=pid0 AND c.id=cid AND p.user_id=uid AND c.user_id=uid AND p.cliente_id=c.cliente_id AND p.conta_caixa_id=NEW.conta_caixa_id)) THEN RAISE EXCEPTION 'Ponte36 owner/vínculo indisponível' USING ERRCODE='42501'; END IF;
 -- 0035/0031 já fornecem posterior integral + operação própria em andamento.
 ok:=EXISTS(SELECT 1 FROM public.multimodal_autorizacoes a JOIN public.multimodal_operacoes o ON o.id=a.operacao_id WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.tabela='transacoes_caixa' AND a.evento='INSERT' AND a.anterior IS NULL AND a.posterior=b AND o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND o.hash_payload=encode(extensions.digest(o.payload::text,'sha256'),'hex'));
 ok:=ok OR EXISTS(SELECT 1 FROM public.renovacao_capacidades a JOIN public.renovacao_operacoes o ON o.id=a.operacao_id WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.tabela='transacoes_caixa' AND a.evento='INSERT' AND a.anterior IS NULL AND a.posterior=b AND o.user_id=uid AND o.contrato_id=cid AND o.parcela_id=pid0 AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND o.hash_payload=encode(extensions.digest(o.payload::text,'sha256'),'hex'));
 -- 0025 capacidade privada autenticada por ciclo_autorizar de oito argumentos.
 ok:=ok OR EXISTS(SELECT 1 FROM public.ciclo_despesas_autorizacoes a JOIN public.despesas_rpc_origens o ON o.despesa_id=a.despesa_id JOIN public.contas_pagar d ON d.id=a.despesa_id WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND pg_xact_status(a.xmin::text::xid8)='in progress' AND a.user_id=uid AND a.conta_id=NEW.conta_caixa_id AND a.esperado=b-'id' AND o.user_id=uid AND d.user_id=uid AND d.valor=NEW.valor AND cid IS NULL AND pid0 IS NULL AND NEW.categoria='despesa_operacional' AND NEW.descricao=(CASE a.acao WHEN 'pagar' THEN 'Pagamento: ' ELSE 'Estorno: ' END)||d.descricao AND NEW.tipo=CASE a.acao WHEN 'pagar' THEN 'saida' ELSE 'entrada' END);
 -- 0034 witness reconstruído/validado pelo bridge35; ambos ainda não consumidos.
 ok:=ok OR EXISTS(SELECT 1 FROM public.legados_capacidades a JOIN public.multimodal_coexistencia w ON w.xid=a.xid AND w.pid=a.pid WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.etapa='ledger' AND a.contrato_id=cid AND a.parcela_id=pid0 AND a.conta_id=NEW.conta_caixa_id AND pg_xact_status(a.xmin::text::xid8)='in progress' AND w.posterior=b-'id' AND EXISTS(SELECT 1 FROM public.legados_operacoes o WHERE o.contrato_id=cid AND o.parcela_id=pid0 AND o.conta_id=NEW.conta_caixa_id AND o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND o.hash_payload=encode(extensions.digest(o.payload::text,'sha256'),'hex')));
 -- 0021/0022 não fornecem posterior: reconstruir o INSERT único da operação
 -- privada, não autorizar categoria genérica ou capability isolada.
 IF NOT ok AND EXISTS(SELECT 1 FROM public.ciclo_autorizacoes a WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.conta_id=NEW.conta_caixa_id AND pg_xact_status(a.xmin::text::xid8)='in progress') THEN
 IF NEW.tipo='saida' AND NEW.categoria='emprestimo_liberado' AND pid0 IS NULL THEN
 SELECT count(*) INTO n FROM public.emprestimos_rpc_operacoes o WHERE o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND (o.payload->>'contaCaixaId')::int=NEW.conta_caixa_id;
 IF n=1 THEN
 SELECT o.* INTO op FROM public.emprestimos_rpc_operacoes o WHERE o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND (o.payload->>'contaCaixaId')::int=NEW.conta_caixa_id;
 IF op.hash_payload=encode(extensions.digest(op.payload::text,'sha256'),'hex') AND EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND acao='criar')
 AND EXISTS(SELECT 1 FROM public.contratos WHERE id=cid AND user_id=uid AND cliente_id=(op.payload->>'clienteId')::int AND valor_principal=(op.payload->>'valorPrincipal')::numeric AND modalidade='mensal' AND tipo_taxa='mensal') THEN
 t.user_id:=uid; t.conta_caixa_id:=NEW.conta_caixa_id; t.contrato_id:=cid; t.tipo:='saida'; t.categoria:='emprestimo_liberado'; t.valor:=(op.payload->>'valorPrincipal')::numeric; t.descricao:='Empréstimo RPC - Contrato #'||cid::text; t.data_transacao:=(op.payload->>'dataDesembolso')::date; t."createdAt":=transaction_timestamp(); ok:=to_jsonb(t)-'id'=b-'id';
 END IF; END IF;
 ELSIF NEW.tipo='entrada' AND NEW.categoria='pagamento_parcela' THEN
 SELECT count(*) INTO n FROM public.ciclo_operacoes o WHERE o.contrato_id=cid AND o.parcela_id=pid0 AND o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress';
 IF n=1 THEN
 SELECT o.* INTO op FROM public.ciclo_operacoes o WHERE o.contrato_id=cid AND o.parcela_id=pid0 AND o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress';
 IF op.hash_payload=encode(extensions.digest(op.payload::text,'sha256'),'hex') AND EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid AND user_id=uid)
 AND EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND acao='receber' AND contrato_id=cid) THEN
 t.user_id:=uid; t.conta_caixa_id:=NEW.conta_caixa_id; t.contrato_id:=cid; t.parcela_id:=pid0; t.tipo:='entrada'; t.categoria:='pagamento_parcela'; t.valor:=(op.payload->>'valorRecebido')::numeric; t.descricao:='Recebimento prospectivo '||op.id::text; t.data_transacao:=(op.payload->>'dataPagamento')::date; t."createdAt":=transaction_timestamp(); ok:=to_jsonb(t)-'id'=b-'id';
 END IF; END IF;
 END IF;
 END IF;
 IF NOT ok THEN RAISE EXCEPTION 'Ponte36 exige intenção privada íntegra e posterior exato' USING ERRCODE='42501'; END IF;
 INSERT INTO public.multa36_coexistencia VALUES(txid_current(),pg_backend_pid(),b);
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.caixa37_ponte() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE b jsonb:=to_jsonb(NEW); cid integer:=NEW.contrato_id; pid0 integer:=NEW.parcela_id; uid integer:=NEW.user_id; ok boolean:=false; op record; t public.transacoes_caixa%ROWTYPE; n integer;
BEGIN
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 PERFORM public.caixa37_verificar();
 IF NOT EXISTS(SELECT 1 FROM public.caixa37_contas WHERE conta_id=NEW.conta_caixa_id) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.caixa37_capacidades cap JOIN public.caixa37_operacoes o ON o.id=cap.operacao_id WHERE cap.xid=txid_current() AND cap.pid=pg_backend_pid() AND cap.posterior=b AND cap.guard='z_caixa37_ledger' AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress') THEN RETURN NEW; END IF;
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=NEW.conta_caixa_id AND user_id=uid AND ativo IS TRUE)
 OR (cid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.clientes cl ON cl.id=c.cliente_id WHERE c.id=cid AND c.user_id=uid AND cl.user_id=uid AND c.conta_caixa_id=NEW.conta_caixa_id))
 OR (pid0 IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id WHERE p.id=pid0 AND c.id=cid AND p.user_id=uid AND c.user_id=uid AND p.cliente_id=c.cliente_id AND p.conta_caixa_id=NEW.conta_caixa_id)) THEN RAISE EXCEPTION 'Ponte37 owner/vínculo indisponível' USING ERRCODE='42501'; END IF;
 -- 0035/0031 já fornecem posterior integral + operação própria em andamento.
 ok:=EXISTS(SELECT 1 FROM public.multa36_capacidades a JOIN public.multa36_operacoes o ON o.id=a.operacao_id WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.tabela='transacoes_caixa' AND a.evento='INSERT' AND a.anterior IS NULL AND a.posterior=b AND o.user_id=uid AND o.contrato_id=cid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND o.hash_payload=encode(extensions.digest(o.request::text,'sha256'),'hex'));
 ok:=ok OR EXISTS(SELECT 1 FROM public.multimodal_autorizacoes a JOIN public.multimodal_operacoes o ON o.id=a.operacao_id WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.tabela='transacoes_caixa' AND a.evento='INSERT' AND a.anterior IS NULL AND a.posterior=b AND o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND o.hash_payload=encode(extensions.digest(o.payload::text,'sha256'),'hex'));
 ok:=ok OR EXISTS(SELECT 1 FROM public.renovacao_capacidades a JOIN public.renovacao_operacoes o ON o.id=a.operacao_id WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.tabela='transacoes_caixa' AND a.evento='INSERT' AND a.anterior IS NULL AND a.posterior=b AND o.user_id=uid AND o.contrato_id=cid AND o.parcela_id=pid0 AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND o.hash_payload=encode(extensions.digest(o.payload::text,'sha256'),'hex'));
 -- 0025 capacidade privada autenticada por ciclo_autorizar de oito argumentos.
 ok:=ok OR EXISTS(SELECT 1 FROM public.ciclo_despesas_autorizacoes a JOIN public.despesas_rpc_origens o ON o.despesa_id=a.despesa_id JOIN public.contas_pagar d ON d.id=a.despesa_id WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND pg_xact_status(a.xmin::text::xid8)='in progress' AND a.user_id=uid AND a.conta_id=NEW.conta_caixa_id AND a.esperado=b-'id' AND o.user_id=uid AND d.user_id=uid AND d.valor=NEW.valor AND cid IS NULL AND pid0 IS NULL AND NEW.categoria='despesa_operacional' AND NEW.descricao=(CASE a.acao WHEN 'pagar' THEN 'Pagamento: ' ELSE 'Estorno: ' END)||d.descricao AND NEW.tipo=CASE a.acao WHEN 'pagar' THEN 'saida' ELSE 'entrada' END);
 -- 0034 witness reconstruído/validado pelo bridge35; ambos ainda não consumidos.
 ok:=ok OR EXISTS(SELECT 1 FROM public.legados_capacidades a JOIN public.multimodal_coexistencia w ON w.xid=a.xid AND w.pid=a.pid WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.etapa='ledger' AND a.contrato_id=cid AND a.parcela_id=pid0 AND a.conta_id=NEW.conta_caixa_id AND pg_xact_status(a.xmin::text::xid8)='in progress' AND w.posterior=b-'id' AND EXISTS(SELECT 1 FROM public.legados_operacoes o WHERE o.contrato_id=cid AND o.parcela_id=pid0 AND o.conta_id=NEW.conta_caixa_id AND o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND o.hash_payload=encode(extensions.digest(o.payload::text,'sha256'),'hex')));
 -- 0021/0022 não fornecem posterior: reconstruir o INSERT único da operação
 -- privada, não autorizar categoria genérica ou capability isolada.
 IF NOT ok AND EXISTS(SELECT 1 FROM public.ciclo_autorizacoes a WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.conta_id=NEW.conta_caixa_id AND pg_xact_status(a.xmin::text::xid8)='in progress') THEN
 IF NEW.tipo='saida' AND NEW.categoria='emprestimo_liberado' AND pid0 IS NULL THEN
 SELECT count(*) INTO n FROM public.emprestimos_rpc_operacoes o WHERE o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND (o.payload->>'contaCaixaId')::int=NEW.conta_caixa_id;
 IF n=1 THEN
 SELECT o.* INTO op FROM public.emprestimos_rpc_operacoes o WHERE o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress' AND (o.payload->>'contaCaixaId')::int=NEW.conta_caixa_id;
 IF op.hash_payload=encode(extensions.digest(op.payload::text,'sha256'),'hex') AND EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND acao='criar')
 AND EXISTS(SELECT 1 FROM public.contratos WHERE id=cid AND user_id=uid AND cliente_id=(op.payload->>'clienteId')::int AND valor_principal=(op.payload->>'valorPrincipal')::numeric AND modalidade='mensal' AND tipo_taxa='mensal') THEN
 t.user_id:=uid; t.conta_caixa_id:=NEW.conta_caixa_id; t.contrato_id:=cid; t.tipo:='saida'; t.categoria:='emprestimo_liberado'; t.valor:=(op.payload->>'valorPrincipal')::numeric; t.descricao:='Empréstimo RPC - Contrato #'||cid::text; t.data_transacao:=(op.payload->>'dataDesembolso')::date; t."createdAt":=transaction_timestamp(); ok:=to_jsonb(t)-'id'=b-'id';
 END IF; END IF;
 ELSIF NEW.tipo='entrada' AND NEW.categoria='pagamento_parcela' THEN
 SELECT count(*) INTO n FROM public.ciclo_operacoes o WHERE o.contrato_id=cid AND o.parcela_id=pid0 AND o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress';
 IF n=1 THEN
 SELECT o.* INTO op FROM public.ciclo_operacoes o WHERE o.contrato_id=cid AND o.parcela_id=pid0 AND o.user_id=uid AND o.resultado IS NULL AND pg_xact_status(o.xmin::text::xid8)='in progress';
 IF op.hash_payload=encode(extensions.digest(op.payload::text,'sha256'),'hex') AND EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid AND user_id=uid)
 AND EXISTS(SELECT 1 FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid() AND acao='receber' AND contrato_id=cid) THEN
 t.user_id:=uid; t.conta_caixa_id:=NEW.conta_caixa_id; t.contrato_id:=cid; t.parcela_id:=pid0; t.tipo:='entrada'; t.categoria:='pagamento_parcela'; t.valor:=(op.payload->>'valorRecebido')::numeric; t.descricao:='Recebimento prospectivo '||op.id::text; t.data_transacao:=(op.payload->>'dataPagamento')::date; t."createdAt":=transaction_timestamp(); ok:=to_jsonb(t)-'id'=b-'id';
 END IF; END IF;
 END IF;
 END IF;
 IF NOT ok THEN RAISE EXCEPTION 'Ponte37 exige intenção privada íntegra e posterior exato' USING ERRCODE='42501'; END IF;
 INSERT INTO public.caixa37_coexistencia VALUES(txid_current(),pg_backend_pid(),b,'predecessor_exact_v1');
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.caixa37_ledger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE ok boolean; a integer; b integer;
BEGIN
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.telefone41_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.assinaturas42_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 a:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.conta_caixa_id END; b:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.conta_caixa_id END;
 IF NOT EXISTS(SELECT 1 FROM public.caixa37_contas WHERE conta_id IN(a,b)) THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
 PERFORM public.caixa37_verificar();
 IF TG_OP='INSERT' AND public.caixa37_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
 DELETE FROM public.caixa37_coexistencia WHERE xid=txid_current() AND pid=pg_backend_pid() AND posterior=to_jsonb(NEW) AND pg_xact_status(xmin::text::xid8)='in progress' RETURNING true INTO ok;
 IF FOUND THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Ledger37 pin exige prova específica; sem patch/manual' USING ERRCODE='42501';
END $$;
CREATE OR REPLACE FUNCTION public.caixa37_perna_comprovada(tid integer,uid integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oid37 uuid;
BEGIN
 SELECT p.operacao_id INTO oid37 FROM public.caixa37_pernas p JOIN public.caixa37_operacoes o ON o.id=p.operacao_id WHERE p.transacao_id=tid AND p.user_id=uid AND o.user_id=uid;
 IF NOT FOUND THEN
 SELECT o.id INTO oid37 FROM public.assinaturas42_operacoes o WHERE o.transacao_id=tid AND o.user_id=uid;
 IF NOT FOUND THEN RETURN telefone41.perna_comprovada(tid,uid); END IF; PERFORM public.assinaturas42_validar(oid37); RETURN true; END IF; PERFORM public.caixa37_validar_op(oid37); RETURN true;
END $$;
-- END PONTE41
DO $after41$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"ciclo_guardar","args":"","hash":"a137cc94825f68d18ac1421a693b4b1c09d1761fd4d8ec854aa1159916b03143","config":["search_path=pg_catalog, pg_temp"]},{"name":"legados_guardar","args":"","hash":"f18056bbe04995ce1150df84cfc6d13e7e97b6411667cf34069773939bf78b94","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_guardar","args":"","hash":"3f5487a467d218ecf84139935bf3e25d1d1dc8b31c89471c20ac63a7ff929bb3","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multa36_guardar","args":"","hash":"84738e37e62fec3e70094d6312228bfec5d746b163d5f32fe5ff043dc3bd982d","config":["search_path=pg_catalog, pg_temp"]},{"name":"multa36_ponte","args":"","hash":"98c40907736c9c726e8422cd6e300ca48c62040e322273d606797d4d9973b200","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ponte","args":"","hash":"13125216be4c8a8d57e0b48d7cb902ef14f3637975890861380abf781125bc4a","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ledger","args":"","hash":"fb7c01ee9719f11ce99b68a81dbeded58bd94637b03453934a609e2040f9accf","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_perna_comprovada","args":"integer, integer","hash":"b0b2e1e6807ce8aeb70d5dd13c70d74844858ddba472cfe64b1777c3f7e30356","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '0041 predecessor overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION '0041 predecessor fonte/config/ACL/owner divergente' USING ERRCODE='55000'; END IF;
 END LOOP; END $after41$;
DO $post41$ DECLARE w record; BEGIN
 FOR w IN SELECT oid,snapshot,definition FROM telefone41_witness LOOP
 IF (SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid=w.oid) IS DISTINCT FROM w.snapshot OR pg_get_functiondef(w.oid) IS DISTINCT FROM w.definition THEN RAISE EXCEPTION '0041 função fora da ponte alterada' USING ERRCODE='55000'; END IF; END LOOP;
 FOR w IN SELECT oid,snapshot FROM telefone41_triggers_witness LOOP
 IF (SELECT to_jsonb(t) FROM pg_trigger t WHERE t.oid=w.oid) IS DISTINCT FROM w.snapshot THEN RAISE EXCEPTION '0041 trigger predecessor alterada' USING ERRCODE='55000'; END IF; END LOOP;
END $post41$;
-- Selagem de instalação apenas, após fontes antes/depois e testemunho sem alterações externas.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
DO $verify41$ BEGIN PERFORM telefone41.verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar(); END $verify41$;
NOTIFY pgrst,'reload schema';
COMMIT;
