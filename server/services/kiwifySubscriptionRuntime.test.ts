import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assinaturaKiwifyEhValida } from "../kiwifyWebhook";
import {
  createKiwifySubscriptionRuntime, processVerifiedKiwifySubscription,
  resolveVerifiedKiwifyBlacklistEvidence, type KiwifyRuntimeSupabase,
} from "./kiwifySubscriptionRuntime";

const defaultDb = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ getSupabaseClientAsync: defaultDb }));
const NOW = Date.parse("2026-11-10T12:00:00Z");
const USER = { id: 7, email: "user@test.example" };
const ENV = {
  ENABLE_KIWIFY_SUBSCRIPTIONS: "true", KIWIFY_CLIENT_ID: "mock-client", KIWIFY_CLIENT_SECRET: "mock-secret",
  KIWIFY_ACCOUNT_ID: "mock-account", KIWIFY_COBRAPRO_PRODUCT_IDS: '["mock-product","other-allowed"]',
};
const accessRow = (patch: Record<string, unknown> = {}) => ({
  eligible: true, user_id: 7, subscription_id: "mock-subscription", product_id: "mock-product",
  last_paid_order_id: "mock-order", status: "active", start_date: "2026-10-10T12:00:00.000000Z",
  access_until: "2026-11-11T12:00:00.000000Z", has_access: true, active_period: true,
  financial_revoked: false, review_required: false, ...patch,
});
const payload = (patch: Record<string, unknown> = {}) => ({
  order_id: "mock-order", subscription_id: "mock-subscription", webhook_event_type: "order_approved", order_status: "paid",
  updated_at: "2026-11-10 08:59", Subscription: { id: "mock-subscription", status: "active", start_date: "2026-10-10 12:00:00",
    customer_access: { has_access: true, active_period: true, access_until: "2026-11-11 12:00:00" } }, ...patch,
});
const raw = (patch: Record<string, unknown> = {}) => Buffer.from(JSON.stringify(payload(patch)));
const financialRaw = (patch: Record<string, unknown> = {}) => raw({
  webhook_event_type: "order_refunded", order_status: "refunded", subscription_id: undefined,
  Subscription: undefined, updated_at: undefined, ...patch,
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const evidence = {
  userId: 7, status: "active", validFrom: "2026-10-10T12:00:00.000Z", validUntil: "2026-11-11T12:00:00.000Z",
  source: "kiwify:authenticated-webhook+verified-sale", lifetime: false,
};
function setup() {
  let current = NOW;
  let access: unknown = accessRow();
  let binding: unknown = { subscription_id: "mock-subscription", user_id: 7, product_id: "mock-product" };
  let matches: unknown = [{ ...USER }];
  let user: unknown = { ...USER };
  let saleStatus = "paid";
  const env: Record<string, string | undefined> = { ...ENV };
  const maybeSingle = vi.fn(async () => ({ data: user, error: null as unknown }));
  const limit = vi.fn((_count: 1) => ({ maybeSingle }));
  const eq = vi.fn((_column: "id", _value: number) => ({ limit }));
  const select = vi.fn((_columns: "id,email") => ({ eq }));
  const from = vi.fn((_table: "users") => ({ select }));
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> => {
    if (name === "rpc_kiwify_blacklist_access") return { data: access, error: null };
    if (name === "rpc_kiwify_blacklist_find_users") return { data: matches, error: null };
    if (name === "rpc_kiwify_blacklist_order_binding") return { data: binding, error: null };
    if (name === "rpc_kiwify_blacklist_consume") {
      const event = params.p_event as Record<string, unknown>;
      const financial = ["order_refunded", "chargeback"].includes(String(event.event_type))
        || ["refunded", "chargedback"].includes(String(event.verified_sale_status));
      return { data: { accepted: true, duplicate: false, outcome: financial ? "financial_revoked" : "paid_period",
        subscription_id: event.subscription_id, eligible: !financial, access_until: financial ? null : "2026-11-11T12:00:00Z",
        financial_revoked: financial, review_required: false }, error: null };
    }
    throw new Error("Unexpected RPC");
  });
  const sb: KiwifyRuntimeSupabase = { rpc, from };
  const getSupabaseClient = vi.fn(async (): Promise<KiwifyRuntimeSupabase | null> => sb);
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    if (String(url).endsWith("/oauth/token")) return json({ access_token: "mock-token", token_type: "Bearer", scope: "sales", expires_in: 3600 });
    if (String(url) === "https://public-api.kiwify.com/v1/sales/mock-order") {
      return json({ id: "mock-order", product: { id: "mock-product" }, customer: { email: USER.email }, status: saleStatus });
    }
    return json({ message: "Fictitious order" }, 404);
  });
  const runtime = createKiwifySubscriptionRuntime({ env, fetch: fetchMock as typeof fetch, getSupabaseClient, now: () => current });
  return { runtime, env, fetchMock, getSupabaseClient, rpc, from, select, eq, limit, maybeSingle, sb,
    setAccess: (v: unknown) => { access = v; }, setBinding: (v: unknown) => { binding = v; },
    setMatches: (v: unknown) => { matches = v; }, setUser: (v: unknown) => { user = v; },
    setStatus: (v: string) => { saleStatus = v; }, setNow: (v: number) => { current = v; },
    writes: () => rpc.mock.calls.filter(([name]) => name === "rpc_kiwify_blacklist_consume"),
    reads: () => rpc.mock.calls.filter(([name]) => name === "rpc_kiwify_blacklist_access"),
    bindings: () => rpc.mock.calls.filter(([name]) => name === "rpc_kiwify_blacklist_order_binding"),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Real network forbidden by test"); }));
  vi.stubEnv("ENABLE_KIWIFY_SUBSCRIPTIONS", "false");
  defaultDb.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("lazy server runtime and exact configuration (no real network)", () => {
  it("factory performs no DB/OAuth call; reuses one OAuth token across operations, never a sale", async () => {
    const s = setup();
    expect(s.getSupabaseClient).not.toHaveBeenCalled(); expect(s.fetchMock).not.toHaveBeenCalled();
    await expect(s.runtime.processVerifiedKiwifySubscription(raw())).resolves.toEqual({ outcome: "consumed", action: "paid_period", applied: true });
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toEqual(evidence);
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toEqual(evidence);
    expect(s.fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/oauth/token"))).toHaveLength(1);
    expect(s.fetchMock.mock.calls.filter(([url]) => String(url).includes("/sales/"))).toHaveLength(3);
    expect(s.reads()).toHaveLength(4);
    expect(s.getSupabaseClient).toHaveBeenCalledTimes(s.rpc.mock.calls.length + s.maybeSingle.mock.calls.length);
    expect(s.from.mock.calls.every(([table]) => table === "users")).toBe(true);
    expect(s.select.mock.calls.every(([columns]) => columns === "id,email")).toBe(true);
    expect(s.eq).toHaveBeenCalledWith("id", 7); expect(s.limit).toHaveBeenCalledWith(1);
    expect(s.bindings()).toHaveLength(0);
  });

  it.each([undefined, "false", "TRUE", "1", " true", "true "])("flag %s cannot enable runtime", async value => {
    const s = setup(); s.env.ENABLE_KIWIFY_SUBSCRIPTIONS = value;
    await expect(s.runtime.processVerifiedKiwifySubscription(raw())).rejects.toMatchObject({ code: "unavailable" });
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "unavailable" });
    expect(s.fetchMock).not.toHaveBeenCalled(); expect(s.getSupabaseClient).not.toHaveBeenCalled();
  });

  it.each(["KIWIFY_CLIENT_ID", "KIWIFY_CLIENT_SECRET", "KIWIFY_ACCOUNT_ID", "KIWIFY_COBRAPRO_PRODUCT_IDS"])("missing %s fails even with an existing account/ledger", async key => {
    const s = setup(); delete s.env[key];
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "configuration" });
    await expect(s.runtime.processVerifiedKiwifySubscription(raw())).rejects.toMatchObject({ code: "configuration" });
    expect(s.fetchMock).not.toHaveBeenCalled(); expect(s.getSupabaseClient).not.toHaveBeenCalled();
  });

  it("turning flag off after successful access immediately denies without cached fallback", async () => {
    const s = setup(); await s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7);
    const calls = s.fetchMock.mock.calls.length; s.env.ENABLE_KIWIFY_SUBSCRIPTIONS = "false";
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "unavailable" });
    expect(s.fetchMock).toHaveBeenCalledTimes(calls);
  });

  it("removed or changed config after initialization denies instead of stale OAuth/allowlist", async () => {
    const s = setup(); await s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7);
    s.env.KIWIFY_COBRAPRO_PRODUCT_IDS = '["different-product"]';
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "configuration" });
    s.env.KIWIFY_COBRAPRO_PRODUCT_IDS = ENV.KIWIFY_COBRAPRO_PRODUCT_IDS; delete s.env.KIWIFY_CLIENT_SECRET;
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "configuration" });
  });

  it("exports wire the same lazy runtime to getSupabaseClientAsync per adapter call", async () => {
    const s = setup(); for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
    defaultDb.mockResolvedValue(s.sb); vi.stubGlobal("fetch", s.fetchMock); vi.spyOn(Date, "now").mockReturnValue(NOW);
    try {
      await expect(processVerifiedKiwifySubscription(raw())).resolves.toMatchObject({ action: "paid_period" });
      await expect(resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toEqual(evidence);
      expect(defaultDb).toHaveBeenCalledTimes(s.rpc.mock.calls.length + s.maybeSingle.mock.calls.length);
      expect(s.fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/oauth/token"))).toHaveLength(1);
    } finally { vi.restoreAllMocks(); }
  });

  it("default export requires the exact flag before Supabase discovery", async () => {
    await expect(resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "unavailable" });
    await expect(processVerifiedKiwifySubscription(raw())).rejects.toMatchObject({ code: "unavailable" });
    expect(defaultDb).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("privileged RPC evidence schema is mandatory", () => {
  it("maps every snake_case evidence field, allows canceled paid period, and calls the exact email RPC", async () => {
    const s = setup(); s.setAccess(accessRow({ status: "canceled" })); s.setUser({ id: 7, email: " USER@Test.Example " });
    s.setMatches([{ id: 7, email: " USER@Test.Example " }]);
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toEqual(evidence);
    expect(s.rpc).toHaveBeenCalledWith("rpc_kiwify_blacklist_access", { p_user_id: 7 });
    expect(s.rpc).toHaveBeenCalledWith("rpc_kiwify_blacklist_find_users", { p_email: USER.email });
  });

  it.each(Object.keys(accessRow()))("missing evidence field %s fails closed before GET sale", async key => {
    const s = setup(); const row: Record<string, unknown> = accessRow(); delete row[key]; s.setAccess(row);
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "ledger_invalid" });
    expect(s.fetchMock).not.toHaveBeenCalled(); expect(s.writes()).toHaveLength(0);
  });

  it("old four-field RPC cannot be supplemented by users registration", async () => {
    const s = setup(); s.setAccess({ eligible: true, subscription_id: "mock-subscription", product_id: "mock-product", access_until: "2026-11-11T12:00:00Z" });
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "ledger_invalid" });
    expect(s.from).not.toHaveBeenCalled(); expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it.each([null, [], "true", true, { eligible: "true" }])("invalid RPC body %j cannot prove eligibility", async data => {
    const s = setup(); s.setAccess(data);
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "ledger_invalid" });
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it("eligible false returns null, never requests users or paid sale bootstrap", async () => {
    const s = setup(); s.setAccess({ eligible: false });
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    expect(s.fetchMock).not.toHaveBeenCalled(); expect(s.from).not.toHaveBeenCalled(); expect(s.writes()).toHaveLength(0);
  });

  it.each([
    { has_access: "true" }, { active_period: 1 }, { financial_revoked: null }, { review_required: 0 },
    { user_id: "7" }, { user_id: 8 }, { status: "ACTIVE" }, { last_paid_order_id: "../order" },
    { subscription_id: "x".repeat(129) }, { product_id: "x".repeat(129) },
    { start_date: "2026-10-10 12:00:00" }, { access_until: "2026-02-31T12:00:00Z" },
  ])("invalid typed fields %j deny rather than defaulting flags", async patch => {
    const s = setup(); s.setAccess(accessRow(patch));
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "ledger_invalid" });
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { has_access: false }, { active_period: false }, { financial_revoked: true }, { review_required: true },
    { status: "ended" }, { status: "waiting_payment" }, { product_id: "not-allowed" },
    { access_until: "2026-11-10T12:00:00Z" }, { start_date: "2026-11-12T12:00:00Z" },
  ])("negative flags/status/expired fields %j yield no evidence", async patch => {
    const s = setup(); s.setAccess(accessRow(patch));
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it("schema missing RPC is sanitized with no Kiwify table or grant fallback", async () => {
    const s = setup(); s.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "secret pii@test.example" } });
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "ledger_unavailable", message: "Evidência Kiwify indisponível (ledger_unavailable)." });
    expect(s.from).not.toHaveBeenCalled(); expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it.each(["null", "throw"])("Supabase %s denies, with no direct DB or credential fallback", async mode => {
    const s = setup();
    if (mode === "null") s.getSupabaseClient.mockResolvedValue(null); else s.getSupabaseClient.mockRejectedValue(new Error("secret"));
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "ledger_unavailable" });
    expect(s.fetchMock).not.toHaveBeenCalled();
  });
});

describe("identity and second reads", () => {
  it.each([{ id: 8, email: USER.email }, { id: 7, email: "" }, { id: "7", email: USER.email }])("tampered users GET %j is not adopted", async user => {
    const s = setup(); s.setUser(user);
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: user.id === 8 ? "identity" : "ledger_invalid" });
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it.each([{ matches: [] }, { matches: [{ ...USER }, { id: 8, email: "USER@TEST.EXAMPLE" }] }])("email matches %j cannot identify a unique user", async ({ matches }) => {
    const s = setup(); s.setMatches(matches);
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    await expect(s.runtime.processVerifiedKiwifySubscription(raw())).resolves.toMatchObject({ reason: "user_not_unique" });
    expect(s.writes()).toHaveLength(0);
  });

  it.each([{ matches: null }, { matches: {} }, { matches: [{ id: 8, email: "other@test.example" }] },
    { matches: [{ ...USER }, { ...USER }, { ...USER }] }])("invalid find_users RPC %j fails closed", async ({ matches }) => {
    const s = setup(); s.setMatches(matches);
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: Array.isArray(matches) && matches.length === 1 ? "identity" : "ledger_invalid" });
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it("user returned for sale email cannot masquerade as the requested user", async () => {
    const s = setup(); s.setMatches([{ id: 8, email: USER.email }]);
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it.each(["refunded", "chargedback", "refused", "waiting_payment"])("current API sale %s denies despite current-looking ledger", async status => {
    const s = setup(); s.setStatus(status);
    await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toBeNull(); expect(s.writes()).toHaveLength(0);
  });

  it.each([
    { product: { id: "other-allowed" } }, { customer: { email: "other@test.example" } }, { id: "other-order" },
  ])("sale identity %j cannot be replaced by account registration", async patch => {
    const s = setup(); s.fetchMock.mockImplementation(async (url) => String(url).endsWith("/oauth/token")
      ? json({ access_token: "mock-token", token_type: "Bearer", scope: "sales", expires_in: 3600 })
      : json({ id: "mock-order", product: { id: "mock-product" }, customer: { email: USER.email }, status: "paid", ...patch }));
    if ("id" in patch) await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "invalid_response" });
    else await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toBeNull();
  });

  it.each(["revoke", "renewal", "expiry", "user", "flag"])("%s during GET is caught before evidence returns", async mutation => {
    const s = setup(); const original = s.fetchMock.getMockImplementation()!;
    s.fetchMock.mockImplementation(async url => {
      const response = await original(url);
      if (String(url).includes("/sales/")) {
        if (mutation === "revoke") s.setAccess(accessRow({ financial_revoked: true }));
        if (mutation === "renewal") s.setAccess(accessRow({ last_paid_order_id: "new-order" }));
        if (mutation === "expiry") s.setNow(Date.parse("2026-11-11T12:00:00Z"));
        if (mutation === "user") s.setUser({ id: 7, email: "other@test.example" });
        if (mutation === "flag") s.env.ENABLE_KIWIFY_SUBSCRIPTIONS = "false";
      }
      return response;
    });
    if (mutation === "flag") await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "unavailable" });
    else await expect(s.runtime.resolveVerifiedKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    if (mutation !== "flag") expect(s.reads()).toHaveLength(2);
  });
});

describe("verified financial order binding and exact raw body contract", () => {
  it.each(["order_refunded", "chargeback"])("%s without Subscription IDs uses ONLY preexisting order binding and can revoke API paid", async event => {
    const s = setup(); const body = financialRaw({ webhook_event_type: event, order_status: event === "chargeback" ? "chargedback" : "refunded" });
    await expect(s.runtime.processVerifiedKiwifySubscription(body)).resolves.toEqual({ outcome: "consumed", action: "revoke", applied: true });
    expect(s.rpc).toHaveBeenCalledWith("rpc_kiwify_blacklist_order_binding", { p_order_id: "mock-order" });
    expect(s.rpc).toHaveBeenCalledWith("rpc_kiwify_blacklist_find_users", { p_email: USER.email });
    expect(s.writes()[0][1]).toEqual({ p_event: {
      event_fingerprint: createHash("sha256").update(body).digest("hex"), order_id: "mock-order", event_type: event,
      subscription_id: "mock-subscription", user_id: 7, product_id: "mock-product", status: null, start_date: null,
      has_access: null, active_period: null, access_until: null, verified_sale_status: "paid", event_at: null,
    } });
    expect(JSON.stringify(s.writes())).not.toContain(USER.email);
    expect(s.reads()).toHaveLength(0);
  });

  it.each(["refunded", "chargedback"])("approved without IDs and API %s revokes existing binding without a fake financial event", async status => {
    const s = setup(); s.setStatus(status);
    await expect(s.runtime.processVerifiedKiwifySubscription(raw({ subscription_id: undefined, Subscription: undefined }))).resolves.toMatchObject({ action: "revoke" });
    expect(s.writes()[0][1]).toMatchObject({ p_event: { event_type: "order_approved", verified_sale_status: status, subscription_id: "mock-subscription" } });
  });

  it("financial event with a signed Subscription ID needs no order-binding bootstrap", async () => {
    const s = setup();
    await expect(s.runtime.processVerifiedKiwifySubscription(raw({ webhook_event_type: "chargeback", order_status: "chargedback", Subscription: { id: "mock-subscription", status: "malformed", customer_access: "invalid" } }))).resolves.toMatchObject({ action: "revoke" });
    expect(s.bindings()).toHaveLength(0); expect(s.writes()).toHaveLength(1);
  });

  it("missing binding denies without minting a subscription from email/product/account", async () => {
    const s = setup(); s.setBinding(null);
    await expect(s.runtime.processVerifiedKiwifySubscription(financialRaw())).rejects.toMatchObject({ code: "identity" });
    expect(s.writes()).toHaveLength(0); expect(s.reads()).toHaveLength(0);
  });

  it.each([
    { subscription_id: "mock-subscription", user_id: 8, product_id: "mock-product" },
    { subscription_id: "mock-subscription", user_id: 7, product_id: "other-allowed" },
  ])("binding identity %j must match GET sale product and unique sale user", async binding => {
    const s = setup(); s.setBinding(binding);
    await expect(s.runtime.processVerifiedKiwifySubscription(financialRaw())).rejects.toMatchObject({ code: "identity" });
    expect(s.writes()).toHaveLength(0);
  });

  it.each([{}, [], { subscription_id: "../evil", user_id: 7, product_id: "mock-product" },
    { subscription_id: "mock-subscription", user_id: "7", product_id: "mock-product" }])("malformed binding %j fails closed", async binding => {
    const s = setup(); s.setBinding(binding);
    await expect(s.runtime.processVerifiedKiwifySubscription(financialRaw())).rejects.toMatchObject({ code: "ledger_invalid" });
    expect(s.writes()).toHaveLength(0);
  });

  it("binding user email changed after sale unique lookup cannot consume", async () => {
    const s = setup(); s.setUser({ id: 7, email: "other@test.example" });
    await expect(s.runtime.processVerifiedKiwifySubscription(financialRaw())).rejects.toMatchObject({ code: "identity" });
    expect(s.writes()).toHaveLength(0);
  });

  it("missing binding RPC/schema denies without table access or bootstrap", async () => {
    const s = setup(); const original = s.rpc.getMockImplementation()!;
    s.rpc.mockImplementation(async (name, params) => name === "rpc_kiwify_blacklist_order_binding"
      ? { data: null, error: { code: "PGRST202" } } : original(name, params));
    await expect(s.runtime.processVerifiedKiwifySubscription(financialRaw())).rejects.toMatchObject({ code: "ledger_unavailable" });
    expect(s.writes()).toHaveLength(0); expect(s.from).not.toHaveBeenCalled();
  });

  it.each([true, false])("approved + root refunded + API paid with IDs=%s is a closed conflict, never a fabricated grant/revoke", async withIds => {
    const s = setup();
    await expect(s.runtime.processVerifiedKiwifySubscription(withIds ? raw({ order_status: "refunded" })
      : raw({ order_status: "refunded", subscription_id: undefined, Subscription: undefined }))).rejects.toMatchObject({ code: "invalid_payload" });
    expect(s.writes()).toHaveLength(0); expect(s.bindings()).toHaveLength(0);
  });

  it("approved without any Subscription evidence remains denied even when binding exists", async () => {
    const s = setup();
    await expect(s.runtime.processVerifiedKiwifySubscription(raw({ subscription_id: undefined, Subscription: undefined }))).resolves.toMatchObject({ reason: "no_current_paid_period" });
    expect(s.bindings()).toHaveLength(0); expect(s.writes()).toHaveLength(0);
  });

  it("signed fictitious panel order cannot reach email RPC/binding/consume", async () => {
    const s = setup(); const body = financialRaw({ order_id: "fictitious-order" });
    const signature = createHmac("sha1", "mock-webhook-token").update(body).digest("hex");
    expect(assinaturaKiwifyEhValida(body, signature, "mock-webhook-token")).toBe(true);
    await expect(s.runtime.processVerifiedKiwifySubscription(body)).rejects.toMatchObject({ code: "not_found" });
    expect(s.getSupabaseClient).not.toHaveBeenCalled(); expect(s.writes()).toHaveLength(0);
  });

  it("the caller validates HMAC before dispatch; runtime hashes the exact same whitespace bytes", async () => {
    const s = setup(); const body = Buffer.from(JSON.stringify(payload(), null, 2) + "\n");
    const token = "mock-webhook-token"; const signature = createHmac("sha1", token).update(body).digest("hex");
    expect(assinaturaKiwifyEhValida(body, signature, token)).toBe(true);
    await s.runtime.processVerifiedKiwifySubscription(body);
    expect(s.writes()[0][1]).toMatchObject({ p_event: { event_fingerprint: createHash("sha256").update(body).digest("hex") } });
    const before = s.fetchMock.mock.calls.length;
    if (assinaturaKiwifyEhValida(body, "invalid", token)) await s.runtime.processVerifiedKiwifySubscription(body);
    expect(s.fetchMock).toHaveBeenCalledTimes(before);
  });

  it("a reparsed object is not an authenticated-byte input", async () => {
    const s = setup();
    await expect(s.runtime.processVerifiedKiwifySubscription(payload() as unknown as Buffer)).rejects.toMatchObject({ code: "invalid_payload" });
    expect(s.fetchMock).not.toHaveBeenCalled();
  });

  it("consume RPC missing schema cannot report grant or successful persistence", async () => {
    const s = setup(); const original = s.rpc.getMockImplementation()!;
    s.rpc.mockImplementation(async (name, params) => name === "rpc_kiwify_blacklist_consume"
      ? { data: null, error: { code: "PGRST202", message: "secret pii" } } : original(name, params));
    await expect(s.runtime.processVerifiedKiwifySubscription(raw())).rejects.toMatchObject({ code: "ledger_unavailable" });
    expect(s.from).not.toHaveBeenCalled(); expect(s.writes()).toHaveLength(1);
  });
});
