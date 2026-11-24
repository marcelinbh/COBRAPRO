import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { TRPCError } from "@trpc/server";
import { dataHojeBrasilia } from "../services/businessDate";
import {
  dataCivilValida,
} from "../services/assinaturasFinanceiras";
import { pagamentoAssinatura42Schema } from "../../shared/assinaturas42";
import { receberAssinatura42, conferirAssinatura42 } from "../services/assinaturasPagamentoRpc";

type Supabase = NonNullable<Awaited<ReturnType<typeof getSupabaseClientAsync>>>;

async function obterAssinaturaDoUsuario(supabase: Supabase, userId: number, assinaturaId: number) {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("id, cliente_id, servico, conta_caixa_id, status, valor_mensal, data_inicio")
    .eq("id", assinaturaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Assinatura não encontrada" });
  return data as {
    id: number; cliente_id: number; servico: string; conta_caixa_id: number | null;
    status: "ativa" | "cancelada" | "suspensa" | "inadimplente";
    valor_mensal: string; data_inicio: string;
  };
}

async function validarClienteDoUsuario(supabase: Supabase, userId: number, clienteId: number) {
  const { data, error } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  if (!data) throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence à sua empresa" });
}

async function validarContaDoUsuario(supabase: Supabase, userId: number, contaCaixaId: number) {
  const { data, error } = await supabase
    .from("contas_caixa")
    .select("id")
    .eq("id", contaCaixaId)
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  if (!data) throw new TRPCError({ code: "FORBIDDEN", message: "Conta de caixa inválida para sua empresa" });
}

export const assinaturasRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["ativa", "cancelada", "suspensa", "inadimplente", "todas"]).optional().default("todas"),
      clienteId: z.number().optional(),
      busca: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

      let query = supabase
        .from("assinaturas")
        .select("*, clientes!inner(id, nome, whatsapp, telefone)")
        .order("createdAt", { ascending: false })
        .eq("user_id", ctx.user.id);
      if (input.status !== "todas") query = query.eq("status", input.status);
      if (input.clienteId) query = query.eq("cliente_id", input.clienteId);

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      if (!input.busca) return data || [];
      const busca = input.busca.toLowerCase();
      return (data || []).filter((assinatura: any) =>
        assinatura.servico?.toLowerCase().includes(busca) ||
        assinatura.clientes?.nome?.toLowerCase().includes(busca)
      );
    }),

  kpis: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
    const { data: todas, error } = await supabase
      .from("assinaturas")
      .select("id, status, valor_mensal")
      .eq("user_id", ctx.user.id);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

    const registros = todas || [];
    const ativas = registros.filter((a: any) => a.status === "ativa");
    return {
      total: registros.length,
      ativas: ativas.length,
      inadimplentes: registros.filter((a: any) => a.status === "inadimplente").length,
      canceladas: registros.filter((a: any) => a.status === "cancelada").length,
      receitaMensal: ativas.reduce((acc: number, a: any) => acc + parseFloat(a.valor_mensal || "0"), 0),
    };
  }),

  criar: protectedProcedure
    .input(z.object({
      clienteId: z.number().int().positive(),
      servico: z.string().trim().min(1),
      descricao: z.string().optional(),
      valorMensal: z.number().positive().multipleOf(0.01),
      diaVencimento: z.number().int().min(1).max(31).default(10),
      dataInicio: z.string(),
      contaCaixaId: z.number().int().positive(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      if (!dataCivilValida(input.dataInicio)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A data de início da assinatura é inválida" });
      }
      await validarClienteDoUsuario(supabase, ctx.user.id, input.clienteId);
      await validarContaDoUsuario(supabase, ctx.user.id, input.contaCaixaId);

      const { data, error } = await supabase.from("assinaturas").insert({
        cliente_id: input.clienteId,
        servico: input.servico,
        descricao: input.descricao || null,
        valor_mensal: input.valorMensal.toFixed(2),
        dia_vencimento: input.diaVencimento,
        status: "ativa",
        data_inicio: input.dataInicio,
        conta_caixa_id: input.contaCaixaId,
        observacoes: input.observacoes || null,
        user_id: ctx.user.id,
      }).select().single();
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  atualizar: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      servico: z.string().trim().min(1).optional(),
      descricao: z.string().optional(),
      valorMensal: z.number().positive().multipleOf(0.01).optional(),
      diaVencimento: z.number().int().min(1).max(31).optional(),
      status: z.enum(["ativa", "cancelada", "suspensa", "inadimplente"]).optional(),
      contaCaixaId: z.number().int().positive().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      await obterAssinaturaDoUsuario(supabase, ctx.user.id, input.id);
      if (input.contaCaixaId !== undefined) await validarContaDoUsuario(supabase, ctx.user.id, input.contaCaixaId);

      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (input.servico !== undefined) updates.servico = input.servico;
      if (input.descricao !== undefined) updates.descricao = input.descricao;
      if (input.valorMensal !== undefined) updates.valor_mensal = input.valorMensal.toFixed(2);
      if (input.diaVencimento !== undefined) updates.dia_vencimento = input.diaVencimento;
      if (input.status !== undefined) {
        updates.status = input.status;
        updates.data_cancelamento = input.status === "cancelada" ? dataHojeBrasilia() : null;
      }
      if (input.contaCaixaId !== undefined) updates.conta_caixa_id = input.contaCaixaId;
      if (input.observacoes !== undefined) updates.observacoes = input.observacoes;

      const { data, error } = await supabase.from("assinaturas").update(updates)
        .eq("id", input.id).eq("user_id", ctx.user.id).select().single();
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  registrarPagamento: protectedProcedure
    .input(pagamentoAssinatura42Schema)
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível; preserve a intenção e UUID para retomar." });
      return receberAssinatura42(supabase, ctx.user.id, input);
    }),

  conferirPagamento: protectedProcedure
    .input(pagamentoAssinatura42Schema)
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível; intenção preservada para conferência." });
      return conferirAssinatura42(supabase, ctx.user.id, input);
    }),

  pagamentos: protectedProcedure
    .input(z.object({ assinaturaId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      await obterAssinaturaDoUsuario(supabase, ctx.user.id, input.assinaturaId);
      const { data, error } = await supabase.from("pagamentos_assinatura").select("*")
        .eq("assinatura_id", input.assinaturaId).order("data_pagamento", { ascending: false });
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data || [];
    }),

  // Preserva a trilha financeira; a ação antiga de exclusão vira cancelamento lógico.
  deletar: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      await obterAssinaturaDoUsuario(supabase, ctx.user.id, input.id);
      const { error } = await supabase.from("assinaturas")
        .update({ status: "cancelada", data_cancelamento: dataHojeBrasilia(), updatedAt: new Date().toISOString() })
        .eq("id", input.id).eq("user_id", ctx.user.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true, cancelada: true };
    }),
});
