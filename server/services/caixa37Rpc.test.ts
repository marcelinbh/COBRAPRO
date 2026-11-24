import { readFileSync } from "node:fs";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import * as pure from "../../shared/caixa37";
import { capacidades37, cotar37, aportar37, transferir37, reconciliar37 } from "./caixa37Rpc";
const KEY = "abcdefab-1234-4234-8234-123456789012", OP = "fedcba98-7654-4321-8123-210987654321", HASH = "a".repeat(64);
const input = { contaDestinoId: 20, valor: "12.34", dataTransacao: "2028-02-29", estadoHash: HASH, idempotencyKey: KEY };
const transfer = { ...input, contaOrigemId: 10 };
const intent = pure.congelarIntencaoAporte37(input), ti = pure.congelarIntencaoTransferencia37(transfer);
const capability = { disponivel: true, regra: "caixa37_v1", aporte: true, transferencia: true, recovery: true };
const conta = { contaCaixaId: 20, nome: "Destino", saldoBase: "-10.00", entradas: "3.00", saidas: "1.00", saldoEfetivo: "-8.00" };
const quoteInput = { acao: "aporte" as const, contaDestinoId: 20, valor: "12.34" };
const quote = { elegivel: true, regra: "caixa37_brt_v1", ...intent.request, origem: null, destino: conta, saldoOrigemApos: null, saldoDestinoApos: "4.34", saldoTotalOwnerAntes: "100.00", saldoTotalOwnerApos: "112.34" };
const result = { success: true, regra: "caixa37_v1", operationId: OP, idempotencyKey: KEY, repetida: false,
  acao: "aporte", contaOrigemId: null, contaDestinoId: 20, valor: "12.34", dataTransacao: "2028-02-29", descricao: null,
  pernas: [{ papel: "aporte", tipo: "entrada", contaCaixaId: 20, transacaoCaixaId: "123", valor: "12.34" }],
  saldoOrigemAntes: null, saldoOrigemApos: null, saldoDestinoAntes: "-8.00", saldoDestinoApos: "4.34", saldoTotalOwnerAntes: "100.00", saldoTotalOwnerApos: "112.34" };
const tr = { ...result, acao: "transferir", contaOrigemId: 10, saldoOrigemAntes: "0.00", saldoOrigemApos: "-12.34", saldoTotalOwnerApos: "100.00",
  pernas: [{ papel: "origem", tipo: "saida", contaCaixaId: 10, transacaoCaixaId: "124", valor: "12.34" }, { papel: "destino", tipo: "entrada", contaCaixaId: 20, transacaoCaixaId: "125", valor: "12.34" }] };
const proof = { userId: 7, idempotencyKey: KEY, request: intent.request, requestHash: HASH, proof: "uuid_fenced37_v1", status: "confirmed", operationId: OP, result };
const client = (data: unknown, error: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error, success: error === null, count: null, status: error === null ? 200 : 400, statusText: error === null ? "OK" : "Bad Request" }) });
const calls = [
  { name: "quote", call: cotar37, input: quoteInput, result: quote, rpc: "rpc_cotar_caixa37" },
  { name: "aporte", call: aportar37, input, result, rpc: "rpc_aportar_caixa37" },
  { name: "transferir", call: transferir37, input: transfer, result: tr, rpc: "rpc_transferir_caixa37" },
  { name: "reconciliar", call: reconciliar37, input: intent, result: proof, rpc: "rpc_reconciliar_caixa37" },
] as const;
let assertions = 0;
afterEach(() => { assertions += expect.getState().assertionCalls; vi.useRealTimers(); });
afterAll(() => console.log(`caixa37Rpc assertions: ${assertions}`));

describe("cinco endpoints37 e parâmetros congelados exatos", () => {
  it("capacidade exata sem flag/rest/drizzle/retry e nenhuma fonte de saldo paralela", async () => {
    const c = client(capability); expect(await capacidades37(c, 7)).toEqual(capability);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_capacidades_caixa37", {});
    const src = readFileSync(new URL("./caixa37Rpc.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/(?:getDb|registrarTransacao|\.from\(|\.insert\(|\.update\(|process\.env|parseFloat|toFixed|setTimeout|new Date)/);
  });
  it("cotar não reserva UUID/dia e normaliza descrição; SQL decide dia autoritativo", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2030-01-01T02:00:00Z"));
    const c = client({ ...quote, descricao: "nota" });
    expect(await cotar37(c, 7, { ...quoteInput, descricao: "  nota  " })).toEqual({ ...quote, descricao: "nota" });
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_cotar_caixa37", { p_user_id: 7, p_acao: "aporte", p_conta_origem_id: null, p_conta_destino_id: 20, p_valor: "12.34", p_descricao: "nota" });
    const origem = { ...conta, contaCaixaId: 10, saldoBase: "0.00", entradas: "0.00", saidas: "0.00", saldoEfetivo: "0.00" };
    const tq = { ...quote, ...ti.request, origem, saldoOrigemApos: "-12.34", saldoTotalOwnerApos: "100.00" };
    const t = client(tq); expect(await cotar37(t, 7, { ...quoteInput, acao: "transferir", contaOrigemId: 10 })).toEqual(tq);
    expect(t.rpc).toHaveBeenCalledWith("rpc_cotar_caixa37", { p_user_id: 7, p_acao: "transferir", p_conta_origem_id: 10, p_conta_destino_id: 20, p_valor: "12.34", p_descricao: null });
  });
  it("aporte normaliza UUID/descrição antes RPC e não envia owner do payload", async () => {
    const c = client({ ...result, descricao: "recebido" });
    expect(await aportar37(c, 7, { ...input, idempotencyKey: KEY.toUpperCase(), descricao: "  recebido  " })).toEqual({ ...result, descricao: "recebido" });
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_aportar_caixa37", { p_user_id: 7, p_chave_idempotencia: KEY, p_conta_destino_id: 20, p_valor: "12.34", p_data_transacao: "2028-02-29", p_estado_hash: HASH, p_descricao: "recebido" });
    const empty = client(result); expect(await aportar37(empty, 7, { ...input, descricao: "  " })).toEqual(result); expect(empty.rpc.mock.calls[0][1].p_descricao).toBeNull();
  });
  it("transferir uma RPC/pernas exatas e saldo negativo não é restrição local", async () => {
    const c = client(tr); expect(await transferir37(c, 7, transfer)).toEqual(tr);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_transferir_caixa37", { p_user_id: 7, p_chave_idempotencia: KEY, p_conta_origem_id: 10, p_conta_destino_id: 20, p_valor: "12.34", p_data_transacao: "2028-02-29", p_estado_hash: HASH, p_descricao: null });
  });
  it("reconciliar usa request canônico sem trim/UUID/owner injetados e sem consulta capacidade", async () => {
    const c = client(proof); expect(await reconciliar37(c, 7, intent)).toEqual(proof);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_reconciliar_caixa37", { p_user_id: 7, p_chave_idempotencia: KEY, p_request: intent.request });
    const p = { ...proof, request: ti.request, result: tr }, t = client(p); expect(await reconciliar37(t, 7, ti)).toEqual(p);
    expect(t.rpc.mock.calls[0][1].p_request).not.toHaveProperty("userId"); expect(t.rpc.mock.calls[0][1].p_request).not.toHaveProperty("idempotencyKey");
  });
  it.each([0, -1, 1.5, 2147483648, NaN, Infinity, "7", null])("owner inválido %s rejeita antes RPC", async owner => {
    for (const a of calls) { const c = client(a.result); await expect((a.call as Function)(c, owner, a.input)).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(c.rpc).not.toHaveBeenCalled(); }
    const c = client(capability); await expect(capacidades37(c, owner as number)).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each(calls)("$name schema rejeita owner e hostilidade antes de rede", async a => {
    let reads = 0;
    const getter = { ...a.input }; Object.defineProperty(getter, "evil", { enumerable: true, get() { reads++; throw new Error("getter"); } });
    for (const v of [getter, Object.assign(Object.create({ owner: 8 }), a.input), { ...a.input, userId: 8 }, { ...a.input, owner: 8 }, { ...a.input, p_user_id: 8 }, { ...a.input, evil: undefined }]) {
      const c = client(a.result); await expect((a.call as Function)(c, 7, v)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
    }
    expect(reads).toBe(0);
  });
});

describe("envelope SDK não contraditório e sem falso confirmado", () => {
  it.each(calls)("$name aceita envelope mínimo mas nunca double-envelope/sucesso parcial", async a => {
    expect(await (a.call as Function)({ rpc: vi.fn().mockResolvedValue({ data: a.result, error: null }) }, 7, a.input)).toEqual(a.result);
    for (const response of [null, undefined, {}, { data: a.result }, { error: null }, { data: a.result, error: undefined }, { data: a.result, error: false }, { data: a.result, error: "erro" }, { data: null, error: { code: 1 } }, { data: a.result, error: null, extra: 7 }, { data: a.result, error: null, success: false }, { data: null, error: { code: "42883" }, success: true }, { data: a.result, error: null, success: "true" }, { data: a.result, error: { code: "42501" } }, { data: a.result, error: null, status: 400 }, { data: a.result, error: null, status: 0 }, { data: null, error: { code: "42501" }, status: 200 }, { data: { success: true }, error: null }, { data: { data: a.result, error: null }, error: null }, { data: a.result, error: null, count: 1.5 }, { data: a.result, error: null, statusText: null }, { data: null, error: { code: "42501", owner: 8 } }, { data: null, error: { code: "42501", details: {} } }]) {
      const c = { rpc: vi.fn().mockResolvedValue(response) }; await expect((a.call as Function)(c, 7, a.input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(c.rpc).toHaveBeenCalledOnce();
    }
  });
  it("getters em envelope/data/error não são executados", async () => {
    let reads = 0;
    const envelope = { data: result }; Object.defineProperty(envelope, "error", { enumerable: true, get() { reads++; return null; } });
    const error = {}; Object.defineProperty(error, "code", { enumerable: true, get() { reads++; return "42883"; } });
    const data = { ...result }; Object.defineProperty(data, "operationId", { enumerable: true, get() { reads++; return OP; } });
    for (const response of [envelope, { data: null, error }, { data, error: null }]) await expect(aportar37({ rpc: vi.fn().mockResolvedValue(response) }, 7, input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(capacidades37({ rpc: vi.fn().mockResolvedValue({ data: null, error }) }, 7)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(reads).toBe(0);
  });
  it("SDK real retorna os cinco formatos em fetch simulado sem rede externa", async () => {
    const cases = [{ call: (c: any) => capacidades37(c, 7), result: capability }, ...calls.map(a => ({ call: (c: any) => (a.call as Function)(c, 7, a.input), result: a.result }))];
    for (const a of cases) {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(a.result), { status: 200, headers: { "Content-Type": "application/json" } }));
      const sdk = createClient("https://example.invalid", "synthetic", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
      expect(await a.call(sdk)).toEqual(a.result); expect(fetchMock).toHaveBeenCalledOnce();
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "42501", message: "private snapshot", details: null, hint: null }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const sdk = createClient("https://example.invalid", "synthetic", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
    await expect(aportar37(sdk, 7, input)).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("erros não comprovam absence/fence/capacidade", () => {
  it.each([["22023", "BAD_REQUEST"], ["22007", "BAD_REQUEST"], ["22008", "BAD_REQUEST"], ["22P02", "BAD_REQUEST"], ["22003", "BAD_REQUEST"], ["42501", "NOT_FOUND"], ["23505", "CONFLICT"], ["23514", "PRECONDITION_FAILED"], ["40001", "CONFLICT"], ["40P01", "CONFLICT"], ["55000", "PRECONDITION_FAILED"], ["PGRST202", "PRECONDITION_FAILED"], ["42883", "PRECONDITION_FAILED"], ["42P01", "PRECONDITION_FAILED"], ["XX000", "INTERNAL_SERVER_ERROR"]])("%s mapeia %s sem vazar detalhes/retry", async (sql, code) => {
    for (const a of calls) {
      const c = client(null, { code: sql, message: "private snapshot secret", details: "private sql", hint: "private query" });
      await expect((a.call as Function)(c, 7, a.input)).rejects.toMatchObject({ code }); expect(c.rpc).toHaveBeenCalledOnce();
      const c2 = client(null, { code: sql, message: "private snapshot secret" }); await expect((a.call as Function)(c2, 7, a.input)).rejects.not.toThrow(/private snapshot/); expect(c2.rpc).toHaveBeenCalledOnce();
    }
  });
  it("55000 detalhe controlado distingue fence sem retornar not_executed", async () => {
    const c = client(null, { code: "55000", details: "CAIXA37_UUID_FENCED" }); await expect(aportar37(c, 7, input)).rejects.toThrow(/UUID caixa37 fechado por fence/); expect(c.rpc).toHaveBeenCalledOnce();
    const untrusted = client(null, { code: "XX000", message: "CAIXA37_UUID_FENCED" }); await expect(reconciliar37(untrusted, 7, intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it.each(calls)("$name timeout não reenvia nem altera intenção/clock/UUID", async a => {
    const before = JSON.stringify(a.input), c = { rpc: vi.fn().mockRejectedValue(new Error("timeout secret")) };
    await expect((a.call as Function)(c, 7, a.input)).rejects.toThrow(/mesmo UUID\/request; timeout não prova ausência/);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(JSON.stringify(a.input)).toBe(before);
  });
  it("replay histórico aceita nova data atual, mas não refaz quote/fresh balance", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2050-12-31"));
    const c = client({ ...result, repetida: true }); expect(await aportar37(c, 7, input)).toEqual({ ...result, repetida: true }); expect(c.rpc).toHaveBeenCalledOnce();
    const r = client(proof); expect(await reconciliar37(r, 7, intent)).toEqual(proof); expect(r.rpc).toHaveBeenCalledOnce();
  });
  it("capacidade false somente PGRST202/42883 em envelope íntegro", async () => {
    for (const code of ["PGRST202", "42883"]) { const c = client(null, { code }); expect(await capacidades37(c, 7)).toEqual(pure.caixa37Indisponivel); expect(c.rpc).toHaveBeenCalledOnce(); }
    for (const code of ["42P01", "55000", "42501", "23514", "XX000"]) await expect(capacidades37(client(null, { code }), 7)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    for (const data of [null, {}, { ...capability, disponivel: false }, { ...capability, aporte: false }, { ...capability, transferencia: false }, { ...capability, recovery: false }, { ...capability, regra: "caixa36_v1" }, { ...capability, owner: 8 }]) await expect(capacidades37(client(data), 7)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(capacidades37({ rpc: vi.fn().mockRejectedValue(Error("timeout")) }, 7)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(capacidades37({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42883" }, success: true }) }, 7)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

describe("recovery37 completa não depende de capacidade atual", () => {
  it("fence só not_executed completo incluindo eco SQL owner/request/hash", async () => {
    const fence = { ...proof, status: "not_executed", operationId: null, result: null }, c = client(fence);
    expect(await reconciliar37(c, 7, intent)).toEqual(fence); expect(c.rpc).toHaveBeenCalledOnce();
    for (const patch of [{ userId: 8 }, { requestHash: null }, { requestHash: undefined }, { status: null }, { status: "pending" }, { proof: "uuid_fenced36_v1" }, { operationId: OP }, { result }, { result: {} }, { request: { ...intent.request, estadoHash: "b".repeat(64) } }]) await expect(reconciliar37(client({ ...fence, ...patch }), 7, intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("SQL ausência de result/owner/hash e confirmed repetida=true não comprovam", async () => {
    for (const key of ["userId", "request", "requestHash", "result", "status", "operationId", "idempotencyKey", "proof"]) { const value = { ...proof } as any; delete value[key]; await expect(reconciliar37(client(value), 7, intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); }
    for (const patch of [{ operationId: KEY }, { result: { ...result, repetida: true } }, { request: { ...intent.request, descricao: "outra" } }, { userId: 8 }, { result: { ...result, saldoTotalOwnerApos: "100.00" } }]) await expect(reconciliar37(client({ ...proof, ...patch }), 7, intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("input recovery deve já ser canônico e não é reconstruído a partir de form ou outro ciclo", async () => {
    for (const v of [{ ...intent, request: { ...intent.request, descricao: "  nota  " } }, { ...intent, request: { ...intent.request, userId: 7 } }, { ...intent, request: { ...intent.request, idempotencyKey: KEY } }, { ...intent, request: { ...intent.request, acao: "transferir" } }, { ...intent, family: "caixa37" }, { ...intent, payload: intent.request }]) { const c = client(proof); await expect(reconciliar37(c, 7, v as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled(); }
  });
});
