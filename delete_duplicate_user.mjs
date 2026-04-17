import https from 'https';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const hostname = url.replace('https://', '').split('/')[0];

// Primeiro verificar os usuários com esse email
function makeRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Verificar usuários duplicados
  const check = await makeRequest('/rest/v1/users?email=eq.koletor3%40gmail.com&select=id,email,passwordHash,role', 'GET');
  console.log('Usuários encontrados:', check.body);
  
  // Deletar o ID 1 (duplicado com senha diferente)
  const del = await makeRequest('/rest/v1/users?id=eq.1', 'DELETE');
  console.log('Delete status:', del.status);
  console.log('Delete result:', del.body);
  
  // Verificar após a deleção
  const verify = await makeRequest('/rest/v1/users?email=eq.koletor3%40gmail.com&select=id,email,role', 'GET');
  console.log('Usuários após deleção:', verify.body);
}

main().catch(console.error);
