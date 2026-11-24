import { z } from "zod";
import { dataMultimodalValida, jsonMultimodalSeguro } from "./emprestimosMultimodalCalculo";

/** Somente JSON próprio; rejeita getters/protótipos antes que Zod leia campos. */
function seguro<T extends z.ZodType>(schema: T): z.ZodType<z.output<T>, z.input<T>> {
  return z.preprocess((value, ctx) => {
    if (!jsonMultimodalSeguro(value)) {
      ctx.addIssue({ code: "custom", message: "Intenção financeira exige JSON explícito e próprio." });
      return z.NEVER;
    }
    return value;
  }, schema) as unknown as z.ZodType<z.output<T>, z.input<T>>;
}
function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const r = schema.safeParse(value);
  if (!r.success) throw new Error("Intenção/confirmação multa36 inválida; preserve UUID/payload sem presumir rollback.");
  return r.data;
}
function exigir(ok: boolean): void {
  if (!ok) throw new Error("Prova multa36 divergiu da intenção; preserve UUID/payload sem presumir rollback.");
}
const id = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid();
const date = z.string().refine(dataMultimodalValida);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const money = z.string().regex(/^(0|[1-9]\d{0,9})\.\d{2}$/);
/** Até NUMERIC(12,2); todos os centavos permanecem inteiros seguros, sem IEEE754. */
export function centavosMulta(value: string): bigint {
  parse(money, value);
  const n = BigInt(value.replace(".", ""));
  exigir(n <= BigInt(Number.MAX_SAFE_INTEGER));
  return n;
}
const positiveMoney = money.refine(v => money.safeParse(v).success && centavosMulta(v) > BigInt(0));
const ids = z.array(id).min(1).max(60).refine(v => new Set(v).size === v.length);
const transacaoId = z.string().regex(/^[1-9]\d{0,18}$/).refine(v => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= BigInt("9223372036854775807"));
const statusParcela = z.enum(["pendente", "atrasada", "vencendo_hoje", "parcial", "paga", "cancelada", "renovada"]);
const consulta = z.object({ contratoId: id, parcelaId: id }).strict();
const aplicacao = z.object({ idcontrato: id, multa: positiveMoney, idempotencyKey: uuid, parcelasIds: ids.optional() }).strict();
const receber = consulta.extend({
  idempotencyKey: uuid, valorRecebido: positiveMoney, totalExigido: positiveMoney,
  dataPagamento: date, estadoHash: hash, modo: z.enum(["integral", "parcial"]), observacoes: z.string().max(1000).optional(),
}).strict().superRefine((v, ctx) => {
  const pago = money.safeParse(v.valorRecebido), total = money.safeParse(v.totalExigido);
  if (!pago.success || !total.success) return;
  if (v.modo === "integral" ? pago.data !== total.data : centavosMulta(pago.data) >= centavosMulta(total.data))
    ctx.addIssue({ code: "custom", message: "Integral exige residual exato; parcial é positivo e menor, sem desconto." });
});
const consultaRenovacao = consulta.extend({ novoVencimento: date }).strict();
const renovar = consultaRenovacao.extend({
  idempotencyKey: uuid, valorRecebido: positiveMoney, totalExigido: positiveMoney,
  dataPagamento: date, estadoHash: hash, observacoes: z.string().max(1000).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.valorRecebido !== v.totalExigido || v.novoVencimento < v.dataPagamento)
    ctx.addIssue({ code: "custom", message: "Renovação exige encargos exatos e vencimento civil >= pagamento." });
});
export const aplicarMultaSchema = seguro(aplicacao);
export const consultaMultaSchema = seguro(consulta);
export const receberMultaSchema = seguro(receber);
export const consultaRenovacaoMultaSchema = seguro(consultaRenovacao);
export const renovarMultaSchema = seguro(renovar);
export type EntradaAplicarMulta = z.infer<typeof aplicarMultaSchema>;
export type ConsultaMulta = z.infer<typeof consultaMultaSchema>;
export type EntradaReceberMulta = z.infer<typeof receberMultaSchema>;
export type ConsultaRenovacaoMulta = z.infer<typeof consultaRenovacaoMultaSchema>;
export type EntradaRenovarMulta = z.infer<typeof renovarMultaSchema>;

export const capacidadesMultaSchema = seguro(z.object({
  disponivel: z.literal(true), regra: z.literal("multa36_v1"), aplicacao: z.literal(true), recebimento: z.literal(true), renovacao: z.literal(true),
}).strict());
export const multaIndisponivel = Object.freeze({ disponivel: false as const, regra: "multa36_v1" as const, aplicacao: false as const, recebimento: false as const, renovacao: false as const });
export const origemMultaSchema = seguro(z.object({ userId: id, contratoId: id, parcelaId: id, trilho: z.literal("multa36"), status: statusParcela }).strict());
export function normalizarOrigemMulta(value: unknown, userId: number, input: ConsultaMulta) {
  const i = parse(consultaMultaSchema, input);
  parse(id, userId);
  // null é somente a resposta SQL explícita, nunca uma recusa/erro convertido.
  if (value === null) return null;
  const r = parse(origemMultaSchema, value);
  exigir(r.userId === userId && r.contratoId === i.contratoId && r.parcelaId === i.parcelaId);
  return r;
}
export const resultadoAplicacaoMultaSchema = seguro(z.object({
  success: z.literal(true), operationId: uuid, repetida: z.boolean(), contratoId: id, contaCaixaId: id,
  parcelasIds: ids, quantidade: z.number().int().min(1).max(60), valorFixoPorParcela: positiveMoney,
  valorMultaTotal: positiveMoney, dataCivilBrt: date, estado: z.literal("exigivel_nao_recebida"), trilho: z.literal("multa36"),
}).strict());
export type ResultadoAplicacaoMulta = z.infer<typeof resultadoAplicacaoMultaSchema>;
export function normalizarAplicacaoMulta(value: unknown, input: EntradaAplicarMulta): ResultadoAplicacaoMulta {
  const i = parse(aplicarMultaSchema, input), r = parse(resultadoAplicacaoMultaSchema, value);
  exigir(r.contratoId === i.idcontrato && r.valorFixoPorParcela === i.multa && r.quantidade === r.parcelasIds.length &&
    centavosMulta(r.valorMultaTotal) === centavosMulta(i.multa) * BigInt(r.quantidade));
  // Sem IDs extras/omitidos. No modo automático o snapshot SQL congela sua lista no primeiro commit.
  if (i.parcelasIds) exigir(i.parcelasIds.length === r.parcelasIds.length && i.parcelasIds.every(v => r.parcelasIds.includes(v)));
  return r;
}
export const cotacaoMultaSchema = seguro(z.object({
  elegivel: z.boolean(), contratoId: id, parcelaId: id, contaCaixaId: id, totalExigido: money,
  multa: money, mora: money, jurosEmbutidos: money, valorPagoAcumulado: money, dataPagamento: date,
  vencimento: date, status: z.enum(["pendente", "atrasada", "vencendo_hoje", "parcial", "paga", "renovada"]), estadoHash: hash, regra: z.literal("recebimento_multa36_brt_v1"),
}).strict());
export type CotacaoMulta = z.infer<typeof cotacaoMultaSchema>;
export function normalizarCotacaoMulta(value: unknown, input: ConsultaMulta): CotacaoMulta {
  const i = parse(consultaMultaSchema, input), r = parse(cotacaoMultaSchema, value);
  const total = centavosMulta(r.totalExigido), pago = centavosMulta(r.valorPagoAcumulado);
  const encerrada = r.status === "paga" || r.status === "renovada";
  exigir(r.contratoId === i.contratoId && r.parcelaId === i.parcelaId && r.elegivel === (total > BigInt(0)) && encerrada === !r.elegivel);
  if (r.elegivel) exigir(total > BigInt(0) && ["pendente", "atrasada", "vencendo_hoje", "parcial"].includes(r.status));
  if (encerrada) exigir(!r.elegivel && total === BigInt(0));
  if (r.status === "renovada") exigir(pago > BigInt(0) && pago === centavosMulta(r.multa) + centavosMulta(r.mora) + centavosMulta(r.jurosEmbutidos));
  if (r.status === "parcial") exigir(pago > BigInt(0));
  if (["pendente", "atrasada", "vencendo_hoje"].includes(r.status)) exigir(pago === BigInt(0));
  exigir(total + pago >= centavosMulta(r.multa) + centavosMulta(r.mora) + centavosMulta(r.jurosEmbutidos));
  return r;
}
export const cotacaoRenovacaoMultaSchema = seguro(z.object({
  renovavel: z.boolean(), contratoId: id, parcelaId: id, contaCaixaId: id, totalExigido: money,
  juros: money, multa: money, mora: money, principalPreservado: money, dataPagamento: date,
  novoVencimento: date, estadoHash: hash, regra: z.literal("renovacao_multa36_brt_v1"),
}).strict());
export type CotacaoRenovacaoMulta = z.infer<typeof cotacaoRenovacaoMultaSchema>;
export function normalizarCotacaoRenovacaoMulta(value: unknown, input: ConsultaRenovacaoMulta): CotacaoRenovacaoMulta {
  const i = parse(consultaRenovacaoMultaSchema, input), r = parse(cotacaoRenovacaoMultaSchema, value);
  exigir(r.contratoId === i.contratoId && r.parcelaId === i.parcelaId && r.novoVencimento === i.novoVencimento &&
    centavosMulta(r.totalExigido) === centavosMulta(r.juros) + centavosMulta(r.multa) + centavosMulta(r.mora));
  if (r.renovavel) exigir(r.novoVencimento >= r.dataPagamento && centavosMulta(r.principalPreservado) > BigInt(0) && centavosMulta(r.totalExigido) > BigInt(0) && centavosMulta(r.juros) > BigInt(0));
  return r;
}
export const resultadoRecebimentoMultaSchema = seguro(z.object({
  success: z.literal(true), operationId: uuid, repetida: z.boolean(), contratoId: id, parcelaId: id,
  transacaoCaixaId: transacaoId, contaCaixaId: id, valorRecebido: positiveMoney, totalExigido: positiveMoney,
  saldoResidual: money, valorPagoAcumulado: positiveMoney, dataPagamento: date, status: z.enum(["paga", "parcial"]),
  contratoStatus: z.enum(["ativo", "quitado"]), regra: z.literal("recebimento_multa36_brt_v1"),
}).strict());
export type ResultadoRecebimentoMulta = z.infer<typeof resultadoRecebimentoMultaSchema>;
export function normalizarRecebimentoMulta(value: unknown, input: EntradaReceberMulta): ResultadoRecebimentoMulta {
  const i = parse(receberMultaSchema, input), r = parse(resultadoRecebimentoMultaSchema, value);
  const residual = centavosMulta(i.totalExigido) - centavosMulta(i.valorRecebido);
  exigir(r.contratoId === i.contratoId && r.parcelaId === i.parcelaId && r.valorRecebido === i.valorRecebido &&
    r.totalExigido === i.totalExigido && r.dataPagamento === i.dataPagamento && centavosMulta(r.saldoResidual) === residual &&
    (r.status === "paga") === (residual === BigInt(0)) && (i.modo === "integral") === (r.status === "paga") &&
    centavosMulta(r.valorPagoAcumulado) >= centavosMulta(r.valorRecebido) && (r.contratoStatus !== "quitado" || r.status === "paga"));
  return r;
}
export const resultadoRenovacaoMultaSchema = seguro(z.object({
  success: z.literal(true), operationId: uuid, repetida: z.boolean(), contratoId: id, parcelaId: id, novaParcelaId: id,
  transacaoCaixaId: transacaoId, contaCaixaId: id, valorRecebido: positiveMoney, dataPagamento: date, novoVencimento: date,
  contratoStatus: z.literal("ativo"), status: z.literal("renovada"), regra: z.literal("renovacao_multa36_brt_v1"),
}).strict());
export type ResultadoRenovacaoMulta = z.infer<typeof resultadoRenovacaoMultaSchema>;
export function normalizarRenovacaoMulta(value: unknown, input: EntradaRenovarMulta): ResultadoRenovacaoMulta {
  const i = parse(renovarMultaSchema, input), r = parse(resultadoRenovacaoMultaSchema, value);
  exigir(r.contratoId === i.contratoId && r.parcelaId === i.parcelaId && r.novaParcelaId !== i.parcelaId &&
    r.valorRecebido === i.valorRecebido && r.dataPagamento === i.dataPagamento && r.novoVencimento === i.novoVencimento);
  return r;
}

const acao = z.enum(["multa", "receber", "renovar"]);
const recoveryBase = z.object({ acao, idempotencyKey: uuid, payload: z.record(z.string(), z.unknown()) }).strict();
export type RecoveryMultaRequest = z.infer<typeof recoveryBase>;
function validarPayload(i: RecoveryMultaRequest) {
  exigir(!Object.hasOwn(i.payload, "idempotencyKey"));
  const input = { ...i.payload, idempotencyKey: i.idempotencyKey };
  if (i.acao === "multa") return parse(aplicarMultaSchema, input);
  if (i.acao === "receber") return parse(receberMultaSchema, input);
  return parse(renovarMultaSchema, input);
}
export const recuperacaoMultaSchema = seguro(recoveryBase.superRefine((i, ctx) => {
  try { validarPayload(i); }
  catch { ctx.addIssue({ code: "custom", message: "Payload original inválido; exclua owner/UUID e campos de outra ação." }); }
}));
export function validarRecuperacaoMulta(input: unknown): RecoveryMultaRequest { return parse(recuperacaoMultaSchema, input); }
/** Request JSONB do CONTRACT, sem owner nem UUID, com defaults explicitados. */
export function requestSqlRecuperacaoMulta(input: RecoveryMultaRequest): Record<string, unknown> {
  const i = validarRecuperacaoMulta(input), v = validarPayload(i);
  if (i.acao === "multa") {
    const a = v as EntradaAplicarMulta;
    return { acao: "multa", contratoId: a.idcontrato, multa: a.multa, parcelasIds: a.parcelasIds ?? null };
  }
  const r = v as EntradaReceberMulta | EntradaRenovarMulta;
  const base = { acao: i.acao, contratoId: r.contratoId, parcelaId: r.parcelaId, valorRecebido: r.valorRecebido,
    totalExigido: r.totalExigido, dataPagamento: r.dataPagamento, estadoHash: r.estadoHash,
    modo: i.acao === "renovar" ? "renovar" : (r as EntradaReceberMulta).modo, observacoes: r.observacoes?.trim() || null };
  return i.acao === "renovar" ? { ...base, novoVencimento: (r as EntradaRenovarMulta).novoVencimento } : base;
}
const provaSql = z.object({ status: z.enum(["confirmed", "not_executed"]), operationId: uuid.nullable(),
  result: z.unknown(), idempotencyKey: uuid, proof: z.literal("uuid_fenced36_v1") }).strict();
export const evidenciaSqlRecuperacaoMultaSchema = seguro(provaSql);
const provaHandler = seguro(provaSql.extend({ userId: id, acao, payload: z.record(z.string(), z.unknown()), payloadHash: hash.optional() }).strict());
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export type ResultadoRecuperacaoMulta = Omit<z.infer<typeof provaHandler>, "result"> & {
  result: ResultadoAplicacaoMulta | ResultadoRecebimentoMulta | ResultadoRenovacaoMulta | null;
};
/** UI exige wrapper autenticado; não aceita protocolo/família legado nem prova SQL sem owner. */
export function normalizarRecuperacaoMulta(value: unknown, userId: number, request: RecoveryMultaRequest): ResultadoRecuperacaoMulta {
  const i = validarRecuperacaoMulta(request), r = parse(provaHandler, value);
  parse(id, userId);
  exigir(Object.hasOwn(r, "result") && r.userId === userId && r.acao === i.acao &&
    r.idempotencyKey.toLowerCase() === i.idempotencyKey.toLowerCase() && canonical(r.payload) === canonical(i.payload));
  if (r.status === "not_executed") {
    exigir(r.operationId === null && r.result === null);
    return { ...r, result: null };
  }
  exigir(r.operationId !== null && r.result !== null);
  const v = validarPayload(i);
  const result = i.acao === "multa" ? normalizarAplicacaoMulta(r.result, v as EntradaAplicarMulta)
    : i.acao === "receber" ? normalizarRecebimentoMulta(r.result, v as EntradaReceberMulta)
    : normalizarRenovacaoMulta(r.result, v as EntradaRenovarMulta);
  exigir(result.operationId.toLowerCase() === r.operationId!.toLowerCase());
  return { ...r, result };
}
/** Só o adapter autenticado pode ligar o JSON SQL ao owner/ação/request que enviou. */
export function normalizarRespostaSqlRecuperacaoMulta(value: unknown, userId: number, request: RecoveryMultaRequest): ResultadoRecuperacaoMulta {
  const i = validarRecuperacaoMulta(request), r = parse(evidenciaSqlRecuperacaoMultaSchema, value);
  exigir(Object.hasOwn(r, "result"));
  return normalizarRecuperacaoMulta({ ...r, userId, acao: i.acao, payload: i.payload }, userId, i);
}
