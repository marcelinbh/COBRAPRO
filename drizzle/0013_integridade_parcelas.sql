-- CobraPro: integridade de numeração de parcelas por empresa/contrato.
-- Execute SOMENTE após reports/preflight-rpcs-financeiras.sql retornar zero
-- divergências para parcelas. Esta migration não saneia dados: falha fechada
-- para que correções legadas sejam analisadas e aprovadas antes do rollout.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.parcelas
    WHERE user_id IS NULL OR contrato_id IS NULL OR numero_parcela IS NULL
  ) THEN
    RAISE EXCEPTION 'Índice não aplicado: há parcelas sem empresa, contrato ou número.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parcelas
    GROUP BY user_id, contrato_id, numero_parcela
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Índice não aplicado: existem parcelas duplicadas que exigem saneamento.';
  END IF;
END $$;

ALTER TABLE public.parcelas
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN contrato_id SET NOT NULL,
  ALTER COLUMN numero_parcela SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parcelas_user_contrato_numero_uk
  ON public.parcelas (user_id, contrato_id, numero_parcela);

-- Não aceitar um objeto homônimo com definição divergente como se a garantia
-- já estivesse ativa. Confere chave, unicidade e ausência de predicado parcial.
DO $$
DECLARE
  v_atts SMALLINT[];
BEGIN
  SELECT array_agg(attnum ORDER BY ord)
  INTO v_atts
  FROM unnest(ARRAY['user_id', 'contrato_id', 'numero_parcela']) WITH ORDINALITY AS cols(nome, ord)
  JOIN pg_attribute a
    ON a.attrelid = 'public.parcelas'::regclass
   AND a.attname = cols.nome
   AND NOT a.attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.parcelas'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND i.indkey::smallint[] = v_atts
  ) THEN
    RAISE EXCEPTION 'Índice de parcelas inválido: exige unicidade integral (user_id, contrato_id, numero_parcela).';
  END IF;
END $$;
