import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import ts from 'typescript';
const read=(p:string)=>readFileSync(new URL('../../../'+p,import.meta.url),'utf8');
describe('integração mínima43/44 no modal compartilhado',()=>{
 it('modal preserva detalhes mas suas entradas financeiras apenas navegam à ficha segura',()=>{
  const source=read('client/src/components/EmprestimoDetalhesModal.tsx');
  const ast=ts.createSourceFile('modal.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const handlers:string[]=[];
  function walk(n:ts.Node){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(ast)==='Button'&&n.getText(ast).includes('Abrir ficha segura')){
   const a=n.openingElement.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(ast)==='onClick') as ts.JsxAttribute;
   handlers.push(((a.initializer as ts.JsxExpression).expression!).getText(ast));
  }ts.forEachChild(n,walk);}walk(ast);
  expect(handlers.length).toBeGreaterThanOrEqual(2);
  for(const handler of handlers){const close=vi.fn(),navigate=vi.fn();new Function('onOpenChange','navigate','emprestimo',`return (${handler})();`)(close,navigate,{id:43});expect(close).toHaveBeenCalledWith(false);expect(navigate).toHaveBeenCalledWith('/emprestimos/43');expect(handler).not.toContain('mutate');}
  expect(source).not.toContain('{/* Botões de Ação */}');
 });
 it('44 monta uma única ação certificada na ficha e43 dedicado não habilita renovação',()=>{
  const ficha=read('client/src/pages/EmprestimoDetalhes.tsx');expect(ficha.match(/<ManutencaoCalendario /g)).toHaveLength(1);
  const page43=read('client/src/pages/Reparcelamento.tsx');expect(page43).toContain('permitirRenovacao={false}');
  expect(read('server/routers.ts')).toContain('reparcelamento: reparcelamento43Router,');
 });
});
