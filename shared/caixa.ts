export type MovimentoCaixa = {
  tipo: "entrada" | "saida";
  valor: number | string | null | undefined;
};

function paraNumero(valor: number | string | null | undefined): number {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Calcula o saldo da conta a partir do saldo-base e do livro de movimentos.
 * Cada lançamento é considerado uma única vez, inclusive ajustes e estornos.
 */
export function calcularSaldoAtual(
  saldoBase: number | string | null | undefined,
  movimentos: readonly MovimentoCaixa[],
): number {
  const saldo = movimentos.reduce((total, movimento) => {
    const valor = paraNumero(movimento.valor);
    return total + (movimento.tipo === "entrada" ? valor : -valor);
  }, paraNumero(saldoBase));
  return Math.round((saldo + Number.EPSILON) * 100) / 100;
}
