import { z } from "zod";

// Limites dos varchar do schema local; campos text têm um teto de payload.
// Apenas entradas novas são normalizadas: nunca reescrevemos a base existente.
const texto = (max: number) => z.string().trim().max(max).optional();
const ufs = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);
export function somenteDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida o documento informado nesta operação, não consulta nem reescreve a base. */
export function documentoClienteValido(value: string): boolean {
  if (value === "") return true;
  if (!/^[\d\s().\-/]+$/.test(value)) return false;
  const digits = somenteDigitos(value);
  if (![11, 14].includes(digits.length) || /^(\d)\1+$/.test(digits)) return false;
  const check = (base: string, weights: number[]) => {
    const remainder = Array.from(base).reduce((sum, digit, i) => sum + Number(digit) * weights[i], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const weights = digits.length === 11
    ? [10, 9, 8, 7, 6, 5, 4, 3, 2]
    : [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const base = digits.slice(0, -2);
  const first = check(base, weights);
  const secondWeights = digits.length === 11
    ? [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return digits.slice(-2) === `${first}${check(base + first, secondWeights)}`;
}

const documento = z.string().trim().max(64).refine(
  documentoClienteValido,
  "Informe CPF ou CNPJ numérico válido, com dígitos verificadores corretos, ou deixe vazio.",
).transform(somenteDigitos).optional();
const telefone = z.string().trim().max(64).refine(
  value => {
    if (value !== "" && !/^[+\d\s().\-]+$/.test(value)) return false;
    const digits = somenteDigitos(value);
    return value === "" || [10, 11].includes(digits.length) ||
      (digits.startsWith("55") && [12, 13].includes(digits.length));
  },
  "Informe telefone com DDD (10 ou 11 dígitos; código 55 opcional), ou deixe vazio.",
).transform(somenteDigitos).optional();
const estado = z.string().trim().toUpperCase().max(2).refine(
  value => value === "" || ufs.has(value),
  "Informe uma UF válida, ou deixe vazio.",
).optional();

const camposCliente = {
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres.").max(255),
  // Campo legado também usado para CNPJ nas importações existentes.
  cpfCnpj: documento,
  cnpj: texto(20),
  rg: texto(20),
  telefone,
  whatsapp: telefone,
  email: texto(320),
  chavePix: texto(255),
  tipoChavePix: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).optional(),
  endereco: texto(10_000),
  numero: texto(20),
  complemento: texto(100),
  bairro: texto(100),
  cidade: texto(100),
  estado,
  cep: texto(9),
  observacoes: texto(50_000),
  instagram: texto(100),
  facebook: texto(255),
  profissao: texto(100),
  dataNascimento: texto(10),
  sexo: z.enum(["masculino", "feminino", "outro"]).optional(),
  estadoCivil: z.enum(["solteiro", "casado", "divorciado", "viuvo", "outro"]).optional(),
  nomeMae: texto(255),
  nomePai: texto(255),
  fotoUrl: texto(500),
  documentosUrls: texto(1_000_000),
  tipoCliente: texto(50),
  isReferral: z.boolean().optional(),
  ativo: z.boolean().optional(),
  banco: texto(100),
  agencia: texto(20),
  numeroConta: texto(30),
};

export const clienteCreateInput = z.object(camposCliente);
export const clienteUpdateInput = z.object({
  ...camposCliente,
  nome: camposCliente.nome.optional(),
  id: z.number().int().positive(),
  score: z.number().int().min(0).max(1000).optional(),
}).refine(
  value => Object.entries(value).some(([key, item]) => key !== "id" && item !== undefined),
  "Informe pelo menos um campo para atualizar.",
);

/** No formulário, vazio significa limpar na edição e omitir na criação. */
export function clienteTextoOpcional(value: string, editar: boolean): string | undefined {
  return editar ? value : value || undefined;
}

/** Busca não depende da máscara que um registro antigo/importado utiliza. */
export function clienteCorrespondeBusca(
  cliente: { nome?: string | null; cpfCnpj?: string | null; telefone?: string | null },
  busca: string,
): boolean {
  const textoBusca = busca.trim().toLowerCase();
  if (!textoBusca) return true;
  if ((cliente.nome ?? "").toLowerCase().includes(textoBusca)) return true;
  const numeros = somenteDigitos(textoBusca);
  // Não comparar um fragmento numérico de uma busca textual (ex.: "Maria 1").
  if (!numeros || !/^[\d\s()+.\-/]+$/.test(textoBusca)) return false;
  return [cliente.cpfCnpj, cliente.telefone].some(value =>
    somenteDigitos(value ?? "").includes(numeros),
  );
}
