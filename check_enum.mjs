import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Testar se quinzenal e semanal são aceitos no campo tipo_taxa
// Primeiro verificar inserindo um contrato temporário
const tests = ['quinzenal', 'semanal', 'diaria', 'mensal', 'anual'];
for (const t of tests) {
  const { error } = await sb.from('contratos').select('id').eq('tipo_taxa', t).limit(1);
  console.log(`tipo_taxa='${t}': ${error ? 'ERRO: ' + error.message : 'OK (filtro aceito)'}`);
}

// Tentar inserir um contrato com tipo_taxa quinzenal para ver se o enum aceita
const { data: clientes } = await sb.from('clientes').select('id').limit(1);
if (clientes && clientes.length > 0) {
  const { error: insertErr } = await sb.from('contratos').insert({
    cliente_id: clientes[0].id,
    modalidade: 'emprestimo_padrao',
    valor_principal: '100.00',
    taxa_juros: '50.0000',
    tipo_taxa: 'quinzenal',
    numero_parcelas: 1,
    valor_parcela: '150.00',
    total_contrato: '150.00',
    data_inicio: '2026-03-30',
    data_vencimento_primeira: '2026-04-14',
    status: 'ativo',
    multa_atraso: '2.0000',
    juros_mora_diario: '0.0330',
    observacoes: 'TESTE_ENUM_DELETE',
  });
  if (insertErr) {
    console.log('INSERT quinzenal ERRO:', insertErr.message);
    console.log('→ Precisa adicionar quinzenal ao enum tipo_taxa no Supabase');
  } else {
    console.log('INSERT quinzenal OK → enum já aceita quinzenal!');
    // Deletar o teste
    await sb.from('contratos').delete().eq('observacoes', 'TESTE_ENUM_DELETE');
  }
}
