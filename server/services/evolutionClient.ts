import { ENV } from "../_core/env";

export type EvolutionState = "open" | "connecting" | "close" | "missing" | "unavailable" | "unauthorized" | "error";

export type EvolutionResult<T = Record<string, unknown>> = {
  ok: boolean;
  httpStatus?: number;
  state?: EvolutionState;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
};

export type EvolutionConnectionSnapshot = {
  instanceName: string;
  state: EvolutionState;
  connected: boolean;
  configured: boolean;
  qrCode: string | null;
  errorCode?: string;
  errorMessage?: string;
};

const REQUEST_TIMEOUT_MS = 12_000;

function getConfig() {
  const url = ENV.evolutionApiUrl.replace(/\/$/, "");
  const apiKey = ENV.evolutionApiKey;
  if (!url || !apiKey) throw new Error("Integração Evolution API não configurada. Verifique os segredos do ambiente.");
  return { url, apiKey };
}

export function instanceNameForUser(userId: number): string {
  return `user-${userId}`;
}

export function normalizarTelefoneWhatsApp(telefone: string): string {
  let digits = telefone.replace(/\D/g, "").replace(/^55(?=55)/, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 13) throw new Error("Número de WhatsApp brasileiro inválido");
  return digits;
}

function extractProviderError(value: unknown): { code?: string; message?: string } {
  if (!value || typeof value !== "object") return {};
  const body = value as Record<string, unknown>;
  const message = [body.message, body.error, body.response?.toString()].find(v => typeof v === "string") as string | undefined;
  const code = [body.code, body.statusCode, body.status].find(v => typeof v === "string" || typeof v === "number");
  return { code: code ? String(code) : undefined, message };
}

function normalizarEstado(value: unknown, httpStatus?: number): EvolutionState {
  if (httpStatus === 401 || httpStatus === 403) return "unauthorized";
  if (httpStatus === 404) return "missing";
  const raw = String((value as any)?.instance?.state ?? (value as any)?.state ?? "").toLowerCase();
  if (raw === "open") return "open";
  if (["connecting", "qrcode", "qr", "pairing"].includes(raw)) return "connecting";
  if (["close", "closed", "disconnected"].includes(raw)) return "close";
  return httpStatus && httpStatus >= 500 ? "unavailable" : "missing";
}

async function request<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<EvolutionResult<T>> {
  let config: { url: string; apiKey: string };
  try {
    config = getConfig();
  } catch (error) {
    return { ok: false, state: "unavailable", errorCode: "CONFIG", errorMessage: error instanceof Error ? error.message : "Evolution API não configurada" };
  }

  try {
    const response = await fetch(`${config.url}${path}`, {
      method,
      headers: { "Content-Type": "application/json", apikey: config.apiKey },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const raw = await response.text();
    let data: T | Record<string, unknown> = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 300) }; }
    const providerError = extractProviderError(data);
    const state = normalizarEstado(data, response.status);
    if (!response.ok || providerError.code === "error") {
      return {
        ok: false,
        httpStatus: response.status,
        state,
        data: data as T,
        errorCode: providerError.code ?? `HTTP_${response.status}`,
        errorMessage: providerError.message ?? "Falha na Evolution API",
      };
    }
    return { ok: true, httpStatus: response.status, state, data: data as T };
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    return {
      ok: false,
      state: "unavailable",
      errorCode: timeout ? "TIMEOUT" : "NETWORK",
      errorMessage: timeout ? "A Evolution API demorou para responder" : "Não foi possível conectar à Evolution API",
    };
  }
}

function qrFrom(data: any): string | null {
  return data?.base64 ?? data?.qrcode?.base64 ?? data?.qrcode ?? data?.qrCode ?? null;
}

export async function getConnectionSnapshot(userId: number): Promise<EvolutionConnectionSnapshot> {
  const instanceName = instanceNameForUser(userId);
  const response = await request("GET", `/instance/connectionState/${encodeURIComponent(instanceName)}`);
  const state = response.ok ? normalizarEstado(response.data, response.httpStatus) : (response.state ?? "error");
  return {
    instanceName,
    state,
    connected: state === "open",
    configured: response.errorCode !== "CONFIG",
    qrCode: null,
    errorCode: response.errorCode,
    errorMessage: response.errorMessage,
  };
}

/** Cria somente a instância inexistente; nunca apaga uma sessão em conexão. */
export async function ensureConnection(userId: number): Promise<EvolutionConnectionSnapshot> {
  const existing = await getConnectionSnapshot(userId);
  if (existing.state === "open" || existing.state === "unavailable" || existing.state === "unauthorized") return existing;
  // A sessão de pareamento já existe: solicitar apenas um QR renovado, sem recriá-la.
  if (existing.state === "connecting") {
    const refreshed = await request<any>("GET", `/instance/connect/${encodeURIComponent(existing.instanceName)}`);
    if (!refreshed.ok) return { ...existing, errorCode: refreshed.errorCode, errorMessage: refreshed.errorMessage };
    return { ...existing, qrCode: qrFrom(refreshed.data) };
  }

  const created = await request<any>("POST", "/instance/create", {
    instanceName: existing.instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  });
  if (!created.ok && created.httpStatus !== 409) {
    return { ...existing, state: created.state ?? "error", errorCode: created.errorCode, errorMessage: created.errorMessage };
  }

  const qrCode = created.ok ? qrFrom(created.data) : null;
  if (qrCode) return { ...existing, state: "connecting", qrCode, configured: true };

  const connected = await request<any>("GET", `/instance/connect/${encodeURIComponent(existing.instanceName)}`);
  if (!connected.ok) {
    return { ...existing, state: connected.state ?? "error", errorCode: connected.errorCode, errorMessage: connected.errorMessage };
  }
  return { ...existing, state: "connecting", qrCode: qrFrom(connected.data), configured: true };
}

export async function disconnectInstance(userId: number): Promise<EvolutionResult> {
  return request("DELETE", `/instance/logout/${encodeURIComponent(instanceNameForUser(userId))}`);
}

export async function deleteInstance(userId: number): Promise<EvolutionResult> {
  return request("DELETE", `/instance/delete/${encodeURIComponent(instanceNameForUser(userId))}`);
}

export async function enviarMensagemEvolution(userId: number, telefone: string, mensagem: string): Promise<{ ok: boolean; providerMessageId?: string; erro?: string; erroCodigo?: string }> {
  let number: string;
  try { number = normalizarTelefoneWhatsApp(telefone); } catch (error) {
    return { ok: false, erroCodigo: "INVALID_PHONE", erro: error instanceof Error ? error.message : "Número inválido" };
  }
  const status = await getConnectionSnapshot(userId);
  if (!status.connected) return { ok: false, erroCodigo: status.errorCode ?? "DISCONNECTED", erro: status.errorMessage ?? "WhatsApp desconectado" };

  const response = await request<any>("POST", `/message/sendText/${encodeURIComponent(status.instanceName)}`, {
    number,
    textMessage: { text: mensagem.slice(0, 4_000) },
  });
  if (!response.ok) return { ok: false, erroCodigo: response.errorCode, erro: response.errorMessage ?? "Falha no envio pela Evolution API" };
  const data: any = response.data;
  return { ok: true, providerMessageId: data?.key?.id ?? data?.message?.key?.id ?? data?.id };
}
