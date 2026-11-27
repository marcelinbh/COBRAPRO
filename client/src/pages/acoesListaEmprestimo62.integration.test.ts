// @vitest-environment node
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compile, code, declaration, Hooks, nodes, source, text, treeNodes } from '../lib/r1BoundaryHarness';
import * as presentation from '../lib/obrigacoes51Apresentacao';
import { badgeContrato, badgeParcela } from '../lib/statusEmprestimoBadge';
import { rotaReparcelamentoAtual } from '../lib/legacyFinanceNavigation';
import { HASHES_ACOES_LISTA62 } from '../lib/acoesListaEmprestimo62';
const runtime = vi.hoisted(() => ({ hooks: null as any }));
vi.mock('react', async original => ({
  ...await original<any>(),
  useRef: (value: any) => runtime.hooks.useRef(value),
  useEffect: (fn: any, deps: any[]) => runtime.hooks.useEffect(fn, deps),
}));
import { useAcoesListaEmprestimo62 } from '../lib/useAcoesListaEmprestimo62';
const ast = source('pages/EmprestimoDetalhes.tsx');
const settled = { isPending: false, isLoading: false, isError: false, isFetching: false };
const loan = (parcelas: any[] = []) => ({
  id: 31, clienteNome: 'Ficha confirmada', clienteWhatsapp: null, modalidade: 'mensal', status: 'ativo', statusObrigacao: 'ativo', arquivado: false,
  valorPrincipal: 100, totalReceber: 120, totalPago: 0, lucroPrevisto: 20, lucroRealizado: 0, valorJurosParcela: 20,
  parcelasAbertas: parcelas.length, parcelasComAtraso: [], todasParcelas: parcelas, obrigacaoAtual: '120.00', obrigacaoAdicional: '0.00',
  numeroParcelas: parcelas.length, taxaJuros: 20, tipoTaxa: 'mensal', dataVencimento: '2026-12-10', dataCriacao: '2026-11-10',
});
function mounted(parcelas: any[] = [], hash = '#receber-conferir') {
  const hooks = new Hooks(), navigate = vi.fn(), refetch = vi.fn(), invalidate = vi.fn();
  const financial = vi.fn(() => { throw Error('Atalho/montagem tentou financeiro'); });
  const boundary: any = new Proxy(financial, { get: () => boundary });
  let result: any = { ...settled, data: loan(parcelas), refetch }, id = '31';
  const query = vi.fn(() => result), config = vi.fn(() => ({ data: {} }));
  const location = { pathname: '/emprestimos/31', search: '', hash };
  const listeners = new Set<() => void>();
  const targets = Object.fromEntries(HASHES_ACOES_LISTA62.map(h => [h.slice(1), { focus: vi.fn(), scrollIntoView: vi.fn(), click: financial }]));
  const lookup = vi.fn((name: string) => targets[name] ?? null);
  vi.stubGlobal('window', { location, open: financial, addEventListener: (event: string, fn: () => void) => { expect(event).toBe('hashchange'); listeners.add(fn); }, removeEventListener: (event: string, fn: () => void) => { expect(event).toBe('hashchange'); listeners.delete(fn); } });
  vi.stubGlobal('document', { getElementById: lookup });
  for (const name of ['localStorage', 'sessionStorage', 'crypto', 'fetch', 'setTimeout', 'setInterval']) vi.stubGlobal(name, boundary);
  const bindings: any = {
    ...hooks.bindings(), ...presentation, badgeContrato, badgeParcela, useAcoesListaEmprestimo62,
    useTranslation: () => ({ t: (key: string) => key }), useLocation: () => [location.pathname, navigate], useParams: () => ({ id }),
    formatarMoeda: (value: number) => `R$ ${Number(value).toFixed(2)}`, formatarData: (value: any) => String(value), rotaReparcelamentoAtual,
    toast: { info: vi.fn(), error: vi.fn() },
    trpc: {
      useUtils: () => ({ client: boundary, contratos: { listComParcelas: { invalidate } }, dashboard: { invalidate }, caixa: { invalidate }, parcelas: { invalidate } }),
      contratos: { obterDetalhes: { useQuery: query } }, configuracoes: { get: { useQuery: config } },
    },
  };
  for (const name of ['Button', 'Badge', 'DeleteEmprestimoDialog', 'OperacoesObrigacao51', 'ManutencaoSucessor53', 'RecebimentoValidado', 'ManutencaoJuros48', 'ManutencaoCalendario', 'MultaManualAplicar', 'HistoricoAba', 'MessageCircle', 'AlertTriangle', 'Trash2', 'FileText', 'Send', 'ArrowLeft', 'Download', 'Loader2', 'History', 'Clock']) bindings[name] = name;
  const component = compile(code(ast, 'EmprestimoDetalhes') + '\nreturn EmprestimoDetalhes;', bindings);
  const api = {
    hooks, navigate, refetch, invalidate, financial, targets, listeners, query, config, lookup, location,
    render() { runtime.hooks = hooks; const tree = hooks.render(component); hooks.flush(); return tree; },
    flags(next: any) { result = { ...result, ...next }; },
    id(next: string) { id = next; location.pathname = `/emprestimos/${next}`; },
    hash(next: string) { location.hash = next; [...listeners].forEach(fn => fn()); },
    unmount() { hooks.unmount(); expect(financial).not.toHaveBeenCalled(); },
  };
  return api;
}
function one(tree: any, predicate: (n: any) => boolean) {
  const found = treeNodes(tree, predicate); expect(found).toHaveLength(1); return found[0];
}
function byId(tree: any, id: string) { return one(tree, n => n.props?.id === id); }
const footer = (tree: any) => byId(tree, 'manutencao-financeira');
const tags = (tag: string) => nodes(ast, n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(ast) === tag) as ts.JsxSelfClosingElement[];
function props(node: ts.JsxSelfClosingElement, bindings: Record<string, any>) {
  return Object.fromEntries(node.attributes.properties.map(attr => {
    if (!ts.isJsxAttribute(attr)) throw Error('Spread inesperado na fronteira financeira');
    const value = attr.initializer;
    return [attr.name.getText(ast), !value ? true : ts.isJsxExpression(value) ? compile(`return (${value.expression!.getText(ast)});`, bindings) : value.text];
  }));
}
afterEach(() => vi.unstubAllGlobals());

describe('Ficha62: quatro destinos inertes exclusivamente no rodapé atual', () => {
  it.each(HASHES_ACOES_LISTA62)('%s foca rodapé sem abrir Detalhes, diálogo ou chamar handlers', hash => {
    const m = mounted([{ id: 44, status: 'pendente' }, { id: 45, status: 'pendente' }], hash), tree = m.render(), foot = footer(tree);
    for (const known of HASHES_ACOES_LISTA62) expect(treeNodes(foot, n => n.props?.id === known.slice(1))).toHaveLength(1);
    expect(m.targets[hash.slice(1)].focus.mock.calls).toEqual([[{ preventScroll: true }]]);
    expect(m.targets[hash.slice(1)].scrollIntoView.mock.calls).toEqual([[{ block: 'center' }]]);
    // Não montar wrappers de operações por parcela, manutenção sucessor ou histórico da outra aba.
    expect(treeNodes(tree, n => n.type === 'RecebimentoValidado')).toHaveLength(1);
    expect(treeNodes(tree, n => n.type === 'OperacoesObrigacao51')).toHaveLength(1);
    expect(treeNodes(tree, n => ['ManutencaoSucessor53', 'HistoricoAba'].includes(n.type))).toHaveLength(0);
    expect(text(tree)).not.toContain('Todas as Parcelas');
    expect(one(tree, n => n.type === 'DeleteEmprestimoDialog').props.open).toBe(false);
    expect(m.navigate).not.toHaveBeenCalled(); expect(m.refetch).not.toHaveBeenCalled(); expect(m.invalidate).not.toHaveBeenCalled();
    expect(m.query).toHaveBeenCalledTimes(1); expect(m.config).toHaveBeenCalledTimes(1); expect(m.financial).not.toHaveBeenCalled(); m.unmount();
  });
  it('wrapper receber-conferir focável sempre existe mesmo sem parcela e orienta Detalhes sem inventar ID', () => {
    const m = mounted(), tree = m.render(), wrapper = byId(tree, 'receber-conferir');
    expect(wrapper.props.tabIndex).toBe(-1); expect(wrapper.props.className).toContain('focus-visible:ring-2');
    expect(text(wrapper)).toContain('Abra a aba Detalhes');
    expect(treeNodes(wrapper, n => n.type === 'RecebimentoValidado')).toHaveLength(0);
    expect(treeNodes(tree, n => n.type === 'RecebimentoValidado')).toHaveLength(0);
    expect(m.targets['receber-conferir'].focus).toHaveBeenCalledTimes(1); m.unmount();
  });
  it.each([
    [[{ id: 44, status: 'paga' }, { id: 45, status: 'pendente' }], 45],
    [[{ id: 44, status: 'pago' }, { id: 45, status: 'cancelada' }], 44],
    [[{ id: 44, status: 'cancelada' }], undefined],
  ] as const)('seleção existente da ficha %j continua intacta', (rows, expected) => {
    const m = mounted([...rows]), tree = m.render();
    const receive = treeNodes(byId(tree, 'receber-conferir'), n => n.type === 'RecebimentoValidado');
    if (expected === undefined) expect(receive).toHaveLength(0);
    else { expect(receive).toHaveLength(1); expect(receive[0].props).toMatchObject({ contratoId: 31, parcelaId: expected, permitirRenovacao: true }); }
    m.unmount();
  });
  it('editar-obrigacao é wrapper focável e altera só acaoInicial do rodapé; sem inline/open', () => {
    const m = mounted(), tree = m.render(), wrapper = byId(tree, 'editar-obrigacao');
    expect(wrapper.props.tabIndex).toBe(-1);
    const writer = one(wrapper, n => n.type === 'OperacoesObrigacao51');
    expect(Object.keys(writer.props).sort()).toEqual(['acaoInicial', 'alvoInicial', 'children', 'contratoId', 'label', 'onSuccess'].sort());
    expect(writer.props).toMatchObject({ contratoId: 31, alvoInicial: { tipo: 'contrato' }, acaoInicial: 'editar', label: 'Adicionar parcela / editar obrigação / quitar' });
    expect(writer.props).not.toHaveProperty('inline'); expect(writer.props).not.toHaveProperty('open');
    const detailsButton = one(tree, n => n.type === 'button' && text(n).includes('Detalhes'));
    detailsButton.props.onClick(); const details = m.render();
    const contractOps = treeNodes(details, n => n.type === 'OperacoesObrigacao51' && n.props.alvoInicial.tipo === 'contrato');
    expect(contractOps).toHaveLength(2);
    expect(contractOps[0].props).not.toHaveProperty('acaoInicial'); expect(contractOps[1].props.acaoInicial).toBe('editar'); m.unmount();
  });
  it('reparcelar mantém exatamente o handler existente e só navega após clique explícito', () => {
    const m = mounted([], '#reparcelar'), tree = m.render(), button = byId(tree, 'reparcelar');
    expect(button.type).toBe('Button'); expect(m.navigate).not.toHaveBeenCalled();
    button.props.onClick();
    expect(m.navigate.mock.calls).toEqual([['/reparcelamento?contratoId=31']]);
    expect(m.financial).not.toHaveBeenCalled(); expect(m.refetch).not.toHaveBeenCalled(); expect(m.invalidate).not.toHaveBeenCalled(); m.unmount();
  });
  it('cancelar-arquivar continua fechado após navegação/hashchange; só clique explícito abre diálogo', () => {
    const m = mounted([], '#cancelar-arquivar'); let tree = m.render();
    expect(one(tree, n => n.type === 'DeleteEmprestimoDialog').props.open).toBe(false);
    m.hash('#editar-obrigacao'); m.hash('#cancelar-arquivar'); tree = m.render();
    expect(one(tree, n => n.type === 'DeleteEmprestimoDialog').props.open).toBe(false);
    byId(tree, 'cancelar-arquivar').props.onClick(); tree = m.render();
    expect(one(tree, n => n.type === 'DeleteEmprestimoDialog').props.open).toBe(true);
    expect(m.navigate).not.toHaveBeenCalled(); expect(m.financial).not.toHaveBeenCalled(); m.unmount();
  });
  it.each([{ data: undefined, isPending: true }, { isLoading: true }, { isError: true }, { data: null }, { isFetching: true }, { data: { ...loan(), id: 32 } }])('guard real da ficha %j nunca foca dados não prontos', flags => {
    const m = mounted(); m.flags(flags); m.render();
    expect(m.lookup).not.toHaveBeenCalled(); expect(m.listeners.size).toBe(0); expect(m.navigate).not.toHaveBeenCalled(); m.unmount();
  });
  it('hook mantém ordem entre earlyreturn e success e recebe somente id/readerflags existentes', () => {
    const fn = declaration(ast, 'EmprestimoDetalhes');
    const hook = nodes(fn, n => ts.isCallExpression(n) && n.expression.getText(ast) === 'useAcoesListaEmprestimo62')[0] as ts.CallExpression;
    const returns = nodes(fn, ts.isReturnStatement);
    expect(hook).toBeDefined(); expect(returns.every(n => n.pos > hook.pos)).toBe(true);
    expect(hook.arguments[0].getText(ast)).toBe('{ id, emprestimo, isPending, isLoading, isError, isFetching }');
    const m = mounted(); m.flags({ data: undefined, isPending: true }); m.render(); const count = m.hooks.cursor;
    m.flags({ ...settled, data: loan() }); m.render(); expect(m.hooks.cursor).toBe(count);
    expect(m.targets['receber-conferir'].focus).toHaveBeenCalledTimes(1); m.unmount();
  });
  it('AST confirma propswriters invariantes e nenhum wrapper novo por parcela ou writer adicional', () => {
    const cb = vi.fn(), bindings = { emprestimo: { id: 31, todasParcelas: [{ id: 44 }, { id: 45 }] }, p: { id: 45 }, parcela: { id: 44 }, atualizarFinanceiro: cb, modalDeletar: false, setModalDeletar: vi.fn(), setLocation: vi.fn() };
    expect(tags('OperacoesObrigacao51').map(n => props(n, bindings))).toEqual([
      { contratoId: 31, alvoInicial: { tipo: 'contrato' }, onSuccess: cb },
      { contratoId: 31, alvoInicial: { tipo: 'parcela', parcelaId: 45 }, acaoInicial: 'editar', label: 'Editar / cancelar / arquivar parcela', onSuccess: cb },
      { contratoId: 31, alvoInicial: { tipo: 'contrato' }, acaoInicial: 'editar', label: 'Adicionar parcela / editar obrigação / quitar', onSuccess: cb },
    ]);
    expect(tags('RecebimentoValidado').map(n => props(n, bindings))).toEqual([
      { contratoId: 31, parcelaId: 45, permitirRenovacao: true, onSuccess: cb },
      { contratoId: 31, parcelaId: 44, permitirRenovacao: true, onSuccess: cb },
    ]);
    expect(props(tags('ManutencaoJuros48')[0], bindings)).toEqual({ contratoId: 31, parcelasIds: [44, 45], onSuccess: cb });
    for (const tag of ['ManutencaoCalendario', 'MultaManualAplicar', 'ManutencaoSucessor53']) {
      expect(tags(tag)).toHaveLength(1); expect(props(tags(tag)[0], bindings)).toEqual({ contratoId: 31, onSuccess: cb });
    }
    expect(tags('DeleteEmprestimoDialog')).toHaveLength(1);
    expect(props(tags('DeleteEmprestimoDialog')[0], { ...bindings, emprestimo: { id: 31, clienteNome: 'Nome' } })).toMatchObject({ emprestimoId: 31, clienteNome: 'Nome', open: false, onOpenChange: bindings.setModalDeletar });
    expect((ast as any).parseDiagnostics).toEqual([]);
    const sourceText = ast.getText();
    expect(sourceText).not.toMatch(/\.click\(|location\.hash.*setAba|useMutation|randomUUID|localStorage|sessionStorage/);
    expect(sourceText).toContain("const parcela = emprestimo.todasParcelas?.find((p: any) => ['pendente', 'atrasada', 'vencendo_hoje', 'parcial'].includes(p.status)) ?? emprestimo.todasParcelas?.find((p: any) => ['paga', 'pago'].includes(p.status));");
    const buttons = nodes(ast, n => ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'Button') as ts.JsxElement[];
    for (const [id, exact] of [['reparcelar', '() => setLocation(rotaReparcelamentoAtual(emprestimo.id))'], ['cancelar-arquivar', '() => setModalDeletar(true)']]) {
      const button = buttons.find(n => n.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'id' && (a.initializer as ts.StringLiteral).text === id))!;
      expect(button).toBeDefined();
      const click = button.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'onClick') as ts.JsxAttribute;
      expect((click.initializer as ts.JsxExpression).expression!.getText(ast)).toBe(exact);
    }
  });
});
