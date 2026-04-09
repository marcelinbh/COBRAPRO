import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUserWithHash() {
  try {
    const email = 'dgfinanceira@gmail.com';
    const password = '97556511';
    const name = 'DG Financeira';
    const openId = nanoid();
    
    // Gerar hash bcrypt
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Buscar usuário existente
    const { data: existingUser, error: searchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    
    if (searchError) {
      console.error('Erro ao buscar usuário:', searchError);
      return;
    }
    
    if (existingUser) {
      console.log('Usuário já existe, atualizando...');
      // Atualizar usuário existente
      const { data, error } = await supabase
        .from('users')
        .update({
          passwordHash,
          name,
          loginMethod: 'email',
        })
        .eq('email', email)
        .select();
      
      if (error) {
        console.error('Erro ao atualizar usuário:', error);
      } else {
        console.log('✅ Usuário atualizado com sucesso!');
        console.log('Email:', email);
        console.log('Senha:', password);
      }
    } else {
      console.log('Criando novo usuário...');
      // Criar novo usuário
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            openId,
            email,
            passwordHash,
            name,
            loginMethod: 'email',
            role: 'user',
          }
        ])
        .select();
      
      if (error) {
        console.error('Erro ao criar usuário:', error);
      } else {
        console.log('✅ Usuário criado com sucesso!');
        console.log('Email:', email);
        console.log('Senha:', password);
      }
    }
  } catch (err) {
    console.error('Erro:', err);
  }
}

createUserWithHash();
