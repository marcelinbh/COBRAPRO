import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const DEFAULT_PASSWORD = '97556511';

console.log('=== CORRIGINDO HASH DA SENHA ===\n');

// Gerar hash bcrypt correto (salt 12, igual ao authRoutes.ts)
console.log('Gerando hash bcrypt para a senha...');
const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
console.log(`✓ Hash gerado: ${passwordHash.substring(0, 20)}...`);

// Atualizar a senha do admin
const { data, error } = await supabase
  .from('users')
  .update({ passwordHash, loginMethod: 'email' })
  .eq('email', 'koletor3@gmail.com')
  .select('id, email, role, loginMethod')
  .single();

if (error) {
  console.error(`✗ Erro ao atualizar: ${error.message}`);
} else {
  console.log(`\n✓ Senha atualizada com sucesso!`);
  console.log(`  - ID: ${data.id}`);
  console.log(`  - Email: ${data.email}`);
  console.log(`  - Role: ${data.role}`);
  console.log(`  - Login Method: ${data.loginMethod}`);
}

// Verificar se o hash funciona
console.log('\nVerificando se o hash está correto...');
const { data: user } = await supabase
  .from('users')
  .select('passwordHash')
  .eq('email', 'koletor3@gmail.com')
  .single();

const valid = await bcrypt.compare(DEFAULT_PASSWORD, user.passwordHash);
console.log(`✓ Verificação da senha: ${valid ? 'CORRETA ✅' : 'INCORRETA ❌'}`);

console.log('\n=== CREDENCIAIS DE ACESSO ===');
console.log(`Email: koletor3@gmail.com`);
console.log(`Senha: ${DEFAULT_PASSWORD}`);
console.log(`\nAcesse: https://cobrapro.online/login`);
