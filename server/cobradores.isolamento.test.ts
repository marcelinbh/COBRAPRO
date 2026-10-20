import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getSupabaseClientAsync: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getSupabaseClientAsync: mocks.getSupabaseClientAsync,
  resetDb: vi.fn(),
}));

import { appRouter } from "./routers";

function criarContexto(userId: number): TrpcContext {
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

function criarSupabaseDeColetor() {
  const filtros: Array<[string, unknown]> = [];
  const resultado = { data: { id: 88 }, error: null };
  const consulta = {
    eq: vi.fn((campo: string, valor: unknown) => {
      filtros.push([campo, valor]);
      return consulta;
    }),
    select: vi.fn(() => consulta),
    maybeSingle: vi.fn().mockResolvedValue(resultado),
  };
  const update = vi.fn(() => consulta);
  return {
    filtros,
    update,
    from: vi.fn(() => ({ update })),
  };
}

describe("cobradores - isolamento por empresa", () => {
  beforeEach(() => {
    mocks.getDb.mockResolvedValue(null);
    mocks.getSupabaseClientAsync.mockReset();
  });

  it("inclui user_id ao alterar um coletor", async () => {
    const supabase = criarSupabaseDeColetor();
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    const caller = appRouter.createCaller(criarContexto(41));
    await expect(caller.cobradores.update({ id: 88, nome: "Cobrador Seguro" })).resolves.toEqual({ success: true });

    expect(supabase.filtros).toEqual(expect.arrayContaining([
      ["id", 88],
      ["user_id", 41],
    ]));
  });

  it("inclui user_id ao desativar um coletor", async () => {
    const supabase = criarSupabaseDeColetor();
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    const caller = appRouter.createCaller(criarContexto(52));
    await expect(caller.cobradores.delete({ id: 88 })).resolves.toEqual({ success: true });

    expect(supabase.filtros).toEqual(expect.arrayContaining([
      ["id", 88],
      ["user_id", 52],
    ]));
  });
});
