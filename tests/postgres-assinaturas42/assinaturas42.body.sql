-- Fence não referencia assinatura/conta: até uma intenção recusada por vínculo pode ser fechada.
CREATE TABLE public.assinaturas42_fences (
 user_id integer NOT NULL REFERENCES public.users(id), chave uuid NOT NULL,
 request jsonb NOT NULL, hash_request text NOT NULL,
 fechado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,chave), CHECK(hash_request=encode(extensions.digest(request::text,'sha256'),'hex'))
);
CREATE FUNCTION public.assinaturas42_fence_imutavel() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Fence42 fechado imutável' USING ERRCODE='42501'; END $$;
CREATE TRIGGER assinaturas42_fence_immutable BEFORE UPDATE OR DELETE ON public.assinaturas42_fences FOR EACH ROW EXECUTE FUNCTION public.assinaturas42_fence_imutavel();
ALTER TABLE public.assinaturas42_fences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assinaturas42_fences FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.assinaturas42_request(p_user_id integer,p_chave uuid,p_assinatura_id integer,p_cliente_id integer,p_conta_id integer,p_valor text,p_mes text,p_observacoes text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE req jsonb;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave IS NULL OR p_assinatura_id IS NULL OR p_assinatura_id<=0 OR p_cliente_id IS NULL OR p_cliente_id<=0 OR p_conta_id IS NULL OR p_conta_id<=0
 OR (p_valor ~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$') IS DISTINCT FROM true OR p_valor::numeric<=0
 OR (p_mes ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$') IS DISTINCT FROM true OR length(p_observacoes)>2000 THEN
 RAISE EXCEPTION 'Intenção42 inválida' USING ERRCODE='22023'; END IF;
 req:=jsonb_build_object('assinaturaId',p_assinatura_id,'clienteId',p_cliente_id,'contaCaixaId',p_conta_id,'valorPago',p_valor,'mesReferencia',p_mes,'observacoes',p_observacoes);
 RETURN req;
END $$;
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
 req:=public.assinaturas42_request(p_user_id,p_chave,p_assinatura_id,p_cliente_id,p_conta_id,p_valor,p_mes,p_observacoes);
 PERFORM pg_advisory_xact_lock(hashtextextended('assinaturas42:'||p_user_id::text||':'||p_chave::text,42));
 SELECT o.id,o.user_id,o.chave,o.request,o.hash_request,o.assinatura_id,o.cliente_id,o.conta_id,o.saldo_base,o.pagamento_id,o.transacao_id,o.pagamento,o.ledger,o.assinatura_antes,o.assinatura_depois,o.resultado,o.instante INTO op FROM public.assinaturas42_operacoes o WHERE o.user_id=p_user_id AND o.chave=p_chave;
 IF FOUND THEN
  IF op.request IS DISTINCT FROM req THEN RAISE EXCEPTION 'UUID42 outra intenção' USING ERRCODE='23505'; END IF;
  PERFORM public.assinaturas42_validar(op.id); RETURN op.resultado||jsonb_build_object('repetida',true);
 END IF;
 -- Mesmo lock UUID da conferência: uma intenção fechada jamais chega ao writer financeiro.
 IF EXISTS(SELECT 1 FROM public.assinaturas42_fences WHERE user_id=p_user_id AND chave=p_chave) THEN
  IF EXISTS(SELECT 1 FROM public.assinaturas42_fences WHERE user_id=p_user_id AND chave=p_chave AND request IS DISTINCT FROM req) THEN
   RAISE EXCEPTION 'UUID42 outra intenção fenced' USING ERRCODE='23505'; END IF;
  RAISE EXCEPTION 'Intenção42 fechada por fence durável; não executar' USING ERRCODE='23514';
 END IF;
 -- Locks cooperativos37: conta recebedora e seus vínculos exatos; não tocar contas alheias à operação.
 PERFORM public.assinaturas42_travar_conta(p_user_id,p_conta_id);
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
 PERFORM public.assinaturas42_validar_conta(p_user_id,p_conta_id);
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

CREATE FUNCTION public.rpc_conferir_assinatura42(p_user_id integer,p_chave uuid,p_assinatura_id integer,p_cliente_id integer,p_conta_id integer,p_valor text,p_mes text,p_observacoes text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE req jsonb; op public.assinaturas42_operacoes%ROWTYPE; f public.assinaturas42_fences%ROWTYPE;
BEGIN
 PERFORM public.caixa37_verificar();
 req:=public.assinaturas42_request(p_user_id,p_chave,p_assinatura_id,p_cliente_id,p_conta_id,p_valor,p_mes,p_observacoes);
 -- EXATAMENTE o mesmo advisory lock UUID do writer; espera commit/rollback antes de provar ausência.
 PERFORM pg_advisory_xact_lock(hashtextextended('assinaturas42:'||p_user_id::text||':'||p_chave::text,42));
 SELECT o.id,o.user_id,o.chave,o.request,o.hash_request,o.assinatura_id,o.cliente_id,o.conta_id,o.saldo_base,o.pagamento_id,o.transacao_id,o.pagamento,o.ledger,o.assinatura_antes,o.assinatura_depois,o.resultado,o.instante INTO op FROM public.assinaturas42_operacoes o WHERE o.user_id=p_user_id AND o.chave=p_chave;
 IF FOUND THEN
  IF op.request IS DISTINCT FROM req THEN RAISE EXCEPTION 'UUID42 outra intenção' USING ERRCODE='23505'; END IF;
  PERFORM public.assinaturas42_validar(op.id);
  RETURN jsonb_build_object('estado','confirmed','regra','assinaturas42_fence_v1','resultado',op.resultado||jsonb_build_object('repetida',true));
 END IF;
 SELECT user_id,chave,request,hash_request,fechado_em INTO f FROM public.assinaturas42_fences WHERE user_id=p_user_id AND chave=p_chave;
 IF FOUND THEN
  IF f.request IS DISTINCT FROM req THEN RAISE EXCEPTION 'UUID42 outra intenção fenced' USING ERRCODE='23505'; END IF;
 ELSE
  INSERT INTO public.assinaturas42_fences(user_id,chave,request,hash_request)
  VALUES(p_user_id,p_chave,req,encode(extensions.digest(req::text,'sha256'),'hex'));
 END IF;
 RETURN jsonb_build_object('estado','fenced','regra','assinaturas42_fence_v1','idempotencyKey',p_chave,'request',req);
END $$;
REVOKE ALL ON FUNCTION public.assinaturas42_request(integer,uuid,integer,integer,integer,text,text,text),public.assinaturas42_fence_imutavel(),public.rpc_conferir_assinatura42(integer,uuid,integer,integer,integer,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_conferir_assinatura42(integer,uuid,integer,integer,integer,text,text,text) TO service_role;
