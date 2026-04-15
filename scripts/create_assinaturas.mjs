import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Use the REST API to execute SQL via the pg endpoint
const sql = `
CREATE TABLE IF NOT EXISTS assinaturas (
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
);

CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
  id SERIAL PRIMARY KEY,
  assinatura_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  valor_pago DECIMAL(15,2) NOT NULL,
  data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  mes_referencia VARCHAR(7) NOT NULL,
  conta_caixa_id INTEGER,
  observacoes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`;

// Use Supabase's rpc or direct fetch to run SQL
const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  },
  body: JSON.stringify({ sql }),
});

if (!response.ok) {
  // Try using pg_query directly
  const pgResponse = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (!pgResponse.ok) {
    console.log('Trying direct SQL via Supabase...');
    // Try each statement separately
    const statements = [
      `CREATE TABLE IF NOT EXISTS assinaturas (
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
      )`,
      `CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
        id SERIAL PRIMARY KEY,
        assinatura_id INTEGER NOT NULL,
        cliente_id INTEGER NOT NULL,
        valor_pago DECIMAL(15,2) NOT NULL,
        data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        mes_referencia VARCHAR(7) NOT NULL,
        conta_caixa_id INTEGER,
        observacoes TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      )`
    ];
    
    for (const stmt of statements) {
      const r = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ query: stmt }),
      });
      console.log('Statement result:', r.status, await r.text().catch(() => ''));
    }
  } else {
    console.log('PG query result:', pgResponse.status);
  }
} else {
  console.log('Tables created successfully!');
}

// Verify tables exist by trying to select from them
const { data: assinaturas, error: err1 } = await supabase.from('assinaturas').select('id').limit(1);
if (err1) {
  console.log('assinaturas table check failed:', err1.message);
} else {
  console.log('✅ assinaturas table exists');
}

const { data: pagamentos, error: err2 } = await supabase.from('pagamentos_assinatura').select('id').limit(1);
if (err2) {
  console.log('pagamentos_assinatura table check failed:', err2.message);
} else {
  console.log('✅ pagamentos_assinatura table exists');
}
