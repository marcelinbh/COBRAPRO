import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const parse = (file: string) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function nodes(root: ts.Node, match: (n: ts.Node) => boolean) { const found: ts.Node[] = []; const visit = (n: ts.Node) => { if (match(n)) found.push(n); ts.forEachChild(n, visit); }; visit(root); return found; }
function tags(ast: ts.SourceFile, tag: string) { return nodes(ast, n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(ast) === tag) as ts.JsxSelfClosingElement[]; }
function evaluate(text: string, context: Record<string, unknown>) {
  const output = ts.transpileModule(`return (${text});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(context), output)(...Object.values(context));
}
function props(node: ts.JsxSelfClosingElement, ast: ts.SourceFile, context: Record<string, unknown>) {
  return Object.fromEntries(node.attributes.properties.map(a => {
    if (!ts.isJsxAttribute(a)) throw Error('Spread financeiro inesperado');
    return [a.name.getText(ast), !a.initializer ? true : ts.isJsxExpression(a.initializer) ? evaluate(a.initializer.expression!.getText(ast), context) : a.initializer.text];
  }));
}
describe('integração real R1→obrigações: nenhuma navegação executa financeiro', () => {
  it('ficha tem acesso na aba Detalhes, por parcela e no rodapé; props de alvo não autorizam writer', () => {
    const ast = parse('pages/EmprestimoDetalhes.tsx'), cb = vi.fn();
    const inputs = tags(ast, 'OperacoesObrigacao51').map(n => props(n, ast, { emprestimo: { id: 31 }, p: { id: 44 }, atualizarFinanceiro: cb }));
    expect(inputs).toHaveLength(3); expect(inputs.every(p => p.contratoId === 31 && p.onSuccess === cb)).toBe(true);
    expect(inputs.filter(p => p.alvoInicial.tipo === 'contrato')).toHaveLength(2);
    expect(inputs.find(p => p.alvoInicial.tipo === 'parcela')).toMatchObject({ alvoInicial: { tipo: 'parcela', parcelaId: 44 }, acaoInicial: 'editar' });
    for (const input of inputs) { expect(input).not.toHaveProperty('ownerId'); expect(input).not.toHaveProperty('sessionScope'); expect(input).not.toHaveProperty('contaCaixaId'); expect(input).not.toHaveProperty('valorPago'); }
    const perParcel = tags(ast, 'OperacoesObrigacao51').find(n => n.getText(ast).includes('parcelaId: p.id'))!;
    expect(perParcel.parent.parent.getText(ast)).toContain('px-3 py-2 text-center');
    const detail = tags(ast, 'OperacoesObrigacao51')[0]; let parent: ts.Node | undefined = detail;
    let underDetails = false; while (parent) { if (parent.getText(ast).startsWith("aba === 'detalhes' &&")) underDetails = true; parent = parent.parent; }
    expect(underDetails).toBe(true);
    expect(read('pages/EmprestimoDetalhes.tsx')).toContain('Reparcelamento redistribui a dívida existente, não inclui nova obrigação');
  });
  it('não oculta ou troca os fluxos 46/48/receber/multa existentes', () => {
    const ast = parse('pages/EmprestimoDetalhes.tsx');
    for (const name of ['ManutencaoJuros48', 'ManutencaoCalendario', 'MultaManualAplicar']) expect(tags(ast, name)).toHaveLength(1);
    expect(tags(ast, 'RecebimentoValidado')).toHaveLength(2);
  });
  it('os dois atalhos antigos da listagem abrem o mesmo diálogo, sem confirmação/mutation de deletar', () => {
    const ast = parse('pages/Emprestimos.tsx'), open = vi.fn(), forbidden = vi.fn(() => { throw Error('Financeiro chamado pela navegação'); });
    const handlers = nodes(ast, n => ts.isJsxAttribute(n) && n.name.getText(ast) === 'onClick' && n.getText(ast).includes('setCancelarAberto(true)')) as ts.JsxAttribute[];
    expect(handlers).toHaveLength(2);
    for (const attr of handlers) {
      const body = (attr.initializer as ts.JsxExpression).expression!.getText(ast);
      evaluate(body, { setCancelarAberto: open, confirm: forbidden, deletarMutation: { mutate: forbidden } })();
    }
    expect(open.mock.calls).toEqual([[true], [true]]); expect(forbidden).not.toHaveBeenCalled();
    expect(read('pages/Emprestimos.tsx')).not.toMatch(/contratos\.deletar|deletarMutation|confirm\('.*deletar/);
    const exact = props(tags(ast, 'DeleteEmprestimoDialog')[0], ast, { emp: { id: 31, clienteNome: 'Synthetic' }, cancelarAberto: true, setCancelarAberto: open, onRefresh: vi.fn() });
    expect(exact).toMatchObject({ emprestimoId: 31, clienteNome: 'Synthetic', open: true });
  });
  it('botão da ficha não está disabled incondicionalmente: abre diálogo sem POST', () => {
    const ast = parse('pages/EmprestimoDetalhes.tsx');
    const button = nodes(ast, n => ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'Button' && n.children.some(c => c.getText(ast).includes('Cancelar / arquivar')))[0] as ts.JsxElement;
    expect(button).toBeDefined();
    expect(button.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'disabled')).toBe(false);
    const attr = button.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'onClick') as ts.JsxAttribute;
    const open = vi.fn(); evaluate((attr.initializer as ts.JsxExpression).expression!.getText(ast), { setModalDeletar: open })(); expect(open).toHaveBeenCalledWith(true);
  });
  it('diálogo de cancelar delega contrato exato ao único protocolo e explica sem estorno', () => {
    const text = read('components/DeleteEmprestimoDialog.tsx');
    expect(text).not.toMatch(/useMutation|contratos\.deletar|mutateAsync|estorno compensatório precisa/);
    expect(text).toContain('Cancelar é renúncia à obrigação aberta, sem estorno');
    expect(text).toContain('alvoInicial={{ tipo: \'contrato\' }} acaoInicial="cancelar"');
    expect(text).toContain('contratoId={emprestimoId}');
  });
});
