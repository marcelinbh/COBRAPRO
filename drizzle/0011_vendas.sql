-- Create vendas table
CREATE TABLE IF NOT EXISTS "vendas" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "cliente_id" integer,
  "produto_id" integer,
  "produto" varchar(255) NOT NULL,
  "quantidade" integer DEFAULT 1 NOT NULL,
  "valor_unitario" numeric(15, 2) NOT NULL,
  "valor_total" numeric(15, 2) NOT NULL,
  "status" varchar(50) DEFAULT 'concluida' NOT NULL,
  "forma_pagamento" varchar(50) DEFAULT 'dinheiro',
  "data_venda" timestamp with time zone DEFAULT now() NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
