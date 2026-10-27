/**
 * Prioriza o token que integra a rota pública /portal/:token.
 * O fallback para query string preserva links emitidos por versões antigas.
 */
export function resolverTokenPortal(tokenDaRota: string | undefined, search: string): string | null {
  const tokenNormalizado = tokenDaRota?.trim();
  if (tokenNormalizado) return tokenNormalizado;

  const legado = new URLSearchParams(search).get("token")?.trim();
  return legado || null;
}
