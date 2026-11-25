import type { Request, Response, Router } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClientAsync: vi.fn(),
  persistirHistoricoWhatsApp: vi.fn(),
  env: {
    evolutionWebhookToken: "fixture-token-not-a-secret",
    evolutionWebhookAllowLegacyQuery: false,
  },
}));

vi.mock("./db", () => ({
  getSupabaseClientAsync: mocks.getSupabaseClientAsync,
}));
vi.mock("./_core/env", () => ({
  ENV: new Proxy(mocks.env, {
    get(target, property) {
      if (!(property in target)) throw new Error("Unexpected ENV access in test");
      return target[property as keyof typeof target];
    },
  }),
}));
vi.mock("./services/notificacoes.operational.safe", () => ({
  persistirHistoricoWhatsApp: mocks.persistirHistoricoWhatsApp,
}));

import { processWebhookEvent, registerWebhookRoutes } from "./webhookRoutes";

const USER_ID = 3;
const INSTANCE = "user-3";
const TOKEN = "fixture-token-not-a-secret";
const PROVIDER_ID = "fake-provider-receipt";

type StoredEvent = {
  evento: string;
  instancia: string;
  payload: string;
  criado_em: string;
};

type QueryFilter = [string, string | number];

function expectOnceWith(mock: { mock: { calls: unknown[][] } }, ...args: unknown[]) {
  expect(mock.mock.calls).toEqual([args]);
}

function createStrictDatabase() {
  const events: StoredEvent[] = [];
  const selectionFilters: QueryFilter[] = [];
  const updateFilters: QueryFilter[] = [];
  const selectedIds: string[] = [];
  const control = { missingOutbox: false, errorAt: "" };
  const insert = vi.fn(async (event: StoredEvent) => {
    expect(Object.keys(event).sort()).toEqual([
      "criado_em", "evento", "instancia", "payload",
    ]);
    events.push(event);
    return { error: control.errorAt === "event" ? { message: "fixture failure" } : null };
  });
  const select = vi.fn((columns: string) => {
    expect(columns).toBe("id, user_id, tipo, parcela_id, cliente_id");
    return {
      eq: (column: string, value: number) => {
        expect([column, value]).toEqual(["user_id", USER_ID]);
        selectionFilters.push([column, value]);
        return {
          eq: async (providerColumn: string, providerId: string) => {
            expect(providerColumn).toBe("provider_message_id");
            expect(providerId).toMatch(/^fake-provider-/);
            selectionFilters.push([providerColumn, providerId]);
            selectedIds.push(providerId);
            return {
              data: control.missingOutbox ? [] : [{
                id: `fake-outbox-${providerId}`,
                user_id: USER_ID,
                tipo: "cobranca",
                parcela_id: 101,
                cliente_id: 102,
              }],
              error: null,
            };
          },
        };
      },
    };
  });
  const update = vi.fn((values: Record<string, unknown>) => {
    expect(Object.keys(values)).toEqual(["updated_at"]);
    expect(values.updated_at).toEqual(expect.any(String));
    return {
      eq: (column: string, value: string) => {
        expect(column).toBe("id");
        expect(value).toMatch(/^fake-outbox-fake-provider-/);
        updateFilters.push([column, value]);
        return {
          eq: async (ownerColumn: string, ownerId: number) => {
            expect([ownerColumn, ownerId]).toEqual(["user_id", USER_ID]);
            updateFilters.push([ownerColumn, ownerId]);
            return { error: null };
          },
        };
      },
    };
  });
  const upsert = vi.fn(async (
    values: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => {
    expect(Object.keys(values).sort()).toEqual(["chave", "user_id", "valor"]);
    expect(values.chave).toBe("evolution_connection_state");
    expect(values.user_id).toBe(USER_ID);
    expect(options).toEqual({ onConflict: "chave,user_id" });
    return { error: control.errorAt === "connection" ? { message: "fixture failure" } : null };
  });
  const from = vi.fn((table: string) => {
    if (table === "whatsapp_eventos") return { insert };
    if (table === "whatsapp_outbox") return { select, update };
    if (table === "configuracoes") return { upsert };
    throw new Error(`Unexpected table in test: ${table}`);
  });
  return {
    client: { from }, events, selectionFilters, updateFilters, selectedIds,
    control, insert, select, update, upsert,
  };
}

function receipt(id = PROVIDER_ID, status: unknown = "READ", fromMe = true) {
  return { key: { id, fromMe }, update: { status } };
}

async function invokeRealRoute(options: {
  body?: unknown;
  header?: string;
  query?: unknown;
} = {}) {
  let handler: ((req: Request, res: Response) => Promise<unknown>) | undefined;
  const app = {
    post: vi.fn((path: string, callback: typeof handler) => {
      expect(path).toBe("/api/webhook/evolution");
      handler = callback;
    }),
    get: vi.fn((path: string) => {
      expect(path).toBe("/api/webhook/evolution");
    }),
  };
  registerWebhookRoutes(app as unknown as Router);
  expect(app.post).toHaveBeenCalledTimes(1);
  expect(app.get).toHaveBeenCalledTimes(1);
  const req = {
    header: vi.fn((name: string) => {
      expect(name).toBe("x-cobrapro-webhook-token");
      return options.header;
    }),
    query: { token: options.query },
    body: options.body ?? { event: "messages.update", instance: INSTANCE, data: [receipt()] },
  };
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  await handler!(req as unknown as Request, res as unknown as Response);
  return res;
}

let db: ReturnType<typeof createStrictDatabase>;
let forbiddenFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.evolutionWebhookToken = TOKEN;
  mocks.env.evolutionWebhookAllowLegacyQuery = false;
  db = createStrictDatabase();
  mocks.getSupabaseClientAsync.mockResolvedValue(db.client);
  mocks.persistirHistoricoWhatsApp.mockResolvedValue(undefined);
  forbiddenFetch = vi.fn(() => { throw new Error("Fetch is forbidden in webhook tests"); });
  vi.stubGlobal("fetch", forbiddenFetch);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  expect(forbiddenFetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("webhook Evolution - mapa fechado e processamento real, fixtures user-3", () => {
  it.each([
    { event: "MESSAGES_UPDATE", shape: "array", status: "SENT", expected: "aceito_evolution" },
    { event: "messages.update", shape: "array", status: "SENT", expected: "aceito_evolution" },
    { event: "MESSAGES_UPDATE", shape: "single", status: "DELIVERED", expected: "entregue" },
    { event: "messages.update", shape: "single", status: "DELIVERED", expected: "entregue" },
    { event: " \tMESSAGES_UPDATE\n", shape: "updates", status: "READ", expected: "lido" },
    { event: " \tmessages.update\n", shape: "updates", status: "READ", expected: "lido" },
  ])("despacha $event / $shape com vínculo por usuário e provider ID", async ({ event, shape, status, expected }) => {
    const entry = receipt(` ${PROVIDER_ID} `, status);
    const data = shape === "array" ? [entry] : shape === "single" ? entry : { updates: [entry] };
    expect(await processWebhookEvent({ event, instance: ` ${INSTANCE} `, data })).toBe(true);
    expect(mocks.getSupabaseClientAsync).toHaveBeenCalledTimes(1);
    expect(db.events).toHaveLength(1);
    expect(db.events[0]).toMatchObject({ evento: "MESSAGES_UPDATE", instancia: INSTANCE });
    expect(JSON.parse(db.events[0].payload)).toEqual({
      event: "MESSAGES_UPDATE", instance: INSTANCE, userId: USER_ID,
      updates: [{ messageId: PROVIDER_ID, status: expected }],
    });
    expect(db.selectionFilters).toEqual([["user_id", USER_ID], ["provider_message_id", PROVIDER_ID]]);
    expect(db.updateFilters).toEqual([["id", `fake-outbox-${PROVIDER_ID}`], ["user_id", USER_ID]]);
    expectOnceWith(mocks.persistirHistoricoWhatsApp,
      db.client,
      { id: `fake-outbox-${PROVIDER_ID}`, user_id: USER_ID, tipo: "cobranca", parcela_id: 101, cliente_id: 102 },
      expected,
    );
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it.each([
    { event: "CONNECTION_UPDATE", nested: true },
    { event: "connection.update", nested: true },
    { event: " \tCONNECTION_UPDATE\n", nested: false },
    { event: " \tconnection.update\n", nested: false },
  ])("despacha $event e upsert somente da própria instância", async ({ event, nested }) => {
    const data = nested ? { instance: { state: " open " }, user_id: 999 } : { state: " open ", user_id: 999 };
    expect(await processWebhookEvent({ event, instance: ` ${INSTANCE} `, data })).toBe(true);
    expect(db.events).toHaveLength(1);
    expect(db.events[0]).toMatchObject({ evento: "CONNECTION_UPDATE", instancia: INSTANCE });
    expect(JSON.parse(db.events[0].payload)).toEqual({ event: "CONNECTION_UPDATE", instance: INSTANCE, userId: USER_ID, state: "open" });
    expectOnceWith(db.upsert,
      { chave: "evolution_connection_state", valor: "open", user_id: USER_ID },
      { onConflict: "chave,user_id" },
    );
    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(mocks.persistirHistoricoWhatsApp).not.toHaveBeenCalled();
  });

  it("rejeita eventos desconhecidos, aliases não exatos e payloads inválidos antes do DB", async () => {
    const unknownEvents = [
      "MESSAGES.UPDATE", "messages_update", "Messages_Update", "Messages.Update",
      "CONNECTION.UPDATE", "connection_update", "Connection.Update",
      "MESSAGES_UPSERT", "messages.upsert", "__proto__", "constructor", "toString",
      "", "  ", null, 17,
    ];
    for (const event of unknownEvents) {
      expect(await processWebhookEvent({ event, instance: INSTANCE, data: [receipt()] })).toBe(false);
    }
    for (const payload of [null, undefined, [], "invalid", 17]) {
      expect(await processWebhookEvent(payload)).toBe(false);
    }
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
    expect(db.client.from).not.toHaveBeenCalled();
    expect(mocks.persistirHistoricoWhatsApp).not.toHaveBeenCalled();
  });

  it("rejeita instâncias inválidas para os quatro nomes aceitos antes do DB", async () => {
    for (const event of ["MESSAGES_UPDATE", "messages.update", "CONNECTION_UPDATE", "connection.update"]) {
      for (const instance of [undefined, null, 3, "", "koletor3", "user-0", "user--3", "user-3-other", "user-3.0", "user-9007199254740992"]) {
        expect(await processWebhookEvent({ event, instance, data: [receipt()] })).toBe(false);
      }
    }
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
    expect(db.client.from).not.toHaveBeenCalled();
  });

  it("rota real: header inválido vence query válida e retorna 401 antes do DB", async () => {
    mocks.env.evolutionWebhookAllowLegacyQuery = true;
    const res = await invokeRealRoute({ header: "fixture-wrong-token", query: TOKEN });
    expectOnceWith(res.status, 401);
    expectOnceWith(res.json, { received: false, error: "Webhook não autorizado" });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it("rota real: segredo não configurado retorna 503 antes do DB", async () => {
    mocks.env.evolutionWebhookToken = "";
    const res = await invokeRealRoute({ header: TOKEN });
    expectOnceWith(res.status, 503);
    expectOnceWith(res.json, { received: false, error: "Webhook temporariamente indisponível" });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it("rota real: query válida com legado desligado retorna 401 antes do DB", async () => {
    const res = await invokeRealRoute({ query: TOKEN });
    expectOnceWith(res.status, 401);
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it.each(["messages.update", "connection.update"])("rota real: alias %s retorna 200 após despacho", async (event) => {
    const data = event === "messages.update" ? [receipt()] : { state: "open" };
    const res = await invokeRealRoute({ header: TOKEN, body: { event, instance: INSTANCE, data } });
    expectOnceWith(res.status, 200);
    expectOnceWith(res.json, { received: true });
    expect(db.insert).toHaveBeenCalledTimes(1);
    if (event === "messages.update") {
      expect(mocks.persistirHistoricoWhatsApp).toHaveBeenCalledTimes(1);
      expect(db.upsert).not.toHaveBeenCalled();
    } else {
      expect(db.upsert).toHaveBeenCalledTimes(1);
      expect(mocks.persistirHistoricoWhatsApp).not.toHaveBeenCalled();
    }
  });

  it("rota real: outbox ainda sem vínculo retorna 503 e não persiste histórico", async () => {
    db.control.missingOutbox = true;
    const res = await invokeRealRoute({ header: TOKEN, body: { event: "MESSAGES_UPDATE", instance: INSTANCE, data: [receipt()] } });
    expectOnceWith(res.status, 503);
    expectOnceWith(res.json, { received: false, error: "Webhook temporariamente indisponível" });
    expect(db.selectionFilters).toEqual([["user_id", USER_ID], ["provider_message_id", PROVIDER_ID]]);
    expect(mocks.persistirHistoricoWhatsApp).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each(["event", "connection", "history"])("rota real: erro de persistência em %s retorna 503", async (failure) => {
    db.control.errorAt = failure;
    if (failure === "history") mocks.persistirHistoricoWhatsApp.mockRejectedValue(new Error("fixture failure"));
    const event = failure === "connection" ? "CONNECTION_UPDATE" : "MESSAGES_UPDATE";
    const data = failure === "connection" ? { state: "open" } : [receipt()];
    const res = await invokeRealRoute({ header: TOKEN, body: { event, instance: INSTANCE, data } });
    expectOnceWith(res.status, 503);
    expectOnceWith(res.json, { received: false, error: "Webhook temporariamente indisponível" });
    if (failure === "event") {
      expect(db.select).not.toHaveBeenCalled();
      expect(db.upsert).not.toHaveBeenCalled();
      expect(mocks.persistirHistoricoWhatsApp).not.toHaveBeenCalled();
    } else if (failure === "connection") {
      expect(db.upsert).toHaveBeenCalledTimes(1);
    } else {
      expect(mocks.persistirHistoricoWhatsApp).toHaveBeenCalledTimes(1);
      expect(db.update).not.toHaveBeenCalled();
    }
  });

  it("processamento real persiste somente resumo canônico sem PII ou metadados brutos", async () => {
    const entry = {
      ...receipt(),
      key: { id: PROVIDER_ID, fromMe: true, remoteJid: "fake-jid@s.whatsapp.net" },
      update: { status: "READ", message: { conversation: "fixture confidential body" } },
      message: { imageMessage: { caption: "fixture media caption" } },
      pushName: "fixture person name",
    };
    expect(await processWebhookEvent({ event: "messages.update", instance: INSTANCE, data: [entry], token: TOKEN })).toBe(true);
    const stored = db.events[0];
    expect(JSON.parse(stored.payload)).toEqual({ event: "MESSAGES_UPDATE", instance: INSTANCE, userId: USER_ID, updates: [{ messageId: PROVIDER_ID, status: "lido" }] });
    const serialized = JSON.stringify(stored);
    for (const value of ["remoteJid", "fake-jid", "confidential", "imageMessage", "media caption", "pushName", "person name", TOKEN]) {
      expect(serialized).not.toContain(value);
    }
  });

  it("processamento real ignora fromMe false, ID oversized e status desconhecido", async () => {
    const entries = [
      receipt("fake-provider-inbound", "READ", false),
      receipt(`fake-provider-${"x".repeat(256)}`),
      receipt("fake-provider-unknown", "UNKNOWN_STATUS"),
      null,
      receipt(),
    ];
    expect(await processWebhookEvent({ event: "MESSAGES_UPDATE", instance: INSTANCE, data: { updates: entries } })).toBe(true);
    expect(db.selectedIds).toEqual([PROVIDER_ID]);
    expect(mocks.persistirHistoricoWhatsApp).toHaveBeenCalledTimes(1);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(JSON.parse(db.events[0].payload).updates).toEqual([{ messageId: PROVIDER_ID, status: "lido" }]);
  });

  it("lote com mais de 50 recibos realmente despacha e resume somente os primeiros 50", async () => {
    const entries = Array.from({ length: 57 }, (_, index) => receipt(`fake-provider-batch-${index}`));
    expect(await processWebhookEvent({ event: "MESSAGES_UPDATE", instance: INSTANCE, data: entries })).toBe(true);
    expect(db.selectedIds).toEqual(entries.slice(0, 50).map(entry => entry.key.id));
    expect(db.select).toHaveBeenCalledTimes(50);
    expect(db.update).toHaveBeenCalledTimes(50);
    expect(mocks.persistirHistoricoWhatsApp).toHaveBeenCalledTimes(50);
    const updates = JSON.parse(db.events[0].payload).updates;
    expect(updates).toHaveLength(50);
    expect(updates.map((entry: { messageId: string }) => entry.messageId)).toEqual(db.selectedIds);
    expect(db.upsert).not.toHaveBeenCalled();
  });
});

describe("Evolution 1.8.6 plano / aliases HH — fixtures sem mensagem real", () => {
  it.each([
    { event: "MESSAGES_UPDATE", status: "DELIVERY_ACK", expected: "entregue" },
    { event: "messages.update", status: "READ", expected: "lido" },
    { event: "messages.update", status: 2, expected: "aceito_evolution" },
    { event: "MESSAGES_UPDATE", status: 3, expected: "entregue" },
  ])("callback plano $event/$status vincula owner+keyId exatos", async ({ event, status, expected }) => {
    const body = { event, instance: INSTANCE, user_id: 999, data: { keyId: PROVIDER_ID, status, remoteJid: "fixture-sensitive-jid", owner: 999 } };
    const r = await invokeRealRoute({ header: TOKEN, body });
    expectOnceWith(r.status, 200);
    expect(db.selectionFilters).toEqual([["user_id", USER_ID], ["provider_message_id", PROVIDER_ID]]);
    expect(mocks.persistirHistoricoWhatsApp.mock.calls[0][2]).toBe(expected);
    expect(JSON.parse(db.events[0].payload).updates).toEqual([{ messageId: PROVIDER_ID, status: expected }]);
    expect(db.events[0].payload).not.toContain("sensitive");
  });
  it.each([
    { key: { id: PROVIDER_ID }, keyId: "fake-provider-other", status: "READ" },
    { key: { id: PROVIDER_ID }, update: { status: "READ" }, status: "DELIVERED" },
    { keyId: PROVIDER_ID, status: "READ", fromMe: false },
    { keyId: 42, status: "READ" },
  ])("recibo contraditório/inbound não avança %j", async data => {
    expect(await processWebhookEvent({ event: "messages.update", instance: INSTANCE, data })).toBe(true);
    expect(db.select).not.toHaveBeenCalled();
    expect(mocks.persistirHistoricoWhatsApp).not.toHaveBeenCalled();
  });
  it("instância user-03 não é alias da instância exata user-3", async () => {
    expect(await processWebhookEvent({ event: "messages.update", instance: "user-03", data: { keyId: PROVIDER_ID, status: "READ" } })).toBe(false);
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
  it.each([{ status: ['READ'] }, { status: { value: 'READ' } }, { status: true }, { status: null }])("status não escalar não é convertido em recibo válido %j", async ({ status }) => {
    expect(await processWebhookEvent({ event: "messages.update", instance: INSTANCE, data: { keyId: PROVIDER_ID, status } })).toBe(true);
    expect(db.select).not.toHaveBeenCalled();
    expect(mocks.persistirHistoricoWhatsApp).not.toHaveBeenCalled();
  });
  it.each(['', '   '])("header explicitamente vazio não cai para query válida %j", async header => {
    mocks.env.evolutionWebhookAllowLegacyQuery = true;
    const res = await invokeRealRoute({ header, query: TOKEN });
    expectOnceWith(res.status, 401);
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
});
