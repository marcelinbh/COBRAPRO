import { describe, expect, it } from 'vitest';
import { contratoReparcelamentoDaBusca, rotaReparcelamentoAtual } from './legacyFinanceNavigation';

describe('legacy-ui: navegação é somente pré-seleção de contrato', () => {
  it('leva o contrato exato para47 sem taxa, saldo, owner, conta ou UUID', () => {
    expect(rotaReparcelamentoAtual(31)).toBe('/reparcelamento?contratoId=31');
    expect(contratoReparcelamentoDaBusca('?contratoId=31')).toBe(31);
    expect(contratoReparcelamentoDaBusca('contratoId=31')).toBe(31);
    // Dados de URL não podem fornecer os argumentos financeiros do writer.
    expect(contratoReparcelamentoDaBusca('?contratoId=31&owner=999&taxa=0')).toBe(31);
  });
  it.each(['', '?contratoId=', '?contratoId=0', '?contratoId=-1', '?contratoId=1.5', '?contratoId=1e2', '?contratoId=01', '?contratoId=31&contratoId=32', '?contratoId=2147483648', '?contratoId=Infinity', '?contratoId=31abc'])('não pré-seleciona ID ambíguo: %s', search => {
    expect(contratoReparcelamentoDaBusca(search)).toBeUndefined();
  });
  it.each([0, -1, NaN, Infinity, 1.5, 2147483648])('não monta rota inválida: %s', id => {
    expect(() => rotaReparcelamentoAtual(id)).toThrow();
  });
});
