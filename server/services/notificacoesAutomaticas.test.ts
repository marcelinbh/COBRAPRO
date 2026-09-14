import { describe, expect, it } from "vitest";
import {
  calcularDataAlvoBrasilia,
  criarPayloadTextoEvolution,
  deveExecutarNoHorario,
  inicioDoDiaBrasilia,
  normalizarTelefoneWhatsApp,
  obterDataBrasilia,
  obterHorarioBrasilia,
  substituirVariaveis,
} from "./notificacoesAutomaticas";

describe("notificacoesAutomaticas", () => {
  const noveHorasEmBrasilia = new Date("2026-09-14T12:00:00.000Z");

  it("usa a data e o horário de Brasília, não o fuso do servidor", () => {
    expect(obterDataBrasilia(noveHorasEmBrasilia)).toBe("2026-09-14");
    expect(obterHorarioBrasilia(noveHorasEmBrasilia)).toBe("09:00");
    expect(deveExecutarNoHorario("09:00", noveHorasEmBrasilia)).toBe(true);
    expect(deveExecutarNoHorario("08:55", noveHorasEmBrasilia)).toBe(false);
    expect(deveExecutarNoHorario("09:00", new Date("2026-09-14T12:04:59.000Z"))).toBe(true);
    expect(deveExecutarNoHorario("09:00", new Date("2026-09-14T12:05:00.000Z"))).toBe(false);
  });

  it("calcula corretamente lembretes de três dias antes e do próprio vencimento", () => {
    expect(calcularDataAlvoBrasilia(3, noveHorasEmBrasilia)).toBe("2026-09-17");
    expect(calcularDataAlvoBrasilia(0, noveHorasEmBrasilia)).toBe("2026-09-14");
    expect(calcularDataAlvoBrasilia(-1, noveHorasEmBrasilia)).toBe("2026-09-13");
  });

  it("produz o início correto do dia de referência para bloquear reenvio duplicado", () => {
    expect(inicioDoDiaBrasilia("2026-09-14")).toBe("2026-09-14T03:00:00.000Z");
  });

  it("substitui as variáveis de cobrança no texto personalizado", () => {
    const mensagem = substituirVariaveis("Olá {nome}, sua parcela {parcela}/{total_parcelas} de R$ {valor} vence em {data_vencimento}. — {empresa}", {
      nome: "Ana",
      parcela: 2,
      total_parcelas: 6,
      valor: 125.5,
      data_vencimento: "17/09/2026",
      empresa: "Ultra Credi",
    });
    expect(mensagem).toBe("Olá Ana, sua parcela 2/6 de R$ 125,50 vence em 17/09/2026. — Ultra Credi");
  });

  it("normaliza telefones brasileiros para a Evolution API", () => {
    expect(normalizarTelefoneWhatsApp("(31) 99746-6817")).toBe("5531997466817");
    expect(normalizarTelefoneWhatsApp("5531997466817")).toBe("5531997466817");
  });

  it("monta o payload da Evolution API com número internacional sem sufixo JID", () => {
    expect(criarPayloadTextoEvolution("(31) 99746-6817", "Olá!")).toEqual({
      number: "5531997466817",
      textMessage: { text: "Olá!" },
    });
  });
});
