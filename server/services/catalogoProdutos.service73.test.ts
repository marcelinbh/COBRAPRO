import { beforeEach, describe, expect, it } from 'vitest';
import {
  criarProdutoInput, atualizarEstoqueInput, desativarProdutoInput,
  mapearProdutosCatalogo, listarProdutosCatalogo, criarProdutoCatalogo,
  atualizarEstoqueCatalogo, desativarProdutoCatalogo,
} from './catalogoProdutos';
import { OWNER, OTHER, PRIVATE, row, rest, rejectedRest, resetMocks } from './catalogoProdutos.fixture73';
beforeEach(resetMocks);
async function fails(work: Promise<unknown>, code = 'INTERNAL_SERVER_ERROR') {
  const error = await work.then(() => null, error => error);
  expect(error).toBeTruthy();
  expect(error.code).toBe(code);
  expect(error.message).not.toContain(PRIVATE);
  expect(JSON.stringify(error)).not.toContain(PRIVATE);
}
const input = { nome: '  Produto teste  ', preco: 0.29 };
describe('catalog service and mapping: direct isolated tests', () => {
  it('strict schemas forbid every owner/unknown key for each input', () => {
    for (const key of ['userId', 'user_id', 'owner', 'ownerId', 'extra']) {
      expect(criarProdutoInput.safeParse({ ...input, [key]: OTHER }).success).toBe(false);
      expect(atualizarEstoqueInput.safeParse({ id: 3, estoque: 0, [key]: OTHER }).success).toBe(false);
      expect(desativarProdutoInput.safeParse({ id: 3, [key]: OTHER }).success).toBe(false);
    }
  });
  it('legitimate cents are accepted without multiplication-based float rejection', () => {
    for (const preco of [0.01, 0.07, 0.29, 0.57, 1.01, 10.1, 9999999999999.99]) {
      expect(criarProdutoInput.parse({ ...input, preco }).preco).toBe(preco);
    }
  });
  it('subcents, exponent-tiny/huge, NaN, Infinity and numeric strings reject', () => {
    for (const preco of [0.001, 0.0000001, 1.005, 0.29000001, 1e20, NaN, Infinity, -Infinity, '1.01']) {
      expect(criarProdutoInput.safeParse({ ...input, preco }).success).toBe(false);
    }
  });
  it('schema normalizes whitespace and nullable/absent description, stock default', () => {
    expect(criarProdutoInput.parse(input)).toEqual({ nome: 'Produto teste', preco: 0.29, estoque: 0 });
    expect(criarProdutoInput.parse({ ...input, descricao: null }).descricao).toBeNull();
    expect(criarProdutoInput.safeParse({ ...input, nome: '\t\n  ' }).success).toBe(false);
    expect(criarProdutoInput.safeParse({ ...input, nome: 'á'.repeat(255) }).success).toBe(true);
    expect(criarProdutoInput.safeParse({ ...input, nome: 'á'.repeat(256) }).success).toBe(false);
  });
  it('public DTO removes unknown fields and maps decimal price exactly', () => {
    expect(mapearProdutosCatalogo([row({ preco: '0.29', segredo: PRIVATE })], OWNER)).toEqual([{
      id: 3, user_id: OWNER, nome: 'Produto teste', descricao: null, preco: 0.29, estoque: 2, ativo: true,
    }]);
  });
  it('nullable inventory is not inferred as zero; absence is malformed', () => {
    expect(mapearProdutosCatalogo([row({ estoque: null })], OWNER)[0].estoque).toBeNull();
    expect(() => mapearProdutosCatalogo([row({ estoque: undefined })], OWNER)).toThrow();
  });
  it('mapper rejects mixed owners without PII in thrown error/cause', () => {
    let error: any;
    try { mapearProdutosCatalogo([row(), row({ user_id: OTHER, nome: PRIVATE })], OWNER); } catch (caught) { error = caught; }
    expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain(PRIVATE);
  });
  for (const owner of [-1, 0, 1.5, 2147483648]) {
    it(`service rejects invalid server owner ${owner} before DB query`, async () => {
      const { client } = rest([]);
      await fails(listarProdutosCatalogo(client, owner), 'UNAUTHORIZED');
      expect(client.from).not.toHaveBeenCalled();
    });
  }
  it('missing client fails closed for all four service operations', async () => {
    await fails(listarProdutosCatalogo(null, OWNER));
    await fails(criarProdutoCatalogo(null, OWNER, input));
    await fails(atualizarEstoqueCatalogo(null, OWNER, { id: 3, estoque: 0 }));
    await fails(desativarProdutoCatalogo(null, OWNER, { id: 3 }));
  });
  for (const envelope of [undefined, null, {}, { data: [] }, { data: [], error: undefined }, { data: [], error: {} }, { data: [], error: null, status: 500 }, { data: [], error: null, status: '200' }]) {
    it(`rejects malformed/error envelope ${JSON.stringify(envelope)}`, async () => {
      const { client, q } = rest([]);
      q.then = (ok: any, fail: any) => Promise.resolve(envelope).then(ok, fail);
      await fails(listarProdutosCatalogo(client, OWNER));
    });
  }
  it('successful empty read is not confused with missing data', async () => {
    const { client } = rest([]);
    expect(await listarProdutosCatalogo(client, OWNER)).toEqual([]);
  });
  it('service create writes exact decimal and only ctx owner once', async () => {
    const { client, q } = rest({ id: 3, user_id: OWNER });
    expect(await criarProdutoCatalogo(client, OWNER, input)).toEqual({ success: true, id: 3 });
    expect(q.insert).toHaveBeenCalledTimes(1);
    expect(q.insert).toHaveBeenCalledWith({ nome: 'Produto teste', descricao: null, preco: '0.29', estoque: 0, user_id: OWNER });
  });
  it('service rejects forged create owner rather than stripping it', async () => {
    const { client } = rest({ id: 3, user_id: OWNER });
    await fails(criarProdutoCatalogo(client, OWNER, { ...input, userId: OTHER } as any), 'BAD_REQUEST');
    expect(client.from).not.toHaveBeenCalled();
  });
  for (const [name, operation] of [
    ['create', (client: any) => criarProdutoCatalogo(client, OWNER, input)],
    ['stock', (client: any) => atualizarEstoqueCatalogo(client, OWNER, { id: 3, estoque: 0 })],
    ['deactivate', (client: any) => desativarProdutoCatalogo(client, OWNER, { id: 3 })],
  ] as const) {
    it(`${name} timeout/rejected write has no retry`, async () => {
      const { client } = rejectedRest();
      await fails(operation(client));
      expect(client.from).toHaveBeenCalledTimes(1);
    });
  }
  it('absolute stock zero/max-int32 persist without arithmetic or decrement', async () => {
    for (const estoque of [0, 2147483647]) {
      const { client, q } = rest([{ id: 3, user_id: OWNER }]);
      expect(await atualizarEstoqueCatalogo(client, OWNER, { id: 3, estoque })).toEqual({ success: true });
      expect(q.update).toHaveBeenCalledTimes(1);
      expect(q.update).toHaveBeenCalledWith({ estoque });
    }
  });
  it('deactivate writes only ativo false and requires an own row', async () => {
    const { client, q } = rest([{ id: 3, user_id: OWNER }]);
    expect(await desativarProdutoCatalogo(client, OWNER, { id: 3 })).toEqual({ success: true });
    expect(q.update).toHaveBeenCalledWith({ ativo: false });
  });
  it('error wins over zero rows; zero rows NOT_FOUND only after error=null', async () => {
    const failed = rest([], { message: PRIVATE });
    await fails(desativarProdutoCatalogo(failed.client, OWNER, { id: 3 }));
    const empty = rest([]);
    await fails(desativarProdutoCatalogo(empty.client, OWNER, { id: 3 }), 'NOT_FOUND');
  });
});
