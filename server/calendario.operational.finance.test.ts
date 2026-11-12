import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calcularJurosMora, dataHojeBrasilia, dataVencimentoCivil,
  diferencaDiasCivis, formatarData, getStatusParcela,
} from "../shared/finance";

const fusos = ["America/Sao_Paulo", "UTC", "America/Los_Angeles", "Asia/Tokyo"];
const tzOriginal = process.env.TZ;
afterEach(() => {
  vi.useRealTimers();
  if (tzOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = tzOriginal;
});

describe.each(fusos)("calendario operacional — dispositivo %s", fuso => {
  it.each(["2026-11-10", "2026-12-01", "2027-01-01", "2028-02-29"])("preserva o DATE %s e sua formatação", civil => {
    process.env.TZ = fuso;
    for (const vencimento of [civil, new Date(civil), `${civil}T00:00:00.000Z`]) {
      expect(dataVencimentoCivil(vencimento)).toBe(civil);
      expect(formatarData(dataVencimentoCivil(vencimento))).toBe(civil.split("-").reverse().join("/"));
    }
  });

  it.each([
    ["2026-11-10", "2026-11-10T23:59:59.999Z", "2026-11-10", 0],
    ["2026-11-10", "2026-11-11T00:00:00.000Z", "2026-11-10", 0],
    ["2026-11-10", "2026-11-11T00:00:00.999Z", "2026-11-10", 0],
    ["2026-11-10", "2026-11-11T00:00:01.000Z", "2026-11-10", 0],
    ["2026-11-10", "2026-11-11T02:59:59.999Z", "2026-11-10", 0],
    ["2026-11-10", "2026-11-11T03:00:00.000Z", "2026-11-11", 1],
    ["2026-11-30", "2026-12-01T00:00:00.999Z", "2026-11-30", 0],
    ["2026-11-30", "2026-12-01T03:00:00.000Z", "2026-12-01", 1],
    ["2026-12-31", "2027-01-01T00:00:00.999Z", "2026-12-31", 0],
    ["2026-12-31", "2027-01-01T02:59:59.999Z", "2026-12-31", 0],
    ["2026-12-31", "2027-01-01T03:00:00.000Z", "2027-01-01", 1],
  ] as const)("mora %s com relógio %s", (civil, instante, hoje, dias) => {
    process.env.TZ = fuso;
    const referencia = new Date(instante);
    expect(dataHojeBrasilia(referencia)).toBe(hoje);
    for (const vencimento of [civil, new Date(civil)]) {
      expect(calcularJurosMora(100, vencimento, referencia, 2, 10)).toEqual({
        diasAtraso: dias, juros: dias ? 2 : 0, multa: dias ? 10 : 0, total: dias ? 112 : 100,
      });
    }
    vi.useFakeTimers();
    vi.setSystemTime(referencia);
    expect(getStatusParcela("pendente", civil)).toBe(dias ? "atrasada" : "vencendo_hoje");
    expect(getStatusParcela("pendente", new Date(civil))).toBe(dias ? "atrasada" : "vencendo_hoje");
    expect(getStatusParcela("paga", civil)).toBe("paga");
    expect(getStatusParcela("parcial", civil)).toBe("parcial");
  });

  it("distingue futuro sem antecipar dias ou encargos", () => {
    process.env.TZ = fuso;
    const referencia = new Date("2026-11-11T00:00:00.999Z");
    expect(calcularJurosMora(100, "2026-11-12", referencia, 2, 10)).toEqual({ diasAtraso: 0, juros: 0, multa: 0, total: 100 });
    expect(diferencaDiasCivis(dataHojeBrasilia(referencia), "2026-11-12")).toBe(2);
  });
});

describe("contrato DATE versus instante", () => {
  it("reserva meia-noite UTC exata apenas para a compatibilidade do vencimento", () => {
    const instante = new Date("2026-11-11T00:00:00.000Z");
    expect(dataVencimentoCivil(instante)).toBe("2026-11-11");
    expect(dataHojeBrasilia(instante)).toBe("2026-11-10");
    expect(dataVencimentoCivil(new Date("2026-11-11T00:00:00.999Z"))).toBe("2026-11-10");
    expect(dataHojeBrasilia(new Date("2026-11-11T00:00:00.999Z"))).toBe("2026-11-10");
  });
  it.each(["2026-02-29", "2026-13-01", "2026-11-31", "inválida"])("não normaliza silenciosamente vencimento inválido %s", data => {
    expect(() => dataVencimentoCivil(data)).toThrow(RangeError);
  });
  it("não muda as fórmulas configuradas de multa única/diária", () => {
    expect(calcularJurosMora(1000, "2025-01-01", new Date("2025-01-31T15:00:00Z"), 0.33, 2)).toEqual({ diasAtraso: 30, juros: 9.9, multa: 20, total: 1029.9 });
    // Date de referência é um instante: 31/01 UTC à meia-noite ainda é 30/01 BRT.
    expect(calcularJurosMora(1000, "2025-01-01", new Date("2025-01-31"), 0.33, 2)).toEqual({ diasAtraso: 29, juros: 9.57, multa: 20, total: 1029.57 });
  });
});
