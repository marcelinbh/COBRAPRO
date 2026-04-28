import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos');
  process.exit(1);
}

const supabase = createClient(url, key);
const projectRef = url.replace('https://', '').split('.')[0];
console.log('Project ref:', projectRef);

// Verificar se a tabela já existe
const { data: check, error: checkErr } = await supabase.from('contrato_historico').select('id').limit(1);
if (!checkErr) {
  console.log('✅ Tabela contrato_historico já existe!');
  process.exit(0);
}
console.log('Tabela não existe, criando...');

// Tentar via Management API do Supabase (requer service role)
const createSQL = `
CREATE TABLE IF NOT EXISTS contrato_historico (
  id BIGSERIAL PRIMARY KEY,
  contrato_id BIGINT NOT NULL,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  valor_anterior NUMERIC(15,2),
  valor_novo NUMERIC(15,2),
  campo_alterado TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contrato_historico_contrato_id ON contrato_historico(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_historico_user_id ON contrato_historico(user_id);
`;

// Tentar via pg direto
try {
  const { default: postgres } = await import('postgres');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL não definida');
  
  const sql_client = postgres(dbUrl, { ssl: 'require', max: 1, connect_timeout: 10 });
  try {
    await sql_client.unsafe(createSQL);
    console.log('✅ Tabela contrato_historico criada via PostgreSQL direto!');
  } finally {
    await sql_client.end();
  }
} catch (pgErr) {
  console.log('PostgreSQL direto falhou:', pgErr.message);
  
  // Tentar via Management API
  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  try {
    const resp = await fetch(mgmtUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({ query: createSQL }),
    });
    const result = await resp.text();
    console.log('Management API status:', resp.status, result.slice(0, 200));
  } catch (mgmtErr) {
    console.log('Management API falhou:', mgmtErr.message);
    console.log('⚠️  Não foi possível criar a tabela automaticamente.');
    console.log('Execute o seguinte SQL no Supabase Dashboard:');
    console.log(createSQL);
  }
}
