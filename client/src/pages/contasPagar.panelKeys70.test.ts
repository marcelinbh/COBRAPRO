import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Fonte real, sem importar a página, handlers financeiros ou um harness de hooks.
const filename = fileURLToPath(new URL('./ContasPagar.tsx', import.meta.url));
const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const panels = ['CancelamentoPendente', 'EdicaoDespesa49'] as const;
type Panel = typeof panels[number];
type Context = { userId: number; sessao: { cacheId: number }; lista?: unknown; frame?: unknown };

function realKey(panel: Panel): ts.TemplateExpression {
  const expressions: ts.Expression[] = [];
  function visit(node: ts.Node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === panel) {
      const keys = node.attributes.properties.filter((attr): attr is ts.JsxAttribute => ts.isJsxAttribute(attr) && attr.name.getText(source) === 'key');
      expect(keys, `${panel}: exatamente uma key JSX`).toHaveLength(1);
      const value = keys[0].initializer;
      expect(value && ts.isJsxExpression(value) && value.expression, `${panel}: expressão JSX real`).toBeTruthy();
      if (value && ts.isJsxExpression(value) && value.expression) expressions.push(value.expression);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(expressions, `${panel}: exatamente um painel na fonte`).toHaveLength(1);
  expect(ts.isTemplateExpression(expressions[0])).toBe(true);
  return expressions[0] as ts.TemplateExpression;
}

const templates = panels.map(realKey);
const printer = ts.createPrinter();
function evaluate(template: ts.TemplateExpression, context: Context): string {
  // Compila somente o template extraído, não duas constantes duplicadas no teste.
  const expression = printer.printNode(ts.EmitHint.Expression, template, source);
  const { userId, sessao, lista, frame } = context;
  return new Function('userId', 'sessao', 'lista', 'frame', `return (${expression});`)(userId, sessao, lista, frame) as string;
}
const keys = (context: Context) => templates.map(template => evaluate(template, context));

describe('panelKeys70: identidade real dos siblings de ContasPagar', () => {
  it('retém owner/cacheId e usa namespaces distintos nos dois templates reais', () => {
    for (const template of templates) {
      expect(template.templateSpans.map(span => span.expression.getText(source))).toEqual(['userId', 'sessao.cacheId']);
      expect(template.templateSpans.map(span => span.literal.text)).toEqual([':', '']);
      expect(template.head.text.length).toBeGreaterThan(0);
      expect(template.head.text.endsWith(':')).toBe(true);
    }
    expect(new Set(templates.map(template => template.head.text)).size).toBe(2);
    for (const userId of [41, 42, 26011]) {
      for (const cacheId of [1, 2, 101]) {
        const result = keys({ userId, sessao: { cacheId } });
        expect(new Set(result).size).toBe(2);
        expect(result.every(key => key.endsWith(`${userId}:${cacheId}`))).toBe(true);
      }
    }
  });

  it('expõe a colisão original ao retirar apenas os namespaces dos templates reais', () => {
    // Reconstrói o template anterior (head vazio); os spans vêm da fonte CPP.
    const original = templates.map(template => ts.factory.updateTemplateExpression(template, ts.factory.createTemplateHead(''), template.templateSpans));
    const context = { userId: 41, sessao: { cacheId: 7 } };
    const legacy = original.map(template => evaluate(template, context));
    expect(legacy[0]).toBe(legacy[1]);
    expect(new Set(legacy).size).toBe(1);
    expect(new Set(keys(context)).size).toBe(2);
  });

  it('é estável por frame/refetch apesar de inserção, troca e remoção de antecedentes', () => {
    const owner = { userId: 41, sessao: { cacheId: 7 } };
    const initial = keys(owner);
    const frames = [
      { antecedentes: [], isFetching: false, data: [{ id: 1 }] },
      { antecedentes: ['alerta'], isFetching: true, data: undefined },
      { antecedentes: ['resumo', 'alerta'], isFetching: false, data: [{ id: 2 }, { id: 1 }] },
      { antecedentes: ['outro'], isFetching: false, data: [] },
      { antecedentes: [], isFetching: false, data: [{ id: 3 }] },
    ];
    for (const [index, lista] of frames.entries()) {
      expect(keys({ ...owner, sessao: { ...owner.sessao }, lista, frame: index })).toEqual(initial);
    }
  });

  it('muda ambos os painéis por owner e por sessão; A→B→A não recupera a identidade antiga', () => {
    const a = keys({ userId: 41, sessao: { cacheId: 7 } });
    const ownerOnly = keys({ userId: 42, sessao: { cacheId: 7 } });
    const sessionOnly = keys({ userId: 41, sessao: { cacheId: 8 } });
    const b = keys({ userId: 42, sessao: { cacheId: 8 } });
    const newA = keys({ userId: 41, sessao: { cacheId: 9 } });
    for (let index = 0; index < panels.length; index++) {
      expect(ownerOnly[index]).not.toBe(a[index]);
      expect(sessionOnly[index]).not.toBe(a[index]);
      expect(b[index]).not.toBe(a[index]);
      expect(newA[index]).not.toBe(a[index]);
      expect(newA[index]).not.toBe(b[index]);
    }
    expect(new Set([...a, ...b, ...newA]).size).toBe(6);
  });
});
