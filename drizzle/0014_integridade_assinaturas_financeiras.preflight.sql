-- SOMENTE LEITURA — executar no projeto COBRA PRO antes de 0014.
-- Todas as consultas de divergência abaixo devem retornar zero linhas.

SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('assinaturas', 'pagamentos_assinatura', 'transacoes_caixa')
ORDER BY table_name, ordinal_position;

SELECT id, cliente_id, servico
FROM public.assinaturas
WHERE user_id IS NULL;

SELECT p.id, p.assinatura_id, p.cliente_id, p.user_id,
       a.id AS assinatura_encontrada, a.user_id AS assinatura_user_id, a.cliente_id AS assinatura_cliente_id
FROM public.pagamentos_assinatura p
LEFT JOIN public.assinaturas a ON a.id = p.assinatura_id
WHERE p.user_id IS NULL
   OR a.id IS NULL
   OR a.user_id IS DISTINCT FROM p.user_id
   OR a.cliente_id IS DISTINCT FROM p.cliente_id;

SELECT user_id, assinatura_id, mes_referencia, count(*) AS quantidade, array_agg(id ORDER BY id) AS ids
FROM public.pagamentos_assinatura
GROUP BY user_id, assinatura_id, mes_referencia
HAVING count(*) > 1;

SELECT p.id, p.assinatura_id, p.mes_referencia, p.conta_caixa_id
FROM public.pagamentos_assinatura p
LEFT JOIN public.contas_caixa c ON c.id = p.conta_caixa_id AND c.user_id = p.user_id
WHERE p.conta_caixa_id IS NULL OR c.id IS NULL;
