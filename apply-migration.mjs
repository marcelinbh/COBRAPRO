import 'dotenv/config';

const projectId = 'oxvtmibrgjruldkouhhb';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// SQL para corrigir o schema
const migrationSQL = `
-- 1. Verificar e corrigir o enum status_parcela
-- Primeiro, verificar o enum atual
SELECT enumlabel FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'status_parcela'
ORDER BY enumsortorder;
`;

// Tentar via Supabase Management API
const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
  },
  body: JSON.stringify({ query: migrationSQL })
});

console.log('Status:', response.status);
const result = await response.json();
console.log('Result:', JSON.stringify(result, null, 2));

// Tentar via Supabase REST API com pg_meta
const response2 = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/tables`, {
  headers: {
    'Authorization': `Bearer ${serviceRoleKey}`,
  }
});
console.log('Tables API status:', response2.status);
const result2 = await response2.json();
console.log('Tables:', JSON.stringify(result2).substring(0, 200));
