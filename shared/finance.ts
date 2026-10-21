// Helpers financeiros compartilhados entre frontend e backend
const TIME_ZONE_BRASILIA = "America/Sao_Paulo";

function dataCivilBrasilia(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  // Datas de vencimento históricas chegam como YYYY-MM-DDT00:00:00.
  // Nesse caso preservamos a data civil original, sem deslocá-la para o dia anterior no fuso BRT.
  if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0) {
    return value.toISOString().slice(0, 10);
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE_BRASILIA, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function diferencaDiasCivis(inicio: string, fim: string): number {
  return Math.round((new Date(`${fim}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 86_400_000);
}

/**
 * Calcula juros de mora e multa por atraso.
 *
 * MODELO CobraFácil (padrão do sistema):
 * - multaDiariaReais: valor fixo em R$ por dia de atraso (ex: R$ 100/dia)
 *   Configurável pelo usuário em Configurações > Multa Diária
 * - multaAtrasoPercentual: % aplicado UMA VEZ sobre o valor original no 1º dia de atraso
 *
 * @param valorOriginal - Valor da parcela sem juros/multa
 * @param dataVencimento - Data de vencimento da parcela
 * @param dataPagamento - Data do pagamento (ou data atual para cálculo)
 * @param multaDiariaReais - Valor em R$ por dia de atraso (padrão: 0 = sem multa diária)
 * @param multaAtrasoPercentual - % de multa única no 1º dia (padrão: 0)
 */
export function calcularJurosMora(
  valorOriginal: number,
  dataVencimento: Date,
  dataPagamento: Date,
  multaDiariaReais: number = 0,
  multaAtrasoPercentual: number = 0
): { juros: number; multa: number; total: number; diasAtraso: number } {
  // A multa só nasce à 00:00 do dia seguinte ao vencimento em Brasília.
  // Comparar DATEs civis evita que UTC/servidor antecipe a cobrança às 21h BRT.
  const vencimento = dataCivilBrasilia(dataVencimento);
  const pagamento = dataCivilBrasilia(dataPagamento);
  const diasAtraso = Math.max(0, diferencaDiasCivis(vencimento, pagamento));

  if (diasAtraso === 0) {
    return { juros: 0, multa: 0, total: valorOriginal, diasAtraso: 0 };
  }

  // Multa única (% sobre o valor original, aplicada no 1º dia)
  const multa = multaAtrasoPercentual > 0
    ? Math.round(valorOriginal * (multaAtrasoPercentual / 100) * 100) / 100
    : 0;

  // Juros diários = R$/dia × número de dias (valor absoluto configurado pelo usuário)
  const juros = Math.round(multaDiariaReais * diasAtraso * 100) / 100;

  const total = Math.round((valorOriginal + multa + juros) * 100) / 100;

  return { juros, multa, total, diasAtraso };
}

export function calcularParcelasPrice(
  principal: number,
  taxaMensal: number,
  numParcelas: number
): number {
  if (taxaMensal === 0) return principal / numParcelas;
  const i = taxaMensal / 100;
  const parcela = principal * (i * Math.pow(1 + i, numParcelas)) / (Math.pow(1 + i, numParcelas) - 1);
  return Math.round(parcela * 100) / 100;
}

/**
 * Cálculo padrão amortizado (juros simples sobre o total)
 * Modelo CobraFácil: capital × taxa × n_parcelas = juros total
 * Valor por parcela = (capital + juros_total) / n_parcelas
 * Exemplo: R$ 500, 50%, 3 parcelas → parcela = (500 + 750) / 3 = R$ 416,67
 */
export function calcularParcelaPadrao(
  principal: number,
  taxaMensal: number,
  numParcelas: number
): number {
  const jurosTotal = principal * (taxaMensal / 100) * numParcelas;
  return Math.round(((principal + jurosTotal) / numParcelas) * 100) / 100;
}

/**
 * Cálculo para Empréstimo Diário (taxa única sobre o total)
 * Total = capital × (1 + taxa/100)
 * Parcela = Total ÷ número de parcelas
 * Exemplo: R$300, 100%, 15 parcelas → total = R$600, parcela = R$40
 */
export function calcularParcelaDiario(
  principal: number,
  taxa: number,
  numParcelas: number
): number {
  const total = Math.round(principal * (1 + taxa / 100) * 100) / 100;
  return Math.round((total / numParcelas) * 100) / 100;
}

/**
 * Cálculo bullet/renovável (modelo Cobra Fácil)
 * Cada parcela = principal × (1 + taxa/100)
 * Cliente pode pagar total (capital + juros) ou só os juros e renovar
 * Usado para empréstimos quinzenais, semanais, diários com 1 parcela
 */
export function calcularParcelaBullet(
  principal: number,
  taxa: number  // taxa do período (ex: 50 = 50%)
): { valorParcela: number; valorJuros: number; valorTotal: number } {
  const valorJuros = Math.round(principal * (taxa / 100) * 100) / 100;
  const valorParcela = Math.round((principal + valorJuros) * 100) / 100;
  return { valorParcela, valorJuros, valorTotal: valorParcela };
}

/**
 * Calcula o saldo residual de um pagamento parcial.
 * Quando o cliente paga menos do que o valor original, o saldo restante
 * deve ser transferido para a próxima parcela.
 *
 * @param valorOriginal - Valor original da parcela
 * @param valorPago - Valor efetivamente pago
 * @param saldoResidualAnterior - Saldo residual que veio da parcela anterior (default: 0)
 * @returns saldoRestante - Valor que ainda falta pagar (0 se pagou tudo)
 */
export function calcularSaldoResidual(
  valorOriginal: number,
  valorPago: number,
  saldoResidualAnterior: number = 0
): number {
  const valorTotal = valorOriginal + saldoResidualAnterior;
  const saldo = valorTotal - valorPago;
  return saldo > 0 ? Math.round(saldo * 100) / 100 : 0;
}

/**
 * Retorna exclusivamente o que ainda falta receber de uma parcela.
 * Em uma parcela parcial, saldo_residual já representa o valor remanescente
 * (inclusive encargos calculados no momento da baixa); somá-lo novamente ao
 * valor original duplica a dívida nos cards, relatórios e no dashboard.
 */
export function calcularValorAbertoParcela(parcela: {
  status: string;
  valorOriginal: number | string | null | undefined;
  saldoResidual?: number | string | null | undefined;
  valorMulta?: number | string | null | undefined;
}): number {
  if (parcela.status === "paga") return 0;

  const paraNumero = (valor: number | string | null | undefined) => {
    const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
    return Number.isFinite(numero) ? numero : 0;
  };
  const valorOriginal = paraNumero(parcela.valorOriginal);
  const saldoResidual = paraNumero(parcela.saldoResidual);
  const valorMulta = paraNumero(parcela.valorMulta);

  // Compatibilidade com registros parciais antigos que ainda não possuíam
  // saldo_residual preenchido: eles continuam exibindo o principal em aberto.
  const principalAberto = parcela.status === "parcial" && saldoResidual > 0
    ? saldoResidual
    : valorOriginal + saldoResidual;
  const total = principalAberto + (parcela.status === "parcial" && saldoResidual > 0 ? 0 : valorMulta);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function formatarMoeda(valor: number | string | null | undefined): string {
  const num = typeof valor === 'string' ? parseFloat(valor) : (valor ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

export function formatarData(data: Date | string | null | undefined): string {
  if (!data) return '-';
  if (typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)) return data.split("-").reverse().join("/");
  const d = typeof data === 'string' ? new Date(data) : data;
  return d.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE_BRASILIA });
}

export function getStatusParcela(
  status: string,
  dataVencimento: Date | string
): 'paga' | 'atrasada' | 'vencendo_hoje' | 'pendente' | 'parcial' {
  if (status === 'paga') return 'paga';
  if (status === 'parcial') return 'parcial';

  const hoje = dataCivilBrasilia(new Date());
  const vencimento = dataCivilBrasilia(dataVencimento);
  if (vencimento < hoje) return 'atrasada';
  if (vencimento === hoje) return 'vencendo_hoje';
  return 'pendente';
}

export const MODALIDADE_LABELS: Record<string, string> = {
  mensal: 'Empréstimo Mensal',
  diario: 'Empréstimo Diário',
  semanal: 'Empréstimo Semanal',
  quinzenal: 'Empréstimo Quinzenal',
  tabela_price: 'Parcela Fixa',
  venda: 'Venda de Produto',
  cheque: 'Desconto de Cheque',
  reparcelamento: 'Reparcelamento',
};

export const STATUS_CONTRATO_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  quitado: 'Quitado',
  inadimplente: 'Inadimplente',
  cancelado: 'Cancelado',
};

/**
 * Retorna o intervalo em dias para cada modalidade
 */
export function getDiasModalidade(modalidade: string): number {
  switch (modalidade) {
    case 'diario': return 1;
    case 'semanal': return 7;
    case 'quinzenal': return 15;
    case 'mensal': return 30;
    case 'anual': return 365;
    default: return 30;
  }
}
