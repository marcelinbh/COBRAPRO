// Script para aplicar migration da tabela contrato_historico via Supabase REST API
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);

// Use undici with custom DNS resolver (same as server/db.ts)
import { fetch as undiciFetch, Agent } from 'undici';

const dnsResolver = new dns.Resolver();
dnsResolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

const dnsCache = new Map();

const agent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      const cached = dnsCache.get(hostname);
      if (cached && cached.expires > Date.now()) {
        return callback(null, cached.address, 4);
      }
      dnsResolver.resolve4(hostname, (err, addresses) => {
        if (err || !addresses || addresses.length === 0) {
          // Fallback to system DNS
          dns.lookup(hostname, { family: 4 }, (err2, address) => {
            if (err2) return callback(err2, '', 4);
            dnsCache.set(hostname, { address, expires: Date.now() + 30000 });
            callback(null, address, 4);
          });
          return;
        }
        const address = addresses[0];
        dnsCache.set(hostname, { address, expires: Date.now() + 30000 });
        callback(null, address, 4);
      });
    }
  }
});

const customFetch = (url, options) => undiciFetch(url, { ...options, dispatcher: agent });

// Try to check if table exists
const checkResponse = await customFetch(`${supabaseUrl}/rest/v1/contrato_historico?limit=1`, {
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  },
});
console.log('Table check status:', checkResponse.status);

if (checkResponse.status === 200) {
  console.log('Table contrato_historico already exists!');
  process.exit(0);
}

console.log('Table does not exist, creating...');
// We need to create the table - use the Supabase Management API
// The Management API requires a personal access token, not service role key
// Let's try a different approach: use the SQL API endpoint

// Supabase has a SQL endpoint at /rest/v1/rpc/exec_sql for service role
// But it requires a custom function. Let's try the direct SQL endpoint.

// Actually, the best approach is to use the Supabase client's rpc method
// with a raw SQL execution function that we can create first

// Let's try the pg_dump/restore approach via the Supabase API
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: customFetch },
});

// Try to create the enum type first
const { data: enumData, error: enumError } = await supabase.rpc('exec_sql', {
  sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_alteracao') THEN CREATE TYPE tipo_alteracao AS ENUM ('edicao_juros', 'aplicacao_multa', 'edicao_parcela', 'edicao_contrato', 'pagamento', 'pagamento_juros', 'reparcelamento', 'criacao'); END IF; END $$`
});

console.log('Enum creation result:', enumData, enumError?.message);

const { data: tableData, error: tableError } = await supabase.rpc('exec_sql', {
  sql: `CREATE TABLE IF NOT EXISTS contrato_historico (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, contrato_id INTEGER NOT NULL, tipo tipo_alteracao NOT NULL, descricao TEXT NOT NULL, valor_anterior TEXT, valor_novo TEXT, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL)`
});

console.log('Table creation result:', tableData, tableError?.message);
