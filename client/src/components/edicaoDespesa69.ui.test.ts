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
 despesas69: {
 capacidades: { useQuery: (_: any, options: any) => { h.queryCalls.push(options);return { data: { habilitado: h.capEnabled }, isError: h.capError, refetch: h.read }; } },
 cotar: { useMutation: () => ({ mutateAsync: h.quote }) }, editar: { useMutation: () => ({ mutateAsync: h.edit }) }, recuperar: { useMutation: () => ({ mutateAsync: h.recover }) },
 },
} }));
import EdicaoDespesa69 from './EdicaoDespesa69';
class HarnessReact {
  values: any[] = []; deps: any[] = []; cleanups: any[] = []; effects: any[] = [];
  cursor = 0; dirty = true; tree: any; writes = 0; frames: any[] = [];
  render() {
    let n = 0;
    do {
      this.dirty = false; this.cursor = 0; h.current = this; this.tree = EdicaoDespesa69({ userId: h.user.id, itens: [{ id: 10, descricao: "Despesa do owner atual", podePagar: true }] }); this.frames.push(this.tree);
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
const quote = (owner = 7) => ({ contrato:'despesas69_v1',habilitado:true,somenteEstaOcorrencia:true,quote49:{contrato:'despesas49_v1',userId:owner,despesaId:10,origemOperationId:uuid,estadoHash:'a'.repeat(64),valor:'1.01',habilitado:false,semMovimentoCaixa:true,modo:'sucessao20',original:{id:10,user_id:owner,descricao:'Original',categoria:'outros',data_vencimento:'2030-01-31',observacoes:null,valor:1.01,status:'pendente',data_pagamento:null,conta_caixa_id:null,recorrente:false,frequencia:null}} });
let memory:Memory;
const locks = { request: async (_:string,fn:()=>any) => fn() };
const wait = () => { let resolve!:(v:any)=>void;const promise=new Promise<any>(r=>{resolve=r;});return {promise,resolve}; };
beforeEach(()=>{
 vi.stubGlobal('React',React);vi.clearAllMocks();h.capEnabled=true;h.capError=false;h.queryCalls=[];h.user={id:7};memory=new Memory();vi.stubGlobal('window',{sessionStorage:memory});vi.stubGlobal('navigator',{locks});h.quote.mockResolvedValue(quote());h.edit.mockImplementation(()=>new Promise(()=>{}));
});
afterEach(()=>vi.unstubAllGlobals());

const sent=()=>({idempotencyKey:uuid,request:{despesaId:10,origemOperationId:uuid,estadoHash:'a'.repeat(64),descricao:'Original',categoria:'outros',dataVencimento:'2030-01-31',observacoes:'',motivo:'Ajuste',valor:'2.01'}});
const receipt=(i:any)=>({contrato:'despesas69_v1',success:true,acao:'editarPendenteComValor',userId:7,idempotencyKey:i.idempotencyKey,request:i.request,operationId:uuid,despesaId:10,raizId:10,sucessoraId:11,sucessoraOperationId:uuid,valorAnterior:'1.01',valorNovo:i.request.valor,statusOriginal:'cancelado',statusSucessora:'pendente',semMovimentoCaixa:true,somenteEstaOcorrencia:true,instante:'2026-11-24T23:00:00Z'});
const recovery=(i:any,status='confirmed')=>({contrato:'despesas69_v1',userId:7,idempotencyKey:i.idempotencyKey,request:i.request,status,result:status==='confirmed'?receipt(i):null,fence:status==='confirmed'?null:{fenceId:uuid,instante:'2026-11-24T23:00:00Z'}});
async function form(r:HarnessReact){r.change(r.field('edicao69-id'),'10');await r.click('Cotar edição69');r.change(r.field('edicao69-motivo'),'Ajuste');}
describe('UI69 valor/session/recovery funcional',()=>{
 it('apenas motivo não prepara UUID; apenas valor cria uma intenção exata antesPOST',async()=>{
  const r=new HarnessReact().render();await form(r);expect(r.button('Confirmar substituição').props.disabled).toBe(true);expect(memory.m.size).toBe(0);
  r.change(r.field('edicao69-valor'),'2.01');await r.click('Confirmar substituição');expect(h.edit).toHaveBeenCalledTimes(1);const i=h.edit.mock.calls[0][0];expect(i.request.valor).toBe('2.01');expect(i.request).not.toHaveProperty('userId');expect(JSON.parse(memory.getItem('cobrapro:despesas69:7:pending')!)).toEqual(i);r.unmount();
 });
 it('quote falha é recuperável sem UUID e formulário inválido pode ser corrigido',async()=>{
  h.quote.mockRejectedValueOnce(Error('timeout'));const r=new HarnessReact().render();r.change(r.field('edicao69-id'),'10');await r.click('Cotar edição69');expect(r.button('Cotar edição69').props.disabled).toBe(false);expect(memory.m.size).toBe(0);await r.click('Cotar edição69');r.change(r.field('edicao69-motivo'),'Ajuste');r.change(r.field('edicao69-valor'),'1.001');expect(r.button('Confirmar substituição').props.disabled).toBe(true);r.change(r.field('edicao69-valor'),'2.01');expect(r.button('Confirmar substituição').props.disabled).toBe(false);r.unmount();
 });
 it('writeThenThrow descobre pedido persistido imediatamente, mostra recovery e nãoPOST',async()=>{
  const r=new HarnessReact().render();await form(r);r.change(r.field('edicao69-valor'),'2.01');const set=memory.setItem.bind(memory);memory.setItem=(k,v)=>{set(k,v);throw Error('after write');};await r.click('Confirmar substituição');expect(h.edit).not.toHaveBeenCalled();expect(r.text()).toContain('UUID original69:');expect(r.button('Conferir UUID').props.disabled).toBe(false);r.unmount();
 });
 it('erro genérico não bloqueia retryEXATO; fence terminal impede POST tardio',async()=>{
  const i=sent();memory.setItem('cobrapro:despesas69:7:pending',JSON.stringify(i));h.edit.mockRejectedValue(Error('lost'));const r=new HarnessReact().render();await r.click('Reenviar pedido');expect(r.button('Reenviar pedido').props.disabled).toBe(false);await r.click('Reenviar pedido');expect(h.edit.mock.calls).toEqual([[i],[i]]);h.recover.mockResolvedValue(recovery(i,'not_executed'));await r.click('Conferir UUID');expect(r.button('Reenviar pedido').props.disabled).toBe(true);await r.click('Encerrar69');expect(memory.getItem('cobrapro:despesas69:7:pending')).toBeNull();expect(memory.getItem('cobrapro:despesas69:7:receipt:'+uuid)).toContain('not_executed');r.unmount();
 });
 it.each([false,true])('recoveryOFF/erro%s continua disponível semPOST',async error=>{
  const i=sent();memory.setItem('cobrapro:despesas69:7:pending',JSON.stringify(i));h.capEnabled=false;h.capError=error;h.recover.mockResolvedValue(recovery(i));const r=new HarnessReact().render();await r.click('Encerrar69');expect(h.edit).not.toHaveBeenCalled();expect(memory.getItem('cobrapro:despesas69:7:pending')).toBeNull();r.unmount();
 });
 it.each(['edit','recover'] as const)('callback%s A→B→A não altera nova sessão/cache/closure',async action=>{
  const i=sent(),raw=JSON.stringify(i),d=wait();memory.setItem('cobrapro:despesas69:7:pending',raw);h[action].mockReturnValueOnce(d.promise);const r=new HarnessReact().render();await r.click(action==='edit'?'Reenviar pedido':'Encerrar69');h.user={id:8};r.render();h.user={id:7};r.render();const writes=r.writes;d.resolve(action==='edit'?receipt(i):recovery(i));await r.flush();expect(r.writes).toBe(writes);expect(h.invalidate).not.toHaveBeenCalled();expect(memory.getItem('cobrapro:despesas69:7:pending')).toBe(raw);expect(memory.getItem('cobrapro:despesas69:7:receipt:'+uuid)).toBeNull();r.unmount();
 });
 it.each(['edit','recover'] as const)('callback%s apósunmount preserva original sem efeitos',async action=>{
  const i=sent(),raw=JSON.stringify(i),d=wait();memory.setItem('cobrapro:despesas69:7:pending',raw);h[action].mockReturnValueOnce(d.promise);const r=new HarnessReact().render();await r.click(action==='edit'?'Reenviar pedido':'Encerrar69');r.unmount();const writes=r.writes;d.resolve(action==='edit'?receipt(i):recovery(i));await r.flush();expect(r.writes).toBe(writes);expect(h.invalidate).not.toHaveBeenCalled();expect(memory.getItem('cobrapro:despesas69:7:pending')).toBe(raw);
 });
 it('CAS alterado durante recovery não apaga outraUUID e não invalida leitura',async()=>{
  const i=sent(),d=wait();memory.setItem('cobrapro:despesas69:7:pending',JSON.stringify(i));h.recover.mockReturnValueOnce(d.promise);const r=new HarnessReact().render();await r.click('Encerrar69');const newer=JSON.stringify({...i,idempotencyKey:'40000000-0000-4000-8000-000000000001'});memory.setItem('cobrapro:despesas69:7:pending',newer);d.resolve(recovery(i));await r.flush();expect(memory.getItem('cobrapro:despesas69:7:pending')).toBe(newer);expect(h.invalidate).not.toHaveBeenCalled();r.unmount();
 });
 it('falha de leitura após confirmação não vira erro financeiro nem permite segundoPOST',async()=>{
  const i=sent();memory.setItem('cobrapro:despesas69:7:pending',JSON.stringify(i));h.edit.mockResolvedValue(receipt(i));h.invalidate.mockRejectedValue(Error('read failed'));const r=new HarnessReact().render();await r.click('Reenviar pedido');expect(h.edit).toHaveBeenCalledTimes(1);expect(r.text()).toContain('Operação confirmada; leitura não atualizada');expect(r.button('Reenviar pedido').props.disabled).toBe(true);r.unmount();
 });
});
