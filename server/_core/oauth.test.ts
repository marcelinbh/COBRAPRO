import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { oauthLegadoEstaHabilitado, registerOAuthRoutes } from "./oauth";

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
  server = undefined;
});

describe("OAuth legado", () => {
  it("permanece desabilitado por padrão e só liga com opt-in explícito", () => {
    expect(oauthLegadoEstaHabilitado({})).toBe(false);
    expect(oauthLegadoEstaHabilitado({ ENABLE_LEGACY_MANUS_OAUTH: "false" })).toBe(false);
    expect(oauthLegadoEstaHabilitado({ ENABLE_LEGACY_MANUS_OAUTH: "true" })).toBe(true);
  });

  it("não processa callback quando o fluxo legado não foi autorizado", async () => {
    const original = process.env.ENABLE_LEGACY_MANUS_OAUTH;
    delete process.env.ENABLE_LEGACY_MANUS_OAUTH;
    try {
      const app = express();
      registerOAuthRoutes(app);
      server = await new Promise<Server>(resolve => {
        const created = app.listen(0, "127.0.0.1", () => resolve(created));
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("porta de teste indisponível");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/oauth/callback?code=teste&state=teste`);
      expect(response.status).toBe(410);
    } finally {
      if (original === undefined) delete process.env.ENABLE_LEGACY_MANUS_OAUTH;
      else process.env.ENABLE_LEGACY_MANUS_OAUTH = original;
    }
  });
});
