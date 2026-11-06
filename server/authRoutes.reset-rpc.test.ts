import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerAuthRoutes } from "./authRoutes";
import { hashTokenDeRecuperacao } from "./authRoutes";
const mocks = vi.hoisted(() => ({
  client: vi.fn(), db: vi.fn(), hash: vi.fn(),
  env: { enableSessionRevocation: true },
}));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./db", () => ({ getDb: mocks.db, getSupabaseClientAsync: mocks.client }));
vi.mock("./_core/sdk", () => ({ sdk: {} }));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));
function harness(data: unknown = [{ user_id: 3, session_version: 1 }], error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const from = vi.fn();
  mocks.client.mockResolvedValue({ rpc, from });
  const app = { post: vi.fn(), get: vi.fn() };
  registerAuthRoutes(app as any);
  const handler = app.post.mock.calls.find(([path]) => path === "/api/auth/reset-password")!.at(-1);
  const run = async (body: unknown = { token: "token-sintetico", password: "nova-senha-sintetica" }) => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn() };
    await handler({ body, headers: {} }, res);
    return res;
  };
  return { run, rpc, from };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.enableSessionRevocation = true;
  mocks.hash.mockResolvedValue("bcrypt-hash-sintetica-para-teste");
});
describe("reset HTTP no modo versionado", () => {
  it("somente a RPC altera senha/consumo/versão sem criar sessão", async () => {
    const h = harness();
    const res = await h.run();
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith("consume_password_reset_and_revoke_sessions", {
      p_token_hash: hashTokenDeRecuperacao("token-sintetico"), p_password_hash: "bcrypt-hash-sintetica-para-teste",
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Senha alterada com sucesso!" });
    expect(h.from).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });
  it("token usado ou expirado retorna 400 sem fallback", async () => {
    const h = harness([]);
    expect((await h.run()).status).toHaveBeenCalledWith(400);
    expect(h.from).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each([[null, { code: "PGRST202", message: "rpc ausente" }], [null, { code: "42501" }], [null, null], [[{ user_id: 3 }], null]])("falha fechada em RPC ausente, sem permissão ou malformada", async (data, error) => {
    const h = harness(data, error);
    expect((await h.run()).status).toHaveBeenCalledWith(500);
    expect(h.from).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("cliente ausente não cai no caminho Drizzle", async () => {
    const h = harness();
    mocks.client.mockResolvedValue(null);
    expect((await h.run()).status).toHaveBeenCalledWith(500);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each([{ token: {}, password: "senha-longa" }, { token: "token", password: [] }, { token: "x".repeat(513), password: "senha-longa" }])("não faz hash/consulta de entrada não textual ou excessiva", async (body) => {
    const h = harness();
    expect((await h.run(body)).status).toHaveBeenCalledWith(400);
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
