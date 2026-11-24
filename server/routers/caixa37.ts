import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import {
  cotarCaixa37Schema, aportar37Schema, transferir37Schema, recovery37Schema,
  capacidades37, cotar37, aportar37, transferir37, reconciliar37,
} from "../services/caixa37Rpc";

async function cliente() {
  try {
    const c = await getSupabaseClientAsync();
    if (c) return c;
  } catch { /* Falha de configuração/getter não prova RPC ausente. */ }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Fonte caixa37 indisponível; nenhum fallback será executado." });
}
/** Integração feita pelo responsável: ...caixa37Procedures dentro de appRouter.caixa. */
export const caixa37Procedures = {
  capacidades37: protectedProcedure.query(async ({ ctx }) => capacidades37(await cliente(), ctx.user.id)),
  cotar37: protectedProcedure.input(cotarCaixa37Schema).query(async ({ ctx, input }) => cotar37(await cliente(), ctx.user.id, input)),
  aportar37: protectedProcedure.input(aportar37Schema).mutation(async ({ ctx, input }) => aportar37(await cliente(), ctx.user.id, input)),
  transferir37: protectedProcedure.input(transferir37Schema).mutation(async ({ ctx, input }) => transferir37(await cliente(), ctx.user.id, input)),
  reconciliar37: protectedProcedure.input(recovery37Schema).mutation(async ({ ctx, input }) => reconciliar37(await cliente(), ctx.user.id, input)),
};
export const caixa37Router = router(caixa37Procedures);
export type Caixa37Router = typeof caixa37Router;
