-- CobraPro: integridade de numeração de parcelas.
-- Pré-requisito operacional: executar a consulta de auditoria de duplicidades antes
-- desta migration. Ela não altera dados existentes e falha de forma segura se houver
-- registros legados duplicados que precisem ser saneados manualmente.

CREATE UNIQUE INDEX IF NOT EXISTS parcelas_user_contrato_numero_uk
  ON public.parcelas (user_id, contrato_id, numero_parcela)
  WHERE user_id IS NOT NULL;
