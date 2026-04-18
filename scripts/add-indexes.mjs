/**
 * Script para adicionar índices de performance no banco de produção TiDB
 * Executa: node scripts/add-indexes.mjs
 */
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida');
  process.exit(1);
}

const indexes = [
  // Índices por user_id (mais importantes - isolamento multi-tenant)
  { name: 'idx_parcelas_user_id',    sql: 'CREATE INDEX idx_parcelas_user_id ON parcelas(user_id)' },
  { name: 'idx_contratos_user_id',   sql: 'CREATE INDEX idx_contratos_user_id ON contratos(user_id)' },
  { name: 'idx_clientes_user_id',    sql: 'CREATE INDEX idx_clientes_user_id ON clientes(user_id)' },
  { name: 'idx_transacoes_user_id',  sql: 'CREATE INDEX idx_transacoes_user_id ON transacoes(user_id)' },
  { name: 'idx_contas_caixa_user_id',sql: 'CREATE INDEX idx_contas_caixa_user_id ON contas_caixa(user_id)' },
  // Índices compostos para queries do dashboard
  { name: 'idx_parcelas_user_status',sql: 'CREATE INDEX idx_parcelas_user_status ON parcelas(user_id, status)' },
  { name: 'idx_parcelas_user_venc',  sql: 'CREATE INDEX idx_parcelas_user_venc ON parcelas(user_id, data_vencimento)' },
  { name: 'idx_contratos_user_status',sql: 'CREATE INDEX idx_contratos_user_status ON contratos(user_id, status)' },
  { name: 'idx_transacoes_user_data',sql: 'CREATE INDEX idx_transacoes_user_data ON transacoes(user_id, data_transacao)' },
];

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log('✅ Conectado ao banco de dados');

  for (const idx of indexes) {
    try {
      await conn.execute(idx.sql);
      console.log(`✅ Índice criado: ${idx.name}`);
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.message?.includes('Duplicate key name') || err.message?.includes('already exists')) {
        console.log(`⏭️  Índice já existe: ${idx.name}`);
      } else {
        console.error(`❌ Erro ao criar ${idx.name}: ${err.message}`);
      }
    }
  }

  await conn.end();
  console.log('\n✅ Script de índices concluído!');
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
