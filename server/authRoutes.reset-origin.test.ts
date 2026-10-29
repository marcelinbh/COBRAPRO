import { describe, expect, it } from "vitest";
import { obterOrigemSeguraParaReset, origemEhConfiavelParaMutacaoPublica } from "./authRoutes";

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

  it("não confia em subdomínios compartilhados de hospedagem", () => {
    expect(obterOrigemSeguraParaReset("https://atacante.manus.space")).toBe("https://cobrapro.online");
    expect(obterOrigemSeguraParaReset("https://atacante.manus.computer")).toBe("https://cobrapro.online");
  });

  it("rejeita uma mutação de autenticação iniciada em site externo", () => {
    expect(origemEhConfiavelParaMutacaoPublica({
      headers: { origin: "https://phishing.example", "sec-fetch-site": "cross-site" },
    } as any)).toBe(false);
  });

  it("aceita a origem oficial e chamadas sem cabeçalhos de navegador", () => {
    expect(origemEhConfiavelParaMutacaoPublica({
      headers: { origin: "https://cobrapro.online", "sec-fetch-site": "same-origin" },
    } as any)).toBe(true);
    expect(origemEhConfiavelParaMutacaoPublica({ headers: {} } as any)).toBe(true);
  });
});
