import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { canonical51, toRequest51, type Intent51 } from '../../../shared/obrigacoes51';
import { chaveJournal51, chaveLock51 } from '@/lib/obrigacoes51Journal';
const h = vi.hoisted(() => ({
  owner: 11001, scope: 'a'.repeat(64), authError: false, authFetching: false, sessionError: false, sessionFetching: false,
  queries: {} as Record<string, any>, calls: [] as any[], cap: vi.fn(), expanded: vi.fn(), state: vi.fn(), accounts: vi.fn(),
  quote: vi.fn(), execute: vi.fn(), recover: vi.fn(), invalidate: vi.fn(), callback: vi.fn(),
}));
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
vi.mock('@/components/ui/input', () => ({ Input: 'input' }));
vi.mock('@/components/ui/dialog', () => ({ Dialog: 'dialog', DialogContent: 'div', DialogHeader: 'header', DialogTitle: 'h2' }));
vi.mock('@/lib/trpc', () => {
  const query = (name: string, fn: (...a: any[]) => any) => ({ useQuery: (input: any, options: any) => {
    h.calls.push({ name, input, options });
    return { data: undefined, isError: false, isLoading: false, isFetching: false, refetch: () => fn(input) };
  } });
  return { trpc: {
    auth: { me: { useQuery: () => ({ data: { id: h.owner }, isError: h.authError, isLoading: false, isFetching: h.authFetching }) } },
    obrigacoes51: {
      sessao: { useQuery: (input: any, options: any) => { h.calls.push({ name: 'session', input, options }); return { data: { userId: h.owner, sessionScope: h.scope }, isError: h.sessionError, isLoading: false, isFetching: h.sessionFetching, refetch: vi.fn() }; } },
      capacidade: query('capability', h.cap), capacidadeInclusao: query('expanded', h.expanded), estado: query('state', h.state),
      executar: { useMutation: (options: any) => { h.calls.push({ name: 'execute', options }); return { mutateAsync: h.execute }; } },
      conferir: { useMutation: (options: any) => { h.calls.push({ name: 'recover', options }); return { mutateAsync: h.recover }; } },
    },
    caixa: { contasParaOperacao37: query('accounts', h.accounts) },
    useUtils: () => ({ client: { obrigacoes51: { cotar: { query: h.quote } } }, invalidate: h.invalidate }),
  } };
});
import { OperacoesObrigacao51 } from './OperacoesObrigacao51';
import { DeleteEmprestimoDialog } from './DeleteEmprestimoDialog';
// Dispatcher real do React19, preserva frames/effects/cleanup/keys: nenhum browser ou financeiro real.
type Props = Record<string, any> & { children?: any };
type Node = { type: any; props: Props };
type Frame = { values: any[]; deps: any[]; cleanups: any[]; cursor: number };
const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
const instances: MemoryUI<any>[] = [];
class MemoryUI<P extends object = object> {
  frames = new Map<string, Frame>(); tree: any; mounted = true; dirty = true; effects: Array<() => void> = [];
  constructor(private component: React.ComponentType<P>, public props: P) { instances.push(this); }
  expand(node: any, path: string, seen: Set<string>): any {
    if (Array.isArray(node)) return node.map((n, i) => this.expand(n, `${path}/${React.isValidElement(n) ? n.key ?? i : i}`, seen));
    if (!React.isValidElement<Props>(node)) return node;
    if (typeof node.type === 'function') {
      const id = `${path}:${node.type.name}:${node.key ?? ''}`; seen.add(id);
      let f = this.frames.get(id); if (!f) { f = { values: [], deps: [], cleanups: [], cursor: 0 }; this.frames.set(id, f); }
      const frame = f; frame.cursor = 0;
      const changed = (i: number, deps?: any[]) => !deps || !frame.deps[i] || deps.length !== frame.deps[i].length || deps.some((v, n) => !Object.is(v, frame.deps[i][n]));
      const memo = (fn: () => any, deps?: any[]) => { const i = frame.cursor++; if (changed(i, deps)) { frame.values[i] = fn(); frame.deps[i] = deps ? [...deps] : []; } return frame.values[i]; };
      const effect = (fn: () => any, deps?: any[]) => { const i = frame.cursor++; if (changed(i, deps)) { frame.deps[i] = deps ? [...deps] : []; this.effects.push(() => { frame.cleanups[i]?.(); frame.cleanups[i] = fn(); }); } };
      const previous = internals.H;
      internals.H = {
        useState: (initial: any) => { const i = frame.cursor++; if (!(i in frame.values)) frame.values[i] = typeof initial === 'function' ? initial() : initial;
          return [frame.values[i], (next: any) => { frame.values[i] = typeof next === 'function' ? next(frame.values[i]) : next; this.dirty = true; }]; },
        useRef: (initial: any) => { const i = frame.cursor++; return frame.values[i] ?? (frame.values[i] = { current: initial }); },
        useMemo: memo, useCallback: (fn: any, deps: any[]) => memo(() => fn, deps), useEffect: effect, useLayoutEffect: effect,
      };
      let child: any; try { child = (node.type as any)(node.props); } finally { internals.H = previous; }
      return this.expand(child, `${id}/child`, seen);
    }
    return { type: node.type, props: { ...node.props, children: this.expand(node.props.children, `${path}/children`, seen) } };
  }
  render() {
    if (!this.mounted) return this; let count = 0;
    do { this.dirty = false; const seen = new Set<string>(); this.tree = this.expand(React.createElement(this.component, this.props), 'root', seen);
      for (const [id, f] of this.frames) if (!seen.has(id)) { f.cleanups.forEach(fn => fn?.()); this.frames.delete(id); }
      this.effects.splice(0).forEach(fn => fn()); if (++count > 40) throw Error('Loop de render');
    } while (this.dirty); return this;
  }
  async flush() { for (let i = 0; i < 40; i++) { await Promise.resolve(); if (this.dirty && this.mounted) this.render(); } return this; }
  unmount() { if (!this.mounted) return; this.frames.forEach(f => f.cleanups.forEach(fn => fn?.())); this.mounted = false; this.dirty = false; }
  nodes(type?: string): Node[] { const out: Node[] = []; const walk = (n: any) => { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; if (!type || n.type === type) out.push(n); walk(n.props?.children); }; walk(this.tree); return out; }
  text(node: any = this.tree): string { const walk = (n: any): string => n == null || typeof n === 'boolean' ? '' : Array.isArray(n) ? n.map(walk).join(' ') : typeof n === 'object' ? walk(n.props?.children) : String(n); return walk(node); }
  button(text: string) { const n = this.nodes('button').find(n => this.text(n).includes(text)); if (!n) throw Error(`Botão ausente: ${text}\n${this.text()}`); return n; }
  async click(text: string) { const n = this.button(text); if (n.props.disabled) throw Error(`Botão desabilitado: ${text}`); await n.props.onClick(); this.render(); await this.flush(); }
  change(label: string, value: string | boolean) { const n = this.nodes().find(n => n.props['aria-label'] === label); if (!n) throw Error(`Campo ausente: ${label}`); n.props.onChange({ target: { value, checked: value } }); this.render(); }
}
const uuid = '11111111-1111-4111-8111-111111111111';
const op = '22222222-2222-4222-8222-222222222222';
const scope = () => ({ ownerId: h.owner, sessionScope: h.scope, contratoId: 12 });
const saved = (proposal: any = { acao: 'editar', parcelaId: 13, novoValor: '100.00', novaDataVencimento: '2026-12-15' }): Intent51 => ({ ...scope(), idempotencyKey: uuid, proposta: proposal, estadoHash: 'b'.repeat(64), dataCalculo: '2026-11-26', motivo: 'Pedido original' });
const proof = (input: Intent51, status: 'confirmed' | 'fenced' = 'confirmed'): any => ({ status, versao: 'obrigacoes51_v1', sameIntentOnly: true,
  userId: input.ownerId, idempotencyKey: input.idempotencyKey, request: toRequest51(input),
  ...(status === 'confirmed' ? { resultado: { operationId: op, contratoId: input.contratoId, acao: input.proposta.acao, idsAfetados: [13],
    valorRecebido: input.proposta.acao === 'quitar' ? input.proposta.valorRecebido : '0.00',
    contaDestinoId: input.proposta.acao === 'quitar' ? input.proposta.contaCaixaId : null, caixaPreservado: input.proposta.acao !== 'quitar' } } : {}) });
const projection = () => ({ versao: 'obrigacoes51_v1', userId: h.owner, contratoId: 12, statusObrigacao: 'ativo', arquivado: false, obrigacaoAdicional: '10.00', parcelas: [
  { parcelaId: 13, statusFinanceiroOriginal: 'pendente', statusObrigacao: 'aberta', obrigacaoAtual: '90.00', componenteAdicional: '10.00', arquivada: false },
  { parcelaId: 14, statusFinanceiroOriginal: 'paga', statusObrigacao: 'paga', obrigacaoAtual: '0.00', componenteAdicional: '0.00', arquivada: false },
] });
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let data: Map<string, string>; let held: string;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-26T17:00:00Z'));
  vi.stubGlobal('React', React);
  h.owner = 11001; h.scope = 'a'.repeat(64); h.authError = h.authFetching = h.sessionError = h.sessionFetching = false; h.calls = [];
  data = new Map(); held = '';
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k),
    get length() { return data.size; }, key: (n: number) => [...data.keys()][n] ?? null };
  vi.stubGlobal('localStorage', storage); vi.stubGlobal('navigator', { locks: { request: async (name: string, fn: () => Promise<any>) => { const previous=held; expect(name).not.toBe(previous); if(previous) { expect(previous).toBe(`cobrapro:financeiro:owner:${h.owner}`); expect(name).toBe(chaveLock51(scope())); } else expect(name).toBe(`cobrapro:financeiro:owner:${h.owner}`); held=name; try { return await fn(); } finally { held=previous; } } } });
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => uuid) });
  h.cap.mockResolvedValue({ data: { versao: 'obrigacoes51_v1', disponivel: true } });
  h.expanded.mockResolvedValue({data:{versao:'inclusao52_v1',predecessor:'obrigacoes51_v1',disponivel:true,coortes:['prospectivo21_mensal','multimodal35_semanal','multimodal35_quinzenal','multimodal35_diario','legado34_mensal_estrito'],classificacao:'obrigacao_adicional_nao_desembolsada',caixaPreservado:true}});
  h.state.mockImplementation(async () => ({ data: projection() })); h.accounts.mockImplementation(async () => ({ data: { empresaId: h.owner, contas: [{ id: 17, nome: 'Dinheiro da empresa', tipo: 'dinheiro' }, { id: 18, nome: 'Banco da empresa', tipo: 'banco' }] } }));
  h.quote.mockImplementation(async input => ({ versao: 'obrigacoes51_v1', userId: input.ownerId, contratoId: input.contratoId, proposta: input.proposta,
    origem: 'legado', estadoHash: 'b'.repeat(64), dataCalculo: '2026-11-26', totalAntes: '90.00', totalDepois: input.proposta.acao === 'quitar' || input.proposta.acao === 'cancelar' ? '0.00' : '100.00', obrigacaoAdicional: '10.00',
    valorExigido: input.proposta.acao === 'quitar' ? input.proposta.valorRecebido : '0.00', contaDestinoId: input.proposta.acao === 'quitar' ? input.proposta.contaCaixaId : null,
    caixaPreservado: input.proposta.acao !== 'quitar', idsAfetados: ['cancelar', 'arquivar'].includes(input.proposta.acao) && input.proposta.alvo?.tipo === 'parcela' ? [input.proposta.alvo.parcelaId] : [13] }));
  h.execute.mockRejectedValue(Error('timeout')); h.recover.mockImplementation(async x => proof(x)); h.invalidate.mockResolvedValue(undefined); h.callback.mockResolvedValue(undefined);
});
afterEach(() => { instances.splice(0).forEach(r => r.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function ui(props: any = {}) { const r = new MemoryUI(OperacoesObrigacao51, { contratoId: 12, inline: true, onSuccess: h.callback, ...props }).render(); await r.flush(); return r; }
function edit(r: MemoryUI<any>, amount = '100,00', date = '2026-12-15') {
  r.change('Operação da obrigação', 'editar'); r.change('Parcela alvo', '13'); r.change('Valor da operação', amount); r.change('Data de vencimento da operação', date); r.change('Motivo da operação', 'Valor e data corrigidos juntos');
}
async function authorize(r: MemoryUI<any>) { await r.click('Obter cotação e prévia'); r.change('Confirmar prévia exata', true); }
describe('UI52 — extensão explícita e journal51 preservado; writer mockado', () => {
  it('sem capacidade52 antiga disponibilidade51 não autoriza A nem POST e recovery51 continua', async()=>{h.expanded.mockResolvedValue({data:{versao:'obrigacoes51_v1',disponivel:true}});const r=await ui();r.change('Valor da operação','10,00');r.change('Data de vencimento da operação','2026-12-15');r.change('Motivo da operação','Obrigação adicional');r.change('Reconhecer natureza da operação',true);expect(r.button('Obter cotação e prévia').props.disabled).toBe(true);await r.button('Confirmar operação cotada').props.onClick();expect(h.execute).not.toHaveBeenCalled();r.unmount();const pending=saved();data.set(chaveJournal51(scope()),JSON.stringify(pending));const recovery=await ui();await recovery.click('Conferir mesma intenção');expect(h.recover).toHaveBeenCalledWith(pending);});
  it('editar valor e data individual envia UM POST, após lock e persistência; timeout restaura exato após reload', async () => {
    let r = await ui({ alvoInicial: { tipo: 'parcela', parcelaId: 13 } }); edit(r); await authorize(r);
    h.execute.mockImplementationOnce(async exact => { expect(held).toBe(chaveLock51(scope())); expect(JSON.parse(data.get(chaveJournal51(scope()))!)).toEqual(exact); throw Error('timeout'); });
    await r.click('Confirmar operação cotada'); const original = h.execute.mock.calls[0][0];
    expect(original.proposta).toEqual({ acao: 'editar', parcelaId: 13, novoValor: '100.00', novaDataVencimento: '2026-12-15' });
    expect(h.execute).toHaveBeenCalledOnce(); expect(r.text()).toContain('Resultado não confirmado'); expect(r.nodes('input')).toHaveLength(0);
    r.unmount(); r = await ui(); await r.click('Repetir pedido exato'); expect(h.execute.mock.calls[1][0]).toEqual(original);
    await r.click('Conferir mesma intenção'); expect(h.recover.mock.calls[0][0]).toEqual(original); expect(data.has(`${chaveJournal51(scope())}:closed:${uuid}`)).toBe(true);
    expect(h.callback).not.toHaveBeenCalled(); await r.click('Encerrar confirmação'); expect(h.callback).toHaveBeenCalledOnce(); expect(data.has(chaveJournal51(scope()))).toBe(false);
  });
  it('duas telas do mesmo contrato não sobrescrevem pending nem criam segundo POST', async () => {
    const first = await ui(), second = await ui({ alvoInicial: { tipo: 'parcela', parcelaId: 13 } });
    edit(first); edit(second, '101,00'); await authorize(first); await authorize(second);
    await first.click('Confirmar operação cotada'); const exact = h.execute.mock.calls[0][0];
    await second.click('Confirmar operação cotada');
    expect(h.execute).toHaveBeenCalledOnce(); expect(second.text()).toContain('Journal mudou em outra aba');
    expect(JSON.parse(data.get(chaveJournal51(scope()))!)).toEqual(exact);
    expect(second.text()).toContain(exact.idempotencyKey);
  });
  it('quitar exige escolha explícita (sem primeira conta/origem), dinheiro real e prévia; uma única RPC global', async () => {
    const r = await ui(); r.change('Operação da obrigação', 'quitar'); r.change('Valor da operação', '90,00'); r.change('Motivo da operação', 'Dinheiro realmente recebido'); r.change('Reconhecer natureza da operação', true);
    expect(r.nodes('select').find(n => n.props['aria-label'] === 'Conta que recebeu o dinheiro')?.props.value).toBe('');
    expect(r.button('Obter cotação e prévia').props.disabled).toBe(true);
    r.change('Conta que recebeu o dinheiro', '17'); await authorize(r);
    h.execute.mockImplementation(async x => proof(x)); await r.click('Confirmar operação cotada');
    expect(h.execute).toHaveBeenCalledOnce(); expect(h.execute.mock.calls[0][0].proposta).toEqual({ acao: 'quitar', contaCaixaId: 17, valorRecebido: '90.00', reconhecoDinheiroReal: true });
    expect(r.text()).toContain('conta #17'); expect(r.text()).not.toContain('estorno confirmado');
  });
  it('adicionar exige classificação adicional não desembolsada, não simula caixa/principal', async () => {
    const r = await ui(); r.change('Valor da operação', '10,00'); r.change('Data de vencimento da operação', '2026-12-15'); r.change('Motivo da operação', 'Obrigação adicional manual');
    expect(r.button('Obter cotação e prévia').props.disabled).toBe(true); r.change('Reconhecer natureza da operação', true); await authorize(r); await r.click('Confirmar operação cotada');
    expect(h.execute.mock.calls[0][0].proposta).toEqual({ acao: 'adicionar', valor: '10.00', dataVencimento: '2026-12-15', classificacao: 'obrigacao_adicional_nao_desembolsada' });
    expect(r.text()).toContain('obrigação adicional não desembolsada, sem saída de dinheiro');
  });
  it('cancelamento individual preserva alvo exato e consentimento; arquivo é outra ação', async () => {
    const r = await ui({ alvoInicial: { tipo: 'parcela', parcelaId: 13 }, acaoInicial: 'cancelar' });
    r.change('Motivo da operação', 'Renúncia da obrigação'); r.change('Reconhecer natureza da operação', true); await authorize(r); await r.click('Confirmar operação cotada');
    expect(h.execute.mock.calls[0][0].proposta).toEqual({ acao: 'cancelar', alvo: { tipo: 'parcela', parcelaId: 13 }, reconhecoSemEstorno: true });
    expect(r.text()).toContain('não estorno');
  });
  it('arquiva parcela encerrada explicitamente sem exclusão ou estorno presumido', async () => {
    const r = await ui({ alvoInicial: { tipo: 'parcela', parcelaId: 14 }, acaoInicial: 'arquivar' });
    r.change('Motivo da operação', 'Ocultar parcela encerrada mantendo histórico'); await authorize(r);
    h.execute.mockImplementation(async x => proof(x)); await r.click('Confirmar operação cotada');
    expect(h.execute.mock.calls[0][0].proposta).toEqual({ acao: 'arquivar', alvo: { tipo: 'parcela', parcelaId: 14 } });
    expect(h.execute).toHaveBeenCalledOnce(); expect(r.text()).toContain('sem apagá-lo');
  });
  it('quote proposta/conta/dia/hash/owner divergentes não libera confirmação nem POST', async () => {
    const r = await ui(); edit(r);
    const original = h.quote.getMockImplementation()!;
    h.quote.mockImplementation(async input => ({ ...await original(input), userId: h.owner + 1 })); await r.click('Obter cotação e prévia');
    expect(r.text()).toContain('Cotação não disponível'); expect(r.text()).not.toContain('origem ausente'); expect(r.button('Confirmar operação cotada').props.disabled).toBe(true); expect(h.execute).not.toHaveBeenCalled();
  });
  it('alterar motivo/proposta após prévia invalida consentimento e handler capturado não envia', async () => {
    const r = await ui(); edit(r); await authorize(r); const oldHandler = r.button('Confirmar operação cotada').props.onClick;
    r.change('Valor da operação', '101,00'); await oldHandler(); await r.flush(); expect(h.execute).not.toHaveBeenCalled(); expect(r.button('Confirmar operação cotada').props.disabled).toBe(true);
  });
  it('virada do dia exige nova cotação mesmo handler capturado com preview antigo', async () => {
    const r = await ui(); edit(r); await authorize(r); const handler = r.button('Confirmar operação cotada').props.onClick;
    vi.setSystemTime(new Date('2026-11-27T03:01:00Z')); await handler(); await r.flush(); expect(h.execute).not.toHaveBeenCalled();
  });
  it('capacidade ausente exibe módulo em atualização; handler novo nunca usa writer alternativo', async () => {
    h.cap.mockResolvedValue({ isError: true, data: { versao: 'obrigacoes51_v1', disponivel: true } }); const r = await ui(); edit(r);
    expect(r.text()).toContain('Módulo em atualização'); await r.button('Confirmar operação cotada').props.onClick(); await r.flush();
    expect(h.execute).not.toHaveBeenCalled(); expect(data.size).toBe(0); expect(h.quote).not.toHaveBeenCalled();
  });
  it('instalação posterior permite recotar após retry explícito; não exige reinstalar/montar de novo', async () => {
    h.cap.mockResolvedValueOnce({ isError: true }); const r = await ui(); edit(r);
    expect(r.text()).toContain('Módulo em atualização'); await r.click('Conferir disponibilidade e estado novamente');
    await authorize(r); expect(r.button('Confirmar operação cotada').props.disabled).toBe(false);
    expect(h.execute).not.toHaveBeenCalled(); expect(data.size).toBe(0);
  });
  it('estado51 ausente/owner errado não vira saldo zero nem permite POST', async () => {
    h.state.mockResolvedValue({ data: { ...projection(), userId: 999 } }); const r = await ui(); edit(r);
    expect(r.text()).toContain('Estado efetivo da obrigação indisponível'); expect(r.button('Obter cotação e prévia').props.disabled).toBe(true); expect(h.execute).not.toHaveBeenCalled();
  });
  it('metadata37 de outra empresa ou erro cacheado não aparece e impede somente quitação nova', async () => {
    h.accounts.mockResolvedValue({ data: { empresaId: 999, contas: [{ id: 17, nome: 'Conta alheia', tipo: 'caixa' }] } }); const r = await ui(); r.change('Operação da obrigação', 'quitar');
    expect(r.text()).not.toContain('Conta alheia'); expect(r.text()).toContain('Contas próprias indisponíveis');
    r.change('Conta que recebeu o dinheiro', '17'); r.change('Valor da operação', '90'); r.change('Motivo da operação', 'Recebimento real'); r.change('Reconhecer natureza da operação', true);
    expect(r.button('Obter cotação e prévia').props.disabled).toBe(true);
    edit(r); await authorize(r); expect(r.button('Confirmar operação cotada').props.disabled).toBe(false);
  });
  it('nova intenção bloqueada pelo journal48 concreto em scope antigo; recovery51 existente continua', async () => {
    const name = `cobrapro:manutencao48:${h.owner}:${'c'.repeat(64)}:12`; data.set(name, 'pending48'); const r = await ui();
    expect(r.text()).toContain(name); expect(r.text()).toContain('Nada será migrado'); expect(r.button('Confirmar operação cotada').props.disabled).toBe(true); expect(data.get(name)).toBe('pending48');
    const exact = saved(); data.set(chaveJournal51(scope()), JSON.stringify(exact)); await r.click('Reler intenção preservada'); await r.click('Conferir mesma intenção');
    expect(h.recover).toHaveBeenCalledWith(exact); expect(data.get(name)).toBe('pending48');
  });
  it('pending exato recupera sem capacidade/estado/contas e fenced exige prova estrita', async () => {
    const exact = saved(); data.set(chaveJournal51(scope()), JSON.stringify(exact)); h.cap.mockResolvedValue({ isError: true }); h.state.mockResolvedValue({ isError: true });
    h.recover.mockResolvedValueOnce({ status: 'fenced' }); const r = await ui(); await r.click('Conferir mesma intenção');
    expect(r.text()).not.toContain('Não execução comprovada:'); expect(data.has(chaveJournal51(scope()))).toBe(true);
    h.recover.mockResolvedValueOnce(proof(exact, 'fenced')); await r.click('Conferir mesma intenção'); expect(r.text()).toContain('não execução comprovada');
    await r.click('Encerrar confirmação'); expect(h.execute).not.toHaveBeenCalled(); expect(h.callback).not.toHaveBeenCalled();
  });
  it('sessão A→B→A desmonta frames/key, ignora quote antiga e isola caches', async () => {
    const r = await ui(); edit(r); const deferredQuote = deferred<any>(), original = h.quote.getMockImplementation()!;
    h.quote.mockReturnValueOnce(deferredQuote.promise); const fetching = r.click('Obter cotação e prévia'); await r.flush();
    h.owner = 11002; h.scope = 'c'.repeat(64); r.render(); await r.flush(); h.owner = 11001; h.scope = 'a'.repeat(64); r.render(); await r.flush();
    const input = h.quote.mock.calls[0][0]; deferredQuote.resolve(await original(input)); await fetching; await r.flush();
    expect(r.text()).not.toContain('Snapshot:'); expect(h.execute).not.toHaveBeenCalled();
    const accountCalls = h.calls.filter(c => c.name === 'accounts'), hashes = accountCalls.map(c => c.options.queryKeyHashFn(['caixa', 'contasParaOperacao37']));
    expect(new Set(hashes).size).toBeGreaterThanOrEqual(3);
  });
  it('resposta financeira da geração A anterior não arquiva/callback em novo A', async () => {
    const r = await ui(); edit(r); await authorize(r); const result = deferred<any>(); h.execute.mockReturnValueOnce(result.promise);
    const sending = r.click('Confirmar operação cotada'); await r.flush(); const exact = h.execute.mock.calls[0][0];
    h.owner = 11002; h.scope = 'c'.repeat(64); r.render(); await r.flush(); h.owner = 11001; h.scope = 'a'.repeat(64); r.render(); await r.flush();
    result.resolve(proof(exact)); await sending; await r.flush();
    expect(h.callback).not.toHaveBeenCalled(); expect(data.has(`${chaveJournal51(scope())}:closed:${uuid}`)).toBe(false);
    expect(r.text()).toContain(uuid); await r.click('Conferir mesma intenção'); expect(h.recover).toHaveBeenCalledWith(exact);
  });
  it('auth/session em erro ou fetching desmonta acesso e callbacks antigos', async () => {
    const r = await ui(); edit(r); await authorize(r); const stale = r.button('Confirmar operação cotada').props.onClick;
    h.sessionFetching = true; r.render(); await stale(); await r.flush(); expect(r.text()).toContain('Conferindo a sessão'); expect(h.execute).not.toHaveBeenCalled();
  });
  it('callback falho acontece após arquivo+readback+remoção; reload não reexecuta financeiro', async () => {
    const r = await ui(); edit(r); await authorize(r); h.execute.mockImplementation(async x => proof(x));
    h.callback.mockImplementation(async () => { expect(data.has(chaveJournal51(scope()))).toBe(false); expect(JSON.parse(data.get(`${chaveJournal51(scope())}:closed:${uuid}`)!).closure.status).toBe('confirmed'); throw Error('UI failed'); });
    await r.click('Confirmar operação cotada'); await r.click('Encerrar confirmação'); expect(r.text()).toContain('não repita o financeiro');
    r.unmount(); const restored = await ui(); expect(restored.text().replace(/\s+/g, ' ')).toContain('Última intenção arquivada: confirmada'); expect(h.execute).toHaveBeenCalledOnce(); expect(h.recover).not.toHaveBeenCalled();
  });
  it('falha de invalidação não impede callback pós-prova e não retorna ao financeiro', async () => {
    const r = await ui(); edit(r); await authorize(r); h.execute.mockImplementation(async x => proof(x)); h.invalidate.mockRejectedValue(Error('Cache unavailable'));
    await r.click('Confirmar operação cotada'); await r.click('Encerrar confirmação');
    expect(h.callback).toHaveBeenCalledOnce(); expect(h.execute).toHaveBeenCalledOnce(); expect(h.recover).not.toHaveBeenCalled();
    expect(data.has(`${chaveJournal51(scope())}:closed:${uuid}`)).toBe(true); expect(data.has(chaveJournal51(scope()))).toBe(false);
    expect(r.text()).toContain('Atualização da tela pendente');
  });
  it('arquivo terminal sem readback mantém intenção incerta e não chama callback', async () => {
    const r = await ui(); edit(r); await authorize(r); h.execute.mockImplementation(async x => proof(x));
    const originalSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => { if (!key.includes(':closed:')) originalSet(key, value); };
    await r.click('Confirmar operação cotada');
    expect(r.text()).toContain('Prova não persistiu'); expect(r.text()).toContain('Conferir mesma intenção');
    expect(h.callback).not.toHaveBeenCalled(); expect(data.has(chaveJournal51(scope()))).toBe(true); expect(h.execute).toHaveBeenCalledOnce();
    expect(r.nodes('button').some(n => r.text(n).includes('Encerrar confirmação'))).toBe(false);
  });
  it('sem locks botão não executa financeiro nem perde intenção', async () => {
    const r = await ui(); edit(r); await authorize(r); vi.stubGlobal('navigator', {}); await r.click('Confirmar operação cotada');
    expect(h.execute).not.toHaveBeenCalled(); expect(r.text()).toContain('Web Locks'); expect(data.size).toBe(0);
  });
  it('diálogo antigo delega ao MESMO componente, alvo exato contrato, sem POST de exclusão', async () => {
    const r = new MemoryUI(DeleteEmprestimoDialog, { emprestimoId: 12, clienteNome: 'Cliente sintético', open: true, onOpenChange: vi.fn(), onSuccess: h.callback }).render(); await r.flush();
    expect(r.text()).toContain('Cancelar obrigação / arquivar contrato encerrado'); expect(r.nodes('select').find(n => n.props['aria-label'] === 'Operação da obrigação')?.props.value).toBe('cancelar');
    expect(r.nodes('select').find(n => n.props['aria-label'] === 'Alvo da operação')?.props.value).toBe('contrato');
    expect(h.execute).not.toHaveBeenCalled(); expect(r.text()).toContain('Não é exclusão');
  });
  it('queries usam cache por owner/session/generation e novas mutations sem retry automático', async () => {
    await ui(); for (const name of ['session', 'capability', 'state', 'accounts']) {
      const call = h.calls.find(c => c.name === name); expect(call.options.queryKeyHashFn).toBeTypeOf('function'); expect(call.options.placeholderData).toBeUndefined(); expect(call.options.retry).toBe(false);
    }
    expect(h.calls.filter(c => c.name === 'execute' || c.name === 'recover').every(c => c.options.retry === false)).toBe(true);
  });
});

// Provas novas exclusivas da composição: não removem os cenários52/51 originais.
describe('composição52→53 lock owner e pending estrangeiro preservados',()=>{
 it('pending53 da mesma empresa impede pedido51 novo sem criar UUID ou POST',async()=>{
  const r=await ui(); edit(r); await authorize(r);
  const other=`cobrapro:sucessores53:v1:${h.owner}:${h.scope}:99`,bytes='pending53-preservado';data.set(other,bytes);
  await r.click('Confirmar operação cotada');expect(h.execute).not.toHaveBeenCalled();expect(data.get(other)).toBe(bytes);expect(data.has(chaveJournal51(scope()))).toBe(false);expect(r.text()).toContain('Pendência financeira da mesma empresa preservada');
 });
 it('recovery51 original funciona mesmo com52 indisponível e pending53, sem adotar journal53',async()=>{
  const exact=saved();data.set(chaveJournal51(scope()),JSON.stringify(exact));const other=`cobrapro:sucessores53:v1:${h.owner}:${h.scope}:99`;data.set(other,'pending53-preservado');h.expanded.mockResolvedValue({data:null,isError:true});
  const r=await ui();await r.click('Conferir mesma intenção');expect(h.recover).toHaveBeenCalledWith(exact);expect(h.execute).not.toHaveBeenCalled();expect(data.get(other)).toBe('pending53-preservado');expect(data.has(`${chaveJournal51(scope())}:closed:${uuid}`)).toBe(true);
 });
});
