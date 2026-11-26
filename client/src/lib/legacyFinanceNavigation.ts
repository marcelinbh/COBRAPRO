/** Pré-seleção de UI, nunca autorização de owner ou payload financeiro. */
const MAX_ID = 2147483647;
function idValido(id: number): boolean {
  return Number.isInteger(id) && id > 0 && id <= MAX_ID;
}
export function rotaReparcelamentoAtual(contratoId: number): string {
  if (!idValido(contratoId)) throw new Error('Contrato inválido para reparcelamento.');
  return `/reparcelamento?contratoId=${contratoId}`;
}
export function contratoReparcelamentoDaBusca(search: string): number | undefined {
  const params = new URLSearchParams(search);
  const values = params.getAll('contratoId');
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return undefined;
  const id = Number(values[0]);
  return idValido(id) ? id : undefined;
}
