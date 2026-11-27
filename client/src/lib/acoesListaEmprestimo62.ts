// Atalhos62 são apenas destinos de apresentação, nunca autorização financeira.
export const HASHES_ACOES_LISTA62 = [
  '#receber-conferir', '#editar-obrigacao', '#reparcelar', '#cancelar-arquivar',
] as const;
export type HashAcaoLista62 = typeof HASHES_ACOES_LISTA62[number];
export type AlvoAcaoLista62 = 'receber-conferir' | 'editar-obrigacao' | 'reparcelar' | 'cancelar-arquivar';

export function idContratoAcao62(value: unknown): number | null {
  if (typeof value === 'string') {
    if (!/^[1-9]\d{0,9}$/.test(value) || String(Number(value)) !== value) return null;
    value = Number(value);
  }
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647 ? value : null;
}

export function hashAcaoLista62(value: unknown): HashAcaoLista62 | null {
  return typeof value === 'string' && HASHES_ACOES_LISTA62.some(hash => hash === value) ? value as HashAcaoLista62 : null;
}

export function rotaAcaoListaEmprestimo62(id: unknown, hash: unknown): string | undefined {
  const contrato = idContratoAcao62(id), destino = hashAcaoLista62(hash);
  return contrato !== null && destino !== null ? `/emprestimos/${contrato}${destino}` : undefined;
}

export function alvoAcaoListaEmprestimo62(pathname: unknown, hash: unknown, idAtual: unknown): AlvoAcaoLista62 | null {
  const contrato = idContratoAcao62(idAtual), destino = hashAcaoLista62(hash);
  return contrato !== null && pathname === `/emprestimos/${contrato}` && destino !== null ? destino.slice(1) as AlvoAcaoLista62 : null;
}

export type LeituraAcaoLista62 = {
  emprestimo: { id: number } | null | undefined;
  isPending?: boolean; isLoading?: boolean; isError?: boolean; isFetching?: boolean;
};
export function fichaProntaAcaoLista62(idAtual: unknown, leitura: LeituraAcaoLista62): boolean {
  const id = idContratoAcao62(idAtual);
  return id !== null && leitura.emprestimo?.id === id &&
    !leitura.isError && !leitura.isPending && !leitura.isLoading && !leitura.isFetching;
}
