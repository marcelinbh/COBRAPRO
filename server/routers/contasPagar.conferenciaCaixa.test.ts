import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ fonte: vi.fn(), conferir: vi.fn() }));
vi.mock('../db', () => ({ getSupabaseClientAsync: h.fonte }));
vi.mock('../services/conferenciaDespesasCaixa', () => ({ conferirDespesasCaixa: h.conferir }));
import { contasPagarRouter } from './contasPagar';
const input = { leituraId: '00000000-0000-4000-8000-000000000001', contaCaixaId: 4 };
const caller = (id = 41) => contasPagarRouter.createCaller({ user: { id } as any, req: {} as any, res: {} as any });
beforeEach(() => { vi.clearAllMocks(); });
describe('conferirCaixa: leitura autenticada sem writer', () => {
  it('deriva tenant apenas do contexto e nonce não integra prova financeira', async () => {
    const fonte = { from: vi.fn(), rpc: vi.fn() };
    const resposta = { empresaId: 41, somenteLeitura: true, autorizaCorrecao: false };
    h.fonte.mockResolvedValue(fonte); h.conferir.mockResolvedValue(resposta);
    expect(await caller().conferirCaixa(input)).toBe(resposta);
    expect(h.conferir).toHaveBeenCalledTimes(1); expect(h.conferir).toHaveBeenCalledWith(fonte, 41, 4);
    expect(fonte.rpc).not.toHaveBeenCalled();
  });
  it.each([{ userId: 99 }, { user_id: 99 }, { saldo: '100.00' }, { corrigir: true }])('rejeita campos extras %j antes da fonte', async extra => {
    await expect(caller().conferirCaixa({ ...input, ...extra } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(h.fonte).not.toHaveBeenCalled(); expect(h.conferir).not.toHaveBeenCalled();
  });
  it('não exige flags de novas escritas para consultar evidências', async () => {
    const fonte = {}; h.fonte.mockResolvedValue(fonte); h.conferir.mockResolvedValue({ empresaId: 41 });
    await caller().conferirCaixa({ leituraId: input.leituraId });
    expect(h.conferir).toHaveBeenCalledTimes(1); expect(h.conferir).toHaveBeenCalledWith(fonte, 41, undefined);
  });
  it('sem sessão ou fonte não confunde falha com divergência zero', async () => {
    const semSessao = contasPagarRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    await expect(semSessao.conferirCaixa(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(h.fonte).not.toHaveBeenCalled();
    h.fonte.mockResolvedValue(null);
    await expect(caller().conferirCaixa(input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(h.conferir).not.toHaveBeenCalled();
  });
});
