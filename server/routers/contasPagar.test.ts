import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { contasPagarRouter, marcarElegibilidade } from './contasPagar';
import { DespesasIntentStore, diaCivilBrt, dinheiroDespesa, moedaDespesa, criarDespesaInput, pagarDespesaInput, estornarDespesaInput } from '../../shared/despesasIntent';

const mocked = vi.hoisted(() => ({ cliente: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: mocked.cliente }));
const key = '00000000-0000-4000-8000-000000000001';
const createOp = '00000000-0000-4000-8000-000000000002';
const payOp = '00000000-0000-4000-8000-000000000003';
const reverseOp = '00000000-0000-4000-8000-000000000004';
const caller = (userId = 1) => contasPagarRouter.createCaller({ user: { id: userId } as any, req: {} as any, res: {} as any });
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function pgText(v: any): string {
  if (!v || typeof v !== 'object') return JSON.stringify(v);
  return '{'+Object.keys(v).sort((a, b) => Buffer.byteLength(a)-Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b))).map(k => JSON.stringify(k)+': '+(k === 'valor' ? String(v[k]) : pgText(v[k]))).join(', ')+'}';
}
function op(tipo: string, opId: string, payload: any, auditoria: any, resultado: any) {
  const payloadTexto = pgText(payload);
  const hash = createHash('sha256').update(`{"tipo": "${tipo}", "userId": 1, "payload": ${payloadTexto}}`).digest('hex');
  return { id: opId, user_id: 1, chave_idempotencia: key, tipo, payload, payloadTexto, hash_payload: '\\x'+hash, auditoria, resultado: { success: true, acao: tipo, operationId: opId, chaveIdempotencia: key, userId: 1, despesaId: 9, ...resultado } };
}
function proveniencia(valor = '10.01', txId: number | string = '9007199254740993') {
  const d = { id: 9, user_id: 1, descricao: 'Água e energia "valor": 12.00', categoria: 'outros', valor, status: 'pendente', data_vencimento: '2026-11-08', data_pagamento: null, conta_caixa_id: null, recorrente: false, frequencia: null, observacoes: null, createdAt: '2026-11-08T12:00:00+00:00', updatedAt: '2026-11-08T12:00:00+00:00' };
  const origem = { despesa_id: 9, user_id: 1, operacao_id: createOp, snapshot: copy(d) };
  const cria = op('criar', createOp, { descricao: d.descricao, categoria: 'outros', valor, dataVencimento: d.data_vencimento, observacoes: null }, { antes: null, depois: copy(d), origemOperationId: createOp, saida: null, estorno: null, motivo: null }, { status: 'pendente', valor, dataVencimento: d.data_vencimento });
  const pago = { ...d, status: 'pago', data_pagamento: '2026-11-08', conta_caixa_id: 4, updatedAt: '2026-11-08T12:01:00+00:00' };
  const saida = { id: txId, user_id: 1, conta_caixa_id: 4, tipo: 'saida', categoria: 'despesa_operacional', descricao: 'Pagamento: '+d.descricao, valor, data_transacao: '2026-11-08', contrato_id: null, parcela_id: null, createdAt: '2026-11-08T12:01:00+00:00' };
  const pg = { despesa_id: 9, user_id: 1, operacao_id: payOp, conta_caixa_id: 4, valor, data_pagamento: '2026-11-08', saida_id: txId, saida_snapshot: copy(saida), despesa_snapshot: copy(pago), operacao_estorno_id: null, estorno_id: null, estorno_snapshot: null };
  const paga = op('pagar', payOp, { despesaId: 9, contaCaixaId: 4, data: '2026-11-08' }, { antes: copy(d), depois: copy(pago), origemOperationId: createOp, saida: copy(saida), estorno: null, motivo: null }, { status: 'pago', valor, contaCaixaId: 4, dataPagamento: '2026-11-08', pagamentoOperationId: payOp, transacaoSaidaId: String(txId) });
  return { d, origem, cria, pago, saida, pg, paga };
}
function confirmation(acao: 'criar' | 'pagar' | 'estornar') {
  return { success: true, acao, operationId: acao === 'pagar' ? payOp : acao === 'estornar' ? reverseOp : createOp, chaveIdempotencia: key, userId: 1, despesaId: 9, status: acao === 'criar' ? 'pendente' : acao === 'pagar' ? 'pago' : 'cancelado', valor: '10.01', contaCaixaId: acao === 'criar' ? null : 4, dataVencimento: '2026-11-08', dataPagamento: acao === 'criar' ? null : '2026-11-08', dataEstorno: acao === 'estornar' ? '2026-11-09' : null, pagamentoOperationId: acao === 'criar' ? null : payOp, transacaoSaidaId: acao === 'criar' ? null : '9007199254740993', transacaoEstornoId: acao === 'estornar' ? '9007199254740994' : null };
}
const inputs = {
  criar: { descricao: 'Nova', categoria: 'outros' as const, valor: '10.01', dataVencimento: '2026-11-08', idempotencyKey: key },
  pagar: { id: 9, contaCaixaId: 4, dataPagamento: '2026-11-08', idempotencyKey: key },
  estornar: { id: 9, pagamentoOperationId: payOp, dataEstorno: '2026-11-09', motivo: 'Devolução comprovada', idempotencyKey: key },
};
function client(rows: Record<string, any[]> = {}, errorTable?: string, errorCode = 'XX000') {
  const calls: { table: string; select?: string; eq: [string, unknown][]; in: [string, unknown[]][]; range?: [number, number] }[] = [];
  const c = { rpc: vi.fn(), from: vi.fn((table: string) => {
    const call = { table, eq: [], in: [] } as (typeof calls)[number]; calls.push(call);
    const q: any = { select: (v: string) => { call.select = v; return q; }, eq: (k: string, v: unknown) => { call.eq.push([k, v]); return q; }, in: (k: string, v: unknown[]) => { call.in.push([k, v]); return q; }, order: () => q, range: (a: number, b: number) => { call.range = [a, b]; return q; }, then: (ok: any, fail: any) => {
      const data = (rows[table] ?? []).filter(r => call.eq.every(([k,v]) => r[k] === v) && call.in.every(([k,v]) => v.map(String).includes(String(r[k])))).slice(call.range?.[0] ?? 0, (call.range?.[1] ?? 999)+1);
      return Promise.resolve({ data: table === errorTable ? null : data, error: table === errorTable ? { code: errorCode } : null }).then(ok, fail);
    } }; return q;
  }), calls };
  mocked.cliente.mockResolvedValue(c); return c;
}
beforeEach(() => { vi.stubEnv('ENABLE_RPC_DESPESAS_PROSPECTIVAS', 'true'); mocked.cliente.mockReset(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-08T12:00:00Z')); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('contasPagarRouter RPC exclusiva', () => {
  it.each(['criar', 'pagar', 'estornar'] as const)('%s deriva owner do contexto e chama somente uma RPC', async acao => {
    const c = client(); c.rpc.mockResolvedValue({ data: confirmation(acao), error: null });
    expect(await (caller()[acao] as any)(inputs[acao])).toEqual(confirmation(acao));
    expect(c.rpc).toHaveBeenCalledTimes(1); expect(c.from).not.toHaveBeenCalled();
    expect(c.rpc.mock.calls[0][1].p_user_id).toBe(1);
  });
  it.each(['criar', 'pagar', 'estornar'] as const)('%s rejeita spoof userId/user_id e campos não permitidos', async acao => {
    const c = client();
    for (const patch of [{ userId: 2 }, { user_id: 2 }, { valor: 1 }, { conta_id: 99 }]) await expect((caller()[acao] as any)({ ...inputs[acao], ...patch })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(c.rpc).not.toHaveBeenCalled(); expect(mocked.cliente).not.toHaveBeenCalled();
  });
  it.each([undefined, 'false', 'TRUE', '1'])('flag %s não obtém banco nem escreve legado', async flag => {
    if (flag === undefined) delete process.env.ENABLE_RPC_DESPESAS_PROSPECTIVAS; else vi.stubEnv('ENABLE_RPC_DESPESAS_PROSPECTIVAS', flag);
    for (const acao of ['criar', 'pagar', 'estornar'] as const) await expect((caller()[acao] as any)(inputs[acao])).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(mocked.cliente).not.toHaveBeenCalled();
  });
  it.each(['editar', 'update', 'cancelar', 'excluir', 'recorrencia', 'sincronizarCaixa'] as const)('%s rejeita claramente sem fallback mesmo com flags antigas', async acao => {
    vi.stubEnv('ENABLE_LEGACY_CASH_SYNC', 'true'); await expect((caller()[acao] as any)({ id: 9 })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', message: expect.stringContaining('não são suportados') }); expect(mocked.cliente).not.toHaveBeenCalled();
  });
  it('recorrência pública é rejeitada antes da chamada', async () => { await expect(caller().criar({ ...inputs.criar, recorrente: true } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' }); expect(mocked.cliente).not.toHaveBeenCalled(); });
  it('rede incerta mantém a mesma chave e não escreve via REST', async () => { const c = client(); c.rpc.mockRejectedValue(new Error('timeout')); await expect(caller().pagar(inputs.pagar)).rejects.toMatchObject({ message: expect.stringContaining('MESMA chave') }); expect(c.from).not.toHaveBeenCalled(); expect(c.rpc).toHaveBeenCalledTimes(1); });
  it('sem sessão, nenhum acesso à fonte', async () => { await expect(contasPagarRouter.createCaller({ user: null, req: {} as any, res: {} as any }).listar()).rejects.toMatchObject({ code: 'UNAUTHORIZED' }); expect(mocked.cliente).not.toHaveBeenCalled(); });
  it('resposta incompleta não confirma sucesso', async () => { const c = client(); c.rpc.mockResolvedValue({ data: { success: true }, error: null }); await expect(caller().criar(inputs.criar)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); expect(c.from).not.toHaveBeenCalled(); });
});

describe('elegibilidade estrita 0020 e isolamento', () => {
  it('permite pagar somente o snapshot prospectivo original', () => { const x = proveniencia(); const r = marcarElegibilidade(x.d, x.origem, undefined, [x.cria], undefined, 1); expect(r.podePagar).toBe(true); expect(r.podeEstornar).toBe(false); expect(r.pagamentoOperationId).toBeNull(); });
  it('status/descrição não adotam legado', () => { const x = proveniencia(); const r = marcarElegibilidade(x.pago, undefined, x.pg, [x.paga], x.saida, 1); expect(r.proveniencia0020).toBe(false); expect(r.podeEstornar).toBe(false); expect(r.requerConferencia).toBe(true); });
  it('baixa estritamente vinculada permite estorno e preserva bigint string', () => { const x = proveniencia(); const r = marcarElegibilidade(x.pago, x.origem, x.pg, [x.cria, x.paga], x.saida, 1); expect(r.podeEstornar).toBe(true); expect(r.pagamentoOperationId).toBe(payOp); expect(r.transacaoSaidaId).toBe('9007199254740993'); });
  it.each(['origemOwner', 'pagamentoOwner', 'operacaoOwner', 'saidaOwner', 'despesaOwner', 'operacaoErrada', 'valor', 'data', 'conta', 'status', 'hash', 'snapshot', 'saidaAusente', 'estornoAnterior', 'ligacaoResultado'] as const)('nega estorno com %s incompatível', field => {
    const x = proveniencia(); let saida: any = x.saida;
    if (field === 'origemOwner') x.origem.user_id = 2;
    if (field === 'pagamentoOwner') x.pg.user_id = 2;
    if (field === 'operacaoOwner') x.paga.user_id = 2;
    if (field === 'saidaOwner') x.saida.user_id = 2;
    if (field === 'despesaOwner') x.pago.user_id = 2;
    if (field === 'operacaoErrada') x.pg.operacao_id = reverseOp;
    if (field === 'valor') x.pg.valor = '10.02';
    if (field === 'data') x.pg.data_pagamento = '2026-11-09';
    if (field === 'conta') x.pg.conta_caixa_id = 99;
    if (field === 'status') x.pago.status = 'paga';
    if (field === 'hash') x.paga.hash_payload = '\\x'+'0'.repeat(64);
    if (field === 'snapshot') x.pago.descricao = 'Adulterada';
    if (field === 'saidaAusente') saida = undefined;
    if (field === 'estornoAnterior') x.pg.estorno_id = 77 as any;
    if (field === 'ligacaoResultado') x.paga.resultado.pagamentoOperationId = reverseOp;
    const r = marcarElegibilidade(x.pago, x.origem, x.pg, [x.cria, x.paga], saida, 1); expect(r.podeEstornar).toBe(false); expect(r.pagamentoOperationId).toBeNull();
  });
  it('adulteração de snapshot original impede pagar', () => { const x = proveniencia(); x.d.descricao = 'Outra'; expect(marcarElegibilidade(x.d, x.origem, undefined, [x.cria], undefined, 1).podePagar).toBe(false); });
  it('UUID solto sem auditoria de criação não permite pagar', () => { const x = proveniencia(); expect(marcarElegibilidade(x.d, x.origem, undefined, [], undefined, 1).podePagar).toBe(false); });
  it('payload de criação alterado sem hash impede adoção', () => { const x = proveniencia(); x.cria.payloadTexto = pgText({ ...x.cria.payload, valor: '10.02' }); expect(marcarElegibilidade(x.d, x.origem, undefined, [x.cria], undefined, 1).podePagar).toBe(false); });
  it('valor máximo mantém todos os centavos', () => { const x = proveniencia('9999999999999.99'); expect(marcarElegibilidade(x.pago, x.origem, x.pg, [x.cria,x.paga], x.saida, 1).podeEstornar).toBe(true); });
  it('trilha indisponível mantém consulta sem elegibilidade inventada', async () => { const x = proveniencia(); client({ contas_pagar: [x.pago] }, 'despesas_rpc_origens', '42P01'); const r = await caller().listar(); expect(r).toHaveLength(1); expect(r[0].podeEstornar).toBe(false); expect(r[0].mensagemConferencia).toContain('indisponível'); });
  it('consulta legada é paginada e user_id é obrigatório em todas tabelas', async () => { const x = proveniencia(); const c = client({ contas_pagar: [x.d, { ...x.d, id: 10, user_id: 2 }] }); const r = await caller().listar(); expect(r.map(d => d.id)).toEqual([9]); expect(c.calls.length).toBeGreaterThan(1); for (const call of c.calls) { expect(call.eq).toContainEqual(['user_id', 1]); expect(call.range).toBeDefined(); expect(call.select).not.toBe('*'); } });
  it('status físicos antigos são normalizados nos filtros', async () => { const x = proveniencia(); client({ contas_pagar: [{ ...x.d, status: 'atrasado' }, { ...x.d, id: 10, status: 'cancelado' }] }); expect((await caller().listar({ status: 'atrasada' })).map(d => d.id)).toEqual([9]); expect((await caller().listar({ status: 'cancelada' })).map(d => d.id)).toEqual([10]); });
  it('zero legítimo somente quando a consulta retorna vazio', async () => { client(); expect(await caller().listar()).toEqual([]); expect(await caller().resumo()).toEqual({ totalPendente: '0.00', qtdPendente: 0, totalAtrasado: '0.00', qtdAtrasado: 0, totalPago: '0.00', qtdPago: 0 }); });
  it('erro de banco não retorna vazio/zeros', async () => { client({}, 'contas_pagar'); await expect(caller().listar()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); await expect(caller().resumo()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); });
  it('fonte ausente não retorna vazio/zeros', async () => { mocked.cliente.mockResolvedValue(null); await expect(caller().listar()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); await expect(caller().resumo()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' }); });
  it('resumo monetário exato e pago só no mês BRT com dia civil', async () => { vi.setSystemTime(new Date('2026-12-01T01:00:00Z')); const x = proveniencia(); client({ contas_pagar: [{ ...x.d, data_vencimento: '2026-11-30', valor: '9999999999999.99' }, { ...x.d, data_vencimento: '2026-11-30', id: 10, valor: '0.01' }, { ...x.pago, id: 11 }, { ...x.pago, id: 12, data_pagamento: '2026-10-31' }] }); const r = await caller().resumo(); expect(r.totalPendente).toBe('10000000000000.00'); expect(r.totalPago).toBe('10.01'); expect(r.qtdPago).toBe(1); });
  it('dinheiro inválido legado falha fechado no resumo', async () => { const x = proveniencia(); client({ contas_pagar: [{ ...x.d, valor: 'NaN' }] }); await expect(caller().resumo()).rejects.toMatchObject({ message: expect.stringContaining('não será substituído por zero') }); });
  it('pendente vencida deriva atraso BRT apenas na apresentação e continua pagável sem drift', async () => { vi.setSystemTime(new Date('2026-11-09T03:00:00Z')); const x=proveniencia(); const before=copy(x.d); const r=marcarElegibilidade(x.d,x.origem,undefined,[x.cria],undefined,1); expect(r.status).toBe('atrasada'); expect(r.podePagar).toBe(true); expect(x.d).toEqual(before); client({contas_pagar:[x.d]}); expect((await caller().listar({status:'atrasada'}))).toHaveLength(1); const resumo=await caller().resumo(); expect(resumo.totalAtrasado).toBe('10.01'); expect(resumo.totalPendente).toBe('0.00'); });
  it('paga sem data civil confiável não subconta o mês como zero', async () => { const x=proveniencia(); client({contas_pagar:[{...x.pago,data_pagamento:null}]}); await expect(caller().resumo()).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'}); });
});

describe('router com JSONB/NUMERIC reais e ledger histórico em PostgreSQL17 privado', () => {
  it('origem/pagamento reais admitem estorno com centavos exatos e não alteram saldo-base ou lançamento histórico', async () => {
    const bin = '/usr/lib/postgresql/17/bin';
    const run = mkdtempSync(resolve(tmpdir(), 'cobrapro-expenses-router.'));
    chmodSync(run, 0o700); mkdirSync(resolve(run, 'socket'), { mode: 0o700 });
    const env = { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', HOME: run };
    const cmd = (name: string, args: string[]) => {
      const r = spawnSync(resolve(bin,name),args,{ env,encoding:'utf8',timeout:30000 });
      expect(r.status, r.stderr).toBe(0); return r.stdout.trim();
    };
    let started = false;
    try {
      cmd('initdb', ['-D',resolve(run,'pgdata'),'-A','trust','--no-locale','-E','UTF8']);
      cmd('pg_ctl',['-D',resolve(run,'pgdata'),'-l',resolve(run,'postgres.log'),'-o',`-k ${run}/socket -p 55438 -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']); started=true;
      const args = ['-X','-q','-h',resolve(run,'socket'),'-p','55438','-d','postgres','-v','ON_ERROR_STOP=1','-At'];
      const sql=(s:string) => cmd('psql',[...args,'-c',s]);
      expect(sql("SELECT current_setting('server_version_num')::int/10000||'|'||current_setting('listen_addresses')||'|'||current_setting('unix_socket_directories')")).toBe(`17||${run}/socket`);
      sql('CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN');
      cmd('psql',[...args,'-f',resolve(process.cwd(),'tests/postgres-expenses/fixture.sql')]);
      cmd('psql',[...args,'-f',resolve(process.cwd(),'drizzle/0020_rpc_despesas_prospectivas.sql')]);
      // Fixture não possui grants REST anteriores da instalação; somente SELECT sintético local.
      sql('GRANT SELECT ON contas_pagar,transacoes_caixa TO service_role');
      sql("INSERT INTO transacoes_caixa(conta_caixa_id,tipo,categoria,descricao,valor,data_transacao,user_id) VALUES(1,'entrada','outros','Histórico válido anterior',7.77,'2026-10-01',1)");
      const before = sql('SELECT saldo::text FROM contas_caixa WHERE id=1');
      const historic = sql("SELECT to_jsonb(t)::text FROM transacoes_caixa t WHERE descricao='Histórico válido anterior'");
      const created = JSON.parse(sql(`SET ROLE service_role; SELECT rpc_criar_despesa_prospectiva(1,'Água 😀 \\"valor\\": 12.00','agua',9999999999999.99,'2026-11-08',NULL,'${key}')`));
      const rows = () => {
        const query = (q:string) => JSON.parse(sql(`SET ROLE service_role; SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM (${q}) t`));
        return {
          contas_pagar: query('SELECT id,descricao,categoria,valor::text,data_vencimento,data_pagamento,status,recorrente,frequencia,conta_caixa_id,observacoes,user_id,"createdAt","updatedAt" FROM contas_pagar WHERE user_id=1'),
          despesas_rpc_origens: query('SELECT despesa_id,user_id,operacao_id,snapshot::text FROM despesas_rpc_origens WHERE user_id=1'),
          despesas_rpc_pagamentos: query('SELECT despesa_id,user_id,operacao_id,conta_caixa_id,valor::text,data_pagamento,saida_id::text,saida_snapshot::text,despesa_snapshot::text,operacao_estorno_id,estorno_id::text,estorno_snapshot::text FROM despesas_rpc_pagamentos WHERE user_id=1'),
          despesas_rpc_operacoes: query('SELECT id,user_id,chave_idempotencia,tipo,payload::text,hash_payload,resultado,auditoria::text FROM despesas_rpc_operacoes WHERE user_id=1'),
          transacoes_caixa: query('SELECT id::text,conta_caixa_id,tipo,categoria,descricao,valor::text,data_transacao,contrato_id,parcela_id,"createdAt",user_id FROM transacoes_caixa WHERE user_id=1'),
        };
      };
      client(rows());
      const pending=(await caller().listar()).find(d => d.id===created.despesaId)!;
      expect(pending.podePagar).toBe(true); expect(pending.valor).toBe('9999999999999.99');
      const paid=JSON.parse(sql(`SET ROLE service_role; SELECT rpc_pagar_despesa_prospectiva(1,${created.despesaId},1,'2026-11-08','${payOp}')`));
      client(rows());
      const ready=(await caller().listar()).find(d => d.id===created.despesaId)!;
      expect(ready.podeEstornar).toBe(true); expect(ready.pagamentoOperationId).toBe(paid.operationId);
      expect(ready.transacaoSaidaId).toBe(paid.transacaoSaidaId); expect(ready.valor).toBe('9999999999999.99');
      sql(`SET ROLE service_role; SELECT rpc_estornar_despesa_prospectiva(1,${created.despesaId},'${paid.operationId}','2026-11-09','Devolução integral','${reverseOp}')`);
      expect(sql('SELECT saldo::text FROM contas_caixa WHERE id=1')).toBe(before);
      expect(sql("SELECT to_jsonb(t)::text FROM transacoes_caixa t WHERE descricao='Histórico válido anterior'")).toBe(historic);
      expect(sql("SELECT sum(CASE tipo WHEN 'entrada' THEN valor ELSE -valor END)::text FROM transacoes_caixa WHERE conta_caixa_id=1")).toBe('7.77');
      expect(sql('SET ROLE service_role; SELECT count(*) FROM despesas_rpc_origens')).toBe('1');
    } finally {
      if (started) {
        cmd('pg_ctl',['-D',resolve(run,'pgdata'),'-m','fast','-w','stop']);
        const status=spawnSync(resolve(bin,'pg_ctl'),['-D',resolve(run,'pgdata'),'status'],{env,encoding:'utf8'});
        expect(status.status).toBe(3);
      }
    }
  }, 60000);
});

describe('intenções persistidas e UI segura', () => {
  let user = 100;
  function storage() { const data = new Map<string, string>(); return { data, getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string,v: string) => { data.set(k,v); }), removeItem: vi.fn((k: string) => { data.delete(k); }) }; }
  const payload = { descricao: 'Nova', categoria: 'outros' as const, valor: '10.01', dataVencimento: '2026-11-08' };
  it('primeira intenção guarda UUID e payload original, mesmas referências em retry', () => { const disk = storage(); const uuid = vi.fn(() => key); const s = new DespesasIntentStore(++user, disk, vi.fn(), uuid); const i = s.begin('criar', payload); expect(s.begin('criar', payload)).toEqual(i); expect(uuid).toHaveBeenCalledTimes(1); expect(disk.setItem).toHaveBeenCalledTimes(1); });
  it('payload diferente não reutiliza mesma chave nem gera outra', () => { const uuid = vi.fn(() => key); const s = new DespesasIntentStore(++user, storage(), vi.fn(), uuid); s.begin('criar', payload); expect(() => s.begin('criar', { ...payload, valor: '10.02' })).toThrow('payload original'); expect(uuid).toHaveBeenCalledTimes(1); });
  it('outro objeto/remount recupera a intenção original', () => { const disk = storage(); const id = ++user; const s = new DespesasIntentStore(id,disk,vi.fn(),() => key); const i = s.begin('criar',payload); const reopened = new DespesasIntentStore(id,disk,vi.fn(),vi.fn()); expect(reopened.get('criar')).toEqual(i); });
  it('reload real recupera JSON original sem UUID novo, inclusive pagamento/data', () => { const disk = storage(); const id = ++user; disk.data.set(`cobrapro:despesas:0020:v1:user:${id}:action:pagar`, JSON.stringify({ version:1, userId:id, action:'pagar', idempotencyKey:key, payload:{ id:9, contaCaixaId:4, dataPagamento:'2026-11-08' } })); const uuid = vi.fn(); const s = new DespesasIntentStore(id,disk,vi.fn(),uuid); expect(s.get('pagar')?.payload.dataPagamento).toBe('2026-11-08'); expect(s.begin('pagar', { id:9,contaCaixaId:4,dataPagamento:'2026-11-08' }).idempotencyKey).toBe(key); expect(uuid).not.toHaveBeenCalled(); });
  it('payload é imune a mutação do formulário ou retorno', () => { const s = new DespesasIntentStore(++user,storage(),vi.fn(),() => key); const original = { ...payload }; const i = s.begin('criar',original); original.valor = '20.00'; i.payload.valor = '30.00'; expect(s.get('criar')?.payload.valor).toBe('10.01'); });
  it('quota mantém UUID em memória, avisa e nunca troca após retry', () => { const disk = storage(); disk.setItem.mockImplementation(() => { throw new Error('quota'); }); const aviso = vi.fn(); const uuid = vi.fn(() => key); const s = new DespesasIntentStore(++user,disk,aviso,uuid); s.begin('criar',payload); expect(aviso.mock.calls[0][0]).toContain('mantido em memória'); expect(s.begin('criar',payload).idempotencyKey).toBe(key); expect(uuid).toHaveBeenCalledTimes(1); });
  it('leitura inacessível impede chave substituta e pede conferência', () => { const disk = storage(); disk.getItem.mockImplementation(() => { throw new Error('denied'); }); const aviso = vi.fn(); const uuid = vi.fn(); const s = new DespesasIntentStore(++user,disk,aviso,uuid); expect(() => s.begin('criar',payload)).toThrow('requer conferência'); expect(uuid).not.toHaveBeenCalled(); expect(aviso).toHaveBeenCalled(); });
  it('JSON corrompido/owner estranho fica bloqueado sem sobrescrever', () => { const disk = storage(); const id=++user; disk.data.set(`cobrapro:despesas:0020:v1:user:${id}:action:criar`, '{bad'); const s = new DespesasIntentStore(id,disk,vi.fn(),vi.fn()); expect(s.get('criar')).toBeNull(); expect(s.blocked('criar')).toBe(true); expect(() => s.begin('criar',payload)).toThrow(); expect(disk.setItem).not.toHaveBeenCalled(); });
  it('owners e ações têm escopos independentes e não armazenam tokens', () => { const disk = storage(); const s = new DespesasIntentStore(++user,disk,vi.fn(),() => key); s.begin('criar',payload); const t = new DespesasIntentStore(++user,disk,vi.fn(),() => payOp); expect(t.get('criar')).toBeNull(); expect(s.get('pagar')).toBeNull(); expect(disk.setItem.mock.calls[0][0]).toContain('action:criar'); expect(disk.setItem.mock.calls[0][1]).not.toMatch(/token|cookie|session/i); });
  it('bloqueio síncrono duplo clique vale entre instâncias', () => { const disk=storage(); const id=++user; const s=new DespesasIntentStore(id,disk,vi.fn()); const t=new DespesasIntentStore(id,disk,vi.fn()); expect(s.acquire('pagar')).toBe(true); expect(t.acquire('pagar')).toBe(false); s.release('pagar'); expect(t.acquire('pagar')).toBe(true); t.release('pagar'); });
  it('confirmação remove apenas a mesma intenção, nunca por timeout', () => { const s=new DespesasIntentStore(++user,storage(),vi.fn(),() => key); s.begin('criar',payload); expect(() => s.confirmed('criar',payOp)).toThrow(); expect(s.get('criar')).not.toBeNull(); s.confirmed('criar',key); expect(s.get('criar')).toBeNull(); });
  it('remoção falhada retém a intenção segura para replay', () => { const disk=storage(); disk.removeItem.mockImplementation(() => { throw new Error('denied'); }); const aviso=vi.fn(); const s=new DespesasIntentStore(++user,disk,aviso,() => key); s.begin('criar',payload); s.confirmed('criar',key); expect(s.get('criar')?.idempotencyKey).toBe(key); expect(aviso.mock.calls[0][0]).toContain('Operação confirmada'); });
  it('dia BRT atravessa meia-noite UTC sem trocar data', () => { expect(diaCivilBrt(new Date('2026-11-09T01:59:59Z'))).toBe('2026-11-08'); expect(diaCivilBrt(new Date('2026-11-09T03:00:00Z'))).toBe('2026-11-09'); });
  it.each(['0', '-1', '1.001', '1e2', 'NaN', 'Infinity', '10000000000000.00', '01.00'])('valor inválido %s não vira zero/arredondamento', v => { expect(dinheiroDespesa(v)).toBeNull(); });
  it('formatação exata preserva centavos e máximos sem float', () => { expect(dinheiroDespesa('9999999999999.99')).toBe('9999999999999.99'); expect(moedaDespesa('9999999999999.99')).toBe('R$ 9.999.999.999.999,99'); expect(moedaDespesa('0.00')).toBe('R$ 0,00'); });
  it('schemas públicos .strict: userId spoof, motivo ausente e número monetário rejeitados', () => { expect(criarDespesaInput.safeParse({...inputs.criar,userId:2}).success).toBe(false); expect(criarDespesaInput.safeParse({...inputs.criar,valor:10.01}).success).toBe(false); expect(pagarDespesaInput.safeParse({...inputs.pagar,valor:'10.01'}).success).toBe(false); expect(estornarDespesaInput.safeParse({...inputs.estornar,motivo:''}).success).toBe(false); });
  it('UI não contém mutações destrutivas, floats ou substituição automática de UUID', () => { const ui=readFileSync(resolve(process.cwd(),'client/src/pages/ContasPagar.tsx'),'utf8'); expect(ui).not.toMatch(/cancelar\.useMutation|excluir\.useMutation|parseFloat|randomUUID|toISOString/); expect(ui).toContain('retry: false'); expect(ui).toContain('lista.isError'); expect(ui).toContain('resumo.isError'); expect(ui).toContain('pagamentoOperationId'); expect(ui).toContain('motivo'); expect(ui).toContain('Reenviar intenção original'); expect(ui).not.toMatch(/totalPendente\s*\?\?\s*0/); });
});
