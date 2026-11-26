import { TRPCError } from '@trpc/server';
import { canonical51, type Projection51 } from '../../shared/obrigacoes51';
import { validarProjecao51, validarMetadados51, exigivel51, type MetadadoParcela51 } from '../../shared/obrigacoes51Projection';
import { listarRegistrosEmprestimos } from './emprestimosLeitura';

export type ClienteLeitura51 = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string | null } | null; status?: number }>;
};
export type FonteLeitura51 = ClienteLeitura51 & { from(table: string): any };
function falhar51(): never {
  throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Estado efetivo51 não confirmado; valores e cobrança indisponíveis. Atualize para conferir, sem novo cadastro nem saldo zero presumido.' });
}
type RecusaLista51 = { recusaLista51: true; code: string; message: string };
/** Pins textuais da fonte0051; nunca classifica erro de rede, catálogo ou envelope
 * malformado como recusa local. Não executa getters do objeto de erro do SDK. */
function recusaLista51(fields: Record<string, unknown>): RecusaLista51 | null {
  if (fields.data !== null || !Number.isInteger(fields.status) ||
    (Object.hasOwn(fields, 'success') && fields.success !== false) ||
    (Object.hasOwn(fields, 'count') && fields.count !== null) ||
    (Object.hasOwn(fields, 'statusText') && typeof fields.statusText !== 'string')) return null;
  const raw = fields.error;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) return null;
  const e: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(raw)) {
    if (typeof key !== 'string' || !['code', 'message', 'details', 'hint'].includes(key)) return null;
    const d = Object.getOwnPropertyDescriptor(raw, key)!;
    if (!d.enumerable || !('value' in d)) return null;
    e[key] = d.value;
  }
  if ((Object.hasOwn(e, 'details') && e.details !== null) || (Object.hasOwn(e, 'hint') && e.hint !== null)) return null;
  const expected = e.code === '42501' && fields.status === 403 && e.message === '51 vínculos próprios completos obrigatórios; sem saneamento'
    || e.code === '23514' && fields.status === 400 && ['51 obrigação registrada ambígua', '51 valores registrados inválidos', '51 residual parcial ambíguo', '51 aliases/baixa registrada ambíguos'].includes(e.message as string);
  return expected ? { recusaLista51: true, code: e.code as string, message: e.message as string } : null;
}
async function estadoCompleto51(client: ClienteLeitura51, uid: number, cid: number, ids: readonly number[]): Promise<Projection51>;
async function estadoCompleto51(client: ClienteLeitura51, uid: number, cid: number, ids: readonly number[], lista: true): Promise<Projection51 | RecusaLista51>;
async function estadoCompleto51(client: ClienteLeitura51, uid: number, cid: number, ids: readonly number[], lista = false): Promise<Projection51 | RecusaLista51> {
  let r;
  try { r = await client.rpc('rpc_estado_obrigacoes51', { p_user_id: uid, p_contrato_id: cid }); }
  catch { return falhar51(); }
  if (!r || typeof r !== 'object' || Array.isArray(r) || ![Object.prototype, null].includes(Object.getPrototypeOf(r))) return falhar51();
  const fields: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(r)) {
    if (typeof key !== 'string' || !['data', 'error', 'status', 'statusText', 'count', 'success'].includes(key)) return falhar51();
    const d = Object.getOwnPropertyDescriptor(r, key)!;
    if (!d.enumerable || !('value' in d)) return falhar51();
    fields[key] = d.value;
  }
  if (lista && Object.hasOwn(fields, 'data')) {
    const local = recusaLista51(fields);
    if (local) return local;
  }
  if (!Object.hasOwn(fields, 'data') || fields.error !== null ||
    (Object.hasOwn(fields, 'success') && fields.success !== true) ||
    (Object.hasOwn(fields, 'status') && (typeof fields.status !== 'number' || !Number.isInteger(fields.status) || fields.status < 200 || fields.status >= 300))) return falhar51();
  try { return validarProjecao51(fields.data, uid, cid, ids); } catch { return falhar51(); }
}
/** Somente após a verificação ORIGINAL de todos os vínculos; metadados completos,
 * inclusive pagas/canceladas/arquivadas. Reconfere após a primeira RPC e repete
 * a prova51 para invalidar alteração observável; não promete snapshot SQL/ABA. */
export async function lerProjecaoVinculada51(
  client: ClienteLeitura51, uid: number, cid: number,
  metadados: readonly MetadadoParcela51[], reler: () => Promise<readonly MetadadoParcela51[]>,
): Promise<Projection51> {
  let ids: number[];
  let selection: MetadadoParcela51[];
  try {
    ids = validarMetadados51(metadados, uid, cid);
    // Copia antes do await: mutação do adapter/caller não troca a seleção provada.
    selection = metadados.map(row => Object.freeze({ id: row.id, user_id: row.user_id, contrato_id: row.contrato_id, cliente_id: row.cliente_id }));
  } catch { return falhar51(); }
  const first = await estadoCompleto51(client, uid, cid, ids);
  let reviewed: readonly MetadadoParcela51[];
  try {
    reviewed = await reler();
    const after = validarMetadados51(reviewed, uid, cid), byId = new Map(reviewed.map(row => [row.id, row]));
    if (after.length !== ids.length || after.some(id => !ids.includes(id)) || selection.some(row => {
      const next = byId.get(row.id);
      return !next || row.cliente_id !== next.cliente_id;
    })) return falhar51();
  } catch { return falhar51(); }
  const final = await estadoCompleto51(client, uid, cid, ids);
  if (canonical51(first) !== canonical51(final)) return falhar51();
  return final;
}
/** Exclusivo da lista segura, APÓS prova global de pai/cliente/escopo. Recusa
 * SQL prevista pode indisponibilizar este contrato, jamais autorizar cobrança.
 * Metadados e o mesmo resultado são reconferidos inclusive quando recusado. */
export async function lerProjecaoLista51(
  client: ClienteLeitura51, uid: number, cid: number,
  metadados: readonly MetadadoParcela51[], reler: () => Promise<readonly MetadadoParcela51[]>,
): Promise<Projection51 | null> {
  let ids: number[];
  let selection: MetadadoParcela51[];
  try {
    ids = validarMetadados51(metadados, uid, cid);
    selection = metadados.map(row => ({ id: row.id, user_id: row.user_id, contrato_id: row.contrato_id, cliente_id: row.cliente_id }));
  } catch { return falhar51(); }
  const first = await estadoCompleto51(client, uid, cid, ids, true);
  const reviewed = await reler();
  try {
    const after = validarMetadados51(reviewed, uid, cid), byId = new Map(reviewed.map(row => [row.id, row]));
    if (after.length !== ids.length || after.some(id => !ids.includes(id)) || selection.some(row => row.cliente_id !== byId.get(row.id)?.cliente_id)) return falhar51();
  } catch { return falhar51(); }
  const final = await estadoCompleto51(client, uid, cid, ids, true);
  if (canonical51(first) !== canonical51(final)) return falhar51();
  return 'recusaLista51' in final ? null : final;
}
/** Para leitores legados com seleção filtrada, primeiro lê o conjunto COMPLETO
 * somente de metadados, sem usar status/valores REST para decidir eventos51. */
export async function lerEstadoVinculado51(client: FonteLeitura51, uid: number, cid: number): Promise<Projection51> {
  const own = (q: () => any) => listarRegistrosEmprestimos(q, uid);
  const parentQuery = () => client.from('contratos').select('id, user_id, cliente_id', { count: 'exact' }).eq('user_id', uid).eq('id', cid).order('id');
  const parents = await own(parentQuery);
  if (parents.length !== 1 || parents[0].id !== cid) return falhar51();
  const parent = parents[0];
  const customers = await own(() => client.from('clientes').select('id, user_id', { count: 'exact' }).eq('user_id', uid).eq('id', parent.cliente_id).order('id'));
  if (customers.length !== 1 || customers[0].id !== parent.cliente_id) return falhar51();
  const metadataQuery = () => client.from('parcelas').select('id, user_id, contrato_id, cliente_id', { count: 'exact' }).eq('contrato_id', cid).order('id');
  const metadata = await own(metadataQuery);
  if (metadata.some(p => p.cliente_id !== parent.cliente_id)) return falhar51();
  return lerProjecaoVinculada51(client, uid, cid, metadata, async () => {
    const now = await own(parentQuery);
    const customerNow = await own(() => client.from('clientes').select('id, user_id', { count: 'exact' }).eq('user_id', uid).eq('id', parent.cliente_id).order('id'));
    if (canonical51(now) !== canonical51(parents) || canonical51(customerNow) !== canonical51(customers)) return falhar51();
    const reviewed = await own(metadataQuery);
    if (reviewed.some(p => p.cliente_id !== parent.cliente_id)) return falhar51();
    return reviewed;
  });
}
/** Enfileiramento e pré-envio usam o MESMO helper. Não deve ser aplicado a
 * confirmação de pagamento: evidência concluída precede elegibilidade atual. */
export async function lerCobrancaExigivel51(client: FonteLeitura51, uid: number, parcelaId: number, clienteId: number) {
  const rows = await listarRegistrosEmprestimos(() => client.from('parcelas')
    .select('id, user_id, contrato_id, cliente_id', { count: 'exact' }).eq('user_id', uid).eq('id', parcelaId).order('id'), uid);
  if (rows.length !== 1 || rows[0].id !== parcelaId || rows[0].cliente_id !== clienteId) return falhar51();
  const p = await lerEstadoVinculado51(client, uid, rows[0].contrato_id);
  const row = p.parcelas.find(r => r.parcelaId === parcelaId);
  if (!row) return falhar51();
  return { exigivel: exigivel51(p, parcelaId), obrigacaoAtual: row.obrigacaoAtual };
}
