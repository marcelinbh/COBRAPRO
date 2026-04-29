/**
 * Script de migração DDL usando DNS customizado (Google/Cloudflare)
 * para resolver o hostname do Supabase PostgreSQL
 */
import dns from 'dns';
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);

// Load env
try {
  const dotenv = require('dotenv');
  dotenv.config();
} catch(e) {}

const supabaseUrl = process.env.SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

console.log('Project ref:', projectRef);
console.log('DB Password:', dbPassword ? 'OK' : 'MISSING');

// Force IPv4
dns.setDefaultResultOrder('ipv4first');

// Custom DNS resolver using Google/Cloudflare
const dnsResolver = new dns.Resolver();
dnsResolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// Resolve the pooler hostname
const poolerHost = `aws-0-us-east-1.pooler.supabase.com`;

async function resolveHost(hostname) {
  return new Promise((resolve, reject) => {
    dnsResolver.resolve4(hostname, (err, addresses) => {
      if (err) {
        // Try system DNS as fallback
        dns.resolve4(hostname, (err2, addrs) => {
          if (err2) reject(err2);
          else resolve(addrs[0]);
        });
      } else {
        resolve(addresses[0]);
      }
    });
  });
}

async function main() {
  const { Client } = require('pg');
  
  // Try different connection strings
  const configs = [
    // Pooler session mode (port 5432) - supports DDL
    {
      host: poolerHost,
      port: 5432,
      database: 'postgres',
      user: `postgres.${projectRef}`,
      password: dbPassword,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    },
    // Pooler transaction mode (port 6543)
    {
      host: poolerHost,
      port: 6543,
      database: 'postgres', 
      user: `postgres.${projectRef}`,
      password: dbPassword,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    },
  ];

  // Try to resolve the hostname first
  let resolvedIp = null;
  try {
    resolvedIp = await resolveHost(poolerHost);
    console.log(`Resolved ${poolerHost} → ${resolvedIp}`);
  } catch(e) {
    console.log('DNS resolution failed:', e.message);
  }

  for (const config of configs) {
    // Use resolved IP if available
    const connectConfig = resolvedIp 
      ? { ...config, host: resolvedIp }
      : config;
    
    console.log(`\nTrying ${config.host}:${config.port} (${resolvedIp || 'unresolved'})...`);
    
    const client = new Client(connectConfig);
    try {
      await client.connect();
      console.log('✅ Connected!');
      
      // Execute DDL
      const sqls = [
        `ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS saldo_residual NUMERIC(15,2) DEFAULT 0.00 NOT NULL`,
        `ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS multa_diaria_usada NUMERIC(15,2) DEFAULT 0.00`,
        `COMMENT ON COLUMN parcelas.saldo_residual IS 'Saldo residual de pagamento parcial anterior'`,
        `COMMENT ON COLUMN parcelas.multa_diaria_usada IS 'Valor da multa diária aplicada no pagamento'`,
      ];
      
      for (const sqlStr of sqls) {
        const result = await client.query(sqlStr);
        console.log(`✅ ${sqlStr.substring(0, 60)}... → ${result.command}`);
      }
      
      // Verify
      const verify = await client.query(
        `SELECT column_name, data_type, column_default 
         FROM information_schema.columns 
         WHERE table_name = 'parcelas' 
         AND column_name IN ('saldo_residual', 'multa_diaria_usada')
         ORDER BY column_name`
      );
      console.log('\n✅ Columns verified:', JSON.stringify(verify.rows, null, 2));
      
      await client.end();
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    } catch(e) {
      console.log(`❌ Failed: ${e.message}`);
      try { await client.end(); } catch(_) {}
    }
  }
  
  console.log('\n❌ All connection attempts failed');
  process.exit(1);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
