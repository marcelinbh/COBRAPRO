import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Primeiro, verificar o status atual da parcela 52
const { data: current } = await sb.from('parcelas').select('id, status').eq('id', 52).single();
console.log('Current parcela 52 status:', current?.status);

const statuses = ['pendente', 'paga', 'atrasada', 'vencendo_hoje', 'parcial', 'quitada'];

for (const status of statuses) {
  const { error } = await sb.from('parcelas').update({ status }).eq('id', 52);
  if (!error) {
    console.log('Valid status:', status, '✓');
    // Reverter para pendente
    await sb.from('parcelas').update({ status: 'pendente' }).eq('id', 52);
  } else {
    console.log('Invalid status:', status, '-', error.message.substring(0, 80));
  }
}

// Verificar colunas de transacoes_caixa
console.log('\n--- transacoes_caixa columns ---');
const { data: tx } = await sb.from('transacoes_caixa').select('*').limit(1);
if (tx && tx[0]) {
  console.log('Columns:', Object.keys(tx[0]).join(', '));
}

// Tentar inserir com data_transacao
const { data: ins, error: insErr } = await sb.from('transacoes_caixa').insert({
  conta_caixa_id: 1,
  tipo: 'entrada',
  categoria: 'pagamento_parcela',
  valor: '100.00',
  descricao: 'Test',
  parcela_id: 52,
  contrato_id: 10,
  data_transacao: new Date().toISOString(),
}).select().single();

if (insErr) {
  console.log('Insert with data_transacao error:', insErr.message);
} else {
  console.log('Insert with data_transacao success! ID:', ins.id);
  await sb.from('transacoes_caixa').delete().eq('id', ins.id);
  console.log('Deleted test record');
}
