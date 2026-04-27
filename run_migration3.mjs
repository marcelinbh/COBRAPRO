import postgres from 'postgres';

const supabaseUrl = process.env.SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

// Tentar diferentes URLs de conexão
const urls = [
  // Pooler transaction mode (porta 6543)
  `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  // Pooler session mode (porta 5432)  
  `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  // Direto (porta 5432)
  `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
];

for (const dbUrl of urls) {
  const masked = dbUrl.replace(dbPassword, '***');
  console.log('\nTentando:', masked);
  
  const sql = postgres(dbUrl, { 
    ssl: 'require', 
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
  });

  try {
    const check = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('onboarding_completo', 'nome_empresa')
    `;
    console.log('✅ Conectado! Colunas existentes:', check.map(r => r.column_name));

    if (!check.find(r => r.column_name === 'onboarding_completo')) {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false`;
      console.log('✅ Coluna onboarding_completo adicionada');
    } else {
      console.log('ℹ️  onboarding_completo já existe');
    }

    if (!check.find(r => r.column_name === 'nome_empresa')) {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nome_empresa varchar(255)`;
      console.log('✅ Coluna nome_empresa adicionada');
    } else {
      console.log('ℹ️  nome_empresa já existe');
    }

    const result = await sql`SELECT id, email, onboarding_completo, nome_empresa FROM users LIMIT 5`;
    console.log('Usuários:', result);
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.log('❌ Erro:', err.message);
    await sql.end().catch(() => {});
  }
}

console.log('\nTodas as tentativas falharam');
process.exit(1);
