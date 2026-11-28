import { describe, expect, it } from 'vitest';
import { parsePrecoCentavos, parseEstoque, validarProdutoForm, catalogoPertenceAoOwner, MAX_PRECO_CENTAVOS } from './vendasProdutoForm';

describe('vendasProdutoForm — funções puras', () => {
  it.each([
    ['1234,56',123456], ['1234.56',123456], ['1.234,56',123456], ['12.345.678,90',1234567890],
    ['0,01',1], ['1',100], ['1,2',120], [' 1234,56 ',123456], ['0001.05',105],
    ['9999999999999,99',MAX_PRECO_CENTAVOS], ['9.999.999.999.999,99',MAX_PRECO_CENTAVOS],
  ] as const)('preço completo %s => %s centavos', (input, expected) => expect(parsePrecoCentavos(input)).toBe(expected));
  it.each(['',' ','0','0,00','-1','+1','1e3','1E2','NaN','Infinity','123reais','R$ 123,45','123,45 reais','1 234,56','1.234','1.234.56','12.34,56','1,234.56','1,234','0.001','0,001','.50',',50','1.','1,','1\n2','10000000000000','10000000000000,00','9999999999999,999'])('rejeita preço sem coerção/arredondamento %j', input => expect(parsePrecoCentavos(input)).toBeNull());
  it.each([['0',0],['2',2],[' 12 ',12],['00012',12],['2147483647',2147483647]] as const)('estoque inteiro %s', (input, expected) => expect(parseEstoque(input)).toBe(expected));
  it.each(['',' ','-1','+1','1.1','1,1','1e2','NaN','Infinity','abc','2x','2147483648','99999999999999999999'])('rejeita estoque %j', input => expect(parseEstoque(input)).toBeNull());
  it('nome usa trim e limite exatamente 255; preco continua number e imutável', () => {
    const valid = validarProdutoForm({ nome: ` ${'a'.repeat(255)} `, descricao: '', preco: '9999999999999,99', estoque: '0' });
    expect(valid.ok).toBe(true);
    if (valid.ok) { expect(valid.input.nome).toHaveLength(255); expect(valid.input.preco).toBe(9999999999999.99); expect(typeof valid.input.preco).toBe('number'); expect(Object.isFrozen(valid.input)).toBe(true); }
    expect(validarProdutoForm({ nome: 'a'.repeat(256), descricao: '', preco: '1', estoque: '0' }).ok).toBe(false);
    expect(validarProdutoForm({ nome: ' \t ', descricao: '', preco: '1', estoque: '0' }).ok).toBe(false);
  });
  it('checker aceita exclusivamente owner exato em rows raw ou camel, não filtra subconjunto', () => {
    expect(catalogoPertenceAoOwner([{user_id:101}],101)).toBe(true);
    expect(catalogoPertenceAoOwner([{userId:101}],101)).toBe(true);
    expect(catalogoPertenceAoOwner([{userId:101,user_id:101}],101)).toBe(true);
    expect(catalogoPertenceAoOwner([{userId:101,user_id:202}],101)).toBe(false);
    expect(catalogoPertenceAoOwner([{userId:101},{userId:202}],101)).toBe(false);
    expect(catalogoPertenceAoOwner([{user_id:'101'}],101)).toBe(false);
    expect(catalogoPertenceAoOwner([{}],101)).toBe(false);
    expect(catalogoPertenceAoOwner([null],101)).toBe(false);
    expect(catalogoPertenceAoOwner(undefined,101)).toBe(false);
    expect(catalogoPertenceAoOwner([],101)).toBe(true);
  });
});
