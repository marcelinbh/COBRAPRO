import { readFileSync, writeFileSync } from 'node:fs';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { executarEtiqueta67 } from './etiquetasLista67';
import { resultadoEtiqueta67 } from '../../shared/emprestimosListaControles67';

// Base: SDK65 real + runtime/router67. Apenas transporte inerte; não executa SQL.
const UID = 4682, CID = 67001, HASH = 'a'.repeat(64);
type Acao = 'criar' | 'remover' | 'aplicar';
const ACOES: Acao[] = ['criar', 'remover', 'aplicar'];
const ARGS: Record<Acao, Record<string, unknown>> = {
  criar: { p_nome: 'TESTE LISTA67 28-11-2026', p_cor: '#6b7280' },
  remover: { p_id: '1' },
  aplicar: { p_contrato_id: CID, p_nomes: ['Prioridade72'], p_revisao: '0', p_estado_hash: HASH },
};
const expected = (acao: Acao) => ({ versao: 'etiquetas_lista67_v1', userId: UID, acao,
  id: acao === 'aplicar' ? null : '1', contratoId: acao === 'aplicar' ? CID : null,
  revisao: acao === 'aplicar' ? '1' : null });
const ERROR_CASES = [
  { code: '40001', status: 409, trpc: 'CONFLICT' },
  { code: '55P03', status: 409, trpc: 'CONFLICT' },
  { code: '23505', status: 409, trpc: 'CONFLICT' },
  { code: '42501', status: 403, trpc: 'PRECONDITION_FAILED' },
  { code: '22023', status: 400, trpc: 'PRECONDITION_FAILED' },
  { code: '23514', status: 400, trpc: 'PRECONDITION_FAILED' },
];
const nativeError = (code: string) => ({ code, message: `SQL67 ${code}`, details: null, hint: null });
const captures: unknown[] = [];
afterAll(() => {
  if (process.env.HOTFIX72_CAPTURE) writeFileSync(process.env.HOTFIX72_CAPTURE, JSON.stringify(captures, null, 2) + '\n');
});
let forbiddenFetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  forbiddenFetch = vi.fn(() => { throw new Error('NETWORK FORBIDDEN hotfix72'); });
  vi.stubGlobal('fetch', forbiddenFetch);
});
afterEach(() => {
  expect(forbiddenFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

function sdkFixture(acao: Acao, options: {
  patch?: (envelope: any) => void; rawPatch?: (body: any) => void;
  status?: number; failure?: { code: string; status: number };
  omitSuccess?: boolean;
} = {}) {
  const requests: { url: string; method: string; body: Record<string, unknown> }[] = [];
  const rawBodies: any[] = [], sdkResponses: any[] = [];
  const state = { catalogo: acao === 'remover'
    ? [{ user_id: UID, id: '1', nome: 'Prioridade72', cor: '#6b7280' }] : [] as any[],
    overlay: null as null | { user_id: number; contrato_id: number; etiquetas: string[]; revisao: string }, writes: 0 };
  const fetchFixture = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)), method = init?.method ?? 'GET';
    expect(url.origin).toBe('https://fixture72.invalid');
    expect(url.pathname).toBe(`/rest/v1/rpc/rpc_etiquetas_${acao}67`);
    expect(url.search).toBe(''); expect(method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ ...ARGS[acao], p_user_id: UID });
    requests.push({ url: String(url), method, body });
    let data: any;
    if (options.failure) data = nativeError(options.failure.code);
    else {
      // Shapes são os RETURN jsonb_build_object das linhas122/131/158 da migration67.
      // fakeSQL é somente estado JS: não é banco real nem comprovação de implementação SQL.
      if (acao === 'criar') state.catalogo.push({ user_id: body.p_user_id, id: '1', nome: body.p_nome, cor: body.p_cor });
      if (acao === 'remover') {
        expect(state.catalogo[0]).toMatchObject({ user_id: body.p_user_id, id: body.p_id });
        state.catalogo = [];
      }
      if (acao === 'aplicar') {
        expect(body.p_revisao).toBe('0'); expect(body.p_estado_hash).toBe(HASH);
        state.overlay = { user_id: UID, contrato_id: CID, etiquetas: body.p_nomes, revisao: String(BigInt(body.p_revisao) + 1n) };
      }
      state.writes++;
      data = expected(acao);
    }
    options.rawPatch?.(data); rawBodies.push(structuredClone(data));
    return new Response(JSON.stringify(data), {
      status: options.failure?.status ?? options.status ?? 200,
      statusText: options.failure ? 'SQL error' : 'OK', headers: { 'content-type': 'application/json' },
    });
  });
  const real = createClient('https://fixture72.invalid', 'fixture72-not-a-credential', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchFixture },
  });
  const client = { rpc: async (name: string, args: Record<string, unknown>) => {
    const response = await real.rpc(name, args);
    sdkResponses.push(structuredClone(response));
    captures.push({ acao, nativeCode: options.failure?.code ?? null,
      request: structuredClone(requests[0]), rawOutput: structuredClone(rawBodies[0]),
      sdkEnvelope: structuredClone(response), fakeSQLState: structuredClone(state) });
    if (options.omitSuccess) delete (response as any).success;
    options.patch?.(response);
    return response;
  } };
  const execute = (extra: Record<string, unknown> = {}) => executarEtiqueta67(client as any, UID, acao, { ...ARGS[acao], ...extra });
  const assertOne = () => { expect(fetchFixture).toHaveBeenCalledTimes(1); expect(requests).toHaveLength(1); };
  return { real, client, execute, requests, rawBodies, sdkResponses, state, fetchFixture, assertOne };
}
const FAIL = { code: 'INTERNAL_SERVER_ERROR', message: 'Resultado de etiquetas não confirmado. Atualize a consulta antes de tentar novamente.' };
async function refused(f: ReturnType<typeof sdkFixture>) {
  await expect(f.execute()).rejects.toMatchObject(FAIL); f.assertOne();
}

describe('72 SDK real instalado / envelopes e fakeSQL inerte', () => {
  it('usa versões reais 2.118.0 de Supabase e PostgREST, não mock dos módulos', () => {
    const supabase = JSON.parse(readFileSync(require.resolve('@supabase/supabase-js/package.json'), 'utf8'));
    const pgPath = require.resolve('@supabase/postgrest-js/package.json', { paths: [require.resolve('@supabase/supabase-js')] });
    const postgrest = JSON.parse(readFileSync(pgPath, 'utf8'));
    expect(supabase.version).toBe('2.118.0'); expect(postgrest.version).toBe('2.118.0');
  });
  it.each(ACOES)('SDK real %s produz success:true e output versao67 estrito', async acao => {
    const f = sdkFixture(acao), response = await f.real.rpc(`rpc_etiquetas_${acao}67`, { ...ARGS[acao], p_user_id: UID });
    expect(response).toEqual({ success: true, data: expected(acao), error: null, count: null, status: 200, statusText: 'OK' });
    expect(resultadoEtiqueta67.parse(response.data)).toEqual(expected(acao)); f.assertOne(); expect(f.state.writes).toBe(1);
  });
  it.each(ERROR_CASES)('erro nativo $code vem REALMENTE com success:false', async failure => {
    const f = sdkFixture('aplicar', { failure }), response = await f.real.rpc('rpc_etiquetas_aplicar67', { ...ARGS.aplicar, p_user_id: UID });
    expect(response).toEqual({ success: false, data: null, error: nativeError(failure.code), count: null, status: failure.status, statusText: 'SQL error' });
    f.assertOne(); expect(f.state.writes).toBe(0);
  });
});

describe('72 regressão do serviço — verde somente com literal true optional', () => {
  it.each(ACOES.flatMap(acao => [200, 201].map(status => ({ acao, status }))))('confirma $acao HTTP$status sem retry', async ({ acao, status }) => {
    const f = sdkFixture(acao, { status });
    await expect(f.execute()).resolves.toEqual(expected(acao)); f.assertOne();
    expect(f.rawBodies).toEqual([expected(acao)]); expect(f.sdkResponses[0].success).toBe(true);
    expect(f.state.writes).toBe(1);
    if (acao === 'criar') expect(f.state.catalogo).toEqual([{ user_id: UID, id: '1', nome: ARGS.criar.p_nome, cor: '#6b7280' }]);
    if (acao === 'remover') expect(f.state.catalogo).toEqual([]);
    if (acao === 'aplicar') expect(f.state.overlay).toEqual({ user_id: UID, contrato_id: CID, etiquetas: ['Prioridade72'], revisao: '1' });
  });
  it('owner do serviço sobrescreve p_user_id externo sem alterar args', async () => {
    const f = sdkFixture('criar'), args = { ...ARGS.criar, p_user_id: 999 };
    await expect(executarEtiqueta67(f.client as any, UID, 'criar', args)).resolves.toEqual(expected('criar'));
    expect(args.p_user_id).toBe(999); f.assertOne();
  });
  it.each(ACOES)('compatibilidade %s: envelope antigo sem success continua válido', async acao => {
    const f = sdkFixture(acao, { omitSuccess: true }); await expect(f.execute()).resolves.toEqual(expected(acao)); f.assertOne();
  });
  it.each(ACOES.flatMap(acao => [false, null, 'true', 1].map(success => ({ acao, success }))))('recusa $acao success=$success', async ({ acao, success }) => {
    await refused(sdkFixture(acao, { patch: r => { r.success = success; } }));
  });
  it.each(ACOES)('recusa %s envelope unknownfield', async acao => {
    await refused(sdkFixture(acao, { patch: r => { r.unknownfield = true; } }));
  });
  const envelopeBad = [
    { label: 'error ausente', mutate: (r: any) => { delete r.error; } },
    { label: 'error malformado', mutate: (r: any) => { r.error = {}; } },
    { label: 'error string', mutate: (r: any) => { r.error = '40001'; } },
    { label: 'error unknownfield', mutate: (r: any) => { r.error = { ...nativeError('40001'), unknownfield: true }; } },
    { label: 'status string', mutate: (r: any) => { r.status = '200'; } },
    { label: 'status fracionário', mutate: (r: any) => { r.status = 200.1; } },
    { label: 'status 199', mutate: (r: any) => { r.status = 199; } },
    { label: 'status 300', mutate: (r: any) => { r.status = 300; } },
    { label: 'count número', mutate: (r: any) => { r.count = 1; } },
    { label: 'statusText não string', mutate: (r: any) => { r.statusText = null; } },
  ];
  it.each(envelopeBad)('continua estrito: $label', async ({ mutate }) => { await refused(sdkFixture('aplicar', { patch: mutate })); });
  const resultBad = [
    { label: 'versao desconhecida', acao: 'aplicar', mutate: (r: any) => { r.versao = 'etiquetas_lista67_v2'; } },
    { label: 'versao ausente', acao: 'criar', mutate: (r: any) => { delete r.versao; } },
    ...ACOES.map(acao => ({ label: `owner externo ${acao}`, acao, mutate: (r: any) => { r.userId = UID + 1; } })),
    ...ACOES.map(acao => ({ label: `acao mismatch ${acao}`, acao, mutate: (r: any) => { r.acao = acao === 'criar' ? 'remover' : 'criar'; } })),
    ...ACOES.map(acao => ({ label: `result unknownfield ${acao}`, acao, mutate: (r: any) => { r.unknownfield = true; } })),
    { label: 'criar id null', acao: 'criar', mutate: (r: any) => { r.id = null; } },
    { label: 'criar id number', acao: 'criar', mutate: (r: any) => { r.id = 1; } },
    { label: 'criar contratoId preenchido', acao: 'criar', mutate: (r: any) => { r.contratoId = CID; } },
    { label: 'criar revisao preenchida', acao: 'criar', mutate: (r: any) => { r.revisao = '1'; } },
    { label: 'remover id mismatch', acao: 'remover', mutate: (r: any) => { r.id = '2'; } },
    { label: 'remover revisao preenchida', acao: 'remover', mutate: (r: any) => { r.revisao = '1'; } },
    { label: 'aplicar id não null', acao: 'aplicar', mutate: (r: any) => { r.id = '1'; } },
    { label: 'aplicar contratoId mismatch', acao: 'aplicar', mutate: (r: any) => { r.contratoId = CID + 1; } },
    { label: 'aplicar rev stale', acao: 'aplicar', mutate: (r: any) => { r.revisao = '0'; } },
    { label: 'aplicar rev jump', acao: 'aplicar', mutate: (r: any) => { r.revisao = '2'; } },
    { label: 'aplicar rev number', acao: 'aplicar', mutate: (r: any) => { r.revisao = 1; } },
    { label: 'aplicar rev null', acao: 'aplicar', mutate: (r: any) => { r.revisao = null; } },
  ];
  it.each(resultBad)('result/owner/acao/CAS intactos: $label', async ({ acao, mutate }) => {
    await refused(sdkFixture(acao as Acao, { rawPatch: mutate }));
  });
  it.each(ERROR_CASES)('preserva erro nativo legado sem discriminador $code → $trpc', async failure => {
    const f = sdkFixture('aplicar', { failure, omitSuccess: true });
    await expect(f.execute()).rejects.toMatchObject({ code: failure.trpc }); f.assertOne(); expect(f.state.writes).toBe(0);
  });
  it('não faz retry nem escrita adicional depois de resposta estranha', async () => {
    const f = sdkFixture('criar', { patch: r => { r.unknownfield = true; } });
    await refused(f); expect(f.state.writes).toBe(1);
  });
  it('owner inválido e client ausente recusam sem transporte', async () => {
    const f = sdkFixture('criar');
    await expect(executarEtiqueta67(f.client as any, 0, 'criar', ARGS.criar)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(executarEtiqueta67(null, UID, 'criar', ARGS.criar)).rejects.toMatchObject(FAIL);
    expect(f.fetchFixture).not.toHaveBeenCalled();
  });
});

// Limitação existente: success:false nativo continua recusado antes do mapping legado.
// Diagnóstico com expectativa de mapping preservado fora do ROOT em SDK72-RESULT.md/outputs.
// Este hotfix de confirmação não altera classificação de erros nem admite false como sucesso.
describe('72 erro nativo SDK REAL permanece fail-closed (limite explícito)', () => {
  it.each(ERROR_CASES)('SDK error nativo $code permanece genérico, sem retry ou escrita', async failure => {
    const f = sdkFixture('aplicar', { failure });
    const actual = await f.execute().then(value => ({ unexpectedSuccess: value }), error => error);
    f.assertOne(); expect(f.state.writes).toBe(0);
    expect(actual).toMatchObject(FAIL);
  });
});
