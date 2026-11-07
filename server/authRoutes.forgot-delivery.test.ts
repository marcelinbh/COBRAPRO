import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerAuthRoutes } from "./authRoutes";

const mocks = vi.hoisted(() => ({ db: vi.fn(), email: vi.fn() }));
vi.mock("./db", () => ({ getDb: vi.fn().mockResolvedValue(null), getSupabaseClientAsync: mocks.db }));
vi.mock("./_core/email", () => ({ enviarEmail: mocks.email }));
vi.mock("./_core/sdk", () => ({ sdk: {} }));

const publicResponse = { success: true, message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve." };

function harness(user: unknown, insertError: unknown = null, updateError: unknown = null, columns = ["used"]) {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: updateError }) });
  const probe = vi.fn((column: string) => ({ limit: vi.fn().mockResolvedValue(columns.includes(column)
    ? { data: [], error: null } : { data: null, error: { code: "42703" } }) }));
  mocks.db.mockResolvedValue({ from: (table: string) => {
    if (table === "users") return { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: user, error: null }) }) }) }) };
    return { update, insert, select: probe };
  } });
  const app = { post: vi.fn(), get: vi.fn() };
  registerAuthRoutes(app as any);
  const handler = app.post.mock.calls.find(([path]) => path === "/api/auth/forgot-password")!.at(-1);
  const run = async (email: unknown = "cliente@example.test") => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() };
    await handler({ body: { email }, headers: {}, header: () => undefined, socket: { remoteAddress: crypto.randomUUID() } }, res);
    return res;
  };
  return { run, insert, update, probe };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.email.mockResolvedValue({ accepted: true, kind: "accepted", retryEligible: false, deliveryKnown: true });
});
afterEach(() => vi.restoreAllMocks());

describe("recuperação de senha e persistência antes do e-mail", () => {
  it.each([null, { id: 1, email: null, openId: "teste" }])("resposta uniforme para conta inexistente/e-mail nulo", async (user) => {
    const h = harness(user);
    const res = await h.run();
    expect(res.json).toHaveBeenCalledWith(publicResponse);
    expect(mocks.db).toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each([["insert", null], [null, "update"]])("não envia link se falhar a persistência: %s %s", async (insertError, updateError) => {
    const h = harness({ id: 1, email: "cliente@example.test", openId: "teste" }, insertError, updateError);
    const res = await h.run();
    expect(res.json).toHaveBeenCalledWith(publicResponse);
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each(["used", "usado"])("persiste somente hash e %s=false antes de emitir um link individual", async (column) => {
    const h = harness({ id: 1, email: "cliente@example.test", openId: "teste" }, null, null, [column]);
    await h.run();
    const payload = h.insert.mock.calls[0][0];
    const message = mocks.email.mock.calls[0][0];
    const token = message.htmlContent.match(/token=([a-f0-9]{64})/)![1];
    expect(payload.token).not.toBe(token);
    expect(payload.token).toMatch(/^[a-f0-9]{64}$/);
    expect(message.to).toBe("cliente@example.test");
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalledWith({ [column]: true });
    expect(payload[column]).toBe(false);
    expect(payload[column === "used" ? "usado" : "used"]).toBeUndefined();
    for (const probe of h.probe.mock.results) expect(probe.value.limit).toHaveBeenCalledWith(0);
    expect(h.insert.mock.invocationCallOrder[0]).toBeLessThan(mocks.email.mock.invocationCallOrder[0]);
  });

  it.each([{ columns: [] }, { columns: ["used", "usado"] }])("contrato ausente/ambíguo não escreve nem envia e preserva resposta uniforme", async ({ columns }) => {
    const h = harness({ id: 1, email: "cliente@example.test", openId: "teste" }, null, null, columns);
    expect((await h.run()).json).toHaveBeenCalledWith(publicResponse);
    expect(h.update).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("rejeita entrada não textual sem fazer consulta ou envio", async () => {
    const h = harness(null);
    const res = await h.run({ email: "malformado" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });
});
