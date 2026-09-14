import { deveEnviarRelatorioDiario } from "./relatorioDiarioAutomatico";
import { describe, expect, it } from "vitest";

describe("relatorioDiarioAutomatico", () => {
  const oitoHorasEmBrasilia = new Date("2026-09-15T11:00:00.000Z");

  it("processa o relatório ativo no horário escolhido e com telefone configurado", () => {
    expect(deveEnviarRelatorioDiario({
      ativo: "true",
      horario: "08:00",
      telefone: "(31) 99746-6817",
    }, oitoHorasEmBrasilia)).toBe(true);
  });

  it("não reenvia o relatório que já foi marcado para a data de Brasília", () => {
    expect(deveEnviarRelatorioDiario({
      ativo: "true",
      horario: "08:00",
      telefone: "31997466817",
      ultimoEnvio: "2026-09-15",
    }, oitoHorasEmBrasilia)).toBe(false);
  });

  it("não envia quando a configuração está inativa, fora do horário ou sem telefone", () => {
    expect(deveEnviarRelatorioDiario({ ativo: "false", horario: "08:00", telefone: "31997466817" }, oitoHorasEmBrasilia)).toBe(false);
    expect(deveEnviarRelatorioDiario({ ativo: "true", horario: "08:05", telefone: "31997466817" }, oitoHorasEmBrasilia)).toBe(false);
    expect(deveEnviarRelatorioDiario({ ativo: "true", horario: "08:00", telefone: "" }, oitoHorasEmBrasilia)).toBe(false);
  });
});
