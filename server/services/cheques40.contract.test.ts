import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { executarCheque40 } from "../../server/services/cheques40Rpc";
import { cheque40IntentSchema, decimalCheque40, diaCheque40, type Cheque40Intent } from "../../shared/cheques40";
import { lerIntencaoCheque40, reservarIntencaoCheque40, concluirIntencaoCheque40, concluirAbandonoCheque40 } from "../../client/src/lib/cheques40Intent";
import { abandonarCheque40 } from "../../server/services/cheques40Fence";
const intent: Cheque40Intent = { idempotencyKey: randomUUID(), request: { acao: "criar", dataOperacao: "2026-11-24", clienteId: 1, contaCaixaId: 101, emitente: "Teste", numeroCheque: "123", banco: null, agencia: null, conta: null, cpfCnpjEmitente: null, valorNominal: "100.00", dataVencimento: "2026-12-24", taxaDesconto: "3.00", tipoTaxa: "mensal", observacoes: null } };
const result = { success: true, regra: "cheques40_v1", id: 1001, operationId: randomUUID(), idempotencyKey: intent.idempotencyKey, repetida: false, valorLiquido: "97.09", valorDesconto: "2.91", status: "descontado", estornadoNoCaixa: false, requerConferenciaCaixa: false };
const client = (data: unknown = result, error: unknown = null) => ({ rpc: vi.fn(async () => ({ data, error })) });
const storage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
describe("Cheques40 contratos", () => {
  it("decimal lexical exato não usa arredondamento flutuante", () => {
    expect(decimalCheque40("1,20")).toBe("1.20"); expect(decimalCheque40("9999999999.99")).toBe("9999999999.99"); expect(decimalCheque40("3", 4)).toBe("3.0000");
    for (const value of ["1e2", "01.00", "1.001", "NaN", "-1", "1.000,00"]) expect(() => decimalCheque40(value)).toThrow();
  });
  it("data civil usa Brasília", () => { expect(diaCheque40(new Date("2026-11-25T02:59:59Z"))).toBe("2026-11-24"); expect(diaCheque40(new Date("2026-11-25T03:00:00Z"))).toBe("2026-11-25"); });
  it("contrato fechado recusa owner/payload adicional e precisão perdida", () => {
    for (const extra of [{ userId: 2 }, { valorNominal: 100 }, { dataVencimento: "2026-02-30" }, { valorNominal: "100.001" }, { taxaDesconto: "3" }]) expect(cheque40IntentSchema.safeParse({ ...intent, request: { ...intent.request, ...extra } }).success).toBe(false);
    expect(cheque40IntentSchema.safeParse({ ...intent, userId: 2 }).success).toBe(false);
  });
});
