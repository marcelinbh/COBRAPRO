import React from 'react';
import { trpc } from '@/lib/trpc';
import type { ListaSeguraEmprestimos } from '../../../shared/emprestimosListaSegura';
import { EmprestimosListaSegura } from './EmprestimosListaSegura';
import { CobrancaLote64, type ApiLote64 } from './CobrancaLote64';
import { EtiquetasLista67, type ApiEtiquetas67 } from './EtiquetasLista67';

/** Boundary montada só depois de auth e lista60 assentados. Nenhuma query por card. */
export function EmprestimosLista64Conectada({ data, onRefresh, isFetching = false }: {
  data: ListaSeguraEmprestimos; onRefresh: () => void; isFetching?: boolean;
}) {
  const utils = trpc.useUtils();
  const envio = trpc.cobrancaLista64.enviar.useMutation({ retry: false });
  const criar = trpc.etiquetasLista67.criar.useMutation({ retry: false });
  const remover = trpc.etiquetasLista67.remover.useMutation({ retry: false });
  const aplicar = trpc.etiquetasLista67.aplicar.useMutation({ retry: false });
  const etiquetas: ApiEtiquetas67 = {
    criar: input => criar.mutateAsync(input), remover: input => remover.mutateAsync(input), aplicar: input => aplicar.mutateAsync(input),
    atualizar: () => utils.contratos.listLeituraSegura.invalidate(),
  };
  const api: ApiLote64 = {
    preparar: input => utils.client.cobrancaLista64.preparar.query(input),
    enviar: token => envio.mutateAsync({ token, confirmar: true }),
    status: () => utils.client.whatsappEvolution.getStatus.query(),
  };
  return <EmprestimosListaSegura data={data} onRefresh={onRefresh} isFetching={isFetching}
    renderEtiquetas={({ editor, fechar, onBusy }) => <EtiquetasLista67 key={`${data.userId}:${editor?.contratoId ?? 'catalogo'}:${editor?.etiquetas.revisao ?? ''}:${editor?.etiquetas.estadoHash ?? ''}`} data={data} editor={editor} api={etiquetas} fechar={fechar} onBusy={onBusy} />}
    renderCobranca={({ contratoIds, onBusy }) => <CobrancaLote64 key={`${data.userId}:${[...contratoIds].sort((a, b) => a - b).join(',')}`} userId={data.userId} contratoIds={contratoIds} api={api} onBusy={onBusy} />} />;
}
