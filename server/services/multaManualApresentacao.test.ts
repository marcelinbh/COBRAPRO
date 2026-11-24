import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CotacaoMulta } from "../../shared/multaManual";
import type { ClienteEmprestimosRpc } from "./emprestimosRpc";
import * as rpcMulta from "./multaManualRpc";
import { lerCotacoesApresentacaoMulta, type ParcelaMultaApresentacao } from "./multaManualApresentacao";

const USER = 7, CONTRATO = 10, HOJE = "2028-02-29", HASH = "a".repeat(64);
const row = (id = 20, multa_manual: unknown = "12.34"): ParcelaMultaApresentacao => ({ id, user_id: USER, contrato_id: CONTRATO, multa_manual });
const origem = (parcelaId = 20, status = "pendente") => ({ userId: USER, contratoId: CONTRATO, parcelaId, trilho: "multa36", status });
const quote = (parcelaId = 20, patch: Partial<CotacaoMulta> = {}): CotacaoMulta => ({
  contratoId: CONTRATO, parcelaId, contaCaixaId: 40, elegivel: true, totalExigido: "125.34",
  multa: "12.34", mora: "3.00", jurosEmbutidos: "10.00", valorPagoAcumulado: "0.00",
  dataPagamento: HOJE, vencimento: "2028-02-28", status: "pendente", estadoHash: HASH,
  regra: "recebimento_multa36_brt_v1", ...patch,
});
const envelope = (data: unknown, error: unknown = null) => ({
  data, error, count: null, status: error === null ? 200 : 400,
  statusText: error === null ? "OK" : "Bad Request", success: error === null,
});
function client(origin: unknown = origem(), cotacao: (id: number) => unknown = quote) {
  return {
    rpc: vi.fn().mockImplementation(async (name: string, params: Record<string, unknown>) => {
      if (name === "rpc_identificar_multa36") return envelope(origin);
      if (name === "rpc_cotar_multa36") return envelope(cotacao(params.p_parcela_id as number));
      throw new Error("Endpoint de escrita/fallback proibido");
    }),
    from: vi.fn(() => { throw new Error("REST proibido"); }),
  };
}
function ler(c: ClienteEmprestimosRpc, rows = [row()], hoje = HOJE) {
  return lerCotacoesApresentacaoMulta(c, USER, CONTRATO, rows, hoje, async () => rows);
}
function hostile(base: object) {
  let reads = 0;
  const getter = { ...base };
  Object.defineProperty(getter, Object.keys(base)[0], { enumerable: true, get() { reads++; throw new Error("getter privado"); } });
  const hidden = { ...base }; Object.defineProperty(hidden, "hidden", { value: 1 });
  const cyclic = { ...base, self: null as unknown }; cyclic.self = cyclic;
  return {
    values: [getter, hidden, cyclic, Object.assign(Object.create({ inherited: 1 }), base),
      { ...base, [Symbol("hidden")]: 1 }, new Date(), new Map(), [base],
      new Proxy({}, { ownKeys() { throw new Error("proxy"); } })],
    reads: () => reads,
  };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("seleção e sinal de multa: validar tudo antes de consultar", () => {
  it("sem parcelas ou marcadores positivos retorna null sem qualquer RPC/REST", async () => {
    const semCampo = { id: 20, user_id: USER, contrato_id: CONTRATO };
    for (const rows of [[], [row(20, 0)], [row(20, "0.00"), row(21, "0"), row(22, 0)],
      [row(20, null)], [{ ...row(), multa_manual: undefined }], [semCampo]]) {
      const c = client(); expect(await ler(c, rows)).toBeNull();
      expect(c.rpc).not.toHaveBeenCalled(); expect(c.from).not.toHaveBeenCalled();
    }
  });
  it.each(["0", "0.0", "0.00", 0, "0.01", "12.34", "1", "1.0", 1, 12.34, "9999999999999.99", 9999999999999.99])("aceita marcador decimal legítimo %s, sem usar seu valor como multa certificada", async marker => {
    const c = client(null);
    expect(await ler(c, [row(20, marker)])).toBeNull();
    expect(c.rpc).toHaveBeenCalledTimes(Number(marker) > 0 ? 1 : 0);
  });
  it.each([true, false, {}, [], BigInt(1), NaN, Infinity, -Infinity, -0, -1, "-0.00", "-1.00", "", " 1.00", "1.00 ", "01.00", "+1.00", "1,00", ".01", "1.", "1e2", "1.001", 0.001, 0.1 + 0.2, "10000000000000.00"])("recusa marcador inválido %s sem coerção nem RPC", async marker => {
    const c = client();
    await expect(ler(c, [row(20, marker)])).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("campos financeiros opcionais undefined são ausência legada, não zero malformado", async () => {
    const c = client(null);
    const semSinal = { ...row(), multa_manual: undefined, valor_juros: undefined };
    expect(await ler(c, [semSinal as any])).toBeNull(); expect(c.rpc).not.toHaveBeenCalled();
    const map = await ler(client(), [row(), row(21, null), { ...row(22), multa_manual: undefined }]);
    expect([...map!.keys()]).toEqual([20, 21, 22]);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648, "7", undefined, null])("recusa sessão %s antes de RPC mesmo sem marcadores", async userId => {
    const c = client();
    await expect(lerCotacoesApresentacaoMulta(c, userId as number, CONTRATO, [], HOJE)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648, "10", undefined, null])("recusa contrato %s antes de RPC", async contratoId => {
    const c = client();
    await expect(lerCotacoesApresentacaoMulta(c, USER, contratoId as number, [], HOJE)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("recusa IDs de linha inválidos, duplicados e ownership estrangeiro inclusive depois do primeiro sinal", async () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, 2147483648, "21", undefined, null]) {
      for (const key of ["id", "user_id", "contrato_id"]) {
        const c = client();
        await expect(ler(c, [row(), { ...row(21, 0), [key]: bad }])).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(c.rpc).not.toHaveBeenCalled();
      }
    }
    for (const rows of [[row(), row()], [row(), { ...row(21, 0), user_id: 8 }], [row(), { ...row(21, 0), contrato_id: 11 }]]) {
      const c = client(); await expect(ler(c, rows)).rejects.toBeInstanceOf(Error); expect(c.rpc).not.toHaveBeenCalled();
    }
    const c = client(); await expect(ler(c, [row(), row(21, "-1.00")])).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
  });
  it("não aceita IDs emprestados de aliases ou campos herdados", async () => {
    for (const key of ["id", "user_id", "contrato_id"]) {
      const missing = { ...row(), parcelaId: 20, userId: USER, contratoId: CONTRATO } as any; delete missing[key];
      const c = client(); await expect(ler(c, [missing])).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
    }
    const c = client(null);
    expect(await ler(c, [Object.assign(Object.create(null), row())])).toBeNull();
    expect(c.rpc).toHaveBeenCalledOnce();
  });
  it("valida por linha até 1000, sem atingir o orçamento JSON de 2048 nós no array", async () => {
    const c = client(null), rows = Array.from({ length: 1000 }, (_, i) => row(i + 1, 0));
    expect(await ler(c, rows)).toBeNull(); expect(c.rpc).not.toHaveBeenCalled();
    rows[999] = row(1000);
    expect(await ler(c, rows)).toBeNull();
    expect(c.rpc).toHaveBeenCalledWith("rpc_identificar_multa36", { p_user_id: USER, p_contrato_id: CONTRATO, p_parcela_id: 1000 });
    const legado = client(null), muitas = Array.from({ length: 19999 }, (_, i) => row(i + 1, 0));
    expect(await ler(legado, muitas)).toBeNull(); expect(legado.rpc).not.toHaveBeenCalled();
    const d = client(); await expect(ler(d, [...muitas, row(20000)])).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(d.rpc).not.toHaveBeenCalled();
  });
  it("recusa array esparso, accessor, keys extras/symbols e protótipo sem executar getter", async () => {
    let reads = 0;
    const accessor = [row()]; Object.defineProperty(accessor, "0", { enumerable: true, get() { reads++; throw new Error("getter"); } });
    const extended = [row()] as any; extended.extra = row(21);
    const symbolic = [row()] as any; symbolic[Symbol("row")] = row(21);
    const inherited = [row()]; Object.setPrototypeOf(inherited, Object.create(Array.prototype));
    for (const rows of [null, undefined, {}, [row(), , row(21)], accessor, extended, symbolic, inherited,
      new Proxy([], { ownKeys() { throw new Error("proxy"); } })]) {
      const c = client(); await expect(lerCotacoesApresentacaoMulta(c, USER, CONTRATO, rows as any, HOJE)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
    }
    expect(reads).toBe(0);
  });
  it("recusa linhas JSON hostis sem executar accessors", async () => {
    const h = hostile(row());
    for (const value of [...h.values, null, undefined, true, "row"]) {
      const c = client(); await expect(ler(c, [value as any])).rejects.toBeInstanceOf(Error); expect(c.rpc).not.toHaveBeenCalled();
    }
    expect(h.reads()).toBe(0);
  });
  it("NaN/Infinity em dados financeiros extras preservam a falha de apresentação sem RPC", async () => {
    for (const valor_original of [NaN, Infinity, -Infinity]) {
      const c = client();
      await expect(ler(c, [{ ...row(), valor_original } as any])).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(c.rpc).not.toHaveBeenCalled();
    }
  });
  it.each(["2027-02-29", "2028-02-30", "2028-2-29", "2028-02-29T00:00:00Z", "1999-12-31", "2101-01-01", "", null, undefined, new Date()])("recusa data civil inválida %s antes de RPC", async hoje => {
    const c = client(); await expect(lerCotacoesApresentacaoMulta(c, USER, CONTRATO, [], hoje as string)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
  });
});

describe("origem SQL explícita e nenhum caminho de adoção/fallback", () => {
  it("consulta somente a primeira parcela positiva e NULL explícito não adota multa36", async () => {
    const c = client(null);
    expect(await ler(c, [row(19, 0), row(20, "1.00"), row(21, "2.00")])).toBeNull();
    expect(c.rpc.mock.calls).toEqual([["rpc_identificar_multa36", { p_user_id: USER, p_contrato_id: CONTRATO, p_parcela_id: 20 }]]);
    expect(c.from).not.toHaveBeenCalled();
  });
  it("undefined, ausente, falso e origem estrangeira não são NULL SQL", async () => {
    for (const data of [undefined, {}, false, "null", { ...origem(), userId: 8 }, { ...origem(), contratoId: 11 },
      { ...origem(), parcelaId: 21 }, { ...origem(), trilho: "multimodal" }, { ...origem(), owner: USER }]) {
      const c = client(data); if (data === undefined) c.rpc.mockResolvedValue(envelope(undefined));
      await expect(ler(c)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(c.rpc).toHaveBeenCalledOnce(); expect(c.from).not.toHaveBeenCalled();
    }
    const c = client(); c.rpc.mockResolvedValue({ error: null });
    await expect(ler(c)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(c.rpc).toHaveBeenCalledOnce();
  });
  it.each([["42501", "NOT_FOUND"], ["23514", "CONFLICT"], ["40001", "CONFLICT"], ["PGRST202", "PRECONDITION_FAILED"], ["42883", "PRECONDITION_FAILED"], ["42P01", "PRECONDITION_FAILED"], ["XX000", "INTERNAL_SERVER_ERROR"]])("erro %s é %s e nunca ausência/legado", async (sql, code) => {
    const c = client(); c.rpc.mockResolvedValue(envelope(null, { code: sql, message: "snapshot privado" }));
    await expect(ler(c)).rejects.toMatchObject({ code }); expect(c.rpc).toHaveBeenCalledOnce(); expect(c.from).not.toHaveBeenCalled();
  });
  it("timeout não faz retry, reconciliação, REST ou DML", async () => {
    const c = client(); c.rpc.mockRejectedValue(new Error("timeout privado"));
    await expect(ler(c)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(c.rpc).toHaveBeenCalledOnce(); expect(c.from).not.toHaveBeenCalled();
  });
  it("SDK real instalado interpreta somente JSON null explícito como ausência, sem rede externa", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("null", { status: 200, headers: { "Content-Type": "application/json" } }));
    const sdk = createClient("https://example.invalid", "chave-sintetica", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
    expect(await ler(sdk)).toBeNull(); expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/rest/v1/rpc/rpc_identificar_multa36");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: "42501", message: "snapshot privado", details: null, hint: null }), { status: 403, headers: { "Content-Type": "application/json" } }));
    await expect(ler(sdk)).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("revalida origem do serviço: mocks/adapters também não podem fornecer undefined/getters/herança", async () => {
    const h = hostile(origem());
    for (const value of [undefined, ...h.values, { ...origem(), userId: 8 }]) {
      vi.spyOn(rpcMulta, "identificarMulta").mockResolvedValue(value as any);
      const c = client(); await expect(ler(c)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(c.rpc).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    }
    expect(h.reads()).toBe(0);
  });
});

describe("mapa completo de provas, sem reaplicar percentual nem inferir quitação", () => {
  it("identificada origem36 cota todas as parcelas próprias, inclusive marker zero e paga", async () => {
    const q = [quote(20), quote(21, { status: "parcial", totalExigido: "85.34", valorPagoAcumulado: "40.00" }),
      quote(22, { status: "paga", elegivel: false, totalExigido: "0.00", valorPagoAcumulado: "125.34" })];
    const c = client(origem(), id => q.find(p => p.parcelaId === id));
    const map = await ler(c, [row(20), row(21, 0), row(22, 0)]);
    expect(map).toBeInstanceOf(Map); expect([...map!]).toEqual(q.map(p => [p.parcelaId, p]));
    expect(map!.get(21)?.totalExigido).toBe("85.34"); expect(map!.get(22)?.status).toBe("paga");
    expect(c.rpc).toHaveBeenCalledTimes(5); expect(c.from).not.toHaveBeenCalled();
    for (const id of [20, 21, 22]) expect(c.rpc).toHaveBeenCalledWith("rpc_cotar_multa36", { p_user_id: USER, p_contrato_id: CONTRATO, p_parcela_id: id });
  });
  it("mantém multa fixa SQL ainda não recebida e residual parcial congelado", async () => {
    const c = client(origem(20, "parcial"), id => quote(id, {
      status: "parcial", totalExigido: "82.34", valorPagoAcumulado: "40.00", mora: "0.00", vencimento: "2027-01-01",
    }));
    const map = await ler(c); expect(map!.get(20)).toMatchObject({ multa: "12.34", mora: "0.00", totalExigido: "82.34", status: "parcial" });
    expect(map!.get(20)?.multa).not.toBe(String(row().multa_manual) + "0");
  });
  it("preserva status físico aberto mesmo que a data local sugira atrasada/vencendo_hoje", async () => {
    for (const vencimento of ["2028-02-28", HOJE, "2028-03-01"]) {
      const c = client(origem(), id => quote(id, { vencimento }));
      const map = await ler(c); expect(map!.get(20)?.status).toBe("pendente");
    }
    const c = client(origem(20, "atrasada"), id => quote(id, { status: "atrasada", vencimento: "2028-03-01" }));
    expect((await ler(c))!.get(20)?.status).toBe("atrasada");
  });
  it("paga exige SQL positivo de estado fechado, nunca total zero/marker/status REST por inferência", async () => {
    const paga = quote(20, { status: "paga", elegivel: false, totalExigido: "0.00", valorPagoAcumulado: "125.34" });
    expect((await ler(client(origem(20, "paga"), () => paga)))!.get(20)).toEqual(paga);
    for (const patch of [{ status: "pendente" }, { elegivel: true }, { totalExigido: "0.01" }, { valorPagoAcumulado: "0.00" }]) {
      await expect(ler(client(origem(20, "paga"), () => ({ ...paga, ...patch })))).rejects.toBeInstanceOf(Error);
    }
    // Campo REST extra não é prova: somente a cotação assinada determina estado.
    const c = client(); expect((await ler(c, [{ ...row(), status: "paga" } as any]))!.get(20)?.status).toBe("pendente");
  });
  it("não omite cancelada/renovada e não inventa quitação quando SQL recusa a cotação", async () => {
    const c = client();
    c.rpc.mockImplementation(async (name: string, params: Record<string, unknown>) => {
      if (name === "rpc_identificar_multa36") return envelope(origem());
      return params.p_parcela_id === 21 ? envelope(null, { code: "23514" }) : envelope(quote(params.p_parcela_id as number));
    });
    await expect(ler(c, [row(), { ...row(21, 0), status: "cancelada" } as any])).rejects.toMatchObject({ code: "CONFLICT" });
    expect(c.rpc).toHaveBeenCalledWith("rpc_cotar_multa36", { p_user_id: USER, p_contrato_id: CONTRATO, p_parcela_id: 21 });
  });
  it("revalida as cotações do serviço antes de usar getters/protótipos/mocks", async () => {
    const h = hostile(quote());
    for (const value of [...h.values, undefined, null, {}, { ...quote(), regra: "multimodal_v1" }, { ...quote(), estadoHash: "A".repeat(64) }]) {
      vi.spyOn(rpcMulta, "cotarMulta").mockResolvedValue(value as any);
      const c = client(); await expect(ler(c)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(c.rpc).toHaveBeenCalledOnce();
      vi.restoreAllMocks();
    }
    expect(h.reads()).toBe(0);
  });
  it("IDs, regra, hashes, status e centavos divergentes da RPC são falha fechada", async () => {
    for (const patch of [{ contratoId: 11 }, { parcelaId: 21 }, { contaCaixaId: 0 }, { estadoHash: "bad" }, { estadoHash: "A".repeat(64) },
      { regra: "recebimento_multimodal_brt_v1" }, { totalExigido: 125.34 }, { multa: "01.00" }, { mora: "-1.00" }, { totalExigido: "1.00" },
      { status: "paga" }, { status: "parcial" }, { status: "cancelada" }, { status: "pago" }, { status: "atrasado" }, { elegivel: false }]) {
      const c = client(origem(), () => ({ ...quote(), ...patch }));
      await expect(ler(c)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(c.rpc).toHaveBeenCalledTimes(2);
    }
  });
  it("divergência do status físico entre identificação e primeira cotação invalida a leitura", async () => {
    const c = client(origem(), id => quote(id, { status: "atrasada" }));
    await expect(ler(c)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" }); expect(c.rpc).toHaveBeenCalledTimes(2);
  });
  it("exige snapshot/hash e conta únicos do contrato, sem fazer merge de momentos distintos", async () => {
    for (const patch of [{ estadoHash: "b".repeat(64) }, { contaCaixaId: 41 }]) {
      const c = client(origem(), id => quote(id, id === 21 ? patch : {}));
      await expect(ler(c, [row(), row(21, 0)])).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
  });
  it("SDK real produz o mapa completo usando somente RPCs de leitura com owner da sessão", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: unknown, init: RequestInit) => {
      const params = JSON.parse(String(init.body));
      const data = String(url).endsWith("rpc_identificar_multa36") ? origem(params.p_parcela_id) : quote(params.p_parcela_id);
      return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const sdk = createClient("https://example.invalid", "chave-sintetica", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
    expect([...(await ler(sdk, [row(), row(21, 0)]))!]).toEqual([[20, quote(20)], [21, quote(21)]]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).toMatch(/\/rpc\/rpc_(identificar|cotar)_multa36$/);
      expect(JSON.parse(String(init.body))).toMatchObject({ p_user_id: USER, p_contrato_id: CONTRATO });
    }
  });
});

describe("data BRT, concorrência limitada e integridade entre awaits", () => {
  it("exige dataPagamento===hoje apesar do fuso/relógio local", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2030-01-01T01:00:00Z"));
    expect((await ler(client()))!.get(20)?.dataPagamento).toBe(HOJE);
    for (const dataPagamento of ["2028-02-28", "2028-03-01"]) {
      await expect(ler(client(origem(), id => quote(id, { dataPagamento })))).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
  });
  it("virada de dia entre RPCs descarta todo o mapa, sem retry silencioso", async () => {
    const c = client(origem(), id => quote(id, id === 21 ? { dataPagamento: "2028-03-01" } : {}));
    await expect(ler(c, [row(), row(21, 0)])).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(c.rpc).toHaveBeenCalledTimes(3);
  });
  it("captura IDs antes de await e não lê linhas mutadas depois da identificação", async () => {
    const rows = [row(), row(21, 0)];
    const c = client();
    c.rpc.mockImplementation(async (name: string, params: Record<string, unknown>) => {
      if (name === "rpc_identificar_multa36") { rows[1] = { ...row(99), user_id: 8 }; rows.push(row(22)); return envelope(origem()); }
      return envelope(quote(params.p_parcela_id as number));
    });
    await expect(ler(c, rows)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(c.rpc).not.toHaveBeenCalledWith("rpc_cotar_multa36", expect.objectContaining({ p_parcela_id: 99 }));
  });
  it("não altera linhas congeladas nem resultados do SDK", async () => {
    const rows = Object.freeze([Object.freeze(row())]); const q = Object.freeze(quote());
    const c = client(Object.freeze(origem()), () => q);
    expect((await ler(c, rows as unknown as ParcelaMultaApresentacao[]))!.get(20)).toEqual(q);
    expect(rows[0]).toEqual(row());
  });
  it("executa no máximo quatro cotações em paralelo e retorna a ordem de seleção", async () => {
    const rows = Array.from({ length: 9 }, (_, i) => row(20 + i, i === 0 ? "12.34" : 0));
    let active = 0, max = 0;
    const pending = new Map<number, (data: unknown) => void>();
    const c = client();
    c.rpc.mockImplementation((name: string, params: Record<string, unknown>) => {
      if (name === "rpc_identificar_multa36") return Promise.resolve(envelope(origem()));
      active++; max = Math.max(max, active);
      return new Promise(resolve => pending.set(params.p_parcela_id as number, data => { active--; pending.delete(params.p_parcela_id as number); resolve(envelope(data)); }));
    });
    const promise = ler(c, rows);
    await vi.waitFor(() => expect(pending.size).toBe(4));
    expect(c.rpc).toHaveBeenCalledTimes(5);
    for (const id of [23, 22, 21, 20, 27, 26, 25, 24, 28, 20]) {
      await vi.waitFor(() => expect(pending.has(id)).toBe(true));
      pending.get(id)!(quote(id));
    }
    const map = await promise;
    expect(max).toBe(4); expect(active).toBe(0); expect([...map!.keys()]).toEqual(rows.map(p => p.id));
    expect(c.rpc).toHaveBeenCalledTimes(11);
  });
  it("primeira falha interrompe agendamento, drena consultas em voo e nunca publica mapa parcial", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(20 + i));
    const pending = new Map<number, (response: unknown) => void>();
    const c = client();
    c.rpc.mockImplementation((name: string, params: Record<string, unknown>) => {
      if (name === "rpc_identificar_multa36") return Promise.resolve(envelope(origem()));
      return new Promise(resolve => pending.set(params.p_parcela_id as number, resolve));
    });
    const promise = ler(c, rows); const assertion = expect(promise).rejects.toMatchObject({ code: "CONFLICT" });
    let done = false; void promise.then(() => { done = true; }, () => { done = true; });
    await vi.waitFor(() => expect(pending.size).toBe(4));
    pending.get(20)!(envelope(null, { code: "23514" }));
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(done).toBe(false); expect(c.rpc).toHaveBeenCalledTimes(5);
    for (const id of [21, 22, 23]) pending.get(id)!(envelope(quote(id)));
    await assertion; expect(done).toBe(true); expect(c.rpc).toHaveBeenCalledTimes(5);
  });
  it("1000 parcelas próprias com sinal resultam em 1000 provas sem truncar", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => row(20 + i, i === 0 ? "12.34" : 0));
    const c = client(); const map = await ler(c, rows);
    expect(map!.size).toBe(1000); expect(map!.get(1019)).toEqual(quote(1019)); expect(c.rpc).toHaveBeenCalledTimes(1002);
  });
  it("arquivo de produção importa somente serviços de consulta e não contém escrita/reconciliação/fallback", () => {
    const source = readFileSync(new URL("./multaManualApresentacao.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/(?:fetch\s*\(|(?:cliente|supabase)\.from\s*\(|\.rpc\s*\(|reconciliarMulta|aplicarMulta\s*\(|receberMulta\s*\(|renovarMulta\s*\(|process\.env)/);
    expect(source).toContain("identificarMulta"); expect(source).toContain("cotarMulta");
  });
});
