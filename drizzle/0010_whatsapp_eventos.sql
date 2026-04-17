-- Tabela de eventos do webhook da Evolution API
CREATE TABLE IF NOT EXISTS whatsapp_eventos (
  id BIGSERIAL PRIMARY KEY,
  evento TEXT NOT NULL,
  instancia TEXT NOT NULL DEFAULT 'cobrapro',
  payload TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wpp_ev_evento ON whatsapp_eventos(evento);
CREATE INDEX IF NOT EXISTS idx_wpp_ev_instancia ON whatsapp_eventos(instancia);
CREATE INDEX IF NOT EXISTS idx_wpp_ev_criado ON whatsapp_eventos(criado_em DESC);
