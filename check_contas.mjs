import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key);

const tables = ['caixas', 'contas_caixa', 'conta_caixa', 'contas', 'accounts'];
for (const t of tables) {
  const { data, error } = await sb.from(t).select('*').limit(5);
  if (!error) {
    console.log(`${t}: ${JSON.stringify(data)}`);
  } else {
    console.log(`${t} error: ${error.message}`);
  }
}

// Verificar o schema do routers.ts para contas
import { readFileSync } from 'fs';
const routers = readFileSync('/home/ubuntu/cobrapro/server/routers.ts', 'utf8');
const contasMatch = routers.match(/contas[A-Za-z_]*\s*=\s*pgTable\(['"]([\w_]+)['"]/g);
console.log('contas tables in schema:', contasMatch);
