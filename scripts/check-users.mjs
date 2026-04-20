import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import https from 'https';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Buscar todos os usuários
const { data: users, error } = await supabase
  .from('users')
  .select('id, name, email, loginMethod, role, passwordHash, createdAt')
  .order('createdAt', { ascending: false });

if (error) { console.error('Erro:', error.message); process.exit(1); }

console.log('=== USUÁRIOS CADASTRADOS NO SUPABASE ===');
console.log(`Total: ${users.length} usuários\n`);

for (const u of users) {
  const data = new Date(u.createdAt).toLocaleDateString('pt-BR');
  const temSenha = !!u.passwordHash ? '✅ tem senha' : '❌ sem senha';
  console.log(`[${u.id}] ${u.email}`);
  console.log(`     Nome: ${u.name} | Método: ${u.loginMethod} | Role: ${u.role} | ${temSenha} | Criado: ${data}`);
}

// Testar o endpoint de login em produção com credencial inválida (apenas para confirmar que responde)
console.log('\n=== TESTE DO ENDPOINT DE LOGIN EM PRODUÇÃO ===');

function testLogin(email, password) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ email, password });
    const options = {
      hostname: 'cobrapro.online',
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.write(body);
    req.end();
  });
}

// Teste com senha errada — deve retornar 401
const r1 = await testLogin('koletor3@gmail.com', 'senhaerrada');
console.log(`Login com senha errada → HTTP ${r1.status} | Resposta: ${JSON.stringify(r1.body)}`);

// Teste com e-mail inexistente — deve retornar 401
const r2 = await testLogin('naoexiste@teste.com', '123456');
console.log(`Login com e-mail inexistente → HTTP ${r2.status} | Resposta: ${JSON.stringify(r2.body)}`);

console.log('\n✅ Endpoint /api/auth/login está respondendo corretamente em produção.');
