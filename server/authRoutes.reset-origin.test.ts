import { describe, expect, it } from "vitest";
import { obterOrigemSeguraParaReset } from "./authRoutes";

describe("obterOrigemSeguraParaReset", () => {
  it("mantém o domínio oficial para origens permitidas", () => {
    expect(obterOrigemSeguraParaReset("https://www.cobrapro.online")).toBe("https://www.cobrapro.online");
  });

  it("descarta Origin controlado por atacante", () => {
    expect(obterOrigemSeguraParaReset("https://phishing.example/reset")).toBe("https://cobrapro.online");
  });

  it("descarta esquemas inseguros e cabeçalhos inválidos", () => {
    expect(obterOrigemSeguraParaReset("http://cobrapro.online")).toBe("https://cobrapro.online");
    expect(obterOrigemSeguraParaReset("not a url")).toBe("https://cobrapro.online");
    expect(obterOrigemSeguraParaReset(undefined)).toBe("https://cobrapro.online");
  });
});
