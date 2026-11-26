import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ data: {} as any, mutate: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('wouter', () => ({ useLocation: () => ['/emprestimos/462', vi.fn()], useParams: () => ({ id: '462' }) }));
vi.mock('@/lib/trpc', () => ({ trpc: {
  useUtils: () => ({}),
  caixa: { contas: { useQuery: () => ({ data: [] }) } },
  configuracoes: { get: { useQuery: () => ({ data: {} }) } },
  contratos: {
    obterDetalhes: { useQuery: () => ({ data: h.data, isPending: false, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }) },
    editarJuros: { useMutation: () => ({ mutate: h.mutate }) },
  },
  parcelas: new Proxy({}, { get: () => ({ useMutation: () => ({ mutate: h.mutate }) }) }),
} }));
// These tests render the actual details page and actual badges. Financial children
// are inert boundaries: this is SSR presentation coverage, NOT mounted auth/E2E.
vi.mock('@/components/DeleteEmprestimoDialog', () => ({ DeleteEmprestimoDialog: () => null }));
vi.mock('@/components/OperacoesObrigacao51', () => ({ OperacoesObrigacao51: () => null }));
vi.mock('@/components/RecebimentoValidado', () => ({ RecebimentoValidado: () => null }));
vi.mock('@/components/ManutencaoJuros48', () => ({ ManutencaoJuros48: () => null }));
vi.mock('@/components/ManutencaoCalendario', () => ({ ManutencaoCalendario: () => null }));
vi.mock('@/components/MultaManualOperacoes', () => ({ MultaManualAplicar: () => null }));
import EmprestimoDetalhes from './EmprestimoDetalhes';

beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('React', React);
  h.data = { id: 462, clienteId: 256, clienteNome: 'Cliente sintético', modalidade: 'mensal', status: 'cancelado',
    valorPrincipal: 10, valorJurosParcela: 0, totalReceber: 0, totalPago: 0, parcelasAbertas: 0,
    todasParcelas: [], parcelasComAtraso: [], numeroParcelas: 1, taxaJuros: 10, tipoTaxa: 'mensal', etiquetas: [] };
});
afterEach(() => vi.unstubAllGlobals());

describe('Ficha real renderizada: rótulos explícitos preservam os valores recebidos', () => {
  it.each([
    ['cancelado', 'CANCELADO'], ['renegociado', 'REPARCELADO'], ['quitado', 'QUITADO'],
    ['encerrado', 'ENCERRADO'], ['inadimplente', 'INADIMPLENTE'], ['estado_novo', 'STATUS NÃO RECONHECIDO'],
  ])('%s não é mostrado como Em dia no cabeçalho nem no texto de juros', (status, label) => {
    h.data.status = status;
    const before = JSON.stringify(h.data);
    const html = renderToStaticMarkup(React.createElement(EmprestimoDetalhes));
    expect(html).toContain(label);
    expect(html).not.toContain('EM DIA');
    expect(html).not.toContain('Em dia');
    expect(html).toContain('Restante a Receber');
    expect(JSON.stringify(h.data)).toBe(before);
    expect(h.mutate).not.toHaveBeenCalled();
  });
  it('estado ativo conserva o indicador Em dia, sem presumir quitação de saldo zero', () => {
    h.data.status = 'ativo';
    const html = renderToStaticMarkup(React.createElement(EmprestimoDetalhes));
    expect(html).toContain('EM DIA'); expect(html).not.toContain('QUITADO');
    expect(h.mutate).not.toHaveBeenCalled();
  });
  it('cancelado continua CANCELADO mesmo com dias de atraso antigos no DTO', () => {
    h.data.parcelasComAtraso = [{ diasAtraso: 10, jurosAtraso: 1, totalComAtraso: 11 }];
    const html = renderToStaticMarkup(React.createElement(EmprestimoDetalhes));
    expect(html).toContain('CANCELADO'); expect(html).not.toContain('>ATRASADO<');
    expect(h.mutate).not.toHaveBeenCalled();
  });
});
