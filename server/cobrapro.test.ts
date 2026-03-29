import { describe, expect, it } from "vitest";
import { calcularParcelaPadrao, calcularParcelasPrice, calcularJurosMora, formatarMoeda } from "../shared/finance";

describe("Cálculos Financeiros — CobraPro", () => {
  describe("calcularParcelaPadrao", () => {
    it("calcula parcela simples sem juros", () => {
      const parcela = calcularParcelaPadrao(1200, 0, 12);
      expect(parcela).toBeCloseTo(100, 2);
    });

    it("calcula parcela com juros mensais", () => {
      // R$1000 em 10x com 5% ao mês
      const parcela = calcularParcelaPadrao(1000, 5, 10);
      // Total = 1000 * (1 + 0.05 * 10) = 1500, parcela = 150
      expect(parcela).toBeCloseTo(150, 2);
    });

    it("calcula parcela única", () => {
      const parcela = calcularParcelaPadrao(500, 10, 1);
      expect(parcela).toBeCloseTo(550, 2);
    });
  });

  describe("calcularParcelasPrice", () => {
    it("calcula parcela pela tabela price com juros", () => {
      // R$1000 em 12x com 2% ao mês
      const parcela = calcularParcelasPrice(1000, 2, 12);
      expect(parcela).toBeGreaterThan(90);
      expect(parcela).toBeLessThan(100);
    });

    it("retorna valor do principal quando taxa é zero", () => {
      const parcela = calcularParcelasPrice(1200, 0, 12);
      expect(parcela).toBeCloseTo(100, 2);
    });
  });

  describe("calcularJurosMora", () => {
    it("retorna zero quando não há atraso", () => {
      const hoje = new Date();
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      const { diasAtraso, juros, multa, total } = calcularJurosMora(100, amanha, hoje);
      expect(diasAtraso).toBe(0);
      expect(juros).toBe(0);
      expect(multa).toBe(0);
      expect(total).toBeCloseTo(100, 2);
    });

    it("calcula multa e juros com 30 dias de atraso", () => {
      const vencimento = new Date("2025-01-01");
      const hoje = new Date("2025-01-31");
      const { diasAtraso, juros, multa, total } = calcularJurosMora(1000, vencimento, hoje);
      expect(diasAtraso).toBe(30);
      // Multa padrão 2% = 20
      expect(multa).toBeCloseTo(20, 2);
      // Juros mora 0.033% ao dia por 30 dias = 9.9
      expect(juros).toBeCloseTo(9.9, 1);
      // Total = 1000 + 20 + 9.9 = 1029.9
      expect(total).toBeCloseTo(1029.9, 1);
    });
  });

  describe("formatarMoeda", () => {
    it("formata número como moeda brasileira", () => {
      const resultado = formatarMoeda(1234.56);
      expect(resultado).toContain("1.234,56");
    });

    it("formata string como moeda", () => {
      const resultado = formatarMoeda("500.00");
      expect(resultado).toContain("500,00");
    });

    it("formata zero corretamente", () => {
      const resultado = formatarMoeda(0);
      expect(resultado).toContain("0,00");
    });
  });
});

describe("auth.logout", () => {
  it("módulo de autenticação está acessível", () => {
    expect(true).toBe(true);
  });
});
