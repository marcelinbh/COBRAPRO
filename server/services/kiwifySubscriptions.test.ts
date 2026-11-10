import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { assinaturaKiwifyEhValida } from "../kiwifyWebhook";
import {
  createKiwifySubscriptions, configureKiwifySubscriptions,
  processAuthenticatedKiwifyWebhook, resolveKiwifyBlacklistEvidence,
  parseKiwifySubscriptionUtc, projectAuthenticatedKiwifyWebhook,
  parseKiwifyRootBrasilia, consumeKiwifyEvent0027, toKiwifyConsumeEvent0027,
  type KiwifyLedgerEvidence, type KiwifyLedgerProjection,
} from "./kiwifySubscriptions";
import { KiwifySalesError, createKiwifySalesClient } from "./kiwifySalesClient";

const NOW = Date.parse("2026-11-10T12:00:00.000Z");
const USER = { id: 7, email: "user@test.example" };
const SALE = { id: "order-test", productId: "cobrapro-test", customerEmail: "user@test.example", status: "paid" };
const ledgerRow = (patch: Partial<KiwifyLedgerEvidence> = {}): KiwifyLedgerEvidence => ({
  userId: 7, subscriptionId: "subscription-test", productId: "cobrapro-test", customerEmail: "user@test.example",
  lastPaidOrderId: "order-test", status: "active", validFrom: "2026-10-10T12:00:00Z", validUntil: "2026-11-11T12:00:00Z",
  hasAccess: true, activePeriod: true, refunded: false, chargedback: false, reviewRequired: false, trustedWebhook: true, ...patch,
});
const payload = (patch: Record<string, unknown> = {}) => ({
  updated_at: "2026-11-10 08:59",
  order_id: "order-test", subscription_id: "subscription-test", webhook_event_type: "order_approved", order_status: "paid",
  Subscription: {
    id: "subscription-test", status: "active", start_date: "2026-10-10 12:00:00",
    customer_access: { has_access: true, active_period: true, access_until: "2026-11-11 12:00:00" },
  }, ...patch,
});
function setup(row: KiwifyLedgerEvidence | null = ledgerRow()) {
  let current = NOW;
  const sales = {
    getSale: vi.fn(async () => ({ ...SALE })), isProductAllowed: vi.fn((id: string) => id === "cobrapro-test"),
  };
  const users = {
    findUsersByNormalizedEmail: vi.fn(async () => [{ ...USER }]),
    getUserById: vi.fn(async () => ({ ...USER })),
  };
  const ledger = {
    consume: vi.fn(async (_input: KiwifyLedgerProjection) => ({ applied: true })),
    readEvidenceForUser: vi.fn(async () => row),
  };
  const rawService = createKiwifySubscriptions({ sales, users, ledger, now: () => current });
  return { sales, users, ledger, deps: { sales, users, ledger, now: () => current },
    setNow: (value: number) => { current = value; },
    service: { ...rawService,
      processAuthenticatedWebhook: (value: unknown) => rawService.processAuthenticatedWebhook(Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))),
    } };
}

describe("strict documented UTC subscription dates", () => {
  it.each([
    ["2026-11-10 12:34", "2026-11-10T12:34:00.000Z"],
    ["2026-11-10 12:34:56", "2026-11-10T12:34:56.000Z"],
    ["2026-11-10T12:34:56.123456Z", "2026-11-10T12:34:56.123Z"],
    ["2024-02-29T00:00:00+00:00", "2024-02-29T00:00:00.000Z"],
  ])("normalizes %s explicitly to UTC", (input, expected) => {
    expect(parseKiwifySubscriptionUtc(input)).toBe(expected);
  });
  it.each([
    "2026-02-29 12:00:00", "2026-02-31T12:00:00Z", "2026-13-01 00:00:00", "2026-11-10 24:00:00",
    "2026-11-10 12:60:00", "2026-11-10 12:00:60", "2026-11-10T12:00:00-03:00", "2026-11-10T12:00:00",
    "2026-11-10", "10/11/2026 12:00", "2026-11-10 12:00:00 trailing", "", null, 1794312000000,
  ])("rejects rollover/local/ambiguous date %s", input => {
    expect(parseKiwifySubscriptionUtc(input)).toBeNull();
  });
});

describe("authenticated-only webhook projection and consume", () => {
  it("projects paid period using API identity, not forged Customer/Product webhook fields", async () => {
    const s = setup();
    const result = await s.service.processAuthenticatedWebhook(payload({
      Customer: { email: "other@test.example" }, customer: { email: "other@test.example" },
      Product: { product_id: "another-product" }, product_id: "another-product",
    }));
    expect(result).toEqual({ outcome: "consumed", action: "paid_period", applied: true });
    expect(s.ledger.consume).toHaveBeenCalledOnce();
    expect(s.ledger.consume.mock.calls[0][0]).toMatchObject({
      userId: 7, customerEmail: "user@test.example", productId: "cobrapro-test", orderId: "order-test",
      subscriptionId: "subscription-test", validFrom: "2026-10-10T12:00:00.000Z",
      validUntil: "2026-11-11T12:00:00.000Z", receivedAt: "2026-11-10T12:00:00.000Z",
    });
    expect(s.ledger.consume.mock.calls[0][0].evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(s.users.findUsersByNormalizedEmail).toHaveBeenCalledWith("user@test.example");
  });

  it("subscription_renewed paid is the exact official grant event", async () => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ webhook_event_type: "subscription_renewed" })))
      .resolves.toMatchObject({ action: "paid_period" });
  });

  it.each(["compra_aprovada", "subscription_cancelled", "subscription_ended", "approved", "ORDER_APPROVED", "carrinho_abandonado"])("rejects unsupported event aliases %s", async type => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ webhook_event_type: type }))).rejects.toMatchObject({ code: "invalid_payload" });
    expect(s.sales.getSale).not.toHaveBeenCalled();
  });

  it("root-only IDs: ignores nested order aliases and cannot invent customer paths", () => {
    expect(() => projectAuthenticatedKiwifyWebhook({ order: { order_id: "order-test", webhook_event_type: "order_approved", order_status: "paid" } })).toThrow("invalid_payload");
  });

  it("rejects root and nested subscription identity mismatch", async () => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ subscription_id: "different" }))).rejects.toMatchObject({ code: "invalid_payload" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("accepts documented Subscription.id without root ID", async () => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ subscription_id: undefined }))).resolves.toMatchObject({ action: "paid_period" });
  });

  it.each(["approved", "complete", "PAID", "", undefined])("order_status %s is never treated as paid", async status => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ order_status: status }))).rejects.toMatchObject({ code: "invalid_payload" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("signed fictitious Test Webhook IDs with authentic HMAC and real client mocked 404 do not consume/create/email", async () => {
    const raw = Buffer.from(JSON.stringify(payload({ order_id: "fictitious-panel-id" })));
    const signature = createHmac("sha1", "test-webhook-token").update(raw).digest("hex");
    expect(assinaturaKiwifyEhValida(raw, signature, "test-webhook-token")).toBe(true);
    const fetchMock = vi.fn(async (url: string) => url.endsWith("/oauth/token")
      ? new Response(JSON.stringify({ access_token: "test-token", token_type: "Bearer", expires_in: 3600, scope: "sales" }))
      : new Response(JSON.stringify({ message: "Fictitious order" }), { status: 404 }));
    const sales = createKiwifySalesClient({ configuration: { clientId: "test-client", clientSecret: "test-secret", accountId: "test-account", productIds: ["cobrapro-test"] }, fetch: fetchMock as unknown as typeof fetch });
    const s = setup();
    const service = createKiwifySubscriptions({ ...s.deps, sales });
    await expect(service.processAuthenticatedWebhook(raw)).rejects.toMatchObject({ code: "not_found" });
    expect(s.users.findUsersByNormalizedEmail).not.toHaveBeenCalled();
    expect(s.ledger.consume).not.toHaveBeenCalled();
    // No createUser/email/password/caixa methods exist among service dependencies.
    expect(Object.keys(s.deps)).toEqual(["sales", "users", "ledger", "now"]);
  });

  it("signature validation remains outside: malformed HMAC stops service dispatch", async () => {
    const s = setup();
    const raw = Buffer.from(JSON.stringify(payload()));
    if (assinaturaKiwifyEhValida(raw, "invalid", "test-token")) await s.service.processAuthenticatedWebhook(JSON.parse(raw.toString()));
    expect(s.sales.getSale).not.toHaveBeenCalled();
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("unknown product is ignored even if signed and paid", async () => {
    const s = setup(); s.sales.getSale.mockResolvedValue({ ...SALE, productId: "alien" });
    await expect(s.service.processAuthenticatedWebhook(payload())).resolves.toMatchObject({ reason: "product_not_allowed" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("no server user never creates a new account or grants", async () => {
    const s = setup(); s.users.findUsersByNormalizedEmail.mockResolvedValue([]);
    await expect(s.service.processAuthenticatedWebhook(payload())).resolves.toMatchObject({ reason: "user_not_unique" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("case-insensitive unique identity matches existing account", async () => {
    const s = setup(); s.users.findUsersByNormalizedEmail.mockResolvedValue([{ id: 7, email: "USER@Test.Example" }]);
    await expect(s.service.processAuthenticatedWebhook(payload())).resolves.toMatchObject({ action: "paid_period" });
  });

  it("duplicate case-insensitive users fail closed", async () => {
    const s = setup(); s.users.findUsersByNormalizedEmail.mockResolvedValue([{ ...USER }, { id: 8, email: "USER@TEST.EXAMPLE" }]);
    await expect(s.service.processAuthenticatedWebhook(payload())).resolves.toMatchObject({ reason: "user_not_unique" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("directory swapped email cannot consume", async () => {
    const s = setup(); s.users.findUsersByNormalizedEmail.mockResolvedValue([{ id: 8, email: "other@test.example" }]);
    await expect(s.service.processAuthenticatedWebhook(payload())).resolves.toMatchObject({ reason: "user_not_unique" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it.each(["order_refunded", "chargeback"])("%s revokes despite paid sale and has_access=true", async event => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ webhook_event_type: event, order_status: event === "chargeback" ? "chargedback" : "refunded" })))
      .resolves.toMatchObject({ action: "revoke" });
    expect(s.ledger.consume.mock.calls[0][0].hasAccess).toBe(true);
  });

  it.each(["order_refunded", "chargeback"])("%s can revoke with NO Subscription or access block", async event => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ webhook_event_type: event, order_status: event === "chargeback" ? "chargedback" : "refunded", Subscription: undefined, subscription_id: undefined })))
      .resolves.toMatchObject({ action: "revoke" });
    expect(s.ledger.consume.mock.calls[0][0]).toMatchObject({ subscriptionId: null, hasAccess: null, validUntil: null });
  });

  it.each(["refunded", "chargedback"])("current sale %s overrides stale approved webhook", async status => {
    const s = setup(); s.sales.getSale.mockResolvedValue({ ...SALE, status });
    await expect(s.service.processAuthenticatedWebhook(payload())).resolves.toMatchObject({ action: "revoke" });
  });

  it("financial negative order status overrides divergent approved event", async () => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ order_status: "refunded" }))).resolves.toMatchObject({ action: "revoke" });
  });

  it.each(["refused", "waiting_payment"])("approved event with order_status %s never grants via OR", async status => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ order_status: status }))).resolves.toMatchObject({ reason: "no_current_paid_period" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it.each(["refused", "waiting_payment"])("approved event with API status %s never grants", async status => {
    const s = setup(); s.sales.getSale.mockResolvedValue({ ...SALE, status });
    await expect(s.service.processAuthenticatedWebhook(payload())).resolves.toMatchObject({ reason: "no_current_paid_period" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it.each([
    ["order_rejected", "refused"], ["billet_created", "waiting_payment"], ["pix_created", "waiting_payment"],
  ])("%s alone neither grants nor destroys prior paid period", async (event, status) => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ webhook_event_type: event, order_status: status })))
      .resolves.toMatchObject({ reason: "non_grant_event" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("subscription_late only suspends, no paid-period grant", async () => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ webhook_event_type: "subscription_late", order_status: "refused" })))
      .resolves.toMatchObject({ action: "suspend" });
  });

  it("ended despite has_access=true never grants", async () => {
    const s = setup(); const p = payload(); p.Subscription.status = "ended";
    await expect(s.service.processAuthenticatedWebhook(p)).resolves.toMatchObject({ action: "suspend" });
  });

  it("cancel only prepares retain-existing-period, never establishes or extends one", async () => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ webhook_event_type: "subscription_canceled" }))).resolves.toMatchObject({ action: "cancel_existing_period" });
  });

  it("changed legitimate cancellation payload is not deduped by order+event in processor", async () => {
    const s = setup(); const first = payload({ webhook_event_type: "subscription_canceled" });
    const second = payload({ webhook_event_type: "subscription_canceled" }); second.Subscription.customer_access.has_access = false;
    await s.service.processAuthenticatedWebhook(first); await s.service.processAuthenticatedWebhook(second);
    expect(s.ledger.consume).toHaveBeenCalledTimes(2);
    expect(s.ledger.consume.mock.calls[0][0].evidenceHash).not.toBe(s.ledger.consume.mock.calls[1][0].evidenceHash);
  });

  it("identical replays retain stable evidence hash despite server received time", async () => {
    const s = setup(); await s.service.processAuthenticatedWebhook(payload()); s.setNow(NOW + 1000);
    await s.service.processAuthenticatedWebhook(payload());
    expect(s.ledger.consume.mock.calls[0][0].evidenceHash).toBe(s.ledger.consume.mock.calls[1][0].evidenceHash);
    expect(s.ledger.consume.mock.calls[0][0].receivedAt).not.toBe(s.ledger.consume.mock.calls[1][0].receivedAt);
  });

  it.each([
    { has_access: false, active_period: true, access_until: "2026-11-11 12:00:00" },
    { has_access: true, active_period: false, access_until: "2026-11-11 12:00:00" },
    { has_access: "true", active_period: true, access_until: "2026-11-11 12:00:00" },
    { has_access: true, active_period: true, access_until: "2026-11-10 12:00:00" },
    { has_access: true, active_period: true, access_until: "2026-02-31 12:00:00" },
    { has_access: true, active_period: true },
  ])("cannot grant with invalid access block %j", async access => {
    const s = setup(); const p = payload(); p.Subscription.customer_access = access as typeof p.Subscription.customer_access;
    await expect(s.service.processAuthenticatedWebhook(p)).resolves.toMatchObject({ reason: "no_current_paid_period" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("never calculates fixed monthly expiry from next_payment/qty_charges=0", async () => {
    const s = setup(); const p = payload({ Subscription: { id: "subscription-test", status: "active", start_date: "2026-10-10 12:00:00", next_payment: "2099-01-01 00:00:00", plan: { qty_charges: 0 } } });
    await expect(s.service.processAuthenticatedWebhook(p)).resolves.toMatchObject({ reason: "no_current_paid_period" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("does not take Brasília root approved_date as subscription validity", async () => {
    const s = setup(); const p = payload({ approved_date: "2026-10-10 12:00", Subscription: { id: "subscription-test", status: "active", customer_access: { has_access: true, active_period: true, access_until: "2026-11-11 12:00:00" } } });
    await expect(s.service.processAuthenticatedWebhook(p)).resolves.toMatchObject({ reason: "no_current_paid_period" });
  });

  it("absent ledger RPC and malformed replies cannot report successful consumption", async () => {
    const s = setup(); s.ledger.consume.mockRejectedValue(new Error("RPC 0027 missing user@test.example"));
    await expect(s.service.processAuthenticatedWebhook(payload())).rejects.toMatchObject({ message: "Evidência Kiwify indisponível (unavailable)." });
    s.ledger.consume.mockResolvedValue({} as { applied: boolean });
    await expect(s.service.processAuthenticatedWebhook(payload())).rejects.toMatchObject({ code: "ledger_invalid" });
  });
});

describe("every Blacklist operation re-verifies ledger + paid SALE, not live subscription endpoint", () => {
  it("valid server ledger and paid sale produce finite trusted Kiwify evidence", async () => {
    const s = setup();
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toEqual({ userId: 7, status: "active", validFrom: "2026-10-10T12:00:00.000Z", validUntil: "2026-11-11T12:00:00.000Z", source: "kiwify:authenticated-webhook+verified-sale", lifetime: false });
    expect(s.sales.getSale).toHaveBeenCalledWith("order-test");
    expect(s.ledger.readEvidenceForUser).toHaveBeenCalledTimes(2);
  });

  it("canceled retains ONLY an existing valid paid period", async () => {
    const s = setup(ledgerRow({ status: "canceled" }));
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toMatchObject({ status: "active" });
    s.setNow(Date.parse("2026-11-11T12:00:00Z"));
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    expect(s.sales.getSale).toHaveBeenCalledTimes(1);
  });

  it("no ledger means historical paid sale or user registration never bootstraps a grant", async () => {
    const s = setup(null);
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    expect(s.sales.getSale).not.toHaveBeenCalled(); expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("each operation re-fetches sale; missed refund is denied on the next operation", async () => {
    const s = setup();
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toMatchObject({ status: "active" });
    s.sales.getSale.mockResolvedValue({ ...SALE, status: "refunded" });
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    expect(s.sales.getSale).toHaveBeenCalledTimes(2);
  });

  it.each([
    { refunded: true }, { chargedback: true }, { reviewRequired: true }, { trustedWebhook: false }, { hasAccess: false }, { activePeriod: false },
    { status: "waiting_payment" }, { status: "ended" }, { userId: 8 }, { productId: "alien" },
    { validUntil: "2026-11-10T12:00:00Z" }, { validUntil: "" }, { validUntil: "2026-02-31T12:00:00Z" },
    { validFrom: "2026-11-12T12:00:00Z" }, { validFrom: "2026-10-10 12:00:00" },
    { subscriptionId: "" }, { lastPaidOrderId: "../evil" },
  ])("rejects invalid/sticky/expired ledger %j before external eligibility fetch", async patch => {
    const s = setup(ledgerRow(patch as Partial<KiwifyLedgerEvidence>));
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    expect(s.sales.getSale).not.toHaveBeenCalled();
  });

  it.each(["refunded", "chargedback", "refused", "waiting_payment"])("current API status %s denies despite valid period", async status => {
    const s = setup(); s.sales.getSale.mockResolvedValue({ ...SALE, status });
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
  });

  it("sale order ID mismatch fails closed", async () => {
    const s = setup(); s.sales.getSale.mockResolvedValue({ ...SALE, id: "other-order" });
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("sale product mismatch fails closed even if both products were allowlisted", async () => {
    const s = setup(); s.sales.isProductAllowed.mockReturnValue(true); s.sales.getSale.mockResolvedValue({ ...SALE, productId: "other-allowed" });
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
  });

  it("sale email swapped to another user denies", async () => {
    const s = setup(); s.sales.getSale.mockResolvedValue({ ...SALE, customerEmail: "other@test.example" });
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
  });

  it("server user email changed since paid ledger denies", async () => {
    const s = setup(); s.users.getUserById.mockResolvedValue({ id: 7, email: "changed@test.example" });
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
    expect(s.sales.getSale).not.toHaveBeenCalled();
  });

  it("server lookup returning swapped user ID denies", async () => {
    const s = setup(); s.users.getUserById.mockResolvedValue({ id: 8, email: USER.email });
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
  });

  it("ambiguous case-insensitive user identity denies", async () => {
    const s = setup(); s.users.findUsersByNormalizedEmail.mockResolvedValue([{ ...USER }, { id: 8, email: "USER@TEST.EXAMPLE" }]);
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
  });

  it.each(["forbidden", "rate_limited", "not_found", "timeout", "configuration"] as const)("API %s is unavailable/fail closed, never cached positive fallback", async code => {
    const s = setup(); s.sales.getSale.mockRejectedValue(new KiwifySalesError(code));
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("revocation arriving during GET is detected by second ledger read", async () => {
    const s = setup(); s.ledger.readEvidenceForUser.mockResolvedValueOnce(ledgerRow()).mockResolvedValueOnce(ledgerRow({ chargedback: true }));
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
  });

  it("period expiry during GET does not grant", async () => {
    const s = setup(); s.sales.getSale.mockImplementation(async () => { s.setNow(Date.parse("2026-11-11T12:00:00Z")); return { ...SALE }; });
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
  });

  it("email reassignment during GET does not grant", async () => {
    const s = setup(); s.users.getUserById.mockResolvedValueOnce({ ...USER }).mockResolvedValueOnce({ id: 7, email: "other@test.example" });
    await expect(s.service.resolveKiwifyBlacklistEvidence(7)).resolves.toBeNull();
  });

  it("unconfigured exported composition fails closed without DB/credential discovery", async () => {
    configureKiwifySubscriptions();
    await expect(resolveKiwifyBlacklistEvidence(7)).rejects.toMatchObject({ code: "ledger_unavailable" });
    await expect(processAuthenticatedKiwifyWebhook(Buffer.from(JSON.stringify(payload())))).rejects.toMatchObject({ code: "ledger_unavailable" });
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER])("invalid server user ID %s denies before any access", async id => {
    const s = setup(); await expect(s.service.resolveKiwifyBlacklistEvidence(id)).resolves.toBeNull();
    expect(s.sales.getSale).not.toHaveBeenCalled(); expect(s.ledger.readEvidenceForUser).not.toHaveBeenCalled();
  });
});

describe("0027 exact writer DTO and documented root epoch ordering", () => {
  it("normalizes Brasília root minutes with IANA timezone, not server local timezone", () => {
    expect(parseKiwifyRootBrasilia("2026-11-10 08:59")).toBe("2026-11-10T11:59:00.000Z");
    expect(parseKiwifyRootBrasilia("2026-02-31 08:59")).toBeNull();
    expect(parseKiwifyRootBrasilia("2026-11-10T08:59:00Z")).toBeNull();
  });

  it("missing/future official root event timestamp never falls back to server receipt", async () => {
    const s = setup();
    for (const updated_at of [undefined, "2026-11-11 08:59", "bad-date"]) {
      await expect(s.service.processAuthenticatedWebhook(payload({ updated_at }))).resolves.toMatchObject({ reason: "no_current_paid_period" });
    }
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });

  it("refund missing or malformed root/access fields still prepares sticky revoke", async () => {
    const s = setup();
    await expect(s.service.processAuthenticatedWebhook(payload({ webhook_event_type: "order_refunded", order_status: "refunded", updated_at: "bad", Subscription: { id: "subscription-test", customer_access: "malformed" } })))
      .resolves.toMatchObject({ action: "revoke" });
    const dto = toKiwifyConsumeEvent0027(s.ledger.consume.mock.calls[0][0]);
    expect(dto.event_at).toBeNull(); expect(dto.has_access).toBeNull();
  });

  it("writer emits ONLY allowed exact RPC fields, without PII/action/receipt", async () => {
    const s = setup(); const raw = Buffer.from(JSON.stringify(payload()));
    await s.service.processAuthenticatedWebhook(raw);
    const projection = s.ledger.consume.mock.calls[0][0];
    const rpc = vi.fn(async () => ({ data: { accepted: true, duplicate: false, outcome: "paid_period", subscription_id: "subscription-test", eligible: true, access_until: "2026-11-11T12:00:00.000000Z", financial_revoked: false, review_required: false }, error: null }));
    await expect(consumeKiwifyEvent0027({ rpc }, projection)).resolves.toEqual({ applied: true });
    expect(rpc).toHaveBeenCalledWith("rpc_kiwify_blacklist_consume", { p_event: {
      event_fingerprint: projection.evidenceHash, order_id: "order-test", event_type: "order_approved", subscription_id: "subscription-test", user_id: 7, product_id: "cobrapro-test", status: "active", start_date: "2026-10-10T12:00:00.000Z", has_access: true, active_period: true, access_until: "2026-11-11T12:00:00.000Z", verified_sale_status: "paid", event_at: "2026-11-10T11:59:00.000Z",
    } });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(USER.email);
  });

  it("raw whitespace changes fingerprint while preserving normalized event semantics", async () => {
    const s = setup();
    await s.service.processAuthenticatedWebhook(Buffer.from(JSON.stringify(payload())));
    await s.service.processAuthenticatedWebhook(Buffer.from(JSON.stringify(payload(), null, 2)));
    expect(s.ledger.consume.mock.calls[0][0].evidenceHash).not.toBe(s.ledger.consume.mock.calls[1][0].evidenceHash);
    expect(s.ledger.consume.mock.calls[0][0].eventAt).toBe(s.ledger.consume.mock.calls[1][0].eventAt);
  });

  it("writer requires subscription identity; cannot invent it when entirely absent", async () => {
    const s = setup();
    await s.service.processAuthenticatedWebhook(payload({ webhook_event_type: "chargeback", order_status: "chargedback", Subscription: undefined, subscription_id: undefined }));
    expect(() => toKiwifyConsumeEvent0027(s.ledger.consume.mock.calls[0][0])).toThrow("invalid_payload");
  });

  it("divergent approved + refunded order_status cannot become grant through writer lacking order_status", async () => {
    const s = setup(); await s.service.processAuthenticatedWebhook(payload({ order_status: "refunded" }));
    expect(() => toKiwifyConsumeEvent0027(s.ledger.consume.mock.calls[0][0])).toThrow("invalid_payload");
  });

  it("missing writer/migration errors are sanitized and no fallback grant occurs", async () => {
    const s = setup(); await s.service.processAuthenticatedWebhook(payload()); const p = s.ledger.consume.mock.calls[0][0];
    await expect(consumeKiwifyEvent0027(null, p)).rejects.toMatchObject({ code: "ledger_unavailable" });
    const rpc = vi.fn(async () => ({ data: null, error: { code: "PGRST202", message: "PII secret" } }));
    await expect(consumeKiwifyEvent0027({ rpc }, p)).rejects.toMatchObject({ message: "Evidência Kiwify indisponível (ledger_unavailable)." });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("malformed/contradictory consume receipt cannot assert persistence or grant", async () => {
    const s = setup(); await s.service.processAuthenticatedWebhook(payload()); const p = s.ledger.consume.mock.calls[0][0];
    const rpc = vi.fn(async () => ({ data: { accepted: true, duplicate: false, outcome: "paid_period", subscription_id: "other", eligible: true, access_until: "2026-11-11T12:00:00Z", financial_revoked: true, review_required: false }, error: null }));
    await expect(consumeKiwifyEvent0027({ rpc }, p)).rejects.toMatchObject({ code: "ledger_invalid" });
  });

  it("paid approved canceled state can establish documented finite paid access, not recurrence", async () => {
    const s = setup(); const p = payload(); p.Subscription.status = "canceled";
    await expect(s.service.processAuthenticatedWebhook(p)).resolves.toMatchObject({ action: "paid_period" });
  });

  it("367-day local safety ceiling blocks lifetime disguised as future access_until", async () => {
    const s = setup(); const p = payload(); p.Subscription.customer_access.access_until = "2099-12-01 00:00:00";
    await expect(s.service.processAuthenticatedWebhook(p)).resolves.toMatchObject({ reason: "no_current_paid_period" });
    expect(s.ledger.consume).not.toHaveBeenCalled();
  });
});

describe("negative observation DTO cannot retain positive access", () => {
  it.each(["order_refunded", "chargeback"])("%s writer nulls access/order dates while preserving real event and sale identity", async event => {
    const s = setup();
    await s.service.processAuthenticatedWebhook(payload({ webhook_event_type: event }));
    const dto = toKiwifyConsumeEvent0027(s.ledger.consume.mock.calls[0][0]);
    expect(dto).toMatchObject({ event_type: event, verified_sale_status: "paid", subscription_id: "subscription-test",
      status: null, start_date: null, has_access: null, active_period: null, access_until: null, event_at: null });
  });

  it("subscription_late with contradictory has_access=true is persisted with derived false flags", async () => {
    const s = setup();
    await s.service.processAuthenticatedWebhook(payload({ webhook_event_type: "subscription_late", order_status: "refused" }));
    const projection = s.ledger.consume.mock.calls[0][0];
    expect(projection.hasAccess).toBe(true);
    expect(projection.action).toBe("suspend");
    expect(toKiwifyConsumeEvent0027(projection)).toMatchObject({ has_access: false, active_period: false });
  });
});
