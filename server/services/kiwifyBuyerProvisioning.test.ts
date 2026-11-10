import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createKiwifyBuyerProvisioning, type KiwifyInvitationState } from "./kiwifyBuyerProvisioning";
import { createKiwifySubscriptions, type KiwifyLedgerProjection } from "./kiwifySubscriptions";
import { KiwifySalesError } from "./kiwifySalesClient";
import type { EmailDeliveryResult } from "../_core/email";

const projection = (): Omit<KiwifyLedgerProjection, "userId"> => ({
  orderId: "order_fixture", subscriptionId: "sub_fixture", productId: "prod_fixture",
  customerEmail: "new@example.invalid", eventType: "order_approved", orderStatus: "paid", saleStatus: "paid",
  action: "paid_period", subscriptionStatus: "active", validFrom: "2026-10-10T12:00:00.000Z",
  validUntil: "2026-11-11T12:00:00.000Z", hasAccess: true, activePeriod: true,
  eventAt: "2026-11-10T11:59:00.000Z", receivedAt: "2026-11-10T12:00:00.000Z", evidenceHash: "a".repeat(64),
});
const accepted: EmailDeliveryResult = { accepted: true, kind: "accepted", retryEligible: false, deliveryKnown: true };
const unknown: EmailDeliveryResult = { accepted: false, kind: "delivery_unknown", retryEligible: false, deliveryKnown: false };
function setup(initial: KiwifyInvitationState = "pending") {
  let state = initial;
  let tokenHash: string | undefined;
  const sendEmail = vi.fn(async () => accepted);
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
    if (name === "rpc_kiwify_buyer_provision") return { error: null, data: {
      user_id: 77, email: "new@example.invalid", created: initial !== "not_needed", applied: true, invite_state: state,
    } };
    if (name === "rpc_kiwify_buyer_invite_claim") {
      const claim = params.p_claim as Record<string, unknown>;
      const acquired = state === "pending" || state === "retryable";
      if (acquired) { state = "sending"; tokenHash = String(claim.token_hash); }
      return { error: null, data: { claimed: acquired, user_id: 77, invite_state: state } };
    }
    if (name === "rpc_kiwify_buyer_invite_finish") {
      const result = params.p_result as Record<string, unknown>;
      expect(state).toBe("sending"); expect(result.token_hash).toBe(tokenHash);
      state = result.state as KiwifyInvitationState;
      return { error: null, data: { finished: true, invite_state: state } };
    }
    throw new Error("Unexpected RPC");
  });
  const service = createKiwifyBuyerProvisioning({ client: async () => ({ rpc }), sendEmail });
  return { service, rpc, sendEmail, state: () => state, tokenHash: () => tokenHash };
}

describe("buyer backend DTO + random individual invitation (no real calls)", () => {
  it("sends exact RPC contract, bcrypt12 random password, neutral name and hash-only token before email", async () => {
    const s = setup();
    s.sendEmail.mockImplementation(async () => { expect(s.state()).toBe("sending"); expect(s.tokenHash()).toMatch(/^[a-f0-9]{64}$/); return accepted; });
    await expect(s.service.provisionPaidBuyer(projection())).resolves.toEqual({ userId: 77, applied: true, invitation: "accepted" });
    const dto = s.rpc.mock.calls[0][1].p_buyer as Record<string, unknown>;
    expect(Object.keys(dto).sort()).toEqual(["email", "event", "open_id", "password_hash"]);
    expect(dto.email).toBe("new@example.invalid"); expect(dto.open_id).toMatch(/^kiwify_[a-f0-9-]{36}$/);
    expect(dto.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare("12345678", String(dto.password_hash))).toBe(false);
    expect(Object.keys(dto.event as object)).not.toContain("user_id");
    const message = s.sendEmail.mock.calls[0][0] as any;
    expect(message.to).toBe("new@example.invalid"); expect(message.toName).toBe("Cliente CobraPro");
    const rawToken = /token=([a-f0-9]{64})/.exec(message.htmlContent)![1];
    expect(createHash("sha256").update(rawToken).digest("hex")).toBe(s.tokenHash());
    expect(JSON.stringify(s.rpc.mock.calls)).not.toContain(rawToken);
    expect(message.htmlContent).not.toContain("12345678");
  });
  it("two acquisitions have unrelated bcrypt hashes and individual tokens", async () => {
    const a = setup(); const b = setup();
    await a.service.provisionPaidBuyer(projection()); await b.service.provisionPaidBuyer(projection());
    expect((a.rpc.mock.calls[0][1].p_buyer as any).password_hash).not.toBe((b.rpc.mock.calls[0][1].p_buyer as any).password_hash);
    expect(a.tokenHash()).not.toBe(b.tokenHash());
  });
  it.each(["not_needed", "sending", "accepted", "unknown", "blocked"] as const)("%s never claims or sends", async initial => {
    const s = setup(initial); await s.service.provisionPaidBuyer(projection());
    expect(s.rpc).toHaveBeenCalledTimes(1); expect(s.sendEmail).not.toHaveBeenCalled();
  });
  it.each([
    [accepted, "accepted"], [unknown, "unknown"],
    [{ accepted: false, kind: "throttled", deliveryKnown: true, retryEligible: true }, "retryable"],
    [{ accepted: false, kind: "transient_provider", deliveryKnown: true, retryEligible: true }, "retryable"],
    [{ accepted: false, kind: "rejected", deliveryKnown: true, retryEligible: false }, "blocked"],
    [{ accepted: false, kind: "configuration", deliveryKnown: true, retryEligible: false }, "blocked"],
  ] as const)("maps provider reply to %s / %s without alleging delivery", async (reply, state) => {
    const s = setup(); s.sendEmail.mockResolvedValue(reply);
    expect((await s.service.provisionPaidBuyer(projection())).invitation).toBe(state);
  });
  it("known retry failure reuses user and permits new individual token", async () => {
    const s = setup(); s.sendEmail.mockResolvedValueOnce({ accepted: false, kind: "throttled", deliveryKnown: true, retryEligible: true });
    const first = await s.service.provisionPaidBuyer(projection()); const firstHash = s.tokenHash();
    const second = await s.service.provisionPaidBuyer(projection());
    expect(first.userId).toBe(second.userId); expect(second.invitation).toBe("accepted"); expect(firstHash).not.toBe(s.tokenHash());
  });
  it("unknown or thrown transport cannot resend after timeout", async () => {
    const s = setup(); s.sendEmail.mockRejectedValue(new Error("connection interrupted after POST"));
    expect((await s.service.provisionPaidBuyer(projection())).invitation).toBe("unknown");
    await s.service.provisionPaidBuyer(projection()); expect(s.sendEmail).toHaveBeenCalledTimes(1);
  });
  it("finish failure leaves persisted sending, so replay cannot resend", async () => {
    const s = setup(); const original = s.rpc.getMockImplementation()!;
    s.rpc.mockImplementation(async (name, params) => name.endsWith("finish") ? { data: null, error: { message: "secret" } } : original(name, params) as any);
    await expect(s.service.provisionPaidBuyer(projection())).rejects.toMatchObject({ code: "ledger_unavailable" });
    expect(s.state()).toBe("sending"); await s.service.provisionPaidBuyer(projection()); expect(s.sendEmail).toHaveBeenCalledTimes(1);
  });
  it("claim race losers do not send", async () => {
    const s = setup(); await Promise.all([s.service.provisionPaidBuyer(projection()), s.service.provisionPaidBuyer(projection())]);
    expect(s.sendEmail).toHaveBeenCalledTimes(1);
  });
  it.each([null, true, {}, { accepted: false, retryEligible: true, deliveryKnown: false, kind: "delivery_unknown" },
    { accepted: true, retryEligible: true, deliveryKnown: true, kind: "accepted" },
    { accepted: false, retryEligible: true, deliveryKnown: true, kind: "unapproved" }])("unexpected email reply %j is unknown, NEVER retryable", async reply => {
    const s = setup(); s.sendEmail.mockResolvedValue(reply as any);
    expect((await s.service.provisionPaidBuyer(projection())).invitation).toBe("unknown");
    await s.service.provisionPaidBuyer(projection()); expect(s.sendEmail).toHaveBeenCalledTimes(1);
  });
  it.each([null, {}, { claimed: true, user_id: 78, invite_state: "sending" },
    { claimed: true, user_id: 77, invite_state: "pending" },
    { claimed: true, user_id: 77, invite_state: "sending", extra: true }])("unexpected claim %j cannot POST", async reply => {
    const s = setup(); const original = s.rpc.getMockImplementation()!;
    s.rpc.mockImplementation(async (name, params) => name.endsWith("claim") ? { data: reply, error: null } as any : original(name, params));
    await expect(s.service.provisionPaidBuyer(projection())).rejects.toMatchObject({ code: "ledger_invalid" });
    expect(s.sendEmail).not.toHaveBeenCalled();
  });
  it("malformed finish cannot assert acceptance and replay preserves sending", async () => {
    const s = setup(); const original = s.rpc.getMockImplementation()!;
    s.rpc.mockImplementation(async (name, params) => name.endsWith("finish") ? { data: { finished: false, invite_state: "accepted" }, error: null } as any : original(name, params));
    await expect(s.service.provisionPaidBuyer(projection())).rejects.toMatchObject({ code: "ledger_invalid" });
    expect(s.state()).toBe("sending"); await s.service.provisionPaidBuyer(projection()); expect(s.sendEmail).toHaveBeenCalledTimes(1);
  });
  it.each([null, {}, { user_id: 77, email: "other@example.invalid", created: true, applied: true, invite_state: "pending" },
    { user_id: 77, email: "new@example.invalid", created: false, applied: true, invite_state: "pending" },
    { user_id: 77, email: "new@example.invalid", created: true, applied: true, invite_state: "pending", extra: true }])("strict provision reply %j refuses", async data => {
    const s = setup(); s.rpc.mockResolvedValue({ data, error: null } as any);
    await expect(s.service.provisionPaidBuyer(projection())).rejects.toMatchObject({ code: "ledger_invalid" }); expect(s.sendEmail).not.toHaveBeenCalled();
  });
  it.each(["refused", "waiting_payment", "refunded", "chargedback"])("cannot provision sale %s", async saleStatus => {
    const s = setup(); await expect(s.service.provisionPaidBuyer({ ...projection(), saleStatus })).rejects.toMatchObject({ code: "invalid_payload" }); expect(s.rpc).not.toHaveBeenCalled();
  });
  it("missing RPC failure is redacted and never direct-table fallback", async () => {
    const s = setup(); s.rpc.mockRejectedValue(new Error("secret pii@example.invalid"));
    await expect(s.service.provisionPaidBuyer(projection())).rejects.toMatchObject({ message: "Evidência Kiwify indisponível (ledger_unavailable)." }); expect(s.sendEmail).not.toHaveBeenCalled();
  });
});

function subscriptionSetup() {
  const NOW = Date.parse("2026-11-10T12:00:00Z");
  const buyers = { provisionPaidBuyer: vi.fn(async () => ({ userId: 77, applied: true, invitation: "accepted" as const })) };
  const sales = { getSale: vi.fn(async () => ({ id: "order_fixture", productId: "prod_fixture", customerEmail: "new@example.invalid", status: "paid" })), isProductAllowed: vi.fn(() => true) };
  const users = { findUsersByNormalizedEmail: vi.fn(async () => []), getUserById: vi.fn(async () => null) };
  const ledger = { consume: vi.fn(async () => ({ applied: true })), readEvidenceForUser: vi.fn(async () => null) };
  const service = createKiwifySubscriptions({ sales, users, ledger, buyers, now: () => NOW });
  const payload = () => ({ order_id: "order_fixture", subscription_id: "sub_fixture", webhook_event_type: "order_approved", order_status: "paid", updated_at: "2026-11-10 08:59",
    Customer: { email: "webhook-forged@example.invalid", name: "Untrusted" }, Subscription: { id: "sub_fixture", status: "active", start_date: "2026-10-10 12:00:00", customer_access: { has_access: true, active_period: true, access_until: "2026-11-11 12:00:00" } } });
  const run = (patch: Record<string, unknown> = {}) => service.processAuthenticatedWebhook(Buffer.from(JSON.stringify({ ...payload(), ...patch })));
  return { buyers, sales, users, ledger, payload, run };
}
describe("full paid validation precedes account transaction", () => {
  it("new buyer reaches transaction with only verified GET identity; no forever user_not_unique", async () => {
    const s = subscriptionSetup(); expect(await s.run()).toMatchObject({ outcome: "consumed", invitation: "accepted" });
    expect(s.buyers.provisionPaidBuyer).toHaveBeenCalledWith(expect.objectContaining({ customerEmail: "new@example.invalid", action: "paid_period" }));
    expect(s.users.findUsersByNormalizedEmail).not.toHaveBeenCalled(); expect(s.ledger.consume).not.toHaveBeenCalled();
    expect(JSON.stringify(s.buyers.provisionPaidBuyer.mock.calls)).not.toContain("webhook-forged");
  });
  it.each(["refused", "waiting_payment", "refunded", "chargedback"])("API %s never provisions", async status => {
    const s = subscriptionSetup(); s.sales.getSale.mockResolvedValue({ id: "order_fixture", productId: "prod_fixture", customerEmail: "new@example.invalid", status }); await s.run(); expect(s.buyers.provisionPaidBuyer).not.toHaveBeenCalled();
  });
  it.each(["order_refunded", "chargeback", "order_rejected", "pix_created", "billet_created", "subscription_late", "subscription_canceled"])("event %s never creates user", async webhook_event_type => {
    const s = subscriptionSetup(); await s.run({ webhook_event_type }); expect(s.buyers.provisionPaidBuyer).not.toHaveBeenCalled();
  });
  it.each([
    { Subscription: undefined }, { updated_at: undefined }, { updated_at: "2099-01-01 12:00" },
    { Subscription: { id: "sub_fixture", status: "active", start_date: "2026-02-31 00:00:00", customer_access: { has_access: true, active_period: true, access_until: "2026-11-11 12:00:00" } } },
    { Subscription: { id: "sub_fixture", status: "active", start_date: "2026-10-10 00:00:00", customer_access: { has_access: true, active_period: true, access_until: "2099-01-01 00:00:00" } } },
    { Subscription: { id: "sub_fixture", status: "active", start_date: "2026-10-10 00:00:00", customer_access: { has_access: "true", active_period: true, access_until: "2026-11-11 12:00:00" } } },
  ])("invalid positive %j never creates transient account/grant", async patch => {
    const s = subscriptionSetup(); await s.run(patch); expect(s.buyers.provisionPaidBuyer).not.toHaveBeenCalled(); expect(s.ledger.consume).not.toHaveBeenCalled();
  });
  it.each(["not_found", "timeout", "invalid_response", "forbidden"] as const)("GET %s prevents provisioning", async code => {
    const s = subscriptionSetup(); s.sales.getSale.mockRejectedValue(new KiwifySalesError(code)); await expect(s.run()).rejects.toMatchObject({ code }); expect(s.buyers.provisionPaidBuyer).not.toHaveBeenCalled();
  });
  it("product not allowed prevents transaction", async () => {
    const s = subscriptionSetup(); s.sales.isProductAllowed.mockReturnValue(false); await s.run(); expect(s.buyers.provisionPaidBuyer).not.toHaveBeenCalled();
  });
});
