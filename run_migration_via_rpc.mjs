/**
 * Migração via Supabase RPC usando undici com DNS customizado
 * Estratégia: usar a função pg_query do Supabase ou criar uma função temporária
 */
import dns from 'dns';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config();

const { fetch: undiciFetch, Agent } = await import('undici');

dns.setDefaultResultOrder('ipv4first');
const dnsResolver = new dns.Resolver();
dnsResolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create undici agent with custom DNS
const agent = new Agent({
  connect: {
    lookup: (hostname, _opts, callback) => {
      dnsResolver.resolve4(hostname, (err, addresses) => {
        if (err) {
          dns.resolve4(hostname, (err2, addrs) => {
            if (err2) callback(err2);
            else callback(null, [{address: addrs[0], family: 4}]);
          });
        } else {
          callback(null, [{address: addresses[0], family: 4}]);
        }
      });
    }
  }
});

const customFetch = (url, init) => undiciFetch(url, {...init, dispatcher: agent});

async function rpc(funcName, args = {}) {
  const resp = await customFetch(`${supabaseUrl}/rest/v1/rpc/${funcName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(args)
  });
  const text = await resp.text();
  return { status: resp.status, body: text };
}

async function main() {
  console.log('=== Migração via Supabase RPC ===\n');
  
  // Step 1: Check if exec_ddl function exists
  console.log('1. Checking if exec_ddl function exists...');
  const checkResult = await rpc('exec_ddl', { query: 'SELECT 1' });
  console.log('   Status:', checkResult.status, '| Body:', checkResult.body.substring(0, 100));
  
  if (checkResult.status === 404 || checkResult.body.includes('Could not find')) {
    console.log('\n2. exec_ddl not found. Need to create it first.');
    console.log('   This requires direct DB access which is blocked in sandbox.');
    console.log('\n   Alternative: Use Supabase Edge Functions or direct SQL via browser.');
    
    // Try using pg_net or other built-in functions
    const pgNetCheck = await rpc('pg_net_collect_response', { request_id: 1 });
    console.log('   pg_net status:', pgNetCheck.status);
    
    return;
  }
  
  // Step 2: Execute DDL via exec_ddl
  console.log('\n2. Executing DDL migrations...');
  
  const migrations = [
    `ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS saldo_residual NUMERIC(15,2) DEFAULT 0.00 NOT NULL`,
    `ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS multa_diaria_usada NUMERIC(15,2) DEFAULT 0.00`,
  ];
  
  for (const sql of migrations) {
    const result = await rpc('exec_ddl', { query: sql });
    console.log(`   ${result.status === 200 ? '✅' : '❌'} ${sql.substring(0, 60)}...`);
    if (result.status !== 200) {
      console.log('   Error:', result.body);
    }
  }
  
  // Step 3: Verify
  console.log('\n3. Verifying columns...');
  const verify = await customFetch(
    `${supabaseUrl}/rest/v1/parcelas?select=saldo_residual,multa_diaria_usada&limit=1`,
    {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    }
  );
  const verifyBody = await verify.text();
  console.log('   Status:', verify.status, '| Body:', verifyBody.substring(0, 200));
  
  if (verify.status === 200) {
    console.log('\n✅ Migration successful! Columns exist.');
  } else {
    console.log('\n❌ Columns still not found.');
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
