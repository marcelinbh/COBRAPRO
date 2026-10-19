import { describe, expect, it } from "vitest";
import { tabelaOperacionalAusente } from "./operacoesFinanceiras";

describe("compatibilidade da camada de operações financeiras", () => {
  it("reconhece a ausência de operacoes_financeiras no schema cache do Supabase", () => {
    expect(tabelaOperacionalAusente({
      message: "Could not find the table 'public.operacoes_financeiras' in the schema cache",
    }, "operacoes_financeiras")).toBe(true);
  });

  it("reconhece a ausência de auditoria_financeira sem ocultar outros erros", () => {
    expect(tabelaOperacionalAusente({
      message: 'relation "auditoria_financeira" does not exist',
    }, "auditoria_financeira")).toBe(true);
    expect(tabelaOperacionalAusente({
      message: "permission denied for table operacoes_financeiras",
    }, "operacoes_financeiras")).toBe(false);
    expect(tabelaOperacionalAusente({
      message: "timeout while connecting to database",
    }, "operacoes_financeiras")).toBe(false);
  });
});
