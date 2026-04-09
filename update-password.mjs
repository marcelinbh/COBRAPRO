import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePassword() {
  try {
    // Buscar usuário
    const { data: users, error: searchError } = await supabase.auth.admin.listUsers();
    
    if (searchError) {
      console.error('Erro ao listar usuários:', searchError);
      return;
    }

    const user = users.users.find(u => u.email === 'dgfinanceira@gmail.com');
    
    if (!user) {
      console.error('Usuário não encontrado');
      return;
    }

    console.log('Usuário encontrado:', user.id);

    // Atualizar senha
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: '97556511'
    });

    if (error) {
      console.error('Erro ao atualizar senha:', error);
    } else {
      console.log('✅ Senha atualizada com sucesso!');
      console.log('Email: dgfinanceira@gmail.com');
      console.log('Senha: 97556511');
    }
  } catch (err) {
    console.error('Erro:', err);
  }
}

updatePassword();
