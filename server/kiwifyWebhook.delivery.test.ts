import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerKiwifyWebhookRoutes, statusDoConviteKiwify } from "./kiwifyWebhook";

const mocks = vi.hoisted(() => ({ db: vi.fn(), email: vi.fn() }));
vi.mock("./db", () => ({ getSupabaseClientAsync: mocks.db }));
vi.mock("./_core/email", () => ({ enviarEmail: mocks.email }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hash-nao-reutilizavel") } }));

const accepted = { accepted: true, kind: "accepted", retryEligible: false, deliveryKnown: true };
const unknown = { accepted: false, kind: "delivery_unknown", retryEligible: false, deliveryKnown: false };
const throttled = { accepted: false, kind: "throttled", retryEligible: true, deliveryKnown: true };

function harness(status = "email_pendente", duplicate = true, email = "cliente@example.test") {
  const state = { status, user_criado: 77, email_enviado: 0 };
  const writes: Record<string, unknown>[] = [];
  const resetInsert = vi.fn().mockResolvedValue({ error: null });
  const usersInsert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 77 }, error: null }) }) });
  const from = vi.fn((table: string) => {
    if (table === "users") return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: duplicate ? { id: 77, email, name: "Cliente" } : null, error: null }) }) }),
      insert: usersInsert,
    };
    if (table === "password_resets") return { insert: resetInsert };
    if (table !== "kiwify_webhooks") throw new Error("Tabela inesperada");
    return {
      insert: async () => duplicate ? { error: { code: "23505" } } : { error: null },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...state }, error: null }) }) }),
      update: (patch: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};
        const execute = () => {
          const matches = Object.entries(filters).every(([key, value]) => key === "order_id" || state[key as keyof typeof state] === value);
          if (matches) { Object.assign(state, patch); writes.push(patch); }
          return { data: matches ? { user_criado: 77 } : null, error: null };
        };
        const query: any = {
          eq: (key: string, value: unknown) => { filters[key] = value; return query; },
          select: () => query,
          maybeSingle: async () => execute(),
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
        };
        return query;
      },
    };
  });
  mocks.db.mockResolvedValue({ from });
  const app = { post: vi.fn(), get: vi.fn() };
  registerKiwifyWebhookRoutes(app as any);
  const handler = app.post.mock.calls[0][1];
  const run = async () => {
    const body = { order_id: "pedido-teste", order_status: "paid", customer: { email: "cliente@example.test" } };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = crypto.createHmac("sha1", "teste-segredo").update(rawBody).digest("hex");
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    await handler({ body, rawBody, query: { signature } }, res);
    return res;
  };
  return { run, state, writes, resetInsert, usersInsert };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("KIWIFY_WEBHOOK_TOKEN", "teste-segredo");
  mocks.email.mockResolvedValue(accepted);
});
afterEach(() => vi.unstubAllEnvs());

describe("convites Kiwify com resultado Brevo tipado", () => {
  it("mapeia aceite, falha permanente, retry e estado indeterminado", () => {
    expect(statusDoConviteKiwify(accepted as any)).toBe("concluido");
    expect(statusDoConviteKiwify(unknown as any)).toBe("email_confirmacao_pendente");
    expect(statusDoConviteKiwify(throttled as any)).toBe("email_pendente");
    expect(statusDoConviteKiwify({ accepted: false, kind: "rejected", retryEligible: false, deliveryKnown: true })).toBe("email_bloqueado");
  });

  it("reserva envio antes do POST e não repete após timeout", async () => {
    const h = harness();
    mocks.email.mockImplementation(async () => {
      expect(h.state.status).toBe("email_enviando");
      return unknown;
    });
    const res = await h.run();
    expect(h.state.status).toBe("email_confirmacao_pendente");
    expect(res.json).toHaveBeenCalledWith({ received: true, needsReview: true });
    await h.run();
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(h.usersInsert).not.toHaveBeenCalled();
  });

  it("apenas uma reentrega concorrente pode adquirir o convite", async () => {
    const h = harness();
    await Promise.all([h.run(), h.run()]);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(h.resetInsert).toHaveBeenCalledTimes(1);
    expect(h.state.status).toBe("concluido");
  });

  it("rejeição transitória mantém retry elegível sem apagar a reserva", async () => {
    const h = harness();
    mocks.email.mockResolvedValue(throttled);
    const res = await h.run();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(h.state.status).toBe("email_pendente");
    expect(h.writes).not.toContainEqual(expect.objectContaining({ status: "erro" }));
  });

  it("não permite redirecionar convite do pedido a outro destinatário", async () => {
    const h = harness("email_pendente", true, "outro@example.test");
    const res = await h.run();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(h.resetInsert).not.toHaveBeenCalled();
  });

  it("conta nova registra vínculo antes de enviar e aceita o resultado tipado", async () => {
    const h = harness("processando", false);
    const res = await h.run();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(h.state.status).toBe("concluido");
    expect(h.state.email_enviado).toBe(1);
    expect(h.writes).toContainEqual({ status: "convite_preparando", user_criado: 77 });
    const reset = h.resetInsert.mock.calls[0][0];
    expect(reset.token).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });
});
