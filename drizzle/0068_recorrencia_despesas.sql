-- 68: extensão aditiva pós composição20/25/35/37/38c/49/51->54->52->53->58->60
-- Aceita67 aditiva legítima: preimagem37 CORRENTE válida, nunca assinatura pós60 fixa.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
DO $pre68$ BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::integer/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION '68 requer PG17/Read Committed' USING ERRCODE='55000'; END IF;
 IF to_regnamespace('despesas68') IS NOT NULL THEN RAISE EXCEPTION '68 já instalada ou namespace ocupado' USING ERRCODE='55000'; END IF;
 PERFORM public.caixa37_verificar(); PERFORM despesas49.verificar(); PERFORM despesa_cancelamento_v1.verificar();
 PERFORM obrigacoes51.verificar(); PERFORM inclusao52.verificar(); PERFORM sucessores53.verificar(); PERFORM emprestimos_lista60.verificar();
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.verificar()'::regprocedure),'sha256'),'hex') <> '8f587261d12bad22e26b6a3381f2c8004c6ab950faf1a9c3dd5e6932778e7074' THEN RAISE EXCEPTION '68 compilado54 divergente' USING ERRCODE='55000'; END IF;
END $pre68$;
-- Serializa extensões aditivas; não interfere nos locks financeiros por owner/UUID.
SELECT pg_advisory_xact_lock(hashtextextended('cobrapro:additive:public37',68));
LOCK TABLE public.caixa37_manifesto IN SHARE ROW EXCLUSIVE MODE;
SELECT public.caixa37_verificar();
CREATE TEMP TABLE witness68_seal ON COMMIT DROP AS SELECT assinatura FROM public.caixa37_manifesto WHERE id=1;
CREATE TEMP TABLE witness68_functions ON COMMIT DROP AS SELECT p.oid,to_jsonb(p) snapshot,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND p.prokind='f';
-- Complete catalog projection of predecessors: OIDs, not name-based exclusions.
CREATE TEMP TABLE witness68_catalog ON COMMIT DROP AS
 SELECT 'namespace:'||oid k,to_jsonb(n) v FROM pg_namespace n WHERE nspname !~ '^pg_' AND nspname<>'information_schema'
 UNION ALL SELECT 'class:'||c.oid,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'attribute:'||a.attrelid||':'||a.attnum,to_jsonb(a) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'constraint:'||oid,to_jsonb(k) FROM pg_constraint k
 UNION ALL SELECT 'trigger:'||oid,to_jsonb(t) FROM pg_trigger t
 UNION ALL SELECT 'policy:'||oid,to_jsonb(p) FROM pg_policy p
 UNION ALL SELECT 'default:'||oid,to_jsonb(d) FROM pg_attrdef d
 UNION ALL SELECT 'index:'||indexrelid,to_jsonb(i) FROM pg_index i
 UNION ALL SELECT 'type:'||t.oid,to_jsonb(t) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'defaultacl:'||oid,to_jsonb(a) FROM pg_default_acl a
 UNION ALL SELECT 'role:'||oid,to_jsonb(r) FROM pg_roles r
 UNION ALL SELECT 'member:'||oid,to_jsonb(m) FROM pg_auth_members m
 UNION ALL SELECT 'setting:'||setdatabase||':'||setrole,to_jsonb(s) FROM pg_db_role_setting s;
CREATE TEMP TABLE witness68_data(rel regclass PRIMARY KEY,hash text) ON COMMIT DROP;
DO $data68$ DECLARE r record;h text; BEGIN
 FOR r IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','extensions') AND c.relkind='r' ORDER BY c.oid LOOP
  -- Exceção fechada: somente cinco managed tables autenticadas; nunca fallback por falta de ACL.
  IF (r.nspname,r.relname) IN (('auth','schema_migrations'),('realtime','schema_migrations'),('storage','buckets_vectors'),('storage','migrations'),('storage','vector_indexes')) THEN
   EXECUTE format('LOCK TABLE ONLY %I.%I IN ACCESS SHARE MODE NOWAIT',r.nspname,r.relname);
   IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=r.oid) IS DISTINCT FROM
      (CASE r.nspname WHEN 'auth' THEN 'supabase_auth_admin' WHEN 'realtime' THEN 'supabase_admin' WHEN 'storage' THEN 'supabase_storage_admin' END)
      OR NOT has_table_privilege(current_user,r.oid,'SELECT')
      OR has_table_privilege(current_user,r.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(current_user,r.oid,'INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION '68 managed readonly/owner/ACL divergente: %.%',r.nspname,r.relname USING ERRCODE='55000';
   END IF;
  ELSE
  EXECUTE format('LOCK TABLE ONLY %s IN SHARE MODE NOWAIT',r.oid::regclass);
  END IF;
  EXECUTE format('SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),''[]''::jsonb)::text,''sha256''),''hex'') FROM %s x',r.oid::regclass) INTO h;
  INSERT INTO witness68_data VALUES(r.oid::regclass,h);
 END LOOP;
END $data68$;
CREATE SCHEMA despesas68;
REVOKE ALL ON SCHEMA despesas68 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE despesas68.series(
 user_id integer NOT NULL CHECK(user_id>0),id uuid NOT NULL,frequencia text NOT NULL CHECK(frequencia IN('mensal','semanal','quinzenal','anual')),
 ancora date NOT NULL CHECK(ancora BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),termino date CHECK(termino>=ancora AND termino<=DATE '9999-12-31'),
 estado text NOT NULL CHECK(estado IN('ativa','pausada','encerrada')),revision integer NOT NULL CHECK(revision>0),next_ordinal integer NOT NULL CHECK(next_ordinal BETWEEN 0 AND 4000000),
 last_attempt bigint NOT NULL DEFAULT 0,failure boolean NOT NULL DEFAULT false,PRIMARY KEY(user_id,id),UNIQUE(id)
);
CREATE TABLE despesas68.revisoes(
 user_id integer NOT NULL,serie_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),effective_ordinal integer NOT NULL CHECK(effective_ordinal BETWEEN 0 AND 4000000),template jsonb NOT NULL,
 PRIMARY KEY(user_id,serie_id,revision),FOREIGN KEY(user_id,serie_id) REFERENCES despesas68.series(user_id,id)
);
CREATE INDEX revisoes68_vigencia ON despesas68.revisoes(user_id,serie_id,effective_ordinal,revision);
CREATE TABLE despesas68.ocorrencias(
 user_id integer NOT NULL,serie_id uuid NOT NULL,ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 4000000),competencia date NOT NULL,revision integer NOT NULL,
 child_uuid uuid NOT NULL UNIQUE,root_id integer NOT NULL UNIQUE CHECK(root_id>0),operation20 uuid NOT NULL UNIQUE,receipt20 jsonb NOT NULL,
 PRIMARY KEY(user_id,serie_id,ordinal),UNIQUE(user_id,serie_id,competencia),
 FOREIGN KEY(user_id,serie_id,revision) REFERENCES despesas68.revisoes(user_id,serie_id,revision)
);
-- Nenhuma FK para public: não adiciona triggers em tabelas financeiras antigas.
CREATE TABLE despesas68.receipts(
 user_id integer NOT NULL CHECK(user_id>0),chave uuid NOT NULL,request jsonb NOT NULL,proof jsonb NOT NULL,
 PRIMARY KEY(user_id,chave)
);
CREATE TABLE despesas68.skips(
 user_id integer NOT NULL,serie_id uuid NOT NULL,from_ordinal integer NOT NULL,to_exclusive integer NOT NULL CHECK(to_exclusive>=from_ordinal),instante timestamptz NOT NULL,
 FOREIGN KEY(user_id,serie_id) REFERENCES despesas68.series(user_id,id)
);
CREATE TABLE despesas68.agenda(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),domain text NOT NULL CHECK(domain='despesas68'),
 schedule_cron_task_uid varchar(65) NOT NULL CHECK(schedule_cron_task_uid ~ '^[A-Za-z0-9_-]{1,65}$'),project_id text NOT NULL CHECK(project_id ~ '^[A-Za-z0-9_-]{1,65}$'),
 path text NOT NULL CHECK(path='/api/scheduled/despesas-recorrentes'),method text NOT NULL CHECK(method='POST'),estado text NOT NULL CHECK(estado IN('ativa','pausada')),
 tick bigint NOT NULL DEFAULT 0,ultima_execucao timestamptz,resultado text NOT NULL DEFAULT 'aguardando' CHECK(resultado IN('aguardando','concluido','parcial')),
 geradas integer,falhas integer
);
CREATE UNIQUE INDEX agenda68_uid ON despesas68.agenda(schedule_cron_task_uid);
CREATE TABLE despesas68.runs(run_id uuid NOT NULL,tick bigint NOT NULL,instante timestamptz NOT NULL,geradas integer NOT NULL,falhas integer NOT NULL,backlog boolean NOT NULL,PRIMARY KEY(run_id,tick));
CREATE TABLE despesas68.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);
CREATE FUNCTION despesas68.imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION '68 append-only' USING ERRCODE='42501'; END $$;
CREATE FUNCTION despesas68.guardar_serie() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION '68 série não removível' USING ERRCODE='42501'; END IF;
 IF ROW(NEW.user_id,NEW.id,NEW.ancora,NEW.frequencia,NEW.termino) IS DISTINCT FROM ROW(OLD.user_id,OLD.id,OLD.ancora,OLD.frequencia,OLD.termino) OR NEW.next_ordinal<OLD.next_ordinal OR NEW.revision<OLD.revision OR NEW.revision>OLD.revision+1 OR OLD.estado='encerrada' AND NEW.estado<>'encerrada' THEN RAISE EXCEPTION '68 identidade/calendário imutável' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION despesas68.template(r jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR NOT r ?& ARRAY['descricao','categoria','valor','observacoes'] OR r-ARRAY['descricao','categoria','valor','observacoes']<>'{}'::jsonb
 OR jsonb_typeof(r->'descricao') IS DISTINCT FROM 'string' OR length(r->>'descricao') NOT BETWEEN 1 AND 255 OR btrim(r->>'descricao')<>r->>'descricao'
 OR r->>'categoria' IS NULL OR r->>'categoria' NOT IN('aluguel','energia','agua','internet','telefone','salario','imposto','fornecedor','outros') OR jsonb_typeof(r->'categoria') IS DISTINCT FROM 'string'
 OR jsonb_typeof(r->'valor') IS DISTINCT FROM 'string' OR r->>'valor' !~ '^(0|[1-9][0-9]{0,12})\.[0-9]{2}$'
 OR jsonb_typeof(r->'observacoes') IS DISTINCT FROM 'string' OR length(r->>'observacoes')>10000 THEN RAISE EXCEPTION '68 template inválido' USING ERRCODE='22023'; END IF;
 IF (r->>'valor')::numeric<=0 OR (r->>'valor')::numeric>9999999999999.99 THEN RAISE EXCEPTION '68 dinheiro inválido' USING ERRCODE='22023'; END IF;
 RETURN r;
END $$;
CREATE FUNCTION despesas68.civil(s text) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE d date; BEGIN
 IF s IS NULL OR s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR left(s,4)='0000' THEN RAISE EXCEPTION '68 data inválida' USING ERRCODE='22023'; END IF;
 d:=s::date; IF to_char(d,'YYYY-MM-DD')<>s THEN RAISE EXCEPTION '68 data inválida' USING ERRCODE='22023'; END IF; RETURN d;
END $$;
CREATE FUNCTION despesas68.data(a date,f text,n integer) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE m bigint;y integer;mo integer;d integer;lastday integer;r date; BEGIN
 IF a IS NULL OR a<DATE '0001-01-01' OR a>DATE '9999-12-31' OR n IS NULL OR n NOT BETWEEN 0 AND 4000000 OR f IS NULL OR f NOT IN('mensal','anual','semanal','quinzenal') THEN RAISE EXCEPTION '68 calendário inválido' USING ERRCODE='22023'; END IF;
 IF f IN('semanal','quinzenal') THEN r:=a+n*CASE WHEN f='semanal' THEN 7 ELSE 15 END;
 ELSE m:=(extract(year FROM a)::bigint-1)*12+extract(month FROM a)::integer-1+n::bigint*CASE WHEN f='mensal' THEN 1 ELSE 12 END;y:=(m/12+1)::integer;mo:=(m%12+1)::integer;
 IF y>9999 THEN RAISE EXCEPTION '68 limite civil' USING ERRCODE='22008'; END IF;
 lastday:=CASE mo WHEN 2 THEN CASE WHEN y%4=0 AND (y%100<>0 OR y%400=0) THEN 29 ELSE 28 END WHEN 4 THEN 30 WHEN 6 THEN 30 WHEN 9 THEN 30 WHEN 11 THEN 30 ELSE 31 END;
 d:=least(extract(day FROM a)::integer,lastday);r:=make_date(y,mo,d);END IF;
 IF r>DATE '9999-12-31' THEN RAISE EXCEPTION '68 limite civil' USING ERRCODE='22008'; END IF;RETURN r;
END $$;
CREATE FUNCTION despesas68.data_segura(a date,f text,n integer) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
BEGIN RETURN despesas68.data(a,f,n);EXCEPTION WHEN datetime_field_overflow THEN RETURN NULL;END $$;
CREATE FUNCTION despesas68.futuro(a date,f text,hoje date) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE n integer; BEGIN
 IF hoje<a THEN RETURN 0; END IF;
 n:=CASE WHEN f='semanal' THEN (hoje-a)/7 WHEN f='quinzenal' THEN (hoje-a)/15 WHEN f='mensal' THEN (extract(year FROM hoje)::integer-extract(year FROM a)::integer)*12+extract(month FROM hoje)::integer-extract(month FROM a)::integer ELSE extract(year FROM hoje)::integer-extract(year FROM a)::integer END;
 IF despesas68.data(a,f,n)<=hoje THEN n:=n+1; END IF; RETURN n;
END $$;
CREATE FUNCTION despesas68.request(r jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE a text;d date;t date; BEGIN
 IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR jsonb_typeof(r->'action') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION '68 pedido inválido' USING ERRCODE='22023'; END IF;a:=r->>'action';
 IF a='criar' THEN
  IF NOT r ?& ARRAY['action','template','frequencia','ancora','termino'] OR r-ARRAY['action','template','frequencia','ancora','termino']<>'{}'::jsonb OR jsonb_typeof(r->'frequencia') IS DISTINCT FROM 'string' OR r->>'frequencia' IS NULL OR r->>'frequencia' NOT IN('mensal','semanal','quinzenal','anual') THEN RAISE EXCEPTION '68 criação inválida' USING ERRCODE='22023'; END IF;
  PERFORM despesas68.template(r->'template');d:=despesas68.civil(r->>'ancora');
  IF r->'termino'<>'null'::jsonb THEN t:=despesas68.civil(r->>'termino');IF t<d THEN RAISE EXCEPTION '68 término inválido' USING ERRCODE='22023';END IF; END IF;
 ELSIF a IN('alterar','pausar','retomar','encerrar') THEN
  IF NOT r ?& ARRAY['action','serieId','expectedRevision'] OR jsonb_typeof(r->'serieId') IS DISTINCT FROM 'string' OR r->>'serieId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR jsonb_typeof(r->'expectedRevision') IS DISTINCT FROM 'number' OR r->>'expectedRevision' !~ '^[1-9][0-9]*$' OR (r->>'expectedRevision')::bigint>2147483646 THEN RAISE EXCEPTION '68 alvo/CAS inválido' USING ERRCODE='22023'; END IF;
  IF a='alterar' THEN IF NOT r ?& ARRAY['effectiveOrdinal','template'] OR r-ARRAY['action','serieId','expectedRevision','effectiveOrdinal','template']<>'{}'::jsonb OR jsonb_typeof(r->'effectiveOrdinal') IS DISTINCT FROM 'number' OR r->>'effectiveOrdinal' !~ '^(0|[1-9][0-9]*)$' OR (r->>'effectiveOrdinal')::bigint>4000000 THEN RAISE EXCEPTION '68 vigência inválida' USING ERRCODE='22023'; END IF;PERFORM despesas68.template(r->'template');
  ELSIF r-ARRAY['action','serieId','expectedRevision']<>'{}'::jsonb THEN RAISE EXCEPTION '68 campos extras' USING ERRCODE='22023'; END IF;
 ELSE RAISE EXCEPTION '68 ação inválida' USING ERRCODE='22023'; END IF;
 RETURN r;
END $$;
ALTER TABLE despesas68.revisoes ADD CONSTRAINT template68_valid CHECK(despesas68.template(template)=template);
CREATE FUNCTION despesas68.metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT encode(extensions.digest(jsonb_build_object(
 'schema',(SELECT to_jsonb(n) FROM pg_namespace n WHERE nspname='despesas68'),
 'functions',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE pronamespace='despesas68'::regnamespace OR pronamespace='public'::regnamespace AND proname IN('rpc_listar_despesas68','rpc_configurar_despesas68','rpc_recuperar_despesas68','rpc_gerar_despesas68','rpc_vincular_agenda_despesas68')),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY oid) FROM pg_class c WHERE relnamespace='despesas68'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='despesas68'::regnamespace AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY oid) FROM pg_constraint k WHERE connamespace='despesas68'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas68'::regnamespace)),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas68'::regnamespace))
 )::text,'sha256'),'hex')
$$;
CREATE FUNCTION despesas68.verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.caixa37_verificar(); PERFORM despesas49.verificar(); PERFORM obrigacoes51.verificar(); PERFORM inclusao52.verificar(); PERFORM sucessores53.verificar(); PERFORM emprestimos_lista60.verificar();
 IF (SELECT assinatura FROM despesas68.manifesto WHERE id=1) IS DISTINCT FROM despesas68.metadata() THEN RAISE EXCEPTION '68 catálogo desconhecido; sem reseal runtime' USING ERRCODE='55000'; END IF;
END $$;
CREATE FUNCTION despesas68.configurar(uid integer,k uuid,r jsonb,recover boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE old despesas68.receipts%ROWTYPE;s despesas68.series%ROWTYPE;sid uuid;rev integer;eff integer;p jsonb;a text;t jsonb;stamp timestamptz:=clock_timestamp();hoje date:=(stamp AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
 PERFORM despesas68.verificar();r:=despesas68.request(r);
 IF uid IS NULL OR uid<=0 OR k IS NULL OR recover IS NULL THEN RAISE EXCEPTION '68 owner/UUID inválido' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('despesas68:config:'||uid||':'||k,68));
 PERFORM id FROM public.users WHERE id=uid FOR KEY SHARE;IF NOT FOUND THEN RAISE EXCEPTION '68 owner indisponível' USING ERRCODE='42501';END IF;
 SELECT * INTO old FROM despesas68.receipts WHERE user_id=uid AND chave=k;
 IF FOUND THEN IF old.request IS DISTINCT FROM r THEN RAISE EXCEPTION '68 UUID/pedido divergente' USING ERRCODE='23505';END IF;
  IF old.proof->>'contrato' IS DISTINCT FROM 'despesas68_v1' OR old.proof->'userId' IS DISTINCT FROM to_jsonb(uid) OR old.proof->>'idempotencyKey' IS DISTINCT FROM k::text OR old.proof->'request' IS DISTINCT FROM r OR old.proof->>'status' IS NULL OR old.proof->>'status' NOT IN('confirmed','not_executed') OR old.proof->>'fenceId' IS NULL OR old.proof->>'instante' IS NULL OR old.proof-ARRAY['contrato','userId','idempotencyKey','request','status','serieId','revision','effectiveOrdinal','fenceId','instante']<>'{}'::jsonb THEN RAISE EXCEPTION '68 receipt/fence persistido divergente' USING ERRCODE='23514';END IF;
  IF old.proof->>'status'='not_executed' AND (old.proof->'serieId' IS DISTINCT FROM 'null'::jsonb OR old.proof->'revision' IS DISTINCT FROM 'null'::jsonb OR old.proof->'effectiveOrdinal' IS DISTINCT FROM 'null'::jsonb) OR old.proof->>'status'='confirmed' AND (old.proof->>'serieId' IS NULL OR old.proof->>'revision' IS NULL OR old.proof->>'effectiveOrdinal' IS NULL) THEN RAISE EXCEPTION '68 prova terminal contraditória' USING ERRCODE='23514';END IF;
  IF NOT recover AND old.proof->>'status'='not_executed' THEN RAISE EXCEPTION '68 UUID fenced' USING ERRCODE='23514';END IF;RETURN old.proof;END IF;
 IF recover THEN p:=jsonb_build_object('contrato','despesas68_v1','userId',uid,'idempotencyKey',k,'request',r,'status','not_executed','serieId',NULL,'revision',NULL,'effectiveOrdinal',NULL,'fenceId',gen_random_uuid(),'instante',stamp);
 ELSE
  a:=r->>'action';
  IF a='criar' THEN
   IF despesas68.civil(r->>'ancora')<hoje THEN RAISE EXCEPTION '68 primeira data não pode ser retroativa' USING ERRCODE='22023';END IF;
   sid:=gen_random_uuid();rev:=1;eff:=0;t:=r->'template';
   INSERT INTO despesas68.series(user_id,id,frequencia,ancora,termino,estado,revision,next_ordinal) VALUES(uid,sid,r->>'frequencia',(r->>'ancora')::date,(r->>'termino')::date,'ativa',rev,0);
  ELSE
   sid:=(r->>'serieId')::uuid;SELECT * INTO s FROM despesas68.series WHERE user_id=uid AND id=sid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION '68 série indisponível' USING ERRCODE='42501';END IF;
   IF s.revision<>(r->>'expectedRevision')::integer THEN RAISE EXCEPTION '68 revisão stale' USING ERRCODE='40001';END IF;
   IF s.estado='encerrada' THEN RAISE EXCEPTION '68 série encerrada; criar nova explicitamente' USING ERRCODE='23514';END IF;
   rev:=s.revision+1;eff:=greatest(s.next_ordinal,despesas68.futuro(s.ancora,s.frequencia,hoje));
   IF a='alterar' THEN
    IF (r->>'effectiveOrdinal')::integer<>eff THEN RAISE EXCEPTION '68 vigência futura stale' USING ERRCODE='40001';END IF;
    IF despesas68.data_segura(s.ancora,s.frequencia,eff) IS NULL OR s.termino IS NOT NULL AND despesas68.data_segura(s.ancora,s.frequencia,eff)>s.termino THEN RAISE EXCEPTION '68 sem competência futura' USING ERRCODE='22023';END IF;
    t:=r->'template';
    IF t IS NOT DISTINCT FROM (SELECT template FROM despesas68.revisoes WHERE user_id=uid AND serie_id=sid AND effective_ordinal<=eff ORDER BY effective_ordinal DESC,revision DESC LIMIT 1) THEN RAISE EXCEPTION '68 sem alteração' USING ERRCODE='22023';END IF;
   ELSIF a='pausar' THEN
    IF s.estado<>'ativa' THEN RAISE EXCEPTION '68 já pausada' USING ERRCODE='22023';END IF;
    UPDATE despesas68.series SET estado='pausada' WHERE user_id=uid AND id=sid;
   ELSIF a='retomar' THEN
    IF s.estado<>'pausada' THEN RAISE EXCEPTION '68 não pausada' USING ERRCODE='22023';END IF;
    IF eff>s.next_ordinal THEN INSERT INTO despesas68.skips VALUES(uid,sid,s.next_ordinal,eff,stamp);END IF;
    UPDATE despesas68.series SET estado='ativa',next_ordinal=eff,failure=false WHERE user_id=uid AND id=sid;
   ELSE UPDATE despesas68.series SET estado='encerrada' WHERE user_id=uid AND id=sid;END IF;
   UPDATE despesas68.series SET revision=rev WHERE user_id=uid AND id=sid;
  END IF;
  IF t IS NOT NULL THEN INSERT INTO despesas68.revisoes VALUES(uid,sid,rev,eff,t);END IF;
  p:=jsonb_build_object('contrato','despesas68_v1','userId',uid,'idempotencyKey',k,'request',r,'status','confirmed','serieId',sid,'revision',rev,'effectiveOrdinal',eff,'fenceId',gen_random_uuid(),'instante',stamp);
 END IF;
 INSERT INTO despesas68.receipts VALUES(uid,k,r,p);RETURN p;
END $$;
CREATE FUNCTION despesas68.validar_ocorrencia(uid integer,sid uuid,n integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o despesas68.ocorrencias%ROWTYPE;d jsonb;origin public.despesas_rpc_origens%ROWTYPE;op public.despesas_rpc_operacoes%ROWTYPE;s despesas68.series%ROWTYPE;t jsonb; BEGIN
 SELECT * INTO STRICT o FROM despesas68.ocorrencias WHERE user_id=uid AND serie_id=sid AND ordinal=n;
 SELECT * INTO STRICT s FROM despesas68.series WHERE user_id=uid AND id=sid;
 SELECT template INTO STRICT t FROM despesas68.revisoes WHERE user_id=uid AND serie_id=sid AND revision=o.revision;
 SELECT * INTO origin FROM public.despesas_rpc_origens WHERE despesa_id=o.root_id;IF NOT FOUND OR origin.user_id IS DISTINCT FROM uid OR origin.operacao_id IS DISTINCT FROM o.operation20 THEN RAISE EXCEPTION '68 origem20 divergente' USING ERRCODE='23514';END IF;
 SELECT * INTO op FROM public.despesas_rpc_operacoes WHERE id=o.operation20;d:=origin.snapshot;
 IF NOT FOUND OR op.user_id IS DISTINCT FROM uid OR op.tipo IS DISTINCT FROM 'criar' OR op.chave_idempotencia IS DISTINCT FROM o.child_uuid OR op.resultado IS DISTINCT FROM o.receipt20
 OR o.competencia IS DISTINCT FROM despesas68.data(s.ancora,s.frequencia,n)
 OR d->'id' IS DISTINCT FROM to_jsonb(o.root_id) OR d->'user_id' IS DISTINCT FROM to_jsonb(uid) OR d->>'status' IS DISTINCT FROM 'pendente' OR d->'recorrente' IS DISTINCT FROM 'false'::jsonb OR d->'frequencia' IS DISTINCT FROM 'null'::jsonb OR d->'conta_caixa_id' IS DISTINCT FROM 'null'::jsonb OR d->'data_pagamento' IS DISTINCT FROM 'null'::jsonb
 OR d->>'descricao' IS DISTINCT FROM t->>'descricao' OR d->>'categoria' IS DISTINCT FROM t->>'categoria' OR d->>'observacoes' IS DISTINCT FROM t->>'observacoes' OR (d->>'valor')::numeric IS DISTINCT FROM (t->>'valor')::numeric OR d->>'data_vencimento' IS DISTINCT FROM o.competencia::text
 OR op.payload IS DISTINCT FROM jsonb_build_object('descricao',d->>'descricao','categoria',d->>'categoria','valor',(d->>'valor')::numeric,'dataVencimento',o.competencia,'observacoes',d->>'observacoes')
 OR op.hash_payload IS DISTINCT FROM extensions.digest(convert_to(jsonb_build_object('tipo','criar','userId',uid,'payload',op.payload)::text,'UTF8'),'sha256')
 OR op.auditoria IS DISTINCT FROM jsonb_build_object('antes',NULL,'depois',d,'origemOperationId',op.id,'saida',NULL,'estorno',NULL,'motivo',NULL)
 OR op.resultado IS DISTINCT FROM jsonb_build_object('success',true,'acao','criar','operationId',op.id,'userId',uid,'chaveIdempotencia',op.chave_idempotencia,'despesaId',o.root_id,'status','pendente','valor',(d->>'valor')::numeric(15,2)::text,'contaCaixaId',NULL,'dataVencimento',o.competencia,'dataPagamento',NULL,'dataEstorno',NULL,'pagamentoOperationId',NULL,'transacaoSaidaId',NULL,'transacaoEstornoId',NULL) THEN RAISE EXCEPTION '68 prova financeira20 incompleta' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contas_pagar WHERE id=o.root_id AND user_id=uid) THEN RAISE EXCEPTION '68 raiz ausente/alheia' USING ERRCODE='23514';END IF;
END $$;
CREATE FUNCTION despesas68.commit_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN PERFORM despesas68.validar_ocorrencia(NEW.user_id,NEW.serie_id,NEW.ordinal);RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER ocorrencia68_complete AFTER INSERT ON despesas68.ocorrencias DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION despesas68.commit_check();
CREATE FUNCTION despesas68.vincular_agenda(taskuid text,projectid text,expecteduid text,active boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a despesas68.agenda%ROWTYPE; BEGIN
 PERFORM despesas68.verificar();
 IF taskuid IS NULL OR taskuid !~ '^[A-Za-z0-9_-]{1,65}$' OR projectid IS NULL OR projectid !~ '^[A-Za-z0-9_-]{1,65}$' OR active IS NULL THEN RAISE EXCEPTION '68 agenda inválida' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('despesas68:agenda',68));SELECT * INTO a FROM despesas68.agenda WHERE singleton FOR UPDATE;
 IF FOUND THEN
  IF expecteduid IS DISTINCT FROM a.schedule_cron_task_uid OR projectid IS DISTINCT FROM a.project_id THEN RAISE EXCEPTION '68 vínculo/CAS stale' USING ERRCODE='40001';END IF;
  UPDATE despesas68.agenda SET schedule_cron_task_uid=taskuid,estado=CASE WHEN active THEN 'ativa' ELSE 'pausada' END WHERE singleton;
 ELSE IF expecteduid IS NOT NULL THEN RAISE EXCEPTION '68 vínculo ausente/CAS stale' USING ERRCODE='40001';END IF;
  INSERT INTO despesas68.agenda(singleton,domain,schedule_cron_task_uid,project_id,path,method,estado) VALUES(true,'despesas68',taskuid,projectid,'/api/scheduled/despesas-recorrentes','POST',CASE WHEN active THEN 'ativa' ELSE 'pausada' END);
 END IF;
 RETURN jsonb_build_object('vinculada',true,'ativa',active,'path','/api/scheduled/despesas-recorrentes','method','POST');
END $$;
CREATE FUNCTION despesas68.gerar(taskuid text,runid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a despesas68.agenda%ROWTYPE;s despesas68.series%ROWTYPE;v despesas68.revisoes%ROWTYPE;n integer;dt date;child uuid;receipt jsonb;generated integer:=0;failed integer:=0;backlog boolean;selected boolean:=false;stamp timestamptz:=clock_timestamp();hoje date:=(stamp AT TIME ZONE 'America/Sao_Paulo')::date; BEGIN
 PERFORM despesas68.verificar();
 IF taskuid IS NULL OR taskuid !~ '^[A-Za-z0-9_-]{1,65}$' OR runid IS NULL THEN RAISE EXCEPTION '68 cron inválido' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM despesas68.agenda WHERE schedule_cron_task_uid=taskuid AND domain='despesas68' AND path='/api/scheduled/despesas-recorrentes' AND method='POST' AND estado='ativa' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '68 cron não vinculado' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM despesas68.series WHERE estado='ativa' AND despesas68.data_segura(ancora,frequencia,next_ordinal)<=hoje AND (termino IS NULL OR despesas68.data_segura(ancora,frequencia,next_ordinal)<=termino) ORDER BY last_attempt,user_id,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF FOUND THEN
  selected:=true;
  -- Uma série/lote atômico; savepoint implícito não deixa órfão20 em falhas.
  BEGIN
   PERFORM id FROM public.users WHERE id=s.user_id FOR KEY SHARE;IF NOT FOUND THEN RAISE EXCEPTION '68 owner ausente' USING ERRCODE='23514';END IF;
   FOR i IN 1..8 LOOP
    n:=s.next_ordinal;dt:=despesas68.data_segura(s.ancora,s.frequencia,n);EXIT WHEN dt IS NULL OR dt>hoje OR s.termino IS NOT NULL AND dt>s.termino;
    IF EXISTS(SELECT 1 FROM despesas68.ocorrencias WHERE user_id=s.user_id AND serie_id=s.id AND ordinal=n) THEN
     PERFORM despesas68.validar_ocorrencia(s.user_id,s.id,n);
    ELSE
     SELECT * INTO STRICT v FROM despesas68.revisoes WHERE user_id=s.user_id AND serie_id=s.id AND effective_ordinal<=n ORDER BY effective_ordinal DESC,revision DESC LIMIT 1;
     PERFORM despesas68.template(v.template);child:=gen_random_uuid();
     -- Não chamar original renomeada nem interna20. Wrapper público33/20 vigente.
     receipt:=public.rpc_criar_despesa_prospectiva(s.user_id,v.template->>'descricao',v.template->>'categoria',(v.template->>'valor')::numeric,dt,v.template->>'observacoes',child);
     INSERT INTO despesas68.ocorrencias VALUES(s.user_id,s.id,n,dt,v.revision,child,(receipt->>'despesaId')::integer,(receipt->>'operationId')::uuid,receipt);
     PERFORM despesas68.validar_ocorrencia(s.user_id,s.id,n);generated:=generated+1;
    END IF;
    s.next_ordinal:=n+1;
    UPDATE despesas68.series SET next_ordinal=s.next_ordinal,failure=false WHERE user_id=s.user_id AND id=s.id;
   END LOOP;
  EXCEPTION WHEN OTHERS THEN generated:=0;failed:=1;END;
  UPDATE despesas68.series SET last_attempt=a.tick+1,failure=failed>0 WHERE user_id=s.user_id AND id=s.id;
 END IF;
 SELECT EXISTS(SELECT 1 FROM despesas68.series WHERE estado='ativa' AND despesas68.data_segura(ancora,frequencia,next_ordinal)<=hoje AND (termino IS NULL OR despesas68.data_segura(ancora,frequencia,next_ordinal)<=termino)) INTO backlog;
 UPDATE despesas68.agenda SET tick=a.tick+1,ultima_execucao=stamp,resultado=CASE WHEN failed>0 OR backlog THEN 'parcial' ELSE 'concluido' END,geradas=generated,falhas=failed WHERE singleton;
 INSERT INTO despesas68.runs VALUES(runid,a.tick+1,stamp,generated,failed,backlog);
 RETURN jsonb_build_object('contrato','despesas68_batch_v1','runId',runid,'geradas',generated,'falhas',failed,'backlog',backlog,'selecionada',selected);
END $$;
-- Leitura recursiva49 comprovada; hook69 opcional documentado no pacote.
CREATE FUNCTION despesas68.linhagem(uid integer,root integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE currentid integer:=root;seen integer[]:='{}';next69 jsonb;e despesas49.operacoes%ROWTYPE;cancel38 despesa_cancelamento_v1.operacoes%ROWTYPE;d public.contas_pagar%ROWTYPE;o public.despesas_rpc_origens%ROWTYPE;c public.despesas_rpc_operacoes%ROWTYPE; BEGIN
 LOOP
  IF currentid=ANY(seen) OR cardinality(seen)>=128 THEN RAISE EXCEPTION '68 linhagem cíclica/limite' USING ERRCODE='23514';END IF;seen:=array_append(seen,currentid);
  SELECT * INTO d FROM public.contas_pagar WHERE id=currentid AND user_id=uid;IF NOT FOUND THEN RAISE EXCEPTION '68 linhagem alheia/ausente' USING ERRCODE='23514';END IF;
  SELECT * INTO e FROM despesas49.operacoes WHERE user_id=uid AND estado='confirmed' AND (request->>'despesaId')::integer=currentid;
  IF NOT FOUND THEN
   IF to_regnamespace('despesas69') IS NOT NULL THEN
    IF to_regprocedure('despesas69.verificar()') IS NULL OR to_regprocedure('despesas69.sucessora68(integer,integer)') IS NULL THEN RAISE EXCEPTION '68 adaptador69 certificado ausente' USING ERRCODE='23514';END IF;
    EXECUTE 'SELECT despesas69.verificar()';
    EXECUTE 'SELECT despesas69.sucessora68($1,$2)' INTO next69 USING uid,currentid;
    IF next69 IS NOT NULL AND next69<>'null'::jsonb THEN
     IF next69->'userId' IS DISTINCT FROM to_jsonb(uid) OR next69->'despesaId' IS DISTINCT FROM to_jsonb(currentid) OR next69->'confirmed' IS DISTINCT FROM 'true'::jsonb OR next69->>'sucessoraId' IS NULL OR next69->>'sucessoraId' !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION '68 adaptador69 divergente' USING ERRCODE='23514';END IF;
     currentid:=(next69->>'sucessoraId')::integer;CONTINUE;
    END IF;
   END IF;
   EXIT;
  END IF;
  SELECT * INTO o FROM public.despesas_rpc_origens WHERE despesa_id=currentid;SELECT * INTO c FROM public.despesas_rpc_operacoes WHERE id=o.operacao_id;
  IF o.user_id IS DISTINCT FROM uid OR e.hash_request IS DISTINCT FROM despesas49.hash(uid,e.request) OR e.antes IS DISTINCT FROM o.snapshot OR e.depois IS DISTINCT FROM to_jsonb(d) OR e.resultado->>'contrato' IS DISTINCT FROM 'despesas49_v1' OR e.resultado->'success' IS DISTINCT FROM 'true'::jsonb OR e.resultado->'request' IS DISTINCT FROM e.request OR e.resultado->'userId' IS DISTINCT FROM to_jsonb(uid) OR e.resultado->>'idempotencyKey' IS DISTINCT FROM e.chave::text OR e.resultado->>'operationId' IS DISTINCT FROM e.operation_id::text OR e.resultado->'semMovimentoCaixa' IS DISTINCT FROM 'true'::jsonb OR e.sucessora->'user_id' IS DISTINCT FROM to_jsonb(uid) OR e.sucessora->>'status' IS DISTINCT FROM 'pendente' OR (e.sucessora->>'valor')::numeric IS DISTINCT FROM (e.antes->>'valor')::numeric OR c.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION '68 sucessão49 não comprovada' USING ERRCODE='23514';END IF;
  SELECT * INTO o FROM public.despesas_rpc_origens WHERE despesa_id=(e.resultado->>'sucessoraId')::integer;
  IF o.user_id IS DISTINCT FROM uid OR o.snapshot IS DISTINCT FROM e.sucessora OR o.operacao_id::text IS DISTINCT FROM e.resultado->>'sucessoraOperationId' THEN RAISE EXCEPTION '68 sucessora49 alheia' USING ERRCODE='23514';END IF;
  IF e.depois IS DISTINCT FROM jsonb_set(jsonb_set(e.antes,'{status}','"cancelado"'::jsonb),'{updatedAt}',to_jsonb(e.instante))
  OR e.resultado IS DISTINCT FROM jsonb_build_object('contrato','despesas49_v1','success',true,'acao','editarPendente','userId',uid,'idempotencyKey',e.chave,'request',e.request,'operationId',e.operation_id,'despesaId',currentid,'sucessoraId',(e.sucessora->>'id')::integer,'sucessoraOperationId',o.operacao_id,'valor',(e.sucessora->>'valor')::numeric(15,2)::text,'statusOriginal','cancelado','statusSucessora','pendente','semMovimentoCaixa',true,'instante',e.instante)
  OR NOT EXISTS(SELECT 1 FROM public.financial_intent_fences WHERE user_id=uid AND scope='despesa' AND chave=e.chave AND family='despesas49_v1' AND request=e.request AND payload_hash=encode(e.hash_request,'hex')) THEN RAISE EXCEPTION '68 recibo/fence49 incompleto' USING ERRCODE='23514';END IF;
  SELECT * INTO c FROM public.despesas_rpc_operacoes WHERE id=o.operacao_id;
  IF NOT FOUND OR c.user_id IS DISTINCT FROM uid OR c.tipo IS DISTINCT FROM 'criar'
  OR c.hash_payload IS DISTINCT FROM extensions.digest(convert_to(jsonb_build_object('tipo','criar','userId',uid,'payload',c.payload)::text,'UTF8'),'sha256')
  OR c.payload IS DISTINCT FROM jsonb_build_object('descricao',e.sucessora->>'descricao','categoria',e.sucessora->>'categoria','valor',(e.sucessora->>'valor')::numeric,'dataVencimento',(e.sucessora->>'data_vencimento')::date,'observacoes',e.sucessora->>'observacoes')
  OR c.auditoria IS DISTINCT FROM jsonb_build_object('antes',NULL,'depois',e.sucessora,'origemOperationId',c.id,'saida',NULL,'estorno',NULL,'motivo',NULL)
  OR c.resultado IS DISTINCT FROM jsonb_build_object('success',true,'acao','criar','operationId',c.id,'userId',uid,'chaveIdempotencia',c.chave_idempotencia,'despesaId',(e.sucessora->>'id')::integer,'status','pendente','valor',(e.sucessora->>'valor')::numeric(15,2)::text,'contaCaixaId',NULL,'dataVencimento',(e.sucessora->>'data_vencimento')::date,'dataPagamento',NULL,'dataEstorno',NULL,'pagamentoOperationId',NULL,'transacaoSaidaId',NULL,'transacaoEstornoId',NULL) THEN RAISE EXCEPTION '68 filha20 da sucessão49 não comprovada' USING ERRCODE='23514';END IF;
  currentid:=(e.resultado->>'sucessoraId')::integer;
 END LOOP;
 IF d.status='pendente' THEN
  SELECT * INTO o FROM public.despesas_rpc_origens WHERE despesa_id=currentid;
  IF NOT FOUND OR o.user_id IS DISTINCT FROM uid OR o.snapshot IS DISTINCT FROM to_jsonb(d) OR d.recorrente IS DISTINCT FROM false OR d.frequencia IS NOT NULL OR d.conta_caixa_id IS NOT NULL OR d.data_pagamento IS NOT NULL OR EXISTS(SELECT 1 FROM public.despesas_rpc_pagamentos WHERE despesa_id=currentid) THEN RAISE EXCEPTION '68 pendente final não intacta20' USING ERRCODE='23514';END IF;
 END IF;
 IF d.status='pago' OR d.status='cancelado' AND d.data_pagamento IS NOT NULL THEN
  SELECT * INTO c FROM public.despesas_rpc_operacoes WHERE user_id=uid AND tipo=CASE WHEN d.status='pago' THEN 'pagar' ELSE 'estornar' END AND (resultado->>'despesaId')::integer=currentid ORDER BY criado_em DESC LIMIT 1;
  IF NOT FOUND OR c.auditoria->'depois' IS DISTINCT FROM to_jsonb(d) OR c.hash_payload IS DISTINCT FROM extensions.digest(convert_to(jsonb_build_object('tipo',c.tipo,'userId',uid,'payload',c.payload)::text,'UTF8'),'sha256') OR c.resultado->'success' IS DISTINCT FROM 'true'::jsonb OR c.resultado->'userId' IS DISTINCT FROM to_jsonb(uid) OR c.resultado->>'status' IS DISTINCT FROM d.status OR NOT EXISTS(SELECT 1 FROM public.despesas_rpc_pagamentos WHERE despesa_id=currentid AND user_id=uid AND valor=d.valor AND conta_caixa_id=d.conta_caixa_id AND data_pagamento=d.data_pagamento) THEN RAISE EXCEPTION '68 baixa final não comprovada20' USING ERRCODE='23514';END IF;
 ELSIF d.status='cancelado' THEN
  SELECT * INTO cancel38 FROM despesa_cancelamento_v1.operacoes WHERE user_id=uid AND despesa_id=currentid;
  SELECT * INTO o FROM public.despesas_rpc_origens WHERE despesa_id=currentid;
  IF cancel38.user_id IS DISTINCT FROM uid OR cancel38.antes IS DISTINCT FROM o.snapshot OR cancel38.depois IS DISTINCT FROM to_jsonb(d) OR cancel38.hash_request IS DISTINCT FROM despesa_cancelamento_v1.hash(uid,cancel38.request) OR cancel38.resultado->'success' IS DISTINCT FROM 'true'::jsonb OR cancel38.resultado->'userId' IS DISTINCT FROM to_jsonb(uid) OR cancel38.resultado->>'contrato' IS DISTINCT FROM 'despesa_cancelamento_pendente_v1' OR cancel38.resultado->'semMovimentoCaixa' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION '68 cancelamento final não comprovado38c' USING ERRCODE='23514';END IF;
 END IF;
 -- Cancelada sem sucessão comprovada permanece encerrada, jamais regenerada.
 RETURN jsonb_build_object('currentId',currentid,'status',d.status);
END $$;
CREATE FUNCTION despesas68.listar(uid integer,afterid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a despesas68.agenda%ROWTYPE;s despesas68.series%ROWTYPE;o despesas68.ocorrencias%ROWTYPE;series jsonb:='[]';occs jsonb:='[]';t jsonb;sk jsonb;link jsonb;eff integer;dt date;hoje date:=(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;more boolean;lastid uuid; BEGIN
 PERFORM despesas68.verificar();IF uid IS NULL OR uid<=0 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid) THEN RAISE EXCEPTION '68 owner inválido' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM despesas68.agenda WHERE singleton;
 FOR s IN SELECT * FROM despesas68.series WHERE user_id=uid AND (afterid IS NULL OR id>afterid) ORDER BY id LIMIT 25 LOOP
  lastid:=s.id;eff:=greatest(s.next_ordinal,despesas68.futuro(s.ancora,s.frequencia,hoje));dt:=despesas68.data_segura(s.ancora,s.frequencia,s.next_ordinal);
  SELECT template INTO STRICT t FROM despesas68.revisoes WHERE user_id=uid AND serie_id=s.id AND effective_ordinal<=eff ORDER BY effective_ordinal DESC,revision DESC LIMIT 1;
  SELECT coalesce(jsonb_agg(jsonb_build_object('from',from_ordinal,'toExclusive',to_exclusive,'instante',instante) ORDER BY instante),'[]') INTO sk FROM despesas68.skips WHERE user_id=uid AND serie_id=s.id;
  series:=series||jsonb_build_array(jsonb_build_object('serieId',s.id,'userId',uid,'revision',s.revision,'estado',s.estado,'frequencia',s.frequencia,'ancora',s.ancora,'termino',s.termino,'template',t,'nextOrdinal',s.next_ordinal,'nextDate',CASE WHEN s.estado='encerrada' OR s.termino IS NOT NULL AND dt>s.termino THEN NULL ELSE dt END,'futureOrdinal',eff,'backlog',coalesce(s.estado='ativa' AND dt<=hoje AND (s.termino IS NULL OR dt<=s.termino),false),'failure',s.failure,'skipped',sk));
  FOR o IN SELECT * FROM despesas68.ocorrencias WHERE user_id=uid AND serie_id=s.id ORDER BY ordinal DESC LIMIT 10 LOOP
   BEGIN PERFORM despesas68.validar_ocorrencia(uid,s.id,o.ordinal);link:=despesas68.linhagem(uid,o.root_id);
   EXCEPTION WHEN OTHERS THEN link:=jsonb_build_object('currentId',NULL,'status','UNKNOWN');END;
   occs:=occs||jsonb_build_array(jsonb_build_object('serieId',s.id,'ordinal',o.ordinal,'competencia',o.competencia,'rootId',o.root_id,'currentId',link->'currentId','status',link->>'status'));
  END LOOP;
 END LOOP;
 SELECT EXISTS(SELECT 1 FROM despesas68.series WHERE user_id=uid AND id>lastid) INTO more;
 RETURN jsonb_build_object('contrato','despesas68_v1','userId',uid,'hoje',hoje,'series',series,'ocorrencias',occs,'hasMore',coalesce(more,false),'agenda',jsonb_build_object('vinculada',a.singleton IS NOT NULL,'ativa',coalesce(a.estado='ativa',false),'path','/api/scheduled/despesas-recorrentes','method','POST','ultimaExecucao',a.ultima_execucao,'resultado',coalesce(a.resultado,'aguardando'),'geradas',a.geradas,'falhas',a.falhas));
END $$;
CREATE FUNCTION public.rpc_listar_despesas68(p_user_id integer,p_after uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT despesas68.listar(p_user_id,p_after) $$;
CREATE FUNCTION public.rpc_configurar_despesas68(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT despesas68.configurar(p_user_id,p_chave,p_request,false) $$;
CREATE FUNCTION public.rpc_recuperar_despesas68(p_user_id integer,p_chave uuid,p_request jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT despesas68.configurar(p_user_id,p_chave,p_request,true) $$;
CREATE FUNCTION public.rpc_gerar_despesas68(p_task_uid text,p_run_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT despesas68.gerar(p_task_uid,p_run_id) $$;
-- Backend-only; NÃO registrado no router humano. Parent vincula após publicação.
CREATE FUNCTION public.rpc_vincular_agenda_despesas68(p_task_uid text,p_project_id text,p_expected_uid text,p_active boolean) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT despesas68.vincular_agenda(p_task_uid,p_project_id,p_expected_uid,p_active) $$;
DO $acl68$ DECLARE r record; BEGIN
 FOR r IN SELECT oid,relkind FROM pg_class WHERE relnamespace='despesas68'::regnamespace AND relkind='r' LOOP EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',r.oid::regclass);END LOOP;
 FOR r IN SELECT oid FROM pg_class WHERE relnamespace='despesas68'::regnamespace AND relkind='r' AND relname IN('revisoes','ocorrencias','receipts','skips','runs','manifesto') LOOP
  EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION despesas68.imutavel()',r.oid::regclass);
  EXECUTE format('CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION despesas68.imutavel()',r.oid::regclass);
 END LOOP;
END $acl68$;
CREATE TRIGGER identidade68 BEFORE UPDATE OR DELETE ON despesas68.series FOR EACH ROW EXECUTE FUNCTION despesas68.guardar_serie();
CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON despesas68.series FOR EACH STATEMENT EXECUTE FUNCTION despesas68.imutavel();
REVOKE ALL ON ALL TABLES IN SCHEMA despesas68 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA despesas68 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_listar_despesas68(integer,uuid),public.rpc_configurar_despesas68(integer,uuid,jsonb),public.rpc_recuperar_despesas68(integer,uuid,jsonb),public.rpc_gerar_despesas68(text,uuid),public.rpc_vincular_agenda_despesas68(text,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_listar_despesas68(integer,uuid),public.rpc_configurar_despesas68(integer,uuid,jsonb),public.rpc_recuperar_despesas68(integer,uuid,jsonb),public.rpc_gerar_despesas68(text,uuid),public.rpc_vincular_agenda_despesas68(text,text,text,boolean) TO service_role;
-- FINAL68 is generated below from exact source bodies and ORIGINAL metadata37 expression.


-- Immutable installer reference DDL, temporary only, deparsed by PG17 itself.
CREATE TEMP TABLE ref68_series(
 user_id integer NOT NULL CHECK(user_id>0),id uuid NOT NULL,frequencia text NOT NULL CHECK(frequencia IN('mensal','semanal','quinzenal','anual')),
 ancora date NOT NULL CHECK(ancora BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),termino date CHECK(termino>=ancora AND termino<=DATE '9999-12-31'),
 estado text NOT NULL CHECK(estado IN('ativa','pausada','encerrada')),revision integer NOT NULL CHECK(revision>0),next_ordinal integer NOT NULL CHECK(next_ordinal BETWEEN 0 AND 4000000),
 last_attempt bigint NOT NULL DEFAULT 0,failure boolean NOT NULL DEFAULT false,PRIMARY KEY(user_id,id),UNIQUE(id)) ON COMMIT DROP;
CREATE TEMP TABLE ref68_revisoes(
 user_id integer NOT NULL,serie_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),effective_ordinal integer NOT NULL CHECK(effective_ordinal BETWEEN 0 AND 4000000),template jsonb NOT NULL,
 PRIMARY KEY(user_id,serie_id,revision),FOREIGN KEY(user_id,serie_id) REFERENCES ref68_series(user_id,id)) ON COMMIT DROP;
CREATE TEMP TABLE ref68_ocorrencias(
 user_id integer NOT NULL,serie_id uuid NOT NULL,ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 4000000),competencia date NOT NULL,revision integer NOT NULL,
 child_uuid uuid NOT NULL UNIQUE,root_id integer NOT NULL UNIQUE CHECK(root_id>0),operation20 uuid NOT NULL UNIQUE,receipt20 jsonb NOT NULL,
 PRIMARY KEY(user_id,serie_id,ordinal),UNIQUE(user_id,serie_id,competencia),
 FOREIGN KEY(user_id,serie_id,revision) REFERENCES ref68_revisoes(user_id,serie_id,revision)) ON COMMIT DROP;
CREATE TEMP TABLE ref68_receipts(
 user_id integer NOT NULL CHECK(user_id>0),chave uuid NOT NULL,request jsonb NOT NULL,proof jsonb NOT NULL,
 PRIMARY KEY(user_id,chave)) ON COMMIT DROP;
CREATE TEMP TABLE ref68_skips(
 user_id integer NOT NULL,serie_id uuid NOT NULL,from_ordinal integer NOT NULL,to_exclusive integer NOT NULL CHECK(to_exclusive>=from_ordinal),instante timestamptz NOT NULL,
 FOREIGN KEY(user_id,serie_id) REFERENCES ref68_series(user_id,id)) ON COMMIT DROP;
CREATE TEMP TABLE ref68_agenda(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),domain text NOT NULL CHECK(domain='despesas68'),
 schedule_cron_task_uid varchar(65) NOT NULL CHECK(schedule_cron_task_uid ~ '^[A-Za-z0-9_-]{1,65}$'),project_id text NOT NULL CHECK(project_id ~ '^[A-Za-z0-9_-]{1,65}$'),
 path text NOT NULL CHECK(path='/api/scheduled/despesas-recorrentes'),method text NOT NULL CHECK(method='POST'),estado text NOT NULL CHECK(estado IN('ativa','pausada')),
 tick bigint NOT NULL DEFAULT 0,ultima_execucao timestamptz,resultado text NOT NULL DEFAULT 'aguardando' CHECK(resultado IN('aguardando','concluido','parcial')),
 geradas integer,falhas integer) ON COMMIT DROP;
CREATE TEMP TABLE ref68_runs(run_id uuid NOT NULL,tick bigint NOT NULL,instante timestamptz NOT NULL,geradas integer NOT NULL,falhas integer NOT NULL,backlog boolean NOT NULL,PRIMARY KEY(run_id,tick)) ON COMMIT DROP;
CREATE TEMP TABLE ref68_manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL) ON COMMIT DROP;
ALTER TABLE ref68_revisoes ADD CONSTRAINT template68_valid CHECK(despesas68.template(template)=template);
CREATE INDEX ref68_revisoes_vigencia ON ref68_revisoes(user_id,serie_id,effective_ordinal,revision);
CREATE UNIQUE INDEX ref68_agenda_uid ON ref68_agenda(schedule_cron_task_uid);
CREATE CONSTRAINT TRIGGER ocorrencia68_complete AFTER INSERT ON ref68_ocorrencias DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION despesas68.commit_check();
DO $exact68$ DECLARE pin jsonb;proc_pin pg_proc%ROWTYPE;witness_row record;h text;derived text;old text;final text;nr integer;new_public_oids oid[]; BEGIN
 FOR pin IN SELECT value FROM jsonb_array_elements('[{"name":"despesas68.imutavel","signature":"despesas68.imutavel()","sha256":"94b1da9142e45e63bc4863ad295182f4ab2d24581bfb12461c357cdadec671ad","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.guardar_serie","signature":"despesas68.guardar_serie()","sha256":"333d5906b54bb89e2104cb4c03b33e04bfe367bc4718c2a521f6258f009e1b7c","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.template","signature":"despesas68.template(jsonb)","sha256":"64aac98d0090e1f1a224034fd411a0aa54a2d8f8278e6bc39ff9228205d635e3","secdef":false,"language":"plpgsql","volatile":"i","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.civil","signature":"despesas68.civil(text)","sha256":"10f37c1c6cc1936dcb792a3735f11a6730b4e0f0c0906f39cf8ca32dd3a17df7","secdef":false,"language":"plpgsql","volatile":"i","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.data","signature":"despesas68.data(date,text,integer)","sha256":"2aaaa45fb08e57551f654bd9a12cb73c2052adfcfcf33592d424329a84959d26","secdef":false,"language":"plpgsql","volatile":"i","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.data_segura","signature":"despesas68.data_segura(date,text,integer)","sha256":"10e55dfd305859f27476fefaab80b281547415c40211146d038f9305ccc8947e","secdef":false,"language":"plpgsql","volatile":"i","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.futuro","signature":"despesas68.futuro(date,text,date)","sha256":"25552110f1b5866ccb0a8c2f0599a0a82a4723c94249421b3b6afda96d7f7055","secdef":false,"language":"plpgsql","volatile":"i","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.request","signature":"despesas68.request(jsonb)","sha256":"7a4fe9ae942eddc2e732aaee5584c9a297463f524fff140318823c92a3032350","secdef":false,"language":"plpgsql","volatile":"i","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.metadata","signature":"despesas68.metadata()","sha256":"ee44b5bdf0c8ae385753659ca77bf5a89f2a54cc45bba9d5a42ef3dba8ec76ef","secdef":true,"language":"sql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.verificar","signature":"despesas68.verificar()","sha256":"63d5be08414851a3e339070e453102bd8d4915009fd056a3e6409d4fab8f5c1a","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.configurar","signature":"despesas68.configurar(integer,uuid,jsonb,boolean)","sha256":"c5ad6ba26707b79548c4f8709228fa262bc362ee389d42d9f477a5a1c6aca599","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"despesas68.validar_ocorrencia","signature":"despesas68.validar_ocorrencia(integer,uuid,integer)","sha256":"1ccd43d7da1674f4877c325f9e53d29c48a44e90bf003b5778fa7520f1912722","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.commit_check","signature":"despesas68.commit_check()","sha256":"a553823a0a37ebbfe0eebb864ecb1bb53172843c19f14428d39ed9fa77b7390e","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.vincular_agenda","signature":"despesas68.vincular_agenda(text,text,text,boolean)","sha256":"a300fb4588b2060dd16db0d9c6d810f5eea2db6d7fe4bdb12774885c96e477de","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"despesas68.gerar","signature":"despesas68.gerar(text,uuid)","sha256":"cf2e543295c5e6764c4a54b2dd3098abcc5e5efe6783afc2ba044fb763957eab","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"despesas68.linhagem","signature":"despesas68.linhagem(integer,integer)","sha256":"1573e68b3b6aa6ea465080bb1e90c0dbeb6ae55f1f4f893cd0f1c41e6d0149bd","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"despesas68.listar","signature":"despesas68.listar(integer,uuid)","sha256":"07caf7b2eaa278c4a5eecf3a9dbe417304b20866a2f29daedd294edcfcf78129","secdef":true,"language":"plpgsql","volatile":"v","config":["search_path=pg_catalog, pg_temp","TimeZone=UTC"]},{"name":"public.rpc_listar_despesas68","signature":"public.rpc_listar_despesas68(integer,uuid)","sha256":"3075951254a916ff5bb8ff185209eed47cd3ae7b2cb34c08cdb95c0ac6c5aa24","secdef":true,"language":"sql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_configurar_despesas68","signature":"public.rpc_configurar_despesas68(integer,uuid,jsonb)","sha256":"186b0cb3490613b835d60345bbbd13d22c1d0998daac2c056657cc580451e7fd","secdef":true,"language":"sql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_recuperar_despesas68","signature":"public.rpc_recuperar_despesas68(integer,uuid,jsonb)","sha256":"a1e1ec962a5a2e80df10b756554a73a9ff1a5185ed095744fa380048377f8505","secdef":true,"language":"sql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_gerar_despesas68","signature":"public.rpc_gerar_despesas68(text,uuid)","sha256":"e2d869e4d21f61e6e204e14c0a745bc6c1faacbd3a70d85cc12abb09b9b13d02","secdef":true,"language":"sql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]},{"name":"public.rpc_vincular_agenda_despesas68","signature":"public.rpc_vincular_agenda_despesas68(text,text,text,boolean)","sha256":"7b294c08b5b5529b11d1e663c94401b24693627b2719daadda09ab6120a97efc","secdef":true,"language":"sql","volatile":"v","config":["search_path=pg_catalog, pg_temp"]}]'::jsonb) LOOP
  SELECT * INTO STRICT proc_pin FROM pg_proc WHERE oid=to_regprocedure(pin->>'signature');
  IF encode(extensions.digest(proc_pin.prosrc,'sha256'),'hex') IS DISTINCT FROM pin->>'sha256' OR proc_pin.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user) OR proc_pin.prosecdef IS DISTINCT FROM (pin->>'secdef')::boolean OR to_jsonb(proc_pin.proconfig) IS DISTINCT FROM pin->'config' OR proc_pin.prokind<>'f' OR proc_pin.provolatile::text IS DISTINCT FROM pin->>'volatile' OR proc_pin.prolang<>(SELECT oid FROM pg_language WHERE lanname=pin->>'language') THEN RAISE EXCEPTION '68 fonte nova drift: %',pin->>'name' USING ERRCODE='55000';END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='despesas68'::regnamespace)<>17 OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND p.prokind='f')<>(SELECT count(*)+22 FROM witness68_functions) THEN RAISE EXCEPTION '68 função extra' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT 1 FROM witness68_functions w LEFT JOIN pg_proc p ON p.oid=w.oid WHERE p.oid IS NULL OR to_jsonb(p) IS DISTINCT FROM w.snapshot OR pg_get_functiondef(p.oid) IS DISTINCT FROM w.definition) THEN RAISE EXCEPTION '68 predecessor fonte/ACL/config mudou' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT 1 FROM witness68_catalog w LEFT JOIN ( SELECT 'namespace:'||oid k,to_jsonb(n) v FROM pg_namespace n WHERE nspname !~ '^pg_' AND nspname<>'information_schema'
 UNION ALL SELECT 'class:'||c.oid,to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'attribute:'||a.attrelid||':'||a.attnum,to_jsonb(a) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'constraint:'||oid,to_jsonb(k) FROM pg_constraint k
 UNION ALL SELECT 'trigger:'||oid,to_jsonb(t) FROM pg_trigger t
 UNION ALL SELECT 'policy:'||oid,to_jsonb(p) FROM pg_policy p
 UNION ALL SELECT 'default:'||oid,to_jsonb(d) FROM pg_attrdef d
 UNION ALL SELECT 'index:'||indexrelid,to_jsonb(i) FROM pg_index i
 UNION ALL SELECT 'type:'||t.oid,to_jsonb(t) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
 UNION ALL SELECT 'defaultacl:'||oid,to_jsonb(a) FROM pg_default_acl a
 UNION ALL SELECT 'role:'||oid,to_jsonb(r) FROM pg_roles r
 UNION ALL SELECT 'member:'||oid,to_jsonb(m) FROM pg_auth_members m
 UNION ALL SELECT 'setting:'||setdatabase||':'||setrole,to_jsonb(s) FROM pg_db_role_setting s) c USING(k) WHERE c.v IS DISTINCT FROM w.v) THEN RAISE EXCEPTION '68 catálogo predecessor mudou' USING ERRCODE='55000';END IF;

 -- Static new relation layouts; do not derive a seal from a modified new DDL.
 FOR pin IN SELECT value FROM jsonb_array_elements('[{"table":"series","columns":[{"name":"user_id","type":"integer","notnull":true},{"name":"id","type":"uuid","notnull":true},{"name":"frequencia","type":"text","notnull":true},{"name":"ancora","type":"date","notnull":true},{"name":"termino","type":"date","notnull":false},{"name":"estado","type":"text","notnull":true},{"name":"revision","type":"integer","notnull":true},{"name":"next_ordinal","type":"integer","notnull":true},{"name":"last_attempt","type":"bigint","notnull":true},{"name":"failure","type":"boolean","notnull":true}]},{"table":"revisoes","columns":[{"name":"user_id","type":"integer","notnull":true},{"name":"serie_id","type":"uuid","notnull":true},{"name":"revision","type":"integer","notnull":true},{"name":"effective_ordinal","type":"integer","notnull":true},{"name":"template","type":"jsonb","notnull":true}]},{"table":"ocorrencias","columns":[{"name":"user_id","type":"integer","notnull":true},{"name":"serie_id","type":"uuid","notnull":true},{"name":"ordinal","type":"integer","notnull":true},{"name":"competencia","type":"date","notnull":true},{"name":"revision","type":"integer","notnull":true},{"name":"child_uuid","type":"uuid","notnull":true},{"name":"root_id","type":"integer","notnull":true},{"name":"operation20","type":"uuid","notnull":true},{"name":"receipt20","type":"jsonb","notnull":true}]},{"table":"receipts","columns":[{"name":"user_id","type":"integer","notnull":true},{"name":"chave","type":"uuid","notnull":true},{"name":"request","type":"jsonb","notnull":true},{"name":"proof","type":"jsonb","notnull":true}]},{"table":"skips","columns":[{"name":"user_id","type":"integer","notnull":true},{"name":"serie_id","type":"uuid","notnull":true},{"name":"from_ordinal","type":"integer","notnull":true},{"name":"to_exclusive","type":"integer","notnull":true},{"name":"instante","type":"timestamp with time zone","notnull":true}]},{"table":"agenda","columns":[{"name":"singleton","type":"boolean","notnull":true},{"name":"domain","type":"text","notnull":true},{"name":"schedule_cron_task_uid","type":"character varying(65)","notnull":true},{"name":"project_id","type":"text","notnull":true},{"name":"path","type":"text","notnull":true},{"name":"method","type":"text","notnull":true},{"name":"estado","type":"text","notnull":true},{"name":"tick","type":"bigint","notnull":true},{"name":"ultima_execucao","type":"timestamp with time zone","notnull":false},{"name":"resultado","type":"text","notnull":true},{"name":"geradas","type":"integer","notnull":false},{"name":"falhas","type":"integer","notnull":false}]},{"table":"runs","columns":[{"name":"run_id","type":"uuid","notnull":true},{"name":"tick","type":"bigint","notnull":true},{"name":"instante","type":"timestamp with time zone","notnull":true},{"name":"geradas","type":"integer","notnull":true},{"name":"falhas","type":"integer","notnull":true},{"name":"backlog","type":"boolean","notnull":true}]},{"table":"manifesto","columns":[{"name":"id","type":"integer","notnull":true},{"name":"assinatura","type":"text","notnull":true}]}]'::jsonb) LOOP
  IF (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=to_regclass('despesas68.'||(pin->>'table')) AND a.attnum>0 AND NOT a.attisdropped) IS DISTINCT FROM pin->'columns' THEN RAISE EXCEPTION '68 layout novo não corresponde ao plano: %',pin->>'table' USING ERRCODE='55000';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='despesas68'::regnamespace AND (c.relkind NOT IN('r','i') OR c.relkind='r' AND (NOT c.relrowsecurity OR c.relforcerowsecurity OR c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)))) OR EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid IN(SELECT oid FROM pg_class WHERE relnamespace='despesas68'::regnamespace)) THEN RAISE EXCEPTION '68 relation/RLS extra ou proprietário inválido' USING ERRCODE='55000';END IF;

 FOR pin IN SELECT value FROM jsonb_array_elements('["series","revisoes","ocorrencias","receipts","skips","agenda","runs","manifesto"]'::jsonb) LOOP
  IF (SELECT jsonb_agg(jsonb_build_object('kind',k.contype,'def',replace(pg_get_constraintdef(k.oid),'despesas68.',''),'deferrable',k.condeferrable,'deferred',k.condeferred,'validated',k.convalidated) ORDER BY k.contype,replace(pg_get_constraintdef(k.oid),'despesas68.','')) FROM pg_constraint k WHERE k.conrelid=to_regclass('despesas68.'||(pin#>>'{}')))
   IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('kind',k.contype,'def',replace(replace(pg_get_constraintdef(k.oid),'ref68_',''),'despesas68.',''),'deferrable',k.condeferrable,'deferred',k.condeferred,'validated',k.convalidated) ORDER BY k.contype,replace(replace(pg_get_constraintdef(k.oid),'ref68_',''),'despesas68.','')) FROM pg_constraint k WHERE k.conrelid=to_regclass('pg_temp.ref68_'||(pin#>>'{}'))) THEN RAISE EXCEPTION '68 constraint nova divergente: %',pin USING ERRCODE='55000';END IF;
  IF (SELECT jsonb_agg(jsonb_build_object('unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready,'keys',i.indkey::text,'pred',pg_get_expr(i.indpred,i.indrelid),'expr',pg_get_expr(i.indexprs,i.indrelid),'nkeys',i.indnkeyatts,'nattrs',i.indnatts,'nullsdistinct',i.indnullsnotdistinct) ORDER BY i.indisprimary,i.indisunique,i.indkey::text) FROM pg_index i WHERE i.indrelid=to_regclass('despesas68.'||(pin#>>'{}')))
   IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready,'keys',i.indkey::text,'pred',pg_get_expr(i.indpred,i.indrelid),'expr',pg_get_expr(i.indexprs,i.indrelid),'nkeys',i.indnkeyatts,'nattrs',i.indnatts,'nullsdistinct',i.indnullsnotdistinct) ORDER BY i.indisprimary,i.indisunique,i.indkey::text) FROM pg_index i WHERE i.indrelid=to_regclass('pg_temp.ref68_'||(pin#>>'{}'))) THEN RAISE EXCEPTION '68 índice novo divergente: %',pin USING ERRCODE='55000';END IF;
 END LOOP;

 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='despesas68'::regnamespace AND NOT t.tgisinternal)<>15 THEN RAISE EXCEPTION '68 trigger novo extra' USING ERRCODE='55000';END IF;
 FOR pin IN SELECT value FROM jsonb_array_elements('[{"table":"revisoes","name":"imutavel","function":"despesas68.imutavel()","type":27,"deferrable":false,"deferred":false},{"table":"revisoes","name":"imutavel_truncate","function":"despesas68.imutavel()","type":34,"deferrable":false,"deferred":false},{"table":"ocorrencias","name":"imutavel","function":"despesas68.imutavel()","type":27,"deferrable":false,"deferred":false},{"table":"ocorrencias","name":"imutavel_truncate","function":"despesas68.imutavel()","type":34,"deferrable":false,"deferred":false},{"table":"receipts","name":"imutavel","function":"despesas68.imutavel()","type":27,"deferrable":false,"deferred":false},{"table":"receipts","name":"imutavel_truncate","function":"despesas68.imutavel()","type":34,"deferrable":false,"deferred":false},{"table":"skips","name":"imutavel","function":"despesas68.imutavel()","type":27,"deferrable":false,"deferred":false},{"table":"skips","name":"imutavel_truncate","function":"despesas68.imutavel()","type":34,"deferrable":false,"deferred":false},{"table":"runs","name":"imutavel","function":"despesas68.imutavel()","type":27,"deferrable":false,"deferred":false},{"table":"runs","name":"imutavel_truncate","function":"despesas68.imutavel()","type":34,"deferrable":false,"deferred":false},{"table":"manifesto","name":"imutavel","function":"despesas68.imutavel()","type":27,"deferrable":false,"deferred":false},{"table":"manifesto","name":"imutavel_truncate","function":"despesas68.imutavel()","type":34,"deferrable":false,"deferred":false},{"table":"series","name":"identidade68","function":"despesas68.guardar_serie()","type":27,"deferrable":false,"deferred":false},{"table":"series","name":"imutavel_truncate","function":"despesas68.imutavel()","type":34,"deferrable":false,"deferred":false},{"table":"ocorrencias","name":"ocorrencia68_complete","function":"despesas68.commit_check()","type":5,"deferrable":true,"deferred":true}]'::jsonb) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=to_regclass('despesas68.'||(pin->>'table')) AND t.tgname=pin->>'name' AND t.tgfoid=to_regprocedure(pin->>'function') AND t.tgtype=(pin->>'type')::integer AND t.tgdeferrable=(pin->>'deferrable')::boolean AND t.tginitdeferred=(pin->>'deferred')::boolean AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgnargs=0 AND t.tgqual IS NULL) THEN RAISE EXCEPTION '68 trigger novo não exato: %',pin USING ERRCODE='55000';END IF;
 END LOOP;

 IF EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND n.nspname<>'despesas68' AND NOT EXISTS(SELECT 1 FROM witness68_catalog WHERE k='namespace:'||n.oid))
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','despesas68') AND NOT EXISTS(SELECT 1 FROM witness68_catalog WHERE k='class:'||c.oid))
 OR EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname !~ '^pg_' AND n.nspname NOT IN('information_schema','despesas68') AND NOT EXISTS(SELECT 1 FROM witness68_catalog WHERE k='type:'||t.oid))
 OR EXISTS(SELECT 1 FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'despesas68' AND NOT EXISTS(SELECT 1 FROM witness68_catalog WHERE witness68_catalog.k='constraint:'||k.oid)) THEN RAISE EXCEPTION '68 objeto extra fora da adição autorizada' USING ERRCODE='55000';END IF;
 FOR pin IN SELECT value FROM jsonb_array_elements('["series","revisoes","ocorrencias","receipts","skips","agenda","runs","manifesto"]'::jsonb) LOOP
  IF (SELECT jsonb_agg(jsonb_build_object('attnum',d.adnum,'expr',pg_get_expr(d.adbin,d.adrelid)) ORDER BY d.adnum) FROM pg_attrdef d WHERE d.adrelid=to_regclass('despesas68.'||(pin#>>'{}')))
  IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('attnum',d.adnum,'expr',pg_get_expr(d.adbin,d.adrelid)) ORDER BY d.adnum) FROM pg_attrdef d WHERE d.adrelid=to_regclass('pg_temp.ref68_'||(pin#>>'{}'))) THEN RAISE EXCEPTION '68 default novo divergente: %',pin USING ERRCODE='55000';END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='despesas68'::regnamespace AND relkind='r')<>8 OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='despesas68'::regnamespace AND relkind='r' AND relname NOT IN('series','revisoes','ocorrencias','receipts','skips','agenda','runs','manifesto')) OR EXISTS(SELECT 1 FROM pg_constraint WHERE connamespace='despesas68'::regnamespace AND contype='f' AND confrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)) THEN RAISE EXCEPTION '68 relation extra/FK public interditada' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='despesas68' AND a.grantee<>n.nspowner)
 OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='despesas68'::regnamespace AND a.grantee<>c.relowner)
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE (p.pronamespace='despesas68'::regnamespace OR p.oid=ANY(ARRAY['public.rpc_listar_despesas68(integer,uuid)'::regprocedure,'public.rpc_configurar_despesas68(integer,uuid,jsonb)'::regprocedure,'public.rpc_recuperar_despesas68(integer,uuid,jsonb)'::regprocedure,'public.rpc_gerar_despesas68(text,uuid)'::regprocedure,'public.rpc_vincular_agenda_despesas68(text,text,text,boolean)'::regprocedure]::oid[])) AND a.grantee<>p.proowner AND NOT(p.pronamespace='public'::regnamespace AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role') AND a.privilege_type='EXECUTE' AND NOT a.is_grantable AND a.grantor=p.proowner)) THEN RAISE EXCEPTION '68 ACL aberta/herdada' USING ERRCODE='55000';END IF;
 FOR witness_row IN SELECT * FROM witness68_data LOOP
  EXECUTE format('SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),''[]''::jsonb)::text,''sha256''),''hex'') FROM %s x',witness_row.rel) INTO h;
  IF h IS DISTINCT FROM witness_row.hash THEN RAISE EXCEPTION '68 dados históricos/financeiros alterados: %',witness_row.rel USING ERRCODE='55000';END IF;
 END LOOP;
 IF (SELECT encode(extensions.digest(prosrc,'sha256'),'hex') FROM pg_proc WHERE oid='public.caixa37_metadata()'::regprocedure) IS DISTINCT FROM '088bced7e8df832b95b32a44f83c2d19450eaa076c487179df54b410dd224280' THEN RAISE EXCEPTION '68 metadata37 original drift' USING ERRCODE='55000';END IF;
 new_public_oids:=ARRAY['public.rpc_listar_despesas68(integer,uuid)'::regprocedure,'public.rpc_configurar_despesas68(integer,uuid,jsonb)'::regprocedure,'public.rpc_recuperar_despesas68(integer,uuid,jsonb)'::regprocedure,'public.rpc_gerar_despesas68(text,uuid)'::regprocedure,'public.rpc_vincular_agenda_despesas68(text,text,text,boolean)'::regprocedure]::oid[];
 SELECT public.caixa37_hash(jsonb_build_object(
 'funcoes',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE (p.pronamespace='public'::regnamespace OR p.proname LIKE 'caixa37\_%' ESCAPE '\' OR p.proname LIKE 'rpc\_%caixa37' ESCAPE '\') AND p.oid <> ALL(new_public_oids)),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='public'::regnamespace AND a.attnum>0),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(t),pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) ORDER BY oid) FROM pg_roles WHERE rolname IN('service_role','anon','authenticated',current_user)),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m WHERE member IN(SELECT oid FROM pg_roles WHERE rolname IN('service_role','anon','authenticated'))))) INTO derived;
 SELECT assinatura INTO STRICT old FROM witness68_seal;
 IF derived IS DISTINCT FROM old THEN RAISE EXCEPTION '68 delta37 não é somente OIDs novos autorizados' USING ERRCODE='55000';END IF;
 final:=public.caixa37_metadata();
 UPDATE public.caixa37_manifesto SET assinatura=final WHERE id=1 AND assinatura=old;
 GET DIAGNOSTICS nr=ROW_COUNT;IF nr<>1 THEN RAISE EXCEPTION '68 CAS37 falhou' USING ERRCODE='55000';END IF;
 INSERT INTO despesas68.manifesto VALUES(1,despesas68.metadata());
 PERFORM despesas68.verificar(); PERFORM public.legados_verificar(); PERFORM public.multimodal_verificar(); PERFORM public.multa36_verificar(); PERFORM telefone41.verificar(); PERFORM manutencao44.verificar(); PERFORM caixa_manutencao45.verificar(); PERFORM calendario46.verificar(); PERFORM private47.verificar(); PERFORM manutencao48.verificar();
END $exact68$;
COMMIT;
