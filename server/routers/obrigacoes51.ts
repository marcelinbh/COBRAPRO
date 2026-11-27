import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure,router } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import { quoteInput51,intent51,int32_51 } from '../../shared/obrigacoes51';
import { sessionScope51,checkSession51,cotar51,executar51,capacidade51 } from '../services/obrigacoes51Rpc';
import { lerEstadoVinculado51 } from '../services/obrigacoes51Leitura';
import { capacidade52 } from '../services/inclusao52Rpc';
async function client51(){const c=await getSupabaseClientAsync();if(!c)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Backend51 indisponível; sem fallback.'});return c;}
export const obrigacoes51Router=router({
 sessao:protectedProcedure.query(({ctx})=>({userId:ctx.user.id,sessionScope:sessionScope51(ctx.user.id,ctx.req.headers.cookie)})),
 cotar:protectedProcedure.input(quoteInput51).query(async({ctx,input})=>{checkSession51(ctx.user.id,sessionScope51(ctx.user.id,ctx.req.headers.cookie),input);return cotar51(await client51(),ctx.user.id,input);}),
 executar:protectedProcedure.input(intent51).mutation(async({ctx,input})=>{checkSession51(ctx.user.id,sessionScope51(ctx.user.id,ctx.req.headers.cookie),input);return executar51(await client51(),ctx.user.id,input);}),
 conferir:protectedProcedure.input(intent51).mutation(async({ctx,input})=>{checkSession51(ctx.user.id,sessionScope51(ctx.user.id,ctx.req.headers.cookie),input);return executar51(await client51(),ctx.user.id,input,true);}),
 estado:protectedProcedure.input(z.object({contratoId:int32_51}).strict()).query(async({ctx,input})=>lerEstadoVinculado51(await client51(),ctx.user.id,input.contratoId)),
 capacidade:protectedProcedure.query(async()=>capacidade51(await client51())),
 capacidadeInclusao:protectedProcedure.query(async()=>capacidade52(await client51())),
});
