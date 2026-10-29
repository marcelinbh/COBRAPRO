import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/0016_revogacao_sessoes_reset_senha.sql"),
  "utf8",
);

describe("migration 0016 — revogação de sessões após reset", () => {
  it("adiciona estado de revogação por usuário sem invalidar a base atual", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0");
    expect(migration).toContain("users_session_version_nonnegative");
    expect(migration).toContain("CHECK (session_version >= 0)");
  });

  it("incrementa a versão somente se a hash de senha realmente mudar", () => {
    expect(migration).toContain("revogar_sessoes_ao_alterar_senha");
    expect(migration).toContain("to_jsonb(OLD)");
    expect(migration).toContain("NEW.session_version := OLD.session_version + 1");
    expect(migration).toContain("BEFORE UPDATE ON public.users");
  });

  it("consome token, altera senha e devolve a versão na mesma função transacional", () => {
    expect(migration).toContain("consume_password_reset_and_revoke_sessions");
    expect(migration).toContain("UPDATE public.password_resets");
    expect(migration).toContain("AND usado = false");
    expect(migration).toContain("AND expires_at > now()");
    expect(migration).toContain("SET %I = p_password_hash");
    expect(migration).toContain("RETURNING users.id, users.session_version");
    expect(migration).not.toContain("p_user_id");
  });

  it("não expõe a RPC de reset a usuários ou papéis públicos", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = pg_catalog, public");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });
});
