import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ db: vi.fn(), rpc: vi.fn(), multa: vi.fn(), nova: vi.fn(), antiga: vi.fn(), cotar: vi.fn(), receber: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: h.db }));
vi.mock('../services/recebimentosLegadosRpc', async original => ({ ...await original<any>(), cotarRecebimentoLegado: h.cotar, receberLegadoAtomico: h.receber }));
import { recebimentosLegadosRouter } from './recebimentosLegados';
const input = { contratoId: 1, parcelaId: 2, escopoUserId: 77 };
const origem = { userId: 77, contratoId: 1, parcelaId: 2, trilho: 'legado', status: 'pendente' };
const caller = (user: any = { id: 77 }) => recebimentosLegadosRouter.createCaller({ user, req: {}, res: {} } as any);
beforeEach(() => {
  vi.clearAllMocks(); h.db.mockResolvedValue({ rpc: h.rpc });
  h.multa.mockResolvedValue({ data: null, error: null }); h.nova.mockResolvedValue({ data: null, error: null }); h.antiga.mockResolvedValue({ data: origem, error: null });
  h.rpc.mockImplementation((name, args) => name === 'rpc_identificar_multa36' ? h.multa(args) : name === 'rpc_identificar_emprestimo_multimodal' ? h.nova(args) : name === 'legados_identificar_trilho' ? h.antiga(args) : Promise.reject(new Error('RPC fora do contrato')));
});
function noFinancialFallback() {
  expect(h.cotar).not.toHaveBeenCalled(); expect(h.receber).not.toHaveBeenCalled();
  expect(h.rpc.mock.calls.every(c => ['rpc_identificar_multa36', 'rpc_identificar_emprestimo_multimodal', 'legados_identificar_trilho'].includes(c[0]))).toBe(true);
}
describe('origem real — provas específicas, autenticação e tenant SQL', () => {
  it('não autenticado bloqueia antes do DB', async () => { await expect(caller(null).origem(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled(); });
  it.each([1, 78, 999999])('escopo %s divergente não vira tenant', async escopoUserId => {
    await expect(caller().origem({ ...input, escopoUserId })).rejects.toMatchObject({ code: 'UNAUTHORIZED' }); expect(h.db).not.toHaveBeenCalled(); noFinancialFallback();
  });
  it('tenant vem de ctx; NULL específico precede a classificação antiga', async () => {
    expect(await caller().origem(input)).toEqual(origem);
    expect(h.rpc.mock.calls).toEqual([
      ['rpc_identificar_multa36', { p_user_id: 77, p_contrato_id: 1, p_parcela_id: 2 }],
      ['rpc_identificar_emprestimo_multimodal', { p_user_id: 77, p_contrato_id: 1, p_parcela_id: 2 }],
      ['legados_identificar_trilho', { p_user_id: 77, p_contrato_id: 1, p_parcela_id: 2 }],
    ]); noFinancialFallback();
  });
  it('nova sessão usa seu próprio tenant autenticado', async () => {
    h.antiga.mockResolvedValue({ data: { ...origem, userId: 78, trilho: 'prospectivo' }, error: null });
    expect(await caller({ id: 78 }).origem({ ...input, escopoUserId: 78 })).toMatchObject({ userId: 78, trilho: 'prospectivo' }); expect(h.nova.mock.calls[0][0].p_user_id).toBe(78);
  });
  it.each([{ userId: 9 }, { p_user_id: 9 }, { desconto: '1.00' }, { contaCaixaId: 3 }])('rejeita input extra %j antes do banco', async extra => {
    await expect(caller().origem({ ...input, ...extra } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' }); expect(h.db).not.toHaveBeenCalled(); noFinancialFallback();
  });
  it.each([{ escopoUserId: 0 }, { escopoUserId: -1 }, { escopoUserId: '77' }, { escopoUserId: 1.5 }, { contratoId: 0 }, { parcelaId: 2147483648 }, { contratoId: 1.5 }])('rejeita identificadores inválidos %j', async extra => {
    await expect(caller().origem({ ...input, ...extra } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' }); expect(h.db).not.toHaveBeenCalled();
  });
  it('backend ausente não presume legado', async () => { h.db.mockResolvedValue(null); await expect(caller().origem(input)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(h.rpc).not.toHaveBeenCalled(); });
  it.each(['nova', 'antiga'] as const)('timeout no probe %s não permite outro trilho financeiro', async which => {
    h[which].mockRejectedValue(new Error('timeout')); await expect(caller().origem(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    if (which === 'nova') expect(h.antiga).not.toHaveBeenCalled(); noFinancialFallback();
  });
  it.each(['nova', 'antiga'] as const)('erros no probe %s não classificam por presunção', async which => {
    for (const [code, expected] of [['42501', 'NOT_FOUND'], ['42883', 'PRECONDITION_FAILED'], ['PGRST202', 'PRECONDITION_FAILED'], ['23514', 'PRECONDITION_FAILED']]) {
      h[which].mockResolvedValue({ data: origem, error: { code } }); await expect(caller().origem(input)).rejects.toMatchObject({ code: expected });
    }
    if (which === 'nova') expect(h.antiga).not.toHaveBeenCalled(); noFinancialFallback();
  });
  it.each([undefined, [], {}, { ...origem, trilho: 'legado' }, { ...origem, trilho: 'multimodal', userId: 78 }, { ...origem, trilho: 'multimodal', contratoId: 9 }, { ...origem, trilho: 'multimodal', parcelaId: 9 }, { ...origem, trilho: 'multimodal', status: 'ativo' }, { ...origem, trilho: 'multimodal', contaCaixaId: 3 }])('probe novo inválido %j não cai no antigo', async response => {
    h.nova.mockResolvedValue({ data: response, error: null }); await expect(caller().origem(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); expect(h.antiga).not.toHaveBeenCalled(); noFinancialFallback();
  });
  it.each([null, [], { ...origem, userId: 78 }, { ...origem, contratoId: 9 }, { ...origem, parcelaId: 9 }, { ...origem, trilho: 'desconhecido' }, { ...origem, trilho: 'multimodal' }, { ...origem, status: 'ativo' }, { ...origem, contaCaixaId: 3 }])('resposta antiga inválida %j não confirma origem', async response => {
    h.antiga.mockResolvedValue({ data: response, error: null }); await expect(caller().origem(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); noFinancialFallback();
  });
  it.each(['prospectivo', 'legado'])('trilho antigo %s íntegro é retornado sem mutação', async trilho => { h.antiga.mockResolvedValue({ data: { ...origem, trilho }, error: null }); expect(await caller().origem(input)).toEqual({ ...origem, trilho }); noFinancialFallback(); });
  it.each(['pendente', 'parcial', 'paga', 'renovada', 'cancelada'])('origem multimodal com status %s não chama classificador antigo', async status => {
    h.nova.mockResolvedValue({ data: { ...origem, trilho: 'multimodal', status }, error: null });
    expect(await caller().origem(input)).toEqual({ ...origem, trilho: 'multimodal', status }); expect(h.antiga).not.toHaveBeenCalled(); noFinancialFallback();
  });
  it('status renovada antigo preserva prova de principal transferido', async () => { h.antiga.mockResolvedValue({ data: { ...origem, status: 'renovada' }, error: null }); expect(await caller().origem(input)).toMatchObject({ status: 'renovada' }); });
  it.each(['pendente', 'parcial', 'paga', 'renovada', 'cancelada'])('multa36 %s tem prioridade sobre todas as origens anteriores', async status => {
    h.multa.mockResolvedValue({ data: { ...origem, trilho: 'multa36', status }, error: null });
    expect(await caller().origem(input)).toEqual({ ...origem, trilho: 'multa36', status });
    expect(h.nova).not.toHaveBeenCalled(); expect(h.antiga).not.toHaveBeenCalled(); noFinancialFallback();
  });
  it.each([undefined, [], {}, { ...origem }, { ...origem, trilho: 'multa36', userId: 78 }, { ...origem, trilho: 'multa36', parcelaId: 9 }, { ...origem, trilho: 'multa36', contratoId: 9 }, { ...origem, trilho: 'multa36', status: 'ativo' }])('multa36 inválida %j não presume ausência', async response => {
    h.multa.mockResolvedValue({ data: response, error: null }); await expect(caller().origem(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(h.nova).not.toHaveBeenCalled(); expect(h.antiga).not.toHaveBeenCalled();
  });
  it.each(['42501', '42883', 'PGRST202', '23514', '55000'])('recusa36 %s não permite outro trilho', async code => {
    h.multa.mockResolvedValue({ data: null, error: { code } }); await expect(caller().origem(input)).rejects.toMatchObject({ code: code === '42501' ? 'NOT_FOUND' : 'PRECONDITION_FAILED' });
    expect(h.nova).not.toHaveBeenCalled(); expect(h.antiga).not.toHaveBeenCalled();
  });
  it('timeout36 não permite classificação antiga', async () => {
    h.multa.mockRejectedValue(Error('timeout')); await expect(caller().origem(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(h.nova).not.toHaveBeenCalled(); expect(h.antiga).not.toHaveBeenCalled();
  });
});
