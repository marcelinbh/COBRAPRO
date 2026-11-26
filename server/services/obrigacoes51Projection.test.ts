import { describe, expect, it } from 'vitest';
import { validarProjecao51 } from '../../shared/obrigacoes51Projection';
import { lerProjecaoVinculada51, lerEstadoVinculado51, lerCobrancaExigivel51 } from './obrigacoes51Leitura';
import { listarEmprestimosSeguros } from './emprestimosListaSegura';
import { listarParcelasEfetivas51 } from './parcelas51Leitura';
import { apresentarEmprestimo } from './emprestimosApresentacao';
import { resumirCarteiraDashboard } from '../../shared/dashboardPortfolio';
import { abertoCentavosRelatorio } from '../../shared/reporting';
import { projection51Test, source51Test, contract51Test, parcel51Test } from './projection51TestSource';
const today = '2026-11-26';
const metadata = [{ id: 3, user_id: 41, contrato_id: 1, cliente_id: 2 }];
describe('Leitores51 funcionais, sem DB/env/router imports', () => {
  it('RPC acontece só após metadados próprios, reconfere IDs e estado; não escreve', async () => {
    const f = source51Test();
    const p = await lerEstadoVinculado51(f, 41, 1);
    expect(p).toEqual(projection51Test());
    expect(f.rpcCalls).toEqual(Array.from({ length: 2 }, () => ({ name: 'rpc_estado_obrigacoes51', args: { p_user_id: 41, p_contrato_id: 1 } })));
    const first = f.events.findIndex(e => e.startsWith('RPC:'));
    expect(f.events.slice(0, first)).toEqual([
      'REST:contratos:id, user_id, cliente_id', 'REST:clientes:id, user_id', 'REST:parcelas:id, user_id, contrato_id, cliente_id',
    ]);
    expect(f.events.slice(first + 1, -1)).toContain('REST:parcelas:id, user_id, contrato_id, cliente_id');
  });
  it.each([99, null, undefined])('owner metadado %s rejeita antes da RPC', async owner => {
    const f = source51Test();
    await expect(lerProjecaoVinculada51(f, 41, 1, [{ ...metadata[0], user_id: owner }], async () => metadata)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(f.rpcCalls).toHaveLength(0);
  });
  it.each([null, undefined, 0])('ID %s rejeita antes da RPC', async id => {
    const f = source51Test();
    await expect(lerProjecaoVinculada51(f, 41, 1, [{ ...metadata[0], id }], async () => metadata)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(f.rpcCalls).toHaveLength(0);
  });
  it.each(['null', 'owner', 'parent', 'missing', 'duplicate', 'extra', 'money', 'totalA'])('prova %s não vira zero nem conjunto parcial', async kind => {
    const f = source51Test(), p = projection51Test();
    if (kind === 'owner') p.userId = 99;
    if (kind === 'parent') p.contratoId = 99;
    if (kind === 'missing') p.parcelas = [];
    if (kind === 'duplicate') p.parcelas.push({ ...p.parcelas[0] });
    if (kind === 'extra') p.parcelas[0].parcelaId = 99;
    if (kind === 'money') p.parcelas[0].obrigacaoAtual = '0';
    if (kind === 'totalA') p.obrigacaoAdicional = '1.00';
    f.setResponse(kind === 'null' ? null : p);
    await expect(lerEstadoVinculado51(f, 41, 1)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('RPC error, timeout e ausência de módulo não oferecem fallback', async () => {
    for (const client of [
      { rpc: async () => ({ data: null, error: { code: 'PGRST202' } }) },
      { rpc: async () => ({ data: null, error: { code: '42883' } }) },
      { rpc: async () => { throw new Error('timeout'); } },
      { rpc: async () => ({ data: projection51Test(), error: null, status: 503 }) },
    ]) await expect(lerProjecaoVinculada51(client, 41, 1, metadata, async () => metadata)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('adição de irmã na reconferência e alteração entre RPCs invalidam tudo', async () => {
    const f = source51Test();
    await expect(lerProjecaoVinculada51(f, 41, 1, metadata, async () => [...metadata, { ...metadata[0], id: 4 }])).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    const g = source51Test(); g.setOnRpc(n => { if (n === 2) { const p = projection51Test(); p.parcelas[0].obrigacaoAtual = '111.00'; g.setResponse(p); } });
    await expect(lerEstadoVinculado51(g, 41, 1)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('getters na prova não são executados', () => {
    const p = projection51Test(); let accessed = false;
    Object.defineProperty(p, 'userId', { enumerable: true, get() { accessed = true; return 41; } });
    expect(() => validarProjecao51(p, 41, 1, [3])).toThrow(); expect(accessed).toBe(false);
  });
  it('cancelamento de irmã conserva paga; dívida atual zero não fabrica quitação', async () => {
    const p = projection51Test(); p.statusObrigacao = 'encerrado_por_cancelamento';
    p.parcelas[0] = { ...p.parcelas[0], statusFinanceiroOriginal: 'parcial', statusObrigacao: 'cancelada', obrigacaoAtual: '0.00' };
    p.parcelas.push({ parcelaId: 4, statusFinanceiroOriginal: 'paga', statusObrigacao: 'paga', obrigacaoAtual: '0.00', componenteAdicional: '0.00', arquivada: false });
    const rows = [{ ...parcel51Test, status: 'parcial', valor_pago: '30.00', saldo_residual: '80.00' }, { ...parcel51Test, id: 4, status: 'paga', valor_pago: '110.00' }];
    const view = apresentarEmprestimo(contract51Test, rows, today, 100, 10, null, p);
    expect(view).toMatchObject({ status: 'encerrado_por_cancelamento', statusFinanceiroOriginal: 'ativo', obrigacaoAtual: '0.00', totalReceber: 0, totalPago: 140, parcelasPagas: 1 });
    expect(view.todasParcelas.map(r => r.status)).toEqual(['cancelada', 'paga']);
    expect(rows[0].status).toBe('parcial'); expect(rows[0].valor_pago).toBe('30.00');
    const f = source51Test(p); f.tables.parcelas = rows;
    const list = await listarEmprestimosSeguros(f, 41, today);
    expect(list.items[0]).toMatchObject({ status: 'encerrado_por_cancelamento', statusFinanceiroOriginal: 'ativo', totalReceber: 0, totalPago: 140, capital: 100 });
    expect(list.totals.values).toEqual({ capital: 100, totalReceber: 0, totalPago: 140 });
    expect((await lerCobrancaExigivel51(f, 41, 3, 2)).exigivel).toBe(false);
  });
  it('contradição SQL atual: paga sob encerramento não pode ser cancelada', () => {
    const p = projection51Test(); p.statusObrigacao = 'encerrado_por_cancelamento';
    p.parcelas[0] = { ...p.parcelas[0], statusFinanceiroOriginal: 'paga', statusObrigacao: 'cancelada', obrigacaoAtual: '0.00' };
    expect(() => validarProjecao51(p, 41, 1, [3])).toThrow();
  });
  it('quitação verdadeira mantém histórico e arquivo acessível, não oculta dívida como paga', async () => {
    const p = projection51Test(); p.statusObrigacao = 'quitado'; p.arquivado = true;
    p.parcelas[0] = { ...p.parcelas[0], statusFinanceiroOriginal: 'paga', statusObrigacao: 'paga', obrigacaoAtual: '0.00', arquivada: true };
    const f = source51Test(p); f.tables.parcelas[0].status = 'paga'; f.tables.parcelas[0].valor_pago = '110.00';
    expect(await listarParcelasEfetivas51(f, 41, {}, today)).toEqual([]);
    const history = await listarParcelasEfetivas51(f, 41, { arquivo: 'historico' }, today);
    expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ status: 'paga', arquivada: true, valorPago: '110.00', obrigacaoAtual: '0.00' });
    const archivedOpen = projection51Test(); archivedOpen.parcelas[0].arquivada = true;
    const view = apresentarEmprestimo(contract51Test, [parcel51Test], today, 0, 0, null, archivedOpen);
    expect(view.status).toBe('ativo'); expect(view.obrigacaoAtual).toBe('110.00'); expect(view.totalReceber).toBe(0);
    expect(view.todasParcelas[0].status).toBe('vencendo_hoje');
  });
  it('A não muda principal nem lucro; recebimento de A preservado e excluído da estimativa', () => {
    const p = projection51Test(); p.statusObrigacao = 'quitado'; p.obrigacaoAdicional = '50.00';
    p.parcelas[0] = { ...p.parcelas[0], statusFinanceiroOriginal: 'paga', statusObrigacao: 'paga', obrigacaoAtual: '0.00' };
    p.parcelas.push({ parcelaId: 4, statusFinanceiroOriginal: 'paga', statusObrigacao: 'paga', obrigacaoAtual: '0.00', componenteAdicional: '50.00', arquivada: false });
    const rows = [{ ...parcel51Test, status: 'paga', valor_pago: '110.00' }, { ...parcel51Test, id: 4, status: 'paga', valor_original: '50.00', valor_juros: '0.00', valor_pago: '50.00' }];
    const view = apresentarEmprestimo(contract51Test, rows, today, 0, 0, null, p);
    expect(view).toMatchObject({ totalPago: 160, lucroRealizado: 10, adicionalRecebido: 50, obrigacaoAdicional: '50.00' });
    expect(contract51Test.valor_principal).toBe('100.00');
    const open = projection51Test(); open.obrigacaoAdicional = '50.00'; open.parcelas[0].componenteAdicional = '50.00'; open.parcelas[0].obrigacaoAtual = '50.00';
    const a = { ...parcel51Test, valor_original: '50.00', valor_juros: '40.00' };
    expect(apresentarEmprestimo(contract51Test, [a], today, 0, 0, null, open)).toMatchObject({ totalReceber: 50, lucroPrevisto: 0, valorJurosParcela: 0 });
  });
  it('dashboard/relatórios não somam base REST novamente nem contam A como juros', () => {
    const row = { status: 'parcial', valorOriginal: '999.00', saldoResidual: '999.00', valorMulta: '99.00', valorJuros: '50.00', dataVencimento: '2026-11-20', obrigacaoAtual: '40.00', componenteAdicional: '50.00', clienteId: 2 };
    expect(resumirCarteiraDashboard([row], today)).toMatchObject({ totalReceber: 40, totalInadimplente: 40, jurosPendentes: 0 });
    expect(abertoCentavosRelatorio(row)).toBe(4000);
  });
});
