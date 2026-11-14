import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { criarEmprestimoProspectivoAtomico, entradaEmprestimoProspectivoSchema } from "../services/emprestimosRpc";
import { consultaCicloSchema, entradaRecebimentoProspectivoSchema, exigirCicloEmprestimosProspectivos, cotarEmprestimoProspectivo, receberEmprestimoProspectivoAtomico } from "../services/cicloEmprestimosRpc";
import { financialIntentRecoveryInput } from "../../shared/financialIntentRecovery";
import { reconcileFinancialIntent } from "../services/financialIntentRecovery";
import { recebimentoComConfirmacao } from "../services/recebimentoNotificacao";
import { listarContasParaCadastro } from "../services/contasCadastro";
async function cliente() {
  exigirCicloEmprestimosProspectivos();
  const client = await getSupabaseClientAsync();
  if (!client) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Backend RPC indisponível; sem fallback." });
  return client;
}
/** Pai registra em appRouter como emprestimosProspectivos; nenhuma rota legada é liberada. */
export const emprestimosProspectivosRouter = router({
  contasParaCadastro: protectedProcedure.query(async ({ ctx }) => {
    const fonte = await getSupabaseClientAsync();
    if (!fonte) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível carregar as contas. Tente novamente." });
    return listarContasParaCadastro(fonte, ctx.user.id);
  }),
  disponibilidade: protectedProcedure.query(() => ({
    disponivel: process.env.ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS === "true" && process.env.ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS === "true",
    modalidade: "mensal" as const, regra: "mensal_simples_v1" as const,
    renovacao: false as const,
  })),
  validarCriacao: protectedProcedure.input(entradaEmprestimoProspectivoSchema).mutation(async ({ ctx, input }) => {
    // Reusa TODA validação/cálculo do adaptador; cliente sentinela nunca obtém DB.
    let validada = false;
    try { await criarEmprestimoProspectivoAtomico({ rpc: async () => { validada = true; throw new Error("validation-only"); } }, ctx.user.id, input); }
    catch (e) { if (!validada) throw e; }
    if (!validada) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Validação incompleta; nenhum envio." });
    return { validada: true as const };
  }),
  reconciliar: protectedProcedure.input(financialIntentRecoveryInput).mutation(async ({ ctx, input }) => {
    if (!input.family.startsWith("emprestimo_")) throw new TRPCError({ code: "BAD_REQUEST", message: "Família divergente." });
    return reconcileFinancialIntent(await cliente(), ctx.user.id, input);
  }),
  criar: protectedProcedure.input(entradaEmprestimoProspectivoSchema).mutation(async ({ ctx, input }) =>
    criarEmprestimoProspectivoAtomico(await cliente(), ctx.user.id, input)),
  cotar: protectedProcedure.input(consultaCicloSchema).query(async ({ ctx, input }) =>
    cotarEmprestimoProspectivo(await cliente(), ctx.user.id, input)),
  receber: protectedProcedure.input(entradaRecebimentoProspectivoSchema).mutation(async ({ ctx, input }) => {
    const c = await cliente();
    return recebimentoComConfirmacao(ctx.user.id, "ciclo_operacoes", () => receberEmprestimoProspectivoAtomico(c, ctx.user.id, input));
  }),
});
export type EmprestimosProspectivosRouter = typeof emprestimosProspectivosRouter;

// Composição apenas de tipos para o transporte cliente; pai registra mesma chave no appRouter.
const emprestimosProspectivosAppRouter = router({ emprestimosProspectivos: emprestimosProspectivosRouter });
export type EmprestimosProspectivosAppRouter = typeof emprestimosProspectivosAppRouter;
