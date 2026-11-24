import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CancelamentoPendenteStore, validarCancelamentoPendente, validarRecoveryCancelamento, cancelamentoPendenteInput } from '../../../shared/despesaCancelamentoPendente';
import { executarCancelamentoPendente } from '../../../server/services/despesaCancelamentoPendente';
import { contasPagarRouter } from '../../../server/routers/contasPagar';
import { isOwnedKey38 } from '../../../shared/despesas38Original';
const h = vi.hoisted(() => ({ source: vi.fn() }));
vi.mock('../../../server/db.ts', () => ({ getSupabaseClientAsync: h.source }));
const key = '11111111-1111-4111-8111-111111111111', origin = '22222222-2222-4222-8222-222222222222';
const input = { idempotencyKey: key, despesaId: 18, origemOperationId: origin, motivo: 'Obrigação duplicada' };
const result = { contrato: 'despesa_cancelamento_pendente_v1', success: true, acao: 'cancelarPendente', userId: 1, ...input, operationId: '33333333-3333-4333-8333-333333333333', status: 'cancelado', valor: '9999999999999.99', instante: '2026-11-24T18:00:00.123456+00:00', semMovimentoCaixa: true };
const request = { despesaId: input.despesaId, origemOperationId: origin, motivo: input.motivo };
const proof = (status = 'confirmed') => ({ contrato: result.contrato, userId: 1, idempotencyKey: key, request, status, result: status === 'confirmed' ? result : null, fence: null });
const caller = (user: any = { id: 1 }) => contasPagarRouter.createCaller({ user, req: {} as any, res: {} as any });
function disk() { const data = new Map<string, string>(); return { data, getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string, v: string) => { data.set(k, v); }) }; }
function source(data: any = result) { const rpc = vi.fn().mockResolvedValue({ data, error: null }); const value = { schema: vi.fn(), rpc, from: vi.fn() }; h.source.mockResolvedValue(value); return { ...value, rpcIsolated: rpc }; }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('ENABLE_RPC_CANCELAMENTO_PENDENTE_V1', 'true'); });
afterEach(() => vi.unstubAllEnvs());
describe('contrato strict separado: não inventa despesas38_v1', () => {
  it('prova owner/UUID/despesa/origem/motivo, sem perda de centavos', () => { expect(validarCancelamentoPendente(result, 1, input)).toEqual(result); expect(validarRecoveryCancelamento(proof(), 1, input).result).toEqual(result); });
  it.each([{ userId: 2 }, { idempotencyKey: origin }, { despesaId: 19 }, { origemOperationId: key }, { motivo: 'Outro' }, { semMovimentoCaixa: false }, { extra: true }, { valor: 0.1 }, { valor: '01.00' }, { status: 'pago' }, { acao: 'cancelar38' }])('rejeita confirmação incompatível %j', patch => { expect(() => validarCancelamentoPendente({ ...result, ...patch }, 1, input)).toThrow(); });
  it('ausência é UNKNOWN sem fence/closure; proof fingida é rejeitada', () => {
    expect(validarRecoveryCancelamento(proof('unknown'), 1, input).status).toBe('unknown');
    for (const p of [{ ...proof(), result: null }, { ...proof('unknown'), result }, { ...proof(), status: 'not_executed' }, { ...proof(), request: { ...request, despesaId: 19 } }]) expect(() => validarRecoveryCancelamento(p, 1, input)).toThrow();
  });
  it('input não recebe owner, dinheiro, conta nem recorrência', () => { for (const p of [{ userId: 2 }, { user_id: 2 }, { valor: '1.00' }, { contaCaixaId: 4 }, { recorrente: true }]) expect(cancelamentoPendenteInput.safeParse({ ...input, ...p }).success).toBe(false); });
  it('namespace38 preservado owner-bound sem adotar o request histórico', () => { expect(isOwnedKey38('cobrapro:despesas:0038:v38:user:1:ui:contas', 1)).toBe(true); expect(isOwnedKey38('cobrapro:despesas:0038:v38:user:11:ui:contas', 1)).toBe(false); expect(isOwnedKey38('cobrapro:despesas38:successor-postreset-v1:user:1:uuid:a', 1)).toBe(true); });
});
describe('store terminal independente da lista e gate, sem descarte', () => {
  it('persiste antes do envio e reload mantém MESMA chave/payload; confirmação não apaga', () => {
    const d = disk(), s = new CancelamentoPendenteStore(1, d); const o = s.begin(request, () => key); expect(s.read()).toEqual(o);
    const reload = new CancelamentoPendenteStore(1, d); expect(reload.read()).toEqual(o); expect(reload.confirmed(result)).toEqual(result); expect(reload.read()).toEqual(o); expect(() => reload.begin({ ...request, motivo: 'Outra' })).toThrow(); expect(d.data.size).toBe(1);
  });
  it('outro owner nunca lê payload alheio', () => { const d = disk(); new CancelamentoPendenteStore(1, d).begin(request, () => key); d.getItem.mockClear(); expect(new CancelamentoPendenteStore(2, d).read()).toBeNull(); expect(d.getItem).toHaveBeenCalledWith('cobrapro:despesa-cancelamento-pendente:v1:user:2:original'); });
  it.each(['quota', 'silentdrop', 'writeThenThrow'])('falha %s não libera UUID substituta nem writer', mode => {
    const d = disk(); if (mode === 'quota') d.setItem.mockImplementation(() => { throw new Error('quota'); }); if (mode === 'silentdrop') d.setItem.mockImplementation(() => {}); if (mode === 'writeThenThrow') d.setItem.mockImplementation((k, v) => { d.data.set(k, v); throw new Error('after'); });
    const s = new CancelamentoPendenteStore(1, d); expect(() => s.begin(request, () => key)).toThrow(); expect(s.blocked).toBe(true); expect(s.read()?.input.idempotencyKey).toBe(key); expect(s.acquire()).toBeNull(); expect(() => s.begin(request, () => origin)).toThrow();
  });
  it('corrupção local e divergência permanecem fechadas, original conhecido não é apagado', () => { const d = disk(), s = new CancelamentoPendenteStore(1, d); s.begin(request, () => key); d.data.set(s.key, '{}'); expect(s.read()?.input.idempotencyKey).toBe(key); expect(s.blocked).toBe(true); expect(d.data.get(s.key)).toBe('{}'); });
  it('locks são compartilhados entre wrappers do mesmo owner/storage', () => { const d=disk(), a=new CancelamentoPendenteStore(1,d), b=new CancelamentoPendenteStore(1,d); a.begin(request,()=>key); const lock=a.acquire()!; expect(b.acquire()).toBeNull(); b.release(Symbol()); expect(b.acquire()).toBeNull(); a.release(lock); expect(b.acquire()).not.toBeNull(); });
  it('release libera apenas o handle próprio, double send recusado', () => { const d = disk(), s = new CancelamentoPendenteStore(1, d); s.begin(request, () => key); const lock = s.acquire()!; expect(s.acquire()).toBeNull(); s.release(Symbol()); expect(s.acquire()).toBeNull(); s.release(lock); expect(s.acquire()).not.toBeNull(); });
});
describe('router real e adapter isolado, mocks SOMENTE de transporte', () => {
  it('flag vem do banco a cada consulta sem snapshot de inicialização', async () => {
    const cap = { contrato: result.contrato, habilitado: false, somentePendente20: true, edicao: false, exclusao: false, recorrencia: false };
    const c=source(cap);expect(await caller().capacidadesCancelamentoPendente()).toEqual(cap);
    c.rpc.mockResolvedValueOnce({data:{...cap,habilitado:true},error:null});expect((await caller().capacidadesCancelamentoPendente()).habilitado).toBe(true);
    c.rpc.mockResolvedValueOnce({data:cap,error:null});expect((await caller().capacidadesCancelamentoPendente()).habilitado).toBe(false);
    expect(c.rpc.mock.calls.map(x=>x[0])).toEqual(Array(3).fill('rpc_capacidades_cancelamento_despesa38c'));expect(c.schema).not.toHaveBeenCalled();
  });
  it('writer rejeita flagOFF autoritativa com 55000, sem REST fallback',async()=>{const c=source();c.rpc.mockResolvedValueOnce({data:null,error:{code:'55000'}});await expect(caller().cancelarPendente(input)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});expect(c.from).not.toHaveBeenCalled();});
  it('ctx.user é o único owner e schema/rpc são fechados; zero REST writer', async () => { const c = source(); expect(await caller().cancelarPendente(input)).toEqual(result); expect(c.schema).not.toHaveBeenCalled(); expect(c.rpcIsolated).toHaveBeenCalledTimes(1); expect(c.rpcIsolated).toHaveBeenCalledWith('rpc_cancelar_despesa_pendente38c', { p_user_id: 1, p_chave: key, p_despesa_id: 18, p_origem_operation_id: origin, p_motivo: input.motivo }); expect(c.from).not.toHaveBeenCalled(); expect(c.rpc).toHaveBeenCalledTimes(1); });
  it('recovery é permitido com gateOFF sem chamar writer', async () => { vi.stubEnv('ENABLE_RPC_CANCELAMENTO_PENDENTE_V1', 'false'); const c = source(proof()); expect(await caller().recuperarCancelamentoPendente(input)).toEqual(proof()); expect(c.rpcIsolated.mock.calls[0][0]).toBe('rpc_recuperar_cancelamento_despesa38c'); });
  it('auth e spoof recusados antes da fonte', async () => { await expect(caller(null).cancelarPendente(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' }); await expect(caller().cancelarPendente({ ...input, userId: 2 } as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' }); expect(h.source).not.toHaveBeenCalled(); });
  it('timeout/prova truncada/schema não exposto não confirmam', async () => {
    const c = source(); c.rpcIsolated.mockRejectedValueOnce(new Error('timeout')); await expect(executarCancelamentoPendente(c, 1, input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    c.rpcIsolated.mockResolvedValueOnce({ data: { success: true }, error: null }); await expect(executarCancelamentoPendente(c, 1, input)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    c.rpcIsolated.mockResolvedValueOnce({ data: null, error: { code: 'PGRST106' } }); await expect(executarCancelamentoPendente(c, 1, input)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(c.from).not.toHaveBeenCalled();
  });
  it.each(['editar', 'update', 'cancelar', 'excluir', 'recorrencia', 'sincronizarCaixa'] as const)('entrada genérica %s continua bloqueada', async action => { await expect(caller()[action]({ id: 18 })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' }); expect(h.source).not.toHaveBeenCalled(); });
});
describe('closure terminal com prova e CAS, sem reset/DELETE',()=>{
  const fenced=()=>({...proof('not_executed'),fence:{fenceId:'44444444-4444-4444-8444-444444444444',instante:result.instante}});
  it.each(['confirmed','not_executed'])('fecha %s e permite segunda intenção no MESMO store/reload, preservando recibo',status=>{
    const d=disk(),s=new CancelamentoPendenteStore(1,d),o=s.begin(request,()=>key),lock=s.acquire()!;
    const evidence=status==='confirmed'?proof():fenced();s.close(lock,o,evidence);expect(s.read()).toBeNull();expect(d.data.size).toBe(2);
    expect(()=>s.begin(request,()=>origin)).toThrow();s.release(lock);
    const reloaded=new CancelamentoPendenteStore(1,d);expect(reloaded.read()).toBeNull();const next=reloaded.begin({...request,despesaId:19},()=>origin);expect(next.input.idempotencyKey).toBe(origin);expect(d.data.size).toBe(2);
    const receipt=JSON.parse(d.data.get(s.key+':encerrada:'+key)!);expect(receipt.encerrada).toEqual(o);expect(receipt.prova).toEqual(evidence);
    expect(()=>reloaded.close(Symbol(),o,evidence)).toThrow();expect(reloaded.read()).toEqual(next);
  });
  it('recusa close sem lock, wrong lock, unknown, payload divergente e fence incompleta',()=>{
    const d=disk(),s=new CancelamentoPendenteStore(1,d),o=s.begin(request,()=>key);expect(()=>s.close(Symbol(),o,proof())).toThrow();const lock=s.acquire()!;
    for(const evidence of [proof('unknown'),{...proof(),userId:2},{...proof(),request:{...request,motivo:'Outra'}},{...fenced(),fence:null}])expect(()=>s.close(lock,o,evidence)).toThrow();
    expect(()=>s.close(lock,{...o,input:{...o.input,motivo:'Outra'}},proof())).toThrow();expect(s.read()).toEqual(o);expect(d.data.size).toBe(1);
  });
  it('CAS alterado durante rede impede closure e bloqueia qualquer nova intenção',()=>{
    const d=disk(),s=new CancelamentoPendenteStore(1,d),o=s.begin(request,()=>key),lock=s.acquire()!;d.data.set(s.key,JSON.stringify({...o,input:{...o.input,motivo:'Alterado'}}));expect(()=>s.close(lock,o,proof())).toThrow();expect(s.blocked).toBe(true);expect(d.data.size).toBe(1);s.release(lock);expect(()=>s.begin(request,()=>origin)).toThrow();
  });
  it.each(['quotaReceipt','silentReceipt','headThrow','headSilent','writeThenThrow'])('falha %s não libera original nem substituta',mode=>{
    const d=disk(),s=new CancelamentoPendenteStore(1,d),o=s.begin(request,()=>key),lock=s.acquire()!;d.setItem.mockImplementation((k,v)=>{
      if(k!==s.key){if(mode==='quotaReceipt')throw Error('quota');if(mode==='silentReceipt')return;d.data.set(k,v);return;}
      if(mode==='headThrow')throw Error('head');if(mode==='headSilent')return;d.data.set(k,v);if(mode==='writeThenThrow')throw Error('after');
    });expect(()=>s.close(lock,o,proof())).toThrow();expect(s.blocked).toBe(true);s.release(lock);expect(()=>s.begin(request,()=>origin)).toThrow();
  });
  it('recibo conflitante ou removido e UUID terminal reutilizada ficam fechados',()=>{
    const d=disk(),s=new CancelamentoPendenteStore(1,d),o=s.begin(request,()=>key),lock=s.acquire()!;s.close(lock,o,proof());s.release(lock);expect(()=>s.begin(request,()=>key)).toThrow();expect(s.blocked).toBe(true);
    const d2=disk(),s2=new CancelamentoPendenteStore(1,d2),o2=s2.begin(request,()=>key),l=s2.acquire()!;d2.data.set(s2.key+':encerrada:'+key,'{}');expect(()=>s2.close(l,o2,proof())).toThrow();expect(s2.blocked).toBe(true);
  });
});
