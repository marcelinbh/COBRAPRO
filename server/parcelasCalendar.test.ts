import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { statusCalendarioParcela } from "../shared/parcelasCalendar";

describe("status civil de parcelas sem escritas em consultas", () => {
  it.each([
    ["pendente", "2026-11-07", "2026-11-08", "atrasada"],
    ["pendente", "2026-11-08", "2026-11-08", "vencendo_hoje"],
    ["atrasada", "2026-11-09", "2026-11-08", "pendente"],
    ["vencendo_hoje", "2026-11-08", "2026-11-09", "atrasada"],
    ["pendente", "2028-02-29", "2028-02-29", "vencendo_hoje"],
  ])("deriva %s / %s com o dia %s", (status, vencimento, hoje, esperado) => {
    expect(statusCalendarioParcela(status, vencimento, hoje)).toBe(esperado);
  });

  it.each(["paga", "parcial", "renegociada", "cancelada"])("preserva o estado financeiro %s", (status) => {
    expect(statusCalendarioParcela(status, "2026-11-01", "2026-11-08")).toBe(status);
  });

  it.each([null, undefined, "2026-02-29", "2026-13-01", "2026-11-08T00:00:00Z"])("não inventa status para vencimento inválido %s", (data) => {
    expect(statusCalendarioParcela("pendente", data, "2026-11-08")).toBe("pendente");
  });

  it("a listagem não escreve status nem dispara multa", () => {
    const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const listagem = source.split("const parcelasRouter = router({")[1].split("registrarPagamento: protectedProcedure")[0];
    expect(listagem).not.toMatch(/db\.update\(parcelas\)|\.update\(\{\s*status/);
    expect(listagem).toContain("statusCalendarioParcela");
  });
});
