// PROPOSTA NÃO APLICADA. Renderizar só após falha PRECONDITION_FAILED do endpoint estrito.
import React, { useState } from "react";
import { badgeContrato } from "@/lib/statusEmprestimoBadge";
import { noArquivo51, referenciaMonetaria51, statusContrato51, REFERENCIA51, type Arquivo51 } from "@/lib/obrigacoes51Apresentacao";

import type { ListaSeguraEmprestimos } from "../../../shared/emprestimosListaSegura";
const moeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export function EmprestimosListaSegura({ data, onRefresh, isFetching = false }: {
  data: ListaSeguraEmprestimos; onRefresh: () => void; isFetching?: boolean;
}) {
  const [arquivo, setArquivo] = useState<Arquivo51>('operacional');
  // Coverage/totais são do conjunto integral provado, jamais da seleção visual.
  const items = data.items.filter(item => item.kind === 'unavailable' || noArquivo51(item, arquivo));
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
    <div role="group" aria-label="Arquivo dos empréstimos" className="flex gap-2">
      {(['operacional', 'historico', 'todos'] as const).map(a => <button key={a} type="button" aria-pressed={arquivo === a} onClick={() => setArquivo(a)}>{a === 'operacional' ? 'Operacionais' : a === 'historico' ? 'Histórico' : 'Todos'}</button>)}
    </div>
    <p className="text-sm">O filtro altera somente os cards. Coverage e totais validados acima incluem o histórico; itens indisponíveis permanecem visíveis em todos os filtros.</p>
    <div className="grid gap-4 md:grid-cols-2">
      {items.map(item => item.kind === 'unavailable' ?
        <article key={item.id} aria-label={`Empréstimo ${item.id} indisponível`} className="rounded-lg border p-4">
          <h3>Empréstimo #{item.id}</h3>
          <p>{item.message}</p>
          <p>Cliente, contato, valores e ações não estão disponíveis. Não cadastre novamente.</p>
        </article> :
        <article key={item.id} className="rounded-lg border p-4">
          <h3>Empréstimo #{item.id} — {item.clienteNome}</h3>
          <p>Capital histórico: {moeda(item.capital)}</p>
          <p>A receber: {moeda(item.totalReceber)}</p>
          <p>Recebido: {moeda(item.totalPago)}</p>
          <p>{item.modalidade} · {badgeContrato(statusContrato51(item)).label}{item.arquivado ? ' · Arquivado' : ''}. Somente leitura; ações permanecem no fluxo completo validado.</p>
          <p>Obrigação registrada51: {referenciaMonetaria51(item.obrigacaoAtual)}</p>
          <p>A — obrigação adicional não desembolsada: {referenciaMonetaria51(item.obrigacaoAdicional)}. Não é capital, juros ou lucro.</p>
          <p className="text-xs">{REFERENCIA51}</p>
          <a href={`/emprestimos/${item.id}`}>Abrir ficha com validação própria</a>
        </article>)}
    </div>
    {items.length === 0 && data.items.length > 0 && <p>Nenhum empréstimo neste filtro; o escopo confirmado e o histórico foram preservados.</p>}
    {data.items.length === 0 && <p>Nenhum empréstimo no escopo confirmado.</p>}
  </section>;
}
