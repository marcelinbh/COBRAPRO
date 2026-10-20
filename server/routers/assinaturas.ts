import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { TRPCError } from "@trpc/server";
import { dataHojeBrasilia } from "../services/businessDate";

async function obterAssinaturaDoUsuario(supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseClientAsync>>>, userId: number, assinaturaId: number) {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("id, cliente_id, servico, conta_caixa_id")
    .eq("id", assinaturaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Assinatura não encontrada" });
  return data;
}

async function validarClienteDoUsuario(supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseClientAsync>>>, userId: number, clienteId: number) {
  const { data, error } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  if (!data) throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence à sua empresa" });
}

async function validarContaDoUsuario(supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseClientAsync>>>, userId: number, contaCaixaId: number) {
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
  // Listar assinaturas com dados do cliente
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

      if (input.status !== "todas") {
        query = query.eq("status", input.status);
      }
      if (input.clienteId) {
        query = query.eq("cliente_id", input.clienteId);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      let result = data || [];
      if (input.busca) {
        const busca = input.busca.toLowerCase();
        result = result.filter((a: any) =>
          a.servico?.toLowerCase().includes(busca) ||
          a.clientes?.nome?.toLowerCase().includes(busca)
        );
      }
      return result;
    }),

  // KPIs do módulo de assinaturas
  kpis: protectedProcedure.query(async ({ ctx }) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

    const { data: todas, error } = await supabase
      .from("assinaturas")
      .select("id, status, valor_mensal")
      .eq("user_id", ctx.user.id);

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

    const ativas = (todas || []).filter((a: any) => a.status === "ativa");
    const inadimplentes = (todas || []).filter((a: any) => a.status === "inadimplente");
    const canceladas = (todas || []).filter((a: any) => a.status === "cancelada");

    const receitaMensal = ativas.reduce((acc: number, a: any) => acc + parseFloat(a.valor_mensal || "0"), 0);

    return {
      total: (todas || []).length,
      ativas: ativas.length,
      inadimplentes: inadimplentes.length,
      canceladas: canceladas.length,
      receitaMensal,
    };
  }),

  // Criar nova assinatura
  criar: protectedProcedure
    .input(z.object({
      clienteId: z.number(),
      servico: z.string().min(1),
      descricao: z.string().optional(),
      valorMensal: z.number().positive(),
      diaVencimento: z.number().min(1).max(31).default(10),
      dataInicio: z.string(),
      contaCaixaId: z.number().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      await validarClienteDoUsuario(supabase, ctx.user.id, input.clienteId);
      if (input.contaCaixaId) {
        await validarContaDoUsuario(supabase, ctx.user.id, input.contaCaixaId);
      }

      const { data, error } = await supabase
        .from("assinaturas")
        .insert({
          cliente_id: input.clienteId,
          servico: input.servico,
          descricao: input.descricao || null,
          valor_mensal: input.valorMensal.toFixed(2),
          dia_vencimento: input.diaVencimento,
          status: "ativa",
          data_inicio: input.dataInicio,
          conta_caixa_id: input.contaCaixaId || null,
          observacoes: input.observacoes || null,
          user_id: ctx.user.id,
        })
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  // Atualizar assinatura
  atualizar: protectedProcedure
    .input(z.object({
      id: z.number(),
      servico: z.string().min(1).optional(),
      descricao: z.string().optional(),
      valorMensal: z.number().positive().optional(),
      diaVencimento: z.number().min(1).max(31).optional(),
      status: z.enum(["ativa", "cancelada", "suspensa", "inadimplente"]).optional(),
      contaCaixaId: z.number().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      await obterAssinaturaDoUsuario(supabase, ctx.user.id, input.id);
      if (input.contaCaixaId !== undefined && input.contaCaixaId !== null) {
        await validarContaDoUsuario(supabase, ctx.user.id, input.contaCaixaId);
      }

      const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (input.servico !== undefined) updates.servico = input.servico;
      if (input.descricao !== undefined) updates.descricao = input.descricao;
      if (input.valorMensal !== undefined) updates.valor_mensal = input.valorMensal.toFixed(2);
      if (input.diaVencimento !== undefined) updates.dia_vencimento = input.diaVencimento;
      if (input.status !== undefined) {
        updates.status = input.status;
        if (input.status === "cancelada") {
          updates.data_cancelamento = dataHojeBrasilia();
        }
      }
      if (input.contaCaixaId !== undefined) updates.conta_caixa_id = input.contaCaixaId;
      if (input.observacoes !== undefined) updates.observacoes = input.observacoes;

      const { data, error } = await supabase
        .from("assinaturas")
        .update(updates)
        .eq("id", input.id)
        .eq("user_id", ctx.user.id)
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  // Registrar pagamento de assinatura
  registrarPagamento: protectedProcedure
    .input(z.object({
      assinaturaId: z.number(),
      clienteId: z.number(),
      valorPago: z.number().positive(),
      mesReferencia: z.string().regex(/^\d{4}-\d{2}$/),
      contaCaixaId: z.number().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const assinatura = await obterAssinaturaDoUsuario(supabase, ctx.user.id, input.assinaturaId);
      if (assinatura.cliente_id !== input.clienteId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "O cliente informado não pertence a esta assinatura" });
      }
      if (input.contaCaixaId) {
        await validarContaDoUsuario(supabase, ctx.user.id, input.contaCaixaId);
      }

      const { data: pagamentoExistente, error: buscaPagamentoErro } = await supabase
        .from("pagamentos_assinatura")
        .select("id")
        .eq("assinatura_id", input.assinaturaId)
        .eq("mes_referencia", input.mesReferencia)
        .limit(1)
        .maybeSingle();
      if (buscaPagamentoErro) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: buscaPagamentoErro.message });
      if (pagamentoExistente) throw new TRPCError({ code: "CONFLICT", message: "O pagamento desta assinatura já foi registrado para o mês informado" });

      // Registrar pagamento
      const { data: pagamento, error: pagErr } = await supabase
        .from("pagamentos_assinatura")
        .insert({
          assinatura_id: input.assinaturaId,
          cliente_id: assinatura.cliente_id,
          valor_pago: input.valorPago.toFixed(2),
          mes_referencia: input.mesReferencia,
          conta_caixa_id: input.contaCaixaId || null,
          observacoes: input.observacoes || null,
        })
        .select()
        .single();

      if (pagErr) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: pagErr.message });

      // Se tinha conta caixa, registrar entrada no caixa
      if (input.contaCaixaId) {
        const { data: assinatura } = await supabase
          .from("assinaturas")
          .select("servico, clientes!inner(nome)")
          .eq("id", input.assinaturaId)
          .eq("user_id", ctx.user.id)
          .single();

        const clienteNome = (assinatura as any)?.clientes?.nome || "Cliente";
        const servico = (assinatura as any)?.servico || "Assinatura";

        const descricaoCaixa = `Assinatura ${servico} - ${clienteNome} (${input.mesReferencia})`;
        const { data: entradaExistente, error: buscaEntradaErro } = await supabase
          .from("transacoes_caixa")
          .select("id")
          .eq("conta_caixa_id", input.contaCaixaId)
          .eq("tipo", "entrada")
          .eq("descricao", descricaoCaixa)
          .eq("user_id", ctx.user.id)
          .limit(1)
          .maybeSingle();
        if (buscaEntradaErro) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: buscaEntradaErro.message });
        if (!entradaExistente) {
          const { error: entradaErro } = await supabase.from("transacoes_caixa").insert({
            conta_caixa_id: input.contaCaixaId,
            tipo: "entrada",
            categoria: "outros",
            descricao: descricaoCaixa,
            valor: input.valorPago.toFixed(2),
            data_transacao: dataHojeBrasilia(),
            user_id: ctx.user.id,
          });
          if (entradaErro) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: entradaErro.message });
        }
      }

      // Atualizar status da assinatura para ativa se estava inadimplente
      await supabase
        .from("assinaturas")
        .update({ status: "ativa", updatedAt: new Date().toISOString() })
        .eq("id", input.assinaturaId)
        .eq("user_id", ctx.user.id)
        .eq("status", "inadimplente");

      return pagamento;
    }),

  // Listar pagamentos de uma assinatura
  pagamentos: protectedProcedure
    .input(z.object({ assinaturaId: z.number() }))
    .query(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      await obterAssinaturaDoUsuario(supabase, ctx.user.id, input.assinaturaId);

      const { data, error } = await supabase
        .from("pagamentos_assinatura")
        .select("*")
        .eq("assinatura_id", input.assinaturaId)
        .order("data_pagamento", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data || [];
    }),

  // Deletar assinatura
  deletar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      await obterAssinaturaDoUsuario(supabase, ctx.user.id, input.id);

      const { error } = await supabase
        .from("assinaturas")
        .delete()
        .eq("id", input.id)
        .eq("user_id", ctx.user.id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});
