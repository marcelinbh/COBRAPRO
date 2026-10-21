import { describe, expect, it } from "vitest";
import { gerarConferenciaCaixa } from "./conferenciaCaixa";

const conta = { id: 1, nome: "Caixa principal", saldo: 100 };

describe("gerarConferenciaCaixa", () => {
  it("aponta parcela paga sem entrada no livro-caixa", () => {
    const resultado = gerarConferenciaCaixa({
      contas: [conta],
      transacoes: [],
      parcelas: [{ id: 10, conta_caixa_id: 1, valor_pago: 250, status: "paga" }],
      despesas: [],
    });

    expect(resultado.resumo.criticas).toBe(1);
    expect(resultado.divergencias[0]).toMatchObject({ tipo: "parcela_sem_entrada", esperado: 250, encontrado: 0 });
  });

  it("aponta despesa paga sem saída no livro-caixa", () => {
    const resultado = gerarConferenciaCaixa({
      contas: [conta],
      transacoes: [],
      parcelas: [],
      despesas: [{ id: 20, conta_caixa_id: 1, descricao: "Energia", valor: 80, status: "paga" }],
    });

    expect(resultado.divergencias[0]).toMatchObject({ tipo: "despesa_sem_saida", esperado: 80, encontrado: 0 });
  });

  it("identifica lançamentos duplicados de uma mesma parcela", () => {
    const resultado = gerarConferenciaCaixa({
      contas: [conta],
      parcelas: [{ id: 10, conta_caixa_id: 1, valor_pago: 250, status: "paga" }],
      despesas: [],
      transacoes: [
        { id: 1, conta_caixa_id: 1, tipo: "entrada", categoria: "pagamento_parcela", parcela_id: 10, valor: 250 },
        { id: 2, conta_caixa_id: 1, tipo: "entrada", categoria: "pagamento_parcela", parcela_id: 10, valor: 250 },
      ],
    });

    expect(resultado.divergencias).toHaveLength(1);
    expect(resultado.divergencias[0]).toMatchObject({ tipo: "movimentos_duplicados", encontrado: 500 });
  });

  it("aceita vários recebimentos legítimos que compõem uma parcela parcial", () => {
    const resultado = gerarConferenciaCaixa({
      contas: [conta],
      parcelas: [{ id: 10, conta_caixa_id: 1, valor_pago: 150, status: "parcial" }],
      despesas: [],
      transacoes: [
        { id: 1, conta_caixa_id: 1, tipo: "entrada", categoria: "pagamento_parcela", parcela_id: 10, valor: 100 },
        { id: 2, conta_caixa_id: 1, tipo: "entrada", categoria: "pagamento_parcela", parcela_id: 10, valor: 50 },
      ],
    });

    expect(resultado.divergencias).toHaveLength(0);
  });

  it("fecha o saldo pelo livro sem alterar nenhum dado de entrada", () => {
    const transacoes = [
      { id: 1, conta_caixa_id: 1, tipo: "entrada" as const, categoria: "outros", valor: 50 },
      { id: 2, conta_caixa_id: 1, tipo: "saida" as const, categoria: "outros", valor: 25 },
    ];
    const resultado = gerarConferenciaCaixa({ contas: [conta], transacoes, parcelas: [], despesas: [] });

    expect(resultado.somenteLeitura).toBe(true);
    expect(resultado.contas[0]).toMatchObject({ saldoBase: 100, entradas: 50, saidas: 25, saldoLivro: 125 });
    expect(transacoes).toHaveLength(2);
  });
});
