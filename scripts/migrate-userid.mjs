import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== INICIANDO MIGRAÇÃO user_id ===\n');

// 1. Verificar quais tabelas precisam de user_id
const tables = [
  'clientes','contratos','parcelas','contas_caixa',
  'transacoes_caixa','contas_pagar','cheques','configuracoes',
  'templates_whatsapp','vendas_telefone','parcelas_venda_telefone','produtos'
];

const needsMigration = [];
for (const t of tables) {
  const [cols] = await conn.execute('SHOW COLUMNS FROM ' + t);
  const hasUserId = cols.some(c => c.Field === 'user_id');
  if (!hasUserId) {
    needsMigration.push(t);
    console.log('❌ Sem user_id: ' + t);
  } else {
    console.log('✅ Já tem user_id: ' + t);
  }
}

console.log('\n=== ADICIONANDO user_id NAS TABELAS ===\n');

// 2. Adicionar user_id nas tabelas que precisam
for (const t of needsMigration) {
  await conn.execute(`ALTER TABLE ${t} ADD COLUMN user_id INT NULL AFTER id`);
  console.log('✅ user_id adicionado em: ' + t);
}

console.log('\n=== LIMPANDO DADOS DE DEMONSTRAÇÃO ===\n');

// 3. Limpar TODOS os dados de demonstração (sem user_id = dados órfãos/demo)
// Ordem importa: filhos antes dos pais
const [parcelasCount] = await conn.execute('SELECT COUNT(*) as n FROM parcelas');
const [contratosCount] = await conn.execute('SELECT COUNT(*) as n FROM contratos');
const [clientesCount] = await conn.execute('SELECT COUNT(*) as n FROM clientes');
const [transacoesCount] = await conn.execute('SELECT COUNT(*) as n FROM transacoes_caixa');
const [contasCount] = await conn.execute('SELECT COUNT(*) as n FROM contas_caixa');
const [contasPagarCount] = await conn.execute('SELECT COUNT(*) as n FROM contas_pagar');
const [configCount] = await conn.execute('SELECT COUNT(*) as n FROM configuracoes');
const [templatesCount] = await conn.execute('SELECT COUNT(*) as n FROM templates_whatsapp');
const [produtosCount] = await conn.execute('SELECT COUNT(*) as n FROM produtos');

console.log('Dados a deletar:');
console.log('  parcelas:', parcelasCount[0].n);
console.log('  contratos:', contratosCount[0].n);
console.log('  clientes:', clientesCount[0].n);
console.log('  transacoes_caixa:', transacoesCount[0].n);
console.log('  contas_caixa:', contasCount[0].n);
console.log('  contas_pagar:', contasPagarCount[0].n);
console.log('  configuracoes:', configCount[0].n);
console.log('  templates_whatsapp:', templatesCount[0].n);
console.log('  produtos:', produtosCount[0].n);

// Deletar em ordem (filhos antes dos pais)
await conn.execute('DELETE FROM parcelas_venda_telefone');
await conn.execute('DELETE FROM vendas_telefone');
await conn.execute('DELETE FROM parcelas');
await conn.execute('DELETE FROM contratos');
await conn.execute('DELETE FROM clientes');
await conn.execute('DELETE FROM transacoes_caixa');
await conn.execute('DELETE FROM contas_caixa');
await conn.execute('DELETE FROM contas_pagar');
await conn.execute('DELETE FROM cheques');
await conn.execute('DELETE FROM configuracoes');
await conn.execute('DELETE FROM templates_whatsapp');
await conn.execute('DELETE FROM produtos');
await conn.execute('DELETE FROM magic_links');

console.log('\n✅ Todos os dados de demonstração foram deletados!');

// 4. Verificar resultado
const [finalParcelas] = await conn.execute('SELECT COUNT(*) as n FROM parcelas');
const [finalClientes] = await conn.execute('SELECT COUNT(*) as n FROM clientes');
const [finalContratos] = await conn.execute('SELECT COUNT(*) as n FROM contratos');
console.log('\n=== RESULTADO FINAL ===');
console.log('  parcelas:', finalParcelas[0].n, '(deve ser 0)');
console.log('  clientes:', finalClientes[0].n, '(deve ser 0)');
console.log('  contratos:', finalContratos[0].n, '(deve ser 0)');

await conn.end();
console.log('\n=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ===');
