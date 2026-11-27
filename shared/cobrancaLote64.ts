import { z } from 'zod';

export const tipo64Schema = z.enum(['atraso', 'preventivo', 'vence_hoje']);
export type Tipo64 = z.infer<typeof tipo64Schema>;
export const contratoIds64Schema = z.array(z.number().int().min(1).max(2147483647))
  .min(1).max(20).refine(ids => new Set(ids).size === ids.length, 'Contratos repetidos.');
export const preparar64Schema = z.object({ contratoIds: contratoIds64Schema, tipo: tipo64Schema }).strict();
export const conferir64Schema = preparar64Schema;
export const enviar64Schema = z.object({ token: z.string().min(1).max(16000), confirmar: z.literal(true) }).strict();
export const resultado64Schema = z.object({
  contratoId: z.number().int().min(1).max(2147483647),
  status: z.enum(['aceito_evolution', 'entregue', 'lido', 'nao_solicitado', 'desconhecido', 'em_processamento', 'ignorado']),
  motivo: z.string(), providerMessageId: z.string().nullable(), outboxId: z.string().nullable(),
}).strict();
export const previewItem64Schema = z.object({
  contratoId: z.number().int().min(1).max(2147483647), clienteNome: z.string().nullable(),
  contatoMascarado: z.string().nullable(), mensagem: z.string().nullable(), token: z.string().max(16000).nullable(),
  estado: z.enum(['pronto', 'ignorado', 'registrado']), motivo: z.string(), registro: resultado64Schema.optional(),
}).strict();
export const preview64Schema = z.object({
  userId: z.number().int().min(1).max(2147483647), dataReferencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(previewItem64Schema).min(1).max(20),
}).strict();
export type Preparar64 = z.infer<typeof preparar64Schema>;
export type Resultado64 = z.infer<typeof resultado64Schema>;
export type PreviewItem64 = z.infer<typeof previewItem64Schema>;
export type Preview64 = z.infer<typeof preview64Schema>;
