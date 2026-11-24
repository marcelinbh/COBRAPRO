import { pagamentoAssinatura42Schema, confirmarConferenciaAssinatura42, type PagamentoAssinatura42 } from './assinaturas42';
type Storage42 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Locks42 = Pick<LockManager, 'request'>;
const storageKey = (userId: number) => {
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) throw new Error('Sessão inválida.');
  return `cobrapro.assinaturas42.pending.${userId}`;
};
const igual = (a: PagamentoAssinatura42, b: PagamentoAssinatura42) => JSON.stringify(a) === JSON.stringify(b);
async function comLock42<T>(locks: Locks42 | undefined, userId: number, action: () => T): Promise<T> {
  // Não há fallback read/set inseguro entre abas. Sem Web Locks, bloquear a operação.
  if (!locks?.request) throw new Error('Web Locks indisponível; recebimento bloqueado para preservar a intenção.');
  return locks.request(storageKey(userId), { mode: 'exclusive' }, action);
}
export function carregarIntencaoAssinatura42(storage: Storage42, userId: number): PagamentoAssinatura42 | null {
  const text = storage.getItem(storageKey(userId));
  if (text === null) return null;
  const envelope = JSON.parse(text);
  if (!envelope || envelope.version !== 1 || envelope.userId !== userId || Object.keys(envelope).sort().join(',') !== 'input,userId,version') throw new Error('Intenção persistida inválida; preserve o registro para conferência.');
  return pagamentoAssinatura42Schema.parse(envelope.input);
}
export async function persistirIntencaoAssinatura42(storage: Storage42, locks: Locks42 | undefined, userId: number, input: PagamentoAssinatura42, atual: () => boolean = () => true): Promise<PagamentoAssinatura42> {
  const parsed = pagamentoAssinatura42Schema.parse(input);
  return comLock42(locks, userId, () => {
    if (!atual()) throw new Error('Sessão alterada; nenhum novo envio.');
    const current = carregarIntencaoAssinatura42(storage, userId);
    if (current !== null && !igual(current, parsed)) throw new Error('Já existe recebimento pendente; confira a intenção antes de registrar outro.');
    if (current === null) storage.setItem(storageKey(userId), JSON.stringify({ version: 1, userId, input: parsed }));
    const persisted = carregarIntencaoAssinatura42(storage, userId);
    if (!persisted || !igual(persisted, parsed)) throw new Error('Não foi possível preservar a intenção; nenhum envio permitido.');
    return persisted;
  });
}
/** CAS sob o mesmo Web Lock. Sem prova confirmed/fenced válida não existe limpeza local. */
export async function concluirIntencaoAssinatura42(storage: Storage42, locks: Locks42 | undefined, userId: number, input: PagamentoAssinatura42, prova: unknown, atual: () => boolean = () => true): Promise<boolean> {
  const parsed = pagamentoAssinatura42Schema.parse(input);
  confirmarConferenciaAssinatura42(prova, parsed);
  return comLock42(locks, userId, () => {
    if (!atual()) return false;
    const current = carregarIntencaoAssinatura42(storage, userId);
    if (!current || !igual(current, parsed)) return false;
    storage.removeItem(storageKey(userId));
    if (carregarIntencaoAssinatura42(storage, userId) !== null) throw new Error('Journal não liberado; preserve para conferência.');
    return true;
  });
}
