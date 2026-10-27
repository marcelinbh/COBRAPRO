import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseClientAsync } = vi.hoisted(() => ({ getSupabaseClientAsync: vi.fn() }));
vi.mock("../db", () => ({ getSupabaseClientAsync }));
vi.mock("../storage", () => ({ storageGet: vi.fn(), storagePut: vi.fn() }));
vi.mock("../uploadSecurity", () => ({ validarFotoBlacklist: vi.fn() }));

import { blacklistRouter } from "./blacklist";

function contexto() {
  return {
    user: {
      id: 7,
      openId: "teste",
      name: "Empresa teste",
      email: "teste@example.com",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as any,
    res: {} as any,
  };
}

describe("blacklist.consultar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recusa nome, documento fragmentado e CPF inválido antes de consultar o banco", async () => {
    const caller = blacklistRouter.createCaller(contexto());
    await expect(caller.consultar({ busca: "Maria" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.consultar({ busca: "529982" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.consultar({ busca: "52998224724" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it("consulta somente documento exato e devolve DTO mascarado", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{
        id: 10,
        cpf_cnpj: "52998224725",
        nome: "Maria da Silva",
        cidade: "São Paulo",
        estado: "SP",
        tipo_divida: "emprestimo",
        status: "ativo",
        telefone: "11999999999",
        endereco: "Rua privada",
        valor_divida: "900.00",
        observacoes: "não expor",
      }],
      error: null,
    });
    const inStatus = vi.fn().mockReturnValue({ limit });
    const eqDocumento = vi.fn().mockReturnValue({ in: inStatus });
    const select = vi.fn().mockReturnValue({ eq: eqDocumento });
    const from = vi.fn().mockReturnValue({ select });
    getSupabaseClientAsync.mockResolvedValue({ from });

    const caller = blacklistRouter.createCaller(contexto());
    const resultado = await caller.consultar({ busca: "529.982.247-25" });

    expect(select).toHaveBeenCalledWith("id, cpf_cnpj, nome, cidade, estado, tipo_divida, status");
    expect(eqDocumento).toHaveBeenCalledWith("cpf_cnpj", "52998224725");
    expect(inStatus).toHaveBeenCalledWith("status", ["ativo", "em_negociacao"]);
    expect(resultado).toEqual([{
      id: 10,
      nome: "Maria D** S****",
      documentoMascarado: "***.***.***-25",
      cidade: "São Paulo",
      estado: "SP",
      tipoDivida: "emprestimo",
      status: "ativo",
    }]);
    expect(JSON.stringify(resultado)).not.toContain("telefone");
    expect(JSON.stringify(resultado)).not.toContain("Rua privada");
    expect(JSON.stringify(resultado)).not.toContain("900.00");
  });
});
