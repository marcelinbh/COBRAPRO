import { describe, expect, it, vi } from "vitest";
import { concluirOnboardingRpc, criarOnboardingCompleteHandler, onboardingCompleteSchema } from "./onboardingRpc";

const input = { nomeEmpresa: "Sintética", nomeConta: "Caixa Principal", tipoConta: "caixa" };
const result = () => ({ success: true, id: 17, conta_id: 42, onboardingCompleto: true,
  nomeEmpresa: "Sintética", nomeConta: "Caixa Principal", tipoConta: "caixa", repetida: false, contaCriada: true });
const client = (data: unknown = result(), error: {code?: string} | null = null) => ({ rpc: vi.fn().mockResolvedValue({data,error}) });

describe("onboarding — RPC exclusiva e handler importável", () => {
  it("usa somente ctx.user.id, trim e defaults em uma única RPC", async () => {
    const c = client();
    const get = vi.fn().mockResolvedValue(c);
    const r = await criarOnboardingCompleteHandler(get)({ctx:{user:{id:17}},input:{nomeEmpresa:" \tSintética\n "}});
    expect(r).toEqual(result());
    expect(get).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledWith("rpc_concluir_onboarding", {
      p_user_id:17,p_nome_empresa:"Sintética",p_nome_conta:"Caixa Principal",p_tipo_conta:"caixa",
    });
  });
  it.each(["caixa", "banco", "digital"])("aceita tipo %s normalizado", async tipoConta => {
    const c = client({...result(), tipoConta});
    await expect(concluirOnboardingRpc(c,17,{...input,tipoConta:` ${tipoConta} `})).resolves.toMatchObject({tipoConta});
  });
  it("replay confirma mesma conta sem criar outra", async () => {
    await expect(concluirOnboardingRpc(client({...result(),repetida:true,contaCriada:false}),17,input))
      .resolves.toMatchObject({conta_id:42,repetida:true,contaCriada:false});
  });
  it("não conta pares surrogate como dois caracteres e aceita 255 codepoints", async () => {
    const nomeEmpresa = "😀".repeat(255);
    expect(onboardingCompleteSchema.safeParse({...input,nomeEmpresa}).success).toBe(true);
    await expect(concluirOnboardingRpc(client({...result(),nomeEmpresa}),17,{...input,nomeEmpresa})).resolves.toMatchObject({nomeEmpresa});
  });
  it.each([
    {nomeEmpresa:""},{nomeEmpresa:" \t\r\n "},{nomeEmpresa:null},{nomeEmpresa:42},
    {nomeEmpresa:"x".repeat(256)},{nomeConta:""},{nomeConta:"x".repeat(256)},
    {nomeConta:null},{tipoConta:"crypto"},{tipoConta:null},{tipoConta:7},
    {userId:2},{p_user_id:2},{user_id:2},{contaId:2},{saldo:100},{extra:true},
  ])("recusa payload inválido/owner do usuário sem transporte %j", async changes => {
    const c = client();
    await expect(concluirOnboardingRpc(c,17,{...input,...changes} as never)).rejects.toMatchObject({code:"BAD_REQUEST"});
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each([0,-1,1.2,NaN,Infinity,2147483648,"17",null])("recusa id de contexto inválido %s", async id => {
    const c = client();
    await expect(concluirOnboardingRpc(c,id as number,input)).rejects.toMatchObject({code:"BAD_REQUEST"});
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("sem usuário não resolve cliente nem permite owner no input", async () => {
    const get = vi.fn();
    await expect(criarOnboardingCompleteHandler(get)({ctx:{user:null},input})).rejects.toMatchObject({code:"UNAUTHORIZED"});
    expect(get).not.toHaveBeenCalled();
  });
  it("sem cliente ou erro de aquisição falha por precondição", async () => {
    await expect(concluirOnboardingRpc(null,17,input)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
    await expect(criarOnboardingCompleteHandler(vi.fn().mockRejectedValue(new Error("postgres://secret")))({ctx:{user:{id:17}},input}))
      .rejects.toMatchObject({code:"PRECONDITION_FAILED",cause:undefined});
  });
  it.each([
    ["PGRST202","PRECONDITION_FAILED"],["PGRST203","PRECONDITION_FAILED"],["42883","PRECONDITION_FAILED"],
    ["42P01","PRECONDITION_FAILED"],["42703","PRECONDITION_FAILED"],["22023","BAD_REQUEST"],
    ["22P02","BAD_REQUEST"],["22001","BAD_REQUEST"],["23505","CONFLICT"],["23514","CONFLICT"],
    ["40001","CONFLICT"],["40P01","CONFLICT"],["42501","FORBIDDEN"],["XX000","INTERNAL_SERVER_ERROR"],
  ])("mapeia %s sem SQL/credentials nem fallback", async (code,expected) => {
    const c = client(result(),{code,message:"SELECT password; postgres://secret"} as never);
    const err = await concluirOnboardingRpc(c,17,input).catch(e => e);
    expect(err.code).toBe(expected);
    expect(err.message).not.toMatch(/SELECT|password|postgres:\/\/|secret/);
    expect(err.cause).toBeUndefined();
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });
  it("RPC ausente jamais retorna success apesar de data existir", async () => {
    await expect(concluirOnboardingRpc(client(result(),{code:"PGRST202"}),17,input)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
  });
  it("timeout não promete rollback, não repete automaticamente e não expõe erro", async () => {
    const c = {rpc:vi.fn().mockRejectedValue(new Error("postgres://secret SQL failed"))};
    await expect(concluirOnboardingRpc(c,17,input)).rejects.toMatchObject({code:"INTERNAL_SERVER_ERROR",cause:undefined});
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    {success:false},{success:1},{id:"17"},{id:18},{id:null},{id:2147483648},
    {conta_id:"42"},{conta_id:0},{conta_id:1.2},{conta_id:NaN},{conta_id:2147483648},
    {onboardingCompleto:false},{nomeEmpresa:"Outra"},{nomeConta:"Outra"},{tipoConta:"digital"},
    {nomeEmpresa:" Sintética "},{nomeConta:" Caixa Principal "},{tipoConta:" caixa "},
    {repetida:"true"},{contaCriada:"true"},{repetida:true,contaCriada:true},{extra:true},
  ])("recusa confirmação malformada/divergente %j", async changes => {
    await expect(concluirOnboardingRpc(client({...result(),...changes}),17,input)).rejects.toMatchObject({code:"INTERNAL_SERVER_ERROR"});
  });
  it.each([null,{},[],"success",{data:result()},{error:null},undefined])("recusa transporte malformado %j", async response => {
    const c = {rpc:vi.fn().mockResolvedValue(response)};
    await expect(concluirOnboardingRpc(c,17,input)).rejects.toMatchObject({code:"INTERNAL_SERVER_ERROR"});
  });
  it.each([undefined,false,0,"",{code:123}])("recusa error malformado apesar de data sucesso %j", async error => {
    const c = {rpc:vi.fn().mockResolvedValue({data:result(),error})};
    await expect(concluirOnboardingRpc(c,17,input)).rejects.toMatchObject({code:"INTERNAL_SERVER_ERROR"});
  });
  it.each([null,{},[],"success",undefined])("recusa JSONB vazio %j", async data => {
    const c = {rpc:vi.fn().mockResolvedValue({data,error:null})};
    await expect(concluirOnboardingRpc(c,17,input)).rejects.toMatchObject({code:"INTERNAL_SERVER_ERROR"});
  });
});
