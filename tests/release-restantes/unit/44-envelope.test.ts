import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { cotarCalendario44, manterCalendario44 } from "../../../server/services/manutencaoEmprestimos";
const intent={contratoId:1001,idempotencyKey:"10000000-0000-4000-8000-000000000044",estadoHash:"a".repeat(64),vencimentos:["2030-01-10","2030-02-10"],motivo:"Ajuste auditado"};
const result={success:true,repetida:false,operationId:"20000000-0000-4000-8000-000000000044",idempotencyKey:intent.idempotencyKey,contratoId:intent.contratoId,vencimentos:intent.vencimentos,regra:"calendario_mensal_sem_baixa_v1"};
beforeEach(()=>vi.stubEnv("ENABLE_MANUTENCAO_EMPRESTIMOS_0044","true"));afterEach(()=>vi.unstubAllEnvs());
it.each(["cotar","executar","conferir"] as const)("SDK real monta /rest/v1/rpc/%s44 no public padrão, sem namespace privado nem fallback",async action=>{
 const response=action==="cotar"?{contratoId:1001,estadoHash:intent.estadoHash,regra:result.regra,parcelasIds:[3,4],vencimentos:intent.vencimentos}:action==="executar"?result:{...intent,status:"fenced",regra:"calendario44_fence_v1"};
 const calls:{url:string;init:RequestInit}[]=[];
 // Fetch injetado terminal: NENHUM socket/DNS/HTTP é aberto; URL e token são sintéticos.
 const client=createClient("https://offline.invalid","synthetic-service-key-not-a-credential",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{calls.push({url:String(input),init:init!});return new Response(JSON.stringify(response),{status:200,headers:{"Content-Type":"application/json"}});}}});
 if(action==="cotar")await cotarCalendario44(client,77,{contratoId:1001});else await manterCalendario44(client,77,intent,action==="conferir");
 expect(calls).toHaveLength(1);const call=calls[0];expect(call.url).toBe(`https://offline.invalid/rest/v1/rpc/rpc_${action}_calendario44`);expect(call.init.method).toBe("POST");
 const headers=new Headers(call.init.headers);expect(headers.get("Content-Profile")).toBe("public");expect(headers.get("Authorization")).toBe("Bearer synthetic-service-key-not-a-credential");
 expect(JSON.parse(String(call.init.body))).toEqual(action==="cotar"?{p_user_id:77,p_contrato_id:1001}:{p_user_id:77,p_chave_idempotencia:intent.idempotencyKey,p_contrato_id:1001,p_estado_hash:intent.estadoHash,p_vencimentos:intent.vencimentos,p_motivo:intent.motivo});
});
