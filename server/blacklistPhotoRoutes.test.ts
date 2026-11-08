import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), entitlement: vi.fn(), enabled: vi.fn(), download: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.auth } }));
vi.mock("./db", () => ({ getSupabaseClientAsync: mocks.client }));
vi.mock("./services/blacklistEntitlement", () => ({ requireBlacklistEntitlement: mocks.entitlement, requireBlacklistEnabled: mocks.enabled }));
vi.mock("./services/blacklistPrivateStorage", async importOriginal => ({ ...await importOriginal<any>(), downloadPrivateBlacklistPhoto: mocks.download }));
import { TRPCError } from "@trpc/server";
import { registerBlackListPhotoRoutes } from "./blacklistPhotoRoutes";
const key = "00000000-0000-4000-8000-000000000000/7/10.png";
const photo = () => ({ id: 2, blacklist_id: 10, file_key: key, url: `storage://cobrapro-blacklist-private/${key}` });
function setup(p = photo(), parent: any = { id: 10, cadastrado_por_user_id: 7, status: "ativo" }) {
  let handler: any; const app = { get: vi.fn((_path, h) => { handler = h; }) };
  registerBlackListPhotoRoutes(app as any);
  function query(data: any) { const q: any = { select: vi.fn(), eq: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) }; q.select.mockReturnValue(q); q.eq.mockReturnValue(q); q.limit.mockReturnValue(q); return q; }
  const from = vi.fn((table: string) => query(table === "blacklist_fotos" ? p : parent)); mocks.client.mockResolvedValue({ from });
  const res: any = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn(), send: vi.fn(), redirect: vi.fn() }; res.status.mockReturnValue(res);
  return { res, run: (id = "2") => handler({ params: { id }, headers: {} }, res), app, from };
}
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: 8, openId: "local_8", role: "user" }); mocks.entitlement.mockResolvedValue(undefined); mocks.enabled.mockReturnValue(undefined); mocks.download.mockResolvedValue({ buffer: Buffer.from([137,80,78,71]), contentType: "image/png" }); });
afterEach(() => vi.unstubAllEnvs());
describe("GET /api/blacklist/photos/:id", () => {
  it("assinante lê outro owner só nesta blacklist e recebe bytes sem redirect", async () => {
    const t = setup(); await t.run(); expect(t.app.get).toHaveBeenCalledWith("/api/blacklist/photos/:id", expect.any(Function));
    expect(mocks.entitlement).toHaveBeenCalledTimes(2); expect(mocks.download).toHaveBeenCalledWith(key, { userId: 7, blacklistId: 10 });
    expect(t.res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store"); expect(t.res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png");
    expect(t.res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff"); expect(t.res.status).toHaveBeenCalledWith(200); expect(t.res.redirect).not.toHaveBeenCalled();
  });
  it("flag off antes de sessão/DB", async () => {
    mocks.enabled.mockImplementation(() => { throw new TRPCError({ code: "PRECONDITION_FAILED" }); });
    const t = setup(); await t.run(); expect(t.res.status).toHaveBeenCalledWith(412); expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
  });
  it("sessão inválida não lê DB nem storage", async () => {
    mocks.auth.mockRejectedValue(new Error("bad session")); const t = setup(); await t.run(); expect(t.res.status).toHaveBeenCalledWith(401); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("owner/admin sem assinatura não acessa", async () => {
    mocks.auth.mockResolvedValue({ id: 7, role: "admin" }); mocks.entitlement.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    const t = setup(); await t.run(); expect(t.res.status).toHaveBeenCalledWith(403); expect(mocks.download).not.toHaveBeenCalled();
  });
  it("revogação durante download impede resposta de bytes", async () => {
    mocks.entitlement.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new TRPCError({ code: "FORBIDDEN" }));
    const t = setup(); await t.run(); expect(t.res.status).toHaveBeenCalledWith(403); expect(t.res.send).not.toHaveBeenCalled();
  });
  it.each(["0","../2","1.1","2147483648","https://x"]) ("id %s recusado", async id => { const t=setup(); await t.run(id); expect(t.res.status).toHaveBeenCalledWith(400); expect(mocks.download).not.toHaveBeenCalled(); });
  it("legacy público não é seguido/exibido", async () => { const t = setup({ ...photo(), url: "https://public.invalid/photo.png" }); await t.run(); expect(t.res.status).toHaveBeenCalledWith(412); expect(mocks.download).not.toHaveBeenCalled(); });
  it("foto aponta outro pai/objeto não passa", async () => { const t = setup(photo(), { id: 11, cadastrado_por_user_id: 7, status: "ativo" }); await t.run(); expect(t.res.status).toHaveBeenCalledWith(404); expect(mocks.download).not.toHaveBeenCalled(); });
  it("foto resolvida de outro owner deixa consulta compartilhada", async () => { const t = setup(photo(), { id: 10, cadastrado_por_user_id: 7, status: "resolvido" }); await t.run(); expect(t.res.status).toHaveBeenCalledWith(404); });
  it("conteúdo rejeitado pelo storage não vaza mensagem interna", async () => { mocks.download.mockRejectedValue(new Error("token-secret")); const t = setup(); await t.run(); expect(t.res.status).toHaveBeenCalledWith(503); expect(JSON.stringify(t.res.json.mock.calls)).not.toContain("token-secret"); });
});
