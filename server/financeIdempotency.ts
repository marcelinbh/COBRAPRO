export function podeRegistrarMovimento(status: string | null | undefined, permitidos: string[]): boolean {
  return Boolean(status && permitidos.includes(status));
}

export function chavePagamentoParcela(parcelaId: number, valor: number): string {
  return `${parcelaId}:${Math.round(valor * 100)}`;
}
