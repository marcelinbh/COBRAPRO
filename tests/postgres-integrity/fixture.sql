-- LOCAL DESCARTÁVEL: não é dump nem validação de produção.
-- Campos necessários ao contrato, tipos e defaults baseados em schema.ts.
-- Assinaturas/pagamentos usam a migration PostgreSQL 0009 copiada literalmente.
-- Tenant de assinatura é compatibilidade pré-0014; tenant de pagamento é criado pela 0014.
CREATE TYPE role AS ENUM ('user','admin');
CREATE TYPE tipo_transacao AS ENUM ('entrada','saida','transferencia');
CREATE TYPE categoria_transacao AS ENUM ('pagamento_parcela','emprestimo_liberado','despesa_operacional','transferencia_conta','ajuste_manual','outros');
CREATE TABLE users (
 id serial PRIMARY KEY, "openId" varchar(64) NOT NULL UNIQUE,
 name text, email varchar(320), "passwordHash" varchar(255), "loginMethod" varchar(64),
 role role NOT NULL DEFAULT 'user', "createdAt" timestamptz NOT NULL DEFAULT now(),
 "updatedAt" timestamptz NOT NULL DEFAULT now(), "lastSignedIn" timestamptz NOT NULL DEFAULT now()
 -- session_version deve ser criado pela migration 0016.
);
CREATE TABLE password_resets (
 id serial PRIMARY KEY, user_id integer NOT NULL,
 token varchar NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
 used boolean NOT NULL DEFAULT false, "createdAt" timestamptz
 -- Contrato informado do inventário READ ONLY; dados abaixo são somente sintéticos.
);
CREATE TABLE clientes (id serial PRIMARY KEY, user_id integer, nome varchar(255) NOT NULL);
CREATE TABLE contas_caixa (
 id serial PRIMARY KEY, user_id integer, nome varchar(100) NOT NULL,
 saldo numeric(15,2) NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true,
 "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
\ir ../../drizzle/0009_assinaturas.sql
ALTER TABLE assinaturas ADD COLUMN user_id integer;
CREATE TABLE transacoes_caixa (
 id serial PRIMARY KEY, user_id integer, conta_caixa_id integer NOT NULL,
 tipo tipo_transacao NOT NULL, categoria categoria_transacao NOT NULL,
 valor numeric(15,2) NOT NULL, descricao text, parcela_id integer, contrato_id integer,
 cliente_id integer, conta_destino_id integer,
 data_transacao timestamptz NOT NULL DEFAULT now(), "createdAt" timestamptz NOT NULL DEFAULT now()
 -- pagamento_assinatura_id deve ser criado pela 0014.
);
-- Contrato literal da tabela relevante de 0012.
CREATE TABLE operacoes_financeiras (
 id UUID PRIMARY KEY, user_id INTEGER NOT NULL,
 tipo TEXT NOT NULL CHECK (tipo IN ('recebimento_parcela','renovacao_juros','pagamento_conta','estorno_conta','ajuste_manual')),
 chave_idempotencia UUID NOT NULL, hash_requisicao TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'processando' CHECK(status IN ('processando','concluida','falha')),
 resultado JSONB, erro TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), concluida_em TIMESTAMPTZ,
 CONSTRAINT operacoes_financeiras_user_chave_uk UNIQUE(user_id,chave_idempotencia)
);
-- A tabela Kiwify não aparece no schema.ts nem no DDL histórico encontrado.
-- Fixture limitado ao contrato explícito da 0017: order_id compatível com btrim/texto.
-- Não se inventa NOT NULL ou CHECK ausente da migration.
CREATE TABLE kiwify_webhooks (id serial PRIMARY KEY, order_id text, status text);
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated, unprivileged;
INSERT INTO users(id,"openId",name,"passwordHash") VALUES
 (1,'local-user-1','Tenant A','hash-inicial-local-00000001'),
 (2,'local-user-2','Tenant B','hash-inicial-local-00000002');
INSERT INTO clientes(id,user_id,nome) VALUES(1,1,'Cliente A'),(2,2,'Cliente B'),(3,1,'Outro cliente A');
INSERT INTO contas_caixa(id,user_id,nome) VALUES(1,1,'Caixa A'),(2,2,'Caixa B'),(3,1,'Caixa inativo A');
INSERT INTO assinaturas(id,user_id,cliente_id,servico,valor_mensal,data_inicio,conta_caixa_id)
 VALUES(1,1,1,'Assinatura A',100,'2026-01-01',1),(2,2,2,'Assinatura B',100,'2026-01-01',2);
INSERT INTO pagamentos_assinatura(id,assinatura_id,cliente_id,valor_pago,mes_referencia,conta_caixa_id)
 VALUES(1,1,1,100,'2026-01',1);
INSERT INTO kiwify_webhooks(order_id,status) VALUES('pedido-base','reservado');
-- IDs explícitos de seed não avançam sequências serial no PostgreSQL.
-- Ajuste obrigatório de fixture, sem alterar integridade ou esconder erros DDL.
SELECT setval(pg_get_serial_sequence('users','id'),(SELECT max(id) FROM users),true);
SELECT setval(pg_get_serial_sequence('clientes','id'),(SELECT max(id) FROM clientes),true);
SELECT setval(pg_get_serial_sequence('contas_caixa','id'),(SELECT max(id) FROM contas_caixa),true);
SELECT setval(pg_get_serial_sequence('assinaturas','id'),(SELECT max(id) FROM assinaturas),true);
SELECT setval(pg_get_serial_sequence('pagamentos_assinatura','id'),(SELECT max(id) FROM pagamentos_assinatura),true);
