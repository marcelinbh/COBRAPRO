import { describe, expect, it } from "vitest";
import {
  competenciaElegivel,
  dataCivilValida,
  mesmoValorMonetario,
  mesReferenciaValido,
} from "./assinaturasFinanceiras";

describe("regras financeiras de assinaturas", () => {
  it("aceita somente datas civis existentes", () => {
    expect(dataCivilValida("2026-02-28")).toBe(true);
    expect(dataCivilValida("2026-02-29")).toBe(false);
    expect(dataCivilValida("2024-02-29")).toBe(true);
    expect(dataCivilValida("2026-02-31")).toBe(false);
  });

  it("rejeita competências com mês fora do calendário", () => {
    expect(mesReferenciaValido("2026-01")).toBe(true);
    expect(mesReferenciaValido("2026-00")).toBe(false);
    expect(mesReferenciaValido("2026-13")).toBe(false);
  });

  it("não permite cobrar competência anterior ao início da assinatura", () => {
    expect(competenciaElegivel("2026-10-15", "2026-10")).toBe(true);
    expect(competenciaElegivel("2026-10-15", "2026-09")).toBe(false);
  });

  it("compara mensalidade e pagamento em centavos", () => {
    expect(mesmoValorMonetario(100, "100.00")).toBe(true);
    expect(mesmoValorMonetario(0.1 + 0.2, "0.30")).toBe(true);
    expect(mesmoValorMonetario(99.99, "100.00")).toBe(false);
  });
});
