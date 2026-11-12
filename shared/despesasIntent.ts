import { z } from 'zod';
import { canCloseRejectedIntent, type RecoveryEvidence } from './financialIntentRecovery';

export function diaCivilBrt(now = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => p.find(p => p.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function dataCivilDespesa(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
/** Sem float, arredondamento, notação científica ou centavos inventados. */
export function dinheiroDespesa(value: string): string | null {
  if (!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(value)) return null;
  const [inteiro, fracao = ''] = value.split('.');
  const cents = BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, '0'));
  if (cents <= BigInt(0) || cents > BigInt('999999999999999')) return null;
  return `${inteiro}.${fracao.padEnd(2, '0')}`;
}
export function moedaDespesa(value: string | number): string {
  const s = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s)) return 'Valor requer conferência';
  const [inteiro, fracao = ''] = s.split('.');
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fracao.padEnd(2, '0')}`;
}
const id = z.number().int().positive().max(2147483647);
const civil = z.string().refine(dataCivilDespesa, 'Informe uma data civil válida (YYYY-MM-DD).');
const dinheiro = z.string().refine(v => dinheiroDespesa(v) !== null, 'Informe dinheiro decimal exato, positivo e com até dois centavos.');
export const categoriaDespesa = z.enum(['aluguel', 'energia', 'agua', 'internet', 'telefone', 'salario', 'imposto', 'fornecedor', 'outros']);
export const criarDespesaPayload = z.object({ descricao: z.string().trim().min(1).max(255), categoria: categoriaDespesa.default('outros'), valor: dinheiro, dataVencimento: civil, observacoes: z.string().max(10000).optional() }).strict();
export const pagarDespesaPayload = z.object({ id, contaCaixaId: id, dataPagamento: civil }).strict();
export const estornarDespesaPayload = z.object({ id, pagamentoOperationId: z.string().uuid(), dataEstorno: civil, motivo: z.string().trim().min(1).max(2000) }).strict();
export const criarDespesaInput = criarDespesaPayload.extend({ idempotencyKey: z.string().uuid() }).strict();
export const pagarDespesaInput = pagarDespesaPayload.extend({ idempotencyKey: z.string().uuid() }).strict();
export const estornarDespesaInput = estornarDespesaPayload.extend({ idempotencyKey: z.string().uuid() }).strict();
export type AcaoDespesa = 'criar' | 'pagar' | 'estornar';
export type PayloadDespesa = {
  criar: z.infer<typeof criarDespesaPayload>;
  pagar: z.infer<typeof pagarDespesaPayload>;
  estornar: z.infer<typeof estornarDespesaPayload>;
};
const envelopeBase = { version: z.literal(1), userId: id, idempotencyKey: z.string().uuid() };
const envelopeSchema = z.discriminatedUnion('action', [
  z.object({ ...envelopeBase, action: z.literal('criar'), payload: criarDespesaPayload }).strict(),
  z.object({ ...envelopeBase, action: z.literal('pagar'), payload: pagarDespesaPayload }).strict(),
  z.object({ ...envelopeBase, action: z.literal('estornar'), payload: estornarDespesaPayload }).strict(),
]);
export type IntencaoDespesaPersistida = z.infer<typeof envelopeSchema>;
export type IntencaoDaAcao<A extends AcaoDespesa> = Extract<IntencaoDespesaPersistida, { action: A }>;
export type StorageDespesas = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const schemas = { criar: criarDespesaPayload, pagar: pagarDespesaPayload, estornar: estornarDespesaPayload };
const memoria = new Map<string, IntencaoDespesaPersistida | null>();
const locks = new Set<string>();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function canonical(v: unknown): string {
  if (!v || typeof v !== 'object') return JSON.stringify(v);
  return JSON.stringify(Object.keys(v).sort().map(k => [k, (v as Record<string, unknown>)[k]]));
}
/** Uma intenção incerta não pode ser descartada/trocada silenciosamente. Nenhum token é armazenado. */
export class DespesasIntentStore {
  private bloqueadas = new Set<AcaoDespesa>();
  constructor(private readonly userId: number, private readonly storage: StorageDespesas | null, private readonly avisar: (message: string) => void, private readonly uuid: () => string = () => crypto.randomUUID()) { id.parse(userId); }
  private key(action: AcaoDespesa) { return `cobrapro:despesas:0020:v1:user:${this.userId}:action:${action}`; }
  get<A extends AcaoDespesa>(action: A): IntencaoDaAcao<A> | null {
    const key = this.key(action);
    if (memoria.has(key)) return clone(memoria.get(key) ?? null) as IntencaoDaAcao<A> | null;
    try {
      if (!this.storage) throw new Error('sessionStorage indisponível');
      const text = this.storage.getItem(key);
      if (!text) { memoria.set(key, null); return null; }
      const parsed = envelopeSchema.parse(JSON.parse(text));
      if (parsed.userId !== this.userId || parsed.action !== action) throw new Error('Escopo incorreto');
      memoria.set(key, parsed);
      return clone(parsed) as IntencaoDaAcao<A>;
    } catch {
      this.bloqueadas.add(action);
      this.avisar(`Intenção ${action} não pôde ser recuperada. Requer conferência antes de qualquer nova operação; nenhuma chave substituta será gerada.`);
      return null;
    }
  }
  blocked(action: AcaoDespesa) { return this.bloqueadas.has(action); }
  begin<A extends AcaoDespesa>(action: A, payload: PayloadDespesa[A]): IntencaoDaAcao<A> {
    const atual = this.get(action);
    if (this.blocked(action)) throw new Error('Intenção indisponível; requer conferência, sem nova chave.');
    const parsed = schemas[action].parse(payload);
    if (atual) {
      if (canonical(atual.payload) !== canonical(parsed)) throw new Error('Resultado incerto: a MESMA chave exige o payload original. Confira ou repita a intenção original.');
      return atual;
    }
    const record = envelopeSchema.parse({ version: 1, userId: this.userId, action, idempotencyKey: this.uuid(), payload: parsed });
    memoria.set(this.key(action), record);
    try {
      if (!this.storage) throw new Error('sessionStorage indisponível');
      this.storage.setItem(this.key(action), JSON.stringify(record));
    } catch {
      this.avisar(`Não foi possível persistir a intenção ${action} (quota/armazenamento). UUID ${record.idempotencyKey} mantido em memória. Não recarregue: salve a chave e o payload original exibidos para conferência/retry.`);
    }
    return clone(record) as IntencaoDaAcao<A>;
  }
  acquire(action: AcaoDespesa): boolean {
    const key = this.key(action);
    if (locks.has(key)) return false;
    locks.add(key); return true;
  }
  release(action: AcaoDespesa) { locks.delete(this.key(action)); }
  /** A ausência REST/NOT_FOUND/timeout não satisfaz esta prova. Nunca cleanup automático. */
  closeRejected(action: AcaoDespesa, evidence: RecoveryEvidence | undefined) {
    const atual = this.get(action);
    if (locks.has(this.key(action)) || !atual || !canCloseRejectedIntent(evidence, this.userId, {
      family: `despesa_${action}`, idempotencyKey: atual.idempotencyKey, payload: atual.payload,
    })) throw new Error('Não execução NÃO comprovada ou operação em curso; intenção preservada.');
    try {
      if (!this.storage) throw new Error('sessionStorage indisponível');
      this.storage.removeItem(this.key(action));
      memoria.set(this.key(action), null);
    } catch { throw new Error('Remoção indisponível; intenção original preservada para conferência.'); }
  }
  /** Chamar somente depois de confirmação completa validada da RPC. */
  confirmed(action: AcaoDespesa, key: string) {
    const atual = this.get(action);
    if (!atual || atual.idempotencyKey !== key) throw new Error('Confirmação não corresponde à intenção original.');
    // Se falha a remoção, conservar a intenção original (inclusive em memória): replay seguro.
    try {
      if (!this.storage) throw new Error('sessionStorage indisponível');
      this.storage.removeItem(this.key(action));
      memoria.set(this.key(action), null);
    } catch {
      this.avisar(`Operação confirmada, mas intenção ${action} não pôde ser removida do armazenamento. Confira/reenvie a MESMA chave; nova intenção permanece bloqueada.`);
    }
  }
}
