import { describe, expect, it } from "vitest";
import {
  documentoBlacklistValido,
  mascararDocumentoBlacklist,
  mascararNomeBlacklist,
  normalizarDocumentoBlacklist,
  normalizarTextoBlacklist,
  normalizarValorBlacklist,
} from "./blacklistPrivacy";

describe("privacidade e validação da Blacklist", () => {
  it("normaliza e valida somente CPF/CNPJ completos com dígito verificador", () => {
    expect(normalizarDocumentoBlacklist("529.982.247-25")).toBe("52998224725");
    expect(documentoBlacklistValido("529.982.247-25")).toBe(true);
    expect(documentoBlacklistValido("04.252.011/0001-10")).toBe(true);
    expect(documentoBlacklistValido("529.982.247-24")).toBe(false);
    expect(documentoBlacklistValido("111.111.111-11")).toBe(false);
    expect(documentoBlacklistValido("52998")).toBe(false);
  });

  it("não revela o documento completo nem sobrenomes completos na consulta compartilhada", () => {
    expect(mascararDocumentoBlacklist("52998224725")).toBe("***.***.***-25");
    expect(mascararDocumentoBlacklist("04252011000110")).toBe("**.***.***/****-10");
    expect(mascararNomeBlacklist("Maria da Silva")).toBe("Maria D** S****");
  });

  it("remove textos vazios e recusa valores monetários malformados", () => {
    expect(normalizarTextoBlacklist("  Rua   Central ", 30)).toBe("Rua Central");
    expect(normalizarTextoBlacklist("   ", 30)).toBeNull();
    expect(normalizarValorBlacklist("1500,5")).toBe("1500.50");
    expect(() => normalizarValorBlacklist("1; DROP TABLE")).toThrow("Valor da dívida inválido");
    expect(() => normalizarValorBlacklist("-1")).toThrow("Valor da dívida inválido");
  });
});
