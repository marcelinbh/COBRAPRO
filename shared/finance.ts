// Helpers financeiros compartilhados entre frontend e backend

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
  const hoje = new Date(dataPagamento);
  const venc = new Date(dataVencimento);
  venc.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);

  const diasAtraso = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));

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

export function formatarMoeda(valor: number | string | null | undefined): string {
  const num = typeof valor === 'string' ? parseFloat(valor) : (valor ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

export function formatarData(data: Date | string | null | undefined): string {
  if (!data) return '-';
  const d = typeof data === 'string' ? (data.includes('T') || data.includes('Z') ? new Date(data) : new Date(data + 'T00:00:00')) : data;
  return d.toLocaleDateString('pt-BR');
}

export function getStatusParcela(
  status: string,
  dataVencimento: Date | string
): 'paga' | 'atrasada' | 'vencendo_hoje' | 'pendente' | 'parcial' {
  if (status === 'paga') return 'paga';
  if (status === 'parcial') return 'parcial';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = typeof dataVencimento === 'string'
    ? new Date(dataVencimento + 'T00:00:00')
    : new Date(dataVencimento);
  venc.setHours(0, 0, 0, 0);

  if (venc.getTime() < hoje.getTime()) return 'atrasada';
  if (venc.getTime() === hoje.getTime()) return 'vencendo_hoje';
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
    default: return 30;
  }
}
