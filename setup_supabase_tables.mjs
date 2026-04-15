// Try to create tables using Supabase's pg_net or direct connection
// The Supabase project has a direct PostgreSQL connection available
// via the pooler URL format: postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oxvtmibrgjruldkouhhb.supabase.co';
const SERVICE_KEY = 'sb_secret_kC8jHwgYFeNBqi1kKAavHg_VR57TFuZ';
const PROJECT_ID = 'oxvtmibrgjruldkouhhb';

// Try using the Supabase Management API to run SQL
// This requires a Personal Access Token, not service role key
// Let's try a different approach: use the REST API to call a stored procedure

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Check if we can use the pg_net extension or exec_sql function
const { data: rpcTest, error: rpcErr } = await supabase.rpc('exec_sql', { 
  query: 'SELECT 1' 
});
console.log('RPC exec_sql test:', rpcErr?.message ?? 'OK', rpcTest);

// Try another approach - use the Supabase REST API v1 for SQL execution
const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
  },
  body: JSON.stringify({ query: 'SELECT 1' }),
});
console.log('Management API status:', response.status);
const text = await response.text();
console.log('Response:', text.slice(0, 200));
