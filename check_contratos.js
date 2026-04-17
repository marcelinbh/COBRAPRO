const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Buscar todos os contratos
  const { data, error } = await sb.from('contratos')
    .select('id, cliente_id, valor_principal, total_contrato, data_vencimento, status, modalidade, num_parcelas')
    .order('id');
  if (error) { console.log('Erro:', error.message); return; }
  console.log('Total contratos:', data.length);
  console.log('Todos os contratos:');
  data.forEach(c => {
    console.log(`  ID=${c.id} cliente_id=${c.cliente_id} valor=${c.valor_principal} total=${c.total_contrato} venc=${c.data_vencimento} modalidade=${c.modalidade}`);
  });
  
  const problemas = data.filter(c => {
    return (c.total_contrato === 0 || c.total_contrato === null || !c.data_vencimento);
  });
  console.log('\nContratos com problema:', problemas.length);
  problemas.forEach(c => console.log('  PROBLEMA:', JSON.stringify(c)));
  
  // Verificar parcelas
  const { data: parcelas, error: ep } = await sb.from('parcelas').select('*').limit(3);
  if (ep) console.log('Erro parcelas:', ep.message);
  else if (parcelas && parcelas.length > 0) {
    console.log('\nColunas parcelas:', Object.keys(parcelas[0]));
  }
}
main().catch(console.error);
