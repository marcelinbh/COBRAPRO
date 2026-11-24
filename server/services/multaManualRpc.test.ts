import { readFileSync } from "node:fs";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import * as pure from "../../shared/multaManual";
import {
  aplicarMulta, identificarMulta, cotarMulta, receberMulta, cotarRenovacaoMulta, renovarMulta,
  disponibilidadeMulta, reconciliarMulta,
} from "./multaManualRpc";

const KEY = "abcdefab-1234-4234-8234-123456789012";
const OP = "87654321-4321-4321-8321-210987654321";
const HASH = "a".repeat(64);
const consulta = { contratoId: 10, parcelaId: 20 };
const aplicacao: pure.EntradaAplicarMulta = { idcontrato: 10, multa: "12.34", idempotencyKey: KEY, parcelasIds: [20, 21] };
const aplicado = {
  success: true, operationId: OP, repetida: false, contratoId: 10, contaCaixaId: 40, parcelasIds: [20, 21], quantidade: 2,
  valorFixoPorParcela: "12.34", valorMultaTotal: "24.68", dataCivilBrt: "2028-02-29", estado: "exigivel_nao_recebida", trilho: "multa36",
};
const origem = { userId: 7, ...consulta, trilho: "multa36", status: "atrasada" };
const capacidade = { disponivel: true, regra: "multa36_v1", aplicacao: true, recebimento: true, renovacao: true };
const cotacao = {
  ...consulta, contaCaixaId: 40, elegivel: true, totalExigido: "122.34", multa: "12.34", mora: "0.00", jurosEmbutidos: "10.00",
  valorPagoAcumulado: "0.00", dataPagamento: "2028-02-29", vencimento: "2028-02-28", status: "atrasada", estadoHash: HASH, regra: "recebimento_multa36_brt_v1",
};
const recebimento: pure.EntradaReceberMulta = {
  ...consulta, idempotencyKey: KEY, valorRecebido: "122.34", totalExigido: "122.34", dataPagamento: "2028-02-29", estadoHash: HASH, modo: "integral",
};
const recebido = {
  ...consulta, success: true, repetida: false, operationId: OP, transacaoCaixaId: "9007199254740993", contaCaixaId: 40,
  valorRecebido: "122.34", totalExigido: "122.34", saldoResidual: "0.00", valorPagoAcumulado: "122.34", status: "paga", contratoStatus: "quitado",
  dataPagamento: "2028-02-29", regra: "recebimento_multa36_brt_v1",
};
const consultaRenovacao = { ...consulta, novoVencimento: "2028-03-31" };
const renovacao: pure.EntradaRenovarMulta = {
  ...consultaRenovacao, idempotencyKey: KEY, valorRecebido: "22.34", totalExigido: "22.34", dataPagamento: "2028-02-29", estadoHash: HASH,
};
const cotacaoRenovacao = {
  ...consultaRenovacao, contaCaixaId: 40, renovavel: true, totalExigido: "22.34", juros: "10.00", multa: "12.34", mora: "0.00", principalPreservado: "100.00",
  dataPagamento: "2028-02-29", estadoHash: HASH, regra: "renovacao_multa36_brt_v1",
};
const renovado = {
  ...consultaRenovacao, success: true, repetida: false, operationId: OP, novaParcelaId: 22, transacaoCaixaId: "9007199254740993", contaCaixaId: 40,
  valorRecebido: "22.34", dataPagamento: "2028-02-29", contratoStatus: "ativo", status: "renovada", regra: "renovacao_multa36_brt_v1",
};
const client = (data: unknown, error: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error, success: error === null, count: null, status: error === null ? 200 : 400, statusText: error === null ? "OK" : "Bad Request" }) });
function recovery(acao: pure.RecoveryMultaRequest["acao"], input: { idempotencyKey: string }) {
  const { idempotencyKey, ...payload } = input;
  return { acao, idempotencyKey, payload };
}
const request = recovery("multa", aplicacao);
const proof = { status: "confirmed", operationId: OP, result: aplicado, idempotencyKey: KEY, proof: "uuid_fenced36_v1" };
const wrapped = { ...proof, userId: 7, acao: "multa", payload: request.payload };
let assertions = 0;
afterEach(() => { assertions += expect.getState().assertionCalls; vi.useRealTimers(); });
afterAll(() => console.log(`multaManualRpc assertions: ${assertions}`));

const writes = [
  { name: "multa", call: aplicarMulta, input: aplicacao, result: aplicado, rpc: "rpc_aplicar_multa36" },
  { name: "receber", call: receberMulta, input: recebimento, result: recebido, rpc: "rpc_receber_multa36" },
  { name: "renovar", call: renovarMulta, input: renovacao, result: renovado, rpc: "rpc_renovar_multa36" },
] as const;

describe("shared multa36 puro e intenção estrita", () => {
  it("não importa ambiente, banco, servidor ou rede e conserva centavos inteiros seguros", () => {
    const source = readFileSync(new URL("../../shared/multaManual.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/(?:from\s+["'][^"']*(?:server|node:|db)|process\.env|import\.meta\.env|TRPCError|fetch\s*\()/);
    expect(pure.centavosMulta("9999999999.99")).toBe(BigInt("999999999999"));
    expect(pure.centavosMulta("0.01")).toBe(BigInt(1));
    expect(pure.centavosMulta("0.00")).toBe(BigInt(0));
    expect(Object.isFrozen(pure.multaIndisponivel)).toBe(true);
  });
  it("safeParse recusa decimais/bigints malformados sem lançar fora da validação", () => {
    for (const multa of ["NaN", "Infinity", "1e2", "", "1.000", "01.00", "-1.00"]) {
      expect(pure.aplicarMultaSchema.safeParse({ ...aplicacao, multa }).success).toBe(false);
      expect(pure.receberMultaSchema.safeParse({ ...recebimento, valorRecebido: multa }).success).toBe(false);
      expect(pure.renovarMultaSchema.safeParse({ ...renovacao, valorRecebido: multa }).success).toBe(false);
    }
    for (const transacaoCaixaId of ["NaN", "Infinity", "1e2", "", "1.0"]) {
      expect(pure.resultadoRecebimentoMultaSchema.safeParse({ ...recebido, transacaoCaixaId }).success).toBe(false);
      expect(pure.resultadoRenovacaoMultaSchema.safeParse({ ...renovado, transacaoCaixaId }).success).toBe(false);
    }
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648, Number.MAX_SAFE_INTEGER])("owner inválido %s recusa antes do RPC", async owner => {
    for (const w of writes) {
      const c = client(w.result);
      await expect((w.call as Function)(c, owner, w.input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(c.rpc).not.toHaveBeenCalled();
    }
  });
  it.each(["0.00", "-1.00", "01.00", "1", "1.0", "1.000", "1e2", " 1.00", "1.00 ", "10000000000.00", 1, NaN, Infinity, null])("multa não canônica/positiva %s recusa sem RPC", async multa => {
    const c = client(aplicado);
    await expect(aplicarMulta(c, 7, { ...aplicacao, multa } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("exige seleção única 1..60, int32 e UUID, nunca owner/campos derivados", async () => {
    for (const patch of [{ parcelasIds: [] }, { parcelasIds: [20, 20] }, { parcelasIds: [0] }, { parcelasIds: [1.5] }, { parcelasIds: [2147483648] }, { parcelasIds: Array.from({ length: 61 }, (_, i) => i + 1) }, { parcelasIds: null }, { idcontrato: 0 }, { idcontrato: 1.5 }, { idempotencyKey: "bad" }, { userId: 7 }, { p_user_id: 7 }, { owner: 7 }, { contaCaixaId: 40 }, { quantidade: 2 }, { trilho: "multa36" }]) {
      const c = client(aplicado);
      await expect(aplicarMulta(c, 7, { ...aplicacao, ...patch } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(c.rpc).not.toHaveBeenCalled();
    }
    expect(pure.aplicarMultaSchema.safeParse({ ...aplicacao, multa: "9999999999.99", parcelasIds: Array.from({ length: 60 }, (_, i) => i + 1) }).success).toBe(true);
  });
  it("consultas/recebimento/renovação têm schemas próprios, sem família antiga ou campos financeiros extras", async () => {
    for (const [schema, input] of [[pure.consultaMultaSchema, consulta], [pure.consultaRenovacaoMultaSchema, consultaRenovacao], [pure.receberMultaSchema, recebimento], [pure.renovarMultaSchema, renovacao]] as const) {
      for (const patch of [{ userId: 7 }, { p_user_id: 7 }, { owner: 7 }, { contratoId: 0 }, { parcelaId: 2147483648 }]) expect(schema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
    for (const patch of [{ valorRecebido: "122.33" }, { valorRecebido: "0.00" }, { totalExigido: "0.00" }, { valorRecebido: 122.34 }, { estadoHash: "A".repeat(64) }, { modo: "desconto" }, { dataPagamento: "2027-02-29" }, { multa: "12.34" }, { observacoes: "x".repeat(1001) }]) {
      const c = client(recebido); await expect(receberMulta(c, 7, { ...recebimento, ...patch } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
    }
    for (const patch of [{ valorRecebido: "22.33" }, { novoVencimento: "2028-02-28" }, { novoVencimento: "2028-02-30" }, { modo: "renovar" }, { principalPreservado: "100.00" }]) {
      const c = client(renovado); await expect(renovarMulta(c, 7, { ...renovacao, ...patch } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
    }
    expect(pure.receberMultaSchema.safeParse({ ...recebimento, modo: "parcial", valorRecebido: "0.01" }).success).toBe(true);
    expect(pure.receberMultaSchema.safeParse({ ...recebimento, modo: "parcial" }).success).toBe(false);
  });
});

describe("RPC único, owner de sessão e parâmetros CONTRACT exatos", () => {
  it("aplica seleção explícita ou automática sem recalcular vencidos ou cotar", async () => {
    const c = client(aplicado);
    expect(await aplicarMulta(c, 7, aplicacao)).toEqual(aplicado);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_aplicar_multa36", { p_user_id: 7, p_chave_idempotencia: KEY, p_contrato_id: 10, p_multa: "12.34", p_parcelas_ids: [20, 21] });
    const { parcelasIds: _, ...auto } = aplicacao;
    const a = client(aplicado); expect(await aplicarMulta(a, 7, auto)).toEqual(aplicado);
    expect(a.rpc).toHaveBeenCalledOnce(); expect(a.rpc).toHaveBeenCalledWith("rpc_aplicar_multa36", { p_user_id: 7, p_chave_idempotencia: KEY, p_contrato_id: 10, p_multa: "12.34", p_parcelas_ids: null });
  });
  it("origem identifica tenant/IDs exatos e aceita somente null SQL explícito", async () => {
    const c = client(origem); expect(await identificarMulta(c, 7, consulta)).toEqual(origem);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_identificar_multa36", { p_user_id: 7, p_contrato_id: 10, p_parcela_id: 20 });
    expect(await identificarMulta(client(null), 7, consulta)).toBeNull();
    await expect(identificarMulta(client(null, { code: "42501" }), 7, consulta)).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const data of [undefined, {}, { ...origem, userId: 8 }, { ...origem, contratoId: 11 }, { ...origem, parcelaId: 21 }, { ...origem, trilho: "multimodal" }, { ...origem, owner: 7 }]) await expect(identificarMulta(client(data), 7, consulta)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("cota DATE BRT/hash/regra sem usar relógio/fuso do cliente", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2030-01-01T01:00:00Z"));
    const c = client(cotacao); expect(await cotarMulta(c, 7, consulta)).toEqual(cotacao);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_cotar_multa36", { p_user_id: 7, p_contrato_id: 10, p_parcela_id: 20 });
    const q = client(cotacaoRenovacao); expect(await cotarRenovacaoMulta(q, 7, consultaRenovacao)).toEqual(cotacaoRenovacao);
    expect(q.rpc).toHaveBeenCalledOnce(); expect(q.rpc).toHaveBeenCalledWith("rpc_cotar_renovacao_multa36", { p_user_id: 7, p_contrato_id: 10, p_parcela_id: 20, p_novo_vencimento: "2028-03-31" });
  });
  it("recebe integral/parcial preservando residual, sem cotação extra, e não envia conta/owner do payload", async () => {
    const c = client(recebido); expect(await receberMulta(c, 7, { ...recebimento, observacoes: "  anotação  " })).toEqual(recebido);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_receber_multa36", { p_user_id: 7, p_chave_idempotencia: KEY, p_contrato_id: 10, p_parcela_id: 20, p_valor_recebido: "122.34", p_total_exigido: "122.34", p_data_pagamento: "2028-02-29", p_estado_hash: HASH, p_modo: "integral", p_observacoes: "anotação" });
    const i = { ...recebimento, modo: "parcial" as const, valorRecebido: "40.00" };
    const r = { ...recebido, valorRecebido: "40.00", saldoResidual: "82.34", valorPagoAcumulado: "40.00", status: "parcial", contratoStatus: "ativo" };
    expect(await receberMulta(client(r), 7, i)).toEqual(r);
    expect(await receberMulta(client({ ...recebido, totalExigido: "82.34", valorRecebido: "82.34" }), 7, { ...recebimento, totalExigido: "82.34", valorRecebido: "82.34" })).toMatchObject({ valorPagoAcumulado: "122.34", saldoResidual: "0.00" });
  });
  it("renova uma vez, sem principal ou modo extra, e não herda multa em valores calculados locais", async () => {
    const c = client(renovado); expect(await renovarMulta(c, 7, renovacao)).toEqual(renovado);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_renovar_multa36", { p_user_id: 7, p_chave_idempotencia: KEY, p_contrato_id: 10, p_parcela_id: 20, p_valor_recebido: "22.34", p_total_exigido: "22.34", p_data_pagamento: "2028-02-29", p_estado_hash: HASH, p_novo_vencimento: "2028-03-31", p_observacoes: null });
    expect(Object.keys(c.rpc.mock.calls[0][1])).not.toEqual(expect.arrayContaining(["p_principal", "p_modo", "p_conta_caixa_id"]));
  });
});

describe("normalizadores refletem IDs/centavos/regra e não certificam resposta parcial", () => {
  it("aplicação exige quantidade exata, seleção inteira e sem IDs externos/duplicados", async () => {
    for (const patch of [{ parcelasIds: [20, 20] }, { parcelasIds: [20, 22] }, { parcelasIds: [20] }, { parcelasIds: [20, 21, 22] }, { quantidade: 1 }, { quantidade: 3 }, { valorMultaTotal: "24.67" }, { valorFixoPorParcela: "12.35" }, { contratoId: 11 }, { contaCaixaId: 0 }, { estado: "recebida" }, { trilho: "multimodal" }, { success: false }, { dataCivilBrt: "2028-02-30" }, { userId: 7 }, { transacaoCaixaId: "1" }]) {
      await expect(aplicarMulta(client({ ...aplicado, ...patch }), 7, aplicacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    }
    expect(pure.normalizarAplicacaoMulta({ ...aplicado, parcelasIds: [21, 20], repetida: true }, aplicacao)).toMatchObject({ repetida: true, parcelasIds: [21, 20] });
    expect(() => pure.normalizarAplicacaoMulta({ ...aplicado, valorFixoPorParcela: "9999999999.99", valorMultaTotal: "19999999999.98" }, { ...aplicacao, multa: "9999999999.99" })).toThrow();
  });
  it("cotação exige booleano/IDs/date/hash/regra explícitos e evita centavos impossíveis", async () => {
    for (const patch of [{ contratoId: 11 }, { parcelaId: 21 }, { totalExigido: "0.00" }, { totalExigido: "1.00" }, { elegivel: "true" }, { status: "paga" }, { status: "parcial" }, { valorPagoAcumulado: "0.01" }, { estadoHash: "A".repeat(64) }, { dataPagamento: "2028-02-30" }, { regra: "recebimento_multimodal_brt_v1" }, { snapshot: {} }]) await expect(cotarMulta(client({ ...cotacao, ...patch }), 7, consulta)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(await cotarMulta(client({ ...cotacao, elegivel: false, totalExigido: "0.00", valorPagoAcumulado: "122.34", status: "paga" }), 7, consulta)).toMatchObject({ elegivel: false });
    expect(await cotarMulta(client({ ...cotacao, totalExigido: "82.34", valorPagoAcumulado: "40.00", status: "parcial" }), 7, consulta)).toMatchObject({ status: "parcial" });
    for (const patch of [{ contratoId: 11 }, { parcelaId: 21 }, { novoVencimento: "2028-03-30" }, { totalExigido: "22.33" }, { principalPreservado: "0.00" }, { dataPagamento: "2028-04-01" }, { renovavel: 1 }, { regra: "renovacao_multimodal_brt_v1" }, { principal: "100.00" }]) await expect(cotarRenovacaoMulta(client({ ...cotacaoRenovacao, ...patch }), 7, consultaRenovacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(await cotarRenovacaoMulta(client({ ...cotacaoRenovacao, renovavel: false }), 7, consultaRenovacao)).toMatchObject({ renovavel: false });
  });
  it("cotação falsa não encobre aberto exigível e renovável não encobre juros zero", async () => {
    for (const patch of [{ elegivel: false }, { status: "cancelada", elegivel: false }, { status: "renovada", elegivel: false }])
      await expect(cotarMulta(client({ ...cotacao, ...patch }), 7, consulta)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(cotarRenovacaoMulta(client({ ...cotacaoRenovacao, juros: "0.00", totalExigido: "12.34" }), 7, consultaRenovacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("recebimento exige modo/saldo/status/acumulado/intenção correspondentes", async () => {
    for (const patch of [{ contratoId: 11 }, { parcelaId: 21 }, { valorRecebido: "122.33" }, { totalExigido: "122.35" }, { saldoResidual: "0.01" }, { valorPagoAcumulado: "122.33" }, { dataPagamento: "2028-03-01" }, { status: "parcial" }, { regra: "multimodal_v1" }, { success: false }, { desconto: "0.00" }]) await expect(receberMulta(client({ ...recebido, ...patch }), 7, recebimento)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(receberMulta(client({ ...recebido, valorRecebido: "40.00", saldoResidual: "82.34", status: "parcial" }), 7, { ...recebimento, valorRecebido: "40.00", modo: "parcial" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("renovação exige sucessora diferente e todos os campos de intenção exatos", async () => {
    for (const patch of [{ contratoId: 11 }, { parcelaId: 21 }, { novaParcelaId: 20 }, { valorRecebido: "22.33" }, { novoVencimento: "2028-03-30" }, { dataPagamento: "2028-03-01" }, { status: "cancelada" }, { contratoStatus: "quitado" }, { totalExigido: "22.34" }, { regra: "multimodal_v1" }, { principalPreservado: "100.00" }]) await expect(renovarMulta(client({ ...renovado, ...patch }), 7, renovacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it.each(["0", "-1", "01", "1.0", "NaN", "9223372036854775808", 9007199254740992, BigInt(4)])("bigint caixa %s não sofre coerção/overflow", async transacaoCaixaId => {
    for (const w of writes.slice(1)) await expect((w.call as Function)(client({ ...w.result, transacaoCaixaId }), 7, w.input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("bigint caixa 2^53+1 e limite int64 permanecem strings", async () => {
    expect((await receberMulta(client(recebido), 7, recebimento)).transacaoCaixaId).toBe("9007199254740993");
    expect((await renovarMulta(client({ ...renovado, transacaoCaixaId: "9223372036854775807" }), 7, renovacao)).transacaoCaixaId).toBe("9223372036854775807");
  });
});

describe("JSON hostil sem execução de getter nem herança", () => {
  function hostile(base: object) {
    let reads = 0;
    const getter = { ...base }; Object.defineProperty(getter, "evil", { enumerable: true, get: () => { reads++; throw new Error("getter"); } });
    const hidden = { ...base }; Object.defineProperty(hidden, "owner", { value: 7 });
    const cyclic = { ...base, self: null as unknown }; cyclic.self = cyclic;
    const bad = [getter, hidden, cyclic, Object.assign(Object.create({ userId: 7 }), base), { ...base, [Symbol("owner")]: 7 }, new Date(), new Map(), [base], new Proxy({}, { ownKeys() { throw new Error("proxy"); } })];
    return { bad, reads: () => reads };
  }
  it("malícia em intenção é BAD_REQUEST sem RPC", async () => {
    for (const w of writes) {
      const h = hostile(w.input);
      for (const input of h.bad) { const c = client(w.result); await expect((w.call as Function)(c, 7, input)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled(); }
      expect(h.reads()).toBe(0);
    }
    const c = client(aplicado); await expect(aplicarMulta(c, 7, { ...aplicacao, parcelasIds: [20, , 21] } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
  });
  it("malícia em confirmação/envelope/erro é INTERNAL sem executar accessors", async () => {
    const h = hostile(aplicado);
    for (const data of [...h.bad, { ...aplicado, parcelasIds: [20, , 21] }, null, "ok", true]) await expect(aplicarMulta(client(data), 7, aplicacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(h.reads()).toBe(0);
    const e = hostile({ code: "42501" });
    for (const error of e.bad) await expect(aplicarMulta(client(null, error), 7, aplicacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(e.reads()).toBe(0);
    const r = hostile({ data: aplicado, error: null });
    for (const envelope of r.bad) await expect(aplicarMulta({ rpc: vi.fn().mockResolvedValue(envelope) }, 7, aplicacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(r.reads()).toBe(0);
    expect(await aplicarMulta(client(Object.assign(Object.create(null), aplicado)), 7, aplicacao)).toEqual(aplicado);
  });
});

describe("SDK real, envelope contraditório e erro não prova rollback", () => {
  it("SDK instalado usa fetch simulado sem rede para cada endpoint inclusive reconciliação", async () => {
    const calls = [
      [(c: any) => disponibilidadeMulta(c, 7), capacidade], [(c: any) => aplicarMulta(c, 7, aplicacao), aplicado],
      [(c: any) => identificarMulta(c, 7, consulta), origem], [(c: any) => identificarMulta(c, 7, consulta), null],
      [(c: any) => cotarMulta(c, 7, consulta), cotacao], [(c: any) => receberMulta(c, 7, recebimento), recebido],
      [(c: any) => cotarRenovacaoMulta(c, 7, consultaRenovacao), cotacaoRenovacao], [(c: any) => renovarMulta(c, 7, renovacao), renovado],
      [(c: any) => reconciliarMulta(c, 7, request), proof],
    ] as const;
    for (const [call, data] of calls) {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } }));
      const sdk = createClient("https://example.invalid", "chave-sintetica", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
      expect(await call(sdk)).toEqual(data === proof ? wrapped : data); expect(fetchMock).toHaveBeenCalledTimes(1);
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "42501", message: "private snapshot", details: null, hint: null }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const sdk = createClient("https://example.invalid", "chave-sintetica", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
    await expect(aplicarMulta(sdk, 7, aplicacao)).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("success opcional do SDK é coerente, mas nunca substitui data/prova completa", async () => {
    expect(await aplicarMulta({ rpc: vi.fn().mockResolvedValue({ data: aplicado, error: null }) }, 7, aplicacao)).toEqual(aplicado);
    for (const response of [null, undefined, {}, { data: aplicado }, { error: null }, { data: aplicado, error: undefined }, { data: aplicado, error: false }, { data: aplicado, error: "error" }, { data: null, error: { code: 1 } }, { data: aplicado, error: null, owner: 7 }, { data: aplicado, error: null, success: false }, { data: null, error: { code: "42501" }, success: true }, { data: aplicado, error: null, success: "true" }, { data: aplicado, error: { code: "42501" } }, { data: aplicado, error: null, status: 400 }, { data: null, error: { code: "42501" }, status: 200 }, { data: { success: true }, error: null, success: true }, { data: aplicado, error: null, count: 1.5 }, { data: aplicado, error: null, statusText: false }, { data: null, error: { code: "42501", owner: 7 } }]) {
      const c = { rpc: vi.fn().mockResolvedValue(response) }; await expect(aplicarMulta(c, 7, aplicacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(c.rpc).toHaveBeenCalledOnce();
    }
  });
  it.each([["22023", "BAD_REQUEST"], ["22007", "BAD_REQUEST"], ["22008", "BAD_REQUEST"], ["22P02", "BAD_REQUEST"], ["22003", "BAD_REQUEST"], ["23505", "CONFLICT"], ["23514", "CONFLICT"], ["40001", "CONFLICT"], ["40P01", "CONFLICT"], ["55000", "CONFLICT"], ["42501", "NOT_FOUND"], ["PGRST202", "PRECONDITION_FAILED"], ["42883", "PRECONDITION_FAILED"], ["42P01", "PRECONDITION_FAILED"], ["XX000", "INTERNAL_SERVER_ERROR"]])("%s classifica %s sem SQL privado/fallback", async (sql, code) => {
    const c = client(null, { code: sql, message: "private snapshot secret" });
    await expect(aplicarMulta(c, 7, aplicacao)).rejects.toMatchObject({ code });
    await expect(aplicarMulta(c, 7, aplicacao)).rejects.not.toThrow(/private snapshot/);
    expect(c.rpc).toHaveBeenCalledTimes(2);
    expect(c.rpc.mock.calls.every(([name, p]) => name === "rpc_aplicar_multa36" && p.p_chave_idempotencia === KEY)).toBe(true);
  });
  it.each(writes)("$name preserva UUID/payload no timeout e retry explícito", async w => {
    const before = JSON.stringify(w.input);
    const c = { rpc: vi.fn().mockRejectedValueOnce(new Error("timeout private")).mockResolvedValueOnce({ data: { ...w.result, repetida: true }, error: null }) };
    await expect((w.call as Function)(c, 7, w.input)).rejects.toThrow(/mesmo UUID\/payload; timeout não prova rollback/);
    expect(c.rpc).toHaveBeenCalledOnce();
    vi.useFakeTimers(); vi.setSystemTime(new Date("2030-01-01"));
    expect((await (w.call as Function)(c, 7, w.input)).repetida).toBe(true);
    expect(c.rpc.mock.calls[0]).toEqual(c.rpc.mock.calls[1]); expect(JSON.stringify(w.input)).toBe(before);
  });
});

describe("capacidade fail-closed", () => {
  it("consulta somente a RPC instalada e não infere disponibilidade por flags", async () => {
    const c = client(capacidade); expect(await disponibilidadeMulta(c, 7)).toEqual(capacidade);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_capacidades_multa36", {});
    for (const data of [null, {}, { ...capacidade, disponivel: false }, { ...capacidade, aplicacao: false }, { ...capacidade, recebimento: false }, { ...capacidade, renovacao: false }, { ...capacidade, regra: "multa36" }, { ...capacidade, owner: 7 }]) await expect(disponibilidadeMulta(client(data), 7)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it.each(["PGRST202", "42883"])("ausência %s vira false apenas com erro válido", async code => {
    const c = client(null, { code }); expect(await disponibilidadeMulta(c, 7)).toEqual(pure.multaIndisponivel); expect(c.rpc).toHaveBeenCalledOnce();
    await expect(disponibilidadeMulta({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code }, success: true }) }, 7)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("outros erros/transportes não são ausência", async () => {
    for (const code of ["42P01", "55000", "42501", "XX000"]) await expect(disponibilidadeMulta(client(null, { code }), 7)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(disponibilidadeMulta({ rpc: vi.fn().mockRejectedValue(new Error("timeout")) }, 7)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

describe("reconciliação cycle36: SQL preciso e wrapper owner/action/request seguros", () => {
  it.each(writes)("confirmed $name valida resultado completo, ID prova e apenas um RPC", async w => {
    const req = recovery(w.name, w.input), c = client({ ...proof, result: w.result });
    const r = await reconciliarMulta(c, 7, req);
    expect(r).toEqual({ ...proof, result: w.result, userId: 7, acao: w.name, payload: req.payload });
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_reconciliar_multa36", { p_user_id: 7, p_chave_idempotencia: KEY, p_request: pure.requestSqlRecuperacaoMulta(req) });
    expect(pure.normalizarRecuperacaoMulta(r, 7, req)).toEqual(r);
  });
  it("SQL request exclui owner/UUID, normaliza defaults sem alterar payload da UI", () => {
    expect(pure.requestSqlRecuperacaoMulta(request)).toEqual({ acao: "multa", contratoId: 10, multa: "12.34", parcelasIds: [20, 21] });
    expect(pure.requestSqlRecuperacaoMulta(recovery("receber", recebimento))).toEqual({ acao: "receber", ...consulta, valorRecebido: "122.34", totalExigido: "122.34", dataPagamento: "2028-02-29", estadoHash: HASH, modo: "integral", observacoes: null });
    expect(pure.requestSqlRecuperacaoMulta(recovery("renovar", { ...renovacao, observacoes: "  nota  " }))).toEqual({ acao: "renovar", ...consultaRenovacao, valorRecebido: "22.34", totalExigido: "22.34", dataPagamento: "2028-02-29", estadoHash: HASH, modo: "renovar", observacoes: "nota" });
    const { parcelasIds: _, ...auto } = aplicacao;
    expect(pure.requestSqlRecuperacaoMulta(recovery("multa", auto))).toEqual({ acao: "multa", contratoId: 10, multa: "12.34", parcelasIds: null });
  });
  it("not_executed aceita somente fence36 explícito com operationId/result null", async () => {
    const p = { ...proof, status: "not_executed", operationId: null, result: null };
    const c = client(p); expect(await reconciliarMulta(c, 7, request)).toEqual({ ...p, userId: 7, acao: "multa", payload: request.payload }); expect(c.rpc).toHaveBeenCalledOnce();
    for (const patch of [{ operationId: OP }, { result: {} }, { proof: "uuid_fenced_v1" }, { proof: undefined }, { status: "pending" }, { idempotencyKey: OP }, { quote: null }, { fenceId: OP }]) await expect(reconciliarMulta(client({ ...p, ...patch }), 7, request)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(reconciliarMulta(client(null, { code: "40001" }), 7, request)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reconciliarMulta(client(null, { code: "22023" }), 7, request)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("SQL proof strict recusa mismatch IDs/result/status/key/family", async () => {
    const noResult = { ...proof } as any; delete noResult.result;
    for (const data of [noResult, { ...proof, operationId: KEY }, { ...proof, operationId: null }, { ...proof, result: null }, { ...proof, result: recebido }, { ...proof, result: { ...aplicado, parcelasIds: [20, 22] } }, { ...proof, idempotencyKey: OP }, { ...proof, family: "multimodal_criar" }, { ...proof, userId: 7 }, { ...proof, acao: "receber" }, { ...proof, payload: request.payload }, { ...proof, payloadHash: HASH }, { ...proof, proof: "uuid_fenced_v1" }]) await expect(reconciliarMulta(client(data), 7, request)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect((await reconciliarMulta(client({ ...proof, idempotencyKey: KEY.toUpperCase() }), 7, request)).status).toBe("confirmed");
  });
  it("wrapper UI compara owner/ação/UUID/payload/proof, hash opcional somente por formato", () => {
    expect(pure.normalizarRecuperacaoMulta(wrapped, 7, request)).toEqual(wrapped);
    expect(pure.normalizarRecuperacaoMulta({ ...wrapped, payloadHash: HASH }, 7, request).payloadHash).toBe(HASH);
    const reordered = Object.fromEntries(Object.entries(request.payload).reverse());
    expect(pure.normalizarRecuperacaoMulta({ ...wrapped, payload: reordered, idempotencyKey: KEY.toUpperCase() }, 7, request).status).toBe("confirmed");
    for (const value of [proof, { ...wrapped, userId: 8 }, { ...wrapped, acao: "receber" }, { ...wrapped, idempotencyKey: OP }, { ...wrapped, payload: { ...request.payload, multa: "12.35" } }, { ...wrapped, payload: { ...request.payload, owner: 7 } }, { ...wrapped, payloadHash: "bad" }, { ...wrapped, proof: "uuid_fenced_v1" }, { ...wrapped, family: "multimodal_criar" }, { ...wrapped, result: recebido }]) expect(() => pure.normalizarRecuperacaoMulta(value, 7, request)).toThrow();
  });
  it("não aceita payload de outra ação, owner/UUID ou normalizado SQL como input UI", async () => {
    for (const patch of [{ acao: "criar" }, { family: "multimodal_criar" }, { userId: 7 }, { payload: { ...request.payload, userId: 7 } }, { payload: { ...request.payload, p_user_id: 7 } }, { payload: { ...request.payload, idempotencyKey: KEY } }, { payload: pure.requestSqlRecuperacaoMulta(request) }, { acao: "receber" }, { payload: { ...request.payload, parcelasIds: [20, 20] } }]) {
      const c = client(proof); await expect(reconciliarMulta(c, 7, { ...request, ...patch } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
    }
  });
  it("recovery hostil também falha antes de getters e rede", async () => {
    let reads = 0; const payload = { ...request.payload };
    Object.defineProperty(payload, "multa", { enumerable: true, get() { reads++; throw new Error("getter"); } });
    const c = client(proof); await expect(reconciliarMulta(c, 7, { ...request, payload })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled(); expect(reads).toBe(0);
    const malicious = { ...wrapped }; Object.defineProperty(malicious, "userId", { enumerable: true, get() { reads++; return 7; } });
    expect(() => pure.normalizarRecuperacaoMulta(malicious, 7, request)).toThrow(); expect(reads).toBe(0);
  });
});
