import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const INT32_MAX = 2147483647;
const MAX_CENTS = 999999999999999n; // NUMERIC(15,2); below Number.MAX_SAFE_INTEGER.
const id = z.number().int().positive().max(INT32_MAX);
const estoque = z.number().int().min(0).max(INT32_MAX);
const nome = z.string().trim().min(1).max(255); // produtos.nome VARCHAR(255).

// Parse the decimal spelling, never value * 100: e.g. 0.29 * 100 is not integral.
// More than two decimal places are rejected, not rounded into a different price.
function cents(value: number | string): bigint | null {
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  const text = String(value);
  if (!/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return amount > 0n && amount <= MAX_CENTS ? amount : null;
}

const preco = z.number().refine(value => cents(value) !== null, 'Preço deve ser positivo, em centavos e compatível com NUMERIC(15,2).');
export const criarProdutoInput = z.object({
  nome,
  descricao: z.string().nullable().optional(),
  preco,
  estoque: estoque.default(0),
}).strict();
export const atualizarEstoqueInput = z.object({ id, estoque }).strict();
export const desativarProdutoInput = z.object({ id }).strict();
export type CriarProdutoInput = z.input<typeof criarProdutoInput>;
export type AtualizarEstoqueInput = z.input<typeof atualizarEstoqueInput>;
export type DesativarProdutoInput = z.input<typeof desativarProdutoInput>;
export type CatalogClient = Pick<SupabaseClient, 'from'>;
export type ProdutoCatalogo = {
  id: number;
  user_id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  estoque: number | null;
  ativo: true;
};

const projection = 'id,user_id,nome,descricao,preco,estoque,ativo';
const row = z.object({
  id,
  user_id: id,
  nome,
  descricao: z.string().nullable(),
  preco: z.union([z.string(), z.number()]).refine(value => cents(value) !== null),
  estoque: estoque.nullable(), // Do not invent inventory when the physical value is NULL.
  ativo: z.literal(true),
});
const confirmedRow = z.object({ id, user_id: id });
const unavailable = (): never => {
  // Neither raw DB errors, row values nor causes escape to the transport/logs.
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Catálogo indisponível ou resultado não confirmado. Consulte novamente antes de repetir uma alteração.',
  });
};
export function erroCatalogoIndisponivel(): never { return unavailable(); }

function ownClient(client: CatalogClient | null | undefined, owner: number): CatalogClient {
  if (!id.safeParse(owner).success) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  if (!client) return unavailable();
  return client;
}
function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados de produto inválidos.' });
  return result.data;
}
async function response(query: () => PromiseLike<unknown>): Promise<unknown> {
  let result: unknown;
  try { result = await query(); } catch { return unavailable(); }
  if (!result || typeof result !== 'object' || !('error' in result) || !('data' in result)) return unavailable();
  const envelope = result as { error: unknown; data: unknown; status?: unknown };
  if (envelope.error !== null) return unavailable();
  if (envelope.status !== undefined && (!Number.isInteger(envelope.status) || Number(envelope.status) < 200 || Number(envelope.status) > 299)) return unavailable();
  return envelope.data;
}

export function mapearProdutosCatalogo(data: unknown, owner: number): ProdutoCatalogo[] {
  if (!id.safeParse(owner).success) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  const parsed = z.array(row).safeParse(data);
  if (!parsed.success || parsed.data.some(product => product.user_id !== owner)) return unavailable();
  return parsed.data.map(product => ({ ...product, preco: Number(cents(product.preco)) / 100 }));
}

export async function listarProdutosCatalogo(client: CatalogClient | null | undefined, owner: number): Promise<ProdutoCatalogo[]> {
  const db = ownClient(client, owner);
  const data = await response(() => db.from('produtos').select(projection)
    .eq('ativo', true).eq('user_id', owner).order('createdAt', { ascending: false }));
  return mapearProdutosCatalogo(data, owner);
}

export async function criarProdutoCatalogo(client: CatalogClient | null | undefined, owner: number, input: CriarProdutoInput): Promise<{ success: true; id: number }> {
  const db = ownClient(client, owner);
  const value = parseInput(criarProdutoInput, input);
  const amount = cents(value.preco)!; // Validated above; exact integer arithmetic for serialization.
  const price = `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
  const data = await response(() => db.from('produtos').insert({
    nome: value.nome,
    descricao: value.descricao ?? null,
    preco: price,
    estoque: value.estoque,
    user_id: owner,
  }).select('id,user_id').single());
  const result = confirmedRow.safeParse(data);
  if (!result.success || result.data.user_id !== owner) return unavailable();
  return { success: true, id: result.data.id };
}

async function alterarProduto(client: CatalogClient | null | undefined, owner: number, productId: number, patch: { estoque: number } | { ativo: false }): Promise<{ success: true }> {
  const db = ownClient(client, owner);
  const data = await response(() => db.from('produtos').update(patch)
    .eq('id', productId).eq('user_id', owner).select('id,user_id'));
  if (!Array.isArray(data)) return unavailable();
  if (data.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Produto não encontrado.' });
  const result = z.array(confirmedRow).length(1).safeParse(data);
  if (!result.success || result.data[0].id !== productId || result.data[0].user_id !== owner) return unavailable();
  return { success: true };
}

export async function atualizarEstoqueCatalogo(client: CatalogClient | null | undefined, owner: number, input: AtualizarEstoqueInput): Promise<{ success: true }> {
  const value = parseInput(atualizarEstoqueInput, input);
  return alterarProduto(client, owner, value.id, { estoque: value.estoque });
}
export async function desativarProdutoCatalogo(client: CatalogClient | null | undefined, owner: number, input: DesativarProdutoInput): Promise<{ success: true }> {
  const value = parseInput(desativarProdutoInput, input);
  return alterarProduto(client, owner, value.id, { ativo: false });
}
