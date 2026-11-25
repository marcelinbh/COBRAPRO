import { describe, it, expect, vi } from 'vitest';
import { COOKIE_NAME } from '../../shared/const';
import { sessionScope46, conferirSessao46, scopedQuote46, scopedIntent46, cotar46, executar46, type Client46 } from '../../server/services/calendarioWriter46';
const intent = { contratoId: 9, idempotencyKey: '10000000-0000-4000-8000-000000000046', estadoHash: 'a'.repeat(64), vencimentos: ['2031-01-28'], motivo: 'Calendário real' };
const quote = { contratoId: 9, estadoHash: intent.estadoHash, parcelasIds: [99], vencimentos: intent.vencimentos, regra: 'calendario_mensal_sem_baixa_v1' };
function client(data: unknown, error: { code?: string } | null = null) { const rpc = vi.fn().mockResolvedValue({ data, error }); return { rpc } as Client46 & { rpc: ReturnType<typeof vi.fn> }; }
function enabled() { process.env.ENABLE_CALENDARIO_0046 = 'true'; }
describe('writer46 serviço seguro — mocks de RPC, não RESTprod', () => {
  it('hash opaco muda por owner/token e não contém cookie', () => {
    const a = sessionScope46(1, `${COOKIE_NAME}=one`), b = sessionScope46(1, `${COOKIE_NAME}=two`), c = sessionScope46(2, `${COOKIE_NAME}=one`);
    expect(a).toMatch(/^[a-f0-9]{64}$/); expect(a).not.toContain('one'); expect(a).not.toBe(b); expect(a).not.toBe(c);
    expect(() => sessionScope46(1, '')).toThrow(); expect(() => conferirSessao46(a, b)).toThrow(); expect(() => conferirSessao46(a, a)).not.toThrow();
  });
  it('scoped bodies fechados não aceitam dono/origem/family', () => {
    expect(scopedQuote46.safeParse({ contratoId: 9, sessionScope: 'b'.repeat(64), userId: 2 }).success).toBe(false);
    expect(scopedIntent46.safeParse({ sessionScope: 'b'.repeat(64), intent: { ...intent, origem: 'prospectivo21' } }).success).toBe(false);
    expect(scopedIntent46.safeParse({ sessionScope: 'b'.repeat(64), intent, family: 'multimodal_receber' }).success).toBe(false);
  });
  it('flag OFF não chama backend nem fallback44', async () => {
    delete process.env.ENABLE_CALENDARIO_0046; const c = client(quote);
    await expect(cotar46(c, 77, { contratoId: 9 })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(c.rpc).not.toHaveBeenCalled();
  });
  it('cotar somente facade46 p_user_id servidor; eco exige contrato', async () => {
    enabled(); const c = client(quote); expect(await cotar46(c, 77, { contratoId: 9 })).toEqual(quote);
    expect(c.rpc).toHaveBeenCalledWith('rpc_cotar_calendario46', { p_user_id: 77, p_contrato_id: 9 });
    await expect(cotar46(client({ ...quote, contratoId: 10 }), 77, { contratoId: 9 })).rejects.toBeDefined();
    await expect(cotar46(c, 0, { contratoId: 9 })).rejects.toBeDefined();
  });
  it('execute e recovery conservam mesmos UUID/hash/dias sem scope no SQL', async () => {
    enabled(); const confirmed = { success: true, repetida: false, operationId: intent.idempotencyKey, idempotencyKey: intent.idempotencyKey, contratoId: 9, vencimentos: intent.vencimentos, regra: 'calendario_mensal_sem_baixa_v1' };
    const c = client(confirmed); expect((await executar46(c, 77, intent)).status).toBe('confirmed');
    const args = { p_user_id: 77, p_chave_idempotencia: intent.idempotencyKey, p_contrato_id: 9, p_estado_hash: intent.estadoHash, p_vencimentos: intent.vencimentos, p_motivo: intent.motivo };
    expect(c.rpc).toHaveBeenCalledWith('rpc_executar_calendario46', args);
    const d = client({ ...intent, status: 'fenced', regra: 'calendario44_fence_v1' }); expect((await executar46(d, 77, intent, true)).status).toBe('fenced'); expect(d.rpc).toHaveBeenCalledWith('rpc_conferir_calendario46', args);
  });
  it.each(['40001', '23505', '42501', '55000', 'PGRST202'])('erro%s não chama outro writer', async code => {
    enabled(); const c = client(null, { code }); await expect(executar46(c, 77, intent)).rejects.toBeDefined(); expect(c.rpc).toHaveBeenCalledOnce();
  });
  it('timeout/not_found/fence divergente não encerram journal', async () => {
    enabled(); const c = client(null); c.rpc.mockRejectedValue(Error('timeout')); await expect(executar46(c, 77, intent)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    await expect(executar46(client({ status: 'not_found' }), 77, intent, true)).rejects.toBeDefined();
    await expect(executar46(client({ ...intent, motivo: 'Outro payload', status: 'fenced', regra: 'calendario44_fence_v1' }), 77, intent, true)).rejects.toBeDefined();
  });
});
