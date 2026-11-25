-- PROPOSTA DML APENAS: NÃO EXECUTADA EM PRODUÇÃO. SEM DDL/CRON/FLAGS/ENV/FILA.
-- Verificar primeiro PRE_READONLY no projeto BkqW4WQ4ndZHJQHLtTMfxv,
-- confirmando metadados da tarefa já existente e autorização do pai.
-- O callback novo não deve ser publicado antes de registry confirmado:
-- ausência permanece fail-closed, então publicação isolada cortaria o Manus atual.
-- Identidade de plataforma 310519663380431118 NÃO vira user_id local.
-- Chave reservada + NULL constitui escopo de PROJETO; UID precisa ser exato.
-- Transação termina ROLLBACK por segurança. COMMIT depende de aprovação separada
-- e revisão explícita pelo pai; este artefato não autoriza execução.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '5s';
-- Configuracoes não tem unique de NULL; lock evita race sem criar índice/DDL.
LOCK TABLE public.configuracoes IN SHARE ROW EXCLUSIVE MODE;
DO $registry$
DECLARE
  project_id CONSTANT text := 'BkqW4WQ4ndZHJQHLtTMfxv';
  task_uid CONSTANT text := 'cGt8wArds2oGUEpKbRJZo8';
  reserved_key CONSTANT text := '__notificacoes_project_task_uid:BkqW4WQ4ndZHJQHLtTMfxv';
  total integer;
  exact integer;
  inserted integer;
BEGIN
  IF reserved_key <> '__notificacoes_project_task_uid:' || project_id
     OR task_uid <> 'cGt8wArds2oGUEpKbRJZo8' THEN
    RAISE EXCEPTION 'AGENDA_PROJECT_GUARD';
  END IF;
  SELECT count(*)::integer,
         count(*) FILTER (WHERE chave = reserved_key AND user_id IS NULL AND valor = task_uid)::integer
    INTO total, exact
    FROM public.configuracoes
    WHERE chave = reserved_key
       OR (chave = 'notificacoes_cron_task_uid' AND valor = task_uid) LIMIT 1;
  IF total = 0 THEN
    INSERT INTO public.configuracoes (chave, valor, user_id, "createdAt", "updatedAt")
      SELECT reserved_key, task_uid, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE project_id = 'BkqW4WQ4ndZHJQHLtTMfxv'
        AND reserved_key = '__notificacoes_project_task_uid:' || project_id
        AND task_uid = 'cGt8wArds2oGUEpKbRJZo8' LIMIT 1;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    IF inserted <> 1 THEN RAISE EXCEPTION 'AGENDA_REGISTRY_INSERT_GUARD'; END IF;
  ELSIF total <> 1 OR exact <> 1 THEN
    RAISE EXCEPTION 'AGENDA_REGISTRY_AMBIGUO_OU_SCOPE_INVALIDO';
  END IF;
  -- Já exato é no-op: não atualiza nenhum timestamp, não adota tenant.
  SELECT count(*)::integer,
         count(*) FILTER (WHERE chave = reserved_key AND user_id IS NULL AND valor = task_uid)::integer
    INTO total, exact
    FROM public.configuracoes
    WHERE chave = reserved_key
       OR (chave = 'notificacoes_cron_task_uid' AND valor = task_uid) LIMIT 1;
  IF total <> 1 OR exact <> 1 THEN RAISE EXCEPTION 'AGENDA_REGISTRY_POST_GUARD'; END IF;
END
$registry$;
SELECT id, chave, user_id, valor = 'cGt8wArds2oGUEpKbRJZo8' AS uid_exato
FROM public.configuracoes
WHERE chave = '__notificacoes_project_task_uid:BkqW4WQ4ndZHJQHLtTMfxv'
ORDER BY id LIMIT 2;
ROLLBACK;
