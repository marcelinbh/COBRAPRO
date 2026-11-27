import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { listarEmprestimosSnapshot60, mapearSnapshot60, RPC60 } from './snapshot60-reader';

const OWNER = 41;
const TODAY = '2026-11-27';
const fixture = () => ({ versao: 'lista_emprestimos60_v1', userId: OWNER, dataCalculo: TODAY, configuracoes: [], items: [{
  kind: 'validated', id: 1,
  contrato: { id: 1, user_id: OWNER, cliente_id: 2, koletor_id: null, modalidade: 'mensal', status: 'ativo', valor_principal: '100.00' },
  cliente: { id: 2, user_id: OWNER, nome: 'Cliente sintético63' },
  parcelas: [{ id: 3, user_id: OWNER, contrato_id: 1, cliente_id: 2, numero_parcela: 1,
    valor_original: '110.00', valor_juros: '10.00', valor_pago: '0.00', valor_multa: '0.00', multa_manual: '0.00', saldo_residual: '0.00',
    data_vencimento: '2027-01-10', data_pagamento: null, status: 'pendente' }],
  estado51: { versao: 'obrigacoes51_v1', userId: OWNER, contratoId: 1, statusObrigacao: 'ativo', arquivado: false, obrigacaoAdicional: '0.00',
    parcelas: [{ parcelaId: 3, statusFinanceiroOriginal: 'pendente', statusObrigacao: 'aberta', obrigacaoAtual: '110.00', componenteAdicional: '0.00', arquivada: false }] },
  cotacoes36: null,
}] });
const summary = (f: ReturnType<typeof fixture>) => (mapearSnapshot60(f, OWNER).items[0] as any).resumoParcelas;
const expected = { total: 1, abertas: 1, pagas: 0, canceladas: 0, transferidas: 0, arquivadas: 0, proximoVencimento: '2027-01-10', dataReferencia: TODAY };

function append(f: ReturnType<typeof fixture>, id: number, date: string, kind: 'aberta' | 'paga' | 'cancelada' | 'transferida', archived = false) {
  const item = f.items[0], physical: any = structuredClone(item.parcelas[0]), proof: any = structuredClone(item.estado51.parcelas[0]);
  physical.id = proof.parcelaId = id;
  physical.numero_parcela = id;
  physical.data_vencimento = date;
  physical.status = proof.statusFinanceiroOriginal = kind === 'paga' ? 'paga' : kind === 'transferida' ? 'renovada' : 'pendente';
  physical.valor_pago = kind === 'paga' ? '110.00' : '0.00';
  physical.data_pagamento = kind === 'paga' ? TODAY : null;
  proof.statusObrigacao = kind;
  proof.obrigacaoAtual = kind === 'aberta' ? '110.00' : '0.00';
  proof.arquivada = archived;
  item.parcelas.push(physical); item.estado51.parcelas.push(proof);
}

describe('Cards63: resumo da mesma projeção validada60/51, sem novas leituras', () => {
  it('expõe resumo de uma parcela genuinamente aberta e DATE civil', () => {
    const f = fixture(), before = JSON.stringify(f), result = mapearSnapshot60(f, OWNER);
    expect((result.items[0] as any).resumoParcelas).toEqual(expected);
    expect(result.totals.values).toEqual({ capital: 100, totalReceber: 110, totalPago: 0 });
    expect(JSON.stringify(f)).toBe(before);
  });
  it('usa o menor vencimento aberto mesmo com registros fora de ordem', () => {
    const f = fixture(); append(f, 8, '2026-12-10', 'aberta'); append(f, 7, '2026-12-05', 'aberta');
    f.items[0].parcelas.reverse(); f.items[0].estado51.parcelas.reverse();
    expect(summary(f)).toEqual({ ...expected, total: 3, abertas: 3, proximoVencimento: '2026-12-05' });
  });
  it('um vencimento já passado continua sendo o primeiro aberto, não vira uma data futura fictícia', () => {
    const f = fixture(); f.items[0].parcelas[0].data_vencimento = '2026-11-26';
    expect(summary(f)).toEqual({ ...expected, proximoVencimento: '2026-11-26' });
  });
  it('vencimento de hoje mantém exatamente a referência do snapshot', () => {
    const f = fixture(); f.items[0].parcelas[0].data_vencimento = TODAY;
    expect(summary(f)).toEqual({ ...expected, proximoVencimento: TODAY });
  });
  it('parcial com residual comprovado conta aberta, não paga', () => {
    const f = fixture(), item = f.items[0];
    item.parcelas[0].status = item.estado51.parcelas[0].statusFinanceiroOriginal = 'parcial';
    item.parcelas[0].valor_pago = '20.00'; item.parcelas[0].saldo_residual = '90.00'; item.parcelas[0].data_pagamento = TODAY as any;
    item.estado51.parcelas[0].obrigacaoAtual = '90.00';
    expect(summary(f)).toEqual(expected);
    expect(mapearSnapshot60(f, OWNER).totals.values).toEqual({ capital: 100, totalReceber: 90, totalPago: 20 });
  });
  it('conta pagamento real antes de cancelamento de irmã sem confundir transferência com recebimento', () => {
    const f = fixture(); append(f, 4, '2026-10-01', 'paga'); append(f, 5, '2026-09-01', 'cancelada'); append(f, 6, '2026-08-01', 'transferida');
    expect(summary(f)).toEqual({ ...expected, total: 4, pagas: 1, canceladas: 1, transferidas: 1 });
    expect(mapearSnapshot60(f, OWNER).totals.values).toEqual({ capital: 100, totalReceber: 110, totalPago: 110 });
  });
  it('cancelada com status físico antigo pendente não vira obrigação em aberto nem pagamento', () => {
    const f = fixture(), item = f.items[0];
    item.estado51.statusObrigacao = 'encerrado_por_cancelamento'; item.estado51.parcelas[0].statusObrigacao = 'cancelada'; item.estado51.parcelas[0].obrigacaoAtual = '0.00';
    expect(summary(f)).toEqual({ ...expected, abertas: 0, canceladas: 1, proximoVencimento: null });
    expect(mapearSnapshot60(f, OWNER).totals.values!.totalPago).toBe(0);
  });
  it('quitada só por paga real conserva o histórico sem próximo vencimento', () => {
    const f = fixture(), item = f.items[0];
    item.parcelas[0].status = item.estado51.parcelas[0].statusFinanceiroOriginal = 'paga'; item.parcelas[0].valor_pago = '110.00'; item.parcelas[0].data_pagamento = TODAY as any;
    item.estado51.statusObrigacao = 'quitado'; item.estado51.parcelas[0].statusObrigacao = 'paga'; item.estado51.parcelas[0].obrigacaoAtual = '0.00';
    expect(summary(f)).toEqual({ ...expected, abertas: 0, pagas: 1, proximoVencimento: null });
  });
  it('origem transferida não é parcela paga ou próximo vencimento', () => {
    const f = fixture(), item = f.items[0];
    item.parcelas[0].status = item.estado51.parcelas[0].statusFinanceiroOriginal = 'renovada';
    item.estado51.statusObrigacao = 'quitado'; item.estado51.parcelas[0].statusObrigacao = 'transferida'; item.estado51.parcelas[0].obrigacaoAtual = '0.00';
    expect(summary(f)).toEqual({ ...expected, abertas: 0, transferidas: 1, proximoVencimento: null });
    expect(mapearSnapshot60(f, OWNER).totals.values!.totalPago).toBe(0);
  });
  it('arquivada permanece atributo independente da classificação paga', () => {
    const f = fixture(); append(f, 4, '2026-10-01', 'paga', true);
    expect(summary(f)).toEqual({ ...expected, total: 2, pagas: 1, arquivadas: 1 });
  });
  it('aberta arquivada não entra em vencimento ou cobrança operacional', () => {
    const f = fixture(); f.items[0].estado51.parcelas[0].arquivada = true;
    expect(summary(f)).toEqual({ ...expected, arquivadas: 1, proximoVencimento: null });
  });
  it('arquivo do contrato preserva as contagens históricas e suprime o próximo vencimento', () => {
    const f = fixture(); f.items[0].estado51.arquivado = true; f.items[0].estado51.parcelas[0].arquivada = true;
    expect(summary(f)).toEqual({ ...expected, arquivadas: 1, proximoVencimento: null });
  });
  it('obrigação adicional A continua parcela sem compor capital novamente', () => {
    const f = fixture(); f.items[0].estado51.obrigacaoAdicional = f.items[0].estado51.parcelas[0].componenteAdicional = '110.00';
    expect(summary(f)).toEqual(expected); expect(mapearSnapshot60(f, OWNER).totals.values!.capital).toBe(100);
  });
  it.each(['mensal', 'tabela_price', 'semanal', 'legado'])('não reconstrói calendário pela modalidade %s', modalidade => {
    const f = fixture(); f.items[0].contrato.modalidade = modalidade; expect(summary(f)).toEqual(expected);
  });
  it('zero parcelas confirmado é zero real, não dívida sintetizada', () => {
    const f = fixture(); f.items[0].parcelas = []; f.items[0].estado51.parcelas = []; f.items[0].estado51.statusObrigacao = 'quitado';
    expect(summary(f)).toEqual({ ...expected, total: 0, abertas: 0, proximoVencimento: null });
  });
  it('datas de fechado e de arquivo não antecipam a próxima parcela aberta', () => {
    const f = fixture(); append(f, 4, '2026-01-01', 'paga'); append(f, 5, '2026-02-01', 'cancelada'); append(f, 6, '2026-03-01', 'transferida'); append(f, 7, '2026-04-01', 'aberta', true);
    expect(summary(f)).toEqual({ ...expected, total: 5, abertas: 2, pagas: 1, canceladas: 1, transferidas: 1, arquivadas: 1 });
  });
  it('resultado não expõe IDs de parcelas, cotação, conta, contato ou seleção financeira no resumo', () => {
    expect(Object.keys(summary(fixture())).sort()).toEqual(Object.keys(expected).sort());
    expect(JSON.stringify(summary(fixture()))).not.toMatch(/parcelaId|contaCaixaId|telefone|estadoHash|UUID|cotacao/);
  });
  it('placeholder continua com exatamente três campos e nenhum resumo', () => {
    const f: any = fixture(); f.items = [{ kind: 'unavailable', id: 42, reason: 'local_link_unconfirmed' }];
    const result = mapearSnapshot60(f, OWNER); expect(Object.keys(result.items[0]).sort()).toEqual(['id','kind','message']);
    expect(result.totals.values).toBeNull(); expect((result.items[0] as any).resumoParcelas).toBeUndefined();
  });
  it('recusa resumo injetado no snapshot em vez de aceitá-lo como prova', () => {
    const f: any = fixture(); f.items[0].resumoParcelas = expected;
    expect(() => mapearSnapshot60(f, OWNER)).toThrow();
  });
  it.each(['root', 'contrato', 'cliente', 'parcela', 'estado51'])('owner %s divergente não expõe resumo ou novos dados', field => {
    const f: any = fixture(); if (field === 'root') f.userId = 99;
    else if (field === 'parcela') f.items[0].parcelas[0].user_id = 99;
    else if (field === 'estado51') f.items[0].estado51.userId = 99;
    else f.items[0][field].user_id = 99;
    expect(() => mapearSnapshot60(f, OWNER)).toThrow();
  });
  it.each(['2026-02-30', '2026-13-01', '2026-11-27T00:00:00Z', null])('DATE inválida %j não ganha resumo ou data inventada', day => {
    const f: any = fixture(); f.items[0].parcelas[0].data_vencimento = day;
    expect(() => mapearSnapshot60(f, OWNER)).toThrow();
  });
  it('requisição normal continua uma únicaRPC do mesmo owner e nenhum REST por card', async () => {
    const rpc = vi.fn(async () => ({ data: fixture(), error: null, status: 200 }));
    const from = vi.fn(() => { throw Error('query adicional proibida'); });
    const client = { rpc, from };
    const result = await listarEmprestimosSnapshot60(client, OWNER);
    expect((result.items[0] as any).resumoParcelas).toEqual(expected);
    expect(rpc.mock.calls).toEqual([[RPC60, { p_user_id: OWNER }]]); expect(from).not.toHaveBeenCalled();
  });
  it('prefixo de retry61 permanece com a allowlist nativa57014 e limite existente', () => {
    const src = readFileSync(new URL('./snapshot60-reader.ts', import.meta.url), 'utf8');
    const tail = src.slice(src.indexOf('const statementTimeout60'));
    expect(tail).toContain("code: z.literal('57014')"); expect(tail).toContain('setTimeout(resolve, 250)');
    expect(tail.match(/fetchSnapshot60\(client, owner as number\)/g)).toHaveLength(2);
  });
});
