import { describe, expect, it, vi } from "vitest";
import {
  createKiwifySalesClient, readKiwifyConfiguration, normalizeKiwifyEmail,
  KIWIFY_CONFIGURATION_ENV_KEYS,
  type KiwifyConfiguration,
} from "./kiwifySalesClient";

const config: KiwifyConfiguration = {
  clientId: "client-test", clientSecret: "secret-test", accountId: "account-test", productIds: ["cobrapro-test"],
};
const oauth = (patch = {}) => ({ access_token: "token-test", token_type: "Bearer", expires_in: 3600, scope: "sales", ...patch });
const sale = (patch = {}) => ({ id: "order-test", product: { id: "cobrapro-test" }, customer: { id: "customer-test", email: "User@Test.Example" }, status: "paid", ...patch });
const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
function transport(...responses: (Response | Error)[]) {
  return vi.fn(async () => {
    const result = responses.shift();
    if (result instanceof Error) throw result;
    if (!result) throw new Error("No mocked response");
    return result;
  }) as ReturnType<typeof vi.fn> & typeof fetch;
}
const env = {
  KIWIFY_CLIENT_ID: "client-test", KIWIFY_CLIENT_SECRET: "secret-test", KIWIFY_ACCOUNT_ID: "account-test",
  KIWIFY_COBRAPRO_PRODUCT_IDS: '["cobrapro-test"]',
};

describe("Kiwify OAuth/sales (zero real network)", () => {
  it("documents only the four exact server configuration environment names", () => {
    expect(KIWIFY_CONFIGURATION_ENV_KEYS).toEqual([
      "KIWIFY_CLIENT_ID", "KIWIFY_CLIENT_SECRET", "KIWIFY_ACCOUNT_ID", "KIWIFY_COBRAPRO_PRODUCT_IDS",
    ]);
  });

  it("uses exact HTTPS form OAuth and Bearer/account headers for the direct sale", async () => {
    const fetchMock = transport(json(oauth()), json(sale()));
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    await expect(client.getSale("order-test")).resolves.toEqual({ id: "order-test", productId: "cobrapro-test", customerEmail: "user@test.example", status: "paid" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://public-api.kiwify.com/v1/oauth/token");
    const tokenInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(tokenInit.method).toBe("POST");
    expect(tokenInit.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(new URLSearchParams(tokenInit.body as string).get("client_id")).toBe(config.clientId);
    expect(new URLSearchParams(tokenInit.body as string).get("client_secret")).toBe(config.clientSecret);
    expect(fetchMock.mock.calls[1][0]).toBe("https://public-api.kiwify.com/v1/sales/order-test");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "GET", redirect: "error", headers: { Authorization: "Bearer token-test", "x-kiwify-account-id": "account-test" } });
    expect(tokenInit.redirect).toBe("error");
    expect(tokenInit.signal).toBeInstanceOf(AbortSignal);
  });

  it("accepts the real Kiwify OAuth scope array without requiring refund permission", async () => {
    const fetchMock = transport(json(oauth({ scope: ["sales"] })), json(sale()));
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    await expect(client.getSale("order-test")).resolves.toMatchObject({ status: "paid" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    { scope: null }, { scope: [] }, { scope: [null, "sales"] },
    { scope: ["sales", {}] }, { scope: ["sales_refund"] }, { scope: "sales_refund" },
    { scope: { sales: true } }, { scope: ["sales\n"] },
  ])("rejects missing or malformed scope %j before any sale read", async patch => {
    const fetchMock = transport(json(oauth(patch)));
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches OAuth only, never a sale or eligibility", async () => {
    const fetchMock = transport(json(oauth()), json(sale()), json(sale({ status: "refunded" })));
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    expect((await client.getSale("order-test")).status).toBe("paid");
    expect((await client.getSale("order-test")).status).toBe("refunded");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("singleflights simultaneous OAuth, while making every sale request", async () => {
    const fetchMock = vi.fn(async (url: string) => url.endsWith("/oauth/token") ? json(oauth()) : json(sale())) as unknown as typeof fetch;
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    await Promise.all(Array.from({ length: 8 }, () => client.getSale("order-test")));
    expect(vi.mocked(fetchMock).mock.calls.filter(c => String(c[0]).endsWith("/oauth/token"))).toHaveLength(1);
    expect(vi.mocked(fetchMock).mock.calls).toHaveLength(9);
  });

  it("honors actual expires_in instead of assumed 24/96 hours", async () => {
    let current = 1_000_000;
    const fetchMock = transport(json(oauth({ expires_in: 10 })), json(sale()), json(oauth({ access_token: "second-token" })), json(sale()));
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock, now: () => current });
    await client.getSale("order-test");
    current += 9_001;
    await client.getSale("order-test");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1]).toMatchObject({ headers: { Authorization: "Bearer second-token" } });
  });

  it("clears failed token singleflight for a later explicit retry", async () => {
    const fetchMock = transport(json({ message: "secret upstream" }, 403), json(oauth()), json(sale()));
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "forbidden" });
    await expect(client.getSale("order-test")).resolves.toMatchObject({ status: "paid" });
  });

  it("401 invalidates token but never retries or grants in the same operation", async () => {
    const fetchMock = transport(json(oauth()), json({}, 401), json(oauth()), json(sale()));
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await client.getSale("order-test");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([
    [404, "not_found"], [403, "forbidden"], [429, "rate_limited"], [500, "unavailable"], [302, "unavailable"],
  ])("sale HTTP %i fails closed as %s without revealing body", async (status, code) => {
    const fetchMock = transport(json(oauth()), json({ email: "pii@example.com", secret: "secret-test" }, Number(status)));
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code, message: `Kiwify indisponível (${code}).` });
  });

  it.each(["KIWIFY_CLIENT_ID", "KIWIFY_CLIENT_SECRET", "KIWIFY_ACCOUNT_ID", "KIWIFY_COBRAPRO_PRODUCT_IDS"])("missing %s prevents any network call", key => {
    const fetchMock = transport();
    expect(() => createKiwifySalesClient({ env: { ...env, [key]: undefined }, fetch: fetchMock })).toThrow("configuration");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["[]", '"all"', '["*"]', '["id","id"]', '[null]', "id1,id2", '["Cobra Pro"]'])("rejects non-explicit/unsafe product JSON %s", value => {
    expect(() => readKiwifyConfiguration({ ...env, KIWIFY_COBRAPRO_PRODUCT_IDS: value })).toThrow("configuration");
  });

  it("explicit product allowlist is exact and not case/title/wildcard matching", () => {
    const client = createKiwifySalesClient({ configuration: config, fetch: transport() });
    expect(client.isProductAllowed("cobrapro-test")).toBe(true);
    for (const id of ["COBRAPRO-test", "other", "all", "CobraPro"]) expect(client.isProductAllowed(id)).toBe(false);
  });

  it.each(["https://evil.example", "../order", "order/other", "order\nheader", "", "x".repeat(256)])("unsafe order ID %s is rejected before OAuth", async id => {
    const fetchMock = transport();
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    await expect(client.getSale(id)).rejects.toMatchObject({ code: "invalid_id" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { expires_in: 0 }, { expires_in: -1 }, { expires_in: "3600" }, { expires_in: 1.5 },
    { expires_in: null }, { token_type: "Basic" }, { access_token: "secret\nheader" }, { access_token: "" },
  ])("rejects malformed OAuth %j", async patch => {
    const fetchMock = transport(json(oauth(patch)));
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { id: "wrong-order" }, { product: { product_id: "cobrapro-test" } },
    { customer: { Email: "user@test.example" } }, { customer: { email: "invalid" } },
    { status: "PAID" }, { data: sale(), id: undefined }, { product: null },
  ])("rejects invented wrappers/fields or mismatched sale %j", async patch => {
    const client = createKiwifySalesClient({ configuration: config, fetch: transport(json(oauth()), json(sale(patch))) });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("fails closed on network error and redacts original secrets", async () => {
    const client = createKiwifySalesClient({ configuration: config, fetch: transport(new Error("secret-test pii@example.com")) });
    const error = await client.getSale("order-test").catch(error => error);
    expect(error.message).toBe("Kiwify indisponível (unavailable).");
    expect(error).not.toHaveProperty("cause");
  });

  it("bounds headers declaring oversized bodies", async () => {
    const client = createKiwifySalesClient({ configuration: config, fetch: transport(json(oauth(), 200, { "content-length": "131073" })) });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "response_too_large" });
  });

  it("bounds streamed bodies without Content-Length", async () => {
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(131_073)); c.close(); } });
    const client = createKiwifySalesClient({ configuration: config, fetch: transport(new Response(stream)) });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "response_too_large" });
  });

  it("bounds timeout even when mocked fetch ignores AbortSignal", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock, timeoutMs: 5 });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "timeout" });
  });

  it("bounds timeout while receiving a stalled response body", async () => {
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"a":')); } });
    const client = createKiwifySalesClient({ configuration: config, fetch: transport(new Response(stream)), timeoutMs: 5 });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "timeout" });
  });

  it("rejects invalid JSON without leaking raw response", async () => {
    const client = createKiwifySalesClient({ configuration: config, fetch: transport(new Response("private@example.com")) });
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("enforces 100 calls/minute locally without caching sales and resets after window", async () => {
    let current = 1_000_000;
    const fetchMock = vi.fn(async (url: string) => url.endsWith("/oauth/token") ? json(oauth()) : json(sale())) as unknown as typeof fetch;
    const client = createKiwifySalesClient({ configuration: config, fetch: fetchMock, now: () => current });
    for (let i = 0; i < 99; i++) await client.getSale("order-test");
    await expect(client.getSale("order-test")).rejects.toMatchObject({ code: "rate_limited" });
    expect(vi.mocked(fetchMock)).toHaveBeenCalledTimes(100);
    current += 60_000;
    await client.getSale("order-test");
    expect(vi.mocked(fetchMock)).toHaveBeenCalledTimes(101);
  });

  it("normalizes email case only, never aliases another account", () => {
    expect(normalizeKiwifyEmail("  USER@Test.Example ")).toBe("user@test.example");
    expect(normalizeKiwifyEmail("user+other@test.example")).toBe("user+other@test.example");
    expect(normalizeKiwifyEmail(null)).toBeNull();
  });
});
