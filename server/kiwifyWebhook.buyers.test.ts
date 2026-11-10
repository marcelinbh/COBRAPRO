import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import { registerKiwifyWebhookRoutes } from "./kiwifyWebhook";
import { createKiwifySubscriptionRuntime, type KiwifyRuntimeSupabase } from "./services/kiwifySubscriptionRuntime";
import type { EmailDeliveryResult } from "./_core/email";
const processMock = vi.hoisted(() => vi.fn());
vi.mock("./services/kiwifySubscriptionRuntime", async original => ({
  ...await original<typeof import("./services/kiwifySubscriptionRuntime")>(),
  processVerifiedKiwifySubscription: processMock,
}));
const TOKEN = "synthetic-hmac-no-real-secret";
const NOW = Date.parse("2026-11-10T12:00:00Z");
const ENV = { ENABLE_KIWIFY_SUBSCRIPTIONS: "true", KIWIFY_CLIENT_ID: "fixture-client", KIWIFY_CLIENT_SECRET: "fixture-secret", KIWIFY_ACCOUNT_ID: "fixture-account", KIWIFY_COBRAPRO_PRODUCT_IDS: '["fixture-product"]' };
const positive = () => ({ order_id: "fixture-order", subscription_id: "fixture-sub", webhook_event_type: "order_approved", order_status: "paid", updated_at: "2026-11-10 08:59",
  Customer: { email: "forged@webhook.invalid", name: "FORGED NAME" },
  Subscription: { id: "fixture-sub", status: "active", start_date: "2026-10-10 12:00:00", customer_access: { has_access: true, active_period: true, access_until: "2026-11-11 12:00:00" } } });
function harness(options: { manual?: boolean; duplicateEmail?: boolean; apiStatus?: string; api404?: boolean; disallowed?: boolean; emailResult?: EmailDeliveryResult } = {}) {
  let state = options.manual ? "not_needed" : "pending";
  let tokenHash: unknown;
  const sendEmail = vi.fn(async (_params: any): Promise<EmailDeliveryResult> => options.emailResult ?? { accepted: true, kind: "accepted", deliveryKnown: true, retryEligible: false });
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> => {
    if (name === "rpc_kiwify_buyer_provision") {
      if (options.duplicateEmail) return { data: null, error: { code: "23505", message: "PII suppressed" } };
      return { data: { user_id: 77, email: "verified@sales.invalid", created: !options.manual, applied: true, invite_state: state }, error: null };
    }
    if (name === "rpc_kiwify_buyer_invite_claim") {
      const claimed = ["pending", "retryable"].includes(state);
      if (claimed) { state = "sending"; tokenHash = (params.p_claim as any).token_hash; }
      return { data: { claimed, user_id: 77, invite_state: state }, error: null };
    }
    if (name === "rpc_kiwify_buyer_invite_finish") {
      expect((params.p_result as any).token_hash).toBe(tokenHash);
      state = (params.p_result as any).state;
      return { data: { finished: true, invite_state: state }, error: null };
    }
    if (name === "rpc_kiwify_blacklist_find_users") return { data: [], error: null };
    throw new Error("Unexpected RPC");
  });
  const from = vi.fn(() => { throw new Error("Cross-tenant table read/write forbidden during provisioning"); });
  const sb: KiwifyRuntimeSupabase = { rpc, from };
  const fetchMock = vi.fn(async (url: string | URL | Request) => String(url).endsWith("/oauth/token")
    ? new Response(JSON.stringify({ access_token: "fixture-oauth", token_type: "Bearer", expires_in: 3600, scope: "sales" }))
    : new Response(JSON.stringify(options.api404 ? { error: "not found" } : { id: "fixture-order", product: { id: options.disallowed ? "alien-product" : "fixture-product" }, customer: { email: " VERIFIED@SALES.INVALID " }, status: options.apiStatus ?? "paid" }), { status: options.api404 ? 404 : 200 }));
  const runtime = createKiwifySubscriptionRuntime({ env: { ...ENV }, getSupabaseClient: async () => sb, fetch: fetchMock as typeof fetch, now: () => NOW, sendEmail });
  processMock.mockImplementation(runtime.processVerifiedKiwifySubscription);
  const app = { post: vi.fn(), get: vi.fn() }; registerKiwifyWebhookRoutes(app as unknown as Express);
  const handler = app.post.mock.calls[0][1];
  const run = async (patch: Record<string, unknown> = {}, invalidSignature = false) => {
    const rawBody = Buffer.from(JSON.stringify({ ...positive(), ...patch }, null, 2));
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const req = { rawBody, query: { signature: invalidSignature ? "0".repeat(40) : createHmac("sha1", TOKEN).update(rawBody).digest("hex") } };
    Object.defineProperty(req, "body", { get: () => { throw new Error("Untrusted req.body never read"); } });
    await handler(req, res); return { res, rawBody };
  };
  return { run, rpc, from, fetchMock, sendEmail, state: () => state };
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("KIWIFY_WEBHOOK_TOKEN", TOKEN); vi.stubEnv("ENABLE_KIWIFY_SUBSCRIPTIONS", "true"); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Real network prohibited"); })); vi.spyOn(console, "error").mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("new buyer authenticated route end-to-end with fake transports only", () => {
  it("HMAC -> GET paid -> full period -> one buyer RPC -> token hash claim -> exact email adapter", async () => {
    const s = harness(); s.sendEmail.mockImplementation(async () => { expect(s.state()).toBe("sending"); return { accepted: true, kind: "accepted", deliveryKnown: true, retryEligible: false }; });
    const { res, rawBody } = await s.run(); expect(res.status).toHaveBeenCalledWith(200); expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(s.from).not.toHaveBeenCalled();
    expect(s.rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kiwify_buyer_provision", "rpc_kiwify_buyer_invite_claim", "rpc_kiwify_buyer_invite_finish"]);
    expect(s.rpc.mock.calls[0][1]).toMatchObject({ p_buyer: { email: "verified@sales.invalid", event: { event_fingerprint: createHash("sha256").update(rawBody).digest("hex") } } });
    expect(s.sendEmail.mock.calls[0][0]).toMatchObject({ to: "verified@sales.invalid", toName: "Cliente CobraPro" });
    expect(JSON.stringify(s.rpc.mock.calls)).not.toContain("FORGED"); expect(JSON.stringify(s.sendEmail.mock.calls)).not.toContain("forged@webhook");
  });
  it("existing manual account has no reset token, email or direct users write", async () => {
    const s = harness({ manual: true }); const { res } = await s.run(); expect(res.status).toHaveBeenCalledWith(200);
    expect(s.rpc).toHaveBeenCalledTimes(1); expect(s.sendEmail).not.toHaveBeenCalled(); expect(s.from).not.toHaveBeenCalled();
  });
  it.each([
    [{ accepted: false, kind: "delivery_unknown", deliveryKnown: false, retryEligible: false }, 200, { received: true, needsReview: true }],
    [{ accepted: false, kind: "configuration", deliveryKnown: true, retryEligible: false }, 200, { received: true, needsReview: true }],
    [{ accepted: false, kind: "throttled", deliveryKnown: true, retryEligible: true }, 503, { error: "Convite pendente de aceite", retry: true }],
  ] as const)("provider %j maps to HTTP %s without promising delivery", async (emailResult, code, body) => {
    const s = harness({ emailResult }); const { res } = await s.run(); expect(res.status).toHaveBeenCalledWith(code); expect(res.json).toHaveBeenCalledWith(body);
    if (emailResult.kind !== "throttled") { await s.run(); expect(s.sendEmail).toHaveBeenCalledTimes(1); }
  });
  it("invalid HMAC cannot perform GET or touch DB", async () => {
    const s = harness(); const { res } = await s.run({}, true); expect(res.status).toHaveBeenCalledWith(401); expect(s.fetchMock).not.toHaveBeenCalled(); expect(s.rpc).not.toHaveBeenCalled();
  });
  it.each([{ api404: true }, { apiStatus: "refused" }, { apiStatus: "waiting_payment" }, { apiStatus: "refunded" }, { apiStatus: "chargedback" }, { disallowed: true }])("upstream %j never reaches buyer creation", async options => {
    const s = harness(options); await s.run(); expect(s.rpc.mock.calls.some(([name]) => name === "rpc_kiwify_buyer_provision")).toBe(false); expect(s.sendEmail).not.toHaveBeenCalled(); expect(s.from).not.toHaveBeenCalled();
  });
  it.each([{ Subscription: undefined }, { updated_at: "2099-01-01 00:00" }, { Subscription: { id: "fixture-sub", status: "active", start_date: "2026-10-10 12:00:00", customer_access: { has_access: true, active_period: true, access_until: "2099-01-01 00:00:00" } } }])("invalid positive %j creates no account/grant/claim", async patch => {
    const s = harness(); const { res } = await s.run(patch); expect(res.status).toHaveBeenCalledWith(503); expect(s.rpc).not.toHaveBeenCalled(); expect(s.sendEmail).not.toHaveBeenCalled();
  });
  it("ambiguous legacy email refuses transaction and no email claim", async () => {
    const s = harness({ duplicateEmail: true }); const { res } = await s.run(); expect(res.status).toHaveBeenCalledWith(503); expect(s.rpc).toHaveBeenCalledTimes(1); expect(s.sendEmail).not.toHaveBeenCalled();
  });
});
