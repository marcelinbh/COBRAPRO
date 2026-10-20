import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSupabaseClientAsync } from "../db";
import { enviarMensagemEvolution, normalizarTelefoneWhatsApp } from "../services/evolutionClient";
import { dataHojeBrasilia } from "../services/businessDate";
import { obterSaudeNotificacoes, substituirVariaveis } from "../services/notificacoesAutomaticas";

export type TipoNotificacao =
  | "antes_vencimento_5" | "antes_vencimento_4" | "antes_vencimento_3" | "antes_vencimento_2" | "antes_vencimento_1"
  | "no_vencimento" | "apos_vencimento_1" | "apos_vencimento_3"
  | "apos_vencimento_7" | "confirmacao_pagamento";

export const TIPOS_NOTIFICACAO: { tipo: TipoNotificacao; label: string; descricao: string; diasAntes: number }[] = [
  { tipo: "antes_vencimento_5", label: "5 dias antes", descricao: "Lembrete 5 dias antes do vencimento", diasAntes: 5 },
  { tipo: "antes_vencimento_4", label: "4 dias antes", descricao: "Lembrete 4 dias antes do vencimento", diasAntes: 4 },
  { tipo: "antes_vencimento_3", label: "3 dias antes", descricao: "Lembrete 3 dias antes do vencimento", diasAntes: 3 },
  { tipo: "antes_vencimento_2", label: "2 dias antes", descricao: "Lembrete 2 dias antes do vencimento", diasAntes: 2 },
  { tipo: "antes_vencimento_1", label: "1 dia antes", descricao: "Lembrete 1 dia antes do vencimento", diasAntes: 1 },
  { tipo: "no_vencimento", label: "No vencimento", descricao: "Aviso no dia do vencimento", diasAntes: 0 },
  { tipo: "apos_vencimento_1", label: "1 dia em atraso", descricao: "Cobrança 1 dia após o vencimento", diasAntes: -1 },
  { tipo: "apos_vencimento_3", label: "3 dias em atraso", descricao: "Cobrança 3 dias após o vencimento", diasAntes: -3 },
  { tipo: "apos_vencimento_7", label: "7 dias em atraso", descricao: "Cobrança 7 dias após o vencimento", diasAntes: -7 },
  { tipo: "confirmacao_pagamento", label: "Confirmação de pagamento", descricao: "Mensagem ao confirmar pagamento", diasAntes: 0 },
];

const MENSAGENS_PADRAO: Record<TipoNotificacao, string> = {
  antes_vencimento_5: "Olá {nome}! 😊 Sua parcela de *R$ {valor}* vence em *5 dias* ({data_vencimento}). Programe-se para não perder o vencimento. — {empresa}",
  antes_vencimento_4: "Olá {nome}! 😊 Sua parcela de *R$ {valor}* vence em *4 dias* ({data_vencimento}). Conte conosco em caso de dúvidas. — {empresa}",
  antes_vencimento_3: "Olá {nome}! 😊 Sua parcela de *R$ {valor}* vence em *3 dias* ({data_vencimento}). Qualquer dúvida, estamos à disposição! — {empresa}",
  antes_vencimento_2: "Olá {nome}! Sua parcela de *R$ {valor}* vence em *2 dias* ({data_vencimento}). Não esqueça! 😉 — {empresa}",
  antes_vencimento_1: "Olá {nome}! ⚠️ Sua parcela de *R$ {valor}* vence *amanhã* ({data_vencimento}). Por favor, efetue o pagamento para evitar juros. — {empresa}",
  no_vencimento: "Olá {nome}! 📅 Sua parcela de *R$ {valor}* vence *hoje* ({data_vencimento}). Efetue o pagamento para evitar juros. — {empresa}",
  apos_vencimento_1: "Olá {nome}, sua parcela de *R$ {valor}* está em atraso há *1 dia*. Por favor, regularize o quanto antes. — {empresa}",
  apos_vencimento_3: "Olá {nome}, sua parcela de *R$ {valor}* está em atraso há *3 dias*. Entre em contato para evitar maiores problemas. — {empresa}",
  apos_vencimento_7: "Olá {nome}, sua parcela de *R$ {valor}* está em atraso há *7 dias*. Urgente: regularize sua situação. — {empresa}",
  confirmacao_pagamento: "Olá {nome}! ✅ Recebemos seu pagamento de *R$ {valor}* referente à parcela {parcela}/{total_parcelas}. Obrigado! — {empresa}",
};

async function requireDb() {
  const sb = await getSupabaseClientAsync();
  if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  return sb;
}

export const notificacoesRouter = router({
  listar: protectedProcedure.query(async ({ ctx }) => {
    const sb = await requireDb();
    const { data, error } = await sb.from("notificacoes_automaticas").select("id, tipo, ativo, mensagem_template").eq("user_id", ctx.user.id);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    const existentes = Object.fromEntries((data ?? []).map((r: any) => [r.tipo, r]));
    return TIPOS_NOTIFICACAO.map(t => ({ ...t, id: existentes[t.tipo]?.id ?? null, ativo: existentes[t.tipo]?.ativo ?? false, mensagem_template: existentes[t.tipo]?.mensagem_template || MENSAGENS_PADRAO[t.tipo] }));
  }),

  getGlobalAtivo: protectedProcedure.query(async ({ ctx }) => {
    const sb = await requireDb();
    const { data, error } = await sb.from("configuracoes").select("valor").eq("chave", "notificacoes_auto_ativo").eq("user_id", ctx.user.id).maybeSingle();
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data?.valor === "true";
  }),

  getAutomacao: protectedProcedure.query(async ({ ctx }) => {
    const sb = await requireDb();
    const { data, error } = await sb.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id).in("chave", ["notificacoes_auto_ativo", "notificacoes_auto_horario"]);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    const config = Object.fromEntries((data ?? []).map((row: any) => [row.chave, row.valor])) as Record<string, string>;
    return { ativo: config.notificacoes_auto_ativo === "true", horario: config.notificacoes_auto_horario || "09:00" };
  }),

  salvarAutomacao: protectedProcedure.input(z.object({
    ativo: z.boolean(),
    horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM").refine(v => Number(v.slice(3)) % 5 === 0, "Escolha um horário em intervalos de 5 minutos"),
  })).mutation(async ({ ctx, input }) => {
    const sb = await requireDb();
    const { error } = await sb.from("configuracoes").upsert([
      { chave: "notificacoes_auto_ativo", valor: String(input.ativo), user_id: ctx.user.id },
      { chave: "notificacoes_auto_horario", valor: input.horario, user_id: ctx.user.id },
    ], { onConflict: "chave,user_id" });
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),

  salvar: protectedProcedure.input(z.object({ tipo: z.string(), ativo: z.boolean(), mensagem_template: z.string().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const tipo = TIPOS_NOTIFICACAO.find(t => t.tipo === input.tipo);
      if (!tipo) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo inválido" });
      const sb = await requireDb();
      const { error } = await sb.from("notificacoes_automaticas").upsert({
        user_id: ctx.user.id, tipo: input.tipo, ativo: input.ativo, dias_antes: tipo.diasAntes,
        mensagem_template: input.mensagem_template, updatedAt: new Date().toISOString(),
      }, { onConflict: "user_id,tipo,dias_antes" });
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  toggle: protectedProcedure.input(z.object({ tipo: z.string(), ativo: z.boolean() })).mutation(async ({ ctx, input }) => {
    const tipo = TIPOS_NOTIFICACAO.find(t => t.tipo === input.tipo);
    if (!tipo) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo inválido" });
    const sb = await requireDb();
    const { data: regra, error: regraError } = await sb.from("notificacoes_automaticas").select("id, mensagem_template").eq("user_id", ctx.user.id).eq("tipo", input.tipo).maybeSingle();
    if (regraError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: regraError.message });
    const { error } = regra
      ? await sb.from("notificacoes_automaticas").update({ ativo: input.ativo, updatedAt: new Date().toISOString() }).eq("id", regra.id).eq("user_id", ctx.user.id)
      : await sb.from("notificacoes_automaticas").insert({ user_id: ctx.user.id, tipo: input.tipo, ativo: input.ativo, dias_antes: tipo.diasAntes, mensagem_template: MENSAGENS_PADRAO[tipo.tipo] });
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),

  historico: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional()).query(async ({ ctx, input }) => {
    const sb = await requireDb();
    const { data, error } = await sb.from("notificacoes_log").select("*, clientes(nome)").eq("user_id", ctx.user.id).order("createdAt", { ascending: false }).limit(input?.limit ?? 50);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data ?? [];
  }),

  saude: protectedProcedure.query(async ({ ctx }) => obterSaudeNotificacoes(ctx.user.id)),

  /**
   * Envio manual, deliberado e rastreável. O retorno síncrono confirma apenas
   * que a Evolution aceitou a solicitação; entrega/leitura dependem do recibo
   * assíncrono do WhatsApp e nunca são inferidas deste endpoint.
   */
  testar: protectedProcedure.input(z.object({
    tipo: z.string(),
    mensagem_template: z.string().min(1).max(4000),
    telefone: z.string().min(8).max(24),
  })).mutation(async ({ ctx, input }) => {
    const tipo = TIPOS_NOTIFICACAO.find(item => item.tipo === input.tipo);
    if (!tipo) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de mensagem inválido" });
    const sb = await requireDb();
    let telefone: string;
    try {
      telefone = normalizarTelefoneWhatsApp(input.telefone);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Número de WhatsApp inválido" });
    }

    const { data: configs, error } = await sb.from("configuracoes").select("chave, valor").eq("user_id", ctx.user.id).eq("chave", "nomeEmpresa");
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    const config = Object.fromEntries((configs ?? []).map((r: any) => [r.chave, r.valor])) as Record<string, string>;
    const mensagem = substituirVariaveis(input.mensagem_template, { nome: "João Silva (teste)", valor: 250, data_vencimento: dataHojeBrasilia().split("-").reverse().join("/"), dias_atraso: 2, empresa: config.nomeEmpresa || "Sua Empresa", parcela: 3, total_parcelas: 12 });
    const resultado = await enviarMensagemEvolution(ctx.user.id, telefone, mensagem);
    if (!resultado.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: resultado.erro || "Erro ao enviar" });

    const aceitoEm = new Date().toISOString();
    // O histórico de testes não bloqueia uma mensagem que a Evolution já aceitou.
    // Assim, uma base legada sem a tabela de log continua permitindo validar a conexão.
    const { data: registro, error: logError } = await sb.from("notificacoes_log").insert({
      user_id: ctx.user.id,
      tipo: "teste_envio",
      telefone,
      mensagem,
      status: "aceito_evolution",
      erro: null,
      createdAt: aceitoEm,
    }).select("id, createdAt").maybeSingle();
    if (logError) console.warn("[notificacoes.testar] Mensagem aceita, mas não foi possível gravar o histórico:", logError.message);

    return {
      success: true,
      mensagem,
      telefone,
      providerMessageId: resultado.providerMessageId ?? null,
      etapa: "aceito_evolution" as const,
      aceitoEm,
      registroId: registro?.id ?? null,
      historicoRegistrado: Boolean(registro),
    };
  }),

  /** Legado: o agendador oficial produz e processa a outbox; não há mais disparo direto por tRPC. */
  dispararDoDia: protectedProcedure.mutation(async () => ({ enviados: 0, mensagem: "Use a rotina agendada: as mensagens agora passam pela fila rastreável." })),
});

export { substituirVariaveis };
