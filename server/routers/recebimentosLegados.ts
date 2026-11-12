import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { consultaRecebimentoLegadoSchema, entradaRecebimentoLegadoSchema, exigirRecebimentosLegados, cotarRecebimentoLegado, receberLegadoAtomico, REGRA_RECEBIMENTO_LEGADO } from "../services/recebimentosLegadosRpc";
import { recebimentoComConfirmacao } from "../services/recebimentoNotificacao";
const id = z.number().int().positive().max(2147483647);
const origemEntrada = z.object({ contratoId: id, parcelaId: id, escopoUserId: id }).strict();
const origemResultado = z.object({ userId: id, contratoId: id, parcelaId: id, trilho: z.enum(["prospectivo", "legado"]), status: z.enum(["pendente", "paga", "pago", "atrasada", "atrasado", "cancelada", "cancelado", "parcial", "vencendo_hoje", "renovada"]) }).strict();
async function cliente() {
  exigirRecebimentosLegados();
  const c = await getSupabaseClientAsync();
  if (!c) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Backend RPC indisponível; sem fallback." });
  return c;
}
export const recebimentosLegadosRouter = router({
  disponibilidade: protectedProcedure.query(() => ({ disponivel: process.env.ENABLE_RPC_RECEBIMENTO_LEGADO_VALIDADO === "true", regra: REGRA_RECEBIMENTO_LEGADO, modo: "integral" as const })),
  origem: protectedProcedure.input(origemEntrada).query(async ({ ctx, input }) => {
    // O campo só separa o cache de sessões; nunca fornece o tenant da consulta SQL.
    if (input.escopoUserId !== ctx.user.id) throw new TRPCError({ code: "UNAUTHORIZED", message: "A sessão mudou; recarregue o recebimento." });
    const c = await getSupabaseClientAsync();
    if (!c) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Classificação RPC indisponível; não presumir legado." });
    let response;
    try { response = await c.rpc("legados_identificar_trilho", { p_user_id: ctx.user.id, p_contrato_id: input.contratoId, p_parcela_id: input.parcelaId }); }
    catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Consulta da origem indisponível; tente novamente." }); }
    if (response.error) throw new TRPCError({ code: response.error.code === "42501" ? "NOT_FOUND" : "PRECONDITION_FAILED", message: "Origem não comprovada para esta sessão. Nenhuma alternativa financeira será executada." });
    const parsed = origemResultado.safeParse(response.data);
    if (!parsed.success || parsed.data.userId !== ctx.user.id || parsed.data.contratoId !== input.contratoId || parsed.data.parcelaId !== input.parcelaId)
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resposta de origem inválida; não confirmar recebimento." });
    return parsed.data;
  }),
  cotar: protectedProcedure.input(consultaRecebimentoLegadoSchema).query(async ({ ctx, input }) => cotarRecebimentoLegado(await cliente(), ctx.user.id, input)),
  receber: protectedProcedure.input(entradaRecebimentoLegadoSchema).mutation(async ({ ctx, input }) => {
    const c = await cliente();
    return recebimentoComConfirmacao(ctx.user.id, "legados_operacoes", () => receberLegadoAtomico(c, ctx.user.id, input));
  }),
});
const app = router({ recebimentosLegados: recebimentosLegadosRouter });
export type RecebimentosLegadosAppRouter = typeof app;
