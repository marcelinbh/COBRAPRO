import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), upload: vi.fn(), remove: vi.fn(), reversible: vi.fn() }));
vi.mock("../db", () => ({ getSupabaseClientAsync: mocks.client }));
vi.mock("../services/blacklistPrivateStorage", async importOriginal => ({ ...await importOriginal<any>(), uploadPrivateBlacklistPhoto: mocks.upload, removePrivateBlacklistPhoto: mocks.remove, removePrivatePhotoReversibly: mocks.reversible }));
import { blacklistRouter } from "./blacklist";
import { configureBlacklistEntitlementResolver } from "../services/blacklistEntitlement";
const key = "00000000-0000-4000-8000-000000000000/7/10.png";
const ctx: any = { user: { id: 7, openId: "local_7", name: "Empresa Sintética", role: "user" }, req: { headers: {} }, res: {} };
function builder(result: any) {
  const log: Array<[string, ...any[]]> = [];
  const q: any = { then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) };
  for (const method of ["select", "eq", "in", "limit", "order", "update", "insert", "delete"]) q[method] = vi.fn((...args) => { log.push([method, ...args]); return q; });
  q.maybeSingle = vi.fn().mockResolvedValue(result); return { q, log };
}
function db(results: any[] = []) {
  const queries: ReturnType<typeof builder>[] = [];
  const from = vi.fn(() => { const entry = builder(results.shift() ?? { data: null, error: null }); queries.push(entry); return entry.q; });
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null }); mocks.client.mockResolvedValue({ from, rpc }); return { from, rpc, queries };
}
const grant = { userId: 7, status: "active" as const, validFrom: "2020-01-01T00:00:00Z", validUntil: "2099-01-01T00:00:00Z", source: "kiwify:authenticated-webhook+verified-sale", lifetime: false };
const operations = [
  ["criar", { cpfCnpj: "52998224725", nome: "Sintético", motivo: "Evidência sintética", tipoDivida: "outros" }],
  ["consultar", { busca: "52998224725" }], ["detalhe", { id: 10 }], ["listarMeus", undefined],
  ["atualizar", { id: 10, nome: "Sintético" }], ["deletar", { id: 10 }],
  ["adicionarFoto", { blacklistId: 10, fotoBase64: "aGVsbG8=", mimeType: "image/png" }],
  ["removerFoto", { blacklistId: 10, fotoId: 20 }], ["estatisticas", undefined],
] as const;
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("ENABLE_BLACKLIST_PRIVATE", "true"); configureBlacklistEntitlementResolver(async () => grant); mocks.upload.mockResolvedValue({ key, reference: `storage://cobrapro-blacklist-private/${key}` }); mocks.remove.mockResolvedValue(undefined); mocks.reversible.mockImplementation(async (_key, _scope, commit) => commit()); });
afterEach(() => { vi.unstubAllEnvs(); configureBlacklistEntitlementResolver(); });
describe("Blacklist gates/ownership/storage", () => {
  it.each(operations)("%s off é precondition antes de acessar DB/storage", async (method, input) => {
    vi.stubEnv("ENABLE_BLACKLIST_PRIVATE", "false"); db(); const caller: any = blacklistRouter.createCaller(ctx);
    await expect(caller[method](input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it.each(operations)("%s usuário/admin sem concessão negado", async (method, input) => {
    configureBlacklistEntitlementResolver(async () => null); db(); const caller: any = blacklistRouter.createCaller({ ...ctx, user: { ...ctx.user, role: "admin" } });
    await expect(caller[method](input)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(operations)("%s admin com grant manual/vitalício negado antes de DB/storage", async (method, input) => {
    for (const invalid of [{ ...grant, source: "blacklist_access_grants:0023" }, { ...grant, lifetime: true }, { ...grant, source: "users:registration" }]) {
      configureBlacklistEntitlementResolver(async () => invalid); db();
      const caller: any = blacklistRouter.createCaller({ ...ctx, user: { ...ctx.user, role: "admin" } });
      await expect(caller[method](input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
    }
  });
  it("owner/create sanitiza evidencia e preserva cidade/estado/endereco", async () => {
    const t = db([{ data: { id: 10 }, error: null }]);
    await blacklistRouter.createCaller(ctx).criar({ cpfCnpj: "529.982.247-25", nome: "<b>Sintético</b>", motivo: "<script>x</script> Evidência\u0000 sintética", cidade: "São Paulo", estado: "sp", endereco: "Rua sintética" });
    expect(t.queries[0].q.insert).toHaveBeenCalledWith(expect.objectContaining({ cpf_cnpj: "52998224725", nome: "Sintético", motivo: "x Evidência sintética", cidade: "São Paulo", estado: "SP", endereco: "Rua sintética", cadastrado_por_user_id: 7 }));
  });
  it("editar de outro owner usa filtro e não tem acesso", async () => {
    const t = db([{ data: null, error: null }]); await expect(blacklistRouter.createCaller(ctx).atualizar({ id: 10, nome: "Alteração" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(t.queries[0].q.eq).toHaveBeenCalledWith("cadastrado_por_user_id", 7);
  });
  it("upload de outro owner nunca armazena", async () => {
    db([{ data: null, error: null }]); await expect(blacklistRouter.createCaller(ctx).adicionarFoto({ blacklistId: 10, fotoBase64: "aGVsbG8=", mimeType: "image/png" })).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("DB rejeita sexta foto concorrente => remove objeto recém-enviado", async () => {
    const t = db([{ data: { id: 10 }, error: null }, { count: 4, error: null }, { data: null, error: { code: "23514" } }, { data: null, error: null }]);
    await expect(blacklistRouter.createCaller(ctx).adicionarFoto({ blacklistId: 10, fotoBase64: "aGVsbG8=", mimeType: "image/png" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.remove).toHaveBeenCalledWith(key, { userId: 7, blacklistId: 10 });
    expect(t.queries[2].q.insert).toHaveBeenCalledWith({ blacklist_id: 10, file_key: key, url: `storage://cobrapro-blacklist-private/${key}` });
  });
  it("upload DB timeout já confirmado preserva objeto", async () => {
    db([{ data: { id: 10 }, error: null }, { count: 4, error: null }, { data: null, error: { code: "timeout" } }, { data: { id: 20 }, error: null }]);
    await expect(blacklistRouter.createCaller(ctx).adicionarFoto({ blacklistId: 10, fotoBase64: "aGVsbG8=", mimeType: "image/png" })).resolves.toEqual({ id: 20 }); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("confirmação ambígua upload não destrói possível dado", async () => {
    db([{ data: { id: 10 }, error: null }, { count: 4, error: null }, { data: null, error: {} }, { data: null, error: {} }]);
    await expect(blacklistRouter.createCaller(ctx).adicionarFoto({ blacklistId: 10, fotoBase64: "aGVsbG8=", mimeType: "image/png" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("excluir registro com fotos exige remoção reversível sem CASCADE", async () => {
    const t=db([{ data: { id: 10 }, error: null }]); t.rpc.mockResolvedValue({ data: null, error: { code: "23514" } } as any);
    await expect(blacklistRouter.createCaller(ctx).deletar({ id: 10 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(t.rpc).toHaveBeenCalledWith("blacklist_delete_empty_owned", { target_id: 10, owner_id: 7 }); expect(t.from).toHaveBeenCalledTimes(1);
  });
  it("listagem nunca emite URL externa/legacy nem storage reference", async () => {
    db([{ data: [{ id: 10, nome: "Sintético" }], error: null }, { data: [{ id: 20, blacklist_id: 10, file_key: key, url: `storage://cobrapro-blacklist-private/${key}` }, { id: 21, blacklist_id: 10, file_key: "legacy", url: "https://public.invalid" }], error: null }]);
    const rows = await blacklistRouter.createCaller(ctx).listarMeus(); expect(rows[0].fotos).toEqual([{ id: 20, url: "/api/blacklist/photos/20" }]); expect(JSON.stringify(rows)).not.toContain("storage://"); expect(JSON.stringify(rows)).not.toContain("https://");
  });
  it("detalhe de outro owner mínimo/mascarado e fotos route-only", async () => {
    db([{ data: { id: 10, nome: "Sintético Teste", cpf_cnpj: "52998224725", status: "ativo", cadastrado_por_user_id: 8, endereco: "privado" }, error: null }, { data: [], error: null }]);
    const result = await blacklistRouter.createCaller(ctx).detalhe({ id: 10 }); expect(result.documentoMascarado).toBe("***.***.***-25"); expect(JSON.stringify(result)).not.toContain("privado"); expect(JSON.stringify(result)).not.toContain("cadastrado_por_user_id");
  });
  it("removerFoto vincula owner/pai e usa callback reversível", async () => {
    const t = db([{ data: { id: 10 }, error: null }, { data: { id: 20, blacklist_id: 10, file_key: key, url: `storage://cobrapro-blacklist-private/${key}` }, error: null }, { data: { id: 20 }, error: null }]);
    await expect(blacklistRouter.createCaller(ctx).removerFoto({ blacklistId: 10, fotoId: 20 })).resolves.toEqual({ sucesso: true });
    expect(mocks.reversible).toHaveBeenCalledWith(key, { userId: 7, blacklistId: 10 }, expect.any(Function));
    expect(t.queries[2].q.eq).toHaveBeenCalledWith("blacklist_id", 10); expect(t.queries[2].q.eq).toHaveBeenCalledWith("file_key", key);
  });
  it("removerFoto DB falha solicita rollback preservando os dados", async () => {
    db([{ data: { id: 10 }, error: null }, { data: { id: 20, blacklist_id: 10, file_key: key, url: `storage://cobrapro-blacklist-private/${key}` }, error: null }, { data: null, error: { code: "DB_FAILED" } }, { data: { id: 20 }, error: null }]);
    await expect(blacklistRouter.createCaller(ctx).removerFoto({ blacklistId: 10, fotoId: 20 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("usuario comum não audita nem concede acesso", async () => {
    db(); await expect(blacklistRouter.createCaller(ctx).auditarAcessos({ userId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("CPF com caracteres não permitidos e data civil impossível rejeitados", async () => {
    db(); const caller = blacklistRouter.createCaller(ctx);
    await expect(caller.consultar({ busca: "x52998224725" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.criar({ cpfCnpj: "52998224725", nome: "Sintético", motivo: "Evidência", dataOcorrencia: "2026-02-31" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
