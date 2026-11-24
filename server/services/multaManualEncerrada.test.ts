import { describe, expect, it, vi } from "vitest";
import { normalizarCotacaoMulta, receberMultaSchema } from "../../shared/multaManual";
import { cotarMulta } from "./multaManualRpc";

const input = { contratoId: 10, parcelaId: 20 };
const renovada = {
  ...input, elegivel: false, contaCaixaId: 40, totalExigido: "0.00", multa: "7.50", mora: "1.25",
  jurosEmbutidos: "10.00", valorPagoAcumulado: "18.75", dataPagamento: "2026-11-20",
  vencimento: "2026-11-19", status: "renovada", estadoHash: "a".repeat(64), regra: "recebimento_multa36_brt_v1",
};
describe("Cotação encerrada36 — leitura comprovada, não recebimento", () => {
  it("preserva encargos recebidos sem contar o principal transferido como exigível ou pago", async () => {
    expect(normalizarCotacaoMulta(renovada, input)).toEqual(renovada);
    const client = { rpc: vi.fn().mockResolvedValue({ data: renovada, error: null }) };
    expect(await cotarMulta(client, 7, input)).toEqual(renovada);
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith("rpc_cotar_multa36", { p_user_id: 7, p_contrato_id: 10, p_parcela_id: 20 });
    expect(receberMultaSchema.safeParse({ ...input, idempotencyKey: "abcdefab-1234-4234-8234-123456789012", valorRecebido: "0.01", totalExigido: "0.00", dataPagamento: renovada.dataPagamento, estadoHash: renovada.estadoHash, modo: "integral" }).success).toBe(false);
  });
  it.each([
    { elegivel: true }, { totalExigido: "100.00" }, { totalExigido: "0.01", elegivel: true },
    { valorPagoAcumulado: "0.00" }, { valorPagoAcumulado: "18.74" }, { valorPagoAcumulado: "118.75" },
    { jurosEmbutidos: "10.01" }, { multa: "7.51" }, { mora: "1.26" },
    { status: "cancelada" }, { status: "cancelado" }, { status: "pendente" }, { status: "parcial" },
    { contratoId: 11 }, { parcelaId: 21 }, { regra: "recebimento_multimodal_brt_v1" },
    { estadoHash: "A".repeat(64) }, { dataPagamento: "2026-02-30" }, { contaCaixaId: 0 },
    { valorPagoAcumulado: 18.75 }, { proof: "não basta uma flag" },
  ])("recusa antecessora sem coerência de prova %j", patch => {
    expect(() => normalizarCotacaoMulta({ ...renovada, ...patch }, input)).toThrow();
  });
  it("não executa getter nem aceita status herdado como prova", () => {
    let reads = 0;
    const getter = { ...renovada }; Object.defineProperty(getter, "status", { enumerable: true, get() { reads++; return "renovada"; } });
    expect(() => normalizarCotacaoMulta(getter, input)).toThrow();
    expect(reads).toBe(0);
    expect(() => normalizarCotacaoMulta(Object.assign(Object.create({ status: "renovada" }), { ...renovada }), input)).toThrow();
  });
});
