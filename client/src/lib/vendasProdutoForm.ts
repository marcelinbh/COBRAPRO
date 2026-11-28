export const MAX_PRECO_CENTAVOS = 999_999_999_999_999;
export const MAX_ESTOQUE = 2_147_483_647;

/** Inteiro em centavos: sem float parsing parcial, arredondamento ou coerção de inválido. */
export function parsePrecoCentavos(raw: string): number | null {
  const text = raw.trim();
  // Ponto isolado é decimal; milhares só com agrupamento completo e vírgula decimal.
  if (!/^(?:\d+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+,\d{1,2})$/.test(text)) return null;
  const canonical = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const [whole, fraction = ''] = canonical.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_PRECO_CENTAVOS ? cents : null;
}

export function parseEstoque(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const stock = Number(text);
  return Number.isInteger(stock) && stock >= 0 && stock <= MAX_ESTOQUE ? stock : null;
}

export type ProdutoForm = Readonly<{ nome: string; descricao: string; preco: string; estoque: string }>;
export type ProdutoInput = Readonly<{ nome: string; descricao: string | undefined; preco: number; estoque: number }>;
export type ValidacaoProduto = { ok: true; input: ProdutoInput } | { ok: false; message: string };

export function validarProdutoForm(form: ProdutoForm): ValidacaoProduto {
  const nome = form.nome.trim();
  if (!nome || nome.length > 255) return { ok: false, message: 'Informe um nome de produto com 1 a 255 caracteres.' };
  const centavos = parsePrecoCentavos(form.preco);
  if (centavos === null) return { ok: false, message: 'Informe um preço positivo, com até duas casas decimais, no máximo 9.999.999.999.999,99.' };
  const estoque = parseEstoque(form.estoque);
  if (estoque === null) return { ok: false, message: 'Informe estoque inteiro entre 0 e 2147483647.' };
  // Mantém o contrato preco:number do backend; centavos já foram validados antes da conversão.
  const preco = Number((centavos / 100).toFixed(2));
  return { ok: true, input: Object.freeze({ nome, descricao: form.descricao || undefined, preco, estoque }) };
}

/** Tanto Drizzle/camelCase quanto REST/snake_case; não aceita owner ausente/conflitante. */
export function catalogoPertenceAoOwner(rows: unknown, owner: number): boolean {
  return Array.isArray(rows) && rows.every(row => {
    if (!row || typeof row !== 'object') return false;
    const value = row as Record<string, unknown>;
    const hasCamel = value.userId !== undefined;
    const hasSnake = value.user_id !== undefined;
    return (hasCamel || hasSnake) && (!hasCamel || value.userId === owner) && (!hasSnake || value.user_id === owner);
  });
}
