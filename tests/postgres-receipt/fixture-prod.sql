-- FIXTURE LOCAL SINTÉTICO dos tipos/constraints informados na auditoria READ ONLY.
-- Não contém dados, credenciais ou exportações produtivas. Roles criadas pelo fixture legado.
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions VERSION '1.3';
CREATE TYPE status_parcela AS ENUM ('pendente','paga','atrasada','vencendo_hoje','parcial');
CREATE TYPE status_contrato AS ENUM ('ativo','quitado','inadimplente','cancelado');
CREATE TYPE tipo_transacao AS ENUM ('entrada','saida','transferencia');
CREATE TYPE categoria_transacao AS ENUM ('pagamento_parcela','outros');
CREATE TABLE clientes (id serial PRIMARY KEY, user_id integer, nome varchar(255) NOT NULL);
CREATE TABLE contas_caixa (id serial PRIMARY KEY, user_id integer, nome varchar(100) NOT NULL, saldo numeric(15,2) NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true);
CREATE TABLE contratos (
 id serial PRIMARY KEY, user_id integer, cliente_id integer NOT NULL,
 status varchar NOT NULL DEFAULT 'ativo', numero_parcelas integer, num_parcelas integer NOT NULL,
 CONSTRAINT contratos_status_check CHECK (status IN ('ativo','quitado','atrasado','cancelado','renegociado'))
);
CREATE TABLE parcelas (
 id serial PRIMARY KEY, contrato_id integer NOT NULL, numero integer NOT NULL, valor numeric NOT NULL,
 data_vencimento date NOT NULL, data_pagamento date, valor_pago numeric,
 status varchar NOT NULL DEFAULT 'pendente', conta_caixa_id integer, observacoes text,
 "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
 cliente_id integer, numero_parcela integer, valor_original numeric, user_id integer,
 saldo_residual numeric NOT NULL DEFAULT 0, valor_juros numeric, valor_multa numeric,
 valor_desconto numeric, multa_diaria_usada numeric,
 CONSTRAINT parcelas_status_check CHECK (status IN ('pendente','paga','pago','atrasada','atrasado','cancelada','cancelado','parcial','vencendo_hoje'))
);
CREATE UNIQUE INDEX parcelas_user_contrato_numero_uk ON parcelas(user_id,contrato_id,numero_parcela);
CREATE TABLE transacoes_caixa (
 id serial PRIMARY KEY, conta_caixa_id integer NOT NULL, tipo varchar NOT NULL,
 categoria varchar, descricao text NOT NULL, valor numeric NOT NULL, data_transacao date NOT NULL,
 contrato_id integer, parcela_id integer, user_id integer, "createdAt" timestamptz DEFAULT now(),
 CONSTRAINT transacoes_caixa_tipo_check CHECK (tipo IN ('entrada','saida'))
 -- cliente_id e operacao_financeira_id ausentes: adições nullable de 0015.
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
 id bigserial PRIMARY KEY, contrato_id bigint, user_id text NOT NULL, tipo text,
 descricao text, valor_novo numeric, created_at timestamptz DEFAULT now()
);
CREATE TABLE configuracoes (id serial PRIMARY KEY, user_id integer, chave varchar(100) NOT NULL, valor text);
CREATE UNIQUE INDEX idx_configuracoes_usuario_chave ON configuracoes(user_id,chave);
CREATE TABLE parcelas_renovacoes (id serial PRIMARY KEY);
CREATE TABLE assinaturas (id serial PRIMARY KEY, user_id integer, cliente_id integer NOT NULL);
CREATE TABLE pagamentos_assinatura (id serial PRIMARY KEY, user_id integer NOT NULL, assinatura_id integer NOT NULL, cliente_id integer NOT NULL, conta_caixa_id integer NOT NULL, mes_referencia varchar(7) NOT NULL);
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
INSERT INTO clientes(id,user_id,nome) VALUES (1,1,'Tenant A'),(2,2,'Tenant B'),(3,1,'Outro cliente A');
INSERT INTO contas_caixa(id,user_id,nome,ativo) VALUES(1,1,'Caixa A',true),(2,2,'Caixa B',true),(3,1,'Inativo A',false);
