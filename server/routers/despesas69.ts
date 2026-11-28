import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { edicao69Input } from '../../shared/despesas69';
import { despesas69Service } from '../services/despesas69Rpc';
const human = protectedProcedure.use(({ ctx, next }) => {
  if (!Number.isSafeInteger(ctx.user.id) || ctx.user.id <= 0 || ctx.user.id > 2147483647 || (ctx.user as { isCron?: boolean }).isCron === true) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sessão humana válida obrigatória.' });
  return next({ ctx });
});
export const despesas69Router = router({
  capacidades: human.query(() => despesas69Service.capacidades()),
  cotar: human.input(z.object({ despesaId: z.number().int().positive().max(2147483647) }).strict()).mutation(({ ctx, input }) => despesas69Service.cotar(ctx.user.id, input.despesaId)),
  editar: human.input(edicao69Input).mutation(({ ctx, input }) => despesas69Service.editar(ctx.user.id, input)),
  recuperar: human.input(edicao69Input).mutation(({ ctx, input }) => despesas69Service.recuperar(ctx.user.id, input)),
});
