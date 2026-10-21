import { describe, expect, it, vi } from "vitest";
import { compensarRenovacaoJuros } from "./services/renovacaoJurosCompensacao";

describe("compensarRenovacaoJuros", () => {
  it("desfaz a parcela nova, o lançamento de caixa e a baixa original", async () => {
    const chamadas: string[] = [];
    await compensarRenovacaoJuros({
      removerParcelaRenovada: async () => { chamadas.push("nova-parcela"); },
      removerLancamentoCaixa: async () => { chamadas.push("caixa"); },
      restaurarParcelaOriginal: async () => { chamadas.push("parcela-original"); },
    });

    expect(chamadas).toEqual(["nova-parcela", "caixa", "parcela-original"]);
  });

  it("restaura caixa e parcela original mesmo quando apagar a nova parcela falha", async () => {
    const removerParcelaRenovada = vi.fn().mockRejectedValue(new Error("erro ao apagar nova parcela"));
    const removerLancamentoCaixa = vi.fn().mockResolvedValue(undefined);
    const restaurarParcelaOriginal = vi.fn().mockResolvedValue(undefined);

    await expect(compensarRenovacaoJuros({
      removerParcelaRenovada,
      removerLancamentoCaixa,
      restaurarParcelaOriginal,
    })).rejects.toThrow("erro ao apagar nova parcela");

    expect(removerLancamentoCaixa).toHaveBeenCalledOnce();
    expect(restaurarParcelaOriginal).toHaveBeenCalledOnce();
  });

  it("compensa somente o lançamento e a baixa se a nova parcela ainda não existe", async () => {
    const removerLancamentoCaixa = vi.fn().mockResolvedValue(undefined);
    const restaurarParcelaOriginal = vi.fn().mockResolvedValue(undefined);

    await compensarRenovacaoJuros({ removerLancamentoCaixa, restaurarParcelaOriginal });

    expect(removerLancamentoCaixa).toHaveBeenCalledOnce();
    expect(restaurarParcelaOriginal).toHaveBeenCalledOnce();
  });
});
