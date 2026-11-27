import React from 'react';
import { trpc } from '@/lib/trpc';
import { EmprestimosLista64Conectada as EmprestimosListaSegura } from './EmprestimosLista64Conectada';

// Compatibilidade com o consumidor strict legado; não inicia nem oferece leitura strict.
type Props = { onRetryStrict?: () => void; isRetryingStrict?: boolean };

/** Entrada direta da lista60. A leitura não depende de uma falha strict anterior. */
export function EmprestimosListaSeguraFallback(_props: Props = {}) {
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 0 });
  const owner = auth.data?.id;
  // Auth em refetch/erro/null NÃO confirma que o cache pertence à sessão atual.
  if (auth.isFetching || auth.isLoading || auth.isPending || auth.isError ||
    typeof owner !== 'number' || !Number.isInteger(owner) || owner <= 0 || owner > 2147483647)
    return <section className="space-y-3" aria-label="Sessão da leitura segura">
      <h1 className="text-2xl font-bold">Empréstimos</h1>
      <p role={auth.isError ? 'alert' : 'status'}>Não foi possível confirmar a sessão para exibir a consulta segura.</p>
      <a href="/contratos/novo">Novo empréstimo</a>
      <button type="button" disabled={auth.isFetching} onClick={() => { void auth.refetch(); }}>Confirmar sessão novamente</button>
    </section>;
  // Remount por owner; sem owner em input da RPC. Em auth revalidation o filho é desmontado.
  return <ConsultaListaSegura key={owner} owner={owner} />;
}

function ConsultaListaSegura({ owner }: { owner: number }) {
  const safe = trpc.contratos.listLeituraSegura.useQuery(undefined, {
    enabled: true, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always',
  });
  const wrongOwner = !!safe.data && safe.data.userId !== owner;
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Empréstimos — leitura segura</h1>
      <a href="/contratos/novo" className="rounded-lg bg-emerald-600 px-3 py-2 text-white">Novo empréstimo</a>
    </div>
    {safe.isError || wrongOwner ? <div role="alert" className="space-y-3 rounded-lg border p-4">
      <p>A leitura segura está indisponível para a sessão confirmada. Nenhum total ou ausência de dívida foi confirmado. Não cadastre novamente uma dívida existente.</p>
      <button type="button" disabled={safe.isFetching} onClick={() => { void safe.refetch(); }}>Tentar consulta segura novamente</button>
    </div> : safe.isPending || safe.isLoading || safe.isFetching || !safe.data ? <p role="status">Confirmando vínculos da consulta segura...</p> :
      <EmprestimosListaSegura data={safe.data} onRefresh={() => { void safe.refetch(); }} isFetching={safe.isFetching} />}
  </div>;
}
