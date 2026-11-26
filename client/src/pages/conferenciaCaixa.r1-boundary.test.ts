import { describe, expect, it, vi } from 'vitest';
import { code, compile, Hooks, nodes, source, text, treeNodes } from '../lib/r1BoundaryHarness';

function component(relative: string, name: string, hooks: Hooks, bindings: Record<string, any>) {
  const ast = source(relative), tags: Record<string, any> = {};
  for (const n of nodes(ast, n => !!(n as any).tagName)) {
    const tag = (n as any).tagName?.getText(ast);
    if (tag && /^[A-Z][\w]*$/.test(tag)) tags[tag] = tag;
  }
  const localMoeda = ast.statements.find(n => n.getText(ast).startsWith('const moeda ='))?.getText(ast) ?? '';
  return compile(`${localMoeda}\n${code(ast, name)}\nreturn ${name};`, { ...tags, ...hooks.bindings(), ...bindings });
}
const dto = (empresaId = 31) => ({ empresaId, escopo: 'fixture somente leitura', geradoEm: '2026-11-26T12:00:00Z', contas: [
  { id: 7, nome: 'CONTA_PRIVADA_31', ativa: true, saldoBase: '100.00', entradas: '20.00', saidas: '5.00', saldoLivro: '115.00', divergencias: 0 },
  { id: 8, nome: 'INATIVA_PRIVADA_31', ativa: false, saldoBase: '-10.00', entradas: '0.00', saidas: '0.00', saldoLivro: '-10.00', divergencias: 1 },
], divergencias: [{ despesaId: 10, contaCaixaId: 8, tipo: 'legado_sem_vinculo', mensagem: 'DIVERGENCIA_PRIVADA_31', esperado: '4.00', encontrado: null }] });
let uuidSequence = 0;
function reader(atual: () => boolean = () => true) {
  const hooks = new Hooks(), query = { data: dto() as any, isError: false, error: null as any, isFetching: false, refetch: vi.fn() };
  const calls: any[] = [], mutate = vi.fn(() => { throw Error('Forbidden mutation'); });
  const trpc = { contasPagar: { conferirCaixa: { useQuery: (input: any, options: any) => { calls.push({ input, options }); return query; } }, sincronizarCaixa: { useMutation: () => { throw Error('Removed API'); } } }, mutate };
  const fn = component('components/ConferenciaDespesasCaixa.tsx', 'ConferenciaDespesasCaixa', hooks, { trpc, moedaDespesa: (v: string) => `R$ ${v}`, globalThis: { crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuidSequence).padStart(12, '0')}` } } });
  const render = (id = 31) => hooks.render(fn, { userId: id, atual });
  return { hooks, query, calls, mutate, render };
}
function dialog(tree: any) { return treeNodes(tree, n => n.type === 'Dialog')[0]; }
function conference(tree: any) { return treeNodes(tree, n => n.type === 'ConferenciaDespesasCaixa')[0]; }

describe('R1 ConferenciaDespesasCaixa — real component body / confined hook instances', () => {
  it('abrir e refetch só consultam; nenhuma mutation ou ajuste de saldo', () => {
    const r = reader(); let tree = r.render();
    expect(r.calls.at(-1).options.enabled).toBe(false); dialog(tree).props.onOpenChange(true); tree = r.render();
    expect(r.calls.at(-1).options).toMatchObject({ enabled: true, retry: false, staleTime: 0, gcTime: 0, placeholderData: undefined, trpc: { abortOnUnmount: true } });
    treeNodes(tree, n => n.type === 'Button' && text(n).includes('Atualizar conferência'))[0].props.onClick();
    expect(r.query.refetch).toHaveBeenCalledTimes(1); expect(r.mutate).not.toHaveBeenCalled();
    expect(text(tree)).toContain('Saldo do livro: R$ 115.00'); expect(text(tree)).toContain('INATIVA_PRIVADA_31');
  });
  it.each(['fetch', 'isError', 'errorOnly', 'wrongOwner', 'obsoleteSession'])('%s com cache não pinta contas, valores ou divergências antigas', kind => {
    let current = true; const r = reader(() => current); dialog(r.render()).props.onOpenChange(true);
    if (kind === 'fetch') r.query.isFetching = true;
    if (kind === 'isError') r.query.isError = true;
    if (kind === 'errorOnly') r.query.error = new Error('fixture');
    if (kind === 'wrongOwner') r.query.data = dto(42);
    if (kind === 'obsoleteSession') current = false;
    const tree = r.render(), output = text(tree);
    expect(output).not.toContain('CONTA_PRIVADA_31'); expect(output).not.toContain('115.00'); expect(output).not.toContain('DIVERGENCIA_PRIVADA_31');
    expect(treeNodes(tree, n => n.props?.['aria-label'] === 'Saldo automático pelo livro')).toHaveLength(0);
    if (!current) { expect(dialog(tree).props.open).toBe(false); const count = r.query.refetch.mock.calls.length; treeNodes(tree, n => n.type === 'Button' && text(n).includes('Atualizar conferência'))[0].props.onClick(); expect(r.query.refetch).toHaveBeenCalledTimes(count); }
  });
  it('filtro é local; conta inativa não vira mutation nem consulta com outro owner', () => {
    const r = reader(); dialog(r.render()).props.onOpenChange(true); let tree = r.render();
    treeNodes(tree, n => n.type === 'select')[0].props.onChange({ target: { value: '8' } }); tree = r.render();
    expect(treeNodes(tree, n => n.props?.['aria-label'] === 'Saldo automático pelo livro').map(text).join(' ')).not.toContain('CONTA_PRIVADA_31');
    expect(r.calls.at(-1).input).toEqual(r.calls[0].input); expect(r.mutate).not.toHaveBeenCalled();
  });
});

function page(name: 'Caixa' | 'ContasPagar') {
  const hooks = new Hooks(), auth = { data: { id: 31 } as any, isError: false, error: null as any, isLoading: false, isFetching: false };
  const mutate = vi.fn(() => { throw Error('Opening must never mutate'); });
  const empty = () => ({ data: undefined, isError: false, error: null, isLoading: false, isFetching: false, refetch: vi.fn() });
  const utils: any = {};
  for (const group of ['caixa', 'contasPagar', 'dashboard']) utils[group] = new Proxy({}, { get: () => ({ invalidate: vi.fn() }) });
  const endpoint = () => ({ useQuery: empty, useMutation: () => ({ mutate, mutateAsync: mutate, isPending: false }) });
  const trpc: any = { auth: { me: { useQuery: () => auth } }, useUtils: () => utils, caixa: new Proxy({}, { get: endpoint }), contasPagar: new Proxy({}, { get: endpoint }) };
  class Store { get() { return null; } blocked() { return false; } }
  const bindings = { trpc, despesasTrpc: trpc, DespesasIntentStore: Store, window: { sessionStorage: {} }, hashKey: JSON.stringify, acoes: ['criar', 'pagar', 'estornar'], freshForm: () => ({}), categorias: {}, statuses: {}, toast: { error: vi.fn(), success: vi.fn() }, canCloseRejectedIntent: () => false };
  // Preserve the actual module-level transition counter in the compiled closure.
  const ast = source(`pages/${name}.tsx`), tags: Record<string, any> = {};
  for (const n of nodes(ast, n => !!(n as any).tagName)) { const tag = (n as any).tagName?.getText(ast); if (tag && /^[A-Z][\w]*$/.test(tag)) tags[tag] = tag; }
  const fn = compile(`let proximaSessaoCache = 0;\n${code(ast, name)}\nreturn ${name};`, { ...tags, ...hooks.bindings(), ...bindings });
  const render = () => hooks.render(fn);
  const settled = () => { render(); hooks.flush(); return render(); };
  return { hooks, auth, mutate, render, settled };
}

describe('R1 mounts reais Caixa / ContasPagar — cache e callback de sessão', () => {
  it.each(['Caixa', 'ContasPagar'] as const)('%s A→B→A remonta e invalida identidade do primeiro A', name => {
    const p = page(name); const mount = () => { const tree = p.settled(); return name === 'Caixa' ? treeNodes(tree, n => n.type === 'CaixaEmpresa')[0] : conference(tree); };
    const a = mount(); expect(a.props.userId).toBe(31); expect(a.props.atual()).toBe(true);
    const oldReader = reader(a.props.atual); dialog(oldReader.render()).props.onOpenChange(true);
    treeNodes(oldReader.render(), n => n.type === 'select')[0].props.onChange({ target: { value: '8' } });
    expect(dialog(oldReader.render()).props.open).toBe(true);
    p.auth.data = { id: 42 }; const b = mount(); expect(b.props.userId).toBe(42); expect(a.props.atual()).toBe(false);
    p.auth.data = { id: 31 }; const a2 = mount(); expect(a2.key).not.toBe(a.key); expect(b.props.atual()).toBe(false); expect(a.props.atual()).toBe(false); expect(a2.props.atual()).toBe(true);
    // Real React key requests a fresh child: model separate hook instances and check reset.
    const currentReader = reader(a2.props.atual);
    expect(dialog(currentReader.render()).props.open).toBe(false); expect(currentReader.calls.at(-1).options.enabled).toBe(false);
    expect(treeNodes(currentReader.render(), n => n.type === 'select')[0].props.value).toBe('');
    expect(currentReader.calls[0].input.leituraId).not.toBe(oldReader.calls[0].input.leituraId);
    expect(dialog(oldReader.render()).props.open).toBe(false);
    expect(p.mutate).not.toHaveBeenCalled();
  });
  it.each(['Caixa', 'ContasPagar'] as const)('%s erro auth desmonta mount e bloqueia o callback anterior', name => {
    const p = page(name), tree = p.settled(), child = name === 'Caixa' ? treeNodes(tree, n => n.type === 'CaixaEmpresa')[0] : conference(tree);
    p.auth.isError = true; const failed = p.settled();
    expect(conference(failed)).toBeUndefined(); expect(treeNodes(failed, n => n.type === 'CaixaEmpresa')).toHaveLength(0); expect(child.props.atual()).toBe(false);
  });
  it.each(['Caixa', 'ContasPagar'] as const)('%s refetch auth com cache NÃO mantém mount nem callback autorizado [ContasPagar expected RED]', name => {
    const p = page(name), tree = p.settled(), child = name === 'Caixa' ? treeNodes(tree, n => n.type === 'CaixaEmpresa')[0] : conference(tree);
    p.auth.isFetching = true; const fetching = p.settled();
    expect(conference(fetching)).toBeUndefined(); expect(treeNodes(fetching, n => n.type === 'CaixaEmpresa')).toHaveLength(0); expect(child.props.atual()).toBe(false);
  });
  it.each(['Caixa', 'ContasPagar'] as const)('%s auth.error independente de isError é fail-closed [ContasPagar expected RED]', name => {
    const p = page(name); p.settled(); p.auth.error = new Error('flag transitória'); const failed = p.settled();
    expect(conference(failed)).toBeUndefined(); expect(treeNodes(failed, n => n.type === 'CaixaEmpresa')).toHaveLength(0);
  });
});
