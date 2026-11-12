export type MovimentoCaixa = {
  tipo: "entrada" | "saida";
  valor: number | string | null | undefined;
};

function paraCentavos(valor: number | string | null | undefined): bigint {
  // Compatibilidade do helper para soma vazia. As consultas de livro validam
  // linhas reais; valores não finitos ou inválidos nunca viram zero silencioso.
  if (valor === null || valor === undefined) return BigInt(0);
  if (typeof valor === "number" && !Number.isFinite(valor)) throw new Error("Valor inválido no livro-caixa");
  const text = String(valor).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error("Valor inválido ou precisão incompatível no livro-caixa");
  const cents = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0") || "0");
  return match[1] === "-" ? -cents : cents;
}

function saldoEmCentavos(
  saldoBase: number | string | null | undefined,
  movimentos: readonly MovimentoCaixa[],
): bigint {
  let saldo = paraCentavos(saldoBase);
  for (const movimento of movimentos) {
    if (movimento.tipo !== "entrada" && movimento.tipo !== "saida") throw new Error("Direção inválida no livro-caixa");
    const valor = paraCentavos(movimento.valor);
    if (valor < BigInt(0)) throw new Error("Lançamento negativo no livro-caixa");
    saldo += movimento.tipo === "entrada" ? valor : -valor;
  }
  return saldo;
}

/** Transporte decimal exato, inclusive para acumulados maiores que MAX_SAFE_INTEGER. */
export function calcularSaldoAtualDecimal(
  saldoBase: number | string | null | undefined,
  movimentos: readonly MovimentoCaixa[],
): string {
  const saldo = saldoEmCentavos(saldoBase, movimentos);
  const negative = saldo < BigInt(0);
  const absolute = negative ? -saldo : saldo;
  return `${negative ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}

/** Calcula cada lançamento uma única vez. A API numérica existente é preservada
 * somente quando o resultado em centavos pode fazer round-trip sem perda.
 * Acumulados intermediários grandes e estornos nunca usam floats.
 */
export function calcularSaldoAtual(
  saldoBase: number | string | null | undefined,
  movimentos: readonly MovimentoCaixa[],
): number {
  const decimal = calcularSaldoAtualDecimal(saldoBase, movimentos);
  const result = Number(decimal);
  if (!Number.isFinite(result) || paraCentavos(result) !== paraCentavos(decimal)) {
    throw new Error("Saldo exige transporte decimal exato; representação numérica insegura");
  }
  return result;
}
