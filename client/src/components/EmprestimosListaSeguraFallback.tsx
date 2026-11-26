import React from 'react';
import { trpc } from '@/lib/trpc';
import { EmprestimosListaSegura } from './EmprestimosListaSegura';

type Props = { onRetryStrict: () => void; isRetryingStrict: boolean };

/** Montado pela página SOMENTE após PRECONDITION_FAILED do endpoint estrito. */
export function EmprestimosListaSeguraFallback(props: Props) {
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 0 });
  const owner = auth.data?.id;
  // Auth em refetch/erro/null NÃO confirma que o cache pertence à sessão atual.
  if (auth.isFetching || auth.isLoading || auth.isPending || auth.isError ||
    typeof owner !== 'number' || !Number.isInteger(owner) || owner <= 0 || owner > 2147483647)
    return <section className="space-y-3" aria-label="Sessão da leitura segura">
      <p role={auth.isError ? 'alert' : 'status'}>Não foi possível confirmar a sessão para exibir a consulta segura.</p>
      <a href="/contratos/novo">Novo empréstimo</a>
      <button type="button" disabled={auth.isFetching} onClick={() => { void auth.refetch(); }}>Confirmar sessão novamente</button>
    </section>;
  // Remount por owner; sem owner em input da RPC. Em auth revalidation o filho é desmontado.
  return <ConsultaListaSegura key={owner} owner={owner} {...props} />;
}

function ConsultaListaSegura({ owner, onRetryStrict, isRetryingStrict }: Props & { owner: number }) {
  const safe = trpc.contratos.listLeituraSegura.useQuery(undefined, {
    enabled: true, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always',
  });
  const wrongOwner = !!safe.data && safe.data.userId !== owner;
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">Empréstimos — leitura segura</h1>
    <a href="/contratos/novo">Novo empréstimo</a>
    <button type="button" className="rounded-lg border px-3 py-2" disabled={isRetryingStrict} onClick={onRetryStrict}>
      Tentar leitura completa novamente
    </button>
    {safe.isError || wrongOwner ? <div role="alert" className="space-y-3 rounded-lg border p-4">
      <p>A leitura segura está indisponível para a sessão confirmada. Nenhum total ou ausência de dívida foi confirmado. Não cadastre novamente uma dívida existente.</p>
      <button type="button" disabled={safe.isFetching} onClick={() => { void safe.refetch(); }}>Tentar consulta segura novamente</button>
    </div> : safe.isPending || safe.isFetching || !safe.data ? <p role="status">Confirmando vínculos da consulta segura...</p> :
      <EmprestimosListaSegura data={safe.data} onRefresh={() => { void safe.refetch(); }} isFetching={safe.isFetching} />}
  </div>;
}
