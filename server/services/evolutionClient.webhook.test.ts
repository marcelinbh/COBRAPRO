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
    expect(JSON.parse(String(options.body))).toMatchObject({
      url: "https://cobrapro.online/api/webhook/evolution?token=test-webhook-token",
      webhook_by_events: false,
      webhook_base64: false,
      events: ["MESSAGES_UPDATE", "CONNECTION_UPDATE"],
    });
  });
});
