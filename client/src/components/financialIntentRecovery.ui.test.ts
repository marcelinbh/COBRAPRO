import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
const h = vi.hoisted(() => ({ current: null as any, user: { id: 5001 }, search: '', validar: vi.fn(), criar: vi.fn(), receber: vi.fn(), cotar: vi.fn(), rec: vi.fn(), despesaRec: vi.fn(), expensePay: vi.fn(), success: vi.fn(), error: vi.fn(), location: vi.fn() }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof React>();
  return { ...actual,
    useState: (initial: any) => { const r = h.current, i = r.cursor++; if (!(i in r.values)) r.values[i] = typeof initial === 'function' ? initial() : initial; return [r.values[i], (next: any) => { r.values[i] = typeof next === 'function' ? next(r.values[i]) : next; r.dirty = true; }]; },
    useRef: (initial: any) => { const r = h.current, i = r.cursor++; return r.values[i] ?? (r.values[i] = { current: initial }); },
    useMemo: (fn: any, deps: any[]) => { const r = h.current, i = r.cursor++; if (!r.deps[i] || deps.some((v, n) => v !== r.deps[i][n])) { r.values[i] = fn(); r.deps[i] = deps; } return r.values[i]; },
    useEffect: (fn: any, deps: any[]) => { const r = h.current, i = r.cursor++; if (!r.deps[i] || deps.some((v, n) => v !== r.deps[i][n])) { r.effects.push(() => { r.cleanups[i]?.(); r.cleanups[i] = fn(); }); r.deps[i] = deps; } },
  };
});
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
vi.mock('@/components/ui/input', () => ({ Input: 'input' }));
vi.mock('@/components/ui/label', () => ({ Label: 'label' }));
vi.mock('@/components/ui/dialog', () => ({ Dialog: 'dialog', DialogContent: 'div', DialogHeader: 'header', DialogTitle: 'h2' }));
vi.mock('@/components/ui/card', () => ({ Card: 'article', CardContent: 'div', CardHeader: 'header', CardTitle: 'h2' }));
vi.mock('@/components/ui/select', () => ({ Select: 'select', SelectContent: 'div', SelectItem: 'option', SelectTrigger: 'div', SelectValue: 'span' }));
vi.mock('@/components/ui/badge', () => ({ Badge: 'span' }));
vi.mock('@/components/ui/textarea', () => ({ Textarea: 'textarea' }));
vi.mock('sonner', () => ({ toast: { success: h.success, error: h.error } }));
vi.mock('wouter', () => ({ useLocation: () => ['/contratos/novo', h.location] }));
vi.mock('@/lib/trpc', () => {
  const utils = new Proxy({}, { get: () => new Proxy({}, { get: () => ({ invalidate: async () => {} }) }) });
  const q = (data: any) => ({ data, isError: false, isLoading: false });
  return { trpc: {
    auth: { me: { useQuery: () => q(h.user) } },
    clientes: { list: { useQuery: () => q({ clientes: [{ id: 1, nome: 'Sintético' }] }) } },
    caixa: { contas: { useQuery: () => q([{ id: 1, nome: 'Sintética', ativa: true }]) } },
    useUtils: () => utils,
    contasPagar: {
      resumo: { useQuery: () => q({ totalPendente: '100.00', qtdPendente: 2, totalAtrasado: '0.00', qtdAtrasado: 0, totalPago: '0.00', qtdPago: 0 }) },
      listar: { useQuery: () => q([101, 102].map(id => ({ id, descricao: `Despesa ${id}`, valor: '50.00', categoria: 'energia', dataVencimento: '2026-11-10', status: 'pendente', podePagar: true }))) },
      capacidades: { useQuery: () => q({ prospectivasHabilitadas: true }) },
      criar: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      pagar: { useMutation: () => ({ mutateAsync: h.expensePay }) },
      estornar: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      reconciliar: { useMutation: () => ({ mutateAsync: h.despesaRec }) },
    },
  } };
});
vi.mock('./EmprestimoSeguroRpc', async original => ({ ...await original<any>(), cicloRpc: {
  disponibilidade: { query: async () => ({ disponivel: true }) }, validarCriacao: { mutate: h.validar },
  criar: { mutate: h.criar }, receber: { mutate: h.receber }, cotar: { query: h.cotar }, reconciliar: { mutate: h.rec },
} }));
import { EmprestimoSeguroCriar } from './EmprestimoSeguroCriar';
import { EmprestimoSeguroReceber } from './EmprestimoSeguroReceber';
import NovoContrato from '../pages/NovoContrato';
import ContasPagar from '../pages/ContasPagar';
import { chaveIntencao } from './EmprestimoSeguroRpc';
import { DespesasIntentStore } from '../../../shared/despesasIntent';
import { entradaEmprestimoProspectivoSchema, criarEmprestimoProspectivoAtomico } from '../../../server/services/emprestimosRpc';
const key = '11111111-1111-4111-8111-111111111111';
const body = { idempotencyKey: key, clienteId: 1, contaCaixaId: 1, modalidade: 'mensal' as const, tipoTaxa: 'mensal' as const, valorPrincipal: '100.00', taxaJuros: '0.00', numeroParcelas: 1, dataInicio: '2026-11-10', dataDesembolso: '2026-11-10', vencimentos: ['2026-12-10'] };
const quote = { elegivel: true, contratoId: 1, parcelaId: 2, contaCaixaId: 1, totalExigido: '100.00', multa: '0.00', mora: '0.00', jurosEmbutidos: '0.00', valorPagoAcumulado: '0.00', dataPagamento: '2026-11-10', vencimento: '2026-12-10', status: 'pendente', estadoHash: 'a'.repeat(64), regra: 'recebimento_defaults_brt_v1' };
const proof = (request: any, userId = h.user.id) => ({ ...request, userId, payloadHash: 'b'.repeat(64), proof: 'uuid_fenced_v1', status: 'not_executed', fenceId: '22222222-2222-4222-8222-222222222222', result: null, quote });
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
class MemoryUI {
  values: any[] = []; deps: any[] = []; cleanups: any[] = []; effects: any[] = []; cursor = 0; dirty = true; tree: any;
  constructor(private component: any, public props: any) {}
  render() { let n = 0; do { this.dirty = false; this.cursor = 0; h.current = this; this.tree = this.component(this.props); this.effects.splice(0).forEach(f => f()); if (++n > 20) throw new Error('Loop de render'); } while (this.dirty); return this; }
  async flush() { for (let i = 0; i < 12; i++) { await Promise.resolve(); if (this.dirty) this.render(); } return this; }
  nodes(type?: string) { const list: any[] = []; const walk = (n: any) => { if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== 'object') return; if (!type || n.type === type) list.push(n); walk(n.props?.children); }; walk(this.tree); return list; }
  text(n: any = this.tree): string { const walk = (v: any): string => { if (v === null || v === undefined || typeof v === 'boolean') return ''; if (Array.isArray(v)) return v.map(walk).join(' '); return typeof v === 'object' ? walk(v.props?.children) : String(v); }; return walk(n); }
  button(fragment: string) { const node = this.nodes('button').find(n => this.text(n).includes(fragment)); if (!node) throw new Error(`Botão ausente: ${fragment}\n${this.text()}`); return node; }
  async click(fragment: string) { const n = this.button(fragment); if (n.props.disabled) throw new Error(`Botão desabilitado ${fragment}`); await n.props.onClick({ stopPropagation() {} }); this.render(); await this.flush(); }
  change(node: any, value: string) { node.props.onChange ? node.props.onChange({ target: { value } }) : node.props.onValueChange(value); this.render(); }
}
let data: Map<string, string>, storage: any;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('React', React); vi.stubEnv('ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS', 'true'); vi.stubEnv('ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS', 'true');
  h.user = { id: h.user.id + 1 }; h.search = ''; data = new Map();
  storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) };
  vi.stubGlobal('sessionStorage', storage); vi.stubGlobal('window', { sessionStorage: storage, location: { get search() { return h.search; } } });
  h.cotar.mockResolvedValue(quote); h.criar.mockRejectedValue(new Error('timeout')); h.receber.mockRejectedValue(new Error('CONFLICT'));
  h.rec.mockImplementation(async r => proof(r)); h.despesaRec.mockImplementation(async r => proof(r));
  h.validar.mockImplementation(async (input: any) => { const parsed = entradaEmprestimoProspectivoSchema.parse(input); let validada = false;
    try { await criarEmprestimoProspectivoAtomico({ rpc: async () => { validada = true; throw new Error('validation-only'); } }, h.user.id, parsed); } catch (e) { if (!validada) throw e; }
    return { validada: true };
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const createUI = async () => { const r = new MemoryUI(EmprestimoSeguroCriar, { onSuccess: h.success }).render(); await r.flush(); return r; };
function fill(r: MemoryUI, principal = '100.00', taxa = '0', dates = '2026-12-10') {
  r.change(r.nodes('select')[0], '1'); r.change(r.nodes('select')[1], '1');
  r.change(r.nodes('input')[0], principal); r.change(r.nodes('input')[1], taxa);
  r.change(r.nodes('input')[2], '2026-11-10'); r.change(r.nodes('input')[3], dates);
}
describe('componentes reais com hooks, storage e RPC em memória (sem navegador/rede)', () => {
  it.each([['0', '0', '2026-12-10'], ['100', '1000', '2026-12-10'], ['0.01', '0', '2026-12-10,2027-01-10'], ['100', '0', '2026-12-31,2027-01-31'], ['100', '0', '2026-12-10,2027-02-10'], ['100', '0', '2026-02-30']])('validação completa antes de persistir: %s/%s/%s', async (principal, taxa, dates) => {
    const r = await createUI(); fill(r, principal, taxa, dates); await r.click('Confirmar criação');
    expect(h.criar).not.toHaveBeenCalled(); expect(data.size).toBe(0); expect(r.nodes('input')).toHaveLength(4);
    expect(h.error).toHaveBeenCalled();
  });
  it('principal zero continua editável e principal corrigido preserva payload em timeout/reload', async () => {
    let r = await createUI(); fill(r, '0'); await r.click('Confirmar criação'); expect(r.nodes('input')).toHaveLength(4);
    r.change(r.nodes('input')[0], '100.00'); await r.click('Confirmar criação'); const first = h.criar.mock.calls[0][0];
    expect(first.valorPrincipal).toBe('100.00'); expect(r.nodes('input')).toHaveLength(0);
    r = await createUI(); await r.click('Conferir/repetir'); expect(h.criar.mock.calls[1][0]).toEqual(first);
    expect(r.text()).not.toContain('Corrigir campos após');
  });
  it('saved invalid principal não libera por BAD_REQUEST; só fence autoritativo habilita correção', async () => {
    const bad = { ...body, valorPrincipal: '0.00' }; data.set(chaveIntencao(h.user.id, 'criar'), JSON.stringify({ versao: 1, payload: bad }));
    const r = await createUI(); expect(r.nodes('input')).toHaveLength(0); h.rec.mockRejectedValueOnce(new Error('unavailable'));
    await r.click('Reconciliar UUID'); expect(r.text()).not.toContain('Corrigir campos após'); expect(data.size).toBe(1);
    await r.click('Reconciliar UUID'); expect(r.text()).toContain('Não execução comprovada'); expect(data.size).toBe(1);
    await r.click('Corrigir campos após'); expect(r.nodes('input')[0].props.value).toBe('0.00'); expect(data.size).toBe(0);
  });
  it('resposta antiga de criação/validação não preenche outra sessão', async () => {
    const response = deferred<any>(); h.criar.mockReturnValueOnce(response.promise);
    const r = await createUI(); fill(r); const sending = r.click('Confirmar criação'); await r.flush(); const old = h.user.id;
    h.user = { id: old + 1 }; r.render(); response.resolve({ id: 9, totalContrato: '100.00' }); await sending; await r.flush();
    expect(h.success).not.toHaveBeenCalled(); expect(r.nodes('input')).toHaveLength(4);
    expect(data.has(chaveIntencao(old, 'criar'))).toBe(true); expect(data.has(chaveIntencao(h.user.id, 'criar'))).toBe(false);
  });
  it('cotação rejeitada: unknown conserva UUID; recotar só depois de fence, sem novo envio automático', async () => {
    const r = new MemoryUI(EmprestimoSeguroReceber, { contratoId: 1, parcelaId: 2, onSuccess: h.success }).render(); await r.click('Receber / conferir'); await r.click('Confirmar valor recebido');
    const original = h.receber.mock.calls[0][0]; expect(r.text()).not.toContain('Recotar após');
    await r.click('Conferir/repetir UUID'); expect(h.receber.mock.calls[1][0]).toEqual(original); expect(h.cotar).toHaveBeenCalledTimes(1);
    h.rec.mockRejectedValueOnce(new Error('timeout')); await r.click('Reconciliar UUID'); expect(r.text()).not.toContain('Recotar após');
    await r.click('Reconciliar UUID'); expect(r.text()).toContain('Recotar após'); expect(data.size).toBe(1);
    await r.click('Recotar após'); expect(h.cotar).toHaveBeenCalledTimes(2); expect(h.receber).toHaveBeenCalledTimes(2); expect(data.size).toBe(0);
  });
  it('old response de cotação após troca de sessão é ignorada', async () => {
    const response = deferred<any>(); h.cotar.mockReturnValueOnce(response.promise);
    const r = new MemoryUI(EmprestimoSeguroReceber, { contratoId: 1, parcelaId: 2, onSuccess: h.success }).render(); const request = r.click('Receber / conferir');
    await r.flush(); h.user = { id: h.user.id + 1 }; r.render(); response.resolve(quote); await request; await r.flush();
    expect(r.text()).not.toContain('Exigido:'); expect(h.success).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it.each(['/contratos/novo', '/emprestimos/novo'])('atalho %s monta mensal seguro, não legado', path => {
    const r = new MemoryUI(NovoContrato, {}).render(); expect(r.nodes().some(n => n.type === EmprestimoSeguroCriar)).toBe(true);
    expect(r.text()).toContain('Criação legada permanece bloqueada'); expect(path).toMatch(/novo$/);
    h.search = '?modalidade=tabela_price&valorPrincipal=900'; r.render(); expect(r.nodes().some(n => n.type === EmprestimoSeguroCriar)).toBe(false);
    expect(r.text()).toContain('Não há conversão silenciosa'); expect(r.nodes('a')[0].props.href).toBe('/contratos/novo');
  });
  it('despesa NOT_FOUND/timeout não libera outra operação; reconciliação comprovada + escolha explícita libera', async () => {
    const s = new DespesasIntentStore(h.user.id, storage, h.error, () => key); s.begin('pagar', { id: 101, contaCaixaId: 1, dataPagamento: '2026-11-10' });
    h.expensePay.mockRejectedValue(new Error('NOT_FOUND')); const r = new MemoryUI(ContasPagar, {}).render();
    await r.click('Reenviar intenção original'); expect(r.text()).not.toContain('Encerrar após'); expect(data.size).toBe(1);
    expect(r.nodes('button').filter(n => r.text(n).includes('Registrar pagamento atômico')).every(n => n.props.disabled)).toBe(true);
    h.despesaRec.mockRejectedValueOnce(new Error('timeout')); await r.click('Reconciliar UUID'); expect(r.text()).not.toContain('Encerrar após');
    await r.click('Reconciliar UUID'); expect(data.size).toBe(1); await r.click('Encerrar após'); expect(data.size).toBe(0);
    expect(r.nodes('button').filter(n => r.text(n).includes('Registrar pagamento atômico')).every(n => !n.props.disabled)).toBe(true);
    expect(h.expensePay).toHaveBeenCalledTimes(1);
  });
});
