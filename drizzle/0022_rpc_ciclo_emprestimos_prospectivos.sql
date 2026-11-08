-- ADITIVA, LOCAL, one-shot. Aplicar somente sob autorização; não instala 0013/0015.
-- Não adota legado nem repara linhas; origem 0021 deve provar integridade integral.
BEGIN;
DO $preflight$
DECLARE n text; x record;
BEGIN
  IF current_setting('server_version_num')::int < 170000 THEN RAISE EXCEPTION 'Requer PostgreSQL17+'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace s ON s.oid=e.extnamespace WHERE e.extname='pgcrypto' AND s.nspname='extensions')
     OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN RAISE EXCEPTION 'pgcrypto em extensions obrigatório'; END IF;
  FOREACH n IN ARRAY ARRAY['service_role','anon','authenticated'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=n) THEN RAISE EXCEPTION 'Role ausente: %',n; END IF;
  END LOOP;
  FOREACH n IN ARRAY ARRAY['contratos','parcelas','clientes','contas_caixa','koletores','transacoes_caixa','contrato_historico','emprestimos_rpc_origens','emprestimos_rpc_operacoes'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname=n AND c.relkind='r') THEN RAISE EXCEPTION 'Tabela física ausente: %',n; END IF;
  END LOOP;
  FOR x IN SELECT * FROM (VALUES ('contratos','data_inicio','date'),('contratos','data_vencimento','date'),('contratos','data_vencimento_primeira','date'),('parcelas','data_vencimento','date'),('parcelas','data_pagamento','date'),('transacoes_caixa','data_transacao','date'),('contrato_historico','user_id','text'),('contrato_historico','valor_novo','numeric(12,2)'),('contratos','taxa_juros','numeric(5,2)'),('contratos','multa_atraso','numeric(8,4)'),('contratos','juros_mora_diario','numeric(8,4)'),('contratos','valor_principal','numeric(15,2)'),('parcelas','valor_original','numeric(15,2)'),('parcelas','saldo_residual','numeric(15,2)'),('transacoes_caixa','id','integer')) AS v(t,c,typ) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=('public.'||x.t)::regclass AND a.attname=x.c AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=x.typ) THEN RAISE EXCEPTION 'Schema incompatível %.% esperado %',x.t,x.c,x.typ; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public' AND p.proname='rpc_criar_emprestimo') <> 1
     OR to_regprocedure('public.rpc_criar_emprestimo(integer,uuid,integer,integer,text,text,numeric,numeric,integer,date,date,date[],text,text)') IS NULL THEN RAISE EXCEPTION '0021 ausente ou overload ambíguo'; END IF;
  -- Nunca aceitar IF NOT EXISTS, objeto homônimo, overload ou trigger anterior desconhecido.
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public' AND (p.proname LIKE 'ciclo\_%' ESCAPE '\' OR p.proname IN ('rpc_receber_emprestimo_prospectivo','rpc_cotar_emprestimo_prospectivo')))
     OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relname LIKE 'ciclo\_%' ESCAPE '\')
     OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname LIKE 'ciclo\_%' ESCAPE '\') THEN RAISE EXCEPTION 'Objetos 0022 homônimos: instalação recusada'; END IF;
END;
$preflight$;

CREATE TABLE public.ciclo_autorizacoes (
  xid bigint NOT NULL, pid integer NOT NULL, acao text NOT NULL CHECK(acao IN ('criar','receber')),
  conta_id integer NOT NULL REFERENCES public.contas_caixa(id) ON DELETE RESTRICT,
  contrato_id integer REFERENCES public.contratos(id) ON DELETE RESTRICT,
  PRIMARY KEY(xid,pid)
);
CREATE TABLE public.ciclo_estados (
  contrato_id integer PRIMARY KEY REFERENCES public.emprestimos_rpc_origens(contrato_id) ON DELETE RESTRICT,
  user_id integer NOT NULL REFERENCES public.users(id), snapshot jsonb NOT NULL,
  origem_completa boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ciclo_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id integer NOT NULL REFERENCES public.users(id),
  chave_idempotencia uuid NOT NULL, hash_payload text NOT NULL CHECK(hash_payload ~ '^[0-9a-f]{64}$'),
  contrato_id integer NOT NULL REFERENCES public.emprestimos_rpc_origens(contrato_id) ON DELETE RESTRICT,
  parcela_id integer NOT NULL REFERENCES public.parcelas(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL, resultado jsonb, auditoria jsonb, concluida_em timestamptz,
  UNIQUE(user_id,chave_idempotencia), UNIQUE(user_id,id),
  CHECK((resultado IS NULL AND auditoria IS NULL AND concluida_em IS NULL) OR (resultado IS NOT NULL AND auditoria IS NOT NULL AND concluida_em IS NOT NULL))
);
CREATE TABLE public.ciclo_pernas (
  operacao_id uuid PRIMARY KEY REFERENCES public.ciclo_operacoes(id) ON DELETE RESTRICT,
  user_id integer NOT NULL, transacao_id integer NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL,
  FOREIGN KEY(user_id,operacao_id) REFERENCES public.ciclo_operacoes(user_id,id) ON DELETE RESTRICT
);
ALTER TABLE public.ciclo_autorizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciclo_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciclo_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciclo_pernas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ciclo_autorizacoes,public.ciclo_estados,public.ciclo_operacoes,public.ciclo_pernas FROM PUBLIC,anon,authenticated,service_role;

-- Capacidade transacional privada, não GUC controlável pelo caller; nunca EXECUTE service_role.
CREATE FUNCTION public.ciclo_autorizar(p_acao text,p_conta integer,p_contrato integer) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  INSERT INTO public.ciclo_autorizacoes(xid,pid,acao,conta_id,contrato_id)
  VALUES(txid_current(),pg_backend_pid(),p_acao,p_conta,p_contrato)
  ON CONFLICT(xid,pid) DO UPDATE SET acao=excluded.acao,conta_id=excluded.conta_id,contrato_id=excluded.contrato_id;
$$;
CREATE FUNCTION public.ciclo_snapshot(p_contrato integer) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object(
 'contrato',(SELECT to_jsonb(c) FROM public.contratos c WHERE c.id=p_contrato),
 'parcelas',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.numero,p.id) FROM public.parcelas p WHERE p.contrato_id=p_contrato),'[]'::jsonb),
 'ledger',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.transacoes_caixa t WHERE t.contrato_id=p_contrato OR t.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=p_contrato)),'[]'::jsonb),
 'historico',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.contrato_historico h WHERE h.contrato_id=p_contrato),'[]'::jsonb),
 'origem',(SELECT to_jsonb(o) FROM public.emprestimos_rpc_origens o WHERE o.contrato_id=p_contrato));
$$;

-- Asserção SEM adoção: valida snapshot 0021 e atual, incluindo aliases, rateio, defaults,
-- datas, TODOS descendentes (sem esconder owner NULL), criação/Caixa/histórico/result/hash.
CREATE FUNCTION public.ciclo_validar(p_user integer,p_contrato integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.emprestimos_rpc_origens%ROWTYPE; op public.emprestimos_rpc_operacoes%ROWTYPE;
 c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; t public.transacoes_caixa%ROWTYPE;
 h public.contrato_historico%ROWTYPE; s jsonb; e public.ciclo_estados%ROWTYPE;
 n integer; i integer:=0; juros numeric; total numeric; ref numeric; jr numeric; vl numeric; jl numeric;
 ps jsonb; ids jsonb; histid bigint;
BEGIN
 SELECT * INTO o FROM public.emprestimos_rpc_origens WHERE contrato_id=p_contrato;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM p_user THEN RAISE EXCEPTION 'Origem 0021 indisponível' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT op FROM public.emprestimos_rpc_operacoes WHERE id=o.operacao_id;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato;
 IF c.user_id IS DISTINCT FROM p_user OR op.user_id IS DISTINCT FROM p_user OR o.regra<>'mensal_simples_v1'
   OR op.resultado IS NULL OR op.auditoria IS NULL OR op.concluida_em IS NULL
   OR op.hash_payload<>encode(extensions.digest(op.payload::text,'sha256'),'hex')
   OR op.auditoria->'payload' IS DISTINCT FROM op.payload OR op.auditoria->>'hashPayload' IS DISTINCT FROM op.hash_payload
   OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado OR op.auditoria->>'acao' IS DISTINCT FROM 'criacao_emprestimo'
   OR op.auditoria->'jurosEmbutidos' IS DISTINCT FROM 'true'::jsonb THEN
   RAISE EXCEPTION 'Proveniência/auditoria adulterada' USING ERRCODE='23514'; END IF;
 s:=public.ciclo_snapshot(p_contrato);
 SELECT * INTO e FROM public.ciclo_estados WHERE contrato_id=p_contrato;
 IF FOUND THEN
   IF e.user_id IS DISTINCT FROM p_user OR e.snapshot IS DISTINCT FROM s THEN RAISE EXCEPTION 'Estado alterado fora da RPC' USING ERRCODE='23514'; END IF;
   RETURN s;
 END IF;
 -- 0021 existente: NÃO confiar apenas na existência da origem. Cabeçalho e todas linhas
 -- devem ser exatamente iguais ao snapshot inicial (inclusive campos extras e timestamps).
 IF op.auditoria->'contrato' IS DISTINCT FROM s->'contrato' OR op.auditoria->'parcelas' IS DISTINCT FROM s->'parcelas' THEN
   RAISE EXCEPTION '0021 sem snapshot completo exige estado inicial intacto' USING ERRCODE='23514'; END IF;
 n:=(op.payload->>'numeroParcelas')::integer;
 juros:=round((op.payload->>'valorPrincipal')::numeric*(op.payload->>'taxaJuros')::numeric/100*n,2);
 total:=(op.payload->>'valorPrincipal')::numeric+juros; ref:=round(total/n,2); jr:=round(juros/n,2);
 IF n NOT BETWEEN 1 AND 60 OR total>9999999999.99
   OR op.payload->>'regra' IS DISTINCT FROM 'mensal_simples_v1' OR op.payload->>'encargos' IS DISTINCT FROM 'defaults_catalogo'
   OR (op.payload->>'userId')::integer IS DISTINCT FROM p_user
   OR c.cliente_id IS DISTINCT FROM (op.payload->>'clienteId')::integer
   OR c.conta_caixa_id IS DISTINCT FROM (op.payload->>'contaCaixaId')::integer
   OR c.modalidade IS DISTINCT FROM 'mensal' OR c.tipo_taxa IS DISTINCT FROM 'mensal'
   OR c.valor_principal IS DISTINCT FROM (op.payload->>'valorPrincipal')::numeric
   OR c.taxa_juros IS DISTINCT FROM (op.payload->>'taxaJuros')::numeric
   OR c.num_parcelas IS DISTINCT FROM n OR c.numero_parcelas IS DISTINCT FROM n
   OR c.total_contrato IS DISTINCT FROM total OR c.valor_parcela IS DISTINCT FROM ref
   OR c.multa_atraso IS DISTINCT FROM 2::numeric OR c.juros_mora_diario IS DISTINCT FROM 0.033::numeric
   OR c.data_inicio IS DISTINCT FROM (op.payload->>'dataInicio')::date
   OR c.data_inicio IS DISTINCT FROM (op.payload->>'dataDesembolso')::date
   OR c.data_vencimento_primeira IS DISTINCT FROM (op.payload->'vencimentos'->>0)::date
   OR c.data_vencimento IS DISTINCT FROM (op.payload->'vencimentos'->>(n-1))::date
   OR c.dia_vencimento IS DISTINCT FROM extract(day FROM c.data_vencimento_primeira)::int
   OR c.descricao IS DISTINCT FROM op.payload->>'descricao' OR c.observacoes IS DISTINCT FROM op.payload->>'observacoes'
   OR c.status IS DISTINCT FROM 'ativo' OR c.contrato_origem_id IS NOT NULL
   OR c."createdAt" IS DISTINCT FROM op.created_at OR c."updatedAt" IS DISTINCT FROM op.created_at
   OR jsonb_array_length(op.payload->'vencimentos') IS DISTINCT FROM n THEN
   RAISE EXCEPTION 'Invariantes da criação divergentes' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT * FROM public.parcelas WHERE contrato_id=p_contrato ORDER BY numero,id LOOP
   i:=i+1; vl:=CASE WHEN i=n THEN total-ref*(n-1) ELSE ref END; jl:=CASE WHEN i=n THEN juros-jr*(n-1) ELSE jr END;
   IF p.numero IS DISTINCT FROM i OR p.numero_parcela IS DISTINCT FROM i OR i>n
     OR p.user_id IS DISTINCT FROM p_user OR p.cliente_id IS DISTINCT FROM c.cliente_id
     OR p.koletor_id IS DISTINCT FROM c.koletor_id OR p.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id
     OR p.valor IS DISTINCT FROM vl OR p.valor_original IS DISTINCT FROM vl OR p.valor_juros IS DISTINCT FROM jl
     OR vl<=0 OR jl<0 OR jl>vl OR p.valor_pago IS DISTINCT FROM 0::numeric OR p.saldo_residual IS DISTINCT FROM 0::numeric
     OR p.valor_multa IS DISTINCT FROM 0::numeric OR p.valor_desconto IS DISTINCT FROM 0::numeric
     OR p.multa_manual IS DISTINCT FROM 0::numeric OR p.multa_diaria_usada IS DISTINCT FROM 0::numeric
     OR p.data_pagamento IS NOT NULL OR p.observacoes IS NOT NULL
     OR p."createdAt" IS DISTINCT FROM op.created_at OR p."updatedAt" IS DISTINCT FROM op.created_at
     OR p.data_vencimento IS DISTINCT FROM (op.payload->'vencimentos'->>(i-1))::date
     OR p.data_vencimento<c.data_inicio
     OR (n>1 AND extract(day FROM c.data_vencimento_primeira)>28)
     OR p.data_vencimento IS DISTINCT FROM (c.data_vencimento_primeira+make_interval(months=>i-1))::date
     OR p.status IS DISTINCT FROM (CASE WHEN p.data_vencimento<coalesce((op.auditoria->>'dataCivilCriacaoBrt')::date,(op.created_at AT TIME ZONE 'America/Sao_Paulo')::date) THEN 'atrasada' WHEN p.data_vencimento=coalesce((op.auditoria->>'dataCivilCriacaoBrt')::date,(op.created_at AT TIME ZONE 'America/Sao_Paulo')::date) THEN 'vencendo_hoje' ELSE 'pendente' END) THEN
     RAISE EXCEPTION 'Parcelas iniciais divergentes' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF i<>n OR (SELECT sum(valor_original) FROM public.parcelas WHERE contrato_id=p_contrato)<>total
   OR (SELECT sum(valor_juros) FROM public.parcelas WHERE contrato_id=p_contrato)<>juros THEN RAISE EXCEPTION 'Somas divergentes' USING ERRCODE='23514'; END IF;
 ids:=(SELECT jsonb_agg(id ORDER BY numero,id) FROM public.parcelas WHERE contrato_id=p_contrato);
 IF op.resultado IS DISTINCT FROM jsonb_build_object('success',true,'repetida',false,'id',p_contrato,'operationId',op.id,
   'parcelasIds',ids,'transacaoCaixaId',o.transacao_caixa_id::text,'valorParcela',ref::numeric(15,2)::text,
   'totalContrato',total::numeric(15,2)::text,'jurosTotal',juros::numeric(15,2)::text,'numeroParcelas',n,
   'dataDesembolso',c.data_inicio,'vencimentos',op.payload->'vencimentos','status','ativo','regra','mensal_simples_v1') THEN
   RAISE EXCEPTION 'Resultado de criação divergente' USING ERRCODE='23514'; END IF;
 IF jsonb_array_length(s->'ledger')<>1 OR jsonb_array_length(s->'historico')<>1 THEN RAISE EXCEPTION 'Trilha extra/ausente' USING ERRCODE='23514'; END IF;
 SELECT * INTO STRICT t FROM public.transacoes_caixa WHERE id=o.transacao_caixa_id;
 histid:=(op.auditoria->>'historicoId')::bigint;
 SELECT * INTO STRICT h FROM public.contrato_historico WHERE id=histid;
 IF t.user_id IS DISTINCT FROM p_user OR t.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id
   OR t.contrato_id IS DISTINCT FROM p_contrato OR t.parcela_id IS NOT NULL
   OR t.tipo IS DISTINCT FROM 'saida' OR t.categoria IS DISTINCT FROM 'emprestimo_liberado'
   OR t.valor IS DISTINCT FROM c.valor_principal OR t.data_transacao IS DISTINCT FROM c.data_inicio
   OR t.descricao IS DISTINCT FROM 'Empréstimo RPC - Contrato #'||p_contrato::text
   OR t."createdAt" IS DISTINCT FROM op.created_at OR o.created_at IS DISTINCT FROM op.created_at
   OR h.contrato_id IS DISTINCT FROM p_contrato OR h.user_id IS DISTINCT FROM p_user::text
   OR h.tipo IS DISTINCT FROM 'criacao' OR h.valor_novo IS DISTINCT FROM total OR h.valor_anterior IS NOT NULL
   OR h.descricao IS DISTINCT FROM 'Criação atômica mensal_simples_v1' OR h.created_at IS DISTINCT FROM op.created_at THEN
   RAISE EXCEPTION 'Débito/histórico de criação divergente' USING ERRCODE='23514'; END IF;
 RETURN s;
END;
$$;

-- Regra única e testável: atraso apenas após virar dia civil em Brasília.
-- Mora simples sobre valor original (juros contratuais JÁ embutidos), multa uma vez.
-- No primeiro parcial encargos ficam fixados; residual não recebe nova multa/mora.
CREATE FUNCTION public.ciclo_encargos(p_original numeric,p_multa numeric,p_mora numeric,p_vencimento date,p_instante timestamptz) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('dias',greatest(0,(p_instante AT TIME ZONE 'America/Sao_Paulo')::date-p_vencimento),
 'multa',CASE WHEN (p_instante AT TIME ZONE 'America/Sao_Paulo')::date>p_vencimento THEN round(p_original*p_multa/100,2) ELSE 0 END,
 'mora',round(p_original*p_mora/100*greatest(0,(p_instante AT TIME ZONE 'America/Sao_Paulo')::date-p_vencimento),2));
$$;

CREATE FUNCTION public.ciclo_cotacao(p_user integer,p_contrato integer,p_parcela integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; s jsonb; enc jsonb;
 multa numeric; mora numeric; devido numeric; hoje date:=(statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 s:=public.ciclo_validar(p_user,p_contrato);
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato;
 SELECT * INTO p FROM public.parcelas WHERE id=p_parcela AND contrato_id=p_contrato;
 IF NOT FOUND OR p.user_id IS DISTINCT FROM p_user THEN RAISE EXCEPTION 'Parcela indisponível' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=p_user)
   OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=c.conta_caixa_id AND user_id=p_user AND ativo=true)
   OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=p_user AND ativo=true))
   OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE conta_caixa_id=c.conta_caixa_id AND user_id IS DISTINCT FROM p_user) THEN
   RAISE EXCEPTION 'Vínculos/conta indisponíveis' USING ERRCODE='42501'; END IF;
 IF c.status NOT IN('ativo','quitado') THEN RAISE EXCEPTION 'Contrato não elegível' USING ERRCODE='23514'; END IF;
 IF p.status='parcial' THEN
   multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=p.saldo_residual;
   IF devido<=0 OR p.valor_pago<=0 OR p.valor_original+multa+mora-p.valor_pago<>devido OR p.valor_desconto<>0 THEN RAISE EXCEPTION 'Residual inconsistente' USING ERRCODE='23514'; END IF;
 ELSIF p.status='paga' THEN multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=0;
 ELSIF p.status IN('pendente','atrasada','vencendo_hoje') AND p.valor_pago=0 THEN
   enc:=public.ciclo_encargos(p.valor_original,c.multa_atraso,c.juros_mora_diario,p.data_vencimento,statement_timestamp());
   multa:=(enc->>'multa')::numeric; mora:=(enc->>'mora')::numeric; devido:=p.valor_original+multa+mora;
 ELSE RAISE EXCEPTION 'Estado de parcela não elegível' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('elegivel',devido>0,'contratoId',p_contrato,'parcelaId',p_parcela,'contaCaixaId',c.conta_caixa_id,
   'totalExigido',devido::numeric(15,2)::text,'multa',multa::numeric(15,2)::text,'mora',mora::numeric(15,2)::text,
   'jurosEmbutidos',p.valor_juros::numeric(15,2)::text,'valorPagoAcumulado',p.valor_pago::numeric(15,2)::text,
   'dataPagamento',hoje,'vencimento',p.data_vencimento,'status',p.status,
   'estadoHash',encode(extensions.digest(s::text,'sha256'),'hex'),'regra','recebimento_defaults_brt_v1');
END;
$$;
CREATE FUNCTION public.rpc_cotar_emprestimo_prospectivo(p_user_id integer,p_contrato_id integer,p_parcela_id integer) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT public.ciclo_cotacao(p_user_id,p_contrato_id,p_parcela_id);
$$;

CREATE FUNCTION public.rpc_receber_emprestimo_prospectivo(
 p_user_id integer,p_chave_idempotencia uuid,p_contrato_id integer,p_parcela_id integer,
 p_valor_recebido numeric,p_total_exigido numeric,p_data_pagamento date,p_estado_hash text,p_modo text,p_observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v_payload jsonb; hash text; op public.ciclo_operacoes%ROWTYPE; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE;
 s jsonb; depois jsonb; q jsonb; conta integer; cx integer; hi bigint; residual numeric; pago numeric; v_resultado jsonb;
BEGIN
 IF p_user_id IS NULL OR p_user_id<=0 OR p_chave_idempotencia IS NULL OR p_contrato_id IS NULL OR p_contrato_id<=0 OR p_parcela_id IS NULL OR p_parcela_id<=0
   OR p_valor_recebido IS NULL OR p_valor_recebido::text IN('NaN','Infinity','-Infinity') OR p_valor_recebido<=0 OR p_valor_recebido<>round(p_valor_recebido,2) OR p_valor_recebido>9999999999.99
   OR p_total_exigido IS NULL OR p_total_exigido::text IN('NaN','Infinity','-Infinity') OR p_total_exigido<=0 OR p_total_exigido<>round(p_total_exigido,2) OR p_total_exigido>9999999999.99
   OR p_estado_hash IS NULL OR p_estado_hash !~ '^[0-9a-f]{64}$' OR p_modo IS NULL OR p_modo NOT IN('integral','parcial')
   OR p_data_pagamento IS NULL OR NOT isfinite(p_data_pagamento) OR length(p_observacoes)>1000 THEN
   RAISE EXCEPTION 'Intenção inválida: centavos, UUID, modo, estado e DATE obrigatórios' USING ERRCODE='22023'; END IF;
 v_payload:=jsonb_build_object('userId',p_user_id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,
   'valorRecebido',p_valor_recebido::numeric(15,2)::text,'totalExigido',p_total_exigido::numeric(15,2)::text,
   'dataPagamento',p_data_pagamento,'estadoHash',p_estado_hash,'modo',p_modo,'observacoes',nullif(btrim(p_observacoes),''),'regra','recebimento_defaults_brt_v1');
 hash:=encode(extensions.digest(v_payload::text,'sha256'),'hex');
 -- Sem origem não há reserva, FK não serve como prova de tenant.
 IF NOT EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=p_contrato_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'Origem 0021 indisponível' USING ERRCODE='42501'; END IF;
 INSERT INTO public.ciclo_operacoes(user_id,chave_idempotencia,hash_payload,contrato_id,parcela_id,payload)
 VALUES(p_user_id,p_chave_idempotencia,hash,p_contrato_id,p_parcela_id,v_payload) ON CONFLICT(user_id,chave_idempotencia) DO NOTHING;
 SELECT * INTO STRICT op FROM public.ciclo_operacoes WHERE user_id=p_user_id AND chave_idempotencia=p_chave_idempotencia FOR UPDATE;
 IF op.hash_payload<>hash THEN RAISE EXCEPTION 'UUID reutilizado com intenção divergente' USING ERRCODE='23505'; END IF;
 IF op.resultado IS NOT NULL THEN RETURN op.resultado||jsonb_build_object('repetida',true); END IF;
 SELECT conta_caixa_id INTO conta FROM public.contratos WHERE id=p_contrato_id;
 -- Ordem global: operação -> lock ledger/conta -> conta -> cliente -> koletor -> contrato -> parcelas IDs.
 PERFORM pg_advisory_xact_lock(22022,conta);
 PERFORM 1 FROM public.contas_caixa WHERE id=conta FOR UPDATE;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato_id;
 PERFORM 1 FROM public.clientes WHERE id=c.cliente_id FOR UPDATE;
 PERFORM 1 FROM public.koletores WHERE id=c.koletor_id FOR UPDATE;
 -- NO KEY UPDATE é exclusivo entre writers, mas compatível com KEY SHARE das FKs
 -- das reservas concorrentes. FOR UPDATE criaria upgrade deadlock antes da cotação.
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato_id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.parcelas WHERE contrato_id=p_contrato_id ORDER BY id FOR NO KEY UPDATE;
 PERFORM 1 FROM public.transacoes_caixa WHERE conta_caixa_id=conta OR contrato_id=p_contrato_id OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=p_contrato_id) ORDER BY id FOR UPDATE;
 s:=public.ciclo_validar(p_user_id,p_contrato_id); q:=public.ciclo_cotacao(p_user_id,p_contrato_id,p_parcela_id);
 IF c.conta_caixa_id IS DISTINCT FROM conta OR q->>'estadoHash' IS DISTINCT FROM p_estado_hash OR (q->>'totalExigido')::numeric IS DISTINCT FROM p_total_exigido
   OR (q->>'dataPagamento')::date IS DISTINCT FROM p_data_pagamento OR q->'elegivel' IS DISTINCT FROM 'true'::jsonb THEN
   RAISE EXCEPTION 'Cotação/estado/data divergente; conferir antes de nova intenção' USING ERRCODE='40001'; END IF;
 IF (p_modo='integral' AND p_valor_recebido<>p_total_exigido) OR (p_modo='parcial' AND p_valor_recebido>=p_total_exigido) THEN
   RAISE EXCEPTION 'Integral exige valor exato; parcial positivo menor, sem desconto' USING ERRCODE='22023'; END IF;
 SELECT * INTO STRICT p FROM public.parcelas WHERE id=p_parcela_id;
 residual:=p_total_exigido-p_valor_recebido; pago:=p.valor_pago+p_valor_recebido;
 INSERT INTO public.ciclo_estados(contrato_id,user_id,snapshot,origem_completa) VALUES(p_contrato_id,p_user_id,s,false) ON CONFLICT(contrato_id) DO NOTHING;
 PERFORM public.ciclo_autorizar('receber',conta,p_contrato_id);
 UPDATE public.parcelas SET valor_pago=pago,valor_multa=(q->>'multa')::numeric,multa_diaria_usada=(q->>'mora')::numeric,
   valor_desconto=0,saldo_residual=residual,data_pagamento=p_data_pagamento,status=CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,"updatedAt"=clock_timestamp()
 WHERE id=p_parcela_id;
 INSERT INTO public.transacoes_caixa(user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor,descricao,data_transacao)
 VALUES(p_user_id,conta,p_contrato_id,p_parcela_id,'entrada','pagamento_parcela',p_valor_recebido,'Recebimento prospectivo '||op.id::text,p_data_pagamento) RETURNING id INTO cx;
 INSERT INTO public.ciclo_pernas(operacao_id,user_id,transacao_id,snapshot) VALUES(op.id,p_user_id,cx,(SELECT to_jsonb(t) FROM public.transacoes_caixa t WHERE id=cx));
 UPDATE public.contratos SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=p_contrato_id AND status IS DISTINCT FROM 'paga') THEN 'quitado' ELSE 'ativo' END,"updatedAt"=clock_timestamp() WHERE id=p_contrato_id;
 INSERT INTO public.contrato_historico(user_id,contrato_id,tipo,descricao,valor_anterior,valor_novo)
 VALUES(p_user_id::text,p_contrato_id,'pagamento','Recebimento prospectivo '||op.id::text,p.valor_pago,pago) RETURNING id INTO hi;
 depois:=public.ciclo_snapshot(p_contrato_id);
 UPDATE public.ciclo_estados SET snapshot=depois WHERE contrato_id=p_contrato_id;
 v_resultado:=jsonb_build_object('success',true,'repetida',false,'operationId',op.id,'contratoId',p_contrato_id,'parcelaId',p_parcela_id,
  'transacaoCaixaId',cx::text,'contaCaixaId',conta,'valorRecebido',p_valor_recebido::numeric(15,2)::text,
  'totalExigido',p_total_exigido::numeric(15,2)::text,'saldoResidual',residual::numeric(15,2)::text,'valorPagoAcumulado',pago::numeric(15,2)::text,
  'status',CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'contratoStatus',(SELECT status FROM public.contratos WHERE id=p_contrato_id),
  'dataPagamento',p_data_pagamento,'regra','recebimento_defaults_brt_v1');
 UPDATE public.ciclo_operacoes SET resultado=v_resultado,concluida_em=clock_timestamp(),auditoria=jsonb_build_object('hashPayload',hash,'payload',v_payload,'antes',s,'depois',depois,'cotacao',q,'pernaId',cx::text,'historicoId',hi::text,'resultado',v_resultado) WHERE id=op.id;
 DELETE FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid();
 RETURN v_resultado;
END;
$$;

-- Guardas efetivas no banco: service_role não pode contornar via REST/GUC.
-- Não escrevem nenhuma linha legada. Ledger de conta com cohort é append-only via RPC.
CREATE FUNCTION public.ciclo_guardar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE oldj jsonb; newj jsonb; cid integer; aid integer; protegido boolean; autorizado boolean;
BEGIN
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
CREATE TRIGGER ciclo_conta BEFORE UPDATE OR DELETE ON public.contas_caixa FOR EACH ROW EXECUTE FUNCTION public.ciclo_guardar();
CREATE TRIGGER ciclo_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.transacoes_caixa FOR EACH ROW EXECUTE FUNCTION public.ciclo_guardar();
CREATE TRIGGER ciclo_contrato BEFORE UPDATE OR DELETE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.ciclo_guardar();
CREATE TRIGGER ciclo_parcela BEFORE INSERT OR UPDATE OR DELETE ON public.parcelas FOR EACH ROW EXECUTE FUNCTION public.ciclo_guardar();
CREATE TRIGGER ciclo_historico BEFORE INSERT OR UPDATE OR DELETE ON public.contrato_historico FOR EACH ROW EXECUTE FUNCTION public.ciclo_guardar();

CREATE FUNCTION public.ciclo_finalizar_criacao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid integer; s jsonb;
BEGIN
 IF OLD.resultado IS NOT NULL THEN RAISE EXCEPTION 'Proveniência concluída imutável' USING ERRCODE='42501'; END IF;
 IF NEW.resultado IS NOT NULL THEN
   cid:=(NEW.resultado->>'id')::int; s:=public.ciclo_validar(NEW.user_id,cid);
   INSERT INTO public.ciclo_estados(contrato_id,user_id,snapshot,origem_completa) VALUES(cid,NEW.user_id,s,true);
   DELETE FROM public.ciclo_autorizacoes WHERE xid=txid_current() AND pid=pg_backend_pid();
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER ciclo_criacao_snapshot AFTER UPDATE ON public.emprestimos_rpc_operacoes FOR EACH ROW EXECUTE FUNCTION public.ciclo_finalizar_criacao();
CREATE FUNCTION public.ciclo_imutavel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Proveniência/perna imutável' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER ciclo_origem_imutavel BEFORE UPDATE OR DELETE ON public.emprestimos_rpc_origens FOR EACH ROW EXECUTE FUNCTION public.ciclo_imutavel();
CREATE TRIGGER ciclo_perna_imutavel BEFORE UPDATE OR DELETE ON public.ciclo_pernas FOR EACH ROW EXECUTE FUNCTION public.ciclo_imutavel();

REVOKE ALL ON FUNCTION public.ciclo_autorizar(text,integer,integer),public.ciclo_snapshot(integer),public.ciclo_validar(integer,integer),public.ciclo_encargos(numeric,numeric,numeric,date,timestamptz),public.ciclo_cotacao(integer,integer,integer),public.ciclo_guardar(),public.ciclo_finalizar_criacao(),public.ciclo_imutavel() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_cotar_emprestimo_prospectivo(integer,integer,integer),public.rpc_receber_emprestimo_prospectivo(integer,uuid,integer,integer,numeric,numeric,date,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cotar_emprestimo_prospectivo(integer,integer,integer),public.rpc_receber_emprestimo_prospectivo(integer,uuid,integer,integer,numeric,numeric,date,text,text,text) TO service_role;
COMMIT;
