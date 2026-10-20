import { describe, expect, it } from "vitest";
import { validarLogoBase64 } from "./perfil";

const pngMinimo = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString("base64");

describe("validarLogoBase64", () => {
  it("aceita PNG cuja assinatura corresponde ao MIME", () => {
    const logo = validarLogoBase64(`data:image/png;base64,${pngMinimo}`, "image/png");
    expect(logo.ext).toBe("png");
    expect(logo.buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("rejeita conteúdo que finge ser imagem", () => {
    expect(() => validarLogoBase64(Buffer.from("<script>alert(1)</script>").toString("base64"), "image/png"))
      .toThrow("não corresponde ao formato");
  });

  it("rejeita MIME não permitido e base64 malformado", () => {
    expect(() => validarLogoBase64(pngMinimo, "image/svg+xml")).toThrow("Formato de logo não permitido");
    expect(() => validarLogoBase64("não-é-base64", "image/png")).toThrow("Conteúdo do logo inválido");
  });
});
