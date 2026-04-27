import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

console.log('=== CRIANDO CONTAS DE TESTE ===\n');

// Contas a criar
const accounts = [
  {
    openId: 'admin_koletor3',
    name: 'Administrador',
    email: 'koletor3@gmail.com',
    role: 'admin',
    loginMethod: 'email'
  },
  {
    openId: 'contato_vital',
    name: 'Contato Vital Financeira',
    email: 'contato@vitalfinanceira.com',
    role: 'user',
    loginMethod: 'oauth'
  }
];

for (const account of accounts) {
  try {
    console.log(`Criando conta: ${account.email} (${account.name})...`);
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        openId: account.openId,
        name: account.name,
        email: account.email,
        role: account.role,
        loginMethod: account.loginMethod
      })
      .select()
      .single();
    
    if (error) {
      console.error(`  ✗ ERRO: ${error.message}`);
    } else {
      console.log(`  ✓ Conta criada com sucesso!`);
      console.log(`    - ID: ${data.id}`);
      console.log(`    - Email: ${data.email}`);
      console.log(`    - Role: ${data.role}`);
      console.log(`    - Login Method: ${data.loginMethod}`);
    }
  } catch (err) {
    console.error(`  ✗ EXCEÇÃO: ${err.message}`);
  }
}

// Verificar contas criadas
console.log('\n=== VERIFICAÇÃO FINAL ===\n');
const { data: allUsers, error: err } = await supabase
  .from('users')
  .select('id, name, email, role, loginMethod');

if (err) {
  console.error('Erro ao listar usuários:', err.message);
} else {
  console.log(`Total de contas criadas: ${allUsers.length}\n`);
  for (const user of allUsers) {
    console.log(`✓ ${user.id} | ${user.email} | ${user.name} | Role: ${user.role}`);
  }
}

console.log('\n=== CRIAÇÃO DE CONTAS CONCLUÍDA ===');
