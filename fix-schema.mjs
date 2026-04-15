import 'dotenv/config';

// Tentar via REST API diretamente
const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({
    sql: "SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conname = 'parcelas_status_check';"
  })
});
const result = await response.json();
console.log('exec_sql result:', JSON.stringify(result));

// Tentar via pg_meta
const response2 = await fetch(`${process.env.SUPABASE_URL}/pg/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({
    query: "SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conname = 'parcelas_status_check';"
  })
});
const result2 = await response2.json();
console.log('pg/query result:', JSON.stringify(result2));
