import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSupabaseClientAsync } from "../db";
import { ENV } from "../_core/env";

// ─── HELPER: Enviar via Evolution API (config global) ─────────────────────────
function getEvolutionConfig(userId: number) {
  return {
    url: ENV.evolutionApiUrl.replace(/\/$/, ""),
    apiKey: ENV.evolutionApiKey,
    instanceName: `user-${userId}`,
  };
}

async function sendWhatsAppMessage(phone: string, text: string, userId: number): Promise<boolean> {
  const config = getEvolutionConfig(userId);
  let p = phone.replace(/\D/g, "");
  if (!p.startsWith("55")) p = "55" + p;
  const res = await fetch(`${config.url}/message/sendText/${config.instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.apiKey },
    body: JSON.stringify({ number: p + "@s.whatsapp.net", textMessage: { text } }),
  });
  return res.ok;
}

// ─── HELPER: Gerar mensagem no formato CobraFácil ─────────────────────────────
async function gerarMensagemRelatorio(userId: number): Promise<string> {
  const sb = await getSupabaseClientAsync();
  if (!sb) return "";

  const hoje = new Date().toISOString().split("T")[0];

  // Configurações da empresa
  const { data: cfgData } = await sb.from("configuracoes").select("chave, valor").eq("user_id", userId);
  const cfg: Record<string, string> = {};
  (cfgData || []).forEach((r: { chave: string; valor: string }) => { cfg[r.chave] = r.valor; });
  const nomeEmpresa = cfg["nomeEmpresa"] || cfg["assinaturaWhatsapp"] || "CobraPro";

  // Parcelas vencendo hoje (pendentes)
  const { data: vencendoHoje } = await sb
    .from("parcelas")
    .select("id, valor, status, contratos(clientes(nome, telefone))")
    .eq("data_vencimento", hoje)
    .eq("user_id", userId)
    .neq("status", "paga");

  // Parcelas em atraso (status = atrasada)
  const { data: emAtraso } = await sb
    .from("parcelas")
    .select("id, valor, data_vencimento, contratos(clientes(nome, telefone))")
    .eq("status", "atrasada")
    .eq("user_id", userId)
    .order("data_vencimento", { ascending: true });

  // Carteira: clientes ativos, contratos ativos, capital
  const { data: contratosAtivos } = await sb
    .from("contratos")
    .select("id, valor_principal, status")
    .eq("status", "ativo")
    .eq("user_id", userId);

  const { data: clientesAtivos } = await sb
    .from("clientes")
    .select("id")
    .eq("status", "ativo")
    .eq("user_id", userId);

  const capitalNaRua = (contratosAtivos || []).reduce(
    (s: number, c: { valor_principal: string }) => s + parseFloat(c.valor_principal || "0"), 0
  );

  // Total a cobrar hoje
  const totalVencendoHoje = (vencendoHoje || []).reduce(
    (s: number, p: { valor: string }) => s + parseFloat(p.valor || "0"), 0
  );

  const totalEmAtraso = (emAtraso || []).reduce(
    (s: number, p: { valor: string }) => s + parseFloat(p.valor || "0"), 0
  );

  // Data formatada
  const dataObj = new Date();
  const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const diaSemana = diasSemana[dataObj.getDay()];
  const dataFormatada = `${String(dataObj.getDate()).padStart(2, "0")}/${String(dataObj.getMonth() + 1).padStart(2, "0")}/${dataObj.getFullYear()}`;

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const qtdVence = (vencendoHoje || []).length;
  const qtdAtraso = (emAtraso || []).length;

  let msg = `📊 *RELATÓRIO COBRAPRO*\n`;
  msg += `🗓 ${dataFormatada} • ${diaSemana}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `💰 *RESUMO DO DIA*\n`;
  msg += `▸ A cobrar hoje: *${fmt(totalVencendoHoje)}* (${qtdVence} parcela${qtdVence !== 1 ? "s" : ""})\n`;
  msg += `▸ Total em atraso: *${fmt(totalEmAtraso)}* (${qtdAtraso} parcela${qtdAtraso !== 1 ? "s" : ""})\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (qtdVence > 0) {
    msg += `⏰ *VENCE HOJE — ${fmt(totalVencendoHoje)}*\n`;
    const grupos: Record<string, { valor: number; tipo: string }[]> = {};
    (vencendoHoje || []).forEach((p: any) => {
      const nome = p.contratos?.clientes?.nome || "Cliente";
      if (!grupos[nome]) grupos[nome] = [];
      grupos[nome].push({ valor: parseFloat(p.valor || "0"), tipo: "Parcela" });
    });
    Object.entries(grupos).forEach(([nome, parcelas]) => {
      parcelas.forEach(({ valor }) => {
        msg += `  • ${nome} — ${fmt(valor)}\n`;
        msg += `    └ Mensal\n`;
      });
    });
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  if (qtdAtraso > 0) {
    msg += `🔴 *EM ATRASO — ${fmt(totalEmAtraso)}*\n`;
    (emAtraso || []).slice(0, 8).forEach((p: any) => {
      const nome = p.contratos?.clientes?.nome || "Cliente";
      const venc = new Date(p.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR");
      msg += `  • ${nome} — ${fmt(parseFloat(p.valor || "0"))}\n`;
      msg += `    └ Venceu ${venc}\n`;
    });
    if (qtdAtraso > 8) msg += `  ... e mais ${qtdAtraso - 8} em atraso\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  msg += `📈 *SUA CARTEIRA*\n`;
  msg += `▸ Clientes ativos: ${(clientesAtivos || []).length}\n`;
  msg += `▸ Empréstimos ativos: ${(contratosAtivos || []).length}\n`;
  msg += `▸ Capital na rua: *${fmt(capitalNaRua)}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_${nomeEmpresa}_`;

  return msg;
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
      await sb.from("configuracoes").upsert([
        { chave: "relatorio_diario_ativo", valor: String(input.ativo), user_id: ctx.user.id },
        { chave: "relatorio_diario_horario", valor: input.horario, user_id: ctx.user.id },
        { chave: "relatorio_diario_telefone", valor: input.telefone, user_id: ctx.user.id },
      ], { onConflict: "chave,user_id" });
      return { success: true };
    }),

  // Enviar relatório agora (manual)
  enviarAgora: protectedProcedure
    .input(z.object({ telefone: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verificar se WhatsApp está conectado
      const { data: cfgData } = await sb.from("configuracoes").select("chave, valor").in("chave", [
        "evolution_url", "evolution_api_key", "evolution_instance",
        "relatorio_diario_telefone",
      ]).eq("user_id", ctx.user.id);
      const cfg: Record<string, string> = {};
      (cfgData || []).forEach((r: { chave: string; valor: string }) => { cfg[r.chave] = r.valor; });

      const telefone = input?.telefone || cfg["relatorio_diario_telefone"] || "";
      if (!telefone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Configure o número de telefone para receber o relatório" });
      }

      const mensagem = await gerarMensagemRelatorio(ctx.user.id);
      if (!mensagem) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao gerar relatório" });

      const enviado = await sendWhatsAppMessage(telefone, mensagem, ctx.user.id);
      if (!enviado) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao enviar mensagem. Verifique se o WhatsApp está conectado." });
      }

      return { success: true, mensagem };
    }),

  // Preview da mensagem (sem enviar)
  preview: protectedProcedure.query(async ({ ctx }) => {
    const mensagem = await gerarMensagemRelatorio(ctx.user.id);
    return { mensagem };
  }),
});
