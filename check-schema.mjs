import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(supabaseUrl, supabaseKey);

// Verificar as colunas de transacoes_caixa
const { data: cols, error: colsErr } = await sb
  .from('transacoes_caixa')
  .select('*')
  .limit(1);
console.log('transacoes_caixa sample:', JSON.stringify(cols), colsErr?.message);

// Tentar inserir sem cliente_id
const { data: testInsert, error: testErr } = await sb.from('transacoes_caixa').insert({
  conta_caixa_id: 1,
  tipo: 'entrada',
  categoria: 'pagamento_parcela',
  valor: '100.00',
  descricao: 'Test sem cliente_id',
  parcela_id: 52,
  contrato_id: 10,
}).select().single();

if (testErr) {
  console.log('Insert sem cliente_id error:', testErr.message);
} else {
  console.log('Insert sem cliente_id success:', JSON.stringify(testInsert));
  await sb.from('transacoes_caixa').delete().eq('id', testInsert.id);
}

// Tentar atualizar o status para 'paga'
const { error: updateErr } = await sb.from('parcelas').update({
  status: 'paga',
  valor_pago: '566.67',
  valor_juros: '0.00',
  valor_multa: '0.00',
  valor_desconto: '0.00',
  data_pagamento: new Date().toISOString(),
  conta_caixa_id: 1,
}).eq('id', 52);

if (updateErr) {
  console.log('Update parcela status=paga error:', updateErr.message, '|', updateErr.details, '|', updateErr.hint);
} else {
  console.log('Update parcela status=paga SUCCESS!');
  await sb.from('parcelas').update({ status: 'pendente', valor_pago: null, data_pagamento: null }).eq('id', 52);
  console.log('Reverted');
}

// Tentar com status='quitada'
const { error: updateErr2 } = await sb.from('parcelas').update({
  status: 'quitada',
}).eq('id', 52);
console.log('Update status=quitada:', updateErr2?.message || 'success');
if (!updateErr2) await sb.from('parcelas').update({ status: 'pendente' }).eq('id', 52);
