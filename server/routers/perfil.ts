import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSupabaseClientAsync } from "../db";
import bcrypt from "bcryptjs";

// ─── PERFIL ROUTER ────────────────────────────────────────────────────────────
export const perfilRouter = router({

  // Dados completos do perfil: user + configurações + estatísticas
  get: protectedProcedure.query(async ({ ctx }) => {
    const sb = await getSupabaseClientAsync();
    if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    // Configurações da empresa
    const { data: cfgRows } = await sb.from("configuracoes").select("chave, valor");
    const cfg: Record<string, string> = {};
    (cfgRows ?? []).forEach((r: { chave: string; valor: string }) => { cfg[r.chave] = r.valor ?? ""; });
    const get = (camel: string, snake: string, fallback = "") => cfg[camel] ?? cfg[snake] ?? fallback;

    // Estatísticas
    const { data: clientesData } = await sb.from("clientes").select("id", { count: "exact" });
    const totalClientes = clientesData?.length ?? 0;

    const { data: contratosData } = await sb.from("contratos").select("valor_principal");
    const totalEmprestado = (contratosData ?? []).reduce((sum: number, c: { valor_principal: string }) => sum + parseFloat(c.valor_principal ?? "0"), 0);

    const { data: parcelasData } = await sb.from("parcelas").select("valor_pago").eq("status", "paga");
    const totalRecebido = (parcelasData ?? []).reduce((sum: number, p: { valor_pago: string | null }) => sum + parseFloat(p.valor_pago ?? "0"), 0);

    // Assinatura (armazenada nas configurações)
    const assinaturaPlano = get("assinaturaPlano", "assinatura_plano", "Mensal");
    const assinaturaValidade = get("assinaturaValidade", "assinatura_validade", "");
    const assinaturaInicio = get("assinaturaInicio", "assinatura_inicio", ctx.user.createdAt?.toString() ?? "");

    let diasRestantes = 0;
    if (assinaturaValidade) {
      const validade = new Date(assinaturaValidade);
      const hoje = new Date();
      diasRestantes = Math.max(0, Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return {
      // Dados do usuário
      id: ctx.user.id,
      nome: ctx.user.name,
      email: ctx.user.email,
      criadoEm: ctx.user.createdAt,
      role: ctx.user.role,

      // Dados da empresa (configurações)
      nomeEmpresa: get("nomeEmpresa", "nome_empresa"),
      whatsappEmpresa: get("whatsappEmpresa", "whatsapp_empresa"),
      cnpjEmpresa: get("cnpjEmpresa", "cnpj_empresa"),
      enderecoEmpresa: get("enderecoEmpresa", "endereco_empresa"),
      logoUrl: get("logoUrl", "logo_url"),
      pixKey: get("pixKey", "pix_key"),
      tipoPix: get("tipoPix", "tipo_pix", "cpf"),
      nomeCobranca: get("nomeCobranca", "nome_cobranca"),
      linkPagamento: get("linkPagamento", "link_pagamento"),

      // Estatísticas
      totalClientes,
      totalEmprestado,
      totalRecebido,

      // Assinatura
      assinaturaPlano,
      assinaturaValidade,
      assinaturaInicio,
      diasRestantes,
    };
  }),

  // Atualizar dados da empresa no perfil
  update: protectedProcedure
    .input(z.object({
      nomeEmpresa: z.string().optional(),
      whatsappEmpresa: z.string().optional(),
      cnpjEmpresa: z.string().optional(),
      enderecoEmpresa: z.string().optional(),
      nomeCobranca: z.string().optional(),
      linkPagamento: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const entries = Object.entries(input).filter(([, v]) => v !== undefined);
      for (const [chave, valor] of entries) {
        await sb.from("configuracoes").upsert({ chave, valor: String(valor) }, { onConflict: "chave" });
      }
      return { success: true };
    }),

  // Salvar chave PIX
  salvarPix: protectedProcedure
    .input(z.object({
      pixKey: z.string().min(1),
      tipoPix: z.string().default("cpf"),
    }))
    .mutation(async ({ input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await sb.from("configuracoes").upsert({ chave: "pixKey", valor: input.pixKey }, { onConflict: "chave" });
      await sb.from("configuracoes").upsert({ chave: "tipoPix", valor: input.tipoPix }, { onConflict: "chave" });
      return { success: true };
    }),

  // Upload de logo da empresa
  uploadLogo: protectedProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/png"),
    }))
    .mutation(async ({ ctx, input }) => {
      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Converter base64 para buffer
      const base64Data = input.base64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = input.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      const fileKey = `${ctx.user.id}-logo-${Date.now()}.${ext}`;

      // Upload para Supabase Storage (bucket 'logos' público)
      const sbAdmin = await getSupabaseClientAsync();
      if (!sbAdmin) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Storage unavailable" });

      const { error: uploadError } = await sbAdmin.storage
        .from("logos")
        .upload(fileKey, buffer, {
          contentType: input.mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao fazer upload: ${uploadError.message}` });
      }

      const { data: publicData } = sbAdmin.storage.from("logos").getPublicUrl(fileKey);
      const url = publicData.publicUrl;

      // Salvar URL nas configurações
      await sb.from("configuracoes").upsert({ chave: "logoUrl", valor: url }, { onConflict: "chave" });
      return { url };
    }),

  // Remover logo
  removerLogo: protectedProcedure.mutation(async () => {
    const sb = await getSupabaseClientAsync();
    if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await sb.from("configuracoes").upsert({ chave: "logoUrl", valor: "" }, { onConflict: "chave" });
    return { success: true };
  }),

  // Alterar senha
  alterarSenha: protectedProcedure
    .input(z.object({
      novaSenha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
      confirmarSenha: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.novaSenha !== input.confirmarSenha) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "As senhas não coincidem" });
      }

      const sb = await getSupabaseClientAsync();
      if (!sb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const hash = await bcrypt.hash(input.novaSenha, 12);
      const { error } = await sb.from("users").update({ passwordHash: hash }).eq("id", ctx.user.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao alterar senha" });

      return { success: true };
    }),
});
