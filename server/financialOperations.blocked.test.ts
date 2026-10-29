import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseClientAsync: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return { ...original, getSupabaseClientAsync: mocks.getSupabaseClientAsync };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

function contextoAutenticado(): TrpcContext {
  return {
    user: {
      id: 999_999,
      openId: "auditoria-contecao-financeira",
      email: "auditoria@example.invalid",
      name: "Auditoria",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

async function expectSuspensa(operacao: Promise<unknown>) {
  await expect(operacao).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
}

describe("contenção de operações financeiras não atômicas", () => {
  afterEach(() => {
    ENV.enableRpcRecebimentoParcela = false;
    mocks.getSupabaseClientAsync.mockReset();
  });

  it("bloqueia baixas, quitações e alterações de parcelas antes de acessar o banco", async () => {
    const caller = appRouter.createCaller(contextoAutenticado());
    await expectSuspensa(caller.contratos.updateStatus({ id: 1, status: "quitado" }));
    await expectSuspensa(caller.parcelas.registrarPagamento({
      parcelaId: 1, valorPago: 1, contaCaixaId: 1,
      idempotencyKey: "0a0a0a0a-0000-4000-8000-000000000001",
    }));
    await expectSuspensa(caller.parcelas.pagarJuros({ parcelaId: 1, valorJurosPago: 1, contaCaixaId: 1 }));
    await expectSuspensa(caller.parcelas.editarParcela({ parcelaId: 1, novoValor: 1 }));
    await expectSuspensa(caller.parcelas.deletarParcela({ parcelaId: 1 }));
  });

  it("bloqueia despesas, cheques, venda de telefone e assinatura antes de mover Caixa", async () => {
    const caller = appRouter.createCaller(contextoAutenticado());
    await expectSuspensa(caller.contasPagar.pagar({ id: 1, contaCaixaId: 1 }));
    await expectSuspensa(caller.contasPagar.estornar({ id: 1 }));
    await expectSuspensa(caller.cheques.criar({
      clienteId: 1, emitente: "Auditoria", valorNominal: 1, dataVencimento: "2026-10-29",
      taxaDesconto: 1, tipoTaxa: "mensal", contaCaixaId: 1,
    }));
    await expectSuspensa(caller.cheques.compensar({ id: 1, contaCaixaId: 1 }));
    await expectSuspensa(caller.cheques.devolver({ id: 1, motivo: "Auditoria" }));
    await expectSuspensa(caller.cheques.cancelar({ id: 1 }));
    await expectSuspensa(caller.vendasTelefone.pagarParcela({ parcelaId: 1, valorPago: 1, contaCaixaId: 1 }));
    await expectSuspensa(caller.vendasTelefone.deletar({ id: 1 }));
    await expectSuspensa(caller.assinaturas.registrarPagamento({
      assinaturaId: 1, clienteId: 1, valorPago: 1, mesReferencia: "2026-10", contaCaixaId: 1,
    }));
  });

  it("quando liberado, encaminha o recebimento somente para a RPC transacional", async () => {
    ENV.enableRpcRecebimentoParcela = true;
    const rpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        repetida: false,
        operationId: "11111111-1111-4111-8111-111111111111",
        parcelaId: 1,
        status: "paga",
        saldoResidual: 0,
        valorPagoAcumulado: 1,
        dataPagamento: "2026-10-29",
      },
      error: null,
    });
    mocks.getSupabaseClientAsync.mockResolvedValue({ rpc });

    await expect(appRouter.createCaller(contextoAutenticado()).parcelas.registrarPagamento({
      parcelaId: 1,
      valorPago: 1,
      contaCaixaId: 1,
      idempotencyKey: "0a0a0a0a-0000-4000-8000-000000000001",
    })).resolves.toMatchObject({ success: true, confirmadoFinanceiro: true });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("rpc_registrar_pagamento_parcela", expect.objectContaining({
      p_user_id: 999_999,
      p_parcela_id: 1,
      p_conta_caixa_id: 1,
    }));
  });
});
