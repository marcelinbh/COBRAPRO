// Script para criar tabelas vendas_telefone no Supabase PostgreSQL
// Usa postgres-js (já disponível no projeto)
import postgres from './node_modules/postgres/src/index.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectId = SUPABASE_URL.replace('https://', '').split('.')[0];

console.log('Project ID:', projectId);

// Tentar diferentes connection strings do Supabase
const connectionStrings = [
  // Transaction pooler IPv4 (port 6543)
  `postgresql://postgres.${projectId}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  // Session pooler (port 5432)
  `postgresql://postgres.${projectId}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
];

for (const cs of connectionStrings) {
  const masked = cs.replace(SUPABASE_SERVICE_ROLE_KEY, '***');
  console.log('\nTrying:', masked.substring(0, 100));
  
  const sql = postgres(cs, {
    ssl: 'require',
    connect_timeout: 10,
    max: 1,
  });
  
  try {
    const result = await sql`SELECT current_database()`;
    console.log('Connected! DB:', result[0].current_database);
    
    // Criar enum status_venda_telefone
    await sql`
      DO $$ BEGIN
        CREATE TYPE status_venda_telefone AS ENUM ('ativo', 'quitado', 'cancelado');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `;
    console.log('Enum status_venda_telefone OK');
    
    // Criar tabela vendas_telefone
    await sql`
      CREATE TABLE IF NOT EXISTS vendas_telefone (
        id BIGSERIAL PRIMARY KEY,
        marca VARCHAR(100) NOT NULL,
        modelo VARCHAR(200) NOT NULL,
        imei VARCHAR(20),
        cor VARCHAR(50),
        armazenamento VARCHAR(20),
        custo NUMERIC(12,2) NOT NULL,
        preco_venda NUMERIC(12,2) NOT NULL,
        entrada_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
        entrada_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
        num_parcelas INTEGER NOT NULL DEFAULT 1,
        juros_mensal NUMERIC(5,2) NOT NULL DEFAULT 0,
        valor_parcela NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_juros NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_a_receber NUMERIC(12,2) NOT NULL DEFAULT 0,
        lucro_bruto NUMERIC(12,2) NOT NULL DEFAULT 0,
        roi NUMERIC(8,2),
        payback_meses NUMERIC(5,2),
        comprador_nome VARCHAR(200) NOT NULL,
        comprador_cpf VARCHAR(14),
        comprador_rg VARCHAR(20),
        comprador_telefone VARCHAR(20),
        comprador_email VARCHAR(320),
        comprador_estado_civil VARCHAR(30),
        comprador_profissao VARCHAR(100),
        comprador_instagram VARCHAR(100),
        comprador_cep VARCHAR(9),
        comprador_cidade VARCHAR(100),
        comprador_estado VARCHAR(2),
        comprador_endereco VARCHAR(300),
        comprador_local_trabalho VARCHAR(200),
        status status_venda_telefone NOT NULL DEFAULT 'ativo',
        data_venda TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('Table vendas_telefone created!');
    
    // Criar tabela parcelas_venda_telefone
    await sql`
      CREATE TABLE IF NOT EXISTS parcelas_venda_telefone (
        id BIGSERIAL PRIMARY KEY,
        venda_id BIGINT NOT NULL REFERENCES vendas_telefone(id) ON DELETE CASCADE,
        numero INTEGER NOT NULL,
        valor NUMERIC(12,2) NOT NULL,
        vencimento TIMESTAMPTZ NOT NULL,
        status status_parcela NOT NULL DEFAULT 'pendente',
        pago_em TIMESTAMPTZ,
        valor_pago NUMERIC(12,2),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('Table parcelas_venda_telefone created!');
    
    // Verificar tabelas criadas
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('vendas_telefone', 'parcelas_venda_telefone')
    `;
    console.log('\nTables verified:', tables.map(t => t.table_name));
    
    await sql.end();
    console.log('\nAll done!');
    process.exit(0);
  } catch (err) {
    console.log('Failed:', err.message.substring(0, 200));
    await sql.end().catch(() => {});
  }
}

console.log('\nAll connection attempts failed.');
process.exit(1);
