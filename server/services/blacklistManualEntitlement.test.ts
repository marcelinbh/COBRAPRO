import { describe, expect, it, vi } from "vitest";
import { resolveManualLifetimeBlacklistEvidence, MANUAL_LIFETIME_AUTHORIZATION, MANUAL_LIFETIME_SOURCE } from "./blacklistManualEntitlement";

const row = () => ({ user_id: 7, status: "ativo", starts_at: "2026-11-10T12:00:00.000000+00:00", ends_at: null,
  lifetime: true, granted_by: 1, evidence: MANUAL_LIFETIME_AUTHORIZATION });
function setup(data: unknown = row(), error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const limit = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getClient = vi.fn().mockResolvedValue({ from });
  return { maybeSingle, limit, eq, select, from, getClient,
    resolve: (id = 7) => resolveManualLifetimeBlacklistEvidence(id, { getClient }) };
}
describe("concessões vitalícias manuais explícitas e somente leitura", () => {
  it("consulta apenas concessão do ID da sessão e não expõe evidência/motivo", async () => {
    const s = setup();
    const result = await s.resolve();
    expect(s.from).toHaveBeenCalledWith("blacklist_access_grants");
    expect(s.select).toHaveBeenCalledWith("user_id,status,starts_at,ends_at,lifetime,granted_by,evidence");
    expect(s.eq).toHaveBeenCalledWith("user_id", 7); expect(s.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual({ userId: 7, status: "active", validFrom: "2026-11-10T12:00:00.000Z", validUntil: null, lifetime: true, source: MANUAL_LIFETIME_SOURCE });
    expect(result).not.toHaveProperty("evidence"); expect(result).not.toHaveProperty("granted_by");
  });
  it("sem concessão não inventa assinatura para cadastro novo", async () => {
    const s = setup(null); expect(await s.resolve(99)).toBeNull(); expect(s.eq).toHaveBeenCalledWith("user_id",99);
  });
  it.each(["suspenso", "revogado"])("status %s é inativo mesmo sendo vitalício", async status => {
    const s = setup({ ...row(), status }); expect(await s.resolve()).toMatchObject({ status: "inactive" });
  });
  it("revalida a cada acesso sem cache", async () => {
    const s = setup(); await s.resolve(); s.maybeSingle.mockResolvedValue({ data: { ...row(), status: "revogado" }, error: null });
    expect(await s.resolve()).toMatchObject({ status: "inactive" }); expect(s.maybeSingle).toHaveBeenCalledTimes(2);
  });
  it.each(["manual", "owner-confirmed:manual-lifetime:2026-11-10 ", "owner-confirmed:manual-lifetime:2026-11-11", "kiwify", "admin"])("procedência %s não substitui autorização exata", async evidence => {
    expect(await setup({ ...row(), evidence }).resolve()).toBeNull();
  });
  it.each([
    { user_id: 8 }, { user_id: "7" }, { granted_by: 0 }, { granted_by: "1" },
    { evidence: null }, { evidence: undefined }, { status: "active" }, { status: null },
    { lifetime: false }, { lifetime: "true" }, { lifetime: undefined },
    { ends_at: "2050-01-01T00:00:00Z" }, { ends_at: undefined },
    { starts_at: "infinity" }, { starts_at: null }, { starts_at: "2026-02-31T00:00:00Z" },
    { starts_at: "2026-11-10T12:00:00-03:00" }, { starts_at: "2026-11-10 12:00:00" },
  ])("recusa contrato inválido %j", async patch => {
    await expect(setup({ ...row(), ...patch }).resolve()).rejects.toThrow();
  });
  it.each([[], "x", 7, true, undefined])("recusa linha inválida %j", async data => {
    const s = setup(); s.maybeSingle.mockResolvedValue({ data, error: null }); await expect(s.resolve()).rejects.toThrow();
  });
  it("erro REST não é traduzido em concessão ausente", async () => {
    await expect(setup(null, { message: "private" }).resolve()).rejects.toThrow("unavailable");
  });
  it("erro e ausência de cliente não abrem acesso", async () => {
    await expect(resolveManualLifetimeBlacklistEvidence(7, { getClient: async () => null })).rejects.toThrow("unavailable");
  });
  it.each([0, -1, 7.5, NaN, Infinity, 2147483648])("ID %s inválido não consulta banco", async id => {
    const s = setup(); await expect(s.resolve(id)).rejects.toThrow("identity"); expect(s.getClient).not.toHaveBeenCalled();
  });
});
