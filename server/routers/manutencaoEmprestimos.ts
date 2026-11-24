import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { calendario44Schema, cotarCalendarioSchema, cotarCalendario44, exigirCalendario44, manterCalendario44 } from "../services/manutencaoEmprestimos";
async function cliente44() {
  // A flag sozinha NÃO certifica DDL, schema exposto ou catálogo produtivo.
  // Instalação/exposição e provas físicas são etapas externas obrigatórias.
  exigirCalendario44();
  const c = await getSupabaseClientAsync();
  if (!c) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Backend44 indisponível. Sem fallback." });
  return c;
}
/** Único writer deste incremento: agenda mensal completa sem baixas. */
export const manutencaoEmprestimosRouter = router({
  cotarCalendario: protectedProcedure.input(cotarCalendarioSchema).query(async ({ ctx, input }) =>
    cotarCalendario44(await cliente44(), ctx.user.id, input)),
  alterarCalendario: protectedProcedure.input(calendario44Schema).mutation(async ({ ctx, input }) =>
    manterCalendario44(await cliente44(), ctx.user.id, input)),
  conferirCalendario: protectedProcedure.input(calendario44Schema).mutation(async ({ ctx, input }) =>
    manterCalendario44(await cliente44(), ctx.user.id, input, true)),
});
export type ManutencaoEmprestimosRouter = typeof manutencaoEmprestimosRouter;
