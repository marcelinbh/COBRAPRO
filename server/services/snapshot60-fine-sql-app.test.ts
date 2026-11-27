import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapearSnapshot60, type Snapshot60 } from './snapshot60-reader';
import { apresentarEmprestimo } from './emprestimosApresentacao';
import { normalizarCotacaoMulta } from '../../shared/multaManual';

const fixture = (): Snapshot60 => JSON.parse(readFileSync(new URL('./fixtures/snapshot60-final05.json', import.meta.url), 'utf8'));
describe('SQL60 genuíno35→multa36→pagamento parcial→APP', () => {
  it('valida a lista integral e apresenta cotação36 sem fórmula substituta nem soma duplicada', () => {
    const raw = fixture(), result = mapearSnapshot60(raw, raw.userId);
    expect(result.items.map(i => i.id)).toEqual(raw.items.map(i => i.id));
    const fine = raw.items.find(i => i.kind === 'validated' && i.cotacoes36 !== null);
    expect(fine?.kind).toBe('validated');
    if (!fine || fine.kind !== 'validated' || !fine.cotacoes36) throw new Error('fixture genuína36 ausente');
    const quotes = new Map(fine.cotacoes36.map((q: any) => [q.parcelaId, normalizarCotacaoMulta(q, { contratoId: fine.id, parcelaId: q.parcelaId })]));
    expect(quotes.size).toBe(2);
    expect(fine.parcelas[0].status).toBe('parcial');
    const shown = apresentarEmprestimo(fine.contrato, fine.parcelas, raw.dataCalculo, 0, 0, quotes, fine.estado51);
    expect(result.items.find(i => i.id === fine.id)).toMatchObject({ kind: 'validated', totalReceber: shown.totalReceber, totalPago: 1, capital: 100 });
    expect(result.coverage.scopedContracts).toBe(16);
  });
  it('recusa mistura de cotação36 com dia ou proprietário diferentes', () => {
    const raw = fixture();
    const fine = raw.items.find(i => i.kind === 'validated' && i.cotacoes36 !== null);
    if (!fine || fine.kind !== 'validated' || !fine.cotacoes36) throw new Error('fixture genuína36 ausente');
    (fine.cotacoes36[0] as any).dataPagamento = '2026-11-01';
    expect(() => mapearSnapshot60(raw, raw.userId)).toThrow();
    expect(() => mapearSnapshot60(fixture(), 2)).toThrow();
  });
});
