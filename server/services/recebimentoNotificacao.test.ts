import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const h = vi.hoisted(() => ({ fila: vi.fn() }));
vi.mock("./notificacoesAutomaticas", () => ({ enfileirarConfirmacaoPagamento: h.fila }));
import { recebimentoComConfirmacao } from "./recebimentoNotificacao";
const operationId = "22222222-2222-4222-8222-222222222222";
const resultado = { success: true as const, operationId, saldoResidual: "0.00", valorRecebido: "100.00" };
beforeEach(() => { vi.clearAllMocks(); h.fila.mockResolvedValue({ criada: true }); });
describe("recebimento confirmado antes do aviso WhatsApp", () => {
  it.each(["ciclo_operacoes", "legados_operacoes"] as const)("%s consulta prova somente depois do financeiro e preserva resposta", async fonte => {
    const eventos: string[] = [];
    h.fila.mockImplementation(async (...args) => { eventos.push("fila"); expect(args).toEqual([77, fonte, operationId]); });
    const receber = vi.fn(async () => { eventos.push("financeiro"); return resultado; });
    expect(await recebimentoComConfirmacao(77, fonte, receber)).toBe(resultado);
    expect(eventos).toEqual(["financeiro", "fila"]); expect(receber).toHaveBeenCalledTimes(1);
  });
  it("erro/timeout financeiro não solicita aviso nem repete mutação", async () => {
    const erro = new Error("timeout"); const receber = vi.fn().mockRejectedValue(erro);
    await expect(recebimentoComConfirmacao(77, "ciclo_operacoes", receber)).rejects.toBe(erro);
    expect(h.fila).not.toHaveBeenCalled(); expect(receber).toHaveBeenCalledTimes(1);
  });
  it.each([{ success: false, operationId }, { success: true, operationId: "bad" }])("não avisa resultado financeiro inválido %j", async r => {
    await expect(recebimentoComConfirmacao(77, "ciclo_operacoes", async () => r as any)).rejects.toThrow("sem confirmação"); expect(h.fila).not.toHaveBeenCalled();
  });
  it("falha de fila conserva pagamento e registra só alerta sanitizado", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try { h.fila.mockRejectedValue(new Error("erro secreto com PII"));
      expect(await recebimentoComConfirmacao(77, "legados_operacoes", async () => resultado)).toBe(resultado);
      expect(warning).toHaveBeenCalledTimes(1); expect(JSON.stringify(warning.mock.calls)).not.toContain("PII");
    } finally { warning.mockRestore(); }
  });
  it("regra desligada não mascara sucesso nem presume envio", async () => { h.fila.mockResolvedValue({ criada: false }); expect(await recebimentoComConfirmacao(77, "ciclo_operacoes", async () => resultado)).toBe(resultado); });
  it("retry utiliza exatamente a mesma operação na deduplicação da fila", async () => {
    for (let i = 0; i < 2; i++) await recebimentoComConfirmacao(77, "legados_operacoes", async () => ({ ...resultado, repetida: i > 0 }));
    expect(h.fila.mock.calls).toEqual([[77, "legados_operacoes", operationId], [77, "legados_operacoes", operationId]]);
  });
  it("ambas rotas montam o wrapper, sem ligação a cotação ou renovação", () => {
    for (const [name, fonte] of [["emprestimosProspectivos", "ciclo_operacoes"], ["recebimentosLegados", "legados_operacoes"]]) {
      const s = readFileSync(new URL(`../routers/${name}.ts`, import.meta.url), "utf8");
      expect(s).toContain(`recebimentoComConfirmacao(ctx.user.id, "${fonte}"`);
    }
    const renovar = readFileSync(new URL("../routers/renovacaoProspectiva.ts", import.meta.url), "utf8"); expect(renovar).not.toContain("recebimentoComConfirmacao");
  });
});
