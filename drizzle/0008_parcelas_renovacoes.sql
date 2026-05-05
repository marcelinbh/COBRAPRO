-- Criar tabela de histórico de renovações de parcelas
CREATE TABLE IF NOT EXISTS parcelas_renovacoes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  parcela_id INTEGER NOT NULL,
  contrato_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  numero_renovacao INTEGER NOT NULL,
  data_renovacao TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  valor_juros_pago NUMERIC(15, 2) NOT NULL,
  nova_data_vencimento DATE NOT NULL,
  nova_parcela_id INTEGER,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_parcelas_renovacoes_user_id ON parcelas_renovacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_renovacoes_parcela_id ON parcelas_renovacoes(parcela_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_renovacoes_contrato_id ON parcelas_renovacoes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_renovacoes_cliente_id ON parcelas_renovacoes(cliente_id);
