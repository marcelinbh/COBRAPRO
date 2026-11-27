import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AVISO_LISTA_INCOMPLETA, type ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';
import type { FiltrosLista66, RelatorioLista66 } from '../lib/relatorioLista66';

// Nenhuma biblioteca DOM: hooks capturados para eventos/lifecycle e SSR para a UI.
const mocks = vi.hoisted(() => ({
  active: null as any,
  criar: vi.fn(),
  excel: vi.fn(),
  pdf: vi.fn(),
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const hooks = {
    useRef: (value: unknown) => mocks.active ? mocks.active.useRef(value) : actual.useRef(value),
    useState: (value: unknown) => mocks.active ? mocks.active.useState(value) : actual.useState(value),
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => mocks.active ? mocks.active.useEffect(effect, deps) : actual.useEffect(effect, deps),
  };
  return { ...actual, ...hooks, default: { ...actual.default, ...hooks } };
});
vi.mock('../lib/relatorioLista66', () => ({ criarRelatorioLista66: mocks.criar }));
vi.mock('../lib/exportarLista66', () => ({ gerarExcelLista66: mocks.excel, gerarPdfLista66: mocks.pdf }));
import { ExportarLista66 } from './ExportarLista66';

type Props = Parameters<typeof ExportarLista66>[0];
const parcial: ListaSeguraEmprestimos = {
  version: 'loan_list_read_v1', userId: 41,
  items: [
    { kind: 'validated', id: 1, clienteId: 2, clienteNome: 'Cliente próprio <script>alert(1)</script>', modalidade: 'mensal', status: 'ativo', statusFinanceiroOriginal: 'ativo', statusObrigacao: 'ativo', arquivado: false, obrigacaoAdicional: '0.00', obrigacaoAtual: '80.00', capital: 100, totalReceber: 80, totalPago: 20 },
    { kind: 'unavailable', id: 42, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.' },
  ],
  coverage: { scopedContracts: 2, validatedContracts: 1, unavailableContracts: 1, complete: false, label: 'validados somente' },
  totals: { label: 'validados somente', values: { capital: 100, totalReceber: 80, totalPago: 20 } },
  warning: AVISO_LISTA_INCOMPLETA,
};
const filtros: FiltrosLista66 = { arquivo: 'operacional', busca: '', modalidade: 'todos', statusObrigacao: 'todos' };
const props = (): Props => {
  const data = JSON.parse(JSON.stringify(parcial)) as ListaSeguraEmprestimos;
  return { data, items: [...data.items], filtros: { ...filtros } };
};
const report = (): RelatorioLista66 => ({
  titulo: 'Relatório parcial — validados somente', parcial: true,
  avisos: [AVISO_LISTA_INCOMPLETA], metadados: [['Escopo', 'TODO o escopo, incluindo histórico']],
  cabecalho: ['Empréstimo', 'Cliente', 'Capital'], linhas: [[1, 'Cliente próprio', 100], [42, null, null]],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, error) => { resolve = ok; reject = error; });
  return { promise, resolve, reject };
}
function nodes(tree: any, type: string): any[] {
  if (Array.isArray(tree)) return tree.flatMap(value => nodes(value, type));
  if (!tree || typeof tree !== 'object') return [];
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}
function mount(initial: Props) {
  let cursor = 0;
  let current = initial;
  let alive = true;
  let tree: ReturnType<typeof ExportarLista66>;
  const slots: any[] = [];
  const pending: Array<() => void> = [];
  const stateWrites = vi.fn();
  const writesAfterUnmount = vi.fn();
  const runtime = {
    useRef(value: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: value };
      return slots[index];
    },
    useState(value: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof value === 'function' ? (value as () => unknown)() : value;
      return [slots[index], (next: any) => {
        if (!alive) writesAfterUnmount();
        stateWrites();
        slots[index] = typeof next === 'function' ? next(slots[index]) : next;
      }];
    },
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      const index = cursor++;
      const old = slots[index];
      if (!old || deps.length !== old.deps.length || deps.some((dep, i) => !Object.is(dep, old.deps[i]))) {
        const next: any = { deps: [...deps], cleanup: old?.cleanup };
        slots[index] = next;
        pending.push(() => {
          next.cleanup?.();
          next.cleanup = effect();
        });
      }
    },
  };
  const render = (next = current, commit = true) => {
    current = next;
    cursor = 0;
    mocks.active = runtime;
    try { tree = ExportarLista66(current); } finally { mocks.active = null; }
    if (commit) pending.splice(0).forEach(effect => effect());
    return tree;
  };
  render();
  return {
    render,
    html: () => renderToStaticMarkup(render()),
    button: (format: 'xlsx' | 'pdf') => nodes(render(), 'button')[format === 'xlsx' ? 0 : 1],
    click: (format: 'xlsx' | 'pdf') => nodes(render(), 'button')[format === 'xlsx' ? 0 : 1].props.onClick() as Promise<void>,
    unmount: () => {
      for (const slot of slots) slot?.cleanup?.();
      alive = false;
    },
    stateWrites, writesAfterUnmount,
  };
}

let anchor: { href: string; download: string; style: { display: string }; click: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
let createUrl: ReturnType<typeof vi.fn>;
let revokeUrl: ReturnType<typeof vi.fn>;
let append: ReturnType<typeof vi.fn>;
let blob: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.active = null;
  mocks.criar.mockImplementation(() => report());
  mocks.excel.mockResolvedValue(new Uint8Array([80, 75, 3, 4]));
  mocks.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  vi.useFakeTimers();
  anchor = { href: '', download: '', style: { display: '' }, click: vi.fn(), remove: vi.fn() };
  createUrl = vi.fn(() => 'blob:lista66');
  revokeUrl = vi.fn();
  append = vi.fn();
  blob = vi.fn(function (this: any, parts: unknown[], options: unknown) { this.parts = parts; this.options = options; });
  vi.stubGlobal('Blob', blob);
  vi.stubGlobal('URL', class extends NodeURL {
    static createObjectURL = createUrl;
    static revokeObjectURL = revokeUrl;
  });
  vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { appendChild: append } });
});
afterEach(() => {
  mocks.active = null;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Aguarda o mesmo módulo mockado, sem polling, timers ou biblioteca DOM.
async function waitForSerializer(fn: ReturnType<typeof vi.fn>) {
  await import('../lib/exportarLista66');
  await Promise.resolve();
  expect(fn).toHaveBeenCalledTimes(1);
}

describe('ExportarLista66 — download local e leitura parcial', () => {
  it('não monta relatório nem serializa ou baixa automaticamente; UI parcial acessível', () => {
    const view = mount(props());
    const html = view.html();
    expect(html).toContain('Relatório parcial de empréstimos — validados somente');
    expect(html).toContain('cards visíveis conforme os filtros');
    expect(html).toContain('campos desconhecidos em branco');
    expect(html).toContain('TODO o escopo, incluindo o histórico');
    expect(html).toContain('não representam toda a carteira');
    expect(html).toContain('Exportar Excel (.xlsx)');
    expect(html).toContain('Exportar PDF');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('Cliente próprio');
    for (const button of nodes(view.render(), 'button')) {
      expect(button.props.type).toBe('button');
      expect(button.props.disabled).toBe(false);
      expect(button.props.className).toContain('min-h-11');
      expect(button.props.className).toContain('sm:w-auto');
    }
    expect(mocks.criar).not.toHaveBeenCalled();
    expect(mocks.excel).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(blob).not.toHaveBeenCalled();
    expect(createUrl).not.toHaveBeenCalled();
    view.unmount();
  });

  it.each(['xlsx', 'pdf'] as const)('um clique %s gera apenas o formato solicitado e baixa com nome fixo', async format => {
    const initial = props();
    const view = mount(initial);
    const running = view.click(format);
    expect(mocks.criar).toHaveBeenCalledTimes(1);
    expect(mocks.criar).toHaveBeenCalledWith(initial.data, initial.items, initial.filtros, 41);
    expect(view.html()).toContain('Gerando arquivo');
    expect(view.button('xlsx').props.disabled).toBe(true);
    expect(view.button('pdf').props.disabled).toBe(true);
    await running;
    const selected = format === 'xlsx' ? mocks.excel : mocks.pdf;
    const other = format === 'xlsx' ? mocks.pdf : mocks.excel;
    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith(report());
    expect(other).not.toHaveBeenCalled();
    expect(anchor.download).toBe(`emprestimos-lista-parcial.${format}`);
    expect(anchor.download).not.toMatch(/Cliente|41|[/\\]/);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith(anchor);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    expect(blob.mock.calls[0][0][0]).toBeInstanceOf(ArrayBuffer);
    expect(blob.mock.calls[0][1]).toEqual({ type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' });
    expect(view.html()).toContain('Download de');
    expect(view.html()).toContain('iniciado.');
    expect(view.button('xlsx').props.disabled).toBe(false);
    expect(revokeUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeUrl).toHaveBeenCalledWith('blob:lista66');
    view.unmount();
  });

  it('constrói snapshot destacado de data/items/filtros antes de aguardar import/serialização', async () => {
    const actual = await vi.importActual<typeof import('../lib/relatorioLista66')>('../lib/relatorioLista66');
    mocks.criar.mockImplementation(actual.criarRelatorioLista66);
    const initial = props();
    const view = mount(initial);
    const running = view.click('xlsx');
    const [snapshot, visible, applied] = mocks.criar.mock.calls[0];
    expect(mocks.criar.mock.results[0].type).toBe('return');
    expect(snapshot).toBe(initial.data);
    expect(visible).toBe(initial.items);
    expect(visible[0]).toBe(snapshot.items[0]);
    expect(applied).toBe(initial.filtros);
    const destacado = mocks.criar.mock.results[0].value as RelatorioLista66;
    const antes = JSON.stringify(destacado);
    expect(visible.some((item: any) => item.kind === 'unavailable')).toBe(true);
    initial.filtros.busca = 'mudança após o clique';
    if (initial.data.items[0].kind === 'validated') initial.data.items[0].clienteNome = 'Outro';
    expect(JSON.stringify(destacado)).toBe(antes);
    expect(destacado.metadados.find(([key]) => key === 'Busca por cliente')?.[1]).toBe('');
    expect(destacado.linhas[0][1]).toContain('Cliente próprio');
    view.render(initial);
    await running;
    expect(anchor.click).not.toHaveBeenCalled();
    view.unmount();
  });

  it('modelo real preserva membership e conclui o download no clique válido', async () => {
    const actual = await vi.importActual<typeof import('../lib/relatorioLista66')>('../lib/relatorioLista66');
    mocks.criar.mockImplementation(actual.criarRelatorioLista66);
    const initial = props();
    const view = mount(initial);
    await view.click('xlsx');
    expect(mocks.criar.mock.results[0].type).toBe('return');
    expect(mocks.excel).toHaveBeenCalledTimes(1);
    expect(mocks.excel.mock.calls[0][0].linhas.map((row: unknown[]) => row[0])).toEqual([1, 42]);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(view.html()).toContain('Download de Excel (.xlsx) iniciado.');
    view.unmount();
  });

  it('trava por ref impede clique duplo e outro formato antes do próximo render', async () => {
    const gate = deferred<Uint8Array>();
    mocks.excel.mockReturnValue(gate.promise);
    const view = mount(props());
    const excel = view.button('xlsx').props.onClick;
    const pdf = view.button('pdf').props.onClick;
    const first = excel();
    await excel();
    await pdf();
    expect(mocks.criar).toHaveBeenCalledTimes(1);
    await waitForSerializer(mocks.excel);
    expect(mocks.pdf).not.toHaveBeenCalled();
    gate.resolve(new Uint8Array([1]));
    await first;
    expect(anchor.click).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('disabled do pai bloqueia inclusive handlers invocados diretamente', async () => {
    const view = mount({ ...props(), disabled: true });
    expect(view.button('xlsx').props.disabled).toBe(true);
    expect(view.button('pdf').props.disabled).toBe(true);
    await view.click('xlsx');
    await view.click('pdf');
    expect(mocks.criar).not.toHaveBeenCalled();
    expect(mocks.excel).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
    view.unmount();
  });

  it.each(['owner', 'busca', 'arquivo', 'modalidade', 'status', 'data', 'totais', 'items', 'disabled'] as const)('cancela geração em curso quando muda %s', async change => {
    const gate = deferred<Uint8Array>();
    mocks.excel.mockReturnValue(gate.promise);
    const initial = props();
    const view = mount(initial);
    const running = view.click('xlsx');
    await waitForSerializer(mocks.excel);
    const next = JSON.parse(JSON.stringify(initial)) as Props;
    if (change === 'owner') next.data.userId = 99;
    if (change === 'busca') next.filtros.busca = 'outro';
    if (change === 'arquivo') next.filtros.arquivo = 'historico';
    if (change === 'modalidade') next.filtros.modalidade = 'diario';
    if (change === 'status') next.filtros.statusObrigacao = 'quitado';
    if (change === 'data') next.data.coverage.scopedContracts = 3;
    if (change === 'totais') next.data.totals.values!.totalReceber = 70;
    if (change === 'items') next.items = [next.items[1]];
    if (change === 'disabled') next.disabled = true;
    view.render(next);
    const writes = view.stateWrites.mock.calls.length;
    gate.resolve(new Uint8Array([1]));
    await running;
    expect(blob).not.toHaveBeenCalled();
    expect(createUrl).not.toHaveBeenCalled();
    expect(anchor.click).not.toHaveBeenCalled();
    expect(view.stateWrites).toHaveBeenCalledTimes(writes);
    expect(view.html()).not.toContain('Download de');
    view.unmount();
  });

  it('protege render anterior ao effect e revisão A→B→A', async () => {
    const gate = deferred<Uint8Array>();
    mocks.pdf.mockReturnValue(gate.promise);
    const initial = props();
    const view = mount(initial);
    const running = view.click('pdf');
    await waitForSerializer(mocks.pdf);
    view.render({ ...initial, filtros: { ...initial.filtros, busca: 'novo' } }, false);
    view.render(initial, false);
    gate.resolve(new Uint8Array([1]));
    await running;
    expect(blob).not.toHaveBeenCalled();
    expect(anchor.click).not.toHaveBeenCalled();
    view.unmount();
  });

  it('objetos/arrays equivalentes e propriedades em outra ordem não cancelam geração', async () => {
    const gate = deferred<Uint8Array>();
    mocks.pdf.mockReturnValue(gate.promise);
    const initial = props();
    const view = mount(initial);
    const running = view.click('pdf');
    await waitForSerializer(mocks.pdf);
    const copy = JSON.parse(JSON.stringify(initial)) as Props;
    copy.items = copy.items.map(item => Object.fromEntries(Object.entries(item).reverse())) as Props['items'];
    copy.filtros = { statusObrigacao: 'todos', modalidade: 'todos', busca: '', arquivo: 'operacional' };
    view.render(copy);
    expect(view.button('pdf').props.disabled).toBe(true);
    gate.resolve(new Uint8Array([1]));
    await running;
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(view.html()).toContain('Download de PDF iniciado.');
    view.unmount();
  });

  it.each(['blob', 'append'] as const)('confere vigência novamente depois de %s e antes do clique', async point => {
    const initial = props();
    const view = mount(initial);
    const invalidate = () => view.render({ ...initial, data: { ...initial.data, userId: 99 } });
    if (point === 'blob') blob.mockImplementationOnce(function (this: any) { invalidate(); });
    if (point === 'append') append.mockImplementationOnce(invalidate);
    await view.click('pdf');
    expect(anchor.click).not.toHaveBeenCalled();
    if (point === 'blob') expect(createUrl).not.toHaveBeenCalled();
    else {
      expect(anchor.remove).toHaveBeenCalledTimes(1);
      expect(revokeUrl).toHaveBeenCalledWith('blob:lista66');
    }
    view.unmount();
  });

  it('rejeição de geração do owner anterior não publica erro na nova sessão', async () => {
    const gate = deferred<Uint8Array>();
    mocks.pdf.mockReturnValue(gate.promise);
    const initial = props();
    const view = mount(initial);
    const oldHandler = view.button('pdf').props.onClick;
    const running = oldHandler();
    await waitForSerializer(mocks.pdf);
    view.render({ ...initial, data: { ...initial.data, userId: 99 } });
    await oldHandler();
    expect(mocks.criar).toHaveBeenCalledTimes(1);
    const writes = view.stateWrites.mock.calls.length;
    gate.reject(new Error('segredo da sessão anterior'));
    await running;
    expect(view.stateWrites).toHaveBeenCalledTimes(writes);
    expect(view.html()).not.toContain('Não foi possível');
    expect(blob).not.toHaveBeenCalled();
    view.unmount();
  });

  it.each(['resolve', 'reject'] as const)('desmontagem antes de %s não baixa nem chama setters', async outcome => {
    const gate = deferred<Uint8Array>();
    mocks.excel.mockReturnValue(gate.promise);
    const view = mount(props());
    const running = view.click('xlsx');
    await waitForSerializer(mocks.excel);
    view.unmount();
    if (outcome === 'resolve') gate.resolve(new Uint8Array([1]));
    else gate.reject(new Error('segredo owner 41'));
    await running;
    expect(blob).not.toHaveBeenCalled();
    expect(anchor.click).not.toHaveBeenCalled();
    expect(view.writesAfterUnmount).not.toHaveBeenCalled();
  });

  it('desmontagem imediata cancela antes de chamar serializador após import', async () => {
    const view = mount(props());
    const running = view.click('pdf');
    view.unmount();
    await running;
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(blob).not.toHaveBeenCalled();
    expect(view.writesAfterUnmount).not.toHaveBeenCalled();
  });

  it('resposta velha não libera trava nem substitui status de uma nova geração', async () => {
    const old = deferred<Uint8Array>();
    const fresh = deferred<Uint8Array>();
    mocks.excel.mockReturnValue(old.promise);
    mocks.pdf.mockReturnValue(fresh.promise);
    const initial = props();
    const view = mount(initial);
    const first = view.click('xlsx');
    await waitForSerializer(mocks.excel);
    view.render({ ...initial, filtros: { ...initial.filtros, busca: 'novo' } });
    const second = view.click('pdf');
    await waitForSerializer(mocks.pdf);
    old.resolve(new Uint8Array([1]));
    await first;
    expect(view.html()).toContain('Gerando arquivo PDF');
    expect(view.button('xlsx').props.disabled).toBe(true);
    expect(anchor.click).not.toHaveBeenCalled();
    fresh.resolve(new Uint8Array([2]));
    await second;
    expect(anchor.download).toBe('emprestimos-lista-parcial.pdf');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it.each(['modelo', 'serializador', 'blob', 'url', 'append', 'click', 'remove', 'timer'] as const)('erro em %s é genérico, desbloqueia e limpa URL/link quando criados', async stage => {
    const secret = new Error('nome privado; userId 41; stack interno');
    const fail = () => { throw secret; };
    if (stage === 'modelo') mocks.criar.mockImplementationOnce(fail);
    if (stage === 'serializador') mocks.excel.mockRejectedValueOnce(secret);
    if (stage === 'blob') blob.mockImplementationOnce(fail);
    if (stage === 'url') createUrl.mockImplementationOnce(fail);
    if (stage === 'append') append.mockImplementationOnce(fail);
    if (stage === 'click') anchor.click.mockImplementationOnce(fail);
    if (stage === 'remove') anchor.remove.mockImplementationOnce(fail);
    const timerSpy = stage === 'timer' ? vi.spyOn(globalThis, 'setTimeout').mockImplementationOnce(fail) : undefined;
    const view = mount(props());
    await view.click('xlsx');
    timerSpy?.mockRestore();
    const html = view.html();
    expect(html).toContain('Não foi possível gerar o arquivo. Tente novamente.');
    expect(html).toContain('role="status"');
    expect(html).not.toMatch(/nome privado|userId|stack interno/);
    expect(view.button('xlsx').props.disabled).toBe(false);
    if (['append', 'click', 'remove', 'timer'].includes(stage)) expect(revokeUrl).toHaveBeenCalledWith('blob:lista66');
    if (['append', 'click', 'remove'].includes(stage)) expect(anchor.remove).toHaveBeenCalled();
    // A trava é liberada inclusive para erro síncrono de construção.
    await view.click('pdf');
    expect(mocks.pdf).toHaveBeenCalledTimes(1);
    expect(view.html()).toContain('Download de PDF iniciado.');
    view.unmount();
  });

  it('limpeza agendada após sucesso não chama setters depois da desmontagem', async () => {
    const view = mount(props());
    await view.click('pdf');
    view.unmount();
    vi.advanceTimersByTime(1000);
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(view.writesAfterUnmount).not.toHaveBeenCalled();
  });

  it('fronteira estática: import pesado só no handler; sem query/rede/storage/print/escrita', () => {
    // URL global está simulado no teste: construtor real é obtido do módulo Node.
    const src = readFileSync(new NodeURL('./ExportarLista66.tsx', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('ExportarLista66.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const staticImports = ast.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.getText(ast));
    expect(staticImports.join('\n')).not.toContain('exportarLista66');
    const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ExportarLista66') as ts.FunctionDeclaration;
    const handler = component.body!.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'exportar')) as ts.VariableStatement;
    expect(handler.getText(ast)).toContain("await import('@/lib/exportarLista66')");
    expect(handler.getText(ast).indexOf('criarRelatorioLista66(')).toBeLessThan(handler.getText(ast).indexOf('await import('));
    expect(src).not.toMatch(/useQuery|trpc|useMutation|fetch\s*\(|axios|localStorage|sessionStorage|window\.print|navigator\.share|upload|XMLHttpRequest/);
    expect(src).toContain('Uint8Array.from(bytes).buffer');
    expect(src).toContain('emprestimos-lista-parcial.${formato}');
  });
});
