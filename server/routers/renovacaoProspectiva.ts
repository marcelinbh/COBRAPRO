import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { exigirRenovacaoProspectiva, renovacaoProspectivaConsultaSchema, renovacaoProspectivaEntradaSchema,
  cotarRenovacaoProspectiva, renovarProspectivoAtomico } from "../services/renovacaoProspectivaRpc";
async function cliente() {
  exigirRenovacaoProspectiva();
  const c = await getSupabaseClientAsync();
  if (!c) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Backend RPC indisponível; renovação sem alternativa REST." });
  return c;
}
/** Pai integra como renovacaoProspectiva; routers.ts/fluxo legado permanecem intocados. */
export const renovacaoProspectivaRouter = router({
  disponibilidade: protectedProcedure.query(() => ({
    disponivel: [process.env.ENABLE_RPC_EMPRESTIMOS_PROSPECTIVOS, process.env.ENABLE_RPC_CICLO_EMPRESTIMOS_PROSPECTIVOS,
      process.env.ENABLE_RPC_RENOVACAO_PROSPECTIVA].every(v => v === "true"),
    regra: "renovacao_juros_mensal_brt_v1" as const,
    limitacao: "Primeira renovação somente: 0021/0022 completo, uma parcela mensal inicial intacta, sem parcial/desconto/amortização.",
  })),
  cotar: protectedProcedure.input(renovacaoProspectivaConsultaSchema).query(async ({ ctx, input }) =>
    cotarRenovacaoProspectiva(await cliente(), ctx.user.id, input)),
  renovar: protectedProcedure.input(renovacaoProspectivaEntradaSchema).mutation(async ({ ctx, input }) =>
    renovarProspectivoAtomico(await cliente(), ctx.user.id, input)),
});
const renovacaoProspectivaAppRouter = router({ renovacaoProspectiva: renovacaoProspectivaRouter });
export type RenovacaoProspectivaAppRouter = typeof renovacaoProspectivaAppRouter;
