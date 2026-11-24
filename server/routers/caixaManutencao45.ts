import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { consultarCaixa45, intencaoCaixa45, consultar45, corrigir45, reconciliar45 } from "../services/caixaManutencao45Rpc";
async function cliente45() {
  const client = await getSupabaseClientAsync();
  if (!client) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Fonte45 indisponível. Nenhum writer alternativo será executado." });
  return client;
}
export const caixaManutencao45Procedures = {
  consultarObservacao45: protectedProcedure.input(consultarCaixa45).query(async ({ ctx, input }) => consultar45(await cliente45(), ctx.user.id, input)),
  corrigirObservacao45: protectedProcedure.input(intencaoCaixa45).mutation(async ({ ctx, input }) => corrigir45(await cliente45(), ctx.user.id, input)),
  reconciliarObservacao45: protectedProcedure.input(intencaoCaixa45).mutation(async ({ ctx, input }) => reconciliar45(await cliente45(), ctx.user.id, input)),
};
