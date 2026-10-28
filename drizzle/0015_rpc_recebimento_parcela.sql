-- CobraPro: recebimento de parcela atômico no PostgreSQL.
-- NÃO executar sem antes rodar reports/preflight-rpcs-financeiras.sql
-- no projeto COBRA PRO (oxvtmibrgjruldkouhhb) e sanear todas as divergências.
-- Esta migration é aditiva; falha fechada se o schema necessário estiver ausente.

DO $$
DECLARE
  tabela TEXT;
  coluna TEXT;
  requisito RECORD;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'parcelas', 'contratos', 'contas_caixa', 'transacoes_caixa',
    'operacoes_financeiras', 'auditoria_financeira', 'contrato_historico',
    'configuracoes'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tabela AND c.relkind IN ('r', 'p')
    ) THEN
      RAISE EXCEPTION 'RPC não instalada: tabela física public.% ausente.', tabela;
    END IF;
  END LOOP;

  FOR requisito IN
    SELECT * FROM (VALUES
      ('parcelas','id'), ('parcelas','user_id'), ('parcelas','contrato_id'), ('parcelas','cliente_id'),
      ('parcelas','numero_parcela'), ('parcelas','valor_original'), ('parcelas','valor_pago'),
      ('parcelas','valor_juros'), ('parcelas','valor_multa'), ('parcelas','valor_desconto'),
      ('parcelas','saldo_residual'), ('parcelas','multa_diaria_usada'), ('parcelas','data_vencimento'),
      ('parcelas','data_pagamento'), ('parcelas','status'), ('parcelas','conta_caixa_id'), ('parcelas','observacoes'),
      ('contratos','id'), ('contratos','user_id'), ('contratos','status'),
      ('contas_caixa','id'), ('contas_caixa','user_id'), ('contas_caixa','ativo'),
      ('transacoes_caixa','id'), ('transacoes_caixa','user_id'), ('transacoes_caixa','conta_caixa_id'),
      ('transacoes_caixa','tipo'), ('transacoes_caixa','categoria'), ('transacoes_caixa','valor'),
      ('transacoes_caixa','descricao'), ('transacoes_caixa','parcela_id'), ('transacoes_caixa','contrato_id'),
      ('transacoes_caixa','cliente_id'), ('transacoes_caixa','data_transacao'),
      ('operacoes_financeiras','id'), ('operacoes_financeiras','user_id'), ('operacoes_financeiras','tipo'),
      ('operacoes_financeiras','chave_idempotencia'), ('operacoes_financeiras','hash_requisicao'),
      ('operacoes_financeiras','status'), ('operacoes_financeiras','resultado'), ('operacoes_financeiras','concluida_em'),
      ('auditoria_financeira','id'), ('auditoria_financeira','user_id'), ('auditoria_financeira','operacao_id'),
      ('auditoria_financeira','acao'), ('auditoria_financeira','entidade'), ('auditoria_financeira','entidade_id'), ('auditoria_financeira','detalhes'),
      ('contrato_historico','user_id'), ('contrato_historico','contrato_id'), ('contrato_historico','tipo'),
      ('contrato_historico','descricao'), ('contrato_historico','valor_novo'),
      ('configuracoes','user_id'), ('configuracoes','chave'), ('configuracoes','valor')
    ) AS requisitos(tabela, coluna)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = requisito.tabela AND column_name = requisito.coluna
    ) THEN
      RAISE EXCEPTION 'RPC não instalada: coluna %.% ausente.', requisito.tabela, requisito.coluna;
    END IF;
  END LOOP;

  IF to_regtype('public.status_parcela') IS NULL OR to_regtype('public.status_contrato') IS NULL THEN
    RAISE EXCEPTION 'RPC não instalada: enums de status ausentes.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE EXCEPTION 'RPC não instalada: extensão pgcrypto ausente.';
  END IF;
END $$;

-- Vínculo imutável entre a operação idempotente e seu lançamento de Caixa.
ALTER TABLE public.transacoes_caixa
  ADD COLUMN IF NOT EXISTS operacao_financeira_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transacoes_caixa_operacao_financeira_fk'
      AND conrelid = 'public.transacoes_caixa'::regclass
  ) THEN
    ALTER TABLE public.transacoes_caixa
      ADD CONSTRAINT transacoes_caixa_operacao_financeira_fk
      FOREIGN KEY (operacao_financeira_id)
      REFERENCES public.operacoes_financeiras(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.transacoes_caixa'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.operacoes_financeiras'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.transacoes_caixa'::regclass AND attname = 'operacao_financeira_id' AND NOT attisdropped)]::smallint[]
  ) THEN
    RAISE EXCEPTION 'RPC não instalada: FK de transacoes_caixa para operacoes_financeiras inválida.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS transacoes_caixa_operacao_financeira_uk
  ON public.transacoes_caixa (operacao_financeira_id)
  WHERE operacao_financeira_id IS NOT NULL;

-- ON CONFLICT da RPC depende desta unicidade; se houver duplicidade legada,
-- a criação do índice falha e impede um rollout parcialmente seguro.
CREATE UNIQUE INDEX IF NOT EXISTS operacoes_financeiras_user_chave_uk
  ON public.operacoes_financeiras (user_id, chave_idempotencia);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.operacoes_financeiras'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND i.indkey::smallint[] = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.operacoes_financeiras'::regclass AND attname = 'user_id' AND NOT attisdropped),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.operacoes_financeiras'::regclass AND attname = 'chave_idempotencia' AND NOT attisdropped)
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'RPC não instalada: unicidade (user_id, chave_idempotencia) ausente em operacoes_financeiras.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_registrar_pagamento_parcela(
  p_user_id INTEGER,
  p_parcela_id INTEGER,
  p_conta_caixa_id INTEGER,
  p_valor_pago NUMERIC,
  p_desconto NUMERIC,
  p_valor_juros_custom NUMERIC,
  p_data_pagamento DATE,
  p_observacoes TEXT,
  p_chave_idempotencia UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parcela public.parcelas%ROWTYPE;
  v_operacao public.operacoes_financeiras%ROWTYPE;
  v_operacao_criada UUID;
  v_hash TEXT;
  v_payload JSONB;
  v_config_automatico BOOLEAN := FALSE;
  v_multa_diaria NUMERIC(15,2) := 0;
  v_multa_percentual NUMERIC(15,4) := 0;
  v_config_diaria TEXT;
  v_config_percentual TEXT;
  v_contrato_status TEXT;
  v_config_duplicada BOOLEAN := FALSE;
  v_valor_total_devido NUMERIC(15,2);
  v_juros NUMERIC(15,2);
  v_multa NUMERIC(15,2);
  v_desconto NUMERIC(15,2);
  v_valor_total NUMERIC(15,2);
  v_saldo_residual NUMERIC(15,2);
  v_valor_pago_acumulado NUMERIC(15,2);
  v_status_novo TEXT;
  v_dias_atraso INTEGER := 0;
  v_hora_pagamento TIMESTAMPTZ;
  v_resultado JSONB;
  v_transacao_id BIGINT;
  v_valor_pago_normalizado NUMERIC(15,2);
  v_desconto_normalizado NUMERIC(15,2);
  v_juros_custom_normalizado NUMERIC(15,2);
  v_observacoes_normalizadas TEXT;
BEGIN
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'Usuário inválido para o recebimento' USING ERRCODE = '22023';
  END IF;
  IF p_parcela_id IS NULL OR p_parcela_id <= 0 OR p_conta_caixa_id IS NULL OR p_conta_caixa_id <= 0 THEN
    RAISE EXCEPTION 'Parcela e conta de Caixa são obrigatórias' USING ERRCODE = '22023';
  END IF;
  IF p_valor_pago IS NULL OR p_valor_pago <= 0 OR p_desconto IS NULL OR p_desconto < 0
      OR (p_valor_juros_custom IS NOT NULL AND p_valor_juros_custom < 0) THEN
    RAISE EXCEPTION 'Valores de recebimento inválidos' USING ERRCODE = '22023';
  END IF;
  IF p_data_pagamento IS NULL OR p_chave_idempotencia IS NULL THEN
    RAISE EXCEPTION 'Data comercial e chave idempotente são obrigatórias' USING ERRCODE = '22023';
  END IF;

  -- Um centavo nunca desaparece: rejeita entradas com precisão diferente de 2 casas.
  IF p_valor_pago <> round(p_valor_pago, 2)
      OR p_desconto <> round(p_desconto, 2)
      OR (p_valor_juros_custom IS NOT NULL AND p_valor_juros_custom <> round(p_valor_juros_custom, 2)) THEN
    RAISE EXCEPTION 'Valores monetários devem ter no máximo duas casas decimais' USING ERRCODE = '22023';
  END IF;
  v_valor_pago_normalizado := round(p_valor_pago, 2);
  v_desconto_normalizado := round(p_desconto, 2);
  v_juros_custom_normalizado := CASE WHEN p_valor_juros_custom IS NULL THEN NULL ELSE round(p_valor_juros_custom, 2) END;
  v_observacoes_normalizadas := nullif(btrim(p_observacoes), '');

  v_payload := jsonb_build_object(
    'parcelaId', p_parcela_id,
    'contaCaixaId', p_conta_caixa_id,
    'valorPago', v_valor_pago_normalizado,
    'desconto', v_desconto_normalizado,
    'valorJurosCustom', v_juros_custom_normalizado,
    'dataPagamento', p_data_pagamento,
    'observacoes', coalesce(v_observacoes_normalizadas, '')
  );
  v_hash := encode(digest(v_payload::text, 'sha256'), 'hex');

  INSERT INTO public.operacoes_financeiras (
    id, user_id, tipo, chave_idempotencia, hash_requisicao, status
  ) VALUES (
    gen_random_uuid(), p_user_id, 'recebimento_parcela', p_chave_idempotencia, v_hash, 'processando'
  ) ON CONFLICT (user_id, chave_idempotencia) DO NOTHING
  RETURNING id INTO v_operacao_criada;

  SELECT * INTO v_operacao
  FROM public.operacoes_financeiras
  WHERE user_id = p_user_id AND chave_idempotencia = p_chave_idempotencia
  FOR UPDATE;

  IF v_operacao.tipo <> 'recebimento_parcela' OR v_operacao.hash_requisicao <> v_hash THEN
    RAISE EXCEPTION 'A chave idempotente já foi usada para outro recebimento' USING ERRCODE = '23505';
  END IF;
  IF v_operacao_criada IS NULL THEN
    IF v_operacao.status = 'concluida' THEN
      RETURN coalesce(v_operacao.resultado, '{}'::jsonb) || jsonb_build_object('repetida', true);
    END IF;
    RAISE EXCEPTION 'Esta chave de operação já está em processamento ou requer revisão' USING ERRCODE = '40001';
  END IF;

  PERFORM 1
  FROM public.contas_caixa
  WHERE id = p_conta_caixa_id AND user_id = p_user_id AND coalesce(ativo, true) = true
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta de Caixa não encontrada ou inativa para esta empresa' USING ERRCODE = '42501';
  END IF;

  -- Trava a parcela e o contrato proprietário na mesma transação.
  SELECT p.*, c.status::text INTO v_parcela, v_contrato_status
  FROM public.parcelas p
  JOIN public.contratos c ON c.id = p.contrato_id AND c.user_id = p_user_id
  WHERE p.id = p_parcela_id AND p.user_id = p_user_id
  FOR UPDATE OF p, c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada para esta empresa' USING ERRCODE = '42501';
  END IF;
  IF v_contrato_status NOT IN ('ativo', 'inadimplente') THEN
    RAISE EXCEPTION 'Contrato não está elegível para recebimento' USING ERRCODE = '23514';
  END IF;
  IF v_parcela.status = 'paga' THEN
    RAISE EXCEPTION 'Esta parcela já foi quitada' USING ERRCODE = '23505';
  END IF;
  IF v_parcela.status NOT IN ('pendente', 'atrasada', 'vencendo_hoje', 'parcial') THEN
    RAISE EXCEPTION 'Esta parcela não pode receber baixa no estado atual' USING ERRCODE = '23514';
  END IF;

  IF v_parcela.status = 'parcial' AND (v_desconto_normalizado > 0 OR v_juros_custom_normalizado IS NOT NULL) THEN
    RAISE EXCEPTION 'Uma parcela parcial preserva os encargos já apurados; não informe novo desconto ou juros manual' USING ERRCODE = '22023';
  END IF;

  -- Leitura única e determinística da configuração usada neste lançamento.
  SELECT
    coalesce(max(valor) FILTER (WHERE chave IN ('jurosMultaAutomatico', 'juros_multa_automatico')), 'false') = 'true',
    coalesce(max(valor) FILTER (WHERE chave IN ('multaDiaria', 'multa_diaria')), '0'),
    coalesce(max(valor) FILTER (WHERE chave IN ('multaPadrao', 'multa_padrao')), '0'),
    count(*) FILTER (WHERE chave IN ('jurosMultaAutomatico', 'juros_multa_automatico', 'multaDiaria', 'multa_diaria', 'multaPadrao', 'multa_padrao')) > 3
  INTO v_config_automatico, v_config_diaria, v_config_percentual, v_config_duplicada
  FROM public.configuracoes
  WHERE user_id = p_user_id;

  IF v_config_duplicada THEN
    RAISE EXCEPTION 'Configurações financeiras duplicadas; revise as chaves antes de receber' USING ERRCODE = '23505';
  END IF;
  IF v_config_automatico THEN
    IF v_config_diaria !~ '^[0-9]+([.][0-9]+)?$' OR v_config_percentual !~ '^[0-9]+([.][0-9]+)?$' THEN
      RAISE EXCEPTION 'Configuração de multa automática inválida; corrija-a antes de receber' USING ERRCODE = '22023';
    END IF;
    v_multa_diaria := v_config_diaria::numeric;
    v_multa_percentual := v_config_percentual::numeric;
  END IF;

  IF v_parcela.status = 'parcial' AND coalesce(v_parcela.saldo_residual, 0) > 0 THEN
    -- O saldo remanescente já contém os encargos calculados na primeira baixa.
    v_valor_total_devido := round(v_parcela.saldo_residual, 2);
    v_juros := coalesce(v_parcela.valor_juros, 0);
    v_multa := coalesce(v_parcela.valor_multa, 0);
    v_desconto := coalesce(v_parcela.valor_desconto, 0);
    v_multa_diaria := coalesce(v_parcela.multa_diaria_usada, 0);
  ELSE
    v_valor_total_devido := round(coalesce(v_parcela.valor_original, 0) + coalesce(v_parcela.saldo_residual, 0), 2);
    -- DATE civil: multa só surge quando virar o dia seguinte em Brasília.
    v_dias_atraso := greatest(0, p_data_pagamento - v_parcela.data_vencimento);
    v_multa := CASE WHEN v_dias_atraso > 0 THEN round(v_valor_total_devido * v_multa_percentual / 100, 2) ELSE 0 END;
    v_juros := CASE
      WHEN v_juros_custom_normalizado IS NOT NULL THEN v_juros_custom_normalizado
      WHEN v_dias_atraso > 0 THEN round(v_multa_diaria * v_dias_atraso, 2)
      ELSE 0
    END;
    v_desconto := v_desconto_normalizado;
  END IF;

  v_valor_total := round(v_valor_total_devido + v_juros + v_multa - v_desconto, 2);
  IF v_valor_total < 0 THEN
    RAISE EXCEPTION 'O desconto não pode superar o valor devido' USING ERRCODE = '22023';
  END IF;
  IF v_valor_pago_normalizado > v_valor_total THEN
    RAISE EXCEPTION 'O valor informado supera o saldo devido; registre ajuste separado para crédito' USING ERRCODE = '22023';
  END IF;

  v_status_novo := CASE WHEN v_valor_pago_normalizado = v_valor_total THEN 'paga' ELSE 'parcial' END;
  v_saldo_residual := CASE WHEN v_status_novo = 'paga' THEN 0 ELSE round(v_valor_total - v_valor_pago_normalizado, 2) END;
  v_valor_pago_acumulado := round(coalesce(v_parcela.valor_pago, 0) + v_valor_pago_normalizado, 2);
  v_hora_pagamento := (p_data_pagamento::timestamp + time '12:00:00') AT TIME ZONE 'America/Sao_Paulo';

  UPDATE public.parcelas
  SET valor_pago = v_valor_pago_acumulado,
      valor_juros = v_juros,
      valor_multa = v_multa,
      valor_desconto = v_desconto,
      multa_diaria_usada = v_multa_diaria,
      saldo_residual = v_saldo_residual,
      data_pagamento = v_hora_pagamento,
      status = v_status_novo::public.status_parcela,
      conta_caixa_id = p_conta_caixa_id,
      observacoes = v_observacoes_normalizadas
  WHERE id = v_parcela.id AND user_id = p_user_id;

  INSERT INTO public.transacoes_caixa (
    user_id, conta_caixa_id, tipo, categoria, valor, descricao,
    parcela_id, contrato_id, cliente_id, operacao_financeira_id, data_transacao
  ) VALUES (
    p_user_id, p_conta_caixa_id, 'entrada', 'pagamento_parcela', v_valor_pago_normalizado,
    format('Pagamento parcela #%s - Contrato #%s%s', v_parcela.numero_parcela, v_parcela.contrato_id,
      CASE WHEN v_saldo_residual > 0 THEN format(' (parcial, falta R$ %s)', to_char(v_saldo_residual, 'FM999999990.00')) ELSE '' END),
    v_parcela.id, v_parcela.contrato_id, v_parcela.cliente_id, v_operacao.id, v_hora_pagamento
  ) RETURNING id INTO v_transacao_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.parcelas
    WHERE contrato_id = v_parcela.contrato_id
      AND user_id = p_user_id
      AND status IN ('pendente', 'atrasada', 'vencendo_hoje', 'parcial')
  ) THEN
    UPDATE public.contratos
    SET status = 'quitado'::public.status_contrato
    WHERE id = v_parcela.contrato_id AND user_id = p_user_id;
  END IF;

  INSERT INTO public.contrato_historico (user_id, contrato_id, tipo, descricao, valor_novo)
  VALUES (
    p_user_id, v_parcela.contrato_id, 'pagamento',
    CASE WHEN v_status_novo = 'paga'
      THEN format('Parcela #%s quitada - R$ %s', v_parcela.numero_parcela, to_char(v_valor_pago_normalizado, 'FM999999990.00'))
      ELSE format('Parcela #%s paga parcialmente - R$ %s (saldo pendente nesta parcela: R$ %s)', v_parcela.numero_parcela, to_char(v_valor_pago_normalizado, 'FM999999990.00'), to_char(v_saldo_residual, 'FM999999990.00'))
    END,
    to_char(v_valor_pago_normalizado, 'FM999999990.00')
  );

  v_resultado := jsonb_build_object(
    'success', true,
    'repetida', false,
    'operationId', v_operacao.id,
    'parcelaId', v_parcela.id,
    'transacaoCaixaId', v_transacao_id,
    'status', v_status_novo,
    'saldoResidual', v_saldo_residual,
    'valorPagoAcumulado', v_valor_pago_acumulado,
    'dataPagamento', p_data_pagamento
  );

  INSERT INTO public.auditoria_financeira (id, user_id, operacao_id, acao, entidade, entidade_id, detalhes)
  VALUES (
    gen_random_uuid(), p_user_id, v_operacao.id, 'registrar_pagamento_parcela', 'parcelas', v_parcela.id::text,
    jsonb_build_object(
      'payload', v_payload,
      'hashRequisicao', v_hash,
      'valorPago', v_valor_pago_normalizado,
      'contaCaixaId', p_conta_caixa_id,
      'status', v_status_novo,
      'saldoAnterior', coalesce(v_parcela.saldo_residual, 0),
      'saldoResidual', v_saldo_residual,
      'valorTotalDevido', v_valor_total_devido,
      'juros', v_juros,
      'multa', v_multa,
      'desconto', v_desconto,
      'diasAtraso', v_dias_atraso,
      'multaDiariaUsada', v_multa_diaria,
      'dataPagamento', p_data_pagamento
    )
  );

  UPDATE public.operacoes_financeiras
  SET status = 'concluida', resultado = v_resultado, concluida_em = now()
  WHERE id = v_operacao.id;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_pagamento_parcela(INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_registrar_pagamento_parcela(INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_registrar_pagamento_parcela(INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_pagamento_parcela(INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, UUID) TO service_role;
