import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { lerIntencao47, lerUltimoResultado47, enviarIntencao47, recuperarIntencao47, type Storage47 } from '../shared/reparcelamento47Fluxo';
import type { Reparcelamento47Execucao, Reparcelamento47Resultado } from '../shared/reparcelamento47';

// Synthetic local fixtures. No production IDs, HTTP, SQL or real financial operations.
const owner = 101;
const base = `cobrapro:reparcelar47:v2:empresa:${owner}`;
function fixture() {
  const input: Reparcelamento47Execucao = { contratoId: 201, numeroParcelas: 1, taxaJuros: '0.00', tipoTaxa: 'mensal',
    dataInicio: '2026-12-26', incluirMultas: false, cotacaoId: randomUUID(), cotacaoHash: 'a'.repeat(64), estadoHash: 'b'.repeat(64), idempotencyKey: randomUUID() };
  const result: Reparcelamento47Resultado = { success: true, regra: 'reparcelamento47_v2', userId: owner, idempotencyKey: input.idempotencyKey,
    operationId: randomUUID(), contratoOrigemId: 201, contratoId: 202, raizId: 201, contaCaixaId: 301, parcelasIds: [401],
    saldoTransferido: '10.00', principalOriginal: '10.00', jurosEmbutidos: '0.00', jurosNovos: '0.00', totalNovo: '10.00', desembolso: '0.00', repetida: false };
  return { input, result };
}
function memory() {
  const rows = new Map<string, string>();
  const storage: Storage47 = { getItem: k => rows.get(k) ?? null, setItem: (k,v) => { rows.set(k,v); }, removeItem: k => { rows.delete(k); } };
  return { rows, storage };
}
const locks = { request: async <T>(_name: string, callback: () => Promise<T>) => callback() };
function seed(storage: Storage47, input: Reparcelamento47Execucao, result: Reparcelamento47Resultado) {
  storage.setItem(`${base}:terminal:${input.idempotencyKey}`, JSON.stringify({ version: 2, owner, input, proof: { status: 'confirmed', result } }));
  storage.setItem(`${base}:ultimo-terminal`, JSON.stringify({ version: 2, owner, idempotencyKey: input.idempotencyKey }));
}
beforeEach(() => vi.stubGlobal('crypto', { randomUUID }));
afterEach(() => vi.unstubAllGlobals());

describe('Recibo47 local: apenas confirmação vinculada, sem replay', () => {
  it('uma confirmação sintética persiste recibo/índice e permite leitura sem novo envio ou escrita', async () => {
    const { storage, rows } = memory(); const { input, result } = fixture(); const send = vi.fn().mockResolvedValue(result);
    await enviarIntencao47(storage, locks, owner, randomUUID(), input, () => true, send);
    expect(send).toHaveBeenCalledTimes(1); expect(lerIntencao47(storage, owner)).toBeNull();
    const before = [...rows.entries()];
    expect(lerUltimoResultado47(storage, owner)).toEqual(result);
    expect([...rows.entries()]).toEqual(before); expect(send).toHaveBeenCalledTimes(1);
  });
  it('não enumera nem restaura recibos antigos sem índice', () => {
    const { storage } = memory(); const { input, result } = fixture(); seed(storage,input,result);
    storage.removeItem(`${base}:ultimo-terminal`);
    expect(lerUltimoResultado47(storage,owner)).toBeNull();
  });
  it('não lê o resultado da empresa anterior', () => {
    const { storage } = memory(); const { input, result } = fixture(); seed(storage,input,result);
    expect(lerUltimoResultado47(storage,owner+1)).toBeNull();
  });
  it.each(['owner', 'uuid', 'origin', 'money', 'count', 'receipt_missing', 'pointer_owner', 'extra_field'])('recusa recibo contraditório %s', kind => {
    const { storage } = memory(); const { input, result } = fixture(); const bad: any = { ...result };
    if (kind==='owner') bad.userId=owner+1;
    if (kind==='uuid') bad.idempotencyKey=randomUUID();
    if (kind==='origin') bad.contratoOrigemId=999;
    if (kind==='money') bad.totalNovo='11.00';
    if (kind==='count') bad.parcelasIds=[401,402];
    if (kind==='extra_field') bad.secret='not a valid result field';
    seed(storage,input,bad);
    if (kind==='receipt_missing') storage.removeItem(`${base}:terminal:${input.idempotencyKey}`);
    if (kind==='pointer_owner') storage.setItem(`${base}:ultimo-terminal`, JSON.stringify({version:2,owner:owner+1,idempotencyKey:input.idempotencyKey}));
    expect(() => lerUltimoResultado47(storage,owner)).toThrow();
  });
  it('intenção pendente tem precedência sobre confirmação anterior', async () => {
    const { storage } = memory(); const old = fixture(); seed(storage,old.input,old.result);
    const next = fixture();
    await expect(enviarIntencao47(storage,locks,owner,randomUUID(),next.input,()=>true,async()=>{throw Error('synthetic transport failure');})).rejects.toThrow();
    expect(lerIntencao47(storage,owner)).not.toBeNull(); expect(lerUltimoResultado47(storage,owner)).toBeNull();
  });
  it('fence posterior suprime confirmação antiga, sem apagar o recibo histórico', async () => {
    const { storage } = memory(); const old = fixture(); seed(storage,old.input,old.result);
    const next = fixture();
    await expect(enviarIntencao47(storage,locks,owner,randomUUID(),next.input,()=>true,async()=>{throw Error('synthetic');})).rejects.toThrow();
    await recuperarIntencao47(storage,locks,owner,randomUUID(),()=>true,async()=>({status:'not_executed',idempotencyKey:next.input.idempotencyKey}));
    expect(lerUltimoResultado47(storage,owner)).toBeNull();
    expect(storage.getItem(`${base}:terminal:${old.input.idempotencyKey}`)).not.toBeNull();
  });
  it('falha de persistência do índice preserva pending após envio sintético', async () => {
    const { storage } = memory(); const { input, result } = fixture();
    const set = storage.setItem; storage.setItem=(k,v)=>{if(k.endsWith(':ultimo-terminal'))throw Error('synthetic storage failure');set(k,v);};
    await expect(enviarIntencao47(storage,locks,owner,randomUUID(),input,()=>true,async()=>result)).rejects.toThrow('synthetic storage failure');
    expect(lerIntencao47(storage,owner)?.input.idempotencyKey).toBe(input.idempotencyKey);
    expect(lerUltimoResultado47(storage,owner)).toBeNull();
  });
  it('sem WebLocks não envia nem escreve', async () => {
    const { storage, rows } = memory(); const { input, result } = fixture(); const send=vi.fn().mockResolvedValue(result);
    await expect(enviarIntencao47(storage,undefined,owner,randomUUID(),input,()=>true,send)).rejects.toThrow('WebLocks');
    expect(send).not.toHaveBeenCalled();expect(rows.size).toBe(0);
  });
});
