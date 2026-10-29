import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { registerAuthRoutes } from "./authRoutes";

let server: Server | undefined;

async function iniciarServidor() {
  const app = express();
  app.use(express.json());
  registerAuthRoutes(app);
  app.use((_req, res) => res.status(404).json({ error: "not found" }));

  server = await new Promise<Server>(resolve => {
    const created = app.listen(0, "127.0.0.1", () => resolve(created));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("porta de teste indisponível");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
  server = undefined;
});

describe("guardas de origem das rotas de autenticação", () => {
  it("rejeita login iniciado por origem externa antes de consultar o banco", async () => {
    const baseUrl = await iniciarServidor();
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://phishing.example",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ email: "alvo@example.com", password: "nao-importa" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Origem da requisição não permitida" });
  });

  it("mantém a rota oficial elegível e rejeita o logout HTTP legado por GET", async () => {
    const baseUrl = await iniciarServidor();
    const origemOficial = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://cobrapro.online",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({}),
    });
    expect(origemOficial.status).toBe(400);

    const logoutLegado = await fetch(`${baseUrl}/api/auth/logout`, { redirect: "manual" });
    expect(logoutLegado.status).toBe(404);
  });
});
