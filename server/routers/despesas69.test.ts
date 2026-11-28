import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ rpc: vi.fn(), db: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: h.db }));
import { despesas69Router } from './despesas69';
import { edicao69Input, temDelta69, validarQuote69, validarRecibo69, validarRecovery69 } from '../../shared/despesas69';
const key = '10000000-0000-4000-8000-000000000001', operation = '20000000-0000-4000-8000-000000000001';
const request = { despesaId: 10, origemOperationId: operation, estadoHash: 'a'.repeat(64), descricao: 'Original', categoria: 'outros' as const, dataVencimento: '2030-02-28', observacoes: '', motivo: 'Corrigir valor', valor: '9999999999999.99' };
const input = { idempotencyKey: key, request };
const receipt = { contrato: 'despesas69_v1', success: true, acao: 'editarPendenteComValor', userId: 7, idempotencyKey: key, request, operationId: operation, despesaId: 10, raizId: 10, sucessoraId: 11, sucessoraOperationId: key, valorAnterior: '1.01', valorNovo: request.valor, statusOriginal: 'cancelado', statusSucessora: 'pendente', semMovimentoCaixa: true, somenteEstaOcorrencia: true, instante: '2026-11-24T23:00:00.000Z' };
const quote = { contrato: 'despesas69_v1', habilitado: true, somenteEstaOcorrencia: true, quote49: { contrato: 'despesas49_v1', userId: 7, despesaId: 10, origemOperationId: operation, original: { id: 10, user_id: 7, descricao: request.descricao, categoria: request.categoria, data_vencimento: request.dataVencimento, observacoes: null, valor: 1.01, status: 'pendente', recorrente: false, frequencia: null, data_pagamento: null, conta_caixa_id: null }, estadoHash: request.estadoHash, valor: '1.01', habilitado: false, semMovimentoCaixa: true, modo: 'sucessao20' } };
const context = (owner: number | null, isCron = false) => ({ user: owner !== null ? { id: owner, role: 'user', isCron } : null, req: { headers: {} }, res: {} } as any);
beforeEach(() => { vi.clearAllMocks(); h.db.mockResolvedValue({ rpc: h.rpc }); h.rpc.mockResolvedValue({ data: receipt, error: null }); });
describe('69 router/contrato novo, sem mudar49', () => {
  it('owner só ctx.user.id e única RPC transacional; schema público fecha spoof', async () => {
    expect(await despesas69Router.createCaller(context(7)).editar(input)).toEqual(receipt);
    expect(h.rpc).toHaveBeenCalledWith('rpc_editar_despesa69', { p_user_id: 7, p_chave: key, p_request: request });
    for (const bad of [{ ...input, userId: 9 }, { ...input, request: { ...request, owner: 9 } }, { ...input, request: { ...request, snapshot: {} } }]) await expect(despesas69Router.createCaller(context(7)).editar(bad as any)).rejects.toThrow();
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([null, -1, 0, 2147483648])('sessão/owner inválido %s não chama fonte', async owner => {
    await expect(despesas69Router.createCaller(context(owner)).editar(input)).rejects.toThrow(); expect(h.db).not.toHaveBeenCalled();
  });
  it('cron humano falso não chama fonte', async () => { await expect(despesas69Router.createCaller(context(7, true)).recuperar(input)).rejects.toThrow(); expect(h.db).not.toHaveBeenCalled(); });
  it('quote interna49 admite flag49 OFF e delta apenas valor; não altera49', () => {
    const q = validarQuote69(quote, 7, 10); expect(temDelta69(request, q)).toBe(true);
    expect(temDelta69({ ...request, valor: '1.01' }, q)).toBe(false);
    for (const bad of [{ ...quote, userId: 9 }, { ...quote, quote49: { ...quote.quote49, userId: 9 } }, { ...quote, quote49: { ...quote.quote49, valor: '2.00' } }]) expect(() => validarQuote69(bad, 7, 10)).toThrow();
  });
  it('dinheiro NUMERIC15,2 canônico, exato sem float/arredondar', () => {
    for (const valor of ['0.01', '9999999999999.99']) expect(edicao69Input.parse({ ...input, request: { ...request, valor } }).request.valor).toBe(valor);
    for (const valor of ['0.00', '1', '1.1', '1.001', '1e2', 'NaN', 'Infinity', '10000000000000.00', '01.00', 1.01]) expect(() => edicao69Input.parse({ ...input, request: { ...request, valor } })).toThrow();
  });
  it('recibo valorNovo exato/owner/UUID/request completo; falso sucesso não passa', () => {
    expect(validarRecibo69(receipt, 7, input).valorNovo).toBe(request.valor);
    for (const bad of [{ ...receipt, userId: 8 }, { ...receipt, valorNovo: '1.01' }, { ...receipt, valorAnterior: '0.00' }, { ...receipt, request: { ...request, motivo: 'Outro' } }, { ...receipt, sucessoraId: 10 }, { ...receipt, semMovimentoCaixa: false }]) expect(() => validarRecibo69(bad, 7, input)).toThrow();
  });
  it('recovery ausente exige fence terminal e confirmado exige recibo completo', () => {
    const r = { contrato: 'despesas69_v1', userId: 7, idempotencyKey: key, request, status: 'not_executed', result: null, fence: { fenceId: operation, instante: receipt.instante } };
    expect(validarRecovery69(r, 7, input).status).toBe('not_executed');
    for (const bad of [{ ...r, fence: null }, { ...r, status: 'unknown' }, { ...r, result: receipt }, { ...r, idempotencyKey: operation }, { ...r, request: { ...request, valor: '1.01' } }]) expect(() => validarRecovery69(bad, 7, input)).toThrow();
    expect(validarRecovery69({ ...r, status: 'confirmed', result: receipt, fence: null }, 7, input).status).toBe('confirmed');
  });
  it('timeout e erro SQL são sanitizados, sem PII/zero/fallback', async () => {
    h.rpc.mockRejectedValue(new Error('secret person contact')); await expect(despesas69Router.createCaller(context(7)).editar(input)).rejects.toThrow('Resultado desconhecido'); expect(h.rpc).toHaveBeenCalledTimes(1);
    h.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'PII secret' } }); await expect(despesas69Router.createCaller(context(7)).editar(input)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.not.stringContaining('secret') });
    h.db.mockResolvedValue(null); await expect(despesas69Router.createCaller(context(7)).recuperar(input)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});
