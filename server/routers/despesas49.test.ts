import { describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ rpc: vi.fn(), db: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: h.db }));
import { despesas49Router } from './despesas49';
import { edicao49Input, validarQuote49, validarRecibo49, validarRecovery49 } from '../../shared/despesas49';
const key = '10000000-0000-4000-8000-000000000001', operation = '20000000-0000-4000-8000-000000000001';
export const request = { despesaId: 10, origemOperationId: operation, estadoHash: 'a'.repeat(64), descricao: 'Despesa corrigida', categoria: 'outros' as const, dataVencimento: '2030-02-28', observacoes: '', motivo: 'Vencimento alterado' };
const input = { idempotencyKey: key, request };
const receipt = { contrato: 'despesas49_v1', success: true, acao: 'editarPendente', userId: 7, idempotencyKey: key, request, operationId: operation, despesaId: 10, sucessoraId: 11, sucessoraOperationId: key, valor: '9999999999999.99', statusOriginal: 'cancelado', statusSucessora: 'pendente', semMovimentoCaixa: true, instante: '2026-11-24T23:00:00.000Z' };
const context = (owner: number | null) => ({ user: owner ? { id: owner, role: 'user', name: 'offline' } : null, req: { headers: {} }, res: {} } as any);
describe('despesas49 router e contrato exato', () => {
  it('ctx.user.id determina owner; body e URL não escolhem tenant', async () => {
    h.rpc.mockReset(); h.db.mockResolvedValue({ rpc: h.rpc }); h.rpc.mockResolvedValue({ data: receipt, error: null });
    expect(await despesas49Router.createCaller(context(7)).editar(input)).toEqual(receipt);
    expect(h.rpc).toHaveBeenCalledWith('rpc_editar_despesa49', { p_user_id: 7, p_chave: key, p_request: request });
    await expect(despesas49Router.createCaller(context(7)).editar({ ...input, userId: 9 } as any)).rejects.toThrow();
    await expect(despesas49Router.createCaller(context(7)).editar({ ...input, request: { ...request, owner: 9 } } as any)).rejects.toThrow();
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it('não autenticado não chama fonte; quote derivada e recusada para outro owner', async () => {
    h.rpc.mockReset(); h.db.mockClear();
    await expect(despesas49Router.createCaller(context(null)).editar(input)).rejects.toThrow();expect(h.db).not.toHaveBeenCalled();
    const q = { contrato: 'despesas49_v1', userId: 7, despesaId: 10, origemOperationId: operation, original: { id: 10, user_id: 7, status: 'pendente', recorrente: false, frequencia: null, data_pagamento: null, conta_caixa_id: null }, estadoHash: 'a'.repeat(64), valor: '1.01', habilitado: true, semMovimentoCaixa: true, modo: 'sucessao20' };
    h.rpc.mockResolvedValue({ data: q, error: null });
    expect(await despesas49Router.createCaller(context(7)).cotar({ despesaId: 10 })).toEqual(q);
    expect(() => validarQuote49(q, 9, 10)).toThrow();expect(() => validarQuote49({ ...q, original: { ...q.original, data_pagamento: '2026-01-01' } }, 7, 10)).toThrow();
  });
  it('recibo integral owner/request/valor preciso obrigatório; falso sucesso não passa', () => {
    expect(validarRecibo49(receipt, 7, input).valor).toBe('9999999999999.99');
    for (const bad of [{ ...receipt, userId: 8 }, { ...receipt, success: false }, { ...receipt, request: { ...request, motivo: 'Outro' } }, { ...receipt, sucessoraId: 10 }, { ...receipt, valor: 9999999999999.99 }, { ...receipt, semMovimentoCaixa: false }]) expect(() => validarRecibo49(bad, 7, input)).toThrow();
  });
  it('recovery ausência só é terminal com fence e pedido/UUID exatos', () => {
    const r = { contrato: 'despesas49_v1', userId: 7, idempotencyKey: key, request, status: 'not_executed', result: null, fence: { fenceId: operation, instante: receipt.instante } };
    expect(validarRecovery49(r, 7, input).status).toBe('not_executed');
    for (const bad of [{ ...r, fence: null }, { ...r, status: 'unknown' }, { ...r, result: receipt }, { ...r, idempotencyKey: operation }, { ...r, request: { ...request, descricao: 'Divergente' } }]) expect(() => validarRecovery49(bad, 7, input)).toThrow();
    expect(validarRecovery49({ ...r, status: 'confirmed', result: receipt, fence: null }, 7, input).status).toBe('confirmed');
  });
  it('request fecha dinheiro, snapshots e datas UTC/Civil inválidas', () => {
    expect(edicao49Input.parse(input).request.dataVencimento).toBe('2030-02-28');
    for (const bad of [{ ...request, valor: '1.00' }, { ...request, antes: {} }, { ...request, dataVencimento: '2030-02-30' }, { ...request, dataVencimento: '2030-02-28T03:00:00Z' }]) expect(() => edicao49Input.parse({ ...input, request: bad })).toThrow();
  });
  it('erro/timeout nunca usa fallback e mantém resultado desconhecido', async () => {
    h.rpc.mockReset(); h.db.mockResolvedValue({ rpc: h.rpc });h.rpc.mockRejectedValue(new Error('Lost response'));
    await expect(despesas49Router.createCaller(context(7)).editar(input)).rejects.toThrow('Preserve UUID');expect(h.rpc).toHaveBeenCalledTimes(1);
    h.rpc.mockResolvedValue({ data: null, error: { code: '40001' } });await expect(despesas49Router.createCaller(context(7)).editar(input)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
