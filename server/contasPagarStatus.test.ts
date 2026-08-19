import { describe, expect, it } from "vitest";
import { deveRepetirComStatusPagoLegado, normalizarStatusContaPagar } from "./contasPagarStatus";

describe("compatibilidade do status de contas a pagar", () => {
  it("reconhece o erro do check constraint da base legada", () => {
    expect(deveRepetirComStatusPagoLegado({
      message: 'new row for relation "contas_pagar" violates check constraint "contas_pagar_status_check"',
    })).toBe(true);
  });

  it("normaliza pago legado para a interface atual", () => {
    expect(normalizarStatusContaPagar("pago")).toBe("paga");
    expect(normalizarStatusContaPagar("pendente")).toBe("pendente");
  });
});
