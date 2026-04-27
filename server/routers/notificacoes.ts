import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSupabaseClientAsync } from "../db";
import { ENV } from "../_core/env";

// ─── TIPOS ────────────────────────────────────────────────────────────────────
export type TipoNotificacao =
  | "antes_vencimento_3"   // 3 dias antes
  | "antes_vencimento_2"   // 2 dias antes
  | "antes_vencimento_1"   // 1 dia antes
  | "no_vencimento"        // no dia do vencimento
  | "apos_vencimento_1"    // 1 dia depois
  | "apos_vencimento_3"    // 3 dias depois
  | "apos_vencimento_7"    // 7 dias depois
  | "confirmacao_pagamento"; // ao registrar pagamento

export const TIPOS_NOTIFICACAO: { tipo: TipoNotificacao; label: string; descricao: string; diasAntes: number }[] = [
  { tipo: "antes_vencimento_3", label: "3 dias antes", descricao: "Lembrete 3 dias antes do vencimento", diasAntes: 3 },
  { tipo: "antes_vencimento_2", label: "2 dias antes", descricao: "Lembrete 2 dias antes do vencimento", diasAntes: 2 },
  { tipo: "antes_vencimento_1", label: "1 dia antes", descricao: "Lembrete 1 dia antes do vencimento", diasAntes: 1 },
  { tipo: "no_vencimento", label: "No vencimento", descricao: "Aviso no dia do vencimento", diasAntes: 0 },
  { tipo: "apos_vencimento_1", label: "1 dia em atraso", descricao: "Cobrança 1 dia após o vencimento", diasAntes: -1 },
  { tipo: "apos_vencimento_3", label: "3 dias em atraso", descricao: "Cobrança 3 dias após o vencimento", diasAntes: -3 },
  { tipo: "apos_vencimento_7", label: "7 dias em atraso", descricao: "Cobrança 7 dias após o vencimento", diasAntes: -7 },
  { tipo: "confirmacao_pagamento", label: "Confirmação de pagamento", descricao: "Mensagem ao confirmar pagamento", diasAntes: 0 },
];

// Mensagens padrão para cada tipo
const MENSAGENS_PADRAO: Record<TipoNotificacao, string> = {
  antes_vencimento_3: "Olá {nome}! 😊 Sua parcela de *R$ {valor}* vence em *3 dias* ({data_vencimento}). Qualquer dúvida, estamos à disposição! — {empresa}",
  antes_vencimento_2: "Olá {nome}! Sua parcela de *R$ {valor}* vence em *2 dias* ({data_vencimento}). Não esqueça! 😉 — {empresa}",
  antes_vencimento_1: "Olá {nome}! ⚠️ Sua parcela de *R$ {valor}* vence *amanhã* ({data_vencimento}). Por favor, efetue o pagamento para evitar juros. — {empresa}",
  no_vencimento: "Olá {nome}! 📅 Sua parcela de *R$ {valor}* vence *hoje* ({data_vencimento}). Efetue o pagamento para evitar juros. — {empresa}",
  apos_vencimento_1: "Olá {nome}, sua parcela de *R$ {valor}* está em atraso há *1 dia*. Por favor, regularize o quanto antes. — {empresa}",
  apos_vencimento_3: "Olá {nome}, sua parcela de *R$ {valor}* está em atraso há *3 dias*. Entre em contato para evitar maiores problemas. — {empresa}",
  apos_vencimento_7: "Olá {nome}, sua parcela de *R$ {valor}* está em atraso há *7 dias*. Urgente: regularize sua situação. — {empresa}",
  confirmacao_pagamento: "Olá {nome}! ✅ Recebemos seu pagamento de *R$ {valor}* referente à parcela {parcela}/{total_parcelas}. Obrigado! — {empresa}",
};

// ─── HELPER: substituir variáveis na mensagem ─────────────────────────────────
export function substituirVariaveis(template: string, vars: {
  nome?: string;
  valor?: number;
  data_vencimento?: string;
  dias_atraso?: number;
  empresa?: string;
  parcela?: number;
  total_parcelas?: number;
}): string {
  let msg = template;
  if (vars.nome) msg = msg.replace(/{nome}/g, vars.nome);
  if (vars.valor !== undefined) msg = msg.replace(/{valor}/g, vars.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  if (vars.data_vencimento) msg = msg.replace(/{data_vencimento}/g, vars.data_vencimento);
  if (vars.dias_atraso !== undefined) msg = msg.replace(/{dias_atraso}/g, String(Math.abs(vars.dias_atraso)));
  if (vars.empresa) msg = msg.replace(/{empresa}/g, vars.empresa);
  if (vars.parcela !== undefined) msg = msg.replace(/{parcela}/g, String(vars.parcela));
  if (vars.total_parcelas !== undefined) msg = msg.replace(/{total_parcelas}/g, String(vars.total_parcelas));
  return msg;
}

// ─── HELPER: enviar mensagem via Evolution API (config global) ───────────────
async function enviarWhatsApp(userId: number, telefone: string, mensagem: string): Promise<{ ok: boolean; erro?: string }> {
  const evolutionUrl = ENV.evolutionApiUrl.replace(/\/$/, "");
  const evolutionApiKey = ENV.evolutionApiKey;
  const instanceName = `user-${userId}`;

  // Verificar se WhatsApp está conectado
  try {
    const statusRes = await fetch(
      `${evolutionUrl}/instance/connectionState/${instanceName}`,
      { headers: { apikey: evolutionApiKey } }
    );
    const statusData = await statusRes.json() as { instance?: { state?: string } };
    if (statusData?.instance?.state !== "open") {
      return { ok: false, erro: "WhatsApp desconectado" };
    }
  } catch {
    return { ok: false, erro: "Erro ao verificar status do WhatsApp" };
  }

  // Formatar telefone
  let phone = telefone.replace(/\D/g, "");
  if (!phone.startsWith("55")) phone = "55" + phone;

  try {
    const res = await fetch(
      `${evolutionUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone + "@s.whatsapp.net", text: mensagem }),
      }
    );
    const data = await res.json() as { error?: string; message?: string };
    if (data?.error) return { ok: false, erro: data.message || "Erro ao enviar" };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
export const notificacoesRouter = router({

  // Listar todas as regras do usuário (com defaults para tipos não configurados)
  listar: protectedProcedure.query(async ({ ctx }) => {
    const sb = await getSupabaseClientAsync();
    if (!sb) return TIPOS_NOTIFICACAO.map(t => ({ ...t, id: null, ativo: false, mensagem_template: MENSAGENS_PADRAO[t.tipo] }));

    const { data } = await sb.from("notificacoes_automaticas").select("*").eq("user_id", ctx.user.id);
    const existentes: Record<string, { id: number; ativo: boolean; mensagem_template: string }> = {};
    (data ?? []).forEach((r: { tipo: string; id: number; ativo: boolean; mensagem_template: string }) => {
      existentes[r.tipo] = { id: r.id, ativo: r.ativo, mensagem_template: r.mensagem_template };
    });

    return TIPOS_NOTIFICACAO.map(t => ({
      ...t,
      id: existentes[t.tipo]?.id ?? null,
      ativo: existentes[t.tipo]?.ativo ?? false,
      mensagem_template: existentes[t.tipo]?.mensagem_template || MENSAGENS_PADRAO[t.tipo],
    }));
  }),

  // Verificar se as mensagens automáticas estão habilitadas globalmente
  getGlobalAtivo: protectedProcedure.query(async ({ ctx }) => {
    const sb = await getSupabaseClientAsync();
    if (!sb) return false;
    const { data } = await sb.from("configuracoes").select("valor").eq("chave", "notificacoes_auto_ativo").eq("user_id", ctx.user.id).maybeSingle();
    return data?.valor === "true";
  }),

  // Ligar/desligar o sistema globalmente
  setGlobalAtivo: protectedProcedure
    .input(z.object({ ativo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await sb.from("configuracoes").upsert(
        { chave: "notificacoes_auto_ativo", valor: String(input.ativo), user_id: ctx.user.id },
        { onConflict: "chave,user_id" }
      );
      return { success: true };
    }),

  // Salvar/atualizar uma regra (mensagem + ativo)
  salvar: protectedProcedure
    .input(z.object({
      tipo: z.string(),
      ativo: z.boolean(),
      mensagem_template: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tipoInfo = TIPOS_NOTIFICACAO.find(t => t.tipo === input.tipo);
      if (!tipoInfo) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo inválido" });

      await sb.from("notificacoes_automaticas").upsert(
        {
          user_id: ctx.user.id,
          tipo: input.tipo,
          ativo: input.ativo,
          dias_antes: tipoInfo.diasAntes,
          mensagem_template: input.mensagem_template,
          updatedAt: new Date().toISOString(),
        },
        { onConflict: "user_id,tipo,dias_antes" }
      );
      return { success: true };
    }),

  // Toggle rápido de ativo/inativo para uma regra
  toggle: protectedProcedure
    .input(z.object({ tipo: z.string(), ativo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const tipoInfo = TIPOS_NOTIFICACAO.find(t => t.tipo === input.tipo);
      if (!tipoInfo) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo inválido" });

      // Verificar se já existe
      const { data: existing } = await sb.from("notificacoes_automaticas")
        .select("id, mensagem_template")
        .eq("user_id", ctx.user.id)
        .eq("tipo", input.tipo)
        .maybeSingle();

      if (existing) {
        await sb.from("notificacoes_automaticas").update({ ativo: input.ativo, updatedAt: new Date().toISOString() })
          .eq("user_id", ctx.user.id).eq("tipo", input.tipo);
      } else {
        // Criar com mensagem padrão
        await sb.from("notificacoes_automaticas").insert({
          user_id: ctx.user.id,
          tipo: input.tipo,
          ativo: input.ativo,
          dias_antes: tipoInfo.diasAntes,
          mensagem_template: MENSAGENS_PADRAO[input.tipo as TipoNotificacao] || "",
        });
      }
      return { success: true };
    }),

  // Histórico de envios recentes
  historico: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) return [];
      const { data } = await sb.from("notificacoes_log")
        .select("*, clientes(nome)")
        .eq("user_id", ctx.user.id)
        .order("createdAt", { ascending: false })
        .limit(input?.limit ?? 50);
      return data ?? [];
    }),

  // Testar envio (envia para o WhatsApp do próprio usuário)
  testar: protectedProcedure
    .input(z.object({
      tipo: z.string(),
      mensagem_template: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Pegar WhatsApp do perfil do usuário
      const { data: wppConfig } = await sb.from("configuracoes").select("valor")
        .eq("chave", "whatsappEmpresa").eq("user_id", ctx.user.id).maybeSingle();
      const { data: empresaConfig } = await sb.from("configuracoes").select("valor")
        .eq("chave", "nomeEmpresa").eq("user_id", ctx.user.id).maybeSingle();

      const telefone = wppConfig?.valor;
      if (!telefone) throw new TRPCError({ code: "BAD_REQUEST", message: "Configure o WhatsApp da empresa no Meu Perfil primeiro" });

      const mensagem = substituirVariaveis(input.mensagem_template, {
        nome: "João Silva (teste)",
        valor: 250.00,
        data_vencimento: new Date().toLocaleDateString("pt-BR"),
        dias_atraso: 2,
        empresa: empresaConfig?.valor || "Sua Empresa",
        parcela: 3,
        total_parcelas: 12,
      });

      const resultado = await enviarWhatsApp(ctx.user.id, telefone, mensagem);
      if (!resultado.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: resultado.erro || "Erro ao enviar" });
      return { success: true, mensagem };
    }),

  // Job: disparar notificações do dia para um usuário específico (chamado pelo cron)
  dispararDoDia: protectedProcedure.mutation(async ({ ctx }) => {
    const sb = await getSupabaseClientAsync();
    if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    // Verificar se o usuário tem notificações ativas globalmente
    const { data: globalConfig } = await sb.from("configuracoes").select("valor")
      .eq("chave", "notificacoes_auto_ativo").eq("user_id", ctx.user.id).maybeSingle();
    if (globalConfig?.valor !== "true") return { enviados: 0, mensagem: "Notificações automáticas desativadas" };

    // Buscar regras ativas do usuário
    const { data: regras } = await sb.from("notificacoes_automaticas").select("*")
      .eq("user_id", ctx.user.id).eq("ativo", true);
    if (!regras || regras.length === 0) return { enviados: 0, mensagem: "Nenhuma regra ativa" };

    // Pegar nome da empresa
    const { data: empresaConfig } = await sb.from("configuracoes").select("valor")
      .eq("chave", "nomeEmpresa").eq("user_id", ctx.user.id).maybeSingle();
    const nomeEmpresa = empresaConfig?.valor || "Empresa";

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let enviados = 0;

    for (const regra of regras as { tipo: string; dias_antes: number; mensagem_template: string }[]) {
      // Calcular a data alvo
      const dataAlvo = new Date(hoje);
      dataAlvo.setDate(dataAlvo.getDate() + regra.dias_antes); // dias_antes positivo = antes, negativo = depois

      const dataAlvoStr = dataAlvo.toISOString().split("T")[0];

      // Buscar parcelas com vencimento na data alvo, não pagas
      const { data: parcelas } = await sb.from("parcelas")
        .select("id, valor, numero_parcela, contrato_id, contratos!inner(numero_parcelas, cliente_id, clientes!inner(id, nome, whatsapp, telefone))")
        .eq("user_id", ctx.user.id)
        .eq("data_vencimento", dataAlvoStr)
        .in("status", ["pendente", "atrasada"]);

      if (!parcelas || parcelas.length === 0) continue;

      for (const parcela of (parcelas as unknown as {
        id: number;
        valor: number;
        numero_parcela: number;
        contratos: { numero_parcelas: number; clientes: { id: number; nome: string; whatsapp?: string; telefone?: string } };
      }[])) {
        const cliente = parcela.contratos?.clientes;
        if (!cliente) continue;

        const telefone = cliente.whatsapp || cliente.telefone;
        if (!telefone) continue;

        // Verificar se já enviamos hoje para esta parcela e tipo
        const { data: logExistente } = await sb.from("notificacoes_log")
          .select("id")
          .eq("user_id", ctx.user.id)
          .eq("parcela_id", parcela.id)
          .eq("tipo", regra.tipo)
          .gte("createdAt", hoje.toISOString())
          .maybeSingle();

        if (logExistente) continue; // Já enviado hoje

        const mensagem = substituirVariaveis(regra.mensagem_template, {
          nome: cliente.nome,
          valor: parcela.valor,
          data_vencimento: dataAlvoStr.split("-").reverse().join("/"),
          dias_atraso: regra.dias_antes < 0 ? Math.abs(regra.dias_antes) : 0,
          empresa: nomeEmpresa,
          parcela: parcela.numero_parcela,
          total_parcelas: parcela.contratos?.numero_parcelas,
        });

        const resultado = await enviarWhatsApp(ctx.user.id, telefone, mensagem);

        // Registrar no log
        await sb.from("notificacoes_log").insert({
          user_id: ctx.user.id,
          parcela_id: parcela.id,
          cliente_id: cliente.id,
          tipo: regra.tipo,
          telefone,
          mensagem,
          status: resultado.ok ? "enviado" : "erro",
          erro: resultado.ok ? null : resultado.erro,
        });

        if (resultado.ok) enviados++;
      }
    }

    return { enviados, mensagem: `${enviados} mensagem(ns) enviada(s)` };
  }),
});
