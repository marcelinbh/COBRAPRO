import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { consultar45, corrigir45, reconciliar45 } from "../../../server/services/caixaManutencao45Rpc";
import { intencaoCaixa45, conferirResultadoCaixa45 } from "../../../shared/caixaManutencao45";
const hash = "a".repeat(64);
const input = { idempotencyKey: "12345678-1234-4234-8234-123456789abc", request: { transacaoId: 42, estadoHash: hash, observacao: "Texto correto", motivo: "Erro de digitação" } };
const result = { regra: "correcao_observacao45_v1", empresaId: 7, idempotencyKey: input.idempotencyKey, transacaoId: 42, request: input.request, operacaoId: "87654321-4321-4321-8321-cba987654321", originalHash: hash, instante: "2026-11-24T17:00:00+00:00" };
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  const schema = vi.fn(() => ({ rpc }));
  return { schema, rpc };
}
describe("Caixa45 correção adicional, sem writer genérico", () => {
 it("envia owner separado e schema45 exato", async () => {
  const c = client(result); expect(await corrigir45(c, 7, input)).toEqual(result);
  expect(c.schema).toHaveBeenCalledTimes(1); expect(c.schema).toHaveBeenCalledWith("public");
  expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.rpc).toHaveBeenCalledWith("rpc_corrigir_observacao45", { p_user_id: 7, p_chave: input.idempotencyKey, p_request: input.request });
 });
 it.each(["userId", "valor", "contaCaixaId", "categoria", "descricao", "contratoId"])("rejeita payload aberto %s sem RPC", async k => {
  const c = client(result); await expect(corrigir45(c,7,{...input,request:{...input.request,[k]:1}} as never)).rejects.toBeDefined();expect(c.rpc).not.toHaveBeenCalled();
 });
 it("rejeita owner, movimento e intenção diferentes na resposta", async () => {
  for(const bad of [{...result,empresaId:8},{...result,transacaoId:43},{...result,request:{...input.request,motivo:"Outra intenção"}},{...result,idempotencyKey:result.operacaoId}]) {
   await expect(corrigir45(client(bad),7,input)).rejects.toBeDefined();
  }
 });
 it("timeout não repete nem cai em REST e mantém input", async () => {
  const rpc=vi.fn(async()=>{throw new Error("timeout após commit");});const c={schema:vi.fn(()=>({rpc}))};
  await expect(corrigir45(c,7,input)).rejects.toThrow(/mesma intenção/);expect(rpc).toHaveBeenCalledTimes(1);expect(input.request.observacao).toBe("Texto correto");
 });
 it("recovery usa mesma intenção mesmo com estadoHash antigo", async () => {
  const c=client({status:"confirmed",result});expect(await reconciliar45(c,7,input)).toEqual({status:"confirmed",result});
  expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.rpc).toHaveBeenCalledWith("rpc_reconciliar_observacao45",{p_user_id:7,p_chave:input.idempotencyKey,p_request:input.request});
 });
 it("ausência só é aceita com fence ligado à empresa e payload", async () => {
  const good={status:"not_executed",empresaId:7,idempotencyKey:input.idempotencyKey,request:input.request};
  expect(await reconciliar45(client(good),7,input)).toEqual(good);
  await expect(reconciliar45(client({...good,empresaId:9}),7,input)).rejects.toThrow();
  await expect(reconciliar45(client({...good,request:{...input.request,motivo:"Diferente"}}),7,input)).rejects.toThrow();
 });
 it("RPC ausente/envelope inválido não confirma nem autoriza fallback", async () => {
  await expect(corrigir45(client(null,{code:"PGRST106"}),7,input)).rejects.toThrow(/não confirmada/);
  const c={schema:()=>({rpc:async()=>({data:result})})};await expect(corrigir45(c as never,7,input)).rejects.toThrow(/Envelope45/);
 });
 it("consulta não aceita cache/prova de outra empresa", async () => {
  const q={regra:result.regra,empresaId:7,transacaoId:42,estadoHash:hash,originalHash:hash,observacaoAtual:"Texto correto",ultimaCorrecao:result,correcoes:1};
  expect(await consultar45(client(q),7,{transacaoId:42})).toEqual(q);
  await expect(consultar45(client({...q,empresaId:8}),7,{transacaoId:42})).rejects.toThrow();
 });
 it("SDK real envia Content-Profile restrito, sem qualquer rede externa", async () => {
  const fetchMock=vi.fn(async (url: RequestInfo | URL,init?:RequestInit)=> {
   expect(String(url)).toBe("https://offline.invalid/rest/v1/rpc/rpc_corrigir_observacao45");
   expect(new Headers(init?.headers).get("content-profile")).toBe("public");
   expect(JSON.parse(String(init?.body))).toEqual({p_user_id:7,p_chave:input.idempotencyKey,p_request:input.request});
   return new Response(JSON.stringify(result),{status:200,headers:{"content-type":"application/json"}});
  });
  const sdk=createClient("https://offline.invalid","synthetic-only",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchMock}});
  expect(await corrigir45(sdk,7,input)).toEqual(result);expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it("preserva forma canônica e rejeita texto de controle",()=> {
  expect(intencaoCaixa45.parse(input)).toEqual(input);
  expect(()=>intencaoCaixa45.parse({...input,request:{...input.request,observacao:"bad\u0001"}})).toThrow();
  expect(()=>conferirResultadoCaixa45({...result,request:{...input.request,estadoHash:"b".repeat(64)}},7,input)).toThrow();
 });
 it("router deriva owner de ctx e remove writer delete antigo do candidato",()=> {
  const router=readFileSync(new URL("../../../server/routers/caixaManutencao45.ts",import.meta.url),"utf8");
  expect(router.match(/ctx.user.id/g)).toHaveLength(3);expect(router).not.toContain("input.user");
  const full=readFileSync(new URL("../../../server/routers.ts",import.meta.url),"utf8");
  const area=full.slice(full.indexOf("removerTransacoesDuplicadasDespesa:"), full.indexOf("\n});",full.indexOf("removerTransacoesDuplicadasDespesa:")));
  expect(area).toContain("bloquearOperacaoFinanceiraNaoAtomica");expect(area).not.toContain(".delete()");expect(area).not.toContain("getSupabase");
 });
 it("UI persiste antes da mutação, restringe escopo e mantém recovery acessível",()=> {
  const ui=readFileSync(new URL("../../../client/src/components/CaixaManutencao45.tsx",import.meta.url),"utf8");
  expect(ui.indexOf("persistirCaixa45(localStorage")).toBeLessThan(ui.indexOf("corrigir.mutateAsync"));
  expect(ui).toContain("Conferir envio");expect(ui).toContain("tenant.current === userId && atual()");expect(ui).toContain("Estorno monetário e exclusão continuam indisponíveis");
 });
});

import { persistirCaixa45, pendenteCaixa45, concluirCaixa45 } from "../../../shared/caixaManutencao45Storage";
describe("journal por UUID45",()=> {
 function memory() { const m=new Map<string,string>();return {get length(){return m.size;},key:(i:number)=>Array.from(m.keys())[i]??null,getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);}}; }
 it("sobrevive reload e duas abas sem perder intenção anterior",()=> {
  const s=memory(),other={...input,idempotencyKey:"22345678-1234-4234-8234-123456789abc"};
  persistirCaixa45(s,7,input);persistirCaixa45(s,7,other);expect(s.length).toBe(2);expect(pendenteCaixa45(s,7)).toEqual(input);
  concluirCaixa45(s,7,input,{status:"confirmed",result});expect(pendenteCaixa45(s,7)).toEqual(other);expect(pendenteCaixa45(s,8)).toBeNull();
 });
 it("não sobrescreve o mesmo UUID com payload diferente",()=> {
  const s=memory();persistirCaixa45(s,7,input);expect(()=>persistirCaixa45(s,7,{...input,request:{...input.request,motivo:"Outra intenção"}})).toThrow();expect(pendenteCaixa45(s,7)).toEqual(input);
 });
 it("armazenamento ausente ou corrompido bloqueia novo envio",()=> {
  const s=memory();s.setItem("cobrapro:caixa45:pendente:7:bad","{}");expect(()=>pendenteCaixa45(s,7)).toThrow();
  const bad={...memory(),setItem:()=>{throw new Error("Quota");}};expect(()=>persistirCaixa45(bad,7,input)).toThrow();
 });
});
