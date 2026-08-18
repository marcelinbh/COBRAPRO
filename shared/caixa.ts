export type MovimentoCaixa = {
  tipo: "entrada" | "saida";
  valor: number | string | null | undefined;
};

function paraNumero(valor: number | string | null | undefined): number {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function arredondarCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula o saldo de uma conta a partir do saldo-base e do livro de movimentos.
 * Cada lançamento deve ser contado uma única vez.
 */
export function calcularSaldoAtual(
  saldoBase: number | string | null | undefined,
  movimentos: readonly MovimentoCaixa[],
): number {
  const delta = movimentos.reduce((total, movimento) => {
    const valor = paraNumero(movimento.valor);
    return total + (movimento.tipo === "entrada" ? valor : -valor);
  }, 0);

  return arredondarCentavos(paraNumero(saldoBase) + delta);
}
