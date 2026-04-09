import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUser() {
  try {
    // Criar usuário via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'dgfinanceira@gmail.com',
      password: '97556511',
      email_confirm: true,
    });

    if (authError) {
      console.error('Erro ao criar usuário no Auth:', authError);
      return;
    }

    console.log('✅ Usuário criado no Auth:', authData.user.id);

    // Inserir usuário na tabela users
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: 'dgfinanceira@gmail.com',
          name: 'DG Financeira',
          role: 'user',
          created_at: new Date().toISOString(),
        }
      ])
      .select();

    if (error) {
      console.error('Erro ao inserir na tabela users:', error);
    } else {
      console.log('✅ Usuário inserido na tabela:', data);
    }
  } catch (err) {
    console.error('Erro:', err);
  }
}

createUser();
