/**
 * Script para criar as tabelas de assinaturas no Supabase
 * Usa o Supabase client com service_role key
 */
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

// Check if tables already exist
async function tableExists(tableName) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?limit=1`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    }
  });
  return res.status !== 404;
}

async function main() {
  const assExists = await tableExists('assinaturas');
  const pagExists = await tableExists('pagamentos_assinatura');
  
  console.log('assinaturas exists:', assExists);
  console.log('pagamentos_assinatura exists:', pagExists);
  
  if (assExists && pagExists) {
    console.log('Both tables already exist! Module is ready.');
    process.exit(0);
  }
  
  console.log('Tables do not exist. Need to create them via Supabase Dashboard SQL Editor.');
  console.log('\nSQL to execute:');
  console.log(`
CREATE TABLE IF NOT EXISTS assinaturas (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  servico TEXT NOT NULL,
  descricao TEXT,
  valor_mensal NUMERIC(10,2) NOT NULL,
  dia_vencimento INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa','cancelada')),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
  id BIGSERIAL PRIMARY KEY,
  assinatura_id BIGINT NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  valor_pago NUMERIC(10,2) NOT NULL,
  data_pagamento TIMESTAMPTZ DEFAULT NOW(),
  mes_referencia TEXT NOT NULL,
  forma_pagamento TEXT DEFAULT 'dinheiro',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
  `);
  process.exit(1);
}

main().catch(console.error);
