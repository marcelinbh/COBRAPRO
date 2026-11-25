import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const mocks=vi.hoisted(()=>({db:vi.fn()}));
vi.mock("./db",()=>({getSupabaseClientAsync:mocks.db}));
import { obterSaudeNotificacoes, obterObservabilidadeNotificacoes } from "./services/notificacoesAutomaticas";
const event=(overrides:any={})=>({instancia:"user-51",payload:JSON.stringify({version:1,userId:51,runId:"50505050-0000-4000-8000-000000000001",origem:"manus_task",escopo:"project",dryRun:true,fase:"concluida",resultado:"parcial",observedAt:"2026-11-24T12:05:00.000Z",...overrides})});
function database({events=[event()],receipts=[{user_id:51,status:"aceito_evolution"}],outbox=[],fail=""}:any={}) {
  const calls:any[]=[];
  const sb={from(table:string){return {select(columns:string){calls.push({table,columns});return this;},eq(){return this;},order(){return this;},limit(){return Promise.resolve({data:table==="whatsapp_eventos"?events:table==="notificacoes_log"?receipts:outbox,error:table===fail?{message:"PII_DB_ERROR"}:null});}};}};
  mocks.db.mockResolvedValue(sb);return {sb,calls};
}
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("fetch",vi.fn(()=>{throw Error("NETWORK_FORBIDDEN");}));});
afterEach(()=>{expect(fetch).not.toHaveBeenCalled();vi.unstubAllGlobals();});
describe("observações/recibos50 — não são envio, não ligam OFF",()=>{
  it("aceite sem callback não vira entregue/lido; partial dryRun explícito",async()=>{
    const db=database();const r=await obterSaudeNotificacoes(51);expect(r.recibos).toEqual({aceitosSemRecibo:1,entregues:0,lidos:0,limiteAmostra:200});expect(r.heartbeat).toMatchObject({escopo:"project",dryRun:true,resultado:"parcial"});expect(r.cadencia).toBe("nao_verificada");expect(db.calls.every(c=>!["configuracoes","parcelas","contratos"].includes(c.table))).toBe(true);
  });
  it.each(["whatsapp_eventos","notificacoes_log","whatsapp_outbox"])("DB error %s nunca vira zeros",async fail=>{database({fail});await expect(obterSaudeNotificacoes(51)).rejects.toThrow(/INDISPONIVEL/);});
  it("DB ausente e owner omitido não retornam painel zerado",async()=>{mocks.db.mockResolvedValue(null);await expect(obterSaudeNotificacoes(51)).rejects.toThrow("SAUDE_NOTIFICACOES_INDISPONIVEL");mocks.db.mockClear();await expect(obterSaudeNotificacoes(undefined as any)).rejects.toThrow("USUARIO_ESCOPO_INVALIDO");expect(mocks.db).not.toHaveBeenCalled();});
  it.each(["events","receipts","outbox"])("owner divergente %s failclosed",async source=>{
    database(source==="events"?{events:[{...event(),instancia:"user-52"}]}:source==="receipts"?{receipts:[{user_id:52,status:"lido"}]}:{outbox:[{user_id:52,status:"pendente"}]});await expect(obterSaudeNotificacoes(51)).rejects.toThrow(/OWNER_DIVERGENTE/);
  });
  it.each([{userId:52},{escopo:"global"},{fase:"iniciada",resultado:"ok"},{runId:["50505050-0000-4000-8000-000000000001"]}])("payload contraditório %j não vira heartbeat válido",async overrides=>{const db=database({events:[event(overrides)]});expect((await obterObservabilidadeNotificacoes(db.sb,51)).heartbeat).toBeNull();});
  it("painel não afirma 5min nem possui fallback zero nas observações/recibos",()=>{
    const source=readFileSync(new URL("../client/src/pages/NotificacoesAutomaticas.tsx",import.meta.url),"utf8");
    const health=source.split('<CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">')[1].split('</CardContent>')[0];
    expect(health).not.toContain("?? 0");expect(health).not.toContain("cada 5 minutos");expect(health).toContain("Recibos indisponíveis");expect(health).toContain("erroSaude || !saude");expect(health).toContain("não ligam a automação OFF");
  });
});
