-- Fixture SINTÉTICO construído de columns/constraints/indexes autorizados; sem linhas produtivas.
CREATE ROLE service_role NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE public.users(id INTEGER PRIMARY KEY);
CREATE TABLE public."clientes" (
  "id" serial NOT NULL,
  "nome" character varying(255) NOT NULL,
  "cpf_cnpj" character varying(20),
  "telefone" character varying(20),
  "whatsapp" character varying(20),
  "email" character varying(320),
  "chave_pix" character varying(255),
  "tipo_chave_pix" character varying(20),
  "endereco" text,
  "cidade" character varying(100),
  "estado" character varying(2),
  "cep" character varying(9),
  "observacoes" text,
  "score" integer DEFAULT 100,
  "foto_url" character varying(500),
  "categoria" character varying(20) DEFAULT 'padrao'::character varying,
  "qualificacao" character varying(10) DEFAULT 'bom'::character varying,
  "koletor_id" integer,
  "banco" character varying(100),
  "agencia" character varying(20),
  "numero_conta" character varying(30),
  "ativo" boolean NOT NULL DEFAULT true,
  "rg" character varying(20),
  "cnpj" character varying(20),
  "instagram" character varying(100),
  "facebook" character varying(255),
  "profissao" character varying(100),
  "numero" character varying(20),
  "complemento" character varying(100),
  "bairro" character varying(100),
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "sexo" character varying(20),
  "estado_civil" character varying(20),
  "nome_mae" character varying(255),
  "nome_pai" character varying(255),
  "data_nascimento" date,
  "limite_credito" numeric(15,2) DEFAULT 0,
  "limite_disponivel" numeric(15,2) DEFAULT 0,
  "documentos_urls" text,
  "user_id" integer,
  "is_referral" boolean DEFAULT false,
  "tipo_cliente" character varying(50) DEFAULT 'emprestimo'::character varying
);
CREATE TABLE public."contas_caixa" (
  "id" serial NOT NULL,
  "nome" character varying(255) NOT NULL,
  "tipo" character varying(20) NOT NULL DEFAULT 'caixa'::character varying,
  "saldo" numeric(15,2) NOT NULL DEFAULT 0,
  "ativo" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id" integer
);
CREATE TABLE public."koletores" (
  "id" serial NOT NULL,
  "user_id" integer,
  "nome" character varying(255) NOT NULL,
  "email" character varying(320),
  "telefone" character varying(20),
  "whatsapp" character varying(20),
  "perfil" character varying(20) NOT NULL DEFAULT 'koletor'::character varying,
  "comissao_percentual" numeric(5,2) DEFAULT 0,
  "ativo" boolean NOT NULL DEFAULT true,
  "observacoes" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."contratos" (
  "id" serial NOT NULL,
  "cliente_id" integer NOT NULL,
  "koletor_id" integer,
  "modalidade" character varying(30) NOT NULL,
  "valor_principal" numeric(15,2) NOT NULL,
  "taxa_juros" numeric(5,2) NOT NULL DEFAULT 0,
  "num_parcelas" integer NOT NULL DEFAULT 1,
  "valor_parcela" numeric(15,2) NOT NULL,
  "total_contrato" numeric(15,2) NOT NULL,
  "data_inicio" date NOT NULL,
  "data_vencimento" date,
  "status" character varying(20) NOT NULL DEFAULT 'ativo'::character varying,
  "conta_caixa_id" integer,
  "observacoes" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "tipo_taxa" character varying(20) DEFAULT 'mensal'::character varying,
  "numero_parcelas" integer,
  "multa_atraso" numeric(8,4) DEFAULT 2.00,
  "juros_mora_diario" numeric(8,4) DEFAULT 0.033,
  "data_vencimento_primeira" date,
  "dia_vencimento" integer,
  "descricao" text,
  "contrato_origem_id" integer,
  "contrato_assinado" boolean DEFAULT false,
  "contrato_url" character varying(500),
  "etiquetas" text,
  "user_id" integer
);
CREATE TABLE public."parcelas" (
  "id" serial NOT NULL,
  "contrato_id" integer NOT NULL,
  "numero" integer NOT NULL,
  "valor" numeric(15,2) NOT NULL,
  "data_vencimento" date NOT NULL,
  "data_pagamento" date,
  "valor_pago" numeric(15,2),
  "status" character varying(20) NOT NULL DEFAULT 'pendente'::character varying,
  "conta_caixa_id" integer,
  "observacoes" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "cliente_id" integer,
  "koletor_id" integer,
  "numero_parcela" integer,
  "valor_original" numeric(15,2),
  "valor_juros" numeric(15,2) DEFAULT 0.00,
  "valor_multa" numeric(15,2) DEFAULT 0.00,
  "valor_desconto" numeric(15,2) DEFAULT 0.00,
  "multa_manual" numeric(15,2) DEFAULT 0.00,
  "user_id" integer,
  "saldo_residual" numeric(15,2) NOT NULL DEFAULT 0.00,
  "multa_diaria_usada" numeric(15,2) DEFAULT 0.00
);
CREATE TABLE public."transacoes_caixa" (
  "id" serial NOT NULL,
  "conta_caixa_id" integer NOT NULL,
  "tipo" character varying(10) NOT NULL,
  "categoria" character varying(50),
  "descricao" text NOT NULL,
  "valor" numeric(15,2) NOT NULL,
  "data_transacao" date NOT NULL,
  "contrato_id" integer,
  "parcela_id" integer,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id" integer
);
CREATE TABLE public."contrato_historico" (
  "id" bigserial NOT NULL,
  "contrato_id" bigint NOT NULL,
  "user_id" text NOT NULL,
  "tipo" text NOT NULL,
  "descricao" text NOT NULL,
  "valor_anterior" numeric(12,2),
  "valor_novo" numeric(12,2),
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_categoria_check" CHECK (categoria::text = ANY (ARRAY['bronze'::character varying, 'prata'::character varying, 'ouro'::character varying, 'prefeitura'::character varying, 'padrao'::character varying]::text[]));
ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_qualificacao_check" CHECK (qualificacao::text = ANY (ARRAY['bom'::character varying, 'medio'::character varying, 'ruim'::character varying]::text[]));
ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_tipo_chave_pix_check" CHECK (tipo_chave_pix::text = ANY (ARRAY['cpf'::character varying, 'cnpj'::character varying, 'email'::character varying, 'telefone'::character varying, 'aleatoria'::character varying]::text[]));
ALTER TABLE public."contas_caixa" ADD CONSTRAINT "contas_caixa_tipo_check" CHECK (tipo::text = ANY (ARRAY['caixa'::character varying, 'banco'::character varying, 'digital'::character varying]::text[]));
ALTER TABLE public."contratos" ADD CONSTRAINT "contratos_modalidade_check" CHECK (modalidade::text = ANY (ARRAY['diario'::character varying, 'semanal'::character varying, 'quinzenal'::character varying, 'mensal'::character varying, 'tabela_price'::character varying, 'reparcelamento'::character varying, 'venda'::character varying, 'cheque'::character varying]::text[]));
ALTER TABLE public."contratos" ADD CONSTRAINT "contratos_status_check" CHECK (status::text = ANY (ARRAY['ativo'::character varying, 'quitado'::character varying, 'atrasado'::character varying, 'cancelado'::character varying, 'renegociado'::character varying]::text[]));
ALTER TABLE public."koletores" ADD CONSTRAINT "koletores_perfil_check" CHECK (perfil::text = ANY (ARRAY['admin'::character varying, 'gerente'::character varying, 'koletor'::character varying]::text[]));
ALTER TABLE public."parcelas" ADD CONSTRAINT "parcelas_status_check" CHECK (status::text = ANY (ARRAY['pendente'::character varying, 'paga'::character varying, 'pago'::character varying, 'atrasada'::character varying, 'atrasado'::character varying, 'cancelada'::character varying, 'cancelado'::character varying, 'parcial'::character varying, 'vencendo_hoje'::character varying]::text[]));
ALTER TABLE public."transacoes_caixa" ADD CONSTRAINT "transacoes_caixa_tipo_check" CHECK (tipo::text = ANY (ARRAY['entrada'::character varying, 'saida'::character varying]::text[]));
ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_pkey" PRIMARY KEY (id);
ALTER TABLE public."contas_caixa" ADD CONSTRAINT "contas_caixa_pkey" PRIMARY KEY (id);
ALTER TABLE public."contrato_historico" ADD CONSTRAINT "contrato_historico_pkey" PRIMARY KEY (id);
ALTER TABLE public."contratos" ADD CONSTRAINT "contratos_pkey" PRIMARY KEY (id);
ALTER TABLE public."koletores" ADD CONSTRAINT "koletores_pkey" PRIMARY KEY (id);
ALTER TABLE public."parcelas" ADD CONSTRAINT "parcelas_pkey" PRIMARY KEY (id);
ALTER TABLE public."transacoes_caixa" ADD CONSTRAINT "transacoes_caixa_pkey" PRIMARY KEY (id);
ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_koletor_id_fkey" FOREIGN KEY (koletor_id) REFERENCES koletores(id);
ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public."contas_caixa" ADD CONSTRAINT "contas_caixa_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public."contrato_historico" ADD CONSTRAINT "contrato_historico_contrato_id_fkey" FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;
ALTER TABLE public."contratos" ADD CONSTRAINT "contratos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
ALTER TABLE public."contratos" ADD CONSTRAINT "contratos_conta_caixa_id_fkey" FOREIGN KEY (conta_caixa_id) REFERENCES contas_caixa(id);
ALTER TABLE public."contratos" ADD CONSTRAINT "contratos_koletor_id_fkey" FOREIGN KEY (koletor_id) REFERENCES koletores(id);
ALTER TABLE public."contratos" ADD CONSTRAINT "contratos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public."koletores" ADD CONSTRAINT "koletores_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public."parcelas" ADD CONSTRAINT "parcelas_conta_caixa_id_fkey" FOREIGN KEY (conta_caixa_id) REFERENCES contas_caixa(id);
ALTER TABLE public."parcelas" ADD CONSTRAINT "parcelas_contrato_id_fkey" FOREIGN KEY (contrato_id) REFERENCES contratos(id);
ALTER TABLE public."parcelas" ADD CONSTRAINT "parcelas_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public."transacoes_caixa" ADD CONSTRAINT "transacoes_caixa_conta_caixa_id_fkey" FOREIGN KEY (conta_caixa_id) REFERENCES contas_caixa(id);
ALTER TABLE public."transacoes_caixa" ADD CONSTRAINT "transacoes_caixa_contrato_id_fkey" FOREIGN KEY (contrato_id) REFERENCES contratos(id);
ALTER TABLE public."transacoes_caixa" ADD CONSTRAINT "transacoes_caixa_parcela_id_fkey" FOREIGN KEY (parcela_id) REFERENCES parcelas(id);
ALTER TABLE public."transacoes_caixa" ADD CONSTRAINT "transacoes_caixa_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX idx_clientes_user_id ON public.clientes USING btree (user_id);
CREATE INDEX idx_contas_caixa_user_id ON public.contas_caixa USING btree (user_id);
CREATE INDEX idx_contrato_historico_contrato ON public.contrato_historico USING btree (contrato_id);
CREATE INDEX idx_contratos_user_id ON public.contratos USING btree (user_id);
CREATE INDEX idx_parcelas_user_id ON public.parcelas USING btree (user_id);
CREATE INDEX idx_transacoes_caixa_user_id ON public.transacoes_caixa USING btree (user_id);
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
INSERT INTO users(id) VALUES(1),(2);
INSERT INTO clientes(id,user_id,nome) VALUES(1,1,'Sintético A'),(2,2,'Sintético B');
INSERT INTO contas_caixa(id,user_id,nome,saldo,ativo) VALUES(1,1,'Caixa A',1000,true),(2,2,'Caixa B',700,true),(3,1,'Inativo',0,false),(4,1,'Divergente',0,true),(5,1,'Nulo',0,true);
INSERT INTO koletores(id,user_id,nome) VALUES(1,1,'Koletor A'),(2,2,'Koletor B');
INSERT INTO transacoes_caixa(user_id,conta_caixa_id,tipo,valor,descricao,data_transacao) VALUES(2,4,'entrada',1,'Sintético divergente','2026-01-01'),(NULL,5,'entrada',1,'Sintético nulo','2026-01-01');
-- Legado adversarial: 0013 continua bloqueada.
INSERT INTO contratos(id,user_id,cliente_id,modalidade,valor_principal,valor_parcela,total_contrato,data_inicio,num_parcelas,numero_parcelas) VALUES(900,1,1,'mensal',100,50,100,'2026-01-01',2,2);
INSERT INTO parcelas(id,contrato_id,numero,numero_parcela,valor,data_vencimento,user_id,cliente_id) VALUES(900,900,2,2,50,'2026-02-01',1,1),(901,900,2,2,50,'2026-02-01',NULL,NULL);
SELECT setval('contratos_id_seq',1000),setval('parcelas_id_seq',1000);
-- Dependências somente sintéticas do preflight 0015 (não instalamos sua função).
CREATE TYPE public.status_parcela AS ENUM ('pendente','paga','atrasada','vencendo_hoje','parcial');
CREATE TYPE public.status_contrato AS ENUM ('ativo','quitado','inadimplente','cancelado');
CREATE TABLE public.operacoes_financeiras (
 id UUID PRIMARY KEY, user_id INTEGER NOT NULL, tipo TEXT NOT NULL,
 chave_idempotencia UUID NOT NULL, hash_requisicao TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'processando', resultado JSONB,
 concluida_em TIMESTAMPTZ,
 UNIQUE(user_id,chave_idempotencia),
 CHECK(tipo IN ('recebimento_parcela','renovacao_juros','pagamento_conta','estorno_conta','ajuste_manual')),
 CHECK(status IN ('processando','concluida','falha'))
);
CREATE TABLE public.auditoria_financeira (
 id UUID PRIMARY KEY, user_id INTEGER NOT NULL,
 operacao_id UUID NOT NULL REFERENCES public.operacoes_financeiras(id),
 acao TEXT NOT NULL, entidade TEXT NOT NULL, entidade_id TEXT NOT NULL,
 detalhes JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.configuracoes (id SERIAL PRIMARY KEY, user_id INTEGER, chave VARCHAR(100) NOT NULL, valor TEXT);
