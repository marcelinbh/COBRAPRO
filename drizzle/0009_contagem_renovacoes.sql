-- Adicionar coluna contagem_renovacoes à tabela parcelas
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS contagem_renovacoes INTEGER DEFAULT 0 NOT NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_parcelas_contagem_renovacoes ON parcelas(contagem_renovacoes);
