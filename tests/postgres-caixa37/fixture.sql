-- Complemento exclusivamente sintético37, ANTES das migrations. Nunca saneamento real.
DELETE FROM public.transacoes_caixa;
INSERT INTO public.contas_caixa(id,user_id,nome,saldo,ativo) VALUES
 (6,1,'Conta legado34',1000,true),(7,1,'Destino37',-100,true),(8,1,'Base negativa37',-10.01,true);
UPDATE public.contas_caixa SET saldo=7.00 WHERE id=3;
ALTER TABLE public.users ADD COLUMN "passwordHash" text,ADD COLUMN session_version integer NOT NULL DEFAULT 0,
 ADD CONSTRAINT users_session_version_nonnegative CHECK(session_version>=0);
-- Legado34 elegível dedicado, sem sobrepor fixtures adversariais anteriores.
INSERT INTO public.contratos(id,user_id,cliente_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status)
 VALUES(910,1,1,6,'mensal','mensal',10,10,10,1,1,'2026-01-01','2026-02-01','ativo');
INSERT INTO public.parcelas(id,contrato_id,user_id,cliente_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,data_vencimento,status)
 VALUES(910,910,1,1,6,1,1,10,10,0,0,'2026-02-01','pendente');
SELECT setval('public.contas_caixa_id_seq',20);
-- Ledger histórico grande somente antes da instalação, sem capability/prova inventada.
INSERT INTO public.users(id) VALUES(3);
INSERT INTO public.contas_caixa(id,user_id,nome,saldo,ativo) VALUES(30,3,'Agregado acima safe integer',-9999999999999.99,true),(31,3,'Histórico inativo',12.34,false);
INSERT INTO public.transacoes_caixa(user_id,conta_caixa_id,tipo,categoria,valor,descricao,data_transacao)
 SELECT 3,30,'entrada','ajuste_manual',9999999999999.99,'Histórico sintético grande '||i,'2026-01-01'::date FROM generate_series(1,1001) i;
