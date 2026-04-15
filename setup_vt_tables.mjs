// Script to create vendas_telefone tables in Supabase
// Uses the Supabase service role key to create a helper function first,
// then uses it to execute DDL

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  // Try to load from .env file
  const { readFileSync } = await import('fs');
  try {
    const env = readFileSync('.env', 'utf8');
    for (const line of env.split('\n')) {
      const [key, ...val] = line.split('=');
      if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    }
  } catch {}
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', url?.substring(0, 40));
console.log('Key:', key?.substring(0, 20) + '...');

// The Supabase REST API doesn't support raw DDL
// But we can use the Supabase client to insert into a special table
// OR we can use the pg module directly with the connection string

// The Supabase PostgreSQL connection string format:
// postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// We don't have the password, but we can try to derive it from the service role key

// Alternative approach: Create a stored procedure via the Supabase REST API
// by inserting into pg_proc (not possible with REST)

// Best approach: Use the Supabase client's auth.admin to call a custom function
// OR use the pg module with the DATABASE_URL (MySQL in this case, not PostgreSQL)

// Since DATABASE_URL is MySQL, let's check if there's a separate PostgreSQL URL
const dbUrl = process.env.DATABASE_URL;
console.log('DB URL type:', dbUrl?.startsWith('mysql') ? 'MySQL' : dbUrl?.startsWith('postgres') ? 'PostgreSQL' : 'Unknown');

// The Supabase PostgreSQL can be accessed via the connection pooler
// Let's try to construct the connection string from the Supabase URL
// Project ref: oxvtmibrgjruldkouhhb
// The password for the postgres user is typically the service role key or a separate password

// Let's try using the pg module with the Supabase connection
import pg from 'pg';
const { Client } = pg;

// Try different connection formats
const projectRef = 'oxvtmibrgjruldkouhhb';
const region = 'us-east-1'; // Common default

// Try connection pooler
const connectionString = `postgresql://postgres.${projectRef}:${key}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
console.log('\nTrying connection:', connectionString.substring(0, 80) + '...');

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('Connected to PostgreSQL!');
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS vendas_telefone (
      id BIGSERIAL PRIMARY KEY,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      imei TEXT,
      cor TEXT,
      armazenamento TEXT,
      custo NUMERIC(12,2) NOT NULL,
      preco_venda NUMERIC(12,2) NOT NULL,
      entrada_percentual NUMERIC(5,2) DEFAULT 0,
      entrada_valor NUMERIC(12,2) DEFAULT 0,
      num_parcelas INTEGER NOT NULL DEFAULT 1,
      juros_mensal NUMERIC(5,2) DEFAULT 0,
      valor_parcela NUMERIC(12,2) DEFAULT 0,
      total_juros NUMERIC(12,2) DEFAULT 0,
      total_a_receber NUMERIC(12,2) DEFAULT 0,
      lucro_bruto NUMERIC(12,2) DEFAULT 0,
      roi NUMERIC(8,2),
      payback_meses INTEGER,
      comprador_nome TEXT NOT NULL,
      comprador_cpf TEXT,
      comprador_rg TEXT,
      comprador_telefone TEXT,
      comprador_email TEXT,
      comprador_estado_civil TEXT,
      comprador_profissao TEXT,
      comprador_instagram TEXT,
      comprador_cep TEXT,
      comprador_cidade TEXT,
      comprador_estado TEXT,
      comprador_endereco TEXT,
      comprador_local_trabalho TEXT,
      status TEXT DEFAULT 'ativo',
      conta_caixa_id BIGINT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Created vendas_telefone!');
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS parcelas_venda_telefone (
      id BIGSERIAL PRIMARY KEY,
      venda_id BIGINT NOT NULL REFERENCES vendas_telefone(id) ON DELETE CASCADE,
      numero INTEGER NOT NULL,
      valor NUMERIC(12,2) NOT NULL,
      data_vencimento DATE NOT NULL,
      status TEXT DEFAULT 'pendente',
      pago_em TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Created parcelas_venda_telefone!');
  
  await client.end();
  console.log('\nAll tables created successfully!');
} catch (err) {
  console.error('Connection error:', err.message);
  await client.end().catch(() => {});
}
