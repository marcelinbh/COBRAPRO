import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cotarRecebimentoLegado, entradaRecebimentoLegadoSchema, normalizarRecebimentoLegado, receberLegadoAtomico, REGRA_RECEBIMENTO_LEGADO } from "./recebimentosLegadosRpc";
const input = { contratoId: 10, parcelaId: 20, contaCaixaId: 30, idempotencyKey: "12345678-1234-4234-8234-123456789012", estadoHash: "a".repeat(64), regra: REGRA_RECEBIMENTO_LEGADO, totalExigido: "100.00", valorRecebido: "100.00", dataPagamento: "2026-11-10" };
const q = { elegivel: true, regra: REGRA_RECEBIMENTO_LEGADO, contratoId: 10, parcelaId: 20, contaCaixaId: 30, totalExigido: "100.00", estadoHash: input.estadoHash, dataPagamento: input.dataPagamento, validadeDataCivil: input.dataPagamento };
const result = { success: true, repetida: false, operationId: input.idempotencyKey, contratoId: 10, parcelaId: 20, contaCaixaId: 30, transacaoCaixaId: "4", valorRecebido: "100.00", totalExigido: "100.00", valorPagoAcumulado: "100.00", saldoResidual: "0.00", status: "paga", contratoStatus: "quitado", dataPagamento: input.dataPagamento, regra: input.regra };
const client = (data: unknown, error: { code: string } | null = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) });
describe("recebimento legado v1 backend-only", () => {
 beforeEach(() => vi.stubEnv("ENABLE_RPC_RECEBIMENTO_LEGADO_VALIDADO", "true"));
 afterEach(() => vi.unstubAllEnvs());
 it("tem gate independente e não cai em RPC/REST antiga", async () => {
  vi.stubEnv("ENABLE_RPC_RECEBIMENTO_LEGADO_VALIDADO", "false"); const c = client(result);
  await expect(receberLegadoAtomico(c, 1, input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(c.rpc).not.toHaveBeenCalled();
 });
 it("exige dinheiro exact-string e entrada estrita sem owner/desconto/mora/mode", () => {
  for (const patch of [{ valorRecebido: 100 }, { valorRecebido: "100.000" }, { valorRecebido: "NaN" }, { totalExigido: "10000000000.00", valorRecebido: "10000000000.00" }, { userId: 1 }, { desconto: 0 }, { modo: "integral" }, { valorRecebido: "99.99" }, { dataPagamento: "2026-02-30" }]) expect(entradaRecebimentoLegadoSchema.safeParse({ ...input, ...patch }).success).toBe(false);
 });
 it("cotação negativa contém somente códigos; não revela snapshot", async () => {
  const c = client({ elegivel: false, motivos: ["CONTA_PROTEGIDA"] });
  expect(await cotarRecebimentoLegado(c, 7, { contratoId: 10, parcelaId: 20, contaCaixaId: 30 })).toEqual({ elegivel: false, motivos: ["CONTA_PROTEGIDA"] });
  expect(c.rpc).toHaveBeenCalledWith("rpc_cotar_recebimento_legado", { p_user_id: 7, p_contrato_id: 10, p_parcela_id: 20, p_conta_caixa_id: 30 });
 });
 it("cotação só aceita IDs, dia/hash e total compatíveis sem campos privados", async () => {
  expect((await cotarRecebimentoLegado(client(q), 1, { contratoId: 10, parcelaId: 20, contaCaixaId: 30 })).elegivel).toBe(true);
  for (const patch of [{ contaCaixaId: 31 }, { validadeDataCivil: "2026-11-11" }, { totalExigido: "0.00" }, { snapshot: {} }]) await expect(cotarRecebimentoLegado(client({ ...q, ...patch }), 1, { contratoId: 10, parcelaId: 20, contaCaixaId: 30 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
 });
 it("owner exclusivamente ctx/backend, strings enviadas sem trim ou arredondamento", async () => {
  const c = client(result); expect(await receberLegadoAtomico(c, 7, input)).toEqual(result);
  expect(c.rpc).toHaveBeenCalledWith("rpc_receber_legado", { p_user_id: 7, p_chave_idempotencia: input.idempotencyKey, p_contrato_id: 10, p_parcela_id: 20, p_conta_caixa_id: 30, p_valor_recebido: "100.00", p_total_exigido: "100.00", p_data_pagamento: input.dataPagamento, p_estado_hash: input.estadoHash, p_regra: input.regra, p_observacoes: null });
 });
 it("confirmação divergiu: nunca sucesso/efeito posterior", () => {
  for (const patch of [{ contaCaixaId: 31 }, { valorRecebido: "99.00" }, { valorPagoAcumulado: "101.00" }, { saldoResidual: "1.00" }, { status: "parcial" }, { dataPagamento: "2026-11-11" }, { transacaoCaixaId: "2147483648" }, { juros: "0.00" }]) expect(() => normalizarRecebimentoLegado({ ...result, ...patch }, input)).toThrow();
 });
 it("repetida mantém mesma resposta após dia e timeout não gera UUID", async () => {
  const c = client({ ...result, repetida: true }); expect((await receberLegadoAtomico(c, 1, input)).repetida).toBe(true);
  const bad = { rpc: vi.fn().mockRejectedValue(new Error("timeout")) }; await expect(receberLegadoAtomico(bad, 1, input)).rejects.toThrow(/mesmo UUID/); expect(bad.rpc).toHaveBeenCalledTimes(1);
 });
 it("erros SQL fail-closed sem detalhes privados", async () => {
  for (const [sql, code] of [["40001", "CONFLICT"], ["23505", "CONFLICT"], ["42501", "NOT_FOUND"], ["55000", "PRECONDITION_FAILED"], ["PGRST202", "PRECONDITION_FAILED"], ["22023", "BAD_REQUEST"]]) await expect(receberLegadoAtomico(client(null, { code: sql }), 1, input)).rejects.toMatchObject({ code });
 });
});
