import { z } from "zod";
const entidade = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const id = z.number().int().positive().max(2147483647);
export const moeda41 = z.string().regex(/^(0|[1-9]\d{0,9})\.\d{2}$/);
const texto = (max: number) => z.string().trim().min(1).max(max);
const opcional = (max: number) => texto(max).nullable();
const data41 = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T12:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v;
});
export const criarTelefone41Schema = z.object({
  acao: z.literal('criar'), marca: texto(100), modelo: texto(200), imei: opcional(20), cor: opcional(50), armazenamento: opcional(20),
  custo: moeda41, precoVenda: moeda41, entradaPercentual: moeda41, jurosMensal: moeda41,
  numParcelas: z.number().int().min(1).max(60), dataPrimeiraParcela: data41,
  contaCaixaId: id.nullable(), compradorNome: texto(200), compradorCpf: opcional(14), compradorRg: opcional(20),
  compradorTelefone: opcional(20), compradorEmail: opcional(320), compradorEstadoCivil: opcional(30), compradorProfissao: opcional(100),
  compradorInstagram: opcional(100), compradorCep: opcional(9), compradorCidade: opcional(100), compradorEstado: opcional(2),
  compradorEndereco: opcional(300), compradorLocalTrabalho: opcional(200),
}).strict();
export const receberTelefone41Schema = z.object({ acao: z.literal('receber'), vendaId: entidade, parcelaId: entidade, contaCaixaId: id, valorPago: moeda41 }).strict();
export const cancelarTelefone41Schema = z.object({ acao: z.literal('cancelar'), vendaId: entidade, motivo: texto(500) }).strict();
export const requestTelefone41Schema = z.discriminatedUnion('acao', [criarTelefone41Schema, receberTelefone41Schema, cancelarTelefone41Schema]);
export const intencaoTelefone41Schema = z.object({ idempotencyKey: z.string().uuid(), request: requestTelefone41Schema }).strict();
export type IntencaoTelefone41 = z.infer<typeof intencaoTelefone41Schema>;
export function decimalTelefone41(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 9999999999.99) throw new Error('Valor financeiro inválido');
  return value.toFixed(2);
}
/** Não descarta nem troca intenção incerta: chamadas seguintes recuperam o MESMO request. */
export function prepararIntencaoTelefone41(storage: Pick<Storage,'getItem'|'setItem'>, key: string, request: unknown): IntencaoTelefone41 {
  const old = storage.getItem(key);
  if (old !== null) return intencaoTelefone41Schema.parse(JSON.parse(old));
  const value = intencaoTelefone41Schema.parse({idempotencyKey: crypto.randomUUID(), request});
  storage.setItem(key, JSON.stringify(value));
  return value;
}
