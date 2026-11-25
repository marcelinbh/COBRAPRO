import { z } from 'zod';
import { dataCivilDespesa, dinheiroDespesa } from './despesasIntent';
const id = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid().regex(/^[a-f0-9-]+$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const edicao49Request = z.object({
  despesaId: id, origemOperationId: uuid, estadoHash: hash,
  descricao: z.string().min(1).max(255).refine(v => v === v.trim()),
  categoria: z.enum(['aluguel', 'energia', 'agua', 'internet', 'telefone', 'salario', 'imposto', 'fornecedor', 'outros']),
  dataVencimento: z.string().refine(dataCivilDespesa), observacoes: z.string().max(10000),
  motivo: z.string().min(1).max(2000).refine(v => v === v.trim()),
}).strict();
export const edicao49Input = z.object({ idempotencyKey: uuid, request: edicao49Request }).strict();
export type Edicao49Request = z.infer<typeof edicao49Request>;
export type Edicao49Input = z.infer<typeof edicao49Input>;
const exact = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  const keys = Object.keys(x); return keys.length === Object.keys(y).length && keys.every(k => Object.hasOwn(y, k) && exact(x[k], y[k]));
};
export const capabilities49 = z.object({ contrato: z.literal('despesas49_v1'), habilitado: z.boolean(), edicaoPendente20: z.literal(true), valorInalterado: z.literal(true), recorrencia: z.literal(false), legado: z.literal(false), posBaixa: z.literal(false) }).strict();
const quote49 = z.object({ contrato: z.literal('despesas49_v1'), userId: id, despesaId: id, origemOperationId: uuid, original: z.record(z.string(), z.unknown()), estadoHash: hash, valor: z.string().refine(v => dinheiroDespesa(v) === v), habilitado: z.boolean(), semMovimentoCaixa: z.literal(true), modo: z.literal('sucessao20') }).strict();
export function validarQuote49(raw: unknown, owner: number, despesaId: number) {
  const q = quote49.parse(raw);
  if (q.userId !== owner || q.despesaId !== despesaId || q.original.id !== despesaId || q.original.user_id !== owner || q.original.status !== 'pendente' || q.original.data_pagamento !== null || q.original.conta_caixa_id !== null || q.original.recorrente !== false || q.original.frequencia !== null) throw new Error('Cotação49 owner/estado divergente.');
  return q;
}
const receipt49 = z.object({ contrato: z.literal('despesas49_v1'), success: z.literal(true), acao: z.literal('editarPendente'), userId: id, idempotencyKey: uuid, request: edicao49Request, operationId: uuid, despesaId: id, sucessoraId: id, sucessoraOperationId: uuid, valor: z.string().refine(v => dinheiroDespesa(v) === v), statusOriginal: z.literal('cancelado'), statusSucessora: z.literal('pendente'), semMovimentoCaixa: z.literal(true), instante: z.string().refine(v => Number.isFinite(Date.parse(v))) }).strict();
export function validarRecibo49(raw: unknown, owner: number, input: Edicao49Input) {
  const r = receipt49.parse(raw);
  if (r.userId !== owner || r.idempotencyKey !== input.idempotencyKey || r.despesaId !== input.request.despesaId || r.sucessoraId === r.despesaId || !exact(r.request, input.request)) throw new Error('Recibo49 não comprova intenção exata.');
  return r;
}
const recovery49 = z.object({ contrato: z.literal('despesas49_v1'), userId: id, idempotencyKey: uuid, request: edicao49Request, status: z.enum(['confirmed', 'not_executed']), result: z.unknown(), fence: z.object({ fenceId: uuid, instante: z.string().refine(v => Number.isFinite(Date.parse(v))) }).strict().nullable() }).strict();
export function validarRecovery49(raw: unknown, owner: number, input: Edicao49Input) {
  const r = recovery49.parse(raw);
  if (r.userId !== owner || r.idempotencyKey !== input.idempotencyKey || !exact(r.request, input.request)) throw new Error('Recovery49 não comprova owner/UUID/pedido exato.');
  if (r.status === 'confirmed') {
    if (r.fence !== null) throw new Error('Recovery49 contraditório.');
    validarRecibo49(r.result, owner, input);
  } else if (!r.fence || r.result !== null) throw new Error('Não execução exige fence terminal.');
  return r;
}
export type Recovery49 = ReturnType<typeof validarRecovery49>;
