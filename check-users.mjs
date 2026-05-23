import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sete_dias_atras = new Date();
sete_dias_atras.setDate(sete_dias_atras.getDate() - 7);
const sete_dias_str = sete_dias_atras.toISOString();

// Todos os usuários com last_login nos últimos 7 dias
const { data: ativos, error: e1 } = await supabase
  .from('users')
  .select('id, name, email, role, last_login, created_at')
  .gte('last_login', sete_dias_str)
  .order('last_login', { ascending: false });

console.log('\n=== USUÁRIOS ATIVOS (últimos 7 dias) ===');
if (e1) console.error('Erro:', e1.message);
else if (!ativos || ativos.length === 0) console.log('Nenhum usuário com last_login nos últimos 7 dias.');
else ativos.forEach(u => {
  console.log(`ID: ${u.id} | ${u.email} | ${u.name} | role: ${u.role} | último login: ${u.last_login}`);
});

// Todos os usuários cadastrados (para referência)
const { data: todos, error: e2 } = await supabase
  .from('users')
  .select('id, name, email, role, last_login, created_at')
  .order('last_login', { ascending: false, nullsFirst: false });

console.log('\n=== TODOS OS USUÁRIOS CADASTRADOS ===');
if (e2) console.error('Erro:', e2.message);
else todos?.forEach(u => {
  console.log(`ID: ${u.id} | ${u.email} | ${u.name} | role: ${u.role} | último login: ${u.last_login ?? 'nunca'}`);
});
