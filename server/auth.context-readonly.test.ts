import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt, jwtVerify, SignJWT } from "jose";
import { COOKIE_NAME } from "../shared/const";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  upsert: vi.fn(),
  oauthPost: vi.fn(),
  env: {
    appId: "auth-readonly-offline-app",
    cookieSecret: "synthetic-auth-readonly-fixture-secret-not-for-deployment",
    oAuthServerUrl: "https://oauth.invalid",
    ownerOpenId: "local_auth_readonly_owner_7",
    enableSessionRevocation: true,
  },
}));

// These paths match the real SDK imports; neither the DB nor ENV module executes.
vi.mock("./db", () => ({
  getUserByOpenId: mocks.lookup,
  upsertUser: mocks.upsert,
}));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
// Keep the real OAuth method, but replace its entire network boundary.
vi.mock("axios", () => ({
  default: { create: vi.fn(() => ({ post: mocks.oauthPost })) },
}));

import { sdk } from "./_core/sdk";
import { createContext } from "./_core/context";

const payload = {
  openId: "local_auth_readonly_owner_7",
  appId: "auth-readonly-offline-app",
  name: "Synthetic owner 7",
  sessionVersion: 3,
};
function snapshot() {
  return Object.freeze({
    id: 7,
    openId: payload.openId,
    name: payload.name,
    email: "owner7@example.test",
    loginMethod: "email",
    role: "user" as const,
    session_version: 3,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-02T00:00:00Z"),
    lastSignedIn: new Date("2025-01-03T00:00:00Z"),
  });
}
function request(token?: string) {
  return {
    headers: token ? { cookie: `${COOKIE_NAME}=${token}` } : {},
  } as Parameters<typeof sdk.authenticateRequest>[0];
}
function options(token?: string) {
  return { req: request(token), res: {} } as Parameters<typeof createContext>[0];
}
async function signedToken() {
  return sdk.signSession(payload);
}
async function rawToken(changes: Record<string, unknown> = {}, wrongSecret = false) {
  return new SignJWT({ ...payload, ...changes })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(wrongSecret ? "different-synthetic-fixture-secret" : mocks.env.cookieSecret));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
// After lookup is reached JOSE has completed: only SDK/context microtasks remain.
async function drainAfterLookup() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
function noWriteOrOAuth() {
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.oauthPost).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.enableSessionRevocation = true;
  mocks.lookup.mockResolvedValue(snapshot());
  mocks.upsert.mockImplementation(async () => { throw new Error("synthetic telemetry write unavailable"); });
  mocks.oauthPost.mockImplementation(async () => { throw new Error("unexpected OAuth call: offline fixture"); });
});
afterEach(() => { vi.restoreAllMocks(); });

describe("existing APP session context is read-only", () => {
  it("real SDK accepts the exact read snapshot without invoking a rejecting telemetry upsert", async () => {
    const user = snapshot();
    mocks.lookup.mockResolvedValue(user);
    const token = await signedToken();
    expect(decodeJwt(token).sessionVersion).toBe(3);
    const verified = await jwtVerify(token, new TextEncoder().encode(mocks.env.cookieSecret), { algorithms: ["HS256"] });
    expect(verified.payload.openId).toBe(user.openId);
    expect(await sdk.authenticateRequest(request(token))).toBe(user);
    expect(mocks.lookup.mock.calls).toEqual([[user.openId]]);
    noWriteOrOAuth();
  });

  it("real createContext retains user instead of swallowing a telemetry failure as anonymous", async () => {
    const user = snapshot();
    mocks.lookup.mockResolvedValue(user);
    const opts = options(await signedToken());
    const ctx = await createContext(opts);
    expect(ctx.user).toBe(user);
    expect(ctx.req).toBe(opts.req);
    expect(ctx.res).toBe(opts.res);
    noWriteOrOAuth();
  });

  it.each(["SDK", "context"] as const)("%s returns user while the unused upsert remains deferred", async mode => {
    const user = snapshot();
    const readReached = deferred<void>();
    const telemetry = deferred<void>();
    mocks.lookup.mockImplementation(async () => { readReached.resolve(undefined); return user; });
    mocks.upsert.mockReturnValue(telemetry.promise);
    const token = await signedToken();
    let settled = false;
    let observed: unknown;
    const work = (mode === "SDK" ? sdk.authenticateRequest(request(token)) : createContext(options(token)))
      .then(result => { observed = mode === "SDK" ? result : (result as Awaited<ReturnType<typeof createContext>>).user; settled = true; });
    await readReached.promise;
    await drainAfterLookup();
    try {
      expect.soft(mocks.upsert).not.toHaveBeenCalled();
      expect.soft(settled).toBe(true);
      expect.soft(observed).toBe(user);
      expect(mocks.oauthPost).not.toHaveBeenCalled();
    } finally {
      // Release the baseline's erroneous await too; leave no unfinished work.
      telemetry.resolve(undefined);
      await work;
    }
  });

  it("does not clone, elevate owner role, or mutate the frozen user snapshot", async () => {
    const user = snapshot();
    const before = { ...user };
    mocks.lookup.mockResolvedValue(user);
    mocks.upsert.mockResolvedValue(undefined);
    const ctx = await createContext(options(await signedToken()));
    expect(ctx.user).toBe(user);
    expect(user).toEqual(before);
    expect(user.role).toBe("user");
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
    noWriteOrOAuth();
  });

  it.each(["SDK", "context"] as const)("flag off: valid existing session also makes zero writes in %s", async mode => {
    mocks.env.enableSessionRevocation = false;
    const user = snapshot();
    mocks.lookup.mockResolvedValue(user);
    const { sessionVersion: _, ...legacy } = payload;
    const token = await sdk.signSession(legacy);
    expect(decodeJwt(token)).not.toHaveProperty("sessionVersion");
    const result = mode === "SDK" ? await sdk.authenticateRequest(request(token)) : (await createContext(options(token))).user;
    expect(result).toBe(user);
    noWriteOrOAuth();
  });
});

describe("authentication guards remain fail-closed without writes", () => {
  const invalidCases = [
    { name: "invalid signature", wrongSecret: true, reads: false },
    { name: "foreign appId", claims: { appId: "another-offline-app" }, reads: false },
    { name: "missing appId", claims: { appId: undefined }, reads: false },
    { name: "missing identity", claims: { openId: undefined }, reads: false },
    { name: "empty identity", claims: { openId: "" }, reads: false },
    { name: "missing name", claims: { name: undefined }, reads: false },
    { name: "missing version claim", claims: { sessionVersion: undefined }, reads: false },
    { name: "null version claim", claims: { sessionVersion: null }, reads: false },
    { name: "string version claim", claims: { sessionVersion: "3" }, reads: false },
    { name: "negative version claim", claims: { sessionVersion: -1 }, reads: false },
    { name: "fractional version claim", claims: { sessionVersion: 0.5 }, reads: false },
    { name: "cron identity under APP revocation guards", claims: { openId: "cron_offline_forbidden" }, reads: false },
    { name: "identity differs from DB snapshot", row: { ...snapshot(), openId: "local_other_synthetic_identity" }, reads: true },
    { name: "revoked version", row: { ...snapshot(), session_version: 4 }, reads: true },
    { name: "missing DB version", row: { ...snapshot(), session_version: undefined }, reads: true },
    { name: "invalid DB version", row: { ...snapshot(), session_version: "3" }, reads: true },
    { name: "conflicting DB versions", row: { ...snapshot(), sessionVersion: 4 }, reads: true },
    { name: "missing user with flag on", row: null, reads: true },
    { name: "lookup failure", lookupError: true, reads: true },
  ];
  it.each(invalidCases)("$name: SDK rejects and context is anonymous; no upsert or OAuth", async entry => {
    if ("row" in entry) mocks.lookup.mockResolvedValue(entry.row);
    if ("lookupError" in entry) mocks.lookup.mockRejectedValue(new Error("synthetic lookup unavailable"));
    const token = await rawToken("claims" in entry ? entry.claims : {}, "wrongSecret" in entry && entry.wrongSecret);
    await expect(sdk.authenticateRequest(request(token))).rejects.toThrow();
    expect((await createContext(options(token))).user).toBeNull();
    expect(mocks.lookup).toHaveBeenCalledTimes(entry.reads ? 2 : 0);
    noWriteOrOAuth();
  });
  it("missing cookie rejects before DB lookup or OAuth", async () => {
    await expect(sdk.authenticateRequest(request())).rejects.toThrow("Invalid session cookie");
    expect((await createContext(options())).user).toBeNull();
    expect(mocks.lookup).not.toHaveBeenCalled();
    noWriteOrOAuth();
  });
  it.each([
    { appId: "another-offline-app" },
    { sessionVersion: undefined },
    { sessionVersion: -1 },
    { openId: "cron_offline_forbidden" },
  ])("real signer preserves its versioned-session guards: %j", async changes => {
    await expect(sdk.signSession({ ...payload, ...changes })).rejects.toThrow("Emissão de sessão versionada inválida");
    expect(mocks.lookup).not.toHaveBeenCalled();
    noWriteOrOAuth();
  });
});

describe("flag-off missing-user OAuth creation remains necessary and awaited", () => {
  const oauthUser = {
    openId: payload.openId,
    name: payload.name,
    email: "owner7@example.test",
    platforms: ["REGISTERED_PLATFORM_EMAIL"],
  };
  it.each(["SDK", "context"] as const)("%s uses exactly one creation upsert and then rereads the persisted snapshot", async mode => {
    mocks.env.enableSessionRevocation = false;
    const user = snapshot();
    const events: string[] = [];
    mocks.lookup.mockImplementation(async () => { events.push(events.length ? "reread" : "lookup"); return events.length === 1 ? null : user; });
    mocks.oauthPost.mockImplementation(async () => { events.push("OAuth"); return { data: oauthUser }; });
    mocks.upsert.mockImplementation(async () => { events.push("creation"); });
    const token = await signedToken();
    const result = mode === "SDK" ? await sdk.authenticateRequest(request(token)) : (await createContext(options(token))).user;
    expect(result).toBe(user);
    expect(events).toEqual(["lookup", "OAuth", "creation", "reread"]);
    expect(mocks.lookup.mock.calls).toEqual([[payload.openId], [payload.openId]]);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith({
      openId: oauthUser.openId,
      name: oauthUser.name,
      email: oauthUser.email,
      loginMethod: "email",
      lastSignedIn: expect.any(Date),
    });
    expect(mocks.oauthPost).toHaveBeenCalledTimes(1);
    expect(mocks.oauthPost).toHaveBeenCalledWith(
      "/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt",
      { jwtToken: token, projectId: payload.appId },
    );
    expect(user.role).toBe("user");
  });

  it("does not reread or settle context before the required OAuth creation finishes", async () => {
    mocks.env.enableSessionRevocation = false;
    const user = snapshot();
    const creationReached = deferred<void>();
    const creation = deferred<void>();
    mocks.lookup.mockResolvedValueOnce(null).mockResolvedValue(user);
    mocks.oauthPost.mockResolvedValue({ data: oauthUser });
    mocks.upsert.mockImplementation(() => { creationReached.resolve(undefined); return creation.promise; });
    let settled = false;
    const work = createContext(options(await signedToken())).then(ctx => { settled = true; return ctx; });
    await creationReached.promise;
    await drainAfterLookup();
    try {
      expect(settled).toBe(false);
      expect(mocks.lookup).toHaveBeenCalledTimes(1);
      expect(mocks.upsert).toHaveBeenCalledTimes(1);
    } finally { creation.resolve(undefined); }
    expect((await work).user).toBe(user);
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });
});
