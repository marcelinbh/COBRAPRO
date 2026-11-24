import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Cheque40Intent } from '../../shared/cheques40';
import type { TrpcContext } from '../_core/context';
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getSupabaseClientAsync: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock('../db', () => ({ getDb: mocks.getDb, getSupabaseClientAsync: mocks.getSupabaseClientAsync, resetDb: vi.fn() }));
import { appRouter } from '../routers';
const intent: Cheque40Intent = { idempotencyKey: '11111111-1111-4111-8111-111111111111', request: { acao: 'criar', dataOperacao: '2026-11-24', clienteId: 1, contaCaixaId: 101, emitente: 'Fixture', numeroCheque: '123', banco: null, agencia: null, conta: null, cpfCnpjEmitente: null, valorNominal: '100.00', dataVencimento: '2026-12-24', taxaDesconto: '3.00', tipoTaxa: 'mensal', observacoes: null } };
const proof = { success: true, regra: 'cheques40_v1', id: 1001, operationId: '22222222-2222-4222-8222-222222222222', idempotencyKey: intent.idempotencyKey, repetida: false, valorLiquido: '97.09', valorDesconto: '2.91', status: 'descontado', estornadoNoCaixa: false, requerConferenciaCaixa: false };
function contexto(owner: number | null = 901): TrpcContext {
  return { user: owner === null ? null : { id: owner, openId: 'offline-fixture40', role: 'user', name: 'Fixture', email: 'fixture@example.invalid', loginMethod: 'test', createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} } as TrpcContext['req'], res: {} as TrpcContext['res'] };
}
const routes = ['executar40', 'recuperar40', 'abandonar40'] as const;
describe('Cheques40 integrado: contrato fechado, owner de sessão e RPC única', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.from.mockImplementation(() => { throw new Error('REST proibido na escrita40'); });
    mocks.getSupabaseClientAsync.mockResolvedValue({ rpc: mocks.rpc, from: mocks.from });
  });
  it.each(routes)('%s usa owner da sessão e não ORM/REST', async endpoint => {
    const data = endpoint === 'abandonar40' ? { success: true, regra: 'cheques40_fence_v1', estado: 'nao_executada', idempotencyKey: intent.idempotencyKey, request: intent.request, resultado: null } : { ...proof, repetida: endpoint === 'recuperar40' };
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(appRouter.createCaller(contexto(902)).cheques[endpoint](intent)).resolves.toEqual(data);
    expect(mocks.getSupabaseClientAsync).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.rpc).toHaveBeenCalledWith(endpoint === 'abandonar40' ? 'rpc_abandonar_cheques40' : 'rpc_cheques40', { p_user_id: 902, p_chave: intent.idempotencyKey, p_request: intent.request });
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each(routes)('%s rejeita owner extra no envelope/request antes do banco', async endpoint => {
    const caller = appRouter.createCaller(contexto()).cheques;
    for (const bad of [{ ...intent, userId: 2 }, { ...intent, request: { ...intent.request, userId: 2 } }, { id: 1 }, { ...intent.request }, { ...intent, request: { ...intent.request, valorNominal: 100 } }]) await expect(caller[endpoint](bad as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each(routes)('%s recusa anônimo antes de RPC/REST', async endpoint => {
    await expect(appRouter.createCaller(contexto(null)).cheques[endpoint](intent)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(routes)('%s sem cliente falha fechado; não faz fallback', async endpoint => {
    mocks.getSupabaseClientAsync.mockResolvedValue(null);
    await expect(appRouter.createCaller(contexto()).cheques[endpoint](intent)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each(routes)('%s timeout não refaz nem troca UUID/payload', async endpoint => {
    const before = JSON.stringify(intent); mocks.rpc.mockRejectedValue(new Error('timeout'));
    await expect(appRouter.createCaller(contexto()).cheques[endpoint](intent)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.getDb).not.toHaveBeenCalled(); expect(JSON.stringify(intent)).toBe(before);
  });
  it.each(['compensar', 'devolver', 'cancelar'] as const)('ação %s usa o mesmo writer atômico e prova vinculada', async acao => {
    const terminal: Cheque40Intent = { idempotencyKey: intent.idempotencyKey, request: acao === 'devolver' ? { acao, id: 1001, dataOperacao: '2026-11-24', motivo: 'Sem fundos' } : { acao, id: 1001, dataOperacao: '2026-11-24' } };
    mocks.rpc.mockResolvedValue({ data: { ...proof, status: { compensar: 'compensado', devolver: 'devolvido', cancelar: 'cancelado' }[acao], estornadoNoCaixa: acao !== 'compensar' }, error: null });
    await expect(appRouter.createCaller(contexto()).cheques.executar40(terminal)).resolves.toMatchObject({ success: true });
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.rpc).toHaveBeenCalledWith('rpc_cheques40', { p_user_id: 901, p_chave: terminal.idempotencyKey, p_request: terminal.request });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('não ressuscita endpoints legados ou writers40 suspensos, e preserva reserva antes da rede', () => {
    const procedures = appRouter._def.procedures;
    for (const name of ['criar', 'compensar', 'devolver', 'cancelar']) expect(Object.keys(procedures)).not.toContain('cheques.' + name);
    const source = readFileSync(new URL('../routers.ts', import.meta.url), 'utf8');
    const section = source.slice(source.indexOf('const chequesRouter'), source.indexOf('const vendasTelefoneRouter'));
    expect(section).toContain('...cheques40Procedures');
    for (const forbidden of ['db.insert(cheques)', 'db.update(cheques)', ".from('cheques').insert", ".from('cheques').update", 'bloquearOperacaoFinanceiraNaoAtomica']) expect(section).not.toContain(forbidden);
    const ui = readFileSync(new URL('../../client/src/pages/Cheques.tsx', import.meta.url), 'utf8');
    expect(ui.indexOf('reservarIntencaoCheque40(localStorage')).toBeGreaterThan(-1);
    expect(ui.indexOf('reservarIntencaoCheque40(localStorage')).toBeLessThan(ui.indexOf('cheque40.mutateAsync(intent)'));
    expect(ui).toContain('navigator.locks.request'); expect(ui).toContain('Recuperar mesma intenção');
  });
});
