import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {enviarIntencao43,recuperarIntencao43} from '../../../shared/reparcelamento43Fluxo';
import {lerIntencao43,guardarIntencao43} from '../../../shared/reparcelamento43Intencao';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/synthetic-roundtrip43.json',import.meta.url),'utf8'));
const input={...fixture.q.request,estadoHash:fixture.q.estadoHash,cotacaoHash:fixture.q.cotacaoHash,idempotencyKey:fixture.k};
const result=fixture.r;
const store=()=>{const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};};
describe('UI43 durable intent real-PG contract',()=>{
 it('persiste e confirma readback do payload fechado antes de chamar a rede uma vez',async()=>{
  const s=store();const send=vi.fn(async(value)=>{expect(lerIntencao43(s,1)).toEqual(input);expect(value).toEqual(input);return result;});
  expect(await enviarIntencao43(s,1,input,()=>true,send)).toEqual(result);expect(send).toHaveBeenCalledTimes(1);expect(lerIntencao43(s,1)).toBeNull();
 });
 it('storage/quota failure blocks network',async()=>{const send=vi.fn();const s={...store(),setItem:()=>{throw Error('quota');}};await expect(enviarIntencao43(s,1,input,()=>true,send)).rejects.toThrow('quota');expect(send).not.toHaveBeenCalled();});
 it('timeout preserva a mesma UUID e impede nova intenção, sem retry oculto',async()=>{
  const s=store(),send=vi.fn().mockRejectedValue(Error('timeout'));await expect(enviarIntencao43(s,1,input,()=>true,send)).rejects.toThrow('timeout');expect(lerIntencao43(s,1)).toEqual(input);
  await expect(enviarIntencao43(s,1,{...input,idempotencyKey:randomUUID()},()=>true,send)).rejects.toThrow();expect(send).toHaveBeenCalledTimes(1);
 });
 it('troca de tenant durante envio não publica nem limpa intenção do owner anterior',async()=>{
  const s=store();let current=true;const send=vi.fn(async()=>{current=false;return result;});await expect(enviarIntencao43(s,1,input,()=>current,send)).rejects.toThrow('sessão anterior');expect(lerIntencao43(s,1)).toEqual(input);expect(lerIntencao43(s,2)).toBeNull();
 });
 it('resposta malformada não limpa a intenção mesmo em status success',async()=>{const s=store();await expect(enviarIntencao43(s,1,input,()=>true,async()=>({...result,userId:2}))).rejects.toThrow();expect(lerIntencao43(s,1)).toEqual(input);});
 it('recovery confirmed limpa somente confirmação vinculada',async()=>{const s=store();guardarIntencao43(s,1,input);const recover=vi.fn(async(value)=>{expect(value).toEqual(input);return {status:'confirmed' as const,result};});expect((await recuperarIntencao43(s,1,()=>true,recover)).status).toBe('confirmed');expect(lerIntencao43(s,1)).toBeNull();});
 it('fence durável not_executed permite corrigir somente a UUID exata',async()=>{const s=store();guardarIntencao43(s,1,input);await expect(recuperarIntencao43(s,1,()=>true,async()=>({status:'not_executed',idempotencyKey:randomUUID()}))).rejects.toThrow();expect(lerIntencao43(s,1)).toEqual(input);expect((await recuperarIntencao43(s,1,()=>true,async()=>({status:'not_executed',idempotencyKey:input.idempotencyKey}))).status).toBe('not_executed');expect(lerIntencao43(s,1)).toBeNull();});
 it('sessão divergente bloqueia envio/recovery antes de rede',async()=>{const s=store(),send=vi.fn();await expect(enviarIntencao43(s,1,input,()=>false,send)).rejects.toThrow();await expect(recuperarIntencao43(s,1,()=>false,send)).rejects.toThrow();expect(send).not.toHaveBeenCalled();});
 it('UI usa conta metadata por empresa, nenhuma listagem global como autorização, e renderiza recebimento existente',()=>{
  const ui=readFileSync(new URL('../../../client/src/pages/Reparcelamento.tsx',import.meta.url),'utf8');expect(ui).toContain('trpc.caixa.contasParaOperacao37.useQuery');expect(ui).toContain('accounts.data?.empresaId===owner');expect(ui).not.toContain('trpc.caixa.contas.useQuery');expect(ui).not.toContain('parseFloat');expect(ui).toContain('RecebimentoValidado');expect(ui).toContain('permitirRenovacao={false}');expect(ui).toContain('q.parcelas.map');expect(ui).toContain('enviarIntencao43');expect(ui).toContain('recuperarIntencao43');
 });
 it('router integrado registra43 e remove preview REST antigo',()=>{const source=readFileSync(new URL('../../../server/routers.ts',import.meta.url),'utf8');expect(source).toContain('reparcelamento: reparcelamento43Router,');expect(source).not.toContain('const reparcelamentoRouter = router({');});
});
