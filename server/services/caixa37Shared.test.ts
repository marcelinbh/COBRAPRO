import { readFileSync } from "node:fs";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import * as p from "../../shared/caixa37";

export const KEY = "abcdefab-1234-4234-8234-123456789012";
export const OP = "87654321-4321-4321-8321-210987654321";
export const HASH = "a".repeat(64);
const input = { contaDestinoId: 20, valor: "12.34", dataTransacao: "2028-02-29", estadoHash: HASH, idempotencyKey: KEY };
const transfer = { ...input, contaOrigemId: 10 };
const intent = p.congelarIntencaoAporte37(input);
const ti = p.congelarIntencaoTransferencia37(transfer);
const conta = { contaCaixaId: 20, nome: "Destino", saldoBase: "-10.00", entradas: "3.00", saidas: "1.00", saldoEfetivo: "-8.00" };
const quote = { elegivel: true, regra: "caixa37_brt_v1", ...intent.request, origem: null, destino: conta, saldoOrigemApos: null,
  saldoDestinoApos: "4.34", saldoTotalOwnerAntes: "100.00", saldoTotalOwnerApos: "112.34" };
const result = { success: true, regra: "caixa37_v1", operationId: OP, idempotencyKey: KEY, repetida: false,
  acao: "aporte", contaOrigemId: null, contaDestinoId: 20, valor: "12.34", dataTransacao: "2028-02-29", descricao: null,
  pernas: [{ papel: "aporte", tipo: "entrada", contaCaixaId: 20, transacaoCaixaId: "123", valor: "12.34" }],
  saldoOrigemAntes: null, saldoOrigemApos: null, saldoDestinoAntes: "-8.00", saldoDestinoApos: "4.34", saldoTotalOwnerAntes: "100.00", saldoTotalOwnerApos: "112.34" };
const tr = { ...result, acao: "transferir", contaOrigemId: 10, saldoOrigemAntes: "0.00", saldoOrigemApos: "-12.34", saldoTotalOwnerApos: "100.00",
  pernas: [{ papel: "origem", tipo: "saida", contaCaixaId: 10, transacaoCaixaId: "124", valor: "12.34" }, { papel: "destino", tipo: "entrada", contaCaixaId: 20, transacaoCaixaId: "125", valor: "12.34" }] };
const proof = { userId: 7, idempotencyKey: KEY, request: intent.request, requestHash: HASH, proof: "uuid_fenced37_v1", status: "confirmed", operationId: OP, result };
let assertions = 0;
afterEach(() => { assertions += expect.getState().assertionCalls; });
afterAll(() => console.log(`caixa37Shared assertions: ${assertions}`));
function hostile(base: object) {
  let reads = 0;
  const getter = { ...base }; Object.defineProperty(getter, "evil", { enumerable: true, get() { reads++; throw new Error("getter"); } });
  const fieldGetter = { ...base }; const key = Object.keys(base)[0]; Object.defineProperty(fieldGetter, key, { enumerable: true, get() { reads++; throw new Error("getter"); } });
  const hidden = { ...base }; Object.defineProperty(hidden, "hidden", { value: 1 });
  const cycle = { ...base, self: null as unknown }; cycle.self = cycle;
  return { bad: [getter, fieldGetter, hidden, cycle, Object.assign(Object.create({ owner: 9 }), base), { ...base, evil: undefined },
    { ...base, [Symbol("x")]: 1 }, new Date(), new Map(), new Set(), [base], new Proxy({}, { ownKeys() { throw Error("proxy"); } })], reads: () => reads };
}

describe("schemas próprios37 e congelamento", () => {
  it("shared independente, BigInt sem float, operação conservadora e base física", () => {
    const src = readFileSync(new URL("../../shared/caixa37.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*(?:server|node:|db)|process\.env|parseFloat|toFixed|new Date/);
    expect(p.monetaryBigInt("9999999999.99")).toBe(BigInt("999999999999"));
    expect(p.monetaryBigInt("-9999999999999999999999999999999999.99")).toBe(-BigInt("999999999999999999999999999999999999"));
    expect(p.decimalCaixa37(BigInt(-1))).toBe("-0.01"); expect(p.decimalCaixa37(BigInt(0))).toBe("0.00");
    expect(p.contaSaldo37Schema.safeParse({ ...conta, saldoBase: "9999999999999.99" }).success).toBe(true);
    expect(p.contaSaldo37Schema.safeParse({ ...conta, saldoBase: "10000000000000.00" }).success).toBe(false);
    expect(p.aportar37Schema.safeParse({ ...input, valor: p.CAIXA37_MAX_VALOR }).success).toBe(true);
  });
  it.each(["0.00", "-1.00", "+1.00", "-0.00", "01.00", "1", "1.0", "1.000", "1e2", " 1.00", "1.00 ", "1,00", "10000000000.00", "NaN", "Infinity", 1, null, undefined, NaN, Infinity, BigInt(1)])("input monetário %s recusa", valor => {
    expect(p.aportar37Schema.safeParse({ ...input, valor }).success).toBe(false);
    expect(p.transferir37Schema.safeParse({ ...transfer, valor }).success).toBe(false);
  });
  it.each(["-0.00", "+1.00", "01.00", "1e30", "1.000", "NaN", "Infinity", "", 1, null, undefined])("decimal total %s recusa sem coagir", value => {
    expect(() => p.monetaryBigInt(value as string)).toThrow();
    expect(p.cotacao37Schema.safeParse({ ...quote, saldoTotalOwnerAntes: value }).success).toBe(false);
  });
  it("UUID lowercase antes freeze e descrição uma forma canônica sem alteração do input", () => {
    const i = { ...input, idempotencyKey: KEY.toUpperCase(), descricao: "  recebido  " };
    const frozen = p.congelarIntencaoAporte37(i);
    expect(frozen.idempotencyKey).toBe(KEY); expect(frozen.request.descricao).toBe("recebido");
    expect(Object.isFrozen(frozen)).toBe(true); expect(Object.isFrozen(frozen.request)).toBe(true);
    expect(i.descricao).toBe("  recebido  "); expect(i.idempotencyKey).toBe(KEY.toUpperCase());
    for (const descricao of [undefined, "", "  \n\t "]) expect(p.congelarIntencaoAporte37({ ...input, ...(descricao === undefined ? {} : { descricao }) }).request.descricao).toBeNull();
    for (const descricao of [null, 3, "x".repeat(501)]) expect(p.aportar37Schema.safeParse({ ...input, descricao }).success).toBe(false);
    expect(p.congelarIntencaoAporte37({ ...input, descricao: `  ${"x".repeat(500)}  ` }).request.descricao).toHaveLength(500);
    for (const descricao of ["", " ", " recebido ", undefined]) expect(p.recovery37Schema.safeParse({ ...frozen, request: { ...frozen.request, descricao } }).success).toBe(false);
    expect(p.congelarRecovery37(frozen)).toEqual(frozen);
  });
  it.each([0, -1, 1.1, 2147483648, Number.MAX_SAFE_INTEGER, NaN, Infinity, "20", null])("ID físico %s recusa", contaDestinoId => {
    expect(p.aportar37Schema.safeParse({ ...input, contaDestinoId }).success).toBe(false);
  });
  it("campos extras, ausência e ações cruzadas rejeitados", () => {
    for (const patch of [{ userId: 9 }, { owner: 9 }, { p_user_id: 9 }, { empresaId: 9 }, { operationId: OP }, { pernas: [] }, { source: "rpc" }, { ativo: true }, { categoria: "ajuste_manual" }, { tipo: "entrada" }, { contaOrigemId: null }, { estadoHash: "A".repeat(64) }, { idempotencyKey: "bad" }]) expect(p.aportar37Schema.safeParse({ ...input, ...patch }).success).toBe(false);
    expect(p.transferir37Schema.safeParse({ ...transfer, contaOrigemId: 20 }).success).toBe(false);
    expect(p.cotarCaixa37Schema.safeParse({ acao: "transferir", contaDestinoId: 20, valor: "1.00" }).success).toBe(false);
    expect(p.cotarCaixa37Schema.safeParse({ acao: "aporte", contaOrigemId: 10, contaDestinoId: 20, valor: "1.00" }).success).toBe(false);
    for (const key of Object.keys(intent.request)) {
      const r = { ...intent.request } as any; delete r[key]; expect(p.recovery37Schema.safeParse({ ...intent, request: r }).success).toBe(false);
    }
    expect(p.request37Schema.safeParse({ ...intent.request, contaOrigemId: 10 }).success).toBe(false);
    expect(p.request37Schema.safeParse({ ...ti.request, contaOrigemId: null }).success).toBe(false);
  });
  it("JSON hostil recusa antes getters, inclusive nested e arrays extras/holes", () => {
    const h = hostile(input);
    for (const v of h.bad) expect(p.aportar37Schema.safeParse(v).success).toBe(false);
    expect(h.reads()).toBe(0);
    expect(p.aportar37Schema.safeParse(Object.assign(Object.create(null), input)).success).toBe(true);
    const r = hostile(intent.request); for (const request of r.bad) expect(p.recovery37Schema.safeParse({ ...intent, request }).success).toBe(false);
    expect(r.reads()).toBe(0);
    const x = hostile(result); for (const v of x.bad) expect(() => p.normalizarResultado37(v, intent)).toThrow(); expect(x.reads()).toBe(0);
    const array = [...result.pernas]; Object.defineProperty(array, "extra", { value: 1, enumerable: true });
    for (const pernas of [array, [result.pernas[0], , result.pernas[0]]]) expect(p.resultado37Schema.safeParse({ ...result, pernas }).success).toBe(false);
    let reads = 0; const getterArray = [...result.pernas]; Object.defineProperty(getterArray, "0", { enumerable: true, get() { reads++; return result.pernas[0]; } });
    expect(p.resultado37Schema.safeParse({ ...result, pernas: getterArray }).success).toBe(false); expect(reads).toBe(0);
  });
  it.each(["1899-12-31", "1900-02-29", "2100-02-29", "2027-02-29", "2028-02-30", "2028-04-31", "2028-00-01", "2028-13-01", "2028-01-00", "10000-01-01", "2028-2-29", "2028-02-29T00:00:00Z", new Date()])("DATE %s recusa", dataTransacao => {
    expect(p.aportar37Schema.safeParse({ ...input, dataTransacao }).success).toBe(false);
  });
  it.each(["1900-01-01", "2000-02-29", "2028-02-29", "9999-12-31"])("DATE civil %s aceita", date => {
    expect(p.dataCaixa37Valida(date)).toBe(true);
  });
});

describe("quote/result37 equações e provas exatas", () => {
  it("aporte aceita negativo e total ilimitado inclui outras contas, não exige somar só seleção", () => {
    expect(p.normalizarCotacao37(quote, { acao: "aporte", contaDestinoId: 20, valor: "12.34" })).toEqual(quote);
    expect(p.normalizarResultado37(result, intent)).toEqual(result);
    const before = "9007199254740993000000000000000000.00", after = "9007199254740993000000000000000012.34";
    expect(p.normalizarCotacao37({ ...quote, saldoTotalOwnerAntes: before, saldoTotalOwnerApos: after }, { acao: "aporte", contaDestinoId: 20, valor: "12.34" }).saldoTotalOwnerApos).toBe(after);
    expect(p.normalizarResultado37({ ...result, saldoTotalOwnerAntes: before, saldoTotalOwnerApos: after }, intent).saldoTotalOwnerApos).toBe(after);
  });
  it("transferência negativa possível; duas pernas ordenadas, total invariável", () => {
    const origin = { ...conta, contaCaixaId: 10, nome: "Origem", saldoBase: "0.00", entradas: "0.00", saidas: "0.00", saldoEfetivo: "0.00" };
    const tq = { ...quote, ...ti.request, origem: origin, saldoOrigemApos: "-12.34", saldoTotalOwnerApos: "100.00" };
    expect(p.normalizarCotacao37(tq, { acao: "transferir", contaOrigemId: 10, contaDestinoId: 20, valor: "12.34" })).toEqual(tq);
    expect(p.normalizarResultado37(tr, ti)).toEqual(tr);
    for (const patch of [{ origem: null }, { contaOrigemId: 11 }, { saldoOrigemApos: null }, { saldoOrigemApos: "0.00" }, { saldoTotalOwnerApos: "112.34" }, { origem: { ...origin, contaCaixaId: 11 } }]) expect(() => p.normalizarCotacao37({ ...tq, ...patch }, { acao: "transferir", contaOrigemId: 10, contaDestinoId: 20, valor: "12.34" })).toThrow();
  });
  it("quote recusa eco divergente/missing/double envelope/false/integridade", () => {
    for (const patch of [{ valor: "12.35" }, { acao: "transferir" }, { descricao: "outra" }, { contaDestinoId: 21 }, { origem: conta }, { saldoOrigemApos: "0.00" }, { elegivel: false }, { destino: { ...conta, contaCaixaId: 21 } }, { destino: { ...conta, saldoEfetivo: "0.00" } }, { destino: { ...conta, entradas: "-1.00" } }, { saldoDestinoApos: "4.35" }, { saldoTotalOwnerApos: "112.35" }, { regra: "caixa36_v1" }, { dataTransacao: "2028-02-30" }, { estadoHash: "A".repeat(64) }, { snapshots: [] }]) expect(() => p.normalizarCotacao37({ ...quote, ...patch }, { acao: "aporte", contaDestinoId: 20, valor: "12.34" })).toThrow();
    for (const key of Object.keys(quote)) { const q = { ...quote } as any; delete q[key]; expect(() => p.normalizarCotacao37(q, { acao: "aporte", contaDestinoId: 20, valor: "12.34" })).toThrow(); }
    expect(() => p.normalizarCotacao37({ data: quote, error: null }, { acao: "aporte", contaDestinoId: 20, valor: "12.34" })).toThrow();
    for (const descricao of ["", "  ", " nota "]) expect(() => p.normalizarCotacao37({ ...quote, descricao: "nota" }, { acao: "aporte", contaDestinoId: 20, valor: "12.34", descricao })).toThrow();
  });
  it("result exige cada eco, equação, campo e tamanho exato; replay somente muda repetida", () => {
    for (const patch of [{ idempotencyKey: OP }, { idempotencyKey: KEY.toUpperCase() }, { operationId: KEY.toUpperCase() }, { operationId: "bad" }, { contaDestinoId: 21 }, { contaOrigemId: 10 }, { valor: "12.35" }, { descricao: "outra" }, { dataTransacao: "2028-03-01" }, { saldoOrigemAntes: "0.00" }, { saldoOrigemApos: "0.00" }, { saldoDestinoApos: "4.35" }, { saldoTotalOwnerApos: "100.00" }, { pernas: [] }, { pernas: [result.pernas[0], result.pernas[0]] }, { success: false }, { regra: "caixa36_v1" }, { estadoHash: HASH }]) expect(() => p.normalizarResultado37({ ...result, ...patch }, intent)).toThrow();
    for (const key of Object.keys(result)) { const r = { ...result } as any; delete r[key]; expect(() => p.normalizarResultado37(r, intent)).toThrow(); }
    expect(p.normalizarResultado37({ ...result, repetida: true }, intent).repetida).toBe(true);
  });
  it("pernas int32 string sem UUID/coerção e nenhuma perna extra/cruzada", () => {
    for (const transacaoCaixaId of ["0", "-1", "01", "1.0", "2147483648", "9007199254740993", OP, 123, BigInt(123)]) expect(() => p.normalizarResultado37({ ...result, pernas: [{ ...result.pernas[0], transacaoCaixaId }] }, intent)).toThrow();
    expect(p.normalizarResultado37({ ...result, pernas: [{ ...result.pernas[0], transacaoCaixaId: "2147483647" }] }, intent).pernas[0].transacaoCaixaId).toBe("2147483647");
    for (const patch of [{ papel: "destino" }, { tipo: "saida" }, { contaCaixaId: 21 }, { valor: "12.33" }, { valor: "-12.34" }, { userId: 8 }]) expect(() => p.normalizarResultado37({ ...result, pernas: [{ ...result.pernas[0], ...patch }] }, intent)).toThrow();
    for (const pernas of [[...tr.pernas].reverse(), [tr.pernas[0]], [...tr.pernas, result.pernas[0]], [tr.pernas[0], { ...tr.pernas[1], transacaoCaixaId: "124" }], [tr.pernas[0], { ...tr.pernas[1], tipo: "saida" }]]) expect(() => p.normalizarResultado37({ ...tr, pernas }, ti)).toThrow();
    for (const patch of [{ saldoOrigemAntes: null }, { saldoOrigemApos: null }, { saldoOrigemApos: "-12.33" }, { saldoTotalOwnerApos: "112.34" }]) expect(() => p.normalizarResultado37({ ...tr, ...patch }, ti)).toThrow();
  });
});

describe("recovery37 owner/request/chave/hash/status/fence strict", () => {
  it("confirmed é histórico original e not_executed só fence explícito", () => {
    expect(p.normalizarRecovery37(proof, 7, intent)).toEqual(proof);
    const fence = { ...proof, status: "not_executed", operationId: null, result: null };
    expect(p.normalizarRecovery37(fence, 7, intent)).toEqual(fence);
    expect(p.normalizarRecovery37({ ...proof, request: Object.fromEntries(Object.entries(intent.request).reverse()) }, 7, intent)).toEqual(proof);
    const tp = { ...proof, request: ti.request, result: tr }; expect(p.normalizarRecovery37(tp, 7, ti)).toEqual(tp);
  });
  it("não enxerta owner nem hash; falta de campo/status null/erro jamais fecha", () => {
    for (const patch of [{ userId: 8 }, { userId: null }, { idempotencyKey: OP }, { idempotencyKey: KEY.toUpperCase() }, { requestHash: "bad" }, { requestHash: "A".repeat(64) }, { requestHash: null }, { proof: "uuid_fenced36_v1" }, { proof: null }, { status: null }, { status: "pending" }, { operationId: null }, { operationId: KEY }, { result: null }, { result: { ...result, repetida: true } }, { result: tr }, { error: "timeout" }]) expect(() => p.normalizarRecovery37({ ...proof, ...patch }, 7, intent)).toThrow();
    for (const key of Object.keys(proof)) { const r = { ...proof } as any; delete r[key]; expect(() => p.normalizarRecovery37(r, 7, intent)).toThrow(); }
    expect(() => p.normalizarRecovery37(proof, 8, intent)).toThrow();
    for (const [key, value] of Object.entries({ acao: "transferir", contaOrigemId: 10, contaDestinoId: 21, valor: "12.35", descricao: "outra", dataTransacao: "2028-03-01", estadoHash: "b".repeat(64) })) expect(() => p.normalizarRecovery37({ ...proof, request: { ...intent.request, [key]: value } }, 7, intent)).toThrow();
    const fence = { ...proof, status: "not_executed", operationId: null, result: null };
    for (const patch of [{ operationId: OP }, { result }, { result: {} }, { proof: "not_found" }, { status: null }]) expect(() => p.normalizarRecovery37({ ...fence, ...patch }, 7, intent)).toThrow();
  });
  it("recuperação hostil recusa nested/prototype/accessor sem leitura", () => {
    const h = hostile(proof); for (const v of h.bad) expect(() => p.normalizarRecovery37(v, 7, intent)).toThrow(); expect(h.reads()).toBe(0);
    const nested = hostile(intent.request); for (const request of nested.bad) expect(() => p.normalizarRecovery37({ ...proof, request }, 7, intent)).toThrow(); expect(nested.reads()).toBe(0);
  });
});
