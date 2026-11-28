import { input68, owner68, request68, validarProof68, type Input68, type Proof68 } from '../../../shared/despesasRecorrencia68';
export type Storage68 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Locks68 = { request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T> };
export type Journal68 = { key: string; raw: string; input: Input68 };
export class DespesasRecorrencia68Journal {
  readonly key: string;
  constructor(readonly owner: number, readonly storage: Storage68 | null, readonly locks: Locks68 | undefined, readonly current: () => boolean) {
    owner68.parse(owner); this.key = `cobrapro:despesas68:${owner}:pending`;
  }
  read(): Journal68 | null {
    if (!this.storage) throw Error('Persistência68 indisponível.');
    const raw = this.storage.getItem(this.key);
    return raw === null ? null : { key: this.key, raw, input: input68.parse(JSON.parse(raw)) };
  }
  knownProof(j: Journal68): Proof68 | null {
    this.assertCurrent(j);
    const raw = this.storage!.getItem(`cobrapro:despesas68:${this.owner}:receipt:${j.input.idempotencyKey}`);
    if (raw === null) return null;
    const record = JSON.parse(raw);
    const original = input68.parse(record.input);
    if (JSON.stringify(original) !== JSON.stringify(j.input)) throw Error('Recibo68 de outro original.');
    return validarProof68(record.proof, this.owner, j.input);
  }
  private lock<T>(fn: () => T | PromiseLike<T>): Promise<T> {
    if (!this.storage || !this.locks) return Promise.reject(Error('Persistência e Web Locks68 obrigatórios.'));
    return this.locks.request(`journal68:${this.key}`, fn);
  }
  async prepare(request: unknown): Promise<Journal68> {
    return this.lock(() => {
      if (!this.current()) throw Error('Sessão68 encerrada.');
      const parsed = request68.parse(request);
      if (this.read()) throw Error('Original68 pendente; não substituir UUID/pedido.');
      const input = input68.parse({ idempotencyKey: crypto.randomUUID(), request: parsed });
      const raw = JSON.stringify(input); this.storage!.setItem(this.key, raw);
      if (this.storage!.getItem(this.key) !== raw || !this.current()) throw Error('CAS/sessão68 mudou; releia o original.');
      return { key: this.key, raw, input };
    });
  }
  assertCurrent(j: Journal68) {
    if (!this.current() || j.key !== this.key || !this.storage || this.storage.getItem(this.key) !== j.raw) throw Error('Intenção/sessão68 mudou; original preservado.');
  }
  async run<T>(j: Journal68, fn: () => Promise<T>): Promise<T> { return this.lock(async () => { this.assertCurrent(j); return fn(); }); }
  closeInsideLock(j: Journal68, rawProof: Proof68): boolean {
    const proof = validarProof68(rawProof, this.owner, j.input); this.assertCurrent(j);
    const key = `cobrapro:despesas68:${this.owner}:receipt:${j.input.idempotencyKey}`;
    const raw = JSON.stringify({ input: j.input, proof }), old = this.storage!.getItem(key);
    if (old !== null && old !== raw) throw Error('Recibo68 divergente.');
    this.storage!.setItem(key, raw);
    if (this.storage!.getItem(key) !== raw) throw Error('Persistência do recibo68 inconclusiva.');
    this.assertCurrent(j); this.storage!.removeItem(this.key);
    if (this.storage!.getItem(this.key) !== null) throw Error('Remoção68 inconclusiva; consulte o original.');
    return true;
  }
}
