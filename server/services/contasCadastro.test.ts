import { describe, expect, it, vi } from "vitest";
import { listarContasParaCadastro } from "./contasCadastro";

const row = (id: number, userId = 77) => ({ id, nome: `Conta ${id}`, tipo: "dinheiro", ativo: true, user_id: userId, saldo: "segredo não projetado" });
function fonte(rows: any[], total = rows.length, overrides: Record<number, any> = {}) {
  const selects: any[] = [], filtros: any[] = [], ranges: any[] = [], tabelas: string[] = [];
  const from = vi.fn((tabela: string) => {
    tabelas.push(tabela);
    const q: any = {
      select: (...args: any[]) => { selects.push(args); return q; },
      eq: (...args: any[]) => { filtros.push(args); return q; },
      order: (key: string, opts: any) => { expect(key).toBe("id"); expect(opts).toEqual({ ascending: true }); return q; },
      range: (inicio: number, fim: number) => {
        ranges.push([inicio, fim]);
        return Promise.resolve(overrides[inicio] ?? { data: rows.slice(inicio, fim + 1), error: null, count: total });
      },
    };
    return q;
  });
  return { from, selects, filtros, ranges, tabelas };
}

describe("Contas para cadastro: somente metadados da empresa atual", () => {
  it("não consulta transações ou saldo, mesmo se o agregador financeiro estiver indisponível", async () => {
    const f = fonte([row(1), row(2)]);
    expect(await listarContasParaCadastro(f, 77)).toEqual({ empresaId: 77, contas: [
      { id: 1, nome: "Conta 1", tipo: "dinheiro" }, { id: 2, nome: "Conta 2", tipo: "dinheiro" },
    ] });
    expect(f.tabelas).toEqual(["contas_caixa"]);
    expect(f.selects).toEqual([["id,nome,tipo,ativo,user_id", { count: "exact" }]]);
    expect(f.filtros).toEqual([["user_id", 77], ["ativo", true]]);
  });
  it("base vazia confirmada não é falha e não inventa conta", async () => {
    expect(await listarContasParaCadastro(fonte([]), 77)).toEqual({ empresaId: 77, contas: [] });
  });
  it("percorre três páginas sem truncar contas", async () => {
    const f = fonte(Array.from({ length: 205 }, (_, i) => row(i + 1)));
    const r = await listarContasParaCadastro(f, 77);
    expect(r.contas).toHaveLength(205);
    expect(f.ranges).toEqual([[0, 99], [100, 199], [200, 299]]);
    expect(f.filtros.filter(x => x[0] === "user_id")).toEqual(Array(3).fill(["user_id", 77]));
  });
  it.each([row(1, 88), { ...row(1), user_id: null }, { ...row(1), ativo: false }, { ...row(1), id: "1" }, { ...row(1), nome: null }])("recusa metadados não autorizados sem retornar valores %j", async bad => {
    await expect(listarContasParaCadastro(fonte([bad]), 77)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("conta externa na terceira página invalida a leitura completa", async () => {
    const rows = Array.from({ length: 205 }, (_, i) => row(i + 1)); rows[204] = row(205, 88);
    await expect(listarContasParaCadastro(fonte(rows), 77)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("página repetida não é aceita", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => row(i + 1));
    await expect(listarContasParaCadastro(fonte(rows, 101, { 100: { data: [row(1)], error: null, count: 101 } }), 77)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it.each([
    { data: [], error: { message: "Falha" }, count: 0 },
    { data: null, error: null, count: 0 },
    { data: [], error: null, count: null },
    { data: [row(1)], error: null, count: 2 },
    { data: [], error: null, count: 10001 },
  ])("erro e truncamento não viram lista vazia %j", async resposta => {
    await expect(listarContasParaCadastro(fonte([], 0, { 0: resposta }), 77)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("contagem alterada durante paginação exige retry", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => row(i + 1));
    await expect(listarContasParaCadastro(fonte(rows, 101, { 100: { data: [row(101)], error: null, count: 102 } }), 77)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("sem tenant autenticado não consulta o banco", async () => {
    const f = fonte([]);
    await expect(listarContasParaCadastro(f, 0)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(f.from).not.toHaveBeenCalled();
  });
});
