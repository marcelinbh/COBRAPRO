import { describe, expect, it, vi } from 'vitest';
import { Despesas49Journal, type Locks49 } from './despesas49Journal';
const request = { despesaId: 10, origemOperationId: '20000000-0000-4000-8000-000000000001', estadoHash: 'a'.repeat(64), descricao: 'Editada', categoria: 'outros', dataVencimento: '2030-02-28', observacoes: '', motivo: 'Corrigir' };
class Memory {
  m = new Map<string, string>();getItem(k: string) { return this.m.get(k) ?? null; }setItem(k: string, v: string) { this.m.set(k, v); }removeItem(k: string) { this.m.delete(k); }
}
class Locks implements Locks49 {
  tail = new Map<string, Promise<unknown>>();
  request<T>(k: string, fn: () => T | PromiseLike<T>): Promise<T> { const next = (this.tail.get(k) ?? Promise.resolve()).then(fn);this.tail.set(k, next.catch(() => {}));return next; }
}
const proof = (j: any, owner = 7) => ({ contrato: 'despesas49_v1' as const, userId: owner, idempotencyKey: j.input.idempotencyKey, request: j.input.request, status: 'not_executed' as const, result: null, fence: { fenceId: '30000000-0000-4000-8000-000000000001', instante: '2026-11-24T23:00:00Z' } });
describe('journal49 Web Locks/CAS/session', () => {
  it('duplo clique/duas instâncias geram uma UUID; reload preserva pedido original', async () => {
    const m = new Memory(), l = new Locks(), a = new Despesas49Journal(7, m, l, () => true), b = new Despesas49Journal(7, m, l, () => true);
    const r = await Promise.allSettled([a.prepare(request), b.prepare(request)]);expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(1);expect(b.read()).toEqual(a.read());
    await expect(b.prepare({ ...request, motivo: 'Outra intenção' })).rejects.toThrow('original pendente');
  });
  it('sem locks ou storage falha fechada; nunca UUID sem persistência', async () => {
    const m = new Memory();await expect(new Despesas49Journal(7, m, undefined, () => true).prepare(request)).rejects.toThrow('Web Locks');expect(m.m.size).toBe(0);
    await expect(new Despesas49Journal(7, null, new Locks(), () => true).prepare(request)).rejects.toThrow('Persistência');
  });
  it('lock cobre callback RPC e CAS; outra instância espera sem preparar pedido concorrente', async () => {
    const m = new Memory(), l = new Locks(), a = new Despesas49Journal(7, m, l, () => true);const j = await a.prepare(request);let release!: () => void;const deferred = new Promise<void>(r => { release = r; });let callback = false;
    const run = a.run(j, async () => { callback = true;await deferred;return a.closeInsideLock(j, proof(j)); });await Promise.resolve();expect(callback).toBe(true);
    let prepared = false;const next = a.prepare({ ...request, descricao: 'Seguinte' }).then(r => { prepared = true;return r; });await Promise.resolve();expect(prepared).toBe(false);release();expect(await run).toBe(true);expect((await next).input.idempotencyKey).not.toBe(j.input.idempotencyKey);
  });
  it('callback antigo A→B→A não fecha, não lê owner alheio, preserva UUID antiga', async () => {
    const m = new Memory(), l = new Locks();let session = {};const captured = session;const a = new Despesas49Journal(7, m, l, () => captured === session);const j = await a.prepare(request);session = {};
    expect(a.closeInsideLock(j, proof(j))).toBe(false);expect(a.read()!.raw).toBe(j.raw);expect(new Despesas49Journal(8, m, l, () => true).read()).toBeNull();
    await expect(a.run(j, async () => true)).rejects.toThrow('sessão49 mudou');
  });
  it('CAS não apaga UUID/pedido substituído; só prova terminal exata pode guardar recibo e encerrar', async () => {
    const m = new Memory(), l = new Locks(), a = new Despesas49Journal(7, m, l, () => true);const j = await a.prepare(request);
    await expect(a.run(j, async () => a.closeInsideLock(j, { ...proof(j), userId: 8 }))).rejects.toThrow('owner');expect(a.read()).toEqual(j);
    const newer = j.raw.replace('Editada', 'Nova');m.setItem(j.key, newer);expect(a.closeInsideLock(j, proof(j))).toBe(false);expect(m.getItem(j.key)).toBe(newer);
    m.setItem(j.key, j.raw);expect(await a.run(j, async () => a.closeInsideLock(j, proof(j)))).toBe(true);expect(a.read()).toBeNull();expect(m.getItem(`cobrapro:despesas49:7:receipt:${j.input.idempotencyKey}`)).toContain('not_executed');
  });
});

describe('journal49 crash/storage faults reais', () => {
 it.each(['quota','silentdrop','writeThenThrow'])('prepare %s nunca chama POST e preserva bytes quando gravados',async mode=>{
  const m=new Memory(),a=new Despesas49Journal(7,m,new Locks(),()=>true);let rpc=0;
  m.setItem=(k,v)=>{if(mode==='quota')throw Error('quota');if(mode==='silentdrop')return;m.m.set(k,v);throw Error('writeThenThrow');};
  await expect(a.prepare(request).then(j=>a.run(j,async()=>{rpc++;}))).rejects.toThrow();expect(rpc).toBe(0);
  if(mode==='writeThenThrow'){expect(a.read()!.input.request).toEqual(request);await expect(a.prepare(request)).rejects.toThrow('original pendente');}
 });
 it.each(['quotaReceipt','silentReceipt','receiptWriteThenThrow','removeThrow','removeSilent','removeThenThrow'])('close %s nunca informa closure concluída sem prova de remoção',async mode=>{
  const m=new Memory(),a=new Despesas49Journal(7,m,new Locks(),()=>true),j=await a.prepare(request);
  const originalSet=m.setItem.bind(m);m.setItem=(k,v)=>{if(k.includes(':receipt:')){if(mode==='quotaReceipt')throw Error('quota');if(mode==='silentReceipt')return;originalSet(k,v);if(mode==='receiptWriteThenThrow')throw Error('after');}else originalSet(k,v);};
  m.removeItem=k=>{if(mode==='removeThrow')throw Error('remove');if(mode==='removeSilent')return;m.m.delete(k);if(mode==='removeThenThrow')throw Error('after remove');};
  await expect(a.run(j,async()=>a.closeInsideLock(j,proof(j)))).rejects.toThrow();
  if(mode!=='removeThenThrow')expect(m.getItem(j.key)).toBe(j.raw);else expect(m.getItem(`cobrapro:despesas49:7:receipt:${j.input.idempotencyKey}`)).toContain('not_executed');
 });
 it('crash após preparar antesPOST e apósPOST sem resposta: reload mesma UUID, nunca substituta',async()=>{
  const m=new Memory(),l=new Locks(),a=new Despesas49Journal(7,m,l,()=>true),j=await a.prepare(request),reload=new Despesas49Journal(7,m,l,()=>true);
  expect(reload.read()).toEqual(j);await expect(a.run(j,async()=>{throw Error('response lost');})).rejects.toThrow('response lost');expect(reload.read()).toEqual(j);await expect(reload.prepare(request)).rejects.toThrow('original pendente');
 });
});


describe('hotfix49 prova terminal durável e request antes de UUID',()=>{
 it('validação rejeita data civil/motivo antes de randomUUID e persistência',async()=>{
  const uuid=vi.spyOn(crypto,'randomUUID'),m=new Memory(),a=new Despesas49Journal(7,m,new Locks(),()=>true);
  try { await expect(a.prepare({...request,dataVencimento:'2030-02-30'})).rejects.toThrow();await expect(a.prepare({...request,motivo:''})).rejects.toThrow();expect(uuid).not.toHaveBeenCalled();expect(m.m.size).toBe(0); }
  finally {uuid.mockRestore();}
 });
 it('conferir not_executed conserva pending e prova exata, reload lê fence sem reenviar/fechar',async()=>{
  const m=new Memory(),l=new Locks(),a=new Despesas49Journal(7,m,l,()=>true),j=await a.prepare(request),p=proof(j);
  await a.run(j,async()=>a.saveProofInsideLock(j,p));expect(a.read()!.raw).toBe(j.raw);
  const reload=new Despesas49Journal(7,m,l,()=>true);expect(reload.readProof(reload.read()!)).toEqual(p);expect(m.getItem(j.key)).toBe(j.raw);expect(m.m.size).toBe(2);
  expect(await reload.run(j,async()=>reload.closeInsideLock(j,p))).toBe(true);expect(m.getItem(j.key)).toBeNull();expect(m.getItem(`cobrapro:despesas49:7:receipt:${j.input.idempotencyKey}`)).toContain('not_executed');
 });
 it('prova de outro owner ou pedido divergente nunca autoriza leitura terminal/closure',async()=>{
  const m=new Memory(),a=new Despesas49Journal(7,m,new Locks(),()=>true),j=await a.prepare(request),k=`cobrapro:despesas49:7:receipt:${j.input.idempotencyKey}`;
  m.setItem(k,JSON.stringify({input:j.input,proof:proof(j,8)}));expect(()=>a.readProof(j)).toThrow('owner');expect(m.getItem(j.key)).toBe(j.raw);
  m.setItem(k,JSON.stringify({input:{...j.input,request:{...request,motivo:'Divergente'}},proof:proof(j)}));expect(()=>a.readProof(j)).toThrow('divergente');expect(m.getItem(j.key)).toBe(j.raw);
 });
 it('falha write-then-throw ao salvar prova conserva fence e head exatos no reload',async()=>{
  const m=new Memory(),l=new Locks(),a=new Despesas49Journal(7,m,l,()=>true),j=await a.prepare(request);const set=m.setItem.bind(m);
  m.setItem=(k,v)=>{set(k,v);throw Error('after receipt write');};await expect(a.run(j,async()=>a.saveProofInsideLock(j,proof(j)))).rejects.toThrow('after receipt');expect(m.getItem(j.key)).toBe(j.raw);
  expect(new Despesas49Journal(7,m,l,()=>true).readProof(j)).toEqual(proof(j));
 });
});
