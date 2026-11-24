import { z } from "zod";

export const CAIXA37_MAX_ID = 2147483647;
export const CAIXA37_MAX_VALOR = "9999999999.99";
export const CAIXA37_MAX_BASE = "9999999999999.99";
const ZERO = BigInt(0);
const CEM = BigInt(100);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL = /^-?(0|[1-9][0-9]*)\.[0-9]{2}$/;

/** Copia somente valores JSON próprios pelos descriptors, antes de qualquer getter.
 * Não usa toJSON, coerção, campos herdados nem o objeto original dentro do Zod.
 * Arrays têm somente índices contíguos; objetos podem ter Object.prototype ou null.
 */
export function copiarJsonCaixa37(value: unknown): unknown {
  const visiting = new Set<object>();
  function copy(v: unknown, depth: number): unknown {
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v !== "object" || v === null || depth > 100 || visiting.has(v)) throw new Error("JSON37 inválido.");
    const array = Array.isArray(v);
    const prototype = Object.getPrototypeOf(v);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("Protótipo JSON37 inválido.");
    visiting.add(v);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(v);
      const keys = Reflect.ownKeys(descriptors);
      if (keys.some(k => typeof k !== "string")) throw new Error("Chave JSON37 inválida.");
      if (array) {
        const length = descriptors.length;
        if (!length || !("value" in length) || !Number.isSafeInteger(length.value) || length.value < 0 || length.enumerable || keys.length !== length.value + 1) throw new Error("Array JSON37 inválido.");
        const result: unknown[] = [];
        for (let i = 0; i < length.value; i++) {
          const d = descriptors[String(i)];
          if (!d || !("value" in d) || !d.enumerable) throw new Error("Índice JSON37 inválido.");
          result.push(copy(d.value, depth + 1));
        }
        return result;
      }
      const result: Record<string, unknown> = Object.create(null);
      for (const key of keys as string[]) {
        const d = descriptors[key];
        if (!("value" in d) || !d.enumerable) throw new Error("Campo JSON37 inválido.");
        result[key] = copy(d.value, depth + 1);
      }
      return result;
    } finally { visiting.delete(v); }
  }
  return copy(value, 0);
}
export function jsonCaixa37Seguro(value: unknown): boolean {
  try { copiarJsonCaixa37(value); return true; } catch { return false; }
}
function seguro<T extends z.ZodType>(schema: T): z.ZodType<z.output<T>, z.input<T>> {
  return z.preprocess((value, ctx) => {
    try { return copiarJsonCaixa37(value); }
    catch { ctx.addIssue({ code: "custom", message: "Caixa37 exige JSON próprio, explícito e sem accessors." }); return z.NEVER; }
  }, schema) as unknown as z.ZodType<z.output<T>, z.input<T>>;
}
function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const r = schema.safeParse(value);
  if (!r.success) throw new Error("Intenção/prova caixa37 inválida; preserve o mesmo UUID/request. Erro não prova ausência de execução.");
  return r.data;
}
function exigir(ok: boolean): void {
  if (!ok) throw new Error("Prova caixa37 divergiu da intenção; preserve o mesmo UUID/request. Resultado não confirmado.");
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
}

/** DATE civil real, inclusive séculos/bissextos; não consulta relógio ou fuso JS. */
export function dataCaixa37Valida(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
/** Centavos BigInt assinados; agregados não herdam limite de dígitos da operação. */
export function monetaryBigInt(value: string): bigint {
  if (typeof value !== "string" || !DECIMAL.test(value) || value === "-0.00") throw new Error("Decimal caixa37 não canônico.");
  const negative = value.startsWith("-");
  const absolute = negative ? value.slice(1) : value;
  const [integer, fraction] = absolute.split(".");
  const n = BigInt(integer) * CEM + BigInt(fraction);
  return negative ? -n : n;
}
export const centavosCaixa37 = monetaryBigInt;
export function decimalCaixa37(value: bigint): string {
  const negative = value < ZERO, absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / CEM}.${String(absolute % CEM).padStart(2, "0")}`;
}
const id = z.number().int().positive().max(CAIXA37_MAX_ID);
const uuidInput = z.string().regex(UUID).transform(v => v.toLowerCase());
const uuidCanonical = z.string().regex(UUID).refine(v => v === v.toLowerCase());
const date = z.string().refine(dataCaixa37Valida);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const money = z.string().regex(/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/).refine(v => v !== "0.00");
const signed = z.string().regex(DECIMAL).refine(v => v !== "-0.00");
const unsigned = z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/);
const base = z.string().regex(/^-?(0|[1-9][0-9]{0,12})\.[0-9]{2}$/).refine(v => v !== "-0.00");
const descricaoCanonical = z.string().min(1).max(500).refine(v => v === v.trim()).nullable();
// Inputs de formulário são strings opcionais; requests/provas nunca são re-normalizados.
const descricaoForm = z.string().refine(v => v.trim().length <= 500).optional();
export function normalizarDescricao37(value?: string): string | null {
  if (value !== undefined && typeof value !== "string") throw new Error("Descrição caixa37 inválida.");
  const normalized = value === undefined ? null : value.trim() || null;
  return parse(descricaoCanonical, normalized);
}
const quoteAporte = z.object({ acao: z.literal("aporte"), contaDestinoId: id, valor: money, descricao: descricaoForm }).strict();
const quoteTransfer = z.object({ acao: z.literal("transferir"), contaOrigemId: id, contaDestinoId: id, valor: money, descricao: descricaoForm }).strict().refine(v => v.contaOrigemId !== v.contaDestinoId);
export const cotarCaixa37Schema = seguro(z.discriminatedUnion("acao", [quoteAporte, quoteTransfer]));
const aporteInput = z.object({ contaDestinoId: id, valor: money, descricao: descricaoForm, dataTransacao: date, estadoHash: hash, idempotencyKey: uuidInput }).strict();
const transferInput = aporteInput.extend({ contaOrigemId: id }).strict().refine(v => v.contaOrigemId !== v.contaDestinoId);
export const aportar37Schema = seguro(aporteInput);
export const transferir37Schema = seguro(transferInput);
export type Acao37 = "aporte" | "transferir";
export type CotarCaixa37Input = z.infer<typeof cotarCaixa37Schema>;
export type Aportar37Input = z.infer<typeof aportar37Schema>;
export type Transferir37Input = z.infer<typeof transferir37Schema>;
const request = z.object({
  acao: z.enum(["aporte", "transferir"]), contaOrigemId: id.nullable(), contaDestinoId: id,
  valor: money, descricao: descricaoCanonical, dataTransacao: date, estadoHash: hash,
}).strict().refine(v => v.acao === "aporte" ? v.contaOrigemId === null : v.contaOrigemId !== null && v.contaOrigemId !== v.contaDestinoId);
export const request37Schema = seguro(request);
export const recovery37Schema = seguro(z.object({ idempotencyKey: uuidInput, request }).strict());
export type Request37 = z.infer<typeof request37Schema>;
export type Recovery37Input = z.infer<typeof recovery37Schema>;

/** Congela descrição/UUID antes de enviar; request SQL é sempre null|string e sem owner/chave. */
export function congelarRequestAporte37(input: Aportar37Input): Request37 {
  const i = parse(aportar37Schema, input);
  return freeze(parse(request37Schema, { acao: "aporte", contaOrigemId: null, contaDestinoId: i.contaDestinoId,
    valor: i.valor, descricao: normalizarDescricao37(i.descricao), dataTransacao: i.dataTransacao, estadoHash: i.estadoHash }));
}
export function congelarRequestTransferencia37(input: Transferir37Input): Request37 {
  const i = parse(transferir37Schema, input);
  return freeze(parse(request37Schema, { acao: "transferir", contaOrigemId: i.contaOrigemId, contaDestinoId: i.contaDestinoId,
    valor: i.valor, descricao: normalizarDescricao37(i.descricao), dataTransacao: i.dataTransacao, estadoHash: i.estadoHash }));
}
export function congelarRecovery37(input: Recovery37Input): Recovery37Input {
  // Descrição já canônica é validada, não trimada e nunca corrigida no replay/recovery.
  return freeze(parse(recovery37Schema, input));
}
export function congelarIntencaoAporte37(input: Aportar37Input): Recovery37Input {
  const i = parse(aportar37Schema, input);
  return congelarRecovery37({ idempotencyKey: i.idempotencyKey, request: congelarRequestAporte37(i) });
}
export function congelarIntencaoTransferencia37(input: Transferir37Input): Recovery37Input {
  const i = parse(transferir37Schema, input);
  return congelarRecovery37({ idempotencyKey: i.idempotencyKey, request: congelarRequestTransferencia37(i) });
}
export function congelarCotarCaixa37Input(input: CotarCaixa37Input): CotarCaixa37Input {
  const i = parse(cotarCaixa37Schema, input), descricao = normalizarDescricao37(i.descricao);
  const common = { contaDestinoId: i.contaDestinoId, valor: i.valor, ...(descricao === null ? {} : { descricao }) };
  return freeze(i.acao === "aporte" ? { acao: "aporte", ...common } : { acao: "transferir", contaOrigemId: i.contaOrigemId, ...common });
}

export const capacidades37Schema = seguro(z.object({ disponivel: z.literal(true), regra: z.literal("caixa37_v1"), aporte: z.literal(true), transferencia: z.literal(true), recovery: z.literal(true) }).strict());
export const caixa37Indisponivel = Object.freeze({ disponivel: false as const, regra: "caixa37_v1" as const, aporte: false as const, transferencia: false as const, recovery: false as const });
export type Capacidades37 = z.infer<typeof capacidades37Schema> | typeof caixa37Indisponivel;
const contaSaldo = z.object({ contaCaixaId: id, nome: z.string(), saldoBase: base, entradas: unsigned, saidas: unsigned, saldoEfetivo: signed }).strict();
export const contaSaldo37Schema = seguro(contaSaldo);
export type ContaSaldo37 = z.infer<typeof contaSaldo37Schema>;
export const cotacao37Schema = seguro(z.object({
  elegivel: z.literal(true), regra: z.literal("caixa37_brt_v1"), acao: z.enum(["aporte", "transferir"]),
  contaOrigemId: id.nullable(), contaDestinoId: id, valor: money, descricao: descricaoCanonical, dataTransacao: date, estadoHash: hash,
  origem: contaSaldo.nullable(), destino: contaSaldo, saldoOrigemApos: signed.nullable(), saldoDestinoApos: signed,
  saldoTotalOwnerAntes: signed, saldoTotalOwnerApos: signed,
}).strict());
export type Cotacao37 = z.infer<typeof cotacao37Schema>;
function conferirConta(v: ContaSaldo37): void {
  exigir(monetaryBigInt(v.saldoEfetivo) === monetaryBigInt(v.saldoBase) + monetaryBigInt(v.entradas) - monetaryBigInt(v.saidas));
}
export function normalizarCotacao37(value: unknown, input: CotarCaixa37Input): Cotacao37 {
  // O caller já congelou o formulário antes da cotação. Conferir não normaliza
  // novamente: descrição divergente/vazia aqui é inválida, não é silenciosamente corrigida.
  const i = parse(cotarCaixa37Schema, input), r = parse(cotacao37Schema, value);
  if (i.descricao !== undefined) parse(descricaoCanonical, i.descricao);
  exigir(r.acao === i.acao && r.contaDestinoId === i.contaDestinoId && r.destino.contaCaixaId === i.contaDestinoId &&
    r.valor === i.valor && r.descricao === (i.descricao ?? null));
  conferirConta(r.destino);
  const valor = monetaryBigInt(i.valor);
  exigir(monetaryBigInt(r.saldoDestinoApos) === monetaryBigInt(r.destino.saldoEfetivo) + valor);
  if (i.acao === "aporte") {
    exigir(r.contaOrigemId === null && r.origem === null && r.saldoOrigemApos === null &&
      monetaryBigInt(r.saldoTotalOwnerApos) === monetaryBigInt(r.saldoTotalOwnerAntes) + valor);
  } else {
    exigir(r.contaOrigemId === i.contaOrigemId && r.origem !== null && r.saldoOrigemApos !== null);
    const origem = r.origem!;
    conferirConta(origem);
    exigir(origem.contaCaixaId === i.contaOrigemId && monetaryBigInt(r.saldoOrigemApos!) === monetaryBigInt(origem.saldoEfetivo) - valor &&
      r.saldoTotalOwnerApos === r.saldoTotalOwnerAntes);
  }
  return freeze(r);
}
const transacaoId = z.string().regex(/^[1-9][0-9]{0,9}$/).refine(v => /^[1-9][0-9]{0,9}$/.test(v) && BigInt(v) <= BigInt(CAIXA37_MAX_ID));
const perna = z.object({ papel: z.enum(["aporte", "origem", "destino"]), transacaoCaixaId: transacaoId, contaCaixaId: id, tipo: z.enum(["entrada", "saida"]), valor: money }).strict();
export const perna37Schema = seguro(perna);
export type Perna37 = z.infer<typeof perna37Schema>;
const resultado = z.object({
  success: z.literal(true), regra: z.literal("caixa37_v1"), acao: z.enum(["aporte", "transferir"]),
  operationId: uuidCanonical, idempotencyKey: uuidCanonical, repetida: z.boolean(), contaOrigemId: id.nullable(), contaDestinoId: id,
  valor: money, dataTransacao: date, descricao: descricaoCanonical, pernas: z.array(perna).min(1).max(2),
  saldoOrigemAntes: signed.nullable(), saldoOrigemApos: signed.nullable(), saldoDestinoAntes: signed, saldoDestinoApos: signed,
  saldoTotalOwnerAntes: signed, saldoTotalOwnerApos: signed,
}).strict();
export const resultado37Schema = seguro(resultado);
export type Result37 = z.infer<typeof resultado37Schema>;
export function normalizarResultado37(value: unknown, intent: Recovery37Input): Result37 {
  const i = congelarRecovery37(intent), q = i.request, r = parse(resultado37Schema, value);
  exigir(r.idempotencyKey === i.idempotencyKey && r.acao === q.acao && r.contaOrigemId === q.contaOrigemId &&
    r.contaDestinoId === q.contaDestinoId && r.valor === q.valor && r.dataTransacao === q.dataTransacao && r.descricao === q.descricao);
  const valor = monetaryBigInt(q.valor);
  exigir(monetaryBigInt(r.saldoDestinoApos) === monetaryBigInt(r.saldoDestinoAntes) + valor);
  if (q.acao === "aporte") {
    exigir(r.pernas.length === 1 && r.saldoOrigemAntes === null && r.saldoOrigemApos === null &&
      monetaryBigInt(r.saldoTotalOwnerApos) === monetaryBigInt(r.saldoTotalOwnerAntes) + valor);
    const p = r.pernas[0];
    exigir(p.papel === "aporte" && p.tipo === "entrada" && p.contaCaixaId === q.contaDestinoId && p.valor === q.valor);
  } else {
    exigir(r.pernas.length === 2 && r.saldoOrigemAntes !== null && r.saldoOrigemApos !== null &&
      monetaryBigInt(r.saldoOrigemApos!) === monetaryBigInt(r.saldoOrigemAntes!) - valor && r.saldoTotalOwnerApos === r.saldoTotalOwnerAntes);
    const [origem, destino] = r.pernas;
    exigir(origem.papel === "origem" && origem.tipo === "saida" && origem.contaCaixaId === q.contaOrigemId && origem.valor === q.valor &&
      destino.papel === "destino" && destino.tipo === "entrada" && destino.contaCaixaId === q.contaDestinoId && destino.valor === q.valor &&
      origem.transacaoCaixaId !== destino.transacaoCaixaId);
  }
  return freeze(r);
}
export const recovery37ResultSchema = seguro(z.object({
  userId: id, idempotencyKey: uuidCanonical, request, requestHash: hash, proof: z.literal("uuid_fenced37_v1"),
  status: z.enum(["confirmed", "not_executed"]), operationId: uuidCanonical.nullable(), result: resultado.nullable(),
}).strict());
export type Recovery37Result = z.infer<typeof recovery37ResultSchema>;
function mesmoRequest(a: Request37, b: Request37): boolean {
  return a.acao === b.acao && a.contaOrigemId === b.contaOrigemId && a.contaDestinoId === b.contaDestinoId && a.valor === b.valor &&
    a.descricao === b.descricao && a.dataTransacao === b.dataTransacao && a.estadoHash === b.estadoHash;
}
/** Prova exclusivamente do endpoint37. Hash SQL obrigatório e opaco: não é JSON.stringify.
 * O owner é ecoado pelo SQL, nunca enxertado pelo adapter sobre uma resposta incompleta.
 */
export function normalizarRecovery37(value: unknown, userId: number, intent: Recovery37Input): Recovery37Result {
  parse(id, userId);
  const i = congelarRecovery37(intent), r = parse(recovery37ResultSchema, value);
  exigir(r.userId === userId && r.idempotencyKey === i.idempotencyKey && mesmoRequest(r.request, i.request));
  if (r.status === "not_executed") {
    exigir(r.operationId === null && r.result === null);
    return freeze(r);
  }
  exigir(r.operationId !== null && r.result !== null);
  const result = normalizarResultado37(r.result, i);
  exigir(result.operationId === r.operationId && result.repetida === false);
  return freeze({ ...r, result });
}
// Nomes portugueses também disponíveis para integradores que seguem os módulos predecessores.
export const recuperacao37Schema = recovery37Schema;
export const normalizarRecuperacao37 = normalizarRecovery37;
