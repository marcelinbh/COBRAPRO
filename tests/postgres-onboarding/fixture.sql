-- Fixture exclusivamente sintética. Não lê dump, credenciais ou conexão de produção.
CREATE TABLE public.users (
  id integer PRIMARY KEY,
  onboarding_completo boolean NOT NULL DEFAULT false,
  nome_empresa varchar(255),
  "updatedAt" timestamptz NOT NULL
);
CREATE TABLE public.contas_caixa (
  id serial PRIMARY KEY,
  nome varchar(255) NOT NULL,
  tipo varchar(20) NOT NULL DEFAULT 'caixa' CHECK (tipo IN ('caixa','banco','digital')),
  saldo numeric(15,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  user_id integer
);
-- Sentinelas financeiras isoladas: nenhuma dependência da RPC, nenhum DML autorizado.
CREATE TABLE public.clientes (id integer PRIMARY KEY, user_id integer, nome text);
CREATE TABLE public.transacoes_caixa (id integer PRIMARY KEY, user_id integer, conta_caixa_id integer, valor numeric(15,2));
INSERT INTO public.users(id,onboarding_completo,nome_empresa,"updatedAt")
SELECT id,completo,empresa,now() FROM (VALUES
  (1,false,NULL),(2,false,NULL),(3,false,NULL),(4,true,'Concluída'),(5,true,'Concluída'),
  (6,false,NULL),(7,false,NULL),(8,false,NULL),(9,false,NULL),(10,false,NULL),
  (900,true,'Legada')) AS fixture(id,completo,empresa);
INSERT INTO public.contas_caixa(id,user_id,nome,tipo,saldo,ativo) VALUES
  (20,2,'Banco Existente','banco',987.65,true),
  (21,2,'Segunda Ativa','caixa',123.45,true),
  (22,2,'Inativa','digital',45.67,false),
  (30,3,'Inativa','banco',99.00,false),
  (40,4,'Inativa','caixa',222.22,false),
  (50,5,'Caixa Principal','caixa',77.77,true),
  (60,NULL,'Órfã','caixa',88.88,true),
  (900,900,'Legada','digital',999999.99,true);
SELECT setval(pg_get_serial_sequence('public.contas_caixa','id'),1000,true);
INSERT INTO public.clientes VALUES(900,900,'Cliente sintético legado');
INSERT INTO public.transacoes_caixa VALUES(900,900,900,123.45);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_caixa ENABLE ROW LEVEL SECURITY;
-- Sem policies ou grants de tabelas: a RPC definer deve funcionar sem ampliar acesso REST.
REVOKE ALL ON public.users,public.contas_caixa,public.clientes,public.transacoes_caixa FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.contas_caixa_id_seq FROM PUBLIC,anon,authenticated,service_role;
