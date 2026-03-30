import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET');

const supabase = createClient(supabaseUrl, supabaseKey);

// Try to fetch rows to see what columns exist
const { data, error } = await supabase
  .from('contratos')
  .select('*')
  .limit(1);

if (error) {
  console.log('Error fetching contratos:', error.message);
} else {
  console.log('Contratos columns:', data.length > 0 ? Object.keys(data[0]) : 'no rows found');
  if (data.length > 0) {
    console.log('Sample row keys:', Object.keys(data[0]));
  }
}

// Try a simple insert to see what's required
const testInsert = await supabase
  .from('contratos')
  .insert({
    cliente_id: 1,
    modalidade: 'mensal',
    valor_principal: 3000,
    taxa_juros: 5,
    numero_parcelas: 12,
    valor_parcela: 400,
    data_inicio: '2026-03-30',
    data_vencimento_primeira: '2026-04-29',
    status: 'ativo',
  })
  .select('id')
  .single();

if (testInsert.error) {
  console.log('Insert error:', testInsert.error.message);
  console.log('Insert error details:', JSON.stringify(testInsert.error, null, 2));
} else {
  console.log('Insert success! ID:', testInsert.data?.id);
  // Delete the test row
  await supabase.from('contratos').delete().eq('id', testInsert.data.id);
  console.log('Test row deleted');
}
