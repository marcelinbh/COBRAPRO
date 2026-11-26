import { describe, expect, it } from 'vitest';
import { badgeContrato, badgeParcela } from './statusEmprestimoBadge';
describe('Rótulo público de encerramento51, sem quitação fabricada', () => {
  it('tem badge explícito suportado e não é quitado por saldo zero', () => {
    expect(badgeContrato('encerrado_por_cancelamento', true)).toEqual({ label: 'ENCERRADO POR CANCELAMENTO', variant: 'secondary' });
    expect(badgeParcela('cancelada')).toEqual({ label: 'Cancelada', variant: 'secondary' });
    expect(badgeParcela('paga')).toEqual({ label: 'Paga', variant: 'default' });
  });
});
