import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 999_999,
      openId: "auditoria-reparcelamento",
      email: "auditoria@example.invalid",
      name: "Auditoria",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("reparcelamento.executar", () => {
  it("permanece bloqueado mesmo se uma chamada direta tentar executá-lo", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await expect(caller.reparcelamento.executar({
      contratoId: 1,
      numeroParcelas: 2,
      taxaJuros: 5,
      tipoTaxa: "mensal",
      dataInicio: "2026-10-28",
      incluirMultas: true,
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Reparcelamento temporariamente indisponível durante a atualização de segurança financeira.",
    });
  });
});
