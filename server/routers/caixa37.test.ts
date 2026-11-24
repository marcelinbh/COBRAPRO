import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ db: vi.fn(), rpc: vi.fn() }));
vi.mock("../db", () => ({ getSupabaseClientAsync: h.db }));
import { caixa37Procedures, caixa37Router } from "./caixa37";
import { router } from "../_core/trpc";
import { congelarIntencaoAporte37 } from "../../shared/caixa37";
const KEY = "abcdefab-1234-4234-8234-123456789012", OP = "fedcba98-7654-4321-8123-210987654321", HASH = "a".repeat(64);
const caller = (user: any = { id: 41 }) => caixa37Router.createCaller({ user, req: {}, res: {} } as any);
const capability = { disponivel: true, regra: "caixa37_v1", aporte: true, transferencia: true, recovery: true };
const input = { contaDestinoId: 20, valor: "12.34", dataTransacao: "2028-02-29", estadoHash: HASH, idempotencyKey: KEY };
const transfer = { ...input, contaOrigemId: 10 };
const intent = congelarIntencaoAporte37(input);
const conta = { contaCaixaId: 20, nome: "Destino", saldoBase: "-10.00", entradas: "3.00", saidas: "1.00", saldoEfetivo: "-8.00" };
const quoteInput = { acao: "aporte" as const, contaDestinoId: 20, valor: "12.34" };
const quote = { elegivel: true, regra: "caixa37_brt_v1", ...intent.request, origem: null, destino: conta, saldoOrigemApos: null, saldoDestinoApos: "4.34", saldoTotalOwnerAntes: "100.00", saldoTotalOwnerApos: "112.34" };
const result = { success: true, regra: "caixa37_v1", operationId: OP, idempotencyKey: KEY, repetida: false,
  acao: "aporte", contaOrigemId: null, contaDestinoId: 20, valor: "12.34", dataTransacao: "2028-02-29", descricao: null,
  pernas: [{ papel: "aporte", tipo: "entrada", contaCaixaId: 20, transacaoCaixaId: "123", valor: "12.34" }],
  saldoOrigemAntes: null, saldoOrigemApos: null, saldoDestinoAntes: "-8.00", saldoDestinoApos: "4.34", saldoTotalOwnerAntes: "100.00", saldoTotalOwnerApos: "112.34" };
const tr = { ...result, acao: "transferir", contaOrigemId: 10, saldoOrigemAntes: "0.00", saldoOrigemApos: "-12.34", saldoTotalOwnerApos: "100.00",
  pernas: [{ papel: "origem", tipo: "saida", contaCaixaId: 10, transacaoCaixaId: "124", valor: "12.34" }, { papel: "destino", tipo: "entrada", contaCaixaId: 20, transacaoCaixaId: "125", valor: "12.34" }] };
const proof = { userId: 41, idempotencyKey: KEY, request: intent.request, requestHash: HASH, proof: "uuid_fenced37_v1", status: "confirmed", operationId: OP, result };
const routes = [
  { name: "cotar37", input: quoteInput, result: quote, rpc: "rpc_cotar_caixa37" },
  { name: "aportar37", input, result, rpc: "rpc_aportar_caixa37" },
  { name: "transferir37", input: transfer, result: tr, rpc: "rpc_transferir_caixa37" },
  { name: "reconciliar37", input: intent, result: proof, rpc: "rpc_reconciliar_caixa37" },
] as const;
let assertions = 0;
afterEach(() => { assertions += expect.getState().assertionCalls; });
afterAll(() => console.log(`caixa37Router assertions: ${assertions}`));
beforeEach(() => { vi.clearAllMocks(); h.db.mockResolvedValue({ rpc: h.rpc }); h.rpc.mockResolvedValue({ data: capability, error: null }); });

describe("caixa37Procedures spread e owner autenticado", () => {
  it("exporta apenas cinco protectedProcedures e permite montagem caixa pelo responsável", async () => {
    expect(Object.keys(caixa37Procedures)).toEqual(["capacidades37", "cotar37", "aportar37", "transferir37", "reconciliar37"]);
    const app = router({ caixa: router({ ...caixa37Procedures }) });
    expect(await app.createCaller({ user: { id: 41 }, req: {}, res: {} } as any).caixa.capacidades37()).toEqual(capability);
    expect(h.rpc).toHaveBeenCalledWith("rpc_capacidades_caixa37", {});
    const source = readFileSync(new URL("./caixa37.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/(?:getDb|registrarTransacao|process\.env|featureFlag|\.from\(|\.update\()/);
  });
  it("capacidade sem sessão rejeita antes getter/RPC", async () => {
    await expect(caller(null).capacidades37()).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each(routes)("$name sem sessão recusa antes getter/RPC", async a => {
    await expect((caller(null)[a.name] as Function)(a.input)).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each(routes)("$name owner exclusivamente ctx.user.id, uma RPC", async a => {
    h.rpc.mockResolvedValue({ data: a.result, error: null });
    expect(await (caller()[a.name] as Function)(a.input)).toEqual(a.result); expect(h.db).toHaveBeenCalledOnce(); expect(h.rpc).toHaveBeenCalledOnce();
    expect(h.rpc.mock.calls[0][0]).toBe(a.rpc); expect(h.rpc.mock.calls[0][1].p_user_id).toBe(41); expect(h.rpc.mock.calls[0][1]).not.toHaveProperty("p_owner");
  });
  it.each(routes)("$name owner/empresa/source no input rejeita antes getter", async a => {
    for (const patch of [{ owner: 99 }, { userId: 99 }, { p_user_id: 99 }, { empresaId: 99 }, { source: "rpc" }, { flag: true }]) {
      await expect((caller()[a.name] as Function)({ ...a.input, ...patch })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
    }
  });
  it.each(routes)("$name JSON getters/protótipos recusa sem ler", async a => {
    let reads = 0; const input = { ...a.input }; Object.defineProperty(input, "owner", { enumerable: true, get() { reads++; return 99; } });
    await expect((caller()[a.name] as Function)(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect((caller()[a.name] as Function)(Object.assign(Object.create({ owner: 99 }), a.input))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(reads).toBe(0); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("input DATE/money/IDs/ação inválidos rejeita antes getter", async () => {
    for (const patch of [{ valor: "0.00" }, { valor: 12.34 }, { valor: "10000000000.00" }, { dataTransacao: "2028-02-30" }, { contaDestinoId: 2147483648 }, { idempotencyKey: "bad" }, { estadoHash: "A".repeat(64) }, { descricao: null }, { descricao: undefined }]) { await expect(caller().aportar37({ ...input, ...patch } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled(); }
    await expect(caller().transferir37({ ...transfer, contaOrigemId: 20 })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(h.db).not.toHaveBeenCalled();
  });
});

describe("router37 fail-closed sem ausência presumida", () => {
  it.each(["PGRST202", "42883"])("capacidade false somente RPC ausente %s", async code => {
    h.rpc.mockResolvedValue({ data: null, error: { code } }); expect(await caller().capacidades37()).toEqual({ disponivel: false, regra: "caixa37_v1", aporte: false, transferencia: false, recovery: false }); expect(h.rpc).toHaveBeenCalledOnce();
  });
  it("getter ausente/rejeitado/transport nunca disponibilidade false", async () => {
    h.db.mockResolvedValue(null); await expect(caller().capacidades37()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(h.rpc).not.toHaveBeenCalled();
    h.db.mockRejectedValue(Error("private config")); await expect(caller().capacidades37()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(h.rpc).not.toHaveBeenCalled();
    h.db.mockResolvedValue({ rpc: h.rpc }); h.rpc.mockRejectedValue(Error("timeout")); await expect(caller().capacidades37()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(h.rpc).toHaveBeenCalledOnce();
  });
  it("response/error accessors/contraditório nunca false", async () => {
    let reads = 0; const response = { data: capability }; Object.defineProperty(response, "error", { enumerable: true, get() { reads++; return null; } });
    h.rpc.mockResolvedValue(response); await expect(caller().capacidades37()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(reads).toBe(0);
    h.rpc.mockResolvedValue({ data: null, error: { code: "42883" }, success: true }); await expect(caller().capacidades37()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("mutation timeout/conflict preserva chave sem retry ou quote automático", async () => {
    h.rpc.mockRejectedValueOnce(Error("timeout")); await expect(caller().aportar37(input)).rejects.toThrow(/mesmo UUID\/request/); expect(h.rpc).toHaveBeenCalledOnce();
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "40001" } }); await expect(caller().aportar37(input)).rejects.toMatchObject({ code: "CONFLICT" });
    h.rpc.mockResolvedValueOnce({ data: { ...result, repetida: true }, error: null }); expect(await caller().aportar37(input)).toEqual({ ...result, repetida: true });
    expect(h.rpc).toHaveBeenCalledTimes(3); expect(h.rpc.mock.calls[0]).toEqual(h.rpc.mock.calls[1]); expect(h.rpc.mock.calls[1]).toEqual(h.rpc.mock.calls[2]);
  });
  it("outra empresa eco recovery é recusada e not_executed é apenas fence completo", async () => {
    h.rpc.mockResolvedValue({ data: { ...proof, userId: 42 }, error: null }); await expect(caller().reconciliar37(intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    h.rpc.mockResolvedValue({ data: proof, error: null }); await expect(caller({ id: 42 }).reconciliar37(intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    const fence = { ...proof, status: "not_executed", operationId: null, result: null }; h.rpc.mockResolvedValue({ data: fence, error: null }); expect(await caller().reconciliar37(intent)).toEqual(fence);
    h.rpc.mockResolvedValue({ data: { ...fence, status: null }, error: null }); await expect(caller().reconciliar37(intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(h.rpc.mock.calls.every(([name]) => name === "rpc_reconciliar_caixa37")).toBe(true);
  });
  it("recovery fica disponível sem consultar capacidades/mudar request antigo", async () => {
    const fence = { ...proof, status: "not_executed", operationId: null, result: null }; h.rpc.mockResolvedValue({ data: fence, error: null });
    expect(await caller().reconciliar37(intent)).toEqual(fence); expect(h.rpc).toHaveBeenCalledOnce(); expect(h.rpc).toHaveBeenCalledWith("rpc_reconciliar_caixa37", { p_user_id: 41, p_chave_idempotencia: KEY, p_request: intent.request });
  });
});
