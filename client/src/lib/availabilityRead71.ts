/** Per-client read scheduling only. Never shares capability results or queues writers. */
export const availabilityRead71Paths = [
  "contasPagar.capacidadesCancelamentoPendente",
  "despesas49.capacidades",
  "despesas69.capacidades",
  "despesasRecorrencia68.listar",
] as const;
const paths = new Set<string>(availabilityRead71Paths);

export function isAvailabilityRead71Path(path: string): boolean {
  return paths.has(path);
}

function selected(input: RequestInfo | URL, init: RequestInit | undefined, base: URL): boolean {
  try {
    const request = input instanceof Request ? input : undefined;
    const method = init?.method ?? request?.method ?? "GET";
    if (typeof method !== "string" || method.toUpperCase() !== "GET") return false;
    const url = new URL(request ? request.url : input instanceof URL ? input.href : input as string, base);
    if (url.origin !== base.origin || url.searchParams.has("batch")) return false;
    const prefix = "/api/trpc/";
    return url.pathname.startsWith(prefix) && paths.has(url.pathname.slice(prefix.length));
  } catch { return false; } // Native fetch, not this classifier, validates malformed requests.
}

function effectiveSignal(input: RequestInfo | URL, init: RequestInit): AbortSignal | null | undefined {
  if (init.signal !== undefined) return init.signal; // Explicit null overrides Request.signal.
  return input instanceof Request ? input.signal : undefined;
}
function abortReason(signal: AbortSignal): unknown {
  return signal.reason !== undefined ? signal.reason : new DOMException("The operation was aborted.", "AbortError");
}

type Entry = {
  input: RequestInfo | URL;
  init: RequestInit;
  signal: AbortSignal | null | undefined;
  state: "queued" | "running" | "settled";
  resolve: (response: Response) => void;
  reject: (reason: unknown) => void;
  onAbort: () => void;
};

/**
 * One FIFO for the four exact same-origin, individual GETs. Other requests bypass it.
 * The caller owns Request bodies/headers while pending; do not mutate or consume them.
 * URL and init headers are snapshotted; Request is never cloned or its body read here.
 * Settlement means native fetch returned Response/headers, not body consumption or a
 * global SQL mutex. Native signals are preserved; abort never releases an active slot
 * before native fetch settles. No retry, deadline, confirmation cache or auth capture.
 */
export function createAvailabilityRead71Fetch(nativeFetch: typeof fetch, baseUrl: string | URL): typeof fetch {
  const base = new URL(baseUrl);
  const queue: Entry[] = [];
  let active = false;
  const cleanup = (entry: Entry) => {
    entry.state = "settled";
    entry.signal?.removeEventListener("abort", entry.onAbort);
  };
  function drain() {
    if (active) return;
    const entry = queue.shift();
    if (!entry) return;
    if (entry.signal?.aborted) {
      cleanup(entry); entry.reject(abortReason(entry.signal)); drain(); return;
    }
    active = true; entry.state = "running";
    // A synchronous native throw follows the same cleanup/finally path as rejection.
    void Promise.resolve().then(() => nativeFetch(entry.input, entry.init)).then(
      response => entry.resolve(response),
      error => entry.reject(error),
    ).finally(() => { cleanup(entry); active = false; drain(); });
  }
  return (input, init) => {
    const options: RequestInit = { ...init, credentials: "include" };
    if (!selected(input, options, base)) return nativeFetch(input, options);
    if (options.headers !== undefined) options.headers = new Headers(options.headers);
    const frozenInput = input instanceof URL ? new URL(input.href) : input;
    const signal = effectiveSignal(frozenInput, options);
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    return new Promise<Response>((resolve, reject) => {
      const entry: Entry = { input: frozenInput, init: options, signal, resolve, reject, state: "queued", onAbort() {
        if (entry.state !== "queued") return; // Native fetch handles running cancellation.
        const index = queue.indexOf(entry);
        if (index >= 0) queue.splice(index, 1);
        cleanup(entry); reject(signal ? abortReason(signal) : new DOMException("The operation was aborted.", "AbortError"));
      } };
      signal?.addEventListener("abort", entry.onAbort, { once: true });
      queue.push(entry);
      if (signal?.aborted) entry.onAbort();
      drain();
    });
  };
}
