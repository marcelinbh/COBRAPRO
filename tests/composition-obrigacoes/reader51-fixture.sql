-- Apenas fixture sintética privada, criada ANTES dos selos34..51.
-- Não copia dados produtivos nem reescreve histórico depois de instalado.
INSERT INTO contratos(id,user_id,cliente_id,koletor_id,conta_caixa_id,modalidade,tipo_taxa,valor_principal,valor_parcela,total_contrato,num_parcelas,numero_parcelas,data_inicio,data_vencimento,status,multa_atraso,juros_mora_diario)
VALUES
 (970,1,1,1,NULL,'mensal','mensal',650,216.67,650.01,3,3,'2025-01-01','2025-04-01','atrasado',0,0),
 (971,1,1,1,NULL,'mensal','mensal',100,50,100,2,2,'2025-01-01','2025-03-01','atrasado',0,0),
 (972,1,1,1,6,'mensal','mensal',100,50,100,2,2,'2026-11-01','2027-02-01','ativo',0,0),
 (973,1,1,1,6,'mensal','mensal',100,100,100,1,1,'2025-01-01','2025-02-01','ativo',0,0);
INSERT INTO parcelas(id,contrato_id,user_id,cliente_id,koletor_id,conta_caixa_id,numero,numero_parcela,valor,valor_original,valor_juros,valor_pago,saldo_residual,data_vencimento,data_pagamento,status)
VALUES
 (970001,970,1,1,1,6,1,1,216.67,216.67,0,216.67,0,'2025-02-01','2025-02-01','paga'),
 (970002,970,1,1,1,NULL,2,2,216.67,216.67,0,NULL,0,'2025-03-01',NULL,'atrasada'),
 (970003,970,1,1,1,NULL,3,3,216.67,216.67,0,NULL,0,'2025-04-01',NULL,'atrasada'),
 (971001,971,1,1,1,6,1,1,50,50,0,0,0,'2025-02-01',NULL,'atrasada'),
 (971002,971,1,1,1,NULL,2,2,50,50,0,0,0,'2025-03-01',NULL,'atrasada'),
 (972001,972,1,1,1,6,1,1,50,50,0,0,0,'2027-01-01',NULL,'pendente'),
 (972002,972,1,1,1,6,2,2,50,50,0,0,0,'2027-02-01',NULL,'pendente'),
 (973001,973,1,1,1,6,1,1,100,100,0,NULL,0,'2025-02-01',NULL,'atrasada');
INSERT INTO transacoes_caixa(user_id,conta_caixa_id,contrato_id,parcela_id,tipo,categoria,valor,descricao,data_transacao)
VALUES(1,6,970,970001,'entrada','pagamento_parcela',216.67,'Pagamento sintético histórico próprio','2025-02-01');
INSERT INTO contrato_historico(user_id,contrato_id,tipo,descricao,valor_anterior,valor_novo)
VALUES('1',970,'criacao','Histórico antigo próprio sem conta de origem',NULL,650),
 ('1',970,'pagamento','Pagamento histórico sintético próprio',0,216.67),
 ('1',971,'criacao','Histórico próprio null origem e aliases parcela divergentes',NULL,100),
 ('1',972,'criacao','Controle validado legível',NULL,100),
 ('1',973,'criacao','Null monetário próprio com conta presente',NULL,100);
