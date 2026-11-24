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
describe("Cheques40 adapter RPC único", () => {
  it("owner vem do argumento de contexto e UUID não é substituído", async () => {
    const c = client(); expect(await executarCheque40(c, 7, intent)).toEqual(result);
    expect(c.rpc).toHaveBeenCalledOnce(); expect(c.rpc).toHaveBeenCalledWith("rpc_cheques40", { p_user_id: 7, p_chave: intent.idempotencyKey, p_request: intent.request });
  });
  it("timeout não tenta fallback e mesma intenção pode recuperar depois", async () => {
    const c = client(); c.rpc.mockRejectedValueOnce(new Error("timeout"));
    await expect(executarCheque40(c, 7, intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(c.rpc).toHaveBeenCalledOnce();
    c.rpc.mockResolvedValueOnce({ data: { ...result, repetida: true }, error: null });
    expect((await executarCheque40(c, 7, intent)).repetida).toBe(true);expect(c.rpc.mock.calls[0]).toEqual(c.rpc.mock.calls[1]);
  });
  it("rejeita envelope/prova contraditórios sem aceitar sucesso aparente", async () => {
    for (const data of [null, { ...result, idempotencyKey: randomUUID() }, ...["aguardando", "pendente", "em_carteira", "compensado"].map(status => ({ ...result, status })), { ...result, estornadoNoCaixa: true }, { ...result, valorLiquido: 97.09 }]) await expect(executarCheque40(client(data), 7, intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(executarCheque40(client(result, { code: "23505" }), 7, intent)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("mapeia recusa de integridade e conflito sem REST DML", async () => {
    for (const [sql, code] of [["23505", "CONFLICT"], ["23514", "PRECONDITION_FAILED"], ["55000", "PRECONDITION_FAILED"], ["40001", "INTERNAL_SERVER_ERROR"], ["42501", "FORBIDDEN"], ["22023", "BAD_REQUEST"]]) {
      const c = client(null, { code: sql });await expect(executarCheque40(c, 7, intent)).rejects.toMatchObject({ code });expect(c.rpc).toHaveBeenCalledOnce();
    }
  });
});

describe("Cheques40 integração com provas reais e fonte", () => {
  it("aceita envelope realmente produzido pelo PostgreSQL17 local, não fixture de sucesso inventado", async () => {
    const evidence = JSON.parse(readFileSync(new URL("../../tests/postgres-cheques40/real-rpc-envelope.json", import.meta.url), "utf8"));
    const c = { rpc: vi.fn(async () => evidence.response) };
    const parsed = cheque40IntentSchema.parse(evidence.intent);
    expect((await executarCheque40(c, 1, parsed)).id).toBe(evidence.response.data.id);
  });
});
