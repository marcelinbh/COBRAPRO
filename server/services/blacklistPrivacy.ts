export function normalizarDocumentoBlacklist(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digitoCpf(base: string): number {
  const pesoInicial = base.length + 1;
  const soma = base.split("").reduce((acumulado, digito, indice) => acumulado + Number(digito) * (pesoInicial - indice), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function digitoCnpj(base: string): number {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = base.split("").reduce((acumulado, digito, indice) => acumulado + Number(digito) * pesos[indice]!, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Aceita somente CPF/CNPJ completos e com dígitos verificadores válidos. */
export function documentoBlacklistValido(valor: string): boolean {
  const documento = normalizarDocumentoBlacklist(valor);
  if (![11, 14].includes(documento.length) || /^(\d)\1+$/.test(documento)) return false;
  if (documento.length === 11) {
    return digitoCpf(documento.slice(0, 9)) === Number(documento[9])
      && digitoCpf(documento.slice(0, 10)) === Number(documento[10]);
  }
  return digitoCnpj(documento.slice(0, 12)) === Number(documento[12])
    && digitoCnpj(documento.slice(0, 13)) === Number(documento[13]);
}

export function mascararDocumentoBlacklist(valor: string): string {
  const documento = normalizarDocumentoBlacklist(valor);
  if (documento.length === 11) return `***.***.***-${documento.slice(-2)}`;
  if (documento.length === 14) return `**.***.***/****-${documento.slice(-2)}`;
  return "Documento protegido";
}

export function mascararNomeBlacklist(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "Titular protegido";
  return partes.map((parte, indice) => {
    if (indice === 0) return parte;
    return `${parte[0]?.toUpperCase() ?? ""}${"*".repeat(Math.min(Math.max(parte.length - 1, 2), 8))}`;
  }).join(" ");
}

export function normalizarTextoBlacklist(valor: string | undefined, limite: number): string | null {
  if (valor === undefined) return null;
  const texto = valor.trim().replace(/\s+/g, " ");
  if (texto.length === 0) return null;
  if (texto.length > limite) throw new Error("Texto excede o limite permitido");
  return texto;
}

export function normalizarValorBlacklist(valor: string | undefined): string | null {
  if (valor === undefined || valor.trim() === "") return null;
  const normalizado = valor.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) throw new Error("Valor da dívida inválido");
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero < 0 || numero > 999_999_999_999.99) throw new Error("Valor da dívida inválido");
  return numero.toFixed(2);
}
