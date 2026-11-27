// @vitest-environment node
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hooks, source } from './r1BoundaryHarness';
import {
  HASHES_ACOES_LISTA62, alvoAcaoListaEmprestimo62, fichaProntaAcaoLista62,
  hashAcaoLista62, idContratoAcao62, rotaAcaoListaEmprestimo62, type LeituraAcaoLista62,
} from './acoesListaEmprestimo62';
const runtime = vi.hoisted(() => ({ hooks: null as any }));
vi.mock('react', async original => ({
  ...await original<any>(),
  useRef: (value: any) => runtime.hooks.useRef(value),
  useEffect: (fn: any, deps: any[]) => runtime.hooks.useEffect(fn, deps),
}));
import { useAcoesListaEmprestimo62 } from './useAcoesListaEmprestimo62';
const settled = { isPending: false, isLoading: false, isError: false, isFetching: false };
const input = (id = 31, extra: Partial<LeituraAcaoLista62> = {}) => ({ id: String(id), ...settled, emprestimo: { id }, ...extra });
const forbidden = vi.fn(() => { throw Error('Atalho tentou operação, autoopen, browser/rede ou storage'); });
function fixture(hash = '#receber-conferir') {
  const hooks = new Hooks(), listeners = new Set<() => void>();
  const targets = Object.fromEntries(HASHES_ACOES_LISTA62.map(h => [h.slice(1), { scrollIntoView: vi.fn(), focus: vi.fn(), click: forbidden }]));
  const location = { pathname: '/emprestimos/31', hash, search: '' };
  const add = vi.fn((name: string, fn: () => void) => { expect(name).toBe('hashchange'); listeners.add(fn); });
  const remove = vi.fn((name: string, fn: () => void) => { expect(name).toBe('hashchange'); listeners.delete(fn); });
  const lookup = vi.fn((id: string) => targets[id] ?? null);
  vi.stubGlobal('window', { location, addEventListener: add, removeEventListener: remove, open: forbidden });
  vi.stubGlobal('document', { getElementById: lookup, querySelector: forbidden });
  return {
    hooks, targets, location, listeners, add, remove, lookup,
    render(next = input()) { runtime.hooks = hooks; hooks.render(useAcoesListaEmprestimo62, next); hooks.flush(); },
    change(next: string) { location.hash = next; [...listeners].forEach(fn => fn()); },
    unmount() { hooks.unmount(); },
  };
}
beforeEach(() => {
  forbidden.mockClear();
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'setTimeout', 'setInterval', 'localStorage', 'sessionStorage', 'crypto']) {
    vi.stubGlobal(name, new Proxy(forbidden, { get: () => forbidden }));
  }
});
afterEach(() => { expect(forbidden).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe('Allowlist62 canônica: apenas contrato int32 positivo e quatro hashes literais', () => {
  it('allowlist exata sem comandos e limites inclusivos de int32', () => {
    expect(HASHES_ACOES_LISTA62).toEqual(['#receber-conferir', '#editar-obrigacao', '#reparcelar', '#cancelar-arquivar']);
    for (const id of [1, 31, 2147483647, '1', '31', '2147483647']) {
      expect(idContratoAcao62(id)).toBe(Number(id));
      for (const hash of HASHES_ACOES_LISTA62) {
        expect(hashAcaoLista62(hash)).toBe(hash);
        expect(rotaAcaoListaEmprestimo62(id, hash)).toBe(`/emprestimos/${Number(id)}${hash}`);
        expect(alvoAcaoListaEmprestimo62(`/emprestimos/${Number(id)}`, hash, id)).toBe(hash.slice(1));
      }
    }
  });
  it.each([null, undefined, true, {}, [], 0, -1, 1.5, NaN, Infinity, 2147483648, '', '0', '-1', '01', '31x', '31.0', '3e1', '+31', ' 31', '31 ', '2147483648', '%33%31', '31?ownerId=41', '31#receber-conferir', '11111111-1111-4111-8111-111111111111'])('id adulterado/fora do domínio %j é ignorado', id => {
    expect(idContratoAcao62(id)).toBeNull();
    expect(rotaAcaoListaEmprestimo62(id, '#receber-conferir')).toBeUndefined();
    expect(alvoAcaoListaEmprestimo62('/emprestimos/31', '#receber-conferir', id)).toBeNull();
    expect(fichaProntaAcaoLista62(id, input())).toBe(false);
  });
  it.each(['31\n', '31\r', '31\r\n'])('id com newline terminal %j não passa pela âncora da regex', id => {
    expect(idContratoAcao62(id)).toBeNull();
    expect(rotaAcaoListaEmprestimo62(id, '#reparcelar')).toBeUndefined();
  });
  it.each([null, undefined, '', '#', 'receber-conferir', '#RECEBER-CONFERIR', '#manutencao-financeira', '#receber-conferir?parcelaId=1', '#receber-conferir/1', '#receber-conferir&owner=41', '#%72eceber-conferir', '%23receber-conferir', '#reparcelar%00', '#cancelar-arquivar ', '#executar', '#click()', '#cotar', '#mutate'])('hash desconhecido/encoded/comando %j é ignorado sem decodificação', hash => {
    expect(hashAcaoLista62(hash)).toBeNull();
    expect(rotaAcaoListaEmprestimo62(31, hash)).toBeUndefined();
    expect(alvoAcaoListaEmprestimo62('/emprestimos/31', hash, 31)).toBeNull();
  });
  it.each(['/emprestimos/32', '/emprestimos/031', '/emprestimos/31/', '/emprestimos/%33%31', '/emprestimos/31?ownerId=41', '/emprestimos/31#receber-conferir', 'https://site/emprestimos/31', '/reparcelamento'])('rota %s não é interpretada por prefixo ou parseInt', pathname => {
    expect(alvoAcaoListaEmprestimo62(pathname, '#receber-conferir', 31)).toBeNull();
  });
  it.each([{ isPending: true }, { isLoading: true }, { isError: true }, { isFetching: true }, { emprestimo: null }, { emprestimo: undefined }, { emprestimo: { id: 32 } }, { emprestimo: { id: '31' } }])('leitura %j não autoriza nem foco', flags => {
    expect(fichaProntaAcaoLista62('31', { ...input(), ...flags } as LeituraAcaoLista62)).toBe(false);
  });
});

describe('Hook62 real: efeito visual após carga, sem autoaba/autoopen/financeiro', () => {
  it.each(HASHES_ACOES_LISTA62)('load → success %s desloca e foca uma vez somente alvo conhecido', hash => {
    const f = fixture(hash), target = f.targets[hash.slice(1)];
    f.render(input(31, { emprestimo: undefined, isPending: true, isLoading: true, isFetching: true }));
    expect(f.lookup).not.toHaveBeenCalled(); expect(f.listeners.size).toBe(0);
    f.render();
    expect(f.lookup.mock.calls).toEqual([[hash.slice(1)]]);
    expect(target.scrollIntoView.mock.calls).toEqual([[{ block: 'center' }]]);
    expect(target.focus.mock.calls).toEqual([[{ preventScroll: true }]]);
    expect(target.scrollIntoView.mock.invocationCallOrder[0]).toBeLessThan(target.focus.mock.invocationCallOrder[0]);
    f.render(); expect(target.focus).toHaveBeenCalledTimes(1); f.unmount();
  });
  it.each([{ isPending: true }, { isLoading: true }, { isError: true }, { isFetching: true }, { emprestimo: null }, { emprestimo: undefined }, { emprestimo: { id: 32 } }, { emprestimo: { id: '31' } }])('ready false %j não registra listener nem acessa DOM', flags => {
    const f = fixture(); f.render({ ...input(), ...flags } as any);
    f.change('#cancelar-arquivar');
    expect(f.add).not.toHaveBeenCalled(); expect(f.lookup).not.toHaveBeenCalled(); f.unmount();
  });
  it('SSR/fake window sem listener/document não falha nem acessa fronteiras', () => {
    const f = fixture(); vi.stubGlobal('window', undefined); vi.stubGlobal('document', undefined); f.render();
    vi.stubGlobal('window', { location: { search: '' } }); f.render(input(31, { isFetching: true })); f.render();
    expect(f.lookup).not.toHaveBeenCalled(); expect(f.add).not.toHaveBeenCalled(); f.unmount();
  });
  it('hashchange e novo gesto repetido na mesma ficha focam sem executar botão', () => {
    const f = fixture(); f.render();
    for (const hash of HASHES_ACOES_LISTA62) { f.change(hash); expect(f.targets[hash.slice(1)].focus).toHaveBeenLastCalledWith({ preventScroll: true }); }
    const cancel = f.targets['cancelar-arquivar'];
    const before = cancel.focus.mock.calls.length; f.change('#cancelar-arquivar');
    expect(cancel.focus).toHaveBeenCalledTimes(before + 1); expect(forbidden).not.toHaveBeenCalled(); f.unmount();
  });
  it('refetch repetido/novo objeto de dados não rouba foco consumido por id/hash', () => {
    const f = fixture(); f.render();
    for (let i = 0; i < 3; i++) { f.render(input(31, { isFetching: true })); expect(f.listeners.size).toBe(0); f.render(); }
    expect(f.targets['receber-conferir'].focus).toHaveBeenCalledTimes(1);
    expect(f.lookup).toHaveBeenCalledTimes(1); f.unmount();
  });
  it('hash muda durante refetch e é consumido uma só vez após sucesso', () => {
    const f = fixture(); f.render(); f.render(input(31, { isFetching: true }));
    f.change('#editar-obrigacao'); expect(f.targets['editar-obrigacao'].focus).not.toHaveBeenCalled();
    f.render(); expect(f.targets['editar-obrigacao'].focus).toHaveBeenCalledTimes(1); f.render();
    expect(f.targets['editar-obrigacao'].focus).toHaveBeenCalledTimes(1); f.unmount();
  });
  it('troca ID A→B unready→B success→A success limpa listener e permite retorno', () => {
    const f = fixture(); f.render(); expect(f.targets['receber-conferir'].focus).toHaveBeenCalledTimes(1);
    f.location.pathname = '/emprestimos/32';
    f.render(input(32, { emprestimo: { id: 31 }, isPending: true }));
    expect(f.remove).toHaveBeenCalledTimes(1); expect(f.listeners.size).toBe(0);
    f.render(input(32)); expect(f.targets['receber-conferir'].focus).toHaveBeenCalledTimes(2);
    f.location.pathname = '/emprestimos/31'; f.render();
    expect(f.targets['receber-conferir'].focus).toHaveBeenCalledTimes(3); expect(f.listeners.size).toBe(1); f.unmount();
  });
  it('troca A→B ainda unready→A permite retorno mesmo sem B nunca ter ficado pronto', () => {
    const f = fixture(); f.render(); f.location.pathname = '/emprestimos/32';
    f.render(input(32, { emprestimo: undefined, isPending: true }));
    f.location.pathname = '/emprestimos/31'; f.render();
    expect(f.targets['receber-conferir'].focus).toHaveBeenCalledTimes(2); f.unmount();
  });
  it('listener anterior não age no intervalo render unready→cleanup nem na troca de ID', () => {
    const f = fixture(); f.render(); runtime.hooks = f.hooks;
    f.hooks.render(useAcoesListaEmprestimo62, input(31, { isFetching: true }));
    f.change('#cancelar-arquivar');
    expect(f.targets['cancelar-arquivar'].focus).not.toHaveBeenCalled(); f.hooks.flush();
    f.location.hash = '#receber-conferir'; f.render();
    expect(f.targets['receber-conferir'].focus).toHaveBeenCalledTimes(1);
    f.hooks.render(useAcoesListaEmprestimo62, input(32, { isPending: true }));
    f.change('#cancelar-arquivar');
    expect(f.targets['cancelar-arquivar'].focus).not.toHaveBeenCalled(); f.hooks.flush(); f.unmount();
  });
  it('desmontagem limpa o listener exato e eventos posteriores não fazem nada', () => {
    const f = fixture(); f.render(); const registered = f.add.mock.calls[0][1]; f.unmount();
    expect(f.remove.mock.calls).toEqual([['hashchange', registered]]);
    expect(f.listeners.size).toBe(0); f.change('#cancelar-arquivar'); expect(f.targets['cancelar-arquivar'].focus).not.toHaveBeenCalled();
  });
  it.each(['#%72eceber-conferir', '#receber-conferir?parcelaId=1', '#cotar', '#click()', '#manutencao-financeira', ''])('hook ignora hash %s sem sequer consultar DOM', hash => {
    const f = fixture(hash); f.render(); f.change(hash);
    expect(f.lookup).not.toHaveBeenCalled(); f.unmount();
  });
  it('pathname divergente e query adulterada ignorados sem iniciar operação', () => {
    const f = fixture(); f.location.pathname = '/emprestimos/32'; f.render();
    f.location.pathname = '/emprestimos/31'; f.location.search = '?parcelaId=9&ownerId=41'; f.change('#cancelar-arquivar');
    expect(f.lookup).not.toHaveBeenCalled(); f.unmount();
  });
  it('hash desconhecido não contamina o consumo; retorno por hashchange continua somente visual', () => {
    const f = fixture(); f.render(); f.change('#%72eceber-conferir');
    expect(f.lookup).toHaveBeenCalledTimes(1); f.change('#receber-conferir');
    expect(f.targets['receber-conferir'].focus).toHaveBeenCalledTimes(2); f.unmount();
  });
  it('alvo ausente não é inventado, clicado ou recuperado por timer', () => {
    const f = fixture(); f.lookup.mockReturnValue(null); f.render();
    expect(f.lookup.mock.calls).toEqual([['receber-conferir']]);
    expect(f.targets['receber-conferir'].focus).not.toHaveBeenCalled(); f.unmount();
  });
  it('helper não importa auth/query/writer e hook só depende de React e helper62', () => {
    const helper = source('lib/acoesListaEmprestimo62.ts'), hook = source('lib/useAcoesListaEmprestimo62.ts');
    expect(helper.statements.filter(ts.isImportDeclaration)).toHaveLength(0);
    expect(hook.statements.filter(ts.isImportDeclaration).map(n => (n.moduleSpecifier as ts.StringLiteral).text)).toEqual(['react', './acoesListaEmprestimo62']);
    for (const ast of [helper, hook]) {
      expect((ast as any).parseDiagnostics).toEqual([]);
      expect(ast.getText()).not.toMatch(/\.click\(|setAba|setModal|setOpened|mutate|cotar|recover|localStorage|sessionStorage|randomUUID|setTimeout|setInterval|useQuery|useMutation|trpc|fetch\(/);
    }
  });
});
