import { TRPCError } from '@trpc/server';
import { protectedProcedure,router } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import { scopedQuote48,scopedIntent48 } from '../../shared/manutencaoFinanceira48';
import { exigir48,sessionScope48,conferirSessao48,cotar48,executar48 } from '../services/manutencaoFinanceira48';
async function client48(recovery=false){if(!recovery)exigir48();const c=await getSupabaseClientAsync();if(!c)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Backend48 indisponível; sem fallback.'});return c;}
export const manutencaoFinanceira48Router=router({
 sessao:protectedProcedure.query(({ctx})=>({userId:ctx.user.id,sessionScope:sessionScope48(ctx.user.id,ctx.req.headers.cookie)})),
 cotar:protectedProcedure.input(scopedQuote48).query(async({ctx,input})=>{const {sessionScope,ownerId,...v}=input;if(ownerId!==ctx.user.id)throw new TRPCError({code:'CONFLICT',message:'Owner do journal mudou; preservar intenção.'});conferirSessao48(sessionScope48(ctx.user.id,ctx.req.headers.cookie),sessionScope);return cotar48(await client48(),ctx.user.id,v);}),
 executar:protectedProcedure.input(scopedIntent48).mutation(async({ctx,input})=>{const {sessionScope,ownerId,...v}=input;if(ownerId!==ctx.user.id)throw new TRPCError({code:'CONFLICT',message:'Owner do journal mudou; preservar intenção.'});conferirSessao48(sessionScope48(ctx.user.id,ctx.req.headers.cookie),sessionScope);return executar48(await client48(),ctx.user.id,v);}),
 conferir:protectedProcedure.input(scopedIntent48).mutation(async({ctx,input})=>{const {sessionScope,ownerId,...v}=input;if(ownerId!==ctx.user.id)throw new TRPCError({code:'CONFLICT',message:'Owner do journal mudou; preservar intenção.'});conferirSessao48(sessionScope48(ctx.user.id,ctx.req.headers.cookie),sessionScope);return executar48(await client48(true),ctx.user.id,v,true);}),
});
