import mysql from 'mysql2/promise';

const DB_URL = 'mysql://4Ve39mJgttRTexu.root:34r9EAtLn1NSNl3HGr9n@gateway05.us-east-1.prod.aws.tidbcloud.com:4000/BkqW4WQ4ndZHJQHLtTMfxv';

const conn = await mysql.createConnection({
  host: 'gateway05.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4Ve39mJgttRTexu.root',
  password: '34r9EAtLn1NSNl3HGr9n',
  database: 'BkqW4WQ4ndZHJQHLtTMfxv',
  ssl: { rejectUnauthorized: true },
});

console.log('Connected to MySQL/TiDB!');

// Drop and recreate to ensure clean state
try {
  await conn.execute('DROP TABLE IF EXISTS parcelas_venda_telefone');
  await conn.execute('DROP TABLE IF EXISTS vendas_telefone');
  console.log('Dropped existing tables');
} catch (e) {
  console.log('Drop error (ok):', e.message);
}

// Create vendas_telefone table
await conn.execute(`
  CREATE TABLE vendas_telefone (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(200) NOT NULL,
    imei VARCHAR(50),
    cor VARCHAR(50),
    armazenamento VARCHAR(50),
    custo DECIMAL(12,2) NOT NULL,
    preco_venda DECIMAL(12,2) NOT NULL,
    entrada_percentual DECIMAL(5,2) DEFAULT 0,
    entrada_valor DECIMAL(12,2) DEFAULT 0,
    num_parcelas INT NOT NULL DEFAULT 1,
    juros_mensal DECIMAL(5,2) DEFAULT 0,
    valor_parcela DECIMAL(12,2) DEFAULT 0,
    total_juros DECIMAL(12,2) DEFAULT 0,
    total_a_receber DECIMAL(12,2) DEFAULT 0,
    lucro_bruto DECIMAL(12,2) DEFAULT 0,
    roi DECIMAL(8,2),
    payback_meses INT,
    comprador_nome VARCHAR(200) NOT NULL,
    comprador_cpf VARCHAR(20),
    comprador_rg VARCHAR(30),
    comprador_telefone VARCHAR(30),
    comprador_email VARCHAR(200),
    comprador_estado_civil VARCHAR(50),
    comprador_profissao VARCHAR(100),
    comprador_instagram VARCHAR(100),
    comprador_cep VARCHAR(10),
    comprador_cidade VARCHAR(100),
    comprador_estado VARCHAR(50),
    comprador_endereco TEXT,
    comprador_local_trabalho VARCHAR(200),
    status VARCHAR(20) DEFAULT 'ativo',
    conta_caixa_id BIGINT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);
console.log('✅ Created vendas_telefone!');

// Create parcelas_venda_telefone table (no FK, just index)
await conn.execute(`
  CREATE TABLE parcelas_venda_telefone (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    venda_id BIGINT NOT NULL,
    numero INT NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    pago_em DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('✅ Created parcelas_venda_telefone!');

// Verify tables exist
const [tables] = await conn.execute("SHOW TABLES LIKE 'vendas%'");
console.log('\nTables created:', tables);

await conn.end();
console.log('\n✅ All done!');
