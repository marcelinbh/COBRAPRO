import { describe, expect, it } from "vitest";
import { encerrarJournal44 } from "../../../shared/calendario44Journal";
const intent={ contratoId:1001,idempotencyKey:"10000000-0000-4000-8000-000000000044",estadoHash:"a".repeat(64),vencimentos:["2030-01-10","2030-02-10"],motivo:"Ajuste auditado" };
const fence={...intent,status:"fenced",regra:"calendario44_fence_v1"};
const confirmed={status:"confirmed",sameIntentOnly:true,resultado:{success:true,repetida:false,operationId:"20000000-0000-4000-8000-000000000044",idempotencyKey:intent.idempotencyKey,contratoId:intent.contratoId,vencimentos:intent.vencimentos,regra:"calendario_mensal_sem_baixa_v1"}};
const key="cobrapro:calendario44:77:1001",archiveKey=`${key}:closed:${intent.idempotencyKey}`;
function disk(){const data=new Map([[key,JSON.stringify(intent)]]),events:string[]=[];return {data,events,getItem:(k:string)=>{events.push(`get:${k}`);return data.get(k)??null;},setItem:(k:string,v:string)=>{events.push(`set:${k}`);data.set(k,v);},removeItem:(k:string)=>{events.push(`remove:${k}`);data.delete(k);}};}
describe("journal44 — closure só com prova durável do servidor, sem reset",()=>{
 it.each([fence,confirmed])("arquiva prova terminal com read-back ANTES de retirar pendência",terminal=>{
  const s=disk();expect(encerrarJournal44(s,key,intent,terminal)).toEqual(terminal);
  expect(s.data.has(key)).toBe(false);expect(JSON.parse(s.data.get(archiveKey)!)).toEqual({intent,closure:terminal});
  const set=s.events.indexOf(`set:${archiveKey}`),remove=s.events.indexOf(`remove:${key}`);
  expect(set).toBeLessThan(remove);expect(s.events.slice(set+1,remove)).toContain(`get:${archiveKey}`);
 });
 it.each([{status:"not_found",sameIntentOnly:true},null,{status:"unknown"},{...fence,estadoHash:"b".repeat(64)},{...fence,motivo:"Motivo divergente"},{...fence,contratoId:2},{...fence,idempotencyKey:confirmed.resultado.operationId}])("resposta ausente/divergente nunca permite remover journal",terminal=>{
  const s=disk();expect(()=>encerrarJournal44(s,key,intent,terminal)).toThrow();expect(s.data.get(key)).toBe(JSON.stringify(intent));expect(s.data.size).toBe(1);
 });
 it("falha de armazenamento de prova terminal mantém intenção e UUID originais",()=>{
  const s=disk();s.setItem=()=>{};expect(()=>encerrarJournal44(s,key,intent,fence)).toThrow(/não persistiu/);expect(s.data.get(key)).toBe(JSON.stringify(intent));
 });
 it("aba rival alterou journal: não sobrescreve nem remove",()=>{
  const s=disk();const rival={...intent,motivo:"Outra aba"};s.data.set(key,JSON.stringify(rival));expect(()=>encerrarJournal44(s,key,intent,fence)).toThrow(/alterado/);expect(s.data.get(key)).toBe(JSON.stringify(rival));
 });
 it("arquivo terminal conflitante não pode ser substituído",()=>{
  const s=disk();s.data.set(archiveKey,"proof-other");expect(()=>encerrarJournal44(s,key,intent,fence)).toThrow(/divergente/);expect(s.data.get(key)).toBe(JSON.stringify(intent));expect(s.data.get(archiveKey)).toBe("proof-other");
 });
 it("após falha de remoção, repetir a MESMA prova terminal é idempotente",()=>{
  const s=disk();const remove=s.removeItem;s.removeItem=()=>{};expect(()=>encerrarJournal44(s,key,intent,fence)).toThrow(/permanece/);
  expect(s.data.has(archiveKey)).toBe(true);s.removeItem=remove;expect(encerrarJournal44(s,key,intent,fence)).toEqual(fence);expect(s.data.has(key)).toBe(false);
 });
});
