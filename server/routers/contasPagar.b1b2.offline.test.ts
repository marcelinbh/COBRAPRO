import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { contasPagarRouter } from './contasPagar';
import { DespesasIntentStore } from '../../shared/despesasIntent';
import { canCloseRejectedIntent } from '../../shared/financialIntentRecovery';
const h = vi.hoisted(() => ({ source: vi.fn(), recovery: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: h.source }));
vi.mock('../services/financialIntentRecovery', () => ({ reconcileFinancialIntent: h.recovery }));
const key = '11111111-1111-4111-8111-111111111111';
const op = '22222222-2222-4222-8222-222222222222';
const payOp = '33333333-3333-4333-8333-333333333333';
const zero = { totalPendente: '0.00', qtdPendente: 0, totalAtrasado: '0.00', qtdAtrasado: 0, totalPago: '0.00', qtdPago: 0 };
const caller = (userId = 1) => contasPagarRouter.createCaller({ user: userId ? { id: userId } : null, req: {}, res: {} } as any);
const expense = (status: any = null, user_id = 1, id = 900) => ({ id, user_id, descricao: 'Histórica', valor: '12.00', data_vencimento: '2026-11-24', status, data_pagamento: null, conta_caixa_id: null, recorrente: false, frequencia: null, categoria: 'outros', observacoes: null });
function source(rows: any[] = [], corruptOwner = false) {
  const calls: any[] = [];
  const c = { calls, rpc: vi.fn(), from: vi.fn((table: string) => {
    const call = { table, eq: [] as any[], range: null as any }; calls.push(call);
    const q: any = { select: (v: string) => { call.select = v; return q; }, eq: (k: string,v: any) => { call.eq.push([k,v]);return q; }, order: () => q, in: () => q, range: (a: number,b: number) => { call.range = [a,b];return q; }, then: (ok: any,bad: any) => Promise.resolve({ data: table === 'contas_pagar' ? rows.filter(r => corruptOwner || call.eq.every(([k,v]: any[]) => r[k] === v)).slice(call.range[0],call.range[1]+1) : [], error: null }).then(ok,bad) };
    return q;
  }) };
  h.source.mockResolvedValue(c); return c;
}
const request = (action: 'pagar' | 'estornar') => ({ family: `despesa_${action}` as const, idempotencyKey: key, payload: action === 'pagar' ? { id: 900, contaCaixaId: 4, dataPagamento: '2026-11-24' } : { id: 900, pagamentoOperationId: payOp, dataEstorno: '2026-11-24', motivo: 'Devolução comprovada' } });
function proof(r: any, status = 'not_executed', userId = 1) {
  const action = r.family.slice(8);
  return { ...r, userId, payloadHash: 'a'.repeat(64), proof: 'uuid_fenced_v1', status, fenceId: status === 'not_executed' ? op : null, quote: null, result: status === 'not_executed' ? null : { success: true, acao: action, operationId: op, chaveIdempotencia: key, userId, despesaId: 900, status: action === 'pagar' ? 'pago' : 'cancelado', valor: '12.00', contaCaixaId: 4, dataVencimento: '2026-11-24', dataPagamento: '2026-11-24', dataEstorno: action === 'estornar' ? '2026-11-24' : null, pagamentoOperationId: action === 'pagar' ? op : payOp, transacaoSaidaId: '9007199254740993', transacaoEstornoId: action === 'estornar' ? '9007199254740994' : null } };
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('ENABLE_RPC_DESPESAS_PROSPECTIVAS', 'false'); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-24T12:00:00Z')); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('B1 resumo sem omissão silenciosa no router exportado', () => {
  it.each([null, undefined, '', 'unknown', 'PENDENTE', '__proto__'])('status %s falha explicitamente, sem inferir pendente ou falso zero', async status => {
    const row = expense(); row.status = status; const c = source([row]);
    const list = await caller().listar(); expect(list).toHaveLength(1); expect(list[0].podePagar).toBe(false); expect(list[0].podeEstornar).toBe(false);
    await expect(caller().resumo()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: expect.stringContaining('Status histórico inválido') });
    expect(c.rpc).not.toHaveBeenCalled(); expect(row.status).toBe(status);
  });
  it('linha inválida depois da página 1000 invalida resumo completo', async () => {
    const c = source([...Array.from({ length: 1000 }, (_, i) => expense('pendente', 1, i+1)), expense(null, 1, 1001)]);
    await expect(caller().resumo()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(c.calls.map(q => q.range)).toEqual([[0,999],[1000,1999]]);
  });
  it('mistura válido + NULL não devolve subtotal como total completo', async () => { source([expense('pendente', 1, 901), expense(null)]); await expect(caller().resumo()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); });
  it('owner2 com NULL não afeta resumo nem consulta do owner1', async () => {
    const c = source([expense('pendente'), expense(null, 2, 901)]);
    expect(await caller().resumo()).toEqual({ ...zero, totalPendente: '12.00', qtdPendente: 1 });
    expect((await caller().listar()).map(r => r.id)).toEqual([900]);
    await expect(caller(2).resumo()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(c.calls.every(q => q.eq.some(([k]: any[]) => k === 'user_id'))).toBe(true);
  });
  it('fonte divergente continua fail-closed', async () => { source([expense('pendente',2)], true); await expect(caller().resumo()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); });
  it('vazio legítimo permanece zero exato', async () => { source(); expect(await caller().resumo()).toEqual(zero); });
  it('estados físicos/aliases reconhecidos e cancelados preservam totais exatos', async () => {
    source([expense('pendente',1,1), { ...expense('pendente',1,2), data_vencimento: '2026-11-23' },expense('atrasado',1,3),expense('atrasada',1,4),{ ...expense('pago',1,5), data_pagamento: '2026-11-24' },{ ...expense('paga',1,6), data_pagamento: '2026-11-24' },expense('cancelado',1,7),expense('cancelada',1,8)]);
    expect(await caller().resumo()).toEqual({ totalPendente: '12.00', qtdPendente: 1, totalAtrasado: '36.00', qtdAtrasado: 3, totalPago: '24.00', qtdPago: 2 });
  });
});
describe('B2 recovery isolado de novas writes, fonte e recovery mockados', () => {
  it.each(['pagar','estornar'] as const)('%s perdido pode consultar recovery existente com gateOFF', async action => {
    const c = source(), r = request(action), evidence = proof(r); h.recovery.mockResolvedValue(evidence);
    expect(await caller().reconciliar(r)).toEqual(evidence);
    expect(h.recovery).toHaveBeenCalledTimes(1); expect(h.recovery).toHaveBeenCalledWith(c, 1, r); expect(c.rpc).not.toHaveBeenCalled(); expect(c.from).not.toHaveBeenCalled();
  });
  it.each([undefined,'false','TRUE','1',''] as const)('gate %s continua bloqueando criar/pagar/estornar ANTES da fonte', async flag => {
    if (flag === undefined) delete process.env.ENABLE_RPC_DESPESAS_PROSPECTIVAS; else vi.stubEnv('ENABLE_RPC_DESPESAS_PROSPECTIVAS',flag);
    source();
    const inputs = [{ descricao: 'Nova', categoria: 'outros', valor: '12.00', dataVencimento: '2026-11-24', idempotencyKey: key }, { ...request('pagar').payload, idempotencyKey: key }, { ...request('estornar').payload, idempotencyKey: key }];
    for (const [i,action] of (['criar','pagar','estornar'] as const).entries()) await expect((caller()[action] as any)(inputs[i])).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(h.source).not.toHaveBeenCalled(); expect(h.recovery).not.toHaveBeenCalled(); expect(await caller().capacidades()).toEqual({ prospectivasHabilitadas: false, recorrencia: false });
  });
  it('auth, família e spoof continuam rejeitados antes da fonte', async () => {
    const r = request('pagar'); await expect(caller(0).reconciliar(r)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller().reconciliar({ ...r, userId: 2 } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller().reconciliar({ ...r, family: 'emprestimo_criar' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(h.source).not.toHaveBeenCalled(); expect(h.recovery).not.toHaveBeenCalled();
  });
  it('recovery sem fonte é indisponível explícito, nunca não execução', async () => {
    h.source.mockResolvedValue(null); await expect(caller().reconciliar(request('pagar'))).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: expect.stringContaining('Fonte de despesas indisponível') }); expect(h.recovery).not.toHaveBeenCalled();
  });
});
describe('Adapter recovery REAL offline: não chama writer nem inicio gateado', () => {
  it.each(['pagar','estornar'] as const)('adapter %s confirma original com gateOFF por uma única RPC de recovery', async action => {
    const actual = await vi.importActual<typeof import('../services/financialIntentRecovery')>('../services/financialIntentRecovery');
    const c = source(), r = request(action), evidence = proof(r,'confirmed'); c.rpc.mockResolvedValue({ data: evidence, error: null });
    h.recovery.mockImplementation(actual.reconcileFinancialIntent);
    const result = await caller().reconciliar(r); expect(result).toEqual(evidence); expect(result.result).toEqual(evidence.result);
    expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.rpc).toHaveBeenCalledWith('rpc_reconciliar_intencao_financeira', { p_user_id: 1, p_family: r.family, p_chave: key, p_request: r.payload }); expect(c.from).not.toHaveBeenCalled();
  });
  it.each(['pagar','estornar'] as const)('adapter %s prova fence e fechamento explícito sem reenviar dinheiro', async action => {
    const actual = await vi.importActual<typeof import('../services/financialIntentRecovery')>('../services/financialIntentRecovery');
    const c = source(), r = request(action), evidence = proof(r); c.rpc.mockResolvedValue({ data: evidence, error: null }); h.recovery.mockImplementation(actual.reconcileFinancialIntent);
    const values = new Map<string,string>(); const disk = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => values.set(k,v), removeItem: (k: string) => values.delete(k) };
    const store = new DespesasIntentStore(1,disk,vi.fn(),() => key); store.begin(action,r.payload as any);
    const result = await caller().reconciliar(r); expect(store.get(action)?.idempotencyKey).toBe(key); expect(canCloseRejectedIntent(result,1,r)).toBe(true);
    store.closeRejected(action,result); expect(store.get(action)).toBeNull(); expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.rpc.mock.calls[0][0]).toBe('rpc_reconciliar_intencao_financeira'); expect(c.from).not.toHaveBeenCalled();
  });
  it.each(['timeout','sql_error','null','no_fence','wrong_owner','wrong_payload','fake_confirmed'] as const)('evidência %s continua unknown, nunca autoriza descarte', async variant => {
    const actual = await vi.importActual<typeof import('../services/financialIntentRecovery')>('../services/financialIntentRecovery');
    const c = source(), r = request('pagar'); h.recovery.mockImplementation(actual.reconcileFinancialIntent);
    let evidence: any = proof(r);
    if (variant === 'timeout') c.rpc.mockRejectedValue(new Error('timeout sintético'));
    else { if (variant === 'null') evidence = null; if (variant === 'no_fence') evidence.fenceId = null; if (variant === 'wrong_owner') evidence.userId = 2; if (variant === 'wrong_payload') evidence.payload = { ...r.payload, id: 999 }; if (variant === 'fake_confirmed') evidence = { ...proof(r,'confirmed'), result: { success: true } };
      c.rpc.mockResolvedValue({ data: evidence, error: variant === 'sql_error' ? { code: '42501' } : null }); }
    await expect(caller().reconciliar(r)).rejects.toMatchObject({ code: variant === 'sql_error' ? 'PRECONDITION_FAILED' : 'INTERNAL_SERVER_ERROR' }); expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.from).not.toHaveBeenCalled();
  });
});

describe('B2 separação: adapter real já funciona sem env de writer, mesmo no baseline', () => {
  it.each(['pagar','estornar'] as const)('adapter direto %s: confirmed e fence gateOFF, somente recovery RPC', async action => {
    const actual = await vi.importActual<typeof import('../services/financialIntentRecovery')>('../services/financialIntentRecovery');
    const r = request(action);
    for (const status of ['confirmed','not_executed']) {
      const c=source(), evidence=proof(r,status); c.rpc.mockResolvedValue({data:evidence,error:null});
      expect(await actual.reconcileFinancialIntent(c,1,r)).toEqual(evidence);
      expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.rpc.mock.calls[0][0]).toBe('rpc_reconciliar_intencao_financeira'); expect(c.from).not.toHaveBeenCalled();
    }
  });
});
