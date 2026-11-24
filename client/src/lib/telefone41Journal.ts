import { intencaoTelefone41Schema, prepararIntencaoTelefone41, type IntencaoTelefone41 } from '../../../shared/telefone41';

type JournalStorage41 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
export type Journal41 = { key: string; raw: string; intent: IntencaoTelefone41 };
export type Locks41 = { request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T> };
export type Escopo41 = { owner: number | null; ativo: boolean };
export const criarEscopo41 = (owner: number | null): Escopo41 => ({ owner, ativo: true });
export const escopoAtual41 = (expected: Escopo41, current: Escopo41) => expected === current && expected.ativo && expected.owner !== null;
function lock41<T>(key: string, locks: Locks41 | undefined, fn: () => T): Promise<T> {
  if (!locks) return Promise.reject(new Error('Coordenação segura entre abas indisponível. Intenção preservada; use navegador com Web Locks.'));
  return locks.request(`journal41:${key}`, fn);
}
/** A mesma chave de lock cobre read/create e compare/delete entre todas as abas deste cliente. */
export function prepararJournal41(storage: JournalStorage41, key: string, request: unknown, locks: Locks41 | undefined, current: () => boolean = () => true): Promise<Journal41> {
  return lock41(key, locks, () => {
    if (!current()) throw new Error('Owner ou componente mudou; journal preservado.');
    const intent = prepararIntencaoTelefone41(storage, key, request);
    const raw = storage.getItem(key);
    if (raw === null || JSON.stringify(intencaoTelefone41Schema.parse(JSON.parse(raw))) !== JSON.stringify(intent)) throw new Error('Journal mudou durante a preparação.');
    return { key, raw, intent };
  });
}
/** Nenhuma resposta antiga pode apagar UUID/payload novo; checa lifecycle DENTRO do lock. */
export function limparJournal41(storage: JournalStorage41, journal: Journal41, locks: Locks41 | undefined, current: () => boolean = () => true): Promise<boolean> {
  return lock41(journal.key, locks, () => {
    if (!current() || storage.getItem(journal.key) !== journal.raw) return false;
    storage.removeItem(journal.key);
    return true;
  });
}
export function listarJournal41(storage: JournalStorage41, owner: number): string[] {
  const prefix = `cobrapro:telefone41:${owner}:`;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys.sort();
}
