import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { QueryClient } from '@tanstack/react-query';


const h = vi.hoisted(() => ({
  current: null as any, user: null as any, authError: false, authLoading: false,
  cache: null as any, read: vi.fn(), create: vi.fn(), pay: vi.fn(), reverse: vi.fn(), reconcile: vi.fn(), quote: vi.fn(), edit: vi.fn(), recover: vi.fn(),
  invalidate: vi.fn(), success: vi.fn(), error: vi.fn(), network: vi.fn(), owners: 16000,
  queryCalls: [] as any[], capEnabled: true, capError: false,
}));
// Mesmo harness de hooks em memória dos testes de recovery existentes; sem DOM/browser.
vi.mock('react', async original => {
  const actual = await original<typeof React>();
  return { ...actual,
    useState: (initial: any) => {
      const r = h.current, i = r.cursor++;
      if (!(i in r.values)) r.values[i] = typeof initial === 'function' ? initial() : initial;
      return [r.values[i], (next: any) => {
        r.values[i] = typeof next === 'function' ? next(r.values[i]) : next; r.dirty = true; r.writes++;
      }];
    },
    useRef: (initial: any) => { const r = h.current, i = r.cursor++; return r.values[i] ?? (r.values[i] = { current: initial }); },
    useMemo: (fn: any, deps: any[]) => {
      const r = h.current, i = r.cursor++;
      if (!r.deps[i] || deps.some((v, n) => v !== r.deps[i][n])) { r.values[i] = fn(); r.deps[i] = deps; }
      return r.values[i];
    },
    useEffect: (fn: any, deps: any[]) => {
      const r = h.current, i = r.cursor++;
      if (!r.deps[i] || deps.some((v, n) => v !== r.deps[i][n])) {
        r.effects.push(() => { r.cleanups[i]?.(); r.cleanups[i] = fn(); }); r.deps[i] = deps;
      }
    },
  };
});
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
vi.mock('@/components/ui/input', () => ({ Input: 'input' }));
vi.mock('@/components/ui/textarea', () => ({ Textarea: 'textarea' }));
vi.mock('@/components/ui/label', () => ({ Label: 'label' }));
vi.mock('@/components/ui/card', () => ({ Card: 'article', CardContent: 'div' }));
vi.mock('@/components/ui/badge', () => ({ Badge: 'span' }));
vi.mock('@/components/ui/dialog', () => ({ Dialog: 'dialog', DialogContent: 'div', DialogHeader: 'header', DialogTitle: 'h2' }));
vi.mock('@/components/ui/select', () => ({ Select: 'select', SelectContent: 'div', SelectItem: 'option', SelectTrigger: 'div', SelectValue: 'span' }));
vi.mock('sonner', () => ({ toast: { success: h.success, error: h.error } }));
vi.mock('@/lib/trpc', () => ({ trpc: {
 useUtils: () => ({ contasPagar: { listar: { invalidate: h.invalidate }, resumo: { invalidate: h.invalidate } } }),
 despesas49: {
 capacidades: { useQuery: (_: any, options: any) => { h.queryCalls.push(options);return { data: { habilitado: h.capEnabled }, isError: h.capError }; } },
 cotar: { useMutation: () => ({ mutateAsync: h.quote }) }, editar: { useMutation: () => ({ mutateAsync: h.edit }) }, recuperar: { useMutation: () => ({ mutateAsync: h.recover }) },
 },
} }));
import EdicaoDespesa49 from './EdicaoDespesa49';
class HarnessReact {
  values: any[] = []; deps: any[] = []; cleanups: any[] = []; effects: any[] = [];
  cursor = 0; dirty = true; tree: any; writes = 0; frames: any[] = [];
  render() {
    let n = 0;
    do {
      this.dirty = false; this.cursor = 0; h.current = this; this.tree = EdicaoDespesa49({ userId: h.user.id, itens: [{ id: 10, descricao: "Despesa do owner atual", podePagar: true }] }); this.frames.push(this.tree);
      this.effects.splice(0).forEach(f => f());
      if (++n > 30) throw new Error('Loop de render');
    } while (this.dirty);
    return this;
  }
  async flush() { for (let i = 0; i < 24; i++) { await Promise.resolve(); if (this.dirty) this.render(); } return this; }
  unmount() { this.cleanups.forEach(f => f?.()); this.dirty = false; }
  nodes(type?: string, root = this.tree) {
    const list: any[] = [];
    const walk = (n: any) => {
      if (!n) return; if (Array.isArray(n)) return n.forEach(walk); if (typeof n !== 'object') return;
      if (!type || n.type === type) list.push(n); walk(n.props?.children);
    };
    walk(root); return list;
  }
  text(n: any = this.tree): string {
    const walk = (v: any): string => v == null || typeof v === 'boolean' ? '' : Array.isArray(v) ? v.map(walk).join(' ') : typeof v === 'object' ? walk(v.props?.children) : String(v);
    return walk(n);
  }
  button(fragment: string, root = this.tree) {
    const node = this.nodes('button', root).find(n => this.text(n).includes(fragment));
    if (!node) throw new Error(`Botão ausente: ${fragment}`); return node;
  }
  async click(fragment: string, root = this.tree) {
    const n = this.button(fragment, root);
    if (n.props.disabled) throw new Error(`Botão desabilitado: ${fragment}`);
    // Handlers da página enviam void; não aguardar a RPC pendente.
    n.props.onClick(); this.render(); await this.flush();
  }
  field(id: string) { return this.nodes().find(n => n.props?.id === id); }
  change(node: any, value: string) {
    node.props.onChange ? node.props.onChange({ target: { value } }) : node.props.onValueChange(value); this.render();
  }
  dialog(title: string) { return this.nodes('dialog').find(n => this.text(n).includes(title)); }
}

class Memory { m = new Map<string,string>();get length(){return this.m.size;}key(i:number){return [...this.m.keys()][i]??null;}getItem(k:string){return this.m.get(k)??null;}setItem(k:string,v:string){this.m.set(k,v);}removeItem(k:string){this.m.delete(k);} }
const uuid = '20000000-0000-4000-8000-000000000001';
const quote = (owner = 7) => ({ contrato:'despesas49_v1',userId:owner,despesaId:10,origemOperationId:uuid,estadoHash:'a'.repeat(64),valor:'1.01',habilitado:true,semMovimentoCaixa:true,modo:'sucessao20',original:{id:10,user_id:owner,descricao:'Original',categoria:'outros',data_vencimento:'2030-01-31',observacoes:null,status:'pendente',data_pagamento:null,conta_caixa_id:null,recorrente:false,frequencia:null} });
let memory:Memory;
const locks = { request: async (_:string,fn:()=>any) => fn() };
const wait = () => { let resolve!:(v:any)=>void;const promise=new Promise<any>(r=>{resolve=r;});return {promise,resolve}; };
beforeEach(()=>{
 vi.stubGlobal('React',React);vi.clearAllMocks();h.capEnabled=true;h.capError=false;h.queryCalls=[];h.user={id:7};memory=new Memory();vi.stubGlobal('window',{sessionStorage:memory});vi.stubGlobal('navigator',{locks});h.quote.mockResolvedValue(quote());h.edit.mockImplementation(()=>new Promise(()=>{}));
});
afterEach(()=>vi.unstubAllGlobals());
describe('UI49 quote/confirmation/session/recovery callbacks',()=>{
 it('quote é owner-confirmada, valor apenas leitura; confirmação salva pedido antes de POST',async()=>{
  const r=new HarnessReact().render();const select=r.nodes('select').find(n=>n.props.id==='edicao49-id');r.change(select,'10');await r.click('Cotar edição');expect(h.quote).toHaveBeenCalledWith({despesaId:10});expect(r.text()).toMatch(/R\$\s+1\.01/) ;
  r.change(r.nodes('input').find(n=>n.props.id==='edicao49-data'),'2030-02-28');r.change(r.nodes('textarea').find(n=>n.props.id==='edicao49-motivo'),'Ajuste de vencimento');await r.click('Confirmar edição');expect(h.edit).toHaveBeenCalledTimes(1);
  const sent=h.edit.mock.calls[0][0];expect(sent.request).not.toHaveProperty('userId');expect(sent.request).not.toHaveProperty('valor');expect(sent.request.dataVencimento).toBe('2030-02-28');expect(JSON.parse(memory.getItem('cobrapro:despesas49:7:pending')!)).toEqual(sent);r.unmount();
 });
 it('quote atrasada A→B→A não altera formulário/mensagem/cache da nova sessão',async()=>{
  const d=wait();h.quote.mockReturnValueOnce(d.promise);const r=new HarnessReact().render();r.change(r.nodes('select')[0],'10');await r.click('Cotar edição');h.user={id:8};r.render();h.user={id:7};r.render();const before=r.writes;
  d.resolve(quote());await r.flush();expect(r.writes).toBe(before);expect(r.text()).not.toContain('Valor preservado: R$');expect(h.invalidate).not.toHaveBeenCalled();r.unmount();
 });
 it('callback POST antigo não fecha UUID nem invalida nova sessão; reload retém original',async()=>{
  const d=wait();h.edit.mockReturnValueOnce(d.promise);const r=new HarnessReact().render();r.change(r.nodes('select')[0],'10');await r.click('Cotar edição');r.change(r.nodes('textarea').find(n=>n.props.id==='edicao49-motivo'),'Ajuste');await r.click('Confirmar edição');const sent=h.edit.mock.calls[0][0];
  h.user={id:8};r.render();const before=r.writes;d.resolve({contrato:'despesas49_v1',success:true,acao:'editarPendente',userId:7,idempotencyKey:sent.idempotencyKey,request:sent.request,operationId:uuid,despesaId:10,sucessoraId:11,sucessoraOperationId:uuid,valor:'1.01',statusOriginal:'cancelado',statusSucessora:'pendente',semMovimentoCaixa:true,instante:'2026-11-24T23:00:00Z'});await r.flush();expect(r.writes).toBe(before);expect(h.invalidate).not.toHaveBeenCalled();expect(memory.getItem('cobrapro:despesas49:7:pending')).not.toBeNull();h.user={id:7};r.render();expect(r.text()).toContain(sent.idempotencyKey);r.unmount();
 });
 it('recovery not_executed com fence exata encerra CAS e guarda recibo; pedido não é reenviado',async()=>{
  const sent={idempotencyKey:uuid,request:{despesaId:10,origemOperationId:uuid,estadoHash:'a'.repeat(64),descricao:'Corrigida',categoria:'outros',dataVencimento:'2030-02-28',observacoes:'',motivo:'Ajuste'}};memory.setItem('cobrapro:despesas49:7:pending',JSON.stringify(sent));
  h.recover.mockResolvedValue({contrato:'despesas49_v1',userId:7,idempotencyKey:uuid,request:sent.request,status:'not_executed',result:null,fence:{fenceId:uuid,instante:'2026-11-24T23:00:00Z'}});const r=new HarnessReact().render();await r.click('Encerrar edição');expect(h.recover).toHaveBeenCalledWith(sent);expect(h.edit).not.toHaveBeenCalled();expect(memory.getItem('cobrapro:despesas49:7:pending')).toBeNull();expect(memory.getItem('cobrapro:despesas49:7:receipt:'+uuid)).toContain('not_executed');r.unmount();
 });
 it('quote de owner divergente e fence sem prova não habilitam sucesso nem descarte',async()=>{
  h.quote.mockResolvedValue(quote(8));const r=new HarnessReact().render();r.change(r.nodes('select')[0],'10');await r.click('Cotar edição');expect(r.text()).toContain('owner/estado divergente');expect(h.edit).not.toHaveBeenCalled();r.unmount();
 });
 it('cache privado muda por sessão inclusive A→B→A sem owner em input RPC',()=>{
  const r=new HarnessReact().render();const first=h.queryCalls.at(-1).queryKeyHashFn(['cap']);h.user={id:8};r.render();const second=h.queryCalls.at(-1).queryKeyHashFn(['cap']);h.user={id:7};r.render();const third=h.queryCalls.at(-1).queryKeyHashFn(['cap']);expect(first).not.toBe(second);expect(first).not.toBe(third);r.unmount();
 });
 it('original20 retido bloqueia nova UUID49 e fica byte-exato',async()=>{
  const key='cobrapro:despesas:0020:v1:user:7:action:pagar';memory.setItem(key,'opaque original20');const r=new HarnessReact().render();expect(r.text()).toContain('Original20/38 retido');expect(r.button('Cotar edição').props.disabled).toBe(true);expect(h.quote).not.toHaveBeenCalled();expect(memory.getItem(key)).toBe('opaque original20');expect(memory.getItem('cobrapro:despesas49:7:pending')).toBeNull();r.unmount();
 });

});

const input49=()=>({idempotencyKey:uuid,request:{despesaId:10,origemOperationId:uuid,estadoHash:'a'.repeat(64),descricao:'Corrigida',categoria:'outros',dataVencimento:'2030-02-28',observacoes:'',motivo:'Ajuste'}});
const receipt49=(sent:any)=>({contrato:'despesas49_v1',success:true,acao:'editarPendente',userId:7,idempotencyKey:sent.idempotencyKey,request:sent.request,operationId:uuid,despesaId:10,sucessoraId:11,sucessoraOperationId:uuid,valor:'1.01',statusOriginal:'cancelado',statusSucessora:'pendente',semMovimentoCaixa:true,instante:'2026-11-24T23:00:00Z'});
const recovery49=(sent:any)=>({contrato:'despesas49_v1',userId:7,idempotencyKey:sent.idempotencyKey,request:sent.request,status:'confirmed',result:receipt49(sent),fence:null});
describe('UI49 callbacks reais com deferredRPC crash/CAS/unmount eOFF',()=>{
 it.each([false,true])('recoveryOFF comcapError=%s confirma e encerra sem writer',async capError=>{
  const sent=input49();memory.setItem('cobrapro:despesas49:7:pending',JSON.stringify(sent));h.capEnabled=false;h.capError=capError;h.recover.mockResolvedValue(recovery49(sent));const r=new HarnessReact().render();expect(r.button('Reenviar pedido').props.disabled).toBe(true);await r.click('Encerrar edição');expect(h.edit).not.toHaveBeenCalled();expect(memory.getItem('cobrapro:despesas49:7:pending')).toBeNull();expect(memory.getItem('cobrapro:despesas49:7:receipt:'+uuid)).toContain('confirmed');r.unmount();
 });
 it.each(['edit','recover'] as const)('callback %s após unmount não escreve estado/cache/receipt nem fecha original',async action=>{
  const sent=input49(),raw=JSON.stringify(sent),d=wait();memory.setItem('cobrapro:despesas49:7:pending',raw);h[action].mockReturnValueOnce(d.promise);const r=new HarnessReact().render();await r.click(action==='edit'?'Reenviar pedido':'Encerrar edição');r.unmount();const writes=r.writes;d.resolve(action==='edit'?receipt49(sent):recovery49(sent));await r.flush();expect(r.writes).toBe(writes);expect(h.invalidate).not.toHaveBeenCalled();expect(memory.getItem('cobrapro:despesas49:7:pending')).toBe(raw);expect(memory.getItem('cobrapro:despesas49:7:receipt:'+uuid)).toBeNull();
 });
 it.each(['edit','recover'] as const)('CAS muda durante callback %s real: não aceita resultado nem invalida nova intenção',async action=>{
  const sent=input49(),d=wait();memory.setItem('cobrapro:despesas49:7:pending',JSON.stringify(sent));h[action].mockReturnValueOnce(d.promise);const r=new HarnessReact().render();await r.click(action==='edit'?'Reenviar pedido':'Encerrar edição');const newer=JSON.stringify({...sent,idempotencyKey:'40000000-0000-4000-8000-000000000001'});memory.setItem('cobrapro:despesas49:7:pending',newer);d.resolve(action==='edit'?receipt49(sent):recovery49(sent));await r.flush();expect(memory.getItem('cobrapro:despesas49:7:pending')).toBe(newer);expect(memory.getItem('cobrapro:despesas49:7:receipt:'+uuid)).toBeNull();expect(h.invalidate).not.toHaveBeenCalled();expect(r.text()).toContain('Preserve pedido');r.unmount();
 });
 it('quota real durante preparação não dispara POST',async()=>{
  const r=new HarnessReact().render();r.change(r.nodes('select')[0],'10');await r.click('Cotar edição');r.change(r.field('edicao49-motivo'),'Ajuste');memory.setItem=()=>{throw Error('quota');};await r.click('Confirmar edição');expect(h.edit).not.toHaveBeenCalled();expect(r.text()).toContain('quota');r.unmount();
 });
 it('remoção silent após recovery real fica failclosed com original e recibo preservados',async()=>{
  const sent=input49(),raw=JSON.stringify(sent);memory.setItem('cobrapro:despesas49:7:pending',raw);h.recover.mockResolvedValue(recovery49(sent));memory.removeItem=()=>{};const r=new HarnessReact().render();await r.click('Encerrar edição');expect(memory.getItem('cobrapro:despesas49:7:pending')).toBe(raw);expect(memory.getItem('cobrapro:despesas49:7:receipt:'+uuid)).toContain('confirmed');expect(r.text()).toContain('Preserve pedido');expect(h.invalidate).not.toHaveBeenCalled();r.unmount();
 });
});
