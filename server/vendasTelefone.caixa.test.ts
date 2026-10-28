import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getSupabaseClientAsync: vi.fn(),
  resetDb: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getSupabaseClientAsync: mocks.getSupabaseClientAsync,
  resetDb: mocks.resetDb,
}));

import { appRouter } from "./routers";

function contexto(): TrpcContext {
  return {
    user: {
      id: 71, openId: "venda-caixa", name: "Empresa teste", email: "teste@example.com",
      loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const vendaComEntrada = {
  marca: "Teste", modelo: "Aparelho", custo: 500, precoVenda: 700,
  entradaPercentual: 20, entradaValor: 140, numParcelas: 3, jurosMensal: 10,
  valorParcela: 205.33, totalJuros: 56, totalAReceber: 756, lucroBruto: 256,
  compradorNome: "Comprador Teste",
};

describe("vendas de telefone e Caixa", () => {
  beforeEach(() => {
    mocks.getDb.mockResolvedValue(null);
    mocks.getSupabaseClientAsync.mockReset();
  });

  it("suspende o cadastro de venda antes de qualquer lançamento financeiro", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue({});
    await expect(appRouter.createCaller(contexto()).vendasTelefone.criar(vendaComEntrada))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("suspende baixa de parcela antes de qualquer lançamento financeiro", async () => {
    await expect(appRouter.createCaller(contexto()).vendasTelefone.pagarParcela({ parcelaId: 12, valorPago: 100, contaCaixaId: 5 }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
});
