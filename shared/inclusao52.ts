import {z} from 'zod';
export const capacidadeInclusao52=z.object({
 versao:z.literal('inclusao52_v1'),predecessor:z.literal('obrigacoes51_v1'),disponivel:z.literal(true),
 coortes:z.tuple([z.literal('prospectivo21_mensal'),z.literal('multimodal35_semanal'),z.literal('multimodal35_quinzenal'),z.literal('multimodal35_diario'),z.literal('legado34_mensal_estrito')]),
 classificacao:z.literal('obrigacao_adicional_nao_desembolsada'),caixaPreservado:z.literal(true),
}).strict();
export type CapacidadeInclusao52=z.infer<typeof capacidadeInclusao52>;
export function capacidadeInclusaoUi52(value:unknown):boolean{return capacidadeInclusao52.safeParse(value).success;}
