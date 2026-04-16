import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Check if tables already exist
const { data: existingTables } = await supabase
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_schema', 'public')
  .in('table_name', ['assinaturas', 'pagamentos_assinatura']);

console.log('Existing tables:', existingTables);

// Try to query the tables to check if they exist
const { error: checkError } = await supabase.from('assinaturas').select('id').limit(1);
if (!checkError) {
  console.log('Table assinaturas already exists!');
} else {
  console.log('Table assinaturas does not exist:', checkError.message);
}

const { error: checkError2 } = await supabase.from('pagamentos_assinatura').select('id').limit(1);
if (!checkError2) {
  console.log('Table pagamentos_assinatura already exists!');
} else {
  console.log('Table pagamentos_assinatura does not exist:', checkError2.message);
}
