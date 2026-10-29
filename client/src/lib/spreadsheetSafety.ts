/**
 * Neutraliza fórmulas quando texto de negócio é aberto no Excel/LibreOffice.
 * Valores numéricos, booleanos e datas são mantidos para preservar formatação.
 */
export function protegerValorDePlanilha(value: unknown): unknown {
  // Excel e LibreOffice podem ignorar espaços/tabs iniciais antes de avaliar
  // um marcador de fórmula. O apóstrofo no início força a interpretação textual.
  if (typeof value === "string" && /^[\t\r\n ]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function textoSeguroParaPlanilha(value: unknown): string {
  return String(protegerValorDePlanilha(value) ?? "");
}
