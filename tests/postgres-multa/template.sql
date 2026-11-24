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
 public.multimodal_manifesto,public.multimodal_origens,public.multimodal_operacoes,public.multimodal_estados,public.multimodal_autorizacoes,public.multimodal_pernas,public.multimodal_renovacoes,public.multimodal_fences IN ACCESS EXCLUSIVE MODE;
DO $gate36$
DECLARE expected jsonb; actual jsonb; own oid; svc oid; roles oid[]; names text[]; x record; n text;
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION '0036 exige PG17/Read Committed' USING ERRCODE='55000'; END IF;
 SELECT oid INTO own FROM pg_roles WHERE rolname=current_user;
 SELECT oid INTO svc FROM pg_roles WHERE rolname='service_role';
 SELECT array_agg(oid) INTO roles FROM pg_roles WHERE rolname IN('service_role','anon','authenticated');
 IF cardinality(roles) IS DISTINCT FROM 3 OR current_user IN('service_role','anon','authenticated') OR EXISTS(SELECT 1 FROM pg_roles WHERE oid=ANY(roles) AND (rolsuper OR rolcreaterole OR (rolbypassrls AND oid<>svc) OR pg_has_role(oid,own,'MEMBER'))) THEN RAISE EXCEPTION '0036 roles inseguras' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname LIKE 'multa36\_%' ESCAPE '\' OR proname LIKE 'rpc\_%multa36' ESCAPE '\') OR EXISTS(SELECT 1 FROM pg_class WHERE relname LIKE 'multa36\_%' ESCAPE '\') OR EXISTS(SELECT 1 FROM pg_type WHERE typname LIKE 'multa36\_%' ESCAPE '\') OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname LIKE 'multa36\_%' ESCAPE '\') THEN RAISE EXCEPTION '0036 homônimo/reapply recusado' USING ERRCODE='55000'; END IF;
 -- PREDECESSOR MANIFEST
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(expected) f;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO actual FROM (
 SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,
 'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO expected FROM jsonb_array_elements(expected) f;
 IF actual IS DISTINCT FROM expected OR EXISTS(SELECT 1 FROM pg_proc WHERE proname=ANY(names) AND (pronamespace<>'public'::regnamespace OR proowner<>own)) THEN RAISE EXCEPTION '0036 source/signature/config/owner/overload desconhecido' USING ERRCODE='55000', DETAIL=(SELECT coalesce(jsonb_agg(d.x)::text,'owner/schema') FROM (SELECT jsonb_build_object('expected',e,'actual',a) x FROM jsonb_array_elements(expected) e FULL JOIN jsonb_array_elements(actual) a ON e->>'proname'=a->>'proname' AND e->>'types'=a->>'types' WHERE e IS DISTINCT FROM a) d); END IF;
 FOR x IN SELECT * FROM pg_proc WHERE proname=ANY(names) LOOP
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce(x.proacl,acldefault('f',own))) a WHERE a.grantee<>own AND NOT(a.grantee=svc AND (x.proname LIKE 'rpc\_%' ESCAPE '\' OR x.proname IN('legados_prova_pagamento','legados_identificar_trilho')) AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
 OR EXISTS(SELECT 1 FROM unnest(roles) r WHERE r<>svc AND has_function_privilege(r,x.oid,'EXECUTE'))
 OR (x.proname NOT LIKE 'rpc\_%' ESCAPE '\' AND x.proname NOT IN('legados_prova_pagamento','legados_identificar_trilho') AND has_function_privilege(svc,x.oid,'EXECUTE')) THEN RAISE EXCEPTION '0036 ACL predecessora desconhecida %',x.proname USING ERRCODE='55000'; END IF;
 END LOOP;
 PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();
 -- ROW MANIFEST
 FOREACH n IN ARRAY ARRAY['contratos','parcelas','transacoes_caixa','contrato_historico','contas_caixa','clientes','koletores'] LOOP
 SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,CASE WHEN pg_get_expr(d.adbin,d.adrelid) LIKE 'nextval(%' THEN 'serial' ELSE pg_get_expr(d.adbin,d.adrelid) END) ORDER BY a.attnum) INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=to_regclass('public.'||n) AND a.attnum>0 AND NOT a.attisdropped;
 IF actual IS DISTINCT FROM expected->n THEN RAISE EXCEPTION '0036 rowtype/default desconhecido %',n USING ERRCODE='55000'; END IF;
 END LOOP;
END $gate36$;
-- Witness do catálogo inteiro já preflightado: somente funções previstas + triggers36
-- podem mudar. DDL externa privilegiada não cooperativa continua proibida na janela.
CREATE TEMP TABLE multa36_ddl_witness ON COMMIT DROP AS SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p)) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname NOT IN('ciclo_guardar','legados_guardar','multimodal_guardar')),
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
 'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace)) s;

CREATE TABLE public.multa36_operacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id integer NOT NULL REFERENCES public.users(id),chave uuid NOT NULL,
 contrato_id integer NOT NULL REFERENCES public.contratos(id),acao text NOT NULL CHECK(acao IN('multa','receber','renovar')),
 request jsonb NOT NULL,hash_payload text NOT NULL CHECK(hash_payload ~ '^[a-f0-9]{64}$'),resultado jsonb,auditoria jsonb,concluida_em timestamptz,
 UNIQUE(user_id,chave),CHECK((resultado IS NULL AND auditoria IS NULL AND concluida_em IS NULL) OR (resultado IS NOT NULL AND auditoria IS NOT NULL AND concluida_em IS NOT NULL)));
CREATE TABLE public.multa36_origens(contrato_id integer PRIMARY KEY REFERENCES public.contratos(id),user_id integer NOT NULL REFERENCES public.users(id),
 fonte text NOT NULL CHECK(fonte IN('multimodal0035','prospectivo0021','legado_validado0034')),operacao_id uuid NOT NULL UNIQUE REFERENCES public.multa36_operacoes(id),
 snapshot_admissao jsonb NOT NULL,hash_admissao text NOT NULL,conta_id integer NOT NULL REFERENCES public.contas_caixa(id));
CREATE TABLE public.multa36_estados(contrato_id integer PRIMARY KEY REFERENCES public.multa36_origens(contrato_id),user_id integer NOT NULL,
 operacao_id uuid NOT NULL REFERENCES public.multa36_operacoes(id),snapshot jsonb NOT NULL,hash_snapshot text NOT NULL);
CREATE TABLE public.multa36_encargos(parcela_id integer PRIMARY KEY REFERENCES public.parcelas(id),contrato_id integer NOT NULL REFERENCES public.multa36_origens(contrato_id),
 operacao_id uuid NOT NULL REFERENCES public.multa36_operacoes(id),valor numeric(15,2) NOT NULL CHECK(valor>0),dia_brt date NOT NULL);
CREATE TABLE public.multa36_pernas(operacao_id uuid PRIMARY KEY REFERENCES public.multa36_operacoes(id),transacao_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id),snapshot jsonb NOT NULL,alocacao jsonb NOT NULL);
CREATE TABLE public.multa36_renovacoes(operacao_id uuid PRIMARY KEY REFERENCES public.multa36_operacoes(id),contrato_id integer NOT NULL REFERENCES public.multa36_origens(contrato_id),
 anterior_id integer NOT NULL UNIQUE REFERENCES public.parcelas(id),nova_id integer NOT NULL UNIQUE REFERENCES public.parcelas(id),
 principal numeric(15,2) NOT NULL CHECK(principal>0),juros numeric(15,2) NOT NULL CHECK(juros>0),multa numeric(15,2) NOT NULL CHECK(multa>=0),mora numeric(15,2) NOT NULL CHECK(mora>=0),CHECK(anterior_id<>nova_id));
CREATE TABLE public.multa36_capacidades(xid bigint NOT NULL,pid integer NOT NULL,guard text NOT NULL CHECK(guard IN('ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar')),
 operacao_id uuid NOT NULL REFERENCES public.multa36_operacoes(id),tabela text NOT NULL CHECK(tabela IN('contratos','parcelas','transacoes_caixa','contrato_historico')),
 evento text NOT NULL CHECK(evento IN('INSERT','UPDATE')),anterior jsonb,posterior jsonb NOT NULL,PRIMARY KEY(xid,pid,guard),CHECK((evento='INSERT' AND anterior IS NULL) OR (evento='UPDATE' AND anterior IS NOT NULL)));
CREATE TABLE public.multa36_fences(user_id integer NOT NULL REFERENCES public.users(id),chave uuid NOT NULL,request jsonb NOT NULL,PRIMARY KEY(user_id,chave));
CREATE TABLE public.multa36_manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);

CREATE FUNCTION public.multa36_consumir(p_guard text,p_tabela text,p_evento text,p_old jsonb,p_new jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE ok boolean;
BEGIN
 DELETE FROM public.multa36_capacidades a USING public.multa36_operacoes o
 WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.guard=p_guard AND a.tabela=p_tabela AND a.evento=p_evento
 AND a.anterior IS NOT DISTINCT FROM p_old AND a.posterior IS NOT DISTINCT FROM p_new AND o.id=a.operacao_id AND o.resultado IS NULL
 AND p_new->>'user_id'=o.user_id::text AND pg_xact_status(o.xmin::text::xid8)='in progress' AND (CASE WHEN p_tabela='contratos' THEN (p_new->>'id')::int ELSE (p_new->>'contrato_id')::int END)=o.contrato_id
 AND ((o.acao='multa' AND p_tabela IN('parcelas','contrato_historico')) OR o.acao IN('receber','renovar')) RETURNING true INTO ok;
 RETURN coalesce(ok,false);
END $$;
-- GUARD EXTENSIONS

CREATE FUNCTION public.multa36_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a jsonb; b jsonb; ids integer[]; aid integer; protegido boolean;
BEGIN
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
CREATE FUNCTION public.multa36_snapshot(cid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT public.multimodal_snapshot(cid)||jsonb_build_object(
 'encargos36',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY parcela_id) FROM public.multa36_encargos e WHERE contrato_id=cid),'[]'::jsonb),
 'renovacoes36',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY anterior_id) FROM public.multa36_renovacoes r WHERE contrato_id=cid),'[]'::jsonb));
$$;
CREATE FUNCTION public.multa36_vinculos(uid integer,cid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE c public.contratos%ROWTYPE; t public.transacoes_caixa%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.contratos WHERE id=cid;
 IF uid IS NULL OR uid<=0 OR c.id IS NULL OR c.user_id IS DISTINCT FROM uid OR c.conta_caixa_id IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid) OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=uid)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=c.conta_caixa_id AND user_id=uid AND ativo IS TRUE AND public.multimodal_moeda(saldo))
 OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid AND ativo IS TRUE))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND (user_id IS DISTINCT FROM uid OR cliente_id IS DISTINCT FROM c.cliente_id OR conta_caixa_id IS DISTINCT FROM c.conta_caixa_id OR koletor_id IS DISTINCT FROM c.koletor_id))
 OR EXISTS(SELECT 1 FROM public.contrato_historico WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid::text) THEN RAISE EXCEPTION 'Vínculos36 indisponíveis' USING ERRCODE='42501'; END IF;
 -- Ledger INTEIRO da conta, e pernas vinculadas ao contrato mesmo em outra conta.
 FOR t IN SELECT * FROM public.transacoes_caixa WHERE conta_caixa_id=c.conta_caixa_id OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid) LOOP
 IF t.user_id IS DISTINCT FROM uid OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=t.conta_caixa_id AND user_id=uid AND ativo IS TRUE)
 OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos WHERE id=t.contrato_id AND user_id=uid))
 OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos co ON co.id=p.contrato_id WHERE p.id=t.parcela_id AND p.user_id=uid AND co.user_id=uid AND p.cliente_id=co.cliente_id AND p.contrato_id=t.contrato_id AND p.conta_caixa_id=t.conta_caixa_id)) THEN RAISE EXCEPTION 'Ledger36 crossowner/null/vínculo inválido' USING ERRCODE='42501'; END IF;
 IF NOT public.multimodal_moeda(t.valor) OR t.valor<=0 OR t.tipo IS NULL OR t.tipo NOT IN('entrada','saida') OR t.data_transacao IS NULL OR NOT isfinite(t.data_transacao) THEN RAISE EXCEPTION 'Ledger36 financeiro inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION public.multa36_travar(uid integer,cid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE aid integer;
BEGIN
 PERFORM public.multa36_vinculos(uid,cid); SELECT conta_caixa_id INTO aid FROM public.contratos WHERE id=cid;
 PERFORM public.legados_travar(uid,cid,aid); PERFORM public.multa36_vinculos(uid,cid);
 IF (SELECT conta_caixa_id FROM public.contratos WHERE id=cid) IS DISTINCT FROM aid THEN RAISE EXCEPTION 'Conta alterada durante espera' USING ERRCODE='40001'; END IF;
END $$;
CREATE FUNCTION public.multa36_validar(uid integer,cid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; e public.multa36_estados%ROWTYPE; o public.multa36_origens%ROWTYPE; op public.multa36_operacoes%ROWTYPE; p public.parcelas%ROWTYPE; r record; soma numeric;
BEGIN
 PERFORM public.multa36_vinculos(uid,cid);
 SELECT * INTO o FROM public.multa36_origens WHERE contrato_id=cid;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Origem36 indisponível' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT e FROM public.multa36_estados WHERE contrato_id=cid; SELECT * INTO STRICT op FROM public.multa36_operacoes WHERE id=e.operacao_id; s:=public.multa36_snapshot(cid);
 IF e.user_id IS DISTINCT FROM uid OR e.snapshot IS DISTINCT FROM s OR e.hash_snapshot IS DISTINCT FROM encode(extensions.digest(s::text,'sha256'),'hex')
 OR op.user_id IS DISTINCT FROM uid OR op.contrato_id IS DISTINCT FROM cid OR op.resultado IS NULL OR op.auditoria->'depois' IS DISTINCT FROM s OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado
 OR op.auditoria->'request' IS DISTINCT FROM op.request OR op.hash_payload IS DISTINCT FROM encode(extensions.digest(op.request::text,'sha256'),'hex')
 OR o.hash_admissao IS DISTINCT FROM encode(extensions.digest(o.snapshot_admissao::text,'sha256'),'hex')
 OR NOT EXISTS(SELECT 1 FROM public.multa36_operacoes a WHERE a.id=o.operacao_id AND a.acao='multa' AND a.auditoria->'antes'=o.snapshot_admissao AND a.resultado IS NOT NULL) THEN RAISE EXCEPTION 'Prova36 snapshot/auditoria divergente' USING ERRCODE='23514'; END IF;
 FOR r IN SELECT m.*,aop.auditoria,aop.resultado,aop.request FROM public.multa36_pernas m JOIN public.multa36_operacoes aop ON aop.id=m.operacao_id WHERE aop.contrato_id=cid LOOP
 IF r.snapshot IS DISTINCT FROM (SELECT to_jsonb(t) FROM public.transacoes_caixa t WHERE id=r.transacao_id) OR r.resultado IS NULL
 OR r.auditoria->'perna' IS DISTINCT FROM r.snapshot OR r.auditoria->'alocacao' IS DISTINCT FROM r.alocacao
 OR (r.alocacao->>'total')::numeric IS DISTINCT FROM (r.snapshot->>'valor')::numeric
 OR (r.snapshot->>'valor')::numeric IS DISTINCT FROM (r.request->>'valorRecebido')::numeric THEN RAISE EXCEPTION 'Perna36/alocação divergente' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR p IN SELECT * FROM public.parcelas WHERE contrato_id=cid LOOP
 IF p.valor_original IS NULL OR p.valor_original<=0 OR p.valor IS DISTINCT FROM p.valor_original OR p.valor_juros IS NULL OR p.valor_juros<0 OR p.valor_juros>p.valor_original OR p.valor_pago IS NULL OR p.valor_pago<0 OR p.valor_multa IS NULL OR p.multa_manual IS NULL OR p.multa_diaria_usada IS NULL OR p.valor_desconto IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'Parcela36 ambígua' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.multa36_encargos enc WHERE enc.parcela_id=p.id AND (enc.contrato_id<>cid OR enc.valor IS DISTINCT FROM p.multa_manual OR enc.dia_brt<=p.data_vencimento)) THEN RAISE EXCEPTION 'Encargo36 divergente' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(valor),0) INTO soma FROM public.transacoes_caixa WHERE parcela_id=p.id;
 IF soma IS DISTINCT FROM p.valor_pago OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE parcela_id=p.id AND (tipo IS DISTINCT FROM 'entrada' OR categoria IS DISTINCT FROM 'pagamento_parcela' OR contrato_id IS DISTINCT FROM cid)) THEN RAISE EXCEPTION 'Pagamento36 não reconciliado' USING ERRCODE='23514'; END IF;
 IF p.status='paga' AND (p.saldo_residual<>0 OR p.valor_pago<>p.valor_original+p.valor_multa+p.multa_diaria_usada) THEN RAISE EXCEPTION 'Quitação36 não comprovada' USING ERRCODE='23514'; END IF;
 IF p.status='parcial' AND (p.saldo_residual<=0 OR p.valor_pago<=0 OR p.saldo_residual<>p.valor_original+p.valor_multa+p.multa_diaria_usada-p.valor_pago) THEN RAISE EXCEPTION 'Residual36 inválido' USING ERRCODE='23514'; END IF;
 IF p.status IN('pendente','atrasada','atrasado','vencendo_hoje') AND (p.valor_pago<>0 OR p.saldo_residual<>0 OR p.valor_multa<>0 OR p.multa_diaria_usada<>0 OR p.data_pagamento IS NOT NULL) THEN RAISE EXCEPTION 'Aberta36 incoerente' USING ERRCODE='23514'; END IF;
 IF p.status='cancelada' AND NOT EXISTS(SELECT 1 FROM public.multa36_renovacoes ren JOIN public.parcelas n ON n.id=ren.nova_id WHERE ren.anterior_id=p.id AND ren.contrato_id=cid AND ren.principal=p.valor_original-p.valor_juros AND ren.principal=p.saldo_residual AND p.valor_pago=ren.juros+ren.multa+ren.mora AND n.valor_original-n.valor_juros=ren.principal) AND NOT EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE anterior_id=p.id AND contrato_id=cid) THEN RAISE EXCEPTION 'Transferência36 não comprovada' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF (SELECT status FROM public.contratos WHERE id=cid)='quitado' AND EXISTS(SELECT 1 FROM public.parcelas cp WHERE cp.contrato_id=cid AND cp.status<>'paga' AND NOT EXISTS(SELECT 1 FROM public.multa36_renovacoes WHERE anterior_id=cp.id) AND NOT EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE anterior_id=cp.id)) THEN RAISE EXCEPTION 'Contrato36 incompleto' USING ERRCODE='23514'; END IF;
 RETURN s;
END $$;
CREATE FUNCTION public.multa36_escrever(p_op uuid,p_tabela text,p_old jsonb,p_new jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE g text; cols text; vals text; actual jsonb;
BEGIN
 IF p_tabela NOT IN('contratos','parcelas','transacoes_caixa','contrato_historico') OR p_new IS NULL THEN RAISE EXCEPTION 'Escrita36 inválida' USING ERRCODE='42501'; END IF;
 FOREACH g IN ARRAY ARRAY['ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar'] LOOP
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||p_tabela) AND tgfoid=to_regprocedure('public.'||g||'()') AND (tgtype & CASE WHEN p_old IS NULL THEN 4 ELSE 16 END)<>0) THEN INSERT INTO public.multa36_capacidades VALUES(txid_current(),pg_backend_pid(),g,p_op,p_tabela,CASE WHEN p_old IS NULL THEN 'INSERT' ELSE 'UPDATE' END,p_old,p_new); END IF; END LOOP;
 IF p_old IS NULL THEN EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I,$1)).*',p_tabela,p_tabela) USING p_new;
 ELSE
 SELECT string_agg(format('%I',attname),',' ORDER BY attnum),string_agg(format('r.%I',attname),',' ORDER BY attnum) INTO cols,vals FROM pg_attribute WHERE attrelid=to_regclass('public.'||p_tabela) AND attnum>0 AND NOT attisdropped;
 EXECUTE format('UPDATE public.%I t SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r) WHERE t.id=($1->>''id'')::bigint',p_tabela,cols,vals,p_tabela) USING p_new;
 END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=($1->>''id'')::bigint',p_tabela) INTO actual USING p_new;
 IF actual IS DISTINCT FROM p_new OR EXISTS(SELECT 1 FROM public.multa36_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN RAISE EXCEPTION 'Escrita36 diferente da linha prevista/cap não consumida' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION public.multa36_selar(p_op uuid,cid integer,antes jsonb,esperado jsonb,r jsonb,extra jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op public.multa36_operacoes%ROWTYPE; s jsonb;
BEGIN
 SELECT * INTO STRICT op FROM public.multa36_operacoes WHERE id=p_op; s:=public.multa36_snapshot(cid);
 IF s IS DISTINCT FROM esperado THEN RAISE EXCEPTION 'Não selar drift36 observado' USING ERRCODE='23514'; END IF;
 UPDATE public.multa36_operacoes SET resultado=r,concluida_em=clock_timestamp(),auditoria=jsonb_build_object('acao',op.acao,'request',op.request,'hashPayload',op.hash_payload,'antes',antes,'depois',s,'resultado',r)||extra WHERE id=p_op;
 INSERT INTO public.multa36_estados VALUES(cid,op.user_id,p_op,s,encode(extensions.digest(s::text,'sha256'),'hex')) ON CONFLICT(contrato_id) DO UPDATE SET operacao_id=excluded.operacao_id,snapshot=excluded.snapshot,hash_snapshot=excluded.hash_snapshot;
 PERFORM public.multa36_validar(op.user_id,cid); RETURN r;
END $$;

-- Intenção global por owner/UUID: a mesma chave nunca muda de ação.
CREATE FUNCTION public.multa36_dinheiro(v text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF v IS NULL OR v !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' OR v='0.00' THEN RAISE EXCEPTION 'Centavos positivos canônicos obrigatórios' USING ERRCODE='22023'; END IF;
 RETURN v::numeric;
END $$;
CREATE FUNCTION public.multa36_request(r jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a text; keys text[]; x jsonb; ids integer[];
BEGIN
 IF r IS NULL OR jsonb_typeof(r)<>'object' THEN RAISE EXCEPTION 'Request36 inválido' USING ERRCODE='22023'; END IF;
 a:=r->>'acao';
 IF a='multa' THEN keys:=ARRAY['acao','contratoId','multa','parcelasIds'];
 ELSIF a='receber' THEN keys:=ARRAY['acao','contratoId','parcelaId','valorRecebido','totalExigido','dataPagamento','estadoHash','modo','observacoes'];
 ELSIF a='renovar' THEN keys:=ARRAY['acao','contratoId','parcelaId','valorRecebido','totalExigido','dataPagamento','estadoHash','modo','novoVencimento','observacoes'];
 ELSE RAISE EXCEPTION 'Ação36 inválida' USING ERRCODE='22023'; END IF;
 IF r-keys<>'{}'::jsonb OR (SELECT count(*) FROM jsonb_object_keys(r))<>cardinality(keys)
 OR jsonb_typeof(r->'contratoId') IS DISTINCT FROM 'number' OR coalesce(r->>'contratoId','') !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'Request36 chaves/IDs inválidos' USING ERRCODE='22023'; END IF;
 IF a='multa' THEN
 IF jsonb_typeof(r->'multa') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Multa textual obrigatória' USING ERRCODE='22023'; END IF;
 PERFORM public.multa36_dinheiro(r->>'multa');
 IF r->'parcelasIds'<>'null'::jsonb THEN
 IF jsonb_typeof(r->'parcelasIds') IS DISTINCT FROM 'array' OR jsonb_array_length(r->'parcelasIds')=0 THEN RAISE EXCEPTION 'Seleção36 inválida' USING ERRCODE='22023'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(r->'parcelasIds') LOOP
 IF jsonb_typeof(x)<>'number' OR x::text !~ '^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'ID36 inválido' USING ERRCODE='22023'; END IF;
 END LOOP;
 SELECT array_agg(v::text::int ORDER BY v::text::int) INTO ids FROM jsonb_array_elements(r->'parcelasIds') v;
 IF cardinality(ids)<>(SELECT count(DISTINCT v) FROM unnest(ids) v) THEN RAISE EXCEPTION 'Seleção duplicada' USING ERRCODE='22023'; END IF;
 r:=r||jsonb_build_object('parcelasIds',ids);
 END IF;
 ELSE
 IF jsonb_typeof(r->'parcelaId') IS DISTINCT FROM 'number' OR coalesce(r->>'parcelaId','') !~ '^[1-9][0-9]{0,8}$'
 OR jsonb_typeof(r->'valorRecebido') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'totalExigido') IS DISTINCT FROM 'string'
 OR coalesce(r->>'estadoHash','') !~ '^[a-f0-9]{64}$' OR coalesce(r->>'dataPagamento','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 OR NOT ((r->'observacoes'='null'::jsonb) OR (jsonb_typeof(r->'observacoes')='string' AND length(r->>'observacoes')<=1000))
 OR (a='receber' AND coalesce(r->>'modo','') NOT IN('integral','parcial')) OR (a='renovar' AND (r->>'modo' IS DISTINCT FROM 'renovar' OR coalesce(r->>'novoVencimento','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) THEN RAISE EXCEPTION 'Recebimento36 inválido' USING ERRCODE='22023'; END IF;
 PERFORM public.multa36_dinheiro(r->>'valorRecebido'); PERFORM public.multa36_dinheiro(r->>'totalExigido');
 IF (r->>'dataPagamento')::date NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' OR (a='renovar' AND (r->>'novoVencimento')::date NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31') THEN RAISE EXCEPTION 'DATE36 fora da faixa' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN r;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Request36 fora da faixa' USING ERRCODE='22023';
END $$;
CREATE FUNCTION public.multa36_barreira(uid integer,chave uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF uid IS NULL OR uid<=0 OR chave IS NULL THEN RAISE EXCEPTION 'Owner/UUID36 obrigatório' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('multa36:'||uid::text||':'||chave::text,36));
END $$;
CREATE FUNCTION public.multa36_reservar(uid integer,chave uuid,req jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.multa36_operacoes%ROWTYPE; r jsonb;
BEGIN
 PERFORM public.multa36_barreira(uid,chave); r:=public.multa36_request(req);
 PERFORM public.multa36_vinculos(uid,(r->>'contratoId')::int);
 IF EXISTS(SELECT 1 FROM public.multa36_fences WHERE user_id=uid AND multa36_fences.chave=multa36_reservar.chave) THEN
 IF EXISTS(SELECT 1 FROM public.multa36_fences WHERE user_id=uid AND multa36_fences.chave=multa36_reservar.chave AND request IS DISTINCT FROM r) THEN RAISE EXCEPTION 'UUID36 fechado divergente' USING ERRCODE='23505'; END IF;
 RAISE EXCEPTION 'UUID36 fechado permanentemente' USING ERRCODE='55000'; END IF;
 INSERT INTO public.multa36_operacoes(user_id,chave,contrato_id,acao,request,hash_payload) VALUES(uid,chave,(r->>'contratoId')::int,r->>'acao',r,encode(extensions.digest(r::text,'sha256'),'hex')) ON CONFLICT ON CONSTRAINT multa36_operacoes_user_id_chave_key DO NOTHING;
 SELECT * INTO STRICT o FROM public.multa36_operacoes WHERE user_id=uid AND multa36_operacoes.chave=multa36_reservar.chave FOR UPDATE;
 IF o.request IS DISTINCT FROM r OR o.hash_payload IS DISTINCT FROM encode(extensions.digest(r::text,'sha256'),'hex') THEN RAISE EXCEPTION 'UUID36 intenção divergente' USING ERRCODE='23505'; END IF;
 IF o.resultado IS NOT NULL THEN
 PERFORM public.multa36_validar(uid,o.contrato_id);
 IF o.auditoria->'resultado' IS DISTINCT FROM o.resultado OR o.auditoria->'request' IS DISTINCT FROM r OR o.resultado->>'operationId' IS DISTINCT FROM o.id::text OR o.resultado->'success' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Replay36 não comprovado' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN to_jsonb(o);
END $$;
CREATE FUNCTION public.rpc_aplicar_multa36(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_multa text,p_parcelas_ids integer[] DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE op jsonb; antes jsonb; esperado jsonb; p jsonb; e jsonb; h jsonb; r jsonb; ids integer[]; i integer; valor numeric; instante timestamptz; hoje date; primeira boolean;
BEGIN
 PERFORM public.multa36_verificar(); valor:=public.multa36_dinheiro(p_multa);
 IF p_parcelas_ids IS NOT NULL AND (array_ndims(p_parcelas_ids) IS DISTINCT FROM 1 OR array_lower(p_parcelas_ids,1) IS DISTINCT FROM 1) THEN RAISE EXCEPTION 'Array36 unidimensional obrigatório' USING ERRCODE='22023'; END IF;
 op:=public.multa36_reservar(p_user_id,p_chave_idempotencia,jsonb_build_object('acao','multa','contratoId',p_contrato_id,'multa',p_multa,'parcelasIds',p_parcelas_ids));
 IF op->'resultado'<>'null'::jsonb THEN RETURN op->'resultado'||jsonb_build_object('repetida',true); END IF;
 PERFORM public.multa36_travar(p_user_id,p_contrato_id); instante:=clock_timestamp(); hoje:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
 primeira:=NOT EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=p_contrato_id);
 IF primeira THEN
 IF NOT EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=p_contrato_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Admissão36 só origem0035 íntegra; 0021/legado não implementados' USING ERRCODE='23514'; END IF;
 PERFORM public.multimodal_validar(p_user_id,p_contrato_id); antes:=public.multa36_snapshot(p_contrato_id);
 ELSE antes:=public.multa36_validar(p_user_id,p_contrato_id); END IF;
 IF antes->'contrato'->>'status' IS DISTINCT FROM 'ativo' THEN RAISE EXCEPTION 'Contrato36 não ativo' USING ERRCODE='23514'; END IF;
 SELECT array_agg(id ORDER BY id) INTO ids FROM public.parcelas p0 WHERE contrato_id=p_contrato_id AND (p_parcelas_ids IS NULL OR id=ANY(p_parcelas_ids))
 AND status IN('pendente','atrasada','vencendo_hoje') AND valor_pago=0 AND saldo_residual=0 AND valor_multa=0 AND multa_diaria_usada=0 AND multa_manual=0 AND valor_desconto=0 AND data_pagamento IS NULL AND data_vencimento<hoje
 AND NOT EXISTS(SELECT 1 FROM public.multa36_encargos WHERE parcela_id=p0.id);
 IF p_parcelas_ids IS NOT NULL AND EXISTS(SELECT 1 FROM public.multa36_encargos WHERE contrato_id=p_contrato_id AND parcela_id=ANY(p_parcelas_ids)) THEN RAISE EXCEPTION 'Multa36 já aplicada' USING ERRCODE='23505'; END IF;
 IF ids IS NULL THEN RAISE EXCEPTION 'Nenhuma parcela36 elegível' USING ERRCODE='23514'; END IF;
 IF p_parcelas_ids IS NOT NULL AND cardinality(ids)<>cardinality(p_parcelas_ids) THEN
 IF EXISTS(SELECT 1 FROM public.multa36_encargos WHERE parcela_id=ANY(p_parcelas_ids)) THEN RAISE EXCEPTION 'Multa36 já aplicada' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_parcelas_ids) v WHERE NOT EXISTS(SELECT 1 FROM public.parcelas WHERE id=v AND contrato_id=p_contrato_id AND user_id=p_user_id)) THEN RAISE EXCEPTION 'Seleção36 indisponível' USING ERRCODE='42501'; END IF;
 RAISE EXCEPTION 'Seleção36 inclui parcela não elegível' USING ERRCODE='23514'; END IF;
 IF valor*cardinality(ids)>9999999999.99 THEN RAISE EXCEPTION 'Multa36 total fora da faixa' USING ERRCODE='22023'; END IF;
 IF primeira THEN INSERT INTO public.multa36_origens VALUES(p_contrato_id,p_user_id,'multimodal0035',(op->>'id')::uuid,antes,encode(extensions.digest(antes::text,'sha256'),'hex'),(antes->'contrato'->>'conta_caixa_id')::int); END IF;
 esperado:=antes;
 FOREACH i IN ARRAY ids LOOP
 SELECT to_jsonb(x) INTO STRICT p FROM public.parcelas x WHERE id=i;
 PERFORM public.multa36_escrever((op->>'id')::uuid,'parcelas',p,p||jsonb_build_object('multa_manual',valor,'updatedAt',instante));
 p:=p||jsonb_build_object('multa_manual',valor,'updatedAt',instante);
 esperado:=jsonb_set(esperado,'{parcelas}',(SELECT jsonb_agg(CASE WHEN (v->>'id')::int=i THEN p ELSE v END ORDER BY (v->>'id')::int) FROM jsonb_array_elements(esperado->'parcelas') v));
 INSERT INTO public.multa36_encargos VALUES(i,p_contrato_id,(op->>'id')::uuid,valor,hoje) RETURNING to_jsonb(multa36_encargos) INTO e;
 esperado:=jsonb_set(esperado,'{encargos36}',esperado->'encargos36'||jsonb_build_array(e));
 END LOOP;
 esperado:=jsonb_set(esperado,'{encargos36}',(SELECT jsonb_agg(v ORDER BY (v->>'parcela_id')::int) FROM jsonb_array_elements(esperado->'encargos36') v));
 h:=public.multimodal_nova_linha('contrato_historico')||jsonb_build_object('user_id',p_user_id::text,'contrato_id',p_contrato_id,'tipo','multa_manual','descricao','Multa fixa36 '||(op->>'id'),'valor_anterior',0,'valor_novo',valor*cardinality(ids),'created_at',instante);
 PERFORM public.multa36_escrever((op->>'id')::uuid,'contrato_historico',NULL,h); esperado:=jsonb_set(esperado,'{historico}',esperado->'historico'||jsonb_build_array(h));
 r:=jsonb_build_object('success',true,'operationId',op->>'id','repetida',false,'contratoId',p_contrato_id,'contaCaixaId',(antes->'contrato'->>'conta_caixa_id')::int,'parcelasIds',ids,'quantidade',cardinality(ids),'valorFixoPorParcela',p_multa,'valorMultaTotal',(valor*cardinality(ids))::numeric(15,2)::text,'dataCivilBrt',hoje,'estado','exigivel_nao_recebida','trilho','multa36');
 IF (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date IS DISTINCT FROM hoje THEN RAISE EXCEPTION 'Virada civil36' USING ERRCODE='40001'; END IF;
 RETURN public.multa36_selar((op->>'id')::uuid,p_contrato_id,antes,esperado,r,jsonb_build_object('parcelasIds',ids));
END $$;
CREATE FUNCTION public.multa36_cotacao(uid integer,cid integer,pid integer,instante timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; enc jsonb; multa numeric; mora numeric; devido numeric; hoje date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 s:=public.multa36_validar(uid,cid); SELECT * INTO STRICT c FROM public.contratos WHERE id=cid;
 SELECT * INTO p FROM public.parcelas WHERE id=pid AND contrato_id=cid;
 IF NOT FOUND OR p.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Parcela36 indisponível' USING ERRCODE='42501'; END IF;
 IF p.status='parcial' THEN multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=p.saldo_residual;
 ELSIF p.status='paga' THEN multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=0;
 ELSIF p.status='cancelada' AND (EXISTS(SELECT 1 FROM public.multa36_renovacoes WHERE anterior_id=p.id AND contrato_id=cid) OR EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE anterior_id=p.id AND contrato_id=cid)) THEN multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=0;
 ELSIF p.status IN('pendente','atrasada','vencendo_hoje') AND p.valor_pago=0 THEN
 enc:=public.ciclo_encargos(p.valor_original,c.multa_atraso,c.juros_mora_diario,p.data_vencimento,instante);
 SELECT valor INTO multa FROM public.multa36_encargos WHERE parcela_id=pid;
 multa:=coalesce(multa,(enc->>'multa')::numeric); mora:=(enc->>'mora')::numeric; devido:=p.valor_original+multa+mora;
 ELSE RAISE EXCEPTION 'Parcela36 transferida/não elegível' USING ERRCODE='23514'; END IF;
 IF NOT public.multimodal_moeda(devido) OR NOT public.multimodal_moeda(multa) OR NOT public.multimodal_moeda(mora) THEN RAISE EXCEPTION 'Encargos36 fora da faixa' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('elegivel',devido>0,'contratoId',cid,'parcelaId',pid,'contaCaixaId',c.conta_caixa_id,'totalExigido',devido::numeric(15,2)::text,'multa',multa::numeric(15,2)::text,'mora',mora::numeric(15,2)::text,'jurosEmbutidos',p.valor_juros::numeric(15,2)::text,'valorPagoAcumulado',p.valor_pago::numeric(15,2)::text,'dataPagamento',hoje,'vencimento',p.data_vencimento,'status',CASE WHEN p.status='cancelada' THEN 'renovada' ELSE p.status END,'estadoHash',encode(extensions.digest(s::text,'sha256'),'hex'),'regra','recebimento_multa36_brt_v1');
END $$;
CREATE FUNCTION public.rpc_cotar_multa36(p_user_id integer,p_contrato_id integer,p_parcela_id integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN
 PERFORM public.multa36_verificar(); PERFORM public.multa36_travar(p_user_id,p_contrato_id);
 RETURN public.multa36_cotacao(p_user_id,p_contrato_id,p_parcela_id,clock_timestamp());
END $$;
CREATE FUNCTION public.multa36_cotacao_renovacao(uid integer,cid integer,pid integer,novo_vencimento date,instante timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE q jsonb; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; o public.multimodal_origens%ROWTYPE; elegivel boolean; total numeric; hoje date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date; pos integer;
BEGIN
 q:=public.multa36_cotacao(uid,cid,pid,instante);
 SELECT * INTO STRICT c FROM public.contratos WHERE id=cid; SELECT * INTO STRICT p FROM public.parcelas WHERE id=pid; SELECT * INTO STRICT o FROM public.multimodal_origens WHERE contrato_id=cid;
 pos:=(SELECT count(*) FROM public.multimodal_renovacoes WHERE contrato_id=cid)+(SELECT count(*) FROM public.multa36_renovacoes WHERE contrato_id=cid)+1;
 IF novo_vencimento IS NULL OR NOT isfinite(novo_vencimento) OR novo_vencimento>DATE '9999-12-31' OR novo_vencimento<=p.data_vencimento OR novo_vencimento<hoje
 OR novo_vencimento IS DISTINCT FROM public.multimodal_data(c.data_vencimento_primeira,c.modalidade,pos) THEN RAISE EXCEPTION 'Novo vencimento36 exige próximo período ancorado' USING ERRCODE='22023'; END IF;
 elegivel:=o.numero_inicial=1 AND c.modalidade<>'tabela_price' AND c.status='ativo' AND p.status IN('pendente','atrasada','vencendo_hoje') AND p.valor_pago=0 AND p.valor_desconto=0 AND p.valor_multa=0 AND p.multa_diaria_usada=0 AND p.saldo_residual=0 AND p.data_pagamento IS NULL
 AND p.valor=p.valor_original AND p.valor_juros>0 AND p.valor_original-p.valor_juros=c.valor_principal AND p.valor_juros=round(c.valor_principal*c.taxa_juros/100,2)
 AND p.numero=pos AND p.numero_parcela=pos AND c.num_parcelas=pos AND c.numero_parcelas=pos AND c.data_vencimento=p.data_vencimento
 AND p.data_vencimento=public.multimodal_data(c.data_vencimento_primeira,c.modalidade,pos-1)
 AND (SELECT count(*) FROM public.parcelas WHERE contrato_id=cid)=pos
 AND (SELECT count(*) FROM public.parcelas WHERE contrato_id=cid AND status IN('pendente','atrasada','vencendo_hoje','parcial'))=1
 AND NOT EXISTS(SELECT 1 FROM public.multimodal_operacoes WHERE family='multimodal_receber' AND (payload->>'contratoId')::int=cid AND resultado IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM public.multa36_operacoes WHERE contrato_id=cid AND acao='receber' AND resultado IS NOT NULL);
 total:=p.valor_juros+(q->>'multa')::numeric+(q->>'mora')::numeric;
 IF NOT public.multimodal_moeda(total) THEN RAISE EXCEPTION 'Total36 fora da faixa' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('renovavel',coalesce(elegivel,false),'contratoId',cid,'parcelaId',pid,'contaCaixaId',c.conta_caixa_id,'totalExigido',total::numeric(15,2)::text,'juros',p.valor_juros::numeric(15,2)::text,'multa',q->>'multa','mora',q->>'mora','principalPreservado',c.valor_principal::numeric(15,2)::text,'dataPagamento',hoje,'novoVencimento',novo_vencimento,'estadoHash',q->>'estadoHash','regra','renovacao_multa36_brt_v1');
END $$;
CREATE FUNCTION public.rpc_cotar_renovacao_multa36(p_user_id integer,p_contrato_id integer,p_parcela_id integer,p_novo_vencimento date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN
 PERFORM public.multa36_verificar(); PERFORM public.multa36_travar(p_user_id,p_contrato_id);
 RETURN public.multa36_cotacao_renovacao(p_user_id,p_contrato_id,p_parcela_id,p_novo_vencimento,clock_timestamp());
END $$;
CREATE FUNCTION public.multa36_mutar(uid integer,chave uuid,cid integer,pid integer,valor numeric,total numeric,dia date,estado text,modo text,novo_venc date,obs text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE family text:=CASE WHEN modo='renovar' THEN 'renovar' ELSE 'receber' END;
 req jsonb; op public.multa36_operacoes%ROWTYPE; antes jsonb; esperado jsonb; c jsonb; p jsonb; n jsonb; t jsonb; h jsonb; prova jsonb; q jsonb; result jsonb;
 instante timestamptz; residual numeric; pago numeric; conta integer; cs text;
BEGIN
 PERFORM public.multa36_verificar(); PERFORM public.multa36_barreira(uid,chave);
 IF cid IS NULL OR cid<=0 OR pid IS NULL OR pid<=0 OR NOT public.multimodal_moeda(valor) OR valor<=0 OR NOT public.multimodal_moeda(total) OR total<=0
 OR dia IS NULL OR NOT isfinite(dia) OR dia NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' OR estado IS NULL OR estado !~ '^[a-f0-9]{64}$'
 OR modo IS NULL OR modo NOT IN('integral','parcial','renovar') OR length(obs)>1000 THEN RAISE EXCEPTION 'Intenção inválida: UUID/centavos/modo/DATE/hash' USING ERRCODE='22023'; END IF;
 req:=jsonb_build_object('acao',family,'modo',modo,'contratoId',cid,'parcelaId',pid,'valorRecebido',valor::numeric(15,2)::text,'totalExigido',total::numeric(15,2)::text,'dataPagamento',dia,'estadoHash',estado,'observacoes',obs);
 req:=req||CASE WHEN modo='renovar' THEN jsonb_build_object('novoVencimento',novo_venc) ELSE jsonb_build_object('modo',modo) END;
 SELECT * INTO STRICT op FROM jsonb_populate_record(NULL::public.multa36_operacoes,public.multa36_reservar(uid,chave,req));
 IF op.resultado IS NOT NULL THEN RETURN op.resultado||jsonb_build_object('repetida',true); END IF;
 PERFORM public.multa36_travar(uid,cid); instante:=clock_timestamp();
 antes:=public.multa36_validar(uid,cid); esperado:=antes;
 IF modo='renovar' THEN q:=public.multa36_cotacao_renovacao(uid,cid,pid,novo_venc,instante);
 ELSE q:=public.multa36_cotacao(uid,cid,pid,instante); END IF;
 IF q->>'estadoHash' IS DISTINCT FROM estado OR (q->>'dataPagamento')::date IS DISTINCT FROM dia OR (q->>'totalExigido')::numeric IS DISTINCT FROM total
 OR (q->(CASE WHEN modo='renovar' THEN 'renovavel' ELSE 'elegivel' END)) IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Cotação/estado/data expirou/divergiu' USING ERRCODE='40001'; END IF;
 IF (modo IN('integral','renovar') AND valor<>total) OR (modo='parcial' AND valor>=total) THEN RAISE EXCEPTION 'Integral/renovação valor exato; parcial positivo menor' USING ERRCODE='22023'; END IF;
 c:=antes->'contrato'; SELECT to_jsonb(x) INTO STRICT p FROM public.parcelas x WHERE id=pid;
 conta:=(c->>'conta_caixa_id')::integer; residual:=total-valor; pago:=(p->>'valor_pago')::numeric+valor;
 IF modo='renovar' THEN residual:=(q->>'principalPreservado')::numeric; END IF;
 p:=p||jsonb_build_object('valor_pago',pago,'valor_multa',(q->>'multa')::numeric,'multa_diaria_usada',(q->>'mora')::numeric,'saldo_residual',residual,
 'valor_desconto',0,'data_pagamento',dia,'status',CASE WHEN modo='renovar' THEN 'cancelada' WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'updatedAt',instante,
 'observacoes',nullif(btrim(obs),''));
 PERFORM public.multa36_escrever(op.id,'parcelas',(SELECT to_jsonb(x) FROM public.parcelas x WHERE id=pid),p);
 esperado:=jsonb_set(esperado,'{parcelas}',(SELECT jsonb_agg(CASE WHEN (v->>'id')::integer=pid THEN p ELSE v END ORDER BY (v->>'id')::integer) FROM jsonb_array_elements(antes->'parcelas') v));
 IF modo='renovar' THEN
 n:=public.multimodal_nova_linha('parcelas')||jsonb_build_object('user_id',uid,'contrato_id',cid,'cliente_id',(c->>'cliente_id')::integer,'koletor_id',(c->>'koletor_id')::integer,
 'conta_caixa_id',conta,'numero',(p->>'numero')::integer+1,'numero_parcela',(p->>'numero')::integer+1,'valor',(p->>'valor_original')::numeric,'valor_original',(p->>'valor_original')::numeric,
 'valor_juros',(q->>'juros')::numeric,'valor_pago',0,'valor_multa',0,'valor_desconto',0,'saldo_residual',0,'data_vencimento',novo_venc,'data_pagamento',NULL,
 'status',CASE WHEN novo_venc=dia THEN 'vencendo_hoje' ELSE 'pendente' END,'createdAt',instante,'updatedAt',instante);
 PERFORM public.multa36_escrever(op.id,'parcelas',NULL,n);
 esperado:=jsonb_set(esperado,'{parcelas}',esperado->'parcelas'||jsonb_build_array(n));
 INSERT INTO public.multa36_renovacoes VALUES(op.id,cid,pid,(n->>'id')::integer,(q->>'principalPreservado')::numeric,(q->>'juros')::numeric,(q->>'multa')::numeric,(q->>'mora')::numeric) RETURNING to_jsonb(multa36_renovacoes) INTO prova;
 esperado:=jsonb_set(esperado,'{renovacoes36}',esperado->'renovacoes36'||jsonb_build_array(prova));
 c:=c||jsonb_build_object('num_parcelas',(n->>'numero')::integer,'numero_parcelas',(n->>'numero')::integer,'valor_parcela',(n->>'valor')::numeric,'total_contrato',(n->>'valor')::numeric,
 'data_vencimento',novo_venc,'dia_vencimento',extract(day FROM novo_venc)::integer,'status','ativo','updatedAt',instante); cs:='ativo';
 ELSE
 cs:=CASE WHEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(esperado->'parcelas') v WHERE v->>'status'<>'paga' AND NOT EXISTS(SELECT 1 FROM public.multa36_renovacoes WHERE contrato_id=cid AND anterior_id=(v->>'id')::integer) AND NOT EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE contrato_id=cid AND anterior_id=(v->>'id')::integer)) THEN 'quitado' ELSE 'ativo' END;
 c:=c||jsonb_build_object('status',cs,'updatedAt',instante);
 END IF;
 PERFORM public.multa36_escrever(op.id,'contratos',antes->'contrato',c); esperado:=jsonb_set(esperado,'{contrato}',c);
 t:=public.multimodal_nova_linha('transacoes_caixa')||jsonb_build_object('user_id',uid,'conta_caixa_id',conta,'contrato_id',cid,'parcela_id',pid,
 'tipo','entrada','categoria','pagamento_parcela','valor',valor,'descricao',CASE WHEN modo='renovar' THEN 'Renovação multa36 ' ELSE 'Recebimento multa36 ' END||op.id::text,'data_transacao',dia,'createdAt',instante);
 PERFORM public.multa36_escrever(op.id,'transacoes_caixa',NULL,t);
 prova:=jsonb_build_object('total',valor::numeric(15,2)::text,'principal',CASE WHEN modo='renovar' THEN 0 ELSE least(greatest(pago-(q->>'multa')::numeric-(q->>'mora')::numeric-(p->>'valor_juros')::numeric,0), (p->>'valor_original')::numeric-(p->>'valor_juros')::numeric)-least(greatest(pago-valor-(q->>'multa')::numeric-(q->>'mora')::numeric-(p->>'valor_juros')::numeric,0),(p->>'valor_original')::numeric-(p->>'valor_juros')::numeric) END, 'juros',greatest(least(pago-(q->>'multa')::numeric-(q->>'mora')::numeric,(p->>'valor_juros')::numeric),0)-greatest(least(pago-valor-(q->>'multa')::numeric-(q->>'mora')::numeric,(p->>'valor_juros')::numeric),0), 'multa',least(pago,(q->>'multa')::numeric)-least(pago-valor,(q->>'multa')::numeric), 'mora',greatest(least(pago-(q->>'multa')::numeric,(q->>'mora')::numeric),0)-greatest(least(pago-valor-(q->>'multa')::numeric,(q->>'mora')::numeric),0));
 INSERT INTO public.multa36_pernas VALUES(op.id,(t->>'id')::integer,t,prova);
 esperado:=jsonb_set(esperado,'{ledger}',esperado->'ledger'||jsonb_build_array(t));
 h:=public.multimodal_nova_linha('contrato_historico')||jsonb_build_object('user_id',uid::text,'contrato_id',cid,'tipo',CASE WHEN modo='renovar' THEN 'renovacao' ELSE 'pagamento' END,
 'descricao',CASE WHEN modo='renovar' THEN 'Renovação multa36 ' ELSE 'Recebimento multa36 ' END||op.id::text,'valor_anterior',pago-valor,'valor_novo',pago,'created_at',instante);
 PERFORM public.multa36_escrever(op.id,'contrato_historico',NULL,h); esperado:=jsonb_set(esperado,'{historico}',esperado->'historico'||jsonb_build_array(h));
 IF modo='renovar' THEN
 result:=jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'contratoId',cid,'parcelaId',pid,'novaParcelaId',(n->>'id')::integer,'transacaoCaixaId',t->>'id','contaCaixaId',conta,
 'valorRecebido',valor::numeric(15,2)::text,'dataPagamento',dia,'novoVencimento',novo_venc,'contratoStatus','ativo','status','renovada','regra','renovacao_multa36_brt_v1');
 ELSE
 result:=jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'contratoId',cid,'parcelaId',pid,'transacaoCaixaId',t->>'id','contaCaixaId',conta,
 'valorRecebido',valor::numeric(15,2)::text,'totalExigido',total::numeric(15,2)::text,'saldoResidual',residual::numeric(15,2)::text,'valorPagoAcumulado',pago::numeric(15,2)::text,
 'dataPagamento',dia,'status',CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'contratoStatus',cs,'regra','recebimento_multa36_brt_v1');
 END IF;
 IF (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date IS DISTINCT FROM dia THEN RAISE EXCEPTION 'Virada civil durante escrita' USING ERRCODE='40001'; END IF;
 RETURN public.multa36_selar(op.id,cid,antes,esperado,result,jsonb_build_object('cotacao',q,'perna',t,'alocacao',prova));
END $$;

CREATE FUNCTION public.rpc_receber_multa36(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_parcela_id integer,p_valor_recebido text,p_total_exigido text,p_data_pagamento date,p_estado_hash text,p_modo text,p_observacoes text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF p_modo IS NULL OR p_modo NOT IN('integral','parcial') THEN RAISE EXCEPTION 'Modo36 inválido' USING ERRCODE='22023'; END IF;
 RETURN public.multa36_mutar(p_user_id,p_chave_idempotencia,p_contrato_id,p_parcela_id,public.multa36_dinheiro(p_valor_recebido),public.multa36_dinheiro(p_total_exigido),p_data_pagamento,p_estado_hash,p_modo,NULL,p_observacoes);
END $$;
CREATE FUNCTION public.rpc_renovar_multa36(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_parcela_id integer,p_valor_recebido text,p_total_exigido text,p_data_pagamento date,p_estado_hash text,p_novo_vencimento date,p_observacoes text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT public.multa36_mutar(p_user_id,p_chave_idempotencia,p_contrato_id,p_parcela_id,public.multa36_dinheiro(p_valor_recebido),public.multa36_dinheiro(p_total_exigido),p_data_pagamento,p_estado_hash,'renovar',p_novo_vencimento,p_observacoes);
$$;
CREATE FUNCTION public.rpc_identificar_multa36(p_user_id integer,p_contrato_id integer,p_parcela_id integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s text;
BEGIN
 PERFORM public.multa36_verificar(); PERFORM public.multa36_travar(p_user_id,p_contrato_id);
 IF NOT EXISTS(SELECT 1 FROM public.parcelas WHERE id=p_parcela_id AND contrato_id=p_contrato_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Parcela36 indisponível' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=p_contrato_id) THEN RETURN NULL; END IF;
 PERFORM public.multa36_validar(p_user_id,p_contrato_id);
 SELECT status INTO s FROM public.parcelas WHERE id=p_parcela_id;
 IF EXISTS(SELECT 1 FROM public.multa36_renovacoes WHERE anterior_id=p_parcela_id) OR EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE anterior_id=p_parcela_id) THEN s:='renovada'; END IF;
 RETURN jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,'trilho','multa36','status',s);
END $$;
CREATE FUNCTION public.rpc_reconciliar_multa36(p_user_id integer,p_chave_idempotencia uuid,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r jsonb; o public.multa36_operacoes%ROWTYPE; f public.multa36_fences%ROWTYPE;
BEGIN
 PERFORM public.multa36_verificar(); PERFORM public.multa36_barreira(p_user_id,p_chave_idempotencia); r:=public.multa36_request(p_request);
 PERFORM public.multa36_travar(p_user_id,(r->>'contratoId')::int);
 SELECT * INTO o FROM public.multa36_operacoes WHERE user_id=p_user_id AND chave=p_chave_idempotencia FOR UPDATE;
 IF FOUND THEN
 IF o.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'UUID36 request divergente' USING ERRCODE='23505'; END IF;
 PERFORM public.multa36_validar(p_user_id,o.contrato_id);
 IF o.resultado IS NULL OR o.auditoria->'resultado' IS DISTINCT FROM o.resultado OR o.hash_payload IS DISTINCT FROM encode(extensions.digest(r::text,'sha256'),'hex') OR o.auditoria->'request' IS DISTINCT FROM r THEN RAISE EXCEPTION 'Operação36 não comprovada' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('status','confirmed','operationId',o.id,'result',o.resultado,'idempotencyKey',p_chave_idempotencia,'proof','uuid_fenced36_v1');
 END IF;
 SELECT * INTO f FROM public.multa36_fences WHERE user_id=p_user_id AND chave=p_chave_idempotencia FOR UPDATE;
 IF FOUND AND f.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'UUID36 fechado divergente' USING ERRCODE='23505'; END IF;
 IF NOT FOUND THEN INSERT INTO public.multa36_fences VALUES(p_user_id,p_chave_idempotencia,r); END IF;
 RETURN jsonb_build_object('status','not_executed','operationId',NULL,'result',NULL,'idempotencyKey',p_chave_idempotencia,'proof','uuid_fenced36_v1');
END $$;

-- Captura antes dos guards que consomem capacidades predecessoras. Nunca aceita
-- source/owner/GUC do caller: exige witness privado próprio, pendente e linha inteira.
CREATE TABLE public.multa36_coexistencia(xid bigint NOT NULL,pid integer NOT NULL,posterior jsonb NOT NULL,PRIMARY KEY(xid,pid));
CREATE FUNCTION public.multa36_ponte() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE b jsonb:=to_jsonb(NEW); cid integer:=NEW.contrato_id; pid0 integer:=NEW.parcela_id; uid integer:=NEW.user_id; ok boolean:=false; op record; t public.transacoes_caixa%ROWTYPE; n integer;
BEGIN
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
CREATE TRIGGER a0_multa36_ponte BEFORE INSERT ON public.transacoes_caixa FOR EACH ROW EXECUTE FUNCTION public.multa36_ponte();
CREATE FUNCTION public.rpc_capacidades_multa36() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.multa36_verificar();
 RETURN jsonb_build_object('disponivel',true,'regra','multa36_v1','aplicacao',true,'recebimento',true,'renovacao',true);
END $$;
CREATE FUNCTION public.multa36_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='multa36_operacoes' AND TG_OP='UPDATE' THEN
 IF OLD.resultado IS NULL AND NEW.resultado IS NOT NULL AND (to_jsonb(OLD)-ARRAY['resultado','auditoria','concluida_em']) IS NOT DISTINCT FROM (to_jsonb(NEW)-ARRAY['resultado','auditoria','concluida_em']) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Operação/origem/encargo/perna/fence36 imutável' USING ERRCODE='42501';
END $$;
CREATE FUNCTION public.multa36_metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(extensions.digest(jsonb_build_object(
 'funcoes',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE p.proname LIKE 'multa36\_%' ESCAPE '\' OR p.proname LIKE 'rpc\_%multa36' ESCAPE '\'),
 'tables',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'multa36\_%' ESCAPE '\' AND c.relkind IN('r','S')),
 'columns',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='public'::regnamespace AND c.relname LIKE 'multa36\_%' ESCAPE '\' AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY k.oid) FROM pg_constraint k WHERE k.conrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname LIKE 'multa36\_%' ESCAPE '\')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname LIKE 'multa36\_%' ESCAPE '\')),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(t),pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t WHERE NOT t.tgisinternal AND (t.tgname LIKE '%multa36%' OR t.tgfoid IN(SELECT oid FROM pg_proc WHERE proname LIKE 'multa36\_%' ESCAPE '\')))
 )::text,'sha256'),'hex');
$$;
CREATE FUNCTION public.multa36_verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.multimodal_verificar(); PERFORM public.legados_verificar();
 IF (SELECT assinatura FROM public.multa36_manifesto WHERE id=1) IS DISTINCT FROM public.multa36_metadata() THEN RAISE EXCEPTION 'Metadata/ACL/controlguard36 desconhecido' USING ERRCODE='55000'; END IF;
END $$;
DO $acl36$ DECLARE x record; n text; BEGIN
 FOREACH n IN ARRAY ARRAY['contas_caixa','clientes','koletores','contratos','parcelas','transacoes_caixa','contrato_historico'] LOOP
 EXECUTE format('CREATE TRIGGER multa36_guard_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.multa36_guardar()',n,n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['operacoes','origens','encargos','pernas','renovacoes','fences'] LOOP
 EXECUTE format('CREATE TRIGGER multa36_immutable BEFORE UPDATE OR DELETE ON public.multa36_%I FOR EACH ROW EXECUTE FUNCTION public.multa36_imutavel()',n);
 END LOOP;
 FOR x IN SELECT oid,relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'multa36\_%' ESCAPE '\' LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',x.relname); EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',x.relname);
 END LOOP;
 FOR x IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'multa36\_%' ESCAPE '\' OR proname LIKE 'rpc\_%multa36' ESCAPE '\') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',x.oid::regprocedure);
 IF x.proname LIKE 'rpc\_%' ESCAPE '\' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',x.oid::regprocedure); END IF;
 END LOOP;
END $acl36$;
-- Exatamente três extensões versionadas; objetos já existentes restantes intocados.
DO $post36$
DECLARE expected jsonb; actual jsonb; names text[]; witness jsonb; x jsonb; obj jsonb;
BEGIN
 -- POST MANIFEST
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(expected) f;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO actual FROM (
 SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO expected FROM jsonb_array_elements(expected) f;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Postflight36 fonte/config/overload diferente da extensão prevista' USING ERRCODE='55000'; END IF;
 SELECT s INTO STRICT witness FROM multa36_ddl_witness;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(witness->'functions','null'::jsonb),'[]'::jsonb)) LOOP
 SELECT to_jsonb(p) INTO obj FROM pg_proc p WHERE oid=(x->>0)::oid;
 IF obj IS DISTINCT FROM x->1 THEN RAISE EXCEPTION 'Postflight36 função intocada divergiu' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(witness->'relations','null'::jsonb),'[]'::jsonb)) LOOP
 SELECT to_jsonb(c) INTO obj FROM pg_class c WHERE oid=(x->>'oid')::oid;
 IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Postflight36 tabela/ACL predecessora divergiu %',x->>'relname' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(witness->'attributes','null'::jsonb),'[]'::jsonb)) LOOP
 SELECT to_jsonb(a) INTO obj FROM pg_attribute a WHERE attrelid=(x->>'attrelid')::oid AND attnum=(x->>'attnum')::int;
 IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Postflight36 coluna/ACL predecessora divergiu' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(witness->'triggers','null'::jsonb),'[]'::jsonb)) LOOP
 SELECT to_jsonb(t) INTO obj FROM pg_trigger t WHERE oid=(x->>'oid')::oid;
 IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Postflight36 trigger predecessor divergiu' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(witness->'constraints','null'::jsonb),'[]'::jsonb)) LOOP
 SELECT to_jsonb(k) INTO obj FROM pg_constraint k WHERE oid=(x->>'oid')::oid;
 IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Postflight36 constraint predecessora divergiu' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(nullif(witness->'policies','null'::jsonb),'[]'::jsonb)) LOOP
 SELECT to_jsonb(p) INTO obj FROM pg_policy p WHERE oid=(x->>'oid')::oid;
 IF obj IS DISTINCT FROM x THEN RAISE EXCEPTION 'Postflight36 policy predecessora divergiu' USING ERRCODE='55000'; END IF;
 END LOOP;
END $post36$;
-- Somente instalação, após prova de fonte e witness; nunca chamado no runtime.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
INSERT INTO public.multa36_manifesto VALUES(1,public.multa36_metadata());
SELECT public.multa36_verificar();
COMMIT;
