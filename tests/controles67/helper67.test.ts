import { describe, expect, it } from 'vitest';
import { fixture67 } from './fixture67';
import { mapearSnapshot67 } from '../../server/services/snapshot67-reader';
import { agruparClientes67, filtrarLista67, situacaoVencimento67, type Filtros67 } from '../../client/src/lib/emprestimosListaControles67';
import { criarRelatorioLista66 } from '../../client/src/lib/relatorioLista66';
const filtros: Filtros67 = { arquivo: 'todos', busca: '', modalidade: 'todos', statusObrigacao: 'todos', vencimento: 'todos', cobrador: 'todos', etiqueta: 'todos' };
describe('Controles67 apresentação sem clonar objetos financeiros', () => {
  it('ontem/hoje/amanhã e fechamento/arquivo/null/ausência não presumem adimplência', () => {
    const data = mapearSnapshot67(fixture67(),41), item = data.items[0]; if (item.kind !== 'validated') throw Error('fixture');
    for (const [day, state] of [['2026-11-26','atrasados'],['2026-11-27','emdia'],['2026-11-28','emdia']] as const) expect(situacaoVencimento67({ ...item, resumoParcelas: { ...item.resumoParcelas!, proximoVencimento: day } })).toBe(state);
    expect(situacaoVencimento67({ ...item, arquivado: true })).toBe('historico');
    expect(situacaoVencimento67({ ...item, statusObrigacao: 'quitado' })).toBe('historico');
    expect(situacaoVencimento67({ ...item, resumoParcelas: undefined })).toBe('indisponivel');
    expect(situacaoVencimento67({ ...item, resumoParcelas: { ...item.resumoParcelas!, proximoVencimento: null } })).toBe('sem_vencimento');
    expect(situacaoVencimento67({ ...item, resumoParcelas: { ...item.resumoParcelas!, proximoVencimento: '2026-02-30' } })).toBe('indisponivel');
  });
  it('AND de todos filtros com mesmos cards/export/seleção; unknown nunca é oculto', () => {
    const data = mapearSnapshot67(fixture67(),41), before = JSON.stringify(data);
    const items = filtrarLista67(data,{ ...filtros, busca: 'HOMÔNIMO', modalidade: 'mensal', statusObrigacao: 'ativo', vencimento: 'atrasados', cobrador: '7', etiqueta: 'nome:Prioridade' });
    expect(items[0]).toBe(data.items[0]); expect(items[1]).toBe(data.items[1]);
    const r = criarRelatorioLista66(data,items,{ ...filtros, vencimento: 'atrasados', cobrador: 'Cobrador próprio', etiqueta: 'Prioridade', modo: 'pastas' },41);
    expect(r.linhas.map(l => l[0])).toEqual([1,9]); expect(r.cabecalho).toHaveLength(16); expect(r.metadados).toContainEqual(['Modo visual','pastas']);
    expect(filtrarLista67(data,{ ...filtros, cobrador: 'sem', etiqueta: 'sem', busca: 'ninguém' })).toEqual([data.items[1]]);
    expect(JSON.stringify(data)).toBe(before); expect(data.totals.values?.totalReceber).toBe(110);
  });
  it('metadata unavailable não é null confirmado nem lista vazia de etiquetas', () => {
    const f=fixture67(); f.organizacao67.contratos[0].cobrador={ state:'unavailable' }; f.organizacao67.contratos[0].etiquetas={ state:'unavailable' };
    const data=mapearSnapshot67(f,41); expect(filtrarLista67(data,{ ...filtros,cobrador:'sem' })).toEqual([data.items[1]]); expect(filtrarLista67(data,{ ...filtros,etiqueta:'sem' })).toEqual([data.items[1]]);
  });
  it('pastas por clienteId separam homônimos, referências intactas e unknown fora', () => {
    const data=mapearSnapshot67(fixture67(),41), first=data.items[0]; if(first.kind!=='validated') throw Error('fixture');
    const other={ ...first,id:2,clienteId:8 }; const groups=agruparClientes67([first,other,data.items[1]]);
    expect(groups.map(g=>g.clienteId)).toEqual([2,8]); expect(groups[0].items[0]).toBe(first); expect(groups[1].items[0]).toBe(other); expect(groups.flatMap(g=>g.items)).not.toContain(data.items[1]);
  });
});
