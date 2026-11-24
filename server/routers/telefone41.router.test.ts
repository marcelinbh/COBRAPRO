import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntencaoTelefone41 } from '../../shared/telefone41';
import type { TrpcContext } from '../_core/context';

const mocks = vi.hoisted(() => ({ getSupabaseClientAsync: vi.fn(), rpc: vi.fn(), from: vi.fn(), getDb: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: mocks.getSupabaseClientAsync, getDb: mocks.getDb, resetDb: vi.fn() }));
import { appRouter } from '../routers';

const key = '9c5577be-ab41-41ca-b432-76a28fa33211';
const receber: IntencaoTelefone41 = { idempotencyKey: key, request: { acao: 'receber', vendaId: 44, parcelaId: 31, contaCaixaId: 901, valorPago: '0.01' } };
const criar: IntencaoTelefone41 = { idempotencyKey: key, request: {
  acao: 'criar', marca: 'Fixture', modelo: 'Telefone sintético', imei: null, cor: null, armazenamento: null,
  custo: '500.00', precoVenda: '700.00', entradaPercentual: '20.00', jurosMensal: '10.00', numParcelas: 3,
  dataPrimeiraParcela: '2027-01-31', contaCaixaId: 901, compradorNome: 'Fixture sem dados reais',
  compradorCpf: null, compradorRg: null, compradorTelefone: null, compradorEmail: null, compradorEstadoCivil: null,
  compradorProfissao: null, compradorInstagram: null, compradorCep: null, compradorCidade: null, compradorEstado: null,
  compradorEndereco: null, compradorLocalTrabalho: null,
} };
const cancelar: IntencaoTelefone41 = { idempotencyKey: key, request: { acao: 'cancelar', vendaId: 44, motivo: 'Fixture de compensação' } };
const routes = [
  { endpoint: 'criar', input: criar, rpc: 'rpc_executar_telefone41' },
  { endpoint: 'pagarParcela', input: receber, rpc: 'rpc_executar_telefone41' },
  { endpoint: 'deletar', input: cancelar, rpc: 'rpc_executar_telefone41' },
  { endpoint: 'reconciliar', input: receber, rpc: 'rpc_reconciliar_telefone41' },
  { endpoint: 'abandonar', input: receber, rpc: 'rpc_abandonar_telefone41' },
] as const;
function contexto(owner: number | null = 901): TrpcContext {
  return {
    user: owner === null ? null : { id: owner, openId: 'offline-fixture', role: 'user', name: 'Fixture', email: 'fixture@example.invalid', loginMethod: 'test', createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {} } as TrpcContext['req'], res: {} as TrpcContext['res'],
  };
}
function proof(input: IntencaoTelefone41, owner = 901) {
  return { success: true, repetida: false, userId: owner, idempotencyKey: key, acao: input.request.acao,
    vendaId: 44, parcelasIds: input.request.acao === 'criar' ? [31, 32, 33] : [], transacoesIds: [123],
    status: input.request.acao === 'cancelar' ? 'cancelado' : input.request.acao === 'receber' ? 'quitado' : 'ativo' };
}

describe('telefone41 integrado: caller autenticado e somente RPC transacional', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.from.mockImplementation(() => { throw new Error('REST proibido'); });
    mocks.getSupabaseClientAsync.mockResolvedValue({ rpc: mocks.rpc, from: mocks.from });
  });
  it.each(routes)('$endpoint deriva owner exclusivamente da sessão e chama exatamente uma RPC específica', async ({ endpoint, input, rpc }) => {
    const data = endpoint === 'reconciliar' ? { status: 'confirmed', result: proof(input, 902) }
      : endpoint === 'abandonar' ? { status: 'not_executed', result: null, userId: 902, idempotencyKey: key } : proof(input, 902);
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(appRouter.createCaller(contexto(902)).vendasTelefone[endpoint](input)).resolves.toBeDefined();
    expect(mocks.getSupabaseClientAsync).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(rpc, { p_user_id: 902, p_chave: key, p_request: input.request });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each(routes)('$endpoint recusa owner externo no envelope ou request antes de acessar cliente', async ({ endpoint, input }) => {
    const caller = appRouter.createCaller(contexto()).vendasTelefone;
    await expect(caller[endpoint]({ ...input, userId: 902 } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller[endpoint]({ ...input, request: { ...input.request, userId: 902 } } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(routes)('$endpoint recusa sessão anônima sem RPC nem REST', async ({ endpoint, input }) => {
    await expect(appRouter.createCaller(contexto(null)).vendasTelefone[endpoint](input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('não aceita ação de outro writer no endpoint', async () => {
    const caller = appRouter.createCaller(contexto()).vendasTelefone;
    await expect(caller.criar(receber)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.pagarParcela(cancelar)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.deletar(criar)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.getSupabaseClientAsync).not.toHaveBeenCalled();
  });
  it('timeout não faz retry ou fallback REST e mantém a intenção original', async () => {
    const before = JSON.stringify(receber);
    mocks.rpc.mockRejectedValue(new Error('timeout'));
    await expect(appRouter.createCaller(contexto()).vendasTelefone.pagarParcela(receber)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(JSON.stringify(receber)).toBe(before);
  });
});
