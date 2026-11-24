-- Uma coluna nullable; nenhum UPDATE/backfill do histórico.
ALTER TABLE public.cheques ADD COLUMN cheques40_meta jsonb;
CREATE TABLE public.cheques40_contas(
 conta_id integer PRIMARY KEY REFERENCES public.contas_caixa(id) ON DELETE RESTRICT,
 user_id integer NOT NULL REFERENCES public.users(id),saldo_base numeric(15,2) NOT NULL);
CREATE TABLE public.cheques40_origens(
 cheque_id integer PRIMARY KEY REFERENCES public.cheques(id) ON DELETE RESTRICT,
 user_id integer NOT NULL REFERENCES public.users(id),cliente_id integer NOT NULL REFERENCES public.clientes(id),
 conta_id integer NOT NULL REFERENCES public.cheques40_contas(conta_id),snapshot jsonb NOT NULL,
 saida_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id),saida_snapshot jsonb NOT NULL);
CREATE TABLE public.cheques40_operacoes(
 user_id integer NOT NULL REFERENCES public.users(id),chave uuid NOT NULL,operacao_id uuid NOT NULL UNIQUE,
 request jsonb NOT NULL,hash_request text NOT NULL,resultado jsonb,auditoria jsonb,
 cheque_id integer NOT NULL REFERENCES public.cheques(id) DEFERRABLE INITIALLY DEFERRED,
 transacao_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id) DEFERRABLE INITIALLY DEFERRED,
 antes jsonb,depois jsonb NOT NULL,ledger jsonb NOT NULL,saldo_base numeric(15,2) NOT NULL,saldo_antes numeric NOT NULL,
 instante timestamptz NOT NULL,PRIMARY KEY(user_id,chave));
CREATE UNIQUE INDEX cheques40_um_terminal ON public.cheques40_operacoes(cheque_id) WHERE request->>'acao'<>'criar';
CREATE TABLE public.cheques40_capacidades(
 xid bigint NOT NULL,pid integer NOT NULL,operacao_id uuid NOT NULL REFERENCES public.cheques40_operacoes(operacao_id),
 guarda text NOT NULL,tabela text NOT NULL CHECK(tabela IN('cheques','transacoes_caixa')),
 evento text NOT NULL CHECK(evento IN('INSERT','UPDATE')),anterior jsonb,posterior jsonb NOT NULL,
 PRIMARY KEY(xid,pid,guarda,tabela));
CREATE TABLE public.cheques40_ausencias(
 user_id integer NOT NULL REFERENCES public.users(id),chave uuid NOT NULL,request jsonb NOT NULL,
 prova jsonb NOT NULL,instante timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(user_id,chave));
CREATE FUNCTION public.cheques40_consumir(g text,t text,e text,a jsonb,b jsonb) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE ok boolean;
BEGIN
 DELETE FROM public.cheques40_capacidades cap USING public.cheques40_operacoes op
 WHERE cap.xid=txid_current() AND cap.pid=pg_backend_pid() AND cap.guarda=g AND cap.tabela=t AND cap.evento=e
 AND cap.anterior IS NOT DISTINCT FROM a AND cap.posterior=b AND cap.operacao_id=op.operacao_id
 AND op.resultado IS NULL AND pg_xact_status(op.xmin::text::xid8)='in progress' AND pg_xact_status(cap.xmin::text::xid8)='in progress'
 AND op.hash_request=encode(extensions.digest(op.request::text,'sha256'),'hex')
 AND ((t='transacoes_caixa' AND e='INSERT' AND a IS NULL AND b=op.ledger)
 OR (g='cheques40_guardar' AND t='cheques' AND b=op.depois AND a IS NOT DISTINCT FROM op.antes
 AND ((e='INSERT' AND op.request->>'acao'='criar' AND a IS NULL) OR (e='UPDATE' AND op.request->>'acao' IN('compensar','devolver','cancelar') AND a IS NOT NULL))))
 RETURNING true INTO ok;
 RETURN coalesce(ok,false);
END $$;
CREATE FUNCTION public.cheques40_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a jsonb; b jsonb; aid integer;
BEGIN
 IF TG_OP<>'INSERT' THEN a:=to_jsonb(OLD); END IF; IF TG_OP<>'DELETE' THEN b:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='cheques' THEN
  IF public.cheques40_consumir('cheques40_guardar',TG_TABLE_NAME,TG_OP,a,b) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Cheque somente RPC40; sem adoção de legado' USING ERRCODE='42501';
 ELSIF TG_TABLE_NAME='transacoes_caixa' THEN
  IF TG_OP='INSERT' AND b->>'categoria' IN('cheque_desconto40','cheque_compensacao40','cheque_estorno40') THEN
   IF public.cheques40_consumir('cheques40_guardar',TG_TABLE_NAME,TG_OP,a,b) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Ledger40 exige intenção exata' USING ERRCODE='42501';
  END IF;
  IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.cheques40_operacoes WHERE transacao_id=(a->>'id')::int) THEN RAISE EXCEPTION 'Ledger40 append-only' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='contas_caixa' THEN
  aid:=(a->>'id')::int;
  IF NOT pg_try_advisory_xact_lock(22022,aid) THEN RAISE EXCEPTION 'Conta concorrente40' USING ERRCODE='40001'; END IF;
  IF EXISTS(SELECT 1 FROM public.cheques40_contas WHERE conta_id=aid) AND
   (TG_OP='DELETE' OR a->'id' IS DISTINCT FROM b->'id' OR a->'user_id' IS DISTINCT FROM b->'user_id' OR a->'saldo' IS DISTINCT FROM b->'saldo') THEN RAISE EXCEPTION 'Base/owner40 imutáveis' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='clientes' AND EXISTS(SELECT 1 FROM public.cheques40_origens WHERE cliente_id=(a->>'id')::int) AND
  (TG_OP='DELETE' OR a->'id' IS DISTINCT FROM b->'id' OR a->'user_id' IS DISTINCT FROM b->'user_id') THEN RAISE EXCEPTION 'Cliente40 owner imutável' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION public.cheques40_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='cheques40_operacoes' AND TG_OP='UPDATE' THEN
  IF to_jsonb(OLD)->'resultado'='null'::jsonb AND pg_xact_status(OLD.xmin::text::xid8)='in progress'
  AND to_jsonb(OLD)-ARRAY['resultado','auditoria']=to_jsonb(NEW)-ARRAY['resultado','auditoria'] THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Prova40 append-only' USING ERRCODE='42501';
END $$;
CREATE FUNCTION public.cheques40_validar(oid40 uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE o public.cheques40_operacoes%ROWTYPE; orig public.cheques40_origens%ROWTYPE;
 c public.cheques%ROWTYPE; t public.transacoes_caixa%ROWTYPE; atual jsonb; final40 jsonb; acao text; valor numeric; liquido numeric; delta numeric; esperado jsonb;
BEGIN
 SELECT x.* INTO o FROM public.cheques40_operacoes x WHERE x.operacao_id=oid40;
 IF NOT FOUND OR o.resultado IS NULL OR o.hash_request IS DISTINCT FROM encode(extensions.digest(o.request::text,'sha256'),'hex') THEN RAISE EXCEPTION 'Prova40 incompleta' USING ERRCODE='23514'; END IF;
 SELECT x.* INTO orig FROM public.cheques40_origens x WHERE x.cheque_id=o.cheque_id;
 IF NOT FOUND OR orig.user_id IS DISTINCT FROM o.user_id OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=orig.cliente_id AND user_id=o.user_id)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=orig.conta_id AND user_id=o.user_id AND saldo=o.saldo_base)
 OR NOT EXISTS(SELECT 1 FROM public.cheques40_contas WHERE conta_id=orig.conta_id AND user_id=o.user_id AND saldo_base=o.saldo_base)
 THEN RAISE EXCEPTION 'Vínculo/base40 divergente' USING ERRCODE='23514'; END IF;
 c:=jsonb_populate_record(NULL::public.cheques,orig.snapshot); valor:=c.valor_nominal; liquido:=c.valor_liquido; acao:=o.request->>'acao';
 IF c.id IS DISTINCT FROM o.cheque_id OR c.user_id IS DISTINCT FROM o.user_id OR c.cliente_id IS DISTINCT FROM orig.cliente_id OR c.conta_caixa_id IS DISTINCT FROM orig.conta_id
 OR c.status IS DISTINCT FROM 'descontado' OR liquido<=0 OR valor<liquido OR c.valor_descontado IS DISTINCT FROM valor-liquido
 OR NOT EXISTS(SELECT 1 FROM public.transacoes_caixa l WHERE l.id=orig.saida_id AND to_jsonb(l)=orig.saida_snapshot AND l.user_id=o.user_id AND l.conta_caixa_id=orig.conta_id AND l.valor=liquido AND l.tipo='saida' AND l.categoria='cheque_desconto40' AND l.contrato_id IS NULL AND l.parcela_id IS NULL)
 THEN RAISE EXCEPTION 'Origem40 divergente' USING ERRCODE='23514'; END IF;
 SELECT x.depois INTO final40 FROM public.cheques40_operacoes x WHERE x.cheque_id=c.id AND x.request->>'acao'<>'criar';
 final40:=coalesce(final40,orig.snapshot);
 SELECT to_jsonb(ch) INTO atual FROM public.cheques ch WHERE ch.id=c.id;
 IF atual IS DISTINCT FROM final40 THEN RAISE EXCEPTION 'Cheque40 adulterado' USING ERRCODE='23514'; END IF;
 IF acao='criar' THEN
  IF o.antes IS NOT NULL OR o.depois IS DISTINCT FROM orig.snapshot OR o.transacao_id<>orig.saida_id THEN RAISE EXCEPTION 'Cadastro40 divergente' USING ERRCODE='23514'; END IF;
 ELSE
  IF o.antes IS DISTINCT FROM orig.snapshot OR o.depois-ARRAY['status','cheques40_meta','updatedAt'] IS DISTINCT FROM o.antes-ARRAY['status','cheques40_meta','updatedAt']
  OR o.depois->>'status' IS DISTINCT FROM (CASE acao WHEN 'compensar' THEN 'compensado' WHEN 'devolver' THEN 'devolvido' WHEN 'cancelar' THEN 'cancelado' ELSE NULL END)
  THEN RAISE EXCEPTION 'Transição40 divergente' USING ERRCODE='23514'; END IF;
 END IF;
 t.id:=o.transacao_id;t.user_id:=o.user_id;t.conta_caixa_id:=orig.conta_id;t.tipo:=CASE WHEN acao='criar' THEN 'saida' ELSE 'entrada' END;
 t.categoria:=CASE acao WHEN 'criar' THEN 'cheque_desconto40' WHEN 'compensar' THEN 'cheque_compensacao40' ELSE 'cheque_estorno40' END;
 t.valor:=CASE WHEN acao='compensar' THEN valor ELSE liquido END;
 t.descricao:='Cheque40 '||o.operacao_id::text||' '||acao||' #'||c.id::text;t.data_transacao:=(o.instante AT TIME ZONE 'America/Sao_Paulo')::date;t."createdAt":=o.instante;
 SELECT to_jsonb(l) INTO atual FROM public.transacoes_caixa l WHERE l.id=o.transacao_id;
 IF atual IS DISTINCT FROM to_jsonb(t) OR o.ledger IS DISTINCT FROM atual THEN RAISE EXCEPTION 'Ledger40 divergente' USING ERRCODE='23514'; END IF;
 esperado:=jsonb_build_object('success',true,'regra','cheques40_v1','id',c.id,'operationId',o.operacao_id,'idempotencyKey',o.chave,'repetida',false,'valorLiquido',liquido::text,'valorDesconto',(valor-liquido)::text,'status',o.depois->'status','estornadoNoCaixa',acao IN('devolver','cancelar'),'requerConferenciaCaixa',false);
 delta:=CASE WHEN acao='criar' THEN -t.valor ELSE t.valor END;
 IF o.resultado IS DISTINCT FROM esperado OR o.auditoria IS DISTINCT FROM jsonb_build_object('antes',o.antes,'depois',o.depois,'ledger',o.ledger,'compensaTransacaoId',CASE WHEN acao IN('devolver','cancelar') THEN orig.saida_id ELSE NULL END,'saldoAntes',o.saldo_antes::text,'saldoDepois',(o.saldo_antes+delta)::text)
 OR EXISTS(SELECT 1 FROM public.cheques40_capacidades WHERE operacao_id=oid40)
 OR EXISTS(SELECT 1 FROM public.cheques40_ausencias WHERE user_id=o.user_id AND chave=o.chave)
 THEN RAISE EXCEPTION 'Auditoria/capacidade40 divergente' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION public.cheques40_completar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN PERFORM public.cheques40_validar(NEW.operacao_id); RETURN NULL; END $$;
CREATE FUNCTION public.rpc_cheques40(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' SET DateStyle='ISO,YMD' AS $$
DECLARE r jsonb:=p_request; acao text; keys text[]; k text; hj date:=(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
 prev public.cheques40_operacoes%ROWTYPE; origem public.cheques40_origens%ROWTYPE;
 c public.cheques%ROWTYPE; antes jsonb; depois jsonb; t public.transacoes_caixa%ROWTYPE; ts jsonb;
 aid integer; clid integer; saldo numeric; base numeric; valor numeric; liquido numeric; taxa numeric; dias integer; periodo integer;
 op uuid:=gen_random_uuid(); res40 jsonb; instante40 timestamptz:=clock_timestamp(); g text;
BEGIN
 PERFORM public.caixa37_verificar();
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave IS NULL OR jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Intenção40 inválida' USING ERRCODE='22023'; END IF;
 acao:=r->>'acao';
 IF acao='criar' THEN keys:=ARRAY['acao','dataOperacao','clienteId','contaCaixaId','emitente','numeroCheque','banco','agencia','conta','cpfCnpjEmitente','valorNominal','dataVencimento','taxaDesconto','tipoTaxa','observacoes'];
 ELSIF acao IN('compensar','cancelar') THEN keys:=ARRAY['acao','dataOperacao','id'];
 ELSIF acao='devolver' THEN keys:=ARRAY['acao','dataOperacao','id','motivo'];
 ELSE RAISE EXCEPTION 'Ação40 inválida' USING ERRCODE='22023'; END IF;
 IF r-keys<>'{}'::jsonb OR (SELECT count(*) FROM jsonb_object_keys(r))<>cardinality(keys) THEN RAISE EXCEPTION 'Campos40 fechados obrigatórios' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cheques40:'||p_user_id::text||':'||p_chave::text,40));
 SELECT o.* INTO prev FROM public.cheques40_operacoes o WHERE o.user_id=p_user_id AND o.chave=p_chave;
 IF FOUND THEN
  IF prev.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'UUID40 com outro payload' USING ERRCODE='23505'; END IF;
  PERFORM public.cheques40_validar(prev.operacao_id); RETURN prev.resultado||jsonb_build_object('repetida',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.cheques40_ausencias WHERE user_id=p_user_id AND chave=p_chave) THEN RAISE EXCEPTION 'Intenção40 abandonada por fence; jamais executar' USING ERRCODE='23505'; END IF;
 IF jsonb_typeof(r->'dataOperacao') IS DISTINCT FROM 'string' OR (r->>'dataOperacao') IS DISTINCT FROM hj::text THEN RAISE EXCEPTION 'Data da intenção40 expirada; sem execução tardia' USING ERRCODE='22023'; END IF;
 IF acao='criar' THEN
  FOREACH k IN ARRAY ARRAY['clienteId','contaCaixaId'] LOOP
   IF jsonb_typeof(r->k) IS DISTINCT FROM 'number' OR (r->>k) !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'ID40 inválido' USING ERRCODE='22023'; END IF;
  END LOOP;
  aid:=(r->>'contaCaixaId')::int; clid:=(r->>'clienteId')::int;
  IF jsonb_typeof(r->'emitente') IS DISTINCT FROM 'string' OR length(r->>'emitente') NOT BETWEEN 1 AND 255 OR btrim(r->>'emitente')<>r->>'emitente'
   OR jsonb_typeof(r->'numeroCheque') IS DISTINCT FROM 'string' OR length(r->>'numeroCheque') NOT BETWEEN 1 AND 50 OR btrim(r->>'numeroCheque')<>r->>'numeroCheque'
   OR jsonb_typeof(r->'valorNominal') IS DISTINCT FROM 'string' OR (r->>'valorNominal') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' OR (r->>'valorNominal')::numeric<=0
   OR jsonb_typeof(r->'taxaDesconto') IS DISTINCT FROM 'string' OR (r->>'taxaDesconto') !~ '^(0|[1-9][0-9]{0,2})\.[0-9]{2}$' OR (r->>'taxaDesconto')::numeric<=0
   OR jsonb_typeof(r->'dataVencimento') IS DISTINCT FROM 'string' OR (r->>'dataVencimento') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
   OR jsonb_typeof(r->'tipoTaxa') IS DISTINCT FROM 'string' OR r->>'tipoTaxa' NOT IN('diaria','mensal','anual') THEN RAISE EXCEPTION 'Cadastro40 inválido' USING ERRCODE='22023'; END IF;
  FOREACH k IN ARRAY ARRAY['banco','agencia','conta','cpfCnpjEmitente','observacoes'] LOOP
   IF r->k<>'null'::jsonb AND (jsonb_typeof(r->k) IS DISTINCT FROM 'string' OR length(r->>k)<1 OR btrim(r->>k)<>r->>k OR length(r->>k)>CASE k WHEN 'banco' THEN 100 WHEN 'agencia' THEN 20 WHEN 'conta' THEN 30 WHEN 'cpfCnpjEmitente' THEN 20 ELSE 2000 END) THEN RAISE EXCEPTION 'Texto40 inválido' USING ERRCODE='22023'; END IF;
  END LOOP;
  dias:=(r->>'dataVencimento')::date-hj;
  IF dias NOT BETWEEN 0 AND 3660 THEN RAISE EXCEPTION 'Vencimento40 inválido' USING ERRCODE='22023'; END IF;
 ELSE
  IF jsonb_typeof(r->'id') IS DISTINCT FROM 'number' OR (r->>'id') !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'ID40 inválido' USING ERRCODE='22023'; END IF;
  IF acao='devolver' AND (jsonb_typeof(r->'motivo') IS DISTINCT FROM 'string' OR length(r->>'motivo') NOT BETWEEN 1 AND 255 OR btrim(r->>'motivo')<>r->>'motivo') THEN RAISE EXCEPTION 'Motivo40 obrigatório' USING ERRCODE='22023'; END IF;
  SELECT o.* INTO origem FROM public.cheques40_origens o WHERE o.cheque_id=(r->>'id')::int AND o.user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cheque40 não disponível; legado não adotado' USING ERRCODE='42501'; END IF;
  aid:=origem.conta_id; clid:=origem.cliente_id;
 END IF;
 -- Mesmo protocolo37/33: locks ordenados de contas e owner antes de locks de linha.
 PERFORM public.cheques40_travar_conta(p_user_id,aid);
 PERFORM 1 FROM public.users WHERE id=p_user_id FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner40 indisponível' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.contas_caixa WHERE id=aid AND user_id=p_user_id AND ativo IS TRUE FOR UPDATE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conta40 indisponível' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.clientes WHERE id=clid AND user_id=p_user_id AND ativo IS TRUE FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente40 indisponível' USING ERRCODE='42501'; END IF;
 PERFORM public.cheques40_validar_conta(p_user_id,aid);
 SELECT a.saldo,a.saldo+coalesce((SELECT sum(CASE l.tipo WHEN 'entrada' THEN l.valor ELSE -l.valor END) FROM public.transacoes_caixa l WHERE l.conta_caixa_id=aid),0) INTO base,saldo FROM public.contas_caixa a WHERE a.id=aid;
 IF saldo IS NULL OR saldo::text IN('NaN','Infinity','-Infinity') OR saldo<>round(saldo,2) THEN RAISE EXCEPTION 'Saldo40 inválido' USING ERRCODE='23514'; END IF;
 INSERT INTO public.cheques40_contas(conta_id,user_id,saldo_base) VALUES(aid,p_user_id,base) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.cheques40_contas WHERE conta_id=aid AND user_id=p_user_id AND saldo_base=base) THEN RAISE EXCEPTION 'Pin40 divergente' USING ERRCODE='23514'; END IF;
 IF acao='criar' THEN
  valor:=(r->>'valorNominal')::numeric; taxa:=(r->>'taxaDesconto')::numeric;
  periodo:=CASE r->>'tipoTaxa' WHEN 'diaria' THEN 1 WHEN 'mensal' THEN 30 ELSE 365 END;
  liquido:=round(valor/power(1+taxa/100,dias::numeric/periodo),2);
  IF liquido<=0 OR liquido>valor THEN RAISE EXCEPTION 'Líquido40 fora do domínio' USING ERRCODE='22023'; END IF;
  IF saldo<liquido THEN RAISE EXCEPTION 'Saldo40 insuficiente' USING ERRCODE='23514'; END IF;
  c.id:=nextval(pg_get_serial_sequence('public.cheques','id')); c.user_id:=p_user_id;c.cliente_id:=clid;
  c.numero_cheque:=r->>'numeroCheque';c.banco:=r->>'banco';c.agencia:=r->>'agencia';c.conta:=r->>'conta';
  c.valor_nominal:=valor;c.data_emissao:=hj;c.data_vencimento:=(r->>'dataVencimento')::date;c.taxa_desconto:=taxa;
  c.valor_descontado:=valor-liquido;c.valor_liquido:=liquido;c.status:='descontado';c.conta_caixa_id:=aid;
  c.observacoes:=r->>'observacoes';c."createdAt":=instante40;c."updatedAt":=instante40;
  c.cheques40_meta:=jsonb_build_object('emitente',r->'emitente','cpfCnpjEmitente',r->'cpfCnpjEmitente','tipoTaxa',r->'tipoTaxa','dataCompensacao',NULL,'motivoDevolucao',NULL);
 ELSE
  SELECT ch.* INTO c FROM public.cheques ch WHERE ch.id=origem.cheque_id AND ch.user_id=p_user_id FOR UPDATE NOWAIT;
  IF NOT FOUND OR to_jsonb(c) IS DISTINCT FROM origem.snapshot OR c.status<>'descontado' OR c.cliente_id<>clid OR c.conta_caixa_id<>aid THEN RAISE EXCEPTION 'Cheque40 já processado/divergente' USING ERRCODE='23505'; END IF;
  antes:=to_jsonb(c);valor:=c.valor_nominal;liquido:=c.valor_liquido;
  IF acao='compensar' THEN c.status:='compensado';c.cheques40_meta:=c.cheques40_meta||jsonb_build_object('dataCompensacao',instante40);
  ELSIF acao='devolver' THEN c.status:='devolvido';c.cheques40_meta:=c.cheques40_meta||jsonb_build_object('motivoDevolucao',r->'motivo');
  ELSE c.status:='cancelado'; END IF;
  c."updatedAt":=instante40;
 END IF;
 depois:=to_jsonb(c);
 t.id:=nextval(pg_get_serial_sequence('public.transacoes_caixa','id'));t.user_id:=p_user_id;t.conta_caixa_id:=aid;
 t.tipo:=CASE WHEN acao='criar' THEN 'saida' ELSE 'entrada' END;
 t.categoria:=CASE acao WHEN 'criar' THEN 'cheque_desconto40' WHEN 'compensar' THEN 'cheque_compensacao40' ELSE 'cheque_estorno40' END;
 t.valor:=CASE WHEN acao='compensar' THEN valor ELSE liquido END;
 t.descricao:='Cheque40 '||op::text||' '||acao||' #'||c.id::text;t.data_transacao:=hj;t."createdAt":=instante40;ts:=to_jsonb(t);
 INSERT INTO public.cheques40_operacoes(user_id,chave,operacao_id,request,hash_request,cheque_id,transacao_id,antes,depois,ledger,saldo_base,saldo_antes,instante)
 VALUES(p_user_id,p_chave,op,r,encode(extensions.digest(r::text,'sha256'),'hex'),c.id,t.id,antes,depois,ts,base,saldo,instante40);
 INSERT INTO public.cheques40_capacidades VALUES(txid_current(),pg_backend_pid(),op,'cheques40_guardar','cheques',CASE WHEN acao='criar' THEN 'INSERT' ELSE 'UPDATE' END,antes,depois);
 IF acao='criar' THEN
  INSERT INTO public.cheques SELECT (c).*;
 ELSE
  UPDATE public.cheques SET status=c.status,cheques40_meta=c.cheques40_meta,"updatedAt"=c."updatedAt" WHERE id=c.id AND user_id=p_user_id;
 END IF;
 FOREACH g IN ARRAY ARRAY['cheques40_guardar','a_legados_protocolo_transacoes_caixa','a0_multa36_ponte','a1_caixa37_ponte','ciclo_ledger','multa36_guard_transacoes_caixa','multimodal_ledger','z_caixa37_ledger'] LOOP
  INSERT INTO public.cheques40_capacidades VALUES(txid_current(),pg_backend_pid(),op,g,'transacoes_caixa','INSERT',NULL,ts);
 END LOOP;
 INSERT INTO public.transacoes_caixa(id,conta_caixa_id,tipo,categoria,descricao,valor,data_transacao,contrato_id,parcela_id,"createdAt",user_id) VALUES(t.id,t.conta_caixa_id,t.tipo,t.categoria,t.descricao,t.valor,t.data_transacao,t.contrato_id,t.parcela_id,t."createdAt",t.user_id);
 IF acao='criar' THEN INSERT INTO public.cheques40_origens VALUES(c.id,p_user_id,clid,aid,depois,t.id,ts); END IF;
 res40:=jsonb_build_object('success',true,'regra','cheques40_v1','id',c.id,'operationId',op,'idempotencyKey',p_chave,'repetida',false,'valorLiquido',liquido::text,'valorDesconto',(valor-liquido)::text,'status',c.status,'estornadoNoCaixa',acao IN('devolver','cancelar'),'requerConferenciaCaixa',false);
 UPDATE public.cheques40_operacoes SET resultado=resultado40.r,auditoria=resultado40.a FROM
 (SELECT res40 r,jsonb_build_object('antes',antes,'depois',depois,'ledger',ts,'compensaTransacaoId',CASE WHEN acao IN('devolver','cancelar') THEN origem.saida_id ELSE NULL END,'saldoAntes',saldo::text,'saldoDepois',(saldo+CASE WHEN acao='criar' THEN -t.valor ELSE t.valor END)::text) a) resultado40
 WHERE operacao_id=op;
 PERFORM public.cheques40_validar(op);RETURN res40;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Vínculo40 concorrente' USING ERRCODE='40001';
END $$;
CREATE FUNCTION public.rpc_abandonar_cheques40(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE o public.cheques40_operacoes%ROWTYPE; f public.cheques40_ausencias%ROWTYPE; prova40 jsonb;
BEGIN
 PERFORM public.caixa37_verificar();
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave IS NULL OR jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Fence40 inválido' USING ERRCODE='22023'; END IF;
 -- EXATAMENTE o mesmo lock da execução. Retorno de ausência persiste proibição futura.
 PERFORM pg_advisory_xact_lock(hashtextextended('cheques40:'||p_user_id::text||':'||p_chave::text,40));
 SELECT x.* INTO o FROM public.cheques40_operacoes x WHERE x.user_id=p_user_id AND x.chave=p_chave;
 IF FOUND THEN
  IF o.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'UUID40 outro payload' USING ERRCODE='23505'; END IF;
  PERFORM public.cheques40_validar(o.operacao_id);
  RETURN jsonb_build_object('success',true,'regra','cheques40_fence_v1','estado','executada','idempotencyKey',p_chave,'request',p_request,'resultado',o.resultado||jsonb_build_object('repetida',true));
 END IF;
 SELECT x.* INTO f FROM public.cheques40_ausencias x WHERE x.user_id=p_user_id AND x.chave=p_chave;
 IF FOUND THEN
  IF f.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'UUID40 fence outro payload' USING ERRCODE='23505'; END IF; RETURN f.prova;
 END IF;
 prova40:=jsonb_build_object('success',true,'regra','cheques40_fence_v1','estado','nao_executada','idempotencyKey',p_chave,'request',p_request,'resultado',NULL);
 INSERT INTO public.cheques40_ausencias(user_id,chave,request,prova) VALUES(p_user_id,p_chave,p_request,prova40);
 RETURN prova40;
END $$;
CREATE TRIGGER z_cheques40_cheque BEFORE INSERT OR UPDATE OR DELETE ON public.cheques FOR EACH ROW EXECUTE FUNCTION public.cheques40_guardar();
CREATE TRIGGER a00_cheques40_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.transacoes_caixa FOR EACH ROW EXECUTE FUNCTION public.cheques40_guardar();
CREATE TRIGGER z_cheques40_conta BEFORE UPDATE OR DELETE ON public.contas_caixa FOR EACH ROW EXECUTE FUNCTION public.cheques40_guardar();
CREATE TRIGGER z_cheques40_cliente BEFORE UPDATE OR DELETE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.cheques40_guardar();
CREATE TRIGGER cheques40_op_imutavel BEFORE UPDATE OR DELETE ON public.cheques40_operacoes FOR EACH ROW EXECUTE FUNCTION public.cheques40_imutavel();
CREATE TRIGGER cheques40_origem_imutavel BEFORE UPDATE OR DELETE ON public.cheques40_origens FOR EACH ROW EXECUTE FUNCTION public.cheques40_imutavel();
CREATE TRIGGER cheques40_conta_imutavel BEFORE UPDATE OR DELETE ON public.cheques40_contas FOR EACH ROW EXECUTE FUNCTION public.cheques40_imutavel();
CREATE TRIGGER cheques40_fence_imutavel BEFORE UPDATE OR DELETE ON public.cheques40_ausencias FOR EACH ROW EXECUTE FUNCTION public.cheques40_imutavel();
CREATE CONSTRAINT TRIGGER cheques40_complete AFTER INSERT OR UPDATE ON public.cheques40_operacoes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.cheques40_completar();
CREATE CONSTRAINT TRIGGER cheques40_complete AFTER INSERT ON public.cheques40_capacidades DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.cheques40_completar();
ALTER TABLE public.cheques40_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheques40_origens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheques40_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheques40_capacidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheques40_ausencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cheques40_contas,public.cheques40_origens,public.cheques40_operacoes,public.cheques40_capacidades,public.cheques40_ausencias FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.cheques40_consumir(text,text,text,jsonb,jsonb),public.cheques40_guardar(),public.cheques40_imutavel(),public.cheques40_validar(uuid),public.cheques40_completar(),public.rpc_cheques40(integer,uuid,jsonb),public.rpc_abandonar_cheques40(integer,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cheques40(integer,uuid,jsonb),public.rpc_abandonar_cheques40(integer,uuid,jsonb) TO service_role;
