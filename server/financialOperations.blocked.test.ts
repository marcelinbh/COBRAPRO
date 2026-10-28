import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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
  it("bloqueia baixas, quitações e alterações de parcelas antes de acessar o banco", async () => {
    const caller = appRouter.createCaller(contextoAutenticado());
    await expectSuspensa(caller.contratos.updateStatus({ id: 1, status: "quitado" }));
    await expectSuspensa(caller.parcelas.registrarPagamento({ parcelaId: 1, valorPago: 1, contaCaixaId: 1 }));
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
});
