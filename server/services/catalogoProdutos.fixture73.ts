import { vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), resetDb: vi.fn() }));
vi.mock('../db', () => mocks);
const { getDb, getSupabaseClientAsync, resetDb } = mocks;
export const OWNER = 17;
export const OTHER = 29;
export const PRIVATE = 'SYNTHETIC_PRIVATE_OWNER_MESSAGE';
export const row = (extra: Record<string, unknown> = {}) => ({
  id: 3, user_id: OWNER, nome: 'Produto teste', descricao: null,
  preco: '1.01', estoque: 2, ativo: true, ...extra,
});
export function rest(data: unknown, error: unknown = null) {
  const q: any = {};
  for (const method of ['select', 'eq', 'order', 'insert', 'update', 'single', 'maybeSingle', 'limit']) {
    q[method] = vi.fn(() => q);
  }
  q.then = (ok: any, fail: any) => Promise.resolve({ data, error }).then(ok, fail);
  const client = { from: vi.fn(() => q) };
  getDb.mockResolvedValue(null);
  getSupabaseClientAsync.mockResolvedValue(client);
  return { client, q };
}
export function rejectedRest() {
  const result = rest(null);
  result.q.then = (ok: any, fail: any) => Promise.reject(new Error(PRIVATE)).then(ok, fail);
  return result;
}
export function resetMocks() {
  getDb.mockReset().mockResolvedValue(null);
  getSupabaseClientAsync.mockReset();
  resetDb.mockReset();
}
export { getDb, getSupabaseClientAsync, resetDb };
