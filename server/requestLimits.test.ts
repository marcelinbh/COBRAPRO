import { describe, expect, it } from "vitest";
import { LIMITE_CORPO_PADRAO, LIMITE_CORPO_UPLOAD, LIMITE_FORMULARIO } from "./requestLimits";

describe("limites de requisição", () => {
  it("mantém o limite especial de upload isolado dos endpoints comuns", () => {
    expect(LIMITE_CORPO_PADRAO).toBe("3mb");
    expect(LIMITE_CORPO_UPLOAD).toBe("15mb");
    expect(LIMITE_FORMULARIO).toBe("256kb");
  });
});
