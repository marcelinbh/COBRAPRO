import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { TRPCError } from "@trpc/server";

export const assinaturasRouter = router({
  // Listar assinaturas com dados do cliente
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["ativa", "cancelada", "suspensa", "inadimplente", "todas"]).optional().default("todas"),
      clienteId: z.number().optional(),
      busca: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

      let query = supabase
        .from("assinaturas")
        .select("*, clientes!inner(id, nome, whatsapp, telefone)")
        .order("createdAt", { ascending: false });

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
  kpis: protectedProcedure.query(async () => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

    const { data: todas, error } = await supabase
      .from("assinaturas")
      .select("id, status, valor_mensal");

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
    .mutation(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

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
    .mutation(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

      const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (input.servico !== undefined) updates.servico = input.servico;
      if (input.descricao !== undefined) updates.descricao = input.descricao;
      if (input.valorMensal !== undefined) updates.valor_mensal = input.valorMensal.toFixed(2);
      if (input.diaVencimento !== undefined) updates.dia_vencimento = input.diaVencimento;
      if (input.status !== undefined) {
        updates.status = input.status;
        if (input.status === "cancelada") {
          updates.data_cancelamento = new Date().toISOString().split("T")[0];
        }
      }
      if (input.contaCaixaId !== undefined) updates.conta_caixa_id = input.contaCaixaId;
      if (input.observacoes !== undefined) updates.observacoes = input.observacoes;

      const { data, error } = await supabase
        .from("assinaturas")
        .update(updates)
        .eq("id", input.id)
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
    .mutation(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

      // Registrar pagamento
      const { data: pagamento, error: pagErr } = await supabase
        .from("pagamentos_assinatura")
        .insert({
          assinatura_id: input.assinaturaId,
          cliente_id: input.clienteId,
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
          .single();

        const clienteNome = (assinatura as any)?.clientes?.nome || "Cliente";
        const servico = (assinatura as any)?.servico || "Assinatura";

        await supabase.from("transacoes_caixa").insert({
          conta_caixa_id: input.contaCaixaId,
          tipo: "entrada",
          categoria: "outros",
          descricao: `Assinatura ${servico} - ${clienteNome} (${input.mesReferencia})`,
          valor: input.valorPago.toFixed(2),
          data_transacao: new Date().toISOString().split("T")[0],
        });
      }

      // Atualizar status da assinatura para ativa se estava inadimplente
      await supabase
        .from("assinaturas")
        .update({ status: "ativa", updatedAt: new Date().toISOString() })
        .eq("id", input.assinaturaId)
        .eq("status", "inadimplente");

      return pagamento;
    }),

  // Listar pagamentos de uma assinatura
  pagamentos: protectedProcedure
    .input(z.object({ assinaturaId: z.number() }))
    .query(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

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
    .mutation(async ({ input }) => {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });

      const { error } = await supabase
        .from("assinaturas")
        .delete()
        .eq("id", input.id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});
