import React from 'react';
import { trpc } from '@/lib/trpc';
import type { ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';
import { EmprestimosListaSegura } from './EmprestimosListaSegura';
import { CobrancaLote64, type ApiLote64 } from './CobrancaLote64';

/** Boundary montada só depois de auth e lista60 assentados. Nenhuma query por card. */
export function EmprestimosLista64Conectada({ data, onRefresh, isFetching = false }: {
  data: ListaSeguraEmprestimos; onRefresh: () => void; isFetching?: boolean;
}) {
  const utils = trpc.useUtils();
  const envio = trpc.cobrancaLista64.enviar.useMutation({ retry: false });
  const api: ApiLote64 = {
    preparar: input => utils.client.cobrancaLista64.preparar.query(input),
    enviar: token => envio.mutateAsync({ token, confirmar: true }),
    status: () => utils.client.whatsappEvolution.getStatus.query(),
  };
  return <EmprestimosListaSegura data={data} onRefresh={onRefresh} isFetching={isFetching}
    renderCobranca={({ contratoIds, onBusy }) => <CobrancaLote64 key={`${data.userId}:${[...contratoIds].sort((a, b) => a - b).join(',')}`} userId={data.userId} contratoIds={contratoIds} api={api} onBusy={onBusy} />} />;
}
