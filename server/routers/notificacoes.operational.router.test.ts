import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificacoesRouter } from "./notificacoes";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  db: vi.fn(), enqueue: vi.fn(), process: vi.fn(), send: vi.fn(),
  payment: vi.fn(), health: vi.fn(), recover: vi.fn(), markers: vi.fn(),
}));
vi.mock("../db", () => ({ getSupabaseClientAsync: mocks.db }));
vi.mock("../services/evolutionClient", () => ({
  enviarMensagemEvolution: mocks.send,
  normalizarTelefoneWhatsApp: vi.fn((v: string) => v),
}));
vi.mock("../services/notificacoesAutomaticas", () => ({
  enfileirarLembretesAutomaticos: mocks.enqueue,
  processarFilaWhatsApp: mocks.process,
  enfileirarConfirmacaoPagamento: mocks.payment,
  obterSaudeNotificacoes: mocks.health,
  recuperarLeasesExpiradosWhatsApp: mocks.recover,
  sincronizarMarcadoresDeRelatorioDiario: mocks.markers,
  substituirVariaveis: vi.fn((v: string) => v),
}));
const caller = (id = 17) => notificacoesRouter.createCaller({
  user: { id } as any, req: {} as any, res: {} as any,
});
const lembretes = { usuariosNoHorario: 1, elegiveis: 7, enfileiradas: 4, falhasItens: 2 };
const fila = { processadas: 6, enviadas: 3, falhas: 1, aguardandoReconexao: 1, ambiguas: 1, relatoriosConcluidos: 0, canceladas: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enqueue.mockResolvedValue(lembretes);
  mocks.process.mockResolvedValue(fila);
});

describe("notificacoes.dispararDoDia — schema, auth e escopo obrigatório", () => {
  it.each([undefined, {}, { dryRun: true }])("input %j valida sem enviar por padrão", async input => {
    const result = await caller().dispararDoDia(input);
    expect(result.dryRun).toBe(true);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.any(Date), true, 17);
    expect(mocks.process).toHaveBeenCalledTimes(1);
    expect(mocks.process).toHaveBeenCalledWith(25, true, 17);
    expect(mocks.enqueue.mock.invocationCallOrder[0]).toBeLessThan(mocks.process.mock.invocationCallOrder[0]);
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.markers).not.toHaveBeenCalled();
  });
  it.each([17, 44])("somente dryRun=false explícito usa execução do proprietário %i", async id => {
    const result = await caller(id).dispararDoDia({ dryRun: false });
    expect(result).toMatchObject({ dryRun: false, elegiveis: 7, enfileiradas: 4, processadas: 6, enviadas: 3, falhasItens: 2, falhas: 3, ambiguas: 1 });
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.any(Date), false, id);
    expect(mocks.process).toHaveBeenCalledTimes(1);
    expect(mocks.process).toHaveBeenCalledWith(25, false, id);
    expect(mocks.send).not.toHaveBeenCalled(); // Somente motor mockado; nenhum envio real.
  });
  it.each([
    { dryRun: false, userId: 999 }, { dryRun: true, user_id: 999 },
    { tenantId: 999 }, { limite: 200 }, { dryRun: "false" },
    { dryRun: null }, null, false, [], { dryRun: 0 },
  ])("rejeita payload não estrito %j antes do motor", async input => {
    await expect(caller().dispararDoDia(input as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("sessão ausente não chama serviço", async () => {
    const anon = notificacoesRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    await expect(anon.dispararDoDia({ dryRun: false })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it.each([0, -1, NaN, 1.2, undefined, "17", Number.MAX_SAFE_INTEGER + 1])("contexto inválido %s não permite execução global", async id => {
    const invalid = notificacoesRouter.createCaller({ user: { id } as any, req: {} as any, res: {} as any });
    await expect(invalid.dispararDoDia()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it.each(["enqueue", "process"] as const)("falha em %s é sanitizada e nunca retorna sucesso fictício", async stage => {
    mocks[stage].mockRejectedValueOnce(new Error("segredo token provider telefone 5511999999999 sql tenant"));
    const error = await caller().dispararDoDia({ dryRun: false }).catch(error => error);
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toContain("Consulte o histórico");
    expect(error.message).toContain("ambíguos");
    expect(error.message).not.toMatch(/segredo|token|5511999999999|sql/);
    if (stage === "enqueue") expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks[stage]).toHaveBeenCalledTimes(1); // Sem retry no handler.
  });
  it("zero verdadeiro é retornado somente a partir dos resultados do motor", async () => {
    mocks.enqueue.mockResolvedValue({ usuariosNoHorario: 0, elegiveis: 0, enfileiradas: 0, falhasItens: 0 });
    mocks.process.mockResolvedValue({ processadas: 0, enviadas: 0, falhas: 0, aguardandoReconexao: 0, ambiguas: 0, relatoriosConcluidos: 0, canceladas: 0 });
    const result = await caller().dispararDoDia();
    expect(result).toMatchObject({ dryRun: true, enviadas: 0, falhas: 0 });
    expect(Object.prototype.hasOwnProperty.call(result, "enviados")).toBe(false);
    expect(mocks.process).toHaveBeenCalledTimes(1);
  });
});

// Banco somente em memória: comprova que configurar regra não ativa o master.
function memoryDb(existente: boolean) {
  const calls: { table: string; op?: string; payload?: any; eq: [string, unknown][] }[] = [];
  const db = { from: vi.fn((table: string) => {
    const call: typeof calls[number] = { table, eq: [] }; calls.push(call);
    const q: any = {
      select: () => q,
      eq: (key: string, value: unknown) => { call.eq.push([key, value]); return q; },
      maybeSingle: () => Promise.resolve({ data: existente ? { id: 81, mensagem_template: "Mensagem" } : null, error: null }),
      update: (payload: any) => { call.op = "update"; call.payload = payload; return q; },
      insert: (payload: any) => { call.op = "insert"; call.payload = payload; return q; },
      upsert: (payload: any) => { call.op = "upsert"; call.payload = payload; return q; },
      then: (ok: any, fail: any) => Promise.resolve({ error: null }).then(ok, fail),
    };
    return q;
  }) };
  mocks.db.mockResolvedValue(db);
  return calls;
}
describe("regras — edição desligada não ativa automação nem muda tenant", () => {
  it("salvar mantém ativo=false e escreve somente a regra do contexto", async () => {
    const calls = memoryDb(false);
    await caller().salvar({ tipo: "no_vencimento", ativo: false, mensagem_template: "Rascunho" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: "notificacoes_automaticas", payload: { user_id: 17, ativo: false, mensagem_template: "Rascunho" } });
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it.each([true, false])("toggle existente=%s escreve só a regra do owner", async existente => {
    const calls = memoryDb(existente);
    await caller().toggle({ tipo: "no_vencimento", ativo: true });
    expect(calls.every(call => call.table === "notificacoes_automaticas")).toBe(true);
    expect(calls[0].eq).toContainEqual(["user_id", 17]);
    const write = calls[1];
    if (existente) expect(write.eq).toContainEqual(["user_id", 17]);
    else expect(write.payload.user_id).toBe(17);
    expect(write.payload.ativo).toBe(true);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

function historyDatabase(fault?: "log-owner" | "client-owner" | "client-id" | "client-error") {
  const records = [17, 44].map(id => ({
    id, user_id: id, tipo: "no_vencimento", cliente_id: id * 10,
    telefone: `55119999900${id}`, mensagem: `Mensagem privada ${id}`, erro: null,
    status: "aceito_evolution", createdAt: "2026-11-16T15:00:00Z",
  }));
  records.push({ ...records[0], id: 170, cliente_id: null as any, tipo: "teste_envio" });
  const customers = [17, 44].map(id => ({ id: id * 10, user_id: id, nome: `Cliente ${id}` }));
  const calls: { table: string; params: URLSearchParams }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://history.invalid");
    expect(init?.method ?? "GET").toBe("GET");
    const table = url.pathname.split("/").at(-1)!;
    const params = url.searchParams; calls.push({ table, params });
    const rows = (table === "notificacoes_log" ? records : customers).filter((row: any) => {
      if (params.get("user_id") !== `eq.${row.user_id}`) return false;
      const ids = params.get("id");
      return !ids || ids.slice(4, -1).split(",").includes(String(row.id));
    }).slice(0, Number(params.get("limit") ?? 100));
    if (fault === "client-error" && table === "clientes") return new Response(JSON.stringify({ message: "Falha sintética", code: "XX000" }), { status: 500 });
    const columns = params.get("select")!.split(",");
    const projected = rows.map((row: any) => Object.fromEntries(columns.map(column => [column, row[column]])));
    if (fault === "log-owner" && table === "notificacoes_log") projected.push({ ...records[1] });
    if (fault === "client-owner" && table === "clientes") projected.forEach(row => { row.user_id = 44; });
    if (fault === "client-id" && table === "clientes") projected.forEach(row => { row.id = 440; });
    return new Response(JSON.stringify(projected), { status: 200, headers: { "content-type": "application/json" } });
  });
  mocks.db.mockResolvedValue(createClient("https://history.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock },
  }));
  return { records, customers, calls, fetchMock };
}

describe("histórico — vínculo do proprietário via SDK sem rede", () => {
  it.each([17, 44])("consulta limitada usa somente logs e nomes do tenant %i", async id => {
    const db = historyDatabase();
    const result = await caller(id).historico({ limit: 50 });
    expect(result.some(row => row.clientes?.nome === `Cliente ${id}`)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(`Mensagem privada ${id === 17 ? 44 : 17}`);
    expect(db.calls).toHaveLength(2);
    expect(db.calls[0].params.get("limit")).toBe("50");
    expect(db.calls[0].params.get("select")).not.toContain("clientes(");
    expect(db.calls.every(call => call.params.get("user_id") === `eq.${id}`)).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("resposta tardia de log com owner contraditório é descartada, não hidratada", async () => {
    const db = historyDatabase("log-owner");
    const result = await caller().historico();
    expect(result.every(row => row.id !== 44)).toBe(true);
    expect(db.calls[1].params.get("id")).toBe("in.(170)");
    expect(JSON.stringify(result)).not.toContain("Mensagem privada 44");
  });
  it.each(["client-owner", "client-id"] as const)("vínculo %s esconde telefone e mensagem mas preserva metadados", async fault => {
    historyDatabase(fault);
    const result = await caller().historico();
    const log = result.find(row => row.id === 17)!;
    expect(log).toMatchObject({ id: 17, status: "aceito_evolution", telefone: null, mensagem: null, clientes: null });
    expect(log.erro).toContain("dados ocultos");
    const manual = result.find(row => row.tipo === "teste_envio")!;
    expect(manual.telefone).toBe("5511999990017");
    expect(manual.clientes).toBeNull();
  });
  it("falha ao conferir cliente não retorna histórico aparentemente vazio nem PII", async () => {
    historyDatabase("client-error");
    await expect(caller().historico()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível conferir os clientes do histórico" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each([0, -1, undefined, 1.5])("cliente_id inválido %s não hidrata nome nem dados pessoais", async clienteId => {
    const db = historyDatabase(); db.records[0].cliente_id = clienteId as any;
    const result = await caller().historico();
    expect(db.calls).toHaveLength(1);
    expect(result.find(row => row.id === 17)).toMatchObject({ telefone: null, mensagem: null, clientes: null });
  });
});
