import { TRPCError } from '@trpc/server';
import { protectedProcedure,router } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import { reparcelamento47PreviewSchema,reparcelamento47ExecucaoSchema } from '../../shared/reparcelamento47';
import { cotarReparcelamento47,executarReparcelamento47,reconciliarReparcelamento47 } from '../services/reparcelamento47Rpc';
async function client(){const c=await getSupabaseClientAsync();if(!c)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Writer47 sem fonte transacional; sem fallback.'});return c;}
export const reparcelamento47Router=router({
 preview47:protectedProcedure.input(reparcelamento47PreviewSchema).query(async({ctx,input})=>cotarReparcelamento47(await client(),ctx.user.id,input)),
 executar:protectedProcedure.input(reparcelamento47ExecucaoSchema).mutation(async({ctx,input})=>executarReparcelamento47(await client(),ctx.user.id,input)),
 reconciliar:protectedProcedure.input(reparcelamento47ExecucaoSchema).mutation(async({ctx,input})=>reconciliarReparcelamento47(await client(),ctx.user.id,input)),
});
