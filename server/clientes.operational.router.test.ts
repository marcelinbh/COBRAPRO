import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), resetDb: vi.fn() }));
vi.mock("./db", () => mocks);
import { appRouter } from "./routers";

const ctx = (id = 41): TrpcContext => ({
  user: { id, openId: `sintetico-${id}`, name: "Empresa Sintética", email: "fake@example.test", role: "user", loginMethod: "email", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
});
const caller = () => appRouter.createCaller(ctx()).clientes;
type Row = Record<string, any>;
function rest(rows: Row[] = []) {
  const state = { rows: rows.map(r => ({ ...r })), error: null as any, invalidData: false, returned: undefined as Row[] | undefined, calls: [] as any[] };
  const from = vi.fn((table: string) => {
    if (table !== "clientes") throw new Error("Teste não autoriza outras tabelas");
    let mode = "read"; let payload: Row = {}; let fields = "*";
    const filters: [string, any][] = [];
    const execute = () => {
      state.calls.push({ mode, payload, fields, filters });
      if (state.error) return { data: null, error: state.error };
      if (state.invalidData) return { data: null, error: null };
      let result = state.rows.filter(row => filters.every(([key, value]) => row[key] === value));
      if (mode === "insert") {
        const row = { id: state.rows.length + 100, ativo: true, ...payload };
        state.rows.push(row); result = [row];
      }
      if (mode === "update") result.forEach(row => Object.assign(row, payload));
      if (mode === "update" && state.returned !== undefined) result = state.returned;
      return { data: fields === "id" ? result.map(row => ({ id: row.id })) : result, error: null };
    };
    const q: any = {
      select: vi.fn((value = "*") => { fields = value; return q; }),
      order: vi.fn(() => q),
      eq: vi.fn((key, value) => { filters.push([key, value]); return q; }),
      insert: vi.fn(value => { mode = "insert"; payload = value; return q; }),
      update: vi.fn(value => { mode = "update"; payload = value; return q; }),
      single: vi.fn(async () => { const r = execute(); return { ...r, data: r.data?.[0] ?? null }; }),
      maybeSingle: vi.fn(async () => { const r = execute(); return { ...r, data: r.data?.[0] ?? null }; }),
      then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
    };
    return q;
  });
  mocks.getSupabaseClientAsync.mockResolvedValue({ from });
  return { state, from };
}
const own = { id: 900, user_id: 41, nome: "Cliente Sintético", ativo: true, cpf_cnpj: "123.456.789-00", telefone: "(11) 91234-5678" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockResolvedValue(null);
  mocks.getSupabaseClientAsync.mockResolvedValue(null);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Rede real proibida nestes testes"); }));
});

describe("clientes operacional — REST real com dados exclusivamente sintéticos", () => {
  it.each([true, false])("cria com ativo=%s e impõe dono da sessão", async ativo => {
    const { state } = rest();
    await caller().create({ nome: "  Cliente Novo  ", ativo, userId: 99, user_id: 99 } as any);
    expect(state.rows[0]).toMatchObject({ nome: "Cliente Novo", ativo, user_id: 41 });
    expect(state.rows[0]).not.toHaveProperty("userId");
  });
  it("cria sem CPF e sem telefone", async () => {
    const { state } = rest();
    await caller().create({ nome: "Cliente Opcional" });
    expect(state.rows[0]).not.toHaveProperty("cpf_cnpj");
    expect(state.rows[0]).not.toHaveProperty("telefone");
  });
  it("normaliza máscaras, espaços e UF apenas na entrada nova", async () => {
    const { state } = rest([own]);
    await caller().create({ nome: "  Cliente Novo  ", cpfCnpj: "529.982.247-25", telefone: "(11) 91234-5678", cidade: "  Cidade  ", estado: " sp " });
    expect(state.rows[1]).toMatchObject({ cpf_cnpj: "52998224725", telefone: "11912345678", cidade: "Cidade", estado: "SP" });
    expect(state.rows[0]).toEqual(own);
  });
  it("aceita CNPJ no campo legado e telefone internacional com código 55", async () => {
    const { state } = rest();
    await caller().create({ nome: "Empresa Importada", cpfCnpj: "12.345.678/0001-95", telefone: "+55 (11) 91234-5678" });
    expect(state.rows[0]).toMatchObject({ cpf_cnpj: "12345678000195", telefone: "5511912345678" });
  });
  it.each([
    { nome: "  " }, { nome: "X" }, { nome: "Cliente", cpfCnpj: "123" },
    { nome: "Cliente", cpfCnpj: "52998224724" }, { nome: "Cliente", cpfCnpj: "11111111111" },
    { nome: "Cliente", cpfCnpj: "12345678000199" }, { nome: "Cliente", cpfCnpj: "abc52998224725" },
    { nome: "Cliente", telefone: "abc11912345678" },
    { nome: "Cliente", telefone: "11" }, { nome: "Cliente", estado: "ZZ" },
    { nome: "Cliente", cpfCnpj: "---" }, { nome: "Cliente", telefone: "---" },
    { nome: "a".repeat(256) }, { nome: "Cliente", cidade: "a".repeat(101) },
  ])("rejeita entrada inválida antes de qualquer consulta: %j", async input => {
    const { from } = rest();
    await expect(caller().create(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("desativa e reativa, preservando falso no mapeamento de leitura", async () => {
    rest([own]);
    await caller().update({ id: 900, ativo: false });
    expect((await caller().byId({ id: 900 })).ativo).toBe(false);
    expect((await caller().list({ ativo: false })).total).toBe(1);
    expect((await caller().list({ ativo: true })).total).toBe(0);
    await caller().update({ id: 900, ativo: true });
    expect((await caller().byId({ id: 900 })).ativo).toBe(true);
  });
  it("limpa todos os opcionais explícitos e relê valores vazios", async () => {
    const fields = { cpfCnpj: "", cnpj: "", rg: "", telefone: "", whatsapp: "", email: "", instagram: "", facebook: "", profissao: "", observacoes: "", fotoUrl: "", cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", documentosUrls: "[]" };
    const { state } = rest([{ ...own, cidade: "Cidade Anterior", estado: "SP" }]);
    await expect(caller().update({ id: 900, ...fields })).resolves.toEqual({ success: true });
    expect(await caller().byId({ id: 900 })).toMatchObject(fields);
    const update = state.calls.find(c => c.mode === "update");
    expect(update.fields).toBe("id");
    expect(update.filters).toEqual([["id", 900], ["user_id", 41]]);
  });
  it("campo omitido permanece inalterado", async () => {
    const { state } = rest([own]);
    await caller().update({ id: 900, nome: "  Outro Nome  " });
    expect(state.rows[0]).toMatchObject({ nome: "Outro Nome", cpf_cnpj: own.cpf_cnpj, telefone: own.telefone });
  });
  it("PATCH parcial não limpa nem revalida campos legados omitidos", async () => {
    const { state } = rest([{ ...own, cpf_cnpj: "123", telefone: "11", estado: "ZZ" }]);
    await caller().update({ id: 900, ativo: false });
    expect(state.rows[0]).toMatchObject({ ativo: false, cpf_cnpj: "123", telefone: "11", estado: "ZZ" });
    expect(state.calls[0].payload).toEqual({ ativo: false });
  });
  it.each(["12345678900", "123.456.789-00", "456789", "11912345678", "(11) 91234-5678", "91234-5678", "CLIENTE", "  Cliente  "])("busca normalizada encontra %s em dado legado mascarado", async busca => {
    rest([own, { ...own, id: 901, user_id: 99 }]);
    const result = await caller().list({ busca });
    expect(result.total).toBe(1);
    expect(result.clientes[0].id).toBe(900);
  });
  it("busca mascarada encontra CPF e telefone sem máscara", async () => {
    rest([{ ...own, cpf_cnpj: "12345678900", telefone: "11912345678" }]);
    expect((await caller().list({ busca: "123.456.789-00" })).total).toBe(1);
    expect((await caller().list({ busca: "(11) 91234-5678" })).total).toBe(1);
  });
  it("vazio legítimo não é falha; não enumera outro dono", async () => {
    rest([{ ...own, user_id: 99 }]);
    await expect(caller().list()).resolves.toEqual({ clientes: [], total: 0 });
    await expect(caller().byId({ id: 900 })).resolves.toBeNull();
  });
  it.each(["list", "byId"] as const)("%s propaga falha REST e permite retry sem criar dados", async method => {
    const { state } = rest([own]); state.error = { message: "Falha sintética" };
    const read = () => method === "list" ? caller().list() : caller().byId({ id: 900 });
    await expect(read()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    state.error = null; await expect(read()).resolves.toBeTruthy();
    expect(state.rows).toEqual([own]);
    expect(state.calls.every(c => c.mode === "read")).toBe(true);
  });
  it.each(["list", "byId"] as const)("%s sem cliente de banco não vira ausência", async method => {
    await expect(method === "list" ? caller().list() : caller().byId({ id: 900 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("resposta REST nula inesperada de lista é erro", async () => {
    const { state } = rest(); state.invalidData = true;
    await expect(caller().list()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it.each([900, 999])("update alheio/inexistente id=%s não altera nem informa sucesso", async id => {
    const { state } = rest([{ ...own, user_id: 99 }]);
    await expect(caller().update({ id, nome: "Tentativa", userId: 99 } as any)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.rows[0].nome).toBe(own.nome);
    expect(state.calls[0].filters).toEqual([["id", id], ["user_id", 41]]);
  });
  it.each([{ returned: [] }, { returned: [{ id: 900 }, { id: 901 }] }])("update só confirma exatamente uma linha: %j", async ({ returned }) => {
    const { state } = rest([own]); state.returned = returned;
    await expect(caller().update({ id: 900, ativo: false })).rejects.toMatchObject({ code: returned.length === 0 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR" });
  });
  it("falha de UPDATE não informa sucesso", async () => {
    const { state } = rest([own]); state.error = { message: "Falha sintética" };
    await expect(caller().update({ id: 900, ativo: false })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(state.rows).toEqual([own]);
  });
  it("patch vazio é rejeitado sem consulta", async () => {
    const { from } = rest([own]);
    await expect(caller().update({ id: 900 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(from).not.toHaveBeenCalled();
  });
  it("documentos confirma uma linha e não informa sucesso para ID alheio", async () => {
    const { state } = rest([own]);
    await expect(caller().updateDocumentos({ id: 900, documentosUrls: "[]" })).resolves.toEqual({ success: true });
    expect(state.calls[0].fields).toBe("id");
    await expect(caller().updateDocumentos({ id: 999, documentosUrls: "[]" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("importarCSV preserva contrato legado e impõe ownership", async () => {
    const { state } = rest();
    await expect(caller().importarCSV({ registros: [{ nome: "  Importado  ", cpfCnpj: "123", telefone: "11", estado: "ZZ" }, { nome: "Sem CPF" }] })).resolves.toEqual({ importados: 2, erros: 0, detalhesErros: [] });
    expect(state.rows[0]).toMatchObject({ nome: "Importado", cpf_cnpj: "123", telefone: "11", estado: "ZZ", user_id: 41 });
  });
  it.each(["list", "create", "update", "byId", "updateDocumentos"])("%s continua exigindo autenticação", async method => {
    const c = appRouter.createCaller({ ...ctx(), user: null }).clientes as any;
    await expect(c[method]({ id: 900, nome: "Cliente", documentosUrls: "[]" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});

describe("clientes operacional — Drizzle mockado", () => {
  it.each([0, 1, 2])("UPDATE confirma quantidade=%s com condição id e user_id", async count => {
    let condition: any;
    const returning = vi.fn(async () => Array.from({ length: count }, () => ({ id: 900 })));
    mocks.getDb.mockResolvedValue({ update: () => ({ set: () => ({ where: (where: any) => { condition = where; return { returning }; } }) }) });
    const result = caller().update({ id: 900, nome: "Cliente" });
    if (count === 1) await expect(result).resolves.toEqual({ success: true });
    else await expect(result).rejects.toMatchObject({ code: count === 0 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR" });
    const sql = new PgDialect().sqlToQuery(condition);
    expect(sql.params).toEqual([900, 41]);
    expect(sql.sql).toContain('"clientes"."user_id"');
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
  it.each(["list", "byId"] as const)("%s vazio Drizzle não faz fallback", async method => {
    const q: any = { from: () => q, where: () => q, orderBy: async () => [], limit: async () => [] };
    mocks.getDb.mockResolvedValue({ select: () => q });
    const result = method === "list" ? await caller().list() : await caller().byId({ id: 900 });
    expect(result).toEqual(method === "list" ? { clientes: [], total: 0 } : null);
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
  it("fallback após falha Drizzle só retorna resultado se REST funcionar", async () => {
    mocks.getDb.mockResolvedValue({ select: () => { throw new Error("Falha sintética Drizzle"); } });
    const { state } = rest([own]);
    expect((await caller().list()).total).toBe(1);
    state.error = { message: "Falha sintética REST" };
    await expect(caller().list()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.resetDb).toHaveBeenCalled();
  });
});
