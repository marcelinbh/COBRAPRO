-- 0040 após0042 FINAL. Gerado deterministicamente; baseline42 SHA256 7cba180c1e3979b4728459728f7296ac0da88f0de3de21d20745f9067636bd59.
-- Uma extensão exata40 por guarda, sem copiar capacidades42 ou alterar fontes publicadas36/36a/37.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261112,3133);
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
SELECT pg_advisory_xact_lock(20261110,33);
LOCK TABLE public.cheques,public.users,public.clientes,public.contas_caixa,public.contratos,public.parcelas,public.transacoes_caixa IN SHARE ROW EXCLUSIVE MODE;
DO $gate40$ DECLARE actual jsonb; BEGIN
 PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' OR current_user IN('service_role','anon','authenticated')
 OR to_regclass('public.assinaturas42_operacoes') IS NULL OR to_regclass('public.cheques40_operacoes') IS NOT NULL
 THEN RAISE EXCEPTION '0040 one-shot/owner/PG17/baseline42 inválido' USING ERRCODE='55000'; END IF;
 SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) INTO actual FROM pg_attribute WHERE attrelid='public.cheques'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM '[["id","integer",true],["cliente_id","integer",false],["numero_cheque","character varying(50)",true],["banco","character varying(100)",false],["agencia","character varying(20)",false],["conta","character varying(30)",false],["valor_nominal","numeric(15,2)",true],["data_emissao","date",true],["data_vencimento","date",true],["taxa_desconto","numeric(5,2)",false],["valor_descontado","numeric(15,2)",false],["valor_liquido","numeric(15,2)",false],["status","character varying(20)",false],["conta_caixa_id","integer",false],["observacoes","text",false],["createdAt","timestamp with time zone",true],["updatedAt","timestamp with time zone",true],["user_id","integer",false]]'::jsonb THEN RAISE EXCEPTION '0040 shape físico informado divergente; sem inferência/backfill' USING ERRCODE='55000'; END IF;
 IF (SELECT relowner FROM pg_class WHERE oid='public.cheques'::regclass)<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.cheques'::regclass)
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.cheques'::regclass AND NOT tgisinternal)
 OR pg_get_serial_sequence('public.cheques','id') IS NULL THEN RAISE EXCEPTION '0040 owner/RLS/trigger/sequence divergente' USING ERRCODE='55000'; END IF;
END $gate40$;
DO $before40$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"ciclo_guardar","args":"","hash":"a137cc94825f68d18ac1421a693b4b1c09d1761fd4d8ec854aa1159916b03143","config":["search_path=pg_catalog, pg_temp"]},{"name":"legados_guardar","args":"","hash":"f18056bbe04995ce1150df84cfc6d13e7e97b6411667cf34069773939bf78b94","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_guardar","args":"","hash":"3f5487a467d218ecf84139935bf3e25d1d1dc8b31c89471c20ac63a7ff929bb3","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multa36_guardar","args":"","hash":"84738e37e62fec3e70094d6312228bfec5d746b163d5f32fe5ff043dc3bd982d","config":["search_path=pg_catalog, pg_temp"]},{"name":"multa36_ponte","args":"","hash":"98c40907736c9c726e8422cd6e300ca48c62040e322273d606797d4d9973b200","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ponte","args":"","hash":"13125216be4c8a8d57e0b48d7cb902ef14f3637975890861380abf781125bc4a","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ledger","args":"","hash":"fb7c01ee9719f11ce99b68a81dbeded58bd94637b03453934a609e2040f9accf","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_perna_comprovada","args":"integer, integer","hash":"b0b2e1e6807ce8aeb70d5dd13c70d74844858ddba472cfe64b1777c3f7e30356","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '0040 predecessor overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION '0040 predecessor fonte/config/ACL/owner divergente' USING ERRCODE='55000'; END IF;
 END LOOP; END $before40$;
CREATE TEMP TABLE cheques40_witness ON COMMIT DROP AS SELECT oid,to_jsonb(p) snapshot,pg_get_functiondef(oid) definition FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f' AND proname NOT IN('ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','caixa37_ponte','caixa37_ledger','caixa37_perna_comprovada');
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
-- Protocolo37 derivado, somente conta selecionada; não modifica helpers37.
CREATE FUNCTION public.cheques40_conjunto(aid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object(
 'contas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contas_caixa WHERE id=aid),'[]'::jsonb),
 'contratos',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contratos WHERE id IN(SELECT contrato_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid) OR id IN(SELECT contrato_id FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid))),'[]'::jsonb),
 'parcelas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE conta_caixa_id=aid)),'[]'::jsonb));
$$;
CREATE FUNCTION public.cheques40_travar_conta(uid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s jsonb; n integer; aids integer[]; cids integer[]; pids integer[]; clients integer[]; collectors integer[];
BEGIN
 IF uid IS NULL OR uid<=0 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid) THEN RAISE EXCEPTION 'Owner37 indisponível' USING ERRCODE='42501'; END IF;
 s:=public.cheques40_conjunto(aid);
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
 IF public.cheques40_conjunto(aid) IS DISTINCT FROM s OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND NOT cliente_id=ANY(clients))
 OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE id=ANY(pids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors)) THEN RAISE EXCEPTION 'Conjunto37 mudou durante locks' USING ERRCODE='40001'; END IF;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Row37 concorrente' USING ERRCODE='40001';
END $$;
CREATE FUNCTION public.cheques40_validar_conta(uid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a public.contas_caixa%ROWTYPE; t public.transacoes_caixa%ROWTYPE; oid37 uuid;
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
 FOR oid37 IN SELECT id FROM public.caixa37_operacoes o WHERE o.user_id=uid AND EXISTS(SELECT 1 FROM public.caixa37_pernas p JOIN public.transacoes_caixa l ON l.id=p.transacao_id WHERE p.operacao_id=o.id AND l.conta_caixa_id=aid) LOOP PERFORM public.caixa37_validar_op(oid37); END LOOP;
 IF EXISTS(SELECT 1 FROM public.caixa37_contas p LEFT JOIN public.contas_caixa ac ON ac.id=p.conta_id WHERE p.conta_id=aid AND (p.user_id IS DISTINCT FROM uid OR ac.id IS NULL OR ac.user_id IS DISTINCT FROM p.user_id OR ac.saldo IS DISTINCT FROM p.saldo_base)) THEN RAISE EXCEPTION 'Pin37 divergente' USING ERRCODE='23514'; END IF;
 FOR oid37 IN SELECT operacao_id FROM public.cheques40_operacoes WHERE ledger->>'conta_caixa_id'=aid::text LOOP PERFORM public.cheques40_validar(oid37); END LOOP;
 FOR oid37 IN SELECT id FROM public.assinaturas42_operacoes WHERE conta_id=aid LOOP PERFORM public.assinaturas42_validar(oid37); END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.cheques40_conjunto(integer),public.cheques40_travar_conta(integer,integer),public.cheques40_validar_conta(integer,integer) FROM PUBLIC,anon,authenticated,service_role;

-- BEGIN PONTE40 EXATA
CREATE OR REPLACE FUNCTION public.ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oldj jsonb; newj jsonb; cid integer; aid integer; protegido boolean; autorizado boolean; despesa_autorizada boolean;
BEGIN
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
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
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
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
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
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
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
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
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
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
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
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
 IF TG_TABLE_NAME='transacoes_caixa' AND TG_OP='INSERT' AND public.cheques40_consumir(TG_NAME,TG_TABLE_NAME,TG_OP,NULL,to_jsonb(NEW)) THEN RETURN NEW; END IF;
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
 SELECT o.operacao_id INTO oid37 FROM public.cheques40_operacoes o WHERE o.transacao_id=tid AND o.user_id=uid;
 IF FOUND THEN PERFORM public.cheques40_validar(oid37); RETURN true; END IF;
 SELECT p.operacao_id INTO oid37 FROM public.caixa37_pernas p JOIN public.caixa37_operacoes o ON o.id=p.operacao_id WHERE p.transacao_id=tid AND p.user_id=uid AND o.user_id=uid;
 IF NOT FOUND THEN
 SELECT o.id INTO oid37 FROM public.assinaturas42_operacoes o WHERE o.transacao_id=tid AND o.user_id=uid;
 IF NOT FOUND THEN RETURN telefone41.perna_comprovada(tid,uid); END IF; PERFORM public.assinaturas42_validar(oid37); RETURN true; END IF; PERFORM public.caixa37_validar_op(oid37); RETURN true;
END $$;
-- END PONTE40
DO $after40$ DECLARE e jsonb; p record; BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements('[{"name":"ciclo_guardar","args":"","hash":"7cb00fa10c6ff29198ef7b346e97f7e9018a86b1b557de6bf4f649456b694e24","config":["search_path=pg_catalog, pg_temp"]},{"name":"legados_guardar","args":"","hash":"52a26732ed696c3ed7c5b4f595b86f2889931d352705aeab1805204e6fd1fc81","config":["search_path=pg_catalog, pg_temp"]},{"name":"multimodal_guardar","args":"","hash":"0c26a4aaa0ff5fe83d0adf46812b51071dd5eb58a0e7895cdae307a29cbb72cc","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"multa36_guardar","args":"","hash":"e285a390238600532f88b8cc560a87d070105eb49402915d1521445122719349","config":["search_path=pg_catalog, pg_temp"]},{"name":"multa36_ponte","args":"","hash":"8b523954ee1458d160292b5a7516f817f95dc32ca2887863dbfb6d7de40aad7d","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ponte","args":"","hash":"107bf63d09a35e6a05f9eb6aed771ae755a57d5bf8cd8185b4a7e75e6843673e","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_ledger","args":"","hash":"f32da1af1c70308e7018477678b4f862d90512a2c6ad0fdc2ee75e3b4714ce63","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"caixa37_perna_comprovada","args":"integer, integer","hash":"5c69dbd9424341d8952d4382271348c6558045e4b5fef8e5bd1574694bf6acbc","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
 IF (SELECT count(*) FROM pg_proc WHERE proname=e->>'name')<>1 THEN RAISE EXCEPTION '0040 predecessor overload/homônimo' USING ERRCODE='55000'; END IF;
 SELECT prosrc,prosecdef,proconfig,proowner,proacl,oid INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure('public.'||(e->>'name')||'('||(e->>'args')||')');
 IF encode(extensions.digest(p.prosrc,'sha256'),'hex') IS DISTINCT FROM e->>'hash' OR NOT p.prosecdef OR to_jsonb(p.proconfig) IS DISTINCT FROM e->'config'
 OR p.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')
 THEN RAISE EXCEPTION '0040 predecessor fonte/config/ACL/owner divergente' USING ERRCODE='55000'; END IF;
 END LOOP; END $after40$;
DO $post40$ DECLARE w record; BEGIN
 FOR w IN SELECT oid,snapshot,definition FROM cheques40_witness LOOP
 IF (SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid=w.oid) IS DISTINCT FROM w.snapshot OR pg_get_functiondef(w.oid) IS DISTINCT FROM w.definition THEN RAISE EXCEPTION '0040 função fora da ponte alterada' USING ERRCODE='55000'; END IF; END LOOP;
END $post40$;
-- Selos de metadata apenas na instalação, após checks exatos; sem reseal runtime/financeiro.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
UPDATE public.caixa37_manifesto SET assinatura=public.caixa37_metadata() WHERE id=1;
DO $verify40$ BEGIN PERFORM public.caixa37_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar(); END $verify40$;
NOTIFY pgrst,'reload schema';
COMMIT;
