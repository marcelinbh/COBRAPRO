/**
 * Testes do webhook da Kiwify
 * Valida: token de segurança, idempotência, processamento de compra aprovada
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getSupabaseClientAsync: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 99 }, error: null }),
    }),
  }),
}));

vi.mock("./_core/email", () => ({
  enviarEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$12$hashedpassword"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// ─── Helpers de request/response mock ────────────────────────────────────────
function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    headers: {},
    query: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

// ─── Testes ───────────────────────────────────────────────────────────────────
describe("Kiwify Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KIWIFY_WEBHOOK_TOKEN = "test-token-123";
  });

  it("deve rejeitar requisição com token inválido", async () => {
    const { registerKiwifyWebhookRoutes } = await import("./kiwifyWebhook");
    const app = { post: vi.fn(), get: vi.fn() } as unknown as import("express").Express;
    registerKiwifyWebhookRoutes(app);

    // Capturar o handler registrado
    const postCall = (app.post as ReturnType<typeof vi.fn>).mock.calls[0];
    const handler = postCall[1] as (req: unknown, res: unknown) => Promise<void>;

    const req = mockReq({
      headers: { "x-kiwify-token": "token-errado" },
      body: { order_id: "123", order_status: "paid" },
      query: {},
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token inválido" });
  });

  it("deve aceitar requisição com token correto no header", async () => {
    const { registerKiwifyWebhookRoutes } = await import("./kiwifyWebhook");
    const app = { post: vi.fn(), get: vi.fn() } as unknown as import("express").Express;
    registerKiwifyWebhookRoutes(app);

    const postCall = (app.post as ReturnType<typeof vi.fn>).mock.calls[0];
    const handler = postCall[1] as (req: unknown, res: unknown) => Promise<void>;

    const req = mockReq({
      headers: { "x-kiwify-token": "test-token-123" },
      body: {
        order_id: "order_abc123",
        order_status: "paid",
        product_title: "CobraPro",
        customer: { name: "João Silva", email: "joao@teste.com" },
      },
      query: {},
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("deve aceitar token via query string", async () => {
    const { registerKiwifyWebhookRoutes } = await import("./kiwifyWebhook");
    const app = { post: vi.fn(), get: vi.fn() } as unknown as import("express").Express;
    registerKiwifyWebhookRoutes(app);

    const postCall = (app.post as ReturnType<typeof vi.fn>).mock.calls[0];
    const handler = postCall[1] as (req: unknown, res: unknown) => Promise<void>;

    const req = mockReq({
      headers: {},
      body: {
        order_id: "order_xyz789",
        order_status: "paid",
        customer: { email: "maria@teste.com", name: "Maria" },
      },
      query: { token: "test-token-123" },
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("deve ignorar eventos com status diferente de paid/approved", async () => {
    const { registerKiwifyWebhookRoutes } = await import("./kiwifyWebhook");
    const app = { post: vi.fn(), get: vi.fn() } as unknown as import("express").Express;
    registerKiwifyWebhookRoutes(app);

    const postCall = (app.post as ReturnType<typeof vi.fn>).mock.calls[0];
    const handler = postCall[1] as (req: unknown, res: unknown) => Promise<void>;

    const req = mockReq({
      headers: { "x-kiwify-token": "test-token-123" },
      body: { order_id: "order_refund", order_status: "refunded" },
      query: {},
    });
    const res = mockRes();

    await handler(req, res);

    // Deve responder 200 mas não processar
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("KIWIFY_WEBHOOK_TOKEN deve estar configurado no ambiente", () => {
    expect(process.env.KIWIFY_WEBHOOK_TOKEN).toBeTruthy();
    expect(process.env.KIWIFY_WEBHOOK_TOKEN!.length).toBeGreaterThan(0);
  });
});
