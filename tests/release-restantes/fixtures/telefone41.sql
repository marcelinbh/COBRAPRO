-- SINTÉTICO: ordem/tipos/nullability fornecidos pelo parent em24/11; defaults/FKs somente fixture, não catálogo completo de produção.
CREATE TYPE public.status_venda_telefone AS ENUM('ativo','quitado','inadimplente','cancelado');
-- status_parcela já existe no fixture publicado.
CREATE TABLE public.vendas_telefone(
 "id" bigserial PRIMARY KEY,
 "marca" character varying(100) NOT NULL,
 "modelo" character varying(200) NOT NULL,
 "imei" character varying(20),
 "cor" character varying(50),
 "armazenamento" character varying(20),
 "custo" numeric(12,2) NOT NULL,
 "preco_venda" numeric(12,2) NOT NULL,
 "entrada_percentual" numeric(5,2) NOT NULL,
 "entrada_valor" numeric(12,2) NOT NULL,
 "num_parcelas" integer NOT NULL,
 "juros_mensal" numeric(5,2) NOT NULL,
 "valor_parcela" numeric(12,2) NOT NULL,
 "total_juros" numeric(12,2) NOT NULL,
 "total_a_receber" numeric(12,2) NOT NULL,
 "lucro_bruto" numeric(12,2) NOT NULL,
 "roi" numeric(8,2),
 "payback_meses" numeric(5,2),
 "comprador_nome" character varying(200) NOT NULL,
 "comprador_cpf" character varying(14),
 "comprador_rg" character varying(20),
 "comprador_telefone" character varying(20),
 "comprador_email" character varying(320),
 "comprador_estado_civil" character varying(30),
 "comprador_profissao" character varying(100),
 "comprador_instagram" character varying(100),
 "comprador_cep" character varying(9),
 "comprador_cidade" character varying(100),
 "comprador_estado" character varying(2),
 "comprador_endereco" character varying(300),
 "comprador_local_trabalho" character varying(200),
 "status" public.status_venda_telefone NOT NULL,
 "data_venda" timestamp with time zone NOT NULL DEFAULT now(),
 "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
 "user_id" integer
);
CREATE TABLE public.parcelas_venda_telefone(
 "id" bigserial PRIMARY KEY,
 "venda_id" bigint NOT NULL REFERENCES public.vendas_telefone(id) ON DELETE CASCADE,
 "numero" integer NOT NULL,
 "valor" numeric(12,2) NOT NULL,
 "vencimento" timestamp with time zone NOT NULL,
 "status" public.status_parcela NOT NULL,
 "pago_em" timestamp with time zone,
 "valor_pago" numeric(12,2),
 "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
 "user_id" integer
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.vendas_telefone,public.parcelas_venda_telefone TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.vendas_telefone_id_seq,public.parcelas_venda_telefone_id_seq TO service_role;
