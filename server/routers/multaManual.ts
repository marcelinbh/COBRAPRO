import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import {
  aplicarMultaSchema, consultaMultaSchema, receberMultaSchema, consultaRenovacaoMultaSchema, renovarMultaSchema,
  recuperacaoMultaSchema, disponibilidadeMulta, aplicarMulta, identificarMulta, cotarMulta, receberMulta,
  cotarRenovacaoMulta, renovarMulta, reconciliarMulta,
} from "../services/multaManualRpc";

async function cliente() {
  try {
    const c = await getSupabaseClientAsync();
    if (c) return c;
  } catch { /* Getter/configuração não prova ausência da RPC. */ }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Fonte financeira indisponível; nenhum fallback será executado." });
}
export const multaManualRouter = router({
  disponibilidade: protectedProcedure.query(async ({ ctx }) => disponibilidadeMulta(await cliente(), ctx.user.id)),
  aplicar: protectedProcedure.input(aplicarMultaSchema).mutation(async ({ ctx, input }) => aplicarMulta(await cliente(), ctx.user.id, input)),
  origem: protectedProcedure.input(consultaMultaSchema).query(async ({ ctx, input }) => identificarMulta(await cliente(), ctx.user.id, input)),
  cotar: protectedProcedure.input(consultaMultaSchema).query(async ({ ctx, input }) => cotarMulta(await cliente(), ctx.user.id, input)),
  cotarRenovacao: protectedProcedure.input(consultaRenovacaoMultaSchema).query(async ({ ctx, input }) => cotarRenovacaoMulta(await cliente(), ctx.user.id, input)),
  receber: protectedProcedure.input(receberMultaSchema).mutation(async ({ ctx, input }) => receberMulta(await cliente(), ctx.user.id, input)),
  renovar: protectedProcedure.input(renovarMultaSchema).mutation(async ({ ctx, input }) => renovarMulta(await cliente(), ctx.user.id, input)),
  reconciliar: protectedProcedure.input(recuperacaoMultaSchema).mutation(async ({ ctx, input }) => reconciliarMulta(await cliente(), ctx.user.id, input)),
});
const app = router({ multaManual: multaManualRouter });
export type MultaManualAppRouter = typeof app;
