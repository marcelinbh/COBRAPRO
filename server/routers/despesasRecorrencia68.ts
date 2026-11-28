import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { input68, owner68, uuid68 } from '../../shared/despesasRecorrencia68';
import { fonte68, consultar68, configurar68 } from '../services/despesasRecorrencia68';
export function humano68(user: { id: number; isCron?: boolean } | null | undefined): number {
  if (!user || user.isCron === true || !owner68.safeParse(user.id).success) throw new TRPCError({ code: 'FORBIDDEN', message: 'Séries68 exigem sessão humana válida.' });
  return user.id;
}
export const despesasRecorrencia68Router = router({
  listar: protectedProcedure.input(z.object({ after: uuid68.nullable() }).strict().optional()).query(async ({ ctx, input }) => {
    const owner = humano68(ctx.user); return consultar68(await fonte68(), owner, input?.after ?? null);
  }),
  configurar: protectedProcedure.input(input68).mutation(async ({ ctx, input }) => {
    const owner = humano68(ctx.user); return configurar68(await fonte68(), owner, input, false);
  }),
  recuperar: protectedProcedure.input(input68).mutation(async ({ ctx, input }) => {
    const owner = humano68(ctx.user); return configurar68(await fonte68(), owner, input, true);
  }),
});
