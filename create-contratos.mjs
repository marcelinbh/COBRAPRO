const SURL = 'https://oxvtmibrgjruldkouhhb.supabase.co';
const SK = 'sb_secret_kC8jHwgYFeNBqi1kKAavHg_VR57TFuZ';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SK,
  'Authorization': `Bearer ${SK}`,
  'Prefer': 'return=representation'
};

async function supabasePost(table, body) {
  const res = await fetch(`${SURL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Erro ao inserir em ${table}: ${JSON.stringify(data)}`);
  return data;
}

// Parcela padrão: juros simples
function calcularParcelaPadrao(principal, taxaMensal, numParcelas) {
  const juros = principal * (taxaMensal / 100);
  return (principal + juros * numParcelas) / numParcelas;
}

// Tabela Price: juros compostos
function calcularParcelasPrice(principal, taxaMensal, numParcelas) {
  const i = taxaMensal / 100;
  return principal * (i * Math.pow(1 + i, numParcelas)) / (Math.pow(1 + i, numParcelas) - 1);
}

async function main() {
  const hoje = new Date();
  const dataInicio = hoje.toISOString().split('T')[0];
  
  // Primeiro vencimento: 30 dias a partir de hoje
  const primeiraData = new Date(hoje);
  primeiraData.setDate(primeiraData.getDate() + 30);

  const contratos = [
    {
      cliente_id: 1,
      nome: 'João Carlos Silva',
      modalidade: 'mensal',
      valor_principal: 5000.00,
      taxa_juros: 5.0,
      num_parcelas: 12,
      observacoes: 'Empréstimo pessoal para reforma residencial',
      calcFn: calcularParcelaPadrao,
    },
    {
      cliente_id: 2,
      nome: 'Ana Paula Ferreira',
      modalidade: 'tabela_price',
      valor_principal: 3000.00,
      taxa_juros: 4.5,
      num_parcelas: 6,
      observacoes: 'Capital de giro para comércio',
      calcFn: calcularParcelasPrice,
    },
    {
      cliente_id: 3,
      nome: 'Roberto Oliveira Santos',
      modalidade: 'mensal',
      valor_principal: 8000.00,
      taxa_juros: 3.5,
      num_parcelas: 24,
      observacoes: 'Financiamento de veículo para trabalho',
      calcFn: calcularParcelaPadrao,
    },
  ];

  for (const c of contratos) {
    const valorParcela = c.calcFn(c.valor_principal, c.taxa_juros, c.num_parcelas);
    const totalContrato = valorParcela * c.num_parcelas;

    console.log(`\nCriando contrato para ${c.nome}...`);
    console.log(`  Valor: R$ ${c.valor_principal.toFixed(2)} | Taxa: ${c.taxa_juros}% | ${c.num_parcelas}x de R$ ${valorParcela.toFixed(2)} | Total: R$ ${totalContrato.toFixed(2)}`);

    // Data de vencimento geral (primeira parcela)
    const dataVencStr = primeiraData.toISOString().split('T')[0];

    // Inserir contrato
    const contratoResult = await supabasePost('contratos', {
      cliente_id: c.cliente_id,
      modalidade: c.modalidade,
      valor_principal: parseFloat(c.valor_principal.toFixed(2)),
      taxa_juros: parseFloat(c.taxa_juros.toFixed(4)),
      num_parcelas: c.num_parcelas,
      valor_parcela: parseFloat(valorParcela.toFixed(2)),
      total_contrato: parseFloat(totalContrato.toFixed(2)),
      data_inicio: dataInicio,
      data_vencimento: dataVencStr,
      status: 'ativo',
      observacoes: c.observacoes,
    });

    const contratoId = contratoResult[0]?.id;
    console.log(`  ✅ Contrato criado: ID #${contratoId}`);

    // Gerar parcelas
    const parcelasData = [];
    for (let i = 0; i < c.num_parcelas; i++) {
      const dataVencParcela = new Date(primeiraData);
      if (i > 0) {
        dataVencParcela.setMonth(dataVencParcela.getMonth() + i);
      }
      const dataVencParcelaStr = dataVencParcela.toISOString().split('T')[0];
      
      let status = 'pendente';
      const agora = new Date();
      agora.setHours(0, 0, 0, 0);
      dataVencParcela.setHours(0, 0, 0, 0);
      if (dataVencParcela.getTime() < agora.getTime()) status = 'atrasada';
      else if (dataVencParcela.getTime() === agora.getTime()) status = 'vencendo_hoje';

      parcelasData.push({
        contrato_id: contratoId,
        numero: i + 1,
        valor: parseFloat(valorParcela.toFixed(2)),
        data_vencimento: dataVencParcelaStr,
        status,
      });
    }

    // Inserir parcelas em lote
    const parcelasResult = await supabasePost('parcelas', parcelasData);
    console.log(`  📅 ${parcelasResult.length} parcelas geradas (${dataVencStr} → próximos ${c.num_parcelas} meses)`);
  }

  console.log('\n✅ 3 contratos criados com sucesso!\n');
  
  // Verificar contratos criados
  const res = await fetch(`${SURL}/rest/v1/contratos?select=id,cliente_id,modalidade,valor_principal,valor_parcela,num_parcelas,status&order=id`, {
    headers: { 'apikey': SK, 'Authorization': `Bearer ${SK}` }
  });
  const lista = await res.json();
  console.log('Contratos no banco:');
  lista.forEach(c => console.log(`  #${c.id} | Cliente ${c.cliente_id} | ${c.modalidade} | R$ ${c.valor_principal} | ${c.num_parcelas}x R$ ${c.valor_parcela} | ${c.status}`));
}

main().catch(console.error);
