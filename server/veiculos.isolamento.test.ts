import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { veiculosRouter } from "./routers/veiculos";

function contexto(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `empresa-${userId}`,
      email: `empresa${userId}@exemplo.com`,
      name: `Empresa ${userId}`,
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function consultaSemResultado() {
  const limit = vi.fn().mockResolvedValue([]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where, innerJoin: vi.fn(() => ({ where })) }));
  return { select: vi.fn(() => ({ from })), from, where, limit };
}

describe("veiculos - isolamento por empresa", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
  });

  it("não cria veículo com cliente de outra empresa", async () => {
    const consulta = consultaSemResultado();
    const db = { ...consulta, insert: vi.fn() };
    mocks.getDb.mockResolvedValue(db);

    await expect(veiculosRouter.createCaller(contexto(10)).criar({
      clienteId: 900,
      placa: "ABC1D23",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.insert).not.toHaveBeenCalled();
  });

  it("não remove parcelas antes de confirmar o veículo da empresa", async () => {
    const consulta = consultaSemResultado();
    const db = { ...consulta, delete: vi.fn() };
    mocks.getDb.mockResolvedValue(db);

    await expect(veiculosRouter.createCaller(contexto(10)).deletar({ id: 800 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.delete).not.toHaveBeenCalled();
  });

  it("não paga parcela vinculada a veículo de outra empresa", async () => {
    const consulta = consultaSemResultado();
    const db = { ...consulta, update: vi.fn() };
    mocks.getDb.mockResolvedValue(db);

    await expect(veiculosRouter.createCaller(contexto(10)).pagarParcela({
      parcelaId: 700,
      valorPago: 250,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.update).not.toHaveBeenCalled();
  });
});
