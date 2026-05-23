import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sete = new Date();
sete.setDate(sete.getDate() - 7);

const { data, error } = await sb
  .from('users')
  .select('id, name, email, role, loginMethod, lastSignedIn, createdAt, onboarding_completo, nome_empresa')
  .order('lastSignedIn', { ascending: false, nullsFirst: false });

if (error) { console.error('Erro:', error.message); process.exit(1); }

const ativos = data.filter(u => u.lastSignedIn && new Date(u.lastSignedIn) >= sete);
const inativos = data.filter(u => !u.lastSignedIn || new Date(u.lastSignedIn) < sete);

console.log(`\nTotal de usuários cadastrados: ${data.length}`);
console.log(`Ativos nos últimos 7 dias: ${ativos.length}`);
console.log(`\n=== ATIVOS (últimos 7 dias) ===`);
for (const u of ativos) {
  const login = u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'nunca';
  console.log(`  [${u.role.toUpperCase()}] ${u.email} | ${u.name} | empresa: ${u.nome_empresa ?? '—'} | método: ${u.loginMethod} | último login: ${login} | onboarding: ${u.onboarding_completo ? 'sim' : 'não'}`);
}

console.log(`\n=== DEMAIS USUÁRIOS (sem login nos últimos 7 dias) ===`);
for (const u of inativos) {
  const login = u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'nunca';
  const criado = new Date(u.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  console.log(`  [${u.role.toUpperCase()}] ${u.email} | ${u.name} | empresa: ${u.nome_empresa ?? '—'} | método: ${u.loginMethod} | último login: ${login} | cadastro: ${criado}`);
}
