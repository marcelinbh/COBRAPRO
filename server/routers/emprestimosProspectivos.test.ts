import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), db: vi.fn() }));
vi.mock("../db", () => ({ getSupabaseClientAsync: mocks.db }));
import { emprestimosProspectivosRouter } from "./emprestimosProspectivos";
const input = { idempotencyKey: "11111111-1111-4111-8111-111111111111", contratoId: 1, parcelaId: 2, valorRecebido: "50.00", totalExigido: "100.00", dataPagamento: "2026-11-08", estadoHash: "a".repeat(64), modo: "parcial" as const };
const result = { success: true, repetida: false, operationId: "22222222-2222-4222-8222-222222222222", contratoId: 1, parcelaId: 2, transacaoCaixaId: "3", contaCaixaId: 4, valorRecebido: "50.00", totalExigido: "100.00", saldoResidual: "50.00", valorPagoAcumulado: "50.00", status: "parcial", contratoStatus: "ativo", dataPagamento: "2026-11-08", regra: "recebimento_defaults_brt_v1" };
const caller = (user: any = { id: 77 }) => emprestimosProspectivosRouter.createCaller({ user, req: {}, res: {} } as any);
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS", "true"); vi.stubEnv("ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS", "true"); mocks.db.mockResolvedValue({ rpc: mocks.rpc }); mocks.rpc.mockResolvedValue({ data: result, error: null }); });
afterEach(() => vi.unstubAllEnvs());
describe("router prospectivo não alcança legado", () => {
  it("ctx.user.id exclusivo no tenant de recebimento", async () => { expect(await caller().receber(input)).toEqual(result); expect(mocks.rpc.mock.calls[0][1].p_user_id).toBe(77); });
  it.each(["criar", "cotar", "receber"])("autenticação obrigatória %s", async route => { await expect((caller(null) as any)[route](input)).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(mocks.db).not.toHaveBeenCalled(); });
  it("flag ciclo off antes de db", async () => { vi.stubEnv("ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS", undefined); await expect(caller().receber(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(mocks.db).not.toHaveBeenCalled(); });
  it("input não pode enviar userId, conta ou desconto", async () => { for (const extra of [{ userId: 2 }, { contaCaixaId: 1 }, { desconto: 0 }]) await expect(caller().receber({ ...input, ...extra } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(mocks.db).not.toHaveBeenCalled(); });
  it("db ausente nunca REST", async () => { mocks.db.mockResolvedValue(null); await expect(caller().receber(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("disponibilidade não inventa renovação ou precisa banco", async () => { expect(await caller().disponibilidade()).toEqual({ disponivel: true, modalidade: "mensal", regra: "mensal_simples_v1", renovacao: false }); expect(mocks.db).not.toHaveBeenCalled(); });
});
