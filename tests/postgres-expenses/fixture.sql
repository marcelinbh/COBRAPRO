-- Fixture SINTÉTICO; somente columns/constraints/indexes do snapshot informado.
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE public.users(id integer PRIMARY KEY);
CREATE TABLE public.contratos(id integer PRIMARY KEY);
CREATE TABLE public.parcelas(id integer PRIMARY KEY);
CREATE SEQUENCE public.contas_caixa_id_seq;
CREATE TABLE public.contas_caixa (
  "id" integer NOT NULL DEFAULT nextval('contas_caixa_id_seq'::regclass),
  "nome" character varying(255) NOT NULL,
  "tipo" character varying(20) NOT NULL DEFAULT 'caixa'::character varying,
  "saldo" numeric(15,2) NOT NULL DEFAULT 0,
  "ativo" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id" integer
);
ALTER SEQUENCE public.contas_caixa_id_seq OWNED BY public.contas_caixa."id";
CREATE SEQUENCE public.contas_pagar_id_seq;
CREATE TABLE public.contas_pagar (
  "id" integer NOT NULL DEFAULT nextval('contas_pagar_id_seq'::regclass),
  "descricao" character varying(255) NOT NULL,
  "categoria" character varying(50) DEFAULT 'outros'::character varying,
  "valor" numeric(15,2) NOT NULL,
  "data_vencimento" date NOT NULL,
  "data_pagamento" date,
  "status" character varying(20) DEFAULT 'pendente'::character varying,
  "recorrente" boolean DEFAULT false,
  "frequencia" character varying(20),
  "conta_caixa_id" integer,
  "observacoes" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id" integer
);
ALTER SEQUENCE public.contas_pagar_id_seq OWNED BY public.contas_pagar."id";
CREATE SEQUENCE public.transacoes_caixa_id_seq;
CREATE TABLE public.transacoes_caixa (
  "id" integer NOT NULL DEFAULT nextval('transacoes_caixa_id_seq'::regclass),
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
ALTER SEQUENCE public.transacoes_caixa_id_seq OWNED BY public.transacoes_caixa."id";
ALTER TABLE public.contas_caixa ADD CONSTRAINT "contas_caixa_pkey" PRIMARY KEY (id);
ALTER TABLE public.contas_pagar ADD CONSTRAINT "contas_pagar_pkey" PRIMARY KEY (id);
ALTER TABLE public.transacoes_caixa ADD CONSTRAINT "transacoes_caixa_pkey" PRIMARY KEY (id);
ALTER TABLE public.contas_caixa ADD CONSTRAINT "contas_caixa_tipo_check" CHECK (tipo::text = ANY (ARRAY['caixa'::character varying, 'banco'::character varying, 'digital'::character varying]::text[]));
ALTER TABLE public.contas_pagar ADD CONSTRAINT "contas_pagar_categoria_check" CHECK (categoria::text = ANY (ARRAY['aluguel'::character varying, 'energia'::character varying, 'agua'::character varying, 'internet'::character varying, 'telefone'::character varying, 'salario'::character varying, 'imposto'::character varying, 'fornecedor'::character varying, 'outros'::character varying]::text[]));
ALTER TABLE public.contas_pagar ADD CONSTRAINT "contas_pagar_frequencia_check" CHECK (frequencia::text = ANY (ARRAY['mensal'::character varying, 'semanal'::character varying, 'quinzenal'::character varying, 'anual'::character varying]::text[]));
ALTER TABLE public.contas_pagar ADD CONSTRAINT "contas_pagar_status_check" CHECK (status::text = ANY (ARRAY['pendente'::character varying, 'pago'::character varying, 'atrasado'::character varying, 'cancelado'::character varying]::text[]));
ALTER TABLE public.transacoes_caixa ADD CONSTRAINT "transacoes_caixa_tipo_check" CHECK (tipo::text = ANY (ARRAY['entrada'::character varying, 'saida'::character varying]::text[]));
ALTER TABLE public.contas_caixa ADD CONSTRAINT "contas_caixa_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.contas_pagar ADD CONSTRAINT "contas_pagar_conta_caixa_id_fkey" FOREIGN KEY (conta_caixa_id) REFERENCES contas_caixa(id);
ALTER TABLE public.contas_pagar ADD CONSTRAINT "contas_pagar_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.transacoes_caixa ADD CONSTRAINT "transacoes_caixa_conta_caixa_id_fkey" FOREIGN KEY (conta_caixa_id) REFERENCES contas_caixa(id);
ALTER TABLE public.transacoes_caixa ADD CONSTRAINT "transacoes_caixa_contrato_id_fkey" FOREIGN KEY (contrato_id) REFERENCES contratos(id);
ALTER TABLE public.transacoes_caixa ADD CONSTRAINT "transacoes_caixa_parcela_id_fkey" FOREIGN KEY (parcela_id) REFERENCES parcelas(id);
ALTER TABLE public.transacoes_caixa ADD CONSTRAINT "transacoes_caixa_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
CREATE INDEX idx_contas_caixa_user_id ON public.contas_caixa USING btree (user_id);
CREATE INDEX idx_contas_pagar_user_id ON public.contas_pagar USING btree (user_id);
CREATE INDEX idx_transacoes_caixa_user_id ON public.transacoes_caixa USING btree (user_id);
INSERT INTO users(id) VALUES (1),(2);
INSERT INTO contas_caixa(id,nome,user_id,saldo) VALUES(1,'Sintetica A',1,1000),(2,'Sintetica B',2,2000),(3,'Conta inconsistente',1,0),(4,'Inativa',1,0);
UPDATE contas_caixa SET ativo=false WHERE id=4;
INSERT INTO transacoes_caixa(conta_caixa_id,tipo,categoria,descricao,valor,data_transacao,user_id) VALUES(3,'entrada','outros','Owner divergente sintetico',10,'2026-11-01',2);
INSERT INTO contas_pagar(id,descricao,valor,data_vencimento,user_id) VALUES(900,'Despesa legada sintetica',12,'2026-11-07',1);
SELECT setval('contas_pagar_id_seq',1000);
