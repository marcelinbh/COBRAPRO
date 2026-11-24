import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { QueryClient } from '@tanstack/react-query';
import { DespesasIntentStore, diaCivilBrt, type AcaoDespesa } from '../../../shared/despesasIntent';

const h = vi.hoisted(() => ({
  current: null as any, user: null as any, authError: false, authLoading: false,
  cache: null as any, read: vi.fn(), create: vi.fn(), pay: vi.fn(), reverse: vi.fn(), reconcile: vi.fn(),
  invalidate: vi.fn(), success: vi.fn(), error: vi.fn(), network: vi.fn(), owners: 16000,
  queryCalls: [] as any[],
}));
// Mesmo harness de hooks em memória dos testes de recovery existentes; sem DOM/browser.
vi.mock('react', async original => {
  const actual = await original<typeof React>();
  return { ...actual,
    useState: (initial: any) => {
      const r = h.current, i = r.cursor++;
      if (!(i in r.values)) r.values[i] = typeof initial === 'function' ? initial() : initial;
      return [r.values[i], (next: any) => {
        r.values[i] = typeof next === 'function' ? next(r.values[i]) : next; r.dirty = true; r.writes++;
      }];
    },
    useRef: (initial: any) => { const r = h.current, i = r.cursor++; return r.values[i] ?? (r.values[i] = { current: initial }); },
    useMemo: (fn: any, deps: any[]) => {
      const r = h.current, i = r.cursor++;
      if (!r.deps[i] || deps.some((v, n) => v !== r.deps[i][n])) { r.values[i] = fn(); r.deps[i] = deps; }
      return r.values[i];
    },
    useEffect: (fn: any, deps: any[]) => {
      const r = h.current, i = r.cursor++;
      if (!r.deps[i] || deps.some((v, n) => v !== r.deps[i][n])) {
        r.effects.push(() => { r.cleanups[i]?.(); r.cleanups[i] = fn(); }); r.deps[i] = deps;
      }
    },
  };
});
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
vi.mock('@/components/ui/input', () => ({ Input: 'input' }));
vi.mock('@/components/ui/textarea', () => ({ Textarea: 'textarea' }));
vi.mock('@/components/ui/label', () => ({ Label: 'label' }));
vi.mock('@/components/ui/card', () => ({ Card: 'article', CardContent: 'div' }));
vi.mock('@/components/ui/badge', () => ({ Badge: 'span' }));
vi.mock('@/components/ui/dialog', () => ({ Dialog: 'dialog', DialogContent: 'div', DialogHeader: 'header', DialogTitle: 'h2' }));
vi.mock('@/components/ui/select', () => ({ Select: 'select', SelectContent: 'div', SelectItem: 'option', SelectTrigger: 'div', SelectValue: 'span' }));
vi.mock('sonner', () => ({ toast: { success: h.success, error: h.error } }));
vi.mock('@/lib/trpc', async () => {
  const hooks = await import('react');
  const { QueryObserver, hashKey } = await import('@tanstack/react-query');
  const query = (name: string) => ({ useQuery: (input: any, options: any) => {
    const owner = h.user?.id;
    const queryKey = [name === 'contas' ? ['caixa', 'contasParaOperacao37'] : ['contasPagar', name], { ...(input ? { input } : {}), type: 'query' }];
    const opts = { ...options, queryKey, queryFn: () => h.read(name, input, owner) };
    h.queryCalls.push({ name, input, owner, options, queryKey });
    const queryHash = options.queryKeyHashFn?.(queryKey) ?? hashKey(queryKey);
    const observer = hooks.useMemo(() => new QueryObserver(h.cache, opts), [queryHash]);
    const r = h.current;
    hooks.useEffect(() => {
      const unsubscribe = observer.subscribe(() => { r.dirty = true; });
      return () => { unsubscribe(); observer.destroy(); };
    }, [observer]);
    return observer.getCurrentResult();
  } });
  const utils = new Proxy({}, { get: () => new Proxy({}, { get: () => ({ invalidate: h.invalidate }) }) });
  return { trpc: {
    auth: { me: { useQuery: () => ({ data: h.user, isError: h.authError, isLoading: h.authLoading }) } },
    useUtils: () => utils, caixa: { contasParaOperacao37: query('contas') },
    contasPagar: {
      resumo: query('resumo'), listar: query('listar'), capacidades: query('capacidades'),
      criar: { useMutation: () => ({ mutateAsync: h.create }) },
      pagar: { useMutation: () => ({ mutateAsync: h.pay }) },
      estornar: { useMutation: () => ({ mutateAsync: h.reverse }) },
      reconciliar: { useMutation: () => ({ mutateAsync: h.reconcile }) },
    },
  } };
});
import ContasPagar from './ContasPagar';

class HarnessReact {
  values: any[] = []; deps: any[] = []; cleanups: any[] = []; effects: any[] = [];
  cursor = 0; dirty = true; tree: any; writes = 0; frames: any[] = [];
  render() {
    let n = 0;
    do {
      this.dirty = false; this.cursor = 0; h.current = this; this.tree = ContasPagar(); this.frames.push(this.tree);
      this.effects.splice(0).forEach(f => f());
      if (++n > 30) throw new Error('Loop de render');
    } while (this.dirty);
    return this;
  }
  async flush() { for (let i = 0; i < 24; i++) { await Promise.resolve(); if (this.dirty) this.render(); } return this; }
  unmount() { this.cleanups.forEach(f => f?.()); this.dirty = false; }
  nodes(type?: string, root = this.tree) {
    const list: any[] = [];
    const walk = (n: any) => {
      if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== 'object') return;
      if (!type || n.type === type) list.push(n); walk(n.props?.children);
    };
    walk(root); return list;
  }
  text(n: any = this.tree): string {
    const walk = (v: any): string => v == null || typeof v === 'boolean' ? '' : Array.isArray(v) ? v.map(walk).join(' ') : typeof v === 'object' ? walk(v.props?.children) : String(v);
    return walk(n);
  }
  button(fragment: string, root = this.tree) {
    const node = this.nodes('button', root).find(n => this.text(n).includes(fragment));
    if (!node) throw new Error(`Botão ausente: ${fragment}`); return node;
  }
  async click(fragment: string, root = this.tree) {
    const n = this.button(fragment, root);
    if (n.props.disabled) throw new Error(`Botão desabilitado: ${fragment}`);
    // Handlers da página enviam void; não aguardar a RPC pendente.
    n.props.onClick(); this.render(); await this.flush();
  }
  field(id: string) { return this.nodes().find(n => n.props?.id === id); }
  change(node: any, value: string) {
    node.props.onChange ? node.props.onChange({ target: { value } }) : node.props.onValueChange(value); this.render();
  }
  dialog(title: string) { return this.nodes('dialog').find(n => this.text(n).includes(title)); }
}
function deferred<T = any>() {
  let resolve!: (v: T) => void, reject!: (e: Error) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject };
}
const key = '11111111-1111-4111-8111-111111111111';
const op = '22222222-2222-4222-8222-222222222222';
const storeKey = (owner: number, action: AcaoDespesa) => `cobrapro:despesas:0020:v1:user:${owner}:action:${action}`;
const rows = (owner: number) => [
  { id: 101, descricao: `Pendente owner ${owner}`, valor: '50.01', categoria: 'energia', dataVencimento: '2026-11-10', status: 'pendente', podePagar: true },
  { id: 102, descricao: `Paga owner ${owner}`, valor: '25.02', categoria: 'outros', dataVencimento: '2026-11-10', status: 'paga', podeEstornar: true, pagamentoOperationId: op, contaCaixaId: 1, transacaoSaidaId: '3' },
];
const accounts = (owner: number) => ({ empresaId: owner, contas: [1, 2].map(id => ({ id, nome: `Conta ${id} owner ${owner}`, tipo: 'caixa' })) });
const summary = { totalPendente: '50.01', qtdPendente: 1, totalAtrasado: '0.00', qtdAtrasado: 0, totalPago: '25.02', qtdPago: 1 };
const confirmation = (owner: number, action: string, input: any) => ({ success: true, userId: owner, acao: action, chaveIdempotencia: input.idempotencyKey, operationId: op });
const proof = (owner: number, request: any) => ({ ...request, userId: owner, payloadHash: 'b'.repeat(64), proof: 'uuid_fenced_v1', status: 'not_executed', fenceId: op, result: null, quote: null });
let data: Map<string, string>, storage: any, ui: HarnessReact;
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('React', React); h.owners += 10; h.user = { id: h.owners }; h.authError = false; h.authLoading = false; h.queryCalls = [];
  h.cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  data = new Map();
  storage = { getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string, v: string) => data.set(k, v)), removeItem: vi.fn((k: string) => data.delete(k)) };
  vi.stubGlobal('window', { sessionStorage: storage }); vi.stubGlobal('crypto', { randomUUID: () => key });
  h.network.mockImplementation(() => { throw new Error('Rede proibida neste harness'); }); vi.stubGlobal('fetch', h.network);
  h.read.mockImplementation(async (name: string, _input: any, owner: number) => name === 'listar' ? rows(owner) : name === 'contas' ? accounts(owner) : name === 'capacidades' ? { prospectivasHabilitadas: true } : summary);
  h.invalidate.mockResolvedValue(undefined);
  for (const m of [h.create, h.pay, h.reverse]) m.mockRejectedValue(new Error('timeout sintético'));
  h.reconcile.mockImplementation(async request => proof(h.user.id, request));
});
afterEach(() => { ui?.unmount(); h.cache.clear(); expect(h.network).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
async function mount() { ui = new HarnessReact().render(); await ui.flush(); return ui; }
async function switchOwner(owner: number | null) { h.user = owner ? { id: owner } : null; ui.render(); await ui.flush(); }
function fill(description = 'Formulário sessão antiga') {
  ui.change(ui.field('despesa-descricao'), description);
  ui.change(ui.nodes('select', ui.dialog('Nova despesa avulsa'))[0], 'energia');
  ui.change(ui.field('despesa-valor'), '125,47');
  ui.change(ui.field('despesa-vencimento'), '2027-02-03');
  ui.change(ui.field('despesa-observacoes'), 'Observações antigas');
}
function expectFresh() {
  expect(ui.field('despesa-descricao').props.value).toBe(''); expect(ui.field('despesa-valor').props.value).toBe('');
  expect(ui.field('despesa-vencimento').props.value).toBe(diaCivilBrt()); expect(ui.field('despesa-observacoes').props.value).toBe('');
  expect(ui.nodes('select', ui.dialog('Nova despesa avulsa'))[0].props.value).toBe('outros');
  expect(ui.field('despesa-motivo').props.value).toBe('');
  expect(ui.nodes('select', ui.dialog('Registrar pagamento'))[0].props.value).toBe('');
}
function begin(owner: number, action: AcaoDespesa = 'pagar') {
  const s = new DespesasIntentStore(owner, storage, vi.fn(), () => key);
  return s.begin(action, action === 'pagar' ? { id: 101, contaCaixaId: 1, dataPagamento: '2026-11-10' } : { descricao: 'Intenção antiga', categoria: 'outros', valor: '50.00', dataVencimento: '2026-11-10', observacoes: '' });
}

describe('ContasPagar: isolamento local entre sessões, interação sem navegador/rede', () => {
  it('troca owner com todos os campos, modais, conta e filtro antigos: nenhuma cópia nem frame antigo', async () => {
    await mount(); const old = h.user.id;
    await ui.click('Nova despesa'); fill(); await ui.click('Registrar pagamento atômico');
    ui.change(ui.nodes('select', ui.dialog('Registrar pagamento'))[0], '2');
    await ui.click('Estornar pagamento original'); ui.change(ui.field('despesa-motivo'), 'Motivo antigo');
    const filter = ui.nodes('button').find(n => ui.text(n) === 'Paga');
    filter.props.onClick(); ui.render(); await ui.flush();
    const frames = ui.frames.length; await switchOwner(old + 1);
    expect(ui.nodes('dialog').every(n => !n.props.open)).toBe(true); expectFresh();
    expect(ui.text()).not.toContain(`owner ${old}`); expect(ui.text()).toContain(`owner ${old + 1}`);
    for (const frame of ui.frames.slice(frames)) {
      expect(ui.text(frame)).not.toContain(`owner ${old}`);
      expect(ui.nodes('input', frame).some(n => n.props.value === 'Formulário sessão antiga')).toBe(false);
    }
    expect(h.queryCalls.filter(q => q.name === 'listar').at(-1).input).toBeUndefined();
    await ui.click('Nova despesa'); expectFresh();
    // Mesmo chamando um submit desabilitado/adversarialmente, formulário vazio não gera intenção.
    ui.button('Criar despesa atômica').props.onClick(); await ui.flush(); expect(h.create).not.toHaveBeenCalled(); expect(data.size).toBe(0);
    fill('Despesa escolhida na sessão atual'); await ui.click('Criar despesa atômica');
    expect(h.create).toHaveBeenCalledOnce(); expect(h.create.mock.calls[0][0].descricao).toBe('Despesa escolhida na sessão atual');
    expect(data.has(storeKey(old, 'criar'))).toBe(false); expect(data.has(storeKey(old + 1, 'criar'))).toBe(true);
  });

  it('cache compartilhado e respostas tardias de listar/resumo/contas/capacidades não habilitam nova sessão', async () => {
    const old = h.user.id, waits = Object.fromEntries(['listar', 'resumo', 'contas', 'capacidades'].map(n => [n, deferred()]));
    // Dados antigos no cache global (chaves reais tRPC, sem owner) não podem ser adotados no mount.
    h.cache.setQueryData([['contasPagar', 'listar'], { type: 'query' }], rows(old - 1));
    h.cache.setQueryData([['caixa', 'contasParaOperacao37'], { type: 'query' }], accounts(old - 1));
    h.cache.setQueryData([['contasPagar', 'capacidades'], { type: 'query' }], { prospectivasHabilitadas: true });
    h.read.mockImplementation((name: string, _input: any, owner: number) => owner === old ? waits[name].promise : Promise.resolve(name === 'listar' ? rows(owner) : name === 'contas' ? accounts(owner) : name === 'capacidades' ? { prospectivasHabilitadas: false } : { ...summary, totalPendente: '9.99' }));
    await mount(); expect(ui.text()).not.toContain(`owner ${old - 1}`); expect(ui.button('Nova despesa').props.disabled).toBe(true);
    const firstHashes = h.queryCalls.slice(0, 4).map(q => q.options.queryKeyHashFn(q.queryKey));
    await switchOwner(old + 1);
    const current = h.queryCalls.filter(q => q.owner === old + 1).slice(0, 4);
    expect(current.every(q => !firstHashes.includes(q.options.queryKeyHashFn(q.queryKey)))).toBe(true);
    for (const q of current) {
      expect(q.options.retry).toBe(false); expect(q.options.trpc.abortOnUnmount).toBe(true); expect(q.options.gcTime).toBe(0);
      expect(q.options.initialData).toBeUndefined(); expect(q.options.placeholderData).toBeUndefined(); expect(q.input).toBeUndefined();
    }
    waits.listar.resolve(rows(old)); waits.contas.resolve(accounts(old)); waits.resumo.resolve({ ...summary, totalPendente: '777.77' }); waits.capacidades.resolve({ prospectivasHabilitadas: true });
    await ui.flush(); expect(ui.text()).not.toContain(`owner ${old}`); expect(ui.text()).not.toContain('R$ 777,77');
    expect(ui.text()).toContain('R$ 9,99'); expect(ui.button('Nova despesa').props.disabled).toBe(true);
    // flag/guard seguem bloqueando mesmo se o handler for chamado diretamente.
    ui.button('Nova despesa').props.onClick(); ui.render(); fill('Tentativa com flag desligada');
    ui.button('Criar despesa atômica').props.onClick(); await ui.flush(); expect(h.create).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });

  it.each([null, 'error', 'loading'] as const)('perda de sessão (%s) limpa UI e oculta dados; retornar ao mesmo owner não restaura formulário/cache', async loss => {
    await mount(); const old = h.user.id; const firstHash = h.queryCalls[0].options.queryKeyHashFn(h.queryCalls[0].queryKey);
    await ui.click('Nova despesa'); fill();
    if (loss === null) h.user = null; else if (loss === 'error') h.authError = true; else h.authLoading = true;
    ui.render(); await ui.flush(); expect(ui.text()).not.toContain(`owner ${old}`); expect(ui.nodes('dialog').every(n => !n.props.open)).toBe(true);
    expect(ui.button('Nova despesa').props.disabled).toBe(true); expect(ui.field('despesa-descricao').props.value).toBe('');
    h.authError = false; h.authLoading = false; await switchOwner(old);
    const q = h.queryCalls.filter(q => q.owner === old && q.name === 'resumo').at(-1); expect(q.options.queryKeyHashFn(q.queryKey)).not.toBe(firstHash);
    await ui.click('Nova despesa'); expectFresh(); expect(h.create).not.toHaveBeenCalled();
  });

  it.each(['confirmed', 'timeout', 'incompatible'] as const)('pagamento pendente antigo (%s) não fecha formulário novo nem libera inFlight de nova RPC', async outcome => {
    const old = h.user.id, oldResponse = deferred(), newResponse = deferred();
    h.pay.mockReturnValueOnce(oldResponse.promise); h.create.mockReturnValueOnce(newResponse.promise);
    await mount(); await ui.click('Registrar pagamento atômico'); ui.change(ui.nodes('select', ui.dialog('Registrar pagamento'))[0], '2');
    await ui.click('Confirmar baixa integral'); const original = h.pay.mock.calls[0][0];
    const oldRetry = ui.button('Reenviar intenção original').props.onClick;
    await switchOwner(old + 1); await ui.click('Nova despesa'); fill('Formulário novo preservado'); await ui.click('Criar despesa atômica');
    const fresh = h.create.mock.calls[0][0]; expect(fresh.descricao).toBe('Formulário novo preservado');
    const writes = ui.writes;
    if (outcome === 'timeout') oldResponse.reject(new Error('Timeout antigo privado'));
    else oldResponse.resolve(confirmation(outcome === 'incompatible' ? old + 1 : old, 'pagar', original));
    await ui.flush(); expect(ui.writes).toBe(writes); expect(ui.dialog('Nova despesa avulsa').props.open).toBe(true);
    expect(ui.field('despesa-descricao').props.value).toBe('Formulário novo preservado'); expect(ui.button('Aguardando confirmação').props.disabled).toBe(true);
    expect(h.success).not.toHaveBeenCalled(); expect(h.error).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled();
    oldRetry(); ui.button('Aguardando confirmação').props.onClick(); await ui.flush();
    expect(h.pay).toHaveBeenCalledOnce(); expect(h.create).toHaveBeenCalledOnce();
    expect(data.has(storeKey(old, 'pagar'))).toBe(outcome !== 'confirmed'); expect(data.has(storeKey(old + 1, 'criar'))).toBe(true);
    newResponse.reject(new Error('Timeout atual')); await ui.flush();
    expect(ui.button('Reenviar intenção original').props.disabled).toBe(false);
    h.create.mockRejectedValueOnce(new Error('Timeout replay')); await ui.click('Reenviar intenção original');
    expect(h.create.mock.calls[1][0]).toEqual(fresh);
  });

  it('recovery antigo já comprovado é limpo sem descartar intenção; sessão atual exige sua própria prova e escolha explícita', async () => {
    const old = h.user.id; begin(old); await mount(); await ui.click('Reconciliar UUID');
    expect(ui.text()).toContain('Não execução comprovada'); const staleClose = ui.button('Encerrar após').props.onClick;
    begin(old + 1); await switchOwner(old + 1);
    expect(ui.text()).not.toContain('Não execução comprovada'); expect(ui.text()).not.toContain('Encerrar após');
    expect(ui.button('Reenviar intenção original').props.disabled).toBe(false); staleClose(); await ui.flush();
    expect(data.has(storeKey(old, 'pagar'))).toBe(true); expect(data.has(storeKey(old + 1, 'pagar'))).toBe(true);
    await ui.click('Reconciliar UUID'); expect(ui.button('Reenviar intenção original').props.disabled).toBe(true);
    // O mesmo UUID usado propositalmente nos dois owners não transporta sua prova.
    await ui.click('Encerrar após'); expect(data.has(storeKey(old + 1, 'pagar'))).toBe(false); expect(data.has(storeKey(old, 'pagar'))).toBe(true);
    expect(h.pay).not.toHaveBeenCalled();
  });

  it.each(['not_executed', 'timeout'] as const)('reconciliação pendente antiga (%s) não injeta recovery nem destrava requisição atual', async outcome => {
    const old = h.user.id, response = deferred(), currentResponse = deferred(); begin(old);
    h.reconcile.mockReturnValueOnce(response.promise); await mount(); await ui.click('Reconciliar UUID'); const request = h.reconcile.mock.calls[0][0];
    begin(old + 1); h.reconcile.mockReturnValueOnce(currentResponse.promise); await switchOwner(old + 1); await ui.click('Reconciliar UUID');
    const writes = ui.writes;
    if (outcome === 'timeout') response.reject(new Error('Erro antigo')); else response.resolve(proof(old, request));
    await ui.flush(); expect(ui.writes).toBe(writes); expect(ui.text()).not.toContain('Não execução comprovada');
    expect(ui.button('Reconciliar UUID').props.disabled).toBe(true); expect(h.error).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled();
    expect(data.has(storeKey(old, 'pagar'))).toBe(true); expect(data.has(storeKey(old + 1, 'pagar'))).toBe(true);
    currentResponse.resolve(proof(old + 1, h.reconcile.mock.calls[1][0])); await ui.flush(); expect(ui.text()).toContain('Não execução comprovada');
  });

  it('A -> B -> A ignora confirmação do A antigo e conserva o lock/idempotência da operação original', async () => {
    const old = h.user.id, response = deferred(); h.create.mockReturnValueOnce(response.promise);
    await mount(); await ui.click('Nova despesa'); fill('Operação de A original'); await ui.click('Criar despesa atômica');
    const original = h.create.mock.calls[0][0]; await switchOwner(old + 1); await switchOwner(old);
    expect(ui.field('despesa-descricao').props.value).toBe(''); expect(ui.dialog('Nova despesa avulsa').props.open).toBe(false);
    await ui.click('Reenviar intenção original'); expect(h.create).toHaveBeenCalledOnce(); // lock global de owner/ação ainda em curso.
    const writes = ui.writes; response.resolve(confirmation(old, 'criar', original)); await ui.flush();
    expect(ui.writes).toBe(writes); expect(h.success).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled();
    expect(data.has(storeKey(old, 'criar'))).toBe(false);
  });

  it('falha ao remover intenção confirmada da sessão antiga não vaza avisoStorage; confirmação atual mantém guards e invalida leituras', async () => {
    const old = h.user.id, response = deferred(); h.pay.mockReturnValueOnce(response.promise);
    await mount(); await ui.click('Registrar pagamento atômico'); ui.change(ui.nodes('select', ui.dialog('Registrar pagamento'))[0], '1'); await ui.click('Confirmar baixa integral');
    const original = h.pay.mock.calls[0][0]; await switchOwner(old + 1); await ui.click('Nova despesa'); fill('Dados atuais');
    storage.removeItem.mockImplementationOnce(() => { throw new Error('quota antiga'); });
    response.resolve(confirmation(old, 'pagar', original)); await ui.flush();
    expect(ui.text()).not.toContain('Operação confirmada, mas intenção'); expect(h.error).not.toHaveBeenCalled(); expect(data.has(storeKey(old, 'pagar'))).toBe(true);
    h.create.mockImplementationOnce(async input => confirmation(old + 1, 'criar', input)); await ui.click('Criar despesa atômica');
    expect(h.success).toHaveBeenCalledOnce(); expect(h.invalidate).toHaveBeenCalledTimes(5); expect(ui.dialog('Nova despesa avulsa').props.open).toBe(false);
    expect(data.has(storeKey(old + 1, 'criar'))).toBe(false); expectFresh();
  });

  it.each(['criar', 'estornar'] as const)('%s pendente antigo não altera modais, conta ou motivo escolhidos no owner novo', async action => {
    const old = h.user.id, response = deferred(), currentResponse = deferred();
    const mutation = action === 'criar' ? h.create : h.reverse; mutation.mockReturnValueOnce(response.promise);
    await mount();
    if (action === 'criar') { await ui.click('Nova despesa'); fill('Criação anterior'); await ui.click('Criar despesa atômica'); }
    else { await ui.click('Estornar pagamento original'); ui.change(ui.field('despesa-motivo'), 'Motivo anterior'); await ui.click('Confirmar estorno do mesmo valor'); }
    const original = mutation.mock.calls[0][0]; await switchOwner(old + 1);
    await ui.click('Nova despesa'); fill('Rascunho do owner atual');
    await ui.click('Registrar pagamento atômico'); ui.change(ui.nodes('select', ui.dialog('Registrar pagamento'))[0], '2');
    await ui.click('Estornar pagamento original'); ui.change(ui.field('despesa-motivo'), 'Motivo escolhido agora');
    const writes = ui.writes; response.resolve(confirmation(old, action, original)); await ui.flush();
    expect(ui.writes).toBe(writes); expect(ui.nodes('dialog').every(n => n.props.open)).toBe(true);
    expect(ui.field('despesa-descricao').props.value).toBe('Rascunho do owner atual');
    expect(ui.field('despesa-motivo').props.value).toBe('Motivo escolhido agora');
    expect(ui.nodes('select', ui.dialog('Registrar pagamento'))[0].props.value).toBe('2');
    expect(h.success).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled();
    h.pay.mockReturnValueOnce(currentResponse.promise); await ui.click('Confirmar baixa integral');
    expect(h.pay).toHaveBeenCalledOnce(); expect(h.pay.mock.calls[0][0]).toMatchObject({ id: 101, contaCaixaId: 2 });
    currentResponse.reject(new Error('timeout atual')); await ui.flush();
    expect(data.has(storeKey(old, action))).toBe(false); expect(data.has(storeKey(old + 1, 'pagar'))).toBe(true);
  });
});

describe('B1/B2: regressões privadas sobre a página REAL, sem browser', () => {
  function gateOff(capabilityError = false) {
    h.read.mockImplementation(async (name: string, _input: any, owner: number) => {
      if (name === 'capacidades' && capabilityError) throw new Error('capacidade sintética indisponível');
      return name === 'listar' ? rows(owner) : name === 'contas' ? accounts(owner) : name === 'capacidades' ? { prospectivasHabilitadas: false } : summary;
    });
  }
  function beginOriginal(owner: number, action: 'pagar' | 'estornar') {
    const s = new DespesasIntentStore(owner, storage, vi.fn(), () => key);
    return s.begin(action, action === 'pagar' ? { id: 101, contaCaixaId: 1, dataPagamento: '2026-11-10' } : { id: 102, pagamentoOperationId: op, dataEstorno: '2026-11-11', motivo: 'Devolução sintética' });
  }
  it.each(['pagar','estornar'] as const)('gateOFF habilita SOMENTE recovery %s existente, mantém writes/reenvio bloqueados', async action => {
    const owner = h.user.id, original = beginOriginal(owner,action); gateOff(); await mount();
    expect(ui.button('Nova despesa').props.disabled).toBe(true);
    expect(ui.button('Registrar pagamento atômico').props.disabled).toBe(true);
    expect(ui.button('Estornar pagamento original').props.disabled).toBe(true);
    expect(ui.button('Reenviar intenção original').props.disabled).toBe(true);
    expect(ui.button('Reconciliar UUID').props.disabled).toBe(false);
    // Chamada adversarial ao handler desabilitado também não deve sequer reenviar uma write.
    ui.button('Reenviar intenção original').props.onClick(); await ui.flush();
    expect(h.pay).not.toHaveBeenCalled(); expect(h.reverse).not.toHaveBeenCalled(); expect(h.create).not.toHaveBeenCalled();
    await ui.click('Reconciliar UUID');
    expect(h.reconcile).toHaveBeenCalledTimes(1); expect(h.reconcile).toHaveBeenCalledWith({ family: `despesa_${action}`, idempotencyKey: original.idempotencyKey, payload: original.payload });
    expect(data.has(storeKey(owner,action))).toBe(true); expect(ui.text()).toContain('Não execução comprovada');
    expect(ui.button('Reenviar intenção original').props.disabled).toBe(true);
    await ui.click('Encerrar após'); expect(data.has(storeKey(owner,action))).toBe(false); expect(ui.button('Nova despesa').props.disabled).toBe(true);
    expect(h.pay).not.toHaveBeenCalled(); expect(h.reverse).not.toHaveBeenCalled(); expect(h.create).not.toHaveBeenCalled();
  });
  it('capacidade indisponível não barra recovery existente; nenhum resend', async () => {
    beginOriginal(h.user.id,'pagar'); gateOff(true); await mount();
    expect(ui.text()).toContain('Escritas bloqueadas'); expect(ui.button('Nova despesa').props.disabled).toBe(true);
    expect(ui.button('Reconciliar UUID').props.disabled).toBe(false); await ui.click('Reconciliar UUID'); expect(h.reconcile).toHaveBeenCalledOnce(); expect(h.pay).not.toHaveBeenCalled();
  });
  it('gateOFF recovery confirmed remove apenas intenção original, zero writers', async () => {
    const owner=h.user.id; beginOriginal(owner,'pagar'); gateOff();
    h.reconcile.mockImplementation(async request => ({ ...proof(owner,request), status: 'confirmed', fenceId: null, result: { operationId: op } }));
    await mount(); await ui.click('Reconciliar UUID');
    expect(data.has(storeKey(owner,'pagar'))).toBe(false); expect(h.success).toHaveBeenCalledWith(expect.stringContaining('nenhuma nova operação enviada'));
    expect(h.pay).not.toHaveBeenCalled(); expect(h.create).not.toHaveBeenCalled(); expect(h.reverse).not.toHaveBeenCalled();
  });
  it('resumo inconclusivo pinta erro explícito sem cards de zero', async () => {
    h.read.mockImplementation(async (name: string,_input: any,owner: number) => {
      if (name==='resumo') throw new Error('Status histórico inválido; resumo requer conferência, não será subcontado como zero.');
      return name==='listar'?rows(owner):name==='contas'?accounts(owner):{prospectivasHabilitadas:false};
    });
    await mount(); expect(ui.text()).toContain('Resumo indisponível:'); expect(ui.text()).toContain('Status histórico inválido'); expect(ui.text()).not.toContain('R$ 0,00'); expect(ui.text()).toContain(`owner ${h.user.id}`);
  });
  it.each(['not_executed','confirmed','timeout'] as const)('gateOFF recovery A→B→A (%s) antigo não injeta proof, fecha intenção ou libera novo inFlight', async outcome => {
    const a=h.user.id, b=a+1, response=deferred(), fresh=deferred(); beginOriginal(a,'pagar'); beginOriginal(b,'pagar'); gateOff();
    h.reconcile.mockReturnValueOnce(response.promise).mockReturnValueOnce(fresh.promise);
    await mount(); await ui.click('Reconciliar UUID'); const original=h.reconcile.mock.calls[0][0]; const stale=ui.button('Reconciliar UUID').props.onClick;
    await switchOwner(b); expect(ui.text()).not.toContain(`owner ${a}`); await switchOwner(a);
    // A antigo mantém lock owner/ação mesmo após A→B→A. Não nasce chamada duplicada.
    await ui.click('Reconciliar UUID'); expect(h.reconcile).toHaveBeenCalledOnce();
    const writes=ui.writes;
    if(outcome==='timeout') response.reject(new Error('timeout antigo'));
    else response.resolve(outcome==='confirmed'?{...proof(a,original),status:'confirmed',fenceId:null,result:{operationId:op}}:proof(a,original));
    await ui.flush(); expect(ui.writes).toBe(writes); expect(h.success).not.toHaveBeenCalled(); expect(h.error).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled();
    expect(data.has(storeKey(a,'pagar'))).toBe(true); expect(data.has(storeKey(b,'pagar'))).toBe(true); expect(ui.text()).not.toContain('Não execução comprovada');
    stale(); await ui.flush(); expect(h.reconcile).toHaveBeenCalledOnce();
    await ui.click('Reconciliar UUID'); expect(h.reconcile).toHaveBeenCalledTimes(2); expect(ui.button('Reconciliar UUID').props.disabled).toBe(true);
    fresh.resolve(proof(a,h.reconcile.mock.calls[1][0])); await ui.flush(); expect(ui.text()).toContain('Não execução comprovada');
    expect(data.has(storeKey(a,'pagar'))).toBe(true); await ui.click('Encerrar após'); expect(data.has(storeKey(a,'pagar'))).toBe(false); expect(data.has(storeKey(b,'pagar'))).toBe(true);
    expect(h.pay).not.toHaveBeenCalled(); expect(h.create).not.toHaveBeenCalled(); expect(h.reverse).not.toHaveBeenCalled();
  });
});
