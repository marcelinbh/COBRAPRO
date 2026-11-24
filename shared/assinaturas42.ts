import { z } from "zod";
const id = z.number().int().positive().max(2147483647);
export const valorAssinatura42 = z.string().regex(/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/).refine(v => BigInt(v.replace('.', '')) > BigInt(0));
export const pagamentoAssinatura42Schema = z.object({
  assinaturaId: id, clienteId: id, contaCaixaId: id,
  valorPago: valorAssinatura42,
  mesReferencia: z.string().regex(/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/),
  observacoes: z.string().max(2000).nullable(),
  idempotencyKey: z.string().uuid(),
}).strict();
export type PagamentoAssinatura42 = z.infer<typeof pagamentoAssinatura42Schema>;
export const resultadoAssinatura42Schema = z.object({
  success: z.literal(true), regra: z.literal('assinaturas42_v1'), repetida: z.boolean(),
  operationId: z.string().uuid(), idempotencyKey: z.string().uuid(),
  assinaturaId: id, clienteId: id, contaCaixaId: id,
  pagamentoId: z.string().regex(/^[1-9][0-9]*$/), transacaoCaixaId: z.string().regex(/^[1-9][0-9]*$/),
  valorPago: valorAssinatura42, mesReferencia: z.string(),
  vigenciaAte: z.string().regex(/^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/),
  status: z.literal('ativa'),
}).strict();
export function confirmarResultadoAssinatura42(value: unknown, input: PagamentoAssinatura42) {
  const result = resultadoAssinatura42Schema.parse(value);
  for (const key of ['assinaturaId', 'clienteId', 'contaCaixaId', 'valorPago', 'mesReferencia', 'idempotencyKey'] as const) {
    if (result[key] !== input[key]) throw new Error('Confirmação divergente da intenção preservada.');
  }
  return result;
}
/** Sem arredondamento: aceita somente centavos representáveis no formulário. */
export function decimalFormularioAssinatura42(value: string): string {
  if (!/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(value)) throw new Error('Informe um valor com até duas casas decimais.');
  const [inteiro, casas = ''] = value.split('.');
  return valorAssinatura42.parse(`${inteiro}.${casas.padEnd(2, '0')}`);
}

const requestAssinatura42Schema = pagamentoAssinatura42Schema.omit({ idempotencyKey: true });
export const conferenciaAssinatura42Schema = z.discriminatedUnion('estado', [
  z.object({ estado: z.literal('confirmed'), regra: z.literal('assinaturas42_fence_v1'), resultado: resultadoAssinatura42Schema }).strict(),
  z.object({ estado: z.literal('fenced'), regra: z.literal('assinaturas42_fence_v1'), idempotencyKey: z.string().uuid(), request: requestAssinatura42Schema }).strict(),
]);
export type ConferenciaAssinatura42 = z.infer<typeof conferenciaAssinatura42Schema>;
export function confirmarConferenciaAssinatura42(value: unknown, entrada: PagamentoAssinatura42): ConferenciaAssinatura42 {
  const input = pagamentoAssinatura42Schema.parse(entrada);
  const proof = conferenciaAssinatura42Schema.parse(value);
  if (proof.estado === 'confirmed') confirmarResultadoAssinatura42(proof.resultado, input);
  else {
    if (proof.idempotencyKey !== input.idempotencyKey) throw new Error('Fence de outra intenção.');
    const { idempotencyKey: _, ...request } = input;
    if (JSON.stringify(proof.request) !== JSON.stringify(requestAssinatura42Schema.parse(request))) throw new Error('Fence com payload divergente.');
  }
  return proof;
}
