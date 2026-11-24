import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

// Padrão MemoryUI vigente em recebimentoValidado.ui.test.ts: componente real,
// handlers/effects/cleanups reais; hooks, primitivas e fronteira tRPC em memória.
const h = vi.hoisted(() => ({
  current: null as any, user: { id: 6001 } as any, history: {} as any,
  historyQuery: vi.fn(), refetch: vi.fn(), mutate: vi.fn(), invalidar: vi.fn(), toast: vi.fn(),
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof React>();
  return { ...actual,
    useState: (initial: any) => { const r = h.current, i = r.cursor++; if (!(i in r.values)) r.values[i] = typeof initial === 'function' ? initial() : initial; return [r.values[i], (next: any) => { r.values[i] = typeof next === 'function' ? next(r.values[i]) : next; r.dirty = true; }]; },
    useRef: (initial: any) => { const r = h.current, i = r.cursor++; return r.values[i] ?? (r.values[i] = { current: initial }); },
    useMemo: (fn: any, deps: any[]) => { const r = h.current, i = r.cursor++; if (!r.deps[i] || deps.some((v, n) => !Object.is(v, r.deps[i][n]))) { r.values[i] = fn(); r.deps[i] = deps; } return r.values[i]; },
    useEffect: (fn: any, deps: any[]) => { const r = h.current, i = r.cursor++; if (!r.deps[i] || deps.some((v, n) => !Object.is(v, r.deps[i][n]))) { r.effects.push(() => { r.cleanups[i]?.(); r.cleanups[i] = fn(); }); r.deps[i] = deps; } },
  };
});
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
vi.mock('@/components/ui/input', () => ({ Input: 'input' }));
vi.mock('@/components/ui/label', () => ({ Label: 'label' }));
vi.mock('@/components/ui/dialog', () => ({ Dialog: 'dialog', DialogContent: 'div', DialogHeader: 'header', DialogTitle: 'h2' }));
vi.mock('@/components/ui/card', () => ({ Card: 'article', CardContent: 'div', CardHeader: 'header', CardTitle: 'h2' }));
vi.mock('@/components/ui/badge', () => ({ Badge: 'span' }));
vi.mock('@/components/ui/select', () => ({ Select: 'select', SelectContent: 'div', SelectItem: 'option', SelectTrigger: 'div', SelectValue: 'span' }));
vi.mock('@/components/ui/textarea', () => ({ Textarea: 'textarea' }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (s: string) => s }) }));
vi.mock('sonner', () => ({ toast: { success: h.toast, error: h.toast } }));
vi.mock('@/lib/trpc', () => {
  const utils: any = new Proxy({}, { get: (_t, p) => p === 'invalidate' ? h.invalidar : utils });
  const q = (data: any) => ({ data, isLoading: false, isPending: false, isFetching: false, isSuccess: true, error: null });
  const mutation = { useMutation: () => ({ mutate: h.mutate, mutateAsync: h.mutate, isPending: false }) };
  return { trpc: {
    auth: { me: { useQuery: () => q(h.user) } }, useUtils: () => utils,
    assinaturas: {
      list: { useQuery: () => q([9001, 9002].map(id => ({ id, cliente_id: 9003, servico: `Plano sintético ${id}`, status: 'ativa', valor_mensal: '1.00', dia_vencimento: 10, clientes: { nome: 'Cliente sintético' } }))) },
      kpis: { useQuery: () => q({}) },
      pagamentos: { useQuery: (input: any, options: any) => { h.historyQuery(input, options); return h.history; } },
      criar: mutation, registrarPagamento: mutation, conferirPagamento: mutation, atualizar: mutation, deletar: mutation,
    },
    clientes: { list: { useQuery: () => q({ clientes: [] }) } },
    caixa: { contasParaOperacao37: { useQuery: () => q({ empresaId: h.user.id, contas: [] }) } },
  } };
});
import Assinaturas from './Assinaturas';

class MemoryUI {
  values: any[] = []; deps: any[] = []; cleanups: any[] = []; effects: any[] = [];
  cursor = 0; dirty = true; tree: any; mounted = true;
  render() { let n = 0; do { this.dirty = false; this.cursor = 0; h.current = this; this.tree = Assinaturas(); this.effects.splice(0).forEach(f => f()); if (++n > 30) throw new Error('Loop de render'); } while (this.dirty); return this; }
  async flush() { for (let i = 0; i < 16; i++) { await Promise.resolve(); if (this.dirty && this.mounted) this.render(); } return this; }
  unmount() { this.cleanups.forEach(f => f?.()); this.mounted = false; }
  nodes(type?: any) { const list: any[] = []; const walk = (n: any) => { if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== 'object') return; if (!type || n.type === type) list.push(n); walk(n.props?.children); }; walk(this.tree); return list; }
  text(n: any = this.tree): string { const walk = (v: any): string => v == null || typeof v === 'boolean' ? '' : Array.isArray(v) ? v.map(walk).join(' ') : typeof v === 'object' ? walk(v.props?.children) : String(v); return walk(n); }
  button(fragment: string) { const n = this.nodes('button').find(n => this.text(n).includes(fragment)); if (!n) throw new Error(`Botão ausente: ${fragment}\n${this.text()}`); return n; }
  async click(fragment: string) { const n = this.button(fragment); if (n.props.disabled) throw new Error(`Botão desabilitado: ${fragment}`); const p = n.props.onClick(); this.render(); await this.flush(); await p; this.render(); await this.flush(); }
  toggle(index = 0) { const card = this.nodes('article').find(n => this.text(n).includes(`Plano sintético ${9001 + index}`)); if (!card) throw new Error('Assinatura não encontrada'); const buttons = this.nodesIn(card, 'button'); buttons[buttons.length - 1].props.onClick(); return this.render(); }
  nodesIn(root: any, type: any) { const saved = this.tree; this.tree = root; const result = this.nodes(type); this.tree = saved; return result; }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const query = (data: any, extra = {}) => ({ data, isPending: false, isFetching: false, isSuccess: true, error: null, refetch: h.refetch, ...extra });
const paid = [{ id: 9101, mes_referencia: '2026-11', valor_pago: '1.00', data_pagamento: '2026-11-24T12:00:00Z' }];
const empty = 'Nenhum pagamento registrado';
const loading = 'Carregando histórico de pagamentos...';
const historyError = 'Não foi possível carregar o histórico de pagamentos.';
const intent = { assinaturaId: 9001, clienteId: 9003, contaCaixaId: 9004, valorPago: '1.00', mesReferencia: '2026-11', observacoes: null, idempotencyKey: '11111111-1111-4111-8111-111111111111' };
let data: Map<string, string>, storage: any, network: any;
let mounted: MemoryUI[];
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('React', React); h.user = { id: 6001 }; h.history = query([]); mounted = [];
  data = new Map(); storage = { getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string, v: string) => data.set(k, v)), removeItem: vi.fn((k: string) => data.delete(k)) };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('navigator', { locks: { request: vi.fn(() => { throw new Error('Nenhum fluxo financeiro permitido neste teste'); }) } });
  network = vi.fn(() => { throw new Error('Rede proibida neste harness UI'); }); vi.stubGlobal('fetch', network);
  h.refetch.mockResolvedValue({ data: [] });
});
afterEach(() => {
  mounted.forEach(r => r.unmount());
  expect(network).not.toHaveBeenCalled(); expect(h.mutate).not.toHaveBeenCalled();
  expect(h.invalidar).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled();
  expect(navigator.locks.request).not.toHaveBeenCalled(); vi.unstubAllGlobals();
});
const page = () => { const r = new MemoryUI().render(); mounted.push(r); return r; };
const opened = () => page().toggle();

const pendingStates: [string, any][] = [
  ['pending sem dados', query(undefined, { isPending: true, isSuccess: false })],
  ['pending/fetching sem dados', query(undefined, { isPending: true, isFetching: true, isSuccess: false })],
  ['pending pausado sem dados', query(undefined, { isPending: true, isFetching: false, isSuccess: false })],
  ['undefined sem flags pendentes', query(undefined, { isSuccess: false })],
  ['undefined com success inconsistente', query(undefined)],
  ['null não confirma ausência', query(null)],
  ['refetch sem dados', query(undefined, { isFetching: true, isSuccess: false })],
  ['refetch cache vazio', query([], { isFetching: true })],
  ['refetch cache com pagamento', query(paid, { isFetching: true })],
  ['array vazio ainda pending', query([], { isPending: true, isSuccess: false })],
  ['array vazio sem sucesso', query([], { isSuccess: false })],
];
describe('Assinaturas — histórico não presume ausência', () => {
  it.each(pendingStates)('%s mostra carregamento sem falso vazio', (_label, state) => {
    h.history = state; const r = opened(); expect(r.text()).toContain(loading); expect(r.text()).not.toContain(empty);
    expect(r.nodes().some(n => n.props?.role === 'status' && r.text(n).includes(loading))).toBe(true);
  });
  it.each([{ label: 'sem dados', cached: undefined }, { label: 'cache vazio', cached: [] }, { label: 'cache com pagamento', cached: paid }])('erro $label mostra alerta e retentativa, nunca ausência', ({ cached }) => {
    h.history = query(cached, { error: new Error('erro sintético'), isSuccess: false }); const r = opened();
    expect(r.text()).toContain(historyError); expect(r.text()).not.toContain(empty); expect(r.button('Tentar novamente').props.disabled).toBeFalsy();
    expect(r.nodes().some(n => n.props?.role === 'alert' && r.text(n).includes(historyError))).toBe(true);
  });
  it('ausência só aparece após resposta bem-sucedida [] sem pending/fetching/erro', () => {
    const r = opened(); expect(r.text()).toContain(empty); expect(r.text()).not.toContain(loading); expect(r.text()).not.toContain(historyError);
  });
  it('resposta com pagamento preserva competência, valor e linha única', () => {
    h.history = query(paid); const r = opened(); expect(r.text()).not.toContain(empty); expect(r.text()).toContain('2026-11');
    const rows = r.nodes('div').filter(n => n.key === '9101'); expect(rows).toHaveLength(1); expect(r.text(rows[0])).toMatch(/R\$\s*1,00/);
  });
  it('a consulta continua habilitada somente no histórico expandido e usa assinatura atual', () => {
    const r = page(); expect(h.historyQuery.mock.lastCall).toEqual([{ assinaturaId: null }, { enabled: false }]); expect(r.text()).not.toContain('Histórico de Pagamentos');
    r.toggle(); expect(h.historyQuery.mock.lastCall).toEqual([{ assinaturaId: 9001 }, { enabled: true }]);
    h.history = query(undefined, { isPending: true, isSuccess: false }); r.toggle(1);
    expect(h.historyQuery.mock.lastCall).toEqual([{ assinaturaId: 9002 }, { enabled: true }]); expect(r.text()).toContain(loading); expect(r.text()).not.toContain(empty);
    r.toggle(1); expect(h.historyQuery.mock.lastCall[1]).toEqual({ enabled: false }); expect(r.text()).not.toContain('Histórico de Pagamentos');
  });
  it('pending → pagamento não exibe ausência intermediária', () => {
    h.history = query(undefined, { isPending: true, isSuccess: false }); const r = opened(); expect(r.text()).not.toContain(empty);
    h.history = query(paid); r.render(); expect(r.text()).toContain('2026-11'); expect(r.text()).not.toContain(empty);
  });
  it('retentar chama apenas refetch de leitura; durante a consulta o botão fica bloqueado', async () => {
    h.history = query(undefined, { error: new Error('timeout'), isSuccess: false }); const r = opened(); const d = deferred<any>();
    h.refetch.mockImplementationOnce(() => { h.history = query(undefined, { error: new Error('timeout'), isFetching: true, isSuccess: false }); return d.promise; });
    await r.click('Tentar novamente'); expect(h.refetch).toHaveBeenCalledOnce(); expect(r.button('Tentando novamente...').props.disabled).toBe(true); expect(r.text()).not.toContain(empty);
    h.history = query(paid); d.resolve({ data: paid }); await r.flush(); r.render(); expect(r.text()).toContain('2026-11'); expect(r.text()).not.toContain(historyError); expect(r.text()).not.toContain(empty);
  });
  it('retentativa que falha novamente mantém alerta e permite nova leitura', async () => {
    h.history = query(undefined, { error: new Error('timeout'), isSuccess: false }); const r = opened();
    h.refetch.mockImplementation(async () => { h.history = query(undefined, { error: new Error('outra falha'), isSuccess: false }); return { error: h.history.error }; });
    await r.click('Tentar novamente'); expect(r.text()).toContain(historyError); expect(r.text()).not.toContain(empty); expect(r.button('Tentar novamente').props.disabled).toBeFalsy();
    await r.click('Tentar novamente'); expect(h.refetch).toHaveBeenCalledTimes(2);
  });
  it('retry bem-sucedido vazio confirma ausência apenas após término', async () => {
    h.history = query([], { error: new Error('timeout'), isSuccess: false }); const r = opened(); expect(r.text()).not.toContain(empty);
    h.refetch.mockImplementation(async () => { h.history = query([]); return { data: [] }; }); await r.click('Tentar novamente'); expect(r.text()).toContain(empty);
  });
  it('conferir/cancelar permanece disponível e intenção sintética íntegra após retry do histórico', async () => {
    const key = 'cobrapro.assinaturas42.pending.6001'; const saved = JSON.stringify({ version: 1, userId: 6001, input: intent }); data.set(key, saved);
    h.history = query(undefined, { error: new Error('timeout'), isSuccess: false }); const r = opened();
    expect(r.button('Pagar').props.disabled).toBe(true); const recovery = r.button('Conferir/cancelar tentativa').props.onClick;
    h.refetch.mockImplementation(async () => { h.history = query(paid); return { data: paid }; }); await r.click('Tentar novamente');
    expect(data.get(key)).toBe(saved); expect(r.button('Pagar').props.disabled).toBe(true); expect(r.button('Conferir/cancelar tentativa').props.onClick).toBeTypeOf('function'); expect(recovery).toBeTypeOf('function');
    expect(r.text()).toContain('Recebimento pendente de confirmação: assinatura #9001');
  });
  it('intenção ilegível não é limpa nem libera pagamento ao retentar histórico', async () => {
    const key = 'cobrapro.assinaturas42.pending.6001'; data.set(key, '{');
    h.history = query(undefined, { error: new Error('timeout'), isSuccess: false }); const r = opened();
    h.refetch.mockImplementation(async () => { h.history = query([]); return { data: [] }; }); await r.click('Tentar novamente');
    expect(data.get(key)).toBe('{'); expect(r.text()).toContain('Intenção preservada ilegível'); expect(r.button('Pagar').props.disabled).toBe(true);
  });
});
