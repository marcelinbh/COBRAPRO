import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { client } = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("../db", () => ({ getSupabaseClientAsync: client }));
import { configureBlacklistEntitlementResolver, requireBlacklistEntitlement } from "./blacklistEntitlement";
const identity = { id: 7, openId: "local_7", role: "user" };
const grant = () => ({ user_id: 7, status: "ativo", starts_at: "2020-01-01T00:00:00Z", ends_at: "2099-01-01T00:00:00Z", lifetime: false, evidence: "Sintético aprovado", granted_by: 9 });
function db(data: any = grant(), error: any = null) {
  const query: any = { select: vi.fn(), eq: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.limit.mockReturnValue(query);
  client.mockResolvedValue({ from: vi.fn().mockReturnValue(query) }); return query;
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("ENABLE_BLACKLIST_PRIVATE", "true"); configureBlacklistEntitlementResolver(); });
afterEach(() => { vi.unstubAllEnvs(); configureBlacklistEntitlementResolver(); });
describe("Blacklist SaaS entitlement", () => {
  it.each([undefined, "false", "TRUE", "1", ""]) ("flag %s off é fail-closed antes do banco", async flag => {
    vi.stubEnv("ENABLE_BLACKLIST_PRIVATE", flag);
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(client).not.toHaveBeenCalled();
  });
  it.each([null, { id: -1, openId: "cron_task" }, { id: 7, openId: "cron_task" }])("sem sessão/crons não acessam", async user => {
    await expect(requireBlacklistEntitlement(user)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("usuário cadastrado/admin/kiwify não é assinante sem grant", async () => {
    db(null);
    for (const role of ["user", "admin"]) await expect(requireBlacklistEntitlement({ ...identity, role })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("migration/fonte indisponível bloqueia sem fallback", async () => {
    db(null, { code: "42P01" });
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("grant validado consulta só user_id e tabela SaaS", async () => {
    const q = db(); await expect(requireBlacklistEntitlement(identity)).resolves.toBeUndefined();
    expect(q.eq).toHaveBeenCalledWith("user_id", 7); expect(q.limit).toHaveBeenCalledWith(1);
  });
  it.each([
    { status: "suspenso" }, { status: "revogado" }, { user_id: 8 },
    { ends_at: "2020-01-01T00:00:00Z" }, { starts_at: "2099-01-01T00:00:00Z" },
    { ends_at: null }, { starts_at: null }, { evidence: "" }, { granted_by: null }, { ends_at: "infinity" },
  ])("recusa concessão inválida %j", async bad => {
    db({ ...grant(), ...bad });
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("vitalício somente explícito com ends_at nulo", async () => {
    db({ ...grant(), lifetime: true, ends_at: null }); await expect(requireBlacklistEntitlement(identity)).resolves.toBeUndefined();
    db({ ...grant(), lifetime: true }); await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("revogação tem efeito na próxima operação sem cache", async () => {
    const q = db(); await requireBlacklistEntitlement(identity);
    q.maybeSingle.mockResolvedValue({ data: { ...grant(), status: "revogado" }, error: null });
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
