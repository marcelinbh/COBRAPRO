import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),db:vi.fn()}));
vi.mock("../db",()=>({getSupabaseClientAsync:mocks.db}));
import { renovacaoProspectivaRouter } from "./renovacaoProspectiva";
const input={idempotencyKey:"11111111-1111-4111-8111-111111111111",contratoId:1,parcelaId:2,valorRecebido:"50.00",totalExigido:"50.00",dataPagamento:"2026-11-10",estadoHash:"a".repeat(64),cotacaoHash:"b".repeat(64)};
const result={success:true,repetida:false,operationId:"22222222-2222-4222-8222-222222222222",contratoId:1,parcelaId:2,sucessoraId:3,transacaoCaixaId:"4",contaCaixaId:5,valorRecebido:"50.00",totalExigido:"50.00",jurosPagos:"50.00",multaPaga:"0.00",moraPaga:"0.00",principalPago:"0.00",principalAntes:"1000.00",principalDepois:"1000.00",status:"renovada",contratoStatus:"ativo",novoTotal:"1050.00",novoJuros:"50.00",novoVencimento:"2026-12-10",dataPagamento:input.dataPagamento,estadoHash:input.estadoHash,cotacaoHash:input.cotacaoHash,regra:"renovacao_juros_mensal_brt_v1"};
const caller=(user:any={id:77})=>renovacaoProspectivaRouter.createCaller({user,req:{},res:{}} as any);
beforeEach(()=>{vi.clearAllMocks();for(const f of ["ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS","ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS","ENABLE_RPC_RENOVACAO_PROSPECTIVA"])vi.stubEnv(f,"true");mocks.db.mockResolvedValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:result,error:null});});
afterEach(()=>vi.unstubAllEnvs());
describe("renovacaoProspectiva router",()=>{
 it("tenant exclusivamente ctx.user.id",async()=>{expect(await caller().renovar(input)).toEqual(result);expect(mocks.rpc.mock.calls[0][1].p_user_id).toBe(77);});
 it.each(["cotar","renovar","disponibilidade"])("auth %s",async name=>{await expect((caller(null) as any)[name](input)).rejects.toMatchObject({code:"UNAUTHORIZED"});expect(mocks.db).not.toHaveBeenCalled();});
 it("flag antes db",async()=>{vi.stubEnv("ENABLE_RPC_RENOVACAO_PROSPECTIVA",undefined);await expect(caller().renovar(input)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});expect(mocks.db).not.toHaveBeenCalled();});
 it.each([{userId:2},{contaCaixaId:2},{provaId:"x"},{valorJurosPago:"0.01"}])("não aceita extra %j",async extra=>{await expect(caller().renovar({...input,...extra} as any)).rejects.toMatchObject({code:"BAD_REQUEST"});expect(mocks.db).not.toHaveBeenCalled();});
 it("sem backend não fallback",async()=>{mocks.db.mockResolvedValue(null);await expect(caller().renovar(input)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});expect(mocks.rpc).not.toHaveBeenCalled();});
 it("disponibilidade explicita limites sem db",async()=>{expect(await caller().disponibilidade()).toMatchObject({disponivel:true,regra:"renovacao_juros_mensal_brt_v1"});expect(mocks.db).not.toHaveBeenCalled();});
});
