import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ db: vi.fn(), rpc: vi.fn() }));
vi.mock("../db", () => ({ getSupabaseClientAsync: h.db }));
import { multaManualRouter } from "./multaManual";

const KEY = "abcdefab-1234-4234-8234-123456789012";
const OP = "87654321-4321-4321-8321-210987654321";
const HASH = "a".repeat(64);
const caller = (user: any = { id: 41 }) => multaManualRouter.createCaller({ user, req: {}, res: {} } as any);
const capability = { disponivel: true, regra: "multa36_v1", aplicacao: true, recebimento: true, renovacao: true };
const apply = { idcontrato: 10, multa: "12.34", idempotencyKey: KEY, parcelasIds: [20, 21] };
const applied = { success: true, operationId: OP, repetida: false, contratoId: 10, contaCaixaId: 40, parcelasIds: [20, 21], quantidade: 2, valorFixoPorParcela: "12.34", valorMultaTotal: "24.68", dataCivilBrt: "2028-02-29", estado: "exigivel_nao_recebida", trilho: "multa36" };
const query = { contratoId: 10, parcelaId: 20 };
const quote = { ...query, contaCaixaId: 40, elegivel: true, totalExigido: "122.34", multa: "12.34", mora: "0.00", jurosEmbutidos: "10.00", valorPagoAcumulado: "0.00", dataPagamento: "2028-02-29", vencimento: "2028-02-28", status: "atrasada", estadoHash: HASH, regra: "recebimento_multa36_brt_v1" };
const receive = { ...query, idempotencyKey: KEY, valorRecebido: "122.34", totalExigido: "122.34", dataPagamento: "2028-02-29", estadoHash: HASH, modo: "integral" as const };
const received = { ...query, success: true, repetida: false, operationId: OP, transacaoCaixaId: "9007199254740993", contaCaixaId: 40, valorRecebido: "122.34", totalExigido: "122.34", saldoResidual: "0.00", valorPagoAcumulado: "122.34", status: "paga", contratoStatus: "quitado", dataPagamento: "2028-02-29", regra: "recebimento_multa36_brt_v1" };
const renewalQuery = { ...query, novoVencimento: "2028-03-31" };
const renew = { ...renewalQuery, idempotencyKey: KEY, valorRecebido: "22.34", totalExigido: "22.34", dataPagamento: "2028-02-29", estadoHash: HASH };
const renewalQuote = { ...renewalQuery, contaCaixaId: 40, renovavel: true, totalExigido: "22.34", juros: "10.00", multa: "12.34", mora: "0.00", principalPreservado: "100.00", dataPagamento: "2028-02-29", estadoHash: HASH, regra: "renovacao_multa36_brt_v1" };
const renewed = { ...renewalQuery, success: true, repetida: false, operationId: OP, novaParcelaId: 22, transacaoCaixaId: "9007199254740993", contaCaixaId: 40, valorRecebido: "22.34", dataPagamento: "2028-02-29", contratoStatus: "ativo", status: "renovada", regra: "renovacao_multa36_brt_v1" };
const { idempotencyKey, ...payload } = apply;
const recovery = { acao: "multa" as const, idempotencyKey, payload };
const proof = { status: "confirmed", operationId: OP, result: applied, idempotencyKey: KEY, proof: "uuid_fenced36_v1" };
const routes = [
  { name: "aplicar", input: apply, result: applied, rpc: "rpc_aplicar_multa36" },
  { name: "origem", input: query, result: { userId: 41, ...query, trilho: "multa36", status: "atrasada" }, rpc: "rpc_identificar_multa36" },
  { name: "cotar", input: query, result: quote, rpc: "rpc_cotar_multa36" },
  { name: "cotarRenovacao", input: renewalQuery, result: renewalQuote, rpc: "rpc_cotar_renovacao_multa36" },
  { name: "receber", input: receive, result: received, rpc: "rpc_receber_multa36" },
  { name: "renovar", input: renew, result: renewed, rpc: "rpc_renovar_multa36" },
  { name: "reconciliar", input: recovery, result: proof, rpc: "rpc_reconciliar_multa36" },
] as const;
let assertions = 0;
afterEach(() => { assertions += expect.getState().assertionCalls; });
afterAll(() => console.log(`multaManualRouter assertions: ${assertions}`));
beforeEach(() => { vi.clearAllMocks(); h.db.mockResolvedValue({ rpc: h.rpc }); h.rpc.mockResolvedValue({ data: capability, error: null }); });

describe("router multaManual — autenticação real e capacidade fail-closed", () => {
  it("disponibilidade sem sessão recusa antes do getter", async () => {
    await expect(caller(null).disponibilidade()).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each(routes)("$name sem sessão recusa antes do getter/RPC", async r => {
    await expect((caller(null)[r.name] as Function)(r.input)).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("capacidade é da RPC instalada, flags puras não a liberam", async () => {
    expect(await caller().disponibilidade()).toEqual(capability); expect(h.rpc).toHaveBeenCalledOnce(); expect(h.rpc).toHaveBeenCalledWith("rpc_capacidades_multa36", {}); expect(h.db).toHaveBeenCalledOnce();
  });
  it.each(["PGRST202", "42883"])("RPC ausente %s é false, sem fallback", async code => {
    h.rpc.mockResolvedValue({ data: null, error: { code } });
    expect(await caller().disponibilidade()).toEqual({ disponivel: false, regra: "multa36_v1", aplicacao: false, recebimento: false, renovacao: false }); expect(h.rpc).toHaveBeenCalledOnce();
  });
  it.each([null, {}, { ...capability, disponivel: false }, { ...capability, aplicacao: false }, { ...capability, recebimento: false }, { ...capability, renovacao: false }, { ...capability, regra: "multimodal_v1" }, { ...capability, owner: 41 }])("capacidade inválida %j é INTERNAL, não false", async data => {
    h.rpc.mockResolvedValue({ data, error: null }); await expect(caller().disponibilidade()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(h.rpc).toHaveBeenCalledOnce();
  });
  it("getter ausente/rejeitado e transporte não simulam ausência de RPC", async () => {
    h.db.mockResolvedValue(null); await expect(caller().disponibilidade()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(h.rpc).not.toHaveBeenCalled();
    h.db.mockRejectedValue(new Error("private config")); await expect(caller().disponibilidade()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    h.db.mockResolvedValue({ rpc: h.rpc }); h.rpc.mockRejectedValue(new Error("timeout")); await expect(caller().disponibilidade()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("getter que retorna accessor rpc falha INTERNAL, não false", async () => {
    let reads = 0;
    h.db.mockResolvedValue({ get rpc() { reads++; throw new Error("RPC getter"); } });
    await expect(caller().disponibilidade()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(reads).toBe(1);
  });
  it("envelope contraditório/getters não permitem false de ausência SQL", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: "42883" }, success: true });
    await expect(caller().disponibilidade()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    let reads = 0; const response = { data: capability };
    Object.defineProperty(response, "error", { enumerable: true, get() { reads++; return null; } }); h.rpc.mockResolvedValue(response);
    await expect(caller().disponibilidade()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(reads).toBe(0);
  });
});

describe("caller protegido — schema estrito, ownsession e operação única", () => {
  it.each(routes)("$name usa owner somente ctx.user.id e sem flags/fallback", async r => {
    h.rpc.mockResolvedValue({ data: r.result, error: null });
    const result = await (caller()[r.name] as Function)(r.input);
    expect(result).toEqual(r.name === "reconciliar" ? { ...proof, userId: 41, acao: "multa", payload } : r.result);
    expect(h.rpc).toHaveBeenCalledOnce(); expect(h.rpc.mock.calls[0][0]).toBe(r.rpc); expect(h.rpc.mock.calls[0][1].p_user_id).toBe(41);
    expect(h.rpc.mock.calls[0][1]).not.toHaveProperty("p_owner");
  });
  it.each(routes)("$name owner forjado no payload falha schema antes do getter", async r => {
    for (const patch of [{ userId: 99 }, { p_user_id: 99 }, { owner: 99 }]) {
      await expect((caller()[r.name] as Function)({ ...r.input, ...patch })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
    }
  });
  it.each(routes)("$name ownsession rejeita getters/protótipos no input", async r => {
    let reads = 0;
    const input = { ...r.input }; Object.defineProperty(input, "owner", { enumerable: true, get() { reads++; return 99; } });
    await expect((caller()[r.name] as Function)(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect((caller()[r.name] as Function)(Object.assign(Object.create({ userId: 99 }), r.input))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(reads).toBe(0); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("origem owner e IDs são comparados e null nunca é recusa SQL", async () => {
    h.rpc.mockResolvedValue({ data: null, error: null }); expect(await caller().origem(query)).toBeNull();
    for (const patch of [{ userId: 99 }, { contratoId: 11 }, { parcelaId: 21 }]) {
      h.rpc.mockResolvedValue({ data: { userId: 41, ...query, trilho: "multa36", status: "atrasada", ...patch }, error: null }); await expect(caller().origem(query)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    }
    h.rpc.mockResolvedValue({ data: null, error: { code: "42501" } }); await expect(caller().origem(query)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("conflito 40001 não confirma rollback nem renova UUID", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
    await expect(caller().aplicar(apply)).rejects.toMatchObject({ code: "CONFLICT" }); expect(h.rpc).toHaveBeenCalledOnce(); expect(h.rpc.mock.calls[0][1].p_chave_idempotencia).toBe(KEY);
  });
  it("timeout não retry automático e retry explícito conserva o mesmo UUID/payload", async () => {
    h.rpc.mockRejectedValueOnce(new Error("timeout")); await expect(caller().aplicar(apply)).rejects.toThrow(/mesmo UUID\/payload/); expect(h.rpc).toHaveBeenCalledOnce();
    h.rpc.mockResolvedValue({ data: { ...applied, repetida: true }, error: null }); expect(await caller().aplicar(apply)).toMatchObject({ repetida: true });
    expect(h.rpc.mock.calls[0]).toEqual(h.rpc.mock.calls[1]);
  });
  it("reconciliação rejeita família/ciclo anterior e owner/key dentro do payload antes do getter", async () => {
    for (const input of [{ ...recovery, acao: "criar" }, { family: "multimodal_criar", idempotencyKey: KEY, payload }, { ...recovery, family: "multimodal_criar" }, { ...recovery, payload: { ...payload, userId: 41 } }, { ...recovery, payload: { ...payload, idempotencyKey: KEY } }, { ...recovery, acao: "receber" }]) {
      await expect(caller().reconciliar(input as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
    }
  });
  it.each(["multa", "receber", "renovar"] as const)("reconciliação %s envolve owner sessão e valida prova36 precisa", async acao => {
    const input = acao === "multa" ? apply : acao === "receber" ? receive : renew;
    const { idempotencyKey, ...payload } = input;
    const req = { acao, idempotencyKey, payload };
    const p = { ...proof, status: "not_executed", operationId: null, result: null };
    h.rpc.mockResolvedValue({ data: p, error: null });
    expect(await caller().reconciliar(req)).toEqual({ ...p, userId: 41, acao, payload }); expect(h.rpc).toHaveBeenCalledOnce();
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_user_id: 41, p_chave_idempotencia: KEY, p_request: { acao, contratoId: 10 } });
    expect(h.rpc.mock.calls[0][1].p_request).not.toHaveProperty("userId"); expect(h.rpc.mock.calls[0][1].p_request).not.toHaveProperty("idempotencyKey");
    h.rpc.mockResolvedValue({ data: { ...p, proof: "uuid_fenced_v1" }, error: null }); await expect(caller().reconciliar(req)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    h.rpc.mockResolvedValue({ data: { ...p, userId: 99 }, error: null }); await expect(caller().reconciliar(req)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
