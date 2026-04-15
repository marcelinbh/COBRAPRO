import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();

const pg = require('pg');
const { Client } = pg;

const pass = process.env.SUPABASE_DB_PASSWORD;
const projectId = 'oxvtmibrgjruldkouhhb';

console.log('Password available:', !!pass);

// Tentar conexão via direct connection (porta 5432)
const client = new Client({
  host: `db.${projectId}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: pass,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

const SQL = `
CREATE TABLE IF NOT EXISTS assinaturas (
  id bigserial PRIMARY KEY,
  cliente_id integer NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  servico varchar(255) NOT NULL,
  descricao text,
  valor_mensal decimal(15,2) NOT NULL DEFAULT 0.00,
  dia_vencimento integer NOT NULL DEFAULT 1,
  status varchar(50) NOT NULL DEFAULT 'ativa',
  data_inicio date NOT NULL,
  data_fim date,
  observacoes text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
  id bigserial PRIMARY KEY,
  assinatura_id bigint NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  valor decimal(15,2) NOT NULL,
  data_pagamento date NOT NULL,
  mes_referencia varchar(7) NOT NULL,
  forma_pagamento varchar(100),
  observacoes text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
`;

try {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL!');
  await client.query(SQL);
  console.log('Tables created successfully!');
  await client.end();
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
