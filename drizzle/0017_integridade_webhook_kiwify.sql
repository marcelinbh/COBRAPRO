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
    JOIN pg_index i ON i.indexrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'kiwify_webhooks_order_id_uk'
      AND NOT i.indisunique
  ) THEN
    RAISE EXCEPTION 'Migration 0017 bloqueada: já existe índice homônimo não único.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS kiwify_webhooks_order_id_uk
  ON public.kiwify_webhooks (order_id);
