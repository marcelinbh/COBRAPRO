import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE TABLE IF NOT EXISTS public.vendas (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  cliente_id INTEGER,
  produto_id INTEGER,
  produto VARCHAR(255) NOT NULL,
  quantidade INTEGER DEFAULT 1 NOT NULL,
  valor_unitario NUMERIC(15, 2) NOT NULL,
  valor_total NUMERIC(15, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'concluida' NOT NULL,
  forma_pagamento VARCHAR(50) DEFAULT 'dinheiro',
  data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`;

async function createTable() {
  try {
    const { data, error } = await client.rpc("exec_sql", { sql });
    if (error) {
      console.error("Error creating table:", error);
      process.exit(1);
    }
    console.log("Table vendas created successfully!");
  } catch (e) {
    console.error("Exception:", e);
    process.exit(1);
  }
}

createTable();
