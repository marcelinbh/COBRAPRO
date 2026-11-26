import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { badgeContrato, badgeParcela } from './statusEmprestimoBadge';

describe('Rótulos de empréstimos: status explícito sem autoridade financeira', () => {
  it.each([
    ['cancelado', 'CANCELADO'], ['cancelada', 'CANCELADO'],
    ['renegociado', 'REPARCELADO'], ['quitado', 'QUITADO'],
    ['encerrado', 'ENCERRADO'], ['inadimplente', 'INADIMPLENTE'],
    ['atrasado', 'ATRASADO'],
  ])('%s não vira EM DIA com atraso ausente nem muda com atraso antigo', (status, label) => {
    for (const atraso of [false, true]) expect(badgeContrato(status, atraso).label).toBe(label);
  });
  it('somente ativo utiliza o indicador de atraso', () => {
    expect(badgeContrato('ativo', false)).toEqual({ label: 'EM DIA', variant: 'default' });
    expect(badgeContrato('ativo', true)).toEqual({ label: 'ATRASADO', variant: 'destructive' });
  });
  it.each([null, undefined, ''])('status ausente %j não é obrigação ativa nem pagamento', status => {
    expect(badgeContrato(status)).toEqual({ label: 'SEM STATUS', variant: 'secondary' });
    expect(badgeParcela(status)).toEqual({ label: 'Sem status', variant: 'secondary' });
  });
  it.each(['estado_novo', 'reparcelado', 'QUITADO', ' quitado ', '__proto__', 0, {}])('status não suportado %j permanece neutro', status => {
    expect(badgeContrato(status, true)).toEqual({ label: 'STATUS NÃO RECONHECIDO', variant: 'secondary' });
    expect(badgeParcela(status)).toEqual({ label: 'Status não reconhecido', variant: 'secondary' });
  });
  it.each([
    ['cancelada', 'Cancelada'], ['cancelado', 'Cancelada'],
    ['paga', 'Paga'], ['pago', 'Paga'], ['parcial', 'Parcial'],
    ['renovada', 'Renovada: principal transferido'], ['pendente', 'Pendente'],
    ['atrasada', 'Atrasada'], ['atrasado', 'Atrasada'], ['vencendo_hoje', 'Vence hoje'],
  ])('parcela %s recebe rótulo exato, não fallback Pendente', (status, label) => {
    expect(badgeParcela(status).label).toBe(label);
  });
  it('origem renegociada identifica apenas parcelas canceladas como reparceladas', () => {
    expect(badgeParcela('cancelada', 'renegociado').label).toBe('Reparcelada');
    expect(badgeParcela('paga', 'renegociado').label).toBe('Paga');
    expect(badgeParcela('renovada', 'renegociado').label).toBe('Renovada: principal transferido');
    // O DTO atual do writer47 usa cancelado; sem marcador não inferir sua causa.
    expect(badgeParcela('cancelada', 'cancelado').label).toBe('Cancelada');
  });
  it('o caso cancelado com restante zero é rótulo, não mutação nem quitação presumida', () => {
    const dto = Object.freeze({ id: 462, status: 'cancelado', totalReceber: 0, parcelasAbertas: 0 });
    const before = JSON.stringify(dto);
    expect(badgeContrato(dto.status).label).toBe('CANCELADO');
    expect(badgeContrato('ativo').label).toBe('EM DIA');
    expect(JSON.stringify(dto)).toBe(before);
  });
});

describe('Uso dos rótulos na fonte real de apresentação (não teste React montado)', () => {
  const details = readFileSync(new URL('../pages/EmprestimoDetalhes.tsx', import.meta.url), 'utf8');
  const list = readFileSync(new URL('../pages/Emprestimos.tsx', import.meta.url), 'utf8');
  it('cabeçalho e card usam o helper de status explícito', () => {
    expect(details).toContain('badgeContrato(emprestimo.status, isAtrasado)');
    expect(details).toContain('<Badge variant={statusBadge.variant}>');
    expect(list).toContain('badgeContrato(emp.status, diasAtraso > 0)');
    expect(list).toContain('{statusBadge.label}');
  });
  it('a tabela ativa usa o rótulo explícito de parcela; o modal antigo foi removido', () => {
    expect(details.match(/\{badgeParcela\(p.status, emprestimo.status\)\.label\}/g)).toHaveLength(1);
    expect(details).not.toContain("{p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : 'Pendente'}");
  });
  it('o texto secundário de juros não apresenta cancelado como Em dia', () => {
    expect(details).toContain("emprestimo.status !== 'ativo' ? statusBadge.label : isAtrasado ? `${diasAtraso} dias de atraso` : 'Em dia'");
  });
});
