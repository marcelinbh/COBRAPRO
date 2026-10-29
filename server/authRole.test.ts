import { describe, expect, it } from "vitest";
import { ROLE_CADASTRO_PUBLICO } from "./authRole";

describe("papel de cadastro público", () => {
  it("nunca concede administração automaticamente", () => {
    expect(ROLE_CADASTRO_PUBLICO).toBe("user");
  });
});
