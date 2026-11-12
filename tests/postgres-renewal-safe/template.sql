-- ADITIVA one-shot. LOCAL: requer revisão/backup/ensaio antes de qualquer produção.
-- v1: apenas PRIMEIRA renovação de contrato 0021 criado sob 0022, uma parcela mensal intacta.
-- Nunca adota legado, parciais, descontos ou encargos manuais. Não backfill/repara dados.
-- 'renovada' NÃO quita principal: saldo_residual é principal TRANSFERIDO, não nova dívida acumulada.
-- Sucessor no mesmo contrato; total_contrato/valor_parcela representam a obrigação corrente,
-- num_parcelas/numero_parcelas contam linhas geradas (inclui anterior renovada); prova conserva história.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='10s';
SELECT pg_advisory_xact_lock(20261107,20);
SELECT pg_advisory_xact_lock(20261108,25);
LOCK TABLE public.contratos,public.parcelas,public.transacoes_caixa,public.contrato_historico,
 public.ciclo_estados,public.ciclo_operacoes,public.ciclo_autorizacoes,public.ciclo_pernas,
 public.emprestimos_rpc_operacoes,public.emprestimos_rpc_origens,
 public.users,public.contas_caixa,public.clientes,public.koletores,public.contas_pagar,
 public.ciclo_despesas_autorizacoes,public.despesas_rpc_operacoes,
 public.despesas_rpc_origens,public.despesas_rpc_pagamentos IN ACCESS EXCLUSIVE MODE;
-- build.mjs acrescenta advisory reservado, privilégios efetivos e pós-DDL de fontes conhecidas.
-- Sem locks de catálogo: DDL privilegiada externa exige janela exclusiva de governança.
DO $preflight$
DECLARE x record; actual text; expected text; tab text; a jsonb; b jsonb;
 known jsonb; observed jsonb; names text[]; owner_oid oid; service_oid oid; roles oid[];
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION '0031 requer PostgreSQL17'; END IF;
 IF to_regprocedure('extensions.digest(text,text)') IS NULL THEN RAISE EXCEPTION 'pgcrypto extensions obrigatório'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE (p.proname LIKE 'renovacao\_%' ESCAPE '\' OR p.proname IN('rpc_cotar_renovacao_prospectiva','rpc_renovar_emprestimo_prospectivo')))
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE c.relname LIKE 'renovacao\_%' ESCAPE '\') THEN RAISE EXCEPTION 'Objetos 0031 homônimos; one-shot fechado'; END IF;
 -- Somente baseline integral 0020/21/22/25 comprovado, ambos overloads privados.
 SELECT proowner INTO owner_oid FROM pg_proc WHERE oid=to_regprocedure('public.ciclo_guardar()');
 IF owner_oid IS NULL OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=owner_oid AND rolname IN(current_user,'postgres'))
 OR (owner_oid<>(SELECT oid FROM pg_roles WHERE rolname=current_user) AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)) THEN
  RAISE EXCEPTION '0031: owner/instalador predecessor incompatível'; END IF;
 SELECT oid INTO service_oid FROM pg_roles WHERE rolname='service_role';
 SELECT array_agg(oid) INTO roles FROM pg_roles WHERE rolname IN('anon','authenticated','service_role');
 IF cardinality(roles) IS DISTINCT FROM 3 OR EXISTS(SELECT 1 FROM pg_roles WHERE oid=ANY(roles) AND (rolsuper OR rolcreaterole OR pg_has_role(oid,owner_oid,'MEMBER'))) THEN
  RAISE EXCEPTION '0031: roles ausentes/privilegiadas/owner membership'; END IF;
 known := $known0031$@@BASELINE@@$known0031$::jsonb;
 SELECT array_agg(DISTINCT f->>'proname') INTO names FROM jsonb_array_elements(known) f;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname=ANY(names) AND (pronamespace<>'public'::regnamespace OR proowner<>owner_oid)) THEN
  RAISE EXCEPTION '0031: schema/owner predecessor incompatível'; END IF;
 SELECT jsonb_agg(j ORDER BY j->>'proname',j->>'types') INTO observed FROM (
  SELECT jsonb_build_object('proname',p.proname,'args',pg_get_function_identity_arguments(p.oid),
   'types',oidvectortypes(p.proargtypes),'result',pg_get_function_result(p.oid),'lang',l.lanname,
   'prosecdef',p.prosecdef,'provolatile',p.provolatile,'proparallel',p.proparallel,
   'proisstrict',p.proisstrict,'proleakproof',p.proleakproof,'prokind',p.prokind,
   'pronargdefaults',p.pronargdefaults,'defaults',pg_get_expr(p.proargdefaults,0),
   'proconfig',to_jsonb(p.proconfig),'body_hash',encode(extensions.digest(p.prosrc,'sha256'),'hex')) j
  FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname=ANY(names)
 ) q;
 SELECT jsonb_agg(f ORDER BY f->>'proname',f->>'types') INTO known FROM jsonb_array_elements(known) f;
 IF observed IS DISTINCT FROM known THEN RAISE EXCEPTION '0031: corpo/hash/assinatura/language/configuração/overload predecessor incompatível'; END IF;
 FOR x IN SELECT * FROM pg_proc WHERE proname=ANY(names) LOOP
  IF EXISTS(SELECT 1 FROM aclexplode(coalesce(x.proacl,acldefault('f',x.proowner))) a
    WHERE a.grantee<>owner_oid AND NOT(x.proname LIKE 'rpc\_%' ESCAPE '\' AND a.grantee=service_oid AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
   OR (x.proname LIKE 'rpc\_%' ESCAPE '\' AND NOT has_function_privilege(service_oid,x.oid,'EXECUTE'))
   OR EXISTS(SELECT 1 FROM unnest(roles) r WHERE r<>service_oid AND has_function_privilege(r,x.oid,'EXECUTE'))
   OR (x.proname NOT LIKE 'rpc\_%' ESCAPE '\' AND has_function_privilege(service_oid,x.oid,'EXECUTE'))
   OR EXISTS(SELECT 1 FROM pg_depend WHERE classid='pg_proc'::regclass AND objid=x.oid AND deptype='e') THEN
   RAISE EXCEPTION '0031: ACL/capability/dependência predecessora incompatível: %',x.proname; END IF;
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['ciclo_autorizacoes','ciclo_despesas_autorizacoes','ciclo_estados','ciclo_operacoes','ciclo_pernas','emprestimos_rpc_operacoes','emprestimos_rpc_origens'] LOOP
  IF (SELECT count(*) FROM pg_class WHERE relname=tab)<>1 THEN RAISE EXCEPTION '0031: tabela privada ausente/homônima: %',tab; END IF;
  SELECT * INTO x FROM pg_class WHERE relname=tab;
  IF x.relnamespace<>'public'::regnamespace OR x.relowner<>owner_oid OR x.relkind<>'r' OR x.relpersistence<>'p'
   OR NOT x.relrowsecurity OR x.relforcerowsecurity
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(x.relacl,acldefault('r',x.relowner))) a WHERE a.grantee<>owner_oid)
   OR EXISTS(SELECT 1 FROM pg_attribute z,LATERAL aclexplode(z.attacl) a WHERE z.attrelid=x.oid AND a.grantee<>owner_oid)
   OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=x.oid) THEN RAISE EXCEPTION '0031: owner/RLS/ACL/policy privada incompatível: %',tab; END IF;
 END LOOP;
 FOR x IN SELECT * FROM (VALUES ('contratos','ciclo_contrato',27),('parcelas','ciclo_parcela',31),('transacoes_caixa','ciclo_ledger',31),('contrato_historico','ciclo_historico',31),('contas_caixa','ciclo_conta',27)) v(t,n,b) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||x.t)::regclass AND tgname=x.n AND tgfoid='public.ciclo_guardar()'::regprocedure AND tgtype=x.b AND tgenabled='O' AND NOT tgisinternal AND tgconstraint=0 AND tgnargs=0 AND tgqual IS NULL AND tgattr=''::int2vector)
    OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||x.t)::regclass AND NOT tgisinternal AND tgname<>x.n) THEN RAISE EXCEPTION 'Guard/trigger desconhecido: %',x.t; END IF;
 END LOOP;
 FOR x IN SELECT * FROM (VALUES ('contratos','valor_principal','numeric(15,2)'),('contratos','taxa_juros','numeric(5,2)'),('contratos','multa_atraso','numeric(8,4)'),('contratos','juros_mora_diario','numeric(8,4)'),('parcelas','valor_original','numeric(15,2)'),('parcelas','valor_pago','numeric(15,2)'),('parcelas','saldo_residual','numeric(15,2)'),('parcelas','status','character varying(20)'),('contratos','status','character varying(20)'),('transacoes_caixa','valor','numeric(15,2)'),('contrato_historico','valor_novo','numeric(12,2)')) v(t,c,typ) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=('public.'||x.t)::regclass AND attname=x.c AND NOT attisdropped AND format_type(atttypid,atttypmod)=x.typ) THEN RAISE EXCEPTION 'Schema incompatible %.%',x.t,x.c; END IF;
 END LOOP;
 -- Rowtypes inteiros usados para capabilities: desconhecido NÃO ganha permissão nem
 -- é truncado. Modelo sintético conhecido (fixture, nunca dump de dados produtivos).
 @@MODELS@@
 FOREACH tab IN ARRAY ARRAY['contratos','parcelas','transacoes_caixa','contrato_historico'] LOOP
  SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,attidentity,attgenerated,
    CASE WHEN pg_get_expr(d.adbin,d.adrelid) LIKE 'nextval(%' THEN 'serial' ELSE pg_get_expr(d.adbin,d.adrelid) END) ORDER BY attnum)
  INTO a FROM pg_attribute z LEFT JOIN pg_attrdef d ON d.adrelid=z.attrelid AND d.adnum=z.attnum
  WHERE z.attrelid=('public.'||tab)::regclass AND z.attnum>0 AND NOT z.attisdropped;
  SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,attidentity,attgenerated,
    CASE WHEN pg_get_expr(d.adbin,d.adrelid) LIKE 'nextval(%' THEN 'serial' ELSE pg_get_expr(d.adbin,d.adrelid) END) ORDER BY attnum)
  INTO b FROM pg_attribute z LEFT JOIN pg_attrdef d ON d.adrelid=z.attrelid AND d.adnum=z.attnum
  WHERE z.attrelid=('renovacao_modelo_'||tab)::regclass AND z.attnum>0 AND NOT z.attisdropped;
  IF a IS DISTINCT FROM b THEN RAISE EXCEPTION '0031 rowtype/default incompatível: %',tab; END IF;
  EXECUTE format('DROP TABLE renovacao_modelo_%I',tab);
 END LOOP;
 CREATE TEMP TABLE renovacao_check_modelo(status varchar(20),valor numeric(15,2),valor_pago numeric(15,2),saldo_residual numeric(15,2)) ON COMMIT DROP;
 ALTER TABLE renovacao_check_modelo ADD CONSTRAINT esperado CHECK (status::text = ANY (ARRAY['pendente'::varchar,'paga'::varchar,'pago'::varchar,'atrasada'::varchar,'atrasado'::varchar,'cancelada'::varchar,'cancelado'::varchar,'parcial'::varchar,'vencendo_hoje'::varchar]::text[]));
 SELECT pg_get_expr(conbin,conrelid) INTO expected FROM pg_constraint WHERE conrelid='renovacao_check_modelo'::regclass AND conname='esperado';
 SELECT pg_get_expr(conbin,conrelid) INTO actual FROM pg_constraint WHERE conrelid='public.parcelas'::regclass AND conname='parcelas_status_check' AND contype='c' AND convalidated AND NOT connoinherit;
 -- Duas representações da mesma expressão, sem normalizar/remover SQL arbitrário.
 -- A variante abaixo foi comprovada em 17.6: mesmos nove valores e casts exatos.
 IF (actual IS DISTINCT FROM expected AND actual IS DISTINCT FROM $check176$((status)::text = ANY ((ARRAY['pendente'::character varying, 'paga'::character varying, 'pago'::character varying, 'atrasada'::character varying, 'atrasado'::character varying, 'cancelada'::character varying, 'cancelado'::character varying, 'parcial'::character varying, 'vencendo_hoje'::character varying])::text[]))$check176$)
 OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.parcelas'::regclass AND contype='c' AND conname<>'parcelas_status_check') THEN RAISE EXCEPTION 'CHECK parcelas desconhecido; não ampliar cegamente'; END IF;
 IF EXISTS(SELECT 1 FROM public.parcelas WHERE status='renovada') THEN RAISE EXCEPTION 'Dados status reservado existem'; END IF;
END;
$preflight$;
ALTER TABLE public.parcelas DROP CONSTRAINT parcelas_status_check;
ALTER TABLE public.parcelas ADD CONSTRAINT parcelas_status_check CHECK (status::text = ANY (ARRAY['pendente'::varchar,'paga'::varchar,'pago'::varchar,'atrasada'::varchar,'atrasado'::varchar,'cancelada'::varchar,'cancelado'::varchar,'parcial'::varchar,'vencendo_hoje'::varchar,'renovada'::varchar]::text[]));

CREATE TABLE public.renovacao_operacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id integer NOT NULL REFERENCES public.users(id),
 chave_idempotencia uuid NOT NULL, hash_payload text NOT NULL CHECK(hash_payload ~ '^[0-9a-f]{64}$'),
 contrato_id integer NOT NULL REFERENCES public.emprestimos_rpc_origens(contrato_id) ON DELETE RESTRICT,
 parcela_id integer NOT NULL REFERENCES public.parcelas(id) ON DELETE RESTRICT,
 payload jsonb NOT NULL, resultado jsonb, auditoria jsonb, concluida_em timestamptz,
 UNIQUE(user_id,chave_idempotencia), UNIQUE(user_id,id),
 CHECK((resultado IS NULL AND auditoria IS NULL AND concluida_em IS NULL) OR (resultado IS NOT NULL AND auditoria IS NOT NULL AND concluida_em IS NOT NULL))
);
CREATE TABLE public.renovacao_provas (
 operacao_id uuid PRIMARY KEY, user_id integer NOT NULL, contrato_id integer NOT NULL UNIQUE REFERENCES public.contratos(id) ON DELETE RESTRICT,
 parcela_anterior_id integer NOT NULL UNIQUE REFERENCES public.parcelas(id) ON DELETE RESTRICT,
 parcela_sucessora_id integer NOT NULL UNIQUE REFERENCES public.parcelas(id) ON DELETE RESTRICT,
 transacao_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id) ON DELETE RESTRICT,
 principal_antes numeric(15,2) NOT NULL CHECK(principal_antes>0), principal_depois numeric(15,2) NOT NULL,
 principal_pago numeric(15,2) NOT NULL CHECK(principal_pago=0), juros_pagos numeric(15,2) NOT NULL CHECK(juros_pagos>0),
 multa_paga numeric(15,2) NOT NULL CHECK(multa_paga>=0), mora_paga numeric(15,2) NOT NULL CHECK(mora_paga>=0),
 valor_recebido numeric(15,2) NOT NULL, cotacao jsonb NOT NULL, perna_snapshot jsonb NOT NULL,
 regra text NOT NULL CHECK(regra='renovacao_juros_mensal_brt_v1'),
 CHECK(principal_antes=principal_depois AND parcela_anterior_id<>parcela_sucessora_id AND valor_recebido=juros_pagos+multa_paga+mora_paga),
 FOREIGN KEY(user_id,operacao_id) REFERENCES public.renovacao_operacoes(user_id,id) ON DELETE RESTRICT
);
-- Capacidade de USO ÚNICO, por linha e operação. Não aceita caller GUC, tabela/ação genérica.
CREATE TABLE public.renovacao_capacidades (
 xid bigint NOT NULL, pid integer NOT NULL, operacao_id uuid NOT NULL REFERENCES public.renovacao_operacoes(id),
 tabela text NOT NULL CHECK(tabela IN('contratos','parcelas','transacoes_caixa','contrato_historico')),
 evento text NOT NULL CHECK(evento IN('INSERT','UPDATE')), anterior jsonb, posterior jsonb NOT NULL,
 PRIMARY KEY(xid,pid), CHECK((evento='INSERT' AND anterior IS NULL) OR (evento='UPDATE' AND anterior IS NOT NULL))
);
ALTER TABLE public.renovacao_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renovacao_provas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renovacao_capacidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.renovacao_operacoes,public.renovacao_provas,public.renovacao_capacidades FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.renovacao_consumir_capacidade(p_tabela text,p_evento text,p_old jsonb,p_new jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cap public.renovacao_capacidades%ROWTYPE;
BEGIN
 DELETE FROM public.renovacao_capacidades a USING public.renovacao_operacoes o
 WHERE a.xid=txid_current() AND a.pid=pg_backend_pid() AND a.tabela=p_tabela AND a.evento=p_evento
 AND a.anterior IS NOT DISTINCT FROM p_old AND a.posterior IS NOT DISTINCT FROM p_new
 AND o.id=a.operacao_id AND o.resultado IS NULL AND (p_new->>'user_id')=o.user_id::text
 AND (CASE WHEN p_tabela='contratos' THEN (p_new->>'id')::integer ELSE (p_new->>'contrato_id')::integer END)=o.contrato_id
 RETURNING a.* INTO cap;
 IF FOUND THEN RETURN true; END IF;
 -- O novo status não fica disponível para escrita manual no legado.
 IF p_tabela='parcelas' AND p_new->>'status'='renovada' THEN RAISE EXCEPTION 'Status renovada exige capacidade exata' USING ERRCODE='42501'; END IF;
 RETURN false;
END;
$$;
-- Somente esta extensão, código original abaixo permanece integralmente preservado.
CREATE OR REPLACE FUNCTION public.ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$@@GUARD@@$$;

CREATE FUNCTION public.renovacao_cotacao(p_user integer,p_contrato integer,p_parcela integer,p_instante timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' AS $$
DECLARE s jsonb; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; op public.emprestimos_rpc_operacoes%ROWTYPE;
 q jsonb; enc jsonb; hoje date:=(p_instante AT TIME ZONE 'America/Sao_Paulo')::date; venc date;
 total numeric; juros numeric; multa numeric; mora numeric;
BEGIN
 s:=public.ciclo_validar(p_user,p_contrato);
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato;
 SELECT * INTO p FROM public.parcelas WHERE id=p_parcela AND contrato_id=p_contrato AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Parcela indisponível' USING ERRCODE='42501'; END IF;
 SELECT o.* INTO STRICT op FROM public.emprestimos_rpc_operacoes o JOIN public.emprestimos_rpc_origens r ON r.operacao_id=o.id WHERE r.contrato_id=p_contrato;
 IF NOT EXISTS(SELECT 1 FROM public.ciclo_estados WHERE contrato_id=p_contrato AND user_id=p_user AND origem_completa)
 OR op.auditoria->'contrato' IS DISTINCT FROM s->'contrato' OR op.auditoria->'parcelas' IS DISTINCT FROM s->'parcelas'
 OR c.status IS DISTINCT FROM 'ativo' OR c.modalidade IS DISTINCT FROM 'mensal' OR c.tipo_taxa IS DISTINCT FROM 'mensal'
 OR c.num_parcelas IS DISTINCT FROM 1 OR c.numero_parcelas IS DISTINCT FROM 1 OR (op.payload->>'numeroParcelas')::int IS DISTINCT FROM 1
 OR jsonb_array_length(s->'parcelas')<>1 OR jsonb_array_length(s->'ledger')<>1 OR jsonb_array_length(s->'historico')<>1
 OR EXISTS(SELECT 1 FROM public.ciclo_operacoes WHERE contrato_id=p_contrato) OR EXISTS(SELECT 1 FROM public.renovacao_provas WHERE contrato_id=p_contrato)
 OR p.status NOT IN('pendente','atrasada','vencendo_hoje') OR p.valor_pago IS DISTINCT FROM 0::numeric OR p.saldo_residual IS DISTINCT FROM 0::numeric
 OR p.valor_desconto IS DISTINCT FROM 0::numeric OR p.valor_multa IS DISTINCT FROM 0::numeric OR p.multa_diaria_usada IS DISTINCT FROM 0::numeric OR p.multa_manual IS DISTINCT FROM 0::numeric
 OR p.data_pagamento IS NOT NULL OR p.valor IS DISTINCT FROM p.valor_original OR p.valor_juros<=0 OR p.valor_original-p.valor_juros IS DISTINCT FROM c.valor_principal
 OR p.valor_juros IS DISTINCT FROM round(c.valor_principal*c.taxa_juros/100,2) THEN
 RAISE EXCEPTION 'v1 exige criação 0021/0022 completa, UMA parcela mensal intacta; sem legado, parcial, desconto/amortização ou segunda renovação' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=p_user)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=c.conta_caixa_id AND user_id=p_user AND ativo)
 OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=p_user AND ativo))
 OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE conta_caixa_id=c.conta_caixa_id AND user_id IS DISTINCT FROM p_user) THEN RAISE EXCEPTION 'Vínculos/conta não disponíveis' USING ERRCODE='42501'; END IF;
 -- Um mês civil a partir do MAIOR entre vencimento anterior e data BRT de recebimento.
 -- Clamp explícito: 31/jan -> último dia de fevereiro. Não usa 30 dias, não backdate.
 venc:=(greatest(p.data_vencimento,hoje)+interval '1 month')::date;
 IF venc>DATE '9999-12-31' THEN RAISE EXCEPTION 'Calendário fora da faixa' USING ERRCODE='22023'; END IF;
 enc:=public.ciclo_encargos(p.valor_original,c.multa_atraso,c.juros_mora_diario,p.data_vencimento,p_instante);
 juros:=p.valor_juros; multa:=(enc->>'multa')::numeric; mora:=(enc->>'mora')::numeric; total:=juros+multa+mora;
 IF total>9999999999.99 OR c.valor_principal+juros>9999999999.99 THEN RAISE EXCEPTION 'Valores fora da faixa de histórico' USING ERRCODE='22023'; END IF;
 q:=jsonb_build_object('elegivel',true,'contratoId',p_contrato,'parcelaId',p_parcela,'contaCaixaId',c.conta_caixa_id,
 'jurosEmbutidos',juros::numeric(15,2)::text,'multa',multa::numeric(15,2)::text,'mora',mora::numeric(15,2)::text,'totalExigido',total::numeric(15,2)::text,
 'principalAntes',c.valor_principal::numeric(15,2)::text,'principalDepois',c.valor_principal::numeric(15,2)::text,'principalPago','0.00',
 'novoJuros',juros::numeric(15,2)::text,'novoTotal',(c.valor_principal+juros)::numeric(15,2)::text,'novoVencimento',venc,
 'vencimento',p.data_vencimento,'dataPagamento',hoje,'expiraEm',to_char(hoje+1,'YYYY-MM-DD')||'T00:00:00-03:00',
 'estadoHash',encode(extensions.digest(s::text,'sha256'),'hex'),'regra','renovacao_juros_mensal_brt_v1');
 RETURN q||jsonb_build_object('cotacaoHash',encode(extensions.digest(q::text,'sha256'),'hex'));
END;
$$;
CREATE FUNCTION public.rpc_cotar_renovacao_prospectiva(p_user_id integer,p_contrato_id integer,p_parcela_id integer) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT public.renovacao_cotacao(p_user_id,p_contrato_id,p_parcela_id,clock_timestamp());
$$;
CREATE FUNCTION public.rpc_renovar_emprestimo_prospectivo(p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_parcela_id integer,
 p_valor_recebido numeric,p_total_exigido numeric,p_data_pagamento date,p_estado_hash text,p_cotacao_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET timezone='UTC' AS $$
DECLARE v_payload jsonb; hash text; op public.renovacao_operacoes%ROWTYPE; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE;
 novo public.parcelas%ROWTYPE; tc public.transacoes_caixa%ROWTYPE; h public.contrato_historico%ROWTYPE;
 antes jsonb; depois jsonb; oldrow jsonb; q jsonb; conta integer; instante timestamptz; result jsonb;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave_idempotencia IS NULL OR p_contrato_id IS NULL OR p_contrato_id<=0 OR p_parcela_id IS NULL OR p_parcela_id<=0
 OR p_valor_recebido IS NULL OR p_valor_recebido::text IN('NaN','Infinity','-Infinity') OR p_valor_recebido<=0 OR p_valor_recebido<>round(p_valor_recebido,2) OR p_valor_recebido>9999999999.99
 OR p_total_exigido IS NULL OR p_total_exigido IS DISTINCT FROM p_valor_recebido
 OR p_estado_hash IS NULL OR p_estado_hash !~ '^[0-9a-f]{64}$' OR p_cotacao_hash IS NULL OR p_cotacao_hash !~ '^[0-9a-f]{64}$'
 OR p_data_pagamento IS NULL OR NOT isfinite(p_data_pagamento) OR p_data_pagamento NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' THEN
 RAISE EXCEPTION 'Intenção inválida: valor EXATO em centavos, UUID, DATE/hash' USING ERRCODE='22023'; END IF;
 v_payload:=jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,'valorRecebido',p_valor_recebido::numeric(15,2)::text,
 'totalExigido',p_total_exigido::numeric(15,2)::text,'dataPagamento',p_data_pagamento,'estadoHash',p_estado_hash,'cotacaoHash',p_cotacao_hash,'regra','renovacao_juros_mensal_brt_v1');
 hash:=encode(extensions.digest(v_payload::text,'sha256'),'hex');
 IF NOT EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=p_contrato_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Origem não disponível' USING ERRCODE='42501'; END IF;
 INSERT INTO public.renovacao_operacoes(user_id,chave_idempotencia,hash_payload,contrato_id,parcela_id,payload)
 VALUES(p_user_id,p_chave_idempotencia,hash,p_contrato_id,p_parcela_id,v_payload) ON CONFLICT(user_id,chave_idempotencia) DO NOTHING;
 SELECT * INTO STRICT op FROM public.renovacao_operacoes WHERE user_id=p_user_id AND chave_idempotencia=p_chave_idempotencia FOR UPDATE;
 IF op.hash_payload<>hash THEN RAISE EXCEPTION 'UUID reutilizado com intenção divergente' USING ERRCODE='23505'; END IF;
 IF op.resultado IS NOT NULL THEN RETURN op.resultado||jsonb_build_object('repetida',true); END IF;
 SELECT conta_caixa_id INTO conta FROM public.contratos WHERE id=p_contrato_id;
 -- MESMA ordem 0022; NO KEY UPDATE evita upgrade deadlock de reservas/FK concorrentes.
 PERFORM pg_advisory_xact_lock(22022,conta);
 PERFORM 1 FROM public.contas_caixa WHERE id=conta FOR UPDATE;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato_id;
 PERFORM 1 FROM public.clientes WHERE id=c.cliente_id FOR UPDATE;
 PERFORM 1 FROM public.koletores WHERE id=c.koletor_id FOR UPDATE;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato_id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.parcelas WHERE contrato_id=p_contrato_id ORDER BY id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.transacoes_caixa WHERE conta_caixa_id=conta OR contrato_id=p_contrato_id OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=p_contrato_id) ORDER BY id FOR UPDATE;
 instante:=clock_timestamp(); -- revalidar APÓS esperas, não statement_timestamp antes do lock.
 antes:=public.ciclo_validar(p_user_id,p_contrato_id); q:=public.renovacao_cotacao(p_user_id,p_contrato_id,p_parcela_id,instante);
 IF c.conta_caixa_id IS DISTINCT FROM conta OR q->>'estadoHash' IS DISTINCT FROM p_estado_hash OR q->>'cotacaoHash' IS DISTINCT FROM p_cotacao_hash
 OR (q->>'dataPagamento')::date IS DISTINCT FROM p_data_pagamento OR (q->>'totalExigido')::numeric IS DISTINCT FROM p_total_exigido THEN
 RAISE EXCEPTION 'Cotação/estado/data expirou ou divergiu' USING ERRCODE='40001'; END IF;
 SELECT * INTO STRICT p FROM public.parcelas WHERE id=p_parcela_id;
 oldrow:=to_jsonb(p);
 p.valor_pago:=p_valor_recebido; p.valor_multa:=(q->>'multa')::numeric; p.multa_diaria_usada:=(q->>'mora')::numeric;
 p.saldo_residual:=c.valor_principal; p.data_pagamento:=p_data_pagamento; p.status:='renovada'; p."updatedAt":=instante;
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'parcelas','UPDATE',oldrow,to_jsonb(p));
 UPDATE public.parcelas SET valor_pago=p.valor_pago,valor_multa=p.valor_multa,multa_diaria_usada=p.multa_diaria_usada,
 saldo_residual=p.saldo_residual,data_pagamento=p.data_pagamento,status=p.status,"updatedAt"=p."updatedAt" WHERE id=p.id;
 -- Construir linha inteira antes da capability: nenhum INSERT genérico liberado.
 novo:=p; novo.id:=nextval(pg_get_serial_sequence('public.parcelas','id')); novo.numero:=2; novo.numero_parcela:=2;
 novo.valor:=(q->>'novoTotal')::numeric; novo.valor_original:=novo.valor; novo.valor_juros:=(q->>'novoJuros')::numeric;
 novo.valor_pago:=0; novo.valor_multa:=0; novo.multa_diaria_usada:=0; novo.saldo_residual:=0; novo.data_pagamento:=NULL;
 novo.data_vencimento:=(q->>'novoVencimento')::date; novo.status:='pendente'; novo.observacoes:=NULL;
 novo."createdAt":=instante; novo."updatedAt":=instante;
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'parcelas','INSERT',NULL,to_jsonb(novo));
 INSERT INTO public.parcelas SELECT (novo).*;
 -- Categoria específica: não há segundo desembolso nem receita de principal.
 tc.id:=nextval(pg_get_serial_sequence('public.transacoes_caixa','id')); tc.user_id:=p_user_id; tc.conta_caixa_id:=conta;
 tc.contrato_id:=p_contrato_id; tc.parcela_id:=p_parcela_id; tc.tipo:='entrada'; tc.categoria:='renovacao_juros'; tc.valor:=p_valor_recebido;
 tc.descricao:='Renovação prospectiva '||op.id::text; tc.data_transacao:=p_data_pagamento; tc."createdAt":=instante;
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'transacoes_caixa','INSERT',NULL,to_jsonb(tc));
 INSERT INTO public.transacoes_caixa SELECT (tc).*;
 INSERT INTO public.renovacao_provas(operacao_id,user_id,contrato_id,parcela_anterior_id,parcela_sucessora_id,transacao_id,
 principal_antes,principal_depois,principal_pago,juros_pagos,multa_paga,mora_paga,valor_recebido,cotacao,perna_snapshot,regra)
 VALUES(op.id,p_user_id,p_contrato_id,p.id,novo.id,tc.id,c.valor_principal,c.valor_principal,0,p.valor_juros,p.valor_multa,p.multa_diaria_usada,p_valor_recebido,q,to_jsonb(tc),'renovacao_juros_mensal_brt_v1');
 oldrow:=to_jsonb(c); c.num_parcelas:=2; c.numero_parcelas:=2; c.valor_parcela:=novo.valor; c.total_contrato:=novo.valor;
 c.data_vencimento:=novo.data_vencimento; c.dia_vencimento:=extract(day FROM novo.data_vencimento)::int; c."updatedAt":=instante;
 -- data_vencimento_primeira/data_inicio/encargos históricos permanecem originais.
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'contratos','UPDATE',oldrow,to_jsonb(c));
 UPDATE public.contratos SET num_parcelas=c.num_parcelas,numero_parcelas=c.numero_parcelas,valor_parcela=c.valor_parcela,total_contrato=c.total_contrato,
 data_vencimento=c.data_vencimento,dia_vencimento=c.dia_vencimento,"updatedAt"=c."updatedAt" WHERE id=c.id;
 h.id:=nextval(pg_get_serial_sequence('public.contrato_historico','id')); h.user_id:=p_user_id::text; h.contrato_id:=p_contrato_id;
 h.tipo:='renovacao'; h.descricao:='Renovação prospectiva '||op.id::text||'; principal transferido, não quitado';
 h.valor_anterior:=0; h.valor_novo:=p_valor_recebido; h.created_at:=instante;
 INSERT INTO public.renovacao_capacidades VALUES(txid_current(),pg_backend_pid(),op.id,'contrato_historico','INSERT',NULL,to_jsonb(h));
 INSERT INTO public.contrato_historico SELECT (h).*;
 depois:=public.ciclo_snapshot(p_contrato_id);
 UPDATE public.ciclo_estados SET snapshot=depois WHERE contrato_id=p_contrato_id;
 result:=jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'contratoId',p_contrato_id,'parcelaId',p.id,'sucessoraId',novo.id,
 'transacaoCaixaId',tc.id::text,'contaCaixaId',conta,'valorRecebido',p_valor_recebido::numeric(15,2)::text,'totalExigido',p_total_exigido::numeric(15,2)::text,
 'jurosPagos',p.valor_juros::numeric(15,2)::text,'multaPaga',p.valor_multa::numeric(15,2)::text,'moraPaga',p.multa_diaria_usada::numeric(15,2)::text,
 'principalPago','0.00','principalAntes',c.valor_principal::numeric(15,2)::text,'principalDepois',c.valor_principal::numeric(15,2)::text,
 'status','renovada','contratoStatus','ativo','novoTotal',novo.valor::numeric(15,2)::text,'novoJuros',novo.valor_juros::numeric(15,2)::text,
 'novoVencimento',novo.data_vencimento,'dataPagamento',p_data_pagamento,'estadoHash',p_estado_hash,'cotacaoHash',p_cotacao_hash,'regra','renovacao_juros_mensal_brt_v1');
 UPDATE public.renovacao_operacoes SET resultado=result,concluida_em=clock_timestamp(),auditoria=jsonb_build_object('antes',antes,'depois',depois,
 'payload',v_payload,'hashPayload',hash,'cotacao',q,'prova',(SELECT to_jsonb(x) FROM public.renovacao_provas x WHERE operacao_id=op.id),'historicoId',h.id::text,'resultado',result) WHERE id=op.id;
 IF EXISTS(SELECT 1 FROM public.renovacao_capacidades WHERE xid=txid_current() AND pid=pg_backend_pid()) THEN RAISE EXCEPTION 'Capacidade não consumida' USING ERRCODE='23514'; END IF;
 IF (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date IS DISTINCT FROM p_data_pagamento THEN RAISE EXCEPTION 'Cotação expirou durante execução' USING ERRCODE='40001'; END IF;
 RETURN result;
END;
$$;
CREATE FUNCTION public.renovacao_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='renovacao_operacoes' AND TG_OP='UPDATE' THEN
  IF OLD.resultado IS NULL AND NEW.resultado IS NOT NULL
  AND (to_jsonb(OLD)-ARRAY['resultado','auditoria','concluida_em'])=(to_jsonb(NEW)-ARRAY['resultado','auditoria','concluida_em']) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Prova/operação concluída imutável' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER renovacao_prova_imutavel BEFORE UPDATE OR DELETE ON public.renovacao_provas FOR EACH ROW EXECUTE FUNCTION public.renovacao_imutavel();
CREATE TRIGGER renovacao_operacao_imutavel BEFORE UPDATE OR DELETE ON public.renovacao_operacoes FOR EACH ROW EXECUTE FUNCTION public.renovacao_imutavel();
-- Única extensão de recebimento: desconsidera na quitação SOMENTE antecessor cuja
-- dívida de principal foi transferida para sucessor com prova completa. Não 'status pago'.
CREATE FUNCTION public.renovacao_antecessor_transferido(p_user integer,p_contrato integer,p_parcela integer) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.renovacao_provas r
 JOIN public.renovacao_operacoes o ON o.id=r.operacao_id AND o.user_id=r.user_id
 JOIN public.parcelas p ON p.id=r.parcela_anterior_id AND p.contrato_id=r.contrato_id AND p.user_id=r.user_id
 JOIN public.parcelas n ON n.id=r.parcela_sucessora_id AND n.contrato_id=r.contrato_id AND n.user_id=r.user_id
 JOIN public.transacoes_caixa t ON t.id=r.transacao_id
 WHERE r.user_id=p_user AND r.contrato_id=p_contrato AND r.parcela_anterior_id=p_parcela
 AND o.resultado IS NOT NULL AND o.auditoria IS NOT NULL AND o.concluida_em IS NOT NULL
 AND o.auditoria->'prova'=to_jsonb(r) AND r.perna_snapshot=to_jsonb(t)
 AND p.status='renovada' AND p.valor_pago=r.valor_recebido AND p.saldo_residual=r.principal_antes
 AND p.valor_juros=r.juros_pagos AND p.valor_multa=r.multa_paga AND p.multa_diaria_usada=r.mora_paga
 AND n.valor_original-n.valor_juros=r.principal_depois AND r.principal_pago=0);
$$;
@@RECEIVE@@
REVOKE ALL ON FUNCTION public.renovacao_antecessor_transferido(integer,integer,integer),public.renovacao_consumir_capacidade(text,text,jsonb,jsonb),public.renovacao_cotacao(integer,integer,integer,timestamptz),public.renovacao_imutavel() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_cotar_renovacao_prospectiva(integer,integer,integer),public.rpc_renovar_emprestimo_prospectivo(integer,uuid,integer,integer,numeric,numeric,date,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cotar_renovacao_prospectiva(integer,integer,integer),public.rpc_renovar_emprestimo_prospectivo(integer,uuid,integer,integer,numeric,numeric,date,text,text) TO service_role;
-- Preserva owner confiável nos objetos NOVOS; substituições retêm owner original.
-- Operador superuser do clone não é adotado como owner financeiro; nenhum GRANT extra.
DO $owners$ DECLARE own text; x record; BEGIN
 SELECT r.rolname INTO STRICT own FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='public.ciclo_guardar()'::regprocedure;
 FOR x IN SELECT oid,relname,relkind FROM pg_class WHERE relnamespace='public'::regnamespace
  AND relname LIKE 'renovacao\_%' ESCAPE '\' AND relkind IN('r','S') ORDER BY relkind DESC LOOP
  EXECUTE format('ALTER %s public.%I OWNER TO %I',CASE WHEN x.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END,x.relname,own);
 END LOOP;
 FOR x IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND (proname LIKE 'renovacao\_%' ESCAPE '\' OR proname IN('rpc_cotar_renovacao_prospectiva','rpc_renovar_emprestimo_prospectivo')) LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO %I',x.oid::regprocedure,own);
 END LOOP;
END $owners$;
COMMIT;
