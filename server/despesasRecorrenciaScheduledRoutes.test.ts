import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), rpc: vi.fn() }));
vi.mock('./_core/sdk', () => ({ sdk: { authenticateRequest: h.auth } }));
vi.mock('./db', () => ({ getSupabaseClientAsync: h.db }));
import { despesasRecorrenciaScheduled68, registerDespesasRecorrenciaScheduledRoutes } from './despesasRecorrenciaScheduledRoutes';
const request = (body: unknown = {}) => ({ body, query: {}, headers: { 'x-manus-cron-task-uid': 'spoof' } } as any);
function response() { const r: any = { code: 200, body: undefined };r.set = vi.fn(() => r);r.status = vi.fn((n: number) => { r.code = n; return r; });r.json = vi.fn((b: unknown) => { r.body = b; return r; });return r; }
beforeEach(() => {
  vi.clearAllMocks();h.auth.mockResolvedValue({ id: -1, isCron: true, taskUid: 'dedicated68' });h.db.mockResolvedValue({ rpc: h.rpc });
  h.rpc.mockImplementation(async (_: string, args: any) => ({ data: { contrato: 'despesas68_batch_v1', runId: args.p_run_id, geradas: 0, falhas: 0, backlog: false, selecionada: false }, error: null }));
});
describe('HTTP68 domain cron', () => {
  it.each([{ id: 7 }, { id: -1, isCron: true }, { id: -1, isCron: true, taskUid: '' }, { id: -1, isCron: true, taskUid: 'a'.repeat(66) }])('nega sem identidade SDK exacta %j', async actor => {
    h.auth.mockResolvedValue(actor);const res = response();await despesasRecorrenciaScheduled68(request(), res);expect(res.code).toBe(403);expect(h.db).not.toHaveBeenCalled();
  });
  it.each([{ userId: 7 }, { taskUid: 'dedicated68' }, { dryRun: true }, { datas: [] }, { valor: '1.00' }, null, []])('nega body %j sem owner/source', async body => {
    const res = response();await despesasRecorrenciaScheduled68(request(body), res);
    expect(res.code).toBe(400);expect(h.rpc).not.toHaveBeenCalled();
  });
  it('só envia UID autenticado/runId ao geradorDB; owner vem da série noDB', async () => {
    const res = response();await despesasRecorrenciaScheduled68(request(), res);expect(res.code).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith('rpc_gerar_despesas68', { p_task_uid: 'dedicated68', p_run_id: res.body.runId });expect(res.body.resultado).toBe('concluido');expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it('UID de outrodomínio negado peloDB sem usar notificações', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });const res = response();await despesasRecorrenciaScheduled68(request(), res);expect(res.code).toBe(403);expect(JSON.stringify(res.body)).not.toContain('dedicated68');
  });
  it('backlog limita12 transações e reporta parcial; falha éretryable503 semPII', async () => {
    h.rpc.mockImplementation(async (_: string, args: any) => ({ data: { contrato: 'despesas68_batch_v1', runId: args.p_run_id, geradas: 8, falhas: 0, backlog: true, selecionada: true }, error: null }));
    const res = response();await despesasRecorrenciaScheduled68(request(), res);expect(h.rpc).toHaveBeenCalledTimes(12);expect(res.body).toMatchObject({ resultado: 'parcial', geradas: 96, backlog: true });
    h.rpc.mockRejectedValue(Error('PII secreta'));const fail = response();await despesasRecorrenciaScheduled68(request(), fail);expect(fail.code).toBe(503);expect(JSON.stringify(fail.body)).not.toContain('PII');
  });
  it('registra exclusivamente POST no path dedicado', () => {
    const app = { post: vi.fn() };registerDespesasRecorrenciaScheduledRoutes(app as any);expect(app.post).toHaveBeenCalledWith('/api/scheduled/despesas-recorrentes', despesasRecorrenciaScheduled68);
  });
});
