-- CobraPro: controles operacionais, idempotência financeira e outbox de WhatsApp.
-- Esta migration é aditiva: não altera nem apaga movimentos ou histórico existente.

CREATE TABLE IF NOT EXISTS operacoes_financeiras (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('recebimento_parcela', 'renovacao_juros', 'pagamento_conta', 'estorno_conta', 'ajuste_manual')),
  chave_idempotencia UUID NOT NULL,
  hash_requisicao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processando' CHECK (status IN ('processando', 'concluida', 'falha')),
  resultado JSONB,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluida_em TIMESTAMPTZ,
  CONSTRAINT operacoes_financeiras_user_chave_uk UNIQUE (user_id, chave_idempotencia)
);
CREATE INDEX IF NOT EXISTS idx_operacoes_financeiras_status ON operacoes_financeiras (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS auditoria_financeira (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL,
  operacao_id UUID NOT NULL REFERENCES operacoes_financeiras(id),
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_financeira_operacao ON auditoria_financeira (operacao_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auditoria_financeira_usuario ON auditoria_financeira (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  telefone TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  chave_deduplicacao TEXT NOT NULL UNIQUE,
  data_referencia DATE NOT NULL,
  parcela_id INTEGER,
  cliente_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviando', 'enviado', 'falhou', 'desconhecido', 'cancelado')),
  tentativas INTEGER NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  proxima_tentativa_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expira_em TIMESTAMPTZ,
  provider_message_id TEXT,
  ultimo_erro TEXT,
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_fila ON whatsapp_outbox (status, proxima_tentativa_em, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_usuario ON whatsapp_outbox (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_provider ON whatsapp_outbox (provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS whatsapp_tentativas (
  id BIGSERIAL PRIMARY KEY,
  outbox_id UUID NOT NULL REFERENCES whatsapp_outbox(id),
  iniciou_em TIMESTAMPTZ NOT NULL,
  terminou_em TIMESTAMPTZ NOT NULL,
  sucesso BOOLEAN NOT NULL,
  provider_message_id TEXT,
  codigo_erro TEXT,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_tentativas_outbox ON whatsapp_tentativas (outbox_id, created_at);

CREATE TABLE IF NOT EXISTS notificacoes_automaticas (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  mensagem_template TEXT NOT NULL,
  dias_antes INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notificacoes_automaticas_regra_uk UNIQUE (user_id, tipo, dias_antes)
);

CREATE TABLE IF NOT EXISTS notificacoes_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  parcela_id INTEGER,
  cliente_id INTEGER,
  tipo TEXT NOT NULL,
  telefone TEXT,
  mensagem TEXT,
  status TEXT NOT NULL,
  erro TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notificacoes_log ADD COLUMN IF NOT EXISTS outbox_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notificacoes_log_outbox ON notificacoes_log (outbox_id) WHERE outbox_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_usuario_data ON notificacoes_log (user_id, "createdAt" DESC);

-- A configuração usa upsert composto em diversos fluxos. O índice impede estados duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS idx_configuracoes_usuario_chave ON configuracoes (user_id, chave);
