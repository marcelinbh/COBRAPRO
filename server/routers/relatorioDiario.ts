import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSupabaseClientAsync } from "../db";
import { enviarMensagemEvolution } from "../services/evolutionClient";
import { gerarPreviewRelatorioDiario } from "../financialReporting";

// Compartilhado com whatsapp.relatorioDiario. Falha fechada, somente leitura.
export async function gerarMensagemRelatorio(userId: number): Promise<string> {
  const preview = await gerarPreviewRelatorioDiario(await getSupabaseClientAsync(), userId);
  return preview.mensagem;
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
export const relatorioDiarioRouter = router({

  // Obter configurações do relatório diário
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const sb = await getSupabaseClientAsync();
    if (!sb) return { ativo: false, horario: "08:00", telefone: "" };
    const { data } = await sb.from("configuracoes").select("chave, valor").in("chave", [
      "relatorio_diario_ativo",
      "relatorio_diario_horario",
      "relatorio_diario_telefone",
    ]).eq("user_id", ctx.user.id);
    const cfg: Record<string, string> = {};
    (data || []).forEach((r: { chave: string; valor: string }) => { cfg[r.chave] = r.valor; });
    return {
      ativo: cfg["relatorio_diario_ativo"] === "true",
      horario: cfg["relatorio_diario_horario"] || "08:00",
      telefone: cfg["relatorio_diario_telefone"] || "",
    };
  }),

  // Salvar configurações do relatório diário
  saveConfig: protectedProcedure
    .input(z.object({
      ativo: z.boolean(),
      horario: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
      telefone: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { error } = await sb.from("configuracoes").upsert([
        { chave: "relatorio_diario_ativo", valor: String(input.ativo), user_id: ctx.user.id },
        { chave: "relatorio_diario_horario", valor: input.horario, user_id: ctx.user.id },
        { chave: "relatorio_diario_telefone", valor: input.telefone, user_id: ctx.user.id },
      ], { onConflict: "chave,user_id" });
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  // Enviar relatório agora (manual)
  enviarAgora: protectedProcedure
    .input(z.object({ telefone: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verificar se WhatsApp está conectado
      const { data: cfgData, error: cfgErro } = await sb.from("configuracoes").select("chave, valor").in("chave", [
        "evolution_url", "evolution_api_key", "evolution_instance",
        "relatorio_diario_telefone",
      ]).eq("user_id", ctx.user.id);
      if (cfgErro || !Array.isArray(cfgData)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Configuração indisponível; relatório não enviado." });
      const cfg: Record<string, string> = {};
      (cfgData || []).forEach((r: { chave: string; valor: string }) => { cfg[r.chave] = r.valor; });

      const telefone = input?.telefone || cfg["relatorio_diario_telefone"] || "";
      if (!telefone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Configure o número de telefone para receber o relatório" });
      }

      const mensagem = await gerarMensagemRelatorio(ctx.user.id);
      if (!mensagem) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao gerar relatório" });

      const resultado = await enviarMensagemEvolution(ctx.user.id, telefone, mensagem);
      if (!resultado.ok) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: resultado.erro || "Erro ao enviar mensagem. Verifique se o WhatsApp está conectado." });
      }

      return { success: true, mensagem, providerMessageId: resultado.providerMessageId };
    }),

  // Preview da mensagem (sem enviar)
  preview: protectedProcedure.query(async ({ ctx }) => {
    const mensagem = await gerarMensagemRelatorio(ctx.user.id);
    return { mensagem, completo: true };
  }),
});
