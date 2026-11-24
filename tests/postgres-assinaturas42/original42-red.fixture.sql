-- 0042: recebimento operacional, sem Kiwify/legado/rest writer.
-- Aplicar integralmente em janela DDL exclusiva, após backup e validação do shape físico.
-- Nenhum selo é relaxado; original verificado ANTES, reseal SOMENTE na instalação.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.users,public.clientes,public.contas_caixa,public.assinaturas,public.pagamentos_assinatura,public.transacoes_caixa IN SHARE ROW EXCLUSIVE MODE;
DO $gate42$ DECLARE actual jsonb; BEGIN
 PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();
 IF current_user IN('service_role','anon','authenticated') OR to_regclass('public.assinaturas42_operacoes') IS NOT NULL THEN RAISE EXCEPTION '0042 instalação one-shot/owner inválido' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.transacoes_caixa'::regclass AND attname='pagamento_assinatura_id' AND NOT attisdropped) THEN RAISE EXCEPTION '0042 shape0014 incompatível com baseline37 certificado; não adaptar silenciosamente' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) INTO actual FROM pg_attribute WHERE attrelid='public.assinaturas'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM '[["id","integer",true],["cliente_id","integer",true],["servico","character varying(200)",true],["descricao","text",false],["valor_mensal","numeric(15,2)",true],["dia_vencimento","integer",true],["status","public.status_assinatura",true],["data_inicio","date",true],["data_cancelamento","date",false],["conta_caixa_id","integer",false],["observacoes","text",false],["createdAt","timestamp with time zone",true],["updatedAt","timestamp with time zone",true],["user_id","integer",false]]'::jsonb THEN RAISE EXCEPTION '0042 shape físico assinaturas desconhecido; sem adaptação automática' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) INTO actual FROM pg_attribute WHERE attrelid='public.pagamentos_assinatura'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM '[["id","integer",true],["assinatura_id","integer",true],["cliente_id","integer",true],["valor_pago","numeric(15,2)",true],["data_pagamento","timestamp with time zone",true],["mes_referencia","character varying(7)",true],["conta_caixa_id","integer",false],["observacoes","text",false],["createdAt","timestamp with time zone",true],["user_id","integer",false]]'::jsonb THEN RAISE EXCEPTION '0042 shape físico pagamentos desconhecido; sem adaptação automática' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM public.assinaturas WHERE user_id IS NULL) OR EXISTS(SELECT 1 FROM public.pagamentos_assinatura WHERE user_id IS NULL) THEN RAISE EXCEPTION '0042 tenant histórico ausente; sem saneamento automático' USING ERRCODE='55000'; END IF;
END $gate42$;
DO $before42$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"ciclo_guardar","args":"","hash":"d40a30f43cdbae47bcd27812de3175b01539b2ed360b19be86a7974f8f8727e9","config":["search_path=pg_catalog, pg_temp"]},{"name":"legados_guardar","args":"","hash":"5818a775640688d4a2c8a7b6fadd6a047fe1e0da2d547878cb48fabac6f9af77","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_guardar","args":"","hash":"8a484aeb9bb78d5db0e00d13f99e56aed6e37b294320c7c1a1622093a9fb8e1b","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multa36_guardar","args":"","hash":"70014a8fd2058ec639d50fa9ade00cb0b2e6516a14eda0342f61dabadc4a1511","config":["search_path=pg_catalog, pg_temp"]},{"name":"multa36_ponte","args":"","hash":"0892fca052994e24430660475289fbd68770b26cbd9d78929737808de6588115","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ponte","args":"","hash":"bf34137a66e3d0a386bb26cca029e76f0c78afcd26eec1832dc76bc4495f18a6","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ledger","args":"","hash":"a2419786ddb4b9a78b24a986a6d355938feb6229aa3a3f10aa5b2d7c05597109","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_perna_comprovada","args":"integer, integer","hash":"fcbb11adce36b61817315d478ad42579d6687f888d34f6217a2aab75823af079","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '0042 predecessor overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION '0042 predecessor fonte/config/ACL/owner divergente' USING ERRCODE='55000'; END IF;
 END LOOP; END $before42$;
CREATE TEMP TABLE assinaturas42_witness ON COMMIT DROP AS SELECT oid,to_jsonb(p) snapshot,pg_get_functiondef(oid) definition FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f' AND proname NOT IN('ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','caixa37_ponte','caixa37_ledger','caixa37_perna_comprovada');
ALTER TABLE public.assinaturas ADD COLUMN vigencia_pago_ate date;
CREATE TABLE public.assinaturas42_operacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id integer NOT NULL REFERENCES public.users(id),
 chave uuid NOT NULL, request jsonb NOT NULL, hash_request text NOT NULL,
 assinatura_id integer NOT NULL REFERENCES public.assinaturas(id), cliente_id integer NOT NULL REFERENCES public.clientes(id),
 conta_id integer NOT NULL REFERENCES public.contas_caixa(id), saldo_base numeric(15,2) NOT NULL,
 pagamento_id integer UNIQUE REFERENCES public.pagamentos_assinatura(id) DEFERRABLE INITIALLY DEFERRED,
 transacao_id integer UNIQUE REFERENCES public.transacoes_caixa(id) DEFERRABLE INITIALLY DEFERRED,
 pagamento jsonb, ledger jsonb, assinatura_antes jsonb NOT NULL, assinatura_depois jsonb,
 resultado jsonb, instante timestamptz NOT NULL,
 UNIQUE(user_id,chave), UNIQUE(assinatura_id, chave),
 CHECK(hash_request ~ '^[0-9a-f]{64}$'),
 CHECK ((resultado IS NULL AND assinatura_depois IS NULL) OR
 (resultado IS NOT NULL AND assinatura_depois IS NOT NULL AND pagamento_id IS NOT NULL AND transacao_id IS NOT NULL AND pagamento IS NOT NULL AND ledger IS NOT NULL))
);
CREATE UNIQUE INDEX assinaturas42_competencia ON public.assinaturas42_operacoes(assinatura_id,(request->>'mesReferencia'));
CREATE TABLE public.assinaturas42_capacidades (
 xid bigint NOT NULL, pid integer NOT NULL, operacao_id uuid NOT NULL REFERENCES public.assinaturas42_operacoes(id),
 guarda text NOT NULL, tabela text NOT NULL, evento text NOT NULL CHECK(evento IN('INSERT','UPDATE')),
 anterior jsonb, posterior jsonb NOT NULL, PRIMARY KEY(xid,pid,guarda,tabela)
);
CREATE FUNCTION public.assinaturas42_consumir(g text,t text,e text,a jsonb,b jsonb) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE ok boolean;
BEGIN
 DELETE FROM public.assinaturas42_capacidades cap USING public.assinaturas42_operacoes op
 WHERE cap.xid=txid_current() AND cap.pid=pg_backend_pid() AND cap.guarda=g AND cap.tabela=t AND cap.evento=e
 AND cap.anterior IS NOT DISTINCT FROM a AND cap.posterior=b AND cap.operacao_id=op.id
 AND op.resultado IS NULL AND pg_xact_status(op.xmin::text::xid8)='in progress' AND pg_xact_status(cap.xmin::text::xid8)='in progress'
 AND op.hash_request=encode(extensions.digest(op.request::text,'sha256'),'hex')
 AND ((t='transacoes_caixa' AND e='INSERT' AND a IS NULL AND b=op.ledger)
 OR (g='assinaturas42_guardar' AND t='pagamentos_assinatura' AND e='INSERT' AND a IS NULL AND b=op.pagamento)
 OR (g='assinaturas42_guardar' AND t='assinaturas' AND e='UPDATE' AND a=op.assinatura_antes
 AND b-'status'-'vigencia_pago_ate'-'updatedAt'=a-'status'-'vigencia_pago_ate'-'updatedAt'
 AND b->>'status'='ativa' AND (b->>'vigencia_pago_ate')::date=greatest((a->>'vigencia_pago_ate')::date,((op.request->>'mesReferencia')||'-01')::date+interval '1 month'-interval '1 day')::date
 AND b->'updatedAt'=to_jsonb(op.instante))) RETURNING true INTO ok;
 RETURN coalesce(ok,false);
END $$;
CREATE FUNCTION public.assinaturas42_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a jsonb; b jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN a:=to_jsonb(OLD); END IF; IF TG_OP<>'DELETE' THEN b:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='pagamentos_assinatura' THEN
  IF public.assinaturas42_consumir('assinaturas42_guardar',TG_TABLE_NAME,TG_OP,a,b) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Recebimento somente RPC42; histórico imutável' USING ERRCODE='42501';
 ELSIF TG_TABLE_NAME='transacoes_caixa' THEN
  IF TG_OP='INSERT' AND b->>'categoria'='pagamento_assinatura' THEN
   IF public.assinaturas42_consumir('assinaturas42_guardar',TG_TABLE_NAME,TG_OP,a,b) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Entrada assinatura exige intenção42 exata' USING ERRCODE='42501';
  END IF;
  IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.assinaturas42_operacoes WHERE transacao_id=(a->>'id')::int) THEN
   RAISE EXCEPTION 'Livro assinatura append-only; estorno exige compensação auditada' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='assinaturas' THEN
  IF TG_OP='UPDATE' AND a->'vigencia_pago_ate' IS DISTINCT FROM b->'vigencia_pago_ate' THEN
   IF public.assinaturas42_consumir('assinaturas42_guardar',TG_TABLE_NAME,TG_OP,a,b) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Vigência paga exige recebimento42' USING ERRCODE='42501'; END IF;
  -- Consome também o update de uma competência mais antiga que não avança a vigência.
  IF TG_OP='UPDATE' AND public.assinaturas42_consumir('assinaturas42_guardar',TG_TABLE_NAME,TG_OP,a,b) THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.assinaturas42_operacoes WHERE assinatura_id=(a->>'id')::int) AND
   (TG_OP='DELETE' OR a->'id' IS DISTINCT FROM b->'id' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR a->'cliente_id' IS DISTINCT FROM b->'cliente_id') THEN
   RAISE EXCEPTION 'Identidade assinatura recebida imutável' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='clientes' THEN
  IF EXISTS(SELECT 1 FROM public.assinaturas42_operacoes WHERE cliente_id=(a->>'id')::int) AND
   (TG_OP='DELETE' OR a->'id' IS DISTINCT FROM b->'id' OR a->'user_id' IS DISTINCT FROM b->'user_id') THEN
   RAISE EXCEPTION 'Owner cliente recebido imutável' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='contas_caixa' THEN
  IF EXISTS(SELECT 1 FROM public.assinaturas42_operacoes WHERE conta_id=(a->>'id')::int) AND
   (TG_OP='DELETE' OR a->'id' IS DISTINCT FROM b->'id' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR a->'saldo' IS DISTINCT FROM b->'saldo') THEN
   RAISE EXCEPTION 'Owner/base conta recebida imutável' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION public.assinaturas42_validar(oid42 uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op public.assinaturas42_operacoes%ROWTYPE; atual jsonb;
BEGIN
 SELECT o.id,o.user_id,o.chave,o.request,o.hash_request,o.assinatura_id,o.cliente_id,o.conta_id,o.saldo_base,o.pagamento_id,o.transacao_id,o.pagamento,o.ledger,o.assinatura_antes,o.assinatura_depois,o.resultado,o.instante INTO op FROM public.assinaturas42_operacoes o WHERE o.id=oid42;
 IF op.id IS NULL OR op.resultado IS NULL OR op.hash_request IS DISTINCT FROM encode(extensions.digest(op.request::text,'sha256'),'hex')
 OR NOT EXISTS(SELECT 1 FROM public.assinaturas a JOIN public.clientes cl ON cl.id=a.cliente_id WHERE a.id=op.assinatura_id AND a.user_id=op.user_id AND cl.user_id=op.user_id AND cl.id=op.cliente_id)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=op.conta_id AND user_id=op.user_id AND saldo=op.saldo_base)
 OR op.resultado IS DISTINCT FROM jsonb_build_object('success',true,'regra','assinaturas42_v1','repetida',false,'operationId',op.id,'idempotencyKey',op.chave,
 'assinaturaId',op.assinatura_id,'clienteId',op.cliente_id,'contaCaixaId',op.conta_id,'pagamentoId',op.pagamento_id::text,'transacaoCaixaId',op.transacao_id::text,
 'valorPago',op.request->'valorPago','mesReferencia',op.request->'mesReferencia','vigenciaAte',op.assinatura_depois->'vigencia_pago_ate','status','ativa')
 THEN RAISE EXCEPTION 'Prova42 inválida' USING ERRCODE='23514'; END IF;
 SELECT to_jsonb(p) INTO atual FROM public.pagamentos_assinatura p WHERE p.id=op.pagamento_id;
 IF atual IS DISTINCT FROM op.pagamento OR atual->>'user_id' IS DISTINCT FROM op.user_id::text OR atual->>'assinatura_id' IS DISTINCT FROM op.assinatura_id::text
 OR atual->>'cliente_id' IS DISTINCT FROM op.cliente_id::text OR atual->>'conta_caixa_id' IS DISTINCT FROM op.conta_id::text
 OR (atual->>'valor_pago')::numeric IS DISTINCT FROM (op.request->>'valorPago')::numeric OR atual->'mes_referencia' IS DISTINCT FROM op.request->'mesReferencia'
 OR atual->'observacoes' IS DISTINCT FROM op.request->'observacoes' OR atual->'data_pagamento' IS DISTINCT FROM to_jsonb(op.instante)
 THEN RAISE EXCEPTION 'Pagamento42 divergente' USING ERRCODE='23514'; END IF;
 SELECT to_jsonb(t) INTO atual FROM public.transacoes_caixa t WHERE t.id=op.transacao_id;
 IF atual IS DISTINCT FROM op.ledger OR atual->>'user_id' IS DISTINCT FROM op.user_id::text OR atual->>'conta_caixa_id' IS DISTINCT FROM op.conta_id::text
 OR atual->>'tipo' IS DISTINCT FROM 'entrada' OR atual->>'categoria' IS DISTINCT FROM 'pagamento_assinatura'
 OR atual->'contrato_id' IS DISTINCT FROM 'null'::jsonb OR atual->'parcela_id' IS DISTINCT FROM 'null'::jsonb
 OR atual->>'descricao' IS DISTINCT FROM 'Recebimento assinatura42 '||op.id::text||' pagamento #'||op.pagamento_id::text
 OR (atual->>'valor')::numeric IS DISTINCT FROM (op.request->>'valorPago')::numeric
 OR (atual->>'data_transacao')::date IS DISTINCT FROM (op.instante AT TIME ZONE 'America/Sao_Paulo')::date
 THEN RAISE EXCEPTION 'Ledger42 divergente' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.assinaturas42_capacidades WHERE operacao_id=op.id) THEN RAISE EXCEPTION 'Capacidade42 residual' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION public.assinaturas42_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.resultado IS NULL AND pg_xact_status(OLD.xmin::text::xid8)='in progress'
 AND (to_jsonb(OLD)-ARRAY['pagamento_id','transacao_id','pagamento','ledger','assinatura_depois','resultado'])=(to_jsonb(NEW)-ARRAY['pagamento_id','transacao_id','pagamento','ledger','assinatura_depois','resultado']) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Prova42 imutável' USING ERRCODE='42501';
END $$;
CREATE FUNCTION public.assinaturas42_completar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='assinaturas42_operacoes' THEN PERFORM public.assinaturas42_validar(NEW.id); ELSE PERFORM public.assinaturas42_validar(NEW.operacao_id); END IF; RETURN NULL;
END $$;
CREATE FUNCTION public.rpc_receber_assinatura42(p_user_id integer,p_chave uuid,p_assinatura_id integer,p_cliente_id integer,p_conta_id integer,p_valor text,p_mes text,p_observacoes text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE req jsonb; op public.assinaturas42_operacoes%ROWTYPE; a public.assinaturas%ROWTYPE;
 pay public.pagamentos_assinatura%ROWTYPE; ledger42 public.transacoes_caixa%ROWTYPE;
 antes jsonb; depois jsonb; result42 jsonb; instante42 timestamptz:=clock_timestamp(); base numeric; g text;
BEGIN
 PERFORM public.caixa37_verificar();
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave IS NULL OR p_assinatura_id IS NULL OR p_assinatura_id<=0 OR p_cliente_id IS NULL OR p_cliente_id<=0 OR p_conta_id IS NULL OR p_conta_id<=0
 OR (p_valor ~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$') IS DISTINCT FROM true OR p_valor::numeric<=0
 OR (p_mes ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$') IS DISTINCT FROM true OR length(p_observacoes)>2000 THEN
 RAISE EXCEPTION 'Intenção42 inválida' USING ERRCODE='22023'; END IF;
 req:=jsonb_build_object('assinaturaId',p_assinatura_id,'clienteId',p_cliente_id,'contaCaixaId',p_conta_id,'valorPago',p_valor,'mesReferencia',p_mes,'observacoes',p_observacoes);
 PERFORM pg_advisory_xact_lock(hashtextextended('assinaturas42:'||p_user_id::text||':'||p_chave::text,42));
 SELECT o.id,o.user_id,o.chave,o.request,o.hash_request,o.assinatura_id,o.cliente_id,o.conta_id,o.saldo_base,o.pagamento_id,o.transacao_id,o.pagamento,o.ledger,o.assinatura_antes,o.assinatura_depois,o.resultado,o.instante INTO op FROM public.assinaturas42_operacoes o WHERE o.user_id=p_user_id AND o.chave=p_chave;
 IF FOUND THEN
  IF op.request IS DISTINCT FROM req THEN RAISE EXCEPTION 'UUID42 outra intenção' USING ERRCODE='23505'; END IF;
  PERFORM public.assinaturas42_validar(op.id); RETURN op.resultado||jsonb_build_object('repetida',true);
 END IF;
 -- Mesmos locks cooperativos37: contas ordenadas + owner; contrato/parcela não são alterados.
 -- Abrange todas as entidades do owner e valida o livro inteiro antes da entrada.
 PERFORM public.caixa37_travar(p_user_id);
 PERFORM 1 FROM public.clientes WHERE id=p_cliente_id FOR NO KEY UPDATE NOWAIT;
 PERFORM 1 FROM public.assinaturas WHERE id=p_assinatura_id FOR NO KEY UPDATE NOWAIT;
 SELECT a0.id,a0.cliente_id,a0.servico,a0.descricao,a0.valor_mensal,a0.dia_vencimento,a0.status,a0.data_inicio,a0.data_cancelamento,a0.conta_caixa_id,a0.observacoes,a0."createdAt",a0."updatedAt",a0.user_id,a0.vigencia_pago_ate INTO a FROM public.assinaturas a0 WHERE a0.id=p_assinatura_id;
 IF a.id IS NULL OR a.user_id IS DISTINCT FROM p_user_id OR a.cliente_id IS DISTINCT FROM p_cliente_id
 OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=p_cliente_id AND user_id=p_user_id)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=p_conta_id AND user_id=p_user_id AND ativo IS TRUE)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=a.conta_caixa_id AND user_id=p_user_id AND ativo IS TRUE) THEN
 RAISE EXCEPTION 'Vínculo42 indisponível' USING ERRCODE='42501'; END IF;
 IF a.status::text NOT IN('ativa','inadimplente') OR a.valor_mensal IS DISTINCT FROM p_valor::numeric
 OR a.data_inicio IS NULL OR NOT isfinite(a.data_inicio) OR p_mes<to_char(a.data_inicio,'YYYY-MM') THEN RAISE EXCEPTION 'Competência/valor/status42 inválido' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.pagamentos_assinatura WHERE assinatura_id=a.id AND mes_referencia=p_mes) THEN RAISE EXCEPTION 'Competência42 já recebida' USING ERRCODE='23505'; END IF;
 PERFORM public.caixa37_validar_livro(p_user_id);
 SELECT saldo INTO base FROM public.contas_caixa WHERE id=p_conta_id;
 antes:=to_jsonb(a);
 INSERT INTO public.assinaturas42_operacoes(user_id,chave,request,hash_request,assinatura_id,cliente_id,conta_id,saldo_base,assinatura_antes,instante)
 VALUES(p_user_id,p_chave,req,encode(extensions.digest(req::text,'sha256'),'hex'),a.id,p_cliente_id,p_conta_id,base,antes,instante42)
 RETURNING id,user_id,chave,request,hash_request,assinatura_id,cliente_id,conta_id,saldo_base,pagamento_id,transacao_id,pagamento,ledger,assinatura_antes,assinatura_depois,resultado,instante INTO op;
 pay.id:=nextval(pg_get_serial_sequence('public.pagamentos_assinatura','id')); pay.user_id:=p_user_id;pay.assinatura_id:=a.id;pay.cliente_id:=p_cliente_id;pay.valor_pago:=p_valor::numeric;
 pay.mes_referencia:=p_mes;pay.conta_caixa_id:=p_conta_id;pay.observacoes:=p_observacoes;pay.data_pagamento:=instante42;pay."createdAt":=instante42;
 ledger42.id:=nextval(pg_get_serial_sequence('public.transacoes_caixa','id'));ledger42.user_id:=p_user_id;ledger42.conta_caixa_id:=p_conta_id;
 ledger42.tipo:='entrada';ledger42.categoria:='pagamento_assinatura';ledger42.valor:=p_valor::numeric;
 ledger42.descricao:='Recebimento assinatura42 '||op.id::text||' pagamento #'||pay.id::text;
 ledger42.data_transacao:=(instante42 AT TIME ZONE 'America/Sao_Paulo')::date;ledger42."createdAt":=instante42;
 UPDATE public.assinaturas42_operacoes SET pagamento_id=pay.id,transacao_id=ledger42.id,pagamento=to_jsonb(pay),ledger=to_jsonb(ledger42) WHERE id=op.id;
 INSERT INTO public.assinaturas42_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'assinaturas42_guardar','pagamentos_assinatura','INSERT',NULL,to_jsonb(pay));
 INSERT INTO public.pagamentos_assinatura(id,user_id,assinatura_id,cliente_id,valor_pago,data_pagamento,mes_referencia,conta_caixa_id,observacoes,"createdAt")
 VALUES(pay.id,pay.user_id,pay.assinatura_id,pay.cliente_id,pay.valor_pago,pay.data_pagamento,pay.mes_referencia,pay.conta_caixa_id,pay.observacoes,pay."createdAt");
 FOREACH g IN ARRAY ARRAY['assinaturas42_guardar','a_legados_protocolo_transacoes_caixa','a0_multa36_ponte','a1_caixa37_ponte','ciclo_ledger','multa36_guard_transacoes_caixa','multimodal_ledger','z_caixa37_ledger'] LOOP
 INSERT INTO public.assinaturas42_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,g,'transacoes_caixa','INSERT',NULL,to_jsonb(ledger42)); END LOOP;
 INSERT INTO public.transacoes_caixa(id,user_id,conta_caixa_id,tipo,categoria,descricao,valor,data_transacao,contrato_id,parcela_id,"createdAt")
 VALUES(ledger42.id,ledger42.user_id,ledger42.conta_caixa_id,ledger42.tipo,ledger42.categoria,ledger42.descricao,ledger42.valor,ledger42.data_transacao,NULL,NULL,ledger42."createdAt");
 a.status:='ativa';a.vigencia_pago_ate:=greatest(a.vigencia_pago_ate,((p_mes||'-01')::date+interval '1 month'-interval '1 day')::date);a."updatedAt":=instante42;depois:=to_jsonb(a);
 INSERT INTO public.assinaturas42_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'assinaturas42_guardar','assinaturas','UPDATE',antes,depois);
 UPDATE public.assinaturas SET status=a.status,vigencia_pago_ate=a.vigencia_pago_ate,"updatedAt"=a."updatedAt" WHERE id=a.id;
 IF (SELECT to_jsonb(a0) FROM public.assinaturas a0 WHERE a0.id=a.id) IS DISTINCT FROM depois THEN RAISE EXCEPTION 'Delta42 inesperado' USING ERRCODE='23514'; END IF;
 result42:=jsonb_build_object('success',true,'regra','assinaturas42_v1','repetida',false,'operationId',op.id,'idempotencyKey',p_chave,
 'assinaturaId',a.id,'clienteId',p_cliente_id,'contaCaixaId',p_conta_id,'pagamentoId',pay.id::text,'transacaoCaixaId',ledger42.id::text,
 'valorPago',p_valor,'mesReferencia',p_mes,'vigenciaAte',a.vigencia_pago_ate,'status','ativa');
 UPDATE public.assinaturas42_operacoes SET assinatura_depois=depois,resultado=result42 WHERE id=op.id;
 PERFORM public.assinaturas42_validar(op.id); RETURN result42;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Vínculo42 concorrente' USING ERRCODE='40001';
END $$;
CREATE TRIGGER assinaturas42_payment BEFORE INSERT OR UPDATE OR DELETE ON public.pagamentos_assinatura FOR EACH ROW EXECUTE FUNCTION public.assinaturas42_guardar();
CREATE TRIGGER a00_assinaturas42_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.transacoes_caixa FOR EACH ROW EXECUTE FUNCTION public.assinaturas42_guardar();
CREATE TRIGGER assinaturas42_subscription BEFORE UPDATE OR DELETE ON public.assinaturas FOR EACH ROW EXECUTE FUNCTION public.assinaturas42_guardar();
CREATE TRIGGER assinaturas42_client BEFORE UPDATE OR DELETE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.assinaturas42_guardar();
CREATE TRIGGER assinaturas42_account BEFORE UPDATE OR DELETE ON public.contas_caixa FOR EACH ROW EXECUTE FUNCTION public.assinaturas42_guardar();
CREATE TRIGGER assinaturas42_immutable BEFORE UPDATE OR DELETE ON public.assinaturas42_operacoes FOR EACH ROW EXECUTE FUNCTION public.assinaturas42_imutavel();
CREATE CONSTRAINT TRIGGER assinaturas42_complete AFTER INSERT OR UPDATE ON public.assinaturas42_operacoes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assinaturas42_completar();
CREATE CONSTRAINT TRIGGER assinaturas42_complete AFTER INSERT ON public.assinaturas42_capacidades DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assinaturas42_completar();
ALTER TABLE public.assinaturas42_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas42_capacidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assinaturas42_operacoes,public.assinaturas42_capacidades FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.assinaturas42_consumir(text,text,text,jsonb,jsonb),public.assinaturas42_guardar(),public.assinaturas42_validar(uuid),public.assinaturas42_imutavel(),public.assinaturas42_completar(),public.rpc_receber_assinatura42(integer,uuid,integer,integer,integer,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_receber_assinatura42(integer,uuid,integer,integer,integer,text,text,text) TO service_role;

-- BEGIN PONTE42 EXATA
CREATE OR REPLACE FUNCTION public.ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oldj jsonb; newj jsonb; cid integer; aid integer; protegido boolean; autorizado boolean; despesa_autorizada boolean;
BEGIN
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
 IF NOT FOUND THEN RETURN false; END IF; PERFORM public.assinaturas42_validar(oid37); RETURN true; END IF; PERFORM public.caixa37_validar_op(oid37); RETURN true;
END $$;
-- END PONTE42
DO $after42$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"ciclo_guardar","args":"","hash":"2f3fe701ead0b295f918bd768ba0df44d345d8d906030e4e494df9cfe9bfd2e9","config":["search_path=pg_catalog, pg_temp"]},{"name":"legados_guardar","args":"","hash":"122ec38128421f9687b4abe0f78d776e4e06b885fe795463b020498beb4db1d1","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_guardar","args":"","hash":"9a65fbcf387c22bc06253c1e445ec300fbba74dcbae5c17869a798dbb1b5064d","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multa36_guardar","args":"","hash":"8e4624de5ee678923c2ec07916381bf8121363e69221c2b816aa173d1b8a2223","config":["search_path=pg_catalog, pg_temp"]},{"name":"multa36_ponte","args":"","hash":"95a9c01b2f6ea9cf9c6b79525c4ab17bf519ac4f447aa7937600623c00687f98","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ponte","args":"","hash":"f56ab7b8f26b2caecb00d525374a16d6665316130b5508300f4a11860e736bb3","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ledger","args":"","hash":"0cc20d9f80098bfd377dc0ec3d344562c6d6e7f6644b92621dca5a527f8942f9","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_perna_comprovada","args":"integer, integer","hash":"5bd70c44eec12e5e6c3c52c94d41d292d3ae132c5ba16b40d7c119c84a844e3d","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '0042 predecessor overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION '0042 predecessor fonte/config/ACL/owner divergente' USING ERRCODE='55000'; END IF;
 END LOOP; END $after42$;
DO $post42$ DECLARE w record; BEGIN
 FOR w IN SELECT oid,snapshot,definition FROM assinaturas42_witness LOOP
 IF (SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid=w.oid) IS DISTINCT FROM w.snapshot OR pg_get_functiondef(w.oid) IS DISTINCT FROM w.definition THEN RAISE EXCEPTION '0042 função fora da ponte alterada' USING ERRCODE='55000'; END IF; END LOOP;
END $post42$;
-- Atualização controlada de selos, só após verificar original e delta de fontes exato.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
DO $verify42$ BEGIN PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar(); END $verify42$;
COMMIT;
