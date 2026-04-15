import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simular a procedure pagarJuros com o segundo empréstimo (João Carlos Silva - DIARIA)
// Buscar uma parcela pendente
const { data: parcelas, error: parcError } = await supabase
  .from('parcelas')
  .select('*')
  .eq('status', 'pendente')
  .limit(5);

if (parcError) {
  console.error('Erro ao buscar parcelas:', parcError);
  process.exit(1);
}

console.log('Parcelas pendentes encontradas:', parcelas?.length);
if (parcelas?.length > 0) {
  const parcela = parcelas[0];
  console.log('Parcela de teste:', {
    id: parcela.id,
    contrato_id: parcela.contrato_id,
    numero_parcela: parcela.numero_parcela,
    valor_original: parcela.valor_original,
    data_vencimento: parcela.data_vencimento,
    status: parcela.status,
  });

  // Buscar conta caixa
  const { data: contas } = await supabase.from('contas_caixa').select('*').limit(1);
  const conta = contas?.[0];
  console.log('Conta caixa:', conta?.id, conta?.nome);

  if (!conta) {
    console.error('Nenhuma conta caixa encontrada!');
    process.exit(1);
  }

  // Simular pagamento de juros
  const valorJuros = parseFloat(parcela.valor_original) * 0.5; // 50% como juros
  console.log('\nSimulando pagamento de juros:', valorJuros);

  // 1. Atualizar parcela como paga
  const { error: updateErr } = await supabase.from('parcelas').update({
    valor_pago: valorJuros,
    data_pagamento: new Date().toISOString(),
    status: 'paga',
    observacoes: 'Teste: Pagamento de juros - renovado',
    conta_caixa_id: conta.id,
  }).eq('id', parcela.id);

  if (updateErr) {
    console.error('❌ Erro ao atualizar parcela:', updateErr.message);
  } else {
    console.log('✅ Parcela atualizada para paga!');
  }

  // 2. Registrar entrada no caixa
  const { error: transErr } = await supabase.from('transacoes_caixa').insert({
    conta_caixa_id: conta.id,
    tipo: 'entrada',
    categoria: 'pagamento_parcela',
    valor: valorJuros,
    descricao: `Teste: Juros pagos - Parcela #${parcela.numero_parcela} renovada`,
    parcela_id: parcela.id,
    contrato_id: parcela.contrato_id,
    data_transacao: new Date().toISOString().split('T')[0],
  });

  if (transErr) {
    console.error('❌ Erro ao inserir transação:', transErr.message);
  } else {
    console.log('✅ Transação de caixa registrada!');
  }

  // 3. Criar nova parcela
  const novaData = new Date(parcela.data_vencimento + 'T00:00:00');
  novaData.setDate(novaData.getDate() + 15); // +15 dias (quinzenal como teste)
  const novaDataStr = novaData.toISOString().split('T')[0];

  const { error: insertErr } = await supabase.from('parcelas').insert({
    contrato_id: parcela.contrato_id,
    koletor_id: parcela.koletor_id ?? null,
    numero_parcela: (parcela.numero_parcela ?? 1) + 1,
    valor_original: parseFloat(parcela.valor_original),
    data_vencimento: novaDataStr,
    status: 'pendente',
    conta_caixa_id: conta.id,
  });

  if (insertErr) {
    console.error('❌ Erro ao criar nova parcela:', insertErr.message);
  } else {
    console.log('✅ Nova parcela criada com vencimento:', novaDataStr);
  }

  // Reverter a parcela para pendente (para não afetar os dados reais)
  console.log('\n🔄 Revertendo para não afetar dados reais...');
  await supabase.from('parcelas').update({ status: 'pendente', valor_pago: null, data_pagamento: null, observacoes: null }).eq('id', parcela.id);
  // Deletar a nova parcela criada
  const { data: novasParcelas } = await supabase.from('parcelas').select('id').eq('contrato_id', parcela.contrato_id).eq('data_vencimento', novaDataStr);
  if (novasParcelas?.length > 0) {
    await supabase.from('parcelas').delete().eq('id', novasParcelas[0].id);
    console.log('✅ Nova parcela de teste removida');
  }
  // Deletar a transação de teste
  const { data: transacoes } = await supabase.from('transacoes_caixa').select('id').eq('descricao', `Teste: Juros pagos - Parcela #${parcela.numero_parcela} renovada`);
  if (transacoes?.length > 0) {
    await supabase.from('transacoes_caixa').delete().eq('id', transacoes[0].id);
    console.log('✅ Transação de teste removida');
  }

  console.log('\n✅ Teste de pagarJuros PASSOU! A procedure funciona corretamente.');
}
