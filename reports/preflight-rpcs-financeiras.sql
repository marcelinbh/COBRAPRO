-- CobraPro — pré-auditoria SOMENTE LEITURA para as RPCs financeiras.
-- Execute exclusivamente no projeto Supabase COBRA PRO (ref oxvtmibrgjruldkouhhb).
-- Não aplica constraints, funções ou atualizações; cada consulta deve retornar zero
-- linhas de divergência antes do rollout de 0014.

-- 1. Inventário físico: confirme nomes/capitalização e tipos usados pelas RPCs.
SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'parcelas', 'contratos', 'contas_caixa', 'transacoes_caixa',
    'operacoes_financeiras', 'auditoria_financeira',
    'parcelas_renovacoes', 'contrato_historico', 'configuracoes'
  )
ORDER BY table_name, ordinal_position;

-- 2. Status e categorias reais que as RPCs podem gravar.
SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS valores
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname IN (
    'status_parcela', 'status_contrato', 'tipo_taxa',
    'tipo_transacao', 'categoria_transacao'
  )
GROUP BY t.typname;

-- 3. Duplicidades e tenant nulo: bloqueiam a unicidade de parcela.
SELECT user_id, contrato_id, numero_parcela, count(*) AS quantidade, array_agg(id ORDER BY id) AS ids
FROM public.parcelas
GROUP BY user_id, contrato_id, numero_parcela
HAVING count(*) > 1;

SELECT id, contrato_id, numero_parcela
FROM public.parcelas
WHERE user_id IS NULL;

-- 4. Relação parcela/contrato/cliente fora da mesma empresa.
SELECT p.id, p.user_id AS parcela_user_id, c.user_id AS contrato_user_id,
       p.cliente_id AS parcela_cliente_id, c.cliente_id AS contrato_cliente_id
FROM public.parcelas p
LEFT JOIN public.contratos c ON c.id = p.contrato_id
WHERE c.id IS NULL
   OR p.user_id IS NULL
   OR p.user_id IS DISTINCT FROM c.user_id
   OR p.cliente_id IS DISTINCT FROM c.cliente_id;

-- 5. Contador de contrato abaixo do maior número de parcela.
SELECT c.id, c.user_id, c.numero_parcelas, max(p.numero_parcela) AS maior_numero
FROM public.contratos c
LEFT JOIN public.parcelas p ON p.contrato_id = c.id AND p.user_id = c.user_id
GROUP BY c.id, c.user_id, c.numero_parcelas
HAVING c.numero_parcelas < coalesce(max(p.numero_parcela), 0);

-- 6. Valor pago de parcela sem caixa correspondente ou divergente.
WITH caixa AS (
  SELECT user_id, parcela_id, sum(valor)::numeric(15,2) AS total
  FROM public.transacoes_caixa
  WHERE tipo = 'entrada' AND categoria = 'pagamento_parcela'
  GROUP BY user_id, parcela_id
)
SELECT p.id, p.user_id, p.status, p.valor_pago, coalesce(c.total, 0) AS total_caixa
FROM public.parcelas p
LEFT JOIN caixa c ON c.user_id = p.user_id AND c.parcela_id = p.id
WHERE coalesce(p.valor_pago, 0) > 0
  AND coalesce(p.valor_pago, 0) <> coalesce(c.total, 0);

-- 7. Operações idempotentes legadas que não podem ser migradas sem revisão.
SELECT id, user_id, tipo, chave_idempotencia, status, erro, created_at, concluida_em
FROM public.operacoes_financeiras
WHERE status <> 'concluida'
   OR (status = 'concluida' AND resultado IS NULL)
ORDER BY created_at;

-- 8. Configurações duplicadas impedem cálculo de multa determinístico.
SELECT user_id, chave, count(*) AS quantidade
FROM public.configuracoes
GROUP BY user_id, chave
HAVING count(*) > 1;

-- 9. Extensão e índices indispensáveis ao rollout.
SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('operacoes_financeiras_user_chave_uk', 'parcelas_user_contrato_numero_uk');
