-- CobraPro: integridade de assinaturas e recebimentos recorrentes.
-- Execute SOMENTE após 0012 e após o preflight no projeto COBRA PRO.
-- A migration não saneia inconsistências: toda divergência aborta o rollout.

-- O esquema histórico de 0009 não tinha tenant nos dois registros. A coluna é
-- adicionada para compatibilidade, e só recebe inferência da assinatura dona.
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE public.pagamentos_assinatura
  ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE public.transacoes_caixa
  ADD COLUMN IF NOT EXISTS pagamento_assinatura_id INTEGER;

UPDATE public.pagamentos_assinatura p
SET user_id = a.user_id
FROM public.assinaturas a
WHERE a.id = p.assinatura_id
  AND p.user_id IS NULL
  AND a.user_id IS NOT NULL;

-- Este gate vem antes de qualquer constraint nova. Não tenta adivinhar tenant,
-- cliente, Caixa, competência ou pagamento duplicado.
DO $$
BEGIN
  IF to_regclass('public.assinaturas') IS NULL
     OR to_regclass('public.pagamentos_assinatura') IS NULL
     OR to_regclass('public.transacoes_caixa') IS NULL
     OR to_regclass('public.contas_caixa') IS NULL
     OR to_regclass('public.operacoes_financeiras') IS NULL THEN
    RAISE EXCEPTION 'Migration bloqueada: tabelas financeiras obrigatórias ausentes.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assinaturas WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem assinaturas sem user_id; saneie antes de continuar.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pagamentos_assinatura
    WHERE user_id IS NULL OR assinatura_id IS NULL OR cliente_id IS NULL
       OR conta_caixa_id IS NULL OR mes_referencia IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: há pagamento de assinatura sem tenant ou chave de negócio.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.pagamentos_assinatura p
    LEFT JOIN public.assinaturas a ON a.id = p.assinatura_id
    LEFT JOIN public.contas_caixa c ON c.id = p.conta_caixa_id
    WHERE a.id IS NULL OR c.id IS NULL
       OR a.user_id IS DISTINCT FROM p.user_id
       OR a.cliente_id IS DISTINCT FROM p.cliente_id
       OR c.user_id IS DISTINCT FROM p.user_id
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: há pagamento ligado a assinatura, cliente ou Caixa de outra empresa.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pagamentos_assinatura
    GROUP BY user_id, assinatura_id, mes_referencia
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem competências de assinatura duplicadas.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.transacoes_caixa t
    LEFT JOIN public.pagamentos_assinatura p ON p.id = t.pagamento_assinatura_id
    WHERE t.pagamento_assinatura_id IS NOT NULL
      AND (t.user_id IS NULL OR p.id IS NULL OR p.user_id IS DISTINCT FROM t.user_id)
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: há lançamento de Caixa sem pagamento ou com tenant divergente.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.operacoes_financeiras
    WHERE tipo NOT IN ('recebimento_parcela', 'renovacao_juros', 'pagamento_conta', 'estorno_conta', 'ajuste_manual', 'pagamento_assinatura')
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: operacoes_financeiras contém tipo não reconhecido.';
  END IF;
END $$;

ALTER TABLE public.assinaturas
  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.pagamentos_assinatura
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN assinatura_id SET NOT NULL,
  ALTER COLUMN cliente_id SET NOT NULL,
  ALTER COLUMN conta_caixa_id SET NOT NULL,
  ALTER COLUMN mes_referencia SET NOT NULL;

-- A categoria só passa a ser usada pela aplicação após esta migration estar presente.
ALTER TYPE categoria_transacao ADD VALUE IF NOT EXISTS 'pagamento_assinatura';

ALTER TABLE public.operacoes_financeiras
  DROP CONSTRAINT IF EXISTS operacoes_financeiras_tipo_check;
ALTER TABLE public.operacoes_financeiras
  ADD CONSTRAINT operacoes_financeiras_tipo_check CHECK (
    tipo IN ('recebimento_parcela', 'renovacao_juros', 'pagamento_conta', 'estorno_conta', 'ajuste_manual', 'pagamento_assinatura')
  );

-- Índices de referência tornam as FKs compostas possíveis e fazem tenant parte
-- da integridade física, não apenas uma checagem do código da aplicação.
CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_user_id_id_cliente_id_uk
  ON public.assinaturas (user_id, id, cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS contas_caixa_user_id_id_uk
  ON public.contas_caixa (user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_assinatura_user_id_id_uk
  ON public.pagamentos_assinatura (user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_assinatura_user_assinatura_mes_uk
  ON public.pagamentos_assinatura (user_id, assinatura_id, mes_referencia);
CREATE INDEX IF NOT EXISTS pagamentos_assinatura_usuario_data_idx
  ON public.pagamentos_assinatura (user_id, data_pagamento DESC);

-- Substitui FKs legadas por FKs que incluem empresa. O bloco anterior garante
-- que o DROP/ADD só ocorre quando os dados são compatíveis.
ALTER TABLE public.pagamentos_assinatura
  DROP CONSTRAINT IF EXISTS pagamentos_assinatura_assinatura_fk;
ALTER TABLE public.transacoes_caixa
  DROP CONSTRAINT IF EXISTS transacoes_caixa_pagamento_assinatura_fk;

ALTER TABLE public.pagamentos_assinatura
  ADD CONSTRAINT pagamentos_assinatura_assinatura_tenant_cliente_fk
  FOREIGN KEY (user_id, assinatura_id, cliente_id)
  REFERENCES public.assinaturas (user_id, id, cliente_id)
  ON DELETE RESTRICT,
  ADD CONSTRAINT pagamentos_assinatura_conta_caixa_tenant_fk
  FOREIGN KEY (user_id, conta_caixa_id)
  REFERENCES public.contas_caixa (user_id, id)
  ON DELETE RESTRICT;

ALTER TABLE public.transacoes_caixa
  ADD CONSTRAINT transacoes_caixa_pagamento_assinatura_tenant_fk
  FOREIGN KEY (user_id, pagamento_assinatura_id)
  REFERENCES public.pagamentos_assinatura (user_id, id)
  ON DELETE RESTRICT,
  ADD CONSTRAINT transacoes_caixa_pagamento_assinatura_tenant_check
  CHECK (pagamento_assinatura_id IS NULL OR user_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS transacoes_caixa_pagamento_assinatura_uk
  ON public.transacoes_caixa (pagamento_assinatura_id)
  WHERE pagamento_assinatura_id IS NOT NULL;
