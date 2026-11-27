import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure,router } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import { int32_51 } from '../../shared/obrigacoes51';
import { quoteInput53,intent53 } from '../../shared/sucessores53';
import { sessionScope51,checkSession51 } from '../services/obrigacoes51Rpc';
import { cotarSucessor53,executarSucessor53,estadoSucessor53 } from '../services/sucessores53Rpc';
async function client(){const c=await getSupabaseClientAsync();if(!c)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Backend53 não disponível; nenhum fallback.'});return c;}
export const sucessores53Router=router({
 sessao:protectedProcedure.query(({ctx})=>({userId:ctx.user.id,sessionScope:sessionScope51(ctx.user.id,ctx.req.headers.cookie)})),
 estado:protectedProcedure.input(z.object({contratoId:int32_51}).strict()).query(async({ctx,input})=>estadoSucessor53(await client(),ctx.user.id,input.contratoId)),
 cotar:protectedProcedure.input(quoteInput53).query(async({ctx,input})=>{checkSession51(ctx.user.id,sessionScope51(ctx.user.id,ctx.req.headers.cookie),input);return cotarSucessor53(await client(),ctx.user.id,input);}),
 executar:protectedProcedure.input(intent53).mutation(async({ctx,input})=>{checkSession51(ctx.user.id,sessionScope51(ctx.user.id,ctx.req.headers.cookie),input);return executarSucessor53(await client(),ctx.user.id,input);}),
 conferir:protectedProcedure.input(intent53).mutation(async({ctx,input})=>{checkSession51(ctx.user.id,sessionScope51(ctx.user.id,ctx.req.headers.cookie),input);return executarSucessor53(await client(),ctx.user.id,input,true);}),
});
