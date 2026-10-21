import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./storage", () => ({ storagePut: vi.fn() }));

import { blacklistRouter } from "./routers/blacklist";

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

describe("blacklist.removerFoto - isolamento do registro", () => {
  beforeEach(() => mocks.getDb.mockReset());

  it("não remove foto que não pertence ao registro Blacklist autorizado", async () => {
    let condicaoDelete: unknown;
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ cadastradoPorUserId: 10 }]) })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn((condicao: unknown) => {
          condicaoDelete = condicao;
          return { returning: vi.fn().mockResolvedValue([]) };
        }),
      })),
    };
    mocks.getDb.mockResolvedValue(db);

    await expect(blacklistRouter.createCaller(contexto(10)).removerFoto({
      blacklistId: 100,
      fotoId: 999,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const query = new PgDialect().sqlToQuery(condicaoDelete as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(query.sql).toContain('"blacklist_fotos"."id" = $1');
    expect(query.sql).toContain('"blacklist_fotos"."blacklist_id" = $2');
    expect(query.params).toEqual([999, 100]);
  });
});
