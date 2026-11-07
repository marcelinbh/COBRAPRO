import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/Relatorios.tsx", import.meta.url), "utf8");
const cards = source.slice(source.indexOf("{/* KPIs Globais */}"));

describe("relatórios: contrato de disponibilidade dos KPIs", () => {
  it("não transforma falha de carteira em zero nem reapresenta dados stale", () => {
    expect(cards).not.toMatch(/kpis\?\.[a-zA-Z]+\s*\?\?\s*0/);
    for (const campo of ["totalReceber", "totalInadimplente", "jurosPendentes"]) {
      expect(cards).toContain(`kpisFalhou ? undefined : kpis?.${campo}`);
    }
    expect(cards).toContain("Indisponível");
    expect(cards).toContain("valores desconhecidos não são apresentados como zero");
  });
  it("consulta capital em fonte independente e não usa esse fallback quando a leitura falha", () => {
    expect(source).toContain("trpc.dashboard.resumoCaixa.useQuery(undefined, { enabled: kpisFalhou })");
    expect(cards).toContain("caixaFalhou ? undefined : resumoCaixa?.capitalCirculacao");
  });
});
