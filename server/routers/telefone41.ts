import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import { intencaoTelefone41Schema } from '../../shared/telefone41';
import { executarTelefone41 } from '../services/telefone41Rpc';
async function cliente41() {
 const c=await getSupabaseClientAsync();
 if(!c) throw new TRPCError({code:'PRECONDITION_FAILED',message:'Telefone41 indisponível; nenhum fallback REST.'});
 return c;
}
export const telefone41Writers = {
 criar:protectedProcedure.input(intencaoTelefone41Schema.refine(i=>i.request.acao==='criar')).mutation(async({ctx,input})=>executarTelefone41(await cliente41(),ctx.user.id,input)),
 pagarParcela:protectedProcedure.input(intencaoTelefone41Schema.refine(i=>i.request.acao==='receber')).mutation(async({ctx,input})=>executarTelefone41(await cliente41(),ctx.user.id,input)),
 deletar:protectedProcedure.input(intencaoTelefone41Schema.refine(i=>i.request.acao==='cancelar')).mutation(async({ctx,input})=>executarTelefone41(await cliente41(),ctx.user.id,input)),
 abandonar:protectedProcedure.input(intencaoTelefone41Schema).mutation(async({ctx,input})=>executarTelefone41(await cliente41(),ctx.user.id,input,false,true)),
 reconciliar:protectedProcedure.input(intencaoTelefone41Schema).mutation(async({ctx,input})=>executarTelefone41(await cliente41(),ctx.user.id,input,true)),
};
