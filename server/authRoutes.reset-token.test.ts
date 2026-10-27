import { describe, expect, it, vi } from "vitest";
import { consumirTokenRecuperacaoNoSupabase, hashTokenDeRecuperacao } from "./authRoutes";

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

describe("consumirTokenRecuperacaoNoSupabase", () => {
  it("atualiza com filtros de token, uso e expiração em uma única operação", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 42 }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const gt = vi.fn().mockReturnValue({ select });
    const eqUsado = vi.fn().mockReturnValue({ gt });
    const eqToken = vi.fn().mockReturnValue({ eq: eqUsado });
    const update = vi.fn().mockReturnValue({ eq: eqToken });
    const from = vi.fn().mockReturnValue({ update });
    const supabase = { from };
    const agora = new Date("2026-10-27T12:00:00.000Z");

    await expect(consumirTokenRecuperacaoNoSupabase(supabase, "hash", agora)).resolves.toBe(42);
    expect(from).toHaveBeenCalledWith("password_resets");
    expect(update).toHaveBeenCalledWith({ usado: true });
    expect(eqToken).toHaveBeenCalledWith("token", "hash");
    expect(eqUsado).toHaveBeenCalledWith("usado", false);
    expect(gt).toHaveBeenCalledWith("expires_at", agora.toISOString());
  });

  it("não aceita token já consumido, expirado ou inexistente", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle }) }),
            }),
          }),
        }),
      }),
    };

    await expect(consumirTokenRecuperacaoNoSupabase(supabase, "hash", new Date())).resolves.toBeNull();
  });
});
