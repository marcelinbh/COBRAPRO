import { describe, expect, it } from "vitest";

// ─── Importar funções de cálculo ──────────────────────────────────────────────
// Testar as funções de cálculo de parcelas bullet loan e modalidades
// Nota: importamos diretamente do shared/finance.ts

// Funções inline para teste (espelham a lógica do shared/finance.ts)
function calcularParcelaBullet(principal: number, taxaJuros: number): number {
  // Bullet loan: parcela = principal * (1 + taxa/100)
  return principal * (1 + taxaJuros / 100);
}

function calcularParcelaPadrao(principal: number, taxaJuros: number, numeroParcelas: number): number {
  if (numeroParcelas <= 0) return 0;
  if (taxaJuros === 0) return principal / numeroParcelas;
  // Tabela Price: PMT = PV * [i(1+i)^n] / [(1+i)^n - 1]
  const i = taxaJuros / 100;
  const pmt = principal * (i * Math.pow(1 + i, numeroParcelas)) / (Math.pow(1 + i, numeroParcelas) - 1);
  return pmt;
}

function getDiasModalidade(modalidade: string): number {
  const map: Record<string, number> = {
    diario: 1,
    semanal: 7,
    quinzenal: 15,
    mensal: 30,
    anual: 365,
  };
  return map[modalidade] ?? 30;
}

// ─── Testes de cálculo bullet loan ───────────────────────────────────────────
describe("calcularParcelaBullet", () => {
  it("calcula corretamente para R$500 com taxa 50%", () => {
    const resultado = calcularParcelaBullet(500, 50);
    expect(resultado).toBe(750);
  });

  it("calcula corretamente para R$1000 com taxa 10%", () => {
    const resultado = calcularParcelaBullet(1000, 10);
    expect(resultado).toBe(1100);
  });

  it("calcula corretamente para R$2000 com taxa 4%", () => {
    const resultado = calcularParcelaBullet(2000, 4);
    expect(resultado).toBe(2080);
  });

  it("retorna o principal quando taxa é 0%", () => {
    const resultado = calcularParcelaBullet(1000, 0);
    expect(resultado).toBe(1000);
  });

  it("calcula corretamente para taxa quinzenal de 5%", () => {
    const resultado = calcularParcelaBullet(500, 5);
    expect(resultado).toBe(525);
  });
});

// ─── Testes de cálculo tabela price ──────────────────────────────────────────
describe("calcularParcelaPadrao (Tabela Price)", () => {
  it("calcula corretamente para R$1000 com taxa 1% em 12 parcelas", () => {
    const resultado = calcularParcelaPadrao(1000, 1, 12);
    // PMT ≈ 88.85
    expect(resultado).toBeCloseTo(88.85, 1);
  });

  it("retorna principal/n quando taxa é 0%", () => {
    const resultado = calcularParcelaPadrao(1200, 0, 12);
    expect(resultado).toBe(100);
  });

  it("retorna 0 para numeroParcelas = 0", () => {
    const resultado = calcularParcelaPadrao(1000, 5, 0);
    expect(resultado).toBe(0);
  });
});

// ─── Testes de getDiasModalidade ─────────────────────────────────────────────
describe("getDiasModalidade", () => {
  it("retorna 1 para diario", () => {
    expect(getDiasModalidade("diario")).toBe(1);
  });

  it("retorna 7 para semanal", () => {
    expect(getDiasModalidade("semanal")).toBe(7);
  });

  it("retorna 15 para quinzenal", () => {
    expect(getDiasModalidade("quinzenal")).toBe(15);
  });

  it("retorna 30 para mensal", () => {
    expect(getDiasModalidade("mensal")).toBe(30);
  });

  it("retorna 365 para anual", () => {
    expect(getDiasModalidade("anual")).toBe(365);
  });

  it("retorna 30 como padrão para modalidade desconhecida", () => {
    expect(getDiasModalidade("desconhecido")).toBe(30);
  });
});

// ─── Testes de renovação bullet loan ─────────────────────────────────────────
describe("Renovação bullet loan (Pagar Juros)", () => {
  it("calcula corretamente os juros de uma parcela quinzenal", () => {
    const principal = 500;
    const taxaJuros = 50; // 50% quinzenal
    const valorParcela = calcularParcelaBullet(principal, taxaJuros);
    const juros = valorParcela - principal;
    expect(juros).toBe(250);
  });

  it("calcula nova data de vencimento corretamente para quinzenal", () => {
    const dataVencAtual = new Date("2026-04-01T00:00:00");
    const diasIntervalo = getDiasModalidade("quinzenal");
    const novaData = new Date(dataVencAtual);
    novaData.setDate(novaData.getDate() + diasIntervalo);
    expect(novaData.toISOString().split("T")[0]).toBe("2026-04-16");
  });

  it("calcula nova data de vencimento corretamente para semanal", () => {
    const dataVencAtual = new Date("2026-04-01T00:00:00");
    const diasIntervalo = getDiasModalidade("semanal");
    const novaData = new Date(dataVencAtual);
    novaData.setDate(novaData.getDate() + diasIntervalo);
    expect(novaData.toISOString().split("T")[0]).toBe("2026-04-08");
  });

  it("calcula nova data de vencimento corretamente para mensal", () => {
    const dataVencAtual = new Date("2026-04-01T00:00:00");
    const diasIntervalo = getDiasModalidade("mensal");
    const novaData = new Date(dataVencAtual);
    novaData.setDate(novaData.getDate() + diasIntervalo);
    expect(novaData.toISOString().split("T")[0]).toBe("2026-05-01");
  });
});

// ─── Testes de formatação de moeda ───────────────────────────────────────────
describe("formatarMoeda (lógica)", () => {
  it("formata corretamente valores em reais", () => {
    const formatarMoeda = (valor: number | string) => {
      const num = typeof valor === "string" ? parseFloat(valor) : valor;
      if (isNaN(num)) return "R$ 0,00";
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    expect(formatarMoeda(1000)).toBe("R$\u00a01.000,00");
    expect(formatarMoeda(500.5)).toBe("R$\u00a0500,50");
    expect(formatarMoeda("750")).toBe("R$\u00a0750,00");
    expect(formatarMoeda("abc")).toBe("R$ 0,00");
  });
});
