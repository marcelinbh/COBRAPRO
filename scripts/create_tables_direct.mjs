/**
 * Create assinaturas tables using Supabase's pg endpoint
 * The service_role key can bypass RLS but not execute DDL directly via REST
 * We need to use the Supabase pg endpoint or a stored procedure
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Try using Supabase's pg endpoint (available in newer versions)
const PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Try the direct database endpoint
const sql = `
DO $$ BEGIN
  CREATE TYPE status_assinatura AS ENUM ('ativa', 'cancelada', 'suspensa', 'inadimplente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS assinaturas (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  servico VARCHAR(200) NOT NULL,
  descricao TEXT,
  valor_mensal NUMERIC(15,2) NOT NULL,
  dia_vencimento INTEGER NOT NULL DEFAULT 10,
  status status_assinatura DEFAULT 'ativa' NOT NULL,
  data_inicio DATE NOT NULL,
  data_cancelamento DATE,
  conta_caixa_id INTEGER,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
  id SERIAL PRIMARY KEY,
  assinatura_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  valor_pago NUMERIC(15,2) NOT NULL,
  data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  mes_referencia VARCHAR(7) NOT NULL,
  conta_caixa_id INTEGER,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`;

// Try via the Supabase pg endpoint
const pgEndpoints = [
  `${SUPABASE_URL}/pg/query`,
  `${SUPABASE_URL}/rest/v1/rpc/query`,
  `${SUPABASE_URL}/rest/v1/rpc/sql`,
];

for (const endpoint of pgEndpoints) {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  console.log(`${endpoint}: ${r.status}`, text.substring(0, 100));
  if (r.ok) {
    console.log('✅ Success!');
    break;
  }
}

// Alternative: try using the Supabase admin API
const adminEndpoints = [
  `https://${PROJECT_REF}.supabase.co/pg/query`,
  `https://api.supabase.io/v1/projects/${PROJECT_REF}/database/query`,
];

for (const endpoint of adminEndpoints) {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  console.log(`${endpoint}: ${r.status}`, text.substring(0, 100));
  if (r.ok) {
    console.log('✅ Success!');
    break;
  }
}

// Check tables
const { error: e1 } = await supabase.from('assinaturas').select('id').limit(1);
console.log('\nassinaturas:', e1 ? '❌ ' + e1.message : '✅ exists');
const { error: e2 } = await supabase.from('pagamentos_assinatura').select('id').limit(1);
console.log('pagamentos_assinatura:', e2 ? '❌ ' + e2.message : '✅ exists');
