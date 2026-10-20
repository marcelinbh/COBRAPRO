import { afterEach, describe, expect, it, vi } from "vitest";

const chaveOriginal = process.env.EVOLUTION_API_KEY;

afterEach(() => {
  if (chaveOriginal === undefined) delete process.env.EVOLUTION_API_KEY;
  else process.env.EVOLUTION_API_KEY = chaveOriginal;
  vi.resetModules();
});

describe("ENV.evolutionApiKey", () => {
  it("não fornece chave padrão quando o ambiente não a configurou", async () => {
    delete process.env.EVOLUTION_API_KEY;
    vi.resetModules();
    const { ENV } = await import("./_core/env");
    expect(ENV.evolutionApiKey).toBe("");
  });

  it("consome a chave exclusivamente da variável de ambiente", async () => {
    process.env.EVOLUTION_API_KEY = "segredo-de-teste";
    vi.resetModules();
    const { ENV } = await import("./_core/env");
    expect(ENV.evolutionApiKey).toBe("segredo-de-teste");
  });
});
