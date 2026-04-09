import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUser() {
  const email = 'dgfinanceira@gmail.com';
  const password = '97556511';
  const name = 'DG Financeira';
  
  // Hash da senha
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Inserir usuário
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        email,
        password: hashedPassword,
        name,
        role: 'user',
        created_at: new Date().toISOString(),
      }
    ])
    .select();
  
  if (error) {
    console.error('Erro ao criar usuário:', error);
  } else {
    console.log('✅ Usuário criado com sucesso:', data);
  }
}

createUser();
