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

type Resultado = { data: unknown; error: unknown };

function consulta(resultado: Resultado, filtros: Array<[string, unknown]>) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn((campo: string, valor: unknown) => {
      filtros.push([campo, valor]);
      return chain;
    }),
    maybeSingle: vi.fn().mockResolvedValue(resultado),
    single: vi.fn().mockResolvedValue(resultado),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
  };
  return chain;
}

function supabaseComRespostas(respostas: Record<string, Resultado>) {
  const filtros: Record<string, Array<[string, unknown]>> = {};
  const from = vi.fn((tabela: string) => {
    const lista = (filtros[tabela] ??= []);
    return consulta(respostas[tabela] ?? { data: null, error: null }, lista);
  });
  return { from, filtros };
}

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

const contratoInput = {
  clienteId: 900,
  modalidade: "mensal" as const,
  valorPrincipal: 1000,
  taxaJuros: 10,
  tipoTaxa: "mensal" as const,
  numeroParcelas: 1,
  dataInicio: "2026-10-21",
  dataVencimentoPrimeira: "2026-11-21",
  contaCaixaId: 800,
};

describe("operações financeiras - validação de recursos por empresa", () => {
  beforeEach(() => {
    mocks.getDb.mockResolvedValue(null);
    mocks.getSupabaseClientAsync.mockReset();
  });

  it("não cria contrato quando o cliente pertence a outra empresa", async () => {
    const supabase = supabaseComRespostas({ clientes: { data: null, error: null } });
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(appRouter.createCaller(contexto(41)).contratos.create(contratoInput)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(supabase.filtros.clientes).toEqual(expect.arrayContaining([["id", 900], ["user_id", 41]]));
    expect(supabase.from).not.toHaveBeenCalledWith("contratos");
    expect(supabase.from).not.toHaveBeenCalledWith("parcelas");
    expect(supabase.from).not.toHaveBeenCalledWith("transacoes_caixa");
  });

  it("não cria despesa vinculada a uma conta de caixa externa", async () => {
    const supabase = supabaseComRespostas({ contas_caixa: { data: null, error: null } });
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(appRouter.createCaller(contexto(41)).contasPagar.criar({
      descricao: "Despesa de teste",
      categoria: "servicos",
      valor: 100,
      dataVencimento: "2026-10-22",
      contaCaixaId: 800,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(supabase.filtros.contas_caixa).toEqual(expect.arrayContaining([["id", 800], ["user_id", 41]]));
    expect(supabase.from).not.toHaveBeenCalledWith("contas_pagar");
  });

  it("suspende criação de cheque antes de qualquer escrita financeira", async () => {
    const supabase = supabaseComRespostas({});
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(appRouter.createCaller(contexto(41)).cheques.criar({
      clienteId: 900,
      emitente: "Emitente de teste",
      valorNominal: 500,
      dataVencimento: "2026-11-01",
      taxaDesconto: 1,
      contaCaixaId: 800,
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("suspende compensação de cheque antes de qualquer escrita financeira", async () => {
    const supabase = supabaseComRespostas({});
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(appRouter.createCaller(contexto(41)).cheques.compensar({ id: 700, contaCaixaId: 800 }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("suspende recebimento de parcela antes de qualquer escrita financeira", async () => {
    const supabase = supabaseComRespostas({});
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(appRouter.createCaller(contexto(41)).parcelas.registrarPagamento({
      parcelaId: 700,
      valorPago: 100,
      contaCaixaId: 800,
      idempotencyKey: "2c90f2d2-e640-49be-9cfb-ec21102f3c5e",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("suspende renovação de juros antes de qualquer escrita financeira", async () => {
    const supabase = supabaseComRespostas({});
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(appRouter.createCaller(contexto(41)).parcelas.pagarJuros({
      parcelaId: 700,
      valorJurosPago: 100,
      contaCaixaId: 800,
      idempotencyKey: "46a1a4a2-09fb-44ea-9f23-3a9c5a51e5f4",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("suspende pagamento de despesa antes de qualquer escrita financeira", async () => {
    const supabase = supabaseComRespostas({});
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(appRouter.createCaller(contexto(41)).contasPagar.pagar({
      id: 700,
      contaCaixaId: 800,
      idempotencyKey: "19ed02d8-91a8-4b24-89c2-4b9b8f5e0d21",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("não cria histórico ao editar juros de contrato de outra empresa", async () => {
    const supabase = supabaseComRespostas({ contratos: { data: null, error: null } });
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(appRouter.createCaller(contexto(41)).contratos.editarJuros({
      id: 700,
      novaTaxa: "10",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(supabase.filtros.contratos).toEqual(expect.arrayContaining([["id", 700], ["user_id", 41]]));
    expect(supabase.from).not.toHaveBeenCalledWith("contrato_historico");
  });

  it("não aplica multa nem registra histórico em contrato de outra empresa", async () => {
    const supabase = supabaseComRespostas({ contratos: { data: null, error: null } });
    mocks.getSupabaseClientAsync.mockResolvedValue(supabase);

    await expect(appRouter.createCaller(contexto(41)).contratos.aplicarMulta({
      id: 700,
      multa: "5.00",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(supabase.filtros.contratos).toEqual(expect.arrayContaining([["id", 700], ["user_id", 41]]));
    expect(supabase.from).not.toHaveBeenCalledWith("parcelas");
    expect(supabase.from).not.toHaveBeenCalledWith("contrato_historico");
  });
});
