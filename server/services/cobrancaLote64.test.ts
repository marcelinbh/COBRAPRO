import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENV } from '../_core/env';
import { preparar64Schema, enviar64Schema, preview64Schema } from '../../shared/cobrancaLote64';
import { prepararLote64, enviarItem64, type Options64 } from './cobrancaLote64';
import { mapearSnapshot60, RPC60 } from './snapshot60-reader';
import { sessionScope51 } from './obrigacoes51Rpc';
import { cobrancaLista64Router } from '../routers/cobrancaLista64';

const mocks = vi.hoisted(() => ({ db: vi.fn(), evolution: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: mocks.db }));
vi.mock('./evolutionClient', async importOriginal => ({
  ...await importOriginal<typeof import('./evolutionClient')>(),
  enviarMensagemEvolution: mocks.evolution,
}));
const DATE = '2026-11-27', NOW = new Date(`${DATE}T15:00:00Z`), UID = 1, CID = 951;
const SECRET = 'fixture-only-secret64-with-at-least-32-characters';
const COOKIE = 'app_session_id=fixture64-session';
const ORIGINAL_SECRET = ENV.cookieSecret;
const SESSION = sessionScope51(UID, COOKIE);
const key = (tipo = 'preventivo', cid = CID) => `cobranca64:${UID}:${cid}:${tipo}:${DATE}`;
const source = JSON.parse(readFileSync(new URL('./fixtures/snapshot60-final05.json', import.meta.url), 'utf8'));
function fixture(): any {
  const s = structuredClone(source);
  s.items = s.items.filter((item: any) => [951, 952, 958].includes(item.id));
  return s;
}
type Call = { table: string; op: string; payload?: any; eq: [string, any][]; inside: [string, any[]][]; gt: [string, any][]; columns?: string; limit?: number };
/** Simula Supabase em memória; respeita filtros own, count e CAS. Nenhuma credencial/socket. */
function memory() {
  const state = {
    snapshot: fixture(), response: undefined as any, rpcError: false,
    tables: {
      clientes: [{ id: 1, user_id: UID, whatsapp: '(11) 99999-9999', telefone: null }],
      configuracoes: [] as any[], whatsapp_outbox: [] as any[], notificacoes_log: [] as any[],
    } as Record<string, any[]>,
    calls: [] as Call[], post: vi.fn(), beforeInsert: undefined as undefined | ((payload: any) => void),
    beforeQuery: undefined as undefined | ((call: Call) => void),
    responsePatch: undefined as undefined | ((call: Call, response: any) => void),
    failCAS: false, failInsert: false,
  };
  const from = vi.fn((table: string) => {
    const call: Call = { table, op: 'select', eq: [], inside: [], gt: [] };
    state.calls.push(call);
    let single = false, offset = 0, end = Infinity;
    const execute = async () => {
      state.beforeQuery?.(call);
      let rows = state.tables[table] ?? [];
      const matches = (row: any) => call.eq.every(([k, v]) => row[k] === v) && call.inside.every(([k, vs]) => vs.includes(row[k])) && call.gt.every(([k, v]) => Date.parse(row[k]) > Date.parse(v));
      let data: any[], error: any = null;
      if (call.op === 'insert') {
        state.beforeInsert?.(call.payload);
        if (state.failInsert) error = { code: 'XX000', message: 'private sql telephone' };
        else if (rows.some(row => row.chave_deduplicacao === call.payload.chave_deduplicacao)) error = { code: '23505' };
        if (error) data = [];
        else { rows.push(structuredClone(call.payload)); state.tables[table] = rows; data = [rows[rows.length - 1]]; }
      } else if (call.op === 'update') {
        if (state.failCAS && call.payload.status !== 'desconhecido') data = [];
        else { data = rows.filter(matches); data.forEach(row => Object.assign(row, structuredClone(call.payload))); }
      } else data = rows.filter(matches);
      const count = data.length;
      data = data.slice(offset, Math.min(end + 1, offset + (call.limit ?? Infinity)));
      if (call.columns) data = data.map(row => Object.fromEntries(call.columns!.split(',').map(k => [k.trim(), row[k.trim()]])));
      const response = { data: single ? data[0] ?? null : structuredClone(data), error, count };
      state.responsePatch?.(call, response);
      return response;
    };
    const q: any = {
      select: (columns: string) => { call.columns = columns; return q; },
      eq: (k: string, v: any) => { call.eq.push([k, v]); return q; },
      in: (k: string, v: any[]) => { call.inside.push([k, v]); return q; },
      gt: (k: string, v: any) => { call.gt.push([k, v]); return q; },
      order: () => q,
      limit: (n: number) => { call.limit = n; return q; },
      range: (a: number, b: number) => { offset = a; end = b; return q; },
      insert: (payload: any) => { call.op = 'insert'; call.payload = payload; return q; },
      update: (payload: any) => { call.op = 'update'; call.payload = payload; return q; },
      maybeSingle: () => { single = true; return execute(); },
      then: (ok: any, fail: any) => execute().then(ok, fail),
    };
    return q;
  });
  const rpc = vi.fn(async () => {
    if (state.rpcError) throw new Error('private tenant telephone sql');
    return state.response ?? { data: state.snapshot, error: null, status: 200, count: null };
  });
  const sb: any = { from, rpc };
  const history = vi.fn(async (ignored: any, row: any, status: string) => {
    state.tables.notificacoes_log.push({ id: state.tables.notificacoes_log.length + 1, user_id: row.user_id, outbox_id: row.id,
      tipo: row.tipo, parcela_id: row.parcela_id, cliente_id: row.cliente_id, status });
  });
  const send = vi.fn(async (_uid: number, _phone: string, _text: string, callback?: () => Promise<boolean>) => {
    if (!(await callback?.())) return { ok: false, disposition: 'nao_solicitado' as const };
    state.post();
    return { ok: true, disposition: 'aceito' as const, providerMessageId: 'fixture-provider64' };
  });
  const options: Options64 = { now: NOW, secret: SECRET, dependencies: { enviarMensagemEvolution: send, persistirHistoricoWhatsApp: history } };
  const prepare = (input: any = { contratoIds: [CID], tipo: 'preventivo' }, opt = options) => prepararLote64(sb, UID, SESSION, input, opt);
  const previewToken = async () => (await prepare()).items[0].token!;
  const enviar = (token: string, opt = options) => enviarItem64(sb, UID, SESSION, token, opt);
  return { ...state, state, sb, send, history, options, prepare, previewToken, enviar };
}
function row64(overrides: any = {}) {
  return { id: randomUUID(), user_id: UID, tipo: 'cobranca_manual64', chave_deduplicacao: key(), data_referencia: DATE,
    parcela_id: 9511, cliente_id: 1, status: 'enviado', tentativas: 1, lease_expira_em: null,
    provider_message_id: 'fixture-provider64', ...overrides };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  vi.resetAllMocks(); ENV.cookieSecret = SECRET;
  mocks.evolution.mockRejectedValue(new Error('Real send forbidden by offline fixture'));
});
afterEach(() => { vi.useRealTimers(); ENV.cookieSecret = ORIGINAL_SECRET; });

describe('contratos estritos64', () => {
  it.each([[], [0], [-1], [1.5], [2147483648], [CID, CID], Array.from({ length: 21 }, (_, i) => i + 1), ['951']])('rejeita IDs %j', async contratoIds => {
    const m = memory();
    await expect(m.prepare({ contratoIds, tipo: 'preventivo' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(m.sb.rpc).not.toHaveBeenCalled(); expect(m.sb.from).not.toHaveBeenCalled();
  });
  it('rejeita owner, edição de mensagem e confirmação implícita', () => {
    expect(preparar64Schema.safeParse({ contratoIds: [CID], tipo: 'preventivo', userId: UID }).success).toBe(false);
    for (const input of [{ token: 'x' }, { token: 'x', confirmar: false }, { token: 'x', confirmar: true, mensagem: 'nova' }, { token: 'x'.repeat(16001), confirmar: true }])
      expect(enviar64Schema.safeParse(input).success).toBe(false);
  });
});

describe('preview own e reader original60', () => {
  it('fixture real passa mapper; preview uma RPC, batch own e zero writes', async () => {
    const m = memory();
    expect(mapearSnapshot60(m.state.snapshot, UID).coverage.validatedContracts).toBe(2);
    const p = await m.prepare({ contratoIds: [CID, 952], tipo: 'preventivo' });
    expect(preview64Schema.safeParse(p).success).toBe(true);
    expect(p.items.every(i => i.estado === 'pronto')).toBe(true);
    expect(m.sb.rpc.mock.calls).toEqual([[RPC60, { p_user_id: UID }]]);
    expect(m.state.calls.every(c => c.op === 'select' && c.eq.some(([k, v]) => k === 'user_id' && v === UID))).toBe(true);
    const contacts = m.state.calls.filter(c => c.table === 'clientes');
    expect(contacts).toHaveLength(1); expect(contacts[0].inside).toEqual([['id', [1]]]);
    expect(m.send).not.toHaveBeenCalled(); expect(m.history).not.toHaveBeenCalled();
    const body = JSON.parse(Buffer.from(p.items[0].token!.split('.')[0], 'base64url').toString());
    expect(Object.keys(body).sort()).toEqual(['contratoId', 'date', 'exp', 'hash', 'owner', 'session', 'tipo', 'v']);
    expect(JSON.stringify(body)).not.toMatch(/99999|Sintético|Valor registrado/);
    expect(p.items[0].contatoMascarado).not.toContain('11999999999');
    expect(p.items[0].mensagem).toContain('Valor registrado: R$ 50,00');
    expect(p.items[0].mensagem).toContain('Multa e mora devem ser conferidas');
  });
  it('mantém somente retry61 nativo exato sem retry próprio64', async () => {
    const m = memory();
    m.sb.rpc.mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }, status: 500 });
    const promise = m.prepare();
    await vi.advanceTimersByTimeAsync(251);
    expect((await promise).items[0].estado).toBe('pronto');
    expect(m.sb.rpc).toHaveBeenCalledTimes(2);
    expect(m.sb.rpc.mock.calls.every((call: any) => call[0] === RPC60 && call[1].p_user_id === UID)).toBe(true);
  });
  it('aceita exatamente20 IDs sem consultar contatos fora de seleção/escopo', async () => {
    const m = memory();
    const ids = [CID, ...Array.from({ length: 19 }, (_, i) => 2000 + i)];
    const p = await m.prepare({ contratoIds: ids, tipo: 'preventivo' });
    expect(p.items).toHaveLength(20); expect(p.items.filter(i => i.estado === 'pronto')).toHaveLength(1);
    expect(m.state.calls.filter(c => c.table === 'clientes')).toHaveLength(1);
  });
  it('fora do escopo/coletor e unavailable não consultam contato nem expõem PII', async () => {
    const m = memory();
    const p = await m.prepare({ contratoIds: [999, 958], tipo: 'preventivo' });
    for (const i of p.items) expect(i).toMatchObject({ estado: 'ignorado', clienteNome: null, contatoMascarado: null, mensagem: null, token: null });
    expect(m.state.calls.some(c => c.table === 'clientes')).toBe(false);
    expect(m.sb.rpc).toHaveBeenCalledTimes(1); // SQL snapshot60 é a autoridade do coletor.
  });
  it.each(['userId', 'contractOwner', 'clientOwner', 'parcelOwner', 'nonSelectedInvalid', 'date'])('valida carteira inteira antes dos contatos: %s', async kind => {
    const m = memory(), s = m.state.snapshot;
    if (kind === 'userId') s.userId = 2;
    if (kind === 'contractOwner') s.items[0].contrato.user_id = 2;
    if (kind === 'clientOwner') s.items[0].cliente.user_id = 2;
    if (kind === 'parcelOwner') s.items[0].parcelas[0].user_id = 2;
    if (kind === 'nonSelectedInvalid') s.items[1].parcelas[0].contrato_id = 999;
    if (kind === 'date') s.dataCalculo = '2026-11-26';
    await expect(m.prepare()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(m.sb.from).not.toHaveBeenCalled();
  });
  it.each(['getter', 'cycle', 'proto', 'sparse', 'badEnvelope'])('captura own-data recusa %s sem executar getter', async kind => {
    const m = memory(); let getters = 0;
    if (kind === 'getter') Object.defineProperty(m.state.snapshot, 'userId', { enumerable: true, get() { getters++; return UID; } });
    if (kind === 'cycle') m.state.snapshot.extra = m.state.snapshot;
    if (kind === 'proto') Object.setPrototypeOf(m.state.snapshot, { inherited: 1 });
    if (kind === 'sparse') delete m.state.snapshot.items[0];
    if (kind === 'badEnvelope') m.state.response = { data: m.state.snapshot, error: null, status: 503 };
    await expect(m.prepare()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(getters).toBe(0); expect(m.sb.from).not.toHaveBeenCalled();
  });
  it.each(['cancelado', 'renegociado', 'encerrado', 'arquivado', 'parcelArchived', 'cancelledProof'])('não cobra estado %s', async kind => {
    const m = memory(), i = m.state.snapshot.items[0];
    if (kind === 'arquivado') { i.estado51.arquivado = true; i.estado51.parcelas.forEach((p: any) => p.arquivada = true); }
    else if (kind === 'parcelArchived') i.estado51.parcelas.forEach((p: any) => p.arquivada = true);
    else if (kind === 'cancelledProof') { i.estado51.statusObrigacao = 'encerrado_por_cancelamento'; i.estado51.parcelas.forEach((p: any) => { p.statusObrigacao = 'cancelada'; p.obrigacaoAtual = '0.00'; }); }
    else i.contrato.status = kind;
    expect((await m.prepare()).items[0].estado).toBe('ignorado'); expect(m.send).not.toHaveBeenCalled();
  });
  it('seleciona menor DATE,id exigível sem fabricar parcela ou antecipar classificação', async () => {
    const m = memory(), i = m.state.snapshot.items[0];
    i.parcelas[0].data_vencimento = '2026-11-26'; i.parcelas[1].data_vencimento = DATE;
    expect((await m.prepare({ contratoIds: [CID], tipo: 'atraso' })).items[0].mensagem).toContain('parcela 1');
    expect((await m.prepare({ contratoIds: [CID], tipo: 'vence_hoje' })).items[0].mensagem).toContain('parcela 2');
    expect((await m.prepare()).items[0].estado).toBe('ignorado');
    i.parcelas[0].data_vencimento = '2027-02-10'; i.parcelas[1].data_vencimento = '2027-02-10';
    i.parcelas.reverse();
    expect((await m.prepare()).items[0].mensagem).toContain('parcela 1');
  });
  it('partial usa obrigação registrada exata sem resomar original nem float', async () => {
    const m = memory(), i = m.state.snapshot.items[0], p = i.parcelas[0], proof = i.estado51.parcelas[0];
    p.status = 'parcial'; p.valor_pago = '20.00'; p.saldo_residual = '30.00'; p.data_pagamento = DATE;
    proof.statusFinanceiroOriginal = 'parcial'; proof.obrigacaoAtual = '30.00';
    expect((await m.prepare()).items[0].mensagem).toContain('Valor registrado: R$ 30,00');
    p.saldo_residual = 'NaN'; await expect(m.prepare()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
  it('normalização55 e assinatura próprias entram na mensagem', async () => {
    const m = memory(); m.state.tables.configuracoes.push({ user_id: UID, chave: 'nomeEmpresa', valor: 'Empresa sintética' }, { user_id: UID, chave: 'assinatura_whatsapp', valor: 'Atenciosamente' });
    const p = await m.prepare(); expect(p.items[0].mensagem).toContain('Empresa sintética');
    expect(p.items[0].mensagem).toContain('Atenciosamente');
    await m.enviar(p.items[0].token!); expect(m.send.mock.calls[0][1]).toBe('5511999999999');
  });
  it.each(['contactOwner', 'contactExtra', 'contactCount', 'configOwner', 'configDuplicate', 'configType', 'aliases'])('contatos/config inválidos: %s', async kind => {
    const m = memory();
    if (kind === 'contactOwner') m.state.responsePatch = (c, r) => { if (c.table === 'clientes') r.data[0].user_id = 2; };
    if (kind === 'contactExtra') m.state.responsePatch = (c, r) => { if (c.table === 'clientes') r.data[0].id = 99; };
    if (kind === 'contactCount') m.state.responsePatch = (c, r) => { if (c.table === 'clientes') r.count = 2; };
    if (kind === 'configOwner') m.state.responsePatch = (c, r) => { if (c.table === 'configuracoes') { r.data = [{ user_id: 2, chave: 'nomeEmpresa', valor: 'segredo' }]; r.count = 1; } };
    if (kind === 'configDuplicate') m.state.tables.configuracoes.push({ user_id: UID, chave: 'nomeEmpresa', valor: 'A' }, { user_id: UID, chave: 'nomeEmpresa', valor: 'A' });
    if (kind === 'configType') m.state.tables.configuracoes.push({ user_id: UID, chave: 'nomeEmpresa', valor: 12 });
    if (kind === 'aliases') m.state.tables.configuracoes.push({ user_id: UID, chave: 'assinaturaWhatsapp', valor: 'A' }, { user_id: UID, chave: 'assinatura_whatsapp', valor: 'B' });
    await expect(m.prepare()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(m.state.calls.every(c => c.op === 'select')).toBe(true);
  });
});

describe('HMAC/session/revalidação antes de outbox', () => {
  it.each(['owner', 'session', 'expired', 'day', 'tamper', 'size', 'weakSecret'])('recusa token %s sem queries/writes', async kind => {
    const m = memory(); let token = await m.previewToken(); const before = m.sb.rpc.mock.calls.length;
    let uid = UID, session = SESSION, opt = m.options;
    if (kind === 'owner') uid = 2;
    if (kind === 'session') session = 'a'.repeat(64);
    if (kind === 'expired') opt = { ...opt, now: new Date(NOW.getTime() + 300001) };
    if (kind === 'day') opt = { ...opt, now: new Date('2026-11-28T15:00:00Z') };
    if (kind === 'tamper') token = `X${token.slice(1)}`;
    if (kind === 'size') token = 'x'.repeat(16001);
    if (kind === 'weakSecret') opt = { ...opt, secret: '' };
    await expect(enviarItem64(m.sb, uid, session, token, opt)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(m.sb.rpc).toHaveBeenCalledTimes(before); expect(m.state.calls.every(c => c.op === 'select')).toBe(true);
  });
  it.each(['name', 'phone', 'date', 'value', 'config', 'siblingArchive', 'extraObligation', 'unavailable'])('mudança atual %s invalida hash e impede outbox', async kind => {
    const m = memory(); const token = await m.previewToken(), i = m.state.snapshot.items[0];
    if (kind === 'name') i.cliente.nome = 'Nome atualizado';
    if (kind === 'phone') m.state.tables.clientes[0].whatsapp = '(11) 98888-8888';
    if (kind === 'date') i.parcelas[0].data_vencimento = '2027-01-11';
    if (kind === 'value') { i.parcelas[0].valor_original = '51.00'; i.estado51.parcelas[0].obrigacaoAtual = '51.00'; }
    if (kind === 'config') m.state.tables.configuracoes.push({ user_id: UID, chave: 'nomeEmpresa', valor: 'Nova' });
    if (kind === 'siblingArchive') i.estado51.parcelas[1].arquivada = true;
    if (kind === 'extraObligation') { i.estado51.parcelas[1].componenteAdicional = '50.00'; i.estado51.obrigacaoAdicional = '50.00'; }
    if (kind === 'unavailable') m.state.rpcError = true;
    expect(await m.enviar(token)).toMatchObject({ status: 'nao_solicitado', providerMessageId: null, outboxId: null });
    expect(m.state.calls.every(c => c.op === 'select')).toBe(true); expect(m.send).not.toHaveBeenCalled();
  });
});

describe('envio único solicitado, lease CAS e reconsulta sem replay', () => {
  it('aceite exige callback, ID e CAS/readback own; novo preview/replay nunca POST', async () => {
    const m = memory(), token = await m.previewToken();
    const r = await m.enviar(token);
    expect(r).toMatchObject({ status: 'aceito_evolution', providerMessageId: 'fixture-provider64' });
    expect(m.state.post).toHaveBeenCalledTimes(1); expect(m.sb.rpc).toHaveBeenCalledTimes(3);
    expect(m.state.tables.whatsapp_outbox[0]).toMatchObject({ tipo: 'cobranca_manual64', status: 'enviado', tentativas: 1, lease_expira_em: null, chave_deduplicacao: key() });
    expect(r.outboxId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    const insert = m.state.calls.find(c => c.op === 'insert')!; expect(insert.payload.status).toBe('enviando');
    expect(m.history).toHaveBeenCalledTimes(1);
    expect(await m.enviar(token)).toMatchObject({ status: 'aceito_evolution' });
    const again = await m.prepare(); expect(again.items[0]).toMatchObject({ estado: 'registrado', token: null, mensagem: null });
    expect(m.state.post).toHaveBeenCalledTimes(1); expect(m.send).toHaveBeenCalledTimes(1);
  });
  it('race23505 lê owned dailykey, sem upsert/replay POST', async () => {
    const m = memory(), token = await m.previewToken();
    m.state.beforeInsert = () => { m.state.tables.whatsapp_outbox.push(row64()); };
    expect(await m.enviar(token)).toMatchObject({ status: 'aceito_evolution' });
    expect(m.send).not.toHaveBeenCalled(); expect(m.state.post).not.toHaveBeenCalled();
  });
  it.each(['numericId', 'owner', 'count', 'tooMany', 'duplicateUUID', 'duplicateKey', 'date', 'sdkError'])('outbox UUID reader64 recusa %s sem aceitar/replay', async kind => {
    const m = memory(), row = row64(); m.state.tables.whatsapp_outbox.push(row);
    m.state.responsePatch = (c, r) => {
      if (c.table !== 'whatsapp_outbox' || c.op !== 'select' || !Array.isArray(r.data)) return;
      if (kind === 'numericId') r.data[0].id = 1;
      if (kind === 'owner') r.data[0].user_id = 2;
      if (kind === 'count') r.count = 0;
      if (kind === 'tooMany') r.count = 21;
      if (kind === 'date') r.data[0].data_referencia = '2026-11-26';
      if (kind === 'sdkError') r.error = { code: 'XX000', message: 'private' };
      if (kind === 'duplicateUUID' || kind === 'duplicateKey') {
        const twin = structuredClone(r.data[0]);
        if (kind === 'duplicateUUID') twin.chave_deduplicacao = key('preventivo', 952);
        else twin.id = randomUUID();
        r.data.push(twin); r.count = 2;
      }
    };
    await expect(m.prepare({ contratoIds: [CID, 952], tipo: 'preventivo' })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(m.send).not.toHaveBeenCalled(); expect(m.state.calls.every(c => c.op === 'select')).toBe(true);
  });
  it.each(['disconnected', 'uncertain', 'http5xx', 'noID', 'throw', 'bypassCallback'])('resultado %s não inventa aceite nem reenvia', async kind => {
    const m = memory(), token = await m.previewToken();
    m.send.mockImplementation(async (_u, _p, _t, cb) => {
      if (kind === 'disconnected') return { ok: false, disposition: 'nao_solicitado', erroCodigo: 'DISCONNECTED' } as any;
      if (kind === 'bypassCallback') return { ok: true, disposition: 'aceito', providerMessageId: 'unproven' } as any;
      await cb?.(); m.state.post();
      if (kind === 'throw') throw new Error('telephone sql tenant');
      if (kind === 'noID') return { ok: true, disposition: 'aceito' } as any;
      return { ok: false, disposition: 'incerto', erroCodigo: kind === 'http5xx' ? 'HTTP_500' : 'TIMEOUT' } as any;
    });
    const r = await m.enviar(token);
    expect(r.status).toBe(kind === 'disconnected' ? 'nao_solicitado' : 'desconhecido');
    expect(r.providerMessageId).toBeNull(); expect(r.motivo).not.toMatch(/telephone|sql|tenant/);
    expect(m.state.tables.whatsapp_outbox[0].status).not.toBe('pendente');
    await m.enviar(token); expect(m.send).toHaveBeenCalledTimes(1);
  });
  it.each(['CAS', 'readbackOwner', 'readbackStatus', 'insertFailure'])('persistência %s não confirma falso aceite', async kind => {
    const m = memory(), token = await m.previewToken();
    if (kind === 'CAS') m.state.failCAS = true;
    if (kind === 'insertFailure') m.state.failInsert = true;
    if (kind.startsWith('readback')) m.state.responsePatch = (c, r) => {
      if (c.table === 'whatsapp_outbox' && c.op === 'select' && Array.isArray(r.data) && r.data[0]?.status === 'enviado') {
        if (kind === 'readbackOwner') r.data[0].user_id = 2; else r.data[0].status = 'desconhecido';
      }
    };
    const r = await m.enviar(token); expect(r.status).toBe('desconhecido'); expect(r.providerMessageId).toBeNull();
    expect(m.history).not.toHaveBeenCalled();
    if (kind === 'insertFailure') expect(m.send).not.toHaveBeenCalled();
  });
  it('histórico falho preserva aceite durável na outbox sem retry', async () => {
    const m = memory(), token = await m.previewToken(); m.history.mockRejectedValueOnce(new Error('private history'));
    const r = await m.enviar(token); expect(r.status).toBe('aceito_evolution'); expect(r.motivo).toContain('histórico indisponível');
    await m.enviar(token); expect(m.send).toHaveBeenCalledTimes(1);
  });
  it('log entregue sem providerID nunca inventa entrega', async () => {
    const m = memory(), row = row64({ provider_message_id: null });
    m.state.tables.whatsapp_outbox.push(row);
    m.state.tables.notificacoes_log.push({ id: 1, user_id: UID, outbox_id: row.id, tipo: row.tipo,
      parcela_id: row.parcela_id, cliente_id: row.cliente_id, status: 'entregue' });
    expect((await m.prepare()).items[0].registro!.status).toBe('desconhecido');
    expect(m.send).not.toHaveBeenCalled();
  });
  it.each(['owner', 'parcela', 'cliente', 'tipo', 'outboxId'])('recibo com vínculo %s contraditório falha fechado, sem enviar', async kind => {
    const m = memory(), row = row64(); m.state.tables.whatsapp_outbox.push(row);
    m.state.responsePatch = (c, r) => {
      if (c.table === 'notificacoes_log') {
        const log = { id: 1, user_id: UID, outbox_id: row.id, tipo: row.tipo,
          parcela_id: row.parcela_id, cliente_id: row.cliente_id, status: 'lido' };
        if (kind === 'owner') log.user_id = 2;
        if (kind === 'parcela') log.parcela_id = 999;
        if (kind === 'cliente') log.cliente_id = 999;
        if (kind === 'tipo') log.tipo = 'outro';
        if (kind === 'outboxId') log.outbox_id = randomUUID();
        r.data = [log]; r.count = 1;
      }
    };
    await expect(m.prepare()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(m.send).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'changedBeforePost', 'leaseExpired'])('callback barra %s sem POST', async kind => {
    const m = memory(), token = await m.previewToken();
    m.state.beforeQuery = c => {
      if (c.table !== 'whatsapp_outbox' || c.op !== 'select' || !c.eq.some(([k, v]) => k === 'status' && v === 'enviando')) return;
      if (kind === 'cancel') m.state.tables.whatsapp_outbox[0].status = 'cancelado';
      if (kind === 'changedBeforePost') m.state.snapshot.items[0].cliente.nome = 'alterado antes do POST';
      if (kind === 'leaseExpired') m.state.tables.whatsapp_outbox[0].lease_expira_em = NOW.toISOString();
    };
    const r = await m.enviar(token); expect(['nao_solicitado', 'desconhecido']).toContain(r.status);
    expect(m.state.post).not.toHaveBeenCalled(); expect(m.state.calls.some(c => c.op === 'update' && c.payload.status === 'pendente')).toBe(false);
  });
  it.each(['enviando', 'expired', 'pendente', 'falhou', 'desconhecido', 'missingID', 'entregue', 'lido'])('reconsulta %s é somente leitura e não infere entrega', async kind => {
    const m = memory();
    const row = row64();
    if (kind === 'enviando') { row.status = 'enviando'; row.provider_message_id = null; row.lease_expira_em = new Date(NOW.getTime() + 90000).toISOString(); }
    else if (kind === 'expired') { row.status = 'enviando'; row.provider_message_id = null; row.lease_expira_em = NOW.toISOString(); }
    else if (kind === 'missingID') row.provider_message_id = null;
    else if (kind !== 'entregue' && kind !== 'lido') row.status = kind;
    m.state.tables.whatsapp_outbox.push(row);
    if (kind === 'entregue' || kind === 'lido') m.state.tables.notificacoes_log.push({ id: 1, user_id: UID, outbox_id: row.id,
      tipo: row.tipo, parcela_id: row.parcela_id, cliente_id: row.cliente_id, status: kind });
    const r = (await m.prepare()).items[0]; expect(r.estado).toBe('registrado');
    const expected = kind === 'enviando' ? 'em_processamento' : kind === 'falhou' ? 'nao_solicitado' : ['entregue', 'lido'].includes(kind) ? kind : 'desconhecido';
    expect(r.registro!.status).toBe(expected);
    expect(m.state.calls.every(c => c.op === 'select')).toBe(true); expect(m.send).not.toHaveBeenCalled();
  });
});

describe('router callers auth64', () => {
  const caller = (id: any = UID, cookie: string | undefined = COOKIE) => cobrancaLista64Router.createCaller({ user: id === null ? null : { id } as any, req: { headers: { cookie } } as any, res: {} as any });
  it.each([null, 0, -1, 1.5, 2147483648, '1'])('auth owner inválido %s impede banco/provedor', async id => {
    await expect(caller(id).preparar({ contratoIds: [CID], tipo: 'preventivo' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.evolution).not.toHaveBeenCalled();
  });
  it('cookie de sessão obrigatório e input strict antes de serviço', async () => {
    await expect(caller(UID, '').preparar({ contratoIds: [CID], tipo: 'preventivo' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller().enviar({ token: 'x', confirmar: false } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller().preparar({ contratoIds: [CID], tipo: 'preventivo', userId: 2 } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it('preparar e conferir usam reader real sem envio e sem writes', async () => {
    const m = memory(); mocks.db.mockResolvedValue(m.sb);
    const input = { contratoIds: [CID], tipo: 'preventivo' as const };
    expect((await caller().preparar(input)).items[0].estado).toBe('pronto');
    expect((await caller().conferir(input)).items[0].estado).toBe('pronto');
    expect(m.sb.rpc).toHaveBeenCalledTimes(2); expect(m.state.calls.every(c => c.op === 'select')).toBe(true);
    expect(mocks.evolution).not.toHaveBeenCalled();
  });
  it('enviar autenticado usa confirmação e Evolution mock, sem envio real', async () => {
    const m = memory(); mocks.db.mockResolvedValue(m.sb);
    const token = (await caller().preparar({ contratoIds: [CID], tipo: 'preventivo' })).items[0].token!;
    mocks.evolution.mockResolvedValue({ ok: false, disposition: 'nao_solicitado', erroCodigo: 'DISCONNECTED' });
    expect((await caller().enviar({ token, confirmar: true })).status).toBe('nao_solicitado');
    expect(mocks.evolution).toHaveBeenCalledTimes(1); expect(m.state.post).not.toHaveBeenCalled();
  });
  it('backend/segredo ausente falha fechado com mensagem sanitizada', async () => {
    mocks.db.mockRejectedValueOnce(new Error('segredo sql telephone tenant'));
    const error: any = await caller().preparar({ contratoIds: [CID], tipo: 'preventivo' }).catch(e => e);
    expect(error.code).toBe('PRECONDITION_FAILED'); expect(error.message).not.toMatch(/segredo|sql|telephone|tenant/);
    const m = memory(); mocks.db.mockResolvedValue(m.sb); ENV.cookieSecret = '';
    await expect(caller().preparar({ contratoIds: [CID], tipo: 'preventivo' })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(m.sb.rpc).not.toHaveBeenCalled();
  });
});
