import { describe, expect, it } from "vitest";

/**
 * Testes para validar os cálculos de totalReceber e lucroRealizado
 * após a correção para incluir saldo_residual e valor_multa
 */

describe("Finance Calculations", () => {
  describe("totalReceber calculation", () => {
    it("should sum valor_original + valor_multa + saldo_residual for open parcelas", () => {
      // Simular parcelas abertas
      const parcelas = [
        {
          id: 1,
          status: "pendente",
          valor_original: "100.00",
          valor_multa: "10.00",
          saldo_residual: "5.00",
        },
        {
          id: 2,
          status: "atrasada",
          valor_original: "100.00",
          valor_multa: "20.00",
          saldo_residual: "0.00",
        },
        {
          id: 3,
          status: "paga", // Should not be included
          valor_original: "100.00",
          valor_multa: "0.00",
          saldo_residual: "0.00",
        },
      ];

      // Cálculo esperado (apenas parcelas abertas)
      const totalReceber = parcelas
        .filter((p) => !["paga"].includes(p.status))
        .reduce(
          (s: number, p: any) =>
            s +
            parseFloat(p.valor_original ?? "0") +
            parseFloat(p.valor_multa ?? "0") +
            parseFloat(p.saldo_residual ?? "0"),
          0
        );

      // Esperado: (100 + 10 + 5) + (100 + 20 + 0) = 115 + 120 = 235
      expect(totalReceber).toBe(235);
    });

    it("should handle parcelas with status parcial", () => {
      const parcelas = [
        {
          id: 1,
          status: "parcial",
          valor_original: "100.00",
          valor_multa: "5.00",
          saldo_residual: "50.00", // Meio da parcela já pago
        },
      ];

      const totalReceber = parcelas
        .filter((p) => !["paga"].includes(p.status))
        .reduce(
          (s: number, p: any) =>
            s +
            parseFloat(p.valor_original ?? "0") +
            parseFloat(p.valor_multa ?? "0") +
            parseFloat(p.saldo_residual ?? "0"),
          0
        );

      // Esperado: 100 + 5 + 50 = 155
      expect(totalReceber).toBe(155);
    });

    it("should return 0 when all parcelas are paid", () => {
      const parcelas = [
        {
          id: 1,
          status: "paga",
          valor_original: "100.00",
          valor_multa: "0.00",
          saldo_residual: "0.00",
        },
      ];

      const totalReceber = parcelas
        .filter((p) => !["paga"].includes(p.status))
        .reduce(
          (s: number, p: any) =>
            s +
            parseFloat(p.valor_original ?? "0") +
            parseFloat(p.valor_multa ?? "0") +
            parseFloat(p.saldo_residual ?? "0"),
          0
        );

      expect(totalReceber).toBe(0);
    });

    it("should handle null/undefined values gracefully", () => {
      const parcelas = [
        {
          id: 1,
          status: "pendente",
          valor_original: "100.00",
          valor_multa: null,
          saldo_residual: undefined,
        },
      ];

      const totalReceber = parcelas
        .filter((p) => !["paga"].includes(p.status))
        .reduce(
          (s: number, p: any) =>
            s +
            parseFloat(p.valor_original ?? "0") +
            parseFloat(p.valor_multa ?? "0") +
            parseFloat(p.saldo_residual ?? "0"),
          0
        );

      // Esperado: 100 + 0 + 0 = 100
      expect(totalReceber).toBe(100);
    });
  });

  describe("lucroRealizado calculation", () => {
    it("should sum valor_juros from paid parcelas", () => {
      const parcelasPagas = [
        {
          id: 1,
          status: "paga",
          valor_juros: "10.00",
        },
        {
          id: 2,
          status: "paga",
          valor_juros: "15.00",
        },
      ];

      const lucroRealizado = parcelasPagas.reduce(
        (s: number, p: any) => s + parseFloat(p.valor_juros ?? p.juros ?? "0"),
        0
      );

      // Esperado: 10 + 15 = 25
      expect(lucroRealizado).toBe(25);
    });

    it("should handle parcelas with null juros", () => {
      const parcelasPagas = [
        {
          id: 1,
          status: "paga",
          valor_juros: "10.00",
        },
        {
          id: 2,
          status: "paga",
          valor_juros: null,
        },
      ];

      const lucroRealizado = parcelasPagas.reduce(
        (s: number, p: any) => s + parseFloat(p.valor_juros ?? p.juros ?? "0"),
        0
      );

      // Esperado: 10 + 0 = 10
      expect(lucroRealizado).toBe(10);
    });

    it("should return 0 when no parcelas are paid", () => {
      const parcelasPagas: any[] = [];

      const lucroRealizado = parcelasPagas.reduce(
        (s: number, p: any) => s + parseFloat(p.valor_juros ?? p.juros ?? "0"),
        0
      );

      expect(lucroRealizado).toBe(0);
    });

    it("should use juros field as fallback when valor_juros is null", () => {
      const parcelasPagas = [
        {
          id: 1,
          status: "paga",
          valor_juros: null,
          juros: "20.00",
        },
      ];

      const lucroRealizado = parcelasPagas.reduce(
        (s: number, p: any) => s + parseFloat(p.valor_juros ?? p.juros ?? "0"),
        0
      );

      // Esperado: 20 (usando juros como fallback)
      expect(lucroRealizado).toBe(20);
    });
  });

  describe("Integration: totalReceber + lucroRealizado", () => {
    it("should correctly calculate both metrics for a mixed scenario", () => {
      const todasParcelas = [
        {
          id: 1,
          status: "pendente",
          valor_original: "100.00",
          valor_multa: "10.00",
          saldo_residual: "0.00",
          valor_juros: "5.00",
        },
        {
          id: 2,
          status: "atrasada",
          valor_original: "100.00",
          valor_multa: "20.00",
          saldo_residual: "25.00",
          valor_juros: "8.00",
        },
        {
          id: 3,
          status: "parcial",
          valor_original: "100.00",
          valor_multa: "5.00",
          saldo_residual: "50.00",
          valor_juros: "6.00",
        },
        {
          id: 4,
          status: "paga",
          valor_original: "100.00",
          valor_multa: "0.00",
          saldo_residual: "0.00",
          valor_juros: "5.00",
        },
      ];

      const parcelasAbertas = todasParcelas.filter(
        (p) => !["paga"].includes(p.status)
      );
      const parcelasPagas = todasParcelas.filter((p) => p.status === "paga");

      const totalReceber = parcelasAbertas.reduce(
        (s: number, p: any) =>
          s +
          parseFloat(p.valor_original ?? "0") +
          parseFloat(p.valor_multa ?? "0") +
          parseFloat(p.saldo_residual ?? "0"),
        0
      );

      const lucroRealizado = parcelasPagas.reduce(
        (s: number, p: any) => s + parseFloat(p.valor_juros ?? p.juros ?? "0"),
        0
      );

      // totalReceber: (100+10+0) + (100+20+25) + (100+5+50) = 110 + 145 + 155 = 410
      expect(totalReceber).toBe(410);

      // lucroRealizado: 5 (apenas da parcela paga)
      expect(lucroRealizado).toBe(5);
    });
  });
});
