import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), resetDb: vi.fn() }));
vi.mock("./db", () => mocks);
import { appRouter } from "./routers";
const caller = (user: any = { id: 41 }) => appRouter.createCaller({ user, req: { headers: {} }, res: {} } as any).contratos;
const contrato = { id: 1, user_id: 41, cliente_id: 2, modalidade: "mensal", status: "ativo", valor_principal: "100.00", valor_parcela: "100.00", numero_parcelas: 1, taxa_juros: "0.00", tipo_taxa: "mensal", data_inicio: "2026-11-01", createdAt: "2026-11-01", etiquetas: "[]" };
const parcela = { id: 3, user_id: 41, contrato_id: 1, cliente_id: 2, numero_parcela: 1, valor_original: "100.00", valor_pago: "0.00", valor_multa: "0.00", saldo_residual: "0.00", data_vencimento: "2027-01-10", status: "pendente" };
function fonte() {
  const tables: Record<string, any[]> = { contratos: [{ ...contrato }], clientes: [{ id: 2, user_id: 41, nome: "Cliente sintético" }], parcelas: [{ ...parcela }], koletores: [], configuracoes: [] };
  const calls: any[] = [];
  let fault: ((call: any, data: any[]) => any) | undefined;
  const from = vi.fn((table: string) => {
    let fields = ""; const filters: any[] = [], orders: any[] = [];
    const q: any = {
      select: (f: string, opts: any) => { fields = f; expect(opts).toEqual({ count: "exact" }); return q; },
      eq: (k: string, v: any) => { filters.push([k, v]); return q; },
      in: (k: string, v: any[]) => { filters.push([k, v]); return q; },
      order: (k: string, opts: any) => { orders.push([k, opts]); return q; },
      range: async (start: number, end: number) => {
        const call = { table, fields, filters, start, end }; calls.push(call);
        let data = tables[table].filter(r => filters.every(([k, v]) => Array.isArray(v) ? v.includes(r[k]) : r[k] === v));
        data = data.slice().sort((a, b) => {
          for (const [key, opts] of orders) { const d = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0; if (d) return opts?.ascending === false ? -d : d; }
          return 0;
        });
        const altered = fault?.(call, data); if (altered) return altered;
        const projection = fields.replaceAll('"', '').split(',').map(s => s.trim());
        return { data: data.slice(start, end + 1).map(r => Object.fromEntries(projection.filter(k => k in r).map(k => [k, r[k]]))), error: null, count: data.length };
      },
    }; return q;
  });
  return { from, tables, calls, setFault: (fn: typeof fault) => { fault = fn; } };
}
beforeEach(() => { vi.clearAllMocks(); mocks.getDb.mockResolvedValue(null); });
describe("Listagem real de empréstimos: leitura íntegra, nunca cadastro condicionado a saldo", () => {
  it("erro ou banco ausente não é lista vazia", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    mocks.getSupabaseClientAsync.mockRejectedValue(new Error("offline"));
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("base vazia confirmada é vazia e não consulta valores de parcelas", async () => {
    const f = fonte(); f.tables.contratos = []; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    expect(await caller().listComParcelas()).toEqual([]);
    expect(f.calls.map(c => c.table)).toEqual(["koletores", "contratos"]);
  });
  it("contrato limpo é apresentado sem embed de cliente alheio nem consulta do Caixa", async () => {
    const f = fonte(); mocks.getSupabaseClientAsync.mockResolvedValue(f);
    const rows = await caller().listComParcelas();
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ id: 1, clienteNome: "Cliente sintético", totalReceber: 100 });
    expect(f.calls.some(c => /clientes!|transacoes_caixa|contas_caixa/.test(c.fields + c.table))).toBe(false);
    const monetary = f.calls.filter(c => /valor_original|valor_principal/.test(c.fields));
    expect(monetary.every(c => c.filters.some(([k, v]: any[]) => k === "user_id" && v === 41))).toBe(true);
  });
  it("cliente vinculado de outra empresa é recusado sem ler seu nome ou as parcelas monetárias", async () => {
    const f = fonte(); f.tables.clientes[0] = { id: 2, user_id: 99, nome: "Nome alheio não projetado" }; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(f.calls.some(c => /valor_original/.test(c.fields))).toBe(false);
    expect(f.calls.find(c => c.table === "clientes").filters).toContainEqual(["user_id", 41]);
  });
  it.each([99, null])("owner de parcela divergente %s é detectado antes de filtrar por tenant e ler valores", async owner => {
    const f = fonte(); f.tables.parcelas[0].user_id = owner; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(f.calls.some(c => /valor_original/.test(c.fields))).toBe(false);
  });
  it("cliente da parcela deve ser o mesmo cliente próprio do contrato", async () => {
    const f = fonte(); f.tables.parcelas[0].cliente_id = 77; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(f.calls.some(c => /valor_original/.test(c.fields))).toBe(false);
  });
  it.each(["koletores", "contratos", "clientes", "parcelas", "configuracoes"])("falha da consulta %s não é zero/vazio nem remoção de filtro", async table => {
    const f = fonte(); f.setFault(c => c.table === table ? { data: null, error: { message: "offline" }, count: null } : undefined); mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("recusa páginas incompletas mesmo sem erro explícito", async () => {
    const f = fonte(); f.setFault((c, data) => c.table === "contratos" ? { data, error: null, count: 2 } : undefined); mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("divergência na terceira página de metadados recusa antes da leitura monetária", async () => {
    const f = fonte(); f.tables.parcelas = Array.from({ length: 2001 }, (_, i) => ({ ...parcela, id: i + 10 })); f.tables.parcelas[2000].user_id = 99; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(f.calls.filter(c => c.table === "parcelas").map(c => c.start)).toEqual([0, 1000, 2000]);
    expect(f.calls.some(c => /valor_original/.test(c.fields))).toBe(false);
  });
  it("parcial não soma o residual ao principal de novo", async () => {
    const f = fonte(); Object.assign(f.tables.parcelas[0], { status: "parcial", saldo_residual: "40.00", valor_pago: "60.00" }); mocks.getSupabaseClientAsync.mockResolvedValue(f);
    expect((await caller().listComParcelas())[0].totalReceber).toBe(40);
  });
  it("consulta sem autenticação não alcança banco", async () => {
    await expect(caller(null).listComParcelas()).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
});

describe("Ficha de empréstimo: mesma segregação da listagem", () => {
  it("ficha limpa confirma o cliente próprio e parcelas sem embed", async () => {
    const f = fonte(); mocks.getSupabaseClientAsync.mockResolvedValue(f);
    expect(await caller().obterDetalhes({ id: 1 })).toMatchObject({ id: 1, clienteNome: "Cliente sintético", totalReceber: 100 });
    expect(f.calls.some(c => c.fields.includes('clientes!'))).toBe(false);
  });
  it("ausente ou de outra empresa continua ausente sem consulta de seus clientes", async () => {
    const f = fonte(); f.tables.contratos[0].user_id = 99; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    expect(await caller().obterDetalhes({ id: 1 })).toBeNull();
    expect(f.calls.map(c => c.table)).toEqual(['contratos']);
  });
  it("falha de leitura não é registro inexistente", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(caller().obterDetalhes({ id: 1 })).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
  it("cliente cruzado bloqueia ficha antes de parcelas/valores alheios", async () => {
    const f = fonte(); f.tables.clientes[0].user_id = 99; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().obterDetalhes({ id: 1 })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(f.calls.some(c => /valor_original/.test(c.fields))).toBe(false);
  });
  it.each([99, null])("parcela com owner %s é detectada somente por metadados", async owner => {
    const f = fonte(); f.tables.parcelas[0].user_id = owner; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().obterDetalhes({ id: 1 })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(f.calls.some(c => /valor_original/.test(c.fields))).toBe(false);
  });
  it("parcela ligada a outro cliente não é certificada", async () => {
    const f = fonte(); f.tables.parcelas[0].cliente_id = 77; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().obterDetalhes({ id: 1 })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it("configurações indisponíveis não assumem multa zero", async () => {
    const f = fonte(); f.setFault(c => c.table === 'configuracoes' ? { error: {}, data: null, count: null } : undefined); mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().obterDetalhes({ id: 1 })).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
  it("id inválido é rejeitado antes de consultar o banco", async () => {
    await expect(caller().obterDetalhes({ id: -1 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
});
