-- CobraPro: integridade de assinaturas e recebimentos recorrentes.
-- Execute SOMENTE após a pré-auditoria no projeto COBRA PRO (oxvtmibrgjruldkouhhb).
-- Esta migration falha de modo seguro se houver órfãos, tenant nulo ou duplicidades.

-- A categoria só passa a ser usada pela aplicação após esta migration estar presente.
ALTER TYPE categoria_transacao ADD VALUE IF NOT EXISTS 'pagamento_assinatura';

ALTER TABLE public.operacoes_financeiras
  DROP CONSTRAINT IF EXISTS operacoes_financeiras_tipo_check;
ALTER TABLE public.operacoes_financeiras
  ADD CONSTRAINT operacoes_financeiras_tipo_check CHECK (
    tipo IN ('recebimento_parcela', 'renovacao_juros', 'pagamento_conta', 'estorno_conta', 'ajuste_manual', 'pagamento_assinatura')
  );

ALTER TABLE public.pagamentos_assinatura
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- Só é possível inferir o tenant quando a assinatura ainda existe e já possui dono.
UPDATE public.pagamentos_assinatura p
SET user_id = a.user_id
FROM public.assinaturas a
WHERE a.id = p.assinatura_id
  AND p.user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.assinaturas WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem assinaturas sem user_id; saneie antes de continuar.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pagamentos_assinatura WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem pagamentos de assinatura sem tenant vinculável; saneie antes de continuar.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.pagamentos_assinatura p
    LEFT JOIN public.assinaturas a ON a.id = p.assinatura_id
    WHERE a.id IS NULL OR a.user_id IS DISTINCT FROM p.user_id OR a.cliente_id IS DISTINCT FROM p.cliente_id
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: há pagamentos órfãos ou vinculados a outra empresa/cliente.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pagamentos_assinatura
    GROUP BY user_id, assinatura_id, mes_referencia
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migration bloqueada: existem competências de assinatura duplicadas.';
  END IF;
END $$;

ALTER TABLE public.assinaturas
  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.pagamentos_assinatura
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN conta_caixa_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_assinatura_user_assinatura_mes_uk
  ON public.pagamentos_assinatura (user_id, assinatura_id, mes_referencia);
CREATE INDEX IF NOT EXISTS pagamentos_assinatura_usuario_data_idx
  ON public.pagamentos_assinatura (user_id, data_pagamento DESC);

ALTER TABLE public.transacoes_caixa
  ADD COLUMN IF NOT EXISTS pagamento_assinatura_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pagamentos_assinatura_assinatura_fk'
      AND conrelid = 'public.pagamentos_assinatura'::regclass
  ) THEN
    ALTER TABLE public.pagamentos_assinatura
      ADD CONSTRAINT pagamentos_assinatura_assinatura_fk
      FOREIGN KEY (assinatura_id) REFERENCES public.assinaturas(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transacoes_caixa_pagamento_assinatura_fk'
      AND conrelid = 'public.transacoes_caixa'::regclass
  ) THEN
    ALTER TABLE public.transacoes_caixa
      ADD CONSTRAINT transacoes_caixa_pagamento_assinatura_fk
      FOREIGN KEY (pagamento_assinatura_id) REFERENCES public.pagamentos_assinatura(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS transacoes_caixa_pagamento_assinatura_uk
  ON public.transacoes_caixa (pagamento_assinatura_id)
  WHERE pagamento_assinatura_id IS NOT NULL;
