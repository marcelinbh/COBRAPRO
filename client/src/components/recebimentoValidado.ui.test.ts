import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

const h = vi.hoisted(() => ({
  current: null as any, user: { id: 901 } as any, origem: {} as any, contas: {} as any,
  origemQuery: vi.fn(), contasQuery: vi.fn(), refetch: vi.fn(), success: vi.fn(),
  cotar: vi.fn(), receber: vi.fn(), prospectCotar: vi.fn(), prospectReceber: vi.fn(),
  renovar: vi.fn(), oldMutation: vi.fn(), toast: vi.fn(), detalhes: {} as any, parcelas: [] as any[],
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof React>();
  return { ...actual,
    useState: (initial: any) => { const r = h.current, i = r.cursor++; if (!(i in r.values)) r.values[i] = typeof initial === 'function' ? initial() : initial; return [r.values[i], (next: any) => { r.writes++; r.values[i] = typeof next === 'function' ? next(r.values[i]) : next; r.dirty = true; }]; },
    useRef: (initial: any) => { const r = h.current, i = r.cursor++; return r.values[i] ?? (r.values[i] = { current: initial }); },
    useMemo: (fn: any, deps: any[]) => { const r = h.current, i = r.cursor++; if (!r.deps[i] || deps.some((v, n) => !Object.is(v, r.deps[i][n]))) { r.values[i] = fn(); r.deps[i] = deps; } return r.values[i]; },
    useEffect: (fn: any, deps: any[]) => { const r = h.current, i = r.cursor++; if (!r.deps[i] || deps.some((v, n) => !Object.is(v, r.deps[i][n]))) { r.effects.push(() => { r.cleanups[i]?.(); r.cleanups[i] = fn(); }); r.deps[i] = deps; } },
  };
});
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
vi.mock('@/components/ui/input', () => ({ Input: 'input' }));
vi.mock('@/components/ui/label', () => ({ Label: 'label' }));
vi.mock('@/components/ui/dialog', () => ({ Dialog: 'dialog', DialogContent: 'div', DialogHeader: 'header', DialogTitle: 'h2', DialogDescription: 'p' }));
vi.mock('@/components/ui/card', () => ({ Card: 'article', CardContent: 'div' }));
vi.mock('@/components/ui/badge', () => ({ Badge: 'span' }));
vi.mock('@/components/ui/select', () => ({ Select: 'select', SelectContent: 'div', SelectItem: 'option', SelectTrigger: 'div', SelectValue: 'span' }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (s: string) => s, i18n: { language: 'pt-BR' } }) }));
vi.mock('sonner', () => ({ toast: { success: h.toast, error: h.toast, warning: h.toast } }));
vi.mock('wouter', () => ({ useLocation: () => ['/emprestimos/1', vi.fn()], useParams: () => ({ id: '1' }) }));
vi.mock('@trpc/client', async original => ({ ...await original<any>(), httpBatchLink: vi.fn(() => ({})), createTRPCProxyClient: () => ({
  recebimentosLegados: { cotar: { query: h.cotar }, receber: { mutate: h.receber } },
  emprestimosProspectivos: { cotar: { query: h.prospectCotar }, receber: { mutate: h.prospectReceber } },
  renovacaoProspectiva: { renovar: { mutate: h.renovar } },
}) }));
vi.mock('@/lib/trpc', () => {
  const utils: any = new Proxy(() => {}, { get: (_t, p) => p === 'invalidate' ? h.refetch : utils });
  const q = (data: any) => ({ data, isError: false, isLoading: false, isFetching: false, refetch: h.refetch });
  const mutation = { useMutation: () => ({ mutate: h.oldMutation, mutateAsync: h.oldMutation }) };
  return { trpc: {
    auth: { me: { useQuery: () => q(h.user) } }, useUtils: () => utils,
    recebimentosLegados: { origem: { useQuery: (i: any, o: any) => { h.origemQuery(i, o); return h.origem; } } },
    caixa: { contas: { useQuery: (i: any, o: any) => { h.contasQuery(i, o); return h.contas; } } },
    configuracoes: { get: { useQuery: () => q({}) } },
    contratos: { obterDetalhes: { useQuery: () => q(h.detalhes) }, historico: { useQuery: () => q([]) }, editarJuros: mutation, aplicarMulta: mutation, deletar: mutation },
    parcelas: { list: { useQuery: () => q(h.parcelas) }, registrarPagamento: mutation, pagarJuros: mutation, criarParcela: mutation, editarParcela: mutation },
  } };
});
import { RecebimentoValidado } from './RecebimentoValidado';
import { ParcelaLegadaReceber, lerIntencaoLegada } from './ParcelaLegadaReceber';
import { EmprestimoSeguroReceber } from './EmprestimoSeguroReceber';
import { EmprestimoSeguroRenovar } from './EmprestimoSeguroRenovar';
import EmprestimoDetalhes from '../pages/EmprestimoDetalhes';
import Parcelas from '../pages/Parcelas';
import { REGRA_RECEBIMENTO_LEGADO } from '../../../server/services/recebimentosLegadosRpc';

// Executa os componentes reais, seus handlers, effects e cleanups; somente os hooks,
// primitivas UI e fronteiras de RPC são substituídos. Sem DOM, browser ou produção.
class MemoryUI {
  values: any[] = []; deps: any[] = []; cleanups: any[] = []; effects: any[] = [];
  cursor = 0; dirty = true; tree: any; writes = 0; mounted = true;
  constructor(private component: any, public props: any) {}
  render() { if (!this.mounted) throw new Error('Render após unmount'); let n = 0; do { this.dirty = false; this.cursor = 0; h.current = this; this.tree = this.component(this.props); this.effects.splice(0).forEach(f => f()); if (++n > 30) throw new Error('Loop de render'); } while (this.dirty); return this; }
  async flush() { for (let i = 0; i < 16; i++) { await Promise.resolve(); if (this.dirty && this.mounted) this.render(); } return this; }
  unmount() { this.cleanups.forEach(f => f?.()); this.mounted = false; this.dirty = false; }
  nodes(type?: any) { const list: any[] = []; const walk = (n: any) => { if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== 'object') return; if (!type || n.type === type) list.push(n); walk(n.props?.children); }; walk(this.tree); return list; }
  text(n: any = this.tree): string { const walk = (v: any): string => v == null || typeof v === 'boolean' ? '' : Array.isArray(v) ? v.map(walk).join(' ') : typeof v === 'object' ? walk(v.props?.children) : String(v); return walk(n); }
  button(fragment: string) { const n = this.nodes('button').find(n => this.text(n).includes(fragment)); if (!n) throw new Error(`Botão ausente: ${fragment}\n${this.text()}`); return n; }
  async click(fragment: string) { const n = this.button(fragment); if (n.props.disabled) throw new Error(`Botão desabilitado: ${fragment}`); const p = n.props.onClick({ stopPropagation() {} }); if (this.mounted) this.render(); await this.flush(); await p; if (this.mounted) this.render(); await this.flush(); }
  change(node: any, value: any) { node.props.onChange ? node.props.onChange({ target: { value, checked: value } }) : node.props.onValueChange(value); this.render(); }
}
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const uuid = '11111111-1111-4111-8111-111111111111';
const payload = { contratoId: 1, parcelaId: 2, contaCaixaId: 3, idempotencyKey: uuid, estadoHash: 'a'.repeat(64), regra: REGRA_RECEBIMENTO_LEGADO, totalExigido: '100.00', valorRecebido: '100.00', dataPagamento: '2026-11-10' };
const quote = { elegivel: true, contratoId: 1, parcelaId: 2, contaCaixaId: 3, totalExigido: '100.00', estadoHash: 'a'.repeat(64), regra: REGRA_RECEBIMENTO_LEGADO, dataPagamento: '2026-11-10', validadeDataCivil: '2026-11-10' };
const confirmed = { success: true, repetida: false, operationId: '22222222-2222-4222-8222-222222222222', contratoId: 1, parcelaId: 2, contaCaixaId: 3, transacaoCaixaId: '4', valorRecebido: '100.00', totalExigido: '100.00', valorPagoAcumulado: '100.00', saldoResidual: '0.00', status: 'paga', contratoStatus: 'ativo', dataPagamento: '2026-11-10', regra: REGRA_RECEBIMENTO_LEGADO };
const origem = (extra = {}) => ({ userId: h.user.id, contratoId: 1, parcelaId: 2, trilho: 'legado', status: 'pendente', ...extra });
const result = (data: any, extra = {}) => ({ data, isError: false, isLoading: false, isFetching: false, refetch: h.refetch, ...extra });
const props = () => ({ contratoId: 1, parcelaId: 2, contaCaixaId: 3, onSuccess: h.success });
const key = (userId = h.user.id) => `cobrapro:legado:v1:${userId}:1:2`;
let data: Map<string, string>, storage: any, network: any;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('React', React); h.user = { id: 901 };
  h.origem = result(origem()); h.contas = result([{ id: 3, nome: 'Conta A', ativo: true }, { id: 4, nome: 'Inativa', ativo: false }, { id: 5, nome: 'Conta B', ativo: true }]);
  data = new Map(); storage = { getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string, v: string) => data.set(k, v)), removeItem: vi.fn((k: string) => data.delete(k)) };
  vi.stubGlobal('sessionStorage', storage); vi.stubGlobal('window', { sessionStorage: storage, location: { search: '' } });
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => uuid) }); network = vi.fn(() => { throw new Error('Rede proibida neste harness'); }); vi.stubGlobal('fetch', network);
  h.cotar.mockResolvedValue(quote); h.receber.mockRejectedValue(new Error('timeout'));
  const row = { id: 2, contratoId: 1, clienteId: 10, clienteNome: 'Cliente sintético', clienteWhatsapp: null, clienteChavePix: null, numeroParcela: 1, valorOriginal: '100.00', valorPago: null, valorJuros: '0.00', valorMulta: '0.00', dataVencimento: '2026-12-10', dataPagamento: null, status: 'pendente', modalidade: 'mensal', numeroParcelas: 1 };
  h.parcelas = [row]; h.detalhes = { id: 1, clienteNome: 'Cliente sintético', clienteWhatsapp: null, status: 'ativo', modalidade: 'mensal', tipoTaxa: 'mensal', taxaJuros: 0, valorPrincipal: 100, valorJurosParcela: 0, totalReceber: 100, totalPago: 0, numeroParcelas: 1, parcelasAbertas: 1, parcelasPagas: 0, dataVencimento: '2026-12-10', dataCriacao: '2026-11-10', parcelasComAtraso: [], todasParcelas: [{ id: 2, numero_parcela: 1, valor_original: '100.00', data_vencimento: '2026-12-10', status: 'pendente' }] };
});
afterEach(() => { expect(network).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
const legadoUI = () => new MemoryUI(ParcelaLegadaReceber, props()).render();
const gateUI = () => new MemoryUI(RecebimentoValidado, props()).render();
function noPaymentChildren(r: MemoryUI) { expect(r.nodes(ParcelaLegadaReceber)).toHaveLength(0); expect(r.nodes(EmprestimoSeguroReceber)).toHaveLength(0); expect(r.nodes(EmprestimoSeguroRenovar)).toHaveLength(0); expect(h.receber).not.toHaveBeenCalled(); expect(h.prospectReceber).not.toHaveBeenCalled(); }
async function prepare(r: MemoryUI) { await r.click('Receber legado / conferir'); r.change(r.nodes('input').find(n => n.props.type !== 'checkbox'), '100.00'); r.change(r.nodes('input').find(n => n.props.type === 'checkbox'), true); }

describe('RecebimentoValidado — origem autenticada e escolha do trilho', () => {
  it('cache inclui escopoUserId e consulta só abre por ação explícita', async () => {
    const r = gateUI(); expect(h.origemQuery.mock.lastCall).toEqual([{ contratoId: 1, parcelaId: 2, escopoUserId: 901 }, { enabled: false, retry: false, staleTime: 0 }]);
    await r.click('Receber / conferir'); expect(h.origemQuery.mock.lastCall[1].enabled).toBe(true);
    h.user = { id: 902 }; r.render(); expect(h.origemQuery.mock.lastCall[0].escopoUserId).toBe(902); noPaymentChildren(r);
  });
  it.each([{ userId: 902 }, { contratoId: 9 }, { parcelaId: 9 }])('origem com identidade divergente %j não monta financeiro', async extra => { h.origem = result(origem(extra)); const r = gateUI(); await r.click('Receber / conferir'); noPaymentChildren(r); expect(r.text()).toContain('Nenhum recebimento será executado'); });
  it.each(['error', 'missing', 'loading', 'fetching', 'logout'])('origem %s não presume legado nem prospectivo', async mode => {
    if (mode === 'error') h.origem.isError = true;
    if (mode === 'missing') h.origem.data = undefined;
    if (mode === 'loading') h.origem.isLoading = true;
    if (mode === 'fetching') h.origem.isFetching = true;
    if (mode === 'logout') h.user = null;
    const r = gateUI(); await r.click('Receber / conferir'); noPaymentChildren(r);
    if (mode === 'error' || mode === 'missing') { await r.click('Tentar novamente'); expect(h.refetch).toHaveBeenCalled(); noPaymentChildren(r); }
  });
  it('legado exige conta selecionada, rejeita inativa/ausente e aceita só destino explícito', async () => {
    const r = gateUI(); await r.click('Receber / conferir'); noPaymentChildren(r);
    const select = r.nodes('select')[0]; expect(select.props.value).toBe(''); expect(r.nodes('option').map(n => n.props.value)).not.toContain(4);
    for (const id of ['4', '999', '']) { r.change(r.nodes('select')[0], id); noPaymentChildren(r); }
    r.change(r.nodes('select')[0], '3'); const child = r.nodes(ParcelaLegadaReceber)[0]; expect(child.props).toMatchObject({ contratoId: 1, parcelaId: 2, contaCaixaId: 3 });
    const actualChild = new MemoryUI(child.type, child.props).render(); await prepare(actualChild); await actualChild.click('Confirmar recebimento');
    expect(h.receber.mock.calls[0][0].contaCaixaId).toBe(3); expect(h.prospectReceber).not.toHaveBeenCalled(); expect(h.oldMutation).not.toHaveBeenCalled();
  });
  it.each(['isError', 'isLoading'])('contas %s bloqueia componente mesmo com seleção anterior', async field => {
    const r = gateUI(); await r.click('Receber / conferir'); r.change(r.nodes('select')[0], '3'); expect(r.nodes(ParcelaLegadaReceber)).toHaveLength(1);
    h.contas[field] = true; r.render(); noPaymentChildren(r);
    if (field === 'isError') { expect(r.text()).toContain('Não foi possível conferir as contas'); await r.click('Retentar contas'); expect(h.refetch).toHaveBeenCalled(); }
  });
  it.each(['renovada', 'cancelada', 'cancelado'])('parcela %s não cobra principal transferido', async status => { h.origem = result(origem({ status })); const r = gateUI(); r.props.permitirRenovacao = true; await r.click('Receber / conferir'); noPaymentChildren(r); expect(r.text()).toContain('Principal transferido não é cobrado novamente'); });
  it('prospectivo monta componentes próprios, com renovação só quando permitida e callback de atualização', async () => {
    h.origem = result(origem({ trilho: 'prospectivo' })); const r = gateUI(); await r.click('Receber / conferir');
    expect(r.nodes(EmprestimoSeguroReceber)).toHaveLength(1); expect(r.nodes(ParcelaLegadaReceber)).toHaveLength(0); expect(r.nodes('select')).toHaveLength(0); expect(r.nodes(EmprestimoSeguroRenovar)).toHaveLength(0);
    r.props.permitirRenovacao = true; r.render(); expect(r.nodes(EmprestimoSeguroRenovar)).toHaveLength(1);
    r.nodes(EmprestimoSeguroReceber)[0].props.onSuccess(); expect(h.refetch).toHaveBeenCalledOnce(); expect(h.success).toHaveBeenCalledOnce();
  });
});

const invalidIntents: [string, string][] = [
  ['JSON quebrado', '{'], ['null', 'null'], ['versão desconhecida', JSON.stringify({ versao: 2, payload })],
  ...Object.entries({ contratoId: 9, parcelaId: 9, contaCaixaId: 0, idempotencyKey: 'bad', estadoHash: 'bad', regra: 'outra', totalExigido: '0.00', valorRecebido: '99.00', dataPagamento: '2026-02-30', userId: 902 }).map(([field, v]) => [field, JSON.stringify({ versao: 1, payload: { ...payload, [field]: v } })] as [string, string]),
  ['confirmação inválida', JSON.stringify({ versao: 1, payload, confirmacao: { success: true } })],
  ['confirmação de outra conta', JSON.stringify({ versao: 1, payload, confirmacao: { ...confirmed, contaCaixaId: 5 } })],
];
describe('ParcelaLegadaReceber — intenção íntegra, storage e envio real em memória', () => {
  it.each(invalidIntents)('storage %s não sobrescreve UUID e não faz cotação/POST', async (_name, text) => {
    data.set(key(), text); expect(() => lerIntencaoLegada(text, 1, 2)).toThrow(); const r = legadoUI(); expect(r.text()).toContain('intenção armazenada inválida'); await r.click('Receber legado / conferir');
    expect(h.cotar).not.toHaveBeenCalled(); expect(h.receber).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled(); expect(data.get(key())).toBe(text);
  });
  it('storage getItem indisponível bloqueia todas as chamadas', async () => { storage.getItem.mockImplementation(() => { throw new Error('storage bloqueado'); }); const r = legadoUI(); await r.click('Receber legado / conferir'); expect(h.cotar).not.toHaveBeenCalled(); expect(h.receber).not.toHaveBeenCalled(); });
  it('falha de persistência antes do POST não envia recebimento', async () => { const r = legadoUI(); await prepare(r); storage.setItem.mockImplementation(() => { throw new Error('quota exceeded'); }); await r.click('Confirmar recebimento'); expect(h.receber).not.toHaveBeenCalled(); expect(data.size).toBe(0); expect(r.text()).toContain('quota exceeded'); });
  it('cotação negativa ou erro não permite confirmação nem fallback', async () => {
    h.cotar.mockResolvedValueOnce({ elegivel: false, motivos: ['ENCARGOS_AMBIGUOS'] }); const r = legadoUI(); await r.click('Receber legado / conferir'); expect(r.text()).toContain('ENCARGOS_AMBIGUOS'); expect(r.nodes('input')).toHaveLength(0);
    h.cotar.mockRejectedValueOnce(new Error('RPC unavailable')); await r.click('Receber legado / conferir'); expect(r.text()).toContain('RPC unavailable'); expect(h.receber).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it('integral exige valor exato e aceite, não cria UUID antes de confirmar', async () => {
    const r = legadoUI(); await r.click('Receber legado / conferir'); expect(r.button('Confirmar recebimento').props.disabled).toBe(true);
    r.change(r.nodes('input')[0], '99.00'); r.change(r.nodes('input')[1], true); expect(r.button('Confirmar recebimento').props.disabled).toBe(true); expect(data.size).toBe(0);
    r.change(r.nodes('input')[0], '100.00'); expect(r.button('Confirmar recebimento').props.disabled).toBe(false);
  });
  it('timeout/reload e mudança de conta preservam UUID, conta e payload originais sem recotar', async () => {
    let r = legadoUI(); await prepare(r); await r.click('Confirmar recebimento'); const original = h.receber.mock.calls[0][0]; expect(original).toEqual(payload); const saved = data.get(key());
    r.unmount(); r = new MemoryUI(ParcelaLegadaReceber, { ...props(), contaCaixaId: 5 }).render(); expect(r.text()).toContain('conta da intenção # 3'); expect(r.text()).toContain(uuid); await r.click('Conferir/repetir mesmo UUID');
    expect(h.receber.mock.calls[1][0]).toEqual(original); expect(h.cotar).toHaveBeenCalledTimes(1); expect(data.get(key())).toBe(saved); expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it('confirmação válida persiste antes do callback; reload repete intenção já confirmada', async () => {
    h.receber.mockResolvedValue(confirmed); h.success.mockImplementation(() => expect(JSON.parse(data.get(key())!).confirmacao).toEqual(confirmed));
    let r = legadoUI(); await prepare(r); await r.click('Confirmar recebimento'); expect(h.success).toHaveBeenCalledOnce(); expect(r.text()).toContain('Recebimento confirmado');
    r.unmount(); r = legadoUI(); expect(r.text()).toContain('Recebimento confirmado'); await r.click('Conferir/repetir mesmo UUID'); expect(h.receber.mock.calls[1][0]).toEqual(payload); expect(h.cotar).toHaveBeenCalledTimes(1);
  });
  it('confirmação divergente mantém intenção original sem callback nem substituição', async () => {
    h.receber.mockResolvedValue({ ...confirmed, contaCaixaId: 5 }); const r = legadoUI(); await prepare(r); await r.click('Confirmar recebimento');
    expect(h.success).not.toHaveBeenCalled(); expect(JSON.parse(data.get(key())!)).toEqual({ versao: 1, payload }); expect(r.text()).toContain('Confirmação divergiu');
  });
  it('clique duplicado durante POST executa apenas uma mutação', async () => {
    const d = deferred<any>(); h.receber.mockReturnValueOnce(d.promise); const r = legadoUI(); await prepare(r);
    const handler = r.button('Confirmar recebimento').props.onClick; const first = handler(), second = handler(); expect(h.receber).toHaveBeenCalledOnce(); d.reject(new Error('timeout')); await Promise.all([first, second]); await r.flush(); expect(data.size).toBe(1);
  });
});

const scopes = ['sessão', 'conta', 'parcela'] as const;
function changeScope(r: MemoryUI, kind: typeof scopes[number], alternate: boolean) {
  if (kind === 'sessão') h.user = { id: alternate ? 902 : 901 };
  if (kind === 'conta') r.props.contaCaixaId = alternate ? 5 : 3;
  if (kind === 'parcela') r.props.parcelaId = alternate ? 9 : 2;
  r.render();
}
describe('ParcelaLegadaReceber — respostas assíncronas e lifecycle', () => {
  it.each(scopes)('cotação de A não preenche B nem retorno A→B→A por %s', async kind => {
    const d = deferred<any>(); h.cotar.mockReturnValueOnce(d.promise); const r = legadoUI(); await r.click('Receber legado / conferir');
    changeScope(r, kind, true); expect(r.nodes('input')).toHaveLength(0); changeScope(r, kind, false); const writes = r.writes;
    d.resolve(quote); await r.flush(); expect(r.writes).toBe(writes); expect(r.nodes('input')).toHaveLength(0); expect(r.text()).not.toContain('Total exato:'); expect(h.success).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it.each(scopes)('recebimento tardio A→B→A por %s não confirma nem sobrescreve storage', async kind => {
    const d = deferred<any>(); h.receber.mockReturnValueOnce(d.promise); const r = legadoUI(); await prepare(r); const sending = r.click('Confirmar recebimento'); await r.flush(); const saved = data.get(key());
    changeScope(r, kind, true); changeScope(r, kind, false); const writes = r.writes; d.resolve(confirmed); await sending; await r.flush();
    expect(r.writes).toBe(writes); expect(h.success).not.toHaveBeenCalled(); expect(data.get(key())).toBe(saved); expect(JSON.parse(saved!).confirmacao).toBeUndefined();
  });
  it.each(['resolve', 'reject'])('cotação após unmount (%s) não escreve hooks nem storage', async mode => {
    const d = deferred<any>(); h.cotar.mockReturnValueOnce(d.promise); const r = legadoUI(); await r.click('Receber legado / conferir'); r.unmount(); const writes = r.writes;
    mode === 'resolve' ? d.resolve(quote) : d.reject(new Error('late error')); await r.flush(); expect(r.writes).toBe(writes); expect(h.success).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it.each(['resolve', 'reject'])('recebimento após unmount (%s) não confirma nem remove UUID', async mode => {
    const d = deferred<any>(); h.receber.mockReturnValueOnce(d.promise); const r = legadoUI(); await prepare(r); const sending = r.click('Confirmar recebimento'); await r.flush(); const saved = data.get(key()); r.unmount(); const writes = r.writes;
    mode === 'resolve' ? d.resolve(confirmed) : d.reject(new Error('late error')); await sending; await r.flush(); expect(r.writes).toBe(writes); expect(h.success).not.toHaveBeenCalled(); expect(data.get(key())).toBe(saved);
  });
  it('resposta de sessão A durante B não contamina intenção nem tela B', async () => {
    const d = deferred<any>(); h.receber.mockReturnValueOnce(d.promise); const r = legadoUI(); await prepare(r); const sending = r.click('Confirmar recebimento'); await r.flush(); const keyA = key();
    h.user = { id: 902 }; r.render(); d.resolve(confirmed); await sending; expect(h.success).not.toHaveBeenCalled(); expect(data.has(key())).toBe(false); expect(data.has(keyA)).toBe(true); expect(r.text()).not.toContain('Intenção preservada');
  });
});

describe('páginas reais montam RecebimentoValidado, nunca o diálogo de pagamento antigo', () => {
  it.each(['pendente', 'parcial', 'paga', 'renovada'])('Parcelas: status %s encaminha IDs e origem autenticada', async status => {
    h.parcelas[0].status = status; const page = new MemoryUI(Parcelas, {}).render(); const child = page.nodes(RecebimentoValidado)[0]; expect(child.props).toMatchObject({ contratoId: 1, parcelaId: 2 });
    expect(page.nodes().some(n => typeof n.type === 'function' && n.type.name === 'PagamentoDialog')).toBe(false);
    h.origem = result(origem({ status })); const gate = new MemoryUI(child.type, child.props).render(); await gate.click('Receber / conferir');
    if (status === 'renovada') noPaymentChildren(gate); else { expect(gate.text()).toContain('Escolha explicitamente'); noPaymentChildren(gate); }
    expect(h.oldMutation).not.toHaveBeenCalled();
  });
  it('EmprestimoDetalhes: ação principal e tabela usam gate com renovação e IDs', async () => {
    const page = new MemoryUI(EmprestimoDetalhes, {}).render(); expect(page.nodes(RecebimentoValidado)[0].props).toMatchObject({ contratoId: 1, parcelaId: 2, permitirRenovacao: true });
    await page.click('Detalhes'); expect(page.nodes(RecebimentoValidado).length).toBeGreaterThanOrEqual(2);
    for (const child of page.nodes(RecebimentoValidado)) expect(child.props).toMatchObject({ contratoId: 1, parcelaId: 2, permitirRenovacao: true }); expect(h.oldMutation).not.toHaveBeenCalled();
  });
});
