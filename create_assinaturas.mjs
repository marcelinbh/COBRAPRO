import postgres from 'postgres';

const projectRef = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];
const dbPass = process.env.SUPABASE_DB_PASSWORD;

if (!projectRef || !dbPass) {
  console.error('Missing SUPABASE_URL or SUPABASE_DB_PASSWORD');
  process.exit(1);
}

// Try both pooler and direct connection
const connectionStrings = [
  `postgresql://postgres.${projectRef}:${dbPass}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${dbPass}@db.${projectRef}.supabase.co:5432/postgres`,
];

let connected = false;
for (const connStr of connectionStrings) {
  console.log('Trying:', connStr.replace(dbPass, '***'));
  try {
    const sql = postgres(connStr, { ssl: 'require', max: 1, connect_timeout: 10 });
    
    await sql`
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
      )
    `;
    console.log('✅ Table assinaturas created successfully');

    await sql`
      CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
        id BIGSERIAL PRIMARY KEY,
        assinatura_id BIGINT NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
        valor_pago NUMERIC(10,2) NOT NULL,
        data_pagamento TIMESTAMPTZ DEFAULT NOW(),
        mes_referencia TEXT NOT NULL,
        forma_pagamento TEXT DEFAULT 'dinheiro',
        observacoes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Table pagamentos_assinatura created successfully');
    
    await sql.end();
    connected = true;
    break;
  } catch (err) {
    console.error('Failed:', err.message);
  }
}

if (!connected) {
  console.error('All connection attempts failed');
  process.exit(1);
}
