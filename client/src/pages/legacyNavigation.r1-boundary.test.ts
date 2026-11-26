import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { rotaReparcelamentoAtual } from '../lib/legacyFinanceNavigation';
import { deveUsarListaSegura } from '../../../shared/emprestimosListaSegura';
import { compile, declaration, nodes, source } from '../lib/r1BoundaryHarness';

function handler(file: string, scope: string | undefined, label: string) {
  const ast = source(file), root = scope ? declaration(ast, scope) : ast;
  const buttons = nodes(root, n => ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'Button' && n.children.some(c => c.getText(ast).includes(label))) as ts.JsxElement[];
  if (!buttons.length) throw Error(`Missing real button ${label}`);
  return buttons.map(button => {
    const attr = button.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'onClick') as ts.JsxAttribute;
    return (attr.initializer as ts.JsxExpression).expression!.getText(ast);
  });
}
function execute(text: string, bindings: Record<string, any>) { return compile(`return (${text});`, bindings)(); }
const forbidden = vi.fn(() => { throw Error('Navigation attempted a financial mutation'); });
const trap: any = new Proxy(forbidden, { get: (): any => trap });

describe('R1 navegação financeira real é inerte até confirmação explícita', () => {
  it.each([
    ['Receber / conferir', '/emprestimos/31'], ['Receber / renovar', '/emprestimos/31'],
    ['Alterar juros futuros', '/emprestimos/31#manutencao-financeira'], ['Aplicar Multa', '/emprestimos/31'],
    ['Reparcelar mensal', '/reparcelamento?contratoId=31'],
  ])('todos os handlers reais %s encaminham contrato sem POST', (label, expected) => {
    forbidden.mockClear();
    for (const real of handler('pages/Emprestimos.tsx', 'EmprestimoCardCobra', label)) {
      const navigate = vi.fn();
      execute(real, { emp: { id: 31 }, setLocation: navigate, rotaReparcelamentoAtual, trpc: trap, editarJurosMutation: trap, aplicarMultaMutation: trap, pagarTotalMutation: trap, renovarMutation: trap });
      expect(navigate).toHaveBeenCalledWith(expected); expect(navigate).toHaveBeenCalledTimes(1);
    }
    expect(forbidden).not.toHaveBeenCalled();
  });
  it.each(['Abrir ficha segura', 'Simular reparcelamento mensal'])('modal %s fecha antes de navegar e não executa writer', label => {
    forbidden.mockClear();
    for (const real of handler('components/EmprestimoDetalhesModal.tsx', 'EmprestimoDetalhesModal', label)) {
      const order: any[] = [];
      execute(real, { emprestimo: { id: 31 }, onOpenChange: (v: boolean) => order.push(['close', v]), navigate: (v: string) => order.push(['route', v]), rotaReparcelamentoAtual, trpc: trap, pagarTotalMutation: trap, pagarJurosMutation: trap, editarMutation: trap });
      expect(order).toEqual([['close', false], ['route', label.startsWith('Abrir') ? '/emprestimos/31' : '/reparcelamento?contratoId=31']]);
    }
    expect(forbidden).not.toHaveBeenCalled();
  });
  it('retry publicado permanece discriminado pelo predicado real PRECONDITION_FAILED', () => {
    const ast = source('pages/Emprestimos.tsx');
    const call = nodes(ast, n => ts.isCallExpression(n) && n.expression.getText(ast) === 'trpc.contratos.listComParcelas.useQuery')[0] as ts.CallExpression;
    const options = call.arguments[1] as ts.ObjectLiteralExpression;
    const prop = options.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'retry') as ts.PropertyAssignment;
    const retry = compile(`return (${prop.initializer.getText(ast)});`, { deveUsarListaSegura });
    for (const count of [0, 1, 2, 3]) expect(retry(count, { data: { code: 'PRECONDITION_FAILED' } })).toBe(false);
    for (const error of [{ data: { code: 'UNAUTHORIZED' } }, { data: { code: 'INTERNAL_SERVER_ERROR' } }, Error('network fixture')]) {
      expect([0, 1, 2, 3].map(n => retry(n, error))).toEqual([true, true, true, false]);
    }
  });
});
