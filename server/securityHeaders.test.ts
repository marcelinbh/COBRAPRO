import { describe, expect, it, vi } from "vitest";
import { cabecalhosSeguranca } from "./securityHeaders";

function executar(headers: Record<string, string> = {}, secure = false) {
  const setHeader = vi.fn();
  const next = vi.fn();
  cabecalhosSeguranca({ secure, headers } as any, { setHeader } as any, next);
  return { setHeader, next };
}

describe("cabecalhosSeguranca", () => {
  it("aplica defesas contra enquadramento, sniffing e referências excessivas", () => {
    const { setHeader, next } = executar();
    expect(setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(setHeader).toHaveBeenCalledWith("Referrer-Policy", "strict-origin-when-cross-origin");
    expect(setHeader).toHaveBeenCalledWith("Content-Security-Policy", expect.stringContaining("frame-ancestors 'none'"));
    expect(next).toHaveBeenCalledOnce();
  });

  it("só ativa HSTS quando a requisição chegou por HTTPS", () => {
    const http = executar();
    expect(http.setHeader).not.toHaveBeenCalledWith("Strict-Transport-Security", expect.any(String));

    const https = executar({ "x-forwarded-proto": "https" });
    expect(https.setHeader).toHaveBeenCalledWith("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  });
});
