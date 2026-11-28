import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { copiarJson67, id67, resultadoEtiqueta67 } from '../../shared/emprestimosListaControles67';
import type { Client60 } from './snapshot60-reader';
export async function executarEtiqueta67(client: Client60 | null | undefined, owner: number, acao: 'criar' | 'remover' | 'aplicar', args: Record<string, unknown>) {
  if (!id67.safeParse(owner).success) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  const fail = (): never => { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Resultado de etiquetas não confirmado. Atualize a consulta antes de tentar novamente.' }); };
  if (!client) return fail();
  let response: unknown;
  try { response = copiarJson67(await client.rpc(`rpc_etiquetas_${acao}67`, { ...args, p_user_id: owner })); } catch { return fail(); }
  const envelope = z.object({ success: z.literal(true).optional(), data: z.unknown(), error: z.unknown(), status: z.number().int().optional(), statusText: z.string().optional(), count: z.null().optional() }).strict().safeParse(response);
  if (!envelope.success) return fail();
  const r = envelope.data;
  if (r.error !== null) {
    const error = z.object({ code: z.string(), message: z.string(), details: z.string().nullable().optional(), hint: z.string().nullable().optional() }).strict().safeParse(r.error);
    if (error.success && ['40001', '55P03', '23505'].includes(error.data.code)) throw new TRPCError({ code: 'CONFLICT', message: 'Organização mudou ou está em edição. Atualize a consulta e reconfirme.' });
    if (error.success && ['42501', '22023', '23514'].includes(error.data.code)) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Não foi possível confirmar as etiquetas e o escopo próprio. Atualize a consulta.' });
    return fail();
  }
  if (r.status !== undefined && (r.status < 200 || r.status > 299)) return fail();
  const result = resultadoEtiqueta67.safeParse(r.data);
  if (!result.success || result.data.userId !== owner || result.data.acao !== acao) return fail();
  const data = result.data;
  if (acao === 'aplicar' ? data.contratoId !== args.p_contrato_id || data.id !== null || data.revisao !== String(BigInt(String(args.p_revisao)) + 1n)
    : data.contratoId !== null || data.revisao !== null || data.id === null || (acao === 'remover' && data.id !== args.p_id)) return fail();
  return data;
}
