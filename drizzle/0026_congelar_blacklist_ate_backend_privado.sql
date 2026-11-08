-- Contenção transitória de rollout: a versão anterior não verifica entitlement/storage privado.
-- Aplicar depois 0019/0023 e ANTES de expor escrita; reabrir somente com backend privado live.
-- Não altera linhas, owners ou objetos Storage. SELECT vazio permanece backend-only.
BEGIN;
LOCK TABLE public.blacklist, public.blacklist_fotos IN ACCESS EXCLUSIVE MODE;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.blacklist, public.blacklist_fotos FROM service_role;
REVOKE ALL ON FUNCTION public.blacklist_delete_empty_owned(integer,integer) FROM service_role;
COMMIT;
