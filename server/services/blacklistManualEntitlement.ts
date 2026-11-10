import type { BlacklistSubscriptionEvidence } from "./blacklistEntitlement";
import { parseKiwifySubscriptionUtc } from "./kiwifySubscriptions";

/** Evidência explícita do proprietário em 10/11/2026. Nunca derivada de cadastro,
 * role, loginMethod, corpo HTTP ou ENV. Os IDs concedidos são uma fotografia das
 * contas existentes: novos cadastros não são incluídos automaticamente.
 */
export const MANUAL_LIFETIME_AUTHORIZATION = "owner-confirmed:manual-lifetime:2026-11-10";
export const MANUAL_LIFETIME_SOURCE = "blacklist:audited-owner-manual-lifetime";
const COLUMNS = "user_id,status,starts_at,ends_at,lifetime,granted_by,evidence";

type ManualClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: number): {
        limit(count: number): {
          maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
};

type Options = { getClient?: () => Promise<ManualClient | null> };
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const positiveId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;

export async function resolveManualLifetimeBlacklistEvidence(
  userId: number,
  options: Options = {},
): Promise<BlacklistSubscriptionEvidence | null> {
  if (!positiveId(userId)) throw new Error("Manual entitlement identity invalid");
  const getClient = options.getClient ?? (async () => {
    const { getSupabaseClientAsync } = await import("../db");
    return await getSupabaseClientAsync() as unknown as ManualClient | null;
  });
  const client = await getClient();
  if (!client) throw new Error("Manual entitlement unavailable");
  // Seleção mínima e filtrada no ID da sessão; sem cache e sem escrita.
  const response = await client.from("blacklist_access_grants").select(COLUMNS)
    .eq("user_id", userId).limit(1).maybeSingle();
  if (!record(response) || response.error !== null || response.data === undefined) {
    throw new Error("Manual entitlement unavailable");
  }
  if (response.data === null) return null;
  const row = response.data;
  if (!record(row) || row.user_id !== userId || !positiveId(row.user_id)
    || !positiveId(row.granted_by) || !["ativo", "suspenso", "revogado"].includes(String(row.status))
    || typeof row.evidence !== "string") throw new Error("Manual entitlement invalid");
  // Concessões de outra procedência não se tornam vitalícias por semelhança.
  if (row.evidence !== MANUAL_LIFETIME_AUTHORIZATION) return null;
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/;
  const start = typeof row.starts_at === "string" && iso.test(row.starts_at)
    ? parseKiwifySubscriptionUtc(row.starts_at) : null;
  if (!start || row.lifetime !== true || row.ends_at !== null) {
    throw new Error("Manual lifetime contract invalid");
  }
  return Object.freeze({
    userId, status: row.status === "ativo" ? "active" : "inactive",
    validFrom: start, validUntil: null, lifetime: true,
    source: MANUAL_LIFETIME_SOURCE,
  });
}
