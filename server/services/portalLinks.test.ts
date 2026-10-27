import { describe, expect, it, vi } from "vitest";
import { candidatosTokenPortal, consumirLinkPortalNoSupabase, hashTokenPortal, normalizarParcelasPortal } from "./portalLinks";

describe("portalLinks", () => {
  it("gera hash SHA-256 e mantém alternativa somente para links legados", () => {
    const token = "token-publico-de-teste-comprido";
    const hash = hashTokenPortal(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(candidatosTokenPortal(token)).toEqual([hash, token]);
  });

  it("consome o link com operação condicional única", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { cliente_id: 12 }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const gt = vi.fn().mockReturnValue({ select });
    const eq = vi.fn().mockReturnValue({ gt });
    const inFilter = vi.fn().mockReturnValue({ eq });
    const update = vi.fn().mockReturnValue({ in: inFilter });
    const from = vi.fn().mockReturnValue({ update });
    const agora = new Date("2026-10-27T12:00:00.000Z");

    await expect(consumirLinkPortalNoSupabase({ from }, "token-publico-de-teste-comprido", agora)).resolves.toEqual({ clienteId: 12 });
    expect(update).toHaveBeenCalledWith({ usado: true });
    expect(inFilter).toHaveBeenCalledWith("token", candidatosTokenPortal("token-publico-de-teste-comprido"));
    expect(eq).toHaveBeenCalledWith("usado", false);
    expect(gt).toHaveBeenCalledWith("expires_at", agora.toISOString());
    expect(select).toHaveBeenCalledWith("cliente_id");
  });

  it("não devolve cliente quando o link já foi consumido, expirou ou não existe", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle }) }),
            }),
          }),
        }),
      }),
    };
    await expect(consumirLinkPortalNoSupabase(supabase, "token-publico-de-teste-comprido", new Date())).resolves.toBeNull();
  });

  it("remove campos internos das parcelas devolvidas em portal público", () => {
    expect(normalizarParcelasPortal([{
      id: 4,
      numero_parcela: 2,
      numero_parcelas: 10,
      valor_original: "120.00",
      valor_pago: null,
      data_vencimento: "2026-11-10",
      data_pagamento: null,
      status: "pendente",
      user_id: 99,
      conta_caixa_id: 8,
      observacoes: "interno",
    }])).toEqual([{
      id: 4,
      numeroParcela: 2,
      numeroParcelas: 10,
      valorOriginal: "120.00",
      valorPago: null,
      dataVencimento: "2026-11-10",
      dataPagamento: null,
      status: "pendente",
    }]);
  });
});
