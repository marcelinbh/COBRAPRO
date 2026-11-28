import { describe, expect, it, vi } from 'vitest';
import { fixture67 } from './fixture67';
import { listarEmprestimosSnapshot67, mapearSnapshot67, RPC67 } from '../../server/services/snapshot67-reader';
import { mapearSnapshot60 } from '../../server/services/snapshot60-reader';
import { executarEtiqueta67 } from '../../server/services/etiquetasLista67';
import { aplicarEtiquetasInput67, criarEtiquetaInput67 } from '../../shared/emprestimosListaControles67';
describe('Controles67 runtime: organização paralela e fonte60 intacta', () => {
  it('preserva finance60, resumo63, placeholder sem PII; uma RPC sem from', async () => {
    const f = fixture67(), baseline = mapearSnapshot60(f.lista60, 41), rpc = vi.fn(async () => ({ data: f, error: null, status: 200 })), from = vi.fn();
    const data = await listarEmprestimosSnapshot67({ rpc, from } as any, 41);
    expect(data.items).toEqual(baseline.items); expect(data.totals).toEqual(baseline.totals); expect(data.coverage).toEqual(baseline.coverage);
    expect(Object.keys(data.items[1]).sort()).toEqual(['id', 'kind', 'message']);
    expect(rpc.mock.calls).toEqual([[RPC67, { p_user_id: 41 }]]); expect(from).not.toHaveBeenCalled();
  });
  it('own catalog/collector/root, unknown, duplicatas e extras recusam sem expor PII', () => {
    for (const mutate of [(f: any) => f.userId = 99, (f: any) => f.organizacao67.catalogo[0].userId = 99,
      (f: any) => f.organizacao67.cobradores[0].userId = 99, (f: any) => f.organizacao67.contratos[0].id = 9,
      (f: any) => f.organizacao67.contratos.push(f.organizacao67.contratos[0]), (f: any) => f.organizacao67.catalogo.push(f.organizacao67.catalogo[0]),
      (f: any) => f.organizacao67.cobradores[0].telefone = 'SEGREDO', (f: any) => f.organizacao67.contratos = [],
      (f: any) => f.organizacao67.contratos[0].cobrador.id = null]) {
      const f = fixture67(); mutate(f); expect(() => mapearSnapshot67(f, 41)).toThrow();
    }
  });
  it('organização indisponível não converte financeiro inválido em ausência', () => {
    const f = fixture67(); f.organizacao67 = { state: 'unavailable', scope: 'ALLscope' };
    expect(mapearSnapshot67(f, 41).items).toHaveLength(2);
    f.lista60.items[0].cliente.user_id = 99; expect(() => mapearSnapshot67(f, 41)).toThrow();
  });
  it('getters não executados e JSON inválido não vira lista vazia', () => {
    const f = fixture67(); let read = 0; Object.defineProperty(f, 'userId', { enumerable: true, get() { read++; return 41; } });
    expect(() => mapearSnapshot67(f, 41)).toThrow(); expect(read).toBe(0);
  });
  it('somente timeout nativo exato repete, owner e instância permanecem', async () => {
    vi.useFakeTimers();
    try {
      const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }, status: 500 }).mockResolvedValueOnce({ data: fixture67(), error: null });
      const promise = listarEmprestimosSnapshot67({ rpc }, 41); await vi.advanceTimersByTimeAsync(250); await promise;
      expect(rpc.mock.calls).toEqual([[RPC67, { p_user_id: 41 }], [RPC67, { p_user_id: 41 }]]);
      const bad = vi.fn(async () => ({ data: null, error: { code: '57014' }, status: 500 })); await expect(listarEmprestimosSnapshot67({ rpc: bad }, 41)).rejects.toThrow(); expect(bad).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it('input não aceita owner/cor arbitrária/duplicata; mutation confirma revisão exata sem retry', async () => {
    expect(criarEtiquetaInput67.safeParse({ nome: 'N', cor: 'red', userId: 99 }).success).toBe(false);
    expect(aplicarEtiquetasInput67.safeParse({ contratoId: 1, nomes: ['N','N'], revisao: '0', estadoHash: 'a'.repeat(64) }).success).toBe(false);
    const args = { p_contrato_id: 1, p_nomes: [], p_revisao: '0', p_estado_hash: 'a'.repeat(64) };
    const result = { versao: 'etiquetas_lista67_v1', userId: 41, acao: 'aplicar', id: null, contratoId: 1, revisao: '1' };
    const rpc = vi.fn(async () => ({ data: result, error: null, status: 200 })); await executarEtiqueta67({ rpc },41,'aplicar',args);
    expect(rpc.mock.calls).toEqual([['rpc_etiquetas_aplicar67', { ...args, p_user_id: 41 }]]);
    const stale = vi.fn(async () => ({ data: { ...result, revisao: '2' }, error: null })); await expect(executarEtiqueta67({ rpc: stale },41,'aplicar',args)).rejects.toThrow();
    const conflict = vi.fn(async () => ({ data: null, error: { code: '40001', message: 'changed' }, status: 400 })); await expect(executarEtiqueta67({ rpc: conflict },41,'aplicar',args)).rejects.toMatchObject({ code: 'CONFLICT' }); expect(conflict).toHaveBeenCalledTimes(1);
  });
});
