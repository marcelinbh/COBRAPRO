// Lista60/63: apresentação do snapshot confirmado, sem autorizar alterações financeiras.
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
  const dataCivil = (value: string) => value.split('-').reverse().join('/');
  const modalidades = [...new Set(data.items.flatMap(item => item.kind === 'validated' ? [item.modalidade] : []))].sort();
  // Coverage/totais são do conjunto integral provado, jamais da seleção visual.
  // Não se conhece cliente/modalidade/status de um indisponível: nunca ocultá-lo.
  const items = data.items.filter(item => item.kind === 'unavailable' || (
    noArquivo51(item, arquivo) && item.clienteNome.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')) &&
    (modalidade === 'todos' || item.modalidade === modalidade) &&
    (statusObrigacao === 'todos' || item.statusObrigacao === statusObrigacao)
  )).sort((a, b) => Number(a.kind === 'unavailable') - Number(b.kind === 'unavailable'));
  const totals = data.totals.values;
  return <section aria-label="Consulta segura de empréstimos" className="min-w-0 space-y-5">
    <p role="status" className="text-sm text-muted-foreground">Modo de leitura segura. Esta consulta não autoriza recebimentos nem alterações financeiras.</p>
    {data.warning && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-relaxed">{data.warning}</p>}
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <h2 className="min-w-0 text-sm font-semibold leading-relaxed">Empréstimos: {data.coverage.scopedContracts} no escopo; {data.coverage.validatedContracts} validados; {data.coverage.unavailableContracts} indisponíveis</h2>
      <button type="button" disabled={isFetching} onClick={onRefresh} className="min-h-11 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Atualizar consulta segura</button>
    </div>
    <div aria-label="Totais validados somente" className="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
      <h3 className="mb-3 text-sm font-semibold">Totais — validados somente</h3>
      {totals === null ? <p>Valores indisponíveis: nenhum empréstimo deste escopo pôde ser validado.</p> : <div className="grid gap-3 sm:grid-cols-3">
        <p className="min-w-0 break-words rounded-lg bg-muted/40 p-3 tabular-nums">Capital (validados somente): {moeda(totals.capital)}</p>
        <p className="min-w-0 break-words rounded-lg bg-muted/40 p-3 tabular-nums">A receber (validados somente): {moeda(totals.totalReceber)}</p>
        <p className="min-w-0 break-words rounded-lg bg-muted/40 p-3 tabular-nums">Recebido (validados somente): {moeda(totals.totalPago)}</p>
      </div>}
      {!data.coverage.complete && <p className="mt-3 text-sm text-muted-foreground">Não representam toda a carteira. Relatório completo indisponível nesta consulta.</p>}
    </div>
    <div role="group" aria-label="Arquivo dos empréstimos" className="flex flex-wrap gap-2">
      {(['operacional', 'historico', 'todos'] as const).map(a => <button key={a} type="button" aria-pressed={arquivo === a} onClick={() => setArquivo(a)} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${arquivo === a ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted/50'}`}>{a === 'operacional' ? 'Operacionais' : a === 'historico' ? 'Histórico' : 'Todos'}</button>)}
    </div>
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros dos empréstimos validados">
      <label className="flex min-w-0 w-full flex-col gap-1 text-sm sm:w-auto sm:flex-1">Buscar por cliente
        <input type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Nome do cliente"
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
      </label>
      <label className="flex min-w-0 w-full flex-col gap-1 text-sm sm:w-auto">Modalidade
        <select value={modalidade} onChange={event => setModalidade(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground">
          <option value="todos">Todas as modalidades</option>
          {modalidades.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="flex min-w-0 w-full flex-col gap-1 text-sm sm:w-auto">Estado da obrigação
        <select value={statusObrigacao} onChange={event => setStatusObrigacao(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground">
          <option value="todos">Todos os estados</option>
          <option value="ativo">Ativa</option>
          <option value="quitado">Quitada</option>
          <option value="encerrado_por_cancelamento">Encerrada por cancelamento</option>
        </select>
      </label>
      <button type="button" onClick={() => { setBusca(''); setModalidade('todos'); setStatusObrigacao('todos'); setArquivo('operacional'); }} className="min-h-11 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Limpar filtros</button>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">Os filtros alteram somente os cards. Coverage e totais validados acima incluem o histórico; itens indisponíveis permanecem visíveis em todos os filtros. O estado da obrigação não substitui a conferência de atrasos e parcelas na ficha.</p>
    <p className="text-sm text-muted-foreground">Empréstimos validados aparecem primeiro. Os registros indisponíveis continuam abaixo, sem ocultar dívidas existentes.</p>
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      {items.map(item => item.kind === 'unavailable' ?
        <article key={item.id} aria-label={`Empréstimo ${item.id} indisponível`} className="min-w-0 break-words rounded-xl border border-border bg-card p-4 text-card-foreground">
          <h3 className="font-semibold">Empréstimo #{item.id}</h3>
          <p className="mt-2 text-sm leading-relaxed">{item.message}</p>
          <p className="mt-2 text-sm text-muted-foreground">Cliente, contato, valores e ações não estão disponíveis. Não cadastre novamente.</p>
        </article> :
        <article key={item.id} aria-label={`Empréstimo ${item.id} — ${item.clienteNome}`} className="min-w-0 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
          <header className="min-w-0 space-y-3 border-b border-border pb-4">
            <h3 className="min-w-0 break-words [overflow-wrap:anywhere] text-base font-semibold leading-snug">Empréstimo #{item.id} — {item.clienteNome}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="max-w-full break-words rounded-md bg-muted px-2.5 py-1.5 text-muted-foreground">Modalidade: <span className="capitalize">{item.modalidade}</span></span>
              <span className="max-w-full break-words rounded-md border border-border px-2.5 py-1.5 font-medium">{item.status === 'ativo' && item.statusObrigacao === 'ativo' ? 'ATIVO — conferir atrasos na ficha' : badgeContrato(statusContrato51(item)).label}</span>
              {item.arquivado && <span className="rounded-md bg-muted px-2.5 py-1.5 text-muted-foreground">Arquivado</span>}
            </div>
          </header>
          <div aria-label={`Valores validados do empréstimo ${item.id}`} className="my-4 grid min-w-0 gap-2 sm:grid-cols-3">
            <p className="min-w-0 break-words rounded-lg bg-muted/40 p-3 text-sm leading-relaxed tabular-nums">Capital histórico: <strong className="block text-base text-foreground">{moeda(item.capital)}</strong></p>
            <p className="min-w-0 break-words rounded-lg bg-primary/5 p-3 text-sm leading-relaxed tabular-nums">A receber: <strong className="block text-base text-foreground">{moeda(item.totalReceber)}</strong></p>
            <p className="min-w-0 break-words rounded-lg bg-muted/40 p-3 text-sm leading-relaxed tabular-nums">Recebido: <strong className="block text-base text-foreground">{moeda(item.totalPago)}</strong></p>
          </div>
          <div aria-label={`Resumo de parcelas do empréstimo ${item.id}`} className="rounded-lg border border-border p-3">
            <h4 className="text-sm font-semibold">Resumo de parcelas</h4>
            {item.resumoParcelas ? <>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Total de parcelas</dt><dd className="mt-1 font-semibold tabular-nums">{item.resumoParcelas.total}</dd></div>
                <div><dt className="text-muted-foreground">Em aberto</dt><dd className="mt-1 font-semibold tabular-nums">{item.resumoParcelas.abertas}</dd></div>
                <div><dt className="text-muted-foreground">Pagas</dt><dd className="mt-1 font-semibold tabular-nums">{item.resumoParcelas.pagas}</dd></div>
                <div><dt className="text-muted-foreground">Canceladas</dt><dd className="mt-1 font-semibold tabular-nums">{item.resumoParcelas.canceladas}</dd></div>
                <div><dt className="text-muted-foreground">Transferidas</dt><dd className="mt-1 font-semibold tabular-nums">{item.resumoParcelas.transferidas}</dd></div>
                <div><dt className="text-muted-foreground">Arquivadas</dt><dd className="mt-1 font-semibold tabular-nums">{item.resumoParcelas.arquivadas}</dd></div>
              </dl>
              <div className="mt-3 border-t border-border pt-3 text-sm">
                <p className="font-medium">Próximo vencimento registrado: {item.resumoParcelas.proximoVencimento === null ? <span className="font-normal text-muted-foreground">Sem parcela em aberto para vencimento.</span> : <time dateTime={item.resumoParcelas.proximoVencimento}>{dataCivil(item.resumoParcelas.proximoVencimento)}</time>}</p>
                <p className="mt-1 text-xs text-muted-foreground">Referência da consulta: <time dateTime={item.resumoParcelas.dataReferencia}>{dataCivil(item.resumoParcelas.dataReferencia)}</time></p>
                {item.resumoParcelas.arquivadas > 0 && <p className="mt-1 text-xs text-muted-foreground">Arquivo é um atributo separado: não representa pagamento ou cancelamento.</p>}
              </div>
            </> : <p className="mt-2 text-sm text-muted-foreground">Resumo de parcelas indisponível nesta leitura.</p>}
          </div>
          <div className="mt-4 space-y-1 text-sm leading-relaxed">
            <p>Obrigação registrada51: {referenciaMonetaria51(item.obrigacaoAtual)}</p>
            <p>A — obrigação adicional não desembolsada: {referenciaMonetaria51(item.obrigacaoAdicional)}. Não é capital, juros ou lucro.</p>
            <p className="text-xs text-muted-foreground">{REFERENCIA51}</p>
          </div>
          <footer className="mt-4 border-t border-border pt-4">
            <p className="mb-3 text-xs text-muted-foreground">Somente leitura; ações permanecem no fluxo completo validado.</p>
            <a href={`/emprestimos/${item.id}`} className="inline-flex min-h-11 max-w-full items-center rounded-lg px-2 py-2 text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Abrir ficha com validação própria</a>
            <nav aria-label={`Ações na ficha do empréstimo ${item.id}`} className="mt-3 flex flex-wrap gap-2">
              <a href={rotaAcaoListaEmprestimo62(item.id, '#receber-conferir')} className="flex min-h-11 min-w-0 flex-1 basis-[calc(50%-0.5rem)] items-center justify-center break-words rounded-lg border border-border bg-background px-3 py-2 text-center text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Receber / conferir</a>
              <a href={rotaAcaoListaEmprestimo62(item.id, '#editar-obrigacao')} className="flex min-h-11 min-w-0 flex-1 basis-[calc(50%-0.5rem)] items-center justify-center break-words rounded-lg border border-border bg-background px-3 py-2 text-center text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Editar obrigação</a>
              <a href={rotaAcaoListaEmprestimo62(item.id, '#reparcelar')} className="flex min-h-11 min-w-0 flex-1 basis-[calc(50%-0.5rem)] items-center justify-center break-words rounded-lg border border-border bg-background px-3 py-2 text-center text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Reparcelar</a>
              <a href={rotaAcaoListaEmprestimo62(item.id, '#cancelar-arquivar')} className="flex min-h-11 min-w-0 flex-1 basis-[calc(50%-0.5rem)] items-center justify-center break-words rounded-lg border border-border bg-background px-3 py-2 text-center text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Cancelar / arquivar</a>
            </nav>
          </footer>
        </article>)}
    </div>
    {items.length === 0 && data.items.length > 0 && <p>Nenhum empréstimo neste filtro; o escopo confirmado e o histórico foram preservados.</p>}
    {data.items.length === 0 && <p>Nenhum empréstimo no escopo confirmado.</p>}
  </section>;
}
