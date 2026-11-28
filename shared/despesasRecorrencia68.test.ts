import { describe, expect, it } from 'vitest';
import { dataOcorrencia68, input68, callbackBody68, validarProof68, validarList68 } from './despesasRecorrencia68';
const key = '10000000-0000-4000-8000-000000000001';
const serie = '20000000-0000-4000-8000-000000000001';
export const request = { action: 'criar' as const, template: { descricao: 'Aluguel', categoria: 'aluguel' as const, valor: '100.01', observacoes: '' }, frequencia: 'mensal' as const, ancora: '2030-01-31', termino: null };
const input = { idempotencyKey: key, request };
const proof = { contrato: 'despesas68_v1', userId: 7, idempotencyKey: key, request, status: 'confirmed', serieId: serie, revision: 1, effectiveOrdinal: 0, fenceId: key, instante: '2026-11-27T12:00:00Z' };
describe('68 calendário e contrato exato', () => {
  it.each([['2030-01-31', 'mensal', 1, '2030-02-28'], ['2030-01-31', 'mensal', 2, '2030-03-31'], ['2028-01-31', 'mensal', 1, '2028-02-29'], ['2028-02-29', 'anual', 1, '2029-02-28'], ['2028-02-29', 'anual', 4, '2032-02-29'], ['2030-12-31', 'semanal', 1, '2031-01-07'], ['2030-12-31', 'quinzenal', 1, '2031-01-15'], ['0001-01-31', 'mensal', 1, '0001-02-28']] as const)('âncora %s/%s/%s → %s', (a, f, n, expected) => expect(dataOcorrencia68(a, f, n)).toBe(expected));
  it('rejeita data inexistente,0000,overflow e ordinal não inteiro', () => {
    for (const a of ['0000-01-01', '2030-02-30', '2030-01-31T00:00:00Z']) expect(() => dataOcorrencia68(a, 'mensal', 0)).toThrow();
    expect(() => dataOcorrencia68('9999-12-31', 'mensal', 1)).toThrow();expect(() => dataOcorrencia68('2030-01-31', 'mensal', 0.5)).toThrow();
  });
  it('input não aceita owner, caixa, UUID filha ou frequência no alterar', () => {
    expect(input68.parse(input)).toEqual(input);
    for (const extra of [{ userId: 8 }, { user_id: 8 }, { childUuid: key }, { contaCaixaId: 1 }]) expect(() => input68.parse({ ...input, request: { ...request, ...extra } })).toThrow();
    expect(() => input68.parse({ idempotencyKey: key, request: { action: 'alterar', serieId: serie, expectedRevision: 1, effectiveOrdinal: 2, template: request.template, ancora: '2031-01-01' } })).toThrow();
    for (const body of [{ dryRun: true }, { userId: 7 }, { taskUid: 'cron' }, { valor: '1.00' }, []]) expect(callbackBody68.safeParse(body).success).toBe(false);
  });
  it('confirma apenas owner/UUID/pedido exatos e fence terminal consistente', () => {
    expect(validarProof68(proof, 7, input).status).toBe('confirmed');
    for (const bad of [{ ...proof, userId: 8 }, { ...proof, idempotencyKey: serie }, { ...proof, request: { ...request, template: { ...request.template, valor: '100.02' } } }, { ...proof, revision: null }, { ...proof, fenceId: null }]) expect(() => validarProof68(bad, 7, input)).toThrow();
    const fence = { ...proof, status: 'not_executed', serieId: null, revision: null, effectiveOrdinal: null };
    expect(validarProof68(fence, 7, input).status).toBe('not_executed');expect(() => validarProof68({ ...fence, serieId: serie }, 7, input)).toThrow();
  });
  it('UNKNOWN não inclui valor zero, detalhes internos nem owner alheio', () => {
    const list = { contrato: 'despesas68_v1', userId: 7, hoje: '2026-11-27', agenda: { vinculada: false, ativa: false, path: '/api/scheduled/despesas-recorrentes', method: 'POST', ultimaExecucao: null, resultado: 'aguardando', geradas: null, falhas: null }, series: [], ocorrencias: [{ serieId: serie, ordinal: 0, competencia: '2030-01-31', rootId: 1, currentId: null, status: 'UNKNOWN' }], hasMore: false };
    expect(validarList68(list, 7).ocorrencias[0]).not.toHaveProperty('valor');
    expect(() => validarList68({ ...list, userId: 8 }, 7)).toThrow();
    expect(() => validarList68({ ...list, ocorrencias: [{ ...list.ocorrencias[0], valor: '0.00' }] }, 7)).toThrow();
  });
});
