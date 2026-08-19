/** Converte a data de pagamento para formato compatível com colunas DATE e TIMESTAMP do Postgres. */
export function dataPagamentoParaBanco(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function statusPodeSerPago(status: string | null | undefined): boolean {
  return status === "pendente" || status === "atrasada";
}
