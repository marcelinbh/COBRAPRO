import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  deleteInstance,
  disconnectInstance,
  ensureConnection,
  enviarMensagemEvolution,
  getConnectionSnapshot,
  instanceNameForUser,
  normalizarTelefoneWhatsApp,
} from "../services/evolutionClient";

function throwEvolutionError(message?: string): never {
  throw new TRPCError({ code: "BAD_GATEWAY", message: message ?? "A Evolution API não respondeu corretamente" });
}

export const whatsappEvolutionRouter = router({
  /** Não expõe URL ou chave da infraestrutura ao navegador. */
  getConfig: protectedProcedure.query(({ ctx }) => ({
    instanceName: instanceNameForUser(ctx.user.id),
  })),

  /** Consulta somente leitura, apropriada para polling da tela. */
  getStatus: protectedProcedure.query(async ({ ctx }) => getConnectionSnapshot(ctx.user.id)),

  /** Consulta somente leitura: não cria nem apaga sessão. */
  getQRCode: protectedProcedure.query(async ({ ctx }) => getConnectionSnapshot(ctx.user.id)),

  /** Garante uma sessão por usuário e jamais remove uma sessão connecting. */
  createInstance: protectedProcedure.mutation(async ({ ctx }) => {
    const snapshot = await ensureConnection(ctx.user.id);
    if (snapshot.state === "unavailable" || snapshot.state === "unauthorized" || snapshot.state === "error") {
      throwEvolutionError(snapshot.errorMessage);
    }
    return { success: true, ...snapshot };
  }),

  /** Alias explícito para o fluxo seguro de provisionar/conectar. */
  ensureConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const snapshot = await ensureConnection(ctx.user.id);
    if (snapshot.state === "unavailable" || snapshot.state === "unauthorized" || snapshot.state === "error") {
      throwEvolutionError(snapshot.errorMessage);
    }
    return { success: true, ...snapshot };
  }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await disconnectInstance(ctx.user.id);
    if (!result.ok && result.state !== "missing") throwEvolutionError(result.errorMessage);
    return { success: true };
  }),

  /** A recriação é propositalmente separada e exige confirmação do operador. */
  resetConnection: protectedProcedure
    .input(z.object({ confirmar: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      const logout = await disconnectInstance(ctx.user.id);
      if (!logout.ok && logout.state !== "missing") throwEvolutionError(logout.errorMessage);
      const removed = await deleteInstance(ctx.user.id);
      if (!removed.ok && removed.state !== "missing") throwEvolutionError(removed.errorMessage);
      const snapshot = await ensureConnection(ctx.user.id);
      if (snapshot.state === "unavailable" || snapshot.state === "unauthorized" || snapshot.state === "error") {
        throwEvolutionError(snapshot.errorMessage);
      }
      return { success: true, ...snapshot };
    }),

  /** Mantido por compatibilidade; não permite remoção sem a confirmação explícita. */
  deleteInstance: protectedProcedure
    .input(z.object({ confirmar: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      const result = await deleteInstance(ctx.user.id);
      if (!result.ok && result.state !== "missing") throwEvolutionError(result.errorMessage);
      return { success: true };
    }),

  sendMessage: protectedProcedure
    .input(z.object({ phone: z.string().min(8), message: z.string().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const result = await enviarMensagemEvolution(ctx.user.id, input.phone, input.message);
      if (!result.ok) throwEvolutionError(result.erro);
      return { success: true, providerMessageId: result.providerMessageId };
    }),

  checkNumber: protectedProcedure
    .input(z.object({ phone: z.string().min(8) }))
    .query(async ({ input }) => {
      try {
        return { exists: true, number: normalizarTelefoneWhatsApp(input.phone) };
      } catch {
        return { exists: false };
      }
    }),
});
