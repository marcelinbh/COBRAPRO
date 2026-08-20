import { describe, expect, it } from "vitest";
import { criarDesembolsoContrato, deveRegistrarDesembolso } from "./caixaDesembolso";

describe("desembolso de empréstimo no Caixa", () => {
  it("registra o valor principal como uma saída vinculada ao contrato", () => {
    const movimento = criarDesembolsoContrato({
      contaCaixaId: 7,
      contratoId: 42,
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
      user_id: 3,
    });
  });

  it("não cria outro desembolso quando o contrato já possui o lançamento", () => {
    expect(deveRegistrarDesembolso(false)).toBe(true);
    expect(deveRegistrarDesembolso(true)).toBe(false);
  });

  it("mantém o vínculo obrigatório entre o desembolso e a conta selecionada", () => {
    const movimento = criarDesembolsoContrato({
      contaCaixaId: 24,
      contratoId: 322,
      userId: 1,
      valorPrincipal: 1000,
    });

    expect(movimento.conta_caixa_id).toBe(24);
    expect(movimento.valor).toBe(1000);
  });
});
