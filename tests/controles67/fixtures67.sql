-- SOMENTE fixture sintética no PG17 isolado do parent, ANTES dos selos20..60.
-- Nunca aplicar em produção; nenhuma migração da tabela antiga.
DO $$ BEGIN
 IF to_regclass('public.etiquetas_contratos') IS NULL THEN
  CREATE TABLE public.etiquetas_contratos(id bigint PRIMARY KEY,contrato_id bigint NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,nome varchar(50) NOT NULL,cor varchar(20) NOT NULL DEFAULT '#6b7280',created_at timestamptz);
  ALTER TABLE public.etiquetas_contratos ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.etiquetas_contratos FROM PUBLIC,anon,authenticated;
 END IF;
END $$;
INSERT INTO public.users(id) VALUES(6701),(6702);
INSERT INTO public.clientes(id,user_id,nome) VALUES(6701,6701,'Homônimo67 sintético'),(6702,6701,'Homônimo67 sintético'),(6703,6702,'Externo67 sintético');
INSERT INTO public.contas_caixa(id,user_id,nome,tipo,saldo) VALUES(6701,6701,'Caixa67 sintético','caixa',0),(6702,6702,'Caixa67 externo sintético','caixa',0);
INSERT INTO public.koletores(id,user_id,nome,perfil,ativo) VALUES(6701,6701,'Admin67 próprio','admin',true),(6702,6701,'Coletor67 próprio','koletor',false),(6703,6702,'EXTERNO67 não expor','koletor',true);
INSERT INTO public.contratos(id,user_id,cliente_id,koletor_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario,etiquetas)
 SELECT i,6701,CASE WHEN i=67004 THEN 6703 WHEN i=67002 THEN 6702 ELSE 6701 END,CASE WHEN i=67001 THEN 6702 WHEN i=67006 THEN 6703 ELSE NULL END,6701,'mensal','mensal',100,100,100,1,1,'2026-11-01','2027-01-10','ativo',0,0,CASE WHEN i=67001 THEN '["Histórico67"]' WHEN i=67003 THEN 'JSON67 inválido' ELSE NULL END FROM generate_series(67001,67004) i;
INSERT INTO public.parcelas(id,user_id,contrato_id,cliente_id,koletor_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,valor_multa,multa_manual,saldo_residual,data_vencimento,status)
 SELECT i*10,6701,i,CASE WHEN i=67004 THEN 6703 WHEN i=67002 THEN 6702 ELSE 6701 END,CASE WHEN i=67001 THEN 6702 WHEN i=67006 THEN 6703 ELSE NULL END,6701,1,1,100,100,0,0,0,0,0,'2027-01-10','pendente' FROM generate_series(67001,67004) i;
INSERT INTO public.contratos(id,user_id,cliente_id,koletor_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario,etiquetas)
 VALUES(67005,6702,6703,6703,6702,'mensal','mensal',100,100,100,1,1,'2026-11-01','2027-01-10','ativo',0,0,'["EXTERNO67 não expor"]');
INSERT INTO public.parcelas(id,user_id,contrato_id,cliente_id,koletor_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,valor_multa,multa_manual,saldo_residual,data_vencimento,status)
 VALUES(670050,6702,67005,6703,6703,6702,1,1,100,100,0,0,0,0,0,'2027-01-10','pendente');
INSERT INTO public.etiquetas_contratos(id,contrato_id,nome) VALUES(67001,67001,'Antigo por contrato67'),(67002,67005,'EXTERNO tabela antiga67');

INSERT INTO public.contratos(id,user_id,cliente_id,koletor_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario,etiquetas)
 VALUES(67006,6701,6701,6703,6701,'mensal','mensal',100,100,100,1,1,'2026-11-01','2027-01-10','ativo',0,0,'["Não expor6"]');
INSERT INTO public.parcelas(id,user_id,contrato_id,cliente_id,koletor_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,valor_multa,multa_manual,saldo_residual,data_vencimento,status)
 VALUES(670060,6701,67006,6701,6703,6701,1,1,100,100,0,0,0,0,0,'2027-01-10','pendente');
