import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getSupabaseClientAsync } from "../db";
import { listarContasParaCadastro } from "../services/contasCadastro";
import {
  modalidadesMultimodal, entradaMultimodalSchema, validarCriacaoMultimodal, criarMultimodal,
  consultaMultimodalSchema, recebimentoMultimodalSchema, cotarMultimodal, receberMultimodal,
  consultaRenovacaoMultimodalSchema, renovacaoMultimodalSchema, cotarRenovacaoMultimodal, renovarMultimodal, reconciliarMultimodal,
} from "../services/emprestimosMultimodalRpc";
import { financialIntentRecoveryInput } from "../../shared/financialIntentRecovery";

async function cliente() {
  const c = await getSupabaseClientAsync();
  if (!c) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Fonte financeira indisponível. Tente novamente; nenhum fallback será executado." });
  return c;
}
const capacidadesSchema = z.object({
  disponivel: z.literal(true), regra: z.literal("multimodal_v1"), modalidades: z.array(z.enum(modalidadesMultimodal)).length(5),
  recebimento: z.literal(true), renovacao: z.literal(true),
}).strict();
export const emprestimosMultimodalRouter = router({
  disponibilidade: protectedProcedure.query(async () => {
    const c = await cliente();
    let response;
    try { response = await c.rpc("rpc_capacidades_emprestimos_multimodal"); }
    catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível conferir o ciclo multimodal. Tente novamente." }); }
    if (response.error) {
      if (["PGRST202", "42883"].includes(response.error.code ?? "")) return { disponivel: false as const, regra: "multimodal_v1" as const, modalidades: [] as typeof modalidadesMultimodal[number][], recebimento: false as const, renovacao: false as const };
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Capacidade financeira não comprovada. Nenhuma modalidade será liberada por presunção." });
    }
    const parsed = capacidadesSchema.safeParse(response.data);
    if (!parsed.success || new Set(parsed.data.modalidades).size !== 5) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Contrato de capacidade inválido; não iniciar operação." });
    return parsed.data;
  }),
  contasParaCadastro: protectedProcedure.query(async ({ ctx }) => listarContasParaCadastro(await cliente(), ctx.user.id)),
  validarCriacao: protectedProcedure.input(entradaMultimodalSchema).mutation(({ ctx, input }) => {
    const validada = validarCriacaoMultimodal(ctx.user.id, input);
    return { validada: true as const, calculo: validada.calculo };
  }),
  criar: protectedProcedure.input(entradaMultimodalSchema).mutation(async ({ ctx, input }) => criarMultimodal(await cliente(), ctx.user.id, input)),
  cotar: protectedProcedure.input(consultaMultimodalSchema).query(async ({ ctx, input }) => cotarMultimodal(await cliente(), ctx.user.id, input)),
  receber: protectedProcedure.input(recebimentoMultimodalSchema).mutation(async ({ ctx, input }) => receberMultimodal(await cliente(), ctx.user.id, input)),
  cotarRenovacao: protectedProcedure.input(consultaRenovacaoMultimodalSchema).query(async ({ ctx, input }) => cotarRenovacaoMultimodal(await cliente(), ctx.user.id, input)),
  renovar: protectedProcedure.input(renovacaoMultimodalSchema).mutation(async ({ ctx, input }) => renovarMultimodal(await cliente(), ctx.user.id, input)),
  reconciliar: protectedProcedure.input(financialIntentRecoveryInput).mutation(async ({ ctx, input }) => {
    const family = z.enum(["multimodal_criar", "multimodal_receber", "multimodal_renovar"]).safeParse(input.family);
    if (!family.success) throw new TRPCError({ code: "BAD_REQUEST", message: "Família de intenção incompatível com este ciclo." });
    return reconciliarMultimodal(await cliente(), ctx.user.id, { ...input, family: family.data });
  }),
});
const app = router({ emprestimosMultimodal: emprestimosMultimodalRouter });
export type EmprestimosMultimodalAppRouter = typeof app;
