// PROPOSTA NÃO APLICADA. Renderizar só após falha PRECONDITION_FAILED do endpoint estrito.
import React from "react";
import type { ListaSeguraEmprestimos } from "../../../shared/emprestimosListaSegura";
const moeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export function EmprestimosListaSegura({ data, onRefresh, isFetching = false }: {
  data: ListaSeguraEmprestimos; onRefresh: () => void; isFetching?: boolean;
}) {
  const totals = data.totals.values;
  return <section aria-label="Consulta segura de empréstimos" className="space-y-4">
    <p role="status">Modo de leitura segura. Esta consulta não autoriza recebimentos nem alterações financeiras.</p>
    {data.warning && <p role="alert" className="rounded-lg border p-4">{data.warning}</p>}
    <div className="flex gap-3 items-center">
      <h2 className="font-semibold">Empréstimos: {data.coverage.scopedContracts} no escopo; {data.coverage.validatedContracts} validados; {data.coverage.unavailableContracts} indisponíveis</h2>
      <button type="button" disabled={isFetching} onClick={onRefresh}>Atualizar consulta segura</button>
    </div>
    <div aria-label="Totais validados somente" className="rounded-lg border p-4">
      <h3>Totais — validados somente</h3>
      {totals === null ? <p>Valores indisponíveis: nenhum empréstimo deste escopo pôde ser validado.</p> : <>
        <p>Capital (validados somente): {moeda(totals.capital)}</p>
        <p>A receber (validados somente): {moeda(totals.totalReceber)}</p>
        <p>Recebido (validados somente): {moeda(totals.totalPago)}</p>
      </>}
      {!data.coverage.complete && <p>Não representam toda a carteira. Relatório completo indisponível nesta consulta.</p>}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {data.items.map(item => item.kind === 'unavailable' ?
        <article key={item.id} aria-label={`Empréstimo ${item.id} indisponível`} className="rounded-lg border p-4">
          <h3>Empréstimo #{item.id}</h3>
          <p>{item.message}</p>
          <p>Cliente, contato, valores e ações não estão disponíveis. Não cadastre novamente.</p>
        </article> :
        <article key={item.id} className="rounded-lg border p-4">
          <h3>Empréstimo #{item.id} — {item.clienteNome}</h3>
          <p>Capital: {moeda(item.capital)}</p>
          <p>A receber: {moeda(item.totalReceber)}</p>
          <p>Recebido: {moeda(item.totalPago)}</p>
          <p>{item.modalidade} · {item.status}. Somente leitura; ações permanecem no fluxo completo validado.</p>
          <a href={`/emprestimos/${item.id}`}>Abrir ficha com validação própria</a>
        </article>)}
    </div>
    {data.items.length === 0 && <p>Nenhum empréstimo no escopo confirmado.</p>}
  </section>;
}
