import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Marcar todos os usuários existentes como onboarding completo
const [result] = await conn.execute(
  "UPDATE users SET onboarding_completo = 1 WHERE onboarding_completo IS NULL OR onboarding_completo = 0"
);
console.log(`✅ ${result.affectedRows} usuário(s) marcado(s) como onboarding completo`);

// Verificar
const [rows] = await conn.execute("SELECT id, email, onboarding_completo FROM users");
console.log('Usuários:', rows);

await conn.end();
