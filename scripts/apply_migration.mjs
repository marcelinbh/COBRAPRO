/**
 * Apply SQL migration via Supabase Management API
 * Uses the service_role key to authenticate
 */
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

console.log('Project ref:', PROJECT_REF);

// The SQL to execute
const sql = `
DO $$ BEGIN
  CREATE TYPE "status_assinatura" AS ENUM ('ativa', 'cancelada', 'suspensa', 'inadimplente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "assinaturas" (
  "id" serial PRIMARY KEY NOT NULL,
  "cliente_id" integer NOT NULL,
  "servico" varchar(200) NOT NULL,
  "descricao" text,
  "valor_mensal" numeric(15,2) NOT NULL,
  "dia_vencimento" integer NOT NULL DEFAULT 10,
  "status" "status_assinatura" DEFAULT 'ativa' NOT NULL,
  "data_inicio" date NOT NULL,
  "data_cancelamento" date,
  "conta_caixa_id" integer,
  "observacoes" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pagamentos_assinatura" (
  "id" serial PRIMARY KEY NOT NULL,
  "assinatura_id" integer NOT NULL,
  "cliente_id" integer NOT NULL,
  "valor_pago" numeric(15,2) NOT NULL,
  "data_pagamento" timestamp with time zone DEFAULT now() NOT NULL,
  "mes_referencia" varchar(7) NOT NULL,
  "conta_caixa_id" integer,
  "observacoes" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
`;

// Try Supabase Management API v1
const endpoints = [
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations`,
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/sql`,
];

for (const endpoint of endpoints) {
  console.log('\nTrying:', endpoint);
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql, name: 'create_assinaturas' }),
  });
  const text = await r.text();
  console.log(`Status: ${r.status}`, text.substring(0, 300));
  if (r.ok) {
    console.log('✅ Migration applied successfully!');
    break;
  }
}

// Verify tables exist
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const { error: e1 } = await supabase.from('assinaturas').select('id').limit(1);
console.log('\nassinaturas:', e1 ? '❌ ' + e1.message : '✅ exists');

const { error: e2 } = await supabase.from('pagamentos_assinatura').select('id').limit(1);
console.log('pagamentos_assinatura:', e2 ? '❌ ' + e2.message : '✅ exists');
