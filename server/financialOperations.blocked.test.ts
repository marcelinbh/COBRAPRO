import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getSupabaseClientAsync: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return { ...original, getDb: mocks.getDb, getSupabaseClientAsync: mocks.getSupabaseClientAsync };
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
    mocks.getDb.mockReset();
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

  it("bloqueia exclusão de contratos e de supostas duplicidades antes de apagar o Caixa", async () => {
    const caller = appRouter.createCaller(contextoAutenticado());
    await expectSuspensa(caller.contratos.deletar({ id: 1 }));
    await expectSuspensa(caller.caixa.removerTransacoesDuplicadasDespesa({ ids: [1, 2], manterId: 1 }));
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it("bloqueia a criação e alterações financeiras legadas sem contornar o novo fluxo seguro", async () => {
    const caller = appRouter.createCaller(contextoAutenticado());
    await expectSuspensa(caller.contratos.create({
      clienteId: 1, modalidade: 'mensal', valorPrincipal: 100, taxaJuros: 10,
      numeroParcelas: 1, dataInicio: '2026-11-08', dataVencimentoPrimeira: '2026-12-08', contaCaixaId: 1,
    }));
    await expectSuspensa(caller.contratos.updateStatus({ id: 1, status: 'ativo' }));
    await expectSuspensa(caller.contratos.updateStatus({ id: 1, status: 'cancelado' }));
    await expectSuspensa(caller.contratos.editar({ id: 1, valorPrincipal: 100, taxaJuros: '10', tipoTaxa: 'mensal', numeroParcelas: 1 }));
    await expectSuspensa(caller.contratos.editarJuros({ id: 1, novaTaxa: '20' }));
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it.each(['pagamento_parcela', 'emprestimo_liberado', 'despesa_operacional', 'transferencia_conta', 'ajuste_manual', 'outros'] as const)(
    "não aceita categoria %s como atalho manual para uma operação vinculada",
    async (categoria) => {
      const caller = appRouter.createCaller(contextoAutenticado());
      for (const habilitada of [false, true]) {
        ENV.enableRpcRecebimentoParcela = habilitada;
        for (const tipo of ['entrada', 'saida'] as const) {
          await expectSuspensa(caller.caixa.registrarTransacao({ contaCaixaId: 1, tipo, categoria, valor: 1, descricao: 'Auditoria' }));
        }
      }
      expect(mocks.getDb).not.toHaveBeenCalled();
      expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
    },
  );

  it("bloqueia despesas antigas; schemas40/41 recusam payloads legados antes de mover Caixa", async () => {
    const caller = appRouter.createCaller(contextoAutenticado());
    await expectSuspensa(caller.contasPagar.pagar({ id: 1, contaCaixaId: 1, dataPagamento: '2026-11-08', idempotencyKey: '11111111-1111-4111-8111-111111111111' }));
    await expectSuspensa(caller.contasPagar.estornar({ id: 1, dataEstorno: '2026-11-08', pagamentoOperationId: '22222222-2222-4222-8222-222222222222', motivo: 'Teste de bloqueio', idempotencyKey: '33333333-3333-4333-8333-333333333333' }));
    // Payloads pré40 são inválidos no envelope estrito; nenhum endpoint legado é restaurado.
    for (const legacy of [
      { clienteId: 1, emitente: "Auditoria", valorNominal: 1, dataVencimento: "2026-10-29", taxaDesconto: 1, tipoTaxa: "mensal", contaCaixaId: 1 },
      { id: 1, contaCaixaId: 1 }, { id: 1, motivo: "Auditoria" }, { id: 1 },
    ]) await expect(caller.cheques.executar40(legacy as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // @ts-expect-error Payload legado é deliberadamente inválido no contrato41 fechado.
    await expect(caller.vendasTelefone.pagarParcela({ parcelaId: 1, valorPago: 1, contaCaixaId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // @ts-expect-error Exclusão antiga não substitui o cancelamento compensatório41.
    await expect(caller.vendasTelefone.deletar({ id: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("libera assinatura somente pela RPC42, com owner da sessão e confirmação ligada à intenção", async () => {
    const input = {
      assinaturaId: 1, clienteId: 1, valorPago: "1.00", mesReferencia: "2026-11", contaCaixaId: 1,
      observacoes: null, idempotencyKey: "44444444-4444-4444-8444-444444444444",
    };
    const rpc = vi.fn().mockResolvedValue({
      data: { success: true, regra: "assinaturas42_v1", repetida: false,
        operationId: "55555555-5555-4555-8555-555555555555", idempotencyKey: input.idempotencyKey,
        assinaturaId: 1, clienteId: 1, contaCaixaId: 1, pagamentoId: "1", transacaoCaixaId: "2",
        valorPago: "1.00", mesReferencia: "2026-11", vigenciaAte: "2026-11-30", status: "ativa" },
      error: null,
    });
    const from = vi.fn(() => { throw new Error("Writer REST não permitido"); });
    mocks.getSupabaseClientAsync.mockResolvedValue({ rpc, from });
    await expect(appRouter.createCaller(contextoAutenticado()).assinaturas.registrarPagamento(input))
      .resolves.toMatchObject({ success: true, idempotencyKey: input.idempotencyKey });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("rpc_receber_assinatura42", {
      p_user_id: 999_999, p_chave: input.idempotencyKey, p_assinatura_id: 1, p_cliente_id: 1,
      p_conta_id: 1, p_valor: "1.00", p_mes: "2026-11", p_observacoes: null,
    });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("não reativa o writer legado de assinatura nem aceita owner externo", async () => {
    const caller = appRouter.createCaller(contextoAutenticado());
    await expect(caller.assinaturas.registrarPagamento({
      assinaturaId: 1, clienteId: 1, valorPago: "1.00", mesReferencia: "2026-11", contaCaixaId: 1,
      observacoes: null, idempotencyKey: "44444444-4444-4444-8444-444444444444", userId: 2,
    } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
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
