import { describe, expect, it, vi } from 'vitest';
import { compile, code, Hooks, ReactTree, source, text, treeNodes } from '../lib/r1BoundaryHarness';
import { noArquivo51, referenciaMonetaria51, statusContrato51, REFERENCIA51 } from '../lib/obrigacoes51Apresentacao';
import { badgeContrato } from '../lib/statusEmprestimoBadge';
import { AVISO_LISTA_INCOMPLETA, type ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';
import { rotaAcaoListaEmprestimo62 } from '../lib/acoesListaEmprestimo62';

const fixture = (): ListaSeguraEmprestimos => ({ version: 'loan_list_read_v1', userId: 41,
  items: [
    { kind: 'validated', id: 1, clienteId: 11, clienteNome: 'Ana', modalidade: 'mensal', status: 'ativo', statusFinanceiroOriginal: 'ativo', statusObrigacao: 'ativo', arquivado: false, obrigacaoAtual: '120.00', obrigacaoAdicional: '0.00', capital: 100, totalReceber: 120, totalPago: 0 },
    { kind: 'validated', id: 2, clienteId: 12, clienteNome: 'Bruno', modalidade: 'tabela_price', status: 'encerrado_por_cancelamento', statusFinanceiroOriginal: 'ativo', statusObrigacao: 'encerrado_por_cancelamento', arquivado: true, obrigacaoAtual: '0.00', obrigacaoAdicional: '20.00', capital: 100, totalReceber: 0, totalPago: 20 },
    { kind: 'unavailable', id: 42, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.' },
  ], coverage: { scopedContracts: 3, validatedContracts: 2, unavailableContracts: 1, complete: false, label: 'validados somente' },
  totals: { label: 'validados somente', values: { capital: 200, totalReceber: 120, totalPago: 20 } }, warning: AVISO_LISTA_INCOMPLETA,
});
function renderer() {
  const hooks = new Hooks(), ast = source('components/EmprestimosListaSegura.tsx');
  const component = compile(code(ast, 'EmprestimosListaSegura') + '\nreturn EmprestimosListaSegura;', {
    ...hooks.bindings(), noArquivo51, referenciaMonetaria51, statusContrato51, REFERENCIA51, badgeContrato,
    moeda: (value: number) => `R$ ${value.toFixed(2)}`,
    rotaAcaoListaEmprestimo62,
  });
  return (data: ListaSeguraEmprestimos, onRefresh = () => {}) => hooks.render(component, { data, onRefresh });
}
function button(tree: any, label: string) {
  const found = treeNodes(tree, node => node.type === 'button' && text(node) === label)[0];
  expect(found, label).toBeDefined(); return found;
}
function select(tree: any, label: string) {
  const parent = treeNodes(tree, node => node.type === 'label' && text(node).startsWith(label))[0];
  return treeNodes(parent, node => node.type === 'select')[0];
}
function fallbackHarness() {
  let auth: any = { data: { id: 41 }, isFetching: false, isError: false, isLoading: false, isPending: false, refetch: vi.fn() };
  let safe: any = { data: fixture(), isFetching: false, isError: false, isLoading: false, isPending: false, refetch: vi.fn() };
  const authQuery = vi.fn(() => auth), listQuery = vi.fn(() => safe);
  const ast = source('components/EmprestimosListaSeguraFallback.tsx');
  const bindings = { React: ReactTree, trpc: { auth: { me: { useQuery: authQuery } }, contratos: { listLeituraSegura: { useQuery: listQuery } } }, EmprestimosListaSegura: 'EmprestimosListaSegura' };
  const parent = compile(code(ast, 'ConsultaListaSegura') + '\n' + code(ast, 'EmprestimosListaSeguraFallback') + '\nreturn EmprestimosListaSeguraFallback;', bindings);
  return {
    authQuery, listQuery, auth: (next: any) => { auth = { ...auth, ...next }; }, safe: (next: any) => { safe = { ...safe, ...next }; },
    parent: () => parent(), child: (node: any) => node.type(node.props),
  };
}

describe('Lista60: interação real confinada à apresentação e à query existente', () => {
  it('busca/modalidade/estado/arquivo preservam placeholders, coverage, totais e input imutável', () => {
    const data = fixture(), before = JSON.stringify(data), render = renderer();
    let tree = render(data);
    expect(text(tree)).toContain('Ana'); expect(text(tree)).not.toContain('Bruno');
    button(tree, 'Histórico').props.onClick(); tree = render(data);
    expect(text(tree)).not.toContain('Ana'); expect(text(tree)).toContain('Bruno');
    expect(treeNodes(tree, node => node.props?.href === '/emprestimos/2')).toHaveLength(1);
    button(tree, 'Todos').props.onClick(); tree = render(data);
    treeNodes(tree, node => node.type === 'input' && node.props.type === 'search')[0].props.onChange({ target: { value: ' aNA ' } }); tree = render(data);
    expect(text(tree)).toContain('Ana'); expect(text(tree)).not.toContain('Bruno');
    select(tree, 'Modalidade').props.onChange({ target: { value: 'tabela_price' } }); tree = render(data);
    expect(text(tree)).not.toContain('Ana'); expect(text(tree)).not.toContain('Bruno');
    button(tree, 'Limpar filtros').props.onClick(); tree = render(data);
    button(tree, 'Todos').props.onClick(); tree = render(data);
    select(tree, 'Estado da obrigação').props.onChange({ target: { value: 'encerrado_por_cancelamento' } }); tree = render(data);
    expect(text(tree)).toContain('Bruno'); expect(text(tree)).not.toContain('Ana');
    expect(text(tree)).toContain('3 no escopo; 2 validados; 1 indisponíveis');
    expect(text(tree)).toContain('Capital (validados somente): R$ 200.00');
    expect(text(tree)).toContain('A receber (validados somente): R$ 120.00');
    const unavailable = treeNodes(tree, node => node.props?.['aria-label'] === 'Empréstimo 42 indisponível')[0];
    expect(unavailable).toBeDefined(); expect(treeNodes(unavailable, node => !!node.props?.href || !!node.props?.onClick)).toHaveLength(0);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('atualização real chama apenas onRefresh; Novo permanece no wrapper e ficha só em validado', () => {
    const refresh = vi.fn(), render = renderer(), tree = render(fixture(), refresh);
    button(tree, 'Atualizar consulta segura').props.onClick(); expect(refresh).toHaveBeenCalledTimes(1);
    expect(treeNodes(tree, node => node.props?.href === '/emprestimos/1')).toHaveLength(1);
    expect(treeNodes(tree, node => node.props?.href === '/emprestimos/42')).toHaveLength(0);
    const harness = fallbackHarness(), parent = harness.parent(), child = harness.child(parent);
    expect(treeNodes(child, node => node.props?.href === '/contratos/novo')).toHaveLength(1);
    expect(text(child)).not.toContain('leitura completa');
  });

  it('auth unsettled desmonta o filho da lista; novo owner tem key nova e recusa resposta anterior', () => {
    const harness = fallbackHarness();
    const owner41 = harness.parent(); expect(owner41.key).toBe(41);
    let child = harness.child(owner41);
    expect(treeNodes(child, node => node.type === 'EmprestimosListaSegura')).toHaveLength(1);
    expect(harness.listQuery).toHaveBeenCalledTimes(1);
    for (const flags of [{ isFetching: true }, { isLoading: true }, { isPending: true }, { isError: true }, { data: null }]) {
      harness.auth({ data: { id: 41 }, isFetching: false, isLoading: false, isPending: false, isError: false, ...flags });
      const unsettled = harness.parent();
      expect(typeof unsettled.type).toBe('string'); // Não retorna o filho, logo React o desmonta.
      expect(treeNodes(unsettled, node => node.type === owner41.type)).toHaveLength(0);
      expect(treeNodes(unsettled, node => node.props?.href === '/contratos/novo')).toHaveLength(1);
    }
    expect(harness.listQuery).toHaveBeenCalledTimes(1);
    harness.auth({ data: { id: 99 }, isFetching: false, isLoading: false, isPending: false, isError: false });
    const owner99 = harness.parent(); expect(owner99.key).toBe(99); expect(owner99.key).not.toBe(owner41.key);
    child = harness.child(owner99);
    expect(treeNodes(child, node => node.type === 'EmprestimosListaSegura')).toHaveLength(0);
    expect(text(child)).toContain('indisponível para a sessão confirmada');
    expect(harness.listQuery).toHaveBeenLastCalledWith(undefined, { enabled: true, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always' });
    harness.safe({ data: { ...fixture(), userId: 99 } }); child = harness.child(owner99);
    expect(treeNodes(child, node => node.type === 'EmprestimosListaSegura')).toHaveLength(1);
  });

  it.each([{ isFetching: true }, { isPending: true }, { isLoading: true }, { isError: true }, { data: undefined }])('safe %j oculta o DTO antigo e mantém Novo', flags => {
    const harness = fallbackHarness(); harness.safe(flags);
    const child = harness.child(harness.parent());
    expect(treeNodes(child, node => node.type === 'EmprestimosListaSegura')).toHaveLength(0);
    expect(treeNodes(child, node => node.props?.href === '/contratos/novo')).toHaveLength(1);
  });
});
