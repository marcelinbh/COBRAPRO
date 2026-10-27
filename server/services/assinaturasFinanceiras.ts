const DATA_CIVIL_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_REFERENCIA_RE = /^(\d{4})-(\d{2})$/;

/** Evita normalização silenciosa do Date, como 2026-02-31 virar março. */
export function dataCivilValida(valor: string): boolean {
  if (!DATA_CIVIL_RE.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const date = new Date(Date.UTC(ano, mes - 1, dia));
  return date.getUTCFullYear() === ano && date.getUTCMonth() === mes - 1 && date.getUTCDate() === dia;
}

/** Competência mensal válida no formato YYYY-MM, com mês real de 01 a 12. */
export function mesReferenciaValido(valor: string): boolean {
  const match = MES_REFERENCIA_RE.exec(valor);
  if (!match) return false;
  const mes = Number(match[2]);
  return mes >= 1 && mes <= 12;
}

/** Uma competência não pode anteceder o início civil da assinatura. */
export function competenciaElegivel(dataInicio: string, mesReferencia: string): boolean {
  return dataCivilValida(dataInicio) && mesReferenciaValido(mesReferencia) && mesReferencia >= dataInicio.slice(0, 7);
}

/** Compara valores em centavos para eliminar imprecisão binária de ponto flutuante. */
export function mesmoValorMonetario(a: number | string, b: number | string): boolean {
  const aNumero = Number(a);
  const bNumero = Number(b);
  if (!Number.isFinite(aNumero) || !Number.isFinite(bNumero)) return false;
  return Math.round(aNumero * 100) === Math.round(bNumero * 100);
}
