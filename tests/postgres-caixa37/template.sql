CREATE TABLE public.caixa37_operacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id integer NOT NULL REFERENCES public.users(id),chave uuid NOT NULL,acao text NOT NULL CHECK(acao IN('aporte','transferir')),
 request jsonb NOT NULL,hash_request text NOT NULL CHECK(hash_request ~ '^[a-f0-9]{64}$'),instante timestamptz NOT NULL,
 resultado jsonb,auditoria jsonb,hash_auditoria text,concluida_em timestamptz,UNIQUE(user_id,chave),
 CHECK((resultado IS NULL AND auditoria IS NULL AND hash_auditoria IS NULL AND concluida_em IS NULL) OR (resultado IS NOT NULL AND auditoria IS NOT NULL AND hash_auditoria IS NOT NULL AND concluida_em IS NOT NULL)));
CREATE TABLE public.caixa37_pernas(
 operacao_id uuid NOT NULL REFERENCES public.caixa37_operacoes(id),papel text NOT NULL CHECK(papel IN('aporte','origem','destino')),user_id integer NOT NULL,
 transacao_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id) DEFERRABLE INITIALLY DEFERRED,snapshot jsonb NOT NULL,hash_snapshot text NOT NULL,PRIMARY KEY(operacao_id,papel));
CREATE TABLE public.caixa37_contas(conta_id integer PRIMARY KEY REFERENCES public.contas_caixa(id),user_id integer NOT NULL,saldo_base numeric(15,2) NOT NULL,primeira_op uuid NOT NULL REFERENCES public.caixa37_operacoes(id));
CREATE TABLE public.caixa37_fences(user_id integer NOT NULL REFERENCES public.users(id),chave uuid NOT NULL,request jsonb NOT NULL,hash_request text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(user_id,chave));
CREATE TABLE public.caixa37_capacidades(xid bigint NOT NULL,pid integer NOT NULL,operacao_id uuid NOT NULL REFERENCES public.caixa37_operacoes(id),guard text NOT NULL,papel text NOT NULL,
 tabela text NOT NULL CHECK(tabela='transacoes_caixa'),evento text NOT NULL CHECK(evento='INSERT'),anterior jsonb CHECK(anterior IS NULL),posterior jsonb NOT NULL,PRIMARY KEY(xid,pid,operacao_id,guard,papel));
CREATE TABLE public.caixa37_coexistencia(xid bigint NOT NULL,pid integer NOT NULL,posterior jsonb NOT NULL,witness text NOT NULL,PRIMARY KEY(xid,pid));
CREATE TABLE public.caixa37_manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL);
CREATE FUNCTION public.caixa37_hash(j jsonb) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ SELECT encode(extensions.digest(j::text,'sha256'),'hex') $$;
CREATE FUNCTION public.caixa37_decimal(v numeric) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF v IS NULL OR v::text IN('NaN','Infinity','-Infinity') OR v<>round(v,2) THEN RAISE EXCEPTION 'Decimal37 inválido' USING ERRCODE='23514'; END IF;
 IF v=0 THEN RETURN '0.00'; END IF;
 RETURN round(v,2)::text;
END $$;
CREATE FUNCTION public.caixa37_dinheiro(v text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF v IS NULL OR v !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' OR v='0.00' THEN RAISE EXCEPTION 'Dinheiro37 canônico positivo obrigatório' USING ERRCODE='22023'; END IF; RETURN v::numeric;
END $$;
CREATE FUNCTION public.caixa37_intencao(a text,origem integer,destino integer,v text,d text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.caixa37_dinheiro(v);
 IF a IS NULL OR a NOT IN('aporte','transferir') OR destino IS NULL OR destino<=0 OR (a='aporte' AND origem IS NOT NULL)
 OR (a='transferir' AND (origem IS NULL OR origem<=0 OR origem=destino)) OR (d IS NOT NULL AND (d<>btrim(d) OR length(d) NOT BETWEEN 1 AND 500)) THEN RAISE EXCEPTION 'Intenção37 inválida' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION public.caixa37_request(r jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE keys text[]:=ARRAY['acao','contaOrigemId','contaDestinoId','valor','descricao','dataTransacao','estadoHash']; n text;
BEGIN
 IF r IS NULL OR jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Request37 objeto obrigatório' USING ERRCODE='22023'; END IF;
 IF r-keys<>'{}'::jsonb OR (SELECT count(*) FROM jsonb_object_keys(r))<>7 OR jsonb_typeof(r->'acao') IS DISTINCT FROM 'string'
 OR jsonb_typeof(r->'contaDestinoId') IS DISTINCT FROM 'number' OR coalesce(r->>'contaDestinoId','') !~ '^[1-9][0-9]{0,9}$'
 OR NOT(r->'contaOrigemId'='null'::jsonb OR (jsonb_typeof(r->'contaOrigemId')='number' AND r->>'contaOrigemId' ~ '^[1-9][0-9]{0,9}$'))
 OR jsonb_typeof(r->'valor') IS DISTINCT FROM 'string' OR NOT(r->'descricao'='null'::jsonb OR jsonb_typeof(r->'descricao')='string')
 OR jsonb_typeof(r->'dataTransacao') IS DISTINCT FROM 'string' OR coalesce(r->>'dataTransacao','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 OR jsonb_typeof(r->'estadoHash') IS DISTINCT FROM 'string' OR coalesce(r->>'estadoHash','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Request37 chaves/tipos inválidos' USING ERRCODE='22023'; END IF;
 PERFORM public.caixa37_intencao(r->>'acao',(r->>'contaOrigemId')::int,(r->>'contaDestinoId')::int,r->>'valor',r->>'descricao');
 IF (r->>'dataTransacao')::date NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' THEN RAISE EXCEPTION 'DATE37 fora da faixa' USING ERRCODE='22023'; END IF;
 RETURN r;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Request37 fora da faixa' USING ERRCODE='22023';
END $$;
CREATE FUNCTION public.caixa37_barreira(uid integer,k uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF uid IS NULL OR uid<=0 OR k IS NULL THEN RAISE EXCEPTION 'Owner/UUID37 inválidos' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('caixa37:'||uid::text||':'||k::text,37));
END $$;
CREATE FUNCTION public.caixa37_conjunto(uid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object(
 'contas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contas_caixa WHERE user_id=uid),'[]'::jsonb),
 'contratos',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.contratos WHERE id IN(SELECT contrato_id FROM public.transacoes_caixa WHERE user_id=uid OR conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid)) OR id IN(SELECT contrato_id FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE user_id=uid OR conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid)))),'[]'::jsonb),
 'parcelas',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.parcelas WHERE id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE user_id=uid OR conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid))),'[]'::jsonb));
$$;
CREATE FUNCTION public.caixa37_travar(uid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s jsonb; n integer; aids integer[]; cids integer[]; pids integer[]; clients integer[]; collectors integer[];
BEGIN
 IF uid IS NULL OR uid<=0 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid) THEN RAISE EXCEPTION 'Owner37 indisponível' USING ERRCODE='42501'; END IF;
 s:=public.caixa37_conjunto(uid);
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
 PERFORM 1 FROM public.transacoes_caixa WHERE user_id=uid OR conta_caixa_id=ANY(aids) ORDER BY id FOR NO KEY UPDATE NOWAIT;
 IF public.caixa37_conjunto(uid) IS DISTINCT FROM s OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND NOT cliente_id=ANY(clients))
 OR EXISTS(SELECT 1 FROM public.contratos WHERE id=ANY(cids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE id=ANY(pids) AND koletor_id IS NOT NULL AND NOT koletor_id=ANY(collectors)) THEN RAISE EXCEPTION 'Conjunto37 mudou durante locks' USING ERRCODE='40001'; END IF;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Row37 concorrente' USING ERRCODE='40001';
END $$;
CREATE FUNCTION public.caixa37_snapshot(uid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT jsonb_build_object('contas',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.contas_caixa c WHERE user_id=uid),'[]'::jsonb),
 'ledger',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transacoes_caixa t WHERE user_id=uid OR conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid)),'[]'::jsonb));
$$;
CREATE FUNCTION public.caixa37_provas(uid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT jsonb_build_object('operacoes',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.caixa37_operacoes o WHERE user_id=uid AND resultado IS NOT NULL),'[]'::jsonb),
 'pernas',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY operacao_id,papel) FROM public.caixa37_pernas p WHERE user_id=uid),'[]'::jsonb),
 'contas',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY conta_id) FROM public.caixa37_contas c WHERE user_id=uid),'[]'::jsonb));
$$;
CREATE FUNCTION public.caixa37_consumir(g text,t text,e text,a jsonb,b jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE ok boolean;
BEGIN
 IF t<>'transacoes_caixa' OR e<>'INSERT' OR a IS NOT NULL THEN RETURN false; END IF;
 DELETE FROM public.caixa37_capacidades cap USING public.caixa37_operacoes op,public.caixa37_pernas p
 WHERE cap.xid=txid_current() AND cap.pid=pg_backend_pid() AND cap.guard=g AND cap.tabela=t AND cap.evento=e AND cap.anterior IS NULL AND cap.posterior=b
 AND cap.operacao_id=op.id AND p.operacao_id=op.id AND p.papel=cap.papel AND p.snapshot=b AND p.hash_snapshot=public.caixa37_hash(b)
 AND op.resultado IS NULL AND pg_xact_status(op.xmin::text::xid8)='in progress' AND pg_xact_status(p.xmin::text::xid8)='in progress' AND pg_xact_status(cap.xmin::text::xid8)='in progress'
 AND op.hash_request=public.caixa37_hash(op.request) AND public.caixa37_request(op.request)=op.request AND p.user_id=op.user_id AND b->>'user_id'=op.user_id::text
 AND b->'contrato_id'='null'::jsonb AND b->'parcela_id'='null'::jsonb AND b->>'valor'=op.request->>'valor' AND b->>'data_transacao'=op.request->>'dataTransacao'
 AND (b->>'createdAt')::timestamptz=op.instante AND p.transacao_id=(b->>'id')::int
 AND ((op.acao='aporte' AND p.papel='aporte' AND b->>'tipo'='entrada' AND b->>'categoria'='ajuste_manual' AND b->>'descricao'='Aporte37 '||op.id::text AND b->'conta_caixa_id'=op.request->'contaDestinoId')
 OR (op.acao='transferir' AND p.papel IN('origem','destino') AND b->>'categoria'='transferencia_conta' AND b->>'descricao'='Transferencia37 '||op.id::text||' '||p.papel AND b->>'tipo'=CASE p.papel WHEN 'origem' THEN 'saida' ELSE 'entrada' END AND b->'conta_caixa_id'=op.request->CASE p.papel WHEN 'origem' THEN 'contaOrigemId' ELSE 'contaDestinoId' END)) RETURNING true INTO ok;
 RETURN coalesce(ok,false);
END $$;
-- SIX EXTENSIONS
CREATE FUNCTION public.caixa37_validar_op(oid37 uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE
 op public.caixa37_operacoes%ROWTYPE; prior public.caixa37_operacoes%ROWTYPE; first_op public.caixa37_operacoes%ROWTYPE;
 p public.caixa37_pernas%ROWTYPE; pin public.caixa37_contas%ROWTYPE;
 r jsonb; q jsonb; antes jsonb; expected jsonb; physical jsonb; snapshots jsonb:='[]'::jsonb; resultlegs jsonb:='[]'::jsonb;
 obj jsonb; shape jsonb; x jsonb; s jsonb; k text; typ text; aid integer; origem integer; destino integer; n integer;
 before_ids integer[]; prior_ids uuid[]; first_id uuid; frozen_proofs jsonb; state_hash text;
 qorigem jsonb; qdestino jsonb; qexpected jsonb; rexpected jsonb;
 val numeric; total numeric; delta_total numeric; delta_origem numeric; delta_destino numeric;
 saldo_shape jsonb:='{"contaCaixaId":"number","nome":"string","saldoBase":"string","entradas":"string","saidas":"string","saldoEfetivo":"string"}';
 account_shape jsonb:='{"id":"number","user_id":"number","nome":"string","tipo":"string","saldo":"number","ativo":"boolean","createdAt":"string","updatedAt":"string"}';
 ledger_shape jsonb:='{"id":"number","user_id":"number","conta_caixa_id":"number","tipo":"string","categoria":"string|null","descricao":"string","valor":"number","data_transacao":"string","contrato_id":"number|null","parcela_id":"number|null","createdAt":"string"}';
BEGIN
 SELECT * INTO op FROM public.caixa37_operacoes WHERE id=oid37;
 IF op.id IS NULL OR op.user_id IS NULL OR op.resultado IS NULL OR op.auditoria IS NULL OR op.concluida_em IS NULL
 OR NOT isfinite(op.instante) OR NOT isfinite(op.concluida_em)
 OR op.hash_request IS DISTINCT FROM public.caixa37_hash(op.request)
 OR public.caixa37_request(op.request) IS DISTINCT FROM op.request OR op.acao IS DISTINCT FROM op.request->>'acao'
 OR op.hash_auditoria IS DISTINCT FROM public.caixa37_hash(op.auditoria) THEN
 RAISE EXCEPTION 'Operação37 incompleta/adulterada' USING ERRCODE='23514'; END IF;
 r:=op.resultado; q:=op.auditoria->'cotacao'; antes:=op.auditoria->'antes';
 -- Cada chave obrigatória tem um tipo explícito. Ausência (SQL NULL) nunca equivale a JSON null.
 -- Esta fase precede casts, expansão de arrays e extração numérica de r/q/auditoria/snapshot.
 FOR obj,shape IN SELECT * FROM (VALUES
 (op.auditoria,'{"request":"object","requestHash":"string","cotacao":"object","cotacaoHash":"string","antes":"object","depois":"object","pernas":"array","predecessoresHash":"string","instante":"string","diaBrt":"string","resultado":"object"}'::jsonb),
 (r,'{"success":"boolean","regra":"string","acao":"string","operationId":"string","idempotencyKey":"string","repetida":"boolean","contaOrigemId":"number|null","contaDestinoId":"number","valor":"string","dataTransacao":"string","descricao":"string|null","pernas":"array","saldoOrigemAntes":"string|null","saldoOrigemApos":"string|null","saldoDestinoAntes":"string","saldoDestinoApos":"string","saldoTotalOwnerAntes":"string","saldoTotalOwnerApos":"string"}'::jsonb),
 (q,'{"elegivel":"boolean","regra":"string","acao":"string","contaOrigemId":"number|null","contaDestinoId":"number","valor":"string","descricao":"string|null","dataTransacao":"string","estadoHash":"string","origem":"object|null","destino":"object","saldoOrigemApos":"string|null","saldoDestinoApos":"string","saldoTotalOwnerAntes":"string","saldoTotalOwnerApos":"string"}'::jsonb),
 (antes,'{"contas":"array","ledger":"array"}'::jsonb),
 (op.auditoria->'depois','{"contas":"array","ledger":"array"}'::jsonb)
 ) schemas(obj,shape) LOOP
 IF jsonb_typeof(obj) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'JSON37 objeto obrigatório' USING ERRCODE='23514'; END IF;
 IF obj-ARRAY(SELECT jsonb_object_keys(shape)) IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'JSON37 chave extra' USING ERRCODE='23514'; END IF;
 FOR k,typ IN SELECT * FROM jsonb_each_text(shape) LOOP
 IF (jsonb_typeof(obj->k)=ANY(string_to_array(typ,'|'))) IS DISTINCT FROM true THEN RAISE EXCEPTION 'JSON37 chave/tipo inválido: %',k USING ERRCODE='23514'; END IF;
 END LOOP;
 END LOOP;
 IF op.auditoria->'request' IS DISTINCT FROM op.request OR op.auditoria->'requestHash' IS DISTINCT FROM to_jsonb(op.hash_request)
 OR op.auditoria->'resultado' IS DISTINCT FROM r OR op.auditoria->'instante' IS DISTINCT FROM to_jsonb(op.instante)
 OR op.auditoria->'diaBrt' IS DISTINCT FROM op.request->'dataTransacao'
 OR (op.instante AT TIME ZONE 'America/Sao_Paulo')::date IS DISTINCT FROM (op.request->>'dataTransacao')::date
 OR q->'estadoHash' IS DISTINCT FROM op.request->'estadoHash' OR op.auditoria->'cotacaoHash' IS DISTINCT FROM to_jsonb(public.caixa37_hash(q))
 OR (op.auditoria->>'predecessoresHash' ~ '^[a-f0-9]{64}$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Auditoria37 envelope divergente' USING ERRCODE='23514'; END IF;
 origem:=(op.request->>'contaOrigemId')::int; destino:=(op.request->>'contaDestinoId')::int; val:=(op.request->>'valor')::numeric;
 -- Decimais de resposta seguem shared/caixa37.ts; agregados não recebem o limite da operação.
 FOR obj IN SELECT r UNION ALL SELECT q UNION ALL SELECT q->'destino' UNION ALL SELECT q->'origem' WHERE op.acao='transferir' LOOP
 IF obj=q->'destino' OR obj=q->'origem' THEN
 IF jsonb_typeof(obj) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'ContaSaldo37 objeto obrigatório' USING ERRCODE='23514'; END IF;
 IF obj-ARRAY(SELECT jsonb_object_keys(saldo_shape)) IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'ContaSaldo37 chave extra' USING ERRCODE='23514'; END IF;
 FOR k,typ IN SELECT * FROM jsonb_each_text(saldo_shape) LOOP
 IF jsonb_typeof(obj->k) IS DISTINCT FROM typ THEN RAISE EXCEPTION 'ContaSaldo37 chave/tipo inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
 END IF;
 FOR k,x IN SELECT key,value FROM jsonb_each(obj) WHERE key LIKE 'saldo%' OR key IN('entradas','saidas') LOOP
 IF x='null'::jsonb AND op.acao='aporte' AND k IN('saldoOrigemAntes','saldoOrigemApos') THEN CONTINUE; END IF;
 IF jsonb_typeof(x) IS DISTINCT FROM 'string' OR (x#>>'{}' ~ '^-?(0|[1-9][0-9]*)\.[0-9]{2}$') IS DISTINCT FROM true OR x='"-0.00"'::jsonb THEN
 RAISE EXCEPTION 'Decimal37 de resposta não canônico' USING ERRCODE='23514'; END IF;
 END LOOP;
 END LOOP;
 IF op.acao='aporte' AND (r->'saldoOrigemAntes' IS DISTINCT FROM 'null'::jsonb OR r->'saldoOrigemApos' IS DISTINCT FROM 'null'::jsonb OR q->'origem' IS DISTINCT FROM 'null'::jsonb OR q->'saldoOrigemApos' IS DISTINCT FROM 'null'::jsonb) THEN
 RAISE EXCEPTION 'Origem37 deve ser null explícito no aporte' USING ERRCODE='23514'; END IF;
 IF op.acao='transferir' AND (jsonb_typeof(r->'saldoOrigemAntes') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'saldoOrigemApos') IS DISTINCT FROM 'string' OR jsonb_typeof(q->'saldoOrigemApos') IS DISTINCT FROM 'string') THEN
 RAISE EXCEPTION 'Origem37 obrigatória na transferência' USING ERRCODE='23514'; END IF;
 FOR obj IN SELECT value FROM jsonb_array_elements(r->'pernas') LOOP
 shape:='{"papel":"string","transacaoCaixaId":"string","contaCaixaId":"number","tipo":"string","valor":"string"}'::jsonb;
 IF jsonb_typeof(obj) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PernaResult37 objeto obrigatório' USING ERRCODE='23514'; END IF;
 IF obj-ARRAY(SELECT jsonb_object_keys(shape)) IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'PernaResult37 chave extra' USING ERRCODE='23514'; END IF;
 FOR k,typ IN SELECT * FROM jsonb_each_text(shape) LOOP
 IF jsonb_typeof(obj->k) IS DISTINCT FROM typ THEN RAISE EXCEPTION 'PernaResult37 chave/tipo inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
 END LOOP;
 -- Rowtypes completos de snapshot: validar chaves/tipos e gramática antes dos casts.
 FOR obj,shape IN
 SELECT c,account_shape FROM jsonb_array_elements((antes->'contas')||(op.auditoria->'depois'->'contas')) c
 UNION ALL SELECT t,ledger_shape FROM jsonb_array_elements((antes->'ledger')||(op.auditoria->'depois'->'ledger')||(op.auditoria->'pernas')) t
 UNION ALL SELECT lp.snapshot,ledger_shape FROM public.caixa37_pernas lp WHERE lp.operacao_id=op.id LOOP
 IF jsonb_typeof(obj) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Row37 objeto obrigatório' USING ERRCODE='23514'; END IF;
 IF obj-ARRAY(SELECT jsonb_object_keys(shape)) IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'Row37 chave extra' USING ERRCODE='23514'; END IF;
 FOR k,typ IN SELECT * FROM jsonb_each_text(shape) LOOP
 IF (jsonb_typeof(obj->k)=ANY(string_to_array(typ,'|'))) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Row37 chave/tipo inválido: %',k USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR k,x IN SELECT key,value FROM jsonb_each(obj) WHERE key IN('id','user_id','conta_caixa_id','contrato_id','parcela_id') LOOP
 IF x='null'::jsonb AND k IN('contrato_id','parcela_id') THEN CONTINUE; END IF;
 IF (x#>>'{}' ~ '^[1-9][0-9]{0,9}$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Row37 ID inválido' USING ERRCODE='23514'; END IF;
 IF (x#>>'{}')::numeric>2147483647 THEN RAISE EXCEPTION 'Row37 ID fora da faixa' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF obj->'user_id' IS DISTINCT FROM to_jsonb(op.user_id) THEN RAISE EXCEPTION 'Snapshot37 owner divergente' USING ERRCODE='23514'; END IF;
 IF shape=account_shape THEN
 IF (obj->>'saldo' ~ '^-?(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Snapshot37 base inválida' USING ERRCODE='23514'; END IF;
 IF to_jsonb((obj->>'createdAt')::timestamptz) IS DISTINCT FROM obj->'createdAt' OR to_jsonb((obj->>'updatedAt')::timestamptz) IS DISTINCT FROM obj->'updatedAt'
 OR NOT isfinite((obj->>'createdAt')::timestamptz) OR NOT isfinite((obj->>'updatedAt')::timestamptz) THEN RAISE EXCEPTION 'Snapshot37 timestamp de conta inválido' USING ERRCODE='23514'; END IF;
 ELSE
 IF (obj->>'valor' ~ '^(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$') IS DISTINCT FROM true OR (obj->>'tipo' IN('entrada','saida')) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Snapshot37 ledger valor/tipo inválido' USING ERRCODE='23514'; END IF;
 IF (obj->>'valor')::numeric<=0 OR to_jsonb((obj->>'data_transacao')::date) IS DISTINCT FROM obj->'data_transacao' OR NOT isfinite((obj->>'data_transacao')::date)
 OR to_jsonb((obj->>'createdAt')::timestamptz) IS DISTINCT FROM obj->'createdAt' OR NOT isfinite((obj->>'createdAt')::timestamptz) THEN RAISE EXCEPTION 'Snapshot37 ledger data/valor inválido' USING ERRCODE='23514'; END IF;
 END IF;
 END LOOP;
 FOR s IN SELECT antes UNION ALL SELECT op.auditoria->'depois' LOOP
 FOREACH k IN ARRAY ARRAY['contas','ledger'] LOOP
 IF s->k IS DISTINCT FROM coalesce((SELECT jsonb_agg(v ORDER BY (v->>'id')::int) FROM jsonb_array_elements(s->k) v),'[]'::jsonb)
 OR (SELECT count(*) FROM jsonb_array_elements(s->k)) IS DISTINCT FROM (SELECT count(DISTINCT v->'id') FROM jsonb_array_elements(s->k) v) THEN RAISE EXCEPTION 'Snapshot37 ordem/ID duplicado' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s->'ledger') t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'contas') c WHERE c->'id'=t->'conta_caixa_id')) THEN RAISE EXCEPTION 'Snapshot37 conta de ledger ausente/alheia' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'contas') c WHERE c->'id'=to_jsonb(destino) AND c->'ativo'='true'::jsonb)
 OR (op.acao='transferir' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'contas') c WHERE c->'id'=to_jsonb(origem) AND c->'ativo'='true'::jsonb)) THEN RAISE EXCEPTION 'Conta37 não elegível no instante histórico' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO n FROM public.caixa37_pernas WHERE operacao_id=op.id;
 IF n IS DISTINCT FROM (CASE op.acao WHEN 'aporte' THEN 1 ELSE 2 END) OR jsonb_array_length(r->'pernas') IS DISTINCT FROM n THEN RAISE EXCEPTION 'Pernas37 quantidade divergente' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT * FROM public.caixa37_pernas WHERE operacao_id=op.id ORDER BY CASE papel WHEN 'origem' THEN 0 ELSE 1 END LOOP
 SELECT to_jsonb(t) INTO physical FROM public.transacoes_caixa t WHERE id=p.transacao_id;
 aid:=(p.snapshot->>'conta_caixa_id')::int;
 IF p.user_id IS DISTINCT FROM op.user_id OR p.snapshot IS DISTINCT FROM physical OR p.hash_snapshot IS DISTINCT FROM public.caixa37_hash(p.snapshot)
 OR p.snapshot->'id' IS DISTINCT FROM to_jsonb(p.transacao_id) OR p.snapshot->>'valor' IS DISTINCT FROM op.request->>'valor'
 OR p.snapshot->'data_transacao' IS DISTINCT FROM op.request->'dataTransacao' OR p.snapshot->'createdAt' IS DISTINCT FROM to_jsonb(op.instante)
 OR p.snapshot->'contrato_id' IS DISTINCT FROM 'null'::jsonb OR p.snapshot->'parcela_id' IS DISTINCT FROM 'null'::jsonb
 OR ((op.acao='aporte' AND p.papel='aporte' AND p.snapshot->>'tipo'='entrada' AND p.snapshot->>'categoria'='ajuste_manual' AND p.snapshot->>'descricao'='Aporte37 '||op.id::text AND aid=destino)
 OR (op.acao='transferir' AND p.papel IN('origem','destino') AND p.snapshot->>'categoria'='transferencia_conta' AND p.snapshot->>'descricao'='Transferencia37 '||op.id::text||' '||p.papel AND p.snapshot->>'tipo'=CASE p.papel WHEN 'origem' THEN 'saida' ELSE 'entrada' END AND aid=CASE p.papel WHEN 'origem' THEN origem ELSE destino END)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Perna37 física/prova divergente' USING ERRCODE='23514'; END IF;
 -- Não comparar nome/ativo/updatedAt atuais: rename, inativação e append preservam replay.
 SELECT * INTO pin FROM public.caixa37_contas WHERE conta_id=aid;
 IF pin.conta_id IS NULL OR pin.user_id IS DISTINCT FROM op.user_id
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa a WHERE a.id=aid AND a.user_id=op.user_id AND a.saldo IS NOT DISTINCT FROM pin.saldo_base)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'contas') c WHERE c->'id'=to_jsonb(aid) AND c->'saldo'=to_jsonb(pin.saldo_base)) THEN RAISE EXCEPTION 'Pin37 identidade/base divergente' USING ERRCODE='23514'; END IF;
 -- Ordem causal serializada: a primeira utilização não tem perna37 desta conta em antes;
 -- toda utilização diferente já contém sua perna. Não ordenar UUIDs, relógio ou sequence cache.
 first_id:=pin.primeira_op;
 SELECT * INTO first_op FROM public.caixa37_operacoes WHERE id=first_id;
 IF first_op.id IS NULL OR first_op.user_id IS DISTINCT FROM op.user_id OR first_op.resultado IS NULL OR first_op.auditoria IS NULL OR first_op.concluida_em IS NULL
 OR first_op.hash_request IS DISTINCT FROM public.caixa37_hash(first_op.request) OR first_op.hash_auditoria IS DISTINCT FROM public.caixa37_hash(first_op.auditoria)
 OR public.caixa37_request(first_op.request) IS DISTINCT FROM first_op.request OR first_op.acao IS DISTINCT FROM first_op.request->>'acao'
 OR first_op.auditoria->'requestHash' IS DISTINCT FROM to_jsonb(first_op.hash_request)
 OR first_op.auditoria->'request' IS DISTINCT FROM first_op.request OR first_op.auditoria->'resultado' IS DISTINCT FROM first_op.resultado
 OR first_op.resultado->'operationId' IS DISTINCT FROM to_jsonb(first_op.id) OR first_op.resultado->'idempotencyKey' IS DISTINCT FROM to_jsonb(first_op.chave)
 OR first_op.resultado->'success' IS DISTINCT FROM 'true'::jsonb OR first_op.resultado->'repetida' IS DISTINCT FROM 'false'::jsonb
 OR jsonb_typeof(first_op.auditoria->'antes'->'contas') IS DISTINCT FROM 'array' OR jsonb_typeof(first_op.auditoria->'antes'->'ledger') IS DISTINCT FROM 'array'
 OR (SELECT count(*) FROM public.caixa37_pernas lp WHERE lp.operacao_id=first_id) IS DISTINCT FROM (CASE first_op.acao WHEN 'aporte' THEN 1 WHEN 'transferir' THEN 2 ELSE 0 END)::bigint
 OR (first_op.request->'contaDestinoId'=to_jsonb(aid) OR first_op.request->'contaOrigemId'=to_jsonb(aid)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Pin37 origem incompleta/alheia' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(first_op.auditoria->'antes'->'contas') c WHERE c->'id'=to_jsonb(aid) AND c->'user_id'=to_jsonb(op.user_id) AND c->'saldo'=to_jsonb(pin.saldo_base))
 OR NOT EXISTS(SELECT 1 FROM public.caixa37_pernas lp JOIN public.transacoes_caixa t ON t.id=lp.transacao_id WHERE lp.operacao_id=first_id AND t.conta_caixa_id=aid AND lp.user_id=op.user_id AND t.user_id=op.user_id AND lp.snapshot=to_jsonb(t) AND lp.hash_snapshot=public.caixa37_hash(lp.snapshot))
 OR EXISTS(SELECT 1 FROM public.caixa37_pernas lp JOIN public.transacoes_caixa t ON t.id=lp.transacao_id WHERE t.conta_caixa_id=aid AND EXISTS(SELECT 1 FROM jsonb_array_elements(first_op.auditoria->'antes'->'ledger') b WHERE b->'id'=to_jsonb(lp.transacao_id))) THEN RAISE EXCEPTION 'Pin37 origem/base/proveniência divergente' USING ERRCODE='23514'; END IF;
 IF first_id IS DISTINCT FROM op.id AND NOT EXISTS(SELECT 1 FROM public.caixa37_pernas lp JOIN public.transacoes_caixa t ON t.id=lp.transacao_id WHERE lp.operacao_id=first_id AND t.conta_caixa_id=aid AND EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'ledger') b WHERE b=lp.snapshot)) THEN
 RAISE EXCEPTION 'Pin37 primeira utilização não precede esta operação' USING ERRCODE='23514'; END IF;
 snapshots:=snapshots||jsonb_build_array(p.snapshot);
 resultlegs:=resultlegs||jsonb_build_array(jsonb_build_object('papel',p.papel,'transacaoCaixaId',p.transacao_id::text,'contaCaixaId',aid,'tipo',p.snapshot->>'tipo','valor',op.request->>'valor'));
 END LOOP;
 IF op.auditoria->'pernas' IS DISTINCT FROM snapshots OR r->'pernas' IS DISTINCT FROM resultlegs THEN RAISE EXCEPTION 'Auditoria37 pernas divergentes' USING ERRCODE='23514'; END IF;
 expected:=jsonb_set(antes,'{ledger}',(SELECT jsonb_agg(v ORDER BY (v->>'id')::int) FROM jsonb_array_elements((antes->'ledger')||snapshots) v));
 IF expected IS DISTINCT FROM op.auditoria->'depois' THEN RAISE EXCEPTION 'Delta37 histórico não é exato' USING ERRCODE='23514'; END IF;
 -- O emissor não armazena provas37 separadas no audit. Reconstruir o conjunto pré-op pelo
 -- ledger congelado e pelas provas imutáveis armazenadas; não usar provas atuais completas.
 SELECT coalesce(array_agg((v->>'id')::int),'{}'::integer[]) INTO before_ids FROM jsonb_array_elements(antes->'ledger') v;
 SELECT coalesce(array_agg(DISTINCT lp.operacao_id),'{}'::uuid[]) INTO prior_ids FROM public.caixa37_pernas lp WHERE lp.transacao_id=ANY(before_ids);
 IF op.id=ANY(prior_ids) THEN RAISE EXCEPTION 'Snapshot37 antes contém a própria operação' USING ERRCODE='23514'; END IF;
 FOR prior IN SELECT * FROM public.caixa37_operacoes WHERE id=ANY(prior_ids) LOOP
 IF prior.user_id IS DISTINCT FROM op.user_id OR prior.resultado IS NULL OR prior.auditoria IS NULL OR prior.concluida_em IS NULL
 OR prior.hash_request IS DISTINCT FROM public.caixa37_hash(prior.request) OR prior.hash_auditoria IS DISTINCT FROM public.caixa37_hash(prior.auditoria)
 OR prior.auditoria->'request' IS DISTINCT FROM prior.request OR prior.auditoria->'resultado' IS DISTINCT FROM prior.resultado
 OR (SELECT count(*) FROM public.caixa37_pernas lp WHERE lp.operacao_id=prior.id) IS DISTINCT FROM (CASE prior.acao WHEN 'aporte' THEN 1 WHEN 'transferir' THEN 2 ELSE 0 END)::bigint
 OR EXISTS(SELECT 1 FROM public.caixa37_pernas lp WHERE lp.operacao_id=prior.id AND (lp.user_id IS DISTINCT FROM op.user_id OR NOT(lp.transacao_id=ANY(before_ids)) OR lp.hash_snapshot IS DISTINCT FROM public.caixa37_hash(lp.snapshot)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'ledger') b WHERE b->'id'=to_jsonb(lp.transacao_id) AND b=lp.snapshot))) THEN RAISE EXCEPTION 'Provas37 congeladas incompletas/divergentes' USING ERRCODE='23514'; END IF;
 END LOOP;
 frozen_proofs:=jsonb_build_object(
 'operacoes',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM public.caixa37_operacoes o WHERE o.id=ANY(prior_ids)),'[]'::jsonb),
 'pernas',coalesce((SELECT jsonb_agg(to_jsonb(lp) ORDER BY lp.operacao_id,lp.papel) FROM public.caixa37_pernas lp WHERE lp.operacao_id=ANY(prior_ids)),'[]'::jsonb),
 'contas',coalesce((SELECT jsonb_agg(to_jsonb(cp) ORDER BY cp.conta_id) FROM public.caixa37_contas cp WHERE cp.user_id=op.user_id AND cp.primeira_op=ANY(prior_ids)),'[]'::jsonb));
 state_hash:=public.caixa37_hash(jsonb_build_object('regra','caixa37_brt_v1','userId',op.user_id,'acao',op.acao,'contaOrigemId',origem,'contaDestinoId',destino,'valor',op.request->>'valor','descricao',op.request->'descricao','diaBrt',(op.request->>'dataTransacao')::date,'contas',antes->'contas','ledger',antes->'ledger','provas37',frozen_proofs));
 IF q->'estadoHash' IS DISTINCT FROM to_jsonb(state_hash) THEN RAISE EXCEPTION 'Cotação37 estadoHash não corresponde às provas congeladas' USING ERRCODE='23514'; END IF;
 -- NUMERIC sem typmod: bases e ledger de audit.antes são a ÚNICA fonte de saldos históricos.
 qorigem:=NULL;
 FOR aid IN SELECT v FROM unnest(ARRAY[origem,destino]) v WHERE v IS NOT NULL LOOP
 SELECT jsonb_build_object('contaCaixaId',aid,'nome',c->>'nome','saldoBase',public.caixa37_decimal((c->>'saldo')::numeric),
 'entradas',public.caixa37_decimal(coalesce(sum((t->>'valor')::numeric) FILTER(WHERE t->>'tipo'='entrada'),0)),
 'saidas',public.caixa37_decimal(coalesce(sum((t->>'valor')::numeric) FILTER(WHERE t->>'tipo'='saida'),0)),
 'saldoEfetivo',public.caixa37_decimal((c->>'saldo')::numeric+coalesce(sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END),0))) INTO obj
 FROM jsonb_array_elements(antes->'contas') c LEFT JOIN jsonb_array_elements(antes->'ledger') t ON t->'conta_caixa_id'=c->'id' WHERE c->'id'=to_jsonb(aid) GROUP BY c;
 IF aid=destino THEN qdestino:=obj; ELSE qorigem:=obj; END IF;
 END LOOP;
 SELECT coalesce((SELECT sum((c->>'saldo')::numeric) FROM jsonb_array_elements(antes->'contas') c),0)+coalesce((SELECT sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END) FROM jsonb_array_elements(antes->'ledger') t),0) INTO total;
 SELECT coalesce(sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END),0),
 coalesce(sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END) FILTER(WHERE t->'conta_caixa_id'=to_jsonb(origem)),0),
 coalesce(sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END) FILTER(WHERE t->'conta_caixa_id'=to_jsonb(destino)),0)
 INTO delta_total,delta_origem,delta_destino FROM jsonb_array_elements(snapshots) t;
 IF delta_destino IS DISTINCT FROM val OR delta_origem IS DISTINCT FROM (CASE op.acao WHEN 'transferir' THEN -val ELSE 0 END) OR delta_total IS DISTINCT FROM (CASE op.acao WHEN 'aporte' THEN val ELSE 0 END) THEN RAISE EXCEPTION 'Delta37 monetário físico divergente' USING ERRCODE='23514'; END IF;
 qexpected:=jsonb_build_object('elegivel',true,'regra','caixa37_brt_v1','acao',op.acao,'contaOrigemId',origem,'contaDestinoId',destino,'valor',op.request->'valor','descricao',op.request->'descricao','dataTransacao',op.request->'dataTransacao','estadoHash',state_hash,'origem',qorigem,'destino',qdestino,
 'saldoOrigemApos',CASE WHEN origem IS NULL THEN NULL ELSE public.caixa37_decimal((qorigem->>'saldoEfetivo')::numeric+delta_origem) END,'saldoDestinoApos',public.caixa37_decimal((qdestino->>'saldoEfetivo')::numeric+delta_destino),'saldoTotalOwnerAntes',public.caixa37_decimal(total),'saldoTotalOwnerApos',public.caixa37_decimal(total+delta_total));
 rexpected:=jsonb_build_object('success',true,'regra','caixa37_v1','acao',op.acao,'operationId',op.id,'idempotencyKey',op.chave,'repetida',false,'contaOrigemId',origem,'contaDestinoId',destino,'valor',op.request->'valor','dataTransacao',op.request->'dataTransacao','descricao',op.request->'descricao','pernas',resultlegs,
 'saldoOrigemAntes',qorigem->'saldoEfetivo','saldoOrigemApos',qexpected->'saldoOrigemApos','saldoDestinoAntes',qdestino->'saldoEfetivo','saldoDestinoApos',qexpected->'saldoDestinoApos','saldoTotalOwnerAntes',qexpected->'saldoTotalOwnerAntes','saldoTotalOwnerApos',qexpected->'saldoTotalOwnerApos');
 IF q IS DISTINCT FROM qexpected OR r IS DISTINCT FROM rexpected THEN RAISE EXCEPTION 'Cotação/resultado37 não correspondem ao saldo físico histórico' USING ERRCODE='23514'; END IF;
 IF (r->>'saldoDestinoApos')::numeric IS DISTINCT FROM (r->>'saldoDestinoAntes')::numeric+val
 OR (r->>'saldoTotalOwnerApos')::numeric IS DISTINCT FROM (r->>'saldoTotalOwnerAntes')::numeric+delta_total
 OR (op.acao='transferir' AND (r->>'saldoOrigemApos')::numeric IS DISTINCT FROM (r->>'saldoOrigemAntes')::numeric-val) THEN RAISE EXCEPTION 'Equação37 divergente' USING ERRCODE='23514'; END IF;
 -- Append legítimo não invalida snapshot antigo. Somente prefixo nas contas alvo é imutável.
 FOR x IN SELECT value FROM jsonb_array_elements(op.auditoria->'depois'->'ledger') WHERE (value->>'conta_caixa_id')::int IN(origem,destino) LOOP
 IF x IS DISTINCT FROM (SELECT to_jsonb(t) FROM public.transacoes_caixa t WHERE id=(x->>'id')::int) THEN RAISE EXCEPTION 'Prefixo37 alterado' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.caixa37_capacidades WHERE operacao_id=op.id) THEN RAISE EXCEPTION 'Capacidade37 residual' USING ERRCODE='23514'; END IF;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_datetime_format OR datetime_field_overflow THEN
 RAISE EXCEPTION 'Prova37 contém valor fora do formato/faixa' USING ERRCODE='23514';
END $$;
CREATE FUNCTION public.caixa37_perna_comprovada(tid integer,uid integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oid37 uuid;
BEGIN
 SELECT p.operacao_id INTO oid37 FROM public.caixa37_pernas p JOIN public.caixa37_operacoes o ON o.id=p.operacao_id WHERE p.transacao_id=tid AND p.user_id=uid AND o.user_id=uid;
 IF NOT FOUND THEN RETURN false; END IF; PERFORM public.caixa37_validar_op(oid37); RETURN true;
END $$;
CREATE FUNCTION public.caixa37_validar_livro(uid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE a public.contas_caixa%ROWTYPE; t public.transacoes_caixa%ROWTYPE; oid37 uuid;
BEGIN
 FOR a IN SELECT * FROM public.contas_caixa WHERE user_id=uid LOOP
 IF a.id<=0 OR a.saldo::text IN('NaN','Infinity','-Infinity') OR a.saldo<>round(a.saldo,2) OR abs(a.saldo)>9999999999999.99 THEN RAISE EXCEPTION 'Saldo-base37 inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR t IN SELECT * FROM public.transacoes_caixa WHERE user_id=uid OR conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid) ORDER BY id LOOP
 IF t.id<=0 OR t.user_id IS DISTINCT FROM uid OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=t.conta_caixa_id AND user_id=uid)
 OR t.tipo NOT IN('entrada','saida') OR t.valor::text IN('NaN','Infinity','-Infinity') OR t.valor<=0 OR t.valor<>round(t.valor,2) OR NOT isfinite(t.data_transacao)
 OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.clientes cl ON cl.id=c.cliente_id WHERE c.id=t.contrato_id AND c.user_id=uid AND cl.user_id=uid AND c.conta_caixa_id=t.conta_caixa_id AND (c.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid))))
 OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id JOIN public.clientes cl ON cl.id=p.cliente_id WHERE p.id=t.parcela_id AND p.user_id=uid AND c.user_id=uid AND cl.user_id=uid AND p.cliente_id=c.cliente_id AND p.contrato_id=t.contrato_id AND p.conta_caixa_id=t.conta_caixa_id AND (p.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=p.koletor_id AND user_id=uid)))) THEN RAISE EXCEPTION 'Ledger37 whole-owner crossowner/estrutura inválida' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR oid37 IN SELECT id FROM public.caixa37_operacoes WHERE user_id=uid LOOP PERFORM public.caixa37_validar_op(oid37); END LOOP;
 IF EXISTS(SELECT 1 FROM public.caixa37_contas p LEFT JOIN public.contas_caixa ac ON ac.id=p.conta_id WHERE p.user_id=uid AND (ac.id IS NULL OR ac.user_id IS DISTINCT FROM p.user_id OR ac.saldo IS DISTINCT FROM p.saldo_base)) THEN RAISE EXCEPTION 'Pin37 divergente' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION public.caixa37_saldo(uid integer,aid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('contaCaixaId',c.id,'nome',c.nome,'saldoBase',public.caixa37_decimal(c.saldo),'entradas',public.caixa37_decimal(coalesce(sum(t.valor) FILTER(WHERE t.tipo='entrada'),0)),
 'saidas',public.caixa37_decimal(coalesce(sum(t.valor) FILTER(WHERE t.tipo='saida'),0)),'saldoEfetivo',public.caixa37_decimal(c.saldo+coalesce(sum(CASE t.tipo WHEN 'entrada' THEN t.valor ELSE -t.valor END),0)))
 FROM public.contas_caixa c LEFT JOIN public.transacoes_caixa t ON t.conta_caixa_id=c.id WHERE c.id=aid AND c.user_id=uid GROUP BY c.id;
$$;
CREATE FUNCTION public.caixa37_cotacao(uid integer,a text,origem integer,destino integer,v text,d text,instante timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE s jsonb; qorigem jsonb; qdestino jsonb; total numeric; val numeric; dia date; h text;
BEGIN
 PERFORM public.caixa37_intencao(a,origem,destino,v,d); PERFORM public.caixa37_validar_livro(uid);
 IF NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=destino AND user_id=uid AND ativo IS TRUE) OR (a='transferir' AND NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=origem AND user_id=uid AND ativo IS TRUE)) THEN RAISE EXCEPTION 'Conta37 indisponível' USING ERRCODE='42501'; END IF;
 val:=public.caixa37_dinheiro(v); dia:=(instante AT TIME ZONE 'America/Sao_Paulo')::date; s:=public.caixa37_snapshot(uid);
 qdestino:=public.caixa37_saldo(uid,destino); IF origem IS NOT NULL THEN qorigem:=public.caixa37_saldo(uid,origem); END IF;
 SELECT coalesce((SELECT sum(saldo) FROM public.contas_caixa WHERE user_id=uid),0)+coalesce((SELECT sum(CASE tipo WHEN 'entrada' THEN valor ELSE -valor END) FROM public.transacoes_caixa WHERE conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid)),0) INTO total;
 h:=public.caixa37_hash(jsonb_build_object('regra','caixa37_brt_v1','userId',uid,'acao',a,'contaOrigemId',origem,'contaDestinoId',destino,'valor',v,'descricao',d,'diaBrt',dia,'contas',s->'contas','ledger',s->'ledger','provas37',public.caixa37_provas(uid)));
 RETURN jsonb_build_object('elegivel',true,'regra','caixa37_brt_v1','acao',a,'contaOrigemId',origem,'contaDestinoId',destino,'valor',v,'descricao',d,'dataTransacao',dia,'estadoHash',h,'origem',qorigem,'destino',qdestino,
 'saldoOrigemApos',CASE WHEN origem IS NULL THEN NULL ELSE public.caixa37_decimal((qorigem->>'saldoEfetivo')::numeric-val) END,'saldoDestinoApos',public.caixa37_decimal((qdestino->>'saldoEfetivo')::numeric+val),
 'saldoTotalOwnerAntes',public.caixa37_decimal(total),'saldoTotalOwnerApos',public.caixa37_decimal(total+CASE a WHEN 'aporte' THEN val ELSE 0 END));
END $$;
CREATE FUNCTION public.rpc_cotar_caixa37(p_user_id integer,p_acao text,p_conta_origem_id integer,p_conta_destino_id integer,p_valor text,p_descricao text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
BEGIN
 PERFORM public.caixa37_verificar(); PERFORM public.caixa37_intencao(p_acao,p_conta_origem_id,p_conta_destino_id,p_valor,p_descricao); PERFORM public.caixa37_travar(p_user_id);
 RETURN public.caixa37_cotacao(p_user_id,p_acao,p_conta_origem_id,p_conta_destino_id,p_valor,p_descricao,clock_timestamp());
END $$;
CREATE FUNCTION public.caixa37_anteriores(uid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT jsonb_build_object('contratos',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.contratos c WHERE c.user_id=uid OR c.conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid) OR c.id IN(SELECT contrato_id FROM public.transacoes_caixa WHERE user_id=uid OR conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid))),'parcelas',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.parcelas p WHERE p.user_id=uid OR p.conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid) OR p.contrato_id IN(SELECT id FROM public.contratos WHERE user_id=uid) OR p.id IN(SELECT parcela_id FROM public.transacoes_caixa WHERE user_id=uid OR conta_caixa_id IN(SELECT id FROM public.contas_caixa WHERE user_id=uid))),'historico',(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.contrato_historico h WHERE h.user_id=uid::text OR h.contrato_id IN(SELECT id FROM public.contratos WHERE user_id=uid)),
 'origens35',(SELECT jsonb_agg(to_jsonb(o) ORDER BY contrato_id) FROM public.multimodal_origens o WHERE o.user_id=uid),'ops35',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.multimodal_operacoes o WHERE o.user_id=uid),'estados35',(SELECT jsonb_agg(to_jsonb(o) ORDER BY contrato_id) FROM public.multimodal_estados o WHERE o.user_id=uid),'pernas35',(SELECT jsonb_agg(to_jsonb(o) ORDER BY operacao_id) FROM public.multimodal_pernas o WHERE o.operacao_id IN(SELECT id FROM public.multimodal_operacoes WHERE user_id=uid)),'ren35',(SELECT jsonb_agg(to_jsonb(o) ORDER BY anterior_id) FROM public.multimodal_renovacoes o WHERE o.operacao_id IN(SELECT id FROM public.multimodal_operacoes WHERE user_id=uid)),
 'origens36',(SELECT jsonb_agg(to_jsonb(o) ORDER BY contrato_id) FROM public.multa36_origens o WHERE o.user_id=uid),'ops36',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.multa36_operacoes o WHERE o.user_id=uid),'estados36',(SELECT jsonb_agg(to_jsonb(o) ORDER BY contrato_id) FROM public.multa36_estados o WHERE o.user_id=uid),'pernas36',(SELECT jsonb_agg(to_jsonb(o) ORDER BY operacao_id) FROM public.multa36_pernas o WHERE o.operacao_id IN(SELECT id FROM public.multa36_operacoes WHERE user_id=uid)),'ren36',(SELECT jsonb_agg(to_jsonb(o) ORDER BY anterior_id) FROM public.multa36_renovacoes o WHERE o.operacao_id IN(SELECT id FROM public.multa36_operacoes WHERE user_id=uid)),'enc36',(SELECT jsonb_agg(to_jsonb(o) ORDER BY parcela_id) FROM public.multa36_encargos o WHERE o.operacao_id IN(SELECT id FROM public.multa36_operacoes WHERE user_id=uid)),
 'ops34',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.legados_operacoes o WHERE o.user_id=uid),'audit34',(SELECT jsonb_agg(to_jsonb(o) ORDER BY operacao_id) FROM public.legados_auditoria o WHERE o.user_id=uid),'estados34',(SELECT jsonb_agg(to_jsonb(o) ORDER BY contrato_id) FROM public.legados_estados o WHERE o.user_id=uid));
$$;
CREATE FUNCTION public.caixa37_escrever(oid37 uuid,papel37 text,linha jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE g text; actual jsonb;
BEGIN
 INSERT INTO public.caixa37_pernas VALUES(oid37,papel37,(linha->>'user_id')::int,(linha->>'id')::int,linha,public.caixa37_hash(linha));
 FOR g IN SELECT tgname FROM pg_trigger WHERE tgrelid='public.transacoes_caixa'::regclass AND NOT tgisinternal AND tgfoid IN('public.ciclo_guardar()'::regprocedure,'public.legados_guardar()'::regprocedure,'public.multimodal_guardar()'::regprocedure,'public.multa36_guardar()'::regprocedure,'public.multa36_ponte()'::regprocedure,'public.caixa37_ledger()'::regprocedure) LOOP
 INSERT INTO public.caixa37_capacidades VALUES(txid_current(),pg_backend_pid(),oid37,g,papel37,'transacoes_caixa','INSERT',NULL,linha);
 END LOOP;
 INSERT INTO public.transacoes_caixa SELECT (jsonb_populate_record(NULL::public.transacoes_caixa,linha)).*;
 SELECT to_jsonb(t) INTO actual FROM public.transacoes_caixa t WHERE id=(linha->>'id')::int;
 IF actual IS DISTINCT FROM linha OR EXISTS(SELECT 1 FROM public.caixa37_capacidades WHERE operacao_id=oid37) THEN RAISE EXCEPTION 'Escrita37 divergiu/capacidade residual' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION public.caixa37_mutar(uid integer,k uuid,req jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE r jsonb; q jsonb; op public.caixa37_operacoes%ROWTYPE; f public.caixa37_fences%ROWTYPE; instante timestamptz; antes jsonb; expected jsonb; atual jsonb; predecessores jsonb;
 pernas jsonb:='[]'::jsonb; resultlegs jsonb:='[]'::jsonb; t public.transacoes_caixa%ROWTYPE; linha jsonb; papel37 text; papeis text[]; aid integer; audit jsonb; result37 jsonb;
BEGIN
 PERFORM public.caixa37_verificar(); r:=public.caixa37_request(req); PERFORM public.caixa37_barreira(uid,k); PERFORM public.caixa37_travar(uid);
 SELECT * INTO f FROM public.caixa37_fences WHERE user_id=uid AND chave=k;
 IF FOUND THEN
 IF f.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'UUID37 fenced divergente' USING ERRCODE='23505'; END IF;
 IF f.hash_request IS DISTINCT FROM public.caixa37_hash(f.request) THEN RAISE EXCEPTION 'Fence37 adulterado' USING ERRCODE='23514'; END IF;
 RAISE EXCEPTION 'UUID37 fechado permanentemente' USING ERRCODE='55000',DETAIL='CAIXA37_UUID_FENCED'; END IF;
 SELECT * INTO op FROM public.caixa37_operacoes WHERE user_id=uid AND chave=k;
 IF FOUND THEN
 IF op.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'UUID37 intenção divergente' USING ERRCODE='23505'; END IF;
 PERFORM public.caixa37_validar_op(op.id); RETURN op.resultado||jsonb_build_object('repetida',true);
 END IF;
 instante:=clock_timestamp(); q:=public.caixa37_cotacao(uid,r->>'acao',(r->>'contaOrigemId')::int,(r->>'contaDestinoId')::int,r->>'valor',r->>'descricao',instante);
 IF q->>'estadoHash' IS DISTINCT FROM r->>'estadoHash' OR q->>'dataTransacao' IS DISTINCT FROM r->>'dataTransacao' THEN RAISE EXCEPTION 'Cotação37/dia mudou' USING ERRCODE='40001'; END IF;
 antes:=public.caixa37_snapshot(uid); predecessores:=public.caixa37_anteriores(uid); expected:=antes;
 INSERT INTO public.caixa37_operacoes(user_id,chave,acao,request,hash_request,instante) VALUES(uid,k,r->>'acao',r,public.caixa37_hash(r),instante) RETURNING * INTO op;
 FOR aid IN SELECT v FROM unnest(ARRAY[(r->>'contaOrigemId')::int,(r->>'contaDestinoId')::int]) v WHERE v IS NOT NULL ORDER BY v LOOP
 INSERT INTO public.caixa37_contas SELECT id,user_id,saldo,op.id FROM public.contas_caixa WHERE id=aid ON CONFLICT(conta_id) DO NOTHING;
 END LOOP;
 papeis:=CASE op.acao WHEN 'aporte' THEN ARRAY['aporte'] ELSE ARRAY['origem','destino'] END;
 FOREACH papel37 IN ARRAY papeis LOOP
 t:=NULL; t.id:=nextval(pg_get_serial_sequence('public.transacoes_caixa','id'));
 t.conta_caixa_id:=CASE papel37 WHEN 'origem' THEN (r->>'contaOrigemId')::int ELSE (r->>'contaDestinoId')::int END;
 t.user_id:=uid; t.tipo:=CASE papel37 WHEN 'origem' THEN 'saida' ELSE 'entrada' END; t.categoria:=CASE op.acao WHEN 'aporte' THEN 'ajuste_manual' ELSE 'transferencia_conta' END;
 t.descricao:=CASE op.acao WHEN 'aporte' THEN 'Aporte37 '||op.id::text ELSE 'Transferencia37 '||op.id::text||' '||papel37 END;
 t.valor:=(r->>'valor')::numeric; t.data_transacao:=(r->>'dataTransacao')::date; t."createdAt":=instante; linha:=to_jsonb(t);
 PERFORM public.caixa37_escrever(op.id,papel37,linha); pernas:=pernas||jsonb_build_array(linha);
 resultlegs:=resultlegs||jsonb_build_array(jsonb_build_object('papel',papel37,'transacaoCaixaId',t.id::text,'contaCaixaId',t.conta_caixa_id,'tipo',t.tipo,'valor',r->>'valor'));
 END LOOP;
 expected:=jsonb_set(expected,'{ledger}',(SELECT jsonb_agg(v ORDER BY (v->>'id')::int) FROM jsonb_array_elements((expected->'ledger')||pernas) v)); atual:=public.caixa37_snapshot(uid);
 IF atual IS DISTINCT FROM expected OR public.caixa37_anteriores(uid) IS DISTINCT FROM predecessores OR EXISTS(SELECT 1 FROM public.caixa37_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) OR EXISTS(SELECT 1 FROM public.caixa37_coexistencia WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN RAISE EXCEPTION 'Não selar delta37 inesperado' USING ERRCODE='23514'; END IF;
 result37:=jsonb_build_object('success',true,'regra','caixa37_v1','acao',op.acao,'operationId',op.id,'idempotencyKey',k,'repetida',false,'contaOrigemId',r->'contaOrigemId','contaDestinoId',r->'contaDestinoId','valor',r->'valor','dataTransacao',r->'dataTransacao','descricao',r->'descricao','pernas',resultlegs,
 'saldoOrigemAntes',q->'origem'->'saldoEfetivo','saldoOrigemApos',q->'saldoOrigemApos','saldoDestinoAntes',q->'destino'->'saldoEfetivo','saldoDestinoApos',q->'saldoDestinoApos','saldoTotalOwnerAntes',q->'saldoTotalOwnerAntes','saldoTotalOwnerApos',q->'saldoTotalOwnerApos');
 IF (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date IS DISTINCT FROM (r->>'dataTransacao')::date THEN RAISE EXCEPTION 'Virada BRT37 durante escrita' USING ERRCODE='40001'; END IF;
 audit:=jsonb_build_object('request',r,'requestHash',op.hash_request,'cotacao',q,'cotacaoHash',public.caixa37_hash(q),'antes',antes,'depois',expected,'pernas',pernas,'predecessoresHash',public.caixa37_hash(predecessores),'instante',instante,'diaBrt',r->'dataTransacao','resultado',result37);
 UPDATE public.caixa37_operacoes SET resultado=result37,auditoria=audit,hash_auditoria=public.caixa37_hash(audit),concluida_em=clock_timestamp() WHERE id=op.id;
 PERFORM public.caixa37_validar_op(op.id); RETURN result37;
END $$;
CREATE FUNCTION public.rpc_aportar_caixa37(p_user_id integer,p_chave_idempotencia uuid,p_conta_destino_id integer,p_valor text,p_data_transacao date,p_estado_hash text,p_descricao text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT public.caixa37_mutar(p_user_id,p_chave_idempotencia,jsonb_build_object('acao','aporte','contaOrigemId',NULL,'contaDestinoId',p_conta_destino_id,'valor',p_valor,'dataTransacao',p_data_transacao,'estadoHash',p_estado_hash,'descricao',p_descricao));
$$;
CREATE FUNCTION public.rpc_transferir_caixa37(p_user_id integer,p_chave_idempotencia uuid,p_conta_origem_id integer,p_conta_destino_id integer,p_valor text,p_data_transacao date,p_estado_hash text,p_descricao text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
 SELECT public.caixa37_mutar(p_user_id,p_chave_idempotencia,jsonb_build_object('acao','transferir','contaOrigemId',p_conta_origem_id,'contaDestinoId',p_conta_destino_id,'valor',p_valor,'dataTransacao',p_data_transacao,'estadoHash',p_estado_hash,'descricao',p_descricao));
$$;
CREATE FUNCTION public.rpc_reconciliar_caixa37(p_user_id integer,p_chave_idempotencia uuid,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE r jsonb; op public.caixa37_operacoes%ROWTYPE; f public.caixa37_fences%ROWTYPE;
BEGIN
 PERFORM public.caixa37_verificar(); r:=public.caixa37_request(p_request); PERFORM public.caixa37_barreira(p_user_id,p_chave_idempotencia); PERFORM public.caixa37_travar(p_user_id);
 IF NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=(r->>'contaDestinoId')::int AND user_id=p_user_id) OR (r->>'acao'='transferir' AND NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=(r->>'contaOrigemId')::int AND user_id=p_user_id)) THEN RAISE EXCEPTION 'Owner37 recovery indisponível' USING ERRCODE='42501'; END IF;
 PERFORM public.caixa37_validar_livro(p_user_id);
 SELECT * INTO op FROM public.caixa37_operacoes WHERE user_id=p_user_id AND chave=p_chave_idempotencia;
 IF FOUND THEN
 IF op.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'UUID37 recovery divergente' USING ERRCODE='23505'; END IF; PERFORM public.caixa37_validar_op(op.id);
 RETURN jsonb_build_object('userId',p_user_id,'idempotencyKey',p_chave_idempotencia,'request',r,'requestHash',op.hash_request,'proof','uuid_fenced37_v1','status','confirmed','operationId',op.id,'result',op.resultado);
 END IF;
 SELECT * INTO f FROM public.caixa37_fences WHERE user_id=p_user_id AND chave=p_chave_idempotencia;
 IF FOUND THEN
 IF f.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'UUID37 fence divergente' USING ERRCODE='23505'; END IF;
 IF f.hash_request IS DISTINCT FROM public.caixa37_hash(f.request) THEN RAISE EXCEPTION 'Fence37 hash divergente' USING ERRCODE='23514'; END IF;
 ELSE INSERT INTO public.caixa37_fences VALUES(p_user_id,p_chave_idempotencia,r,public.caixa37_hash(r),clock_timestamp()); END IF;
 RETURN jsonb_build_object('userId',p_user_id,'idempotencyKey',p_chave_idempotencia,'request',r,'requestHash',public.caixa37_hash(r),'proof','uuid_fenced37_v1','status','not_executed','operationId',NULL,'result',NULL);
END $$;
-- BRIDGE FROM SOURCE36
CREATE FUNCTION public.caixa37_ledger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $$
DECLARE ok boolean; a integer; b integer;
BEGIN
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
CREATE FUNCTION public.caixa37_conta_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.caixa37_contas WHERE conta_id=OLD.id) AND (TG_OP='DELETE' OR OLD.id IS DISTINCT FROM NEW.id OR OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.saldo IS DISTINCT FROM NEW.saldo) THEN RAISE EXCEPTION 'Pin37 identidade/base imutável' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION public.caixa37_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='caixa37_operacoes' AND TG_OP='UPDATE' THEN
 IF OLD.resultado IS NULL AND NEW.resultado IS NOT NULL AND pg_xact_status(OLD.xmin::text::xid8)='in progress'
 AND (to_jsonb(OLD)-ARRAY['resultado','auditoria','hash_auditoria','concluida_em']) IS NOT DISTINCT FROM (to_jsonb(NEW)-ARRAY['resultado','auditoria','hash_auditoria','concluida_em']) THEN RETURN NEW; END IF; END IF;
 RAISE EXCEPTION 'Prova/pin/fence37 imutável' USING ERRCODE='42501';
END $$;
CREATE FUNCTION public.caixa37_commit_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oid37 uuid;
BEGIN
 IF TG_TABLE_NAME='caixa37_operacoes' THEN oid37:=NEW.id;
 ELSIF TG_TABLE_NAME='caixa37_contas' THEN oid37:=NEW.primeira_op;
 ELSIF TG_TABLE_NAME IN('caixa37_pernas','caixa37_capacidades') THEN oid37:=NEW.operacao_id;
 ELSE IF EXISTS(SELECT 1 FROM public.caixa37_coexistencia WHERE xid=NEW.xid AND pid=NEW.pid) THEN RAISE EXCEPTION 'Witness37 residual no commit' USING ERRCODE='23514'; END IF; RETURN NULL;
 END IF;
 PERFORM public.caixa37_validar_op(oid37); RETURN NULL;
END $$;
CREATE TRIGGER a1_caixa37_ponte BEFORE INSERT ON public.transacoes_caixa FOR EACH ROW EXECUTE FUNCTION public.caixa37_ponte();
CREATE TRIGGER z_caixa37_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.transacoes_caixa FOR EACH ROW EXECUTE FUNCTION public.caixa37_ledger();
CREATE TRIGGER z_caixa37_conta BEFORE UPDATE OR DELETE ON public.contas_caixa FOR EACH ROW EXECUTE FUNCTION public.caixa37_conta_guardar();
CREATE FUNCTION public.caixa37_metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT public.caixa37_hash(jsonb_build_object(
 'funcoes',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace OR p.proname LIKE 'caixa37\_%' ESCAPE '\' OR p.proname LIKE 'rpc\_%caixa37' ESCAPE '\'),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='public'::regnamespace AND a.attnum>0),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(t),pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) ORDER BY oid) FROM pg_roles WHERE rolname IN('service_role','anon','authenticated',current_user)),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m WHERE member IN(SELECT oid FROM pg_roles WHERE rolname IN('service_role','anon','authenticated')))));
$$;
CREATE FUNCTION public.caixa37_verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Caixa37 exige PG17/Read Committed' USING ERRCODE='55000'; END IF;
 PERFORM public.multa36_verificar();
 IF (SELECT assinatura FROM public.caixa37_manifesto WHERE id=1) IS DISTINCT FROM public.caixa37_metadata() THEN RAISE EXCEPTION 'Metadata37 desconhecido; não reseal runtime' USING ERRCODE='55000'; END IF;
END $$;
CREATE FUNCTION public.rpc_capacidades_caixa37() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM public.caixa37_verificar(); RETURN jsonb_build_object('disponivel',true,'regra','caixa37_v1','aporte',true,'transferencia',true,'recovery',true);
END $$;
DO $acl37$ DECLARE n text; x record; BEGIN
 FOREACH n IN ARRAY ARRAY['operacoes','pernas','contas','fences'] LOOP
 EXECUTE format('CREATE TRIGGER caixa37_immutable BEFORE UPDATE OR DELETE ON public.caixa37_%I FOR EACH ROW EXECUTE FUNCTION public.caixa37_imutavel()',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['operacoes','pernas','contas','capacidades','coexistencia'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER caixa37_complete AFTER INSERT OR UPDATE ON public.caixa37_%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.caixa37_commit_check()',n);
 END LOOP;
 FOR x IN SELECT oid,relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'caixa37\_%' ESCAPE '\' LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',x.relname); EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',x.relname);
 END LOOP;
 FOR x IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'caixa37\_%' ESCAPE '\' OR proname LIKE 'rpc\_%caixa37' ESCAPE '\') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',x.oid::regprocedure);
 IF x.proname IN('rpc_capacidades_caixa37','rpc_cotar_caixa37','rpc_aportar_caixa37','rpc_transferir_caixa37','rpc_reconciliar_caixa37') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',x.oid::regprocedure); END IF;
 END LOOP;
END $acl37$;
-- POSTFLIGHT
-- Reseal exclusivamente metadata de instalação, após delta permitido. Nenhuma prova financeira.
UPDATE public.legados_manifesto SET assinatura=public.legados_metadata() WHERE versao=1;
UPDATE public.multimodal_manifesto SET assinatura=public.multimodal_metadata() WHERE id=1;
UPDATE public.multa36_manifesto SET assinatura=public.multa36_metadata() WHERE id=1;
INSERT INTO public.caixa37_manifesto VALUES(1,public.caixa37_metadata());
SELECT public.caixa37_verificar();
COMMIT;
