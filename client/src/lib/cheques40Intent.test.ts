import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { executarCheque40 } from "../../../server/services/cheques40Rpc";
import { cheque40IntentSchema, decimalCheque40, diaCheque40, type Cheque40Intent } from "../../../shared/cheques40";
import { lerIntencaoCheque40, reservarIntencaoCheque40, concluirIntencaoCheque40, concluirAbandonoCheque40 } from "./cheques40Intent";
import { abandonarCheque40 } from "../../../server/services/cheques40Fence";
const intent: Cheque40Intent = { idempotencyKey: randomUUID(), request: { acao: "criar", dataOperacao: "2026-11-24", clienteId: 1, contaCaixaId: 101, emitente: "Teste", numeroCheque: "123", banco: null, agencia: null, conta: null, cpfCnpjEmitente: null, valorNominal: "100.00", dataVencimento: "2026-12-24", taxaDesconto: "3.00", tipoTaxa: "mensal", observacoes: null } };
const result = { success: true, regra: "cheques40_v1", id: 1001, operationId: randomUUID(), idempotencyKey: intent.idempotencyKey, repetida: false, valorLiquido: "97.09", valorDesconto: "2.91", status: "descontado", estornadoNoCaixa: false, requerConferenciaCaixa: false };
const client = (data: unknown = result, error: unknown = null) => ({ rpc: vi.fn(async () => ({ data, error })) });
const storage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
describe("Cheques40 persistência e recovery", () => {
  it("persiste antes da rede, bloqueia outra intenção e separa assinantes", () => {
    const s = storage(); const i = reservarIntencaoCheque40(s, 7, intent.request, () => intent.idempotencyKey);
    expect(lerIntencaoCheque40(s, 7)).toEqual(i);expect(lerIntencaoCheque40(s, 8)).toBe(null);
    expect(() => reservarIntencaoCheque40(s, 7, intent.request, randomUUID)).toThrow(/pendente/);
    concluirIntencaoCheque40(s, 7, { ...i, idempotencyKey: randomUUID() });expect(lerIntencaoCheque40(s, 7)).toEqual(i);
    concluirIntencaoCheque40(s, 7, i);expect(lerIntencaoCheque40(s, 7)).toBe(null);
  });
  it("localStorage indisponível/corrompido impede nova intenção", () => {
    const s = storage(); s.setItem("cobrapro.cheques40.intent.v1.7", "corrupted");expect(() => lerIntencaoCheque40(s, 7)).toThrow();
    const fail = { ...storage(), setItem: () => { throw new Error("quota"); } };expect(() => reservarIntencaoCheque40(fail, 7, intent.request, randomUUID)).toThrow(/quota/);
  });
});

describe("Cheques40 fonte UI segura", () => {
  it("tela usa metadados37 e não depende da leitura global de saldo", () => {
    const ui=readFileSync(new URL("../pages/Cheques.tsx",import.meta.url),"utf8");
    expect(ui).toContain("trpc.caixa.contasParaOperacao37.useQuery()");expect(ui).not.toContain("trpc.caixa.contas.useQuery()");
    expect(ui).toContain("concluirAbandonoCheque40(localStorage");expect(ui).toContain("Confirmar abandono seguro");
  });
});
