import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { Hooks, text, treeNodes } from '../lib/r1BoundaryHarness';

/** Executa corpos/handlers REAIS, não strings nem import da aplicação/backend.
 * VM sem require/process/ENV/network/SQL/storage; todas as fronteiras de escrita
 * e browser são traps. Fonte de apresentação e badges também executada na VM. */
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const syntax = (name: string, src: string) => ts.createSourceFile(name, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function pureModule(src: string) {
  const exports = {};
  const ctx = vm.createContext({ exports }, { codeGeneration: { strings: false, wasm: false } });
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInContext(js, ctx, { timeout: 500 });
  return exports as Record<string, any>;
}
const presentation = pureModule(read('../lib/obrigacoes51Apresentacao.ts'));
const badges = pureModule(read('../lib/statusEmprestimoBadge.ts'));
const trap = () => { throw Error('PROHIBITED: financial/network/browser boundary'); };
const money = (v: any) => `R$ ${Number(v).toFixed(2)}`;
const paid = { id: 1, contratoId: 462, clienteId: 7, clienteNome: 'Pago real', numeroParcela: 1, numero_parcela: 1,
  valorOriginal: '100.00', valor_original: '100.00', valorPago: '100.00', valor_pago: '100.00',
  dataVencimento: '2026-11-26', data_vencimento: '2026-11-26', status: 'paga', statusFinanceiroOriginal: 'paga', statusObrigacao: 'paga',
  obrigacaoAtual: '0.00', componenteAdicional: '0.00', arquivada: false, modalidade: 'mensal', numeroParcelas: 3 };
const cancelled = { ...paid, id: 2, numeroParcela: 2, numero_parcela: 2, clienteNome: 'Cancelada parcial',
  valorOriginal: '500.00', valor_original: '500.00', valorPago: '20.00', valor_pago: '20.00',
  status: 'cancelada', statusFinanceiroOriginal: 'parcial', statusObrigacao: 'cancelada', obrigacaoAtual: '0.00', arquivada: true };
const additional = { ...paid, id: 3, numeroParcela: 3, numero_parcela: 3, clienteNome: 'Obrigação A',
  valorOriginal: '900.00', valor_original: '900.00', valorPago: '0.00', valor_pago: '0.00',
  status: 'pendente', statusFinanceiroOriginal: 'pendente', statusObrigacao: 'aberta', obrigacaoAtual: '75.00', componenteAdicional: '75.00' };
const archivedCancelledRows = [{ ...paid, arquivada: true }, cancelled, { ...additional, status: 'cancelada', statusObrigacao: 'cancelada', obrigacaoAtual: '0.00', arquivada: true }];
const loan = (id: number, extra = {}) => ({ id, clienteId: 7, clienteNome: `Contrato ${id}`, modalidade: 'mensal', status: 'ativo', statusObrigacao: 'ativo',
  valorPrincipal: '100.00', totalReceber: 83.25, totalPago: 120, lucroPrevisto: 0, lucroRealizado: 20,
  valorJurosParcela: 0, parcelasAbertas: 1, parcelasPagas: 1, parcelasAtrasadas: 0, parcelasComAtraso: [], todasParcelas: [paid, cancelled, additional],
  proximaParcela: null, numeroParcelas: 3, taxaJuros: '10', tipoTaxa: 'mensal', obrigacaoAtual: '75.00', obrigacaoAdicional: '75.00', arquivado: false, etiquetas: [], ...extra });
function mounted(path: string, name: string, data: any, extras: Record<string, any> = {}) {
  const src = read(path), ast = syntax(path, src);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  if (!fn) throw Error(`Function absent: ${name}`);
  const hooks = new Hooks(), queries: any[] = [], navigations: any[] = [];
  const query = (input?: any) => { queries.push(input); return { data, isPending: false, isLoading: false, isFetching: false, isError: false, refetch: () => {} }; };
  const inertQuery = () => ({ data: [] });
  const utils = new Proxy({}, { get: () => new Proxy({}, { get: () => ({ invalidate: () => {}, query: trap }) }) });
  const financial = new Proxy({}, { get: trap });
  const bindings: any = {
    ...hooks.bindings(), ...presentation, ...badges, EmprestimoCardCobra: 'EmprestimoCardCobra', HistoricoAba: 'HistoricoAba',
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'pt' } }),
    useLocation: () => ['/emprestimos', (v: string) => navigations.push(v)], useParams: () => ({ id: '462' }),
    formatarMoeda: money, formatarData: (v: any) => v == null ? 'Sem data' : String(v),
    dataHojeBrasilia: () => '2026-11-26', dataVencimentoCivil: (v: any) => String(v).slice(0, 10),
    diferencaDiasCivis: (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000,
    statusCalendarioParcela: (s: string) => s, rotaReparcelamentoAtual: (id: number) => `/reparcelamento?contratoId=${id}`,
    rotaAcaoListaEmprestimo62: (id: number, hash: string) => `/emprestimos/${id}${hash}`,
    useAcoesListaEmprestimo62: () => {}, // Destinos62 cobertos pelo hook real em seus testes próprios.
    deveUsarListaSegura: (e: any) => e?.data?.code === 'PRECONDITION_FAILED',
    toast: { info: () => {}, error: () => {}, success: () => {} },
    financial, mutateAsync: trap, localStorage: financial, sessionStorage: financial, navigator: financial,
    db: financial, sql: trap, getDb: trap, getSupabaseClientAsync: trap, ENV: financial,
    protegerValorDePlanilha: (v: any) => v,
    trpc: { useUtils: () => utils,
      contratos: { listComParcelas: { useQuery: query }, obterDetalhes: { useQuery: query } },
      parcelas: { list: { useQuery: query } },
      caixa: { contas: { useQuery: inertQuery } }, configuracoes: { get: { useQuery: () => ({ data: {} }) } }, cobradores: { list: { useQuery: inertQuery } },
      etiquetas: { listar: { useQuery: inertQuery }, criar: { useMutation: () => ({ mutate: trap }) }, remover: { useMutation: () => ({ mutate: trap }) }, aplicarContrato: { useMutation: () => ({ mutate: trap }) } },
      whatsapp: { recebimentos: { useQuery: () => ({ data: undefined }) }, cobrarLote: { useMutation: () => ({ mutate: trap }) } },
    },
    window: { location: { search: '', href: '' }, open: trap }, fetch: trap, XMLHttpRequest: trap, WebSocket: trap,
    setTimeout: trap, setInterval: trap, document: new Proxy({}, { get: trap }),
    URLSearchParams, ...extras,
  };
  for (const stmt of ast.statements) if (ts.isImportDeclaration(stmt) && stmt.importClause?.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
    for (const e of stmt.importClause.namedBindings.elements) if (!(e.name.text in bindings)) bindings[e.name.text] = e.name.text;
  }
  const extraFunctions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n !== fn && n.name?.text !== 'EmprestimoCardCobra' && n.name?.text !== 'HistoricoAba');
  const constants = ast.statements.filter(ts.isVariableStatement).map(n => n.getText(ast).replace(/^export\s+/, '')).join('\n');
  const body = constants + '\n' + [...extraFunctions, fn].map(n => n.getText(ast).replace(/^export\s+(?:default\s+)?/, '')).join('\n');
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React } }).outputText;
  const ctx = vm.createContext(bindings, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(js, ctx, { timeout: 500 });
  return { hooks, queries, navigations,
    render: (props?: any) => { hooks.cursor = 0; (ctx as any).props = props; return vm.runInContext(`${name}(props)`, ctx, { timeout: 500 }); },
    invoke: (fn: any, value?: any) => { (ctx as any).handler = fn; (ctx as any).eventValue = value; return vm.runInContext('handler(eventValue)', ctx, { timeout: 500 }); }, ctx };
}
function button(tree: any, label: string) {
  const b = treeNodes(tree, n => ['Button', 'button'].includes(n.type) && text(n) === label)[0];
  expect(b, label).toBeDefined(); return b;
}
function aria(tree: any, label: string) { return treeNodes(tree, n => n.props?.['aria-label'] === label)[0]; }
const uiFiles = ['./Emprestimos.tsx', './EmprestimoDetalhes.tsx', './Parcelas.tsx', './Calendario.tsx', '../components/EmprestimosListaSegura.tsx'];

describe('Projeção51 UI: números reais, histórico imutável e fronteiras confinadas', () => {
  it('arquivada/cancelada não é paga nem usa original no saldo; A separada e sem fórmula de lucro', () => {
    const rows = [paid, cancelled, additional], before = JSON.stringify(rows);
    expect(presentation.somaOperacional51(rows)).toBe(75);
    expect(presentation.somaAdicional51(rows)).toBe(75);
    expect(presentation.somaRecebidoHistorico51(rows)).toBe(120);
    expect(presentation.contagensParcelas51(rows)).toMatchObject({ pagas: 1, canceladas: 1, arquivadas: 1, abertas: 1 });
    expect(presentation.somaOperacional51([{ ...additional, valorAtualizado: 83.25 }])).toBe(83.25);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it.each(['9999999999.99', '10000000000.00', '1000000000000.01', '9999999999999.99'])('leitura NUMERIC15 %s permanece nominal e exata em centavos na apresentação', nominal => {
    const row = Object.freeze({ ...additional, obrigacaoAtual: nominal, componenteAdicional: nominal });
    const cents = Number(BigInt(nominal.replace('.', '')));
    expect(Number.isSafeInteger(cents)).toBe(true);
    const value = presentation.moedaTextual51(nominal);
    expect(value).not.toBeNull();
    expect(Math.round(value * 100)).toBe(cents);
    expect(presentation.somaOperacional51([row])).toBe(value);
    expect(presentation.somaAdicional51([row])).toBe(value);
    expect(presentation.parcelaAberta51(row)).toBe(true);
    expect(presentation.referenciaMonetaria51(nominal)).not.toBe('Valor não confirmado');
    expect(row.obrigacaoAtual).toBe(nominal);
  });
  it.each(['10000000000000.00', '9999999999999.999', '1e13', 10000000000])('leitura fora do domínio NUMERIC15 ou sem texto %j continua recusada', nominal => {
    expect(presentation.moedaTextual51(nominal)).toBeNull();
    expect(presentation.somaOperacional51([{ ...additional, obrigacaoAtual: nominal }])).toBeNull();
  });
  it('soma de leituras válidas acima do intervalo seguro não é arredondada nem vira zero', () => {
    const rows = Array.from({ length: 10 }, () => ({ ...additional, obrigacaoAtual: '9999999999999.99', componenteAdicional: '9999999999999.99' }));
    expect(presentation.somaOperacional51(rows)).toBeNull();
    expect(presentation.somaAdicional51(rows)).toBeNull();
  });
  it.each([undefined, null, '', 0, '0', '1.234', 'NaN'])('ausência/valor inválido %j não vira zero', missing => {
    expect(presentation.somaOperacional51([{ ...additional, obrigacaoAtual: missing }])).toBeNull();
    expect(presentation.referenciaMonetaria51(missing)).toBe('Valor não confirmado');
  });
  it('pagamento sem prova nominal não usa original; arquivamento quitado não altera contagem', () => {
    expect(presentation.somaRecebidoHistorico51([{ ...paid, valorPago: null }])).toBeNull();
    expect(presentation.contagensParcelas51([{ ...paid, statusFinanceiroOriginal: 'parcial' }]).pagas).toBe(0);
    expect(presentation.statusParcela51({ ...paid, statusFinanceiroOriginal: 'parcial' })).toBe('status_nao_confirmado');
    expect(presentation.contagensParcelas51([{ ...paid, arquivada: true }])).toMatchObject({ pagas: 1, arquivadas: 1, canceladas: 0 });
    expect(presentation.statusContrato51({ status: 'quitado', statusObrigacao: 'encerrado_por_cancelamento' })).toBe('encerrado_por_cancelamento');
  });
  it('lista segura mantém #42/coverage/totais em Operacionais, Histórico e Todos; ficha arquivada tem link', () => {
    const safe = { version: 'loan_list_read_v1', userId: 8, coverage: { scopedContracts: 3, validatedContracts: 2, unavailableContracts: 1, complete: false },
      totals: { values: { capital: 200, totalReceber: 83.25, totalPago: 120 } }, warning: 'Consulta parcial: valores validados somente.',
      items: [{ kind: 'validated', ...loan(462), capital: 100 }, { kind: 'validated', ...loan(463, { arquivado: true, status: 'encerrado_por_cancelamento', statusObrigacao: 'encerrado_por_cancelamento', obrigacaoAtual: '0.00', totalReceber: 0 }), capital: 100 },
        { kind: 'unavailable', id: 42, message: 'Empréstimo indisponível: não foi possível confirmar seus vínculos.' }] };
    const before = JSON.stringify(safe), m = mounted('../components/EmprestimosListaSegura.tsx', 'EmprestimosListaSegura', undefined, { moeda: money });
    const props = { data: safe, onRefresh: () => {} }; let tree = m.render(props);
    expect(text(tree)).toContain('Contrato 462'); expect(text(tree)).not.toContain('Contrato 463');
    for (const filter of ['Histórico', 'Todos', 'Operacionais']) {
      m.invoke(button(tree, filter).props.onClick); tree = m.render(props);
      expect(text(tree)).toContain('3 no escopo; 2 validados; 1 indisponíveis');
      expect(text(tree)).toContain('83,25'); expect(text(tree)).toContain('Não representam toda a carteira');
      const unavailable = aria(tree, 'Empréstimo 42 indisponível'); expect(unavailable).toBeDefined();
      expect(treeNodes(unavailable, n => !!n.props?.href || !!n.props?.onClick)).toHaveLength(0);
      if (filter === 'Histórico') {
        expect(text(tree)).toContain('ENCERRADO POR CANCELAMENTO'); expect(text(tree)).not.toContain('QUITADO');
        expect(treeNodes(tree, n => n.props?.href === '/emprestimos/463')).toHaveLength(1);
      }
    }
    expect(JSON.stringify(safe)).toBe(before);
  });
  it('entrada da lista monta diretamente o componente snapshot, sem queries strict antes', () => {
    const m = mounted('./Emprestimos.tsx', 'Emprestimos', []);
    const tree = m.render();
    expect(tree.type).toBe('EmprestimosListaSeguraFallback');
    expect(m.queries).toEqual([]);
  });
  it('modos strict legados preservados recebem todos e filtram arquivos sem trocar total36 por51', () => {
    const rows = [loan(462), loan(463, { arquivado: true })], m = mounted('./Emprestimos.tsx', 'EmprestimosListaEstritaLegada', rows);
    let tree = m.render(); expect(m.queries[0]).toEqual({ arquivo: 'todos' });
    expect(treeNodes(tree, n => n.type === 'EmprestimoCardCobra').map(n => n.props.emp.id)).toEqual([462]);
    m.invoke(button(tree, 'Histórico').props.onClick); tree = m.render();
    expect(treeNodes(tree, n => n.type === 'EmprestimoCardCobra').map(n => n.props.emp.id)).toEqual([463]);
    m.invoke(button(tree, 'Todos').props.onClick); tree = m.render();
    expect(treeNodes(tree, n => n.type === 'EmprestimoCardCobra').map(n => n.props.emp.totalReceber)).toEqual([83.25, 83.25]);
  });
  it('card real preserva totalReceber36 e lucro, separa A e não gera comprovante pela primeira parcela', () => {
    const emp = loan(462), before = JSON.stringify(emp);
    const m = mounted('./Emprestimos.tsx', 'EmprestimoCardCobra', []); const tree = m.render({ emp, contas: [], onRefresh: () => {} });
    expect(text(tree)).not.toContain('QUITADO');
    expect(text(tree)).toContain('R$ 83.25'); expect(text(tree)).toContain('R$ 20.00'); expect(text(tree)).toContain('A — obrigação adicional não desembolsada');
    m.invoke(button(tree, 'loans.receipt').props.onClick); // Trap de browser/financeiro continuaria falhando se houvesse POST/PDF.
    expect(JSON.stringify(emp)).toBe(before);
  });
  it('ficha arquivada por ID mostra cancelamento, pagas reais e valores físicos intactos; recebe/conferir continua montado', () => {
    const data = loan(462, { status: 'encerrado_por_cancelamento', statusObrigacao: 'encerrado_por_cancelamento', arquivado: true, obrigacaoAtual: '0.00', totalReceber: 0, todasParcelas: archivedCancelledRows }), before = JSON.stringify(data);
    const m = mounted('./EmprestimoDetalhes.tsx', 'EmprestimoDetalhes', data); let tree = m.render();
    expect(m.queries[0]).toEqual({ id: 462 }); expect(text(tree)).toContain('ENCERRADO POR CANCELAMENTO'); expect(text(tree)).not.toContain('QUITADO');
    expect(text(tree)).toContain('1 pagas reais'); expect(text(tree)).toContain('2 canceladas'); expect(text(tree)).toContain('3 arquivadas');
    const details = treeNodes(tree, n => n.type === 'button' && text(n).includes('Detalhes'))[0]; m.invoke(details.props.onClick); tree = m.render();
    expect(treeNodes(tree, n => n.type === 'OperacoesObrigacao51' && n.props.alvoInicial.tipo === 'parcela').map(n => n.props.alvoInicial.parcelaId)).toEqual([1, 2, 3]);
    expect(treeNodes(tree, n => n.type === 'RecebimentoValidado' && n.props.parcelaId === 2)).not.toHaveLength(0);
    expect(text(tree)).toContain('Original histórico: R$ 500.00'); expect(text(tree)).toContain('Pago histórico: R$ 20.00');
    expect(JSON.stringify(data)).toBe(before);
  });
  it('Parcelas soma referência registrada somente; status/a/arquivo são exibidos sem cotações locais inventadas', () => {
    const m = mounted('./Parcelas.tsx', 'Parcelas', [paid, cancelled, additional]); const tree = m.render();
    expect(m.queries[0]).toMatchObject({ arquivo: 'operacional' }); expect(text(tree)).toContain('1 pagas reais'); expect(text(tree)).toContain('1 canceladas');
    expect(text(tree)).toContain('Referência registrada51'); expect(text(tree)).toContain('75,00');
    expect(text(tree)).toContain('Original histórico: R$ 500.00'); expect(text(tree)).toContain('Arquivada');
    m.invoke(button(tree, 'Histórico').props.onClick); m.render(); expect(m.queries.at(-1).arquivo).toBe('historico');
  });
  it('Calendário usa obrigação atual e recebimento nominal, não original nem saldo menos pagos; arquivos acessíveis', () => {
    const rows = [paid, cancelled, additional], before = JSON.stringify(rows), m = mounted('./Calendario.tsx', 'Calendario', rows);
    let tree = m.render(); expect(text(tree)).toContain('Obrigação registrada no Mês R$ 75,00'); expect(text(tree)).toContain('Já Recebido R$ 120,00');
    expect(text(tree)).toContain('Pendente R$ 75,00'); expect(text(tree)).toContain('1 pagas reais');
    m.invoke(button(tree, 'Histórico').props.onClick); tree = m.render(); expect(m.queries.at(-1)).toEqual({ arquivo: 'historico' });
    expect(JSON.stringify(rows)).toBe(before);
  });
  it.each(['./Parcelas.tsx', './Calendario.tsx'])('erro/paused/ausência em %s não exibe cache/zero/vazio certificado', path => {
    const name = path.includes('Parcelas') ? 'Parcelas' : 'Calendario';
    for (const flags of [{ isError: true }, { isPending: true }, { data: undefined }]) {
      const m = mounted(path, name, [additional]);
      (m.ctx as any).trpc.parcelas.list.useQuery = () => ({ data: [additional], isPending: false, isLoading: false, isError: false, isFetching: false, ...flags, refetch: () => {} });
      const tree = m.render(); expect(text(tree)).not.toContain('R$'); expect(text(tree)).not.toContain('Obrigação A');
      expect(text(tree)).toMatch(/Confirmando|Consulta indisponível/);
    }
  });
  it('todas as fontes têm AST sintaticamente íntegra; writer/journal/guards não importados no sandbox', () => {
    for (const file of uiFiles) expect((syntax(file, read(file)) as any).parseDiagnostics).toEqual([]);
    expect(vm.runInContext('typeof process + ":" + typeof require', mounted('./Calendario.tsx', 'Calendario', []).ctx)).toBe('undefined:undefined');
  });
});
