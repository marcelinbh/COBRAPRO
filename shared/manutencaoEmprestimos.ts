import { z } from "zod";
const id = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid();
export const dataCivil44 = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(`${s}T12:00:00Z`);
  return s >= "1900-01-01" && s <= "9999-12-31" && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
export const cotarCalendarioSchema = z.object({ contratoId: id }).strict();
export const calendario44Schema = z.object({
  contratoId: id, idempotencyKey: uuid, estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
  vencimentos: z.array(dataCivil44).min(1).max(60), motivo: z.string().trim().min(3).max(500),
}).strict().superRefine((v, ctx) => {
  const first = v.vencimentos[0];
  if (!first || !dataCivil44.safeParse(first).success) return;
  const day = Number(first.slice(8)), month = Number(first.slice(5, 7)), year = Number(first.slice(0, 4));
  if (v.vencimentos.length > 1 && day > 28) ctx.addIssue({ code: "custom", message: "Mais de uma parcela exige dia 1..28." });
  v.vencimentos.forEach((date, i) => {
    const expected = new Date(Date.UTC(year, month - 1 + i, day, 12)).toISOString().slice(0, 10);
    if (date !== expected) ctx.addIssue({ code: "custom", path: ["vencimentos", i], message: "Agenda mensal consecutiva obrigatória." });
  });
});
export type Calendario44 = z.infer<typeof calendario44Schema>;
export const resultSchema44 = z.object({ success: z.literal(true), repetida: z.boolean(), operationId: uuid,
  idempotencyKey: uuid, contratoId: id, vencimentos: z.array(dataCivil44).min(1).max(60),
  regra: z.literal("calendario_mensal_sem_baixa_v1"),
}).strict();
export const quoteSchema44 = z.object({ contratoId: id, estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
  parcelasIds: z.array(id).min(1).max(60), vencimentos: z.array(dataCivil44).min(1).max(60),
  regra: z.literal("calendario_mensal_sem_baixa_v1"),
}).strict();
export const fenceSchema44 = z.object({ status: z.literal("fenced"), regra: z.literal("calendario44_fence_v1"),
  contratoId: id, idempotencyKey: uuid, estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
  vencimentos: z.array(dataCivil44).min(1).max(60), motivo: z.string().min(3).max(500),
}).strict();
export const closureSchema44 = z.discriminatedUnion("status", [
  z.object({ status: z.literal("confirmed"), sameIntentOnly: z.literal(true), resultado: resultSchema44 }).strict(),
  fenceSchema44,
]);
/** not_found/erro/timeout NUNCA são closure. Fence precisa ecoar TODA a intenção. */
export function validarClosure44(value: unknown, intent: Calendario44) {
  const r = closureSchema44.parse(value);
  const proof = r.status === "confirmed" ? r.resultado : r;
  if (proof.idempotencyKey !== intent.idempotencyKey || proof.contratoId !== intent.contratoId || JSON.stringify(proof.vencimentos) !== JSON.stringify(intent.vencimentos)) throw Error("Confirmação44 divergente");
  if (r.status === "fenced" && (r.estadoHash !== intent.estadoHash || r.motivo !== intent.motivo)) throw Error("Fence44 de outro payload");
  return r;
}
export type Closure44 = z.infer<typeof closureSchema44>;
