import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NODE_ENV = "production";
  process.env.EVOLUTION_API_URL = "https://evolution.test";
  process.env.EVOLUTION_API_KEY = "test-api-key";
  process.env.EVOLUTION_WEBHOOK_TOKEN = "test-webhook-token";
});

import { ensureConnection } from "./evolutionClient";

describe("Evolution — webhook de entrega", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("configura somente os eventos de status na instância já conectada", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ instance: { state: "open" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await ensureConnection(4682);

    expect(snapshot.connected).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://evolution.test/webhook/set/user-4682");
    expect(JSON.parse(String(options.body))).toEqual({
      enabled: true,
      url: "https://cobrapro.online/api/webhook/evolution",
      headers: {
        "x-cobrapro-webhook-token": "test-webhook-token",
      },
      webhook_by_events: false,
      webhook_base64: false,
      events: ["MESSAGES_UPDATE", "CONNECTION_UPDATE"],
    });
  });

  it("preserva a conexão aberta quando a configuração do webhook falha", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ instance: { state: "open" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "indisponível" }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await ensureConnection(42);

    expect(snapshot).toMatchObject({ connected: true, state: "open", errorCode: "HTTP_503" });
    expect(snapshot.errorMessage).toContain("rastreio de entrega não foi configurado");
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      ["https://evolution.test/instance/connectionState/user-42", "GET"],
      ["https://evolution.test/webhook/set/user-42", "POST"],
    ]);
  });

  it("preserva o QR recém-gerado quando a configuração do webhook falha", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "missing" }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ qrcode: { base64: "QR-FICTICIO" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "indisponível" }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await ensureConnection(42);

    expect(snapshot).toMatchObject({ connected: false, state: "connecting", qrCode: "QR-FICTICIO", errorCode: "HTTP_503" });
    expect(snapshot.errorMessage).toContain("QR Code gerado");
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      ["https://evolution.test/instance/connectionState/user-42", "GET"],
      ["https://evolution.test/instance/create", "POST"],
      ["https://evolution.test/webhook/set/user-42", "POST"],
    ]);
  });

  it("renova apenas o QR de uma sessão em pareamento sem recriar a instância", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ instance: { state: "connecting" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ base64: "QR-RENOVADO" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await ensureConnection(42);

    expect(snapshot).toMatchObject({ state: "connecting", qrCode: "QR-RENOVADO" });
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
      ["https://evolution.test/instance/connectionState/user-42", "GET"],
      ["https://evolution.test/instance/connect/user-42", "GET"],
    ]);
  });
});
