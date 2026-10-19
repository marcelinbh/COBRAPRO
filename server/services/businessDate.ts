export const BRASILIA_TIME_ZONE = "America/Sao_Paulo";

function parts(now: Date = new Date()): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BRASILIA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  );
}

/** Data de negócio no calendário de Brasília, sem converter DATE para UTC. */
export function dataHojeBrasilia(now: Date = new Date()): string {
  const value = parts(now);
  return `${value.year}-${value.month}-${value.day}`;
}

export function horarioBrasilia(now: Date = new Date()): string {
  const value = parts(now);
  return `${value.hour}:${value.minute}:${value.second}`;
}

/** Soma dias a uma data YYYY-MM-DD preservando a semântica de data civil. */
export function adicionarDiasData(data: string, dias: number): string {
  const [year, month, day] = data.split("-").map(Number);
  if (![year, month, day].every(Number.isInteger)) throw new Error("Data inválida");
  return new Date(Date.UTC(year, month - 1, day + dias)).toISOString().slice(0, 10);
}

/** Diferença civil em dias entre datas YYYY-MM-DD. */
export function diferencaDiasData(inicio: string, fim: string): number {
  const a = new Date(`${inicio}T12:00:00Z`).getTime();
  const b = new Date(`${fim}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Cria timestamp de meio-dia de Brasília para representar apenas uma data civil. */
export function dataCivilBrasiliaParaIso(data: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data inválida");
  return new Date(`${data}T12:00:00-03:00`).toISOString();
}
