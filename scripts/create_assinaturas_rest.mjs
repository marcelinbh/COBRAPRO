import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Try to create tables using Supabase's pg REST endpoint
const projectId = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];
console.log('Project ID:', projectId);

const sql = `
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
`;

// Try via Supabase management API
async function tryManagementApi() {
  const url = `https://api.supabase.com/v1/projects/${projectId}/database/query`;
  console.log('Trying management API:', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log('Status:', res.status, text.substring(0, 200));
  return res.ok;
}

// Try via pg REST endpoint
async function tryPgRest() {
  const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  console.log('Trying pg REST:', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ sql }),
  });
  const text = await res.text();
  console.log('Status:', res.status, text.substring(0, 200));
  return res.ok;
}

// Try via Supabase admin endpoint
async function tryAdminEndpoint() {
  const url = `https://api.supabase.com/v1/projects/${projectId}/database/query`;
  console.log('Trying admin endpoint:', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log('Status:', res.status, text.substring(0, 300));
  return res.ok;
}

// Try via internal server endpoint
async function tryServerEndpoint() {
  const url = `http://localhost:3000/api/auth/init-tables`;
  console.log('Trying server endpoint:', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tables: ['assinaturas', 'pagamentos_assinatura'] }),
  });
  const text = await res.text();
  console.log('Status:', res.status, text.substring(0, 200));
  return res.ok;
}

(async () => {
  try {
    const ok1 = await tryManagementApi();
    if (ok1) { console.log('SUCCESS via management API'); process.exit(0); }
  } catch (e) { console.log('Management API failed:', e.message); }
  
  try {
    const ok2 = await tryPgRest();
    if (ok2) { console.log('SUCCESS via pg REST'); process.exit(0); }
  } catch (e) { console.log('pg REST failed:', e.message); }
  
  try {
    const ok3 = await tryAdminEndpoint();
    if (ok3) { console.log('SUCCESS via admin endpoint'); process.exit(0); }
  } catch (e) { console.log('Admin endpoint failed:', e.message); }

  console.log('All methods failed. Tables need to be created manually in Supabase Dashboard.');
  process.exit(1);
})();
