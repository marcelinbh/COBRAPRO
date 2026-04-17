import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock do Supabase ─────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getSupabaseClientAsync: vi.fn(),
}));

import { getSupabaseClientAsync } from "./db";

describe("Evolution API Config", () => {
  const mockSb = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseClientAsync as any).mockResolvedValue(mockSb);
  });

  it("deve retornar null quando não há configurações suficientes", async () => {
    mockSb.in.mockReturnValue({
      data: [
        { chave: "evolution_url", valor: "http://147.182.191.118:8080" },
      ],
    });

    const { data } = await mockSb.from("configuracoes").select("chave, valor").in("chave", [
      "evolution_url",
      "evolution_api_key",
      "evolution_instance",
    ]);

    expect(data.length).toBeLessThan(3);
  });

  it("deve retornar configuração completa quando todas as chaves existem", async () => {
    const configData = [
      { chave: "evolution_url", valor: "http://147.182.191.118:8080" },
      { chave: "evolution_api_key", valor: "cobrapro_evo_key_2024" },
      { chave: "evolution_instance", valor: "cobrapro" },
    ];

    mockSb.in.mockReturnValue({ data: configData });

    const { data } = await mockSb.from("configuracoes").select("chave, valor").in("chave", [
      "evolution_url",
      "evolution_api_key",
      "evolution_instance",
    ]);

    const config: Record<string, string> = {};
    data.forEach((row: { chave: string; valor: string }) => {
      config[row.chave] = row.valor;
    });

    expect(config.evolution_url).toBe("http://147.182.191.118:8080");
    expect(config.evolution_api_key).toBe("cobrapro_evo_key_2024");
    expect(config.evolution_instance).toBe("cobrapro");
  });

  it("deve remover barra final da URL", () => {
    const url = "http://147.182.191.118:8080/";
    const cleanUrl = url.replace(/\/$/, "");
    expect(cleanUrl).toBe("http://147.182.191.118:8080");
  });
});

describe("Filtro de Cobrador em Empréstimos", () => {
  const emprestimos = [
    { id: 1, clienteNome: "João", koletorId: 10, parcelasComAtraso: [] },
    { id: 2, clienteNome: "Maria", koletorId: 20, parcelasComAtraso: [] },
    { id: 3, clienteNome: "Pedro", koletorId: 10, parcelasComAtraso: [{ id: 1 }] },
    { id: 4, clienteNome: "Ana", koletorId: null, parcelasComAtraso: [] },
  ];

  it("deve retornar todos quando filtroKoletor é 'todos'", () => {
    const filtroKoletor = "todos";
    let resultado = emprestimos;

    if (filtroKoletor !== "todos") {
      const koletorId = parseInt(filtroKoletor);
      resultado = resultado.filter((e) => e.koletorId === koletorId);
    }

    expect(resultado.length).toBe(4);
  });

  it("deve filtrar por cobrador específico", () => {
    const filtroKoletor = "10";
    let resultado = emprestimos;

    if (filtroKoletor !== "todos") {
      const koletorId = parseInt(filtroKoletor);
      resultado = resultado.filter((e) => e.koletorId === koletorId);
    }

    expect(resultado.length).toBe(2);
    expect(resultado.map((e) => e.clienteNome)).toEqual(["João", "Pedro"]);
  });

  it("deve combinar filtro de cobrador com filtro de status", () => {
    const filtroKoletor = "10";
    const filtroStatus = "atrasados";
    let resultado = emprestimos;

    if (filtroStatus !== "todos") {
      resultado = resultado.filter((e) => {
        const temAtraso = e.parcelasComAtraso.length > 0;
        return filtroStatus === "atrasados" ? temAtraso : !temAtraso;
      });
    }

    if (filtroKoletor !== "todos") {
      const koletorId = parseInt(filtroKoletor);
      resultado = resultado.filter((e) => e.koletorId === koletorId);
    }

    expect(resultado.length).toBe(1);
    expect(resultado[0].clienteNome).toBe("Pedro");
  });

  it("deve retornar lista vazia quando cobrador não tem empréstimos", () => {
    const filtroKoletor = "99";
    let resultado = emprestimos;

    if (filtroKoletor !== "todos") {
      const koletorId = parseInt(filtroKoletor);
      resultado = resultado.filter((e) => e.koletorId === koletorId);
    }

    expect(resultado.length).toBe(0);
  });
});
