import { TRPCError } from "@trpc/server";
import { getSupabaseClientAsync } from "../db";

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
  lifetime?: boolean;
  validFrom?: string;
};
export type BlacklistEntitlementResolver = (
  userId: number,
) => Promise<BlacklistSubscriptionEvidence | null>;

async function auditedGrantResolver(userId: number): Promise<BlacklistSubscriptionEvidence | null> {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new Error("Fonte de acesso indisponível");
  const { data, error } = await sb.from("blacklist_access_grants")
    .select("user_id, status, starts_at, ends_at, lifetime, evidence, granted_by")
    .eq("user_id", userId).limit(1).maybeSingle();
  if (error) throw new Error("Concessões indisponíveis: validar migration 0023");
  if (!data || data.status !== "ativo" || !data.evidence?.trim() || !data.granted_by) return null;
  return {
    userId: data.user_id, status: "active", validFrom: data.starts_at,
    validUntil: data.ends_at ?? "", lifetime: data.lifetime === true,
    source: "blacklist_access_grants:0023",
  };
}

let trustedResolver: BlacklistEntitlementResolver = auditedGrantResolver;

/** Composição backend após review da fonte e ACL; nunca expor via RPC/ENV público.
 * Não há provedor inventado nem fallback que torna usuários antigos assinantes.
 * Resolver é chamado a CADA operação (inclusive download), sem cache de elegibilidade.
 */
export function configureBlacklistEntitlementResolver(resolver?: BlacklistEntitlementResolver): void {
  trustedResolver = resolver ?? auditedGrantResolver;
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
  if (!trustedResolver) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Blacklist indisponível: ainda não há fonte validada de assinatura atual." });
  }
  let evidence: BlacklistSubscriptionEvidence | null;
  try {
    evidence = await trustedResolver(user.id);
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível confirmar sua assinatura. Tente novamente mais tarde." });
  }
  // Vitalício só quando explicitamente concedido/auditado; início sempre válido.
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
  const starts = typeof evidence?.validFrom === "string" && isoTimestamp.test(evidence.validFrom) ? Date.parse(evidence.validFrom) : NaN;
  const expires = evidence && typeof evidence.validUntil === "string"
    && isoTimestamp.test(evidence.validUntil)
    ? Date.parse(evidence.validUntil) : NaN;
  if (!evidence || evidence.userId !== user.id || evidence.status !== "active"
    || typeof evidence.source !== "string" || !evidence.source.trim()
    || !Number.isFinite(starts) || starts > Date.now()
    || (evidence.lifetime === true ? evidence.validUntil !== "" : !Number.isFinite(expires) || expires <= Date.now())) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A Blacklist exige assinatura atual comprovada. Consulte o responsável pelo seu plano." });
  }
}
