import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import * as pure from "../../shared/emprestimosMultimodalCalculo";
import {
  calcularMultimodal, gerarAgendaMultimodal, modalidadesMultimodal, tipoTaxaMultimodal,
  entradaMultimodalSchema, consultaMultimodalSchema, consultaRenovacaoMultimodalSchema,
  recebimentoMultimodalSchema, renovacaoMultimodalSchema, validarCriacaoMultimodal, normalizarCriacaoMultimodal,
  criarMultimodal, cotarMultimodal, receberMultimodal, cotarRenovacaoMultimodal, renovarMultimodal,
  chamarMultimodal, reconciliarMultimodal,
  type EntradaMultimodal, type EntradaRecebimentoMultimodal, type EntradaRenovacaoMultimodal,
  type ModalidadeMultimodal, type RecuperacaoMultimodal,
} from "./emprestimosMultimodalRpc";

const KEY = "12345678-1234-4234-8234-123456789012";
const OP = "87654321-4321-4321-8321-210987654321";
const HASH = "a".repeat(64);
const consulta = { contratoId: 10, parcelaId: 20 };
const criacao: EntradaMultimodal = {
  idempotencyKey: KEY, clienteId: 30, contaCaixaId: 40, modalidade: "tabela_price", tipoTaxa: "mensal",
  valorPrincipal: "1000.00", taxaJuros: "10.00", numeroParcelas: 3,
  dataInicio: "2028-01-01", dataDesembolso: "2028-01-01", vencimentos: ["2028-01-31", "2028-02-29", "2028-03-31"],
  multaAtraso: "2.0000", jurosMoraDiario: "0.0330",
};
const criado = {
  success: true, repetida: false, id: 10, operationId: OP, parcelasIds: [20, 21, 22], transacaoCaixaId: "9007199254740993",
  valorParcela: "402.11", totalContrato: "1206.35", jurosTotal: "206.35", numeroParcelas: 3,
  dataDesembolso: "2028-01-01", vencimentos: criacao.vencimentos, status: "ativo", regra: "multimodal_v1",
  modalidade: "tabela_price", tipoTaxa: "mensal", multaAtraso: "2.0000", jurosMoraDiario: "0.0330",
};
const recebimento: EntradaRecebimentoMultimodal = {
  ...consulta, idempotencyKey: KEY, valorRecebido: "110.00", totalExigido: "110.00", dataPagamento: "2028-02-29", estadoHash: HASH, modo: "integral",
};
const cotacao = {
  ...consulta, contaCaixaId: 40, elegivel: true, totalExigido: "110.00", multa: "0.00", mora: "0.00", jurosEmbutidos: "10.00",
  valorPagoAcumulado: "0.00", dataPagamento: "2028-02-29", vencimento: "2028-02-29", status: "vencendo_hoje", estadoHash: HASH, regra: "recebimento_multimodal_brt_v1",
};
const recebido = {
  ...consulta, success: true, repetida: false, operationId: OP, transacaoCaixaId: "9007199254740993", contaCaixaId: 40,
  valorRecebido: "110.00", totalExigido: "110.00", saldoResidual: "0.00", valorPagoAcumulado: "110.00", status: "paga", contratoStatus: "quitado",
  dataPagamento: "2028-02-29", regra: "recebimento_multimodal_brt_v1",
};
const consultaRenovacao = { ...consulta, novoVencimento: "2028-03-31" };
const renovacao: EntradaRenovacaoMultimodal = {
  ...consultaRenovacao, idempotencyKey: KEY, valorRecebido: "10.00", totalExigido: "10.00", dataPagamento: "2028-02-29", estadoHash: HASH,
};
const cotacaoRenovacao = {
  ...consultaRenovacao, contaCaixaId: 40, renovavel: true, totalExigido: "10.00", juros: "10.00", multa: "0.00", mora: "0.00", principalPreservado: "100.00",
  dataPagamento: "2028-02-29", estadoHash: HASH, regra: "renovacao_multimodal_brt_v1",
};
const renovado = {
  ...consultaRenovacao, success: true, repetida: false, operationId: OP, novaParcelaId: 21, transacaoCaixaId: "9007199254740993", contaCaixaId: 40,
  valorRecebido: "10.00", dataPagamento: "2028-02-29", contratoStatus: "ativo", status: "renovada", regra: "renovacao_multimodal_brt_v1",
};
const client = (data: unknown, error: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error, success: error === null, count: null, status: error === null ? 200 : 400, statusText: error === null ? "OK" : "Bad Request" }) });
const cents = (s: string) => BigInt(s.replace(".", ""));
function conservar(c: pure.CalculoMultimodal) {
  const total = c.parcelas.reduce((s, p) => s + cents(p.valor), BigInt(0));
  const juros = c.parcelas.reduce((s, p) => s + cents(p.valorJuros), BigInt(0));
  expect(total).toBe(cents(c.totalContrato)); expect(juros).toBe(cents(c.jurosTotal)); expect(total - juros).toBe(cents(c.valorPrincipal));
  for (const p of c.parcelas) { expect(cents(p.valor)).toBeGreaterThan(BigInt(0)); expect(cents(p.valorJuros)).toBeGreaterThanOrEqual(BigInt(0)); expect(cents(p.valorJuros)).toBeLessThanOrEqual(cents(p.valor)); }
}
afterEach(() => vi.useRealTimers());

describe("cálculo compartilhado puro", () => {
  it("é reexportado sem wrappers e não importa backend, ENV, DB ou TRPCError", () => {
    expect(calcularMultimodal).toBe(pure.calcularMultimodal); expect(gerarAgendaMultimodal).toBe(pure.gerarAgendaMultimodal);
    const source = readFileSync(new URL("../../shared/emprestimosMultimodalCalculo.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/(?:from\s+["'][^"']*(?:server|node:|db)|process\.env|import\.meta\.env|TRPCError|fetch\s*\()/);
    expect(Object.isFrozen(tipoTaxaMultimodal)).toBe(true);
  });
  it.each(["mensal", "semanal", "quinzenal"] as const)("%s preserva juros simples de cada período x N", modalidade => {
    const c = calcularMultimodal("1000", "10", 3, modalidade);
    expect(c).toMatchObject({ valorPrincipal: "1000.00", taxaJuros: "10.00", valorParcela: "433.33", totalContrato: "1300.00", jurosTotal: "300.00" });
    expect(c.parcelas).toEqual([{ valor: "433.33", valorJuros: "100.00" }, { valor: "433.33", valorJuros: "100.00" }, { valor: "433.34", valorJuros: "100.00" }]); conservar(c);
  });
  it("diário usa taxa única e rateia o resto de valor e juros somente na última linha", () => {
    const c = calcularMultimodal("1000.00", "10.00", 3, "diario");
    expect(c.totalContrato).toBe("1100.00"); expect(c.jurosTotal).toBe("100.00");
    expect(c.parcelas).toEqual([{ valor: "366.67", valorJuros: "33.33" }, { valor: "366.67", valorJuros: "33.33" }, { valor: "366.66", valorJuros: "33.34" }]); conservar(c);
  });
  it("Price usa o vetor Decimal independente 1000/10/3, não juros simples", () => {
    const c = calcularMultimodal("1000", "10", 3, "tabela_price");
    expect(c.parcelas).toEqual([{ valor: "402.11", valorJuros: "100.00" }, { valor: "402.11", valorJuros: "69.79" }, { valor: "402.13", valorJuros: "36.56" }]);
    expect(c.totalContrato).toBe("1206.35"); expect(c.jurosTotal).toBe("206.35"); conservar(c);
  });
  it("confere Price com oráculo Decimal de 160 dígitos, independente de BigInt compartilhado", () => {
    const vectors = [["1000", "10", 3], ["1000", "10", 60], ["10000.01", "1.25", 60], ["999999.99", "0.01", 60], ["12000", "0", 60], ["1000.01", "999.99", 1]] as const;
    const python = `import json,sys\nfrom decimal import Decimal,localcontext,ROUND_HALF_UP\nwith localcontext() as ctx:\n ctx.prec=160\n results=[]\n for p,r,n in json.loads(sys.argv[1]):\n  balance=Decimal(p); rate=Decimal(r)/100; cent=Decimal('0.01')\n  ref=(balance/n if rate==0 else balance*rate/(1-(1+rate)**(-n))).quantize(cent,rounding=ROUND_HALF_UP)\n  rows=[]\n  for j in range(n):\n   interest=(balance*rate).quantize(cent,rounding=ROUND_HALF_UP)\n   payment=balance+interest if j==n-1 else ref\n   rows.append({'valor':str(payment),'valorJuros':str(interest)})\n   balance-=payment-interest\n  results.append(rows)\n print(json.dumps(results))`;
    const oracle = JSON.parse(execFileSync("python3", ["-c", python, JSON.stringify(vectors)], { encoding: "utf8" })) as unknown[];
    vectors.forEach(([p, r, n], i) => { const c = calcularMultimodal(p, r, n, "tabela_price"); expect(c.parcelas).toEqual(oracle[i]); conservar(c); });
  });
  it.each(modalidadesMultimodal)("%s suporta n1, n60 e taxa zero com conservação de centavos", modalidade => {
    expect(calcularMultimodal("123.45", "0", 1, modalidade).parcelas).toEqual([{ valor: "123.45", valorJuros: "0.00" }]);
    const c = calcularMultimodal("12000", "0", 60, modalidade); expect(c.parcelas).toHaveLength(60); expect(c.totalContrato).toBe("12000.00"); conservar(c);
    const bullet = calcularMultimodal("1000", "10", 1, modalidade); expect(bullet.totalContrato).toBe("1100.00"); conservar(bullet);
    const longa = calcularMultimodal("12000.01", "1.25", 60, modalidade); expect(longa.parcelas).toHaveLength(60); conservar(longa);
    const empate = calcularMultimodal("0.05", "0", 2, modalidade);
    expect(empate.parcelas).toEqual([{ valor: "0.03", valorJuros: "0.00" }, { valor: "0.02", valorJuros: "0.00" }]); conservar(empate);
  });
  it("limita NUMERIC(12,2), exige precisão explícita e rejeita nulos/amortização inválida", () => {
    expect(calcularMultimodal("9999999999.99", "0", 1, "mensal").totalContrato).toBe("9999999999.99");
    expect(calcularMultimodal("0.01", "50", 1, "mensal").totalContrato).toBe("0.02");
    const invalid: [number | string, number | string, number, ModalidadeMultimodal][] = [
      ["10000000000.00", "0", 1, "mensal"], ["9999999999.99", "0.01", 1, "mensal"], ["0", "0", 1, "mensal"], ["-1", "0", 1, "mensal"],
      ["1.001", "0", 1, "mensal"], ["1", "0.001", 1, "mensal"], ["1", "1000", 1, "mensal"], ["1", "-1", 1, "mensal"],
      ["1e3", "1", 1, "mensal"], [NaN, "1", 1, "mensal"], [Infinity, "1", 1, "mensal"], ["1", "1", 0, "mensal"], ["1", "1", 61, "mensal"], ["1", "1", 1.5, "mensal"],
      ["0.01", "0", 60, "mensal"], ["0.01", "0", 60, "tabela_price"], ["1000", "999.99", 60, "tabela_price"], ["1", "1", 1, "outra" as ModalidadeMultimodal],
    ];
    for (const args of invalid) {
      try { calcularMultimodal(...args); throw new Error("accepted"); }
      catch (e) { expect(e).toBeInstanceOf(Error); expect(e).not.toBeInstanceOf(TRPCError); expect((e as Error).message).not.toBe("accepted"); }
    }
    expect(() => calcularMultimodal({ toString: () => "1" } as unknown as string, "0", 1, "mensal")).toThrow(/decimal inválido/);
  });
});

describe("calendário civil 2000..2100", () => {
  it.each(["mensal", "tabela_price"] as const)("%s ancora fim de mês e recupera março após fevereiro", modalidade => {
    expect(gerarAgendaMultimodal("2028-01-31", 4, modalidade)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30"]);
    expect(gerarAgendaMultimodal("2027-01-30", 3, modalidade)).toEqual(["2027-01-30", "2027-02-28", "2027-03-30"]);
  });
  it.each([["semanal", ["2028-02-28", "2028-03-06", "2028-03-13"]], ["quinzenal", ["2028-02-28", "2028-03-14", "2028-03-29"]], ["diario", ["2028-02-28", "2028-02-29", "2028-03-01"]]] as const)("%s usa passo civil sem horário", (modalidade, datas) => {
    expect(gerarAgendaMultimodal("2028-02-28", 3, modalidade)).toEqual(datas);
  });
  it("rejeita datas inexistentes, timestamps e agendas que ultrapassam 2100", () => {
    for (const s of ["1999-12-31", "2101-01-01", "2100-02-29", "2027-02-29", "2028-02-30", "2028-2-29", "2028-02-29T00:00:00Z", "invalid", "2028-04-31"]) { expect(pure.dataMultimodalValida(s)).toBe(false); expect(() => gerarAgendaMultimodal(s, 1, "mensal")).toThrow(); }
    for (const s of ["2000-01-01", "2000-02-29", "2028-02-29", "2100-12-31"]) expect(pure.dataMultimodalValida(s)).toBe(true);
    for (const modalidade of modalidadesMultimodal) { expect(gerarAgendaMultimodal("2100-12-31", 1, modalidade)).toEqual(["2100-12-31"]); expect(() => gerarAgendaMultimodal("2100-12-31", 2, modalidade)).toThrow(); }
    for (const n of [0, 61, NaN, 1.5]) expect(() => gerarAgendaMultimodal("2028-01-31", n, "mensal")).toThrow();
  });
  it("tem o mesmo calendário em UTC, Brasília e fusos extremos", () => {
    // Execuções locais, sem rede; somente TZ é alterado no processo filho.
    const script = `import {gerarAgendaMultimodal} from './shared/emprestimosMultimodalCalculo.ts'; console.log(JSON.stringify(['mensal','diario','semanal','quinzenal'].map(m=>gerarAgendaMultimodal('2028-01-31',4,m))));`;
    const outputs = ["UTC", "America/Sao_Paulo", "Pacific/Kiritimati", "America/Los_Angeles"].map(TZ => execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { cwd: new URL("../../", import.meta.url), env: { ...process.env, TZ }, encoding: "utf8" }).trim());
    expect(new Set(outputs).size).toBe(1);
  });
});

describe("intenção estrita antes de qualquer RPC", () => {
  it("criação valida o mapa modalidade/tipoTaxa e agenda explícita", () => {
    for (const modalidade of modalidadesMultimodal) {
      const i = { ...criacao, modalidade, tipoTaxa: tipoTaxaMultimodal[modalidade], vencimentos: gerarAgendaMultimodal("2028-01-31", 3, modalidade) };
      expect(validarCriacaoMultimodal(7, i).entrada.modalidade).toBe(modalidade);
    }
  });
  it("rejeita owner/campos calculados, IDs/UUID, agenda e precisão sem executar RPC", async () => {
    for (const patch of [{ userId: 99 }, { p_user_id: 99 }, { owner: 7 }, { totalContrato: "1206.35" }, { status: "ativo" }, { clienteId: 0 }, { contaCaixaId: 2147483648 }, { idempotencyKey: "bad" }, { numeroParcelas: 0 }, { modalidade: "mensal", tipoTaxa: "diaria" }, { dataInicio: "1999-12-31" }, { dataDesembolso: "2028-01-02" }, { vencimentos: ["2028-01-31", "2028-02-29"] }, { vencimentos: ["2028-01-31", "2028-02-29", "2028-03-29"] }, { vencimentos: ["2027-01-31", "2027-02-28", "2027-03-31"] }, { valorPrincipal: "0" }, { taxaJuros: "10.001" }, { multaAtraso: "2.00001" }, { jurosMoraDiario: "10000" }, { jurosMoraDiario: "-0.01" }]) {
      const c = client(criado); await expect(criarMultimodal(c, 7, { ...criacao, ...patch } as EntradaMultimodal)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
    }
    expect(entradaMultimodalSchema.safeParse({ ...criacao, userId: 7 }).success).toBe(false);
    for (const owner of [0, -1, 1.5, NaN, 2147483648]) { const c = client(criado); await expect(criarMultimodal(c, owner, criacao)).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(c.rpc).not.toHaveBeenCalled(); }
  });
  it("consulta/recebimento/renovação convertem Zod em BAD_REQUEST antes da chamada", async () => {
    for (const [schema, input] of [[consultaMultimodalSchema, consulta], [consultaRenovacaoMultimodalSchema, consultaRenovacao], [recebimentoMultimodalSchema, recebimento], [renovacaoMultimodalSchema, renovacao]] as const) {
      for (const patch of [{ userId: 7 }, { p_user_id: 7 }, { parcelaId: -1 }, { contratoId: 2147483648 }]) expect(schema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
    for (const patch of [{ modo: "desconto" }, { valorRecebido: "109.99" }, { totalExigido: "0.00", valorRecebido: "0.00" }, { valorRecebido: 110 }, { valorRecebido: "110.000" }, { estadoHash: "A".repeat(64) }, { estadoHash: "a".repeat(63) }, { dataPagamento: "2028-02-30" }, { multa: "1.00" }, { idempotencyKey: "bad" }]) {
      const c = client(recebido); await expect(receberMultimodal(c, 7, { ...recebimento, ...patch } as EntradaRecebimentoMultimodal)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
    }
    const invalidCalls = [() => cotarMultimodal(client(null), 7, { ...consulta, parcelaId: 0 }), () => cotarRenovacaoMultimodal(client(null), 7, { ...consultaRenovacao, novoVencimento: "2101-01-01" }), () => renovarMultimodal(client(null), 7, { ...renovacao, valorRecebido: "110.00" }), () => renovarMultimodal(client(null), 7, { ...renovacao, novoVencimento: "2028-02-28" })];
    for (const call of invalidCalls) await expect(call()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(recebimentoMultimodalSchema.safeParse({ ...recebimento, modo: "parcial", valorRecebido: "0.01" }).success).toBe(true);
    expect(recebimentoMultimodalSchema.safeParse({ ...recebimento, modo: "parcial" }).success).toBe(false);
  });
});

describe("fronteira RPC única, tenant somente do servidor", () => {
  it("criação envia chaves SQL exatas, dinheiro/encargos normalizados e desembolso único", async () => {
    const c = client(criado); expect(await criarMultimodal(c, 7, { ...criacao, valorPrincipal: 1000, taxaJuros: 10, multaAtraso: 2, jurosMoraDiario: "0.033", descricao: "  teste  ", observacoes: "  " })).toEqual(criado);
    expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.rpc).toHaveBeenCalledWith("rpc_criar_emprestimo_multimodal", {
      p_user_id: 7, p_chave_idempotencia: KEY, p_cliente_id: 30, p_conta_caixa_id: 40, p_modalidade: "tabela_price", p_tipo_taxa: "mensal", p_valor_principal: "1000.00", p_taxa_juros: "10.00", p_numero_parcelas: 3,
      p_data_inicio: "2028-01-01", p_data_desembolso: "2028-01-01", p_vencimentos: criacao.vencimentos, p_descricao: "teste", p_observacoes: null, p_multa_atraso: "2.0000", p_juros_mora_diario: "0.0330",
    });
  });
  it("cota uma vez sem recalcular a data Brasília pelo relógio/fuso do cliente", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2030-01-01T01:00:00Z"));
    const c = client(cotacao); expect(await cotarMultimodal(c, 7, consulta)).toEqual(cotacao); expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledWith("rpc_cotar_emprestimo_multimodal", { p_user_id: 7, p_contrato_id: 10, p_parcela_id: 20 });
    const pago = { ...cotacao, elegivel: false, totalExigido: "0.00", valorPagoAcumulado: "110.00", status: "paga" }; expect(await cotarMultimodal(client(pago), 7, consulta)).toEqual(pago);
    const parcial = { ...cotacao, totalExigido: "60.00", valorPagoAcumulado: "50.00", status: "parcial" }; expect(await cotarMultimodal(client(parcial), 7, consulta)).toEqual(parcial);
  });
  it("recebe integral/parcial com conservação residual, sem cotação extra ou desconto", async () => {
    const c = client(recebido); expect(await receberMultimodal(c, 7, recebimento)).toEqual(recebido); expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledWith("rpc_receber_emprestimo_multimodal", { p_user_id: 7, p_chave_idempotencia: KEY, p_contrato_id: 10, p_parcela_id: 20, p_valor_recebido: "110.00", p_total_exigido: "110.00", p_data_pagamento: "2028-02-29", p_estado_hash: HASH, p_modo: "integral", p_observacoes: null });
    const i = { ...recebimento, modo: "parcial" as const, valorRecebido: "40.00" };
    const r = { ...recebido, valorRecebido: "40.00", saldoResidual: "70.00", valorPagoAcumulado: "40.00", status: "parcial", contratoStatus: "ativo" };
    expect(await receberMultimodal(client(r), 7, i)).toEqual(r);
    const ultimo = { ...recebimento, totalExigido: "70.00", valorRecebido: "70.00" }; expect(await receberMultimodal(client({ ...recebido, totalExigido: "70.00", valorRecebido: "70.00" }), 7, ultimo)).toMatchObject({ valorPagoAcumulado: "110.00", saldoResidual: "0.00" });
  });
  it("renovação cotada exclui principal e envia somente juros/encargos uma vez", async () => {
    const q = client(cotacaoRenovacao); expect(await cotarRenovacaoMultimodal(q, 7, consultaRenovacao)).toEqual(cotacaoRenovacao); expect(q.rpc).toHaveBeenCalledTimes(1);
    expect(q.rpc).toHaveBeenCalledWith("rpc_cotar_renovacao_multimodal", { p_user_id: 7, p_contrato_id: 10, p_parcela_id: 20, p_novo_vencimento: "2028-03-31" });
    const c = client(renovado); expect(await renovarMultimodal(c, 7, renovacao)).toEqual(renovado); expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledWith("rpc_renovar_emprestimo_multimodal", { p_user_id: 7, p_chave_idempotencia: KEY, p_contrato_id: 10, p_parcela_id: 20, p_valor_recebido: "10.00", p_total_exigido: "10.00", p_data_pagamento: "2028-02-29", p_estado_hash: HASH, p_novo_vencimento: "2028-03-31", p_observacoes: null });
    expect(Object.keys(c.rpc.mock.calls[0][1])).not.toEqual(expect.arrayContaining(["p_principal", "p_conta_caixa_id", "p_modo"]));
    const next = { ...renovacao, parcelaId: 21, novoVencimento: "2028-04-30" }; expect(await renovarMultimodal(client({ ...renovado, parcelaId: 21, novaParcelaId: 22, novoVencimento: "2028-04-30" }), 7, next)).toMatchObject({ novaParcelaId: 22 });
  });
});

describe("respostas estritas e reflexão da intenção", () => {
  it("criação rejeita duplicados, regra/modalidade/encargos/agenda/cálculo divergentes", async () => {
    const patches = [{ userId: 7 }, { id: 0 }, { operationId: "bad" }, { parcelasIds: [20, 20, 22] }, { parcelasIds: [20, 21] }, { numeroParcelas: 4 }, { status: "quitado" }, { regra: "mensal_simples_v1" }, { modalidade: "mensal" }, { tipoTaxa: "diaria" }, { valorParcela: "402.12" }, { totalContrato: "1206.34" }, { jurosTotal: "206.34" }, { totalContrato: 1206.35 }, { totalContrato: "1206.350" }, { jurosTotal: "NaN" }, { multaAtraso: "2.00" }, { jurosMoraDiario: "0.0340" }, { dataDesembolso: "2028-01-02" }, { vencimentos: ["2028-01-31", "2028-02-29", "2028-03-30"] }];
    for (const patch of patches) { const c = client({ ...criado, ...patch }); await expect(criarMultimodal(c, 7, criacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(c.rpc).toHaveBeenCalledTimes(1); }
    expect(() => normalizarCriacaoMultimodal({ ...criado, private: {} }, 7, criacao)).toThrow(TRPCError);
  });
  it("preserva bigints em strings e rejeita zero, negativos, overflow e arredondamento IEEE754", async () => {
    expect((await criarMultimodal(client({ ...criado, transacaoCaixaId: "9223372036854775807" }), 7, criacao)).transacaoCaixaId).toBe("9223372036854775807");
    for (const transacaoCaixaId of ["0", "-1", "01", "1.0", "NaN", "9223372036854775808", "99999999999999999999", 9007199254740992, BigInt(4)]) {
      for (const [fn, result, input] of [[criarMultimodal, criado, criacao], [receberMultimodal, recebido, recebimento], [renovarMultimodal, renovado, renovacao]] as const) await expect((fn as Function)(client({ ...result, transacaoCaixaId }), 7, input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    }
    expect(pure.resultadoCriacaoMultimodalSchema.safeParse({ ...criado, transacaoCaixaId: "bad" }).success).toBe(false);
  });
  it("cotações rejeitam IDs/hash/date/status/regra/owner e elegibilidade incoerentes", async () => {
    for (const patch of [{ contratoId: 11 }, { parcelaId: 21 }, { contaCaixaId: 0 }, { totalExigido: "0.00" }, { totalExigido: 110 }, { status: "renovada" }, { status: "paga" }, { status: "parcial" }, { valorPagoAcumulado: "1.00" }, { estadoHash: "A".repeat(64) }, { dataPagamento: "2028-02-30" }, { regra: "renovacao_multimodal_brt_v1" }, { snapshot: {} }]) await expect(cotarMultimodal(client({ ...cotacao, ...patch }), 7, consulta)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    for (const patch of [{ contratoId: 11 }, { parcelaId: 21 }, { novoVencimento: "2028-03-30" }, { totalExigido: "110.00" }, { juros: "0.00", totalExigido: "0.00" }, { principalPreservado: "0.00" }, { dataPagamento: "2028-04-01" }, { estadoHash: "bad" }, { regra: "recebimento_multimodal_brt_v1" }, { principal: "100.00" }]) await expect(cotarRenovacaoMultimodal(client({ ...cotacaoRenovacao, ...patch }), 7, consultaRenovacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(await cotarRenovacaoMultimodal(client({ ...cotacaoRenovacao, renovavel: false, juros: "0.00", totalExigido: "0.00" }), 7, consultaRenovacao)).toMatchObject({ renovavel: false });
  });
  it("recebimento exige reflexão exata de modo/data/valores e saldo/status consistentes", async () => {
    for (const patch of [{ contratoId: 11 }, { parcelaId: 21 }, { valorRecebido: "109.99" }, { totalExigido: "110.01" }, { saldoResidual: "0.01" }, { valorPagoAcumulado: "109.99" }, { dataPagamento: "2028-03-01" }, { status: "parcial" }, { regra: "multimodal_v1" }, { success: false }, { desconto: "0.00" }, { contaCaixaId: 0 }]) await expect(receberMultimodal(client({ ...recebido, ...patch }), 7, recebimento)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    const partial = { ...recebimento, modo: "parcial" as const, valorRecebido: "40.00" };
    await expect(receberMultimodal(client({ ...recebido, valorRecebido: "40.00", saldoResidual: "70.00", valorPagoAcumulado: "40.00", status: "parcial", contratoStatus: "quitado" }), 7, partial)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("renovação mantém schema SQL exato, sem valores extras ou antecessor como nova parcela", async () => {
    for (const patch of [{ contratoId: 11 }, { parcelaId: 21 }, { novaParcelaId: 20 }, { valorRecebido: "110.00" }, { novoVencimento: "2028-03-30" }, { dataPagamento: "2028-03-01" }, { status: "cancelada" }, { contratoStatus: "quitado" }, { regra: "multimodal_v1" }, { principalPreservado: "100.00" }, { totalExigido: "10.00" }]) await expect(renovarMultimodal(client({ ...renovado, ...patch }), 7, renovacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("não aceita instâncias, chaves herdadas, getters, symbols, ciclos ou sparse arrays", async () => {
    let reads = 0;
    const getter = { ...criado }; Object.defineProperty(getter, "totalContrato", { enumerable: true, get: () => { reads++; throw new Error("getter"); } });
    const inherited = Object.assign(Object.create({ userId: 7 }), criado);
    const cyclic = { ...criado, self: null as unknown }; cyclic.self = cyclic;
    const symbol = { ...criado, [Symbol("owner")]: 7 };
    const hidden = { ...criado }; Object.defineProperty(hidden, "userId", { value: 7 });
    const sparse = { ...criado, parcelasIds: [20, , 22] };
    for (const value of [getter, inherited, cyclic, symbol, hidden, sparse, new Date(), [criado], null, "ok", true, new Map(), new Proxy({}, { ownKeys() { throw new Error("proxy"); } })]) {
      await expect(criarMultimodal(client(value), 7, criacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
      expect(pure.resultadoCriacaoMultimodalSchema.safeParse(value).success).toBe(false);
    }
    expect(reads).toBe(0);
    const maliciousInput = { ...criacao }; Object.defineProperty(maliciousInput, "valorPrincipal", { enumerable: true, get: () => { reads++; return "1000"; } });
    const c = client(criado); await expect(criarMultimodal(c, 7, maliciousInput)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled(); expect(reads).toBe(0);
    expect(pure.jsonMultimodalSeguro(Object.assign(Object.create(null), criado))).toBe(true);
  });
});

describe("SQL/transporte fail-closed e mesmo UUID", () => {
  it("SDK instalado confirma dados completos e classifica recusa SQL com success booleano, sem rede", async () => {
    for (const [call, data] of [
      [(c: ReturnType<typeof createClient>) => criarMultimodal(c, 7, criacao), criado],
      [(c: ReturnType<typeof createClient>) => cotarMultimodal(c, 7, consulta), cotacao],
      [(c: ReturnType<typeof createClient>) => receberMultimodal(c, 7, recebimento), recebido],
      [(c: ReturnType<typeof createClient>) => renovarMultimodal(c, 7, renovacao), renovado],
    ] as const) {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } }));
      const sdk = createClient("https://example.invalid", "chave-sintetica", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
      expect(await call(sdk)).toEqual(data); expect(fetchMock).toHaveBeenCalledTimes(1);
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "42501", message: "private snapshot", details: null, hint: null }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const sdk = createClient("https://example.invalid", "chave-sintetica", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
    await expect(cotarMultimodal(sdk, 7, consulta)).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("success do SDK não substitui resultado financeiro ou prova autoritativa de recuperação", async () => {
    for (const envelope of [{ data: criado, error: null, success: false }, { data: criado, error: { code: "42501" }, success: true }, { data: criado, error: null, success: "true" }, { data: { success: true }, error: null, success: true }]) {
      await expect(criarMultimodal({ rpc: vi.fn().mockResolvedValue(envelope) }, 7, criacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    }
    const { idempotencyKey, ...payload } = criacao;
    const req = { family: "multimodal_criar" as const, idempotencyKey, payload };
    const evidence = { userId: 7, ...req, payloadHash: HASH, proof: "uuid_fenced_v1", status: "confirmed", fenceId: null, result: criado, quote: null };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(evidence), { status: 200, headers: { "Content-Type": "application/json" } }));
    const sdk = createClient("https://example.invalid", "chave-sintetica", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock } });
    expect((await reconciliarMultimodal(sdk, 7, req)).result).toEqual(criado); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([["22023", "BAD_REQUEST"], ["22007", "BAD_REQUEST"], ["22008", "BAD_REQUEST"], ["22P02", "BAD_REQUEST"], ["22003", "BAD_REQUEST"], ["23505", "CONFLICT"], ["23514", "CONFLICT"], ["40001", "CONFLICT"], ["40P01", "CONFLICT"], ["55000", "CONFLICT"], ["42501", "NOT_FOUND"], ["PGRST202", "PRECONDITION_FAILED"], ["42883", "PRECONDITION_FAILED"], ["42P01", "PRECONDITION_FAILED"], ["XX000", "INTERNAL_SERVER_ERROR"]])("%s mapeia %s sem fallback e sem detalhes SQL", async (sql, code) => {
    const c = client(null, { code: sql, message: "private snapshot secret" });
    await expect(criarMultimodal(c, 7, criacao)).rejects.toMatchObject({ code });
    await expect(criarMultimodal(c, 7, criacao)).rejects.not.toThrow(/private snapshot/);
    expect(c.rpc).toHaveBeenCalledTimes(2); expect(c.rpc.mock.calls.every(([name, p]) => name === "rpc_criar_emprestimo_multimodal" && p.p_chave_idempotencia === KEY)).toBe(true);
  });
  it("envelope malformado nunca é data/sucesso; getter não é executado", async () => {
    let reads = 0; const getter = { data: criado }; Object.defineProperty(getter, "error", { enumerable: true, get: () => { reads++; return null; } });
    for (const envelope of [null, undefined, {}, { data: criado }, { error: null }, { data: criado, error: undefined }, { data: criado, error: false }, { data: criado, error: "error" }, { data: criado, error: { code: 1 } }, { data: criado, error: null, owner: 7 }, getter]) {
      const c = { rpc: vi.fn().mockResolvedValue(envelope) }; await expect(criarMultimodal(c, 7, criacao)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" }); expect(c.rpc).toHaveBeenCalledTimes(1);
    }
    expect(reads).toBe(0);
    expect(await criarMultimodal({ rpc: vi.fn().mockResolvedValue({ data: criado, error: null, count: null, status: 200, statusText: "OK" }) }, 7, criacao)).toEqual(criado);
  });
  it("timeout não prova rollback, não repete automaticamente e preserva UUID/payload ao repetir", async () => {
    const before = JSON.stringify(criacao); const c = { rpc: vi.fn().mockRejectedValueOnce(new Error("timeout private")).mockResolvedValueOnce({ data: { ...criado, repetida: true }, error: null }) };
    await expect(criarMultimodal(c, 7, criacao)).rejects.toThrow(/mesmo UUID\/payload; timeout não prova rollback/); expect(c.rpc).toHaveBeenCalledTimes(1);
    vi.useFakeTimers(); vi.setSystemTime(new Date("2030-01-01")); expect((await criarMultimodal(c, 7, criacao)).repetida).toBe(true);
    expect(c.rpc.mock.calls[0]).toEqual(c.rpc.mock.calls[1]); expect(JSON.stringify(criacao)).toBe(before);
    for (const [fn, input] of [[receberMultimodal, recebimento], [renovarMultimodal, renovacao]] as const) {
      const m = { rpc: vi.fn().mockRejectedValue(new Error("timeout")) }; await expect((fn as Function)(m, 7, input)).rejects.toThrow(/mesmo UUID/); expect(m.rpc).toHaveBeenCalledTimes(1);
    }
  });
  it("helper não permite tenant inválido ou params arbitrários", async () => {
    const c = client(criado); await expect(chamarMultimodal(c, "rpc_criar_emprestimo_multimodal", { p_user_id: 0 })).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(c.rpc).not.toHaveBeenCalled();
  });
});

describe("recuperação validada exportada para router/componentes", () => {
  function request(family: RecuperacaoMultimodal["family"], input: Record<string, unknown> & { idempotencyKey: string }): RecuperacaoMultimodal {
    const { idempotencyKey, ...payload } = input; return { family, idempotencyKey, payload };
  }
  const req = request("multimodal_criar", criacao);
  const evidence = { userId: 7, ...req, payloadHash: HASH, proof: "uuid_fenced_v1", status: "confirmed", fenceId: null, result: criado, quote: null };
  it("confirmed valida resultado completo de cada família com um RPC e request original", async () => {
    for (const [family, input, result] of [["multimodal_criar", criacao, criado], ["multimodal_receber", recebimento, recebido], ["multimodal_renovar", renovacao, renovado]] as const) {
      const r = request(family, input), c = client({ ...evidence, ...r, result });
      expect((await reconciliarMultimodal(c, 7, r)).result).toEqual(result); expect(c.rpc).toHaveBeenCalledTimes(1);
      expect(c.rpc).toHaveBeenCalledWith("rpc_reconciliar_multimodal", { p_user_id: 7, p_family: family, p_chave: KEY, p_request: r.payload });
    }
  });
  it("not_executed exige fence permanente, result/quote null e não é inferido de erro", async () => {
    const e = { ...evidence, status: "not_executed", fenceId: OP, result: null }; expect((await reconciliarMultimodal(client(e), 7, req)).status).toBe("not_executed");
    for (const patch of [{ fenceId: null }, { result: {} }, { quote: cotacao }, { fenceId: "bad" }]) await expect(reconciliarMultimodal(client({ ...e, ...patch }), 7, req)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(reconciliarMultimodal(client(null, { code: "55000" }), 7, req)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("evidence owner/family/key/hash/payload/proof/status/resultado precisam corresponder", async () => {
    for (const patch of [{ userId: 8 }, { family: "multimodal_receber" }, { idempotencyKey: OP }, { payloadHash: "BAD" }, { payload: { ...req.payload, taxaJuros: "11.00" } }, { proof: "outro" }, { status: "pending" }, { result: {} }, { result: { ...criado, parcelasIds: [20, 20, 22] } }, { fenceId: OP }, { private: {} }]) await expect(reconciliarMultimodal(client({ ...evidence, ...patch }), 7, req)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    const reordered = Object.fromEntries(Object.entries(req.payload).reverse()); expect(pure.normalizarRecuperacaoMultimodal({ ...evidence, payload: reordered }, 7, req).status).toBe("confirmed");
    const mixedKey = KEY.toUpperCase(); expect(pure.normalizarRecuperacaoMultimodal({ ...evidence, idempotencyKey: mixedKey }, 7, req).status).toBe("confirmed");
    expect(() => pure.normalizarRecuperacaoMultimodal({ ...evidence, result: { id: 10 } }, 7, req)).toThrow();
  });
  it("body original exclui owner/key e request inválida é BAD_REQUEST sem chamada", async () => {
    for (const patch of [{ family: "emprestimo_criar" }, { payload: { ...req.payload, userId: 7 } }, { payload: { ...req.payload, idempotencyKey: KEY } }, { payload: { ...req.payload, p_user_id: 7 } }, { owner: 7 }]) {
      const c = client(evidence); await expect(reconciliarMultimodal(c, 7, { ...req, ...patch } as RecuperacaoMultimodal)).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(c.rpc).not.toHaveBeenCalled();
    }
    // O hash é prova do servidor no formato SHA-256, não digest local de JSON.stringify.
    expect(pure.normalizarRecuperacaoMultimodal({ ...evidence, payloadHash: "b".repeat(64) }, 7, req).payloadHash).toBe("b".repeat(64));
  });
});
