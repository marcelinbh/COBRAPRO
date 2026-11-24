import { z } from "zod";

export const schemaCaixa45 = "public" as const;
export const idCaixa45 = z.number().int().positive().max(2147483647);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const texto = (max: number) => z.string().min(1).max(max).refine(v => v === v.trim() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v));
/** Correção SOMENTE de observação: nunca substitui descrição nem origem financeira. */
export const requestCaixa45 = z.object({
  transacaoId: idCaixa45,
  estadoHash: hash,
  observacao: texto(500),
  motivo: texto(500),
}).strict();
export const intencaoCaixa45 = z.object({
  idempotencyKey: z.string().uuid(),
  request: requestCaixa45,
}).strict();
export type IntencaoCaixa45 = z.infer<typeof intencaoCaixa45>;
export const consultarCaixa45 = z.object({ transacaoId: idCaixa45 }).strict();
export const resultadoCaixa45 = z.object({
  regra: z.literal("correcao_observacao45_v1"),
  empresaId: idCaixa45,
  idempotencyKey: z.string().uuid(),
  transacaoId: idCaixa45,
  request: requestCaixa45,
  operacaoId: z.string().uuid(),
  originalHash: hash,
  instante: z.string().datetime({ offset: true }),
}).strict();
export const consultaCaixa45 = z.object({
  regra: z.literal("correcao_observacao45_v1"),
  empresaId: idCaixa45,
  transacaoId: idCaixa45,
  estadoHash: hash,
  originalHash: hash,
  observacaoAtual: z.string().nullable(),
  ultimaCorrecao: resultadoCaixa45.nullable(),
  correcoes: z.number().int().nonnegative(),
}).strict();
export const recoveryCaixa45 = z.discriminatedUnion("status", [
  z.object({ status: z.literal("confirmed"), result: resultadoCaixa45 }).strict(),
  z.object({ status: z.literal("not_executed"), empresaId: idCaixa45, idempotencyKey: z.string().uuid(), request: requestCaixa45 }).strict(),
]);

/** A intenção persistida deve sobreviver a timeout/reload e nunca receber outro UUID. */
export function storageKeyCaixa45(userId: number) { return `cobrapro:caixa45:pendente:${idCaixa45.parse(userId)}`; }
export function conferirResultadoCaixa45(value: unknown, userId: number, input: IntencaoCaixa45) {
  const result = resultadoCaixa45.parse(value);
  if (result.empresaId !== userId || result.idempotencyKey !== input.idempotencyKey ||
    result.transacaoId !== input.request.transacaoId || JSON.stringify(result.request) !== JSON.stringify(requestCaixa45.parse(input.request))) {
    throw new Error("Resultado não corresponde à mesma empresa/intenção45.");
  }
  return result;
}

export function conferirRecoveryCaixa45(value: unknown, userId: number, input: IntencaoCaixa45) {
  const i = intencaoCaixa45.parse(input), r = recoveryCaixa45.parse(value);
  if (r.status === "confirmed") conferirResultadoCaixa45(r.result, userId, i);
  else if (r.empresaId !== userId || r.idempotencyKey !== i.idempotencyKey || JSON.stringify(r.request) !== JSON.stringify(i.request)) {
    throw new Error("Recovery45 não corresponde à mesma empresa/intenção.");
  }
  return r;
}
