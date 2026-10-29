import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

describe("cookie de sessão", () => {
  it("usa SameSite Lax, HttpOnly e Secure para uma requisição HTTPS", () => {
    const options = getSessionCookieOptions({
      protocol: "https",
      headers: { host: "cobrapro.online" },
    } as any);

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("reconhece HTTPS informado pelo proxy reverso", () => {
    const options = getSessionCookieOptions({
      protocol: "http",
      headers: { "x-forwarded-proto": "https" },
    } as any);

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("lax");
  });
});
