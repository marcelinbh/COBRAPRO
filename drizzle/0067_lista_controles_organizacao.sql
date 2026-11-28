-- Organização67: catálogo PRIVADO próprio + label_overlay. Nunca UPDATE contratos/parcelas/caixa.
-- NULL contratos.etiquetas = ausência textual confirmada; JSON inválido = indisponível.
-- etiquetas_contratos antigo é por contrato, SEM user_id; preservado e não usado como catálogo.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $pre67$ BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION '67 instalador/contexto inválido' USING ERRCODE='55000'; END IF;
 IF to_regnamespace('lista_controles67') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('rpc_lista_emprestimos67','rpc_etiquetas_criar67','rpc_etiquetas_remover67','rpc_etiquetas_aplicar67')) THEN RAISE EXCEPTION '67 superfície existente/desconhecida' USING ERRCODE='55000'; END IF;
 PERFORM public.legados_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.multa36_verificar(); PERFORM public.caixa37_verificar();
 PERFORM despesa_cancelamento_v1.verificar(); PERFORM telefone41.verificar(); PERFORM manutencao44.verificar(); PERFORM caixa_manutencao45.verificar(); PERFORM calendario46.verificar();
 PERFORM private47.verificar(); PERFORM manutencao48.verificar(); PERFORM despesas49.verificar(); PERFORM obrigacoes51.verificar(); PERFORM inclusao52.verificar(); PERFORM sucessores53.verificar(); PERFORM emprestimos_lista60.verificar();
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.caixa37_metadata()'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '088bced7e8df832b95b32a44f83c2d19450eaa076c487179df54b410dd224280' THEN RAISE EXCEPTION '67 expressão37 desconhecida' USING ERRCODE='55000'; END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='emprestimos_lista60.lista(integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '16a981fed7269c88cdfbcea038b30c26a97a2302d1c0f04c824fe98db1fc16f1' THEN RAISE EXCEPTION '67 fonte60 intacta obrigatória: emprestimos_lista60.lista' USING ERRCODE='55000'; END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='emprestimos_lista60.metadata()'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '62c4a7779a43b381af6710612cde5dedd4b01da537f8424676c80c79739cddfb' THEN RAISE EXCEPTION '67 fonte60 intacta obrigatória: emprestimos_lista60.metadata' USING ERRCODE='55000'; END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='emprestimos_lista60.verificar()'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'f427c84a4d57d8e01409fa9643d16b46572584024eb25f4c2d8e1c7d7a5256f1' THEN RAISE EXCEPTION '67 fonte60 intacta obrigatória: emprestimos_lista60.verificar' USING ERRCODE='55000'; END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.rpc_lista_emprestimos60(integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '891d0bc20ff96f1da3df019a4c566b2caf9f276a32b43e6288d27db4b0ad0cdd' THEN RAISE EXCEPTION '67 fonte60 intacta obrigatória: public.rpc_lista_emprestimos60' USING ERRCODE='55000'; END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.verificar()'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8f587261d12bad22e26b6a3381f2c8004c6ab950faf1a9c3dd5e6932778e7074' THEN RAISE EXCEPTION '67 compilado54 divergente' USING ERRCODE='55000'; END IF;
 -- Inventário seletivo REAL, não o schema Drizzle antigo. Nenhum dado é reparado.
 IF (SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) FROM pg_attribute WHERE attrelid=to_regclass('public.etiquetas_contratos') AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM
 '[ ["id","bigint",true],["contrato_id","bigint",true],["nome","character varying(50)",true],["cor","character varying(20)",true],["created_at","timestamp with time zone",false] ]'::jsonb THEN RAISE EXCEPTION '67 schema antigo etiquetas divergente' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.etiquetas_contratos'::regclass AND contype='p' AND conkey=ARRAY[1]::smallint[]) OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.etiquetas_contratos'::regclass AND contype='f' AND confrelid='public.contratos'::regclass AND confdeltype='c' AND conkey=ARRAY[2]::smallint[]) THEN RAISE EXCEPTION '67 vínculos antigos etiquetas desconhecidos' USING ERRCODE='55000'; END IF;
 IF (SELECT pg_get_expr(adbin,adrelid) FROM pg_attrdef WHERE adrelid='public.etiquetas_contratos'::regclass AND adnum=4) IS DISTINCT FROM '''#6b7280''::character varying' THEN RAISE EXCEPTION '67 default antigo cor divergente' USING ERRCODE='55000'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attname) FROM pg_attribute WHERE attrelid=to_regclass('public.koletores') AND attname IN('id','user_id','nome','perfil','ativo') AND NOT attisdropped) IS DISTINCT FROM
 '[["ativo","boolean",true],["id","integer",true],["nome","character varying(255)",true],["perfil","character varying(20)",true],["user_id","integer",false]]'::jsonb THEN RAISE EXCEPTION '67 schema real koletores divergente' USING ERRCODE='55000'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attname) FROM pg_attribute WHERE attrelid=to_regclass('public.contratos') AND attname IN('id','user_id','koletor_id','etiquetas') AND NOT attisdropped) IS DISTINCT FROM
 '[["etiquetas","text",false],["id","integer",true],["koletor_id","integer",false],["user_id","integer",false]]'::jsonb THEN RAISE EXCEPTION '67 schema real contratos divergente' USING ERRCODE='55000'; END IF;
END $pre67$;
-- Captura corrente válida: aceita selos avançados legitimamente, nunca fixa hash37 pós60.
CREATE TEMP TABLE witness67_functions AS SELECT oid,to_jsonb(p) row,pg_get_functiondef(oid) definition FROM pg_proc p WHERE prokind IN('f','p');
CREATE TEMP TABLE witness67_catalog AS
 SELECT 'class' kind,c.oid,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] row FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions')
 UNION ALL SELECT 'namespace',oid,to_jsonb(n) FROM pg_namespace n WHERE nspname !~ '^pg_' AND nspname NOT IN('information_schema','extensions')
 UNION ALL SELECT 'constraint',oid,to_jsonb(k) FROM pg_constraint k
 UNION ALL SELECT 'trigger',oid,to_jsonb(t) FROM pg_trigger t
 UNION ALL SELECT 'policy',oid,to_jsonb(p) FROM pg_policy p
 UNION ALL SELECT 'default',oid,to_jsonb(d) FROM pg_attrdef d
 UNION ALL SELECT 'index',indexrelid,to_jsonb(i) FROM pg_index i;
CREATE TEMP TABLE witness67_attributes AS SELECT attrelid,attnum,to_jsonb(a) row FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions');
CREATE TEMP TABLE witness67_data(rel text PRIMARY KEY,hash text NOT NULL);
DO $data67$ DECLARE t record; h text; projection text; BEGIN
 FOR t IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') ORDER BY n.nspname,c.relname LOOP
  -- Somente instalação: preimagem estável, sem writer concorrente mascarado como drift.
  -- Exceção fechada: somente cinco managed tables autenticadas; nunca fallback por falta de ACL.
  IF (t.nspname,t.relname) IN (('auth','schema_migrations'),('realtime','schema_migrations'),('storage','buckets_vectors'),('storage','migrations'),('storage','vector_indexes')) THEN
   EXECUTE format('LOCK TABLE ONLY %I.%I IN ACCESS SHARE MODE NOWAIT',t.nspname,t.relname);
   IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=t.oid) IS DISTINCT FROM
      (CASE t.nspname WHEN 'auth' THEN 'supabase_auth_admin' WHEN 'realtime' THEN 'supabase_admin' WHEN 'storage' THEN 'supabase_storage_admin' END)
      OR NOT has_table_privilege(current_user,t.oid,'SELECT')
      OR has_table_privilege(current_user,t.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(current_user,t.oid,'INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION '67 managed readonly/owner/ACL divergente: %.%',t.nspname,t.relname USING ERRCODE='55000';
   END IF;
  ELSE
  EXECUTE format('LOCK TABLE ONLY %I.%I IN SHARE MODE NOWAIT',t.nspname,t.relname);
  END IF;
  projection:=CASE WHEN t.nspname='public' AND t.relname='caixa37_manifesto' THEN 'to_jsonb(x)-''assinatura''' ELSE 'to_jsonb(x)' END;
  EXECUTE format('SELECT encode(extensions.digest(coalesce(jsonb_agg(%s ORDER BY (%s)::text),''[]''::jsonb)::text,''sha256''),''hex'') FROM %I.%I x',projection,projection,t.nspname,t.relname) INTO h;
  INSERT INTO witness67_data VALUES(t.nspname||'.'||t.relname,h);
 END LOOP;
END $data67$;
CREATE TEMP TABLE witness67_seal AS SELECT assinatura FROM public.caixa37_manifesto WHERE id=1;
CREATE SCHEMA lista_controles67 AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA lista_controles67 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION lista_controles67.nomes_validos(n text[]) RETURNS boolean IMMUTABLE LANGUAGE sql SET search_path=pg_catalog,pg_temp AS $$
 SELECT n IS NOT NULL AND coalesce(array_ndims(n),1)=1 AND cardinality(n)<=32 AND NOT EXISTS(SELECT 1 FROM unnest(n) x WHERE x IS NULL OR length(x) NOT BETWEEN 1 AND 80 OR x<>btrim(x) OR x ~ '[[:cntrl:]]') AND cardinality(n)=(SELECT count(DISTINCT x) FROM unnest(n) x);
$$;
CREATE TABLE lista_controles67.catalogo(user_id integer NOT NULL CHECK(user_id>0),id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK(id BETWEEN 1 AND 9999999999999999),nome text NOT NULL CHECK(length(nome) BETWEEN 1 AND 80 AND nome=btrim(nome) AND nome !~ '[[:cntrl:]]'),cor text NOT NULL CHECK(cor ~ '^#[0-9a-fA-F]{6}$'),UNIQUE(user_id,nome));
CREATE TABLE lista_controles67.etiquetas_por_contrato(user_id integer NOT NULL CHECK(user_id>0),contrato_id integer NOT NULL CHECK(contrato_id>0),etiquetas text[] NOT NULL CHECK(lista_controles67.nomes_validos(etiquetas)),revisao bigint NOT NULL CHECK(revisao BETWEEN 1 AND 9999999999999998),PRIMARY KEY(user_id,contrato_id));
CREATE TABLE lista_controles67.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL CHECK(assinatura ~ '^[a-f0-9]{64}$'));
ALTER TABLE lista_controles67.catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_controles67.etiquetas_por_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_controles67.manifesto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA lista_controles67 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA lista_controles67 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION lista_controles67.etiquetas(uid integer,cid integer,legacy text,label_overlay text[],revision bigint) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE n text[]:=label_overlay; rev bigint:=revision; j jsonb; h text;
BEGIN
 IF rev IS NULL THEN
  rev:=0;
  IF legacy IS NULL THEN n:=ARRAY[]::text[];
  ELSE
   IF octet_length(legacy)>16384 THEN RETURN jsonb_build_object('state','unavailable'); END IF;
   BEGIN j:=legacy::jsonb; EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('state','unavailable'); END;
   IF jsonb_typeof(j)<>'array' THEN RETURN jsonb_build_object('state','unavailable'); END IF;
   IF jsonb_array_length(j)>32 OR EXISTS(SELECT 1 FROM jsonb_array_elements(j) e WHERE jsonb_typeof(e)<>'string') THEN RETURN jsonb_build_object('state','unavailable'); END IF;
   SELECT coalesce(array_agg(e ORDER BY ord),ARRAY[]::text[]) INTO n FROM jsonb_array_elements_text(j) WITH ORDINALITY x(e,ord);
  END IF;
 END IF;
 IF NOT lista_controles67.nomes_validos(n) THEN RETURN jsonb_build_object('state','unavailable'); END IF;
 h:=encode(extensions.digest(jsonb_build_array(uid,cid,rev::text,to_jsonb(n))::text,'sha256'),'hex');
 RETURN jsonb_build_object('state','confirmed','nomes',to_jsonb(n),'revisao',rev::text,'estadoHash',h);
END $$;
CREATE FUNCTION lista_controles67.lista(uid integer) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; cat jsonb; roster jsonb; meta jsonb; nr bigint;
BEGIN
 PERFORM lista_controles67.verificar();
 s:=emprestimos_lista60.lista(uid); -- UMA chamada intacta; metadados compartilham o snapshot STABLE do statement.
 SELECT count(*) INTO nr FROM lista_controles67.catalogo WHERE user_id=uid;
 IF nr>256 THEN RETURN jsonb_build_object('versao','lista_emprestimos67_v1','userId',uid,'lista60',s,'organizacao67',jsonb_build_object('state','unavailable','scope','ALLscope')); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id::text,'userId',user_id,'nome',nome,'cor',cor) ORDER BY id),'[]'::jsonb) INTO cat FROM (SELECT id,user_id,nome,cor FROM lista_controles67.catalogo WHERE user_id=uid ORDER BY id LIMIT 256) c;
 WITH valid AS MATERIALIZED(SELECT (i->>'id')::integer id,(i->'contrato'->>'koletor_id')::integer collector FROM jsonb_array_elements(s->'items') i WHERE i->>'kind'='validated')
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',k.id,'userId',k.user_id,'nome',k.nome) ORDER BY k.id),'[]'::jsonb) INTO roster FROM public.koletores k WHERE k.user_id=uid AND k.nome<>'' AND k.id IN(SELECT collector FROM valid);
 WITH valid AS MATERIALIZED(SELECT (i->>'id')::integer id,(i->'contrato'->>'koletor_id')::integer collector FROM jsonb_array_elements(s->'items') i WHERE i->>'kind'='validated')
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'cobrador',CASE WHEN v.collector IS NULL OR k.id IS NOT NULL THEN jsonb_build_object('state','confirmed','id',v.collector) ELSE jsonb_build_object('state','unavailable') END,'etiquetas',lista_controles67.etiquetas(uid,v.id,c.etiquetas,o.etiquetas,o.revisao)) ORDER BY v.id),'[]'::jsonb) INTO meta FROM valid v JOIN public.contratos c ON c.id=v.id AND c.user_id=uid LEFT JOIN lista_controles67.etiquetas_por_contrato o ON o.user_id=uid AND o.contrato_id=v.id LEFT JOIN public.koletores k ON k.id=v.collector AND k.user_id=uid AND k.nome<>'';
 RETURN jsonb_build_object('versao','lista_emprestimos67_v1','userId',uid,'lista60',s,'organizacao67',jsonb_build_object('state','confirmed','scope','ALLscope','catalogo',cat,'cobradores',roster,'contratos',meta));
END $$;
CREATE FUNCTION public.rpc_lista_emprestimos67(p_user_id integer) RETURNS jsonb STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$ SELECT lista_controles67.lista(p_user_id); $$;
CREATE FUNCTION lista_controles67.travar(uid integer) RETURNS void VOLATILE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF uid IS NULL OR uid<=0 THEN RAISE EXCEPTION '67 sessão inválida' USING ERRCODE='22023'; END IF;
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION '67 contexto inválido' USING ERRCODE='55000'; END IF;
 PERFORM lista_controles67.verificar(); PERFORM emprestimos_lista60.verificar(); PERFORM public.caixa37_verificar();
 IF NOT pg_try_advisory_xact_lock(670067,uid) THEN RAISE EXCEPTION '67 organização em edição' USING ERRCODE='55P03'; END IF;
END $$;
CREATE FUNCTION lista_controles67.criar(uid integer,n text,c text) RETURNS jsonb VOLATILE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE label_id bigint;
BEGIN
 PERFORM lista_controles67.travar(uid);
 IF NOT lista_controles67.nomes_validos(ARRAY[n]) OR c IS NULL OR c !~ '^#[0-9a-fA-F]{6}$' THEN RAISE EXCEPTION '67 etiqueta inválida' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM lista_controles67.catalogo WHERE user_id=uid)>=256 THEN RAISE EXCEPTION '67 catálogo excede limite' USING ERRCODE='22023'; END IF;
 INSERT INTO lista_controles67.catalogo(user_id,nome,cor) VALUES(uid,n,c) RETURNING id INTO label_id;
 RETURN jsonb_build_object('versao','etiquetas_lista67_v1','userId',uid,'acao','criar','id',label_id::text,'contratoId',NULL,'revisao',NULL);
END $$;
CREATE FUNCTION lista_controles67.remover(uid integer,label_id bigint) RETURNS jsonb VOLATILE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE nr integer;
BEGIN
 PERFORM lista_controles67.travar(uid);
 DELETE FROM lista_controles67.catalogo WHERE user_id=uid AND id=label_id;
 GET DIAGNOSTICS nr=ROW_COUNT;
 IF nr<>1 THEN RAISE EXCEPTION '67 etiqueta própria não confirmada' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('versao','etiquetas_lista67_v1','userId',uid,'acao','remover','id',label_id::text,'contratoId',NULL,'revisao',NULL);
END $$;
CREATE FUNCTION lista_controles67.aplicar(uid integer,cid integer,n text[],rev bigint,hash text) RETURNS jsonb VOLATILE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE c public.contratos%ROWTYPE; s jsonb; current_labels jsonb; nr integer; label_overlay text[]; revision bigint;
BEGIN
 PERFORM lista_controles67.travar(uid);
 IF cid IS NULL OR cid<=0 OR rev IS NULL OR rev<0 OR rev>=9999999999999998 OR hash IS NULL OR hash !~ '^[a-f0-9]{64}$' OR NOT lista_controles67.nomes_validos(n) THEN RAISE EXCEPTION '67 proposta inválida' USING ERRCODE='22023'; END IF;
 -- Impede ABA de vínculo/owner durante a pequena transação; nunca trava conta/livro.
 SELECT * INTO c FROM public.contratos WHERE id=cid AND user_id=uid FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION '67 contrato próprio não confirmado' USING ERRCODE='42501'; END IF;
 -- Roster é metadata: SHARE fail-fast impede phantom de perfil/ativo até commit.
 LOCK TABLE public.koletores IN SHARE MODE NOWAIT;
 s:=emprestimos_lista60.lista(uid);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'items') i WHERE i->>'kind'='validated' AND (i->>'id')::integer=cid AND (i->'contrato'->>'koletor_id')::integer IS NOT DISTINCT FROM c.koletor_id) THEN RAISE EXCEPTION '67 contrato fora do escopo validado' USING ERRCODE='42501'; END IF;
 SELECT etiquetas,revisao INTO label_overlay,revision FROM lista_controles67.etiquetas_por_contrato WHERE user_id=uid AND contrato_id=cid;
 current_labels:=lista_controles67.etiquetas(uid,cid,c.etiquetas,label_overlay,revision);
 IF current_labels->>'state'<>'confirmed' THEN RAISE EXCEPTION '67 etiquetas antigas indisponíveis' USING ERRCODE='23514'; END IF;
 IF (current_labels->>'revisao')::bigint<>rev OR current_labels->>'estadoHash' IS DISTINCT FROM hash THEN RAISE EXCEPTION '67 revisão mudou' USING ERRCODE='40001'; END IF;
 -- Novas aplicações só no catálogo próprio. Históricos atuais podem permanecer/remover.
 IF EXISTS(SELECT 1 FROM unnest(n) name WHERE NOT EXISTS(SELECT 1 FROM lista_controles67.catalogo l WHERE l.user_id=uid AND l.nome=name) AND NOT (current_labels->'nomes' ? name)) THEN RAISE EXCEPTION '67 etiqueta fora do catálogo próprio' USING ERRCODE='22023'; END IF;
 IF rev=0 THEN
  INSERT INTO lista_controles67.etiquetas_por_contrato(user_id,contrato_id,etiquetas,revisao) VALUES(uid,cid,n,1) ON CONFLICT DO NOTHING;
 ELSE
  UPDATE lista_controles67.etiquetas_por_contrato SET etiquetas=n,revisao=rev+1 WHERE user_id=uid AND contrato_id=cid AND revisao=rev;
 END IF;
 GET DIAGNOSTICS nr=ROW_COUNT;
 IF nr<>1 THEN RAISE EXCEPTION '67 CAS falhou' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('versao','etiquetas_lista67_v1','userId',uid,'acao','aplicar','id',NULL,'contratoId',cid,'revisao',(rev+1)::text);
END $$;
CREATE FUNCTION public.rpc_etiquetas_criar67(p_user_id integer,p_nome text,p_cor text) RETURNS jsonb VOLATILE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT lista_controles67.criar(p_user_id,p_nome,p_cor); $$;
CREATE FUNCTION public.rpc_etiquetas_remover67(p_user_id integer,p_id bigint) RETURNS jsonb VOLATILE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT lista_controles67.remover(p_user_id,p_id); $$;
CREATE FUNCTION public.rpc_etiquetas_aplicar67(p_user_id integer,p_contrato_id integer,p_nomes text[],p_revisao bigint,p_estado_hash text) RETURNS jsonb VOLATILE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT lista_controles67.aplicar(p_user_id,p_contrato_id,p_nomes,p_revisao,p_estado_hash); $$;
CREATE FUNCTION lista_controles67.metadata() RETURNS text STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(extensions.digest(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='lista_controles67'::regnamespace OR p.oid IN('public.rpc_lista_emprestimos67(integer)'::regprocedure,'public.rpc_etiquetas_criar67(integer,text,text)'::regprocedure,'public.rpc_etiquetas_remover67(integer,bigint)'::regprocedure,'public.rpc_etiquetas_aplicar67(integer,integer,text[],bigint,text)'::regprocedure,'extensions.digest(text,text)'::regprocedure)),
 'namespace',(SELECT to_jsonb(n) FROM pg_namespace n WHERE oid='lista_controles67'::regnamespace),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY oid) FROM pg_class c WHERE relnamespace='lista_controles67'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='lista_controles67'::regnamespace AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(oid)) ORDER BY oid) FROM pg_constraint k WHERE connamespace='lista_controles67'::regnamespace),
 'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='lista_controles67'::regnamespace),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(t),pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='lista_controles67'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='lista_controles67'::regnamespace),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) ORDER BY oid) FROM pg_roles WHERE rolname IN('postgres','service_role','anon','authenticated'))
 )::text,'sha256'),'hex');
$$;
CREATE FUNCTION lista_controles67.verificar() RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF (SELECT assinatura FROM lista_controles67.manifesto WHERE id=1) IS DISTINCT FROM lista_controles67.metadata() THEN RAISE EXCEPTION '67 organização desconhecida; sem resselo' USING ERRCODE='55000'; END IF;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lista_controles67 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_lista_emprestimos67(integer),public.rpc_etiquetas_criar67(integer,text,text),public.rpc_etiquetas_remover67(integer,bigint),public.rpc_etiquetas_aplicar67(integer,integer,text[],bigint,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lista_emprestimos67(integer),public.rpc_etiquetas_criar67(integer,text,text),public.rpc_etiquetas_remover67(integer,bigint),public.rpc_etiquetas_aplicar67(integer,integer,text[],bigint,text) TO service_role;
DO $surface67$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='lista_controles67.nomes_validos(text[])'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='7f91c524b4f1a769983c785e559dbf81c42eafc04eec141e93747bca765538eb' AND p.provolatile='i' AND p.prosecdef=false AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: lista_controles67.nomes_validos' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='lista_controles67.etiquetas(integer,integer,text,text[],bigint)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='ed9f4016bd575c148be9d7cacf27ea6ea37ed01e12580e4fddd737b279963521' AND p.provolatile='s' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: lista_controles67.etiquetas' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='lista_controles67.lista(integer)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='523b23db009dc395de6ad01cdd0154cdfa73be0b90dba433203f4e274f7803bb' AND p.provolatile='s' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp','TimeZone=UTC']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: lista_controles67.lista' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_lista_emprestimos67(integer)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='dfae52914facc942cf9ae8901a0e63e5bf6ca08e0d647db427654c278b026e87' AND p.provolatile='s' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp','TimeZone=UTC']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: public.rpc_lista_emprestimos67' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='lista_controles67.travar(integer)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='a095a5f494134c5cedbb40b96af70c87dbf239b6383bfcd3ae191347c741d007' AND p.provolatile='v' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: lista_controles67.travar' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='lista_controles67.criar(integer,text,text)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='7e191dd236336f90d98cdfec562674bb380f92d3d8282850495051e3c1c57c5e' AND p.provolatile='v' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: lista_controles67.criar' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='lista_controles67.remover(integer,bigint)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='1adc520530195ff20bf92525042013b24fcfebd24d30e8b350b417a49d45b8ac' AND p.provolatile='v' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: lista_controles67.remover' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='lista_controles67.aplicar(integer,integer,text[],bigint,text)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='7eb6ab73a73b490975ca70bacd4bc03fd6d805c2070702ba643a8470cfb88fff' AND p.provolatile='v' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: lista_controles67.aplicar' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_etiquetas_criar67(integer,text,text)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='b897db600f28ccd3546750b8d62561e3ef95fcef48bed0f5f305661e2dc44da2' AND p.provolatile='v' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: public.rpc_etiquetas_criar67' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_etiquetas_remover67(integer,bigint)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='c80443555cf425b0934e96154387d12c03a79587b613fe9e0692149e5b714b3a' AND p.provolatile='v' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: public.rpc_etiquetas_remover67' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.rpc_etiquetas_aplicar67(integer,integer,text[],bigint,text)'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='777cc410f22a8519433ac230a3999e2762061ef3e14a4c238191354690065cb5' AND p.provolatile='v' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: public.rpc_etiquetas_aplicar67' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='lista_controles67.metadata()'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='c559638ddd815c440d7d510cb9135b5831d3e0cea2acb3e7e7adad19d19d2191' AND p.provolatile='s' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: lista_controles67.metadata' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='lista_controles67.verificar()'::regprocedure AND encode(extensions.digest(p.prosrc,'sha256'),'hex')='f79353603754a0a2648b04325856cc6b3a6607adbf3797360ce7c9b67bd04f44' AND p.provolatile='s' AND p.prosecdef=true AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[] AND p.proowner='postgres'::regrole) THEN RAISE EXCEPTION '67 fonte/contexto novo divergente: lista_controles67.verificar' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='lista_controles67'::regnamespace AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION '67 ACL privada divergente' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN('public.rpc_lista_emprestimos67(integer)'::regprocedure,'public.rpc_etiquetas_criar67(integer,text,text)'::regprocedure,'public.rpc_etiquetas_remover67(integer,bigint)'::regprocedure,'public.rpc_etiquetas_aplicar67(integer,integer,text[],bigint,text)'::regprocedure) AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR NOT has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION '67 ACL facade divergente' USING ERRCODE='55000'; END IF;
END $surface67$;
INSERT INTO lista_controles67.manifesto VALUES(1,lista_controles67.metadata());
-- DELTA37 EXATO inserido a seguir: excluir SOMENTE os quatro OIDs de facade67.
DO $post67$ DECLARE old text; derived text; final text; nr integer; rr record; h text; projection text; current_row jsonb; BEGIN
 SELECT assinatura INTO STRICT old FROM witness67_seal;
 SELECT public.caixa37_hash(jsonb_build_object(
 'funcoes',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE (p.pronamespace='public'::regnamespace OR p.proname LIKE 'caixa37\_%' ESCAPE '\' OR p.proname LIKE 'rpc\_%caixa37' ESCAPE '\') AND p.oid NOT IN('public.rpc_lista_emprestimos67(integer)'::regprocedure,'public.rpc_etiquetas_criar67(integer,text,text)'::regprocedure,'public.rpc_etiquetas_remover67(integer,bigint)'::regprocedure,'public.rpc_etiquetas_aplicar67(integer,integer,text[],bigint,text)'::regprocedure)),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='public'::regnamespace AND a.attnum>0),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(t),pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) ORDER BY oid) FROM pg_roles WHERE rolname IN('service_role','anon','authenticated',current_user)),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m WHERE member IN(SELECT oid FROM pg_roles WHERE rolname IN('service_role','anon','authenticated'))))) INTO derived;
 IF derived IS DISTINCT FROM old THEN RAISE EXCEPTION '67 predecessores37 divergentes; sem resselo oportunista' USING ERRCODE='55000'; END IF;
 final:=public.caixa37_metadata();
 UPDATE public.caixa37_manifesto SET assinatura=final WHERE id=1 AND assinatura=old;
 GET DIAGNOSTICS nr=ROW_COUNT; IF nr<>1 THEN RAISE EXCEPTION '67 CAS selo37 falhou' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM witness67_functions w LEFT JOIN pg_proc p ON p.oid=w.oid WHERE p.oid IS NULL OR to_jsonb(p) IS DISTINCT FROM w.row OR pg_get_functiondef(p.oid) IS DISTINCT FROM w.definition) THEN RAISE EXCEPTION '67 função/config/ACL predecessora alterada' USING ERRCODE='55000'; END IF;
 FOR rr IN SELECT * FROM witness67_catalog LOOP
  CASE rr.kind
   WHEN 'class' THEN SELECT to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] INTO current_row FROM pg_class c WHERE oid=rr.oid;
   WHEN 'namespace' THEN SELECT to_jsonb(n) INTO current_row FROM pg_namespace n WHERE oid=rr.oid;
   WHEN 'constraint' THEN SELECT to_jsonb(k) INTO current_row FROM pg_constraint k WHERE oid=rr.oid;
   WHEN 'trigger' THEN SELECT to_jsonb(t) INTO current_row FROM pg_trigger t WHERE oid=rr.oid;
   WHEN 'policy' THEN SELECT to_jsonb(p) INTO current_row FROM pg_policy p WHERE oid=rr.oid;
   WHEN 'default' THEN SELECT to_jsonb(d) INTO current_row FROM pg_attrdef d WHERE oid=rr.oid;
   WHEN 'index' THEN SELECT to_jsonb(i) INTO current_row FROM pg_index i WHERE indexrelid=rr.oid;
  END CASE;
  IF current_row IS DISTINCT FROM rr.row THEN RAISE EXCEPTION '67 catálogo predecessor alterado' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM witness67_attributes w LEFT JOIN pg_attribute a ON a.attrelid=w.attrelid AND a.attnum=w.attnum WHERE to_jsonb(a) IS DISTINCT FROM w.row) THEN RAISE EXCEPTION '67 atributo predecessor alterado' USING ERRCODE='55000'; END IF;
 FOR rr IN SELECT rel,hash FROM witness67_data ORDER BY rel LOOP
  projection:=CASE WHEN rr.rel='public.caixa37_manifesto' THEN 'to_jsonb(x)-''assinatura''' ELSE 'to_jsonb(x)' END;
  EXECUTE format('SELECT encode(extensions.digest(coalesce(jsonb_agg(%s ORDER BY (%s)::text),''[]''::jsonb)::text,''sha256''),''hex'') FROM %s x',projection,projection,rr.rel::regclass) INTO h;
  IF h IS DISTINCT FROM rr.hash THEN RAISE EXCEPTION '67 dados predecessores alterados: %',rr.rel USING ERRCODE='55000'; END IF;
 END LOOP;
 PERFORM public.legados_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.multa36_verificar(); PERFORM public.caixa37_verificar();
 PERFORM despesa_cancelamento_v1.verificar(); PERFORM telefone41.verificar(); PERFORM manutencao44.verificar(); PERFORM caixa_manutencao45.verificar(); PERFORM calendario46.verificar();
 PERFORM private47.verificar(); PERFORM manutencao48.verificar(); PERFORM despesas49.verificar(); PERFORM obrigacoes51.verificar(); PERFORM inclusao52.verificar(); PERFORM sucessores53.verificar(); PERFORM emprestimos_lista60.verificar(); PERFORM lista_controles67.verificar();
END $post67$;
DROP TABLE witness67_functions,witness67_catalog,witness67_attributes,witness67_data,witness67_seal;
COMMIT;
