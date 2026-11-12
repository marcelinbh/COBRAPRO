import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), resetDb: vi.fn() }));
vi.mock("./db", () => mocks);
import { appRouter } from "./routers";

const ctx: any = { user: { id: 41, role: "user", openId: "sandbox-41", email: "caixa-fixture@example.invalid", name: "Fixture" }, req: { headers: {} }, res: {} };
// Catálogo produtivo informado para contas_caixa, sem inventar banco ou aliases.
const accountColumns = new Set(["id", "nome", "tipo", "saldo", "ativo", "createdAt", "updatedAt", "user_id"]);
const account = { id: 7, nome: "Caixa fixture", tipo: "caixa", saldo: "1000.00", ativo: true, createdAt: "2026-11-12T00:00:00Z", updatedAt: "2026-11-12T00:00:00Z", user_id: 41 };
type Result = { data: any; error: any };
function client(accounts: Result, pages: Result[] = []) {
  const calls: Array<{ table: string; columns?: string; filters: any[]; range?: number[]; ordered?: string; limit?: number }> = [];
  let ledgerPage = 0;
  const from = vi.fn((table: string) => {
    const call: typeof calls[number] = { table, filters: [] }; calls.push(call);
    let selectedColumns: string[] = [];
    let schemaError: Result["error"] = null;
    const chain: any = {
      select: vi.fn((s: string) => {
        call.columns = s;
        selectedColumns = s.split(",").map(column => column.trim());
        if (table === "contas_caixa") {
          const unknown = selectedColumns.find(column => !accountColumns.has(column));
          if (unknown) schemaError = { code: "42703", message: `column contas_caixa.${unknown} does not exist` };
        }
        return chain;
      }),
      eq: vi.fn((k: string, v: any) => { call.filters.push(["eq", k, v]); return chain; }),
      in: vi.fn((k: string, v: any) => { call.filters.push(["in", k, v]); return chain; }),
      order: vi.fn((k: string) => { call.ordered = k; return chain; }),
      limit: vi.fn((n: number) => { call.limit = n; return chain; }),
      range: vi.fn((a: number, b: number) => { call.range = [a, b]; return chain; }),
      then: (resolve: any, reject: any) => {
        if (schemaError) return Promise.resolve({ data: null, error: schemaError }).then(resolve, reject);
        const result = table === "contas_caixa" ? accounts : (pages[ledgerPage++] ?? { data: [], error: null });
        // A resposta também respeita a projeção: não injeta banco:null na fixture.
        const projected = table === "contas_caixa" && Array.isArray(result.data)
          ? { ...result, data: result.data.map(row => Object.fromEntries(selectedColumns.filter(column => column in row).map(column => [column, row[column]]))) }
          : result;
        return Promise.resolve(projected).then(resolve, reject);
      },
    }; return chain;
  });
  return { from, calls };
}

beforeEach(() => { mocks.getDb.mockResolvedValue(null); mocks.getSupabaseClientAsync.mockReset(); });
describe("mock de contas_caixa com catálogo produtivo estrito", () => {
  it.each(["banco", "saldo_inicial", "ativa", "created_at", "updated_at", "coluna_inventada"])("rejeita projeção inexistente %s mesmo com fixture válida", async column => {
    const sb = client({ data: [account], error: null });
    const result = await sb.from("contas_caixa").select(`id,nome,${column}`);
    expect(result).toEqual({ data: null, error: { code: "42703", message: `column contas_caixa.${column} does not exist` } });
  });
  it("aceita todas as colunas reais, inclusive timestamps camelCase", async () => {
    const sb = client({ data: [account], error: null });
    await expect(sb.from("contas_caixa").select([...accountColumns].join(","))).resolves.toEqual({ data: [account], error: null });
  });
  it("reproduz a falha da projeção anterior, sem fabricar contas vazias", async () => {
    const sb = client({ data: [account], error: null });
    await expect(sb.from("contas_caixa").select("id,nome,tipo,banco,saldo,ativo,user_id")).resolves.toMatchObject({ data: null, error: { code: "42703" } });
  });
});

describe("leitura operacional de Caixa", () => {
  it("falha de cliente não vira lista vazia", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it.each([
    { data: null, error: { message: "offline" } },
    { data: null, error: null },
    { data: null, error: { code: "42703", message: "column does not exist" } },
    { data: [account], error: { code: "42703", message: "column does not exist" } },
  ])("falha, erro de schema ou resposta incompleta não vira conta vazia", async result => {
    const sb = client(result); mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(sb.from).not.toHaveBeenCalledWith("transacoes_caixa");
  });
  it("vazio confirmado continua sendo vazio sem consultar livro alheio", async () => {
    const sb = client({ data: [], error: null }); mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).resolves.toEqual([]);
    expect(sb.from).not.toHaveBeenCalledWith("transacoes_caixa");
  });
  it("catálogo sem banco retorna shape compatível, saldo correto e consulta isolada", async () => {
    const sb = client({ data: [account], error: null }, [{ data: [{ id: 1, user_id: 41, conta_caixa_id: 7, tipo: "saida", valor: "250.75" }], error: null }]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    const rows = await appRouter.createCaller(ctx).caixa.contas();
    expect(rows).toEqual([{ id: 7, nome: "Caixa fixture", tipo: "caixa", banco: null, saldoInicial: 1000, saldoAtual: 749.25, ativa: true }]);
    expect(sb.calls[0].columns).toBe("id,nome,tipo,saldo,ativo,user_id");
    expect(sb.calls[0].filters).toEqual([["eq", "ativo", true], ["eq", "user_id", 41]]);
    expect(sb.calls[0].limit).toBe(1000);
    expect(sb.calls[1].columns).toBe("id,conta_caixa_id,tipo,valor,user_id");
    expect(sb.calls[1].filters).toEqual([["in", "conta_caixa_id", [7]]]);
    expect(sb.calls[1].ordered).toBe("id");
    expect(sb.calls[1].range).toEqual([0, 999]);
  });
  it("calcula centavos sem artefato de ponto flutuante e não mistura contas", async () => {
    const sb = client({ data: [
      { ...account, saldo: "0.10" },
      { ...account, id: 8, saldo: "10.00" },
    ], error: null }, [{ data: [
      { id: 1, user_id: 41, conta_caixa_id: 7, tipo: "entrada", valor: "0.20" },
      { id: 2, user_id: 41, conta_caixa_id: 8, tipo: "saida", valor: "0.01" },
    ], error: null }]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    const rows = await appRouter.createCaller(ctx).caixa.contas();
    expect(rows.map(row => row.saldoAtual)).toEqual([Number(10n + 20n) / 100, Number(1000n - 1n) / 100]);
    expect(rows.every(row => row.banco === null)).toBe(true);
    expect(sb.calls[1].filters).toEqual([["in", "conta_caixa_id", [7, 8]]]);
  });
  it.each([
    { user_id: 90 }, { user_id: null }, { user_id: undefined },
    { ativo: false }, { id: 0 }, { id: "7" },
  ])("conta sem titularidade ou identidade válida falha antes do livro: %j", async overrides => {
    const sb = client({ data: [{ ...account, ...overrides }], error: null });
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(sb.from).not.toHaveBeenCalledWith("transacoes_caixa");
  });
  it.each([null, undefined, "NaN", "0.001"])("saldo-base inválido %s exige revisão", async saldo => {
    mocks.getSupabaseClientAsync.mockResolvedValue(client({ data: [{ ...account, saldo }], error: null }));
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("limite de contas não devolve conjunto potencialmente truncado", async () => {
    const sb = client({ data: Array.from({ length: 1000 }, (_, i) => ({ ...account, id: i + 1 })), error: null });
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(sb.from).not.toHaveBeenCalledWith("transacoes_caixa");
  });
  it.each([
    { user_id: 90 }, { user_id: null }, { user_id: undefined },
    { conta_caixa_id: 8 }, { id: 0 }, { tipo: "transferencia" },
  ])("vínculo ou identidade inválida do livro não é omitida para fabricar saldo: %j", async overrides => {
    const sb = client({ data: [account], error: null }, [{ data: [{ id: 1, user_id: 41, conta_caixa_id: 7, tipo: "entrada", valor: "12.00", ...overrides }], error: null }]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it.each([
    { data: null, error: { code: "42703" } },
    { data: null, error: null },
    { data: [], error: { code: "PGRST000" } },
  ])("livro incompleto ou com erro de schema não devolve saldo-base", async page => {
    mocks.getSupabaseClientAsync.mockResolvedValue(client({ data: [account], error: null }, [page]));
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("lê páginas consecutivas e soma cada centavo uma única vez", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, user_id: 41, conta_caixa_id: 7, tipo: "entrada", valor: "0.01" }));
    const sb = client({ data: [{ ...account, saldo: "0.10" }], error: null }, [
      { data: first, error: null },
      { data: [{ id: 1001, user_id: 41, conta_caixa_id: 7, tipo: "saida", valor: "0.03" }], error: null },
    ]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    const rows = await appRouter.createCaller(ctx).caixa.contas();
    expect(rows[0].saldoAtual).toBe(Number(10n + 1000n - 3n) / 100);
    expect(sb.calls.slice(1).map(call => call.range)).toEqual([[0, 999], [1000, 1999]]);
    expect(sb.calls.slice(1).every(call => call.ordered === "id")).toBe(true);
  });
  it("falha em página posterior não devolve saldo parcial", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, user_id: 41, conta_caixa_id: 7, tipo: "entrada", valor: "0.01" }));
    const sb = client({ data: [account], error: null }, [{ data: first, error: null }, { data: null, error: { code: "PGRST000" } }]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(sb.calls[2].range).toEqual([1000, 1999]);
  });
  it("acumulado incompatível com transporte numérico não perde centavos silenciosamente", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, user_id: 41, conta_caixa_id: 7, tipo: "entrada", valor: "9999999999999.99" }));
    const sb = client({ data: [{ ...account, saldo: "0.00" }], error: null }, [
      { data: first, error: null },
      { data: [{ id: 1001, user_id: 41, conta_caixa_id: 7, tipo: "entrada", valor: "0.01" }], error: null },
    ]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it.each([null, undefined, "NaN", "0.001", "-0.01"])("valor inválido %s não é ignorado", async value => {
    const sb = client({ data: [account], error: null }, [{ data: [{ id: 1, user_id: 41, conta_caixa_id: 7, tipo: "entrada", valor: value }], error: null }]);
    mocks.getSupabaseClientAsync.mockResolvedValue(sb);
    await expect(appRouter.createCaller(ctx).caixa.contas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
