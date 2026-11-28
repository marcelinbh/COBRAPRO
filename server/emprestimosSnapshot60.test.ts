import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const dbMock = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), resetDb: vi.fn() }));
vi.mock('./db', () => dbMock);
import { appRouter } from './routers';
import { LOCAL_REASONS60 } from './services/snapshot60-reader';

import { RPC67 } from './services/snapshot67-reader';
const fixture = () => JSON.parse(readFileSync(new URL('./services/fixtures/snapshot60-whole03.json', import.meta.url), 'utf8'));
const caller = (user: any = { id: 1 }) => appRouter.createCaller({ user, req: { headers: {} }, res: {} } as any).contratos;
function backend(response: unknown = { data: { versao: 'lista_emprestimos67_v1', userId: 1, lista60: fixture(), organizacao67: { state: 'unavailable', scope: 'ALLscope' } }, error: null, status: 200, count: null, statusText: 'OK' }) {
  const rpc = vi.fn(async () => response);
  const from = vi.fn(() => { throw new Error('REST proibido na lista60'); });
  const client = { rpc, from };
  dbMock.getSupabaseClientAsync.mockResolvedValue(client);
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  dbMock.getDb.mockImplementation(() => { throw new Error('Drizzle proibido na lista60'); });
});

describe('Caller real lista60: snapshot único e scope exclusivamente da sessão', () => {
  it('SQL privado atravessa a procedure sem REST, leitura strict, fanout ou writer', async () => {
    const client = backend();
    const result = await caller().listLeituraSegura();
    expect(result.version).toBe('loan_list_read_v1');
    expect(result.userId).toBe(1);
    expect(result.coverage).toEqual({ scopedContracts: 15, validatedContracts: 14, unavailableContracts: 1, complete: false, label: 'validados somente' });
    expect(result.items.find(row => row.id === 958)).toEqual({ kind: 'unavailable', id: 958, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.' });
    expect(client.rpc.mock.calls).toEqual([[RPC67, { p_user_id: 1 }]]);
    expect(client.from).not.toHaveBeenCalled();
    expect(dbMock.getDb).not.toHaveBeenCalled();
  });

  it.each([null, { id: 0 }, { id: '1' }, { id: 1.5 }, { id: 2147483648 }])('owner inválido %j não alcança backend', async user => {
    await expect(caller(user).listLeituraSegura()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(dbMock.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it('nenhum owner/filtro/contrato fornecido pelo caller é aceito', async () => {
    await expect((caller().listLeituraSegura as any)({ userId: 99, contratoId: 1, arquivo: 'todos' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbMock.getSupabaseClientAsync).not.toHaveBeenCalled();
  });

  it('owner divergente no snapshot é falha global, nunca recusa local', async () => {
    const client = backend();
    await expect(caller({ id: 99 }).listLeituraSegura()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(client.rpc.mock.calls).toEqual([[RPC67, { p_user_id: 99 }]]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each(['57014', '42501', 'P0001', 'timeout'])('erro SQL %s não faz retry nem degrada a placeholder/REST', async code => {
    const client = backend({ data: null, error: { code }, status: 500 });
    await expect(caller().listLeituraSegura()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(client.rpc).toHaveBeenCalledTimes(1); expect(client.from).not.toHaveBeenCalled();
  });

  it.each(LOCAL_REASONS60)('só allowlist local %s vira placeholder estrito e total indisponível', async reason => {
    const snapshot = fixture(); snapshot.items = [{ kind: 'unavailable', id: 1, reason }];
    const client = backend({ data: { versao: 'lista_emprestimos67_v1', userId: 1, lista60: snapshot, organizacao67: { state: 'unavailable', scope: 'ALLscope' } }, error: null });
    const result = await caller().listLeituraSegura();
    expect(result.totals.values).toBeNull(); expect(result.coverage.complete).toBe(false);
    expect(Object.keys(result.items[0]).sort()).toEqual(['id', 'kind', 'message']);
    expect(client.rpc).toHaveBeenCalledTimes(1); expect(client.from).not.toHaveBeenCalled();
  });

  it('backend ausente/erro de inicialização não confirma carteira vazia', async () => {
    dbMock.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(caller().listLeituraSegura()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    dbMock.getSupabaseClientAsync.mockRejectedValue(new Error('offline'));
    await expect(caller().listLeituraSegura()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(dbMock.getDb).not.toHaveBeenCalled();
  });
});
