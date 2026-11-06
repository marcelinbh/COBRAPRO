import { describe, expect, it, vi } from "vitest";
import { isSessionVersion, resetPasswordAndRevokeSessions, sessionVersionFromUser } from "./sessionRevocation";

describe("versão de sessão estrita", () => {
  it.each([0, 1, 12])("aceita inteiro %s nos dois adaptadores", (version) => {
    expect(sessionVersionFromUser({ session_version: version })).toBe(version);
    expect(sessionVersionFromUser({ sessionVersion: version })).toBe(version);
  });
  it.each([undefined, null, "0", -1, 1.5, NaN, Infinity])("não converte valor inválido %s em zero", (value) => {
    expect(isSessionVersion(value)).toBe(false);
    expect(() => sessionVersionFromUser({ session_version: value })).toThrow();
  });
  it("não mascara alias inválido ou contraditório com outro campo válido", () => {
    expect(() => sessionVersionFromUser({ session_version: null, sessionVersion: 0 })).toThrow();
    expect(() => sessionVersionFromUser({ session_version: 1, sessionVersion: 0 })).toThrow();
    expect(sessionVersionFromUser({ session_version: 2, sessionVersion: 2 })).toBe(2);
  });
});

describe("reset somente via RPC atômica", () => {
  it("não envia usuário, token bruto, horário nem versão para a RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ user_id: 4, session_version: 2 }], error: null });
    expect(await resetPasswordAndRevokeSessions({ rpc }, "hash-token", "hash-senha")).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("consume_password_reset_and_revoke_sessions", {
      p_token_hash: "hash-token", p_password_hash: "hash-senha",
    });
  });
  it("trata zero linhas como token inválido", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    expect(await resetPasswordAndRevokeSessions({ rpc }, "hash", "senha")).toBe(false);
  });
  it("não vaza resposta do banco nem executa fallback após erro", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "dados-sensiveis" } });
    await expect(resetPasswordAndRevokeSessions({ rpc }, "hash", "senha")).rejects.toThrow("Redefinição transacional de senha indisponível.");
  });
  it("não divulga erro de transporte que contenha parâmetros", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("hash-sensivel-do-payload"));
    await expect(resetPasswordAndRevokeSessions({ rpc }, "hash", "senha")).rejects.toThrow("Redefinição transacional de senha indisponível.");
  });
  it.each([null, {}, [{ user_id: 4 }], [{ user_id: 4, session_version: 0 }], [{ user_id: "4", session_version: 1 }], [{ user_id: 4, session_version: 1 }, { user_id: 5, session_version: 1 }]])("recusa retorno malformado %s", async (data) => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    await expect(resetPasswordAndRevokeSessions({ rpc }, "hash", "senha")).rejects.toThrow("Resposta inválida");
  });
});
