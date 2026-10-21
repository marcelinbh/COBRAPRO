import { describe, expect, it } from "vitest";
import { avisoDePendenciasPosPagamento } from "../client/src/lib/pagamentoConfirmado";

describe("aviso operacional de pagamento confirmado", () => {
  it("informa pendência quando a baixa e o Caixa já foram confirmados", () => {
    expect(avisoDePendenciasPosPagamento({
      confirmadoFinanceiro: true,
      pendenciasPosConfirmacao: [{ etapa: "status do contrato", codigo: "status_contrato" }],
    })).toContain("Pagamento confirmado no Caixa");
  });

  it("não gera alerta para confirmação normal ou retorno legado", () => {
    expect(avisoDePendenciasPosPagamento({ confirmadoFinanceiro: true, pendenciasPosConfirmacao: [] })).toBeNull();
    expect(avisoDePendenciasPosPagamento({ success: true })).toBeNull();
  });
});
