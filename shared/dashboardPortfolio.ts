import { calcularValorAbertoParcela } from "./finance";
import { calcularSaldoAtual, type MovimentoCaixa } from "./caixa";

export const STATUS_ABERTOS_DASHBOARD = ["pendente", "atrasada", "vencendo_hoje", "parcial"] as const;

type Valor = number | string | null | undefined;
export type ParcelaDashboard = {
  status: string;
  valorOriginal: Valor;
  valor?: Valor;
  saldoResidual?: Valor;
  valorMulta?: Valor;
  valorJuros?: Valor;
  dataVencimento: string;
  clienteId?: number | null;
};

/** Não permite que os helpers tolerantes convertam dados inválidos em zero. */
export function numeroDashboard(valor: Valor, campo: string, opcional = false, permitirNegativo = false): number {
  if (valor == null && opcional) return 0;
  if (valor == null || (typeof valor === "string" && valor.trim() === "")) {
    throw new Error(`Dados financeiros inconsistentes: ${campo} ausente; revisão necessária.`);
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || (!permitirNegativo && numero < 0)) {
    throw new Error(`Dados financeiros inconsistentes: ${campo} inválido; revisão necessária.`);
  }
  return numero;
}

export function saldoContaDashboard(saldo: Valor, movimentos: readonly { tipo: string; valor: Valor }[]) {
  const base = numeroDashboard(saldo, "saldo-base", false, true);
  const valores = movimentos.map((m): MovimentoCaixa => {
    if (m.tipo !== "entrada" && m.tipo !== "saida") {
      throw new Error("Dados financeiros inconsistentes: tipo de movimento desconhecido; revisão necessária.");
    }
    return { tipo: m.tipo, valor: numeroDashboard(m.valor, "movimento de caixa") };
  });
  return calcularSaldoAtual(base, valores);
}

export function valorBaseDashboard(parcela: Pick<ParcelaDashboard, "valorOriginal" | "valor">): number {
  // Na fonte DATE/VARCHAR, valor_original é nullable e valor é obrigatório.
  return numeroDashboard(parcela.valorOriginal ?? parcela.valor, "valor da parcela");
}

export function valorAbertoDashboard(parcela: ParcelaDashboard): number {
  if (!(STATUS_ABERTOS_DASHBOARD as readonly string[]).includes(parcela.status)) return 0;
  const base = valorBaseDashboard(parcela);
  const residual = numeroDashboard(parcela.saldoResidual, "saldo residual", true);
  const multa = numeroDashboard(parcela.valorMulta, "multa", true);
  // Sem saldo remanescente positivo, um parcial legado é ambíguo: não é
  // possível reconstruir sua dívida com segurança somando o principal.
  if (parcela.status === "parcial" && (parcela.saldoResidual == null || residual <= 0)) {
    throw new Error("Dados financeiros inconsistentes: saldo residual de parcela parcial ausente ou não positivo; revisão necessária.");
  }
  return calcularValorAbertoParcela({
    status: parcela.status, valorOriginal: base, saldoResidual: residual, valorMulta: multa,
  });
}

const centavos = (valor: number) => Math.round(valor * 100);

export function resumirCarteiraDashboard(parcelas: readonly ParcelaDashboard[], hoje: string) {
  let aberto = 0;
  let inadimplente = 0;
  let juros = 0;
  let vencendo = 0;
  let qtdVenceHoje = 0;
  const clientes = new Set<number>();
  for (const parcela of parcelas) {
    if (!(STATUS_ABERTOS_DASHBOARD as readonly string[]).includes(parcela.status)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parcela.dataVencimento)) {
      throw new Error("Dados financeiros inconsistentes: vencimento civil inválido; revisão necessária.");
    }
    const valor = centavos(valorAbertoDashboard(parcela));
    aberto += valor;
    // Status de atraso explícito ou vencimento passado; inclui parcial vencido.
    if (parcela.status === "atrasada" || parcela.dataVencimento < hoje) {
      inadimplente += valor;
      if (valor > 0 && parcela.clienteId != null) clientes.add(parcela.clienteId);
    }
    if (["atrasada", "parcial"].includes(parcela.status)) {
      juros += centavos(numeroDashboard(parcela.valorJuros, "juros", true));
    }
    if (parcela.dataVencimento === hoje && ["pendente", "vencendo_hoje"].includes(parcela.status)) {
      qtdVenceHoje++;
      vencendo += valor;
    }
  }
  return {
    totalReceber: aberto / 100,
    totalInadimplente: inadimplente / 100,
    qtdInadimplentes: clientes.size,
    jurosPendentes: juros / 100,
    qtdVenceHoje,
    valorVenceHoje: vencendo / 100,
  };
}

/** A UI não limita percentuais para esconder uma base incompatível. */
export function saudeCarteiraDashboard(totalReceber: number, totalInadimplente: number) {
  if (![totalReceber, totalInadimplente].every(Number.isFinite)
    || totalReceber < 0 || totalInadimplente < 0 || totalInadimplente > totalReceber) return null;
  const emDia = Math.round((totalReceber - totalInadimplente) * 100) / 100;
  return { emDia, taxaInadimplencia: totalReceber > 0 ? totalInadimplente / totalReceber * 100 : 0 };
}
