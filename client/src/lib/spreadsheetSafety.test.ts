import { describe, expect, it } from "vitest";
import { protegerValorDePlanilha, textoSeguroParaPlanilha } from "./spreadsheetSafety";

describe("proteção de células de planilha", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-10+10", "@HYPERLINK(\"https://malicioso\")"]) 
  ("neutraliza texto iniciado por %s", (value) => {
    expect(protegerValorDePlanilha(value)).toBe(`'${value}`);
  });

  it.each([" =1+1", "\t@HYPERLINK(\"https://malicioso\")"])
  ("neutraliza fórmula com espaço inicial: %s", (value) => {
    expect(protegerValorDePlanilha(value)).toBe(`'${value}`);
  });

  it("preserva valores que não podem ser fórmula", () => {
    expect(protegerValorDePlanilha(125.5)).toBe(125.5);
    expect(protegerValorDePlanilha(false)).toBe(false);
    expect(protegerValorDePlanilha("Cliente comum")).toBe("Cliente comum");
  });

  it("sempre devolve texto seguro para serializadores CSV", () => {
    expect(textoSeguroParaPlanilha("=IMPORTXML(...)"))
      .toBe("'=IMPORTXML(...)");
    expect(textoSeguroParaPlanilha(null)).toBe("");
  });
});
