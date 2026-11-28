import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { compile, Hooks, source, text, treeNodes, deferred } from '../../client/src/lib/r1BoundaryHarness';
import * as controles67 from '../../client/src/lib/emprestimosListaControles67';
import { badgeContrato } from '../../client/src/lib/statusEmprestimoBadge';
import { noArquivo51, referenciaMonetaria51, statusContrato51, REFERENCIA51 } from '../../client/src/lib/obrigacoes51Apresentacao';
import { rotaAcaoListaEmprestimo62 } from '../../client/src/lib/acoesListaEmprestimo62';
import { mapearSnapshot67 } from '../../server/services/snapshot67-reader';
import { fixture67 } from './fixture67';
const body=(relative:string)=>{const ast=source(relative);return ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast).replace(/^export\s+(?:default\s+)?/,'')).join('\n');};
const button=(tree:any,label:string)=>{const n=treeNodes(tree,n=>n.type==='button'&&text(n)===label)[0];expect(n,label).toBeDefined();return n;};
// Executa wrapper, parent e editor da fonte em instâncias Hooks separadas; sem renderer/browser.
const editorBoundary67=()=>{
 const parent=new Hooks(),hooks=new Hooks(),apply=deferred(),refresh=deferred();let data=mapearSnapshot67(fixture67(),41),tree:any,editorTree:any;
 const api={criar:vi.fn(async()=>{}),remover:vi.fn(async()=>{}),aplicar:vi.fn((_input:any)=>apply.promise),atualizar:vi.fn(()=>refresh.promise)},onBusy=vi.fn(),fechar=vi.fn();
 const Editor=compile(`${body('components/EtiquetasLista67.tsx')}\nreturn EtiquetasLista67;`,hooks.bindings());
 const Parent=compile(`${body('components/EmprestimosListaSegura.tsx')}\nreturn EmprestimosListaSegura;`,{...parent.bindings(),...controles67,badgeContrato,noArquivo51,referenciaMonetaria51,statusContrato51,REFERENCIA51,rotaAcaoListaEmprestimo62,ExportarLista66:'ExportarLista66'});
 const mutation=(fn:any)=>({useMutation:()=>({mutateAsync:fn})});
 const Wrapper=compile(`${body('components/EmprestimosLista64Conectada.tsx')}\nreturn EmprestimosLista64Conectada;`,{React:parent.bindings().React,EmprestimosListaSegura:'Parent67',EtiquetasLista67:'Editor67',CobrancaLote64:'Lote64',trpc:{useUtils:()=>({contratos:{listLeituraSegura:{invalidate:api.atualizar}},client:{}}),cobrancaLista64:{enviar:mutation(vi.fn())},etiquetasLista67:{criar:mutation(api.criar),remover:mutation(api.remover),aplicar:mutation(api.aplicar)}}});
 const render=()=>{
  const wrapper=Wrapper({data,onRefresh:vi.fn()});tree=parent.render(Parent,wrapper.props);parent.flush();
  const node=treeNodes(tree,n=>n.type==='Editor67')[0];editorTree=node?hooks.render(Editor,{...node.props,onBusy:(v:boolean)=>{onBusy(v);node.props.onBusy(v);},fechar:()=>{fechar();node.props.fechar();}}):null;
  if(node)hooks.flush();return tree;
 };
 render();button(tree,'Editar etiquetas # 1').props.onClick();render();
 return {api,apply,refresh,hooks,onBusy,fechar,render,get tree(){return tree;},get editor(){return editorTree;},get data(){return data;},setData:(next:typeof data)=>{data=next;render();}};
};
const settle67=async()=>{await Promise.resolve();await Promise.resolve();};
describe('67 UI boundary: handlers da fonte, não botões decorativos',()=>{
 it('vencimento/cobrador/etiqueta e pasta usam mesmos items/refs; seleção limpa e busy bloqueia',()=>{
  const hooks=new Hooks(),data=mapearSnapshot67(fixture67(),41), renderCobranca=vi.fn((p:any)=>hooks.bindings().React.createElement('aside',p)),renderEtiquetas=vi.fn(()=>null);
  const Component=compile(`${body('components/EmprestimosListaSegura.tsx')}\nreturn EmprestimosListaSegura;`,{...hooks.bindings(),...controles67,badgeContrato,noArquivo51,referenciaMonetaria51,statusContrato51,REFERENCIA51,rotaAcaoListaEmprestimo62,ExportarLista66:'ExportarLista66'});
  const render=()=>hooks.render(Component,{data,onRefresh:vi.fn(),renderCobranca,renderEtiquetas});let tree=render();
  const change=(label:string,value:string)=>{treeNodes(tree,n=>n.type==='select'&&n.props['aria-label']===label)[0].props.onChange({target:{value}});tree=render();};
  change('Situação de vencimento','atrasados'); change('Cobrador no escopo','7');change('Etiqueta','nome:Prioridade');
  const exported=()=>treeNodes(tree,n=>n.type==='ExportarLista66')[0].props;
  expect(exported().items[0]).toBe(data.items[0]);expect(exported().items[1]).toBe(data.items[1]);
  button(tree,'Agrupar em pastas por cliente').props.onClick();tree=render();
  expect(treeNodes(tree,n=>n.type==='details')).toHaveLength(1);expect(treeNodes(tree,n=>n.type==='details')[0].props.open).toBeUndefined();
  const unknown=treeNodes(tree,n=>n.props?.['aria-label']==='Registros indisponíveis sempre visíveis')[0];expect(text(unknown)).toMatch(/Empréstimo #\s*9\b/);
  expect(exported().items[0]).toBe(data.items[0]);expect(treeNodes(unknown,n=>!!n.props?.href||!!n.props?.onClick)).toHaveLength(0);
  const hrefs=treeNodes(tree,n=>n.type==='a').map(n=>n.props.href);expect(hrefs).toEqual(['/emprestimos/1','/emprestimos/1#receber-conferir','/emprestimos/1#editar-obrigacao','/emprestimos/1#reparcelar','/emprestimos/1#cancelar-arquivar']);
  button(tree,'Selecionar para cobrar').props.onClick();tree=render();button(tree,'Selecionar vencidos visíveis').props.onClick();tree=render();
  expect(renderCobranca.mock.calls.at(-1)?.[0].contratoIds).toEqual([1]);renderCobranca.mock.calls.at(-1)?.[0].onBusy(true);tree=render();change('Etiqueta','sem');expect(exported().items[0]).toBe(data.items[0]);
  renderCobranca.mock.calls.at(-1)?.[0].onBusy(false);tree=render();change('Etiqueta','sem');expect(exported().items).toEqual([data.items[1]]);expect(text(tree)).toContain('0 de 20 selecionados');
  button(tree,'Limpar filtros').props.onClick();tree=render();expect(exported().items[0]).toBe(data.items[0]);
 });
 it('único editor não muta no render, bloqueia duplo clique e ignora resposta pós-unmount/ABA',async()=>{
  const hooks=new Hooks(),data=mapearSnapshot67(fixture67(),41),org=data.organizacao67!;if(org.state!=='confirmed'||org.contratos[0].etiquetas.state!=='confirmed')throw Error('fixture');
  const deferredApply=deferred(),api={criar:vi.fn(),remover:vi.fn(),aplicar:vi.fn((_input:any)=>deferredApply.promise),atualizar:vi.fn(async()=>{})},fechar=vi.fn(),onBusy=vi.fn();
  const Component=compile(`${body('components/EtiquetasLista67.tsx')}\nreturn EtiquetasLista67;`,hooks.bindings());
  const props={data,editor:{contratoId:1,etiquetas:org.contratos[0].etiquetas},api,fechar,onBusy};
  let tree=hooks.render(Component,props);hooks.flush();expect(api.aplicar).not.toHaveBeenCalled();
  const click=button(tree,'Confirmar etiquetas').props.onClick;click();click();expect(api.aplicar).toHaveBeenCalledTimes(1);
  expect(api.aplicar.mock.calls[0][0]).toMatchObject({contratoId:1,revisao:'0',estadoHash:'a'.repeat(64)});
  hooks.render(Component,{...props,data:{...data,userId:99}});hooks.render(Component,props);hooks.unmount();deferredApply.resolve({});await Promise.resolve();await Promise.resolve();
  expect(api.atualizar).not.toHaveBeenCalled();expect(fechar).not.toHaveBeenCalled();
 });
 it('conflito/timeout não repete aplicação nem anuncia sucesso; exige atualizar',async()=>{
  const hooks=new Hooks(),data=mapearSnapshot67(fixture67(),41),org=data.organizacao67!;if(org.state!=='confirmed'||org.contratos[0].etiquetas.state!=='confirmed')throw Error('fixture');
  const api={criar:vi.fn(),remover:vi.fn(),aplicar:vi.fn(async()=>{throw Error('40001');}),atualizar:vi.fn(async()=>{})};
  const Component=compile(`${body('components/EtiquetasLista67.tsx')}\nreturn EtiquetasLista67;`,hooks.bindings()),props={data,editor:{contratoId:1,etiquetas:org.contratos[0].etiquetas},api,fechar:vi.fn(),onBusy:vi.fn()};
  let tree=hooks.render(Component,props);hooks.flush();button(tree,'Confirmar etiquetas').props.onClick();await Promise.resolve();await Promise.resolve();tree=hooks.render(Component,props);
  expect(text(tree)).toContain('Resultado não confirmado ou conflito');expect(treeNodes(tree,n=>n.type==='fieldset')[0].props.disabled).toBe(true);
  button(tree,'Confirmar etiquetas').props.onClick();expect(api.aplicar).toHaveBeenCalledTimes(1);expect(api.atualizar).not.toHaveBeenCalled();
 });
 it.each(['resolve','reject'] as const)('sucesso + refetch same-owner antes de atualizar %s libera somente seu lock e permite fechar/reconsultar',async(outcome)=>{
  const h=editorBoundary67(),click=button(h.editor,'Confirmar etiquetas').props.onClick;click();click();h.render();
  expect(h.api.aplicar).toHaveBeenCalledTimes(1);expect(button(h.tree,'Atualizar consulta segura').props.disabled).toBe(true);
  h.apply.resolve({});await settle67();expect(h.api.atualizar).toHaveBeenCalledTimes(1);
  const old=h.data,next=mapearSnapshot67(fixture67(),41);expect(next).not.toBe(old);expect(next.userId).toBe(old.userId);h.setData(next);
  click();button(h.editor,'Confirmar etiquetas').props.onClick();expect(h.api.aplicar).toHaveBeenCalledTimes(1);
  expect(button(h.editor,'Fechar editor').props.disabled).toBe(true);expect(h.fechar).not.toHaveBeenCalled();
  if(outcome==='resolve')h.refresh.resolve({});else h.refresh.reject(Error('refresh timeout'));await settle67();h.render();
  expect(h.onBusy.mock.calls.map(c=>c[0])).toEqual([true,false]);expect(button(h.tree,'Atualizar consulta segura').props.disabled).toBe(false);
  expect(treeNodes(h.tree,n=>n.type==='select').every(n=>n.props.disabled===false)).toBe(true);
  expect(treeNodes(h.editor,n=>n.type==='fieldset')[0].props.disabled).toBe(true);expect(button(h.editor,'Fechar editor').props.disabled).toBe(false);
  expect(button(h.editor,'Atualizar para reconfirmar').props.disabled).toBe(false);expect(h.fechar).not.toHaveBeenCalled();
  click();button(h.editor,'Confirmar etiquetas').props.onClick();expect(h.api.aplicar).toHaveBeenCalledTimes(1);
  button(h.editor,'Atualizar para reconfirmar').props.onClick();h.render();expect(h.fechar).toHaveBeenCalledTimes(1);expect(h.api.atualizar).toHaveBeenCalledTimes(2);expect(h.editor).toBeNull();
 });
 it('sucesso sem mudança de snapshot fecha uma vez e libera o parent, sem repetição automática',async()=>{
  const h=editorBoundary67();button(h.editor,'Confirmar etiquetas').props.onClick();h.apply.resolve({});await settle67();h.refresh.resolve({});await settle67();h.render();
  expect(h.fechar).toHaveBeenCalledTimes(1);expect(h.onBusy.mock.calls.map(c=>c[0])).toEqual([true,false]);expect(h.editor).toBeNull();
  expect(button(h.tree,'Atualizar consulta segura').props.disabled).toBe(false);expect(h.api.aplicar).toHaveBeenCalledTimes(1);expect(h.api.atualizar).toHaveBeenCalledTimes(1);
 });
 it.each(['aplicar','criar'] as const)('promises concorrentes same-owner: %s possui o único lock, sem duplicação após refetch',async(first)=>{
  const h=editorBoundary67(),create=deferred();h.api.criar.mockImplementation(()=>create.promise);
  treeNodes(h.editor,n=>n.type==='input'&&n.props['aria-label']==='Nome da nova etiqueta')[0].props.onChange({target:{value:'Nova'}});h.render();
  const applyClick=button(h.editor,'Confirmar etiquetas').props.onClick,createClick=button(h.editor,'Criar no catálogo próprio').props.onClick;
  if(first==='aplicar'){applyClick();createClick();applyClick();}else{createClick();applyClick();createClick();}
  expect(h.api.aplicar).toHaveBeenCalledTimes(first==='aplicar'?1:0);expect(h.api.criar).toHaveBeenCalledTimes(first==='criar'?1:0);
  if(first==='aplicar')h.apply.resolve({});else create.resolve({});await settle67();expect(h.api.atualizar).toHaveBeenCalledTimes(1);
  h.setData(mapearSnapshot67(fixture67(),41));applyClick();createClick();h.refresh.resolve({});await settle67();h.render();applyClick();createClick();
  expect(h.api.aplicar).toHaveBeenCalledTimes(first==='aplicar'?1:0);expect(h.api.criar).toHaveBeenCalledTimes(first==='criar'?1:0);
  expect(h.onBusy.mock.calls.map(c=>c[0])).toEqual([true,false]);expect(h.fechar).not.toHaveBeenCalled();expect(button(h.tree,'Atualizar consulta segura').props.disabled).toBe(false);
 });
 it.each(['resolve','reject'] as const)('newdata antes da mutation %s: resposta stale não confirma sucesso nem refaz aplicação',async(outcome)=>{
  const h=editorBoundary67();button(h.editor,'Confirmar etiquetas').props.onClick();h.setData(mapearSnapshot67(fixture67(),41));
  if(outcome==='resolve')h.apply.resolve({});else h.apply.reject(Error('40001'));await settle67();h.render();
  expect(h.api.atualizar).not.toHaveBeenCalled();expect(h.fechar).not.toHaveBeenCalled();expect(text(h.editor)).not.toContain('Confirmado.');
  expect(h.onBusy.mock.calls.map(c=>c[0])).toEqual([true,false]);expect(button(h.tree,'Atualizar consulta segura').props.disabled).toBe(false);
  expect(treeNodes(h.editor,n=>n.type==='fieldset')[0].props.disabled).toBe(true);expect(button(h.editor,'Fechar editor').props.disabled).toBe(false);
  button(h.editor,'Confirmar etiquetas').props.onClick();expect(h.api.aplicar).toHaveBeenCalledTimes(1);
 });
 it('refresh antigo após unmount não libera tentativa nova same-owner nem fecha/atualiza outra instância',async()=>{
  const old=editorBoundary67();button(old.editor,'Confirmar etiquetas').props.onClick();old.apply.resolve({});await settle67();old.setData(mapearSnapshot67(fixture67(),41));old.hooks.unmount();
  const current=editorBoundary67();button(current.editor,'Confirmar etiquetas').props.onClick();current.render();
  old.refresh.resolve({});await settle67();current.render();
  expect(old.onBusy.mock.calls.map(c=>c[0])).toEqual([true]);expect(old.fechar).not.toHaveBeenCalled();expect(old.api.atualizar).toHaveBeenCalledTimes(1);
  expect(current.onBusy.mock.calls.map(c=>c[0])).toEqual([true]);expect(button(current.tree,'Atualizar consulta segura').props.disabled).toBe(true);
  button(current.editor,'Confirmar etiquetas').props.onClick();expect(current.api.aplicar).toHaveBeenCalledTimes(1);
  current.apply.resolve({});await settle67();current.refresh.resolve({});await settle67();current.render();
  expect(current.onBusy.mock.calls.map(c=>c[0])).toEqual([true,false]);expect(current.fechar).toHaveBeenCalledTimes(1);
 });
 it.each(['mutation','refresh'] as const)('owner ABA durante %s impede old completion de liberar lock/fechar/confirmar',async(stage)=>{
  const h=editorBoundary67(),initial=h.data;button(h.editor,'Confirmar etiquetas').props.onClick();
  if(stage==='refresh'){h.apply.resolve({});await settle67();}
  h.setData({...initial,userId:99});h.setData(initial);
  if(stage==='mutation')h.apply.resolve({});else h.refresh.resolve({});await settle67();h.render();
  expect(h.onBusy.mock.calls.map(c=>c[0])).toEqual([true]);expect(h.fechar).not.toHaveBeenCalled();expect(h.api.atualizar).toHaveBeenCalledTimes(stage==='refresh'?1:0);
  if(stage==='mutation')expect(text(h.editor)).not.toContain('Confirmado.');expect(button(h.tree,'Atualizar consulta segura').props.disabled).toBe(true);
  button(h.editor,'Confirmar etiquetas').props.onClick();expect(h.api.aplicar).toHaveBeenCalledTimes(1);h.hooks.unmount();
 });
});
