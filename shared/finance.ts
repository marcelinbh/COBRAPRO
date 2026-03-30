// Helpers financeiros compartilhados entre frontend e backend

export function calcularJurosMora(
  valorOriginal: number,
  dataVencimento: Date,
  dataPagamento: Date,
  jurosMoraDiario: number = 0.033,
  multaAtraso: number = 2.0
): { juros: number; multa: number; total: number; diasAtraso: number } {
  const hoje = dataPagamento;
  const venc = new Date(dataVencimento);
  venc.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);

  const diasAtraso = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));

  if (diasAtraso === 0) {
    return { juros: 0, multa: 0, total: valorOriginal, diasAtraso: 0 };
  }

  const multa = valorOriginal * (multaAtraso / 100);
  const juros = valorOriginal * (jurosMoraDiario / 100) * diasAtraso;
  const total = valorOriginal + multa + juros;

  return {
    juros: Math.round(juros * 100) / 100,
    multa: Math.round(multa * 100) / 100,
    total: Math.round(total * 100) / 100,
    diasAtraso,
  };
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
 * Usado para parcelamentos mensais com múltiplas parcelas
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

export function formatarMoeda(valor: number | string | null | undefined): string {
  const num = typeof valor === 'string' ? parseFloat(valor) : (valor ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

export function formatarData(data: Date | string | null | undefined): string {
  if (!data) return '-';
  const d = typeof data === 'string' ? new Date(data + 'T00:00:00') : data;
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
  tabela_price: 'Tabela Price',
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
