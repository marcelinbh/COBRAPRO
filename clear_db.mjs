import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Ordem de deleção respeitando foreign keys (filhos antes dos pais)
const tables = [
  // Filhos mais profundos primeiro
  'parcelas_venda_telefone',
  'pagamentos_assinatura',
  'parcelas_veiculo',
  'parcelas',
  'transacoes_caixa',
  'contas_pagar',
  'cheques',
  'magic_links',
  'password_resets',
  // Entidades intermediárias
  'vendas_telefone',
  'assinaturas',
  'veiculos',
  'contratos',
  'produtos',
  'templates_whatsapp',
  'configuracoes',
  'contas_caixa',
  'koletores',
  // Entidades raiz
  'clientes',
  'users',
];

console.log('=== LIMPEZA DO BANCO DE DADOS ===\n');

for (const table of tables) {
  try {
    // Contar registros antes
    const { count: before } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (before === 0) {
      console.log(`✓ ${table}: já vazia (0 registros)`);
      continue;
    }
    
    // Deletar todos os registros
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', -999999); // Condição que sempre é verdadeira para deletar tudo
    
    if (error) {
      console.error(`✗ ${table}: ERRO - ${error.message}`);
    } else {
      console.log(`✓ ${table}: ${before} registro(s) removido(s)`);
    }
  } catch (err) {
    console.error(`✗ ${table}: EXCEÇÃO - ${err.message}`);
  }
}

console.log('\n=== VERIFICAÇÃO FINAL ===\n');

// Verificar que tudo foi limpo
for (const table of tables) {
  try {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (count > 0) {
      console.log(`⚠️  ${table}: ainda tem ${count} registro(s)!`);
    } else {
      console.log(`✓ ${table}: vazia`);
    }
  } catch (err) {
    console.error(`✗ ${table}: erro ao verificar - ${err.message}`);
  }
}

console.log('\n=== LIMPEZA CONCLUÍDA ===');
