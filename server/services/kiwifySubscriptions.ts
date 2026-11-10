import { createHash } from "node:crypto";
import {
  isKiwifyId, normalizeKiwifyEmail, KiwifySalesError,
  type KiwifySale, type KiwifySalesReader,
} from "./kiwifySalesClient";
import type { BlacklistSubscriptionEvidence } from "./blacklistEntitlement";

export const KIWIFY_WEBHOOK_EVENTS = [
  "order_approved", "order_rejected", "order_refunded", "chargeback",
  "billet_created", "pix_created", "subscription_canceled", "subscription_late",
  "subscription_renewed",
] as const;
export type KiwifyWebhookEvent = typeof KIWIFY_WEBHOOK_EVENTS[number];
type SubscriptionStatus = "active" | "waiting_payment" | "canceled" | "ended";
const FINANCIAL_REVOKE_STATUSES = new Set(["refunded", "chargedback"]);
const ORDER_STATUSES = new Set(["paid", "refused", "refunded", "chargedback", "waiting_payment"]);
const events = new Set<string>(KIWIFY_WEBHOOK_EVENTS);
const statuses = new Set<string>(["active", "waiting_payment", "canceled", "ended"]);

export class KiwifySubscriptionError extends Error {
  constructor(public readonly code: "invalid_payload" | "identity" | "ledger_unavailable" | "ledger_invalid" | "unavailable") {
    super(`Evidência Kiwify indisponível (${code}).`);
    this.name = "KiwifySubscriptionError";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function userIdValid(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= 2_147_483_647;
}

/** Subscription dates are UTC. Supports documented naive UTC with seconds/minutes,
 * or ISO UTC Z/+00:00, never local-zone interpretation or calendar rollover.
 * Naive format is accepted ONLY here, never for ledger/gate timestamps.
 */
export function parseKiwifySubscriptionUtc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T| )(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|\+00:00)?$/.exec(value);
  if (!m) return null;
  // T means ISO and must specify UTC. Space without zone is documented UTC.
  if (value[10] === "T" && !m[8]) return null;
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);
  if (year < 1970 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31
    || hour > 23 || minute > 59 || second > 59) return null;
  const ms = Number((m[7] ?? "").padEnd(3, "0").slice(0, 3));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
    || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return null;
  return date.toISOString();
}
function ledgerUtc(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)
    ? parseKiwifySubscriptionUtc(value) : null;
}

/** Documented ROOT timestamps use America/Sao_Paulo, minute precision. Root
 * fields are used only for ledger ordering, never subscription validity. */
export function parseKiwifyRootBrasilia(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return null;
  const naive = parseKiwifySubscriptionUtc(value);
  if (!naive) return null;
  const wanted = Date.parse(naive);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const localAsUtc = (stamp: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(stamp).map(p => [p.type, p.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  };
  let guess = wanted + 3 * 3_600_000;
  for (let i = 0; i < 3; i++) guess += wanted - localAsUtc(guess);
  return localAsUtc(guess) === wanted ? new Date(guess).toISOString() : null;
}

/** Local DTO, not an asserted Kiwify payload schema. Financial revoke may lack
 * Subscription/customer_access. Never extract customer/product from webhook.
 */
export type ValidatedKiwifyWebhook = Readonly<{
  orderId: string;
  subscriptionId: string | null;
  eventType: KiwifyWebhookEvent;
  orderStatus: string;
  subscriptionStatus: SubscriptionStatus | null;
  validFrom: string | null;
  validUntil: string | null;
  hasAccess: boolean | null;
  activePeriod: boolean | null;
  eventAt: string | null;
}>;

export function projectAuthenticatedKiwifyWebhook(payload: unknown): ValidatedKiwifyWebhook {
  if (!record(payload) || !isKiwifyId(payload.order_id)
    || typeof payload.webhook_event_type !== "string" || !events.has(payload.webhook_event_type)
    || typeof payload.order_status !== "string" || !ORDER_STATUSES.has(payload.order_status)) {
    throw new KiwifySubscriptionError("invalid_payload");
  }
  const subscription = record(payload.Subscription) ? payload.Subscription : null;
  const rootId = payload.subscription_id;
  const nestedId = subscription?.id;
  if ((rootId !== undefined && rootId !== null && !isKiwifyId(rootId))
    || (nestedId !== undefined && nestedId !== null && !isKiwifyId(nestedId))
    || (isKiwifyId(rootId) && isKiwifyId(nestedId) && rootId !== nestedId)) {
    throw new KiwifySubscriptionError("invalid_payload");
  }
  const access = record(subscription?.customer_access) ? subscription.customer_access : null;
  return Object.freeze({
    orderId: payload.order_id,
    subscriptionId: isKiwifyId(rootId) ? rootId : isKiwifyId(nestedId) ? nestedId : null,
    eventType: payload.webhook_event_type as KiwifyWebhookEvent,
    orderStatus: payload.order_status,
    subscriptionStatus: typeof subscription?.status === "string" && statuses.has(subscription.status)
      ? subscription.status as SubscriptionStatus : null,
    validFrom: parseKiwifySubscriptionUtc(subscription?.start_date),
    validUntil: parseKiwifySubscriptionUtc(access?.access_until),
    hasAccess: typeof access?.has_access === "boolean" ? access.has_access : null,
    activePeriod: typeof access?.active_period === "boolean" ? access.active_period : null,
    eventAt: parseKiwifyRootBrasilia(payload.updated_at ?? payload.approved_date ?? payload.created_at),
  });
}

export type KiwifyServerUser = Readonly<{ id: number; email: string | null }>;
export type KiwifyUserDirectory = {
  /** Server-only query LOWER(TRIM(email)) = normalizedEmail, LIMIT 2.
   * Must include ALL matches: duplicates are not an identity proof. Never create users.
   */
  findUsersByNormalizedEmail: (normalizedEmail: string) => Promise<readonly KiwifyServerUser[]>;
  getUserById: (userId: number) => Promise<KiwifyServerUser | null>;
};

export type KiwifyLedgerAction = "paid_period" | "cancel_existing_period" | "suspend" | "revoke";
/** Internal validated DTO for parent adapter to the exact 0027 RPC contract.
 * No guessed RPC/table names. receivedAt is SERVER receipt, NOT provider ordering.
 * validFrom is subscription start (not a fictitious latest billing start).
 */
export type KiwifyLedgerProjection = Readonly<{
  userId: number;
  orderId: string;
  subscriptionId: string | null;
  productId: string;
  customerEmail: string;
  eventType: KiwifyWebhookEvent;
  orderStatus: string;
  saleStatus: string;
  action: KiwifyLedgerAction;
  subscriptionStatus: SubscriptionStatus | null;
  validFrom: string | null;
  validUntil: string | null;
  hasAccess: boolean | null;
  activePeriod: boolean | null;
  eventAt: string | null;
  receivedAt: string;
  evidenceHash: string;
}>;

/** Normalized server ledger READ DTO; adapter must check DB/RPC errors and map
 * exact schema fields. Only evidence persisted by authenticated consume may set
 * trustedWebhook=true. Flags apply to subscription AND financial order tombstones.
 */
export type KiwifyLedgerEvidence = Readonly<{
  userId: number;
  subscriptionId: string;
  productId: string;
  customerEmail: string;
  lastPaidOrderId: string;
  status: "active" | "canceled" | "waiting_payment" | "ended";
  validFrom: string;
  validUntil: string;
  hasAccess: boolean;
  activePeriod: boolean;
  refunded: boolean;
  chargedback: boolean;
  reviewRequired: boolean;
  trustedWebhook: boolean;
}>;
export type KiwifyLedgerAdapter = {
  /** Atomically dedup/evolve the event, paid period and sticky financial tombstones.
   * Must never let replay clear revoke, canceled extend a period, late grant, or
   * stale approved move last_paid_order_id backwards. Duplicate canceled payloads
   * with changed access must remain processable; order+event alone is insufficient.
   */
  consume: (projection: KiwifyLedgerProjection) => Promise<{ applied: boolean }>;
  /** Current row, bounded and unique. Multiple eligible subscriptions are NOT
   * silently resolved by first row; parent must explicitly select verified proof.
   */
  readEvidenceForUser: (userId: number) => Promise<KiwifyLedgerEvidence | null>;
};
export type KiwifySubscriptionDependencies = {
  sales: KiwifySalesReader;
  users: KiwifyUserDirectory;
  ledger: KiwifyLedgerAdapter;
  now?: () => number;
};
export type KiwifyProcessResult =
  | { outcome: "ignored"; reason: "non_grant_event" | "no_current_paid_period" | "product_not_allowed" | "user_not_unique" }
  | { outcome: "consumed"; action: KiwifyLedgerAction; applied: boolean };

async function uniqueUser(users: KiwifyUserDirectory, email: string): Promise<KiwifyServerUser | null> {
  const matches = await users.findUsersByNormalizedEmail(email);
  if (!Array.isArray(matches) || matches.length !== 1 || !userIdValid(matches[0]?.id)
    || normalizeKiwifyEmail(matches[0]?.email) !== email) return null;
  return matches[0];
}
function validateSale(sale: KiwifySale, orderId: string): void {
  if (!sale || sale.id !== orderId || !isKiwifyId(sale.productId)
    || normalizeKiwifyEmail(sale.customerEmail) !== sale.customerEmail
    || typeof sale.status !== "string" || !/^[a-z_]{1,64}$/.test(sale.status)) {
    throw new KiwifySalesError("invalid_response");
  }
}

/** Caller MUST validate raw-body HMAC with existing handler BEFORE invoking.
 * No signature shortcut/boolean supplied by HTTP clients and no account/email
 * mutation capabilities exist in this service. Errors are redacted, no logging.
 */
export function createKiwifySubscriptions(deps: KiwifySubscriptionDependencies) {
  const now = deps.now ?? Date.now;
  return {
    async processAuthenticatedWebhook(authenticatedRawBody: Buffer): Promise<KiwifyProcessResult> {
      if (!Buffer.isBuffer(authenticatedRawBody) || !authenticatedRawBody.length || authenticatedRawBody.length > 128 * 1024) {
        throw new KiwifySubscriptionError("invalid_payload");
      }
      let payload: unknown;
      try { payload = JSON.parse(authenticatedRawBody.toString("utf8")); }
      catch { throw new KiwifySubscriptionError("invalid_payload"); }
      const event = projectAuthenticatedKiwifyWebhook(payload);
      try {
        const sale = await deps.sales.getSale(event.orderId);
        validateSale(sale, event.orderId);
        if (!deps.sales.isProductAllowed(sale.productId)) return { outcome: "ignored", reason: "product_not_allowed" };
        const user = await uniqueUser(deps.users, sale.customerEmail);
        if (!user) return { outcome: "ignored", reason: "user_not_unique" };
        const current = now();
        if (!Number.isFinite(current)) throw new KiwifySubscriptionError("unavailable");
        let action: KiwifyLedgerAction;
        // Financial negative always wins over any contradictory positive access block.
        if (event.eventType === "order_refunded" || event.eventType === "chargeback"
          || FINANCIAL_REVOKE_STATUSES.has(event.orderStatus) || FINANCIAL_REVOKE_STATUSES.has(sale.status)) {
          action = "revoke";
        } else if (!event.eventAt || Date.parse(event.eventAt) > current + 30_000) {
          return { outcome: "ignored", reason: "no_current_paid_period" };
        } else if (event.eventType === "subscription_late" || event.subscriptionStatus === "ended") {
          if (!event.subscriptionId) return { outcome: "ignored", reason: "no_current_paid_period" };
          action = "suspend";
        } else if (event.eventType === "subscription_canceled") {
          if (!event.subscriptionId) return { outcome: "ignored", reason: "no_current_paid_period" };
          action = "cancel_existing_period";
        } else if (event.eventType === "order_approved" || event.eventType === "subscription_renewed") {
          if (sale.status !== "paid" || event.orderStatus !== "paid" || !event.subscriptionId
            || !["active", "canceled"].includes(event.subscriptionStatus ?? "") || event.hasAccess !== true || event.activePeriod !== true
            || !event.validFrom || !event.validUntil || Date.parse(event.validFrom) > current
            || Date.parse(event.validUntil) <= current || Date.parse(event.validUntil) <= Date.parse(event.validFrom)
            || Date.parse(event.validUntil) <= Date.parse(event.eventAt)
            || Date.parse(event.validUntil) > Date.parse(event.eventAt) + 367 * 86_400_000) {
            return { outcome: "ignored", reason: "no_current_paid_period" };
          }
          action = "paid_period";
        } else {
          // Refused renewal alone does not erase an existing paid period.
          return { outcome: "ignored", reason: "non_grant_event" };
        }
        const base = {
          ...event, userId: user.id, productId: sale.productId,
          customerEmail: sale.customerEmail, saleStatus: sale.status, action,
        };
        // Exact authenticated bytes, NOT normalized JSON; receivedAt never orders events.
        const evidenceHash = createHash("sha256").update(authenticatedRawBody).digest("hex");
        const projection: KiwifyLedgerProjection = Object.freeze({ ...base,
          receivedAt: new Date(current).toISOString(), evidenceHash });
        const result = await deps.ledger.consume(projection);
        if (!record(result) || typeof result.applied !== "boolean") throw new KiwifySubscriptionError("ledger_invalid");
        return { outcome: "consumed", action, applied: result.applied };
      } catch (error) {
        if (error instanceof KiwifySalesError || error instanceof KiwifySubscriptionError) throw error;
        throw new KiwifySubscriptionError("unavailable");
      }
    },

    /** EACH Blacklist operation: ledger/time/flags + GET last_paid_order_id +
     * server identity+allowlist. No sale/eligibility cache, no historical bootstrap.
     * This verifies current SALE status, not synchronous subscription status.
     */
    async resolveKiwifyBlacklistEvidence(userId: number): Promise<BlacklistSubscriptionEvidence | null> {
      if (!userIdValid(userId)) return null;
      try {
        const ledger = await deps.ledger.readEvidenceForUser(userId);
        if (!ledger) return null;
        const from = ledgerUtc(ledger.validFrom);
        const until = ledgerUtc(ledger.validUntil);
        const current = now();
        if (ledger.userId !== userId || !isKiwifyId(ledger.subscriptionId)
          || !isKiwifyId(ledger.lastPaidOrderId) || !isKiwifyId(ledger.productId)
          || !deps.sales.isProductAllowed(ledger.productId) || ledger.trustedWebhook !== true
          || ledger.refunded !== false || ledger.chargedback !== false
          || ledger.reviewRequired !== false
          || ledger.hasAccess !== true || ledger.activePeriod !== true
          || !["active", "canceled"].includes(ledger.status)
          || !from || !until || !Number.isFinite(current) || Date.parse(from) > current
          || Date.parse(until) <= current || Date.parse(until) <= Date.parse(from)) return null;
        const user = await deps.users.getUserById(userId);
        const email = normalizeKiwifyEmail(user?.email);
        if (!user || user.id !== userId || !email || normalizeKiwifyEmail(ledger.customerEmail) !== email) return null;
        const unique = await uniqueUser(deps.users, email);
        if (!unique || unique.id !== userId) return null;
        const sale = await deps.sales.getSale(ledger.lastPaidOrderId);
        validateSale(sale, ledger.lastPaidOrderId);
        if (sale.status !== "paid" || sale.productId !== ledger.productId
          || sale.customerEmail !== email || !deps.sales.isProductAllowed(sale.productId)) return null;
        // Re-read ledger AND identity after network I/O to catch intervening revoke,
        // expiry, renewal and reassignment. Parent operation still needs own authz.
        const fresh = await deps.ledger.readEvidenceForUser(userId);
        const currentUser = await deps.users.getUserById(userId);
        const stillUnique = await uniqueUser(deps.users, email);
        if (!fresh || JSON.stringify(fresh) !== JSON.stringify(ledger)
          || !currentUser || currentUser.id !== userId || normalizeKiwifyEmail(currentUser.email) !== email
          || !stillUnique || stillUnique.id !== userId || Date.parse(until) <= now()) return null;
        return {
          userId, status: "active", validFrom: from, validUntil: until,
          source: "kiwify:authenticated-webhook+verified-sale", lifetime: false,
        };
      } catch (error) {
        if (error instanceof KiwifySalesError || error instanceof KiwifySubscriptionError) throw error;
        throw new KiwifySubscriptionError("unavailable");
      }
    },
  };
}

/** Composition is SERVER-only and has no automatic DB, credential or grant fallback. */
let configured: ReturnType<typeof createKiwifySubscriptions> | null = null;
export function configureKiwifySubscriptions(deps?: KiwifySubscriptionDependencies): void {
  configured = deps ? createKiwifySubscriptions(deps) : null;
}
export async function processAuthenticatedKiwifyWebhook(authenticatedRawBody: Buffer): Promise<KiwifyProcessResult> {
  if (!configured) throw new KiwifySubscriptionError("ledger_unavailable");
  return configured.processAuthenticatedWebhook(authenticatedRawBody);
}
export async function resolveKiwifyBlacklistEvidence(userId: number): Promise<BlacklistSubscriptionEvidence | null> {
  if (!configured) throw new KiwifySubscriptionError("ledger_unavailable");
  return configured.resolveKiwifyBlacklistEvidence(userId);
}

/** Exact 0027 consume JSON, no raw body/PII/action/receipt timestamp. */
export type KiwifyConsumeEvent0027 = Readonly<{
  event_fingerprint: string;
  order_id: string;
  event_type: KiwifyWebhookEvent;
  subscription_id: string;
  user_id: number;
  product_id: string;
  status: SubscriptionStatus | null;
  start_date: string | null;
  has_access: boolean | null;
  active_period: boolean | null;
  access_until: string | null;
  verified_sale_status: string;
  event_at: string | null;
}>;
export type KiwifyRpcClient = {
  rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

export function toKiwifyConsumeEvent0027(p: KiwifyLedgerProjection): KiwifyConsumeEvent0027 {
  const shortId = (value: unknown): value is string => isKiwifyId(value) && value.length <= 128;
  if (!p || !shortId(p.orderId) || !shortId(p.subscriptionId) || !shortId(p.productId)
    || !userIdValid(p.userId) || !events.has(p.eventType) || !ORDER_STATUSES.has(p.saleStatus)
    || !/^[a-f0-9]{64}$/.test(p.evidenceHash)) throw new KiwifySubscriptionError("invalid_payload");
  const financial = p.eventType === "order_refunded" || p.eventType === "chargeback"
    || FINANCIAL_REVOKE_STATUSES.has(p.saleStatus);
  // 0027 does not accept signed order_status. Never forward an approved/paid
  // DTO that the processor classified negative based ONLY on that field.
  if (p.action === "revoke" && !financial) throw new KiwifySubscriptionError("invalid_payload");
  if (!financial && (!ledgerUtc(p.eventAt)
    || (p.validFrom !== null && !ledgerUtc(p.validFrom))
    || (p.validUntil !== null && !ledgerUtc(p.validUntil)))) throw new KiwifySubscriptionError("invalid_payload");
  return Object.freeze({
    event_fingerprint: p.evidenceHash, order_id: p.orderId, event_type: p.eventType,
    subscription_id: p.subscriptionId, user_id: p.userId, product_id: p.productId,
    // Financial identity is verified independently; irrelevant/malformed positive
    // access blocks must neither block sticky revoke nor imply a paid period.
    status: financial ? null : p.subscriptionStatus, start_date: financial ? null : p.validFrom,
    // Internal conservative policy for late/ended: negative flags are DERIVED,
    // not claimed as additional upstream fields. Never let contradictory true
    // flags retain access through the RPC observation branch.
    has_access: financial ? null : p.action === "suspend" ? false : p.hasAccess,
    active_period: financial ? null : p.action === "suspend" ? false : p.activePeriod,
    access_until: financial ? null : p.validUntil,
    verified_sale_status: p.saleStatus, event_at: financial ? null : p.eventAt,
  });
}

/** Exact privileged RPC writer; runtime read composition lives separately.
 * NEVER direct table SELECT or fallback grants.
 */
export async function consumeKiwifyEvent0027(
  client: KiwifyRpcClient | null, projection: KiwifyLedgerProjection,
): Promise<{ applied: boolean }> {
  if (!client || typeof client.rpc !== "function") throw new KiwifySubscriptionError("ledger_unavailable");
  const event = toKiwifyConsumeEvent0027(projection);
  let response: { data: unknown; error: unknown };
  try { response = await client.rpc("rpc_kiwify_blacklist_consume", { p_event: event }); }
  catch { throw new KiwifySubscriptionError("ledger_unavailable"); }
  if (!record(response) || response.error !== null || !record(response.data)) {
    throw new KiwifySubscriptionError("ledger_unavailable");
  }
  const r = response.data;
  const outcomes = ["paid_period", "financial_revoked", "sticky_revocation", "stale", "same_paid_order", "observed_no_grant"];
  if (r.accepted !== true || typeof r.duplicate !== "boolean" || typeof r.eligible !== "boolean"
    || typeof r.financial_revoked !== "boolean" || typeof r.review_required !== "boolean"
    || r.subscription_id !== event.subscription_id || typeof r.outcome !== "string" || !outcomes.includes(r.outcome)
    || (r.access_until !== null && !ledgerUtc(r.access_until))
    || ((r.financial_revoked || r.review_required) && r.eligible)
    || (r.eligible && !ledgerUtc(r.access_until))
    || (projection.action === "revoke" && (!r.financial_revoked || r.eligible))) {
    throw new KiwifySubscriptionError("ledger_invalid");
  }
  // consumed/applied is persistence, NEVER permission to use Blacklist.
  return { applied: !r.duplicate || r.outcome === "financial_revoked" || r.outcome === "sticky_revocation" };
}
