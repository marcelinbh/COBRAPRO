import { TRPCError } from '@trpc/server';
import { protectedProcedure,router } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import {
  reparcelamento43PreviewSchema,reparcelamento43ExecucaoSchema,
  cotarReparcelamento43,executarReparcelamento43,reconciliarReparcelamento43,
} from '../services/reparcelamento43Rpc';
/** Candidato offline: registro só junto da migração43 íntegra e catálogo real autorizado.
 * Sem mock/env para liberar writer: a própria RPC exige selo37 e origem/prova43.
 * Dono exclusivamente ctx.user.id; ausência da RPC falha fechada, sem REST.
 */
async function cliente43() {
  const c = await getSupabaseClientAsync();
  if (!c) throw new TRPCError({code:'PRECONDITION_FAILED',message:'Reparcelamento43 sem fonte transacional. Nenhum fallback será usado.'});
  return c;
}
export const reparcelamento43Router = router({
  preview43: protectedProcedure.input(reparcelamento43PreviewSchema).query(async({ctx,input})=>
    cotarReparcelamento43(await cliente43(),ctx.user.id,input)),
  executar: protectedProcedure.input(reparcelamento43ExecucaoSchema).mutation(async({ctx,input})=>
    executarReparcelamento43(await cliente43(),ctx.user.id,input)),
  reconciliar: protectedProcedure.input(reparcelamento43ExecucaoSchema).mutation(async({ctx,input})=>
    reconciliarReparcelamento43(await cliente43(),ctx.user.id,input)),
});
