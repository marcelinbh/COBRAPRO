/**
 * Run migration using postgres.js directly
 * This works when DATABASE_URL is available (direct PostgreSQL connection)
 */
import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

console.log('Connecting to PostgreSQL...');
const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  connect_timeout: 15,
  max: 1,
});

try {
  // Test connection
  const result = await sql`SELECT 1 as test`;
  console.log('✅ Connected to PostgreSQL');
  
  // Create enum
  await sql`
    DO $$ BEGIN
      CREATE TYPE status_assinatura AS ENUM ('ativa', 'cancelada', 'suspensa', 'inadimplente');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;
  console.log('✅ Enum status_assinatura created/exists');
  
  // Create assinaturas table
  await sql`
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
    )
  `;
  console.log('✅ Table assinaturas created/exists');
  
  // Create pagamentos_assinatura table
  await sql`
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
    )
  `;
  console.log('✅ Table pagamentos_assinatura created/exists');
  
  // Verify
  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('assinaturas', 'pagamentos_assinatura')
    ORDER BY table_name
  `;
  console.log('\n📋 Tables verified:', tables.map(t => t.table_name));
  
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  console.error(err);
} finally {
  await sql.end();
}
