import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

// Carregar variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EMAIL = 'ultracrediuc@gmail.com';
const PASSWORD = '97556511';
const NAME = 'UltraCredi UC';

async function main() {
  console.log('🔍 Verificando se o usuário já existe...');

  // Verificar se já existe
  const { data: existing, error: checkError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', EMAIL)
    .maybeSingle();

  if (checkError) {
    console.error('❌ Erro ao verificar usuário:', checkError.message);
    process.exit(1);
  }

  if (existing) {
    console.log(`⚠️  Usuário já existe: ${existing.email} (id: ${existing.id}, role: ${existing.role})`);
    console.log('🔄 Atualizando senha...');

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const { error: updateError } = await supabase
      .from('users')
      .update({
        passwordHash,
        loginMethod: 'email',
        lastSignedIn: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar senha:', updateError.message);
      process.exit(1);
    }
    console.log('✅ Senha atualizada com sucesso!');
    return;
  }

  // Criar hash da senha
  console.log('🔐 Gerando hash da senha...');
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Inserir novo usuário
  console.log('📝 Criando usuário no Supabase...');
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      openId,
      name: NAME,
      email: EMAIL,
      passwordHash,
      loginMethod: 'email',
      role: 'admin',
      lastSignedIn: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Erro ao criar usuário:', insertError.message);
    process.exit(1);
  }

  console.log('✅ Usuário criado com sucesso!');
  console.log(`   ID: ${newUser.id}`);
  console.log(`   Email: ${newUser.email}`);
  console.log(`   Nome: ${newUser.name}`);
  console.log(`   Role: ${newUser.role}`);
  console.log(`   OpenID: ${newUser.openId}`);
}

main().catch(err => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
