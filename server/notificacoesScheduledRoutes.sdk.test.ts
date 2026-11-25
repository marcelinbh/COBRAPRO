import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { COOKIE_NAME } from "../shared/const";
const mocks=vi.hoisted(()=>({db:vi.fn(),lookup:vi.fn(),upsert:vi.fn(),env:{appId:"BkqW4WQ4ndZHJQHLtTMfxv",cookieSecret:"fixture-schedule50-local-signature-only",oAuthServerUrl:"https://auth.invalid"}}));
vi.mock("./_core/env",()=>({ENV:mocks.env}));
vi.mock("./db",()=>({getSupabaseClientAsync:mocks.db,getUserByOpenId:mocks.lookup,upsertUser:mocks.upsert}));
vi.mock("./services/cronAuth",()=>({possuiSegredoDeAutomacaoValido:()=>false,possuiTokenGithubActionsValido:async()=>false}));
import { sdk } from "./_core/sdk";
import { resolverEscopoAgenda, AGENDA_PROJECT_TASK_UID as UID, AGENDA_PROJECT_REGISTRY_KEY as KEY } from "./notificacoesScheduledRoutes";
async function request(secret=mocks.env.cookieSecret) {
  const token=await new SignJWT({openId:"cron_fixture-platform-identity",appId:mocks.env.appId,name:"Nome não autoriza"}).setProtectedHeader({alg:"HS256"}).setExpirationTime("1h").sign(new TextEncoder().encode(secret));
  return {headers:{cookie:`${COOKIE_NAME}=${token}`},get(){return undefined;}} as any;
}
beforeEach(()=>{
  vi.resetAllMocks();vi.stubGlobal("fetch",vi.fn(()=>{throw Error("NETWORK_FORBIDDEN");}));
  vi.spyOn(console,"warn").mockImplementation(()=>{});
  mocks.db.mockResolvedValue({from(){return {select(){return this;},in(){return this;},eq(){return this;},limit(){return Promise.resolve({data:[{user_id:null,chave:KEY,valor:UID}],error:null});}};}});
});
afterEach(()=>{expect(fetch).not.toHaveBeenCalled();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("schedule50 — SDK real verifica assinatura local, platform response offline",()=>{
  it("assinatura válida + UID platform + registro exato autoriza PROJECT, sem lookup de usuário surrogate",async()=>{
    const platform=vi.spyOn(sdk,"getUserInfoWithJwt").mockResolvedValue({openId:"cron_fixture-platform-identity",projectId:mocks.env.appId,name:"fixture",taskUid:UID} as any);
    expect(await resolverEscopoAgenda(await request())).toEqual({escopo:"project",origem:"manus_task",projectId:mocks.env.appId});
    expect(platform).toHaveBeenCalledTimes(1);expect(mocks.lookup).not.toHaveBeenCalled();expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("assinatura inválida não consulta platform/registry permissivos nem usa id=-1",async()=>{
    const platform=vi.spyOn(sdk,"getUserInfoWithJwt").mockResolvedValue({openId:"cron_fixture",taskUid:UID} as any);
    expect(await resolverEscopoAgenda(await request("wrong-signature-local-only"))).toBeNull();expect(platform).not.toHaveBeenCalled();expect(mocks.db).not.toHaveBeenCalled();
  });
  it("platform sem taskUid failclosed antes de registro",async()=>{
    vi.spyOn(sdk,"getUserInfoWithJwt").mockResolvedValue({openId:"cron_fixture-platform-identity",projectId:mocks.env.appId,name:"fixture"} as any);
    expect(await resolverEscopoAgenda(await request())).toBeNull();expect(mocks.db).not.toHaveBeenCalled();
  });
});
