// @ts-nocheck
// Portagem mecânica dos 22 casos Node/SSR aprovados: Vitest normal, sem DB real.
// A callback kpis vem do AST do router real (não de uma cópia reescrita).
// Só o modelo read-only é importado; servidor/db/router não são importados.
// O render SSR mantém whitelist estrita de módulos e fronteiras tRPC em memória.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as model from './telefone41ReadModel';
const target = fileURLToPath(new URL('../../', import.meta.url));
const deps = createRequire(import.meta.url);
const routerSource = readFileSync(path.join(target, 'server/routers.ts'), 'utf8');
const uiSource = readFileSync(path.join(target, 'client/src/pages/VendasTelefone.tsx'), 'utf8');
const ast = ts.createSourceFile('routers.ts', routerSource, ts.ScriptTarget.Latest, true);
let kpisCallback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'vendasTelefoneRouter') {
    const object = node.initializer.arguments[0];
    kpisCallback = object.properties.find(p => p.name?.getText(ast) === 'kpis').initializer.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(kpisCallback, 'Extrair a callback kpis do router real');
function transpile(source) {
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
}
const modelPath = path.join(target, 'server/services/telefone41ReadModel.ts');
class TRPCError extends Error { constructor(opts) { super(opts.message); this.code = opts.code; } }
const owner = 901;
const sale = (extra = {}) => ({ id: 44, status: 'ativo', custo: '5.00', total_a_receber: '10.00', lucro_bruto: '5.00', entrada_valor: '2.00', num_parcelas: 1, ...extra });
const installment = (extra = {}) => ({ id: 31, venda_id: 44, status: 'pendente', valor: '8.00', valor_pago: null, ...extra });
function fixture(sales, installments, options = {}) {
  const calls = [];
  const client = {
    from(table) {
      assert.ok(['vendas_telefone', 'parcelas_venda_telefone'].includes(table), 'Somente tabelas de leitura Telefone');
      const call = { table, filters: [], columns: null, range: null, order: null }; calls.push(call);
      const query = {
        select(columns) { assert.notEqual(columns, '*'); call.columns = columns; return query; },
        eq(column, value) { call.filters.push([column, value]); return query; },
        order(column, opts) { call.order = [column, opts]; return query; },
        range(first, last) { call.range = [first, last]; return query; },
        then(resolve, reject) {
          if (options.reject) return Promise.reject(Error('offline read failed')).then(resolve, reject);
          if (options.errorTable === table) return Promise.resolve({ data: null, error: { message: 'fixture read denied' } }).then(resolve, reject);
          let rows = table === 'vendas_telefone' ? sales : installments;
          if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1);
          if (options.nullTable === table) rows = null;
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    rpc() { throw Error('RPC proibida nestes testes read-only'); },
  };
  const source = transpile(`module.exports = ${kpisCallback};`).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, ...model, getSupabaseClientAsync: async () => options.unavailable ? null : client, TRPCError });
  return { run: () => module.exports({ ctx: { user: { id: owner } } }), calls };
}
const result = value => JSON.parse(JSON.stringify(value));

test('RED→GREEN: preço 10, entrada recebida 2, parcela pendente 8 => A Receber 8, sem subtrair entrada novamente', async () => {
  const f = fixture([sale()], [installment()]);
  const summary = await f.run();
  assert.equal(summary.totalAReceber, 8);
  assert.equal(summary.capitalInvestido, 5, 'Custo contratual, não custo menos entrada');
  assert.equal(summary.lucroBruto, 5, 'Lucro teórico, não lucro realizado');
  assert.deepEqual(Object.keys(summary).sort(), ['capitalInvestido', 'lucroBruto', 'totalAReceber', 'totalVendas', 'vendasAtivas', 'vendasQuitadas'].sort(), 'Shape numérico legado preservado');
});
test('Recebimento integral e quitação => A Receber 0', async () => {
  assert.equal((await fixture([sale({ status: 'quitado' })], [installment({ status: 'paga', valor_pago: '8.00' })]).run()).totalAReceber, 0);
});
test('Pagamento parcial: somar só saldo das parcelas elegíveis; parcela paga não deduz duas vezes', async () => {
  const installments = [installment({ id: 1, valor: '4.00', status: 'paga', valor_pago: '4.00' }), installment({ id: 2, valor: '4.00', status: 'parcial', valor_pago: '1.00' })];
  assert.equal((await fixture([sale({ num_parcelas: 2 })], installments).run()).totalAReceber, 3);
});
test('Atrasadas/vencendo hoje/inadimplentes entram por saldo pendente; pagamentos nunca geram saldo negativo', async () => {
  const parcels = [installment({ id: 1, valor: '3.00', status: 'atrasada' }), installment({ id: 2, valor: '3.00', status: 'vencendo_hoje', valor_pago: '1.00' }), installment({ id: 3, valor: '2.00', status: 'parcial', valor_pago: '9.00' })];
  assert.equal((await fixture([sale({ status: 'inadimplente', num_parcelas: 3 })], parcels).run()).totalAReceber, 5);
});
test('Canceladas ignoradas em todos os totais; parcelas históricas não retornam ao A Receber', async () => {
  const sales = [sale(), sale({ id: 45, status: 'cancelado', custo: '500.00', lucro_bruto: '999.00' }), sale({ id: 46, status: 'quitado', custo: '3.00', lucro_bruto: '-1.00' })];
  const parcels = [installment(), installment({ id: 32, venda_id: 45, valor: '1000.00' })];
  assert.deepEqual(result(await fixture(sales, parcels).run()), { totalVendas: 2, capitalInvestido: 8, totalAReceber: 8, lucroBruto: 4, vendasAtivas: 1, vendasQuitadas: 1 });
  assert.deepEqual(result(await fixture([sales[1]], [parcels[1]]).run()), { totalVendas: 0, capitalInvestido: 0, totalAReceber: 0, lucroBruto: 0, vendasAtivas: 0, vendasQuitadas: 0 });
});
test('Arredondamento da última parcela usa valores persistidos, não PMT ou multiplicação do valor da primeira', async () => {
  const parcels = [installment({ id: 1, valor: '2.66' }), installment({ id: 2, valor: '2.66', status: 'paga', valor_pago: '2.66' }), installment({ id: 3, valor: '2.68' })];
  assert.equal((await fixture([sale({ num_parcelas: 3 })], parcels).run()).totalAReceber, 5.34);
});
test('Leitura paginada completa, owner da sessão em cada página e colunas mínimas', async () => {
  const sales = Array.from({ length: 1003 }, (_, i) => sale({ id: i + 1 }));
  const parcels = sales.map((v, i) => installment({ id: i + 1, venda_id: v.id }));
  const f = fixture(sales, parcels);
  assert.equal((await f.run()).totalAReceber, 8024);
  assert.equal(f.calls.length, 6);
  for (const call of f.calls) {
    assert.deepEqual(call.filters, [['user_id', owner]]);
    assert.equal(call.order[0], 'id');
    assert.ok(call.range && call.range[1] - call.range[0] === 499);
    assert.equal(call.columns, call.table === 'vendas_telefone' ? 'id,status,custo,lucro_bruto,num_parcelas' : 'id,venda_id,status,valor,valor_pago');
  }
});
test('Parcelas de venda não pertencente à lista do owner não entram no resumo', async () => {
  assert.equal((await fixture([sale()], [installment(), installment({ id: 32, venda_id: 999, valor: '999.00' })]).run()).totalAReceber, 8);
});
for (const [name, options] of Object.entries({ 'cliente ausente': { unavailable: true }, 'erro de vendas': { errorTable: 'vendas_telefone' }, 'erro de parcelas': { errorTable: 'parcelas_venda_telefone' }, 'dados nulos': { nullTable: 'vendas_telefone' }, 'exceção de leitura': { reject: true } })) {
  test(`Falha fechada: ${name} não apresenta desconhecido como zero`, async () => {
    await assert.rejects(() => fixture([sale()], [installment()], options).run());
  });
}
test('Parcelas incompletas/duplicadas ou valor inválido não viram saldo zero confiável', async () => {
  for (const parcels of [[], [installment(), installment()], [installment({ valor: '8x' })], [installment({ valor_pago: 'NaN' })], [installment({ status: 'desconhecido' })]]) {
    await assert.rejects(() => fixture([sale()], parcels).run());
  }
});
test('Carteira realmente vazia retorna zeros com leitura bem-sucedida', async () => {
  assert.deepEqual(result(await fixture([], []).run()), { totalVendas: 0, capitalInvestido: 0, totalAReceber: 0, lucroBruto: 0, vendasAtivas: 0, vendasQuitadas: 0 });
});
test('UI: ROI sem fonte confiável não é convertido em 0% nem exibido no card persistido', () => {
  const cards = uiSource.slice(uiSource.indexOf('vendasFiltradas.map'), uiSource.indexOf('{/* Modal de parcelas */}'));
  assert.doesNotMatch(cards, /v\.roi|>ROI</);
  assert.match(cards, /Lucro teórico/);
  assert.match(cards, /v\.status === 'cancelado' \? '—'/);
});
test('UI: custo/lucro contratuais e erro de KPI não mascarado com zero', () => {
  const kpis = uiSource.slice(uiSource.indexOf('{/* KPIs */}'), uiSource.indexOf('{/* Barra de filtros */}'));
  assert.match(kpis, /Custo contratual/);
  assert.match(kpis, /Lucro teórico/);
  assert.doesNotMatch(kpis, /kpis\?\.[\w]+ \?\? 0/);
  assert.match(kpis, /role="alert"/);
  assert.match(kpis, /não representam saldo de Caixa ou lucro realizado/);
});
test('Simulador: projeção verificável ~167%, não ROI real; denominador não positivo não vira 0%', () => {
  const uiAST = ts.createSourceFile('VendasTelefone.tsx', uiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = uiAST.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'calcularSimulacao');
  const module = { exports: {} };
  vm.runInNewContext(transpile(`${fn.getText(uiAST)}\nmodule.exports = calcularSimulacao;`).outputText, { module, exports: module.exports });
  const sim = module.exports;
  assert.ok(Math.abs(sim(5, 10, 20, 1, 0).roi - 166.66666666666669) < 1e-9);
  assert.equal(sim(2, 10, 20, 1, 0).roi, null);
  assert.equal(sim(1, 10, 20, 1, 0).roi, null);
  assert.match(uiSource, /label="ROI projetado"/);
  assert.match(uiSource, /sim\.roi !== null/);
  assert.match(uiSource, /Lucro teórico \/ \(custo - entrada\); não é ROI realizado/);
});
test('Sintaxe TypeScript/TSX dos arquivos alterados válida sem carregar servidor, .env ou DB', () => {
  for (const [name, source] of [['routers.ts', routerSource], ['VendasTelefone.tsx', uiSource], ['telefone41ReadModel.ts', existsSync(modelPath) ? readFileSync(modelPath, 'utf8') : '']]) {
    const output = ts.transpileModule(source, { fileName: name, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
    assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, name);
  }
});

function renderList(kpisState, sales = [sale({ marca: 'Fixture', modelo: 'Telefone', comprador_nome: 'Offline', preco_venda: '10.00', valor_parcela: '8.00', entrada_percentual: '20.00', juros_mensal: '0.00', roi: null })]) {
  const React = deps('react');
  const { renderToStaticMarkup } = deps('react-dom/server');
  const noop = () => {};
  const Block = ({ children }) => React.createElement('div', null, children);
  const mocks = {
    react: { ...React, useState: init => [typeof init === 'function' ? init() : init, noop], useRef: current => ({ current }), useMemo: fn => fn(), useCallback: fn => fn, useEffect: noop },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '../i18n/i18n': { default: { language: 'pt-BR' } },
    wouter: { useLocation: () => ['/', noop] },
    '@/lib/trpc': { trpc: {
      auth: { me: { useQuery: () => ({ data: { id: owner } }) } },
      useUtils: () => ({}),
      vendasTelefone: {
        listar: { useQuery: () => ({ data: sales, refetch: noop }) },
        kpis: { useQuery: () => kpisState },
        parcelas: { useQuery: () => ({ data: [] }) },
        ...Object.fromEntries(['criar', 'deletar', 'pagarParcela', 'reconciliar', 'abandonar'].map(key => [key, { useMutation: () => ({ isPending: false, mutateAsync: () => { throw Error('Mutation proibida no render offline'); } }) }])),
      },
      caixa: { contasParaOperacao37: { useQuery: () => ({ data: { contas: [] } }) } },
    } },
    '../../../shared/telefone41': { decimalTelefone41: () => { throw Error('Escrita fora de escopo'); } },
    '../lib/telefone41Journal': { criarEscopo41: id => ({ owner: id, ativo: true }) },
    jspdf: { default: function () { throw Error('PDF fora de escopo'); } },
    sonner: { toast: {} },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    recharts: {},
  };
  const module = { exports: {} };
  const output = ts.transpileModule(uiSource, { fileName: 'VendasTelefone.tsx', compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require(name) {
    if (name === 'react/jsx-runtime') return deps(name);
    if (name.startsWith('@/components/ui/')) return new Proxy({}, { get: () => Block });
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw Error('Import externo proibido: ' + name);
  } });
  return renderToStaticMarkup(React.createElement(module.exports.default));
}
test('Render React offline: KPI A Receber mostra 8 e card não fabrica ROI 0%', async () => {
  const data = await fixture([sale()], [installment()]).run();
  const html = renderList({ data, isLoading: false, isError: false });
  assert.match(html, /A Receber<\/span><\/div><span[^>]*>R\$[^<]*8,00/);
  assert.doesNotMatch(html, />ROI<\/|>0%<\//);
});
test('Render React offline: dados stale em erro não exibem saldo numérico como atual', () => {
  const html = renderList({ data: { totalVendas: 99, vendasAtivas: 99, vendasQuitadas: 99, capitalInvestido: 999, totalAReceber: 999, lucroBruto: 999 }, isLoading: false, isError: true });
  assert.match(html, /role="alert"/);
  assert.match(html, /A Receber<\/span><\/div><span[^>]*>—/);
});
test('Render React offline: loading e dados ausentes não viram zero financeiro', () => {
  assert.match(renderList({ data: undefined, isLoading: true, isError: false }), /A Receber<\/span><\/div><span[^>]*>Carregando…/);
  assert.match(renderList({ data: undefined, isLoading: false, isError: false }), /A Receber<\/span><\/div><span[^>]*>—/);
});
