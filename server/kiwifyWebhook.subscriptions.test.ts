import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response as ExpressResponse } from "express";

const mocks = vi.hoisted(() => ({ process: vi.fn(), db: vi.fn(), email: vi.fn(), hash: vi.fn() }));
vi.mock("./db", () => ({ getSupabaseClientAsync: mocks.db }));
vi.mock("./_core/email", () => ({ enviarEmail: mocks.email }));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));
vi.mock("./services/kiwifySubscriptionRuntime", async importOriginal => ({
  ...await importOriginal<typeof import("./services/kiwifySubscriptionRuntime")>(),
  processVerifiedKiwifySubscription: mocks.process,
}));
import { registerKiwifyWebhookRoutes } from "./kiwifyWebhook";
import { KiwifySubscriptionError } from "./services/kiwifySubscriptions";
import { KiwifySalesError, type KiwifyFailureCode } from "./services/kiwifySalesClient";
import { createKiwifySubscriptionRuntime, type KiwifyRuntimeSupabase } from "./services/kiwifySubscriptionRuntime";

const TOKEN = "segredo-hmac-somente-teste";
const NOW = Date.parse("2026-11-10T12:00:00Z");
const ENV = {
  ENABLE_KIWIFY_SUBSCRIPTIONS: "true", KIWIFY_CLIENT_ID: "mock-client", KIWIFY_CLIENT_SECRET: "mock-secret",
  KIWIFY_ACCOUNT_ID: "mock-account", KIWIFY_COBRAPRO_PRODUCT_IDS: '["mock-product"]',
};
const payload = () => ({
  order_id: "mock-order", order_status: "paid", webhook_event_type: "order_approved",
  subscription_id: "mock-subscription", updated_at: "2026-11-10 08:59",
  Subscription: { id: "mock-subscription", status: "active", start_date: "2026-10-10 12:00:00",
    customer_access: { has_access: true, active_period: true, access_until: "2026-11-11 12:00:00" } },
});
const raw = () => Buffer.from(JSON.stringify(payload()));
const sign = (body: Buffer) => createHmac("sha1", TOKEN).update(body).digest("hex");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function harness() {
  const app = { post: vi.fn(), get: vi.fn() };
  registerKiwifyWebhookRoutes(app as unknown as Express);
  const handler = app.post.mock.calls[0][1] as (req: Request & { rawBody?: Buffer }, res: ExpressResponse) => Promise<unknown>;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const run = (req: unknown) => handler(req as Request, res as unknown as ExpressResponse);
  return { app, res, run };
}
function signedRequest(rawBody = raw(), body: unknown = { customer: { email: "legacy@example.test" }, order_id: "legacy-order", order_status: "paid" }) {
  return { rawBody, query: { signature: sign(rawBody) }, body };
}
function noLegacy() {
  expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.email).not.toHaveBeenCalled(); expect(mocks.hash).not.toHaveBeenCalled();
}
function realRuntime(options: { saleStatus?: string; notFound?: boolean } = {}) {
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
    if (name === "rpc_kiwify_blacklist_find_users") return { data: [{ id: 7, email: "user@example.test" }], error: null };
    if (name === "rpc_kiwify_blacklist_order_binding") return { data: { subscription_id: "mock-subscription", user_id: 7, product_id: "mock-product" }, error: null };
    if (name === "rpc_kiwify_blacklist_consume") {
      const event = params.p_event as Record<string, unknown>;
      const financial = event.verified_sale_status !== "paid";
      return { data: { accepted: true, duplicate: false, outcome: financial ? "financial_revoked" : "paid_period",
        subscription_id: event.subscription_id, eligible: !financial, access_until: financial ? null : "2026-11-11T12:00:00Z",
        financial_revoked: financial, review_required: false }, error: null };
    }
    throw new Error("RPC inesperada");
  });
  const maybeSingle = vi.fn(async () => ({ data: { id: 7, email: "user@example.test" }, error: null }));
  const from = vi.fn((_table: "users") => ({ select: (_columns: "id,email") => ({
    eq: (_column: "id", _id: number) => ({ limit: (_count: 1) => ({ maybeSingle }) }),
  }) }));
  const sb: KiwifyRuntimeSupabase = { rpc, from };
  const getSupabaseClient = vi.fn(async () => sb);
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    if (String(url).endsWith("/oauth/token")) return json({ access_token: "mock-oauth", token_type: "Bearer", scope: "sales", expires_in: 3600 });
    if (options.notFound) return json({ error: "private-upstream-body user@example.test" }, 404);
    return json({ id: "mock-order", product: { id: "mock-product" }, customer: { email: "user@example.test" }, status: options.saleStatus ?? "paid" });
  });
  const env: Record<string, string | undefined> = { ...ENV };
  const runtime = createKiwifySubscriptionRuntime({ env, fetch: fetchMock as typeof fetch, getSupabaseClient, now: () => NOW });
  mocks.process.mockImplementation(runtime.processVerifiedKiwifySubscription);
  return { rpc, from, getSupabaseClient, fetchMock, env };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("KIWIFY_WEBHOOK_TOKEN", TOKEN);
  vi.stubEnv("ENABLE_KIWIFY_SUBSCRIPTIONS", "true");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Rede real proibida no teste"); }));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.process.mockResolvedValue({ outcome: "consumed", action: "paid_period", applied: true });
  mocks.db.mockImplementation(() => { throw new Error("Fallback legado proibido"); });
  mocks.email.mockImplementation(() => { throw new Error("Email proibido"); });
  mocks.hash.mockImplementation(() => { throw new Error("Conta proibida"); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("HMAC dos bytes crus antecede runtime e leitura de body", () => {
  it("mantém a rota POST existente, sem novo endpoint de assinatura", () => {
    const h = harness(); expect(h.app.post.mock.calls).toEqual([["/api/webhook/kiwify", expect.any(Function)]]);
  });
  it("segredo HMAC ausente => 503, nunca runtime/body/DB", async () => {
    vi.stubEnv("KIWIFY_WEBHOOK_TOKEN", undefined);
    const h = harness(); const req = signedRequest();
    Object.defineProperty(req, "body", { get: () => { throw new Error("Leitura indevida de body"); } });
    await h.run(req); expect(h.res.status).toHaveBeenCalledWith(503); expect(mocks.process).not.toHaveBeenCalled(); noLegacy();
  });
  it.each([undefined, "", "0".repeat(40), "A".repeat(40), "abc", ["0".repeat(40)], { signature: "x" }])("assinatura ausente/inválida %j => nunca runtime/body", async signature => {
    const h = harness(); const req = { rawBody: raw(), query: { signature } };
    const bodyRead = vi.fn(() => { throw new Error("Body não deve ser lido"); });
    Object.defineProperty(req, "body", { get: bodyRead });
    await h.run(req); expect(h.res.status).toHaveBeenCalledWith(401); expect(bodyRead).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled(); noLegacy(); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it.each([undefined, "{}", {}])("rawBody ausente ou não Buffer %j => nunca runtime", async rawBody => {
    const h = harness(); await h.run({ rawBody, query: { signature: sign(raw()) }, body: {} });
    expect(h.res.status).toHaveBeenCalledWith(401); expect(mocks.process).not.toHaveBeenCalled(); noLegacy();
  });
  it("assinatura do JSON reserializado não autentica whitespace original", async () => {
    const rawBody = Buffer.from('{ "order_id" : "mock-order" }\n');
    const h = harness(); await h.run({ rawBody, query: { signature: sign(Buffer.from(JSON.stringify(JSON.parse(rawBody.toString())))) }, body: payload() });
    expect(h.res.status).toHaveBeenCalledWith(401); expect(mocks.process).not.toHaveBeenCalled(); noLegacy();
  });
  it("passa o MESMO Buffer autenticado apesar de req.body divergente", async () => {
    const rawBody = Buffer.from('{ "order_id" : "mock-order", "name": "Sintético ç" }\n');
    const body = { order_id: "pedido-diferente", order_status: "paid", customer: { email: "outro@example.test" } };
    const h = harness(); await h.run(signedRequest(rawBody, body));
    expect(mocks.process.mock.calls).toEqual([[rawBody]]); expect(mocks.process.mock.calls[0][0]).toBe(rawBody);
    expect(h.res.status).toHaveBeenCalledWith(200); expect(h.res.json).toHaveBeenCalledWith({ received: true }); noLegacy();
  });
  it("captura rawBody uma vez e nunca lê req.body mesmo após HMAC válido", async () => {
    const rawBody = raw(); const req = { query: { signature: sign(rawBody) } };
    const rawRead = vi.fn(() => rawBody); const bodyRead = vi.fn(() => { throw new Error("Leitura de body proibida"); });
    Object.defineProperty(req, "rawBody", { get: rawRead }); Object.defineProperty(req, "body", { get: bodyRead });
    const h = harness(); await h.run(req);
    expect(rawRead).toHaveBeenCalledTimes(1); expect(bodyRead).not.toHaveBeenCalled();
    expect(mocks.process.mock.calls[0][0]).toBe(rawBody); expect(h.res.status).toHaveBeenCalledWith(200); noLegacy();
  });
});

describe("mapeamento de resultado e falhas sem fallback", () => {
  it.each([true, false])("consumed applied=%s recebe ACK sem prometer acesso", async applied => {
    mocks.process.mockResolvedValue({ outcome: "consumed", action: "paid_period", applied });
    const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(200); expect(h.res.json).toHaveBeenCalledWith({ received: true }); noLegacy();
  });
  it.each(["product_not_allowed", "non_grant_event"])("ignored %s recebe 200 ignored", async reason => {
    mocks.process.mockResolvedValue({ outcome: "ignored", reason }); const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(200); expect(h.res.json).toHaveBeenCalledWith({ received: true, ignored: true }); noLegacy();
  });
  it.each(["user_not_unique", "no_current_paid_period"])("ignored %s não perde evento legítimo com ACK definitivo", async reason => {
    mocks.process.mockResolvedValue({ outcome: "ignored", reason }); const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(503);
    expect(h.res.json).toHaveBeenCalledWith({ error: "Evento requer conferência antes de confirmação", needsReview: true, retry: true });
    expect(vi.mocked(console.error).mock.calls).toEqual([["[KiwifySubscriptions] review_required"]]); noLegacy();
  });
  it("erro tipado invalid_payload => 400 genérico", async () => {
    mocks.process.mockRejectedValue(new KiwifySubscriptionError("invalid_payload")); const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(400); expect(h.res.json).toHaveBeenCalledWith({ error: "Payload de pedido inválido" });
    expect(vi.mocked(console.error).mock.calls).toEqual([["[KiwifySubscriptions] invalid_payload"]]); noLegacy();
  });
  it.each(["configuration", "invalid_id", "unavailable", "timeout", "rate_limited", "forbidden", "unauthorized", "not_found", "invalid_response", "response_too_large"] satisfies KiwifyFailureCode[])("erro vendas %s => 503 sem fallback", async code => {
    mocks.process.mockRejectedValue(new KiwifySalesError(code)); const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(503);
    expect(h.res.json).toHaveBeenCalledWith({ error: "Webhook temporariamente indisponível", retry: true });
    expect(vi.mocked(console.error).mock.calls).toEqual([["[KiwifySubscriptions] unavailable"]]); noLegacy();
  });
  it.each(["identity", "ledger_unavailable", "ledger_invalid", "unavailable"] as const)("erro runtime %s => 503 sem legado", async code => {
    mocks.process.mockRejectedValue(new KiwifySubscriptionError(code)); const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(503); noLegacy();
  });
  it.each([
    new Error("PII user@example.test token-secret raw-body"),
    { code: "invalid_payload", message: "user@example.test token-secret" },
    { code: "user@example.test", rawBody: "raw-body" }, null,
  ])("falha desconhecida não vaza objetos/códigos/PII %j", async error => {
    mocks.process.mockRejectedValue(error); const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(503);
    expect(h.res.json).toHaveBeenCalledWith({ error: "Webhook temporariamente indisponível", retry: true });
    expect(vi.mocked(console.error).mock.calls).toEqual([["[KiwifySubscriptions] unavailable"]]); noLegacy();
  });
  it.each([null, undefined, {}, { outcome: "ignored", reason: "unexpected user@example.test" }])("resultado inesperado %j falha fechado sem ACK/fallback", async result => {
    mocks.process.mockResolvedValue(result); const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(503); expect(vi.mocked(console.error).mock.calls).toEqual([["[KiwifySubscriptions] unavailable"]]); noLegacy();
  });
});

describe("runtime real com transporte/RPC fictícios pelo handler autenticado", () => {
  it("pedido fictício assinado falha GET 404 e não alcança DB/conta/email", async () => {
    const s = realRuntime({ notFound: true }); const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(503);
    expect(s.fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://public-api.kiwify.com/v1/oauth/token", "https://public-api.kiwify.com/v1/sales/mock-order",
    ]);
    expect(s.getSupabaseClient).not.toHaveBeenCalled(); expect(s.rpc).not.toHaveBeenCalled(); expect(s.from).not.toHaveBeenCalled(); noLegacy();
    expect(vi.mocked(console.error).mock.calls).toEqual([["[KiwifySubscriptions] unavailable"]]);
  });
  it("approved verificado persiste SHA256 dos bytes crus e ignora identidade do req.body", async () => {
    const s = realRuntime(); const rawBody = Buffer.from(JSON.stringify(payload(), null, 2) + "\n");
    const h = harness(); await h.run(signedRequest(rawBody));
    expect(h.res.status).toHaveBeenCalledWith(200); expect(h.res.json).toHaveBeenCalledWith({ received: true });
    const calls = s.rpc.mock.calls.filter(([name]) => name === "rpc_kiwify_blacklist_consume"); expect(calls).toHaveLength(1);
    const dto = calls[0][1].p_event;
    expect(dto).toMatchObject({ user_id: 7, order_id: "mock-order", subscription_id: "mock-subscription", product_id: "mock-product",
      event_fingerprint: createHash("sha256").update(rawBody).digest("hex"), verified_sale_status: "paid" });
    expect(JSON.stringify(dto)).not.toContain("example.test"); noLegacy(); expect(s.from).not.toHaveBeenCalled();
  });
  it.each([
    { event: "order_refunded", status: "refunded" }, { event: "chargeback", status: "chargedback" },
  ])("$event sem Customer/Subscription chega à revogação verificada, nunca parser legado", async ({ event, status }) => {
    const s = realRuntime({ saleStatus: status });
    const rawBody = Buffer.from(JSON.stringify({ order_id: "mock-order", order_status: status, webhook_event_type: event }));
    const h = harness(); const req = signedRequest(rawBody); const bodyRead = vi.fn(() => { throw new Error("Parser legado proibido"); });
    Object.defineProperty(req, "body", { get: bodyRead }); await h.run(req);
    expect(h.res.status).toHaveBeenCalledWith(200); expect(bodyRead).not.toHaveBeenCalled();
    expect(s.rpc).toHaveBeenCalledWith("rpc_kiwify_blacklist_order_binding", { p_order_id: "mock-order" });
    expect(s.rpc).toHaveBeenCalledWith("rpc_kiwify_blacklist_consume", { p_event: expect.objectContaining({
      event_type: event, verified_sale_status: status, user_id: 7, subscription_id: "mock-subscription",
      status: null, has_access: null, active_period: null, access_until: null,
      event_fingerprint: createHash("sha256").update(rawBody).digest("hex"),
    }) });
    expect(s.from.mock.calls.every(([table]) => table === "users")).toBe(true); noLegacy();
  });
  it.each(["KIWIFY_CLIENT_ID", "KIWIFY_CLIENT_SECRET", "KIWIFY_ACCOUNT_ID", "KIWIFY_COBRAPRO_PRODUCT_IDS"])("credencial/config %s ausente => 503 sem OAuth/DB/convites", async key => {
    const s = realRuntime(); delete s.env[key]; const h = harness(); await h.run(signedRequest());
    expect(h.res.status).toHaveBeenCalledWith(503); expect(s.fetchMock).not.toHaveBeenCalled(); expect(s.getSupabaseClient).not.toHaveBeenCalled(); noLegacy();
  });
  it.each([Buffer.from("not-json"), Buffer.from("{}")])("payload autenticado inválido => 400 antes de GET/DB", async rawBody => {
    const s = realRuntime(); const h = harness(); await h.run(signedRequest(rawBody));
    expect(h.res.status).toHaveBeenCalledWith(400); expect(s.fetchMock).not.toHaveBeenCalled(); expect(s.getSupabaseClient).not.toHaveBeenCalled(); noLegacy();
  });
  it("RPC ausente não volta à tabela kiwify_webhooks ausente nem cria conta", async () => {
    const s = realRuntime(); s.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "private user@example.test" } } as never);
    const h = harness(); await h.run(signedRequest()); expect(h.res.status).toHaveBeenCalledWith(503); noLegacy();
    expect(s.from).not.toHaveBeenCalled(); expect(vi.mocked(console.error).mock.calls).toEqual([["[KiwifySubscriptions] unavailable"]]);
  });
});

describe("flag desligada preserva compatibilidade legada sem novo grant", () => {
  it.each([undefined, "false", "TRUE", "1", " true", "true "])("flag %s mantém ignore legado sem runtime", async flag => {
    vi.stubEnv("ENABLE_KIWIFY_SUBSCRIPTIONS", flag);
    const rawBody = Buffer.from(JSON.stringify({ order_id: "legacy-order", order_status: "refunded", customer: { email: "legacy@example.test" } }));
    const h = harness(); await h.run(signedRequest(rawBody, JSON.parse(rawBody.toString())));
    expect(h.res.status).toHaveBeenCalledWith(200); expect(h.res.json).toHaveBeenCalledWith({ received: true, ignored: true });
    expect(mocks.process).not.toHaveBeenCalled(); noLegacy();
  });
  it("flag false mantém reserva/conta existente legadas sem chamar runtime", async () => {
    vi.stubEnv("ENABLE_KIWIFY_SUBSCRIPTIONS", "false");
    const insert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "kiwify_webhooks") return { insert, update: () => ({ eq: async () => ({ error: null }) }) };
      if (table === "users") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 7 }, error: null }) }) }) };
      throw new Error("Tabela inesperada");
    });
    mocks.db.mockResolvedValue({ from }); const h = harness(); const body = { order_id: "legacy-order", order_status: "paid", customer: { email: "legacy@example.test" } };
    await h.run(signedRequest(Buffer.from(JSON.stringify(body)), body));
    expect(h.res.status).toHaveBeenCalledWith(200); expect(from).toHaveBeenCalledWith("kiwify_webhooks"); expect(from).toHaveBeenCalledWith("users");
    expect(mocks.process).not.toHaveBeenCalled(); expect(mocks.email).not.toHaveBeenCalled(); expect(mocks.hash).not.toHaveBeenCalled();
  });
  it("tabela legada ausente continua pendência: 500 antigo, sem runtime/fallback", async () => {
    vi.stubEnv("ENABLE_KIWIFY_SUBSCRIPTIONS", "false");
    mocks.db.mockResolvedValue({ from: vi.fn(() => ({ insert: async () => ({ error: { code: "42P01", message: "kiwify_webhooks ausente" } }) })) });
    const body = { order_id: "legacy-order", order_status: "paid", customer: { email: "legacy@example.test" } };
    const h = harness(); await h.run(signedRequest(Buffer.from(JSON.stringify(body)), body));
    expect(h.res.status).toHaveBeenCalledWith(500); expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled(); expect(mocks.hash).not.toHaveBeenCalled();
  });
});
