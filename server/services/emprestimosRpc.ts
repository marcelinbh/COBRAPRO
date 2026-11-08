import { TRPCError } from "@trpc/server";
import { z } from "zod";

const REGRA = "mensal_simples_v1" as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CENTAVOS = BigInt("999999999999999");
const ZERO = BigInt(0);
const UM = BigInt(1);
const DOIS = BigInt(2);
const CEM = BigInt(100);

function falhar(code: TRPCError["code"], message: string): never {
  throw new TRPCError({ code, message });
}

export function dataEmprestimoValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const decimal = z.union([z.string(), z.number().finite()]);
/** Só intenção. Owner vem separadamente de ctx.user.id; valores calculados não são input. */
export const entradaEmprestimoProspectivoSchema = z.object({
  idempotencyKey: z.string().regex(UUID),
  clienteId: z.number().int().positive().max(2147483647),
  contaCaixaId: z.number().int().positive().max(2147483647),
  modalidade: z.literal("mensal"),
  tipoTaxa: z.literal("mensal"),
  valorPrincipal: decimal,
  taxaJuros: decimal,
  numeroParcelas: z.number().int().min(1).max(60),
  dataInicio: z.string().refine(dataEmprestimoValida),
  dataDesembolso: z.string().refine(dataEmprestimoValida),
  vencimentos: z.array(z.string().refine(dataEmprestimoValida)).min(1).max(60),
  descricao: z.string().max(2000).optional(),
  observacoes: z.string().max(4000).optional(),
}).strict();

export type EntradaEmprestimoProspectivo = z.infer<typeof entradaEmprestimoProspectivoSchema>;
export type ClienteEmprestimosRpc = {
  rpc: (nome: string, parametros: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { code?: string | null } | null;
  }>;
};

function centavos(value: number | string): bigint {
  const text = String(value);
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(text)) falhar("BAD_REQUEST", "Principal e taxa exigem até duas casas decimais, sem arredondamento implícito.");
  const [integer, fraction = ""] = text.split(".");
  return BigInt(integer) * CEM + BigInt(fraction.padEnd(2, "0"));
}

function moeda(value: bigint): string {
  return `${value / CEM}.${String(value % CEM).padStart(2, "0")}`;
}

function arredondarDividendo(value: bigint, divisor: bigint): bigint {
  return (value * DOIS + divisor) / (divisor * DOIS);
}

/** Fórmula existente, NUMERIC espelhado com BigInt; acerto de centavos apenas na última linha. */
export function calcularEmprestimoProspectivo(principal: number | string, taxa: number | string, n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 60) falhar("BAD_REQUEST", "Número de parcelas fora de 1..60.");
  const capital = centavos(principal);
  const taxaCentesimal = centavos(taxa);
  if (capital <= ZERO || capital > MAX_CENTAVOS || taxaCentesimal > BigInt(99999)) {
    falhar("BAD_REQUEST", "Principal/taxa fora da faixa do catálogo.");
  }
  const quantidade = BigInt(n);
  const juros = arredondarDividendo(capital * taxaCentesimal * quantidade, BigInt(10000));
  const total = capital + juros;
  if (total > BigInt("999999999999")) falhar("BAD_REQUEST", "Total excede NUMERIC(12,2) do histórico.");
  const referencia = arredondarDividendo(total, quantidade);
  const jurosReferencia = arredondarDividendo(juros, quantidade);
  const parcelas = Array.from({ length: n }, (_, i) => {
    const valor = i === n - 1 ? total - referencia * (quantidade - UM) : referencia;
    const valorJuros = i === n - 1 ? juros - jurosReferencia * (quantidade - UM) : jurosReferencia;
    if (valor <= ZERO || valorJuros < ZERO || valorJuros > valor) {
      falhar("BAD_REQUEST", "Principal insuficiente para parcelas positivas e rateio conservativo de juros.");
    }
    return { valor: moeda(valor), valorJuros: moeda(valorJuros) };
  });
  return {
    valorPrincipal: moeda(capital), taxaJuros: moeda(taxaCentesimal),
    valorParcela: moeda(referencia), totalContrato: moeda(total), jurosTotal: moeda(juros), parcelas,
  };
}

function validarAgenda(entrada: EntradaEmprestimoProspectivo) {
  if (entrada.dataDesembolso !== entrada.dataInicio || entrada.vencimentos.length !== entrada.numeroParcelas) {
    falhar("BAD_REQUEST", "Desembolso deve coincidir com início; informe exatamente N vencimentos.");
  }
  const primeira = entrada.vencimentos[0];
  const dia = Number(primeira.slice(8));
  if (entrada.numeroParcelas > 1 && dia > 28) {
    falhar("BAD_REQUEST", "N>1 exige dia 1..28: fim de mês sem regra aprovada não é suportado.");
  }
  const ano = Number(primeira.slice(0, 4));
  const mes = Number(primeira.slice(5, 7));
  entrada.vencimentos.forEach((vencimento, i) => {
    const esperado = new Date(Date.UTC(ano, mes - 1 + i, dia, 12)).toISOString().slice(0, 10);
    if (vencimento < entrada.dataInicio || vencimento !== esperado) {
      falhar("BAD_REQUEST", "Agenda deve ser mensal explícita, consecutiva e posterior ou igual ao início.");
    }
  });
}

const valorResultado = z.string().regex(/^(0|[1-9]\d{0,12})\.\d{2}$/);
const id = z.number().int().positive().max(2147483647);
const resultadoSchema = z.object({
  success: z.literal(true), repetida: z.boolean(), id,
  operationId: z.string().regex(UUID), parcelasIds: z.array(id).min(1).max(60),
  transacaoCaixaId: z.string().regex(/^[1-9]\d{0,18}$/),
  valorParcela: valorResultado, totalContrato: valorResultado, jurosTotal: valorResultado,
  numeroParcelas: z.number().int().min(1).max(60),
  dataDesembolso: z.string().refine(dataEmprestimoValida),
  vencimentos: z.array(z.string().refine(dataEmprestimoValida)).min(1).max(60),
  status: z.literal("ativo"), regra: z.literal(REGRA),
}).strict();

export type ResultadoEmprestimoProspectivo = z.infer<typeof resultadoSchema>;

export function normalizarResultadoEmprestimoProspectivo(value: unknown, entrada: EntradaEmprestimoProspectivo): ResultadoEmprestimoProspectivo {
  const parsed = resultadoSchema.safeParse(value);
  if (!parsed.success) falhar("INTERNAL_SERVER_ERROR", "Confirmação RPC inválida; confira/reenvie a mesma chave, sem presumir rollback.");
  const r = parsed.data;
  const esperado = calcularEmprestimoProspectivo(entrada.valorPrincipal, entrada.taxaJuros, entrada.numeroParcelas);
  if (r.numeroParcelas !== entrada.numeroParcelas || r.parcelasIds.length !== entrada.numeroParcelas ||
      new Set(r.parcelasIds).size !== r.parcelasIds.length || r.valorParcela !== esperado.valorParcela ||
      r.totalContrato !== esperado.totalContrato || r.jurosTotal !== esperado.jurosTotal ||
      r.dataDesembolso !== entrada.dataDesembolso || JSON.stringify(r.vencimentos) !== JSON.stringify(entrada.vencimentos) ||
      BigInt(r.transacaoCaixaId) > BigInt("9223372036854775807")) {
    falhar("INTERNAL_SERVER_ERROR", "RPC divergiu da intenção/cálculo; confira a operação com a mesma chave antes de prosseguir.");
  }
  return r;
}

/** Backend-only: userId é argumento exclusivo do servidor. Flag desligada por padrão. */
export async function criarEmprestimoProspectivoAtomico(
  supabase: ClienteEmprestimosRpc,
  userId: number,
  input: EntradaEmprestimoProspectivo,
): Promise<ResultadoEmprestimoProspectivo> {
  if (process.env.ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS !== "true") {
    falhar("PRECONDITION_FAILED", "Criação prospectiva atômica indisponível. Não há fallback REST.");
  }
  if (!Number.isInteger(userId) || userId <= 0 || userId > 2147483647) falhar("BAD_REQUEST", "Tenant do servidor inválido.");
  const parsed = entradaEmprestimoProspectivoSchema.safeParse(input);
  if (!parsed.success) falhar("BAD_REQUEST", "Intenção inválida. Suportado somente mensal/taxa mensal, N 1..60, UUID e datas civis explícitas.");
  const entrada = parsed.data;
  validarAgenda(entrada);
  const calculo = calcularEmprestimoProspectivo(entrada.valorPrincipal, entrada.taxaJuros, entrada.numeroParcelas);
  let response: Awaited<ReturnType<ClienteEmprestimosRpc["rpc"]>>;
  try {
    response = await supabase.rpc("rpc_criar_emprestimo", {
      p_user_id: userId, p_chave_idempotencia: entrada.idempotencyKey,
      p_cliente_id: entrada.clienteId, p_conta_caixa_id: entrada.contaCaixaId,
      p_modalidade: entrada.modalidade, p_tipo_taxa: entrada.tipoTaxa,
      p_valor_principal: calculo.valorPrincipal, p_taxa_juros: calculo.taxaJuros,
      p_numero_parcelas: entrada.numeroParcelas, p_data_inicio: entrada.dataInicio,
      p_data_desembolso: entrada.dataDesembolso, p_vencimentos: entrada.vencimentos,
      p_descricao: entrada.descricao?.trim() || null, p_observacoes: entrada.observacoes?.trim() || null,
    });
  } catch {
    falhar("INTERNAL_SERVER_ERROR", "Transporte sem confirmação: preserve a mesma chave para conferir/repetir; não é prova de rollback.");
  }
  if (response.error) {
    const code = response.error.code;
    if (code === "22023" || code === "22008" || code === "22007" || code === "22P02") falhar("BAD_REQUEST", "Intenção financeira inválida.");
    if (code === "23505" || code === "23514" || code === "40001" || code === "40P01") falhar("CONFLICT", "Conflito de idempotência/integridade; não gere nova chave para repetir.");
    if (code === "42501") falhar("NOT_FOUND", "Cliente, conta ou koletor indisponível para esta empresa.");
    if (code === "PGRST202" || code === "42883" || code === "42P01") falhar("PRECONDITION_FAILED", "RPC/schema prospectivo indisponível. Sem fallback.");
    falhar("INTERNAL_SERVER_ERROR", "Criação sem confirmação; confira/reenvie a mesma chave sem presumir rollback.");
  }
  return normalizarResultadoEmprestimoProspectivo(response.data, entrada);
}
