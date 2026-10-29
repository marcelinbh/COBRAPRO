import { afterEach, describe, expect, it, vi } from "vitest";

describe("segredo da sessão", () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
    vi.resetModules();
  });

  it("recusa verificar sessão quando JWT_SECRET está ausente", async () => {
    delete process.env.JWT_SECRET;
    vi.resetModules();
    const { sdk } = await import("./_core/sdk");

    await expect(sdk.verifySession("eyJhbGciOiJIUzI1NiJ9.e30.invalid"))
      .resolves.toBeNull();
  });
});
