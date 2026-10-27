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

  it("não cria venda com entrada sem conta de Caixa escolhida", async () => {
    mocks.getSupabaseClientAsync.mockResolvedValue({});
    await expect(appRouter.createCaller(contexto()).vendasTelefone.criar(vendaComEntrada))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("Caixa") });
  });

  it("exige uma conta de Caixa antes de aceitar baixa de parcela", async () => {
    await expect(appRouter.createCaller(contexto()).vendasTelefone.pagarParcela({ parcelaId: 12, valorPago: 100 } as any))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
});
