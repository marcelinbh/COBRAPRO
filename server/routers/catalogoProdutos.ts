import { router, protectedProcedure } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import {
  criarProdutoInput, atualizarEstoqueInput, desativarProdutoInput,
  listarProdutosCatalogo, criarProdutoCatalogo, atualizarEstoqueCatalogo, desativarProdutoCatalogo,
  erroCatalogoIndisponivel,
} from '../services/catalogoProdutos';

async function catalogClient() {
  try { return await getSupabaseClientAsync(); } catch { return erroCatalogoIndisponivel(); }
}

// REST is the existing effective path (getDb returns null in the base).
// No fallback/retry after an uncertain read/write; owner only comes from context.
export const vendasCatalogoRouter = router({
  listarProdutos: protectedProcedure.query(async ({ ctx }) =>
    listarProdutosCatalogo(await catalogClient(), ctx.user.id)),
  criarProduto: protectedProcedure.input(criarProdutoInput).mutation(async ({ ctx, input }) =>
    criarProdutoCatalogo(await catalogClient(), ctx.user.id, input)),
  atualizarEstoque: protectedProcedure.input(atualizarEstoqueInput).mutation(async ({ ctx, input }) =>
    atualizarEstoqueCatalogo(await catalogClient(), ctx.user.id, input)),
  desativarProduto: protectedProcedure.input(desativarProdutoInput).mutation(async ({ ctx, input }) =>
    desativarProdutoCatalogo(await catalogClient(), ctx.user.id, input)),
});
