import { router, protectedProcedure } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import { aplicarEtiquetasInput67, criarEtiquetaInput67, removerEtiquetaInput67 } from '../../shared/emprestimosListaControles67';
import { executarEtiqueta67 } from '../services/etiquetasLista67';
import { TRPCError } from '@trpc/server';
async function client67() {
  try { return await getSupabaseClientAsync(); } catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Organização indisponível. Atualize a consulta.' }); }
}
export const etiquetasLista67Router = router({
  criar: protectedProcedure.input(criarEtiquetaInput67).mutation(async ({ ctx, input }) => executarEtiqueta67(await client67(), ctx.user.id, 'criar', { p_nome: input.nome, p_cor: input.cor })),
  remover: protectedProcedure.input(removerEtiquetaInput67).mutation(async ({ ctx, input }) => executarEtiqueta67(await client67(), ctx.user.id, 'remover', { p_id: input.id })),
  aplicar: protectedProcedure.input(aplicarEtiquetasInput67).mutation(async ({ ctx, input }) => executarEtiqueta67(await client67(), ctx.user.id, 'aplicar', { p_contrato_id: input.contratoId, p_nomes: input.nomes, p_revisao: input.revisao, p_estado_hash: input.estadoHash })),
});
