import { afterEach, describe, expect, it, vi } from "vitest";
import { executarEfeitosPosConfirmacao } from "./efeitosPosConfirmacaoFinanceira";

describe("efeitos após confirmação financeira", () => {
  afterEach(() => vi.restoreAllMocks());

  it("registra a pendência e continua os efeitos seguintes sem desfazer o pagamento", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const concluirIdempotencia = vi.fn().mockResolvedValue(undefined);

    const pendencias = await executarEfeitosPosConfirmacao([
      {
        etapa: "status do contrato",
        codigo: "status_contrato",
        executar: async () => { throw new Error("timeout temporário"); },
      },
      {
        etapa: "idempotência da operação",
        codigo: "idempotencia_pendente",
        executar: concluirIdempotencia,
      },
    ]);

    expect(pendencias).toEqual([{ etapa: "status do contrato", codigo: "status_contrato" }]);
    expect(concluirIdempotencia).toHaveBeenCalledTimes(1);
  });

  it("não cria pendência quando todos os efeitos derivados são confirmados", async () => {
    const pendencias = await executarEfeitosPosConfirmacao([
      { etapa: "histórico", codigo: "historico_contrato", executar: async () => undefined },
      { etapa: "auditoria", codigo: "auditoria_financeira", executar: async () => undefined },
    ]);

    expect(pendencias).toEqual([]);
  });
});
