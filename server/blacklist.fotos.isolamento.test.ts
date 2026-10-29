import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getSupabaseClientAsync: vi.fn() }));

vi.mock("./db", () => ({ getSupabaseClientAsync: mocks.getSupabaseClientAsync }));
vi.mock("./storage", () => ({ storageGet: vi.fn(), storagePut: vi.fn() }));

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
  beforeEach(() => mocks.getSupabaseClientAsync.mockReset());

  it("não remove foto que não pertence ao registro Blacklist autorizado", async () => {
    const confirmarRegistroProprio = vi.fn().mockResolvedValue({ data: { id: 100 }, error: null });
    const filtroDono = vi.fn(() => ({ maybeSingle: confirmarRegistroProprio }));
    const filtroRegistro = vi.fn(() => ({ eq: filtroDono }));
    const selectRegistro = vi.fn(() => ({ eq: filtroRegistro }));

    const confirmarExclusaoFoto = vi.fn().mockResolvedValue({ data: null, error: null });
    const selecionarFoto = vi.fn(() => ({ maybeSingle: confirmarExclusaoFoto }));
    const filtrarFotoRegistro = vi.fn(() => ({ select: selecionarFoto }));
    const filtrarFotoId = vi.fn(() => ({ eq: filtrarFotoRegistro }));
    const apagarFoto = vi.fn(() => ({ eq: filtrarFotoId }));

    const supabase = {
      from: vi.fn((tabela: string) => tabela === "blacklist"
        ? { select: selectRegistro }
        : { delete: apagarFoto }),
    };
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(blacklistRouter.createCaller(contexto(10)).removerFoto({
      blacklistId: 100,
      fotoId: 999,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(supabase.from).toHaveBeenNthCalledWith(1, "blacklist");
    expect(filtroRegistro).toHaveBeenCalledWith("id", 100);
    expect(filtroDono).toHaveBeenCalledWith("cadastrado_por_user_id", 10);
    expect(supabase.from).toHaveBeenNthCalledWith(2, "blacklist_fotos");
    expect(filtrarFotoId).toHaveBeenCalledWith("id", 999);
    expect(filtrarFotoRegistro).toHaveBeenCalledWith("blacklist_id", 100);
  });
});
