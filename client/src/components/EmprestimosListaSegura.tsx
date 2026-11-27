// Lista60: apresentação do snapshot confirmado, sem autorizar alterações financeiras.
import React, { useState } from "react";
import { badgeContrato } from "@/lib/statusEmprestimoBadge";
import { noArquivo51, referenciaMonetaria51, statusContrato51, REFERENCIA51, type Arquivo51 } from "@/lib/obrigacoes51Apresentacao";
import { rotaAcaoListaEmprestimo62 } from "@/lib/acoesListaEmprestimo62";

import type { ListaSeguraEmprestimos } from "../../../shared/emprestimosListaSegura";
const moeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export function EmprestimosListaSegura({ data, onRefresh, isFetching = false }: {
  data: ListaSeguraEmprestimos; onRefresh: () => void; isFetching?: boolean;
}) {
  const [arquivo, setArquivo] = useState<Arquivo51>('operacional');
  const [busca, setBusca] = useState('');
  const [modalidade, setModalidade] = useState('todos');
  const [statusObrigacao, setStatusObrigacao] = useState('todos');
  const modalidades = [...new Set(data.items.flatMap(item => item.kind === 'validated' ? [item.modalidade] : []))].sort();
  // Coverage/totais são do conjunto integral provado, jamais da seleção visual.
  // Não se conhece cliente/modalidade/status de um indisponível: nunca ocultá-lo.
  const items = data.items.filter(item => item.kind === 'unavailable' || (
    noArquivo51(item, arquivo) && item.clienteNome.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')) &&
    (modalidade === 'todos' || item.modalidade === modalidade) &&
    (statusObrigacao === 'todos' || item.statusObrigacao === statusObrigacao)
  ));
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
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros dos empréstimos validados">
      <label className="flex flex-col gap-1">Buscar por cliente
        <input type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Nome do cliente"
          className="rounded-lg border bg-background px-3 py-2 text-foreground" />
      </label>
      <label className="flex flex-col gap-1">Modalidade
        <select value={modalidade} onChange={event => setModalidade(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-foreground">
          <option value="todos">Todas as modalidades</option>
          {modalidades.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Estado da obrigação
        <select value={statusObrigacao} onChange={event => setStatusObrigacao(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-foreground">
          <option value="todos">Todos os estados</option>
          <option value="ativo">Ativa</option>
          <option value="quitado">Quitada</option>
          <option value="encerrado_por_cancelamento">Encerrada por cancelamento</option>
        </select>
      </label>
      <button type="button" onClick={() => { setBusca(''); setModalidade('todos'); setStatusObrigacao('todos'); setArquivo('operacional'); }}>Limpar filtros</button>
    </div>
    <p className="text-sm">Os filtros alteram somente os cards. Coverage e totais validados acima incluem o histórico; itens indisponíveis permanecem visíveis em todos os filtros. O estado da obrigação não substitui a conferência de atrasos e parcelas na ficha.</p>
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
          <p>{item.modalidade} · {item.status === 'ativo' && item.statusObrigacao === 'ativo' ? 'ATIVO — conferir atrasos na ficha' : badgeContrato(statusContrato51(item)).label}{item.arquivado ? ' · Arquivado' : ''}. Somente leitura; ações permanecem no fluxo completo validado.</p>
          <p>Obrigação registrada51: {referenciaMonetaria51(item.obrigacaoAtual)}</p>
          <p>A — obrigação adicional não desembolsada: {referenciaMonetaria51(item.obrigacaoAdicional)}. Não é capital, juros ou lucro.</p>
          <p className="text-xs">{REFERENCIA51}</p>
          <a href={`/emprestimos/${item.id}`}>Abrir ficha com validação própria</a>
          <nav aria-label={`Ações na ficha do empréstimo ${item.id}`} className="mt-3 flex flex-wrap gap-2">
            <a href={rotaAcaoListaEmprestimo62(item.id, '#receber-conferir')} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Receber / conferir</a>
            <a href={rotaAcaoListaEmprestimo62(item.id, '#editar-obrigacao')} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Editar obrigação</a>
            <a href={rotaAcaoListaEmprestimo62(item.id, '#reparcelar')} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Reparcelar</a>
            <a href={rotaAcaoListaEmprestimo62(item.id, '#cancelar-arquivar')} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Cancelar / arquivar</a>
          </nav>
        </article>)}
    </div>
    {items.length === 0 && data.items.length > 0 && <p>Nenhum empréstimo neste filtro; o escopo confirmado e o histórico foram preservados.</p>}
    {data.items.length === 0 && <p>Nenhum empréstimo no escopo confirmado.</p>}
  </section>;
}
