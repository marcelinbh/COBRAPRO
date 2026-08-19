import { describe, expect, it } from "vitest";
import { deveRepetirSemPeriodicidade } from "./contasPagarSchemaFallback";

describe("compatibilidade de schema para contas a pagar", () => {
  it("repete o cadastro sem periodicidade quando a coluna não existe no PostgREST", () => {
    expect(deveRepetirSemPeriodicidade({
      code: "PGRST204",
      message: "Could not find the 'periodicidade' column of 'contas_pagar' in the schema cache",
    })).toBe(true);
  });

  it("não mascara outros erros de cadastro", () => {
    expect(deveRepetirSemPeriodicidade({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(deveRepetirSemPeriodicidade(null)).toBe(false);
  });
});
