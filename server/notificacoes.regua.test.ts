import { describe, expect, it } from "vitest";
import {
  TIPOS_NOTIFICACAO,
  deveProcessarReguaNoHorario,
  obterAgoraBrasil,
} from "./routers/notificacoes";

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
    expect(obterAgoraBrasil(referencia)).toEqual({ data: "2026-08-18", horario: "09:34" });
    expect(deveProcessarReguaNoHorario("09:34", referencia)).toBe(true);
    expect(deveProcessarReguaNoHorario("09:35", referencia)).toBe(false);
  });
});
