import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarDespesaAtomica, pagarDespesaAtomica, estornarDespesaAtomica, type ResultadoDespesa } from "./despesasRpc";

const key = "00000000-0000-4000-8000-000000000001";
const operation = "00000000-0000-4000-8000-000000000002";
const original = "00000000-0000-4000-8000-000000000003";
const base = { userId: 1, idempotencyKey: key };
const criacao = { ...base, descricao: "Nova despesa", valor: "10.01", dataVencimento: "2026-11-07" };
const pagamento = { ...base, despesaId: 9, contaCaixaId: 4, dataPagamento: "2026-11-07" };
const estorno = { ...base, despesaId: 9, pagamentoOperationId: original, dataEstorno: "2026-11-08", motivo: "Devolução real" };
function resultado(acao: ResultadoDespesa["acao"] = "criar"): ResultadoDespesa {
  return {
    success: true, acao, operationId: operation, chaveIdempotencia: key, userId: 1,
    despesaId: 9, status: acao === "criar" ? "pendente" : acao === "pagar" ? "pago" : "cancelado",
    valor: "10.01", contaCaixaId: acao === "criar" ? null : 4, dataVencimento: "2026-11-07",
    dataPagamento: acao === "criar" ? null : "2026-11-07", dataEstorno: acao === "estornar" ? "2026-11-08" : null,
    pagamentoOperationId: acao === "criar" ? null : acao === "pagar" ? operation : original,
    transacaoSaidaId: acao === "criar" ? null : "9007199254740993",
    transacaoEstornoId: acao === "estornar" ? "9007199254740994" : null,
  };
}
const cliente = (data: unknown = resultado(), error: { code: string } | null = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) });
beforeEach(() => vi.stubEnv("ENABLE_RPC_DESPESAS_PROSPECTIVAS", "true"));
afterEach(() => vi.unstubAllEnvs());

describe("despesas RPC prospectivas — fail closed", () => {
  it.each([undefined, "false", "TRUE", "1", ""])("flag %s não permite nenhuma chamada", async flag => {
    if (flag === undefined) delete process.env.ENABLE_RPC_DESPESAS_PROSPECTIVAS;
    else vi.stubEnv("ENABLE_RPC_DESPESAS_PROSPECTIVAS", flag);
    const c = cliente();
    await expect(criarDespesaAtomica(c, criacao)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(pagarDespesaAtomica(c, pagamento)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(estornarDespesaAtomica(c, estorno)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("cria por uma única rpc sem fallback e com owner obrigatório do servidor", async () => {
    const c = cliente();
    await expect(criarDespesaAtomica(c, criacao)).resolves.toEqual(resultado());
    expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledWith("rpc_criar_despesa_prospectiva", {
      p_user_id: 1, p_descricao: "Nova despesa", p_categoria: "outros", p_valor: "10.01", p_data_vencimento: "2026-11-07", p_observacoes: null, p_chave_idempotencia: key,
    });
  });
  it("paga integralmente sem receber valor livre e preserva BIGINTs como strings", async () => {
    const c = cliente(resultado("pagar"));
    const r = await pagarDespesaAtomica(c, pagamento);
    expect(r.transacaoSaidaId).toBe("9007199254740993");
    expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledWith("rpc_pagar_despesa_prospectiva", { p_user_id: 1, p_despesa_id: 9, p_conta_caixa_id: 4, p_data_pagamento: "2026-11-07", p_chave_idempotencia: key });
  });
  it("estorna por operação de pagamento original explícita", async () => {
    const c = cliente(resultado("estornar"));
    await expect(estornarDespesaAtomica(c, estorno)).resolves.toEqual(resultado("estornar"));
    expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledWith("rpc_estornar_despesa_prospectiva", { p_user_id: 1, p_despesa_id: 9, p_pagamento_operation_id: original, p_data_estorno: "2026-11-08", p_motivo: "Devolução real", p_chave_idempotencia: key });
  });
  it.each(["", "não-uuid", undefined])("UUID inválido %s rejeitado sem geração implícita", async idempotencyKey => {
    const c = cliente();
    await expect(criarDespesaAtomica(c, { ...criacao, idempotencyKey: idempotencyKey as string })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER, NaN])("owner inválido %s rejeitado", async userId => {
    const c = cliente();
    await expect(criarDespesaAtomica(c, { ...criacao, userId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each(["0", "-1", "0.001", "1.230", "NaN", Infinity, NaN, "10000000000000", "1e2", "", " 1.00"])("valor %s rejeitado", async valor => {
    const c = cliente();
    await expect(criarDespesaAtomica(c, { ...criacao, valor })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each(["2026-02-30", "2026-11-07T00:00:00Z", "0000-01-01", "07/11/2026", "infinity"])("data não civil %s rejeitada", async dataVencimento => {
    const c = cliente();
    await expect(criarDespesaAtomica(c, { ...criacao, dataVencimento })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("retentativa explícita conserva chave e confirmação exata", async () => {
    const c = cliente();
    const first = await criarDespesaAtomica(c, criacao);
    expect(await criarDespesaAtomica(c, criacao)).toEqual(first);
    expect(c.rpc.mock.calls[0]).toEqual(c.rpc.mock.calls[1]);
  });
  it.each(Object.keys(resultado()))("confirmação sem %s falha fechada", async campo => {
    const data: Record<string, unknown> = { ...resultado() }; delete data[campo];
    await expect(criarDespesaAtomica(cliente(data), criacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it.each([
    { success: false }, { acao: "pagar" }, { operationId: "x" }, { chaveIdempotencia: original }, { userId: 2 },
    { valor: "10.02" }, { valor: null }, { despesaId: "9" }, { status: "paga" }, { dataVencimento: "2026-11-08" },
  ])("rejeita retorno incompatível %j", async patch => {
    await expect(criarDespesaAtomica(cliente({ ...resultado(), ...patch }), criacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it.each([
    { transacaoSaidaId: 123 }, { transacaoSaidaId: null }, { transacaoSaidaId: "-1" }, { transacaoSaidaId: "9223372036854775808" },
    { contaCaixaId: 99 }, { dataPagamento: null }, { pagamentoOperationId: null }, { despesaId: 10 },
  ])("pagamento exige vínculo completo %j", async patch => {
    await expect(pagarDespesaAtomica(cliente({ ...resultado("pagar"), ...patch }), pagamento)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("não confirma estorno com mesma perna ou pagamento diferente", async () => {
    for (const patch of [{ transacaoEstornoId: "9007199254740993" }, { pagamentoOperationId: operation }, { dataEstorno: null }]) {
      await expect(estornarDespesaAtomica(cliente({ ...resultado("estornar"), ...patch }), estorno)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    }
  });
  it.each([["23505", "CONFLICT"], ["23514", "CONFLICT"], ["42501", "NOT_FOUND"], ["PGRST202", "PRECONDITION_FAILED"], ["42P01", "PRECONDITION_FAILED"], ["22023", "BAD_REQUEST"], ["XX000", "INTERNAL_SERVER_ERROR"]])("mapeia %s sem fallback", async (code, expected) => {
    const c = cliente(null, { code });
    await expect(criarDespesaAtomica(c, criacao)).rejects.toMatchObject({ code: expected });
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });
  it("resposta perdida orienta mesma chave sem retry automático", async () => {
    const c = { rpc: vi.fn().mockRejectedValue(new Error("network")) };
    await expect(pagarDespesaAtomica(c, pagamento)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("MESMA chave") });
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });
});
