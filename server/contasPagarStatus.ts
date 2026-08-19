type SchemaError = { message?: string } | null | undefined;

/** A base legada usa `pago`; a versão atual do CobraPro usa `paga`. */
export function deveRepetirComStatusPagoLegado(error: SchemaError): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("contas_pagar_status_check") || (message.includes("check constraint") && message.includes("status"));
}

export function normalizarStatusContaPagar(status: string | null | undefined): string {
  return status === "pago" ? "paga" : status ?? "pendente";
}
