-- LOCAL ONLY. Não habilita flags, não adota 0021, não repara/backfill histórico.
-- Recorte: mensal/mensal, integral, encargos explicitamente zero, sem renovação.
-- Writers recebem try-locks por conta/tenant/contrato; contenção aborta 40001 antes
-- da escrita (inclusive inserts-fantasma), não aguarda locks após adquirir row lock.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='90s';
-- Mesmo protocolo cooperativo de 31/33; nenhuma DDL externa concorrente é permitida.
SELECT pg_advisory_xact_lock(20261112,3133);
DO $isolation34$
BEGIN
 IF current_setting('transaction_isolation') <> 'read committed' THEN
  RAISE EXCEPTION '0034: instalação exige Read Committed' USING ERRCODE='55000';
 END IF;
END $isolation34$;
LOCK TABLE public.contratos,public.parcelas,public.transacoes_caixa,
 public.contrato_historico,public.ciclo_estados,public.ciclo_operacoes,
 public.emprestimos_rpc_operacoes,public.emprestimos_rpc_origens,
 public.users,public.contas_caixa,public.clientes,public.koletores IN ACCESS EXCLUSIVE MODE;
DO $install$
DECLARE x record; n text; assinatura text;
BEGIN
 IF current_setting('server_version_num')::integer < 170000 OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN
  RAISE EXCEPTION 'PostgreSQL17 e pgcrypto em extensions obrigatórios'; END IF;
 FOREACH n IN ARRAY ARRAY['service_role','anon','authenticated'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=n AND NOT rolsuper) THEN RAISE EXCEPTION 'Role incompatível: %',n; END IF;
 END LOOP;
 FOREACH n IN ARRAY ARRAY['users','clientes','koletores','contas_caixa','contratos','parcelas','transacoes_caixa','contrato_historico','emprestimos_rpc_origens','emprestimos_rpc_operacoes','ciclo_estados','ciclo_operacoes'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname=n AND c.relkind='r') THEN RAISE EXCEPTION 'Tabela física obrigatória ausente: %',n; END IF;
 END LOOP;
 FOR x IN SELECT * FROM (VALUES
  ('contratos','id','integer'),('contratos','user_id','integer'),('contratos','cliente_id','integer'),('contratos','conta_caixa_id','integer'),('contratos','koletor_id','integer'),('contratos','contrato_origem_id','integer'),
  ('parcelas','id','integer'),('parcelas','contrato_id','integer'),('parcelas','user_id','integer'),('parcelas','cliente_id','integer'),('parcelas','numero','integer'),('parcelas','numero_parcela','integer'),('parcelas','conta_caixa_id','integer'),('parcelas','koletor_id','integer'),
  ('parcelas','valor','numeric(15,2)'),('parcelas','valor_original','numeric(15,2)'),('parcelas','valor_pago','numeric(15,2)'),('parcelas','saldo_residual','numeric(15,2)'),('parcelas','valor_juros','numeric(15,2)'),('parcelas','valor_multa','numeric(15,2)'),('parcelas','valor_desconto','numeric(15,2)'),('parcelas','multa_manual','numeric(15,2)'),('parcelas','multa_diaria_usada','numeric(15,2)'),
  ('parcelas','data_vencimento','date'),('parcelas','data_pagamento','date'),('parcelas','updatedAt','timestamp with time zone'),('contratos','updatedAt','timestamp with time zone'),
  ('contas_caixa','saldo','numeric(15,2)'),('contas_caixa','user_id','integer'),('contas_caixa','ativo','boolean'),
  ('transacoes_caixa','id','integer'),('transacoes_caixa','user_id','integer'),('transacoes_caixa','conta_caixa_id','integer'),('transacoes_caixa','parcela_id','integer'),('transacoes_caixa','contrato_id','integer'),('transacoes_caixa','valor','numeric(15,2)'),('transacoes_caixa','data_transacao','date'),
  ('contrato_historico','user_id','text'),('contrato_historico','valor_anterior','numeric(12,2)'),('contrato_historico','valor_novo','numeric(12,2)')
 ) AS v(t,c,typ) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=('public.'||x.t)::regclass AND a.attname=x.c AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=x.typ) THEN RAISE EXCEPTION 'Metadata incompatível %.% (% exigido)',x.t,x.c,x.typ; END IF;
 END LOOP;
 FOR x IN SELECT * FROM (VALUES ('contas_caixa','ciclo_conta'),('contratos','ciclo_contrato'),('parcelas','ciclo_parcela'),('transacoes_caixa','ciclo_ledger'),('contrato_historico','ciclo_historico')) AS v(t,n) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=('public.'||x.t)::regclass AND t.tgname=x.n AND t.tgenabled='O' AND NOT t.tgisinternal AND p.oid=to_regprocedure('public.ciclo_guardar()') AND p.prosecdef) THEN RAISE EXCEPTION 'Guarda prospectiva obrigatória incompatível: %',x.n; END IF;
 END LOOP;
 IF to_regclass('public.parcelas_renovacoes') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.parcelas_renovacoes') AND attname='contrato_id' AND atttypid='integer'::regtype AND NOT attisdropped) THEN RAISE EXCEPTION 'Renovações sem vínculo comprovável'; END IF;
 -- Reapply só é no-op quando TODOS objetos, ACL/RLS, colunas e guards registrados são intactos.
 IF to_regclass('public.legados_manifesto') IS NOT NULL THEN
  IF to_regprocedure('public.legados_metadata()') IS NULL THEN RAISE EXCEPTION 'Instalação homônima/incompleta'; END IF;
  EXECUTE 'SELECT assinatura FROM public.legados_manifesto WHERE versao=1' INTO assinatura;
  IF assinatura IS NULL OR assinatura IS DISTINCT FROM public.legados_metadata() THEN RAISE EXCEPTION 'Instalação 0034 alterada; sem reparo automático'; END IF;
  RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public' AND (p.proname LIKE 'legados\_%' ESCAPE '\' OR p.proname IN('rpc_cotar_recebimento_legado','rpc_receber_legado')))
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname LIKE 'legados\_%' ESCAPE '\')
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname LIKE 'legados\_%' ESCAPE '\' OR tgname LIKE 'a\_legados\_%' ESCAPE '\') THEN RAISE EXCEPTION 'Objetos homônimos recusados'; END IF;
 EXECUTE $ddl$
CREATE TABLE public.legados_manifesto(versao integer PRIMARY KEY CHECK(versao=1), assinatura text NOT NULL);
CREATE TABLE public.legados_operacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id integer NOT NULL REFERENCES public.users(id),
 chave_idempotencia uuid NOT NULL, hash_payload text NOT NULL CHECK(hash_payload ~ '^[0-9a-f]{64}$'),
 contrato_id integer NOT NULL REFERENCES public.contratos(id) ON DELETE RESTRICT,
 parcela_id integer NOT NULL REFERENCES public.parcelas(id) ON DELETE RESTRICT,
 conta_id integer NOT NULL REFERENCES public.contas_caixa(id) ON DELETE RESTRICT,
 payload jsonb NOT NULL, resultado jsonb, concluida_em timestamptz,
 UNIQUE(user_id,chave_idempotencia), UNIQUE(user_id,id),
 CHECK((resultado IS NULL AND concluida_em IS NULL) OR (resultado IS NOT NULL AND concluida_em IS NOT NULL))
);
CREATE TABLE public.legados_auditoria(
 operacao_id uuid PRIMARY KEY REFERENCES public.legados_operacoes(id) ON DELETE RESTRICT,
 user_id integer NOT NULL, hash_payload text NOT NULL, antes jsonb NOT NULL, depois jsonb NOT NULL,
 cotacao jsonb NOT NULL, resultado jsonb NOT NULL,
 transacao_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id) ON DELETE RESTRICT,
 historico_id bigint NOT NULL UNIQUE REFERENCES public.contrato_historico(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(user_id,operacao_id) REFERENCES public.legados_operacoes(user_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.legados_estados(
 contrato_id integer PRIMARY KEY REFERENCES public.contratos(id) ON DELETE RESTRICT,
 user_id integer NOT NULL REFERENCES public.users(id), snapshot jsonb NOT NULL
);
-- Capability exclusiva DESTE fluxo; nunca usa ciclo_autorizar, GUC ou service_role.
CREATE TABLE public.legados_capacidades(
 xid bigint NOT NULL, pid integer NOT NULL, contrato_id integer NOT NULL, parcela_id integer NOT NULL,
 conta_id integer NOT NULL, etapa text NOT NULL CHECK(etapa IN('parcela','ledger','contrato','historico')),
 PRIMARY KEY(xid,pid)
);
ALTER TABLE public.legados_manifesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legados_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legados_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legados_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legados_capacidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legados_manifesto,public.legados_operacoes,public.legados_auditoria,public.legados_estados,public.legados_capacidades FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.legados_metadata() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT encode(extensions.digest(jsonb_build_object(
 'funcoes',(SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_functiondef(p.oid),p.proacl,p.proowner) ORDER BY p.proname,p.oid) FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public' AND (p.proname LIKE 'legados\_%' ESCAPE '\' OR p.proname IN('rpc_cotar_recebimento_legado','rpc_receber_legado','ciclo_guardar'))),
 'tabelas',(SELECT jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relacl,c.relowner) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname LIKE 'legados\_%' ESCAPE '\' AND c.relkind='r'),
 'colunas',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum) FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE s.nspname='public' AND (c.relname LIKE 'legados\_%' ESCAPE '\' OR c.relname IN('users','clientes','koletores','contas_caixa','contratos','parcelas','transacoes_caixa','contrato_historico','parcelas_renovacoes','emprestimos_rpc_origens','emprestimos_rpc_operacoes','ciclo_estados','ciclo_operacoes'))),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid)) ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname LIKE 'legados\_%' ESCAPE '\'),
 'policies',(SELECT jsonb_agg(jsonb_build_array(c.relname,po.polname,po.polcmd,po.polroles,pg_get_expr(po.polqual,po.polrelid),pg_get_expr(po.polwithcheck,po.polrelid)) ORDER BY c.relname,po.polname) FROM pg_policy po JOIN pg_class c ON c.oid=po.polrelid JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname LIKE 'legados\_%' ESCAPE '\'),
 'indices',(SELECT jsonb_agg(jsonb_build_array(c.relname,pg_get_indexdef(i.indexrelid)) ORDER BY c.relname,i.indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname LIKE 'legados\_%' ESCAPE '\'),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgname LIKE 'legados\_%' ESCAPE '\' OR t.tgname LIKE 'a\_legados\_%' ESCAPE '\' OR t.tgname IN('ciclo_conta','ciclo_contrato','ciclo_parcela','ciclo_ledger','ciclo_historico'))
 )::text,'sha256'),'hex');
$fn$;
CREATE FUNCTION public.legados_verificar() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF (SELECT assinatura FROM public.legados_manifesto WHERE versao=1) IS DISTINCT FROM public.legados_metadata() THEN RAISE EXCEPTION 'METADATA_INCOMPATIVEL' USING ERRCODE='55000'; END IF;
END;
$fn$;
CREATE FUNCTION public.legados_moeda(v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT v IS NOT NULL AND v::text NOT IN('NaN','Infinity','-Infinity') AND v=round(v,2) AND abs(v)<=9999999999.99;
$fn$;
CREATE FUNCTION public.legados_snapshot(cid integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $fn$
 SELECT jsonb_build_object(
 'contrato',(SELECT to_jsonb(c) FROM public.contratos c WHERE id=cid),
 'parcelas',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.parcelas p WHERE contrato_id=cid),'[]'::jsonb),
 'ledger',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.transacoes_caixa t WHERE contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)),'[]'::jsonb),
 'historico',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.contrato_historico h WHERE contrato_id=cid),'[]'::jsonb));
$fn$;

-- Todas mutações cooperam via trigger, mesmo fora da RPC, owners nulos e externos.
-- Locks tenant e contrato independem de owner da nova linha: inferem vínculos por ID.
-- Não espera após row-lock: try-lock false aborta a declaração e evita inversão/deadlock.
CREATE FUNCTION public.legados_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE a jsonb; b jsonb; cids integer[]:='{}'; aids integer[]:='{}'; uids integer[]:='{}'; k integer; protegido boolean:=false; cap public.legados_capacidades%ROWTYPE; etapa text;
BEGIN
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

CREATE FUNCTION public.legados_validar(uid integer,cid integer,pid integer,aid integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $fn$
DECLARE c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; alvo public.parcelas%ROWTYPE; t public.transacoes_caixa%ROWTYPE;
 a public.contas_caixa%ROWTYPE; h public.contrato_historico%ROWTYPE; ids integer[]; s jsonb; e public.legados_estados%ROWTYPE;
 soma numeric; pernas integer; n integer; renov boolean; hj date:=(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 PERFORM public.legados_verificar();
 IF uid IS NULL OR uid<=0 OR cid IS NULL OR cid<=0 OR pid IS NULL OR pid<=0 OR aid IS NULL OR aid<=0 THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.contratos WHERE id=cid;
 SELECT * INTO alvo FROM public.parcelas WHERE id=pid;
 IF c.id IS NULL OR c.user_id IS DISTINCT FROM uid OR alvo.id IS NULL OR alvo.contrato_id IS DISTINCT FROM cid OR alvo.user_id IS DISTINCT FROM uid OR alvo.cliente_id IS DISTINCT FROM c.cliente_id
  OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=uid)
  OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=aid AND user_id=uid AND ativo IS TRUE) THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.ciclo_estados WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.ciclo_operacoes WHERE contrato_id=cid)
  OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_operacoes WHERE (resultado->>'id')::integer=cid OR (auditoria->'contrato'->>'id')::integer=cid) THEN RAISE EXCEPTION 'TRILHO_PROSPECTIVO' USING ERRCODE='23514'; END IF;
 IF c.status NOT IN('ativo','atrasado') OR c.status IS NULL OR c.modalidade IS DISTINCT FROM 'mensal' OR c.tipo_taxa IS DISTINCT FROM 'mensal' OR c.contrato_origem_id IS NOT NULL THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
 IF c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid) THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
 IF to_regclass('public.parcelas_renovacoes') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.parcelas_renovacoes WHERE contrato_id=$1)' INTO renov USING cid;
  IF renov THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
 END IF;
 SELECT * INTO e FROM public.legados_estados WHERE contrato_id=cid;
 s:=public.legados_snapshot(cid);
 IF e.contrato_id IS NOT NULL AND (e.user_id IS DISTINCT FROM uid OR e.snapshot IS DISTINCT FROM s) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
 ids:=ARRAY[aid,c.conta_caixa_id]||ARRAY(SELECT conta_caixa_id FROM public.parcelas WHERE contrato_id=cid)||ARRAY(SELECT conta_caixa_id FROM public.transacoes_caixa WHERE contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid));
 FOR n IN SELECT DISTINCT v FROM unnest(ids) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT * INTO a FROM public.contas_caixa WHERE id=n;
  IF a.id IS NULL OR a.user_id IS DISTINCT FROM uid OR a.ativo IS DISTINCT FROM true THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
  -- Saldo-base não é reconciliado/alterado; negativo é válido para entrada.
  IF NOT public.legados_moeda(a.saldo) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens o JOIN public.contratos co ON co.id=o.contrato_id WHERE co.conta_caixa_id=n)
   OR EXISTS(SELECT 1 FROM public.ciclo_estados ce JOIN public.contratos co ON co.id=ce.contrato_id WHERE co.conta_caixa_id=n) THEN RAISE EXCEPTION 'CONTA_PROTEGIDA' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid GROUP BY numero HAVING count(*)>1) THEN RAISE EXCEPTION 'DESCENDENTE_INVALIDO' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT * FROM public.parcelas WHERE contrato_id=cid ORDER BY id LOOP
  IF p.user_id IS DISTINCT FROM uid OR p.cliente_id IS DISTINCT FROM c.cliente_id OR (p.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=p.koletor_id AND user_id=uid)) THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
  IF p.numero IS NULL OR p.numero<=0 OR p.numero_parcela IS NULL OR p.numero_parcela IS DISTINCT FROM p.numero THEN RAISE EXCEPTION 'ALIAS_DIVERGENTE' USING ERRCODE='23514'; END IF;
  IF NOT public.legados_moeda(p.valor) OR p.valor<=0 OR (p.valor_original IS NOT NULL AND (NOT public.legados_moeda(p.valor_original) OR p.valor_original IS DISTINCT FROM p.valor)) OR p.data_vencimento IS NULL OR NOT isfinite(p.data_vencimento) THEN RAISE EXCEPTION 'PRINCIPAL_INVALIDO' USING ERRCODE='23514'; END IF;
  IF p.valor_juros IS DISTINCT FROM 0::numeric OR p.valor_multa IS DISTINCT FROM 0::numeric OR p.valor_desconto IS DISTINCT FROM 0::numeric OR p.multa_manual IS DISTINCT FROM 0::numeric OR p.multa_diaria_usada IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'ENCARGOS_AMBIGUOS' USING ERRCODE='23514'; END IF;
  IF to_jsonb(p) ? 'contagem_renovacoes' AND (to_jsonb(p)->>'contagem_renovacoes')::integer IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
  SELECT count(*),coalesce(sum(valor),0) INTO pernas,soma FROM public.transacoes_caixa WHERE parcela_id=p.id;
  IF p.status IN('pendente','atrasada','atrasado','vencendo_hoje') THEN
   IF pernas<>0 OR (p.valor_pago IS NOT NULL AND p.valor_pago IS DISTINCT FROM 0::numeric) OR p.saldo_residual IS DISTINCT FROM 0::numeric OR p.data_pagamento IS NOT NULL THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  ELSIF p.status IN('paga','pago') AND p.id<>pid THEN
   IF pernas=0 OR p.valor_pago IS DISTINCT FROM p.valor OR p.saldo_residual IS DISTINCT FROM 0::numeric OR p.data_pagamento IS NULL OR NOT isfinite(p.data_pagamento) OR soma IS DISTINCT FROM p.valor_pago
    OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE parcela_id=p.id AND (tipo IS DISTINCT FROM 'entrada' OR categoria IS DISTINCT FROM 'pagamento_parcela' OR data_transacao IS DISTINCT FROM p.data_pagamento)) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
 END LOOP;
 -- Ledger inteiro de TODAS contas pertinentes e vínculos, jamais filtrado por owner.
 FOR t IN SELECT * FROM public.transacoes_caixa WHERE conta_caixa_id=ANY(ids) OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid) ORDER BY id LOOP
  IF t.user_id IS DISTINCT FROM uid OR NOT public.legados_moeda(t.valor) OR t.valor<=0 OR t.tipo IS NULL OR t.tipo NOT IN('entrada','saida') OR t.data_transacao IS NULL OR NOT isfinite(t.data_transacao)
   OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=t.conta_caixa_id AND user_id=uid AND ativo IS TRUE) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  IF t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas pp JOIN public.contratos cc ON cc.id=pp.contrato_id WHERE pp.id=t.parcela_id AND pp.user_id=uid AND cc.user_id=uid AND pp.cliente_id=cc.cliente_id AND pp.contrato_id=t.contrato_id) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  IF t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos WHERE id=t.contrato_id AND user_id=uid) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
  -- Sem regra para atribuir entrada avulsa ou estorno: recusar, não inferir zero líquido.
  IF (t.tipo='entrada' AND t.parcela_id IS NULL) OR (t.contrato_id=cid AND t.parcela_id IS NULL AND (t.tipo IS DISTINCT FROM 'saida' OR t.categoria IS DISTINCT FROM 'emprestimo_liberado' OR t.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id OR t.valor IS DISTINCT FROM c.valor_principal OR t.data_transacao IS DISTINCT FROM c.data_inicio)) OR (t.contrato_id IS NULL AND t.parcela_id IS NULL) THEN RAISE EXCEPTION 'LEDGER_DIVERGENTE_OU_AMBIGUO' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR h IN SELECT * FROM public.contrato_historico WHERE contrato_id=cid LOOP
  IF h.user_id IS DISTINCT FROM uid::text THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
  IF h.tipo IS NULL OR h.tipo NOT IN('criacao','pagamento') OR (h.tipo='pagamento' AND NOT EXISTS(SELECT 1 FROM public.legados_auditoria WHERE historico_id=h.id AND user_id=uid)) THEN RAISE EXCEPTION 'ESTADO_NAO_SUPORTADO' USING ERRCODE='23514'; END IF;
 END LOOP;
 -- PII não sai da RPC: prova/hash somente no backend. Conta/owners fazem parte da cotação.
 s:=s||jsonb_build_object('cliente',(SELECT jsonb_build_object('id',id,'user_id',user_id) FROM public.clientes WHERE id=c.cliente_id),
  'contas',(SELECT jsonb_agg(to_jsonb(ac) ORDER BY ac.id) FROM public.contas_caixa ac WHERE ac.id=ANY(ids)),
  'koletores',(SELECT jsonb_agg(jsonb_build_object('id',id,'user_id',user_id) ORDER BY id) FROM public.koletores WHERE id=c.koletor_id OR id IN(SELECT koletor_id FROM public.parcelas WHERE contrato_id=cid)),
  'livroContas',(SELECT coalesce(jsonb_agg(to_jsonb(tx) ORDER BY tx.id),'[]'::jsonb) FROM public.transacoes_caixa tx WHERE tx.conta_caixa_id=ANY(ids)),
  'regra','recebimento_legado_sem_recalculo_v1','contaDestino',aid,'diaBrt',hj);
 RETURN jsonb_build_object('elegivel',true,'regra','recebimento_legado_sem_recalculo_v1','contratoId',cid,'parcelaId',pid,'contaCaixaId',aid,
  'totalExigido',alvo.valor::numeric(12,2)::text,'estadoHash',encode(extensions.digest(s::text,'sha256'),'hex'),'dataPagamento',hj,'validadeDataCivil',hj);
END;
$fn$;

CREATE FUNCTION public.legados_travar(uid integer,cid integer,aid integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c public.contratos%ROWTYPE; n integer; ids integer[];
BEGIN
 IF uid IS NULL OR uid<=0 OR cid IS NULL OR cid<=0 OR aid IS NULL OR aid<=0 THEN RAISE EXCEPTION 'TENANT_AUSENTE_OU_DIVERGENTE' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.contratos WHERE id=cid;
 -- Ordem 22022 conta -> tenant -> contrato -> contas -> cliente -> koletor -> contrato -> parcelas -> livro.
 ids:=ARRAY[aid,c.conta_caixa_id]||ARRAY(SELECT conta_caixa_id FROM public.parcelas WHERE contrato_id=cid)||ARRAY(SELECT conta_caixa_id FROM public.transacoes_caixa WHERE contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid));
 FOR n IN SELECT DISTINCT v FROM unnest(ids) v WHERE v IS NOT NULL ORDER BY v LOOP PERFORM pg_advisory_xact_lock(22022,n); END LOOP;
 PERFORM pg_advisory_xact_lock(34034,uid); PERFORM pg_advisory_xact_lock(34035,cid);
 PERFORM 1 FROM public.contas_caixa WHERE id=ANY(ids) ORDER BY id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.clientes WHERE id=c.cliente_id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.koletores WHERE id=c.koletor_id OR id IN(SELECT koletor_id FROM public.parcelas WHERE contrato_id=cid) ORDER BY id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.contratos WHERE id=cid FOR NO KEY UPDATE;
 PERFORM 1 FROM public.parcelas WHERE contrato_id=cid ORDER BY id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.transacoes_caixa WHERE conta_caixa_id=ANY(ids) OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid) ORDER BY id FOR NO KEY UPDATE;
 -- Vínculo mudado entre leitura de IDs e aquisição do protocolo: não usar conta sem lock.
 IF EXISTS(SELECT 1 FROM public.contratos WHERE id=cid AND conta_caixa_id IS NOT NULL AND NOT conta_caixa_id=ANY(array_remove(ids,NULL)))
  OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND conta_caixa_id IS NOT NULL AND NOT conta_caixa_id=ANY(array_remove(ids,NULL)))
  OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE (contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND NOT conta_caixa_id=ANY(array_remove(ids,NULL))) THEN RAISE EXCEPTION 'ESTADO_DESATUALIZADO' USING ERRCODE='40001'; END IF;
END;
$fn$;
CREATE FUNCTION public.rpc_cotar_recebimento_legado(p_user_id integer,p_contrato_id integer,p_parcela_id integer,p_conta_caixa_id integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE motivo text;
BEGIN
 PERFORM public.legados_travar(p_user_id,p_contrato_id,p_conta_caixa_id);
 RETURN public.legados_validar(p_user_id,p_contrato_id,p_parcela_id,p_conta_caixa_id);
EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '23514' THEN
 GET STACKED DIAGNOSTICS motivo=MESSAGE_TEXT;
 IF motivo NOT IN('TENANT_AUSENTE_OU_DIVERGENTE','TRILHO_PROSPECTIVO','ESTADO_NAO_SUPORTADO','ALIAS_DIVERGENTE','PRINCIPAL_INVALIDO','ENCARGOS_AMBIGUOS','LEDGER_DIVERGENTE_OU_AMBIGUO','DESCENDENTE_INVALIDO','CONTA_PROTEGIDA') THEN motivo:='REGISTRO_INDISPONIVEL'; END IF;
 RETURN jsonb_build_object('elegivel',false,'motivos',jsonb_build_array(motivo));
END;
$fn$;
CREATE FUNCTION public.rpc_receber_legado(
 p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_parcela_id integer,p_conta_caixa_id integer,
 p_valor_recebido text,p_total_exigido text,p_data_pagamento date,p_estado_hash text,p_regra text,p_observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE payload jsonb; hash text; op public.legados_operacoes%ROWTYPE; q jsonb; antes jsonb; depois jsonb; r jsonb;
 cx integer; hi bigint; total numeric; cstatus text; todos boolean; contas_antes jsonb; contas_depois jsonb; livro_antes jsonb; livro_depois jsonb;
BEGIN
 PERFORM public.legados_verificar();
 IF p_user_id IS NULL OR p_user_id<=0 OR p_contrato_id IS NULL OR p_contrato_id<=0 OR p_parcela_id IS NULL OR p_parcela_id<=0 OR p_conta_caixa_id IS NULL OR p_conta_caixa_id<=0 OR p_chave_idempotencia IS NULL
  OR p_valor_recebido IS NULL OR p_total_exigido IS NULL OR p_valor_recebido !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' OR p_total_exigido !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$'
  OR p_valor_recebido IS DISTINCT FROM p_total_exigido OR p_total_exigido='0.00' OR p_regra IS DISTINCT FROM 'recebimento_legado_sem_recalculo_v1'
  OR p_data_pagamento IS NULL OR NOT isfinite(p_data_pagamento) OR p_estado_hash IS NULL OR p_estado_hash !~ '^[0-9a-f]{64}$' OR length(p_observacoes)>1000 THEN RAISE EXCEPTION 'INTENCAO_INVALIDA' USING ERRCODE='22023'; END IF;
 total:=p_total_exigido::numeric;
 payload:=jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,'contaCaixaId',p_conta_caixa_id,'valorRecebido',p_valor_recebido,'totalExigido',p_total_exigido,'dataPagamento',p_data_pagamento,'estadoHash',p_estado_hash,'regra',p_regra,'observacoes',p_observacoes);
 hash:=encode(extensions.digest(payload::text,'sha256'),'hex');
 -- UUID reservado por advisory, sem FK/registro processando antes dos locks financeiros.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_chave_idempotencia::text,34036));
 SELECT * INTO op FROM public.legados_operacoes WHERE user_id=p_user_id AND chave_idempotencia=p_chave_idempotencia FOR UPDATE;
 IF op.id IS NOT NULL THEN
  IF op.hash_payload IS DISTINCT FROM hash OR op.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'UUID_PAYLOAD_DIVERGENTE' USING ERRCODE='23505'; END IF;
  IF op.resultado IS NULL OR NOT EXISTS(SELECT 1 FROM public.legados_auditoria WHERE operacao_id=op.id AND user_id=p_user_id AND hash_payload=hash AND resultado=op.resultado) THEN RAISE EXCEPTION 'OPERACAO_INCOMPLETA' USING ERRCODE='23514'; END IF;
  RETURN op.resultado||jsonb_build_object('repetida',true);
 END IF;
 PERFORM public.legados_travar(p_user_id,p_contrato_id,p_conta_caixa_id);
 q:=public.legados_validar(p_user_id,p_contrato_id,p_parcela_id,p_conta_caixa_id);
 IF q->>'estadoHash' IS DISTINCT FROM p_estado_hash OR q->>'totalExigido' IS DISTINCT FROM p_total_exigido OR (q->>'dataPagamento')::date IS DISTINCT FROM p_data_pagamento THEN RAISE EXCEPTION 'ESTADO_DESATUALIZADO' USING ERRCODE='40001'; END IF;
 antes:=public.legados_snapshot(p_contrato_id);
 SELECT jsonb_agg(to_jsonb(ac) ORDER BY ac.id) INTO contas_antes FROM public.contas_caixa ac WHERE ac.id=p_conta_caixa_id OR ac.id=(antes->'contrato'->>'conta_caixa_id')::integer OR ac.id IN(SELECT (v->>'conta_caixa_id')::integer FROM jsonb_array_elements(antes->'parcelas') v) OR ac.id IN(SELECT (v->>'conta_caixa_id')::integer FROM jsonb_array_elements(antes->'ledger') v);
 SELECT coalesce(jsonb_agg(to_jsonb(tx) ORDER BY tx.id),'[]'::jsonb) INTO livro_antes FROM public.transacoes_caixa tx WHERE tx.conta_caixa_id IN(SELECT (v->>'id')::integer FROM jsonb_array_elements(contas_antes) v);
 INSERT INTO public.legados_operacoes(user_id,chave_idempotencia,hash_payload,contrato_id,parcela_id,conta_id,payload)
 VALUES(p_user_id,p_chave_idempotencia,hash,p_contrato_id,p_parcela_id,p_conta_caixa_id,payload) RETURNING * INTO op;
 INSERT INTO public.legados_estados(contrato_id,user_id,snapshot) VALUES(p_contrato_id,p_user_id,antes) ON CONFLICT(contrato_id) DO NOTHING;
 INSERT INTO public.legados_capacidades VALUES(txid_current(),pg_backend_pid(),p_contrato_id,p_parcela_id,p_conta_caixa_id,'parcela');
 UPDATE public.parcelas SET valor_pago=total,saldo_residual=0,status='paga',data_pagamento=p_data_pagamento,"updatedAt"=clock_timestamp() WHERE id=p_parcela_id;
 INSERT INTO public.legados_capacidades VALUES(txid_current(),pg_backend_pid(),p_contrato_id,p_parcela_id,p_conta_caixa_id,'ledger');
 INSERT INTO public.transacoes_caixa(user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor,descricao,data_transacao)
 VALUES(p_user_id,p_conta_caixa_id,p_contrato_id,p_parcela_id,'entrada','pagamento_parcela',total,'Recebimento legado '||op.id::text,p_data_pagamento) RETURNING id INTO cx;
 -- Prova de quitação: TODOS descendentes explícitos e pagos + todas pernas exatas sem estorno.
 SELECT NOT EXISTS(SELECT 1 FROM public.parcelas p WHERE p.contrato_id=p_contrato_id AND (
  p.user_id IS DISTINCT FROM p_user_id OR p.status IS NULL OR p.status NOT IN('paga','pago') OR p.saldo_residual IS DISTINCT FROM 0::numeric OR p.valor_pago IS DISTINCT FROM p.valor OR
  p.valor_pago IS DISTINCT FROM (SELECT sum(t.valor) FROM public.transacoes_caixa t WHERE t.parcela_id=p.id) OR
  EXISTS(SELECT 1 FROM public.transacoes_caixa t WHERE t.parcela_id=p.id AND (t.user_id IS DISTINCT FROM p_user_id OR t.contrato_id IS DISTINCT FROM p_contrato_id OR t.tipo IS DISTINCT FROM 'entrada' OR t.categoria IS DISTINCT FROM 'pagamento_parcela'))
 )) INTO todos;
 SELECT status INTO cstatus FROM public.contratos WHERE id=p_contrato_id;
 IF todos THEN
  INSERT INTO public.legados_capacidades VALUES(txid_current(),pg_backend_pid(),p_contrato_id,p_parcela_id,p_conta_caixa_id,'contrato');
  UPDATE public.contratos SET status='quitado',"updatedAt"=clock_timestamp() WHERE id=p_contrato_id;
  cstatus:='quitado';
 END IF;
 INSERT INTO public.legados_capacidades VALUES(txid_current(),pg_backend_pid(),p_contrato_id,p_parcela_id,p_conta_caixa_id,'historico');
 INSERT INTO public.contrato_historico(user_id,contrato_id,tipo,descricao,valor_anterior,valor_novo)
 VALUES(p_user_id::text,p_contrato_id,'pagamento','Recebimento legado '||op.id::text,0,total) RETURNING id INTO hi;
 depois:=public.legados_snapshot(p_contrato_id);
 SELECT jsonb_agg(to_jsonb(ac) ORDER BY ac.id) INTO contas_depois FROM public.contas_caixa ac WHERE ac.id IN(SELECT (v->>'id')::integer FROM jsonb_array_elements(contas_antes) v);
SELECT coalesce(jsonb_agg(to_jsonb(tx) ORDER BY tx.id),'[]'::jsonb) INTO livro_depois FROM public.transacoes_caixa tx WHERE tx.conta_caixa_id IN(SELECT (v->>'id')::integer FROM jsonb_array_elements(contas_antes) v);
 -- Prova exata pós-write, antes de completar operação: nenhum trigger pode reparar legado.
 IF contas_antes IS DISTINCT FROM contas_depois
  OR (SELECT coalesce(jsonb_agg(v ORDER BY (v->>'id')::integer),'[]'::jsonb) FROM jsonb_array_elements(livro_depois) v WHERE (v->>'id')::integer<>cx) IS DISTINCT FROM livro_antes
  OR jsonb_array_length(livro_depois)<>jsonb_array_length(livro_antes)+1
  OR ((antes->'contrato')-'status'-'updatedAt') IS DISTINCT FROM ((depois->'contrato')-'status'-'updatedAt')
  OR (NOT todos AND antes->'contrato' IS DISTINCT FROM depois->'contrato')
  OR (SELECT coalesce(jsonb_agg(v ORDER BY (v->>'id')::integer),'[]'::jsonb) FROM jsonb_array_elements(antes->'parcelas') v WHERE (v->>'id')::integer<>p_parcela_id) IS DISTINCT FROM
     (SELECT coalesce(jsonb_agg(v ORDER BY (v->>'id')::integer),'[]'::jsonb) FROM jsonb_array_elements(depois->'parcelas') v WHERE (v->>'id')::integer<>p_parcela_id)
  OR (SELECT v-'valor_pago'-'saldo_residual'-'status'-'data_pagamento'-'updatedAt' FROM jsonb_array_elements(antes->'parcelas') v WHERE (v->>'id')::integer=p_parcela_id) IS DISTINCT FROM
     (SELECT v-'valor_pago'-'saldo_residual'-'status'-'data_pagamento'-'updatedAt' FROM jsonb_array_elements(depois->'parcelas') v WHERE (v->>'id')::integer=p_parcela_id)
  OR (SELECT v->>'valor_pago' FROM jsonb_array_elements(depois->'parcelas') v WHERE (v->>'id')::integer=p_parcela_id)::numeric IS DISTINCT FROM total
  OR (SELECT v->>'saldo_residual' FROM jsonb_array_elements(depois->'parcelas') v WHERE (v->>'id')::integer=p_parcela_id)::numeric IS DISTINCT FROM 0::numeric
  OR (SELECT v->>'status' FROM jsonb_array_elements(depois->'parcelas') v WHERE (v->>'id')::integer=p_parcela_id) IS DISTINCT FROM 'paga'
  OR (SELECT v->>'data_pagamento' FROM jsonb_array_elements(depois->'parcelas') v WHERE (v->>'id')::integer=p_parcela_id)::date IS DISTINCT FROM p_data_pagamento
  OR (SELECT coalesce(jsonb_agg(v ORDER BY (v->>'id')::integer),'[]'::jsonb) FROM jsonb_array_elements(depois->'ledger') v WHERE (v->>'id')::integer<>cx) IS DISTINCT FROM antes->'ledger'
  OR jsonb_array_length(depois->'ledger')<>jsonb_array_length(antes->'ledger')+1
  OR NOT EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE id=cx AND user_id=p_user_id AND conta_caixa_id=p_conta_caixa_id AND contrato_id=p_contrato_id AND parcela_id=p_parcela_id AND valor=total AND tipo='entrada' AND categoria='pagamento_parcela' AND data_transacao=p_data_pagamento)
  OR (SELECT coalesce(jsonb_agg(v ORDER BY (v->>'id')::bigint),'[]'::jsonb) FROM jsonb_array_elements(depois->'historico') v WHERE (v->>'id')::bigint<>hi) IS DISTINCT FROM antes->'historico'
  OR jsonb_array_length(depois->'historico')<>jsonb_array_length(antes->'historico')+1
  OR NOT EXISTS(SELECT 1 FROM public.contrato_historico WHERE id=hi AND contrato_id=p_contrato_id AND user_id=p_user_id::text AND tipo='pagamento' AND valor_anterior=0 AND valor_novo=total)
  THEN RAISE EXCEPTION 'PROVA_POS_ESCRITA_DIVERGENTE' USING ERRCODE='23514'; END IF;
 UPDATE public.legados_estados SET snapshot=depois WHERE contrato_id=p_contrato_id;
 r:=jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,'contaCaixaId',p_conta_caixa_id,'transacaoCaixaId',cx::text,'valorRecebido',p_valor_recebido,'totalExigido',p_total_exigido,'valorPagoAcumulado',p_valor_recebido,'saldoResidual','0.00','status','paga','contratoStatus',cstatus,'dataPagamento',p_data_pagamento,'regra',p_regra);
 INSERT INTO public.legados_auditoria(operacao_id,user_id,hash_payload,antes,depois,cotacao,resultado,transacao_id,historico_id) VALUES(op.id,p_user_id,hash,antes||jsonb_build_object('contas',contas_antes,'livroContas',livro_antes),depois||jsonb_build_object('contas',contas_depois,'livroContas',livro_depois),q,r,cx,hi);
 UPDATE public.legados_operacoes SET resultado=r,concluida_em=clock_timestamp() WHERE id=op.id;
 IF EXISTS(SELECT 1 FROM public.legados_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN RAISE EXCEPTION 'CAPABILITY_NAO_CONSUMIDA' USING ERRCODE='23514'; END IF;
 RETURN r;
END;
$fn$;
CREATE FUNCTION public.legados_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'AUDITORIA_LEGADA_IMUTAVEL' USING ERRCODE='42501'; END;
$fn$;
CREATE FUNCTION public.legados_operacao_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF TG_OP='DELETE' OR OLD.resultado IS NOT NULL OR NEW.resultado IS NULL OR NEW.concluida_em IS NULL OR
  (to_jsonb(NEW)-'resultado'-'concluida_em') IS DISTINCT FROM (to_jsonb(OLD)-'resultado'-'concluida_em') OR
  NOT EXISTS(SELECT 1 FROM public.legados_auditoria WHERE operacao_id=NEW.id AND resultado=NEW.resultado AND user_id=NEW.user_id AND hash_payload=NEW.hash_payload) THEN
  RAISE EXCEPTION 'OPERACAO_LEGADA_IMUTAVEL' USING ERRCODE='42501'; END IF; RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.legados_operacao_guardar() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER legados_operacao_imutavel BEFORE UPDATE OR DELETE ON public.legados_operacoes FOR EACH ROW EXECUTE FUNCTION public.legados_operacao_guardar();
CREATE TRIGGER legados_audit_imutavel BEFORE UPDATE OR DELETE ON public.legados_auditoria FOR EACH ROW EXECUTE FUNCTION public.legados_imutavel();
-- Leitor de recibos: somente cinco campos, sem SELECT privado para service_role.
-- STABLE impede DML neste leitor; nada reserva, recalcula ou adota contratos.
CREATE FUNCTION public.legados_prova_pagamento(p_user_id integer,p_fonte text,p_operacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' SET DateStyle='ISO, YMD' AS $proof$
DECLARE op jsonb; r jsonb; perna jsonb; audit jsonb; tx public.transacoes_caixa%ROWTYPE;
 p public.parcelas%ROWTYPE; c public.contratos%ROWTYPE; payload jsonb; montante text; dia text; n integer;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_operacao_id IS NULL OR p_fonte IS NULL
  OR p_fonte NOT IN('ciclo_operacoes','legados_operacoes','operacoes_financeiras') THEN RETURN NULL; END IF;
 IF p_fonte='ciclo_operacoes' THEN
  SELECT to_jsonb(o) INTO op FROM public.ciclo_operacoes o WHERE o.id=p_operacao_id AND o.user_id=p_user_id;
 ELSIF p_fonte='legados_operacoes' THEN
  SELECT to_jsonb(o) INTO op FROM public.legados_operacoes o WHERE o.id=p_operacao_id AND o.user_id=p_user_id;
 ELSE
  -- 0015 é opcional e não é instalada/adotada por 0034. Ausência não vira inferência.
  IF to_regclass('public.operacoes_financeiras') IS NULL OR to_regclass('public.auditoria_financeira') IS NULL THEN RETURN NULL; END IF;
  EXECUTE 'SELECT to_jsonb(o) FROM public.operacoes_financeiras o WHERE o.id=$1 AND o.user_id=$2' INTO op USING p_operacao_id,p_user_id;
  IF op->>'status' IS DISTINCT FROM 'concluida' OR op->>'tipo' IS DISTINCT FROM 'recebimento_parcela' THEN RETURN NULL; END IF;
 END IF;
 r:=op->'resultado'; payload:=op->'payload';
 IF op IS NULL OR op->>'concluida_em' IS NULL OR NOT isfinite((op->>'concluida_em')::timestamptz)
  OR r->'success' IS DISTINCT FROM 'true'::jsonb OR (r->>'operationId')::uuid IS DISTINCT FROM p_operacao_id
  OR r->>'status' IS NULL OR r->>'status' NOT IN('paga','parcial')
  OR coalesce(r->>'parcelaId','') !~ '^[1-9][0-9]*$' OR coalesce(r->>'transacaoCaixaId','') !~ '^[1-9][0-9]*$'
  OR coalesce(r->>'dataPagamento','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF;
 SELECT * INTO tx FROM public.transacoes_caixa WHERE id=(r->>'transacaoCaixaId')::integer;
 IF tx.id IS NULL OR tx.user_id IS DISTINCT FROM p_user_id OR tx.parcela_id IS DISTINCT FROM (r->>'parcelaId')::integer
  OR tx.tipo IS DISTINCT FROM 'entrada' OR tx.categoria IS DISTINCT FROM 'pagamento_parcela'
  OR tx.valor IS NULL OR tx.valor::text IN('NaN','Infinity','-Infinity') OR tx.valor<=0 OR tx.valor<>round(tx.valor,2)
  OR tx.data_transacao IS NULL OR NOT isfinite(tx.data_transacao) OR tx.data_transacao::text IS DISTINCT FROM r->>'dataPagamento'
  OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=tx.conta_caixa_id AND user_id=p_user_id) THEN RETURN NULL; END IF;
 SELECT * INTO p FROM public.parcelas WHERE id=tx.parcela_id;
 SELECT * INTO c FROM public.contratos WHERE id=tx.contrato_id;
 IF p.id IS NULL OR c.id IS NULL OR p.user_id IS DISTINCT FROM p_user_id OR c.user_id IS DISTINCT FROM p_user_id
  OR p.contrato_id IS DISTINCT FROM c.id OR p.cliente_id IS DISTINCT FROM c.cliente_id
  OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=p_user_id)
  OR (to_jsonb(tx) ? 'cliente_id' AND (to_jsonb(tx)->>'cliente_id')::integer IS DISTINCT FROM c.cliente_id)
  OR (r ? 'contratoId' AND (r->>'contratoId')::integer IS DISTINCT FROM c.id)
  OR (r ? 'contaCaixaId' AND (r->>'contaCaixaId')::integer IS DISTINCT FROM tx.conta_caixa_id) THEN RETURN NULL; END IF;
 IF p_fonte='ciclo_operacoes' THEN
  SELECT to_jsonb(cp) INTO perna FROM public.ciclo_pernas cp WHERE cp.operacao_id=p_operacao_id;
  audit:=op->'auditoria';
  IF perna IS NULL OR (perna->>'user_id')::integer IS DISTINCT FROM p_user_id
   OR (perna->>'transacao_id')::integer IS DISTINCT FROM tx.id OR perna->'snapshot' IS DISTINCT FROM to_jsonb(tx)
   OR audit->'resultado' IS DISTINCT FROM r OR audit->'payload' IS DISTINCT FROM payload
   OR audit->>'hashPayload' IS DISTINCT FROM op->>'hash_payload' OR (audit->>'pernaId')::integer IS DISTINCT FROM tx.id
   OR r->>'regra' IS DISTINCT FROM 'recebimento_defaults_brt_v1' OR payload->>'regra' IS DISTINCT FROM r->>'regra' THEN RETURN NULL; END IF;
 ELSIF p_fonte='legados_operacoes' THEN
  SELECT to_jsonb(a) INTO audit FROM public.legados_auditoria a WHERE a.operacao_id=p_operacao_id;
  IF audit IS NULL OR (audit->>'user_id')::integer IS DISTINCT FROM p_user_id
   OR (audit->>'transacao_id')::integer IS DISTINCT FROM tx.id OR audit->'resultado' IS DISTINCT FROM r
   OR audit->>'hash_payload' IS DISTINCT FROM op->>'hash_payload'
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(audit->'depois'->'ledger') v WHERE v=to_jsonb(tx))
   OR r->>'regra' IS DISTINCT FROM 'recebimento_legado_sem_recalculo_v1' OR payload->>'regra' IS DISTINCT FROM r->>'regra'
   OR (op->>'conta_id')::integer IS DISTINCT FROM tx.conta_caixa_id THEN RETURN NULL; END IF;
 ELSE
  -- Sem coluna opcional de vínculo (produção antiga) ou sem auditoria real, NULL.
  -- Não usa descrição, status da parcela, valor acumulado, vencimento ou proximidade.
  IF (to_jsonb(tx)->>'operacao_financeira_id')::uuid IS DISTINCT FROM p_operacao_id THEN RETURN NULL; END IF;
  EXECUTE 'SELECT count(*)::integer FROM public.transacoes_caixa t WHERE (to_jsonb(t)->>''operacao_financeira_id'')::uuid=$1' INTO n USING p_operacao_id;
  IF n<>1 THEN RETURN NULL; END IF;
  EXECUTE 'SELECT count(*)::integer FROM public.auditoria_financeira a WHERE a.operacao_id=$1' INTO n USING p_operacao_id;
  IF n<>1 THEN RETURN NULL; END IF;
  EXECUTE 'SELECT to_jsonb(a) FROM public.auditoria_financeira a WHERE a.operacao_id=$1' INTO audit USING p_operacao_id;
  payload:=audit->'detalhes'->'payload'; montante:=audit->'detalhes'->>'valorPago'; dia:=audit->'detalhes'->>'dataPagamento';
  IF (audit->>'user_id')::integer IS DISTINCT FROM p_user_id OR audit->>'acao' IS DISTINCT FROM 'registrar_pagamento_parcela'
   OR audit->>'entidade' IS DISTINCT FROM 'parcelas' OR audit->>'entidade_id' IS DISTINCT FROM p.id::text
   OR montante IS NULL OR montante::numeric IS DISTINCT FROM tx.valor OR payload->>'valorPago' IS NULL
   OR (payload->>'valorPago')::numeric IS DISTINCT FROM tx.valor OR dia IS DISTINCT FROM tx.data_transacao::text
   OR payload->>'dataPagamento' IS DISTINCT FROM dia OR (payload->>'parcelaId')::integer IS DISTINCT FROM p.id
   OR (payload->>'contaCaixaId')::integer IS DISTINCT FROM tx.conta_caixa_id
   OR (r ? 'valorRecebido' AND (r->>'valorRecebido')::numeric IS DISTINCT FROM tx.valor) THEN RETURN NULL; END IF;
 END IF;
 IF p_fonte IN('ciclo_operacoes','legados_operacoes') AND (
  (op->>'parcela_id')::integer IS DISTINCT FROM p.id OR (op->>'contrato_id')::integer IS DISTINCT FROM c.id
  OR (r->>'contratoId')::integer IS DISTINCT FROM c.id OR (r->>'contaCaixaId')::integer IS DISTINCT FROM tx.conta_caixa_id
  OR (payload->>'userId')::integer IS DISTINCT FROM p_user_id OR (payload->>'contratoId')::integer IS DISTINCT FROM c.id
  OR (payload->>'parcelaId')::integer IS DISTINCT FROM p.id OR (payload->>'valorRecebido')::numeric IS DISTINCT FROM tx.valor
  OR (r->>'valorRecebido')::numeric IS DISTINCT FROM tx.valor OR payload->>'dataPagamento' IS DISTINCT FROM tx.data_transacao::text
 ) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('parcelaId',p.id,'contratoId',c.id,'clienteId',c.cliente_id,
  'valor',tx.valor::numeric(15,2)::text,'dataPagamento',tx.data_transacao::text);
END;
$proof$;
ALTER FUNCTION public.legados_prova_pagamento(integer,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.legados_prova_pagamento(integer,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.legados_prova_pagamento(integer,text,uuid) TO service_role;

-- Somente classificação para a UI; não é cotação nem adoção do legado.
-- As tabelas de origem seguem inacessíveis ao service_role fora de RPC.
CREATE FUNCTION public.legados_identificar_trilho(p_user_id integer,p_contrato_id integer,p_parcela_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $ui$
DECLARE estado text; origem_owner integer;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_contrato_id IS NULL OR p_parcela_id IS NULL THEN
  RAISE EXCEPTION 'CONSULTA_INVALIDA' USING ERRCODE='22023'; END IF;
 SELECT p.status INTO estado FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id
 WHERE p.id=p_parcela_id AND c.id=p_contrato_id AND p.user_id=p_user_id AND c.user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'REGISTRO_INDISPONIVEL' USING ERRCODE='42501'; END IF;
 SELECT user_id INTO origem_owner FROM public.emprestimos_rpc_origens WHERE contrato_id=p_contrato_id;
 IF FOUND AND origem_owner IS DISTINCT FROM p_user_id THEN
  RAISE EXCEPTION 'ORIGEM_DIVERGENTE' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,
  'trilho',CASE WHEN origem_owner IS NULL THEN 'legado' ELSE 'prospectivo' END,'status',estado);
END;
$ui$;
REVOKE ALL ON FUNCTION public.legados_identificar_trilho(integer,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.legados_identificar_trilho(integer,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.legados_metadata(),public.legados_verificar(),public.legados_moeda(numeric),public.legados_snapshot(integer),public.legados_guardar(),public.legados_validar(integer,integer,integer,integer),public.legados_travar(integer,integer,integer),public.legados_imutavel() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_cotar_recebimento_legado(integer,integer,integer,integer),public.rpc_receber_legado(integer,uuid,integer,integer,integer,text,text,date,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cotar_recebimento_legado(integer,integer,integer,integer),public.rpc_receber_legado(integer,uuid,integer,integer,integer,text,text,date,text,text,text) TO service_role;
$ddl$;
 FOREACH n IN ARRAY ARRAY['users','clientes','koletores','contas_caixa','contratos','parcelas','transacoes_caixa','contrato_historico','emprestimos_rpc_origens','emprestimos_rpc_operacoes','ciclo_estados','ciclo_operacoes'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.legados_guardar()', 'a_legados_protocolo_'||n,n);
 END LOOP;
 IF to_regclass('public.parcelas_renovacoes') IS NOT NULL THEN EXECUTE 'CREATE TRIGGER a_legados_protocolo_renovacoes BEFORE INSERT OR UPDATE OR DELETE ON public.parcelas_renovacoes FOR EACH ROW EXECUTE FUNCTION public.legados_guardar()'; END IF;
 INSERT INTO public.legados_manifesto VALUES(1,public.legados_metadata());
END;
$install$;
COMMIT;
