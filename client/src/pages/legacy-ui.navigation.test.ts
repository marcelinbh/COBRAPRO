import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { rotaReparcelamentoAtual } from '../lib/legacyFinanceNavigation';

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const parse = (text: string) => ts.createSourceFile('surface.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function nodes(root: ts.Node, match: (n: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = [];
  function walk(n: ts.Node) { if (match(n)) found.push(n); ts.forEachChild(n, walk); }
  walk(root); return found;
}
function functionNode(ast: ts.SourceFile, name: string) {
  const fn = nodes(ast, n => ts.isFunctionDeclaration(n) && n.name?.text === name)[0];
  expect(fn).toBeDefined(); return fn;
}
function run(code: string, context: Record<string, unknown>) {
  const js = ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(context), `return ${js}`)(...Object.values(context));
}
function buttons(root: ts.Node, ast: ts.SourceFile, text: string) {
  return nodes(root, n => ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'Button' && n.getText(ast).includes(text)) as ts.JsxElement[];
}
function handler(button: ts.JsxElement, ast: ts.SourceFile) {
  const attr = button.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'onClick') as ts.JsxAttribute;
  return (attr.initializer as ts.JsxExpression).expression!.getText(ast);
}
function props(node: ts.JsxSelfClosingElement, ast: ts.SourceFile, ctx: Record<string, unknown>) {
  return Object.fromEntries(node.attributes.properties.map(a => {
    if (!ts.isJsxAttribute(a)) throw Error('Spread inesperado em argumento financeiro');
    const name = a.name.getText(ast), init = a.initializer;
    return [name, !init ? true : ts.isJsxExpression(init) ? run(init.expression!.getText(ast), ctx) : init.text];
  }));
}
function jsxNodes(ast: ts.SourceFile, tag: string) {
  return nodes(ast, n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(ast) === tag) as ts.JsxSelfClosingElement[];
}

describe('legacy-ui: substituição funcional de callers, sem POST de navegação', () => {
  it.each(['pages/Emprestimos.tsx', 'pages/EmprestimoDetalhes.tsx', 'components/EmprestimoDetalhesModal.tsx', 'pages/Parcelas.tsx'])('%s não guarda mutações ou formulários antigos', file => {
    const text = read(file);
    expect(text).not.toMatch(/trpc\.contratos\.(?:editar|editarJuros|aplicarMulta|pagarTotal|renovar)\b/);
    expect(text).not.toMatch(/trpc\.parcelas\.(?:registrarPagamento|pagarJuros|editarParcela|criarParcela)\b/);
    expect(text).not.toMatch(/function (?:EditarEmprestimoModal|PagamentoModal|PagamentoDialog)\b/);
  });
  it.each([
    ['Receber / conferir', '/emprestimos/31'], ['Receber / renovar', '/emprestimos/31'],
    ['Alterar juros futuros', '/emprestimos/31#manutencao-financeira'],
    ['Aplicar Multa', '/emprestimos/31'], ['Reparcelar mensal', '/reparcelamento?contratoId=31'],
  ])('handler real do card %s encaminha IDs e não escreve financeiro', (label, route) => {
    const ast = parse(read('pages/Emprestimos.tsx')), card = functionNode(ast, 'EmprestimoCardCobra');
    const button = buttons(card, ast, label)[0]; expect(button).toBeDefined();
    const navigate = vi.fn(); run(handler(button, ast), { setLocation: navigate, emp: { id: 31 }, rotaReparcelamentoAtual })();
    expect(navigate).toHaveBeenCalledTimes(1); expect(navigate).toHaveBeenCalledWith(route);
  });
  it('ficha mantém exatamente uma manutenção48, um calendário46 e uma multa36 com contrato exato', () => {
    const ast = parse(read('pages/EmprestimoDetalhes.tsx'));
    const cb = vi.fn(), emprestimo = { id: 31, todasParcelas: [{ id: 44 }, { id: 45 }] };
    for (const tag of ['ManutencaoJuros48', 'ManutencaoCalendario', 'MultaManualAplicar']) {
      const list = jsxNodes(ast, tag); expect(list).toHaveLength(1);
      const input = props(list[0], ast, { emprestimo, atualizarFinanceiro: cb });
      expect(input.contratoId).toBe(31); expect(input.onSuccess).toBe(cb);
      if (tag === 'ManutencaoJuros48') expect(input.parcelasIds).toEqual([44, 45]);
      expect(input).not.toHaveProperty('owner'); expect(input).not.toHaveProperty('valorPago');
    }
    expect(read('pages/EmprestimoDetalhes.tsx')).not.toContain('Edição financeira manual bloqueada');
    expect(read('pages/EmprestimoDetalhes.tsx')).toContain('id="manutencao-financeira"');
  });
  it('recebimento da ficha e calendário recebe contrato+parcela, não presume valores ou conta', () => {
    for (const file of ['pages/EmprestimoDetalhes.tsx', 'pages/Calendario.tsx']) {
      const ast = parse(read(file));
      const list = jsxNodes(ast, 'RecebimentoValidado'); expect(list.length).toBeGreaterThan(0);
      for (const node of list) {
        const input = props(node, ast, { emprestimo: { id: 31 }, p: { id: 44, contratoId: 31 }, parcela: { id: 44 }, atualizarFinanceiro: vi.fn(), refetch: vi.fn() });
        expect(input).toMatchObject({ contratoId: 31, parcelaId: 44, permitirRenovacao: true });
        expect(input).not.toHaveProperty('valorPago'); expect(input).not.toHaveProperty('contaCaixaId');
      }
    }
    const calendar = read('pages/Calendario.tsx');
    expect(calendar).not.toContain('pagarMutation'); expect(calendar).not.toContain('parcelas as any).pagar');
    expect(calendar).toContain('navigate(`/emprestimos/${p.contratoId}`)');
  });
  it('modal permanece read-only e fecha antes de navegar; não monta novo writer dentro de modal velho', () => {
    const ast = parse(read('components/EmprestimoDetalhesModal.tsx'));
    for (const text of ['Abrir ficha segura', 'Simular reparcelamento mensal']) {
      const button = buttons(ast, ast, text)[0]; expect(button).toBeDefined();
      const calls: unknown[] = [], close = vi.fn(v => calls.push(['close', v])), navigate = vi.fn(v => calls.push(['route', v]));
      run(handler(button, ast), { onOpenChange: close, navigate, emprestimo: { id: 31 }, rotaReparcelamentoAtual })();
      expect(calls[0]).toEqual(['close', false]);
      expect(calls[1]).toEqual(['route', text.startsWith('Abrir') ? '/emprestimos/31' : '/reparcelamento?contratoId=31']);
    }
    expect(jsxNodes(ast, 'RecebimentoValidado')).toHaveLength(0);
    expect(jsxNodes(ast, 'ReparcelamentoAtual47')).toHaveLength(0);
  });
  it('pré-seleção47 não converte o formulário43 e nunca substitui journal pendente', () => {
    const page = read('pages/Reparcelamento.tsx'), ui47 = read('components/ReparcelamentoAtual47.tsx');
    expect(page).toContain('contratoReparcelamentoDaBusca(useSearch())');
    expect(page).toContain('contratoInicial={contratoInicial}');
    expect(page).toContain('permitido={!pending}');
    expect(page).toContain("[contrato,setContrato]=useState('')");
    expect(ui47).toContain("useState(contratoInicial === undefined ? '' : String(contratoInicial))");
    expect(ui47).toContain('lerIntencao47(localStorage,owner)');
    expect(ui47).toContain('generation.current===epoch');
    expect(ui47).toContain('permitirRenovacao={false}');
    expect(ui47).not.toContain('contratos.renovar');
  });
});
