import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ db: vi.fn(), rpc: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: h.db }));
import { emprestimosMultimodalRouter } from './emprestimosMultimodal';
const caller = (user: any = { id: 41 }) => emprestimosMultimodalRouter.createCaller({ user, req: {}, res: {} } as any);
const capability = { disponivel: true, regra: 'multimodal_v1', modalidades: ['mensal', 'semanal', 'quinzenal', 'diario', 'tabela_price'], recebimento: true, renovacao: true };
const create: any = { idempotencyKey: '10000000-0000-4000-8000-000000000001', clienteId: 2, contaCaixaId: 3, modalidade: 'semanal', tipoTaxa: 'semanal', valorPrincipal: '100.00', taxaJuros: '10.00', numeroParcelas: 2, dataInicio: '2026-11-16', dataDesembolso: '2026-11-16', vencimentos: ['2026-11-23', '2026-11-30'], multaAtraso: '2.0000', jurosMoraDiario: '0.0330' };
beforeEach(() => { vi.clearAllMocks(); h.db.mockResolvedValue({ rpc: h.rpc }); h.rpc.mockResolvedValue({ data: capability, error: null }); });
describe('router multimodal — capacidade real e tenant autenticado', () => {
  it.each(['disponibilidade', 'contasParaCadastro'] as const)('consulta %s sem sessão não chega ao banco', async name => { await expect(caller(null)[name]()).rejects.toMatchObject({ code: 'UNAUTHORIZED' }); expect(h.db).not.toHaveBeenCalled(); });
  it('capacidade vem somente da função instalada e aceita catálogo completo único', async () => { expect(await caller().disponibilidade()).toEqual(capability); expect(h.rpc).toHaveBeenCalledOnce(); expect(h.rpc).toHaveBeenCalledWith('rpc_capacidades_emprestimos_multimodal'); });
  it.each(['PGRST202', '42883'])('ausência %s não simula disponibilidade nem executa fallback', async code => { h.rpc.mockResolvedValue({ data: null, error: { code } }); expect(await caller().disponibilidade()).toMatchObject({ disponivel: false, modalidades: [], recebimento: false, renovacao: false }); expect(h.rpc).toHaveBeenCalledOnce(); });
  it.each([null, {}, { ...capability, disponivel: false }, { ...capability, modalidades: ['mensal','mensal','mensal','mensal','mensal'] }, { ...capability, modalidades: ['mensal'] }, { ...capability, recebimento: false }, { ...capability, renovacao: false }, { ...capability, regra: 'mensal_simples_v1' }, { ...capability, campo: 'extra' }])('capacidade inválida %j é recusada', async data => { h.rpc.mockResolvedValue({ data, error: null }); await expect(caller().disponibilidade()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); });
  it('falha do transporte e banco ausente não são ausência de capacidade', async () => {
    h.rpc.mockRejectedValue(new Error('timeout')); await expect(caller().disponibilidade()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    h.db.mockResolvedValue(null); await expect(caller().disponibilidade()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
  it('validação pura usa schema estrito e não reserva nem consulta saldo', async () => {
    expect(await caller().validarCriacao(create)).toMatchObject({ validada: true, calculo: { totalContrato: '120.00', jurosTotal: '20.00' } }); expect(h.db).not.toHaveBeenCalled();
    await expect(caller().validarCriacao({ ...create, userId: 99 })).rejects.toMatchObject({ code: 'BAD_REQUEST' }); expect(h.db).not.toHaveBeenCalled();
  });
  it('não autenticado não cria ou confirma intenção', async () => { await expect(caller(null).criar(create)).rejects.toMatchObject({ code: 'UNAUTHORIZED' }); expect(h.db).not.toHaveBeenCalled(); });
  it('comando único usa tenant da sessão e não credita cliente de outro tenant em fallback', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(caller().criar(create)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(h.rpc).toHaveBeenCalledOnce(); expect(h.rpc.mock.calls[0][0]).toBe('rpc_criar_emprestimo_multimodal');
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_user_id: 41, p_cliente_id: 2, p_conta_caixa_id: 3, p_chave_idempotencia: create.idempotencyKey, p_modalidade: 'semanal' });
  });
  it.each(['criar', 'cotar', 'receber', 'cotarRenovacao', 'renovar'] as const)('schema inválido em %s falha antes do banco', async name => { await expect((caller()[name] as any)({ userId: 99 })).rejects.toMatchObject({ code: 'BAD_REQUEST' }); expect(h.db).not.toHaveBeenCalled(); });
  it('reconciliação não aceita família do ciclo anterior nem chama seu protocolo', async () => {
    await expect(caller().reconciliar({ family: 'emprestimo_criar', idempotencyKey: create.idempotencyKey, payload: {} })).rejects.toMatchObject({ code: 'BAD_REQUEST' }); expect(h.db).not.toHaveBeenCalled();
  });
  it.each(['multimodal_criar', 'multimodal_receber', 'multimodal_renovar'] as const)('reconciliação %s confere empresa, chave e payload exatos', async family => {
    const { idempotencyKey, ...criacaoPayload } = create;
    const recebimentoBase = { contratoId: 2, parcelaId: 3, valorRecebido: '100.00', totalExigido: '100.00', dataPagamento: '2026-11-16', estadoHash: 'a'.repeat(64) };
    const payload = family === 'multimodal_criar' ? criacaoPayload : family === 'multimodal_receber' ? { ...recebimentoBase, modo: 'integral' } : { ...recebimentoBase, novoVencimento: '2026-12-16' };
    const request = { family, idempotencyKey, payload };
    h.rpc.mockResolvedValue({ data: { userId: 41, ...request, payloadHash: 'a'.repeat(64), proof: 'uuid_fenced_v1', status: 'not_executed', fenceId: '20000000-0000-4000-8000-000000000001', result: null, quote: null }, error: null });
    expect(await caller().reconciliar(request)).toMatchObject({ status: 'not_executed', userId: 41, family });
    expect(h.rpc).toHaveBeenCalledOnce(); expect(h.rpc).toHaveBeenCalledWith('rpc_reconciliar_multimodal', { p_user_id: 41, p_family: family, p_chave: create.idempotencyKey, p_request: payload });
    h.rpc.mockResolvedValue({ data: { userId: 99, ...request, payloadHash: 'a'.repeat(64), proof: 'uuid_fenced_v1', status: 'not_executed', fenceId: '20000000-0000-4000-8000-000000000001', result: null, quote: null }, error: null });
    await expect(caller().reconciliar(request)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
});
