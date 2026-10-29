import { describe, expect, it } from "vitest";
import { pseudonimizarIp } from "./loginLogger";

describe("pseudonimizarIp", () => {
  it("gera um identificador determinístico e não retém o IP em claro", () => {
    const value = pseudonimizarIp("203.0.113.10", "segredo-de-teste");
    expect(value).toHaveLength(24);
    expect(value).not.toContain("203.0.113.10");
    expect(value).toBe(pseudonimizarIp("203.0.113.10", "segredo-de-teste"));
  });

  it("não registra identificador quando não há IP ou segredo", () => {
    expect(pseudonimizarIp("unknown", "segredo")).toBeNull();
    expect(pseudonimizarIp("203.0.113.10", "")).toBeNull();
  });
});
