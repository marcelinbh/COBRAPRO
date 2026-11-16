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

// Slots monetários de 0035 (não reconstruímos a fórmula econômica no router).
const vetoresSlots = [
  { modalidade: "mensal", n: 1, slots: [["110.00", "10.00"]], total: 110, juros: 10, restante: 0, jurosRestantes: 0, capitalRestante: 0 },
  { modalidade: "semanal", n: 1, slots: [["110.00", "10.00"]], total: 110, juros: 10, restante: 0, jurosRestantes: 0, capitalRestante: 0 },
  { modalidade: "diario", n: 1, slots: [["110.00", "10.00"]], total: 110, juros: 10, restante: 0, jurosRestantes: 0, capitalRestante: 0 },
  { modalidade: "tabela_price", n: 1, slots: [["110.00", "10.00"]], total: 110, juros: 10, restante: 0, jurosRestantes: 0, capitalRestante: 0 },
  { modalidade: "mensal", n: 3, slots: [["43.33", "10.00"], ["43.33", "10.00"], ["43.34", "10.00"]], total: 130, juros: 30, restante: 86.67, jurosRestantes: 20, capitalRestante: 66.67 },
  { modalidade: "semanal", n: 3, slots: [["43.33", "10.00"], ["43.33", "10.00"], ["43.34", "10.00"]], total: 130, juros: 30, restante: 86.67, jurosRestantes: 20, capitalRestante: 66.67 },
  { modalidade: "diario", n: 3, slots: [["36.67", "3.33"], ["36.67", "3.33"], ["36.66", "3.34"]], total: 110, juros: 10, restante: 73.33, jurosRestantes: 6.67, capitalRestante: 66.66 },
  { modalidade: "tabela_price", n: 3, slots: [["40.21", "10.00"], ["40.21", "6.98"], ["40.22", "3.66"]], total: 120.64, juros: 20.64, restante: 80.43, jurosRestantes: 10.64, capitalRestante: 69.79 },
];
const camposApresentacao = ["totalReceber", "totalPago", "lucroPrevisto", "lucroRealizado", "valorJurosParcela", "parcelasAbertas", "parcelasPagas", "parcelasAtrasadas", "proximaParcela", "parcelasComAtraso", "todasParcelas"] as const;
async function apresentarListaEFicha(f: ReturnType<typeof fonte>) {
  mocks.getSupabaseClientAsync.mockResolvedValue(f);
  const lista = (await caller().listComParcelas())[0];
  const ficha = await caller().obterDetalhes({ id: 1 });
  expect(ficha).not.toBeNull();
  for (const campo of camposApresentacao) expect(ficha![campo], campo).toEqual(lista[campo]);
  for (const campo of camposApresentacao.slice(0, 8)) expect(typeof lista[campo]).toBe("number");
  expect(lista.valorPrincipal).toBe(f.tables.contratos[0].valor_principal);
  return lista;
}

describe("Apresentação por parcela: slots persistidos, sem principal proporcional ao contador", () => {
  it.each(vetoresSlots)("$modalidade N=$n: próxima e previsto seguem a própria composição", async v => {
    const f = fonte();
    Object.assign(f.tables.contratos[0], { modalidade: v.modalidade, numero_parcelas: v.n, taxa_juros: "10.00", valor_parcela: v.slots[0][0] });
    f.tables.parcelas = v.slots.map(([valor_original, valor_juros], i) => ({ ...parcela, id: 3 + i, numero_parcela: i + 1, valor_original, valor_juros, data_vencimento: `2099-01-${String(10 + i).padStart(2, "0")}` }));
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalReceber: v.total, totalPago: 0, lucroPrevisto: v.juros, valorJurosParcela: Number(v.slots[0][1]), parcelasAbertas: v.n });
    Object.assign(f.tables.parcelas[0], { status: "paga", valor_pago: v.slots[0][0] });
    const restante = await apresentarListaEFicha(f);
    expect(restante).toMatchObject({ totalReceber: v.restante, totalPago: Number(v.slots[0][0]), lucroPrevisto: v.jurosRestantes, parcelasAbertas: v.n - 1, parcelasPagas: 1, valorJurosParcela: v.n === 1 ? 0 : Number(v.slots[1][1]) });
    expect(Math.round((restante.totalReceber - restante.lucroPrevisto) * 100)).toBe(Math.round(v.capitalRestante * 100));
  });

  it("bullet renovado N=3: antecessoras canceladas recebem juros/encargos, sucessora conserva principal inteiro", async () => {
    const f = fonte(); Object.assign(f.tables.contratos[0], { numero_parcelas: 3, taxa_juros: "10.00", valor_parcela: "110.00" });
    f.tables.parcelas = [
      { ...parcela, id: 3, valor_original: "110.00", valor_juros: "10.00", valor_pago: "15.00", valor_multa: "5.00", saldo_residual: "100.00", status: "cancelada", data_vencimento: "2001-01-01" },
      { ...parcela, id: 4, numero_parcela: 2, valor_original: "110.00", valor_juros: "10.00", valor_pago: "10.00", saldo_residual: "100.00", status: "cancelada", data_vencimento: "2001-02-01" },
      { ...parcela, id: 5, numero_parcela: 3, valor_original: "110.00", valor_juros: "10.00", data_vencimento: "2099-01-01" },
    ];
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalReceber: 110, totalPago: 25, lucroPrevisto: 10, lucroRealizado: 0, valorJurosParcela: 10, parcelasAbertas: 1, parcelasAtrasadas: 0, parcelasComAtraso: [], proximaParcela: { id: 5 }, todasParcelas: [{ status: "cancelada" }, { status: "cancelada" }, { status: "pendente" }] });
  });

  it("renovada antiga não duplica residual nem exige/inventa prova nova", async () => {
    const f = fonte(); f.tables.parcelas = [
      { ...parcela, id: 3, valor_original: "110.00", valor_juros: null, valor_pago: "10.00", saldo_residual: "100.00", status: "renovada", data_vencimento: "2001-01-01" },
      { ...parcela, id: 4, valor_original: "110.00", valor_juros: "10.00", data_vencimento: "2099-01-01" },
    ];
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalPago: 10, totalReceber: 110, lucroPrevisto: 10, proximaParcela: { id: 4 }, parcelasAtrasadas: 0 });
    expect(f.calls.every(c => ["contratos", "clientes", "parcelas", "koletores", "configuracoes"].includes(c.table))).toBe(true);
  });

  it.each(["paga", "pago", "cancelada", "cancelado", "renovada"])("estado encerrado %s preserva recebimento mas não próxima/atraso", async status => {
    const f = fonte(); Object.assign(f.tables.parcelas[0], { status, data_vencimento: "2001-01-01", valor_pago: "10.00", saldo_residual: "90.00" });
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalReceber: 0, totalPago: 10, lucroPrevisto: 0, valorJurosParcela: 0, proximaParcela: null, parcelasAbertas: 0, parcelasAtrasadas: 0, parcelasComAtraso: [] });
  });

  it.each(["quitado", "cancelado"])("contrato %s não tem próxima/atraso", async status => {
    const f = fonte(); f.tables.contratos[0].status = status; f.tables.parcelas[0].data_vencimento = "2001-01-01";
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalReceber: 0, proximaParcela: null, parcelasAtrasadas: 0 });
  });

  it("parcial 40 de 100 soma pagamento registrado e não presume composição de lucro", async () => {
    const f = fonte(); Object.assign(f.tables.parcelas[0], { status: "parcial", valor_pago: "40.00", saldo_residual: "60.00", valor_juros: "10.00" });
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalPago: 40, totalReceber: 60, lucroRealizado: 0, lucroPrevisto: 0, valorJurosParcela: 10 });
  });

  it("pagamento parcial abaixo dos juros usa só limite inferior documentado", async () => {
    const f = fonte(); Object.assign(f.tables.parcelas[0], { status: "parcial", valor_pago: "4.00", saldo_residual: "96.00", valor_juros: "10.00" });
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalPago: 4, totalReceber: 96, lucroRealizado: 0, lucroPrevisto: 6 });
  });

  it("mora parcial calcula sobre residual 40, sem original 100 ou multa 5 novamente", async () => {
    const f = fonte(); Object.assign(f.tables.parcelas[0], { status: "parcial", valor_pago: "65.00", saldo_residual: "40.00", valor_multa: "5.00", data_vencimento: "2001-01-01" });
    f.tables.configuracoes = [{ user_id: 41, chave: "jurosMultaAutomatico", valor: "true" }, { user_id: 41, chave: "multaPadrao", valor: "10" }];
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalReceber: 40, totalPago: 65, parcelasAtrasadas: 1, parcelasComAtraso: [{ status: "parcial", jurosAtraso: 4, multaAplicada: 5, totalComAtraso: 44 }] });
  });

  it("pendente reutiliza original/residual/multa e não duplica a base de mora", async () => {
    const f = fonte(); Object.assign(f.tables.parcelas[0], { saldo_residual: "40.00", valor_multa: "5.00", data_vencimento: "2001-01-01" });
    f.tables.configuracoes = [{ user_id: 41, chave: "jurosMultaAutomatico", valor: "true" }, { user_id: 41, chave: "multaPadrao", valor: "10" }];
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalReceber: 145, parcelasComAtraso: [{ jurosAtraso: 14, totalComAtraso: 159 }] });
  });

  it.each([null, undefined, "0.00"])("juros legacy %s é conservador sem aplicar taxa contratual", async valor_juros => {
    const f = fonte(); f.tables.contratos[0].taxa_juros = "99.00"; Object.assign(f.tables.parcelas[0], { valor_original: "110.00", valor_juros });
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalReceber: 110, valorJurosParcela: 0, lucroPrevisto: 0 });
  });

  it("paga sem valor_pago não inventa recebimento do valor_original", async () => {
    const f = fonte(); Object.assign(f.tables.parcelas[0], { status: "paga", valor_pago: null });
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalPago: 0, totalReceber: 0 });
  });

  it("zeros explícitos permanecem finitos e numéricos", async () => {
    const f = fonte(); Object.assign(f.tables.contratos[0], { valor_principal: "0.00", valor_parcela: "0.00" }); Object.assign(f.tables.parcelas[0], { valor_original: "0.00", valor_juros: "0.00" });
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalReceber: 0, totalPago: 0, lucroPrevisto: 0, lucroRealizado: 0, valorJurosParcela: 0 });
  });

  it("somatórios de centavos não acumulam erro binário", async () => {
    const f = fonte(); f.tables.contratos[0].valor_principal = "0.20";
    f.tables.parcelas = ["0.10", "0.20"].map((valor_original, i) => ({ ...parcela, id: 3 + i, valor_original, valor_pago: valor_original, valor_juros: "0.01" }));
    expect(await apresentarListaEFicha(f)).toMatchObject({ totalReceber: 0.3, totalPago: 0.3, lucroRealizado: 0.1 });
  });

  it.each(["valor_original", "valor_pago", "valor_juros", "saldo_residual", "valor_multa"])("%s inválido é recusado na lista e ficha", async campo => {
    for (const invalido of ["12abc", "0.001", "", "-1.00", "NaN", NaN, Infinity, true, "90071992547409.92"]) {
      const f = fonte(); f.tables.parcelas[0][campo] = invalido; mocks.getSupabaseClientAsync.mockResolvedValue(f);
      await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await expect(caller().obterDetalhes({ id: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
  });

  it("principal inválido e composição juros maior que original são recusados", async () => {
    const f = fonte(); f.tables.contratos[0].valor_principal = "100x"; mocks.getSupabaseClientAsync.mockResolvedValue(f);
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller().obterDetalhes({ id: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    f.tables.contratos[0].valor_principal = "100.00"; f.tables.parcelas[0].valor_juros = "100.01";
    await expect(caller().listComParcelas()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller().obterDetalhes({ id: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
