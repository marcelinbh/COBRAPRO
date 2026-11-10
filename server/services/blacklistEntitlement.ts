import { TRPCError } from "@trpc/server";
import { resolveVerifiedKiwifyBlacklistEvidence } from "./kiwifySubscriptionRuntime";
import { parseKiwifySubscriptionUtc } from "./kiwifySubscriptions";
import { resolveManualLifetimeBlacklistEvidence, MANUAL_LIFETIME_SOURCE } from "./blacklistManualEntitlement";

export type BlacklistIdentity = { id: number; openId?: string; role?: string };

/** Evidência de uma fonte confiável do servidor. Cadastro, role/admin e
 * assinaturas financeiras dos clientes NÃO representam o plano CobraPro.
 * Vitalício manual exige concessão explícita auditada do proprietário.
 */
export type BlacklistSubscriptionEvidence = {
  userId: number;
  status: "active" | "inactive" | "cancelled" | "expired";
  validUntil: string | null;
  source: string;
  lifetime: boolean;
  validFrom: string;
};
export type BlacklistEntitlementResolver = (
  userId: number,
) => Promise<BlacklistSubscriptionEvidence | null>;

async function resolveCurrentBlacklistEvidence(userId: number): Promise<BlacklistSubscriptionEvidence | null> {
  const manual = await resolveManualLifetimeBlacklistEvidence(userId);
  // Suspensão/revogação da concessão explícita é autoritativa; não é contornada
  // por outra fonte. Sem concessão, preserva a integração Kiwify já existente.
  if (manual !== null) return manual;
  return resolveVerifiedKiwifyBlacklistEvidence(userId);
}
let trustedResolver: BlacklistEntitlementResolver = resolveCurrentBlacklistEvidence;

/** Composição backend exclusiva. Resolver é chamado a CADA operação, inclusive
 * depois do IO de Storage. undefined restaura as duas fontes confiáveis; não
 * cria concessões, não cadastra assinantes e não habilita bypass por role.
 */
export function configureBlacklistEntitlementResolver(resolver?: BlacklistEntitlementResolver): void {
  trustedResolver = resolver ?? resolveCurrentBlacklistEvidence;
}

export function requireBlacklistEnabled(): void {
  if (process.env.ENABLE_BLACKLIST_PRIVATE !== "true") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Blacklist indisponível: liberação privada pendente de validação." });
  }
}

export async function requireBlacklistEntitlement(user: BlacklistIdentity | null | undefined): Promise<void> {
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || user.id > 2_147_483_647 || user.openId?.startsWith("cron_")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre na sua conta para acessar a Blacklist." });
  }
  requireBlacklistEnabled();
  let evidence: BlacklistSubscriptionEvidence | null;
  try {
    evidence = await trustedResolver(user.id);
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível confirmar sua assinatura. Tente novamente mais tarde." });
  }
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/;
  const from = typeof evidence?.validFrom === "string" && isoTimestamp.test(evidence.validFrom)
    ? parseKiwifySubscriptionUtc(evidence.validFrom) : null;
  const starts = from ? Date.parse(from) : NaN;
  const now = Date.now();
  let allowed = Boolean(evidence && evidence.userId === user.id && evidence.status === "active"
    && Number.isFinite(now) && Number.isFinite(starts) && starts <= now);
  if (evidence?.source === MANUAL_LIFETIME_SOURCE) {
    allowed = allowed && evidence.lifetime === true && evidence.validUntil === null;
  } else {
    const until = typeof evidence?.validUntil === "string" && isoTimestamp.test(evidence.validUntil)
      ? parseKiwifySubscriptionUtc(evidence.validUntil) : null;
    const expires = until ? Date.parse(until) : NaN;
    allowed = allowed && evidence?.source === "kiwify:authenticated-webhook+verified-sale"
      && evidence.lifetime === false && Number.isFinite(expires) && expires > now && expires > starts;
  }
  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A Blacklist exige assinatura atual comprovada. Consulte o responsável pelo seu plano." });
  }
}
