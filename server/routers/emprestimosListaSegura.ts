import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import { listarEmprestimosSeguros } from '../services/emprestimosListaSegura';

/** Somente leitura. Nenhum user/koletor/contrato fornecido pelo cliente. */
export const listaSeguraEmprestimosProcedure = protectedProcedure.input(z.void()).query(async ({ ctx }) => {
  const userId = ctx.user.id;
  if (!Number.isInteger(userId) || userId <= 0 || userId > 2147483647)
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  let client;
  try { client = await getSupabaseClientAsync(); }
  catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível confirmar a leitura dos empréstimos. Tente novamente.' }); }
  return listarEmprestimosSeguros(client, userId);
});
