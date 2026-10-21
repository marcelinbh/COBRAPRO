import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { clientes, veiculos, parcelasVeiculo } from "../../drizzle/schema";
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

      const [cliente] = await db.select({ id: clientes.id }).from(clientes).where(and(
        eq(clientes.id, input.clienteId),
        eq(clientes.userId, ctx.user.id),
      )).limit(1);
      if (!cliente) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado para esta empresa' });

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

      // A autorização do pai precisa acontecer antes de apagar qualquer filha.
      const [veiculo] = await db.select({ id: veiculos.id }).from(veiculos).where(and(
        eq(veiculos.id, input.id),
        eq(veiculos.userId, ctx.user.id),
      )).limit(1);
      if (!veiculo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Veículo não encontrado para esta empresa' });

      // Deletar parcelas associadas
      await db.delete(parcelasVeiculo).where(eq(parcelasVeiculo.veiculoId, veiculo.id));
      
      // Deletar veículo
      const removido = await db.delete(veiculos).where(and(eq(veiculos.id, veiculo.id), eq(veiculos.userId, ctx.user.id))).returning({ id: veiculos.id });
      if (removido.length !== 1) throw new TRPCError({ code: 'CONFLICT', message: 'O veículo não pôde ser removido' });
      
      return { success: true };
    }),

  pagarParcela: protectedProcedure
    .input(z.object({
      parcelaId: z.number(),
      valorPago: z.number(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });

      const [parcela] = await db.select({ id: parcelasVeiculo.id, veiculoId: parcelasVeiculo.veiculoId })
        .from(parcelasVeiculo)
        .innerJoin(veiculos, eq(parcelasVeiculo.veiculoId, veiculos.id))
        .where(and(eq(parcelasVeiculo.id, input.parcelaId), eq(veiculos.userId, ctx.user.id)))
        .limit(1);
      if (!parcela) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela de veículo não encontrada para esta empresa' });

      const hoje = new Date();
      
      const result = await db.update(parcelasVeiculo)
        .set({
          status: 'paga',
          valorPago: input.valorPago.toString(),
          pagamentoData: hoje.toISOString().split('T')[0],
          observacoes: input.observacoes,
          updatedAt: new Date(),
        })
        .where(and(eq(parcelasVeiculo.id, parcela.id), eq(parcelasVeiculo.veiculoId, parcela.veiculoId)))
        .returning();
      if (result.length !== 1) throw new TRPCError({ code: 'CONFLICT', message: 'A parcela de veículo não pôde ser atualizada' });
      return result[0];
    }),
});
