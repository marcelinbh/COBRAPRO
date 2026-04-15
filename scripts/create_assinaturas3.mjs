import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Try to insert a test row to see if the table exists
const { error: checkErr } = await supabase.from('assinaturas').select('id').limit(1);
if (!checkErr) {
  console.log('✅ assinaturas table already exists');
} else {
  console.log('Table does not exist:', checkErr.message);
  console.log('Need to create via Supabase dashboard SQL editor or another method');
}

// Check pagamentos_assinatura
const { error: checkErr2 } = await supabase.from('pagamentos_assinatura').select('id').limit(1);
if (!checkErr2) {
  console.log('✅ pagamentos_assinatura table already exists');
} else {
  console.log('pagamentos_assinatura does not exist:', checkErr2.message);
}

// Try using the Supabase SQL endpoint via the service role key
// This uses the /rest/v1/ endpoint with a special header
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

const sqlStatements = [
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

for (const sql of sqlStatements) {
  // Try via Supabase's built-in SQL execution via the db endpoint
  const r = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ sql }),
  });
  console.log(`RPC exec: ${r.status}`, await r.text().catch(() => ''));
}

// Try using postgres directly
import postgres from 'postgres';
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  console.log('\nTrying direct PostgreSQL connection...');
  const sql = postgres(dbUrl, { ssl: 'require', connect_timeout: 10 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS assinaturas (
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
    console.log('✅ assinaturas table created via direct PostgreSQL');
    
    await sql`CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
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
    console.log('✅ pagamentos_assinatura table created via direct PostgreSQL');
    await sql.end();
  } catch (e) {
    console.error('Direct PostgreSQL failed:', e.message);
    await sql.end().catch(() => {});
  }
}
