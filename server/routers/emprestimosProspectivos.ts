import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { criarEmprestimoProspectivoAtomico, entradaEmprestimoProspectivoSchema } from "../services/emprestimosRpc";
import { consultaCicloSchema, entradaRecebimentoProspectivoSchema, exigirCicloEmprestimosProspectivos, cotarEmprestimoProspectivo, receberEmprestimoProspectivoAtomico } from "../services/cicloEmprestimosRpc";
async function cliente() {
  exigirCicloEmprestimosProspectivos();
  const client = await getSupabaseClientAsync();
  if (!client) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Backend RPC indisponível; sem fallback." });
  return client;
}
/** Pai registra em appRouter como emprestimosProspectivos; nenhuma rota legada é liberada. */
export const emprestimosProspectivosRouter = router({
  disponibilidade: protectedProcedure.query(() => ({
    disponivel: process.env.ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS === "true" && process.env.ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS === "true",
    modalidade: "mensal" as const, regra: "mensal_simples_v1" as const,
    renovacao: false as const,
  })),
  criar: protectedProcedure.input(entradaEmprestimoProspectivoSchema).mutation(async ({ ctx, input }) =>
    criarEmprestimoProspectivoAtomico(await cliente(), ctx.user.id, input)),
  cotar: protectedProcedure.input(consultaCicloSchema).query(async ({ ctx, input }) =>
    cotarEmprestimoProspectivo(await cliente(), ctx.user.id, input)),
  receber: protectedProcedure.input(entradaRecebimentoProspectivoSchema).mutation(async ({ ctx, input }) =>
    receberEmprestimoProspectivoAtomico(await cliente(), ctx.user.id, input)),
});
export type EmprestimosProspectivosRouter = typeof emprestimosProspectivosRouter;

// Composição apenas de tipos para o transporte cliente; pai registra mesma chave no appRouter.
const emprestimosProspectivosAppRouter = router({ emprestimosProspectivos: emprestimosProspectivosRouter });
export type EmprestimosProspectivosAppRouter = typeof emprestimosProspectivosAppRouter;
