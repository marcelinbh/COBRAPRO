import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

console.log('=== VERIFICAÇÃO DE ISOLAMENTO POR user_id ===\n');

// Inserir 2 usuários de teste
console.log('1. Criando usuários de teste...');
const { data: user1, error: e1 } = await supabase
  .from('users')
  .insert({ openId: 'test_user_1', name: 'Usuário Teste 1', email: 'user1@test.com', role: 'user' })
  .select()
  .single();

const { data: user2, error: e2 } = await supabase
  .from('users')
  .insert({ openId: 'test_user_2', name: 'Usuário Teste 2', email: 'user2@test.com', role: 'user' })
  .select()
  .single();

if (e1 || e2) {
  console.error('Erro ao criar usuários:', e1?.message || e2?.message);
  process.exit(1);
}

console.log(`   ✓ Usuário 1 criado: id=${user1.id}`);
console.log(`   ✓ Usuário 2 criado: id=${user2.id}`);

// Inserir clientes para cada usuário
console.log('\n2. Criando clientes para cada usuário...');
const { data: cliente1, error: ce1 } = await supabase
  .from('clientes')
  .insert({ user_id: user1.id, nome: 'Cliente do User 1', telefone: '11999990001' })
  .select()
  .single();

const { data: cliente2, error: ce2 } = await supabase
  .from('clientes')
  .insert({ user_id: user2.id, nome: 'Cliente do User 2', telefone: '11999990002' })
  .select()
  .single();

if (ce1 || ce2) {
  console.error('Erro ao criar clientes:', ce1?.message || ce2?.message);
  process.exit(1);
}

console.log(`   ✓ Cliente 1 (user_id=${cliente1.user_id}): ${cliente1.nome}`);
console.log(`   ✓ Cliente 2 (user_id=${cliente2.user_id}): ${cliente2.nome}`);

// Verificar isolamento: user1 só deve ver seus clientes
console.log('\n3. Verificando isolamento...');
const { data: clientesUser1 } = await supabase
  .from('clientes')
  .select('*')
  .eq('user_id', user1.id);

const { data: clientesUser2 } = await supabase
  .from('clientes')
  .select('*')
  .eq('user_id', user2.id);

const { data: todosClientes } = await supabase
  .from('clientes')
  .select('*');

console.log(`   User 1 vê ${clientesUser1.length} cliente(s): ${clientesUser1.map(c => c.nome).join(', ')}`);
console.log(`   User 2 vê ${clientesUser2.length} cliente(s): ${clientesUser2.map(c => c.nome).join(', ')}`);
console.log(`   Total no banco: ${todosClientes.length} cliente(s)`);

if (clientesUser1.length === 1 && clientesUser1[0].user_id === user1.id &&
    clientesUser2.length === 1 && clientesUser2[0].user_id === user2.id) {
  console.log('\n   ✅ ISOLAMENTO CORRETO: cada usuário vê apenas seus próprios dados');
} else {
  console.log('\n   ❌ PROBLEMA DE ISOLAMENTO DETECTADO!');
}

// Limpar dados de teste
console.log('\n4. Limpando dados de teste...');
await supabase.from('clientes').delete().in('user_id', [user1.id, user2.id]);
await supabase.from('users').delete().in('id', [user1.id, user2.id]);
console.log('   ✓ Dados de teste removidos');

console.log('\n=== VERIFICAÇÃO CONCLUÍDA ===');
