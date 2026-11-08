import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cotarEmprestimoProspectivo, entradaRecebimentoProspectivoSchema, normalizarRecebimentoProspectivo, receberEmprestimoProspectivoAtomico, type EntradaRecebimentoProspectivo } from "./cicloEmprestimosRpc";
import { criarEmprestimoProspectivoAtomico } from "./emprestimosRpc";
const input: EntradaRecebimentoProspectivo = { idempotencyKey: "11111111-1111-4111-8111-111111111111", contratoId: 1, parcelaId: 2, valorRecebido: "50.00", totalExigido: "100.00", dataPagamento: "2026-11-08", estadoHash: "a".repeat(64), modo: "parcial" };
const result = () => ({ success: true, repetida: false, operationId: "22222222-2222-4222-8222-222222222222", contratoId: 1, parcelaId: 2, transacaoCaixaId: "3", contaCaixaId: 4, valorRecebido: "50.00", totalExigido: "100.00", saldoResidual: "50.00", valorPagoAcumulado: "50.00", status: "parcial", contratoStatus: "ativo", dataPagamento: "2026-11-08", regra: "recebimento_defaults_brt_v1" });
const quote = () => ({ elegivel: true, contratoId: 1, parcelaId: 2, contaCaixaId: 4, totalExigido: "100.00", multa: "0.00", mora: "0.00", jurosEmbutidos: "10.00", valorPagoAcumulado: "0.00", dataPagamento: "2026-11-08", vencimento: "2026-11-08", status: "pendente", estadoHash: "a".repeat(64), regra: "recebimento_defaults_brt_v1" });
beforeEach(() => { vi.stubEnv("ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS", "true"); vi.stubEnv("ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS", "true"); });
afterEach(() => vi.unstubAllEnvs());
describe("ciclo prospectivo backend-only", () => {
  it.each(["ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS", "ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS"])("duas flags exigidas antes RPC %s", async flag => {
    vi.stubEnv(flag, undefined); const rpc = vi.fn();
    await expect(receberEmprestimoProspectivoAtomico({ rpc }, 1, input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(cotarEmprestimoProspectivo({ rpc }, 1, { contratoId: 1, parcelaId: 2 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(criarEmprestimoProspectivoAtomico({ rpc }, 1, {} as any)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uma RPC, tenant separado, valor exato, sem conta/desconto/browser mora", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result(), error: null });
    expect(await receberEmprestimoProspectivoAtomico({ rpc }, 88, input)).toEqual(result());
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("rpc_receber_emprestimo_prospectivo", { p_user_id: 88, p_chave_idempotencia: input.idempotencyKey, p_contrato_id: 1, p_parcela_id: 2, p_valor_recebido: "50.00", p_total_exigido: "100.00", p_data_pagamento: "2026-11-08", p_estado_hash: input.estadoHash, p_modo: "parcial", p_observacoes: null });
  });
  it("cotação só RPC SQL e conferência IDs", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: quote(), error: null });
    expect(await cotarEmprestimoProspectivo({ rpc }, 77, { contratoId: 1, parcelaId: 2 })).toEqual(quote());
    expect(rpc).toHaveBeenCalledWith("rpc_cotar_emprestimo_prospectivo", { p_user_id: 77, p_contrato_id: 1, p_parcela_id: 2 });
  });
  it.each([{ userId: 1 }, { contaCaixaId: 2 }, { desconto: "0.00" }, { jurosMora: "0.00" }, { valorRecebido: 50 }, { valorRecebido: "50.001" }, { valorRecebido: "0.00" }, { valorRecebido: "NaN" }, { totalExigido: "0.00" }, { modo: "integral" }, { valorRecebido: "100.00" }, { idempotencyKey: "" }, { dataPagamento: "2026-02-29" }, { estadoHash: "aaa" }])("input estrito sem fallback %j", async patch => {
    const rpc = vi.fn(); await expect(receberEmprestimoProspectivoAtomico({ rpc }, 1, { ...input, ...patch } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(rpc).not.toHaveBeenCalled();
  });
  it.each([{ repetida: "false" }, { operationId: "abc" }, { parcelaId: 3 }, { contratoId: 3 }, { valorRecebido: null }, { valorRecebido: 50 }, { totalExigido: "99.00" }, { saldoResidual: "49.99" }, { saldoResidual: "0.00" }, { valorPagoAcumulado: "49.99" }, { status: "paga" }, { contratoStatus: "quitado" }, { dataPagamento: "2026-11-09" }, { transacaoCaixaId: "9223372036854775808" }, { extra: true }])("não confirma resposta adulterada %j", patch => {
    expect(() => normalizarRecebimentoProspectivo({ ...result(), ...patch }, input)).toThrow(/confirma|diverg/i);
  });
  it.each([{ parcelaId: 3 }, { elegivel: false }, { totalExigido: "0.00" }, { status: "paga" }, { estadoHash: "bad" }, { totalExigido: 100 }])("recusa cotação inválida %j", async patch => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...quote(), ...patch }, error: null });
    await expect(cotarEmprestimoProspectivo({ rpc }, 1, { contratoId: 1, parcelaId: 2 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it.each([["22023", "BAD_REQUEST"], ["23505", "CONFLICT"], ["23514", "CONFLICT"], ["40001", "CONFLICT"], ["40P01", "CONFLICT"], ["42501", "NOT_FOUND"], ["PGRST202", "PRECONDITION_FAILED"], ["42883", "PRECONDITION_FAILED"], ["42P01", "PRECONDITION_FAILED"], ["500", "INTERNAL_SERVER_ERROR"]])("erro SQL fechado %s", async (code, expected) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code } }); await expect(receberEmprestimoProspectivoAtomico({ rpc }, 1, input)).rejects.toMatchObject({ code: expected }); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("timeout preserva UUID e payload idênticos em retry", async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({ data: { ...result(), repetida: true }, error: null });
    await expect(receberEmprestimoProspectivoAtomico({ rpc }, 1, input)).rejects.toThrow(/rollback/);
    expect((await receberEmprestimoProspectivoAtomico({ rpc }, 1, input)).repetida).toBe(true);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
  it("integral exige valor exato e schema não inclui desconto", () => {
    expect(entradaRecebimentoProspectivoSchema.safeParse({ ...input, modo: "integral", valorRecebido: "100.00" }).success).toBe(true);
    expect(entradaRecebimentoProspectivoSchema.safeParse({ ...input, desconto: 0 }).success).toBe(false);
  });
});
