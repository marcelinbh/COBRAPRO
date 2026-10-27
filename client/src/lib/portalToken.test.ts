import { describe, expect, it } from "vitest";
import { resolverTokenPortal } from "./portalToken";

describe("resolverTokenPortal", () => {
  it("lê o token emitido no caminho /portal/:token", () => {
    expect(resolverTokenPortal("token-da-rota", "")).toBe("token-da-rota");
  });

  it("mantém compatibilidade com links antigos que usavam query string", () => {
    expect(resolverTokenPortal(undefined, "?token=token-legado")).toBe("token-legado");
  });

  it("prioriza o token da rota e ignora query string conflitante", () => {
    expect(resolverTokenPortal("token-atual", "?token=forjado")).toBe("token-atual");
  });
});
