import { z } from 'zod';
import { dinheiroDespesa } from './despesasIntent';
export const CONTRATO_CANCELAMENTO_PENDENTE = 'despesa_cancelamento_pendente_v1' as const;
const id = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid().regex(/^[0-9a-f-]+$/, 'UUID deve ser lowercase, sem normalização de intenção.');
const motivo = z.string().min(1).max(2000).refine(v => v === v.trim(), 'Motivo deve vir sem espaços externos.');
export const cancelamentoPendentePayload = z.object({ despesaId: id, origemOperationId: uuid, motivo }).strict();
export const cancelamentoPendenteInput = cancelamentoPendentePayload.extend({ idempotencyKey: uuid }).strict();
export type CancelamentoPendenteInput = z.infer<typeof cancelamentoPendenteInput>;
const instante = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?\+00:00$/).refine(v => Number.isFinite(Date.parse(v)));
export const resultadoCancelamentoPendente = z.object({
  contrato: z.literal(CONTRATO_CANCELAMENTO_PENDENTE), success: z.literal(true), acao: z.literal('cancelarPendente'),
  userId: id, idempotencyKey: uuid, operationId: uuid, despesaId: id, origemOperationId: uuid,
  motivo, status: z.literal('cancelado'), valor: z.string().refine(v => dinheiroDespesa(v) === v),
  instante, semMovimentoCaixa: z.literal(true),
}).strict();
export type ResultadoCancelamentoPendente = z.infer<typeof resultadoCancelamentoPendente>;
export function validarCancelamentoPendente(value: unknown, userId: number, input: CancelamentoPendenteInput): ResultadoCancelamentoPendente {
  const r = resultadoCancelamentoPendente.parse(value);
  if (r.userId !== userId || r.idempotencyKey !== input.idempotencyKey || r.despesaId !== input.despesaId || r.origemOperationId !== input.origemOperationId || r.motivo !== input.motivo) throw new Error('Confirmação diverge da intenção original; preserve a MESMA UUID.');
  return r;
}
const recoverySchema = z.object({
  contrato: z.literal(CONTRATO_CANCELAMENTO_PENDENTE), userId: id, idempotencyKey: uuid,
  request: cancelamentoPendentePayload, status: z.enum(['unknown', 'confirmed', 'not_executed']), result: resultadoCancelamentoPendente.nullable(),
  fence: z.object({ fenceId: uuid, instante }).strict().nullable(),
}).strict();
export type RecoveryCancelamentoPendente = z.infer<typeof recoverySchema>;
export function validarRecoveryCancelamento(value: unknown, userId: number, input: CancelamentoPendenteInput): RecoveryCancelamentoPendente {
  const r = recoverySchema.parse(value);
  if (r.userId !== userId || r.idempotencyKey !== input.idempotencyKey || r.request.despesaId !== input.despesaId || r.request.origemOperationId !== input.origemOperationId || r.request.motivo !== input.motivo || (r.status === 'confirmed') !== (r.result !== null) || (r.status === 'not_executed') !== (r.fence !== null)) throw new Error('Recovery incompatível; ausência não prova não execução.');
  if (r.status === 'confirmed') validarCancelamentoPendente(r.result, userId, input);
  return r;
}
export const capacidadesCancelamentoPendente = z.object({ contrato: z.literal(CONTRATO_CANCELAMENTO_PENDENTE), habilitado: z.boolean(), somentePendente20: z.literal(true), edicao: z.literal(false), exclusao: z.literal(false), recorrencia: z.literal(false) }).strict();
const envelope = z.object({ contrato: z.literal(CONTRATO_CANCELAMENTO_PENDENTE), userId: id, input: cancelamentoPendenteInput }).strict();
export type IntencaoCancelamentoPendente = z.infer<typeof envelope>;
const receiptSchema = z.object({ contrato: z.literal(CONTRATO_CANCELAMENTO_PENDENTE), userId: id, encerrada: envelope, prova: recoverySchema }).strict();
export type StorageCancelamento = Pick<Storage, 'getItem' | 'setItem'>;
const copy = <T,>(v: T): T => structuredClone(v);
const same = (a: CancelamentoPendenteInput, b: CancelamentoPendenteInput) => a.idempotencyKey === b.idempotencyKey && a.despesaId === b.despesaId && a.origemOperationId === b.origemOperationId && a.motivo === b.motivo;
type LocalState = { known: IntencaoCancelamentoPendente | null; raw: string | null | undefined; latched: boolean; lock: symbol | null };
const states = new WeakMap<object, Map<number, LocalState>>();
function ownerState(storage: StorageCancelamento | null, owner: number): LocalState {
  if (!storage) return { known: null, raw: undefined, latched: true, lock: null };
  let byOwner = states.get(storage); if (!byOwner) { byOwner = new Map(); states.set(storage, byOwner); }
  let state = byOwner.get(owner); if (!state) { state = { known: null, raw: undefined, latched: false, lock: null }; byOwner.set(owner, state); }
  return state;
}
/** sessionStorage síncrono: CAS byte-exato e lock compartilhado por owner/storage.
 * Fechamento exige prova terminal sob o MESMO handle; recibo por UUID é retido.
 * Nenhum removeItem, reset local, closure de unknown ou adoção de originais38.
 */
export class CancelamentoPendenteStore {
  private readonly state: LocalState;
  private get known() { return this.state.known; }
  private set known(value: IntencaoCancelamentoPendente | null) { this.state.known = value; }
  private get latched() { return this.state.latched; }
  private set latched(value: boolean) { this.state.latched = value; }
  private get lock() { return this.state.lock; }
  private set lock(value: symbol | null) { this.state.lock = value; }
  constructor(readonly userId: number, private readonly storage: StorageCancelamento | null) { id.parse(userId); this.state = ownerState(storage, userId); }
  get key(): string { return `cobrapro:despesa-cancelamento-pendente:v1:user:${this.userId}:original`; }
  get blocked(): boolean { return this.latched; }
  read(): IntencaoCancelamentoPendente | null {
    try {
      if (!this.storage) throw new Error('Armazenamento indisponível');
      const raw = this.storage.getItem(this.key);
      if (this.state.raw !== undefined && raw !== this.state.raw) throw new Error('CAS head divergente');
      if (raw === null) {
        if (this.known) throw new Error('Intenção conhecida desapareceu');
        this.state.raw = null; return null;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'encerrada' in parsed) {
        const receipt = receiptSchema.parse(parsed);
        if (receipt.userId !== this.userId || receipt.encerrada.userId !== this.userId || JSON.stringify(receipt) !== raw) throw new Error('Recibo divergente');
        const proof = validarRecoveryCancelamento(receipt.prova, this.userId, receipt.encerrada.input);
        if (proof.status === 'unknown' || this.storage.getItem(this.receiptKey(receipt.encerrada)) !== raw) throw new Error('Recibo terminal ausente');
        this.state.raw = raw; this.known = null; return null;
      }
      const value = envelope.parse(parsed);
      if (value.userId !== this.userId || JSON.stringify(value) !== raw || (this.known && !same(this.known.input, value.input))) throw new Error('Original divergente');
      this.state.raw = raw; this.known = value; return copy(value);
    } catch {
      this.latched = true;
      if (this.known) return copy(this.known);
      throw new Error('Cancelamento inconclusivo no armazenamento; não crie UUID substituta.');
    }
  }
  begin(payload: z.infer<typeof cancelamentoPendentePayload>, newUuid: () => string = () => crypto.randomUUID()): IntencaoCancelamentoPendente {
    if (this.read() || this.latched || this.lock) throw new Error('Intenção anterior deve ser conferida com a MESMA chave.');
    const original = envelope.parse({ contrato: CONTRATO_CANCELAMENTO_PENDENTE, userId: this.userId, input: { ...cancelamentoPendentePayload.parse(payload), idempotencyKey: newUuid() } });
    const raw = JSON.stringify(original); this.known = original;
    try {
      if (!this.storage) throw new Error('Armazenamento indisponível');
      if (this.storage.getItem(this.key) !== this.state.raw || this.storage.getItem(this.receiptKey(original)) !== null) throw new Error('CAS/UUID já encerrada');
      this.storage.setItem(this.key, raw);
      if (this.storage.getItem(this.key) !== raw) throw new Error('Persistência não confirmada');
      this.state.raw = raw; return copy(original);
    } catch { this.latched = true; throw new Error('Original não persistiu exatamente; envio bloqueado e UUID preservada, sem substituição.'); }
  }
  acquire(): symbol | null {
    if (this.lock || this.latched) return null;
    const original = this.read(); if (!original || this.latched) return null;
    const token = Symbol('cancelamento'); this.lock = token; return token;
  }
  release(token: symbol): void { if (this.lock === token) this.lock = null; }
  /** Valida confirmação, mas não fecha sem recovery terminal e CAS. */
  confirmed(result: unknown): ResultadoCancelamentoPendente {
    const original = this.read(); if (!original) throw new Error('Original ausente');
    return validarCancelamentoPendente(result, this.userId, original.input);
  }
  private receiptKey(original: IntencaoCancelamentoPendente) { return `${this.key}:encerrada:${original.input.idempotencyKey}`; }
  close(token: symbol, expected: IntencaoCancelamentoPendente, evidence: unknown): void {
    if (this.blocked || this.lock !== token) throw new Error('Fechamento sem lock original');
    const original = this.read();
    if (!original || this.blocked || JSON.stringify(original) !== JSON.stringify(envelope.parse(expected))) throw new Error('CAS: intenção mudou');
    const proof = validarRecoveryCancelamento(evidence, this.userId, original.input);
    if (proof.status === 'unknown') throw new Error('Ausência não autoriza liberar intenção');
    const raw = JSON.stringify(receiptSchema.parse({ contrato: CONTRATO_CANCELAMENTO_PENDENTE, userId: this.userId, encerrada: original, prova: proof }));
    try {
      if (!this.storage || this.storage.getItem(this.key) !== JSON.stringify(original)) throw new Error('CAS divergente');
      const key = this.receiptKey(original), existing = this.storage.getItem(key);
      if (existing !== null && existing !== raw) throw new Error('Recibo divergente');
      if (existing === null) this.storage.setItem(key, raw);
      if (this.storage.getItem(key) !== raw || this.storage.getItem(this.key) !== JSON.stringify(original)) throw new Error('CAS/recibo não persistiu');
      this.storage.setItem(this.key, raw);
      if (this.storage.getItem(this.key) !== raw) throw new Error('Head terminal não persistiu');
      this.state.raw = raw; this.known = null;
    } catch { this.latched = true; throw new Error('Fechamento inconclusivo; UUID preservada, sem reset local.'); }
  }

}
