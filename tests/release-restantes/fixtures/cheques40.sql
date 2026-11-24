-- Shape e catálogo produtivos informados pelo pai; dados/ACL locais sintéticos.
CREATE TABLE public.cheques(
 id serial PRIMARY KEY,cliente_id integer REFERENCES public.clientes(id),numero_cheque varchar(50) NOT NULL,
 banco varchar(100),agencia varchar(20),conta varchar(30),valor_nominal numeric(15,2) NOT NULL,
 data_emissao date NOT NULL,data_vencimento date NOT NULL,taxa_desconto numeric(5,2) DEFAULT 0,
 valor_descontado numeric(15,2),valor_liquido numeric(15,2),status varchar(20) DEFAULT 'em_carteira',
 conta_caixa_id integer REFERENCES public.contas_caixa(id),observacoes text,
 "createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now(),user_id integer REFERENCES public.users(id),
 CONSTRAINT cheques_status_check CHECK (status IN ('em_carteira','descontado','compensado','devolvido','cancelado')));
CREATE INDEX idx_cheques_user_id ON public.cheques(user_id);
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cheques TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.cheques_id_seq TO service_role;
INSERT INTO public.contas_caixa(id,user_id,nome,saldo,ativo) VALUES
 (101,1,'Cheque compartilhável sintético',1000,true),(102,2,'Cheque outro owner',1000,true),(103,1,'Cheque corrida underflow',100,true);
INSERT INTO public.cheques(id,numero_cheque,valor_nominal,data_emissao,data_vencimento,user_id,status,taxa_desconto)
 VALUES(900,'LEGADO-NULLS',1,'2020-01-01','2090-01-01',NULL,NULL,NULL);
SELECT setval('public.cheques_id_seq',1000);
