import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const email = 'dgfinanceira@gmail.com';
const password = '97556511';
const name = 'DG Financeira';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Verificar se já existe
const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
if (existing.length > 0) {
  console.log('Usuário já existe com id:', existing[0].id);
  await conn.end();
  process.exit(0);
}

// Gerar hash da senha
const passwordHash = await bcrypt.hash(password, 12);

// Gerar openId único
const openId = 'user_' + Date.now();

// Inserir usuário
const [result] = await conn.execute(
  'INSERT INTO users (openId, name, email, passwordHash, loginMethod, role, createdAt, updatedAt, lastSignedIn) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())',
  [openId, name, email, passwordHash, 'email', 'user']
);

console.log('✅ Usuário criado com sucesso!');
console.log('  ID:', result.insertId);
console.log('  Email:', email);
console.log('  Nome:', name);
console.log('  Role: user');

await conn.end();
