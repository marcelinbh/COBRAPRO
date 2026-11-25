import { edicao49Input, edicao49Request, validarRecovery49, type Edicao49Input, type Recovery49 } from '../../../shared/despesas49';
export type Locks49 = { request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T> };
export type Storage49 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Journal49 = { key: string; raw: string; input: Edicao49Input };
export class Despesas49Journal {
  readonly key: string;
  constructor(readonly owner: number, readonly storage: Storage49 | null, readonly locks: Locks49 | undefined, readonly current: () => boolean) {
    if (!Number.isSafeInteger(owner) || owner <= 0 || owner > 2147483647) throw new Error('Owner49 inválido.');
    this.key = `cobrapro:despesas49:${owner}:pending`;
  }
  read(): Journal49 | null {
    if (!this.storage) throw new Error('Persistência49 indisponível; escritas bloqueadas.');
    const raw = this.storage.getItem(this.key);
    if (raw === null) return null;
    return { key: this.key, raw, input: edicao49Input.parse(JSON.parse(raw)) };
  }
  private lock<T>(fn: () => T | PromiseLike<T>): Promise<T> {
    if (!this.storage || !this.locks) return Promise.reject(new Error('Persistência e Web Locks49 obrigatórios.'));
    return this.locks.request(`journal49:${this.key}`, fn);
  }
  async prepare(request: unknown): Promise<Journal49> {
    return this.lock(() => {
      if (!this.current()) throw new Error('Sessão49 encerrada.');
      if (this.read()) throw new Error('Intenção49 original pendente: não substituir UUID/pedido.');
      const input = edicao49Input.parse({ idempotencyKey: crypto.randomUUID(), request: edicao49Request.parse(request) });
      const raw = JSON.stringify(input);
      this.storage!.setItem(this.key, raw);
      if (this.storage!.getItem(this.key) !== raw) throw new Error('CAS49 de preparação falhou.');
      return { key: this.key, raw, input };
    });
  }
  /** Lock cobre todo callback, inclusive RPC e confirmação; lifecycle revalidado dentro. */
  async run<T>(j: Journal49, fn: () => Promise<T>): Promise<T> {
    return this.lock(async () => {
      this.assertCurrent(j);
      return fn();
    });
  }
  /** Revalidar no callback APÓS cada await e antes de efeitos UI/cache/closure. */
  assertCurrent(j: Journal49): void {
    if (!this.current() || j.key !== this.key || !this.storage || this.storage.getItem(this.key) !== j.raw) throw new Error('Intenção/sessão49 mudou. Original preservado.');
  }
  /** Somente recovery terminal, sob mesmo lock do callback, pode fechar CAS. */
  closeInsideLock(j: Journal49, proof: Recovery49): boolean {
    validarRecovery49(proof, this.owner, j.input);
    if (!this.current() || this.storage!.getItem(this.key) !== j.raw) return false;
    const receiptKey = `cobrapro:despesas49:${this.owner}:receipt:${j.input.idempotencyKey}`;
    const raw = JSON.stringify({ input: j.input, proof });
    const old = this.storage!.getItem(receiptKey);
    if (old !== null && old !== raw) throw new Error('Recibo49 existente divergente.');
    this.storage!.setItem(receiptKey, raw);
    if (this.storage!.getItem(receiptKey) !== raw || this.storage!.getItem(this.key) !== j.raw) throw new Error('CAS49 mudou; original preservado.');
    this.storage!.removeItem(this.key);
    if (this.storage!.getItem(this.key) !== null) throw new Error('Remoção49 não confirmada; original e recibo preservados.');
    return true;
  }
}
