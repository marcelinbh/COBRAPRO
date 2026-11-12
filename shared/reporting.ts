import { valorAbertoDashboard, type ParcelaDashboard } from "./dashboardPortfolio";

export type LeituraRelatorio<T> =
  | { status: "validado"; completo: true; dados: T }
  | { status: "indisponivel"; completo: false; motivo: string };

export function leituraValidada<T>(leitura: LeituraRelatorio<T> | undefined): leitura is Extract<LeituraRelatorio<T>, { status: "validado" }> {
  return leitura?.status === "validado" && leitura.completo === true;
}

/** DATE é civil, não um timestamp. Não aceitar datas normalizadas silenciosamente. */
export function dataRelatorio(valor: unknown): string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error("Data civil inválida; revisão necessária.");
  const [ano, mes, dia] = valor.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (ano < 1900 || ano > 9999 || d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) throw new Error("Data civil inválida; revisão necessária.");
  return valor;
}

export function hojeRelatorio(agora: Date = new Date()): string {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(agora).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return dataRelatorio(`${partes.year}-${partes.month}-${partes.day}`);
}

export function adicionarDiasRelatorio(data: string, dias: number): string {
  dataRelatorio(data);
  if (!Number.isInteger(dias)) throw new Error("Intervalo civil inválido.");
  const [ano, mes, dia] = data.split("-").map(Number);
  return dataRelatorio(new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10));
}

export const formatarDataRelatorio = (data: string) => dataRelatorio(data).split("-").reverse().join("/");

/** Leitura estrita de NUMERIC(15,2); somas só em centavos inteiros seguros. */
export function centavosRelatorio(valor: unknown): number {
  const texto = typeof valor === "number" ? String(valor) : valor;
  if (typeof texto !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(texto)) throw new Error("Valor financeiro inválido; revisão necessária.");
  const [inteiro, decimal = ""] = texto.split(".");
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos)) throw new Error("Valor financeiro fora do limite seguro; revisão necessária.");
  return centavos;
}

export function somarCentavosRelatorio(valores: readonly number[]): number {
  const total = valores.reduce((s, n) => s + n, 0);
  if (!Number.isSafeInteger(total)) throw new Error("Total financeiro fora do limite seguro; revisão necessária.");
  return total;
}

export function reaisRelatorio(centavos: number): number {
  if (!Number.isSafeInteger(centavos)) throw new Error("Total financeiro fora do limite seguro; revisão necessária.");
  const reais = centavos / 100;
  if (centavosRelatorio(Math.abs(reais)) !== Math.abs(centavos)) throw new Error("Transporte financeiro numérico perderia centavos; revisão necessária.");
  return reais;
}

export const STATUS_ABERTOS_RELATORIO = ["pendente", "atrasada", "vencendo_hoje", "parcial"] as const;
export function parcelaAbertaRelatorio(p: ParcelaDashboard): boolean {
  // Renovada não é paga: seu residual pertence ao sucessor, não ao antecessor.
  if (![...STATUS_ABERTOS_RELATORIO, "paga", "cancelada", "renovada"].includes(p.status as any)) throw new Error("Status de parcela desconhecido; revisão necessária.");
  return (STATUS_ABERTOS_RELATORIO as readonly string[]).includes(p.status);
}

export function abertoCentavosRelatorio(p: ParcelaDashboard): number {
  dataRelatorio(p.dataVencimento);
  if (!parcelaAbertaRelatorio(p)) return 0;
  // Validar todos os componentes antes de reutilizar o guard da carteira.
  const base = centavosRelatorio(p.valorOriginal ?? p.valor);
  const residual = p.saldoResidual == null ? 0 : centavosRelatorio(p.saldoResidual);
  const multa = p.valorMulta == null ? 0 : centavosRelatorio(p.valorMulta);
  valorAbertoDashboard(p); // Mantém o guard de parcial legado ausente/não positivo.
  return p.status === "parcial" ? residual : somarCentavosRelatorio([base, residual, multa]);
}

export function atrasadaRelatorio(p: ParcelaDashboard, hoje: string): boolean {
  dataRelatorio(p.dataVencimento);
  dataRelatorio(hoje);
  return parcelaAbertaRelatorio(p) && (p.status === "atrasada" || p.dataVencimento < hoje);
}

export function resumirDividasRelatorio(parcelas: readonly ParcelaDashboard[], hoje: string) {
  const abertas = parcelas.filter(parcelaAbertaRelatorio);
  const valores = abertas.map(abertoCentavosRelatorio);
  const abertoCentavos = somarCentavosRelatorio(valores);
  const atrasoCentavos = somarCentavosRelatorio(abertas.filter(p => atrasadaRelatorio(p, hoje)).map(abertoCentavosRelatorio));
  return { aberto: reaisRelatorio(abertoCentavos), emAtraso: reaisRelatorio(atrasoCentavos), abertoCentavos, atrasoCentavos,
    quantidade: abertas.length, quantidadeAtrasadas: abertas.filter(p => atrasadaRelatorio(p, hoje)).length };
}

export type MovimentoRelatorio = { tipo: string; categoria: string; valor: unknown; dataTransacao: string };
export function resumirLedgerRelatorio(movimentos: readonly MovimentoRelatorio[]) {
  for (const m of movimentos) {
    dataRelatorio(m.dataTransacao);
    if (!["entrada", "saida"].includes(m.tipo) || typeof m.categoria !== "string" || !m.categoria) throw new Error("Movimento de Caixa inválido; revisão necessária.");
    centavosRelatorio(m.valor);
  }
  const somar = (registros: readonly MovimentoRelatorio[]) => somarCentavosRelatorio(registros.map(m => centavosRelatorio(m.valor)));
  const entradasCentavos = somar(movimentos.filter(m => m.tipo === "entrada"));
  const saidasCentavos = somar(movimentos.filter(m => m.tipo === "saida"));
  const recebidoCentavos = somar(movimentos.filter(m => m.tipo === "entrada" && m.categoria === "pagamento_parcela"));
  return { entradas: reaisRelatorio(entradasCentavos), saidas: reaisRelatorio(saidasCentavos),
    saldo: reaisRelatorio(entradasCentavos - saidasCentavos), recebido: reaisRelatorio(recebidoCentavos),
    recebidoCentavos, quantidade: movimentos.length,
    pagamentosCount: movimentos.filter(m => m.tipo === "entrada" && m.categoria === "pagamento_parcela").length };
}

/** Base histórica explícita: recebimentos no ledger + dívida atualmente aberta. */
export function scoreRelatorio(recebidoCentavos: number, abertoCentavos: number, atrasoCentavos: number) {
  if (![recebidoCentavos, abertoCentavos, atrasoCentavos].every(n => Number.isSafeInteger(n) && n >= 0) || atrasoCentavos > abertoCentavos) throw new Error("Base do score inválida; revisão necessária.");
  const denominadorCentavos = somarCentavosRelatorio([recebidoCentavos, abertoCentavos]);
  const taxaRecebimento = denominadorCentavos > 0 ? recebidoCentavos / denominadorCentavos * 100 : null;
  const inadimplencia = denominadorCentavos > 0 ? atrasoCentavos / denominadorCentavos * 100 : null;
  const score = denominadorCentavos > 0 ? Math.max(0, Math.round((recebidoCentavos - atrasoCentavos / 2) / denominadorCentavos * 100)) : null;
  return { completo: true as const, score, taxaRecebimento, inadimplencia,
    totalRecebido: reaisRelatorio(recebidoCentavos), totalAberto: reaisRelatorio(abertoCentavos), emAtraso: reaisRelatorio(atrasoCentavos),
    denominador: reaisRelatorio(denominadorCentavos), base: "Histórico do ledger (pagamento_parcela) + dívida aberta validada; atraso civil incluído. Não é a taxa da carteira aberta." };
}
