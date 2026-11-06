export function isSessionVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function sessionVersionFromUser(user: { sessionVersion?: unknown; session_version?: unknown }): number {
  const hasSnake = Object.hasOwn(user, "session_version");
  const hasCamel = Object.hasOwn(user, "sessionVersion");
  const version = hasSnake ? user.session_version : user.sessionVersion;
  if (!isSessionVersion(version) || (hasSnake && hasCamel && user.sessionVersion !== undefined && user.sessionVersion !== version)) {
    throw new Error("Versão de sessão indisponível; valide a migration 0016 antes da ativação.");
  }
  return version;
}

/** Somente service_role, nunca chamada diretamente pelo cliente. Sem fallback REST. */
export async function resetPasswordAndRevokeSessions(
  client: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> },
  tokenHash: string,
  passwordHash: string,
): Promise<boolean> {
  let response: { data: unknown; error: unknown };
  try {
    response = await client.rpc("consume_password_reset_and_revoke_sessions", {
      p_token_hash: tokenHash,
      p_password_hash: passwordHash,
    });
  } catch {
    // Nunca vazar transporte, respostas do banco ou hashes nos logs do chamador.
    throw new Error("Redefinição transacional de senha indisponível.");
  }
  const { data, error } = response;
  if (error) throw new Error("Redefinição transacional de senha indisponível.");
  if (!Array.isArray(data)) throw new Error("Resposta inválida da redefinição transacional.");
  if (data.length === 0) return false;
  if (data.length !== 1 || typeof data[0]?.user_id !== "number" || !Number.isSafeInteger(data[0].user_id) || data[0].user_id <= 0 || !isSessionVersion(data[0].session_version) || data[0].session_version < 1) {
    throw new Error("Resposta inválida da redefinição transacional.");
  }
  return true;
}
