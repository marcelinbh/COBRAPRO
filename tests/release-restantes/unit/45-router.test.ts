import { beforeEach, describe, it, expect, vi } from "vitest";
const h=vi.hoisted(()=>({db:vi.fn(),rpc:vi.fn(),schema:vi.fn()}));
vi.mock("../../../server/db",()=>({getSupabaseClientAsync:h.db}));
import { router } from "../../../server/_core/trpc";
import { caixaManutencao45Procedures } from "../../../server/routers/caixaManutencao45";
const app=router(caixaManutencao45Procedures);
const hash="a".repeat(64),key="12345678-1234-4234-8234-123456789abc";
const input={idempotencyKey:key,request:{transacaoId:42,estadoHash:hash,observacao:"Correta",motivo:"Digitação"}};
const result={regra:"correcao_observacao45_v1",empresaId:7,idempotencyKey:key,transacaoId:42,request:input.request,operacaoId:"87654321-4321-4321-8321-cba987654321",originalHash:hash,instante:"2026-11-24T17:00:00+00:00"};
const caller=(user:unknown={id:7})=>app.createCaller({user,req:{},res:{}} as never);
beforeEach(()=>{vi.clearAllMocks();h.schema.mockReturnValue({rpc:h.rpc});h.db.mockResolvedValue({schema:h.schema});h.rpc.mockResolvedValue({data:result,error:null});});
describe("tRPC45 real, DB inteiramente substituído sem configuração/rede",()=>{
 it.each(["corrigirObservacao45","reconciliarObservacao45"] as const)("%s não autenticado recusa antes DB",async name=>{
  await expect(caller(null)[name](input)).rejects.toMatchObject({code:"UNAUTHORIZED"});expect(h.db).not.toHaveBeenCalled();
 });
 it("consulta não autenticada recusa antes DB",async()=>{
  await expect(caller(null).consultarObservacao45({transacaoId:42})).rejects.toMatchObject({code:"UNAUTHORIZED"});expect(h.db).not.toHaveBeenCalled();
 });
 it("deriva owner somente do contexto e executa uma RPC schema45",async()=>{
  expect(await caller().corrigirObservacao45(input)).toEqual(result);expect(h.db).toHaveBeenCalledTimes(1);expect(h.rpc).toHaveBeenCalledTimes(1);
  expect(h.rpc).toHaveBeenCalledWith("rpc_corrigir_observacao45",{p_user_id:7,p_chave:key,p_request:input.request});expect(h.schema).toHaveBeenCalledWith("public");
 });
 it.each(["userId","empresaId","p_user_id","owner"])("campo %s rejeitado antes getter",async key=>{
  await expect(caller().corrigirObservacao45({...input,[key]:9})).rejects.toMatchObject({code:"BAD_REQUEST"});expect(h.db).not.toHaveBeenCalled();expect(h.rpc).not.toHaveBeenCalled();
 });
 it("RPC indisponível não vira success nem writer alternativo",async()=>{
  h.db.mockResolvedValue(null);await expect(caller().corrigirObservacao45(input)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});expect(h.rpc).not.toHaveBeenCalled();
 });
});
