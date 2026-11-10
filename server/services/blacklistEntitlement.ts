import { TRPCError } from "@trpc/server";
import { resolveVerifiedKiwifyBlacklistEvidence } from "./kiwifySubscriptionRuntime";
import { parseKiwifySubscriptionUtc } from "./kiwifySubscriptions";

export type BlacklistIdentity = { id: number; openId?: string; role?: string };

/** Evidência atual obtida EXCLUSIVAMENTE de uma fonte confiável no servidor.
 * Não aceitar campos do navegador, loginMethod, role/admin ou cadastro como prova.
 * users (drizzle/schema.ts) não tem assinatura/plano/validade; assinaturas é o
 * produto financeiro cobrado dos clientes do tenant, NÃO o plano CobraPro.
 */
export type BlacklistSubscriptionEvidence = {
  userId: number;
  status: "active" | "inactive" | "cancelled" | "expired";
  validUntil: string;
  source: string;
  lifetime: boolean;
  validFrom: string;
};
export type BlacklistEntitlementResolver = (
  userId: number,
) => Promise<BlacklistSubscriptionEvidence | null>;

let trustedResolver: BlacklistEntitlementResolver = resolveVerifiedKiwifyBlacklistEvidence;

/** Composição backend após review da fonte e ACL; nunca expor via RPC/ENV público.
 * Não há fallback manual/vitalício/cadastro que torna usuários antigos assinantes.
 * Resolver é chamado a CADA operação (inclusive download), sem cache de elegibilidade.
 * undefined restaura a fonte padrão Kiwify; não habilita grants legados.
 */
export function configureBlacklistEntitlementResolver(resolver?: BlacklistEntitlementResolver): void {
  trustedResolver = resolver ?? resolveVerifiedKiwifyBlacklistEvidence;
}

export function requireBlacklistEnabled(): void {
  if (process.env.ENABLE_BLACKLIST_PRIVATE !== "true") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Blacklist indisponível: liberação privada pendente de validação." });
  }
}

export async function requireBlacklistEntitlement(user: BlacklistIdentity | null | undefined): Promise<void> {
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || user.openId?.startsWith("cron_")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre na sua conta para acessar a Blacklist." });
  }
  requireBlacklistEnabled();
  let evidence: BlacklistSubscriptionEvidence | null;
  try {
    evidence = await trustedResolver(user.id);
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível confirmar sua assinatura. Tente novamente mais tarde." });
  }
  // Só o período finito da fonte exata Kiwify é prova. Datas do ledger/gate
  // exigem UTC explícito e calendário real; Date.parse sozinho normaliza dias inválidos.
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/;
  const from = typeof evidence?.validFrom === "string" && isoTimestamp.test(evidence.validFrom)
    ? parseKiwifySubscriptionUtc(evidence.validFrom) : null;
  const until = typeof evidence?.validUntil === "string" && isoTimestamp.test(evidence.validUntil)
    ? parseKiwifySubscriptionUtc(evidence.validUntil) : null;
  const starts = from ? Date.parse(from) : NaN;
  const expires = until ? Date.parse(until) : NaN;
  const now = Date.now();
  if (!evidence || evidence.userId !== user.id || evidence.status !== "active"
    || evidence.source !== "kiwify:authenticated-webhook+verified-sale"
    || evidence.lifetime !== false || !Number.isFinite(now)
    || !Number.isFinite(starts) || starts > now
    || !Number.isFinite(expires) || expires <= now || expires <= starts) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A Blacklist exige assinatura atual comprovada. Consulte o responsável pelo seu plano." });
  }
}
