import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oxvtmibrgjruldkouhhb.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_kC8jHwgYFeNBqi1kKAavHg_VR57TFuZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Test connection first
console.log('Testing Supabase connection...');
const { data: test, error: testErr } = await supabase.from('contratos').select('id').limit(1);
if (testErr) {
  console.error('Connection test failed:', testErr.message);
} else {
  console.log('✅ Connected! Found contratos:', test?.length ?? 0);
}

// Try to insert a test record to see if vendas_telefone exists
const { error: checkErr } = await supabase.from('vendas_telefone').select('id').limit(1);
if (!checkErr) {
  console.log('✅ Table vendas_telefone already exists!');
  process.exit(0);
}

console.log('Table does not exist, need to create via SQL...');
console.log('Error:', checkErr.message);

// The table doesn't exist - we need to create it
// Try using the Supabase REST API to execute SQL via the pg_net extension or similar
// Actually, we'll create a tRPC endpoint to run the setup SQL

console.log('\nThe table needs to be created via SQL. The Supabase REST API does not support DDL.');
console.log('Solution: Use the server-side setup endpoint.');
