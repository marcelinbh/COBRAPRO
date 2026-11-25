import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { calendario44Schema, cotarCalendarioSchema, cotarCalendario44, exigirCalendario44, manterCalendario44 } from "../services/manutencaoEmprestimos";
import { identificarCalendario46, type ClienteOrigemCalendario46 } from "../services/calendario46";
import { scopedQuote46, scopedIntent46, sessionScope46, conferirSessao46, exigir46, cotar46, executar46, type Client46 } from "../services/calendarioWriter46";
async function cliente46() {
  exigir46(); const c = await getSupabaseClientAsync();
  if (!c) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Backend46 indisponível. Sem fallback." });
  return c as unknown as Client46;
}
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
  sessao46: protectedProcedure.query(({ ctx }) => ({ userId: ctx.user.id, sessionScope: sessionScope46(ctx.user.id, ctx.req.headers.cookie) })),
  cotarCalendario46: protectedProcedure.input(scopedQuote46).query(async ({ ctx, input }) => {
    conferirSessao46(sessionScope46(ctx.user.id, ctx.req.headers.cookie), input.sessionScope);
    return cotar46(await cliente46(), ctx.user.id, { contratoId: input.contratoId });
  }),
  alterarCalendario46: protectedProcedure.input(scopedIntent46).mutation(async ({ ctx, input }) => {
    conferirSessao46(sessionScope46(ctx.user.id, ctx.req.headers.cookie), input.sessionScope);
    return executar46(await cliente46(), ctx.user.id, input.intent);
  }),
  conferirCalendario46: protectedProcedure.input(scopedIntent46).mutation(async ({ ctx, input }) => {
    conferirSessao46(sessionScope46(ctx.user.id, ctx.req.headers.cookie), input.sessionScope);
    return executar46(await cliente46(), ctx.user.id, input.intent, true);
  }),
  origemCalendario: protectedProcedure.input(cotarCalendarioSchema).query(async ({ ctx, input }) =>
    identificarCalendario46(await cliente44() as unknown as ClienteOrigemCalendario46, ctx.user.id, input)),
  cotarCalendario: protectedProcedure.input(cotarCalendarioSchema).query(async ({ ctx, input }) =>
    cotarCalendario44(await cliente44(), ctx.user.id, input)),
  alterarCalendario: protectedProcedure.input(calendario44Schema).mutation(async ({ ctx, input }) =>
    manterCalendario44(await cliente44(), ctx.user.id, input)),
  conferirCalendario: protectedProcedure.input(calendario44Schema).mutation(async ({ ctx, input }) =>
    manterCalendario44(await cliente44(), ctx.user.id, input, true)),
});
export type ManutencaoEmprestimosRouter = typeof manutencaoEmprestimosRouter;
