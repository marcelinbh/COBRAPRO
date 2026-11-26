/** Somente apresentação dos DTOs dos leitores validados; nunca autoriza escrita. */
export type Arquivo51 = 'operacional' | 'historico' | 'todos';
export type LinhaApresentacao51 = {
  status?: unknown; statusObrigacao?: unknown; statusFinanceiroOriginal?: unknown;
  obrigacaoAtual?: unknown; componenteAdicional?: unknown; arquivada?: unknown;
  arquivado?: unknown; contratoArquivado?: unknown; valorAtualizado?: unknown;
  valorPago?: unknown; valor_pago?: unknown;
};
export const REFERENCIA51 = 'Referência registrada51 — não é cotação de baixa; multa/mora dinâmica devem ser conferidas no fluxo validado.';
export function moedaTextual51(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,12})\.[0-9]{2}$/.test(value)) return null;
  const cents = Number(value.replace('.', ''));
  return Number.isSafeInteger(cents) ? cents / 100 : null;
}
export function arquivada51(row: LinhaApresentacao51): boolean {
  return row.arquivada === true || row.arquivado === true || row.contratoArquivado === true;
}
export function noArquivo51(row: LinhaApresentacao51, arquivo: Arquivo51): boolean {
  return arquivo === 'todos' || (arquivo === 'historico' ? arquivada51(row) : !arquivada51(row));
}
export function parcelaAberta51(row: LinhaApresentacao51): boolean {
  return row.statusObrigacao === 'aberta' && !arquivada51(row) && (moedaTextual51(row.obrigacaoAtual) ?? -1) > 0;
}
/** Preserva valorAtualizado já comprovado pelo reader. Sem ele, somente referência51.
 * Fechada não soma valorOriginal, principal ou recebimentos históricos. */
export function valorOperacional51(row: LinhaApresentacao51): number | null {
  const registered = moedaTextual51(row.obrigacaoAtual);
  if (registered === null || !['aberta', 'paga', 'cancelada', 'transferida'].includes(String(row.statusObrigacao))) return null;
  if (row.statusObrigacao !== 'aberta') return registered === 0 ? 0 : null;
  if (arquivada51(row) || registered <= 0) return null;
  if (row.valorAtualizado === undefined) return registered;
  return typeof row.valorAtualizado === 'number' && Number.isFinite(row.valorAtualizado) && row.valorAtualizado >= 0 ? row.valorAtualizado : null;
}
export function somaOperacional51(rows: readonly LinhaApresentacao51[]): number | null {
  let cents = 0;
  for (const row of rows) {
    const value = valorOperacional51(row);
    if (value === null) return null;
    cents += Math.round(value * 100);
    if (!Number.isSafeInteger(cents)) return null;
  }
  return cents / 100;
}
export function somaAdicional51(rows: readonly LinhaApresentacao51[]): number | null {
  let cents = 0;
  for (const row of rows) {
    const value = moedaTextual51(row.componenteAdicional);
    if (value === null) return null;
    cents += Math.round(value * 100);
    if (!Number.isSafeInteger(cents)) return null;
  }
  return cents / 100;
}
export function contagensParcelas51(rows: readonly LinhaApresentacao51[]) {
  return {
    pagas: rows.filter(r => ['paga', 'pago'].includes(String(r.statusFinanceiroOriginal ?? r.status)) && (r.statusObrigacao === undefined || r.statusObrigacao === 'paga')).length,
    canceladas: rows.filter(r => r.statusObrigacao === 'cancelada' || (r.statusObrigacao === undefined && ['cancelada', 'cancelado'].includes(String(r.status)))).length,
    arquivadas: rows.filter(arquivada51).length,
    abertas: rows.filter(parcelaAberta51).length,
    transferidas: rows.filter(r => r.statusObrigacao === 'transferida').length,
  };
}
/** Histórico de recebimento, sem inventar pagamento pelo valorOriginal. */
export function somaRecebidoHistorico51(rows: readonly LinhaApresentacao51[]): number | null {
  let cents = 0;
  for (const row of rows) {
    const raw = row.valorPago !== undefined ? row.valorPago : row.valor_pago;
    if (raw == null && !['paga', 'pago', 'parcial'].includes(String(row.statusFinanceiroOriginal ?? row.status))) continue;
    // Valor físico histórico pode vir como numeric JSON/string. Não arredondar.
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    const nominal = String(raw);
    if (!/^(0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(nominal)) return null;
    const [integer, fraction = ''] = nominal.split('.');
    const value = Number(BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0')));
    if (!Number.isSafeInteger(value)) return null;
    cents += value;
    if (!Number.isSafeInteger(cents)) return null;
  }
  return cents / 100;
}
export function valorConfirmado51(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : 'Valor não confirmado';
}
export function referenciaMonetaria51(value: unknown): string {
  return valorConfirmado51(moedaTextual51(value));
}
export function statusContrato51(row: LinhaApresentacao51): unknown {
  return row.statusObrigacao === 'encerrado_por_cancelamento' ? 'encerrado_por_cancelamento' : row.status;
}
export function statusParcela51(row: LinhaApresentacao51): string {
  return row.statusObrigacao === 'cancelada' ? 'cancelada' : row.statusObrigacao === 'transferida' ? 'renovada'
    : row.statusObrigacao === 'paga' ? (['paga', 'pago'].includes(String(row.statusFinanceiroOriginal ?? row.status)) ? 'paga' : 'status_nao_confirmado') : String(row.status ?? '');
}
export function rotuloValorOperacional51(row: LinhaApresentacao51): string {
  return row.valorAtualizado === undefined ? 'Referência registrada51 · não cotação' : 'Valor de apresentação comprovado pelo reader';
}
