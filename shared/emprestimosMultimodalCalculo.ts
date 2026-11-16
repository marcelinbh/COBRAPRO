import { z } from "zod";

/** Regras puras: sem ambiente, I/O, cliente RPC ou dependência do servidor. */
export const modalidadesMultimodal = Object.freeze(["mensal", "semanal", "quinzenal", "diario", "tabela_price"] as const);
export type ModalidadeMultimodal = typeof modalidadesMultimodal[number];
export type TipoTaxaMultimodal = "mensal" | "semanal" | "quinzenal" | "diaria";
export const tipoTaxaMultimodal: Readonly<Record<ModalidadeMultimodal, TipoTaxaMultimodal>> = Object.freeze({
  mensal: "mensal", semanal: "semanal", quinzenal: "quinzenal", diario: "diaria", tabela_price: "mensal",
});
const Z = BigInt(0), U = BigInt(1), D = BigInt(10000), C = BigInt(100);
const MAX_TOTAL = BigInt("999999999999");
function falhar(message: string): never { throw new Error(message); }

/** DATE civil inclusiva; UTC apenas para verificar o calendário, nunca o fuso do browser. */
export function dataMultimodalValida(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "2000-01-01" || value > "2100-12-31") return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function escalar(value: unknown, casas: number, maxInteiros: number): bigint {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "number" && !Number.isFinite(value))) falhar("Valor decimal inválido; informe precisão explícita, sem arredondamento silencioso.");
  const text = String(value);
  if (!new RegExp(`^\\d{1,${maxInteiros}}(?:\\.\\d{1,${casas}})?$`).test(text)) falhar("Valor decimal inválido; informe precisão explícita, sem arredondamento silencioso.");
  const [inteiro, fracao = ""] = text.split(".");
  return BigInt(inteiro) * BigInt(10 ** casas) + BigInt(fracao.padEnd(casas, "0"));
}
function moeda(value: bigint): string { return `${value / C}.${String(value % C).padStart(2, "0")}`; }
function percentual4(value: bigint): string { return `${value / D}.${String(value % D).padStart(4, "0")}`; }
function dividir(value: bigint, divisor: bigint): bigint { return (value * BigInt(2) + divisor) / (divisor * BigInt(2)); }
function potencia(base: bigint, expoente: number): bigint {
  let resultado = U, fator = base, n = expoente;
  while (n > 0) { if (n % 2 === 1) resultado *= fator; n = Math.floor(n / 2); if (n > 0) fator *= fator; }
  return resultado;
}
export type CalculoMultimodal = {
  valorPrincipal: string; taxaJuros: string; valorParcela: string; totalContrato: string; jurosTotal: string;
  parcelas: { valor: string; valorJuros: string }[];
};
/** Price racional exata; arredondamento half-up em centavos e acerto na última linha. */
export function calcularMultimodal(principal: number | string, taxa: number | string, n: number, modalidade: ModalidadeMultimodal): CalculoMultimodal {
  if (!modalidadesMultimodal.includes(modalidade) || !Number.isInteger(n) || n < 1 || n > 60) falhar("Modalidade ou quantidade de parcelas inválida.");
  const capital = escalar(principal, 2, 10), r = escalar(taxa, 2, 3);
  if (capital <= Z || capital > MAX_TOTAL || r > BigInt(99999)) falhar("Principal/taxa fora da faixa suportada.");
  const quantidade = BigInt(n);
  let referencia: bigint;
  const rows: { valor: bigint; juros: bigint }[] = [];
  if (modalidade === "tabela_price") {
    const a = potencia(D + r, n), b = potencia(D, n);
    referencia = r === Z ? dividir(capital, quantidade) : dividir(capital * r * a, D * (a - b));
    let saldo = capital;
    for (let i = 0; i < n; i++) {
      const juros = dividir(saldo * r, D);
      const valor = i === n - 1 ? saldo + juros : referencia;
      const amortizacao = valor - juros;
      if (valor <= Z || juros < Z || amortizacao <= Z || amortizacao > saldo) falhar("Principal insuficiente para amortização Price positiva e conservativa.");
      rows.push({ valor, juros }); saldo -= amortizacao;
    }
    if (saldo !== Z) falhar("Amortização não conserva o principal.");
  } else {
    const juros = dividir(capital * r * (modalidade === "diario" ? U : quantidade), D);
    const total = capital + juros;
    referencia = dividir(total, quantidade);
    const jref = dividir(juros, quantidade);
    for (let i = 0; i < n; i++) rows.push({
      valor: i === n - 1 ? total - referencia * (quantidade - U) : referencia,
      juros: i === n - 1 ? juros - jref * (quantidade - U) : jref,
    });
  }
  const total = rows.reduce((s, p) => s + p.valor, Z), juros = rows.reduce((s, p) => s + p.juros, Z);
  if (total > MAX_TOTAL || total - juros !== capital || rows.some(p => p.valor <= Z || p.juros < Z || p.juros > p.valor)) falhar("Parcelas não conservam principal/centavos ou excedem NUMERIC(12,2) do histórico financeiro.");
  return { valorPrincipal: moeda(capital), taxaJuros: moeda(r), valorParcela: moeda(referencia), totalContrato: moeda(total), jurosTotal: moeda(juros), parcelas: rows.map(p => ({ valor: moeda(p.valor), valorJuros: moeda(p.juros) })) };
}
/** Agenda mensal ancorada no primeiro dia, com recuperação após fevereiro. */
export function gerarAgendaMultimodal(primeira: string, n: number, modalidade: ModalidadeMultimodal): string[] {
  if (!dataMultimodalValida(primeira) || !Number.isInteger(n) || n < 1 || n > 60 || !modalidadesMultimodal.includes(modalidade)) falhar("Agenda inválida.");
  const [ano, mes, dia] = primeira.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const mensal = modalidade === "mensal" || modalidade === "tabela_price";
    const last = mensal ? new Date(Date.UTC(ano, mes + i, 0, 12)).getUTCDate() : dia;
    const d = mensal ? new Date(Date.UTC(ano, mes - 1 + i, Math.min(dia, last), 12)) : new Date(Date.UTC(ano, mes - 1, dia + i * (modalidade === "semanal" ? 7 : modalidade === "quinzenal" ? 15 : 1), 12));
    const value = d.toISOString().slice(0, 10);
    if (!dataMultimodalValida(value)) falhar("Agenda excede o calendário suportado (2000..2100).");
    return value;
  });
}

/** Rejeita instâncias, accessors, chaves herdadas/symbols, ciclos e arrays esparsos sem executar getters. */
export function jsonMultimodalSeguro(value: unknown): boolean {
  const stack = new Set<object>(); let itens = 0;
  function visit(v: unknown, depth: number): boolean {
    if (++itens > 2048 || depth > 12) return false;
    if (v === null || typeof v === "boolean" || typeof v === "string") return true;
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v !== "object" || stack.has(v)) return false;
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(descriptors);
    if (keys.some(k => typeof k !== "string")) return false;
    stack.add(v);
    if (array) {
      const length = descriptors.length?.value;
      if (!Number.isInteger(length) || length < 0 || length > 2048 || keys.length !== length + 1) return false;
      for (let i = 0; i < length; i++) {
        const d = descriptors[String(i)];
        if (!d || !d.enumerable || !("value" in d) || !visit(d.value, depth + 1)) return false;
      }
    } else {
      for (const k of keys as string[]) {
        const d = descriptors[k];
        if (!d.enumerable || !("value" in d) || !visit(d.value, depth + 1)) return false;
      }
    }
    stack.delete(v); return true;
  }
  try { return visit(value, 0); } catch { return false; }
}
function seguro<T extends z.ZodType>(schema: T): z.ZodType<z.output<T>, z.input<T>> {
  return z.preprocess((value, ctx) => {
    if (!jsonMultimodalSeguro(value)) { ctx.addIssue({ code: "custom", message: "Objeto financeiro deve conter somente JSON explícito e próprio." }); return z.NEVER; }
    return value;
  }, schema) as unknown as z.ZodType<z.output<T>, z.input<T>>;
}
const id = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid();
const date = z.string().refine(dataMultimodalValida);
const decimal = z.union([z.string(), z.number().finite()]);
const money = z.string().regex(/^(0|[1-9]\d{0,9})\.\d{2}$/);
const percentual = z.string().regex(/^(0|[1-9]\d{0,3})\.\d{4}$/);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const transacaoId = z.string().regex(/^[1-9]\d{0,18}$/).refine(v => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= BigInt("9223372036854775807"));
const tipoTaxa = z.enum(["mensal", "semanal", "quinzenal", "diaria"]);
export const entradaMultimodalSchema = seguro(z.object({
  idempotencyKey: uuid, clienteId: id, contaCaixaId: id, modalidade: z.enum(modalidadesMultimodal), tipoTaxa,
  valorPrincipal: decimal, taxaJuros: decimal, numeroParcelas: z.number().int().min(1).max(60),
  dataInicio: date, dataDesembolso: date, vencimentos: z.array(date).min(1).max(60),
  multaAtraso: decimal, jurosMoraDiario: decimal,
  descricao: z.string().max(2000).optional(), observacoes: z.string().max(4000).optional(),
}).strict());
export type EntradaMultimodal = z.infer<typeof entradaMultimodalSchema>;
export function validarEntradaCriacaoMultimodal(input: unknown) {
  const parsed = entradaMultimodalSchema.safeParse(input);
  if (!parsed.success) falhar("Intenção de cadastro inválida.");
  const i = parsed.data;
  if (i.tipoTaxa !== tipoTaxaMultimodal[i.modalidade] || i.dataInicio !== i.dataDesembolso || i.vencimentos.length !== i.numeroParcelas ||
    i.vencimentos.some((v, pos) => v < i.dataInicio || (pos > 0 && v <= i.vencimentos[pos - 1])) || JSON.stringify(i.vencimentos) !== JSON.stringify(gerarAgendaMultimodal(i.vencimentos[0], i.numeroParcelas, i.modalidade))) falhar("Modalidade/taxa e agenda civil devem corresponder à intenção explícita.");
  const multa = escalar(i.multaAtraso, 4, 4), mora = escalar(i.jurosMoraDiario, 4, 4);
  return { entrada: i, calculo: calcularMultimodal(i.valorPrincipal, i.taxaJuros, i.numeroParcelas, i.modalidade), multaAtraso: percentual4(multa), jurosMoraDiario: percentual4(mora) };
}
export const resultadoCriacaoMultimodalSchema = seguro(z.object({
  success: z.literal(true), repetida: z.boolean(), id, operationId: uuid, parcelasIds: z.array(id).min(1).max(60),
  transacaoCaixaId: transacaoId, valorParcela: money, totalContrato: money, jurosTotal: money,
  numeroParcelas: z.number().int().min(1).max(60), dataDesembolso: date, vencimentos: z.array(date).min(1).max(60),
  status: z.literal("ativo"), regra: z.literal("multimodal_v1"), modalidade: z.enum(modalidadesMultimodal), tipoTaxa,
  multaAtraso: percentual, jurosMoraDiario: percentual,
}).strict());
export type ResultadoCriacaoMultimodal = z.infer<typeof resultadoCriacaoMultimodalSchema>;
export function normalizarResultadoCriacaoMultimodal(value: unknown, input: EntradaMultimodal): ResultadoCriacaoMultimodal {
  const esperado = validarEntradaCriacaoMultimodal(input), parsed = resultadoCriacaoMultimodalSchema.safeParse(value);
  if (!parsed.success) falhar("Confirmação inválida; preserve UUID/payload para conferir, sem presumir rollback.");
  const r = parsed.data, c = esperado.calculo, i = esperado.entrada;
  if (r.numeroParcelas !== i.numeroParcelas || r.parcelasIds.length !== i.numeroParcelas || new Set(r.parcelasIds).size !== r.parcelasIds.length ||
    r.valorParcela !== c.valorParcela || r.totalContrato !== c.totalContrato || r.jurosTotal !== c.jurosTotal ||
    r.modalidade !== i.modalidade || r.tipoTaxa !== i.tipoTaxa || r.multaAtraso !== esperado.multaAtraso || r.jurosMoraDiario !== esperado.jurosMoraDiario ||
    r.dataDesembolso !== i.dataDesembolso || JSON.stringify(r.vencimentos) !== JSON.stringify(i.vencimentos)) falhar("RPC divergiu do cálculo/intenção; confira a mesma chave antes de prosseguir.");
  return r;
}
const consulta = z.object({ contratoId: id, parcelaId: id }).strict();
export const consultaMultimodalSchema = seguro(consulta);
export type ConsultaMultimodal = z.infer<typeof consultaMultimodalSchema>;
export const recebimentoMultimodalSchema = seguro(consulta.extend({
  idempotencyKey: uuid, valorRecebido: money, totalExigido: money, dataPagamento: date, estadoHash: hash,
  modo: z.enum(["integral", "parcial"]), observacoes: z.string().max(1000).optional(),
}).strict().superRefine((v, ctx) => {
  if (!money.safeParse(v.valorRecebido).success || !money.safeParse(v.totalExigido).success) return;
  const pago = escalar(v.valorRecebido, 2, 10), total = escalar(v.totalExigido, 2, 10);
  if (pago <= Z || total <= Z || (v.modo === "integral" ? pago !== total : pago >= total)) ctx.addIssue({ code: "custom", message: "Integral exige total exato; parcial positivo e menor, sem desconto implícito." });
}));
export type EntradaRecebimentoMultimodal = z.infer<typeof recebimentoMultimodalSchema>;
export const cotacaoMultimodalSchema = seguro(z.object({
  elegivel: z.boolean(), contratoId: id, parcelaId: id, contaCaixaId: id, totalExigido: money,
  multa: money, mora: money, jurosEmbutidos: money, valorPagoAcumulado: money, dataPagamento: date, vencimento: date,
  status: z.enum(["pendente", "atrasada", "vencendo_hoje", "parcial", "paga"]), estadoHash: hash,
  regra: z.literal("recebimento_multimodal_brt_v1"),
}).strict());
export type CotacaoMultimodal = z.infer<typeof cotacaoMultimodalSchema>;
export function normalizarCotacaoMultimodal(value: unknown, input: ConsultaMultimodal): CotacaoMultimodal {
  const i = validarSchema(consultaMultimodalSchema, input, "Consulta inválida."), parsed = cotacaoMultimodalSchema.safeParse(value);
  if (!parsed.success) falhar("Cotação inválida; nenhum recebimento deve ser confirmado.");
  const r = parsed.data, total = escalar(r.totalExigido, 2, 10), pago = escalar(r.valorPagoAcumulado, 2, 10);
  if (r.contratoId !== i.contratoId || r.parcelaId !== i.parcelaId || r.elegivel !== (total > Z) || (r.status === "paga") !== !r.elegivel ||
    (r.status === "parcial" && pago <= Z) || (!["parcial", "paga"].includes(r.status) && pago !== Z) ||
    total + pago < escalar(r.multa, 2, 10) + escalar(r.mora, 2, 10) + escalar(r.jurosEmbutidos, 2, 10)) falhar("Cotação inválida; nenhum recebimento deve ser confirmado.");
  return r;
}
export const resultadoRecebimentoMultimodalSchema = seguro(z.object({
  success: z.literal(true), repetida: z.boolean(), operationId: uuid, contratoId: id, parcelaId: id,
  transacaoCaixaId: transacaoId, contaCaixaId: id, valorRecebido: money, totalExigido: money,
  saldoResidual: money, valorPagoAcumulado: money, status: z.enum(["paga", "parcial"]), contratoStatus: z.enum(["ativo", "quitado"]),
  dataPagamento: date, regra: z.literal("recebimento_multimodal_brt_v1"),
}).strict());
export type ResultadoRecebimentoMultimodal = z.infer<typeof resultadoRecebimentoMultimodalSchema>;
export function normalizarRecebimentoMultimodal(value: unknown, input: EntradaRecebimentoMultimodal): ResultadoRecebimentoMultimodal {
  const i = validarSchema(recebimentoMultimodalSchema, input, "Intenção de recebimento inválida."), parsed = resultadoRecebimentoMultimodalSchema.safeParse(value);
  if (!parsed.success) falhar("Recebimento não confirmado. Preserve UUID e payload.");
  const r = parsed.data, residual = escalar(i.totalExigido, 2, 10) - escalar(i.valorRecebido, 2, 10);
  if (r.contratoId !== i.contratoId || r.parcelaId !== i.parcelaId || r.valorRecebido !== i.valorRecebido || r.totalExigido !== i.totalExigido || r.dataPagamento !== i.dataPagamento ||
    r.saldoResidual !== moeda(residual) || (r.status === "paga") !== (residual === Z) || (i.modo === "integral") !== (r.status === "paga") ||
    escalar(r.valorPagoAcumulado, 2, 10) < escalar(r.valorRecebido, 2, 10) || (r.contratoStatus === "quitado" && r.status !== "paga")) falhar("Confirmação divergiu da intenção; confira o mesmo UUID.");
  return r;
}
const consultaRenovacao = consulta.extend({ novoVencimento: date }).strict();
export const consultaRenovacaoMultimodalSchema = seguro(consultaRenovacao);
export type ConsultaRenovacaoMultimodal = z.infer<typeof consultaRenovacaoMultimodalSchema>;
export const renovacaoMultimodalSchema = seguro(consultaRenovacao.extend({
  idempotencyKey: uuid, valorRecebido: money, totalExigido: money, dataPagamento: date, estadoHash: hash,
  observacoes: z.string().max(1000).optional(),
}).strict().superRefine((v, ctx) => {
  if (!money.safeParse(v.valorRecebido).success || !money.safeParse(v.totalExigido).success) return;
  if (escalar(v.valorRecebido, 2, 10) <= Z || v.valorRecebido !== v.totalExigido || v.novoVencimento < v.dataPagamento) ctx.addIssue({ code: "custom", message: "Renovação exige exatamente juros e encargos cotados, sem receber principal, com vencimento >= data civil do pagamento." });
}));
export type EntradaRenovacaoMultimodal = z.infer<typeof renovacaoMultimodalSchema>;
export const cotacaoRenovacaoMultimodalSchema = seguro(z.object({
  renovavel: z.boolean(), contratoId: id, parcelaId: id, contaCaixaId: id, totalExigido: money,
  juros: money, multa: money, mora: money, principalPreservado: money, dataPagamento: date, novoVencimento: date,
  estadoHash: hash, regra: z.literal("renovacao_multimodal_brt_v1"),
}).strict());
export type CotacaoRenovacaoMultimodal = z.infer<typeof cotacaoRenovacaoMultimodalSchema>;
export function normalizarCotacaoRenovacaoMultimodal(value: unknown, input: ConsultaRenovacaoMultimodal): CotacaoRenovacaoMultimodal {
  const i = validarSchema(consultaRenovacaoMultimodalSchema, input, "Consulta de renovação inválida."), parsed = cotacaoRenovacaoMultimodalSchema.safeParse(value);
  if (!parsed.success) falhar("Cotação de renovação inválida. Não confirmar cobrança.");
  const r = parsed.data;
  if (r.contratoId !== i.contratoId || r.parcelaId !== i.parcelaId || r.novoVencimento !== i.novoVencimento || r.novoVencimento < r.dataPagamento ||
    escalar(r.totalExigido, 2, 10) !== escalar(r.juros, 2, 10) + escalar(r.multa, 2, 10) + escalar(r.mora, 2, 10) ||
    (r.renovavel && (escalar(r.principalPreservado, 2, 10) <= Z || escalar(r.juros, 2, 10) <= Z))) falhar("Cotação de renovação inválida. Não confirmar cobrança.");
  return r;
}
export const resultadoRenovacaoMultimodalSchema = seguro(z.object({
  success: z.literal(true), repetida: z.boolean(), operationId: uuid, contratoId: id, parcelaId: id, novaParcelaId: id,
  transacaoCaixaId: transacaoId, contaCaixaId: id, valorRecebido: money, dataPagamento: date, novoVencimento: date,
  contratoStatus: z.literal("ativo"), status: z.literal("renovada"), regra: z.literal("renovacao_multimodal_brt_v1"),
}).strict());
export type ResultadoRenovacaoMultimodal = z.infer<typeof resultadoRenovacaoMultimodalSchema>;
export function normalizarRenovacaoMultimodal(value: unknown, input: EntradaRenovacaoMultimodal): ResultadoRenovacaoMultimodal {
  const i = validarSchema(renovacaoMultimodalSchema, input, "Intenção de renovação inválida."), parsed = resultadoRenovacaoMultimodalSchema.safeParse(value);
  if (!parsed.success || parsed.data.contratoId !== i.contratoId || parsed.data.parcelaId !== i.parcelaId || parsed.data.novaParcelaId === i.parcelaId ||
    parsed.data.valorRecebido !== i.valorRecebido || parsed.data.dataPagamento !== i.dataPagamento || parsed.data.novoVencimento !== i.novoVencimento) falhar("Renovação não confirmada; preserve intenção/UUID.");
  return parsed.data;
}
function validarSchema<T extends z.ZodType>(schema: T, input: unknown, message: string): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) falhar(message);
  return parsed.data;
}

export const familiasMultimodal = ["multimodal_criar", "multimodal_receber", "multimodal_renovar"] as const;
export type FamiliaMultimodal = typeof familiasMultimodal[number];
export const recuperacaoMultimodalSchema = seguro(z.object({
  family: z.enum(familiasMultimodal), idempotencyKey: uuid, payload: z.record(z.string(), z.unknown()),
}).strict());
export type RecuperacaoMultimodal = z.infer<typeof recuperacaoMultimodalSchema>;
const evidenceSchema = seguro(z.object({
  userId: id, family: z.enum(familiasMultimodal), idempotencyKey: uuid, payload: z.record(z.string(), z.unknown()),
  payloadHash: hash, proof: z.literal("uuid_fenced_v1"), status: z.enum(["confirmed", "not_executed"]),
  fenceId: uuid.nullable(), result: z.unknown(), quote: z.null(),
}).strict());
export type EvidenciaRecuperacaoMultimodal = z.infer<typeof evidenceSchema>;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function validarRecuperacaoMultimodal(input: unknown): RecuperacaoMultimodal {
  const i = validarSchema(recuperacaoMultimodalSchema, input, "Intenção de reconciliação inválida.");
  const payload = { ...i.payload, idempotencyKey: i.idempotencyKey };
  // A key nunca deve estar no body, mesmo quando coincide com o envelope.
  if (Object.hasOwn(i.payload, "idempotencyKey")) falhar("Request original deve excluir UUID e owner.");
  if (i.family === "multimodal_criar") validarEntradaCriacaoMultimodal(payload);
  else validarSchema(i.family === "multimodal_receber" ? recebimentoMultimodalSchema : renovacaoMultimodalSchema, payload, "Payload de reconciliação inválido.");
  return i;
}
/** Digest público validado apenas por formato: JSONB PostgreSQL não é JSON.stringify. */
export function normalizarRecuperacaoMultimodal(value: unknown, userId: number, request: unknown): EvidenciaRecuperacaoMultimodal {
  const i = validarRecuperacaoMultimodal(request), parsed = evidenceSchema.safeParse(value);
  if (!id.safeParse(userId).success || !parsed.success) falhar("Reconciliação não comprovada; preserve UUID/payload.");
  const r = parsed.data;
  if (r.userId !== userId || r.family !== i.family || r.idempotencyKey.toLowerCase() !== i.idempotencyKey.toLowerCase() || canonical(r.payload) !== canonical(i.payload) ||
    (r.status === "not_executed" && (r.fenceId === null || r.result !== null)) ||
    (r.status === "confirmed" && (r.fenceId !== null || !Object.hasOwn(r, "result")))) falhar("Reconciliação não comprovada para este UUID/payload; intenção preservada.");
  if (r.status === "confirmed") {
    const payload = { ...i.payload, idempotencyKey: i.idempotencyKey };
    if (i.family === "multimodal_criar") r.result = normalizarResultadoCriacaoMultimodal(r.result, validarEntradaCriacaoMultimodal(payload).entrada);
    else if (i.family === "multimodal_receber") r.result = normalizarRecebimentoMultimodal(r.result, validarSchema(recebimentoMultimodalSchema, payload, "Payload inválido."));
    else r.result = normalizarRenovacaoMultimodal(r.result, validarSchema(renovacaoMultimodalSchema, payload, "Payload inválido."));
  }
  return r;
}
