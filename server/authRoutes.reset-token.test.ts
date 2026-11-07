import { beforeEach, describe, expect, it, vi } from "vitest";
import { colunaDeConsumoNoSupabase, consumirTokenRecuperacaoNoSupabase, hashTokenDeRecuperacao } from "./authRoutes";

// Estes testes não criam clientes reais nem dependem de credenciais do ambiente.
vi.mock("./db", () => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: {} }));

function adapter(columns: string[] = ["used"], result: unknown = { data: { user_id: 42 }, error: null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const query: any = {
    eq: vi.fn(() => query), gt: vi.fn(() => query),
    select: vi.fn(() => ({ maybeSingle })),
  };
  const update = vi.fn(() => query);
  const probes = vi.fn((column: string) => ({ limit: vi.fn().mockResolvedValue(columns.includes(column)
    ? { data: [], error: null }
    : { data: null, error: { code: "42703", message: "coluna ausente" } }) }));
  const from = vi.fn(() => ({ select: probes, update }));
  return { from, update, query, probes, maybeSingle };
}

beforeEach(() => vi.clearAllMocks());
describe("hashTokenDeRecuperacao", () => {
  it("é determinística, tem SHA-256 e não persiste o token original", () => {
    const token = "a".repeat(64);
    const hash = hashTokenDeRecuperacao(token);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashTokenDeRecuperacao(token)).toBe(hash);
  });
  it("produz hashes diferentes para tokens diferentes", () => {
    expect(hashTokenDeRecuperacao("token-a")).not.toBe(hashTokenDeRecuperacao("token-b"));
  });
});

describe("contrato used/usado e compare-and-set REST legado", () => {
  it.each(["used", "usado"])("resolve somente %s antes de uma única mutação com token/uso/expiração", async (column) => {
    const client = adapter([column]);
    const agora = new Date("2026-10-27T12:00:00.000Z");
    await expect(consumirTokenRecuperacaoNoSupabase(client, "hash-sintetica", agora)).resolves.toBe(42);
    expect(client.probes).toHaveBeenCalledWith("used");
    expect(client.probes).toHaveBeenCalledWith("usado");
    for (const probe of client.probes.mock.results) expect(probe.value.limit).toHaveBeenCalledWith(0);
    expect(client.from).toHaveBeenCalledWith("password_resets");
    expect(client.update).toHaveBeenCalledTimes(1);
    expect(client.update).toHaveBeenCalledWith({ [column]: true });
    expect(client.query.eq).toHaveBeenCalledWith("token", "hash-sintetica");
    expect(client.query.eq).toHaveBeenCalledWith(column, false);
    expect(client.query.gt).toHaveBeenCalledWith("expires_at", agora.toISOString());
    expect(client.query.select).toHaveBeenCalledWith("user_id");
    expect(client.update.mock.invocationCallOrder[0]).toBeGreaterThan(client.probes.mock.invocationCallOrder[1]);
  });
  it.each([{ columns: [] }, { columns: ["used", "usado"] }])("ausência/ambiguidade falha sem tentar uma mutação", async ({ columns }) => {
    const client = adapter(columns);
    await expect(consumirTokenRecuperacaoNoSupabase(client, "hash", new Date())).rejects.toThrow("Contrato");
    expect(client.update).not.toHaveBeenCalled();
  });
  it.each(["42501", "PGRST204", "PGRST205", "42P01", "08006"])("não interpreta erro %s como schema legado", async (code) => {
    const client = adapter();
    client.probes.mockImplementation(() => ({ limit: vi.fn().mockResolvedValue({ data: null, error: { code } }) }));
    await expect(colunaDeConsumoNoSupabase(client)).rejects.toThrow("Contrato");
    expect(client.update).not.toHaveBeenCalled();
  });
  it("não aceita resposta malformada do probe", async () => {
    const client = adapter();
    client.probes.mockImplementation(() => ({ limit: vi.fn().mockResolvedValue({ data: [{}], error: null }) }));
    await expect(colunaDeConsumoNoSupabase(client)).rejects.toThrow("Contrato");
  });
  it("não aceita token já consumido, expirado ou inexistente", async () => {
    const client = adapter(["used"], { data: null, error: null });
    await expect(consumirTokenRecuperacaoNoSupabase(client, "hash", new Date())).resolves.toBeNull();
    expect(client.update).toHaveBeenCalledTimes(1);
  });
  it("não repete uma mutação após erro e não expõe a mensagem do banco", async () => {
    const client = adapter(["used"], { data: null, error: { code: "42703", message: "dados-sinteticos-nao-registrar" } });
    await expect(consumirTokenRecuperacaoNoSupabase(client, "hash", new Date())).rejects.toThrow("Não foi possível consumir");
    expect(client.update).toHaveBeenCalledTimes(1);
  });
  it.each([{}, { userId: 42 }, { user_id: "42" }, { user_id: -1 }])("não aceita usuário retornado malformado", async (data) => {
    const client = adapter(["used"], { data, error: null });
    await expect(consumirTokenRecuperacaoNoSupabase(client, "hash", new Date())).rejects.toThrow("Resposta inválida");
  });
});
