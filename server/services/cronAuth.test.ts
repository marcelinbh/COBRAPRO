import { describe, expect, it } from "vitest";

const secret = process.env.AUTOMATION_CRON_SECRET;

describe("endpoint de autenticação da automação", () => {
  it("aceita o segredo configurado no endpoint leve de saúde", async () => {
    expect(secret).toBeTruthy();
    const response = await fetch("http://127.0.0.1:3000/api/scheduled/notificacoes/health", {
      method: "POST",
      headers: { "x-automation-cron-secret": secret ?? "" },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, service: "notificacoes-automaticas" });
  });

  it("recusa uma chave diferente no endpoint leve de saúde", async () => {
    const response = await fetch("http://127.0.0.1:3000/api/scheduled/notificacoes/health", {
      method: "POST",
      headers: { "x-automation-cron-secret": "segredo-invalido" },
    });
    expect(response.status).toBe(403);
  });
});
