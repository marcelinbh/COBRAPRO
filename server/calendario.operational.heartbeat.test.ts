import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dataHojeBrasilia } from "./services/businessDate";

const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const bloco = source.split("app.post('/api/scheduled/atualizar-parcelas', async (req, res) => {")[1].split("\n  });")[0];

describe("heartbeat de status sem escrita financeira", () => {
  it("não consulta/escreve parcelas nem emite capability/RPC", () => {
    expect(bloco).toContain("autenticarDisparadorDeAutomacao(req)");
    expect(bloco).not.toMatch(/\.update\(|\.insert\(|\.delete\(|\.rpc\(|\.from\(|getSupabaseClientAsync|capability/i);
    expect(bloco).toContain("atualizadas: 0");
    expect(bloco).toContain("modo: 'somente_leitura'");
  });
  it("preserva endpoint POST e não cria endpoint GET mutante", () => {
    expect(source).toContain("app.post('/api/scheduled/atualizar-parcelas'");
    expect(source).not.toContain("app.get('/api/scheduled/atualizar-parcelas'");
  });
  it.each([false, true])("executa apenas o handler isolado autenticado=%s", async autorizado => {
    // Único import dinâmico autorizado vira o helper local puro, nunca o servidor.
    const code = bloco
      .replace("const { dataHojeBrasilia } = await import('../services/businessDate');", "")
      .replace("catch (err: any)", "catch (err)");
    const handler = new Function("req", "res", "autenticarDisparadorDeAutomacao", "dataHojeBrasilia", "console", `return (async () => {${code}\n})();`);
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res); res.json.mockReturnValue(res);
    const auth = vi.fn(async () => autorizado);
    await handler({}, res, auth, () => dataHojeBrasilia(new Date("2027-01-01T00:00:00.999Z")), { log: vi.fn(), error: vi.fn() });
    expect(auth).toHaveBeenCalledTimes(1);
    if (!autorizado) {
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Acesso exclusivo para automação autorizada" });
    } else {
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, atualizadas: 0, modo: "somente_leitura", data: "2026-12-31" });
    }
  });
  it("outros heartbeats existentes permanecem com autenticação e keepalive leve", () => {
    const keepalive = source.split("app.post('/api/scheduled/supabase-keepalive'")[1].split("// tRPC API")[0];
    expect(keepalive).toContain("autenticarDisparadorDeAutomacao(req)");
    expect(keepalive).toContain("sb.from('users').select('id').limit(1)");
    expect(source).toContain("app.post('/api/scheduled/notificacoes/health'");
  });
});
