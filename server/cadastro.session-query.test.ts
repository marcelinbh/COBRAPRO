import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

async function flush() { for (let i = 0; i < 25; i++) await Promise.resolve(); await new Promise(r => setTimeout(r, 0)); }

describe('sessão conferida sem loop de remontagem', () => {
  it('React Query real monta o filho sem refetch, mas reconfere identidade após invalidação', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    let owner = 901;
    const queryFn = vi.fn(async () => ({ id: owner }));
    const key = ['auth', 'me'];
    const parent = new QueryObserver<{ id: number }>(client, { queryKey: key, queryFn });
    let child: QueryObserver<{ id: number }> | undefined;
    const seen: number[] = [];
    const unsub = parent.subscribe(result => {
      if (result.isFetching || !result.data) { child?.destroy(); child = undefined; return; }
      if (!child) {
        child = new QueryObserver<{ id: number }>(client, { queryKey: key, queryFn, refetchOnMount: false });
        child.subscribe(value => { if (!value.isFetching && value.data) seen.push(value.data.id); });
        seen.push(child.getCurrentResult().data!.id);
      }
    });
    try {
      await flush(); expect(queryFn).toHaveBeenCalledTimes(1); expect(child?.getCurrentResult().data?.id).toBe(901);
      owner = 902; await client.invalidateQueries({ queryKey: key }); await flush();
      expect(queryFn).toHaveBeenCalledTimes(2); expect(child?.getCurrentResult().data?.id).toBe(902);
      expect(seen).toContain(901); expect(seen).toContain(902);
    } finally { unsub(); child?.destroy(); parent.destroy(); client.clear(); }
  });
  it('filhos financeiros adotam a política e recusam envio enquanto a sessão é reconferida', () => {
    for (const path of ['EmprestimoMultimodalCriar.tsx', 'EmprestimoMultimodalOperacoes.tsx', 'EmprestimoSeguroCriar.tsx']) {
      const source = readFileSync(new URL('../client/src/components/' + path, import.meta.url), 'utf8');
      expect(source).not.toMatch(/auth\.me\.useQuery\(\)/);
      expect(source).toContain('refetchOnMount: false');
      expect(source).toContain('!auth.isFetching');
    }
    const parent = readFileSync(new URL('../client/src/pages/NovoContrato.tsx', import.meta.url), 'utf8');
    expect(parent).toContain('auth.isError || auth.isLoading ? null : auth.data');
    expect(parent).toContain('user && !auth.isFetching');
    expect(parent).toContain('key={user.id}');
  });
});
