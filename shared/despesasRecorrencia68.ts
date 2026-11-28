import { z } from 'zod';
import { categoriaDespesa, dataCivilDespesa, dinheiroDespesa } from './despesasIntent';
export const owner68 = z.number().int().positive().max(2147483647);
export const uuid68 = z.string().uuid().regex(/^[a-f0-9-]+$/);
const ordinal = z.number().int().min(0).max(4000000);
const civil = z.string().refine(dataCivilDespesa, 'Data civil inválida.');
export const frequencia68 = z.enum(['mensal', 'semanal', 'quinzenal', 'anual']);
export const template68 = z.object({ descricao: z.string().min(1).max(255).refine(v => v === v.trim()), categoria: categoriaDespesa, valor: z.string().refine(v => dinheiroDespesa(v) === v, 'Use valor positivo exato, com dois centavos.'), observacoes: z.string().max(10000) }).strict();
const revision = z.number().int().positive().max(2147483646);
const target = { serieId: uuid68, expectedRevision: revision };
export const request68 = z.discriminatedUnion('action', [
  z.object({ action: z.literal('criar'), template: template68, frequencia: frequencia68, ancora: civil, termino: civil.nullable() }).strict(),
  z.object({ action: z.literal('alterar'), ...target, effectiveOrdinal: ordinal, template: template68 }).strict(),
  z.object({ action: z.literal('pausar'), ...target }).strict(),
  z.object({ action: z.literal('retomar'), ...target }).strict(),
  z.object({ action: z.literal('encerrar'), ...target }).strict(),
]).superRefine((v, ctx) => { if (v.action === 'criar' && v.termino !== null && v.termino < v.ancora) ctx.addIssue({ code: 'custom', message: 'Término anterior à âncora.', path: ['termino'] }); });
export const input68 = z.object({ idempotencyKey: uuid68, request: request68 }).strict();
export type Request68 = z.infer<typeof request68>;
export type Input68 = z.infer<typeof input68>;
export function exact68(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  const keys = Object.keys(x); return keys.length === Object.keys(y).length && keys.every(k => Object.hasOwn(y, k) && exact68(x[k], y[k]));
}
const timestamp = z.string().refine(v => Number.isFinite(Date.parse(v)));
export const proof68 = z.object({ contrato: z.literal('despesas68_v1'), userId: owner68, idempotencyKey: uuid68, request: request68, status: z.enum(['confirmed', 'not_executed']), serieId: uuid68.nullable(), revision: z.number().int().positive().max(2147483647).nullable(), effectiveOrdinal: ordinal.nullable(), fenceId: uuid68, instante: timestamp }).strict();
export type Proof68 = z.infer<typeof proof68>;
export function validarProof68(raw: unknown, owner: number, input: Input68): Proof68 {
  const p = proof68.parse(raw);
  if (p.userId !== owner || p.idempotencyKey !== input.idempotencyKey || !exact68(p.request, input.request)) throw Error('Prova68 não corresponde ao owner/UUID/pedido exato.');
  if (p.status === 'confirmed') {
    if (p.serieId === null || p.revision === null || p.effectiveOrdinal === null || (input.request.action !== 'criar' && (p.serieId !== input.request.serieId || p.revision !== input.request.expectedRevision + 1)) || (input.request.action === 'criar' && p.revision !== 1)) throw Error('Confirmação68 incompleta.');
    if (input.request.action === 'alterar' && p.effectiveOrdinal !== input.request.effectiveOrdinal) throw Error('Vigência68 divergente.');
  } else if (p.serieId !== null || p.revision !== null || p.effectiveOrdinal !== null) throw Error('Fence68 contraditório.');
  return p;
}
export const serie68 = z.object({ serieId: uuid68, userId: owner68, revision: z.number().int().positive().max(2147483647), estado: z.enum(['ativa', 'pausada', 'encerrada']), frequencia: frequencia68, ancora: civil, termino: civil.nullable(), template: template68, nextOrdinal: ordinal, nextDate: civil.nullable(), futureOrdinal: ordinal, backlog: z.boolean(), failure: z.boolean(), skipped: z.array(z.object({ from: ordinal, toExclusive: ordinal, instante: timestamp }).strict()) }).strict();
export type Serie68 = z.infer<typeof serie68>;
export const agendaStatus68 = z.object({ vinculada: z.boolean(), ativa: z.boolean(), path: z.literal('/api/scheduled/despesas-recorrentes'), method: z.literal('POST'), ultimaExecucao: timestamp.nullable(), resultado: z.enum(['aguardando', 'concluido', 'parcial']), geradas: z.number().int().nonnegative().nullable(), falhas: z.number().int().nonnegative().nullable() }).strict();
export const list68 = z.object({ contrato: z.literal('despesas68_v1'), userId: owner68, hoje: civil, agenda: agendaStatus68, series: z.array(serie68), ocorrencias: z.array(z.object({ serieId: uuid68, ordinal, competencia: civil, rootId: owner68, currentId: owner68.nullable(), status: z.enum(['pendente', 'pago', 'cancelado', 'UNKNOWN']) }).strict()), hasMore: z.boolean() }).strict();
export function validarList68(raw: unknown, owner: number) {
  const r = list68.parse(raw);
  if (r.userId !== owner || r.series.some(s => s.userId !== owner)) throw Error('Lista68 de outro owner.');
  return r;
}
export const batch68 = z.object({ contrato: z.literal('despesas68_batch_v1'), runId: uuid68, geradas: z.number().int().min(0).max(8), falhas: z.number().int().min(0).max(1), backlog: z.boolean(), selecionada: z.boolean() }).strict();
export const callbackBody68 = z.object({}).strict();
/** Cada ordinal parte da âncora original; nunca da data truncada anterior. */
export function dataOcorrencia68(ancora: string, frequencia: z.infer<typeof frequencia68>, n: number): string {
  civil.parse(ancora); frequencia68.parse(frequencia); ordinal.parse(n);
  const [y, m, d] = ancora.split('-').map(Number);
  if (frequencia === 'semanal' || frequencia === 'quinzenal') {
    const date = new Date(`${ancora}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + n * (frequencia === 'semanal' ? 7 : 15));
    const s = date.toISOString().slice(0, 10); civil.parse(s); return s;
  }
  const months = (y - 1) * 12 + m - 1 + n * (frequencia === 'mensal' ? 1 : 12);
  const year = Math.floor(months / 12) + 1, month = months % 12 + 1;
  if (year > 9999) throw Error('Calendário68 fora da faixa civil.');
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const last = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
