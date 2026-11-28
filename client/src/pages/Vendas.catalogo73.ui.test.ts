import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const requireLocal = createRequire(import.meta.url);
const ts: typeof import('typescript') = requireLocal('typescript');
const source = new URL('./Vendas.tsx', import.meta.url);
const helperSource = new URL('../lib/vendasProdutoForm.ts', import.meta.url);
type HarnessMocks = Record<string, any>; // Mock boundary, not application data.
let active: Harness, Vendas: () => any, h: HarnessMocks;
const fixture = (owner: number, snake = false) => [{ id: owner * 10, nome: `cobrprod fixture ${owner === 101 ? 'A' : 'B'}`, descricao: 'FICTÍCIO', preco: '25.00', estoque: 2, [snake ? 'user_id' : 'userId']: owner }];
function deferred() { let resolve!: (value: unknown) => void, reject!: (reason?: unknown) => void; const promise = new Promise<unknown>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const React = {
  createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } }),
  useState: (init: any) => { const r = active, i = r.cursor++; if (!(i in r.values)) r.values[i] = typeof init === 'function' ? init() : init; return [r.values[i], (next: any) => { r.values[i] = typeof next === 'function' ? next(r.values[i]) : next; r.dirty = true; r.writes++; }]; },
  useRef: (init: any) => { const r = active, i = r.cursor++; return r.values[i] ?? (r.values[i] = { current: init }); },
  useEffect: (fn: any, deps: any[]) => { const r = active, i = r.cursor++; if (!r.deps[i] || deps.some((d: any, n: number) => d !== r.deps[i][n])) { r.effects.push(() => { r.cleanups[i]?.(); r.cleanups[i] = fn(); }); r.deps[i] = deps; } },
};
function compile(path: string | URL, mocks: HarnessMocks): HarnessMocks {
  const exports: HarnessMocks = {};
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(`(function(require,exports){${js}\n})`, { React, console: { warn: () => {}, error: () => {} } })( (id: string) => { if (id in mocks) return mocks[id]; throw new Error(`Import não mockado: ${id}`); }, exports);
  return exports;
}
function load() {
  const components: HarnessMocks = {};
  for (const names of [['Card','CardContent','CardHeader','CardTitle'],['Button'],['Input'],['Label'],['Select','SelectContent','SelectItem','SelectTrigger','SelectValue'],['Badge'],['Dialog','DialogContent','DialogHeader','DialogTitle','DialogTrigger'],['Textarea']]) {
    const module = names[0] === 'Card' ? 'card' : names[0].toLowerCase();
    components[`@/components/ui/${module}`] = Object.fromEntries(names.map(n => [n, n]));
  }
  const query = { useQuery: (input: any, options: any) => { h.queryOptions = options; h.queryInput = input; return h.catalog; } };
  const mutation = { useMutation: (options: any = {}) => { h.mutationOptions = options; return { isPending: false, mutate: (input: any) => { h.create(input).then(options.onSuccess, options.onError); }, mutateAsync: h.create }; } };
  const pure = compile(helperSource, {});
  return compile(source, { ...components, react: React, 'react-i18next': { useTranslation: () => ({ t: (v: string) => v }) }, '@/lib/trpc': { trpc: { auth: { me: { useQuery: (_input: any, options: any) => { h.authOptions = options; return h.auth; } } }, useUtils: () => ({ vendas: { listarProdutos: { invalidate: h.invalidate } } }), vendas: { listarProdutos: query, criarProduto: mutation } } }, sonner: { toast: { success: h.success, error: h.error, info: h.info } }, 'lucide-react': Object.fromEntries(['ShoppingBag','Plus','Package','TrendingUp','DollarSign','AlertCircle'].map(n => [n,n])), '../../../shared/finance': { formatarMoeda: (v: number) => `R$ ${v.toFixed(2)}` }, wouter: { useLocation: () => ['/', h.navigate] }, '../lib/vendasProdutoForm': pure }).default;
}
class Harness {
  values: any[] = []; deps: any[] = []; cleanups: any[] = []; effects: any[] = []; cursor = 0; dirty = true; tree: any; writes = 0;
  render() { let turns = 0; do { this.dirty = false; this.cursor = 0; active = this; this.tree = Vendas(); this.effects.splice(0).forEach(f => f()); if (++turns > 20) throw new Error('Render loop'); } while (this.dirty); return this; }
  async flush() { for (let i = 0; i < 15; i++) { await Promise.resolve(); if (this.dirty) this.render(); } return this; }
  nodes(type?: string, root = this.tree) { const out: any[] = []; const walk = (n: any) => { if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== 'object') return; if (!type || n.type === type) out.push(n); walk(n.props?.children); }; walk(root); return out; }
  text(root = this.tree): string { return root == null || typeof root === 'boolean' ? '' : Array.isArray(root) ? root.map(n => this.text(n)).join(' ') : typeof root === 'object' ? this.text(root.props?.children) : String(root); }
  button(name: string) { const n = this.nodes('Button').find(n => this.text(n).includes(name)); if (!n) throw new Error(`Botão ausente: ${name}`); return n; }
  change(index: number, value: string) { this.nodes('Input')[index].props.onChange({ target: { value } }); this.render(); }
  fill(name = ' Produto fictício ', price = '1234,56', stock = '2') { this.change(0, name); this.change(1, price); this.change(2, stock); }
  async submit() { this.button('Cadastrar Produto').props.onClick(); await this.flush(); }
  unmount() { this.cleanups.forEach(f => f?.()); }
}
let ui: Harness;
beforeEach(() => {
  h = { auth: { data: { id: 101 }, isError: false, isLoading: false, isFetching: false }, catalog: { data: fixture(101), isError: false, isLoading: false, isFetching: false, refetch: vi.fn().mockResolvedValue({ data: fixture(101), isError: false }) }, create: vi.fn().mockResolvedValue({ success: true, id: 1010 }), invalidate: vi.fn().mockResolvedValue(undefined), success: vi.fn(), error: vi.fn(), info: vi.fn(), navigate: vi.fn() };
  h.auth.refetch = vi.fn().mockResolvedValue({ data: { id: 101 }, isError: false });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede proibida'); }));
  Vendas = load(); ui = new Harness().render();
});
afterEach(() => { ui?.unmount(); expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe('Vendas REAL — componente e handlers, offline', () => {
  it('erro de leitura não é vazio, permite novo produto e retry é somente RO', async () => {
    h.catalog = { ...h.catalog, data: undefined, isError: true }; ui.render();
    expect(ui.text()).not.toContain('Nenhum produto cadastrado'); expect(ui.text()).toContain('Não foi possível'); expect(ui.button('Novo Produto').props.disabled).toBe(false);
    ui.button('Novo Produto').props.onClick(); ui.render(); expect(ui.nodes('Dialog')[0].props.open).toBe(true); expect(ui.nodes('Input').every(n => n.props.disabled === false)).toBe(true);
    ui.button('Tentar leitura novamente').props.onClick(); await ui.flush(); expect(h.catalog.refetch).toHaveBeenCalledOnce(); expect(h.create).not.toHaveBeenCalled();
  });
  it('vazio confirmado distinto de loading', () => { h.catalog.data = []; ui.render(); expect(ui.text()).toContain('Nenhum produto cadastrado'); h.catalog.isLoading = true; ui.render(); expect(ui.text()).toContain('Carregando produtos'); expect(ui.text()).not.toContain('Nenhum produto cadastrado'); });
  it.each([['   ','10','0'], ['a'.repeat(256),'10','0'], ['Nome','-10','0'], ['Nome','10 reais','0'], ['Nome','1e3','0'], ['Nome','0.001','0'], ['Nome','10','1.9'], ['Nome','10','abc'], ['Nome','10','2147483648'], ['Nome','10','-1']])('handler rejeita formulário inválido %j', async (name, price, stock) => { ui.fill(name, price, stock); await ui.submit(); expect(h.create).not.toHaveBeenCalled(); expect(h.error).toHaveBeenCalled(); });
  it('normaliza nome, dinheiro BR e captura payload imutável sem owner no input', async () => { const wait = deferred(); h.create.mockReturnValue(wait.promise); ui.fill(' Produto fictício ', '1.234,56', '2147483647'); await ui.submit(); expect(h.create).toHaveBeenCalledWith({ nome: 'Produto fictício', descricao: undefined, preco: 1234.56, estoque: 2147483647 }); const payload = h.create.mock.calls[0][0]; expect(Object.isFrozen(payload)).toBe(true); expect('userId' in payload).toBe(false); wait.resolve({ success: true, id: 1020 }); await ui.flush(); });
  it('singleflight síncrono impede dois envios antes de rerender', async () => { const wait = deferred(); h.create.mockReturnValue(wait.promise); ui.fill(); const send = ui.button('Cadastrar Produto').props.onClick; send(); send(); await ui.flush(); expect(h.create).toHaveBeenCalledOnce(); wait.resolve({ success: true, id: 1010 }); await ui.flush(); });
  it('atalho explicita financeiro em implementação e não navega a NovoContrato', () => { const b = ui.nodes('Button').find(n => ui.text(n).includes('Prazo') || ui.text(n).includes('prazo')); expect(b).toBeTruthy(); b.props.onClick(); ui.render(); expect(h.navigate).not.toHaveBeenCalled(); expect(ui.nodes().some(n => n.props?.role === 'alert' && ui.text(n).includes('em implementação'))).toBe(true); expect(ui.text(b).trim()).toBe('Conferir venda a prazo'); });
  it.each([false,true])('row owner errado em camel/snake (%s) não exibe cache da empresa anterior', snake => { h.auth.data = { id: 202 }; h.catalog.data = fixture(101, snake); ui.render(); expect(ui.text()).not.toContain('cobrprod fixture A'); expect(ui.button('Novo Produto').props.disabled).toBe(false); });
  it('row sem owner ou conflitante não é exibido, mas cadastro usa sessão confirmada', () => { h.catalog.data = [{ ...fixture(101)[0], userId: undefined }]; ui.render(); expect(ui.text()).not.toContain('cobrprod fixture A'); expect(ui.button('Novo Produto').props.disabled).toBe(false); h.catalog.data = [{ ...fixture(101)[0], user_id: 202 }]; ui.render(); expect(ui.text()).not.toContain('cobrprod fixture A'); expect(ui.button('Novo Produto').props.disabled).toBe(false); });
  it('query ctx-only particiona cache local por geração e sem input de empresa', () => { const first = h.queryOptions; expect(h.queryInput).toBeUndefined(); expect(first.retry).toBe(false); expect(first.gcTime).toBe(0); expect(first.trpc.abortOnUnmount).toBe(true); const hash = first.queryKeyHashFn(['vendas']); h.auth.data = { id: 202 }; h.catalog.data = fixture(202); ui.render(); expect(h.queryOptions.queryKeyHashFn(['vendas'])).not.toBe(hash); h.auth.data = { id: 101 }; h.catalog.data = fixture(101); ui.render(); expect(h.queryOptions.queryKeyHashFn(['vendas'])).not.toBe(hash); });
  it.each(['owner','ABA','refetch','unmount'])('callback de sucesso tardio após %s não fecha/reset/toast/invalidate', async scope => {
    const wait = deferred(); h.create.mockReturnValue(wait.promise); ui.fill(); await ui.submit();
    if (scope === 'unmount') ui.unmount();
    else if (scope === 'refetch') { h.auth.isFetching = true; ui.render(); h.auth.isFetching = false; ui.render(); }
    else { h.auth.data = { id: 202 }; h.catalog.data = fixture(202); ui.render(); if (scope === 'ABA') { h.auth.data = { id: 101 }; h.catalog.data = fixture(101); ui.render(); } }
    const writes = ui.writes; wait.resolve({ success: true, id: 1010 }); await ui.flush();
    if (scope === 'ABA' || scope === 'refetch') { expect(ui.writes).toBeGreaterThan(writes); expect(ui.text()).toContain('Resultado incerto'); }
    else expect(ui.writes).toBe(writes);
    expect(h.success).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled(); expect(h.error).not.toHaveBeenCalled();
  });
  it('erro tardio de A não altera B nem seu in-flight', async () => { const old = deferred(), fresh = deferred(); h.create.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise); ui.fill(); await ui.submit(); h.auth.data = { id: 202 }; h.catalog.data = fixture(202); ui.render(); ui.fill('Produto B'); await ui.submit(); const writes = ui.writes; old.reject(new Error('timeout privado')); await ui.flush(); expect(ui.writes).toBe(writes); expect(h.error).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled(); expect(h.create).toHaveBeenCalledTimes(2); fresh.resolve({ success: true, id: 2020 }); await ui.flush(); expect(h.success).toHaveBeenCalledOnce(); });
  it('timeout preserva snapshot e intenção; retry RO nunca reenvia nem limpa cadastro incerto', async () => { h.create.mockRejectedValueOnce(new Error('Timeout sintético')); ui.fill(); await ui.submit(); expect(ui.text()).toContain('Resultado incerto'); expect(ui.nodes('Input')[0].props.value).toBe(' Produto fictício '); expect(ui.button('Cadastrar Produto').props.disabled).toBe(true); await ui.submit(); expect(h.create).toHaveBeenCalledOnce(); ui.button('Conferir catálogo').props.onClick(); await ui.flush(); expect(h.catalog.refetch).toHaveBeenCalledOnce(); await ui.submit(); expect(h.create).toHaveBeenCalledOnce(); expect(h.mutationOptions.retry).toBe(false); });
  it('sucesso atual fecha e limpa formulário e invalida catálogo somente atual', async () => { ui.fill(); await ui.submit(); expect(h.success).toHaveBeenCalledOnce(); expect(h.invalidate).toHaveBeenCalledOnce(); expect(ui.nodes('Input')[0].props.value).toBe(''); expect(ui.nodes('Dialog')[0].props.open).toBe(false); });
  it('handler antigo ABA não consegue criar produto ou iniciar retry da nova geração', async () => { ui.fill(); const stale = ui.button('Cadastrar Produto').props.onClick; h.auth.data = { id: 202 }; h.catalog.data = fixture(202); ui.render(); h.auth.data = { id: 101 }; h.catalog.data = fixture(101); ui.render(); stale(); await ui.flush(); expect(h.create).not.toHaveBeenCalled(); });
  it.each(['null','error','loading','pending','fetching'])('sessão %s não mostra rows nem habilita cadastro', async state => {
    ui.fill(); const stale = ui.button('Cadastrar Produto').props.onClick;
    if (state === 'null') h.auth.data = null;
    else { const flags: Record<string, string> = {error:'isError',loading:'isLoading',pending:'isPending',fetching:'isFetching'}; h.auth[flags[state]] = true; }
    ui.render(); expect(ui.text()).not.toContain('cobrprod fixture A'); expect(ui.button('Novo Produto').props.disabled).toBe(true);
    stale(); await ui.flush(); expect(h.create).not.toHaveBeenCalled();
  });
  it('catalog refetch não bloqueia mutação do owner confirmado nem usa rows antigas', async () => { ui.fill('Produto novo', '0,01', '0'); const send = ui.button('Cadastrar Produto').props.onClick; h.catalog.isFetching = true; ui.render(); send(); await ui.flush(); expect(h.create).toHaveBeenCalledWith({nome:'Produto novo',descricao:undefined,preco:0.01,estoque:0}); expect(ui.text()).not.toContain('cobrprod fixture A'); });
  it('sucesso só invalida queryHash da geração atual, não outro mount/owner', async () => {
    const hash = h.queryOptions.queryKeyHashFn(['vendas']); ui.fill(); await ui.submit();
    const [input, filters] = h.invalidate.mock.calls[0]; expect(input).toBeUndefined();
    expect(filters.predicate({ queryHash: hash })).toBe(true);
    expect(filters.predicate({ queryHash: 'vendas73:999:202:0:[]' })).toBe(false);
    expect(filters.predicate({ queryHash: '["vendas"]' })).toBe(false);
  });
  it.each([{ success:false, id:1 }, { success:true, id:0 }, null])('resposta não confirmada %j permanece incerta e não limpa snapshot', async result => { h.create.mockResolvedValueOnce(result); ui.fill(); await ui.submit(); expect(ui.text()).toContain('Resultado incerto'); expect(h.success).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled(); expect(ui.nodes('Input')[0].props.value).toBe(' Produto fictício '); });
  it('intenção incerta de owner A permanece no remount e em A→B→A; readback não é prova de não execução', async () => {
    h.create.mockRejectedValueOnce(new Error('timeout')); ui.fill(); await ui.submit();
    ui.unmount(); ui = new Harness().render(); expect(ui.text()).toContain('Resultado incerto'); expect(ui.button('Cadastrar Produto').props.disabled).toBe(true);
    h.auth.data = {id:202}; h.catalog.data = fixture(202); ui.render(); expect(ui.text()).not.toContain('Resultado incerto'); expect(ui.nodes('Input')[0].props.value).toBe('');
    h.auth.data = {id:101}; h.catalog.data = fixture(101); ui.render(); expect(ui.text()).toContain('Resultado incerto');
    h.catalog.refetch.mockResolvedValueOnce({data:[],isError:false}); ui.button('Conferir catálogo').props.onClick(); await ui.flush(); await ui.submit(); expect(h.create).toHaveBeenCalledOnce();
  });
  it('retry antigo A→B não inicia leitura de B e retorno tardio RO não limpa formulário', async () => {
    h.catalog.isError = true; ui.render(); const stale = ui.button('Tentar leitura novamente').props.onClick;
    h.auth.data = {id:202}; h.catalog = {...h.catalog,data:fixture(202),isError:false}; ui.render(); stale(); await ui.flush(); expect(h.catalog.refetch).not.toHaveBeenCalled();
    ui.fill('Rascunho B'); const read = deferred(); h.catalog.refetch.mockReturnValueOnce(read.promise);
    h.catalog.isError = true; ui.render(); ui.button('Tentar leitura novamente').props.onClick(); read.resolve({data:fixture(101),isError:false}); await ui.flush(); expect(ui.nodes('Input')[0].props.value).toBe('Rascunho B'); expect(h.create).not.toHaveBeenCalled();
  });
  it('estoque físico null não vira zero; row snake_case atual e preco:number renderizam', () => { h.catalog.data = [{...fixture(101,true)[0],preco:25,estoque:null}]; ui.render(); expect(ui.text()).toContain('cobrprod fixture A'); expect(ui.text()).toContain('Estoque não informado'); expect(ui.text()).not.toContain('Sem estoque'); expect(ui.text()).toContain('R$ 25.00'); });
});


describe('Cadastro não financeiro — separação explícita de intenção incerta', () => {
  it.each(['error','loading','pending','fetching','undefined','wrongOwner','mixedOwner'])('catálogo %s não bloqueia cadastro novo e não contribui para payload', async state => {
    if (state === 'undefined') h.catalog.data = undefined;
    else if (state === 'wrongOwner') h.catalog.data = fixture(202);
    else if (state === 'mixedOwner') h.catalog.data = [...fixture(101), ...fixture(202)];
    else { const flags: Record<string, string> = {error:'isError',loading:'isLoading',pending:'isPending',fetching:'isFetching'}; h.catalog[flags[state]] = true; }
    ui.render(); expect(ui.button('Novo Produto').props.disabled).toBe(false);
    expect(ui.text()).not.toContain('cobrprod fixture A'); expect(ui.text()).not.toContain('cobrprod fixture B');
    ui.button('Novo Produto').props.onClick(); ui.render(); expect(ui.nodes('Dialog')[0].props.open).toBe(true);
    ui.fill('Produto independente', '12.345,67', '3'); await ui.submit();
    expect(h.create).toHaveBeenCalledWith({nome:'Produto independente',descricao:undefined,preco:12345.67,estoque:3});
    expect(h.queryInput).toBeUndefined(); expect(h.success).toHaveBeenCalledOnce();
  });
  it.each(['error','loading'])('validação em centavos continua rejeitando subcentavos durante %s', async state => {
    h.catalog[state === 'error' ? 'isError' : 'isLoading'] = true; ui.render(); ui.fill('Novo', '0.001', '0'); await ui.submit();
    expect(h.create).not.toHaveBeenCalled(); expect(h.error).toHaveBeenCalledOnce(); expect(ui.button('Cadastrar Produto').props.disabled).toBe(false);
  });
  it.each(['Iniciar outro produto','Novo Produto'])('%s separa snapshot incerto e abre formulário vazio sem reenvio', async start => {
    h.create.mockRejectedValueOnce(new Error('timeout')); ui.fill('Antigo', '15,90', '4');
    ui.nodes('Textarea')[0].props.onChange({target:{value:'Descrição antiga'}}); ui.render(); await ui.submit();
    const staleSend = ui.button('Cadastrar Produto').props.onClick;
    const staleEdit = ui.nodes('Input')[0].props.onChange;
    const staleStart = ui.button(start).props.onClick;
    expect(ui.text()).toContain('pode duplicar'); expect(ui.button('Novo Produto').props.disabled).toBe(false);
    ui.change(0, 'Tentativa de sobrescrever'); expect(ui.nodes('Input')[0].props.value).toBe('Antigo');
    expect(ui.nodes('Input').every(n => n.props.disabled)).toBe(true);
    staleStart(); ui.render(); expect(ui.nodes('Dialog')[0].props.open).toBe(true);
    expect(ui.nodes('Input').map(n => n.props.value)).toEqual(['','','0']); expect(ui.nodes('Textarea')[0].props.value).toBe('');
    expect(ui.nodes('Input').every(n => n.props.disabled === false)).toBe(true);
    expect(ui.text()).toContain('Snapshot anterior:'); expect(ui.text()).toContain('Descrição antiga'); expect(h.create).toHaveBeenCalledOnce();
    staleSend(); staleEdit({target:{value:'Replay antigo'}}); staleStart(); await ui.flush();
    expect(h.create).toHaveBeenCalledOnce(); expect(ui.nodes('Input')[0].props.value).toBe('');
    await ui.submit(); expect(h.create).toHaveBeenCalledOnce(); // vazio é inválido, não replay
    ui.fill('Produto diferente', '0,01', '0'); await ui.submit();
    expect(h.create).toHaveBeenCalledTimes(2); expect(h.create.mock.calls[1][0]).toEqual({nome:'Produto diferente',descricao:undefined,preco:0.01,estoque:0});
    expect(ui.text()).toContain('Snapshot anterior:'); expect(ui.text()).toContain('pode duplicar');
  });
  it('pending preserva lock síncrono, bloqueia iniciar outra intenção e edição', async () => {
    const wait = deferred(); h.create.mockReturnValueOnce(wait.promise); ui.fill('Em voo');
    const send = ui.button('Cadastrar Produto').props.onClick; const open = ui.button('Novo Produto').props.onClick;
    send(); open(); send(); ui.change(0, 'Não pode editar'); await ui.flush();
    expect(h.create).toHaveBeenCalledOnce(); expect(ui.button('Novo Produto').props.disabled).toBe(true);
    expect(ui.nodes('Input')[0].props.value).toBe('Em voo'); expect(ui.text()).not.toContain('Iniciar outro produto');
    wait.reject(new Error('timeout')); await ui.flush(); expect(ui.button('Iniciar outro produto').props.disabled).toBe(false);
  });
  it.each(['error','loading','fetching'])('separação de intenção permite nova mutação mesmo catálogo %s', async state => {
    h.create.mockRejectedValueOnce(new Error('timeout')); ui.fill('Antigo'); await ui.submit();
    h.catalog[state === 'error' ? 'isError' : state === 'loading' ? 'isLoading' : 'isFetching'] = true; ui.render();
    ui.button('Iniciar outro produto').props.onClick(); ui.render(); ui.fill('Outro', '2,34', '5'); await ui.submit();
    expect(h.create).toHaveBeenCalledTimes(2); expect(h.create.mock.calls[1][0].nome).toBe('Outro');
  });
  it('readback vazio/igual/falha nunca separa intenção nem reenvia e não há autoretry', async () => {
    h.create.mockRejectedValueOnce(new Error('timeout')); ui.fill('Incerto'); await ui.submit();
    for (const data of [[], fixture(101)]) {
      h.catalog.refetch.mockResolvedValueOnce({data,isError:false}); ui.button('Conferir catálogo').props.onClick(); await ui.flush();
      expect(ui.nodes('Input')[0].props.value).toBe('Incerto'); expect(ui.button('Cadastrar Produto').props.disabled).toBe(true);
    }
    h.catalog.refetch.mockRejectedValueOnce(new Error('leitura falhou')); ui.button('Conferir catálogo').props.onClick(); await ui.flush();
    expect(h.create).toHaveBeenCalledOnce(); expect(h.catalog.refetch).toHaveBeenCalledTimes(3);
    expect(h.queryOptions.retry).toBe(false); expect(h.authOptions.retry).toBe(false); expect(h.mutationOptions.retry).toBe(false);
    expect(ui.text()).toContain('Resultado incerto');
  });
  it('readback tardio após separação não altera rascunho ou pedido novo', async () => {
    h.create.mockRejectedValueOnce(new Error('timeout')); ui.fill('Incerto'); await ui.submit();
    const wait = deferred(); h.catalog.refetch.mockReturnValueOnce(wait.promise); ui.button('Conferir catálogo').props.onClick();
    ui.button('Iniciar outro produto').props.onClick(); ui.render(); ui.fill('Rascunho novo'); const writes = ui.writes;
    wait.resolve({data:[],isError:false}); await ui.flush();
    expect(ui.nodes('Input')[0].props.value).toBe('Rascunho novo'); expect(ui.writes).toBe(writes); expect(h.create).toHaveBeenCalledOnce();
  });
  it('handlers de separação antigos não atuam após auth refetch, A→B→A ou unmount', async () => {
    h.create.mockRejectedValueOnce(new Error('timeout')); ui.fill('Incerto A'); await ui.submit(); const staleStart = ui.button('Iniciar outro produto').props.onClick;
    h.auth.isFetching = true; ui.render(); h.auth.isFetching = false; ui.render(); staleStart(); ui.render();
    expect(ui.nodes('Input')[0].props.value).toBe('Incerto A');
    const anotherStale = ui.button('Iniciar outro produto').props.onClick;
    h.auth.data = {id:202}; h.catalog.data = fixture(202); ui.render(); expect(ui.text()).not.toContain('Incerto A');
    anotherStale(); ui.render(); expect(ui.nodes('Input')[0].props.value).toBe('');
    h.auth.data = {id:101}; h.catalog.data = fixture(101); ui.render(); anotherStale(); ui.render(); expect(ui.nodes('Input')[0].props.value).toBe('Incerto A');
    const unmounted = ui.button('Iniciar outro produto').props.onClick; ui.unmount(); const writes = ui.writes; unmounted(); expect(ui.writes).toBe(writes);
    expect(h.create).toHaveBeenCalledOnce();
  });
  it('remount e A→B→A após separação mantêm histórico só do owner e não impõem latch', async () => {
    h.create.mockRejectedValueOnce(new Error('timeout')); ui.fill('Histórico A'); await ui.submit(); ui.button('Iniciar outro produto').props.onClick(); ui.render();
    ui.unmount(); ui = new Harness().render(); expect(ui.text()).toContain('Histórico A'); expect(ui.button('Novo Produto').props.disabled).toBe(false); expect(ui.nodes('Input')[0].props.value).toBe('');
    h.auth.data = {id:202}; h.catalog.data = fixture(202); ui.render(); expect(ui.text()).not.toContain('Histórico A');
    h.auth.data = {id:101}; h.catalog.data = fixture(101); ui.render(); expect(ui.text()).toContain('Histórico A');
    ui.fill('Segundo A'); await ui.submit(); expect(h.create).toHaveBeenCalledTimes(2);
  });
  it('pending por owner sobrevive remount e ABA sem liberar duplicata até settle', async () => {
    const wait = deferred(); h.create.mockReturnValueOnce(wait.promise); ui.fill('Pendente A'); await ui.submit();
    ui.unmount(); ui = new Harness().render(); expect(ui.button('Novo Produto').props.disabled).toBe(true); await ui.submit(); expect(h.create).toHaveBeenCalledOnce();
    h.auth.data = {id:202}; h.catalog.data = fixture(202); ui.render(); expect(ui.button('Novo Produto').props.disabled).toBe(false);
    h.auth.data = {id:101}; h.catalog.data = fixture(101); ui.render(); expect(ui.button('Novo Produto').props.disabled).toBe(true);
    wait.resolve({success:true,id:1010}); await ui.flush(); expect(ui.text()).toContain('Resultado incerto');
    expect(h.success).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled();
    ui.button('Iniciar outro produto').props.onClick(); ui.render(); expect(ui.button('Cadastrar Produto').props.disabled).toBe(false);
  });
  it('handler de sucesso anterior não reenvia snapshot depois de uma nova ação', async () => {
    ui.fill('Primeiro confirmado'); const oldSend = ui.button('Cadastrar Produto').props.onClick; oldSend(); await ui.flush();
    oldSend(); await ui.flush(); expect(h.create).toHaveBeenCalledOnce();
    ui.button('Novo Produto').props.onClick(); ui.render(); ui.fill('Segundo confirmado'); await ui.submit(); expect(h.create).toHaveBeenCalledTimes(2);
  });
  it('nova ação pode cadastrar nome repetido após aviso: singleflight não promete deduplicação DB', async () => {
    h.create.mockRejectedValueOnce(new Error('timeout')); ui.fill('Mesmo produto', '12,34', '2'); await ui.submit();
    expect(ui.text()).toContain('pode duplicar'); ui.button('Novo Produto').props.onClick(); ui.render();
    expect(ui.nodes('Input')[0].props.value).toBe(''); expect(h.create).toHaveBeenCalledOnce();
    ui.fill('Mesmo produto', '12,34', '2'); await ui.submit();
    expect(h.create).toHaveBeenCalledTimes(2); expect(h.create.mock.calls[1][0]).toEqual(h.create.mock.calls[0][0]);
    expect(h.create.mock.calls[1][0]).not.toBe(h.create.mock.calls[0][0]);
    expect(ui.text()).toContain('Snapshot anterior:'); expect(ui.text()).toContain('pode duplicar');
  });
  it('sucessivos erros preservam snapshots em histórico sem impedir terceira intenção explícita', async () => {
    h.create.mockRejectedValueOnce(new Error('timeout 1')).mockRejectedValueOnce(new Error('timeout 2'));
    ui.fill('Primeiro incerto'); await ui.submit(); ui.button('Iniciar outro produto').props.onClick(); ui.render();
    ui.fill('Segundo incerto'); await ui.submit(); ui.button('Iniciar outro produto').props.onClick(); ui.render();
    expect(ui.text()).toContain('Primeiro incerto'); expect(ui.text()).toContain('Segundo incerto');
    expect(ui.button('Cadastrar Produto').props.disabled).toBe(false); ui.fill('Terceiro produto'); await ui.submit();
    expect(h.create).toHaveBeenCalledTimes(3); expect(h.success).toHaveBeenCalledOnce();
  });
  it('atalho financeiro de intenção anterior não restaura form antigo após separação', async () => {
    h.create.mockRejectedValueOnce(new Error('timeout')); ui.fill('Incerto'); await ui.submit();
    const staleFinanceiro = ui.button('Conferir venda a prazo').props.onClick;
    ui.button('Iniciar outro produto').props.onClick(); ui.render(); ui.fill('Rascunho novo');
    const writes = ui.writes; staleFinanceiro(); ui.render();
    expect(ui.writes).toBe(writes); expect(ui.nodes('Input')[0].props.value).toBe('Rascunho novo');
    expect(h.navigate).not.toHaveBeenCalled(); expect(h.create).toHaveBeenCalledOnce();
  });
  it.each(['success','error'])('settle antigo %s notifica o remount atual sem render manual, replay ou efeitos de sucesso', async outcome => {
    const wait = deferred(); h.create.mockReturnValueOnce(wait.promise); ui.fill('Snapshot antigo'); await ui.submit();
    ui.unmount(); const previous = ui; ui = new Harness().render();
    expect(ui.button('Novo Produto').props.disabled).toBe(true);
    const writes = ui.writes, oldWrites = previous.writes;
    if (outcome === 'success') wait.resolve({success:true,id:1010}); else wait.reject(new Error('timeout antigo'));
    await ui.flush(); // Sem ui.render(): exige uma notificação que marque a montagem atual dirty.
    expect(ui.writes).toBeGreaterThan(writes); expect(previous.writes).toBe(oldWrites);
    expect(ui.text()).toContain('Resultado incerto'); expect(ui.button('Novo Produto').props.disabled).toBe(false);
    expect(ui.nodes('Input')[0].props.value).toBe('Snapshot antigo');
    expect(h.create).toHaveBeenCalledOnce(); expect(h.success).not.toHaveBeenCalled();
    expect(h.error).not.toHaveBeenCalled(); expect(h.invalidate).not.toHaveBeenCalled();
    ui.button('Iniciar outro produto').props.onClick(); await ui.flush();
    expect(ui.nodes('Input')[0].props.value).toBe(''); expect(ui.button('Cadastrar Produto').props.disabled).toBe(false);
    expect(h.create).toHaveBeenCalledOnce();
  });
});
