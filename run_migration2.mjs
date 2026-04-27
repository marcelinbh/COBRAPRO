// Usar a URL de conexão direta do Supabase (pooler) para executar a migration
import postgres from 'postgres';

const supabaseUrl = process.env.SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !dbPassword) {
  console.error('SUPABASE_URL ou SUPABASE_DB_PASSWORD não definidos');
  process.exit(1);
}

// Montar a URL de conexão via pooler (porta 5432 - session mode)
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
const dbUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

console.log('Conectando ao banco via pooler...');
console.log('Project ref:', projectRef);

const sql = postgres(dbUrl, { 
  ssl: 'require', 
  max: 1,
  connect_timeout: 15,
  idle_timeout: 10,
});

try {
  // Verificar se as colunas já existem
  const check = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name IN ('onboarding_completo', 'nome_empresa')
  `;
  console.log('Colunas existentes:', check.map(r => r.column_name));

  if (!check.find(r => r.column_name === 'onboarding_completo')) {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false`;
    console.log('✅ Coluna onboarding_completo adicionada');
  } else {
    console.log('ℹ️  Coluna onboarding_completo já existe');
  }

  if (!check.find(r => r.column_name === 'nome_empresa')) {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nome_empresa varchar(255)`;
    console.log('✅ Coluna nome_empresa adicionada');
  } else {
    console.log('ℹ️  Coluna nome_empresa já existe');
  }

  // Verificar resultado
  const result = await sql`SELECT id, email, onboarding_completo, nome_empresa FROM users LIMIT 5`;
  console.log('Usuários:', result);

} catch (err) {
  console.error('Erro:', err.message);
} finally {
  await sql.end();
}
