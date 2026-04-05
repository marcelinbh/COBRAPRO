-- Criar tabela parcelas_veiculo
CREATE TABLE IF NOT EXISTS "parcelas_veiculo" (
	"id" serial PRIMARY KEY NOT NULL,
	"veiculo_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"valor_original" numeric(15,2) NOT NULL,
	"juros" numeric(15,2) DEFAULT '0.00',
	"vencimento" date NOT NULL,
	"status" "status_parcela" DEFAULT 'pendente' NOT NULL,
	"pagamento_data" date,
	"valor_pago" numeric(15,2),
	"observacoes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
