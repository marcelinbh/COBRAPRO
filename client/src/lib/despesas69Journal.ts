import { edicao69Input, edicao69Request, validarRecovery69, type Edicao69Input, type Recovery69, type Quote69, temDelta69, validarQuote69 } from '../../../shared/despesas69';
export type Locks69 = { request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T> };
export type Storage69 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Journal69 = { key: string; raw: string; input: Edicao69Input };
export class Despesas69Journal {
  readonly key: string;
  constructor(readonly owner: number, readonly storage: Storage69 | null, readonly locks: Locks69 | undefined, readonly current: () => boolean) {
    if (!Number.isSafeInteger(owner) || owner <= 0 || owner > 2147483647) throw new Error('Owner69 inválido.');
    this.key = `cobrapro:despesas69:${owner}:pending`;
  }
  read(): Journal69 | null {
    if (!this.storage) throw new Error('Persistência69 indisponível; escritas bloqueadas.');
    const raw = this.storage.getItem(this.key);
    if (raw === null) return null;
    return { key: this.key, raw, input: edicao69Input.parse(JSON.parse(raw)) };
  }
  private lock<T>(fn: () => T | PromiseLike<T>): Promise<T> {
    if (!this.storage || !this.locks) return Promise.reject(new Error('Persistência e Web Locks69 obrigatórios.'));
    return this.locks.request(`journal69:${this.key}`, fn);
  }
  async prepare(request: unknown, quote: Quote69): Promise<Journal69> {
    return this.lock(() => {
      if (!this.current()) throw new Error('Sessão69 encerrada.');
      if (this.read()) throw new Error('Intenção69 original pendente: não substituir UUID/pedido.');
      const parsed = edicao69Request.parse(request);
      quote = validarQuote69(quote, this.owner, parsed.despesaId);
      if (quote.quote49.userId !== this.owner || parsed.despesaId !== quote.quote49.despesaId || parsed.estadoHash !== quote.quote49.estadoHash || parsed.origemOperationId !== quote.quote49.origemOperationId || !temDelta69(parsed, quote)) throw new Error('Cotação69 divergente ou edição sem alteração; nenhuma UUID criada.');
      const input = edicao69Input.parse({ idempotencyKey: crypto.randomUUID(), request: parsed });
      const raw = JSON.stringify(input);
      this.storage!.setItem(this.key, raw);
      if (this.storage!.getItem(this.key) !== raw) throw new Error('CAS69 de preparação falhou.');
      return { key: this.key, raw, input };
    });
  }
  /** Lock cobre todo callback, inclusive RPC e confirmação; lifecycle revalidado dentro. */
  async run<T>(j: Journal69, fn: () => Promise<T>): Promise<T> {
    return this.lock(async () => {
      this.assertCurrent(j);
      return fn();
    });
  }
  /** Revalidar no callback APÓS cada await e antes de efeitos UI/cache/closure. */
  assertCurrent(j: Journal69): void {
    if (!this.current() || j.key !== this.key || !this.storage || this.storage.getItem(this.key) !== j.raw) throw new Error('Intenção/sessão69 mudou. Original preservado.');
  }
  /** Somente recovery terminal, sob mesmo lock do callback, pode fechar CAS. */
  closeInsideLock(j: Journal69, proof: Recovery69): boolean {
    validarRecovery69(proof, this.owner, j.input);
    if (!this.current() || this.storage!.getItem(this.key) !== j.raw) return false;
    const receiptKey = `cobrapro:despesas69:${this.owner}:receipt:${j.input.idempotencyKey}`;
    const raw = JSON.stringify({ input: j.input, proof });
    const old = this.storage!.getItem(receiptKey);
    if (old !== null && old !== raw) throw new Error('Recibo69 existente divergente.');
    this.storage!.setItem(receiptKey, raw);
    if (this.storage!.getItem(receiptKey) !== raw || this.storage!.getItem(this.key) !== j.raw) throw new Error('CAS69 mudou; original preservado.');
    this.storage!.removeItem(this.key);
    if (this.storage!.getItem(this.key) !== null) throw new Error('Remoção69 não confirmada; original e recibo preservados.');
    return true;
  }
}
