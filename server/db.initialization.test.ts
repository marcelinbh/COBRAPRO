import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), fetch: vi.fn(), env: { supabaseUrl: "https://synthetic.invalid", supabaseServiceRoleKey: "synthetic-test-key" } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
const cliente = { synthetic: true };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.env.supabaseUrl = "https://synthetic.invalid"; mocks.env.supabaseServiceRoleKey = "synthetic-test-key";
  vi.stubEnv("SUPABASE_URL", ""); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  mocks.create.mockReturnValue(cliente);
  vi.doMock("undici", () => ({ fetch: mocks.fetch, Agent: class {} }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("undici"); });

describe("Supabase: inicialização única aguardada por todos os cadastros", () => {
  it("consulta concorrente não retorna null depois de 100 ms enquanto a inicialização continua", async () => {
    const gate = deferred<void>(), started = deferred<void>();
    vi.doMock("undici", async () => { started.resolve(); await gate.promise; return { fetch: mocks.fetch, Agent: class {} }; });
    const db = await import("./db");
    const first = db.getSupabaseClientAsync(); await started.promise;
    let terminou = false;
    const second = db.getSupabaseClientAsync().then(v => { terminou = true; return v; });
    await new Promise(r => setTimeout(r, 150));
    expect(terminou).toBe(false); expect(db.getSupabaseClient()).toBeNull(); expect(mocks.create).not.toHaveBeenCalled();
    gate.resolve();
    const results = await Promise.all([first, second]);
    expect(results[0]).toBe(cliente); expect(results[1]).toBe(cliente); expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("trinta chamadas concorrentes compartilham um único cliente e preservam o fetch configurado", async () => {
    const db = await import("./db");
    const results = await Promise.all(Array.from({ length: 30 }, () => db.getSupabaseClientAsync()));
    expect(results.every(v => v === cliente)).toBe(true); expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0][2].auth).toEqual({ persistSession: false, autoRefreshToken: false });
    expect(mocks.create.mock.calls[0][2].global.fetch).toBeTypeOf("function");
    expect(db.getSupabaseClient()).toBe(cliente);
  });
  it("exceção de inicialização não mantém o estado preso e permite nova tentativa", async () => {
    const db = await import("./db"); mocks.create.mockImplementationOnce(() => { throw new Error("initialization failed"); });
    await expect(db.getSupabaseClientAsync()).rejects.toThrow("initialization failed");
    expect(db.getSupabaseClient()).toBeNull();
    expect(await db.getSupabaseClientAsync()).toBe(cliente); expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("todos os chamadores recebem o erro da mesma tentativa e o retry não repete o erro antigo", async () => {
    const db = await import("./db"); mocks.create.mockImplementationOnce(() => { throw new Error("transient"); });
    const results = await Promise.allSettled([db.getSupabaseClientAsync(), db.getSupabaseClientAsync()]);
    expect(results.map(r => r.status)).toEqual(["rejected", "rejected"]); expect(mocks.create).toHaveBeenCalledOnce();
    expect(await db.getSupabaseClientAsync()).toBe(cliente);
  });
  it("configuração ausente não cria cliente nem usa chave fictícia de fallback", async () => {
    mocks.env.supabaseUrl = ""; mocks.env.supabaseServiceRoleKey = "";
    const db = await import("./db");
    expect(await db.getSupabaseClientAsync()).toBeNull(); expect(await db.getSupabaseClientAsync()).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
