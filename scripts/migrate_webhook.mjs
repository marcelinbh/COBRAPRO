import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const sb = createClient(url, key);

async function run() {
  // Verificar se a tabela já existe
  const { error: checkError } = await sb.from('whatsapp_eventos').select('id').limit(1);
  
  if (!checkError) {
    console.log('✅ Tabela whatsapp_eventos já existe!');
    return;
  }
  
  console.log('Tabela não existe, criando via Supabase SQL API...');
  console.log('Erro ao verificar:', checkError.message);
  
  // Tentar criar via API de SQL do Supabase
  const projectRef = url.replace('https://', '').split('.')[0];
  
  const sql = `
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
  `;

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  
  const result = await res.text();
  console.log('Resultado:', result);
  
  if (res.ok) {
    console.log('✅ Tabela criada com sucesso!');
  } else {
    console.log('❌ Erro ao criar tabela. Execute o SQL manualmente no Supabase Dashboard:');
    console.log(sql);
  }
}

run().catch(console.error);
