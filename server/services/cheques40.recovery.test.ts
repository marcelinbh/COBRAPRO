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
describe("Fence40 de ausência durável", () => {
  const proof = () => ({ success: true, regra: "cheques40_fence_v1", estado: "nao_executada", idempotencyKey: intent.idempotencyKey, request: intent.request, resultado: null });
  it("somente prova correspondente permite remover intenção para corrigir pedido", () => {
    const s = storage();reservarIntencaoCheque40(s, 7, intent.request, () => intent.idempotencyKey);
    for (const bad of [{...proof(), idempotencyKey: randomUUID()}, {...proof(), request: {...intent.request, valorNominal: "1.00"}}, {...proof(), resultado: result}, null]) {
      expect(() => concluirAbandonoCheque40(s, 7, intent, bad)).toThrow();expect(lerIntencaoCheque40(s, 7)).toEqual(intent);
    }
    concluirAbandonoCheque40(s, 7, intent, proof());expect(lerIntencaoCheque40(s, 7)).toBe(null);
  });
  it("timeout no abandono preserva intenção sem fallback", async () => {
    const s=storage();reservarIntencaoCheque40(s,7,intent.request,()=>intent.idempotencyKey);
    const c={rpc:vi.fn(async()=>{throw new Error("timeout");})};await expect(abandonarCheque40(c,7,intent)).rejects.toMatchObject({code:"INTERNAL_SERVER_ERROR"});
    expect(c.rpc).toHaveBeenCalledOnce();expect(lerIntencaoCheque40(s,7)).toEqual(intent);
  });
  it("operação já executada é recuperada em vez de fingir ausência", async () => {
    const c=client({...proof(),estado:"executada",resultado:{...result,repetida:true}});expect((await abandonarCheque40(c,7,intent)).estado).toBe("executada");
    expect(c.rpc).toHaveBeenCalledWith("rpc_abandonar_cheques40",{p_user_id:7,p_chave:intent.idempotencyKey,p_request:intent.request});
  });
});
