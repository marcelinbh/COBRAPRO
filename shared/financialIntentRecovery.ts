import { z } from 'zod';
export const recoveryFamilies = ['emprestimo_criar', 'emprestimo_receber', 'despesa_criar', 'despesa_pagar', 'despesa_estornar'] as const;
export type RecoveryFamily = typeof recoveryFamilies[number];
export const financialIntentRecoveryInput = z.object({
  family: z.enum(recoveryFamilies), idempotencyKey: z.string().uuid(), payload: z.record(z.string(), z.unknown()),
}).strict();
export type RecoveryRequest = z.infer<typeof financialIntentRecoveryInput>;
export type RecoveryEvidence = RecoveryRequest & { userId: number; payloadHash: string; proof: 'uuid_fenced_v1';
  status: 'not_executed' | 'confirmed'; fenceId: string | null; result: unknown; quote: unknown };
export function canonicalIntent(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalIntent).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalIntent((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Evidence is accepted only from the reconciliation endpoint, never from an exception/status code. */
export function assertRecoveryEvidence(value: unknown, userId: number, request: RecoveryRequest): RecoveryEvidence {
  const r = value as RecoveryEvidence | null;
  if (!r || r.userId !== userId || r.family !== request.family || r.idempotencyKey?.toLowerCase() !== request.idempotencyKey.toLowerCase() ||
      canonicalIntent(r.payload) !== canonicalIntent(request.payload) || !/^[a-f0-9]{64}$/.test(r.payloadHash ?? '') ||
      r.proof !== 'uuid_fenced_v1' || !['confirmed', 'not_executed'].includes(r.status) ||
      (r.status === 'not_executed' && (!z.string().uuid().safeParse(r.fenceId).success || r.result !== null)) ||
      (r.status === 'confirmed' && (!r.result || r.fenceId !== null))) {
    throw new Error('Reconciliação não comprovada para este UUID/payload; intenção preservada.');
  }
  return r;
}
export function canCloseRejectedIntent(evidence: RecoveryEvidence | undefined, userId: number, request: RecoveryRequest): boolean {
  try { return !!evidence && assertRecoveryEvidence(evidence, userId, request).status === 'not_executed'; } catch { return false; }
}
export function recoveryRequest(family: RecoveryFamily, payload: Record<string, unknown> & { idempotencyKey: string }): RecoveryRequest {
  const { idempotencyKey, ...body } = payload;
  return { family, idempotencyKey, payload: body };
}
