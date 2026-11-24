import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calendario44Schema, cotarCalendario44, manterCalendario44, type ClienteCalendario44 } from "../../../server/services/manutencaoEmprestimos";
const input = { contratoId: 1001, idempotencyKey: "10000000-0000-4000-8000-000000000044", estadoHash: "a".repeat(64), vencimentos: ["2030-01-10", "2030-02-10"], motivo: "Ajuste auditado" };
const result = { success: true, repetida: false, operationId: "20000000-0000-4000-8000-000000000044", idempotencyKey: input.idempotencyKey, contratoId: 1001, vencimentos: input.vencimentos, regra: "calendario_mensal_sem_baixa_v1" };
function client(data: unknown, error: { code: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { rpc, value: { rpc } as ClienteCalendario44 };
}
beforeEach(() => vi.stubEnv("ENABLE_MANUTENCAO_EMPRESTIMOS_0044", "true"));
afterEach(() => vi.unstubAllEnvs());
describe("calendário44 delimitado — mocks validam contrato, NÃO ativação", () => {
  it("recusa injeção owner, principal, valor, schema e payload extra", () => {
    for (const extra of [{ userId: 2 }, { valorPrincipal: 1 }, { novaTaxa: "0" }, { schema: "public" }, { parcelaId: 99 }]) expect(calendario44Schema.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it("recusa agenda incompleta/civil inválida/rollover e aprova mensal explícita", () => {
    expect(calendario44Schema.safeParse(input).success).toBe(true);
    for (const vencimentos of [[], ["2030-01-31", "2030-03-03"], ["2030-02-30"], ["inválida"], ["1899-01-10"], ["2030-02-10", "2030-01-10"]]) expect(calendario44Schema.safeParse({ ...input, vencimentos }).success).toBe(false);
  });
  it("flag desligada impede RPC sem fallback", async () => {
    vi.stubEnv("ENABLE_MANUTENCAO_EMPRESTIMOS_0044", "false"); const c = client(result);
    await expect(manterCalendario44(c.value, 34, input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });expect(c.rpc).not.toHaveBeenCalled();
  });
  it("envia facade public exata e owner separado com a mesma UUID e payload exato", async () => {
    const c = client(result); expect(await manterCalendario44(c.value, 77, input)).toEqual({ status: "confirmed", sameIntentOnly: true, resultado: result });
    expect(c.rpc).toHaveBeenCalledTimes(1);expect(c.rpc).toHaveBeenCalledWith("rpc_executar_calendario44", { p_user_id: 77, p_chave_idempotencia: input.idempotencyKey, p_contrato_id: 1001, p_estado_hash: input.estadoHash, p_vencimentos: input.vencimentos, p_motivo: input.motivo });
  });
  it("recovery public valida fence durável do payload inteiro, não not_found", async () => {
    const fence={ ...input, status: "fenced", regra: "calendario44_fence_v1" };
    const c=client(fence);expect(await manterCalendario44(c.value,77,input,true)).toEqual(fence);
    expect(c.rpc.mock.calls[0][0]).toBe("rpc_conferir_calendario44");
    for(const value of [{status:"not_found",sameIntentOnly:true},{...fence,estadoHash:"b".repeat(64)},{...fence,motivo:"Outro motivo"},{...fence,contratoId:3},{...fence,idempotencyKey:result.operationId},{...fence,vencimentos:["2033-01-10"]}]) {
      await expect(manterCalendario44(client(value).value,77,input,true)).rejects.toMatchObject({code:"INTERNAL_SERVER_ERROR"});
    }
  });
  it("rejeita confirmação de outro contrato, UUID ou calendário", async () => {
    for (const extra of [{ contratoId: 2 }, { idempotencyKey: result.operationId }, { vencimentos: ["2031-01-10"] }]) await expect(manterCalendario44(client({ ...result, ...extra }).value, 77, input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("rejeita cotação com IDs duplicados e sem campos correspondentes", async () => {
    await expect(cotarCalendario44(client({ contratoId: 1001, estadoHash: input.estadoHash, regra: result.regra, parcelasIds: [3, 3], vencimentos: input.vencimentos }).value, 77, { contratoId: 1001 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("cotação usa somente facade exata public e owner separado", async()=>{
    const quote={contratoId:input.contratoId,estadoHash:input.estadoHash,regra:result.regra,parcelasIds:[3,4],vencimentos:input.vencimentos};
    const c=client(quote);expect(await cotarCalendario44(c.value,77,{contratoId:input.contratoId})).toEqual(quote);
    expect(c.rpc).toHaveBeenCalledWith("rpc_cotar_calendario44",{p_user_id:77,p_contrato_id:input.contratoId});
  });
  it("owner inválido e payload extra não chegam à rede",async()=>{
    const c=client(result);await expect(manterCalendario44(c.value,0,input)).rejects.toMatchObject({code:"BAD_REQUEST"});
    await expect(manterCalendario44(c.value,77,{...input,userId:2} as typeof input)).rejects.toBeDefined();expect(c.rpc).not.toHaveBeenCalled();
  });
  it("timeout só toca uma RPC e não muda intenção ou conclui rollback", async () => {
    const c = client(null);c.rpc.mockRejectedValue(new Error("timeout"));
    await expect(manterCalendario44(c.value, 77, input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("mesma intenção/UUID") });expect(c.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([['23505', 'CONFLICT'], ['40001', 'CONFLICT'], ['42501', 'NOT_FOUND'], ['PGRST106', 'PRECONDITION_FAILED'], ['55000', 'PRECONDITION_FAILED'], ['22023', 'BAD_REQUEST']])("mapeia SQLSTATE %s e não tenta writerREST", async (code, expected) => {
    const c = client(null, { code });await expect(manterCalendario44(c.value, 77, input)).rejects.toMatchObject({ code: expected });expect(c.rpc).toHaveBeenCalledTimes(1);
  });
});
