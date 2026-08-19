/** Retorna somente IDs únicos que podem ser removidos, preservando o lançamento escolhido. */
export function idsDuplicadosParaRemocao(ids: number[], manterId: number): number[] {
  return Array.from(new Set(ids)).filter((id) => id !== manterId && Number.isInteger(id) && id > 0);
}
