-- CobraPro: tabelas da aplicação só são acessadas pelo backend service_role.
-- Inventário validado em oxvtmibrgjruldkouhhb em 2026-11-06.
-- Não altera linhas, valores, hashes, tokens ou políticas existentes.
-- A aplicação autentica via Express/tRPC, não via papéis anon/authenticated.
-- Um único DO aplica a contenção atomicamente; ausências são ignoradas para
-- compatibilidade entre instalações. Novas tabelas exigem revisão equivalente.
DO $$
DECLARE
  tabela text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'Contenção bloqueada: service_role sem BYPASSRLS.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Contenção bloqueada: papéis Supabase esperados ausentes.';
  END IF;
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM set_config('statement_timeout', '30s', true);
  FOREACH tabela IN ARRAY ARRAY[
    'assinaturas', 'auditoria_financeira', 'cheques', 'clientes', 'configuracoes',
    'contas_caixa', 'contas_pagar', 'contrato_historico', 'contratos',
    'etiquetas_contratos', 'koletores', 'login_logs', 'magic_links',
    'notificacoes_automaticas', 'notificacoes_log', 'operacoes_financeiras',
    'pagamentos_assinatura', 'parcelas', 'parcelas_venda_telefone',
    'password_resets', 'produtos', 'templates_whatsapp', 'transacoes_caixa',
    'users', 'veiculos', 'vendas_telefone', 'whatsapp_eventos',
    'whatsapp_outbox', 'whatsapp_tentativas', 'kiwify_webhooks',
    'blacklist', 'blacklist_fotos'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tabela AND c.relkind IN ('r', 'p')
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', tabela);
      EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', tabela);
    END IF;
  END LOOP;
END $$;
