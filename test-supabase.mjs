import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'NOT SET');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Verificar parcelas
const { data: parcelas, error: parcelasErr } = await supabase
  .from('parcelas')
  .select('id, contrato_id, numero_parcela, valor_original, status, conta_caixa_id')
  .limit(5);

if (parcelasErr) {
  console.error('Error fetching parcelas:', parcelasErr.message);
} else {
  console.log('Parcelas:', JSON.stringify(parcelas, null, 2));
}

// Verificar contas_caixa
const { data: contas, error: contasErr } = await supabase
  .from('contas_caixa')
  .select('id, nome')
  .limit(5);

if (contasErr) {
  console.error('Error fetching contas_caixa:', contasErr.message);
} else {
  console.log('Contas Caixa:', JSON.stringify(contas, null, 2));
}
