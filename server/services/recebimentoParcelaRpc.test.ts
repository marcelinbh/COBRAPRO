import { describe, expect, it, vi } from "vitest";
import {
  normalizarResultadoRecebimentoParcelaAtomico,
  registrarPagamentoParcelaAtomico,
} from "./recebimentoParcelaRpc";

const entrada = {
  userId: 41,
  parcelaId: 700,
  contaCaixaId: 800,
  valorPago: 125.5,
  desconto: 0,
  valorJurosCustom: undefined,
  dataPagamento: "2026-10-29",
  observacoes: "  recebimento de auditoria  ",
  idempotencyKey: "0a0a0a0a-0000-4000-8000-000000000041",
};

describe("recebimento atômico por RPC", () => {
  it("envia somente parâmetros do servidor e mapeia a confirmação sem BIGINT de Caixa", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        repetida: false,
        operationId: "11111111-1111-4111-8111-111111111111",
        parcelaId: 700,
        transacaoCaixaId: "9223372036854775807",
        status: "parcial",
        saldoResidual: 74.5,
        valorPagoAcumulado: 125.5,
        dataPagamento: "2026-10-29",
      },
      error: null,
    });

    const resultado = await registrarPagamentoParcelaAtomico({ rpc }, entrada);

    expect(rpc).toHaveBeenCalledWith("rpc_registrar_pagamento_parcela", {
      p_user_id: 41,
      p_parcela_id: 700,
      p_conta_caixa_id: 800,
      p_valor_pago: 125.5,
      p_desconto: 0,
      p_valor_juros_custom: null,
      p_data_pagamento: "2026-10-29",
      p_observacoes: "recebimento de auditoria",
      p_chave_idempotencia: entrada.idempotencyKey,
    });
    expect(resultado).toEqual({
      success: true,
      repetida: false,
      operationId: "11111111-1111-4111-8111-111111111111",
      parcelaId: 700,
      status: "parcial",
      saldoResidual: 74.5,
      valorPagoAcumulado: 125.5,
      dataPagamento: "2026-10-29",
      confirmadoFinanceiro: true,
      pendenciasPosConfirmacao: [],
    });
    expect(resultado).not.toHaveProperty("transacaoCaixaId");
  });

  it("falha antes da RPC quando o valor não respeita centavos", async () => {
    const rpc = vi.fn();
    await expect(registrarPagamentoParcelaAtomico({ rpc }, { ...entrada, valorPago: 1.001 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não trata resposta incompleta como pagamento confirmado", () => {
    expect(() => normalizarResultadoRecebimentoParcelaAtomico({ success: true, parcelaId: 700 }))
      .toThrow("confirmação inválida");
  });

  it("converte negação de tenant da função em resposta sem detalhes SQL", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(registrarPagamentoParcelaAtomico({ rpc }, entrada))
      .rejects.toMatchObject({ code: "NOT_FOUND", message: "Parcela ou conta de Caixa não encontrada para esta empresa." });
  });
});
