import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos');
  process.exit(1);
}

const supabase = createClient(url, key);

// Executar via fetch direto para a Management API do Supabase
// Extrair o project ref da URL
const projectRef = url.replace('https://', '').split('.')[0];
console.log('Project ref:', projectRef);

// Usar o endpoint de SQL do Supabase
const sql = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS nome_empresa varchar(255);
`;

// Tentar via REST API com service role
const response = await fetch(`${url}/rest/v1/`, {
  method: 'GET',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  }
});
console.log('REST status:', response.status);

// Usar o Supabase client para verificar se as colunas já existem
const { data: cols, error: colsErr } = await supabase
  .from('users')
  .select('onboarding_completo, nome_empresa')
  .limit(1);

if (colsErr) {
  console.log('Colunas NÃO existem:', colsErr.message);
  
  // Tentar via pg direto
  const { default: postgres } = await import('postgres');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }
  
  const sql_client = postgres(dbUrl, { ssl: 'require', max: 1 });
  try {
    await sql_client`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false`;
    console.log('✅ Coluna onboarding_completo adicionada');
    await sql_client`ALTER TABLE users ADD COLUMN IF NOT EXISTS nome_empresa varchar(255)`;
    console.log('✅ Coluna nome_empresa adicionada');
  } catch (err) {
    console.error('Erro ao adicionar colunas:', err.message);
  } finally {
    await sql_client.end();
  }
} else {
  console.log('✅ Colunas já existem:', cols);
}
