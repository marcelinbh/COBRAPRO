type SchemaError = { message?: string; code?: string } | null | undefined;

/**
 * A tabela legada de produção não possui `periodicidade`. Enquanto a migração
 * não é aplicada, despesas avulsas devem continuar sendo registradas.
 */
export function deveRepetirSemPeriodicidade(error: SchemaError): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST204" || message.includes("periodicidade");
}
