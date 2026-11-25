import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Router, Request, Response } from "express";
const mocks = vi.hoisted(() => ({ db: vi.fn(), secret: vi.fn(), github: vi.fn(), sdk: vi.fn(), producer: vi.fn(), worker: vi.fn(), enqueue: vi.fn(), report: vi.fn() }));
vi.mock("./db", () => ({ getSupabaseClientAsync: mocks.db }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.sdk } }));
vi.mock("./services/cronAuth", () => ({ possuiSegredoDeAutomacaoValido: mocks.secret, possuiTokenGithubActionsValido: mocks.github }));
vi.mock("./services/notificacoesAutomaticas", async importOriginal => ({ ...(await importOriginal<typeof import("./services/notificacoesAutomaticas")>()), enfileirarLembretesAutomaticos: mocks.producer, processarFilaWhatsApp: mocks.worker, enfileirarMensagemWhatsApp: mocks.enqueue }));
vi.mock("./routers/relatorioDiario", () => ({ gerarMensagemRelatorio: mocks.report }));
import { registerNotificacoesScheduledRoutes, AGENDA_PROJECT_ID, AGENDA_PROJECT_TASK_UID as UID, AGENDA_PROJECT_REGISTRY_KEY as PROJECT, AGENDA_TENANT_REGISTRY_KEY as TENANT } from "./notificacoesScheduledRoutes";
const now = new Date("2026-11-24T12:05:00.000Z");
const tenantRow = (user_id: unknown = 51, valor = "fixture-task") => ({ user_id, chave: TENANT, valor });
const projectRow = (user_id: unknown = null, valor = UID) => ({ user_id, chave: PROJECT, valor });
function database(options: { registry?: any[]; owners?: any[]; configs?: any[]; outbox?: any[]; fail?: string; corrupt?: any[]; corruptConfigs?: any[] } = {}) {
  const calls: any[] = [], events: any[] = [];
  const from = (table: string) => {
    const q: any = { filters: [], select(columns: string) { this.columns = columns; return this; }, eq(k: string, v: unknown) { this.filters.push([k, "eq", v]); return this; }, in(k: string, v: unknown) { this.filters.push([k, "in", v]); return this; }, order(k: string) { this.sort = k; return this; }, range(a: number, b: number) { this.start = a; this.count = b-a+1; return this; }, limit(n: number) { this.count = n; return this; }, insert(value: any) { this.value = value; return this; }, then(resolve: any, reject: any) {
      const registry = table === "configuracoes" && this.filters.some(([k, op, v]: any[]) => k === "valor" || (k === "chave" && op === "eq" && v === PROJECT));
      calls.push({ table, columns: this.columns, filters: this.filters, value: this.value, registry, sort: this.sort, count: this.count });
      let result: any = { data: [], error: null };
      if (table === "whatsapp_eventos") {
        if (options.fail === "heartbeat" || (options.fail === "terminal" && JSON.parse(this.value.payload).fase !== "iniciada")) result.error = { message: "PII must not escape" };
        else events.push(this.value);
      } else {
        let rows = registry ? options.registry ?? [tenantRow()] : table === "whatsapp_outbox" ? options.outbox ?? [] : this.columns === "user_id" ? options.owners ?? [{ user_id: 51, chave: "notificacoes_auto_ativo", valor: "false" }] : options.configs ?? [];
        rows = rows.filter(row => this.filters.every(([k, op, v]: any[]) => op === "eq" ? row[k] === v : v.includes(row[k]))).slice(this.start ?? 0, (this.start ?? 0) + (this.count ?? rows.length));
        result.data = registry && options.corrupt ? options.corrupt : !registry && this.columns === "user_id, chave, valor" && options.corruptConfigs ? options.corruptConfigs : rows;
        if (options.fail === (registry ? "registry" : table === "whatsapp_outbox" ? "health" : this.columns === "user_id" ? "owners" : "configs")) result.error = { message: "PII must not escape" };
      }
      return Promise.resolve(result).then(resolve, reject);
    } };
    return q;
  };
  mocks.db.mockResolvedValue({ from }); return { calls, events };
}
async function invoke(body: unknown = { dryRun: true }, headers: Record<string, any> = { authorization: "Bearer fixture" }, path = "/api/scheduled/notificacoes") {
  const handlers: Record<string, any> = {};
  registerNotificacoesScheduledRoutes({ post(p: string, h: unknown) { handlers[p] = h; } } as Router);
  expect(Object.keys(handlers).sort()).toEqual(["/api/scheduled/notificacoes", "/api/scheduled/notificacoes/health"]);
  const req = { body, get(name: string) { return headers[name]; } };
  const res: any = { code: 200, status(n: number) { this.code = n; return this; }, set() { return this; }, json(value: unknown) { this.body = value; return this; } };
  await handlers[path](req as Request, res as Response); return res;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("NETWORK_FORBIDDEN"); }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.github.mockResolvedValue(true); mocks.secret.mockReturnValue(false);
  mocks.sdk.mockResolvedValue({ id: -1, isCron: true, taskUid: "fixture-task", name: "Não autoriza nada" });
  mocks.producer.mockResolvedValue({ usuariosNoHorario: 1, elegiveis: 1, enfileiradas: 0, falhasItens: 0 });
  mocks.worker.mockResolvedValue({ processadas: 0, enviadas: 0, falhas: 0, ambiguas: 0, relatoriosConcluidos: 0 });
  mocks.report.mockResolvedValue("fixture-only");
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe("agenda real compatível — registro do handler offline, sem cron/envio", () => {
  it.each(["github", "http"])("%s autorizado preserva produtor GLOBAL preexistente", async source => {
    const db = database({ owners: [51, 52].map(user_id => ({ user_id, chave: "notificacoes_auto_ativo", valor: "false" })) });
    mocks.secret.mockReturnValue(source === "http");
    const r = await invoke({ dryRun: true }, source === "http" ? { "x-automation-cron-secret": "fixture" } : { authorization: "fixture" });
    expect(r.code).toBe(200); expect(r.body.escopo).toBe("global"); expect(r.body.enviados).toBe(0);
    expect(mocks.producer).toHaveBeenCalledWith(now, true, undefined); expect(mocks.worker).toHaveBeenCalledWith(25, true, undefined);
    expect(mocks.sdk).not.toHaveBeenCalled(); expect(db.events).toHaveLength(6);
    for (const event of db.events) {
      const p = JSON.parse(event.payload);
      expect(p.runId).toBe(r.body.runId); expect(p.escopo).toBe("global");
      expect(event.instancia).toBe(p.userId ? `user-${p.userId}` : `project-${AGENDA_PROJECT_ID}`);
      expect(Object.keys(p).sort()).toEqual(["dryRun", "escopo", "fase", "observedAt", "origem", "resultado", "runId", p.userId ? "userId" : "projectId", "version"].sort());
    }
  });
  it("UID real permite PROJECT somente com registro NULL exato, sem adotar koletor3", async () => {
    const db = database({ registry: [projectRow()] });
    mocks.sdk.mockResolvedValue({ id: -1, isCron: true, taskUid: UID });
    const r = await invoke({ dryRun: true }, {});
    expect(r.code).toBe(200); expect(r.body.escopo).toBe("project");
    expect(db.calls[0].filters).toEqual([["chave", "in", [TENANT, PROJECT]], ["valor", "eq", UID]]); expect(db.calls[0].count).toBe(2);
    expect(mocks.producer).toHaveBeenCalledWith(now, true, undefined); expect(mocks.worker).toHaveBeenCalledWith(25, true, undefined);
    expect(db.events.some(e => e.instancia === "user-4682" || e.instancia === "user-0")).toBe(false);
    expect(JSON.parse(db.events[0].payload)).toMatchObject({ projectId: AGENDA_PROJECT_ID, escopo: "project" });
  });
  it.each([
    [], [tenantRow(4682, UID)], [projectRow(4682)], [projectRow(0)], [projectRow("0")],
    [projectRow(), projectRow()], [projectRow(), projectRow(null, "different-uid")], [projectRow(), tenantRow(51, UID)], [projectRow(null, "other-uid")],
  ].map(registry => ({ registry })))("projeto UID não aceita ausência, fake tenant, duplicata ou escopo errado %#", async ({ registry }) => {
    database({ registry }); mocks.sdk.mockResolvedValue({ isCron: true, taskUid: UID });
    expect((await invoke({}, {})).code).toBe(403); expect(mocks.producer).not.toHaveBeenCalled(); expect(mocks.worker).not.toHaveBeenCalled();
  });
  it("UID não-allowlisted em chave PROJECT não vira produtor global", async () => {
    database({ registry: [projectRow(null, "fixture-task")] });
    expect((await invoke({}, {})).code).toBe(403); expect(mocks.producer).not.toHaveBeenCalled();
  });
  it("TENANT usa exatamente uma linha persistida; id/name/body nunca escolhem owner", async () => {
    const db = database({ registry: [tenantRow(52)] });
    mocks.sdk.mockResolvedValue({ id: 51, isCron: true, taskUid: "fixture-task", name: "user-4682" });
    const r = await invoke({ dryRun: true }, {}); expect(r.code).toBe(200); expect(r.body.escopo).toBe("tenant");
    expect(mocks.producer).toHaveBeenCalledWith(now, true, 52); expect(mocks.worker).toHaveBeenCalledWith(25, true, 52);
    expect(db.events.every(e => e.instancia === "user-52")).toBe(true);
    expect(db.calls.find(c => !c.registry && c.columns === "user_id, chave, valor").filters[0]).toEqual(["user_id", "eq", 52]);
  });
  it.each([[], [tenantRow(51), tenantRow(52)], [tenantRow(51), tenantRow(51)], [tenantRow(0)], [tenantRow(-1)], [tenantRow("51")], [tenantRow(null)]].map(registry => ({ registry })))("TENANT 0/ambíguo/inválido %# falha fechado", async ({ registry }) => {
    database({ registry }); expect((await invoke({}, {})).code).toBe(403); expect(mocks.producer).not.toHaveBeenCalled();
  });
  it.each([[projectRow(null, "wrong")], [{ user_id: 51, chave: "wrong-key", valor: "fixture-task" }]].map(corrupt => ({ corrupt })))("resposta contraditória do DB falha fechado %#", async ({ corrupt }) => {
    database({ corrupt }); expect((await invoke({}, {})).code).toBe(403); expect(mocks.producer).not.toHaveBeenCalled();
  });
  it.each([{ isCron: true }, { id: -1, isCron: false, taskUid: UID }, { isCron: 1, taskUid: UID }, { isCron: true, taskUid: " " }, { isCron: true, taskUid: "x".repeat(66) }])("isCron ou surrogate isolados nunca autorizam %j", async actor => {
    database(); mocks.sdk.mockResolvedValue(actor); expect((await invoke({}, {})).code).toBe(403); expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each([{ userId: 52 }, { owner: 52 }, { dryRun: "true" }, { dryRun: false, user_id: 52 }, { taskUid: UID }, { scope: "project" }])("body %j é recusado antes do trabalho", async body => {
    database(); expect((await invoke(body)).code).toBe(400); expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.producer).not.toHaveBeenCalled();
  });
  it.each(["wrong", "", ["fixture"]])("header explicitamente inválido %# não cai para SDK válido", async authorization => {
    database(); mocks.github.mockResolvedValue(false);
    expect((await invoke({}, { authorization })).code).toBe(403); expect(mocks.sdk).not.toHaveBeenCalled();
    expect((await invoke({}, { "x-automation-cron-secret": "wrong", authorization: "fixture" })).code).toBe(403); expect(mocks.github).toHaveBeenCalledTimes(1);
  });
  it("SDK rejeitado nunca cai para registro permissivo", async () => {
    database({ registry: [projectRow()] }); mocks.sdk.mockRejectedValue(new Error("SIGNED_AUTH_INVALID"));
    expect((await invoke({}, {})).code).toBe(403); expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.producer).not.toHaveBeenCalled();
  });
  it("saúde usa owner TENANT, não registra observação nem chama worker", async () => {
    const db = database({ outbox: [{ id: "fixture", user_id: 51 }] });
    const r = await invoke({}, {}, "/api/scheduled/notificacoes/health"); expect(r.code).toBe(200); expect(r.body.cadencia).toBe("nao_verificada");
    expect(db.calls[1].filters).toEqual([["user_id", "eq", 51]]); expect(db.events).toHaveLength(0); expect(mocks.producer).not.toHaveBeenCalled(); expect(mocks.worker).not.toHaveBeenCalled();
  });
  it.each(["heartbeat", "owners", "configs", "terminal"])("falha %s não confirma sucesso sem persistência", async fail => {
    const db = database({ fail }); const r = await invoke(); expect(r.code).toBe(503); expect(JSON.stringify(r.body)).not.toContain("PII");
    if (["heartbeat", "owners"].includes(fail)) { expect(mocks.producer).not.toHaveBeenCalled(); expect(mocks.worker).not.toHaveBeenCalled(); }
    if (fail === "configs") { expect(mocks.worker).not.toHaveBeenCalled(); expect(JSON.parse(db.events.at(-1).payload).fase).toBe("falhou"); }
  });
  it("falha do lookup é 503 sem fallback", async () => { database({ fail: "registry" }); expect((await invoke({}, {})).code).toBe(503); expect(mocks.producer).not.toHaveBeenCalled(); });
  it.each(["item", "worker", "ambiguo", "report", "enqueue"])("erro %s deixa terminal parcial, HTTP 200 não prova envio", async fail => {
    const configs = ["ativo", "horario", "telefone"].map((suffix, i) => ({ user_id: 51, chave: `relatorio_diario_${suffix}`, valor: ["true", "09:02", "fixture-phone"][i] }));
    const db = database({ configs: fail === "report" || fail === "enqueue" ? configs : [] });
    if (fail === "item") mocks.producer.mockResolvedValue({ usuariosNoHorario: 1, elegiveis: 2, enfileiradas: 0, falhasItens: 1 });
    if (fail === "worker" || fail === "ambiguo") mocks.worker.mockResolvedValue({ enviadas: 0, falhas: fail === "worker" ? 1 : 0, ambiguas: fail === "ambiguo" ? 1 : 0, relatoriosConcluidos: 0 });
    if (fail === "report") mocks.report.mockRejectedValue(new Error("PII must not escape"));
    if (fail === "enqueue") mocks.enqueue.mockRejectedValue(new Error("PII must not escape"));
    const r = await invoke(); expect(r.code).toBe(200); expect(r.body.resultado).toBe("parcial"); expect(r.body.enviados).toBe(0);
    expect(JSON.parse(db.events.at(-1).payload).resultado).toBe("parcial"); expect(JSON.stringify(db.events)).not.toContain("PII");
  });
  it("relatório de outro owner nunca entra no escopo TENANT", async () => {
    const db = database({ configs: [{ user_id: 52, chave: "relatorio_diario_ativo", valor: "true" }] });
    const r = await invoke({ dryRun: true }, {}); expect(r.code).toBe(200); expect(mocks.report).not.toHaveBeenCalled(); expect(db.events.every(e => e.instancia === "user-51")).toBe(true);
  });
  it("global/projeto com zero owners ainda persiste início e terminal projeto", async () => {
    const db = database({ owners: [] }); expect((await invoke()).code).toBe(200); expect(db.events).toHaveLength(2); expect(db.events.every(e => e.instancia === `project-${AGENDA_PROJECT_ID}`)).toBe(true);
  });
});

 it("resposta contraditória de relatório alheio falha antes da geração/worker", async () => {
   database({ corruptConfigs: [{ user_id: 52, chave: "relatorio_diario_ativo", valor: "true" }] });
   const r = await invoke({ dryRun: true }, {}); expect(r.code).toBe(503);
   expect(mocks.report).not.toHaveBeenCalled(); expect(mocks.worker).not.toHaveBeenCalled();
 });
