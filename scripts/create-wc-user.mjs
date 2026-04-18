import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const email = 'wcemprestimorapido@gmail.com';
const senha = '97556511';
const nome = 'WC Empréstimo Rápido';

// Verificar duplicidade antes de criar
const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
if (existing.length > 0) {
  console.log(`⚠️  Usuário ${email} já existe com id=${existing[0].id}. Nenhuma ação necessária.`);
  await conn.end();
  process.exit(0);
}

// Gerar ID único baseado no maior ID existente + 1
const [maxRow] = await conn.execute('SELECT MAX(id) as maxId FROM users');
const newId = (maxRow[0].maxId || 150001) + 1;
const openId = `user_${Date.now()}`;

// Hash da senha
const passwordHash = await bcrypt.hash(senha, 12);

await conn.execute(
  `INSERT INTO users (id, openId, name, email, loginMethod, role, onboarding_completo, passwordHash, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, 'email', 'user', 0, ?, NOW(), NOW())`,
  [newId, openId, nome, email, passwordHash]
);

console.log(`✅ Conta criada com sucesso!`);
console.log(`   Email: ${email}`);
console.log(`   Senha: ${senha}`);
console.log(`   ID: ${newId}`);
console.log(`   Onboarding: pendente (será guiado na primeira entrada)`);

await conn.end();
