import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), resetDb: vi.fn() }));
vi.mock("./db", () => mocks);
import { appRouter } from "./routers";

const ctx: any = { user: { id: 41, role: "user", openId: "sandbox-41", email: "caixa-fixture@example.invalid", name: "Fixture" }, req: { headers: {} }, res: {} };
const account = { id: 7, nome: "Caixa fixture", tipo: "caixa", banco: null, saldo: "1000.00", ativo: true, user_id: 41 };
type Result = { data: any; error: any };
function client(accounts: Result, pages: Result[] = []) {
  const calls: Array<{ table: string; columns?: string; filters: any[]; range?: number[]; ordered?: string }> = [];
  let ledgerPage = 0;
  const from = vi.fn((table: string) => {
    const call: typeof calls[number] = { table, filters: [] }; calls.push(call);
    const chain: any = {
      select: vi.fn((s: string) => { call.columns = s; return chain; }),
      eq: vi.fn((k: string, v: any) => { call.filters.push(["eq", k, v]); return chain; }),
      in: vi.fn((k: string, v: any) => { call.filters.push(["in", k, v]); return chain; }),
      order: vi.fn((k: string) => { call.ordered = k; return chain; }),
      limit: vi.fn(() => chain),
      range: vi.fn((a: number, b: number) => { call.range = [a, b]; return chain; }),
      then: (resolve: any, reject: any) => Promise.resolve(table === "contas_caixa" ? accounts : (pages[ledgerPage++] ?? { data: [], error: null })).then(resolve, reject),
    }; return chain;
  });
  return { from, calls };
}

beforeEach(() => { mocks.getDb.mockResolvedValue(null); mocks.getSupabaseClientAsync.mockReset(); });
describe("leitura operacional de Caixa", () => {
  it("falha de cliente não vira lista vazia", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it.each([{ data: null, error: { message: "offline" } }, { data: null, error: null }])("falha ou resposta incompleta não vira conta vazia", async result => {
    mocks.getSupabaseClientAsync.mockResolvedValue(client(result));
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("vazio confirmado continua sendo vazio sem consultar livro alheio", async () => {
    const sb = client({ data: [], error: null }); mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).resolves.toEqual([]);
    expect(sb.from).not.toHaveBeenCalledWith("transacoes_caixa");
  });
  it("soma decimal, seleção explícita e filtro limitado a contas do proprietário", async () => {
    const sb = client({ data: [account], error: null }, [{ data: [{ id: 1, user_id: 41, conta_caixa_id: 7, tipo: "saida", valor: "250.75" }], error: null }]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    const rows = await appRouter.createCaller(ctx).caixa.contas();
    expect(rows[0].saldoAtual).toBe(749.25);
    expect(sb.calls[0].columns).not.toContain("*");
    expect(sb.calls[0].filters).toContainEqual(["eq", "user_id", 41]);
    expect(sb.calls[1].filters).toContainEqual(["in", "conta_caixa_id", [7]]);
    expect(sb.calls[1].ordered).toBe("id");
  });
  it("parcela do livro com owner diferente não é omitida para fabricar saldo", async () => {
    const sb = client({ data: [account], error: null }, [{ data: [{ id: 1, user_id: 90, conta_caixa_id: 7, tipo: "entrada", valor: "12.00" }], error: null }]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("falha em página posterior não devolve saldo parcial", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, user_id: 41, conta_caixa_id: 7, tipo: "entrada", valor: "0.01" }));
    const sb = client({ data: [account], error: null }, [{ data: first, error: null }, { data: null, error: { code: "PGRST000" } }]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(sb.calls[2].range).toEqual([1000, 1999]);
  });
  it.each([null, undefined, "NaN", "0.001", "-0.01"])("valor inválido %s não é ignorado", async value => {
    const sb = client({ data: [account], error: null }, [{ data: [{ id: 1, user_id: 41, conta_caixa_id: 7, tipo: "entrada", valor: value }], error: null }]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
