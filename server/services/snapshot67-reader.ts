import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { copiarJson67, id67, organizacaoSchema67 } from '../../shared/emprestimosListaControles67';
import { mapearSnapshot60, type Client60 } from './snapshot60-reader';
export const RPC67 = 'rpc_lista_emprestimos67';
const fail = (): never => { throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Não foi possível confirmar a organização desta consulta.' }); };
const readFail = (): never => { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível confirmar a leitura dos empréstimos. Tente novamente.' }); };
export function mapearSnapshot67(raw: unknown, owner: number) {
  let envelope;
  try { envelope = z.object({ versao: z.literal('lista_emprestimos67_v1'), userId: id67, lista60: z.unknown(), organizacao67: organizacaoSchema67 }).strict().parse(copiarJson67(raw)); } catch { return fail(); }
  if (envelope.userId !== owner) return fail();
  // Erros financeiros60 continuam fatais, jamais viram ausência de etiquetas.
  const data = mapearSnapshot60(envelope.lista60, owner), org = envelope.organizacao67;
  if (org.state === 'confirmed') {
    const snapshot = envelope.lista60 as { items: Array<{ kind: string; id: number; contrato?: { koletor_id: number | null } }> };
    const referencedCollectors = new Set(snapshot.items.flatMap(i => i.kind === 'validated' && i.contrato?.koletor_id !== null ? [i.contrato?.koletor_id] : []));
    const valid = new Map(snapshot.items.filter(i => i.kind === 'validated').map(i => [i.id, i]));
    const ids = new Set<number>(), collectors = new Set<number>(), names = new Set<string>(), catalogIds = new Set<string>();
    for (const c of org.catalogo) { if (c.userId !== owner || names.has(c.nome) || catalogIds.has(c.id)) return fail(); names.add(c.nome); catalogIds.add(c.id); }
    for (const c of org.cobradores) { if (c.userId !== owner || collectors.has(c.id) || !referencedCollectors.has(c.id)) return fail(); collectors.add(c.id); }
    for (const c of org.contratos) {
      const original = valid.get(c.id);
      if (!original || ids.has(c.id)) return fail(); ids.add(c.id);
      if (c.cobrador.state === 'confirmed' && (c.cobrador.id !== original.contrato?.koletor_id || (c.cobrador.id !== null && !collectors.has(c.cobrador.id)))) return fail();
    }
    if (ids.size !== valid.size) return fail();
  }
  data.organizacao67 = org;
  return data;
}
const timeout = z.object({ data: z.null(), error: z.object({ code: z.literal('57014'), message: z.literal('canceling statement due to statement timeout'), details: z.string().nullable(), hint: z.string().nullable() }).strict(), status: z.literal(500), count: z.null().optional(), statusText: z.string().optional() }).strict();
export async function listarEmprestimosSnapshot67(client: Client60 | null | undefined, owner: unknown) {
  if (!id67.safeParse(owner).success) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  if (!client) return readFail();
  const fetchOnce = async () => { try { return copiarJson67(await client.rpc(RPC67, { p_user_id: owner })); } catch { return readFail(); } };
  let response = await fetchOnce();
  // Mesma allowlist nativa61, uma repetição, sem tocar parser/retry60.
  if (timeout.safeParse(response).success) { await new Promise<void>(resolve => setTimeout(resolve, 250)); response = await fetchOnce(); }
  let r;
  try { r = z.object({ data: z.unknown(), error: z.unknown(), status: z.number().int().min(200).max(299).optional(), statusText: z.string().optional(), count: z.null().optional(), success: z.literal(true).optional() }).strict().parse(response); } catch { return readFail(); }
  if (!Object.hasOwn(r, 'data') || !Object.hasOwn(r, 'error') || r.error !== null || r.data === null) return readFail();
  return mapearSnapshot67(r.data, owner as number);
}
