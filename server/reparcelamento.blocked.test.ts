import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const db=vi.hoisted(()=>({getSupabaseClientAsync:vi.fn(),getDb:vi.fn(),resetDb:vi.fn()}));
vi.mock("./db",()=>db);
import { appRouter } from "./routers";
const fixture=JSON.parse(readFileSync(new URL("../tests/release-restantes/fixtures/synthetic-roundtrip43.json",import.meta.url),"utf8"));
const input={...fixture.q.request,estadoHash:fixture.q.estadoHash,cotacaoHash:fixture.q.cotacaoHash,idempotencyKey:fixture.k};
const caller=()=>appRouter.createCaller({user:{id:1},req:{headers:{}},res:{}} as never);
beforeEach(()=>vi.resetAllMocks());
describe("reparcelamento43 integrado sem writer legado",()=>{
 it("recusa payload legado incompleto antes de obter o banco",async()=>{
  await expect(caller().reparcelamento.executar({contratoId:1,numeroParcelas:2,taxaJuros:5,tipoTaxa:"mensal",dataInicio:"2026-10-28",incluirMultas:true} as never)).rejects.toMatchObject({code:"BAD_REQUEST"});
  expect(db.getSupabaseClientAsync).not.toHaveBeenCalled();expect(db.getDb).not.toHaveBeenCalled();
 });
 it("encaminha intenção fechada somente à RPC43 com owner da sessão",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:fixture.r,error:null}),from=vi.fn(()=>{throw Error("REST proibido");});
  db.getSupabaseClientAsync.mockResolvedValue({rpc,from});
  await expect(caller().reparcelamento.executar(input)).resolves.toEqual(fixture.r);
  expect(rpc).toHaveBeenCalledTimes(1);expect(rpc.mock.calls[0][0]).toBe("rpc_executar_reparcelamento43");expect(rpc.mock.calls[0][1].p_user_id).toBe(1);
  expect(from).not.toHaveBeenCalled();expect(db.getDb).not.toHaveBeenCalled();
 });
 it("RPC ausente falha fechada e não contorna o protocolo",async()=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:{code:"PGRST202"}});db.getSupabaseClientAsync.mockResolvedValue({rpc});
  await expect(caller().reparcelamento.executar(input)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});expect(rpc).toHaveBeenCalledTimes(1);
 });
});
