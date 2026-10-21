import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
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

function contexto(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
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

describe("contratos.byId - isolamento por empresa", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
    mocks.getSupabaseClientAsync.mockReset();
    mocks.resetDb.mockReset();
  });

  it("restringe a leitura Drizzle ao contrato e cliente da empresa autenticada", async () => {
    let condicao: unknown;
    const limite = vi.fn().mockResolvedValue([]);
    const where = vi.fn((valor: unknown) => {
      condicao = valor;
      return { limit: limite };
    });
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({ where })),
        })),
      })),
    };
    mocks.getDb.mockResolvedValue(db);

    await expect(appRouter.createCaller(contexto(41)).contratos.byId({ id: 99 })).resolves.toBeNull();
    expect(where).toHaveBeenCalledTimes(1);

    const query = new PgDialect().sqlToQuery(condicao as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(query.sql).toContain('"contratos"."id" = $1');
    expect(query.sql).toContain('"contratos"."user_id" = $2');
    expect(query.sql).toContain('"clientes"."user_id" = $3');
    expect(query.params).toEqual([99, 41, 41]);
  });

  it("não atualiza nem consulta parcelas quando o contrato pertence a outra empresa", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const db = {
      update: vi.fn(() => ({ set })),
      select: vi.fn(),
    };
    mocks.getDb.mockResolvedValue(db);

    await expect(appRouter.createCaller(contexto(41)).contratos.editar({
      id: 99,
      valorPrincipal: 1000,
      taxaJuros: "10",
      tipoTaxa: "mensal",
      numeroParcelas: 2,
      dataPrimeiraParcela: "2026-11-01",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});
