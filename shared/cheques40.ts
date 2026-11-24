import { z } from "zod";
const id = z.number().int().min(1).max(999_999_999);
const dinheiro = z.string().regex(/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/).refine(v => v !== "0.00");
const decimalResultado = z.string().regex(/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/);
const data = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
});
const texto = (max: number) => z.string().min(1).max(max).refine(v => v.trim() === v);
const criar = z.object({
  acao: z.literal("criar"), dataOperacao: data, clienteId: id, contaCaixaId: id,
  emitente: texto(255), numeroCheque: texto(50), banco: texto(100).nullable(),
  agencia: texto(20).nullable(), conta: texto(30).nullable(), cpfCnpjEmitente: texto(20).nullable(),
  valorNominal: dinheiro, dataVencimento: data,
  taxaDesconto: z.string().regex(/^(0|[1-9][0-9]{0,2})\.[0-9]{2}$/).refine(v => v !== "0.00"),
  tipoTaxa: z.enum(["diaria", "mensal", "anual"]), observacoes: texto(2000).nullable(),
}).strict();
export const cheque40RequestSchema = z.discriminatedUnion("acao", [
  criar,
  z.object({ acao: z.literal("compensar"), id, dataOperacao: data }).strict(),
  z.object({ acao: z.literal("cancelar"), id, dataOperacao: data }).strict(),
  z.object({ acao: z.literal("devolver"), id, dataOperacao: data, motivo: texto(255) }).strict(),
]);
export const cheque40IntentSchema = z.object({
  idempotencyKey: z.string().uuid(), request: cheque40RequestSchema,
}).strict();
export const cheque40ResultSchema = z.object({
  success: z.literal(true), regra: z.literal("cheques40_v1"), id,
  operationId: z.string().uuid(), idempotencyKey: z.string().uuid(), repetida: z.boolean(),
  valorLiquido: decimalResultado, valorDesconto: decimalResultado,
  status: z.enum(["descontado", "compensado", "devolvido", "cancelado"]),
  estornadoNoCaixa: z.boolean(), requerConferenciaCaixa: z.literal(false),
}).strict();
export type Cheque40Intent = z.infer<typeof cheque40IntentSchema>;
export type Cheque40Request = z.infer<typeof cheque40RequestSchema>;
export type Cheque40Result = z.infer<typeof cheque40ResultSchema>;
/** Conversão lexical; nunca multiplica/arredonda números IEEE754. */
export function decimalCheque40(text: string, scale = 2): string {
  const normalized = text.trim().replace(",", ".");
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(normalized);
  if (!match || (match[2]?.length ?? 0) > scale) throw new Error("Use um valor decimal sem separador de milhares e sem casas excedentes.");
  return match[1] + "." + (match[2] ?? "").padEnd(scale, "0");
}
export function diaCheque40(now: Date = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map(p => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Ausência confirmada persiste a proibição de execução futura do mesmo UUID. */
const fenceBase40 = z.object({ success: z.literal(true), regra: z.literal("cheques40_fence_v1"), idempotencyKey: z.string().uuid(), request: cheque40RequestSchema });
export const cheque40FenceSchema = z.discriminatedUnion("estado", [
  fenceBase40.extend({ estado: z.literal("nao_executada"), resultado: z.null() }).strict(),
  fenceBase40.extend({ estado: z.literal("executada"), resultado: cheque40ResultSchema }).strict(),
]);
export type Cheque40Fence = z.infer<typeof cheque40FenceSchema>;
export function validarFenceCheque40(raw: unknown, intent: Cheque40Intent): Cheque40Fence {
  const proof = cheque40FenceSchema.parse(raw), expected = cheque40IntentSchema.parse(intent);
  if (proof.idempotencyKey !== expected.idempotencyKey || JSON.stringify(proof.request) !== JSON.stringify(expected.request)) throw new Error("Fence não corresponde à intenção preservada.");
  if (proof.estado === "executada") {
    const r = proof.resultado, status = { criar: "descontado", compensar: "compensado", devolver: "devolvido", cancelar: "cancelado" } as const;
    if (r.idempotencyKey !== expected.idempotencyKey || !r.repetida || r.status !== status[expected.request.acao]
      || (expected.request.acao !== "criar" && r.id !== expected.request.id)
      || r.estornadoNoCaixa !== ["devolver", "cancelar"].includes(expected.request.acao)) throw new Error("Execução no fence contraditória.");
  }
  return proof;
}
