import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarEmail, gerarHtmlComprovante, gerarHtmlLembreteVencimento } from "./email";
import { runBrevoDiagnostic } from "../../scripts/test-brevo.mjs";

const apiKey = "xkeysib-chave-confidencial-de-teste";
const providerToken = "token-confidencial-do-provedor";
const params = {
  to: "cliente-privado@exemplo.test",
  toName: "Cliente Confidencial",
  subject: "Assunto Confidencial",
  htmlContent: "<p>Conteúdo privado e token-do-cliente</p>",
};
const sensitiveValues = [apiKey, apiKey.slice(0, 12), providerToken, ...Object.values(params)];
const providerPayload = sensitiveValues.join(" | ");

/** Qualquer tentativa de ler o corpo falha, além de deixar uma asserção explícita. */
function responseWithoutBody(status: number) {
  const fail = () => { throw new Error(providerPayload); };
  const readers = ["json", "text", "arrayBuffer", "blob", "formData", "bytes"]
    .map((name) => [name, vi.fn(fail)] as const);
  const body = vi.fn(fail);
  const response = Object.defineProperty({ status, ...Object.fromEntries(readers) }, "body", {
    get: body,
  }) as unknown as Response;
  return { response, readers: [...readers.map(([, reader]) => reader), body] };
}

function expectBodyUnread(mock: ReturnType<typeof responseWithoutBody>) {
  for (const reader of mock.readers) expect(reader).not.toHaveBeenCalled();
}

/** Node usa timers internos em AbortSignal.timeout: conectar a fake timers é necessário. */
function useFakeAbortTimeout() {
  vi.useFakeTimers();
  return vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Prazo excedido", "TimeoutError")), ms);
    return controller.signal;
  });
}

/** O fetch só termina ao receber o abort real do signal, não por rejeição instantânea. */
function pendingFetchUntilAbort() {
  return vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) throw new Error("Fetch deveria receber um AbortSignal");
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
}

let consoleSpies: ReturnType<typeof vi.spyOn>[];
beforeEach(() => {
  vi.stubEnv("BREVO_API_KEY", apiKey);
  consoleSpies = ["log", "warn", "error", "info", "debug", "trace", "dir", "table"]
    .map((method) => vi.spyOn(console, method as "log").mockImplementation(() => undefined));
});

afterEach(() => {
  try {
    const logs = consoleSpies.flatMap((spy) => spy.mock.calls.map((args) =>
      args.map((arg) => typeof arg === "string" ? arg : JSON.stringify(arg)).join(" "),
    )).join("\n");
    for (const sensitive of sensitiveValues) expect(logs).not.toContain(sensitive);
  } finally {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

describe("cliente Brevo seguro", () => {
  it("falha sem rede quando a configuração está ausente", async () => {
    vi.stubEnv("BREVO_API_KEY", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(enviarEmail(params)).resolves.toEqual({
      accepted: false, kind: "configuration", retryEligible: false, deliveryKnown: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([200, 201, 202, 204, 299])("aceita HTTP %i sem ler corpo ou repetir POST", async (status) => {
    const response = responseWithoutBody(status);
    const fetchMock = vi.fn().mockResolvedValue(response.response);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", fetchMock);

    await expect(enviarEmail(params)).resolves.toEqual({
      accepted: true, kind: "accepted", httpStatus: status, retryEligible: false, deliveryKnown: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", expect.objectContaining({
      method: "POST",
      signal: expect.any(AbortSignal),
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toEqual([{ email: params.to, name: params.toName }]);
    expect(timeout.mock.calls).toEqual([[10_000]]);
    expectBodyUnread(response);
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    { status: 400, kind: "rejected", retryEligible: false },
    { status: 401, kind: "rejected", retryEligible: false },
    { status: 403, kind: "rejected", retryEligible: false },
    { status: 422, kind: "rejected", retryEligible: false },
    { status: 408, kind: "transient_provider", retryEligible: true },
    { status: 429, kind: "throttled", retryEligible: true },
    { status: 500, kind: "transient_provider", retryEligible: true },
    { status: 502, kind: "transient_provider", retryEligible: true },
    { status: 503, kind: "transient_provider", retryEligible: true },
    { status: 504, kind: "transient_provider", retryEligible: true },
  ])("classifica HTTP $status sem ler corpo, vazar dados ou retry implícito", async ({ status, kind, retryEligible }) => {
    const response = responseWithoutBody(status);
    const fetchMock = vi.fn().mockResolvedValue(response.response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(enviarEmail(params)).resolves.toEqual({
      accepted: false, kind, httpStatus: status, retryEligible, deliveryKnown: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectBodyUnread(response);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(`[Email] Entrega não aceita: kind=${kind} status=${status}`);
  });

  it.each([
    new Error(providerPayload),
    new DOMException(providerPayload, "AbortError"),
    new DOMException(providerPayload, "TimeoutError"),
  ])("trata exceção como entrega indeterminada sem registrar mensagem ou repetir POST", async (error) => {
    const fetchMock = vi.fn().mockRejectedValue(error);
    vi.stubGlobal("fetch", fetchMock);

    await expect(enviarEmail(params)).resolves.toEqual({
      accepted: false, kind: "delivery_unknown", retryEligible: false, deliveryKnown: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("aborta efetivamente o fetch aos 10 segundos e não repete o POST", async () => {
    const timeout = useFakeAbortTimeout();
    const fetchMock = pendingFetchUntilAbort();
    vi.stubGlobal("fetch", fetchMock);
    let settled = false;
    const delivery = enviarEmail(params).then((result) => { settled = true; return result; });
    const signal = fetchMock.mock.calls[0][1]?.signal;

    expect(timeout.mock.calls).toEqual([[10_000]]);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe(false);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    await expect(delivery).resolves.toEqual({
      accepted: false, kind: "delivery_unknown", retryEligible: false, deliveryKnown: false,
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith("[Email] Entrega indeterminada: kind=timeout");
  });
});

describe("templates reutilizáveis", () => {
  const unsafe = `<script>alert("x")</script><img src=x onerror='alert(1)'>&`;
  const escaped = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;img src=x onerror=&#39;alert(1)&#39;&gt;&amp;";

  it("escapa nomes e datas no comprovante, inclusive aspas e ampersand", () => {
    const html = gerarHtmlComprovante({
      clienteNome: unsafe, numeroParcela: 1, numeroParcelas: 2,
      valorOriginal: 10, valorJuros: 1, valorMulta: 2, valorDesconto: 3, valorTotal: 10,
      dataPagamento: unsafe,
    });
    expect(html).not.toContain(unsafe);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain(`<strong>Cliente:</strong> ${escaped}`);
    expect(html).toContain(`<strong>Data de Pagamento:</strong> ${escaped}`);
    expect(html).toContain("Total Pago: R$ 10.00");
  });

  it("escapa nomes e datas no lembrete, inclusive aspas e ampersand", () => {
    const html = gerarHtmlLembreteVencimento({
      clienteNome: unsafe, numeroParcela: 1, numeroParcelas: 2,
      valor: 10, dataVencimento: unsafe, diasParaVencer: 1,
    });
    expect(html).not.toContain(unsafe);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain(`<strong>Cliente:</strong> ${escaped}`);
    expect(html).toContain(`<strong>Vencimento:</strong> ${escaped}`);
  });

  it.each([
    { dias: 0, titulo: "VENCE HOJE" },
    { dias: 1, titulo: "VENCE AMANHÃ" },
    { dias: 2, titulo: "VENCE EM 2 DIAS" },
  ])("usa $titulo quando faltam $dias dias", ({ dias, titulo }) => {
    const html = gerarHtmlLembreteVencimento({
      clienteNome: "Cliente", numeroParcela: 1, numeroParcelas: 2,
      valor: 10, dataVencimento: "07/11/2026", diasParaVencer: dias,
    });
    expect(html).toContain(`<strong>${titulo}</strong>`);
    if (dias === 1) expect(html).not.toContain("VENCE HOJE");
  });
});

describe("diagnóstico Brevo sem chamadas live", () => {
  const env = { BREVO_API_KEY: apiKey, BREVO_TEST_TO: params.to };

  it("importar o script não inicia fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await import("../../scripts/test-brevo.mjs");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("por padrão consulta apenas /account, mesmo com BREVO_TEST_TO configurada", async () => {
    const response = responseWithoutBody(200);
    const fetchMock = vi.fn().mockResolvedValue(response.response);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await expect(runBrevoDiagnostic({ argv: [], env, fetchImpl: fetchMock })).resolves.toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/account", {
      method: "GET", headers: { "api-key": apiKey, Accept: "application/json" }, signal: expect.any(AbortSignal),
    });
    expect(timeout.mock.calls).toEqual([[10_000]]);
    expectBodyUnread(response);
  });

  it.each([
    { argv: [], env: {} },
    { argv: ["--send"], env: { BREVO_API_KEY: apiKey } },
    { argv: ["--send"], env: { BREVO_API_KEY: apiKey, BREVO_TEST_TO: "" } },
    { argv: ["--send"], env: { BREVO_API_KEY: apiKey, BREVO_TEST_TO: "   " } },
    { argv: ["--send"], env: { BREVO_API_KEY: apiKey, BREVO_TEST_TO: "inválido" } },
    { argv: ["--send"], env: { BREVO_API_KEY: apiKey, BREVO_TEST_TO: `${params.to},outro@exemplo.test` } },
    { argv: ["--argumento-inválido"], env },
  ])("rejeita configuração/argumentos inválidos antes de qualquer rede ($argv)", async (options) => {
    const fetchMock = vi.fn();
    await expect(runBrevoDiagnostic({ ...options, fetchImpl: fetchMock })).resolves.toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("--help não exige chave nem chama rede", async () => {
    const fetchMock = vi.fn();
    await expect(runBrevoDiagnostic({ argv: ["--help"], env: {}, fetchImpl: fetchMock })).resolves.toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500, 503])("HTTP %i em /account impede envio e não tem retry", async (status) => {
    const response = responseWithoutBody(status);
    const fetchMock = vi.fn().mockResolvedValue(response.response);
    await expect(runBrevoDiagnostic({ argv: ["--send"], env, fetchImpl: fetchMock })).resolves.toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectBodyUnread(response);
  });

  it.each([201, 202, 400, 429, 500, 503])("envia somente com opt-in e classifica HTTP %i sem ler corpo ou retry", async (status) => {
    const account = responseWithoutBody(200);
    const email = responseWithoutBody(status);
    const fetchMock = vi.fn().mockResolvedValueOnce(account.response).mockResolvedValueOnce(email.response);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await expect(runBrevoDiagnostic({ argv: ["--send"], env, fetchImpl: fetchMock })).resolves.toBe(status < 300 ? 0 : 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.brevo.com/v3/smtp/email");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", signal: expect.any(AbortSignal) });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).to).toEqual([{ email: params.to }]);
    expect(timeout.mock.calls).toEqual([[10_000], [10_000]]);
    expectBodyUnread(account);
    expectBodyUnread(email);
  });

  it("não registra a mensagem confidencial de erros de rede", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error(providerPayload));
    await expect(runBrevoDiagnostic({ argv: [], env, fetchImpl: fetchMock })).resolves.toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("aplica timeout efetivo sem retry ao diagnóstico (envio=%s)", async (shouldSend) => {
    const timeout = useFakeAbortTimeout();
    const account = responseWithoutBody(200);
    const pendingFetch = pendingFetchUntilAbort();
    const fetchMock = shouldSend ? vi.fn().mockResolvedValueOnce(account.response).mockImplementation(pendingFetch) : pendingFetch;
    let settled = false;
    const diagnostic = runBrevoDiagnostic({ argv: shouldSend ? ["--send"] : [], env, fetchImpl: fetchMock })
      .then((result: number) => { settled = true; return result; });
    // Permite a consulta de conta resolvida iniciar o POST antes de avançar os timers.
    await Promise.resolve();
    await Promise.resolve();
    const signal = pendingFetch.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    await expect(diagnostic).resolves.toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(shouldSend ? 2 : 1);
    expect(timeout.mock.calls).toEqual(shouldSend ? [[10_000], [10_000]] : [[10_000]]);
    expect(console.error).toHaveBeenCalledWith("Diagnóstico interrompido por timeout; não haverá retry automático.");
    expectBodyUnread(account);
  });
});
