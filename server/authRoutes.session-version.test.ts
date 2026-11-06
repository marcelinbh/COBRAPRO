import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerAuthRoutes } from "./authRoutes";
const mocks = vi.hoisted(() => ({
  client: vi.fn(), compare: vi.fn(), sign: vi.fn(),
  env: { enableSessionRevocation: true, appId: "cobrapro-test" },
}));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./db", () => ({ getDb: vi.fn().mockResolvedValue(null), getSupabaseClientAsync: mocks.client }));
vi.mock("./_core/sdk", () => ({ sdk: { signSession: mocks.sign } }));
vi.mock("./loginLogger", () => ({ registrarLoginLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare } }));

function harness(version: unknown) {
  const state = { version };
  const read = vi.fn(async () => ({ data: { id: 8, openId: "local_test", name: "Teste", email: "teste@example.test", passwordHash: "hash", session_version: state.version }, error: null }));
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: read }) }) }), update: () => ({ eq: async () => ({ error: null }) }) }));
  mocks.client.mockResolvedValue({ from });
  const app = { post: vi.fn(), get: vi.fn() };
  registerAuthRoutes(app as any);
  const handler = app.post.mock.calls.find(([path]) => path === "/api/auth/login")!.at(-1);
  const run = async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn(), setHeader: vi.fn() };
    await handler({ body: { email: "teste@example.test", password: "senha-teste" }, protocol: "https", headers: {}, header: () => undefined, socket: { remoteAddress: crypto.randomUUID() } }, res);
    return res;
  };
  return { run, read, state };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.enableSessionRevocation = true;
  mocks.compare.mockResolvedValue(true);
  mocks.sign.mockResolvedValue("jwt-sintetico");
});
describe("snapshot de versão no login HTTP", () => {
  it("não relê a versão após comparar a senha antiga", async () => {
    const h = harness(0);
    mocks.compare.mockImplementation(async () => { h.state.version = 1; return true; });
    const res = await h.run();
    expect(mocks.sign).toHaveBeenCalledWith({ openId: "local_test", appId: "cobrapro-test", name: "Teste", sessionVersion: 0 }, expect.anything());
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, null, "0", -1, 1.5])("coluna ausente/inválida não vira zero: %s", async (version) => {
    const h = harness(version);
    const res = await h.run();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mocks.compare).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
