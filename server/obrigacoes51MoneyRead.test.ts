import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { projection51, proposta51, money51 } from '../shared/obrigacoes51';
import { centavos51, validarProjecao51 } from '../shared/obrigacoes51Projection';

const projection = (value: string) => ({
  versao: 'obrigacoes51_v1', userId: 1, contratoId: 960,
  statusObrigacao: 'ativo', arquivado: false, obrigacaoAdicional: '0.00',
  parcelas: [{ parcelaId: 960001, statusFinanceiroOriginal: 'pendente',
    statusObrigacao: 'aberta', obrigacaoAtual: value, componenteAdicional: '0.00', arquivada: false }],
});

it('leitura51 conserva o máximo NUMERIC15 textual sem float nem zeros fabricados', () => {
  const p = projection('9999999999999.99');
  expect(projection51.parse(p)).toEqual(p);
  expect(validarProjecao51(p, 1, 960, [960001])).toEqual(p);
  expect(centavos51('9999999999999.99')).toBe(999999999999999n);
});

it.each(['99999999999999.99', '1.001', '1e3', '-1.00', '01.00', 'NaN', 'Infinity'])('leitura51 recusa valor inválido %s sem coerção', value => {
  expect(projection51.safeParse(projection(value)).success).toBe(false);
  expect(() => centavos51(value)).toThrow();
});

it('novos writers51 continuam NUMERIC12; leitura15 não amplia propostas', () => {
  expect(money51.safeParse('9999999999.99').success).toBe(true);
  expect(money51.safeParse('9999999999999.99').success).toBe(false);
  for (const proposal of [
    { acao: 'editar', parcelaId: 1, novoValor: '9999999999999.99' },
    { acao: 'adicionar', valor: '9999999999999.99', dataVencimento: '2027-03-10', classificacao: 'obrigacao_adicional_nao_desembolsada' },
    { acao: 'quitar', contaCaixaId: 1, valorRecebido: '9999999999999.99', reconhecoDinheiroReal: true },
  ]) expect(proposta51.safeParse(proposal).success).toBe(false);
});

it('SQL51 usa serialização15 e validador somente leitura sem alterar registrada dos writers', () => {
  const sql = readFileSync(new URL('../drizzle/0051_composicao_obrigacoes.sql', import.meta.url), 'utf8');
  const state = /CREATE FUNCTION obrigacoes51\.estado\([\s\S]*?END \$\$;/.exec(sql)![0];
  expect(state).toContain('v:=obrigacoes51.registrada_leitura(p)');
  expect(state).not.toContain('numeric(12,2)');
  expect(state).toContain('numeric(15,2)');
  const writer = /CREATE FUNCTION obrigacoes51\.registrada\([\s\S]*?END \$\$;/.exec(sql)![0];
  expect(writer).toContain('public.multimodal_moeda');
  expect(writer).not.toContain('moeda_leitura');
});
