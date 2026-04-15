import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
console.log('Project ref:', projectRef);

// Use the management API to run SQL
const sql1 = `CREATE TABLE IF NOT EXISTS assinaturas (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  servico VARCHAR(200) NOT NULL,
  descricao TEXT,
  valor_mensal DECIMAL(15,2) NOT NULL,
  dia_vencimento INTEGER NOT NULL DEFAULT 10,
  status VARCHAR(50) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'suspensa', 'inadimplente')),
  data_inicio DATE NOT NULL,
  data_cancelamento DATE,
  conta_caixa_id INTEGER,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
)`;

const sql2 = `CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
  id SERIAL PRIMARY KEY,
  assinatura_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  valor_pago DECIMAL(15,2) NOT NULL,
  data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  mes_referencia VARCHAR(7) NOT NULL,
  conta_caixa_id INTEGER,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
)`;

for (const [name, sql] of [['assinaturas', sql1], ['pagamentos_assinatura', sql2]]) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  console.log(`${name}: ${r.status} ${text.substring(0, 200)}`);
}
