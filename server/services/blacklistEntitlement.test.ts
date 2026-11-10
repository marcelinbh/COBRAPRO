import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), client: vi.fn(), manual: vi.fn() }));
vi.mock("../db", () => ({ getSupabaseClientAsync: mocks.client }));
vi.mock("./kiwifySubscriptionRuntime", () => ({ resolveVerifiedKiwifyBlacklistEvidence: mocks.resolve }));
vi.mock("./blacklistManualEntitlement", () => ({
  resolveManualLifetimeBlacklistEvidence: mocks.manual,
  MANUAL_LIFETIME_SOURCE: "blacklist:audited-owner-manual-lifetime",
}));
import {
  configureBlacklistEntitlementResolver, requireBlacklistEntitlement,
  type BlacklistSubscriptionEvidence,
} from "./blacklistEntitlement";

const identity = { id: 7, openId: "local_7", role: "user" };
const NOW = Date.parse("2026-11-10T12:00:00Z");
const evidence = (): BlacklistSubscriptionEvidence => ({
  userId: 7, status: "active", validFrom: "2026-10-10T12:00:00Z",
  validUntil: "2026-12-10T12:00:00Z", lifetime: false,
  source: "kiwify:authenticated-webhook+verified-sale",
});
const manualEvidence = (): BlacklistSubscriptionEvidence => ({
  userId: 7, status: "active", validFrom: "2026-11-10T11:00:00Z",
  validUntil: null, lifetime: true, source: "blacklist:audited-owner-manual-lifetime",
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ENABLE_BLACKLIST_PRIVATE", "true");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Rede real proibida no teste"); }));
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  mocks.resolve.mockResolvedValue(evidence());
  mocks.manual.mockResolvedValue(null);
  mocks.client.mockImplementation(() => { throw new Error("Gate não consulta DB diretamente"); });
  configureBlacklistEntitlementResolver();
});
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  configureBlacklistEntitlementResolver();
});

describe("Blacklist exige evidência vigente confiável ou vitalício manual explicitamente auditado", () => {
  it.each([undefined, "false", "TRUE", "1", "", " true", "true "])("flag %s off bloqueia antes das fontes", async flag => {
    vi.stubEnv("ENABLE_BLACKLIST_PRIVATE", flag);
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.manual).not.toHaveBeenCalled();
  });
  it.each([null, undefined, { id: -1 }, { id: 0 }, { id: 1.5 }, { id: NaN }, { id: 2147483648 }, { id: 7, openId: "cron_task" }])("sem sessão/crons não acessam: %j", async user => {
    await expect(requireBlacklistEntitlement(user)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.manual).not.toHaveBeenCalled();
  });
  it("sem concessão explícita preserva o resolver Kiwify com ID servidor", async () => {
    await expect(requireBlacklistEntitlement(identity)).resolves.toBeUndefined();
    expect(mocks.manual.mock.calls).toEqual([[7]]); expect(mocks.resolve.mock.calls).toEqual([[7]]);
    expect(mocks.client).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("configure(undefined) restaura as fontes confiáveis, sem conceder acesso", async () => {
    const override = vi.fn().mockResolvedValue(evidence());
    configureBlacklistEntitlementResolver(override);
    await requireBlacklistEntitlement(identity);
    expect(override.mock.calls).toEqual([[7]]); expect(mocks.manual).not.toHaveBeenCalled();
    configureBlacklistEntitlementResolver(undefined);
    mocks.resolve.mockResolvedValue(null);
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.resolve.mock.calls).toEqual([[7]]); expect(override).toHaveBeenCalledTimes(1);
  });
  it("cadastro, loginMethod Kiwify e admin não substituem concessão ou assinatura", async () => {
    mocks.resolve.mockResolvedValue(null);
    for (const role of ["user", "admin"]) {
      await expect(requireBlacklistEntitlement({ ...identity, role, email: "cadastrado@example.test", loginMethod: "kiwify" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(mocks.resolve).toHaveBeenCalledTimes(2);
  });
  it("falha da fonte manual bloqueia sem fallback e sem vazar erro", async () => {
    mocks.manual.mockRejectedValue(new Error("secret pessoa@example.test raw-payload"));
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED", message: "Não foi possível confirmar sua assinatura. Tente novamente mais tarde.",
    });
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it("falha Kiwify permanece fechada sem concessão manual", async () => {
    mocks.resolve.mockRejectedValue(new Error("secret"));
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it.each([
    "blacklist_access_grants:0023", "manual", "admin", "users:registration", "cadastro", "kiwify",
    "audited synthetic test", "kiwify:authenticated-webhook+verified-sale ",
    " kiwify:authenticated-webhook+verified-sale", "KIWIFY:authenticated-webhook+verified-sale", "",
  ])("nega fonte não exata %s mesmo para admin", async source => {
    mocks.resolve.mockResolvedValue({ ...evidence(), source });
    await expect(requireBlacklistEntitlement({ ...identity, role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each([
    { status: "inactive" }, { status: "cancelled" }, { status: "expired" }, { status: "canceled" },
    { status: "ACTIVE" }, { userId: 8 }, { userId: "7" },
    { validUntil: "2026-11-10T12:00:00Z" }, { validUntil: "2020-01-01T00:00:00Z" },
    { validFrom: "2026-11-10T12:00:01Z" }, { validFrom: "2026-12-11T12:00:00Z" },
    { validUntil: null }, { validUntil: undefined }, { validFrom: null }, { validFrom: undefined },
    { validUntil: "infinity" }, { validFrom: "-infinity" }, { validUntil: "" },
    { validUntil: "2027-02-31T12:00:00Z" }, { validFrom: "2026-02-31T12:00:00Z" },
    { validUntil: "2026-12-10 12:00:00" }, { validFrom: "2026-10-10T12:00:00" },
    { validUntil: "2026-12-10T12:00:00-03:00" }, { source: null }, { source: undefined },
    { lifetime: true }, { lifetime: true, validUntil: "" }, { lifetime: true, validUntil: null },
    { lifetime: undefined }, { lifetime: null }, { lifetime: "false" }, { lifetime: 0 },
  ])("rejeita evidência Kiwify inválida %j", async bad => {
    mocks.resolve.mockResolvedValue({ ...evidence(), ...bad });
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("override de manual genérico não contorna validação da fonte", async () => {
    configureBlacklistEntitlementResolver(async () => ({ ...evidence(), source: "manual", lifetime: true }));
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("aceita início exatamente agora e timestamps UTC explícitos com microssegundos", async () => {
    mocks.resolve.mockResolvedValue({ ...evidence(), validFrom: "2026-11-10T12:00:00.000000+00:00", validUntil: "2026-12-10T12:00:00.000000Z" });
    await expect(requireBlacklistEntitlement(identity)).resolves.toBeUndefined();
  });
  it("revogação Kiwify tem efeito na próxima operação sem cache", async () => {
    await requireBlacklistEntitlement(identity);
    mocks.resolve.mockResolvedValue(null);
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.resolve).toHaveBeenCalledTimes(2);
  });
  it("expiração continua aplicada mesmo com evidência repetida", async () => {
    await requireBlacklistEntitlement(identity);
    vi.mocked(Date.now).mockReturnValue(Date.parse(evidence().validUntil!));
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("vitalício explicitamente auditado não consulta Kiwify nem perde validade com o tempo", async () => {
    mocks.manual.mockResolvedValue(manualEvidence());
    await expect(requireBlacklistEntitlement(identity)).resolves.toBeUndefined();
    vi.mocked(Date.now).mockReturnValue(Date.parse("2050-01-01T00:00:00Z"));
    await expect(requireBlacklistEntitlement(identity)).resolves.toBeUndefined();
    expect(mocks.manual).toHaveBeenCalledTimes(2); expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it("revogação manual é imediata e não contornada por Kiwify", async () => {
    mocks.manual.mockResolvedValue(manualEvidence()); await requireBlacklistEntitlement(identity);
    mocks.manual.mockResolvedValue({ ...manualEvidence(), status: "inactive" });
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it.each([
    { validUntil: "2050-01-01T00:00:00Z" }, { validUntil: "" }, { validUntil: undefined },
    { lifetime: false }, { lifetime: "true" }, { userId: 8 }, { status: "inactive" },
    { validFrom: "2026-11-10T12:00:01Z" }, { validFrom: "2026-02-31T00:00:00Z" },
    { source: "blacklist:audited-owner-manual-lifetime " },
  ])("vitalício inválido não contorna gate %j", async bad => {
    mocks.manual.mockResolvedValue({ ...manualEvidence(), ...bad });
    await expect(requireBlacklistEntitlement(identity)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});
