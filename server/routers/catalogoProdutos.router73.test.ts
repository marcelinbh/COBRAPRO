import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OWNER, OTHER, PRIVATE, row, rest, rejectedRest, resetMocks, getDb, getSupabaseClientAsync, resetDb } from '../services/catalogoProdutos.fixture73';
let catalog: any;
beforeAll(async () => { catalog = (await import('./catalogoProdutos')).vendasCatalogoRouter; });
beforeEach(resetMocks);
const caller = () => catalog.createCaller({ user: { id: OWNER } });
const create = (extra: Record<string, unknown> = {}) => ({ nome: 'Produto teste', preco: 1.01, estoque: 2, ...extra });
async function failure(task: Promise<unknown>, code: string) {
  const result = await task.then(() => null, error => error);
  expect(result, 'must reject, never false success').toBeTruthy();
  expect(result.code).toBe(code);
  expect(result.message).not.toContain(PRIVATE);
  expect(JSON.stringify(result)).not.toContain(PRIVATE);
}
describe('four real catalog procedures: shared RED/GREEN assertions', () => {
  it('requires authenticated context before any client access', async () => {
    await failure(catalog.createCaller({ user: null }).listarProdutos(), 'UNAUTHORIZED');
    expect(getSupabaseClientAsync).not.toHaveBeenCalled();
  });
  it('empty successful list remains empty with explicit own filters and projection', async () => {
    const { q } = rest([]);
    expect(await caller().listarProdutos()).toEqual([]);
    expect(q.eq).toHaveBeenCalledWith('user_id', OWNER);
    expect(q.eq).toHaveBeenCalledWith('ativo', true);
    expect(q.select).not.toHaveBeenCalledWith('*');
  });
  it('read error is not an empty list and error is sanitized', async () => {
    rest(null, { message: PRIVATE });
    await failure(caller().listarProdutos(), 'INTERNAL_SERVER_ERROR');
  });
  it('read timeout rejects without fallback or raw message', async () => {
    const { client } = rejectedRest();
    await failure(caller().listarProdutos(), 'INTERNAL_SERVER_ERROR');
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(resetDb).not.toHaveBeenCalled();
  });
  it('unavailable client is not empty success', async () => {
    getSupabaseClientAsync.mockResolvedValue(null);
    await failure(caller().listarProdutos(), 'INTERNAL_SERVER_ERROR');
  });
  it('client acquisition error is sanitized', async () => {
    getSupabaseClientAsync.mockRejectedValue(new Error(PRIVATE));
    await failure(caller().listarProdutos(), 'INTERNAL_SERVER_ERROR');
  });
  for (const malformed of [null, {}, [row({ preco: '1.001' })], [row({ id: -3 })], [row({ estoque: -1 })], [row({ estoque: 2147483648 })], [row({ descricao: 9 })], [row({ ativo: false })], [row({ user_id: null })], [row({ user_id: undefined })], [row({ nome: '   ' })]]) {
    it(`rejects malformed list ${JSON.stringify(malformed)}`, async () => {
      rest(malformed);
      await failure(caller().listarProdutos(), 'INTERNAL_SERVER_ERROR');
    });
  }
  it('mixed owner payload rejects whole result rather than leak or silently filter', async () => {
    rest([row(), row({ id: 4, user_id: OTHER, nome: PRIVATE })]);
    await failure(caller().listarProdutos(), 'INTERNAL_SERVER_ERROR');
  });
  it('maps numeric price, public own DTO only, preserving null stock', async () => {
    rest([row({ estoque: null, extraPrivate: PRIVATE, createdAt: PRIVATE })]);
    expect(await caller().listarProdutos()).toEqual([{
      id: 3, user_id: OWNER, nome: 'Produto teste', descricao: null, preco: 1.01, estoque: null, ativo: true,
    }]);
  });
  for (const method of ['atualizarEstoque', 'desativarProduto'] as const) {
    const input = (extra: Record<string, unknown> = {}) => ({ id: 3, ...(method === 'atualizarEstoque' ? { estoque: 7 } : {}), ...extra });
    it(`${method}: checks REST error before success`, async () => {
      rest([row()], { message: PRIVATE });
      await failure(caller()[method](input()), 'INTERNAL_SERVER_ERROR');
    });
    it(`${method}: zero rows means NOT_FOUND and own filter remains mandatory`, async () => {
      const { q } = rest([]);
      await failure(caller()[method](input()), 'NOT_FOUND');
      expect(q.eq).toHaveBeenCalledWith('id', 3);
      expect(q.eq).toHaveBeenCalledWith('user_id', OWNER);
    });
    it(`${method}: only one returned own row confirms success`, async () => {
      const { q } = rest([row({ estoque: 7, ativo: method === 'desativarProduto' ? false : true })]);
      expect(await caller()[method](input())).toEqual({ success: true });
      expect(q.select).toHaveBeenCalledWith('id,user_id');
      expect(q.eq).toHaveBeenCalledWith('id', 3);
      expect(q.eq).toHaveBeenCalledWith('user_id', OWNER);
    });
    for (const data of [null, {}, [row(), row({ id: 4 })], [row({ user_id: OTHER })], [row({ id: 4 })], [{ id: 3 }]]) {
      it(`${method}: malformed/multiple/mismatched write confirmation ${JSON.stringify(data)}`, async () => {
        rest(data);
        await failure(caller()[method](input()), 'INTERNAL_SERVER_ERROR');
      });
    }
    it(`${method}: uncertain timeout has no fallback or retry`, async () => {
      const { client } = rejectedRest();
      await failure(caller()[method](input()), 'INTERNAL_SERVER_ERROR');
      expect(client.from).toHaveBeenCalledTimes(1);
      expect(getSupabaseClientAsync).toHaveBeenCalledTimes(1);
      expect(resetDb).not.toHaveBeenCalled();
    });
    for (const id of [-1, 0, 1.5, 2147483648]) {
      it(`${method}: rejects non-positive/non-integer/out-of-range id ${id} before DB`, async () => {
        rest([row()]);
        await failure(caller()[method](input({ id })), 'BAD_REQUEST');
        expect(getSupabaseClientAsync).not.toHaveBeenCalled();
      });
    }
    it(`${method}: rejects injected userId before DB`, async () => {
      rest([row()]);
      await failure(caller()[method](input({ userId: OTHER })), 'BAD_REQUEST');
      expect(getSupabaseClientAsync).not.toHaveBeenCalled();
    });
  }
  for (const estoque of [-1, 0.5, 2147483648]) {
    it(`stock ${estoque} rejected by create and update before DB`, async () => {
      rest([{ id: 3, user_id: OWNER }]);
      await failure(caller().criarProduto(create({ estoque })), 'BAD_REQUEST');
      await failure(caller().atualizarEstoque({ id: 3, estoque }), 'BAD_REQUEST');
      expect(getSupabaseClientAsync).not.toHaveBeenCalled();
    });
  }
  for (const extra of [{ nome: '   ' }, { nome: 'x'.repeat(256) }, { preco: 0.001 }, { preco: 1.005 }, { preco: 0 }, { preco: -1 }, { preco: 10000000000000 }, { userId: OTHER }, { user_id: OTHER }]) {
    it(`create rejects invalid/forged input ${JSON.stringify(extra)}`, async () => {
      rest({ id: 3, user_id: OWNER });
      await failure(caller().criarProduto(create(extra)), 'BAD_REQUEST');
      expect(getSupabaseClientAsync).not.toHaveBeenCalled();
    });
  }
  for (const preco of [0.29, 1.01, 1, 9999999999999.99]) {
    it(`create exact price ${preco}, trimmed name, default stock, ctx owner, nullable description`, async () => {
      const { q, client } = rest({ id: 3, user_id: OWNER });
      expect(await caller().criarProduto({ nome: '  Produto teste  ', preco, descricao: null })).toEqual({ success: true, id: 3 });
      expect(q.insert).toHaveBeenCalledWith({
        nome: 'Produto teste', descricao: null, preco: preco.toFixed(2), estoque: 0, user_id: OWNER,
      });
      expect(q.select).toHaveBeenCalledWith('id,user_id');
      expect(client.from).toHaveBeenCalledTimes(1);
    });
  }
  it('create permits physical 255-character name and maximum int32 stock', async () => {
    const { q } = rest({ id: 3, user_id: OWNER });
    expect(await caller().criarProduto(create({ nome: 'x'.repeat(255), estoque: 2147483647 }))).toEqual({ success: true, id: 3 });
    expect(q.insert).toHaveBeenCalledWith(expect.objectContaining({ estoque: 2147483647 }));
  });
  it('create missing description becomes null and stock zero is valid', async () => {
    const { q } = rest({ id: 3, user_id: OWNER });
    expect(await caller().criarProduto(create({ estoque: 0 }))).toEqual({ success: true, id: 3 });
    expect(q.insert).toHaveBeenCalledWith(expect.objectContaining({ descricao: null, estoque: 0 }));
  });
  it('create error response never exposes DB message', async () => {
    rest(null, { message: PRIVATE });
    await failure(caller().criarProduto(create()), 'INTERNAL_SERVER_ERROR');
  });
  it('create uncertain timeout never falls back or retries', async () => {
    const { client } = rejectedRest();
    await failure(caller().criarProduto(create()), 'INTERNAL_SERVER_ERROR');
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(resetDb).not.toHaveBeenCalled();
  });
  for (const data of [null, {}, { id: -1, user_id: OWNER }, { id: 3, user_id: OTHER }, { id: 3 }, [{ id: 3, user_id: OWNER }]]) {
    it(`create malformed/wrong owner response ${JSON.stringify(data)}`, async () => {
      rest(data);
      await failure(caller().criarProduto(create()), 'INTERNAL_SERVER_ERROR');
    });
  }
});
