-- FIXTURE LOCAL SINTÉTICO. Não é exportação/verificação do schema de produção.
-- Colunas usadas por 0015 e preflight; enums/tipos de schema.ts e tabelas financeiras de 0012.
CREATE ROLE service_role NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE EXTENSION pgcrypto;
CREATE TYPE status_parcela AS ENUM ('pendente','paga','atrasada','vencendo_hoje','parcial');
CREATE TYPE status_contrato AS ENUM ('ativo','quitado','inadimplente','cancelado');
CREATE TYPE tipo_transacao AS ENUM ('entrada','saida','transferencia');
CREATE TYPE categoria_transacao AS ENUM ('pagamento_parcela','emprestimo_liberado','despesa_operacional','transferencia_conta','ajuste_manual','outros','pagamento_assinatura');
CREATE TYPE tipo_alteracao AS ENUM ('edicao_juros','aplicacao_multa','edicao_parcela','edicao_contrato','pagamento','pagamento_juros','reparcelamento','criacao');
CREATE TABLE clientes (id serial PRIMARY KEY, user_id integer, nome varchar(255) NOT NULL);
CREATE TABLE contas_caixa (id serial PRIMARY KEY, user_id integer, nome varchar(100) NOT NULL, saldo numeric(15,2) NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true);
CREATE TABLE contratos (id serial PRIMARY KEY, user_id integer, cliente_id integer NOT NULL, status status_contrato NOT NULL DEFAULT 'ativo', numero_parcelas integer NOT NULL);
CREATE TABLE parcelas (
 id serial PRIMARY KEY, user_id integer NOT NULL, contrato_id integer NOT NULL, cliente_id integer NOT NULL,
 numero_parcela integer NOT NULL, valor_original numeric(15,2) NOT NULL, valor_pago numeric(15,2),
 valor_juros numeric(15,2) DEFAULT 0, valor_multa numeric(15,2) DEFAULT 0, valor_desconto numeric(15,2) DEFAULT 0,
 saldo_residual numeric(15,2) NOT NULL DEFAULT 0, multa_diaria_usada numeric(15,2) DEFAULT 0,
 data_vencimento date NOT NULL, data_pagamento timestamptz, status status_parcela NOT NULL DEFAULT 'pendente',
 conta_caixa_id integer, observacoes text
);
CREATE UNIQUE INDEX parcelas_user_contrato_numero_uk ON parcelas(user_id,contrato_id,numero_parcela);
CREATE TABLE transacoes_caixa (
 id serial PRIMARY KEY, user_id integer, conta_caixa_id integer NOT NULL, tipo tipo_transacao NOT NULL,
 categoria categoria_transacao NOT NULL, valor numeric(15,2) NOT NULL, descricao text, parcela_id integer,
 contrato_id integer, cliente_id integer, data_transacao timestamptz NOT NULL DEFAULT now()
 -- operacao_financeira_id intencionalmente ausente: deve ser criada por 0015.
);
CREATE TABLE operacoes_financeiras (
 id uuid PRIMARY KEY, user_id integer NOT NULL,
 tipo text NOT NULL CHECK(tipo IN ('recebimento_parcela','renovacao_juros','pagamento_conta','estorno_conta','ajuste_manual')),
 chave_idempotencia uuid NOT NULL, hash_requisicao text NOT NULL,
 status text NOT NULL DEFAULT 'processando' CHECK(status IN ('processando','concluida','falha')),
 resultado jsonb, erro text, created_at timestamptz NOT NULL DEFAULT now(), concluida_em timestamptz,
 CONSTRAINT operacoes_financeiras_user_chave_uk UNIQUE(user_id,chave_idempotencia)
);
CREATE TABLE auditoria_financeira (
 id uuid PRIMARY KEY, user_id integer NOT NULL, operacao_id uuid NOT NULL REFERENCES operacoes_financeiras(id),
 acao text NOT NULL, entidade text NOT NULL, entidade_id text NOT NULL, detalhes jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contrato_historico (
 id serial PRIMARY KEY, user_id integer NOT NULL, contrato_id integer NOT NULL, tipo tipo_alteracao NOT NULL,
 descricao text NOT NULL, valor_novo text, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE configuracoes (id serial PRIMARY KEY, user_id integer, chave varchar(100) NOT NULL, valor text);
CREATE UNIQUE INDEX idx_configuracoes_usuario_chave ON configuracoes(user_id,chave);
-- Somente para permitir o preflight completo (não fazem parte dos cenários 0015).
CREATE TABLE parcelas_renovacoes (id serial PRIMARY KEY);
CREATE TABLE assinaturas (id serial PRIMARY KEY, user_id integer, cliente_id integer NOT NULL);
CREATE TABLE pagamentos_assinatura (id serial PRIMARY KEY, user_id integer NOT NULL, assinatura_id integer NOT NULL, cliente_id integer NOT NULL, conta_caixa_id integer NOT NULL, mes_referencia varchar(7) NOT NULL);
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
INSERT INTO clientes(id,user_id,nome) VALUES (1,1,'Tenant A'),(2,2,'Tenant B'),(3,1,'Outro cliente A');
INSERT INTO contas_caixa(id,user_id,nome,ativo) VALUES(1,1,'Caixa A',true),(2,2,'Caixa B',true),(3,1,'Inativo A',false);
