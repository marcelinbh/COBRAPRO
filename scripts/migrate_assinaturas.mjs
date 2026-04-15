import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: '/home/ubuntu/cobrapro/.env' });

const projectRef = 'oxvtmibrgjruldkouhhb';
const password = process.env.SUPABASE_DB_PASSWORD;

const urls = [
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-2.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
];

const sql = `
DO $$ BEGIN
  CREATE TYPE status_assinatura AS ENUM ('ativa', 'cancelada', 'suspensa', 'inadimplente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS assinaturas (
  id serial PRIMARY KEY NOT NULL,
  cliente_id integer NOT NULL,
  servico varchar(200) NOT NULL,
  descricao text,
  valor_mensal numeric(15,2) NOT NULL,
  dia_vencimento integer NOT NULL DEFAULT 10,
  status status_assinatura DEFAULT 'ativa' NOT NULL,
  data_inicio date NOT NULL,
  data_cancelamento date,
  conta_caixa_id integer,
  observacoes text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
  id serial PRIMARY KEY NOT NULL,
  assinatura_id integer NOT NULL,
  cliente_id integer NOT NULL,
  valor_pago numeric(15,2) NOT NULL,
  data_pagamento timestamp with time zone DEFAULT now() NOT NULL,
  mes_referencia varchar(7) NOT NULL,
  conta_caixa_id integer,
  observacoes text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
`;

const postgres = (await import('/home/ubuntu/cobrapro/node_modules/postgres/src/index.js')).default;

for (const url of urls) {
  const safeUrl = url.replace(encodeURIComponent(password), '***');
  console.log(`\nTrying: ${safeUrl}`);
  try {
    const client = postgres(url, {
      ssl: 'require',
      connect_timeout: 10,
      max: 1,
    });
    await Promise.race([
      client.unsafe(sql),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000)),
    ]);
    console.log('✅ Migration applied successfully!');
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log(`❌ Failed: ${e.message}`);
  }
}

console.log('\n❌ All connection attempts failed. Please run the SQL manually in Supabase Dashboard.');
process.exit(1);
