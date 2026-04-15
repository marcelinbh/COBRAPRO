import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const statuses = ['pendente', 'paga', 'atrasada', 'vencendo_hoje', 'parcial', 'quitada', 'pago', 'paid'];

for (const status of statuses) {
  const { error } = await sb.from('parcelas').update({ status }).eq('id', 999999);
  const isCheckConstraint = error?.message?.includes('check constraint');
  const isNotFound = error?.message?.includes('No rows found') || error?.code === 'PGRST116';
  if (!error || isNotFound) {
    console.log('Valid status:', status);
  } else if (isCheckConstraint) {
    console.log('Invalid status (check constraint):', status);
  } else {
    console.log('Other error for status', status, ':', error.message);
  }
}
