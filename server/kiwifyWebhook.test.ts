import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClientAsync: vi.fn(),
  enviarEmail: vi.fn(),
}));

vi.mock("./db", () => ({ getSupabaseClientAsync: mocks.getSupabaseClientAsync }));
vi.mock("./_core/email", () => ({ enviarEmail: mocks.enviarEmail }));

function resposta() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

function aplicativo() {
  return { post: vi.fn(), get: vi.fn() } as unknown as import("express").Express;
}

async function handlerKiwify() {
  const { registerKiwifyWebhookRoutes } = await import("./kiwifyWebhook");
  const app = aplicativo();
  registerKiwifyWebhookRoutes(app);
  return (app.post as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as (req: unknown, res: unknown) => Promise<void>;
}

function assinar(body: Buffer, token = "kiwify-token-de-teste") {
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHmac("sha1", token).update(body).digest("hex");
}

describe("Webhook Kiwify seguro", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.KIWIFY_WEBHOOK_TOKEN = "kiwify-token-de-teste";
    mocks.enviarEmail.mockResolvedValue(true);
  });

  it("valida o vetor HMAC-SHA1 oficial sobre os bytes originais", async () => {
    const { assinaturaKiwifyEhValida } = await import("./kiwifyWebhook");
    const body = Buffer.from('{"order_id":"9b1c2d3e-0000-4000-8000-000000000001","order_status":"paid","webhook_event_type":"order_approved"}', "utf8");
    expect(assinaturaKiwifyEhValida(body, "bf18f352a4f981b91dfa3f6d8742a81080ab8c86", "kiwify-token-de-teste")).toBe(true);
    expect(assinaturaKiwifyEhValida(body, "0".repeat(40), "kiwify-token-de-teste")).toBe(false);
    expect(assinaturaKiwifyEhValida(body, "bf18f352a4f981b91dfa3f6d8742a81080ab8c86", "")).toBe(false);
  });

  it("falha fechado quando o segredo não está configurado", async () => {
    delete process.env.KIWIFY_WEBHOOK_TOKEN;
    const handler = await handlerKiwify();
    const res = resposta();
    await handler({ rawBody: Buffer.from("{}"), query: {}, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it("rejeita assinatura inválida sem tocar no banco", async () => {
    const handler = await handlerKiwify();
    const res = resposta();
    await handler({ rawBody: Buffer.from("{}"), query: { signature: "0".repeat(40) }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it("aceita evento autenticado não aprovado sem criar conta", async () => {
    const rawBody = Buffer.from('{"order_id":"pedido-1","order_status":"refunded","webhook_event_type":"order_refunded","customer":{"email":"cliente@teste.com"}}');
    const handler = await handlerKiwify();
    const res = resposta();
    await handler({ rawBody, query: { signature: assinar(rawBody) }, body: JSON.parse(rawBody.toString("utf8")) }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true, ignored: true });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it("nunca altera senha ou envia convite quando o e-mail já pertence a uma conta", async () => {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const insertReserva = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "kiwify_webhooks") return { insert: insertReserva, update };
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 77 }, error: null }) }) }),
            insert: vi.fn(),
            update: vi.fn(),
          };
        }
        throw new Error(`Tabela inesperada: ${table}`);
      }),
    };
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    const rawBody = Buffer.from('{"order_id":"pedido-2","order_status":"paid","webhook_event_type":"order_approved","customer":{"email":"existente@teste.com","name":"Conta existente"}}');
    const handler = await handlerKiwify();
    const res = resposta();
    await handler({ rawBody, query: { signature: assinar(rawBody) }, body: JSON.parse(rawBody.toString("utf8")) }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(supabase.from).toHaveBeenCalledWith("users");
    const usersBuilder = (supabase.from as ReturnType<typeof vi.fn>).mock.results.find((result: any) => result.value?.select)?.value;
    expect(usersBuilder.update).not.toHaveBeenCalled();
    expect(mocks.enviarEmail).not.toHaveBeenCalled();
  });
});
