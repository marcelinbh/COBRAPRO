const API_ORIGIN = "https://public-api.kiwify.com";
const API_BASE = `${API_ORIGIN}/v1`;
const MAX_RESPONSE_BYTES = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;
const REQUESTS_PER_MINUTE = 100;

export type KiwifyFailureCode =
  | "configuration" | "invalid_id" | "unavailable" | "timeout"
  | "rate_limited" | "forbidden" | "unauthorized" | "not_found"
  | "invalid_response" | "response_too_large";

/** Never attach upstream bodies, URLs, credentials, emails or original causes. */
export class KiwifySalesError extends Error {
  constructor(public readonly code: KiwifyFailureCode) {
    super(`Kiwify indisponível (${code}).`);
    this.name = "KiwifySalesError";
  }
}

export type KiwifyConfiguration = Readonly<{
  clientId: string;
  clientSecret: string;
  accountId: string;
  productIds: readonly string[];
}>;

/** Exact server configuration contract; no alternate credentials or defaults. */
export const KIWIFY_CONFIGURATION_ENV_KEYS = [
  "KIWIFY_CLIENT_ID", "KIWIFY_CLIENT_SECRET", "KIWIFY_ACCOUNT_ID",
  "KIWIFY_COBRAPRO_PRODUCT_IDS",
] as const;

export function isKiwifyId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,255}$/.test(value);
}

export function normalizeKiwifyEmail(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 320) return null;
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function secret(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
    && value.length <= 4_096 && !/[\r\n\u0000]/.test(value);
}

function validateConfiguration(config: KiwifyConfiguration): KiwifyConfiguration {
  if (!config || !secret(config.clientId) || !secret(config.clientSecret)
    || !isKiwifyId(config.accountId) || !Array.isArray(config.productIds)
    || config.productIds.length < 1 || config.productIds.length > 100
    || !config.productIds.every(isKiwifyId)
    || new Set(config.productIds).size !== config.productIds.length) {
    throw new KiwifySalesError("configuration");
  }
  return Object.freeze({ ...config, productIds: Object.freeze([...config.productIds]) });
}

/** JSON array of explicit IDs only: no wildcard, title, CSV or implicit all-products. */
export function readKiwifyConfiguration(
  env: Record<string, string | undefined> = process.env,
): KiwifyConfiguration {
  let productIds: unknown;
  try { productIds = JSON.parse(env.KIWIFY_COBRAPRO_PRODUCT_IDS ?? ""); }
  catch { throw new KiwifySalesError("configuration"); }
  return validateConfiguration({
    clientId: env.KIWIFY_CLIENT_ID ?? "",
    clientSecret: env.KIWIFY_CLIENT_SECRET ?? "",
    accountId: env.KIWIFY_ACCOUNT_ID ?? "",
    productIds: productIds as string[],
  });
}

/** Minimal projection of the documented direct GET /sales/{id} response, not webhook. */
export type KiwifySale = Readonly<{
  id: string;
  productId: string;
  customerEmail: string;
  status: string;
}>;
export type KiwifySalesReader = {
  getSale: (orderId: string) => Promise<KiwifySale>;
  isProductAllowed: (productId: string) => boolean;
};
export type KiwifySalesClientOptions = {
  configuration?: KiwifyConfiguration;
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  timeoutMs?: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function projectSale(value: unknown, orderId: string): KiwifySale {
  if (!record(value) || value.id !== orderId || !record(value.product)
    || !isKiwifyId(value.product.id) || !record(value.customer)
    || typeof value.status !== "string" || !/^[a-z_]{1,64}$/.test(value.status)) {
    throw new KiwifySalesError("invalid_response");
  }
  const email = normalizeKiwifyEmail(value.customer.email);
  if (!email) throw new KiwifySalesError("invalid_response");
  return Object.freeze({ id: orderId, productId: value.product.id,
    customerEmail: email, status: value.status });
}

/** Only OAuth is cached/singleflight. Every getSale is a new bounded HTTPS request.
 * The local 100/min guard is per instance/process, not a distributed account quota.
 * Reuse ONE instance per account; parent needs a distributed limiter at scale.
 */
export function createKiwifySalesClient(options: KiwifySalesClientOptions = {}): KiwifySalesReader {
  const config = validateConfiguration(options.configuration ?? readKiwifyConfiguration(options.env));
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (typeof fetchImpl !== "function" || !Number.isInteger(timeoutMs)
    || timeoutMs < 1 || timeoutMs > 15_000) throw new KiwifySalesError("configuration");
  const products = new Set(config.productIds);
  let token: { value: string; usableUntil: number } | null = null;
  let tokenFlight: Promise<string> | null = null;
  let requestTimes: number[] = [];

  function budget(): void {
    const current = now();
    if (!Number.isFinite(current)) throw new KiwifySalesError("unavailable");
    requestTimes = requestTimes.filter(t => t > current - 60_000);
    if (requestTimes.length >= REQUESTS_PER_MINUTE) throw new KiwifySalesError("rate_limited");
    requestTimes.push(current);
  }

  async function requestJson(url: string, init: RequestInit): Promise<unknown> {
    budget();
    const controller = new AbortController();
    const streaming: { reader: ReadableStreamDefaultReader<Uint8Array> | null } = { reader: null };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new KiwifySalesError("timeout"));
      }, timeoutMs);
    });
    const operation = (async () => {
      const response = await fetchImpl(url, { ...init, redirect: "error", signal: controller.signal });
      if (controller.signal.aborted) {
        void response.body?.cancel().catch(() => undefined);
        throw new KiwifySalesError("timeout");
      }
      // Also reject a nonconforming injected transport returning a redirected response.
      if (response.redirected || (response.url && response.url !== url)) {
        throw new KiwifySalesError("invalid_response");
      }
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        const codes: Record<number, KiwifyFailureCode> = {
          401: "unauthorized", 403: "forbidden", 404: "not_found", 429: "rate_limited",
        };
        throw new KiwifySalesError(codes[response.status] ?? "unavailable");
      }
      const length = response.headers.get("content-length");
      if (length && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
        void response.body?.cancel().catch(() => undefined);
        throw new KiwifySalesError("response_too_large");
      }
      if (!response.body) throw new KiwifySalesError("invalid_response");
      const reader = response.body.getReader();
      streaming.reader = reader;
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES) throw new KiwifySalesError("response_too_large");
          chunks.push(value);
        }
      } catch (error) {
        void reader.cancel().catch(() => undefined);
        throw error;
      } finally { streaming.reader = null; reader.releaseLock(); }
      try { return JSON.parse(Buffer.concat(chunks, size).toString("utf8")) as unknown; }
      catch { throw new KiwifySalesError("invalid_response"); }
    })();
    try { return await Promise.race([operation, deadline]); }
    catch (error) {
      if (error instanceof KiwifySalesError) throw error;
      throw new KiwifySalesError(controller.signal.aborted ? "timeout" : "unavailable");
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      if (streaming.reader) void streaming.reader.cancel().catch(() => undefined);
    }
  }

  async function accessToken(): Promise<string> {
    if (token && now() < token.usableUntil) return token.value;
    if (tokenFlight) return tokenFlight;
    tokenFlight = (async () => {
      const startedAt = now();
      const data = await requestJson(`${API_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret }).toString(),
      });
      // Verified live on 2026-11-10: Kiwify returns scope as ["sales"].
      // Also preserve the documented space-delimited string contract.
      const scopes = record(data) && typeof data.scope === "string"
        ? data.scope.trim().split(/\s+/)
        : record(data) && Array.isArray(data.scope) ? data.scope : null;
      if (!record(data) || typeof data.access_token !== "string"
        || !/^[\x21-\x7E]{1,8192}$/.test(data.access_token)
        || typeof data.token_type !== "string" || data.token_type.toLowerCase() !== "bearer"
        || !scopes || !scopes.length || !scopes.every(s => typeof s === "string" && /^[a-z_]+$/.test(s))
        || !scopes.includes("sales")
        || typeof data.expires_in !== "number" || !Number.isSafeInteger(data.expires_in)
        || data.expires_in <= 0 || data.expires_in > Math.floor(Number.MAX_SAFE_INTEGER / 1000)) {
        throw new KiwifySalesError("invalid_response");
      }
      const ttlMs = data.expires_in * 1000;
      const usableUntil = startedAt + ttlMs - Math.min(30_000, ttlMs / 10);
      if (!Number.isSafeInteger(startedAt + ttlMs) || usableUntil <= now()) {
        throw new KiwifySalesError("invalid_response");
      }
      token = { value: data.access_token, usableUntil };
      return token.value;
    })();
    try { return await tokenFlight; }
    finally { tokenFlight = null; }
  }

  return {
    isProductAllowed: productId => products.has(productId),
    async getSale(orderId) {
      if (!isKiwifyId(orderId)) throw new KiwifySalesError("invalid_id");
      const bearer = await accessToken();
      try {
        const data = await requestJson(`${API_BASE}/sales/${encodeURIComponent(orderId)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${bearer}`, "x-kiwify-account-id": config.accountId,
            Accept: "application/json" },
        });
        return projectSale(data, orderId);
      } catch (error) {
        if (error instanceof KiwifySalesError && error.code === "unauthorized") token = null;
        throw error;
      }
    },
  };
}
