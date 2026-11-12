import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DespesasIntentStore } from '../../shared/despesasIntent';
import { assertRecoveryEvidence, canCloseRejectedIntent, type RecoveryEvidence } from '../../shared/financialIntentRecovery';
import { reconcileFinancialIntent } from './financialIntentRecovery';
const mocks = vi.hoisted(() => ({ db: vi.fn(), rpc: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: mocks.db }));
import { emprestimosProspectivosRouter } from '../routers/emprestimosProspectivos';
import { contasPagarRouter } from '../routers/contasPagar';
const key = '11111111-1111-4111-8111-111111111111';
const request = { family: 'despesa_pagar' as const, idempotencyKey: key, payload: { id: 101, contaCaixaId: 1, dataPagamento: '2026-11-10' } };
const proof = (userId = 77): RecoveryEvidence => ({ ...request, userId, payloadHash: 'a'.repeat(64), proof: 'uuid_fenced_v1', status: 'not_executed', fenceId: '22222222-2222-4222-8222-222222222222', result: null, quote: null });
const input = { idempotencyKey: key, clienteId: 1, contaCaixaId: 1, modalidade: 'mensal' as const, tipoTaxa: 'mensal' as const, valorPrincipal: '100.00', taxaJuros: '0.00', numeroParcelas: 1, dataInicio: '2026-11-10', dataDesembolso: '2026-11-10', vencimentos: ['2026-12-10'] };
beforeEach(() => { vi.clearAllMocks(); for (const flag of ['ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS', 'ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS', 'ENABLE_RPC_DESPESAS_PROSPECTIVAS']) vi.stubEnv(flag, 'true'); mocks.db.mockResolvedValue({ rpc: mocks.rpc }); mocks.rpc.mockResolvedValue({ data: proof(), error: null }); });
afterEach(() => vi.unstubAllEnvs());
describe('evidência autoritativa UUID/payload e store fail closed', () => {
  it.each([undefined, {}, { code: 'NOT_FOUND' }, { status: 'not_executed' }, { ...proof(), proof: 'absent_select' }, { ...proof(), family: 'despesa_criar' }, { ...proof(), payload: { ...request.payload, id: 102 } }, { ...proof(), idempotencyKey: '33333333-3333-4333-8333-333333333333' }, { ...proof(), payloadHash: '' }, { ...proof(), fenceId: null }, { ...proof(), status: 'unknown' }, { ...proof(), userId: 2 }])('não aceita ausência, erro ou prova divergente %j', value => {
    expect(canCloseRejectedIntent(value as any, 77, request)).toBe(false);
    expect(() => assertRecoveryEvidence(value, 77, request)).toThrow();
  });
  it('store não permite corrigir outra dívida após unknown nem depois de confirmação sem fence', () => {
    const values = new Map<string, string>(); const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) };
    const store = new DespesasIntentStore(7001, storage, vi.fn(), () => key); store.begin('pagar', request.payload);
    expect(() => store.closeRejected('pagar', undefined)).toThrow(/NÃO comprovada/);
    expect(() => store.begin('pagar', { ...request.payload, id: 102 })).toThrow(/MESMA chave/);
    const evidence = proof(7001); expect(store.acquire('pagar')).toBe(true);
    expect(() => store.closeRejected('pagar', evidence)).toThrow(/em curso/); store.release('pagar');
    store.closeRejected('pagar', evidence); expect(store.get('pagar')).toBeNull();
  });
  it('remoção do storage falha: mesmo UUID permanece e nova operação não abre', () => {
    const values = new Map<string, string>(); const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: () => { throw new Error('quota'); } };
    const store = new DespesasIntentStore(7002, storage, vi.fn(), () => key); store.begin('pagar', request.payload);
    expect(() => store.closeRejected('pagar', proof(7002))).toThrow(/preservada/); expect(store.get('pagar')?.idempotencyKey).toBe(key);
  });
  it.each([{ code: '42501' }, { code: '40001' }, { code: 'PGRST202' }, { code: '23514' }])('erro SQL de reconciliação %j não oferece não-execução', async error => {
    await expect(reconcileFinancialIntent({ rpc: async () => ({ data: null, error }) }, 77, request)).rejects.toThrow(/Nenhum descarte/);
  });
  it('timeout e data null são desconhecidos', async () => {
    await expect(reconcileFinancialIntent({ rpc: async () => { throw new Error('network'); } }, 77, request)).rejects.toThrow(/NÃO comprovada/);
    await expect(reconcileFinancialIntent({ rpc: async () => ({ data: null, error: null }) }, 77, request)).rejects.toThrow(/NÃO comprovada/);
  });
  it('router usa owner do contexto, exige sessão e não aceita family emprestimo em despesa', async () => {
    const caller = contasPagarRouter.createCaller({ user: { id: 77 }, req: {}, res: {} } as any);
    expect(await caller.reconciliar(request)).toEqual(proof());
    expect(mocks.rpc).toHaveBeenCalledWith('rpc_reconciliar_intencao_financeira', { p_user_id: 77, p_family: request.family, p_chave: key, p_request: request.payload });
    await expect(caller.reconciliar({ ...request, userId: 2 } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.reconciliar({ ...request, family: 'emprestimo_criar' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(contasPagarRouter.createCaller({ user: null } as any).reconciliar(request)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('validação completa server não obtém DB nem usa RPC real; agenda, principal, taxa e rateio recusados', async () => {
    const caller = emprestimosProspectivosRouter.createCaller({ user: { id: 77 }, req: {}, res: {} } as any);
    expect(await caller.validarCriacao(input)).toEqual({ validada: true });
    for (const over of [{ valorPrincipal: '0.00' }, { taxaJuros: '1000.00' }, { vencimentos: ['2026-02-30'] }, { numeroParcelas: 2, vencimentos: ['2026-12-31', '2027-01-31'] }, { valorPrincipal: '0.01', numeroParcelas: 2, vencimentos: ['2026-12-10', '2027-01-10'] }]) {
      await expect(caller.validarCriacao({ ...input, ...over })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('falso confirmed do SQL é recusado, não desbloqueia store', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...proof(), status: 'confirmed', fenceId: null, result: { success: true } }, error: null });
    await expect(reconcileFinancialIntent({ rpc: mocks.rpc }, 77, request)).rejects.toThrow(/incompatível/);
  });
});
