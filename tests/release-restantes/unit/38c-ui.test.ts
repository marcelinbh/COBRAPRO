import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { CancelamentoPendenteStore } from '../../../shared/despesaCancelamentoPendente';
const h = vi.hoisted(() => ({ current: null as any, cap: { habilitado: true }, cancel: vi.fn(), recover: vi.fn(), success: vi.fn(), invalidate: vi.fn(), network: vi.fn() }));
vi.mock('react', async original => {
 const actual = await original<typeof React>();
 return { ...actual,
  useState: (initial: any) => { const r=h.current,i=r.cursor++;if(!(i in r.values))r.values[i]=typeof initial==='function'?initial():initial;return [r.values[i],(next:any)=>{r.values[i]=typeof next==='function'?next(r.values[i]):next;r.dirty=true;r.writes++;}]; },
  useRef: (initial: any) => { const r=h.current,i=r.cursor++;return r.values[i]??(r.values[i]={current:initial}); },
  useMemo: (fn:any,deps:any[])=>{const r=h.current,i=r.cursor++;if(!r.deps[i]||deps.some((v,n)=>v!==r.deps[i][n])){r.values[i]=fn();r.deps[i]=deps;}return r.values[i];},
  useEffect: (fn:any,deps:any[])=>{const r=h.current,i=r.cursor++;if(!r.deps[i]||deps.some((v,n)=>v!==r.deps[i][n])){r.effects.push(()=>{r.cleanups[i]?.();r.cleanups[i]=fn();});r.deps[i]=deps;}},
 };
});
vi.mock('@/components/ui/button',()=>({Button:'button'}));
vi.mock('@/components/ui/input',()=>({Input:'input'}));
vi.mock('sonner',()=>({toast:{success:h.success}}));
vi.mock('@/lib/trpc',()=>({trpc:{contasPagar:{capacidadesCancelamentoPendente:{useQuery:()=>({data:h.cap,isError:false})},cancelarPendente:{useMutation:()=>({mutateAsync:h.cancel})},recuperarCancelamentoPendente:{useMutation:()=>({mutateAsync:h.recover})}},useUtils:()=>({contasPagar:{listar:{invalidate:h.invalidate},resumo:{invalidate:h.invalidate}}})}}));
import Component from '../../../client/src/components/CancelamentoPendente';
class Harness {
 values:any[]=[];deps:any[]=[];cleanups:any[]=[];effects:any[]=[];cursor=0;dirty=true;tree:any;writes=0;owner=1;items:any[]=[];frames:any[]=[];
 render(){let n=0;do{this.dirty=false;this.cursor=0;h.current=this;this.tree=Component({userId:this.owner,itens:this.items});this.frames.push(this.tree);this.effects.splice(0).forEach(f=>f());if(++n>25)throw new Error('render loop');}while(this.dirty);return this;}
 async flush(){for(let i=0;i<24;i++){await Promise.resolve();if(this.dirty)this.render();}}
 nodes(root=this.tree){const a:any[]=[];const walk=(n:any)=>{if(!n)return;if(Array.isArray(n))return n.forEach(walk);if(typeof n!=='object')return;a.push(n);walk(n.props?.children);};walk(root);return a;}
 text(root=this.tree):string {const walk=(n:any):string=>n==null||typeof n==='boolean'?'':Array.isArray(n)?n.map(walk).join(' '):typeof n==='object'?walk(n.props?.children):String(n);return walk(root);}
 field(id:string){return this.nodes().find(n=>n.props?.id===id);}
 button(text:string){return this.nodes().find(n=>n.type==='button'&&this.text(n).includes(text));}
 change(id:string,value:string){this.field(id).props.onChange({target:{value}});this.render();}
 async click(text:string){const n=this.button(text);expect(n).toBeDefined();expect(n.props.disabled).toBeFalsy();n.props.onClick();this.render();await this.flush();}
 close(){this.cleanups.forEach(f=>f?.());}
}
const key='11111111-1111-4111-8111-111111111111',origin='22222222-2222-4222-8222-222222222222';
const payload={despesaId:18,origemOperationId:origin,motivo:'Duplicada'};
const confirmation=(userId:number,input:any)=>({contrato:'despesa_cancelamento_pendente_v1',success:true,acao:'cancelarPendente',userId,...input,operationId:'33333333-3333-4333-8333-333333333333',status:'cancelado',valor:'10.01',instante:'2026-11-24T18:00:00+00:00',semMovimentoCaixa:true});
let ui:Harness,data:Map<string,string>,storage:any;
function pending(owner=1){return new CancelamentoPendenteStore(owner,storage).begin(payload,()=>key);}
function deferred(){let resolve!:(v:any)=>void;const promise=new Promise(r=>resolve=r);return{resolve,promise};}
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('React',React);h.cap={habilitado:true};data=new Map();storage={get length(){return data.size;},key:vi.fn((i:number)=>[...data.keys()][i]??null),getItem:vi.fn((k:string)=>data.get(k)??null),setItem:vi.fn((k:string,v:string)=>data.set(k,v))};vi.stubGlobal('window',{sessionStorage:storage});h.network.mockImplementation(()=>{throw new Error('rede proibida');});vi.stubGlobal('fetch',h.network);h.cancel.mockRejectedValue(new Error('timeout'));ui=new Harness();ui.items=[{id:18,descricao:'Despesa A',podeCancelarPendente:true,origemOperationId:origin}];});
afterEach(()=>{ui.close();expect(h.network).not.toHaveBeenCalled();vi.unstubAllGlobals();});
describe('UI cancelamento offline: interação e callbacks reais do componente',()=>{
 it('armazena antes de chamar writer e timeout mantém retry exato',async()=>{
  h.cancel.mockImplementation(async input=>{const stored=JSON.parse([...data.values()][0]);expect(stored.input).toEqual(input);throw new Error('timeout');});
  ui.render();ui.change('cancelamento-despesa','18');ui.change('cancelamento-motivo','Duplicada');await ui.click('Confirmar cancelamento');expect(h.cancel).toHaveBeenCalledTimes(1);const original=h.cancel.mock.calls[0][0];expect(data.size).toBe(1);await ui.click('Reenviar MESMA');expect(h.cancel).toHaveBeenCalledTimes(2);expect(h.cancel.mock.calls[1][0]).toEqual(original);
 });
 it('original fora da lista reaparece no reload e recovery funciona com gateOFF',async()=>{
  const o=pending();ui.items=[];h.cap={habilitado:false};h.recover.mockResolvedValue({contrato:o.contrato,userId:1,idempotencyKey:key,request:payload,status:'confirmed',fence:null,result:confirmation(1,o.input)});ui.render();expect(ui.text()).toContain(key);await ui.click('Conferir cancelamento');expect(h.cancel).not.toHaveBeenCalled();expect(h.recover).toHaveBeenCalledWith(o.input);expect(data.size).toBe(1);expect(h.success).toHaveBeenCalledTimes(1);
 });
 it('A→B→A recusa callback antigo após await e não limpa original nem invalida cache',async()=>{
  const o=pending(),wait=deferred();h.recover.mockReturnValue(wait.promise);ui.render();await ui.click('Conferir cancelamento');ui.owner=2;ui.render();expect(ui.text()).not.toContain(key);ui.owner=1;ui.render();const writes=ui.writes;wait.resolve({contrato:o.contrato,userId:1,idempotencyKey:key,request:payload,status:'confirmed',fence:null,result:confirmation(1,o.input)});await ui.flush();expect(ui.writes).toBe(writes);expect(h.success).not.toHaveBeenCalled();expect(h.invalidate).not.toHaveBeenCalled();expect(data.size).toBe(1);
 });
 it('unmount recusa resposta tardia de sessão anterior',async()=>{
  const o=pending(),wait=deferred();h.recover.mockReturnValue(wait.promise);ui.render();await ui.click('Conferir cancelamento');ui.close();const writes=ui.writes;wait.resolve({contrato:o.contrato,userId:1,idempotencyKey:key,request:payload,status:'confirmed',fence:null,result:confirmation(1,o.input)});await ui.flush();expect(ui.writes).toBe(writes);expect(h.success).not.toHaveBeenCalled();
 });
 it('original38 de owner corrente bloqueia intenção nova; nunca lê/remove seu payload',()=>{
  const old='cobrapro:despesas:0038:v38:user:1:ui:despesas:despesa:18';data.set(old,'opaque-original38');ui.render();expect(ui.text()).toContain('originais38');expect(ui.button('Confirmar cancelamento').props.disabled).toBe(true);expect(storage.getItem.mock.calls.some(([k]:any[])=>k===old)).toBe(false);expect(data.get(old)).toBe('opaque-original38');
 });
 it('namespace38 de outro owner não bloqueia nem expõe original alheio',()=>{
  const other='cobrapro:despesas:0038:v38:user:2:ui:despesas:despesa:18';data.set(other,'secret-owner2');ui.render();expect(ui.text()).not.toContain('originais38');expect(ui.text()).not.toContain('secret-owner2');expect(storage.getItem.mock.calls.some(([k]:any[])=>k===other)).toBe(false);
 });
});
describe('UI closure terminal e flag dinâmica',()=>{
  const evidence=(o:any,status='confirmed')=>({contrato:o.contrato,userId:1,idempotencyKey:key,request:payload,status,result:status==='confirmed'?confirmation(1,o.input):null,fence:status==='not_executed'?{fenceId:'44444444-4444-4444-8444-444444444444',instante:'2026-11-24T18:00:00+00:00'}:null});
  it.each(['confirmed','not_executed'])('encerra %s gateOFF, preserva recibo e próximo cancelamento reaparece gateON sem reload',async status=>{
    const o=pending();h.cap={habilitado:false};h.recover.mockResolvedValue(evidence(o,status));ui.render();await ui.click('Encerrar intenção');expect(h.cancel).not.toHaveBeenCalled();expect(ui.button('Confirmar cancelamento')).toBeDefined();expect(ui.button('Confirmar cancelamento').props.disabled).toBe(true);expect(data.size).toBe(2);
    h.cap={habilitado:true};ui.render();ui.change('cancelamento-despesa','18');ui.change('cancelamento-motivo','Próxima');await ui.click('Confirmar cancelamento');expect(h.cancel).toHaveBeenCalledTimes(1);expect(h.cancel.mock.calls[0][0].idempotencyKey).not.toBe(key);expect(data.size).toBe(2);
  });
  it('unknown não libera head, botão de retry continua mesma UUID',async()=>{
    const o=pending();h.recover.mockResolvedValue(evidence(o,'unknown'));ui.render();await ui.click('Encerrar intenção');expect(ui.text()).toContain(key);expect(ui.button('Confirmar cancelamento')).toBeUndefined();expect(data.size).toBe(1);
  });
  it('callback closure A→B→A nunca fecha head antigo',async()=>{
    const o=pending(),wait=deferred();h.recover.mockReturnValue(wait.promise);ui.render();await ui.click('Encerrar intenção');ui.owner=2;ui.render();ui.owner=1;ui.render();wait.resolve(evidence(o));await ui.flush();expect(data.size).toBe(1);expect(ui.text()).toContain(key);expect(h.invalidate).not.toHaveBeenCalled();
  });
  it('flagON→OFF bloqueia novo envio na UI sem remount e não bloqueia recovery',async()=>{
    ui.render();ui.change('cancelamento-despesa','18');ui.change('cancelamento-motivo','Duplicada');h.cap={habilitado:false};ui.render();expect(ui.button('Confirmar cancelamento').props.disabled).toBe(true);expect(h.cancel).not.toHaveBeenCalled();
  });
});
