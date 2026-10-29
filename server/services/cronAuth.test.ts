import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import { possuiSegredoDeAutomacaoValido } from "./cronAuth";

const segredoOriginal = process.env.AUTOMATION_CRON_SECRET;

function requisicaoComSegredo(segredo?: string): Request {
  return {
    get: (nome: string) => nome.toLowerCase() === "x-automation-cron-secret" ? segredo : undefined,
  } as unknown as Request;
}

describe("endpoint de autenticação da automação", () => {
  beforeEach(() => {
    process.env.AUTOMATION_CRON_SECRET = "segredo-de-teste-automacao";
  });

  afterEach(() => {
    if (segredoOriginal === undefined) delete process.env.AUTOMATION_CRON_SECRET;
    else process.env.AUTOMATION_CRON_SECRET = segredoOriginal;
  });

  it("aceita somente o segredo configurado", () => {
    expect(possuiSegredoDeAutomacaoValido(requisicaoComSegredo("segredo-de-teste-automacao"))).toBe(true);
  });

  it("recusa chave diferente, ausente ou configuração sem segredo", () => {
    expect(possuiSegredoDeAutomacaoValido(requisicaoComSegredo("segredo-invalido"))).toBe(false);
    expect(possuiSegredoDeAutomacaoValido(requisicaoComSegredo())).toBe(false);

    delete process.env.AUTOMATION_CRON_SECRET;
    expect(possuiSegredoDeAutomacaoValido(requisicaoComSegredo("segredo-de-teste-automacao"))).toBe(false);
  });
});
