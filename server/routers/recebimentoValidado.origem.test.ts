import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ db: vi.fn(), rpc: vi.fn(), cotar: vi.fn(), receber: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: h.db }));
// A origem é independente das mutações financeiras. Os spies tornam qualquer
// fallback para cotação/recebimento visível, sem mudar flags ou tocar um banco.
vi.mock('../services/recebimentosLegadosRpc', async original => ({ ...await original<any>(), cotarRecebimentoLegado: h.cotar, receberLegadoAtomico: h.receber }));
import { recebimentosLegadosRouter } from './recebimentosLegados';
const input = { contratoId: 1, parcelaId: 2, escopoUserId: 77 };
const origem = { userId: 77, contratoId: 1, parcelaId: 2, trilho: 'legado', status: 'pendente' };
const caller = (user: any = { id: 77 }) => recebimentosLegadosRouter.createCaller({ user, req: {}, res: {} } as any);
beforeEach(() => { vi.clearAllMocks(); h.db.mockResolvedValue({ rpc: h.rpc }); h.rpc.mockResolvedValue({ data: origem, error: null }); });
function noFinancialFallback() { expect(h.cotar).not.toHaveBeenCalled(); expect(h.receber).not.toHaveBeenCalled(); expect(h.rpc.mock.calls.every(c => c[0] === 'legados_identificar_trilho')).toBe(true); }

describe('recebimentosLegados.origem — caller real, autenticação e tenant SQL', () => {
  it('não autenticado bloqueia DB antes de resolver a origem', async () => { await expect(caller(null).origem(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled(); });
  it.each([1, 78, 999999])('cache de escopo %s não é tenant: mismatch rejeita antes do DB', async escopoUserId => {
    await expect(caller().origem({ ...input, escopoUserId })).rejects.toMatchObject({ code: 'UNAUTHORIZED' }); expect(h.db).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled(); noFinancialFallback();
  });
  it('tenant SQL vem exclusivamente de ctx.user.id e não envia escopoUserId à RPC', async () => {
    expect(await caller().origem(input)).toEqual(origem);
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith('legados_identificar_trilho', { p_user_id: 77, p_contrato_id: 1, p_parcela_id: 2 });
    expect(h.rpc.mock.calls[0][1]).not.toHaveProperty('escopoUserId'); expect(h.rpc.mock.calls[0][1]).not.toHaveProperty('userId'); noFinancialFallback();
  });
  it('nova sessão usa outro tenant apenas após autenticação correspondente', async () => {
    h.rpc.mockResolvedValue({ data: { ...origem, userId: 78, trilho: 'prospectivo' }, error: null });
    expect(await caller({ id: 78 }).origem({ ...input, escopoUserId: 78 })).toMatchObject({ userId: 78, trilho: 'prospectivo' }); expect(h.rpc.mock.calls[0][1].p_user_id).toBe(78);
  });
  it.each([{ userId: 9 }, { p_user_id: 9 }, { desconto: '1.00' }, { contaCaixaId: 3 }])('input estrito rejeita campo extra %j antes do banco', async extra => {
    await expect(caller().origem({ ...input, ...extra } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' }); expect(h.db).not.toHaveBeenCalled(); noFinancialFallback();
  });
  it.each([{ escopoUserId: 0 }, { escopoUserId: -1 }, { escopoUserId: '77' }, { escopoUserId: 1.5 }, { contratoId: 0 }, { parcelaId: 2147483648 }, { contratoId: 1.5 }])('input inválido %j bloqueia banco', async extra => {
    await expect(caller().origem({ ...input, ...extra } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' }); expect(h.db).not.toHaveBeenCalled();
  });
  it('backend ausente não presume legado nem executa outro fluxo', async () => { h.db.mockResolvedValue(null); await expect(caller().origem(input)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(h.rpc).not.toHaveBeenCalled(); noFinancialFallback(); });
  it('exceção de transporte bloqueia com erro sem fallback', async () => { h.rpc.mockRejectedValue(new Error('timeout')); await expect(caller().origem(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); expect(h.rpc).toHaveBeenCalledOnce(); noFinancialFallback(); });
  it.each([['42501', 'NOT_FOUND'], ['42883', 'PRECONDITION_FAILED'], ['PGRST202', 'PRECONDITION_FAILED'], ['23514', 'PRECONDITION_FAILED']])('erro SQL %s não classifica implicitamente legado', async (code, expected) => {
    h.rpc.mockResolvedValue({ data: origem, error: { code } }); await expect(caller().origem(input)).rejects.toMatchObject({ code: expected }); noFinancialFallback();
  });
  it.each([null, [], { ...origem, userId: 78 }, { ...origem, contratoId: 9 }, { ...origem, parcelaId: 9 }, { ...origem, trilho: 'desconhecido' }, { ...origem, status: 'ativo' }, { ...origem, contaCaixaId: 3 }])('resposta inválida %j não confirma origem', async response => {
    h.rpc.mockResolvedValue({ data: response, error: null }); await expect(caller().origem(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); noFinancialFallback();
  });
  it.each(['prospectivo', 'legado'])('trilho %s íntegro é retornado sem mutação ou cotação', async trilho => { h.rpc.mockResolvedValue({ data: { ...origem, trilho }, error: null }); expect(await caller().origem(input)).toEqual({ ...origem, trilho }); noFinancialFallback(); });
  it('status renovada é preservado para a UI não cobrar o principal transferido', async () => { h.rpc.mockResolvedValue({ data: { ...origem, status: 'renovada' }, error: null }); expect(await caller().origem(input)).toMatchObject({ status: 'renovada' }); noFinancialFallback(); });
});
