const STATUS_CALENDARIO = new Set(["pendente", "vencendo_hoje", "atrasada"]);

function dataCivilValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  if (ano < 1900 || ano > 9999 || mes < 1 || mes > 12 || dia < 1) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

/** O chamador fornece o dia civil de Brasília. Nunca altera status financeiro ou dados. */
export function statusCalendarioParcela(status: string, vencimento: unknown, hoje: string): string {
  if (!STATUS_CALENDARIO.has(status) || !dataCivilValida(vencimento) || !dataCivilValida(hoje)) return status;
  if (vencimento < hoje) return "atrasada";
  if (vencimento === hoje) return "vencendo_hoje";
  return "pendente";
}
