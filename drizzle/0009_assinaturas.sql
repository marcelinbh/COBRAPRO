-- Criar enum status_assinatura
DO $$ BEGIN
  CREATE TYPE "status_assinatura" AS ENUM ('ativa', 'cancelada', 'suspensa', 'inadimplente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar tabela assinaturas
CREATE TABLE IF NOT EXISTS "assinaturas" (
  "id" serial PRIMARY KEY NOT NULL,
  "cliente_id" integer NOT NULL,
  "servico" varchar(200) NOT NULL,
  "descricao" text,
  "valor_mensal" numeric(15,2) NOT NULL,
  "dia_vencimento" integer NOT NULL DEFAULT 10,
  "status" "status_assinatura" DEFAULT 'ativa' NOT NULL,
  "data_inicio" date NOT NULL,
  "data_cancelamento" date,
  "conta_caixa_id" integer,
  "observacoes" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

-- Criar tabela pagamentos_assinatura
CREATE TABLE IF NOT EXISTS "pagamentos_assinatura" (
  "id" serial PRIMARY KEY NOT NULL,
  "assinatura_id" integer NOT NULL,
  "cliente_id" integer NOT NULL,
  "valor_pago" numeric(15,2) NOT NULL,
  "data_pagamento" timestamp with time zone DEFAULT now() NOT NULL,
  "mes_referencia" varchar(7) NOT NULL,
  "conta_caixa_id" integer,
  "observacoes" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
