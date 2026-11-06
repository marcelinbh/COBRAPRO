-- Kiwify: impede reentregas e replay do mesmo pedido de dispararem efeitos duas vezes.
-- Executar somente após preflight no projeto Supabase COBRA PRO correto.
DO $$
BEGIN
  IF to_regclass('public.kiwify_webhooks') IS NULL THEN
    RAISE EXCEPTION 'Migration 0017 bloqueada: tabela public.kiwify_webhooks não existe.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.kiwify_webhooks
    WHERE order_id IS NULL OR btrim(order_id) = ''
  ) THEN
    RAISE EXCEPTION 'Migration 0017 bloqueada: existem eventos Kiwify sem order_id válido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.kiwify_webhooks
    GROUP BY order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migration 0017 bloqueada: existem order_id duplicados que exigem saneamento.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_index i ON i.indexrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'kiwify_webhooks_order_id_uk'
      AND NOT COALESCE((
        i.indisunique AND i.indisvalid AND i.indisready
        AND i.indrelid = 'public.kiwify_webhooks'::regclass
        AND i.indnkeyatts = 1 AND i.indnatts = 1
        AND i.indexprs IS NULL AND i.indpred IS NULL
        AND i.indkey[0] = (SELECT attnum FROM pg_attribute
          WHERE attrelid = 'public.kiwify_webhooks'::regclass
            AND attname = 'order_id' AND NOT attisdropped)
      ), false)
  ) THEN
    RAISE EXCEPTION 'Migration 0017 bloqueada: já existe índice homônimo incompatível com unicidade de order_id.';
  END IF;
END $$;

-- Manter o gate também para inserções futuras, não só para dados existentes.
ALTER TABLE public.kiwify_webhooks ALTER COLUMN order_id SET NOT NULL;
ALTER TABLE public.kiwify_webhooks
  DROP CONSTRAINT IF EXISTS kiwify_webhooks_order_id_nonempty;
ALTER TABLE public.kiwify_webhooks
  ADD CONSTRAINT kiwify_webhooks_order_id_nonempty CHECK (btrim(order_id) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS kiwify_webhooks_order_id_uk
  ON public.kiwify_webhooks (order_id);
