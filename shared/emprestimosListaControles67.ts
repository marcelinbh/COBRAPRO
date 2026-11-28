// Organização privada67: não é autorização financeira nem catálogo legado.
import { z } from 'zod';
export const id67 = z.number().int().positive().max(2147483647);
export const nomeEtiqueta67 = z.string().min(1).max(80).refine(s => s === s.trim() && !/[\u0000-\u001f\u007f]/u.test(s));
export const corEtiqueta67 = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const revisao67 = z.string().regex(/^(0|[1-9][0-9]{0,15})$/);
export const nomes67 = z.array(nomeEtiqueta67).max(32).refine(a => new Set(a).size === a.length);
export const catalogoItem67 = z.object({ id: z.string().regex(/^[1-9][0-9]{0,15}$/), userId: id67, nome: nomeEtiqueta67, cor: corEtiqueta67 }).strict();
const etiquetas67 = z.discriminatedUnion('state', [
  z.object({ state: z.literal('confirmed'), nomes: nomes67, revisao: revisao67, estadoHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ state: z.literal('unavailable') }).strict(),
]);
export const organizacaoSchema67 = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unavailable'), scope: z.literal('ALLscope') }).strict(),
  z.object({ state: z.literal('confirmed'), scope: z.literal('ALLscope'), catalogo: z.array(catalogoItem67).max(256),
    cobradores: z.array(z.object({ id: id67, userId: id67, nome: z.string().min(1).max(255) }).strict()).max(19999),
    contratos: z.array(z.object({ id: id67, cobrador: z.discriminatedUnion('state', [
      z.object({ state: z.literal('confirmed'), id: id67.nullable() }).strict(),
      z.object({ state: z.literal('unavailable') }).strict(),
    ]), etiquetas: etiquetas67 }).strict()).max(19999),
  }).strict(),
]);
export type OrganizacaoLista67 = z.infer<typeof organizacaoSchema67>;
export type EtiquetasConfirmadas67 = Extract<z.infer<typeof etiquetas67>, { state: 'confirmed' }>;
export type CatalogoEtiqueta67 = z.infer<typeof catalogoItem67>;
export const criarEtiquetaInput67 = z.object({ nome: nomeEtiqueta67, cor: corEtiqueta67 }).strict();
export const removerEtiquetaInput67 = z.object({ id: catalogoItem67.shape.id }).strict();
export const aplicarEtiquetasInput67 = z.object({ contratoId: id67, nomes: nomes67, revisao: revisao67,
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type AplicarEtiquetasInput67 = z.infer<typeof aplicarEtiquetasInput67>;
export const resultadoEtiqueta67 = z.object({ versao: z.literal('etiquetas_lista67_v1'), userId: id67,
  acao: z.enum(['criar', 'remover', 'aplicar']), id: catalogoItem67.shape.id.nullable(),
  contratoId: id67.nullable(), revisao: revisao67.nullable() }).strict();

/** Copia JSON sem executar accessors/protos/ciclos; limite compatível com ALLscope60. */
export function copiarJson67(value: unknown): unknown {
  const stack = new Set<object>(); let nodes = 0;
  const visit = (v: unknown, depth: number): unknown => {
    if (++nodes > 2200000 || depth > 18) throw Error('JSON67 inválido');
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return v;
    if (!v || typeof v !== 'object' || stack.has(v)) throw Error('JSON67 inválido');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v), props = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(props);
    if ((array ? proto !== Array.prototype : ![Object.prototype, null].includes(proto)) || keys.some(k => typeof k !== 'string')) throw Error('JSON67 inválido');
    stack.add(v); let out: unknown;
    if (array) {
      const n = props.length?.value;
      if (!Number.isInteger(n) || n < 0 || n >= 20000 || keys.length !== n + 1) throw Error('JSON67 inválido');
      out = Array.from({ length: n }, (_, i) => { const p = props[String(i)]; if (!p?.enumerable || !('value' in p)) throw Error('JSON67 inválido'); return visit(p.value, depth + 1); });
    } else {
      const obj: Record<string, unknown> = Object.create(null);
      for (const k of keys as string[]) { const p = props[k]; if (!p.enumerable || !('value' in p)) throw Error('JSON67 inválido'); obj[k] = visit(p.value, depth + 1); }
      out = obj;
    }
    stack.delete(v); return out;
  };
  return visit(value, 0);
}
