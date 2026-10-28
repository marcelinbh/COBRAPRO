import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { TRPCError } from "@trpc/server";
import { dataCivilBrasiliaParaIso, dataHojeBrasilia } from "../services/businessDate";
import {
  competenciaElegivel,
  dataCivilValida,
  mesmoValorMonetario,
  mesReferenciaValido,
} from "../services/assinaturasFinanceiras";
import { bloquearOperacaoFinanceiraNaoAtomica } from "../services/financialSafety";

type Supabase = NonNullable<Awaited<ReturnType<typeof getSupabaseClientAsync>>>;

function colunaAusente(error: unknown, coluna: string): boolean {
  const mensagem = String(
    typeof error === "object" && error && "message" in error
      ? (error as { message?: unknown }).message
      : error ?? ""
  ).toLowerCase();
  return mensagem.includes(coluna.toLowerCase()) && (
    mensagem.includes("does not exist") ||
    mensagem.includes("schema cache") ||
    mensagem.includes("could not find")
  );
}

function integridadeAssinaturaAindaIndisponivel(error: unknown): boolean {
  const mensagem = String(
    typeof error === "object" && error && "message" in error
      ? (error as { message?: unknown }).message
      : error ?? ""
  ).toLowerCase();
  return colunaAusente(error, "pagamento_assinatura_id") ||
    mensagem.includes("pagamento_assinatura") ||
    mensagem.includes("invalid input value for enum");
}

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
    .input(z.object({
      assinaturaId: z.number().int().positive(),
      clienteId: z.number().int().positive(),
      valorPago: z.number().positive().multipleOf(0.01),
      mesReferencia: z.string().regex(/^\d{4}-\d{2}$/),
      contaCaixaId: z.number().int().positive(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      bloquearOperacaoFinanceiraNaoAtomica("O recebimento de assinatura");
      const supabase = await getSupabaseClientAsync();
      if (!supabase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const assinatura = await obterAssinaturaDoUsuario(supabase, ctx.user.id, input.assinaturaId);
      if (assinatura.cliente_id !== input.clienteId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "O cliente informado não pertence a esta assinatura" });
      }
      if (!mesReferenciaValido(input.mesReferencia) || !competenciaElegivel(assinatura.data_inicio, input.mesReferencia)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A competência informada é inválida ou anterior ao início da assinatura" });
      }
      if (!['ativa', 'inadimplente'].includes(assinatura.status)) {
        throw new TRPCError({ code: "CONFLICT", message: "Somente assinaturas ativas ou inadimplentes podem receber pagamento" });
      }
      if (!mesmoValorMonetario(input.valorPago, assinatura.valor_mensal)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O pagamento deve corresponder exatamente ao valor mensal da assinatura" });
      }
      await validarContaDoUsuario(supabase, ctx.user.id, input.contaCaixaId);

      const { data: existente, error: buscaErro } = await supabase.from("pagamentos_assinatura")
        .select("id").eq("assinatura_id", input.assinaturaId).eq("mes_referencia", input.mesReferencia)
        .limit(1).maybeSingle();
      if (buscaErro) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: buscaErro.message });
      if (existente) throw new TRPCError({ code: "CONFLICT", message: "O pagamento desta assinatura já foi registrado para o mês informado" });

      const payload: Record<string, unknown> = {
        assinatura_id: input.assinaturaId,
        cliente_id: assinatura.cliente_id,
        user_id: ctx.user.id,
        valor_pago: input.valorPago.toFixed(2),
        mes_referencia: input.mesReferencia,
        conta_caixa_id: input.contaCaixaId,
        observacoes: input.observacoes || null,
      };
      let { data: pagamento, error: pagamentoErro } = await supabase.from("pagamentos_assinatura").insert(payload).select().single();
      // Compatibilidade até a migration 0014 criar user_id no banco produtivo.
      if (colunaAusente(pagamentoErro, "user_id")) {
        delete payload.user_id;
        ({ data: pagamento, error: pagamentoErro } = await supabase.from("pagamentos_assinatura").insert(payload).select().single());
      }
      if (pagamentoErro || !pagamento) {
        const mensagem = pagamentoErro?.message || "Não foi possível registrar o pagamento da assinatura";
        const code = String(pagamentoErro?.code ?? "");
        throw new TRPCError({ code: code === "23505" ? "CONFLICT" : "INTERNAL_SERVER_ERROR", message: mensagem });
      }

      const descricaoCaixa = `Recebimento assinatura #${pagamento.id} — ${assinatura.servico} (${input.mesReferencia})`;
      const entradaPayload = {
        conta_caixa_id: input.contaCaixaId,
        tipo: "entrada",
        categoria: "pagamento_assinatura",
        descricao: descricaoCaixa,
        valor: input.valorPago.toFixed(2),
        data_transacao: dataCivilBrasiliaParaIso(dataHojeBrasilia()),
        user_id: ctx.user.id,
        pagamento_assinatura_id: pagamento.id,
      };
      let { data: entradaCaixa, error: entradaErro } = await supabase.from("transacoes_caixa")
        .insert(entradaPayload).select("id").maybeSingle();
      // A aplicação só usa o vínculo/categoria após 0014, mas continua
      // operacional enquanto a base legada aguarda a migration auditada.
      if (integridadeAssinaturaAindaIndisponivel(entradaErro)) {
        ({ data: entradaCaixa, error: entradaErro } = await supabase.from("transacoes_caixa").insert({
          ...entradaPayload,
          categoria: "outros",
          pagamento_assinatura_id: undefined,
        }).select("id").maybeSingle());
      }
      if (entradaErro || !entradaCaixa) {
        const { error: rollbackErro } = await supabase.from("pagamentos_assinatura")
          .delete().eq("id", pagamento.id).eq("assinatura_id", input.assinaturaId);
        if (rollbackErro) console.error("[assinaturas.registrarPagamento] falha ao compensar pagamento sem Caixa:", rollbackErro.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível registrar a entrada no Caixa; o pagamento foi desfeito" });
      }

      const { error: statusErro } = await supabase.from("assinaturas")
        .update({ status: "ativa", updatedAt: new Date().toISOString() })
        .eq("id", input.assinaturaId).eq("user_id", ctx.user.id).eq("status", "inadimplente");
      if (statusErro) {
        await supabase.from("transacoes_caixa").delete().eq("id", entradaCaixa.id).eq("user_id", ctx.user.id);
        await supabase.from("pagamentos_assinatura").delete().eq("id", pagamento.id).eq("assinatura_id", input.assinaturaId);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível concluir a baixa; o pagamento foi desfeito" });
      }
      return pagamento;
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
