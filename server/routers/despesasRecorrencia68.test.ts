import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ db: vi.fn(), rpc: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: h.db }));
import { despesasRecorrencia68Router } from './despesasRecorrencia68';
const key = '10000000-0000-4000-8000-000000000001', serie = '20000000-0000-4000-8000-000000000001';
const request = { action: 'criar' as const, template: { descricao: 'Aluguel', categoria: 'aluguel' as const, valor: '100.01', observacoes: '' }, frequencia: 'mensal' as const, ancora: '2030-01-31', termino: null };
const input = { idempotencyKey: key, request };
const proof = { contrato: 'despesas68_v1', userId: 7, idempotencyKey: key, request, status: 'confirmed', serieId: serie, revision: 1, effectiveOrdinal: 0, fenceId: key, instante: '2026-11-27T12:00:00Z' };
const ctx = (user: any) => ({ user, req: { headers: {} }, res: {} } as any);
beforeEach(() => { vi.clearAllMocks();h.db.mockResolvedValue({ rpc: h.rpc }); h.rpc.mockResolvedValue({ data: proof, error: null }); });
describe('router68 humano/owner/unknown/CAS', () => {
  it('ctx.user.id é único owner; uma RPC de configuração sem geração/rest', async () => {
    const caller = despesasRecorrencia68Router.createCaller(ctx({ id: 7, role: 'user' }));
    expect(await caller.configurar(input)).toEqual(proof);
    expect(h.rpc).toHaveBeenCalledWith('rpc_configurar_despesas68', { p_user_id: 7, p_chave: key, p_request: request });
    await expect(caller.configurar({ ...input, userId: 8 } as any)).rejects.toThrow();
    await expect(caller.configurar({ ...input, request: { ...request, user_id: 8 } } as any)).rejects.toThrow();expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([null, { id: -1, isCron: true }, { id: 7, isCron: true }, { id: 0 }, { id: NaN }])('nega actor %j antes de fonte', async user => {
    await expect(despesasRecorrencia68Router.createCaller(ctx(user)).configurar(input)).rejects.toThrow();expect(h.db).not.toHaveBeenCalled();
  });
  it('recovery independe da agenda; falso receipt e owner divergente não passam', async () => {
    h.rpc.mockResolvedValueOnce({ data: { ...proof, status: 'not_executed', serieId: null, revision: null, effectiveOrdinal: null }, error: null });
    expect((await despesasRecorrencia68Router.createCaller(ctx({ id: 7 })).recuperar(input)).status).toBe('not_executed');
    h.rpc.mockResolvedValueOnce({ data: { ...proof, userId: 8 }, error: null });await expect(despesasRecorrencia68Router.createCaller(ctx({ id: 7 })).configurar(input)).rejects.toThrow();
  });
  it('timeout preserva unknown; stale CAS é CONFLICT; sem fallback', async () => {
    const caller = despesasRecorrencia68Router.createCaller(ctx({ id: 7 }));h.rpc.mockRejectedValueOnce(Error('timeout'));
    await expect(caller.configurar(input)).rejects.toThrow('Preserve UUID');
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } });await expect(caller.configurar(input)).rejects.toMatchObject({ code: 'CONFLICT' });expect(h.rpc).toHaveBeenCalledTimes(2);
  });
  it('não expõe lifecycle nem vínculo arbitrárioUID no router humano', () => {
    const record = despesasRecorrencia68Router._def.record;expect(Object.keys(record).sort()).toEqual(['configurar', 'listar', 'recuperar']);
  });
});
