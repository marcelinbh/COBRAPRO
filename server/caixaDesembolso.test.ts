import { describe, expect, it } from "vitest";
import { criarDesembolsoContrato, deveRegistrarDesembolso } from "./caixaDesembolso";

describe("desembolso de empréstimo no Caixa", () => {
  it("registra o valor principal como uma saída vinculada ao contrato", () => {
    const movimento = criarDesembolsoContrato({
      contaCaixaId: 7,
      contratoId: 42,
      clienteId: 11,
      userId: 3,
      valorPrincipal: 1500,
      dataTransacao: "2026-08-18T12:00:00.000Z",
    });

    expect(movimento).toMatchObject({
      conta_caixa_id: 7,
      tipo: "saida",
      categoria: "emprestimo_liberado",
      valor: 1500,
      contrato_id: 42,
      cliente_id: 11,
      user_id: 3,
    });
  });

  it("não cria outro desembolso quando o contrato já possui o lançamento", () => {
    expect(deveRegistrarDesembolso(false)).toBe(true);
    expect(deveRegistrarDesembolso(true)).toBe(false);
  });
});
