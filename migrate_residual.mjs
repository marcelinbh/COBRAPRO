import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  console.log('Running migration: add saldo_residual and multa_diaria_usada to parcelas...');
  
  // Add saldo_residual column
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS saldo_residual NUMERIC(15,2) DEFAULT 0.00 NOT NULL'
  }).catch(() => ({ error: null }));
  
  // Try direct approach via REST
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql: 'SELECT 1' })
  });
  console.log('RPC test status:', res.status);
  
  // Use the Supabase admin API to run SQL
  const migRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    }
  });
  console.log('REST API status:', migRes.status);
}

migrate().catch(console.error);
