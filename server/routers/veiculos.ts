import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { veiculos, parcelasVeiculo } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

export const veiculosRouter = router({
  criar: protectedProcedure
    .input(z.object({
      clienteId: z.number(),
      placa: z.string().min(1),
      marca: z.string().optional(),
      modelo: z.string().optional(),
      ano: z.number().optional(),
      cor: z.string().optional(),
      renavam: z.string().optional(),
      chassi: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      
      const result = await db.insert(veiculos).values({ ...input, userId: ctx.user.id }).returning();
      return result[0];
    }),

  listar: protectedProcedure
    .input(z.object({ clienteId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const allVeiculos = await db.select().from(veiculos).where(eq(veiculos.userId, ctx.user.id)).orderBy(desc(veiculos.createdAt));
      
      if (input?.clienteId) {
        return allVeiculos.filter(v => v.clienteId === input.clienteId);
      }
      
      return allVeiculos;
    }),

  deletar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      
      // Deletar parcelas associadas
      await db.delete(parcelasVeiculo).where(eq(parcelasVeiculo.veiculoId, input.id));
      
      // Deletar veículo
      await db.delete(veiculos).where(and(eq(veiculos.id, input.id), eq(veiculos.userId, ctx.user.id)));
      
      return { success: true };
    }),

  pagarParcela: protectedProcedure
    .input(z.object({
      parcelaId: z.number(),
      valorPago: z.number(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      
      const hoje = new Date();
      
      const result = await db.update(parcelasVeiculo)
        .set({
          status: 'paga',
          valorPago: input.valorPago.toString(),
          pagamentoData: hoje.toISOString().split('T')[0],
          observacoes: input.observacoes,
          updatedAt: new Date(),
        })
        .where(eq(parcelasVeiculo.id, input.parcelaId))
        .returning();
      
      return result[0];
    }),
});
