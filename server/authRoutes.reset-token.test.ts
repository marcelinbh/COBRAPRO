import { describe, expect, it } from "vitest";
import { hashTokenDeRecuperacao } from "./authRoutes";

describe("hashTokenDeRecuperacao", () => {
  it("é determinística, tem SHA-256 e não persiste o token original", () => {
    const token = "a".repeat(64);
    const hash = hashTokenDeRecuperacao(token);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashTokenDeRecuperacao(token)).toBe(hash);
  });

  it("produz hashes diferentes para tokens diferentes", () => {
    expect(hashTokenDeRecuperacao("token-a")).not.toBe(hashTokenDeRecuperacao("token-b"));
  });
});
