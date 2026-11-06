import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt, SignJWT } from "jose";
import { COOKIE_NAME } from "../shared/const";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(), upsert: vi.fn(),
  env: { appId: "cobrapro-test", cookieSecret: "chave-sintetica-exclusiva-dos-testes", oAuthServerUrl: "https://auth.example.test", enableSessionRevocation: false },
}));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./db", () => ({ getUserByOpenId: mocks.lookup, upsertUser: mocks.upsert, getDb: vi.fn() }));
import { sdk } from "./_core/sdk";
import { createSessionForUser } from "./auth";

const payload = { openId: "local_teste", appId: "cobrapro-test", name: "Teste", sessionVersion: 0 };
const user = { id: 7, openId: payload.openId, name: "Teste", email: "teste@example.test", session_version: 0 };
function req(token: string) { return { headers: { cookie: `${COOKIE_NAME}=${token}` } } as any; }
async function rawToken(changes: Record<string, unknown>) {
  return new SignJWT({ ...payload, ...changes }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
    .sign(new TextEncoder().encode(mocks.env.cookieSecret));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.enableSessionRevocation = true;
  mocks.lookup.mockResolvedValue(user);
  mocks.upsert.mockResolvedValue(undefined);
});

describe("sessão versionada no SDK", () => {
  it("emite snapshot e autentica com igualdade estrita", async () => {
    const token = await sdk.signSession(payload);
    expect(decodeJwt(token).sessionVersion).toBe(0);
    expect(await sdk.authenticateRequest(req(token))).toEqual(user);
  });
  it("recusa sessão antiga após reset sem atualizar usuário", async () => {
    const token = await sdk.signSession(payload);
    mocks.lookup.mockResolvedValue({ ...user, session_version: 1 });
    await expect(sdk.authenticateRequest(req(token))).rejects.toThrow("Invalid session cookie");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("snapshot do login anterior ao reset não é elevado para versão nova", async () => {
    mocks.lookup.mockResolvedValue({ ...user, session_version: 2 });
    const token = await sdk.signSession(payload);
    expect(decodeJwt(token).sessionVersion).toBe(0);
    expect(mocks.lookup).not.toHaveBeenCalled();
    await expect(sdk.authenticateRequest(req(token))).rejects.toThrow();
  });
  it.each([undefined, null, "0", -1, 0.5])("rejeita claim inválida %s mesmo com assinatura válida", async (sessionVersion) => {
    expect(await sdk.verifySession(await rawToken({ sessionVersion }))).toBeNull();
  });
  it("signer não assina versão omitida", async () => {
    const { sessionVersion: _, ...without } = payload;
    await expect(sdk.signSession(without)).rejects.toThrow("Emissão de sessão versionada inválida");
  });
  it("não autentica banco com coluna ausente nem faz auto-sync", async () => {
    const token = await sdk.signSession(payload);
    const { session_version: _, ...without } = user;
    mocks.lookup.mockResolvedValue(without);
    await expect(sdk.authenticateRequest(req(token))).rejects.toThrow();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("não autentica usuário ausente nem faz auto-sync", async () => {
    mocks.lookup.mockResolvedValue(null);
    const token = await sdk.signSession(payload);
    await expect(sdk.authenticateRequest(req(token))).rejects.toThrow();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("não autentica banco indisponível", async () => {
    mocks.lookup.mockRejectedValue(new Error("indisponível"));
    await expect(sdk.authenticateRequest(req(await sdk.signSession(payload)))).rejects.toThrow();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("recusa identidade divergente e appId de outro aplicativo", async () => {
    mocks.lookup.mockResolvedValue({ ...user, openId: "outra-identidade" });
    await expect(sdk.authenticateRequest(req(await sdk.signSession(payload)))).rejects.toThrow();
    expect(await sdk.verifySession(await rawToken({ appId: "outro-app" }))).toBeNull();
  });
  it("prefixo cron não contorna as sessões humanas", async () => {
    expect(await sdk.verifySession(await rawToken({ openId: "cron_atalho" }))).toBeNull();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("OAuth autorizado obtém versão da identidade persistida", async () => {
    mocks.lookup.mockResolvedValue({ ...user, session_version: 3 });
    const token = await sdk.createSessionToken(user.openId, { name: "Teste" });
    expect(decodeJwt(token).sessionVersion).toBe(3);
    mocks.lookup.mockResolvedValue(null);
    await expect(sdk.createSessionToken(user.openId)).rejects.toThrow();
  });
  it("emissor alternativo auth.ts preserva versão do usuário autenticado", async () => {
    const cookie = vi.fn();
    const { session_version: _, ...drizzleUser } = user;
    await createSessionForUser({ ...drizzleUser, sessionVersion: 2 } as any, { protocol: "https", headers: {} } as any, { cookie } as any);
    expect(decodeJwt(cookie.mock.calls[0][1]).sessionVersion).toBe(2);
  });
  it("flag desligada mantém sessão legada sem consulta adicional de versão", async () => {
    mocks.env.enableSessionRevocation = false;
    const { sessionVersion: _, ...without } = payload;
    const token = await sdk.signSession(without);
    expect(await sdk.verifySession(token)).toEqual(without);
    expect(await sdk.createSessionToken(user.openId, { name: "Teste" })).toBeTruthy();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
});
