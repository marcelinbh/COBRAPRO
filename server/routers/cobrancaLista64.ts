import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../_core/trpc';
import { getSupabaseClientAsync } from '../db';
import { int32_51 } from '../../shared/obrigacoes51';
import { preparar64Schema, conferir64Schema, enviar64Schema, preview64Schema, resultado64Schema } from '../../shared/cobrancaLote64';
import { sessionScope51 } from '../services/obrigacoes51Rpc';
import { prepararLote64, enviarItem64 } from '../services/cobrancaLote64';

function session64(ctx: { user: { id: number }; req: { headers: { cookie?: string } } }) {
  if (!int32_51.safeParse(ctx.user.id).success) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  return { uid: ctx.user.id, sessionScope: sessionScope51(ctx.user.id, ctx.req.headers.cookie) };
}
async function client64() {
  try {
    const sb = await getSupabaseClientAsync();
    if (sb) return sb;
  } catch { /* Não transportar mensagens de banco/credenciais ao navegador. */ }
  throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Cobrança indisponível; sem fallback.' });
}
/** Integração no root exclusivamente pelo parent. Conferir e preparar são apenas leitura. */
export const cobrancaLista64Router = router({
  preparar: protectedProcedure.input(preparar64Schema).output(preview64Schema).query(async ({ ctx, input }) => {
    const { uid, sessionScope } = session64(ctx);
    return prepararLote64(await client64(), uid, sessionScope, input);
  }),
  conferir: protectedProcedure.input(conferir64Schema).output(preview64Schema).query(async ({ ctx, input }) => {
    const { uid, sessionScope } = session64(ctx);
    return prepararLote64(await client64(), uid, sessionScope, input);
  }),
  enviar: protectedProcedure.input(enviar64Schema).output(resultado64Schema).mutation(async ({ ctx, input }) => {
    const { uid, sessionScope } = session64(ctx);
    return enviarItem64(await client64(), uid, sessionScope, input.token);
  }),
});
