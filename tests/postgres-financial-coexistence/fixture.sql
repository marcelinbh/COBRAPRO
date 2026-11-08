-- Complemento sintético ao fixture fiel tests/postgres-loans/fixture.sql.
-- Nenhum dado privado, reconciliação ou mutação de legado.
CREATE ROLE unprivileged NOLOGIN;
CREATE TABLE public.contas_pagar (
  id serial NOT NULL PRIMARY KEY,
  descricao character varying(255) NOT NULL,
  categoria character varying(50) DEFAULT 'outros'::character varying,
  valor numeric(15,2) NOT NULL,
  data_vencimento date NOT NULL,
  data_pagamento date,
  status character varying(20) DEFAULT 'pendente'::character varying,
  recorrente boolean DEFAULT false,
  frequencia character varying(20),
  conta_caixa_id integer,
  observacoes text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  user_id integer,
  CONSTRAINT contas_pagar_categoria_check CHECK (categoria::text = ANY (ARRAY['aluguel'::character varying, 'energia'::character varying, 'agua'::character varying, 'internet'::character varying, 'telefone'::character varying, 'salario'::character varying, 'imposto'::character varying, 'fornecedor'::character varying, 'outros'::character varying]::text[])),
  CONSTRAINT contas_pagar_status_check CHECK (status::text = ANY (ARRAY['pendente'::character varying, 'pago'::character varying, 'atrasado'::character varying, 'cancelado'::character varying]::text[])),
  CONSTRAINT contas_pagar_frequencia_check CHECK (frequencia::text = ANY (ARRAY['mensal'::character varying, 'semanal'::character varying, 'quinzenal'::character varying, 'anual'::character varying]::text[])),
  CONSTRAINT contas_pagar_conta_caixa_id_fkey FOREIGN KEY (conta_caixa_id) REFERENCES public.contas_caixa(id),
  CONSTRAINT contas_pagar_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE INDEX idx_contas_pagar_user_id ON public.contas_pagar(user_id);
INSERT INTO public.contas_pagar(id,descricao,valor,data_vencimento,user_id)
VALUES(900,'Despesa legada sintética',12,'2026-11-07',1);
SELECT setval('public.contas_pagar_id_seq',1000);
-- 0018 já habilitou RLS nestas três bases em produção (06/11).
-- Correção conhecida: nenhum tipo/default/CHECK/FK/índice ou policy é alterado.
ALTER TABLE public.contas_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_caixa ENABLE ROW LEVEL SECURITY;
-- Backend produtivo ignora RLS, mas não ACL/guardas; não é superuser/owner.
ALTER ROLE service_role NOSUPERUSER BYPASSRLS;
-- Privilégios legados explícitos para provar que guardas, não falta de GRANT,
-- bloqueiam escrita manual backend. Nenhuma permissão superuser/interna.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.contas_caixa,public.transacoes_caixa,
 public.contas_pagar,public.contratos,public.parcelas,public.contrato_historico TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
