import { describe, expect, it } from "vitest";
import { TIPOS_NOTIFICACAO } from "./routers/notificacoes";
import { calcularDataAlvoBrasilia, deveExecutarNoHorario, obterDataBrasilia, obterHorarioBrasilia } from "./services/notificacoesAutomaticas";

describe("Régua opcional de alertas WhatsApp", () => {
  it("inclui todos os alertas fixos entre cinco dias antes e o vencimento", () => {
    const tipos = TIPOS_NOTIFICACAO.map((regra) => regra.tipo);
    expect(tipos).toEqual(expect.arrayContaining([
      "antes_vencimento_5",
      "antes_vencimento_4",
      "antes_vencimento_3",
      "antes_vencimento_2",
      "antes_vencimento_1",
      "no_vencimento",
    ]));
  });

  it("interpreta o horário configurado no fuso de Brasília", () => {
    const referencia = new Date("2026-08-18T12:34:00.000Z");
    expect(obterDataBrasilia(referencia)).toBe("2026-08-18");
    expect(obterHorarioBrasilia(referencia)).toBe("09:34");
    expect(deveExecutarNoHorario("09:34", referencia)).toBe(true);
    expect(deveExecutarNoHorario("09:35", referencia)).toBe(false);
  });

  it("calcula as datas-alvo de cinco e quatro dias antes no calendário de Brasília", () => {
    const referencia = new Date("2026-08-18T12:34:00.000Z");
    expect(calcularDataAlvoBrasilia(5, referencia)).toBe("2026-08-23");
    expect(calcularDataAlvoBrasilia(4, referencia)).toBe("2026-08-22");
  });
});
