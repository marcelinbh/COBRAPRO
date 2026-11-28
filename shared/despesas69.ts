import { z } from 'zod';
import { dinheiroDespesa } from './despesasIntent';
import { edicao49Request, validarQuote49 } from './despesas49';
const id = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid().regex(/^[a-f0-9-]+$/);
const money = z.string().refine(v => dinheiroDespesa(v) === v, 'Informe valor positivo em centavos exatos (ex.: 125.50).');
export const edicao69Request = edicao49Request.extend({ valor: money }).strict();
export const edicao69Input = z.object({ idempotencyKey: uuid, request: edicao69Request }).strict();
export type Edicao69Request = z.infer<typeof edicao69Request>;
export type Edicao69Input = z.infer<typeof edicao69Input>;
export const capabilities69 = z.object({ contrato: z.literal('despesas69_v1'), habilitado: z.boolean(), edicaoPendente20: z.literal(true), valorEditavel: z.literal(true), somenteEstaOcorrencia: z.literal(true), recovery: z.literal(true), legado: z.literal(false), posBaixa: z.literal(false) }).strict();
const exact = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && exact(x[k], y[k]));
};
/** Quote49 é contrato interno de proveniência; não alteramos o contrato/flag49. */
export function validarQuote69(raw: unknown, owner: number, despesaId: number) {
  const envelope = z.object({ contrato: z.literal('despesas69_v1'), quote49: z.unknown(), habilitado: z.boolean(), somenteEstaOcorrencia: z.literal(true) }).strict().parse(raw);
  const q = validarQuote49(envelope.quote49, owner, despesaId);
  if (dinheiroDespesa(String(q.original.valor)) !== q.valor) throw new Error('Cotação69 valor/snapshot divergente.');
  return { ...envelope, quote49: q };
}
export type Quote69 = ReturnType<typeof validarQuote69>;
/** Delta inclui valor; motivo isolado nunca gera UUID. Form deve ser validado antes. */
export function temDelta69(r: Edicao69Request, q: Quote69): boolean {
  const o = q.quote49.original;
  return r.valor !== q.quote49.valor || r.descricao !== o.descricao || r.categoria !== o.categoria || r.dataVencimento !== o.data_vencimento || r.observacoes !== (o.observacoes ?? '');
}
const receipt = z.object({ contrato: z.literal('despesas69_v1'), success: z.literal(true), acao: z.literal('editarPendenteComValor'), userId: id, idempotencyKey: uuid, request: edicao69Request, operationId: uuid, despesaId: id, raizId: id, sucessoraId: id, sucessoraOperationId: uuid, valorAnterior: money, valorNovo: money, statusOriginal: z.literal('cancelado'), statusSucessora: z.literal('pendente'), semMovimentoCaixa: z.literal(true), somenteEstaOcorrencia: z.literal(true), instante: z.string().refine(v => Number.isFinite(Date.parse(v))) }).strict();
export function validarRecibo69(raw: unknown, owner: number, input: Edicao69Input) {
  const r = receipt.parse(raw);
  if (r.userId !== owner || r.idempotencyKey !== input.idempotencyKey || r.despesaId !== input.request.despesaId || r.sucessoraId === r.despesaId || r.valorNovo !== input.request.valor || !exact(r.request, input.request)) throw new Error('Recibo69 não comprova owner/UUID/pedido/valor exatos.');
  return r;
}
const recovery = z.object({ contrato: z.literal('despesas69_v1'), userId: id, idempotencyKey: uuid, request: edicao69Request, status: z.enum(['confirmed', 'not_executed']), result: z.unknown(), fence: z.object({ fenceId: uuid, instante: z.string().refine(v => Number.isFinite(Date.parse(v))) }).strict().nullable() }).strict();
export function validarRecovery69(raw: unknown, owner: number, input: Edicao69Input) {
  const r = recovery.parse(raw);
  if (r.userId !== owner || r.idempotencyKey !== input.idempotencyKey || !exact(r.request, input.request)) throw new Error('Recovery69 não comprova owner/UUID/pedido exatos.');
  if (r.status === 'confirmed') {
    if (r.fence !== null) throw new Error('Recovery69 contraditório.');
    validarRecibo69(r.result, owner, input);
  } else if (!r.fence || r.result !== null) throw new Error('Não execução69 exige fence terminal.');
  return r;
}
export type Recovery69 = ReturnType<typeof validarRecovery69>;
