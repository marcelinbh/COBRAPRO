import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { prepararLote64 } from './cobrancaLote64';
import { sessionScope51 } from './obrigacoes51Rpc';

const UID = 1, CID = 951, NOW = new Date('2026-11-27T15:00:00Z');
const SECRET = 'fixture65-noncredential-at-least-32-characters';
const SESSION = sessionScope51(UID, 'app_session_id=fixture65');
const source = JSON.parse(readFileSync(new URL('./fixtures/snapshot60-final05.json', import.meta.url), 'utf8'));

function sdkFixture(patch?: (response: any) => void) {
  const snapshot = structuredClone(source);
  snapshot.items = snapshot.items.filter((item: any) => [951, 952, 958].includes(item.id));
  const requests: { path: string; method: string; owner: string | null }[] = [];
  const fetchFixture = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.split('/').pop()!;
    const method = init?.method ?? 'GET';
    requests.push({ path, method, owner: url.searchParams.get('user_id') });
    const rpc = url.pathname.includes('/rpc/');
    expect(method).toBe(rpc ? 'POST' : 'GET'); // SDK RPC é leitura SQL; nenhum POST Evolution/outbox.
    const data = rpc ? snapshot : path === 'clientes'
      ? [{ id: 1, user_id: UID, whatsapp: '(11) 99999-9999', telefone: null }]
      : [];
    const count = Array.isArray(data) ? data.length : null;
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'content-type': 'application/json', ...(count === null ? {} : { 'content-range': `${count ? '0-0' : '*'}/${count}` }) },
    });
  });
  const real = createClient('https://fixture65.invalid', 'fixture65-noncredential', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchFixture },
  });
  const sb = patch ? {
    rpc: real.rpc.bind(real),
    from: (table: string) => {
      const wrap = (builder: any): any => new Proxy(builder, { get(target, key) {
        if (key === 'then') return (ok: any, fail: any) => target.then((response: any) => {
          if (table === 'whatsapp_outbox') patch(response);
          return ok(response);
        }, fail);
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? (...args: any[]) => wrap(value.apply(target, args)) : value;
      } });
      return wrap(real.from(table));
    },
  } : real;
  const prepare = (tipo: 'atraso' | 'preventivo') => prepararLote64(sb as any, UID, SESSION,
    { contratoIds: [CID], tipo }, { now: NOW, secret: SECRET });
  return { real, prepare, requests, fetchFixture };
}

describe('compatibilidade65 com envelope do Supabase instalado', () => {
  it('SDK real inclui success:true mesmo na leitura vazia', async () => {
    const f = sdkFixture();
    const response = await f.real.from('whatsapp_outbox').select('id', { count: 'exact' })
      .eq('user_id', UID).limit(1).range(0, 0);
    expect(response).toMatchObject({ success: true, data: [], error: null, count: 0, status: 200 });
  });
  it('contrato futuro selecionado como vencido retorna ignorado com o envelope real, sem contatos ou escrita', async () => {
    const f = sdkFixture();
    expect((await f.prepare('atraso')).items[0]).toMatchObject({ contratoId: CID, estado: 'ignorado', token: null, mensagem: null });
    expect(f.requests.map(r => r.path)).toEqual(['rpc_lista_emprestimos60', 'whatsapp_outbox']);
    expect(f.requests[1]).toMatchObject({ method: 'GET', owner: `eq.${UID}` });
  });
  it('prévia preventiva com SDK real passa todas as leituras own sem enviar', async () => {
    const f = sdkFixture();
    const item = (await f.prepare('preventivo')).items[0];
    expect(item).toMatchObject({ contratoId: CID, estado: 'pronto' });
    expect(item.token).toBeTruthy(); expect(item.mensagem).toContain('Valor registrado: R$ 50,00');
    expect(item.contatoMascarado).not.toContain('11999999999');
    expect(f.requests.map(r => r.path)).toEqual(['rpc_lista_emprestimos60', 'whatsapp_outbox', 'clientes', 'configuracoes']);
    expect(f.requests.slice(1).every(r => r.method === 'GET' && r.owner === `eq.${UID}`)).toBe(true);
  });
  it.each([false, null, 'true', 1])('não aceita success contraditório ou malformado: %j', async success => {
    const f = sdkFixture(response => { response.success = success; });
    await expect(f.prepare('atraso')).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(f.requests).toHaveLength(2);
  });
  it('continua recusando campos desconhecidos no envelope', async () => {
    const f = sdkFixture(response => { response.unexpected = true; });
    await expect(f.prepare('atraso')).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});
