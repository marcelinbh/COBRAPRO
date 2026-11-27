import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapearSnapshot60, type Snapshot60 } from './snapshot60-reader';
import { apresentarEmprestimo } from './emprestimosApresentacao';

// Cópia literal de results-whole03/whole-list.json do PostgreSQL privado do pai.
const fixture = (): Snapshot60 => JSON.parse(readFileSync(new URL('./fixtures/snapshot60-whole03.json', import.meta.url), 'utf8'));

describe('Contrato SQL privado whole03 → parser60 → DTO público existente', () => {
  it('preserva todos os 15 IDs incluindo a recusa local; valida contrato com 512 parcelas', () => {
    const raw = fixture(), before = JSON.stringify(raw), result = mapearSnapshot60(raw, raw.userId);
    expect(result.items.map(item => item.id)).toEqual(raw.items.map(item => item.id));
    expect(result.coverage).toMatchObject({ scopedContracts: 15, validatedContracts: 14, unavailableContracts: 1, complete: false });
    expect(raw.items.find(item => item.id === 956)).toMatchObject({ kind: 'validated' });
    const long = raw.items.find(item => item.id === 956);
    expect(long?.kind === 'validated' ? long.parcelas.length : 0).toBe(512);
    expect(result.items.find(item => item.id === 956)).toMatchObject({ kind: 'validated', capital: 512, totalReceber: 512 });
    expect(result.items.find(item => item.id === 958)).toEqual({ kind: 'unavailable', id: 958, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.' });
    expect(result.warning).toContain('não representam toda a carteira');
    expect(JSON.stringify(raw)).toBe(before);
  });

  it('apresentação SQL de cada validado preserva capital nominal, recebimento real, adicional e arquivo', () => {
    const raw = fixture(), result = mapearSnapshot60(raw, raw.userId);
    for (const item of raw.items) {
      if (item.kind !== 'validated') continue;
      // whole03 não contém multa36; a fixture de multa36 tem testes próprios.
      expect(item.cotacoes36).toBeNull();
      const shown = apresentarEmprestimo(item.contrato, [...item.parcelas].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento) || a.id - b.id), raw.dataCalculo, 0, 0, null, item.estado51);
      expect(result.items.find(row => row.id === item.id)).toMatchObject({
        kind: 'validated', clienteId: item.cliente.id, clienteNome: item.cliente.nome,
        capital: Number(item.contrato.valor_principal), totalReceber: shown.totalReceber, totalPago: shown.totalPago,
        obrigacaoAtual: shown.obrigacaoAtual, obrigacaoAdicional: item.estado51.obrigacaoAdicional,
        statusObrigacao: item.estado51.statusObrigacao, arquivado: item.estado51.arquivado,
      });
    }
  });

  it('snapshot SQL de outra sessão não é mostrado nem parcialmente aceito', () => {
    expect(() => mapearSnapshot60(fixture(), 99)).toThrow();
  });
});
