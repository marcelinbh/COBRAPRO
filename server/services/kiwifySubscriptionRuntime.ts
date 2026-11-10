import {
  createKiwifySalesClient, readKiwifyConfiguration, isKiwifyId,
  normalizeKiwifyEmail, KiwifySalesError,
  type KiwifyConfiguration,
} from "./kiwifySalesClient";
import {
  createKiwifySubscriptions, consumeKiwifyEvent0027,
  parseKiwifySubscriptionUtc, KiwifySubscriptionError,
  type KiwifyLedgerEvidence, type KiwifyRpcClient, type KiwifyServerUser,
  type KiwifyUserDirectory, type KiwifyProcessResult,
} from "./kiwifySubscriptions";
import type { BlacklistSubscriptionEvidence } from "./blacklistEntitlement";
import { createKiwifyBuyerProvisioning } from "./kiwifyBuyerProvisioning";
import type { EmailParams, EmailDeliveryResult } from "../_core/email";

/** Server-only structural subset: no Kiwify table access or write capability. */
export type KiwifyRuntimeSupabase = KiwifyRpcClient & {
  from: (table: "users") => {
    select: (columns: "id,email") => {
      eq: (column: "id", value: number) => {
        limit: (count: 1) => {
          maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
};
export type KiwifySubscriptionRuntimeOptions = {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  getSupabaseClient?: () => Promise<KiwifyRuntimeSupabase | null>;
  sendEmail?: (params: EmailParams) => Promise<EmailDeliveryResult>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function userIdValid(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= 2_147_483_647;
}
function shortId(value: unknown): value is string {
  return isKiwifyId(value) && value.length <= 128;
}
function ledgerUtc(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)
    ? parseKiwifySubscriptionUtc(value) : null;
}
function userRow(value: unknown): KiwifyServerUser {
  if (!record(value) || !userIdValid(value.id) || !normalizeKiwifyEmail(value.email)) {
    throw new KiwifySubscriptionError("ledger_invalid");
  }
  return { id: value.id, email: normalizeKiwifyEmail(value.email) };
}

/** One lazy sales client per runtime/process, OAuth cache only. Supabase is
 * obtained afresh per adapter operation. Importing this module does no I/O.
 * HMAC is the CALLER'S prerequisite: pass the exact same verified raw bytes.
 */
export function createKiwifySubscriptionRuntime(options: KiwifySubscriptionRuntimeOptions = {}) {
  const env = options.env ?? process.env;
  let service: ReturnType<typeof createKiwifySubscriptions> | null = null;
  let configuration: KiwifyConfiguration | null = null;
  const getSupabase: () => Promise<KiwifyRuntimeSupabase | null> = options.getSupabaseClient ?? (async () => {
    const { getSupabaseClientAsync } = await import("../db");
    return await getSupabaseClientAsync() as unknown as KiwifyRuntimeSupabase | null;
  });

  function requireEnabled(): void {
    if (env.ENABLE_KIWIFY_SUBSCRIPTIONS !== "true") throw new KiwifySubscriptionError("unavailable");
  }
  function requireConfiguration(): KiwifyConfiguration {
    requireEnabled();
    const current = readKiwifyConfiguration(env);
    // Never silently keep using stale credentials/allowlist or create a second
    // account client. Configuration changes require explicit process restart.
    if (configuration && JSON.stringify(current) !== JSON.stringify(configuration)) {
      throw new KiwifySalesError("configuration");
    }
    return current;
  }
  async function client(): Promise<KiwifyRuntimeSupabase> {
    requireConfiguration();
    let sb: KiwifyRuntimeSupabase | null;
    try { sb = await getSupabase(); }
    catch { throw new KiwifySubscriptionError("ledger_unavailable"); }
    if (!sb || typeof sb.rpc !== "function") throw new KiwifySubscriptionError("ledger_unavailable");
    return sb;
  }
  async function rpc(name: string, params: Record<string, unknown>): Promise<unknown> {
    const sb = await client();
    let response: unknown;
    try { response = await sb.rpc(name, params); }
    catch { throw new KiwifySubscriptionError("ledger_unavailable"); }
    if (!record(response) || response.error !== null || response.data === undefined) {
      throw new KiwifySubscriptionError("ledger_unavailable");
    }
    return response.data;
  }
  const users: KiwifyUserDirectory = {
    async getUserById(userId) {
      if (!userIdValid(userId)) return null;
      const sb = await client();
      let response: unknown;
      try { response = await sb.from("users").select("id,email").eq("id", userId).limit(1).maybeSingle(); }
      catch { throw new KiwifySubscriptionError("ledger_unavailable"); }
      if (!record(response) || response.error !== null || response.data === undefined) {
        throw new KiwifySubscriptionError("ledger_unavailable");
      }
      if (response.data === null) return null;
      const user = userRow(response.data);
      if (user.id !== userId) throw new KiwifySubscriptionError("identity");
      return user;
    },
    async findUsersByNormalizedEmail(email) {
      if (normalizeKiwifyEmail(email) !== email) throw new KiwifySubscriptionError("identity");
      // SECURITY DEFINER RPC performs LOWER(BTRIM(email)) equality, LIMIT 2.
      const data = await rpc("rpc_kiwify_blacklist_find_users", { p_email: email });
      if (!Array.isArray(data) || data.length > 2) throw new KiwifySubscriptionError("ledger_invalid");
      const matches = data.map(userRow);
      if (matches.some(user => user.email !== email)) throw new KiwifySubscriptionError("identity");
      return matches;
    },
  };

  async function readEvidenceForUser(userId: number): Promise<KiwifyLedgerEvidence | null> {
    const data = await rpc("rpc_kiwify_blacklist_access", { p_user_id: userId });
    if (!record(data) || typeof data.eligible !== "boolean") throw new KiwifySubscriptionError("ledger_invalid");
    // SQL returns nullable identity fields for deny. Never bootstrap from users
    // or historical paid sales and never turn missing booleans into false.
    if (data.eligible === false) return null;
    const from = ledgerUtc(data.start_date);
    const until = ledgerUtc(data.access_until);
    if (data.user_id !== userId || !userIdValid(data.user_id)
      || !shortId(data.subscription_id) || !shortId(data.product_id) || !shortId(data.last_paid_order_id)
      || typeof data.status !== "string" || !["active", "canceled", "waiting_payment", "ended"].includes(data.status)
      || !from || !until || typeof data.has_access !== "boolean" || typeof data.active_period !== "boolean"
      || typeof data.financial_revoked !== "boolean" || typeof data.review_required !== "boolean") {
      throw new KiwifySubscriptionError("ledger_invalid");
    }
    const user = await users.getUserById(userId);
    if (!user || !user.email) return null;
    return Object.freeze({
      userId: data.user_id, subscriptionId: data.subscription_id, productId: data.product_id,
      customerEmail: user.email, lastPaidOrderId: data.last_paid_order_id,
      status: data.status as KiwifyLedgerEvidence["status"], validFrom: from, validUntil: until,
      hasAccess: data.has_access, activePeriod: data.active_period,
      refunded: data.financial_revoked, chargedback: data.financial_revoked,
      reviewRequired: data.review_required,
      // Derived ONLY from privileged consumed-ledger RPC provenance, not HTTP.
      trustedWebhook: true,
    });
  }

  function getService() {
    const current = requireConfiguration();
    if (!service) {
      const sales = createKiwifySalesClient({ configuration: current, fetch: options.fetch, now: options.now });
      configuration = current;
      service = createKiwifySubscriptions({ sales, users, now: options.now,
        buyers: createKiwifyBuyerProvisioning({ client, sendEmail: options.sendEmail }), ledger: {
        readEvidenceForUser,
        async consume(projection) {
          let verified = projection;
          if (projection.action === "revoke" && !projection.subscriptionId) {
            // Root order_status alone cannot be represented by this SQL DTO.
            // Do NOT fabricate event_type, sale status or subscription identity.
            if (projection.eventType !== "order_refunded" && projection.eventType !== "chargeback"
              && !["refunded", "chargedback"].includes(projection.saleStatus)) {
              throw new KiwifySubscriptionError("invalid_payload");
            }
            const binding = await rpc("rpc_kiwify_blacklist_order_binding", { p_order_id: projection.orderId });
            if (binding === null) throw new KiwifySubscriptionError("identity");
            if (!record(binding) || !shortId(binding.subscription_id) || !userIdValid(binding.user_id)
              || !shortId(binding.product_id)) throw new KiwifySubscriptionError("ledger_invalid");
            // The projection's identity is exclusively the just-fetched GET sale
            // and unique email RPC. A ledger binding must match BOTH exactly.
            if (binding.user_id !== projection.userId || binding.product_id !== projection.productId) {
              throw new KiwifySubscriptionError("identity");
            }
            const user = await users.getUserById(binding.user_id);
            const matches = await users.findUsersByNormalizedEmail(projection.customerEmail);
            if (!user || user.email !== projection.customerEmail || matches.length !== 1
              || matches[0].id !== binding.user_id) throw new KiwifySubscriptionError("identity");
            verified = Object.freeze({ ...projection, subscriptionId: binding.subscription_id });
          }
          return consumeKiwifyEvent0027(await client(), verified);
        },
      } });
    }
    return service;
  }

  return {
    async processVerifiedKiwifySubscription(rawBody: Buffer): Promise<KiwifyProcessResult> {
      const result = await getService().processAuthenticatedWebhook(rawBody);
      requireConfiguration();
      return result;
    },
    async resolveVerifiedKiwifyBlacklistEvidence(userId: number): Promise<BlacklistSubscriptionEvidence | null> {
      const ready = getService();
      const result = await ready.resolveKiwifyBlacklistEvidence(userId);
      requireConfiguration();
      return result;
    },
  };
}

// Factory itself is lazy; there is no Supabase connection or OAuth call here.
const runtime = createKiwifySubscriptionRuntime();
export async function processVerifiedKiwifySubscription(rawBody: Buffer): Promise<KiwifyProcessResult> {
  return runtime.processVerifiedKiwifySubscription(rawBody);
}
export async function resolveVerifiedKiwifyBlacklistEvidence(userId: number): Promise<BlacklistSubscriptionEvidence | null> {
  return runtime.resolveVerifiedKiwifyBlacklistEvidence(userId);
}
