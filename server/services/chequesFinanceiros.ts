export type TipoTaxaCheque = "diaria" | "semanal" | "quinzenal" | "mensal" | "anual";

const DIAS_POR_PERIODO: Record<TipoTaxaCheque, number> = {
  diaria: 1,
  semanal: 7,
  quinzenal: 15,
  mensal: 30,
  anual: 365,
};

export function dataChequeValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

export function calcularDescontoCheque(params: {
  valorNominal: number;
  taxaPercentual: number;
  tipoTaxa: TipoTaxaCheque;
  diasAteVencimento: number;
}): { valorLiquido: number; valorDesconto: number; taxaDiaria: number } {
  const { valorNominal, taxaPercentual, tipoTaxa, diasAteVencimento } = params;
  if (!Number.isFinite(valorNominal) || valorNominal <= 0) throw new Error("Valor nominal inválido");
  if (!Number.isFinite(taxaPercentual) || taxaPercentual <= 0) throw new Error("Taxa de desconto inválida");
  if (!Number.isInteger(diasAteVencimento) || diasAteVencimento < 0) throw new Error("Vencimento inválido");

  const taxaPorPeriodo = taxaPercentual / 100;
  const taxaDiaria = Math.pow(1 + taxaPorPeriodo, 1 / DIAS_POR_PERIODO[tipoTaxa]) - 1;
  const fatorDesconto = Math.pow(1 + taxaDiaria, diasAteVencimento);
  const valorLiquido = valorNominal / fatorDesconto;
  return { valorLiquido, valorDesconto: valorNominal - valorLiquido, taxaDiaria };
}
