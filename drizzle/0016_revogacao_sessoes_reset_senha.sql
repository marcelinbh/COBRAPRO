-- CobraPro: revogação de todas as sessões após troca de senha.
-- Esta migration é PostgreSQL/Supabase. Não execute o histórico MySQL legado.
-- Execute após validar os nomes físicos do schema por preflight no projeto COBRA PRO.

DO $$
DECLARE
  v_password_column text;
  v_updated_column text;
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.password_resets') IS NULL THEN
    RAISE EXCEPTION 'Migration bloqueada: users ou password_resets não existe.';
  END IF;

  -- Produção pode usar convenções camelCase ou snake_case; exigir uma única
  -- correspondência evita atualizar a coluna errada silenciosamente.
  SELECT attname INTO v_password_column
  FROM pg_attribute
  WHERE attrelid = 'public.users'::regclass
    AND attname IN ('passwordHash', 'password_hash')
    AND NOT attisdropped;
  IF v_password_column IS NULL THEN
    RAISE EXCEPTION 'Migration bloqueada: coluna de hash de senha não encontrada em users.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute
      WHERE attrelid = 'public.users'::regclass
        AND attname IN ('passwordHash', 'password_hash')
        AND NOT attisdropped) <> 1 THEN
    RAISE EXCEPTION 'Migration bloqueada: schema de users possui colunas de hash ambíguas.';
  END IF;

  SELECT attname INTO v_updated_column
  FROM pg_attribute
  WHERE attrelid = 'public.users'::regclass
    AND attname IN ('updatedAt', 'updated_at')
    AND NOT attisdropped;
  IF v_updated_column IS NULL THEN
    RAISE EXCEPTION 'Migration bloqueada: coluna de atualização não encontrada em users.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute
      WHERE attrelid = 'public.users'::regclass
        AND attname IN ('updatedAt', 'updated_at')
        AND NOT attisdropped) <> 1 THEN
    RAISE EXCEPTION 'Migration bloqueada: schema de users possui colunas de atualização ambíguas.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.password_resets'::regclass
      AND attname IN ('user_id', 'token', 'expires_at', 'usado')
      AND NOT attisdropped
    GROUP BY attrelid
    HAVING count(*) <> 4
  ) OR (SELECT count(*) FROM pg_attribute
        WHERE attrelid = 'public.password_resets'::regclass
          AND attname IN ('user_id', 'token', 'expires_at', 'usado')
          AND NOT attisdropped) <> 4 THEN
    RAISE EXCEPTION 'Migration bloqueada: password_resets não possui o contrato físico esperado.';
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE session_version IS NULL OR session_version < 0) THEN
    RAISE EXCEPTION 'Migration bloqueada: session_version legado inválido.';
  END IF;
END $$;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_session_version_nonnegative;
ALTER TABLE public.users
  ADD CONSTRAINT users_session_version_nonnegative CHECK (session_version >= 0);

-- A trigger é gerada com o nome físico confirmado no preflight. Qualquer
-- alteração da hash de senha (inclusive por rota futura) revoga sessões, mas
-- alterações de perfil/lastSignedIn não alteram a versão.
DO $$
DECLARE
  v_password_column text;
BEGIN
  SELECT attname INTO v_password_column
  FROM pg_attribute
  WHERE attrelid = 'public.users'::regclass
    AND attname IN ('passwordHash', 'password_hash')
    AND NOT attisdropped;

  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION public.revogar_sessoes_ao_alterar_senha()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = pg_catalog, public
    AS $body$
    BEGIN
      IF (to_jsonb(OLD) ->> %L) IS DISTINCT FROM (to_jsonb(NEW) ->> %L) THEN
        NEW.session_version := OLD.session_version + 1;
      END IF;
      RETURN NEW;
    END;
    $body$;
  $sql$, v_password_column, v_password_column);
END $$;

DROP TRIGGER IF EXISTS users_revogar_sessoes_ao_alterar_senha ON public.users;
CREATE TRIGGER users_revogar_sessoes_ao_alterar_senha
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.revogar_sessoes_ao_alterar_senha();

-- Consome o token, altera a senha e incrementa session_version em uma única
-- transação. Não recebe user_id do cliente e não possui fallback REST.
DO $$
DECLARE
  v_password_column text;
  v_updated_column text;
BEGIN
  SELECT attname INTO v_password_column
  FROM pg_attribute
  WHERE attrelid = 'public.users'::regclass
    AND attname IN ('passwordHash', 'password_hash')
    AND NOT attisdropped;
  SELECT attname INTO v_updated_column
  FROM pg_attribute
  WHERE attrelid = 'public.users'::regclass
    AND attname IN ('updatedAt', 'updated_at')
    AND NOT attisdropped;

  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION public.consume_password_reset_and_revoke_sessions(
      p_token_hash text,
      p_password_hash text
    )
    RETURNS TABLE(user_id integer, session_version integer)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $body$
    DECLARE
      v_user_id integer;
    BEGIN
      IF p_token_hash IS NULL OR length(p_token_hash) <> 64
         OR p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
        RAISE EXCEPTION 'Parâmetros de recuperação inválidos' USING ERRCODE = '22023';
      END IF;

      UPDATE public.password_resets
      SET usado = true
      WHERE token = p_token_hash
        AND usado = false
        AND expires_at > now()
      RETURNING password_resets.user_id INTO v_user_id;

      IF v_user_id IS NULL THEN
        RETURN;
      END IF;

      RETURN QUERY
      UPDATE public.users
      SET %I = p_password_hash,
          %I = now()
      WHERE id = v_user_id
      RETURNING users.id, users.session_version;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuário associado ao token não encontrado' USING ERRCODE = '23503';
      END IF;
    END;
    $body$;
  $sql$, v_password_column, v_updated_column);
END $$;

REVOKE ALL ON FUNCTION public.consume_password_reset_and_revoke_sessions(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_password_reset_and_revoke_sessions(text, text)
  TO service_role;
