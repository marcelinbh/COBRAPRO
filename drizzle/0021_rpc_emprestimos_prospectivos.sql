-- Somente criação NOVA. Não instala/enfraquece 0013/0015, não saneia legado.
-- Regra mensal simples comprovada: shared/finance.ts calcularParcelaPadrao.
-- Agenda explícita; N>1 exige mesmo dia 1..28 em meses consecutivos.
-- Juros embutidos, não mora adicional. Nenhuma função de recebimento/renovação.
BEGIN;

CREATE TABLE public.emprestimos_rpc_operacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id),
  chave_idempotencia UUID NOT NULL,
  hash_payload TEXT NOT NULL CHECK (hash_payload ~ '^[0-9a-f]{64}$'),
  payload JSONB NOT NULL,
  resultado JSONB,
  auditoria JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em TIMESTAMPTZ,
  UNIQUE (user_id, chave_idempotencia),
  UNIQUE (user_id, id),
  CHECK ((resultado IS NULL AND concluida_em IS NULL AND auditoria IS NULL)
      OR (resultado IS NOT NULL AND concluida_em IS NOT NULL AND auditoria IS NOT NULL))
);
CREATE TABLE public.emprestimos_rpc_origens (
  contrato_id INTEGER PRIMARY KEY REFERENCES public.contratos(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES public.users(id),
  operacao_id UUID NOT NULL UNIQUE,
  transacao_caixa_id INTEGER NOT NULL UNIQUE REFERENCES public.transacoes_caixa(id) ON DELETE RESTRICT,
  regra TEXT NOT NULL CHECK (regra = 'mensal_simples_v1'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, operacao_id) REFERENCES public.emprestimos_rpc_operacoes(user_id, id)
);
ALTER TABLE public.emprestimos_rpc_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emprestimos_rpc_origens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.emprestimos_rpc_operacoes, public.emprestimos_rpc_origens FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.rpc_criar_emprestimo(
  p_user_id INTEGER,
  p_chave_idempotencia UUID,
  p_cliente_id INTEGER,
  p_conta_caixa_id INTEGER,
  p_modalidade TEXT,
  p_tipo_taxa TEXT,
  p_valor_principal NUMERIC,
  p_taxa_juros NUMERIC,
  p_numero_parcelas INTEGER,
  p_data_inicio DATE,
  p_data_desembolso DATE,
  p_vencimentos DATE[],
  p_descricao TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_payload JSONB;
  v_hash TEXT;
  v_op public.emprestimos_rpc_operacoes%ROWTYPE;
  v_conta public.contas_caixa%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_koletor public.koletores%ROWTYPE;
  v_koletor_id INTEGER;
  v_koletor_count INTEGER := 0;
  v_contrato INTEGER;
  v_parcela INTEGER;
  v_caixa INTEGER;
  v_historico public.contrato_historico.id%TYPE;
  v_ids INTEGER[] := '{}';
  v_juros NUMERIC;
  v_total NUMERIC;
  v_referencia NUMERIC;
  v_juros_ref NUMERIC;
  v_valor NUMERIC;
  v_juros_linha NUMERIC;
  v_soma NUMERIC := 0;
  v_soma_juros NUMERIC := 0;
  v_hoje DATE := (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_status public.parcelas.status%TYPE;
  v_resultado JSONB;
  v_i INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 OR p_chave_idempotencia IS NULL
     OR p_cliente_id IS NULL OR p_cliente_id <= 0 OR p_conta_caixa_id IS NULL OR p_conta_caixa_id <= 0
     OR p_modalidade IS DISTINCT FROM 'mensal' OR p_tipo_taxa IS DISTINCT FROM 'mensal'
     OR p_numero_parcelas IS NULL OR p_numero_parcelas NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Apenas mensal simples, tipo mensal, N 1..60 e UUID obrigatório' USING ERRCODE = '22023';
  END IF;
  -- NUMERIC(5,2) real em contratos.taxa_juros: não aceitar quatro casas e truncar silenciosamente.
  IF p_valor_principal IS NULL OR p_valor_principal::text IN ('NaN','Infinity','-Infinity')
     OR p_valor_principal <= 0 OR p_valor_principal > 9999999999999.99
     OR p_valor_principal <> round(p_valor_principal, 2)
     OR p_taxa_juros IS NULL OR p_taxa_juros::text IN ('NaN','Infinity','-Infinity')
     OR p_taxa_juros < 0 OR p_taxa_juros > 999.99 OR p_taxa_juros <> round(p_taxa_juros, 2) THEN
    RAISE EXCEPTION 'Principal/taxa fora da precisão ou faixa' USING ERRCODE = '22023';
  END IF;
  IF p_data_inicio IS NULL OR NOT isfinite(p_data_inicio) OR p_data_inicio < DATE '1900-01-01'
     OR p_data_inicio > DATE '9999-12-31' OR p_data_desembolso IS DISTINCT FROM p_data_inicio
     OR p_vencimentos IS NULL OR array_ndims(p_vencimentos) IS DISTINCT FROM 1
     OR array_lower(p_vencimentos, 1) IS DISTINCT FROM 1 OR cardinality(p_vencimentos) <> p_numero_parcelas THEN
    RAISE EXCEPTION 'Agenda explícita e desembolso na data de início são obrigatórios' USING ERRCODE = '22023';
  END IF;
  FOR v_i IN 1..p_numero_parcelas LOOP
    IF p_vencimentos[v_i] IS NULL OR NOT isfinite(p_vencimentos[v_i])
       OR p_vencimentos[v_i] < p_data_inicio OR p_vencimentos[v_i] > DATE '9999-12-31'
       OR (p_numero_parcelas > 1 AND extract(day FROM p_vencimentos[1]) > 28)
       OR p_vencimentos[v_i] <> (p_vencimentos[1] + make_interval(months => v_i - 1))::date THEN
      RAISE EXCEPTION 'Agenda mensal inválida; N>1 limitado a dias 1..28, sem clamp implícito' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF length(p_descricao) > 2000 OR length(p_observacoes) > 4000 THEN
    RAISE EXCEPTION 'Texto excede limite' USING ERRCODE = '22023';
  END IF;

  v_juros := round(p_valor_principal * p_taxa_juros / 100 * p_numero_parcelas, 2);
  v_total := p_valor_principal + v_juros;
  v_referencia := round(v_total / p_numero_parcelas, 2);
  v_juros_ref := round(v_juros / p_numero_parcelas, 2);
  -- Histórico real é NUMERIC(12,2), menor que cabeçalho/parcelas NUMERIC(15,2).
  IF v_total > 9999999999.99 THEN
    RAISE EXCEPTION 'Total excede NUMERIC(12,2) do histórico' USING ERRCODE = '22023';
  END IF;
  -- Cada soma fecha na última linha; rejeitar qualquer amortização negativa/zero parcela.
  FOR v_i IN 1..p_numero_parcelas LOOP
    v_valor := CASE WHEN v_i = p_numero_parcelas THEN v_total - v_referencia * (p_numero_parcelas - 1) ELSE v_referencia END;
    v_juros_linha := CASE WHEN v_i = p_numero_parcelas THEN v_juros - v_juros_ref * (p_numero_parcelas - 1) ELSE v_juros_ref END;
    IF v_valor <= 0 OR v_juros_linha < 0 OR v_juros_linha > v_valor THEN
      RAISE EXCEPTION 'Principal insuficiente para rateio positivo e conservativo' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  v_payload := jsonb_build_object(
    'regra', 'mensal_simples_v1', 'userId', p_user_id, 'clienteId', p_cliente_id,
    'contaCaixaId', p_conta_caixa_id, 'modalidade', p_modalidade, 'tipoTaxa', p_tipo_taxa,
    'valorPrincipal', p_valor_principal::numeric(15,2)::text, 'taxaJuros', p_taxa_juros::numeric(5,2)::text,
    'numeroParcelas', p_numero_parcelas, 'dataInicio', p_data_inicio, 'dataDesembolso', p_data_desembolso,
    'vencimentos', to_jsonb(p_vencimentos), 'descricao', nullif(btrim(p_descricao), ''),
    'observacoes', nullif(btrim(p_observacoes), ''), 'encargos', 'defaults_catalogo');
  v_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');
  INSERT INTO public.emprestimos_rpc_operacoes(user_id, chave_idempotencia, hash_payload, payload)
    VALUES (p_user_id, p_chave_idempotencia, v_hash, v_payload)
    ON CONFLICT (user_id, chave_idempotencia) DO NOTHING;
  SELECT o.* INTO STRICT v_op FROM public.emprestimos_rpc_operacoes o
    WHERE o.user_id = p_user_id AND o.chave_idempotencia = p_chave_idempotencia FOR UPDATE;
  IF v_op.hash_payload <> v_hash THEN
    RAISE EXCEPTION 'Chave de idempotência reutilizada com payload divergente' USING ERRCODE = '23505';
  END IF;
  IF v_op.resultado IS NOT NULL THEN
    RETURN v_op.resultado || jsonb_build_object('repetida', true);
  END IF;

  -- Ordem para escritores futuros: operação -> conta -> cliente -> koletor.
  SELECT c.* INTO v_conta FROM public.contas_caixa c WHERE c.id = p_conta_caixa_id FOR UPDATE;
  IF NOT FOUND OR v_conta.user_id IS DISTINCT FROM p_user_id OR v_conta.ativo IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Conta inválida para o tenant' USING ERRCODE = '42501';
  END IF;
  -- Examina TODOS os lançamentos da conta, inclusive owner NULL/externo; saldo-base nunca é reescrito.
  IF EXISTS (SELECT 1 FROM public.transacoes_caixa t WHERE t.conta_caixa_id = p_conta_caixa_id AND t.user_id IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'Conta com lançamento de owner divergente exige revisão' USING ERRCODE = '23514';
  END IF;
  SELECT c.* INTO v_cliente FROM public.clientes c WHERE c.id = p_cliente_id FOR UPDATE;
  IF NOT FOUND OR v_cliente.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cliente inválido para o tenant' USING ERRCODE = '42501';
  END IF;
  -- Derivado, nunca aceito do navegador. Ambiguidade/inatividade não equivalem a ausência.
  FOR v_koletor IN SELECT k.* FROM public.koletores k WHERE k.user_id = p_user_id ORDER BY k.id FOR UPDATE LOOP
    v_koletor_count := v_koletor_count + 1;
    IF v_koletor.ativo IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Koletor inativo' USING ERRCODE = '42501';
    END IF;
    v_koletor_id := v_koletor.id;
  END LOOP;
  IF v_koletor_count > 1 THEN
    RAISE EXCEPTION 'Koletor ambíguo' USING ERRCODE = '23514';
  END IF;

  -- Omitir multa_atraso/juros_mora_diario preserva os defaults reais, sem inventar zeros.
  INSERT INTO public.contratos(user_id, cliente_id, koletor_id, modalidade, tipo_taxa,
    valor_principal, taxa_juros, num_parcelas, numero_parcelas, valor_parcela, total_contrato,
    data_inicio, data_vencimento_primeira, data_vencimento, dia_vencimento, conta_caixa_id,
    descricao, observacoes, status)
  VALUES(p_user_id, p_cliente_id, v_koletor_id, 'mensal', 'mensal', p_valor_principal, p_taxa_juros,
    p_numero_parcelas, p_numero_parcelas, v_referencia, v_total, p_data_inicio, p_vencimentos[1],
    p_vencimentos[p_numero_parcelas], extract(day FROM p_vencimentos[1])::integer, p_conta_caixa_id,
    v_payload->>'descricao', v_payload->>'observacoes', 'ativo') RETURNING id INTO v_contrato;

  FOR v_i IN 1..p_numero_parcelas LOOP
    v_valor := CASE WHEN v_i = p_numero_parcelas THEN v_total - v_referencia * (p_numero_parcelas - 1) ELSE v_referencia END;
    v_juros_linha := CASE WHEN v_i = p_numero_parcelas THEN v_juros - v_juros_ref * (p_numero_parcelas - 1) ELSE v_juros_ref END;
    v_status := CASE WHEN p_vencimentos[v_i] < v_hoje THEN 'atrasada' WHEN p_vencimentos[v_i] = v_hoje THEN 'vencendo_hoje' ELSE 'pendente' END;
    INSERT INTO public.parcelas(user_id, contrato_id, cliente_id, koletor_id, numero, numero_parcela,
      valor, valor_original, valor_juros, valor_pago, valor_multa, valor_desconto, saldo_residual,
      data_vencimento, data_pagamento, status, conta_caixa_id)
    VALUES(p_user_id, v_contrato, p_cliente_id, v_koletor_id, v_i, v_i, v_valor, v_valor, v_juros_linha,
      0, 0, 0, 0, p_vencimentos[v_i], NULL, v_status, p_conta_caixa_id) RETURNING id INTO v_parcela;
    v_ids := array_append(v_ids, v_parcela);
  END LOOP;
  SELECT sum(p.valor_original), sum(p.valor_juros) INTO v_soma, v_soma_juros
    FROM public.parcelas p WHERE p.contrato_id = v_contrato;
  IF v_soma <> v_total OR v_soma_juros <> v_juros
     OR (SELECT count(*) FROM public.parcelas p WHERE p.contrato_id = v_contrato) <> p_numero_parcelas THEN
    RAISE EXCEPTION 'Invariante de parcelas violada' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.transacoes_caixa(user_id, conta_caixa_id, contrato_id, parcela_id, tipo, categoria, valor, descricao, data_transacao)
    VALUES(p_user_id, p_conta_caixa_id, v_contrato, NULL, 'saida', 'emprestimo_liberado', p_valor_principal,
      'Empréstimo RPC - Contrato #' || v_contrato::text, p_data_desembolso) RETURNING id INTO v_caixa;
  INSERT INTO public.contrato_historico(user_id, contrato_id, tipo, descricao, valor_novo)
    VALUES(p_user_id::text, v_contrato, 'criacao', 'Criação atômica mensal_simples_v1', v_total) RETURNING id INTO v_historico;
  INSERT INTO public.emprestimos_rpc_origens(contrato_id, user_id, operacao_id, transacao_caixa_id, regra)
    VALUES(v_contrato, p_user_id, v_op.id, v_caixa, 'mensal_simples_v1');

  v_resultado := jsonb_build_object('success', true, 'repetida', false, 'id', v_contrato,
    'operationId', v_op.id, 'parcelasIds', to_jsonb(v_ids), 'transacaoCaixaId', v_caixa::text,
    'valorParcela', v_referencia::numeric(15,2)::text, 'totalContrato', v_total::numeric(15,2)::text,
    'jurosTotal', v_juros::numeric(15,2)::text, 'numeroParcelas', p_numero_parcelas,
    'dataDesembolso', p_data_desembolso, 'vencimentos', to_jsonb(p_vencimentos), 'status', 'ativo', 'regra', 'mensal_simples_v1');
  UPDATE public.emprestimos_rpc_operacoes SET resultado = v_resultado, concluida_em = clock_timestamp(),
    auditoria = jsonb_build_object('acao', 'criacao_emprestimo', 'hashPayload', v_hash, 'payload', v_payload,
      'resultado', v_resultado, 'historicoId', v_historico::text, 'jurosEmbutidos', true,
      'contrato', (SELECT to_jsonb(c) FROM public.contratos c WHERE c.id = v_contrato),
      'parcelas', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.numero) FROM public.parcelas p WHERE p.contrato_id = v_contrato))
    WHERE id = v_op.id;
  RETURN v_resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_criar_emprestimo(INTEGER, UUID, INTEGER, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, DATE, DATE, DATE[], TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_criar_emprestimo(INTEGER, UUID, INTEGER, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, DATE, DATE, DATE[], TEXT, TEXT) TO service_role;
COMMENT ON FUNCTION public.rpc_criar_emprestimo(INTEGER, UUID, INTEGER, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, DATE, DATE, DATE[], TEXT, TEXT) IS 'Somente criação prospectiva mensal simples; recebimento/renovação continuam indisponíveis; 0013/0015 não dispensadas.';
COMMIT;
