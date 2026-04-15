import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Check if table exists
const { data: existing, error: checkError } = await supabase
  .from('vendas_telefone')
  .select('id')
  .limit(1);

if (!checkError) {
  console.log('Table vendas_telefone already exists!');
  process.exit(0);
}

console.log('Table does not exist, error:', checkError.message);
console.log('Need to create via SQL...');

// Use the Supabase SQL API (available via the REST API with service role)
const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  }
});
console.log('REST API status:', response.status);

// Try using pg via the Supabase client's internal methods
// The @supabase/supabase-js client doesn't expose raw SQL execution
// But we can use the Supabase Management API

// Alternative: create a tRPC endpoint that creates the tables
// Let's check if there's a way to run raw SQL via the Supabase client
console.log('\nTrying via fetch to Supabase SQL endpoint...');

const sqlResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sql: 'SELECT 1' })
});
const sqlBody = await sqlResponse.text();
console.log('exec_sql status:', sqlResponse.status, sqlBody.substring(0, 200));
