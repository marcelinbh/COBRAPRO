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

function sqlDaCondicao(condicao: unknown) {
  return new PgDialect().sqlToQuery(condicao as Parameters<PgDialect["sqlToQuery"]>[0]);
}

function bancoParaAtualizacao(condicoes: unknown[]) {
  const where = vi.fn((condicao: unknown) => {
    condicoes.push(condicao);
    return Promise.resolve({});
  });
  const set = vi.fn(() => ({ where }));
  return { update: vi.fn(() => ({ set })) };
}

describe("clientes - isolamento por empresa no caminho Drizzle", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
    mocks.getSupabaseClientAsync.mockReset();
    mocks.resetDb.mockReset();
  });

  it("filtra user_id ao editar os dados completos de um cliente", async () => {
    const condicoes: unknown[] = [];
    mocks.getDb.mockResolvedValue(bancoParaAtualizacao(condicoes));

    await expect(appRouter.createCaller(contexto(41)).clientes.update({ id: 900, nome: "Cliente Seguro" })).resolves.toEqual({ success: true });

    const query = sqlDaCondicao(condicoes[0]);
    expect(query.sql).toContain('"clientes"."id" = $1');
    expect(query.sql).toContain('"clientes"."user_id" = $2');
    expect(query.params).toEqual([900, 41]);
  });

  it("filtra user_id ao substituir a lista de documentos de um cliente", async () => {
    const condicoes: unknown[] = [];
    mocks.getDb.mockResolvedValue(bancoParaAtualizacao(condicoes));

    await expect(appRouter.createCaller(contexto(41)).clientes.updateDocumentos({
      id: 901,
      documentosUrls: "[]",
    })).resolves.toEqual({ success: true });

    const query = sqlDaCondicao(condicoes[0]);
    expect(query.sql).toContain('"clientes"."id" = $1');
    expect(query.sql).toContain('"clientes"."user_id" = $2');
    expect(query.params).toEqual([901, 41]);
  });

  it("considera somente contratos ativos da própria empresa ao excluir um cliente", async () => {
    let condicaoConsulta: unknown;
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn((condicao: unknown) => {
            condicaoConsulta = condicao;
            return Promise.resolve([]);
          }),
        })),
      })),
      delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve({})) })),
    };
    mocks.getDb.mockResolvedValue(db);

    await expect(appRouter.createCaller(contexto(41)).clientes.deletar({ id: 902 })).resolves.toEqual({ success: true });

    const query = sqlDaCondicao(condicaoConsulta);
    expect(query.sql).toContain('"contratos"."cliente_id" = $1');
    expect(query.sql).toContain('"contratos"."status" = $2');
    expect(query.sql).toContain('"contratos"."user_id" = $3');
    expect(query.params).toEqual([902, "ativo", 41]);
  });
});
