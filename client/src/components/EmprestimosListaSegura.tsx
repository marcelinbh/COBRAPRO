// Lista60/63/64: snapshot confirmado; seleção não autoriza alterações financeiras.
import React, { useState } from "react";
import { badgeContrato } from "@/lib/statusEmprestimoBadge";
import { noArquivo51, referenciaMonetaria51, statusContrato51, REFERENCIA51, type Arquivo51 } from "@/lib/obrigacoes51Apresentacao";
import { rotaAcaoListaEmprestimo62 } from "@/lib/acoesListaEmprestimo62";
import { ExportarLista66 } from "./ExportarLista66";
import { agruparClientes67, filtrarLista67, rotuloVencimento67, situacaoVencimento67, type Vencimento67 } from '@/lib/emprestimosListaControles67';
import type { EditorLista67, RenderEtiquetas67 } from './EtiquetasLista67';

import type { ListaSeguraEmprestimos } from "../../../shared/emprestimosListaSegura";
const moeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
export type RenderLote64 = (props: { contratoIds: number[]; limpar: () => void; onBusy: (value: boolean) => void }) => React.ReactNode;
// Candidato visual apenas. Destinatário, valor e exigibilidade são conferidos no servidor.
export function candidatoCobranca64(item: ListaSeguraEmprestimos['items'][number]) {
  return item.kind === 'validated' && item.statusObrigacao === 'ativo' && !item.arquivado &&
    ['ativo', 'inadimplente'].includes(item.statusFinanceiroOriginal) &&
    !!item.resumoParcelas && item.resumoParcelas.abertas > 0 && item.resumoParcelas.proximoVencimento !== null;
}

export function EmprestimosListaSegura({ data, onRefresh, isFetching = false, renderCobranca, renderEtiquetas }: {
  data: ListaSeguraEmprestimos; onRefresh: () => void; isFetching?: boolean; renderCobranca?: RenderLote64; renderEtiquetas?: RenderEtiquetas67;
}) {
  const [arquivo, setArquivo] = useState<Arquivo51>('operacional');
  const [busca, setBusca] = useState('');
  const [modalidade, setModalidade] = useState('todos');
  const [statusObrigacao, setStatusObrigacao] = useState('todos');
  const [vencimento, setVencimento] = useState<Vencimento67>('todos');
  const [cobrador, setCobrador] = useState('todos'); const [etiqueta, setEtiqueta] = useState('todos');
  const [modo, setModo] = useState<'cards' | 'pastas'>('cards');
  const [editor, setEditor] = useState<EditorLista67 | null>(null); const [editorAberto, setEditorAberto] = useState(false);
  const [etiquetasEmCurso, setEtiquetasEmCurso] = useState(false);
  const [selecaoAtiva, setSelecaoAtiva] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [avisoSelecao, setAvisoSelecao] = useState('');
  const [loteEmCurso, setLoteEmCurso] = useState(false);
  const limparSelecao = () => { setSelecionados([]); setAvisoSelecao(''); };
  const mudarFiltro = (fn: () => void) => { if (loteEmCurso || etiquetasEmCurso) return; limparSelecao(); setEditorAberto(false); setEditor(null); fn(); };
  const dataCivil = (value: string) => value.split('-').reverse().join('/');
  const modalidades = [...new Set(data.items.flatMap(item => item.kind === 'validated' ? [item.modalidade] : []))].sort();
  // Coverage/totais são do conjunto integral provado, jamais da seleção visual.
  // Não se conhece cliente/modalidade/status de um indisponível: nunca ocultá-lo.
  const items = filtrarLista67(data, { arquivo, busca, modalidade, statusObrigacao, vencimento, cobrador, etiqueta });
  const org = data.organizacao67;
  const catalogo = org?.state === 'confirmed' ? org.catalogo : [];
  const cobradores = org?.state === 'confirmed' ? org.cobradores : [];
  const nomesEtiquetas = org?.state === 'confirmed' ? [...new Set(org.contratos.flatMap(c => c.etiquetas.state === 'confirmed' ? c.etiquetas.nomes : []))].sort() : [];
  const grupos = agruparClientes67(items);
  const metadados = new Map(org?.state === 'confirmed' ? org.contratos.map(c => [c.id, c] as const) : []);
  const metadataContrato = (id: number) => metadados.get(id);
  const abrirEditor = (id: number) => {
    if (loteEmCurso || etiquetasEmCurso) return;
    const m = metadataContrato(id);
    if (m?.etiquetas.state !== 'confirmed') return;
    limparSelecao(); setEditor({ contratoId: id, etiquetas: m.etiquetas }); setEditorAberto(true);
  };
  const totals = data.totals.values;
  const escolherVisiveis = (atrasados = false) => {
    if (loteEmCurso || etiquetasEmCurso) return;
    const candidatos = items.filter(item => candidatoCobranca64(item) && (!atrasados || (
      situacaoVencimento67(item) === 'atrasados'
    ))).map(item => item.id);
    setSelecionados(candidatos.slice(0, 20));
    setAvisoSelecao(candidatos.length > 20 ? 'Limite de 20 contratos: foram selecionados os primeiros 20 candidatos visíveis.' : '');
  };
  const alternarSelecao = (id: number) => {
    if (loteEmCurso || etiquetasEmCurso || !items.some(item => item.id === id && candidatoCobranca64(item))) return;
    setSelecionados(atuais => atuais.includes(id) ? atuais.filter(value => value !== id) : atuais.length < 20 ? [...atuais, id] : atuais);
    setAvisoSelecao(!selecionados.includes(id) && selecionados.length >= 20 ? 'O limite é de 20 contratos por lote.' : '');
  };
  const renderItem = (item: ListaSeguraEmprestimos['items'][number]) => item.kind === 'unavailable' ?
        <article key={item.id} aria-label={`Empréstimo ${item.id} indisponível`} className="min-w-0 break-words rounded-xl border border-border bg-card p-4 text-card-foreground">
          <h3 className="font-semibold">Empréstimo #{item.id}</h3>
          <p className="mt-2 text-sm leading-relaxed">{item.message}</p>
          <p className="mt-2 text-sm text-muted-foreground">Cliente, contato, valores e ações não estão disponíveis. Não cadastre novamente.</p>
        </article> :
        <article key={item.id} aria-label={`Empréstimo ${item.id} — ${item.clienteNome}`} className="min-w-0 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
          <header className="min-w-0 space-y-3 border-b border-border pb-4">
            {selecaoAtiva && renderCobranca && candidatoCobranca64(item) && <label className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring">
              <input type="checkbox" aria-label={`Selecionar empréstimo ${item.id}`} checked={selecionados.includes(item.id)} disabled={loteEmCurso || etiquetasEmCurso} onChange={() => alternarSelecao(item.id)} className="h-5 w-5 shrink-0 accent-primary" /> Selecionar para o lote
            </label>}
            <h3 className="min-w-0 break-words [overflow-wrap:anywhere] text-base font-semibold leading-snug">Empréstimo #{item.id} — {item.clienteNome}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="max-w-full break-words rounded-md bg-muted px-2.5 py-1.5 text-muted-foreground">Modalidade: <span className="capitalize">{item.modalidade}</span></span>
              <span className="max-w-full break-words rounded-md border border-border px-2.5 py-1.5 font-medium">{item.status === 'ativo' && item.statusObrigacao === 'ativo' ? 'ATIVO — conferir atrasos na ficha' : badgeContrato(statusContrato51(item)).label}</span>
              <span className="rounded-md border border-border px-2 py-1">{rotuloVencimento67(item)}</span>
              <span className="break-words">Cobrador: {metadataContrato(item.id)?.cobrador.state === 'confirmed' ? ((metadataContrato(item.id)!.cobrador as { id: number | null }).id === null ? 'Sem cobrador confirmado' : cobradores.find(c => c.id === (metadataContrato(item.id)!.cobrador as { id: number }).id)?.nome ?? 'Indisponível') : 'Indisponível'}</span>
              {metadataContrato(item.id)?.etiquetas.state === 'confirmed' ? <span className="break-words">Etiquetas: {(metadataContrato(item.id)!.etiquetas as { nomes: string[] }).nomes.join(', ') || 'Sem etiquetas confirmadas'}</span> : <span>Etiquetas indisponíveis</span>}
              {renderEtiquetas && metadataContrato(item.id)?.etiquetas.state === 'confirmed' && <button type="button" disabled={loteEmCurso || etiquetasEmCurso} className="min-h-11 rounded border px-3" onClick={() => abrirEditor(item.id)}>Editar etiquetas #{item.id}</button>}
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
        </article>;
  return <section aria-label="Consulta segura de empréstimos" className="min-w-0 space-y-5">
    <p role="status" className="text-sm text-muted-foreground">Modo de leitura segura. Esta consulta não autoriza recebimentos nem alterações financeiras.</p>
    {data.warning && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-relaxed">{data.warning}</p>}
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <h2 className="min-w-0 text-sm font-semibold leading-relaxed">Empréstimos: {data.coverage.scopedContracts} no escopo; {data.coverage.validatedContracts} validados; {data.coverage.unavailableContracts} indisponíveis</h2>
      <button type="button" disabled={isFetching || loteEmCurso || etiquetasEmCurso} onClick={() => { if (!loteEmCurso && !etiquetasEmCurso) { limparSelecao(); onRefresh(); } }} className="min-h-11 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Atualizar consulta segura</button>
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
      {(['operacional', 'historico', 'todos'] as const).map(a => <button key={a} type="button" disabled={loteEmCurso || etiquetasEmCurso} aria-pressed={arquivo === a} onClick={() => mudarFiltro(() => setArquivo(a))} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${arquivo === a ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted/50'}`}>{a === 'operacional' ? 'Operacionais' : a === 'historico' ? 'Histórico' : 'Todos'}</button>)}
    </div>
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros dos empréstimos validados">
      <label className="flex min-w-0 w-full flex-col gap-1 text-sm sm:w-auto sm:flex-1">Buscar por cliente
        <input type="search" disabled={loteEmCurso || etiquetasEmCurso} value={busca} onChange={event => mudarFiltro(() => setBusca(event.target.value))} placeholder="Nome do cliente"
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
      </label>
      <label className="flex min-w-0 w-full flex-col gap-1 text-sm sm:w-auto">Modalidade
        <select disabled={loteEmCurso || etiquetasEmCurso} value={modalidade} onChange={event => mudarFiltro(() => setModalidade(event.target.value))} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground">
          <option value="todos">Todas as modalidades</option>
          {modalidades.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="flex min-w-0 w-full flex-col gap-1 text-sm sm:w-auto">Estado da obrigação
        <select disabled={loteEmCurso || etiquetasEmCurso} value={statusObrigacao} onChange={event => mudarFiltro(() => setStatusObrigacao(event.target.value))} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground">
          <option value="todos">Todos os estados</option>
          <option value="ativo">Ativa</option>
          <option value="quitado">Quitada</option>
          <option value="encerrado_por_cancelamento">Encerrada por cancelamento</option>
        </select>
      </label>
      <label>Situação de vencimento<select aria-label="Situação de vencimento" disabled={loteEmCurso || etiquetasEmCurso} value={vencimento} onChange={e => mudarFiltro(() => setVencimento(e.target.value as Vencimento67))} className="block min-h-11 rounded border px-3">
        <option value="todos">Todos os vencimentos</option><option value="atrasados">Atrasados na data da consulta</option><option value="emdia">Em dia operacional na data da consulta</option>
      </select></label>
      <label>Cobrador no escopo<select aria-label="Cobrador no escopo" disabled={loteEmCurso || etiquetasEmCurso || org?.state !== 'confirmed'} value={cobrador} onChange={e => mudarFiltro(() => setCobrador(e.target.value))} className="block min-h-11 rounded border px-3">
        <option value="todos">Todos no escopo autorizado</option><option value="sem">Sem cobrador confirmado</option>{cobradores.map(c => <option key={c.id} value={String(c.id)}>{c.nome} — #{c.id}</option>)}
      </select></label>
      <label>Etiqueta<select aria-label="Etiqueta" disabled={loteEmCurso || etiquetasEmCurso || org?.state !== 'confirmed'} value={etiqueta} onChange={e => mudarFiltro(() => setEtiqueta(e.target.value))} className="block min-h-11 rounded border px-3">
        <option value="todos">Todas as etiquetas</option><option value="sem">Sem etiquetas confirmadas</option>{[...new Set([...nomesEtiquetas, ...catalogo.map(c => c.nome)])].map(n => <option key={n} value={`nome:${n}`}>{n}</option>)}
      </select></label>
      <button type="button" disabled={loteEmCurso || etiquetasEmCurso} aria-pressed={modo === 'pastas'} className="min-h-11 rounded border px-3" onClick={() => mudarFiltro(() => setModo(modo === 'cards' ? 'pastas' : 'cards'))}>{modo === 'cards' ? 'Agrupar em pastas por cliente' : 'Mostrar cards'}</button>
      {renderEtiquetas && org?.state === 'confirmed' && <button type="button" disabled={loteEmCurso || etiquetasEmCurso} className="min-h-11 rounded border px-3" onClick={() => { if (loteEmCurso || etiquetasEmCurso) return; limparSelecao(); setEditor(null); setEditorAberto(true); }}>Gerenciar catálogo próprio</button>}
      <button type="button" disabled={loteEmCurso || etiquetasEmCurso} onClick={() => mudarFiltro(() => { setBusca(''); setModalidade('todos'); setStatusObrigacao('todos'); setArquivo('operacional'); setVencimento('todos'); setCobrador('todos'); setEtiqueta('todos'); })} className="min-h-11 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Limpar filtros</button>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">Os filtros alteram somente os cards. Pastas são visuais; fechá-las não muda seleção nem exportação, cuja ordem plana é a mesma dos cards. Coverage ALLscope e totais validados acima incluem o histórico; itens indisponíveis permanecem visíveis em todos os filtros. O estado da obrigação não substitui a conferência de atrasos e parcelas na ficha.</p>
    {org?.state !== 'confirmed' && <p role="status">Organização indisponível; ausência de cobrador ou etiqueta não confirmada. Filtros dependentes e editor desabilitados.</p>}
    <p className="text-sm text-muted-foreground">Empréstimos validados aparecem primeiro. Os registros indisponíveis continuam abaixo, sem ocultar dívidas existentes.</p>
    <ExportarLista66 data={data} items={items} filtros={{ arquivo, busca, modalidade, statusObrigacao, vencimento, cobrador: cobrador === 'todos' ? 'Todos no escopo autorizado' : cobrador === 'sem' ? 'Sem cobrador confirmado' : cobradores.find(c => String(c.id) === cobrador)?.nome ?? 'Cobrador indisponível', etiqueta: etiqueta === 'todos' ? 'Todas' : etiqueta === 'sem' ? 'Sem etiquetas confirmadas' : etiqueta.slice(5), modo }} disabled={isFetching || loteEmCurso || etiquetasEmCurso} />
    {renderCobranca && <section aria-label="Seleção para cobrança" className="min-w-0 rounded-xl border border-border bg-card p-4 text-card-foreground space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Cobrança em lote pelo WhatsApp</h3>
        <button type="button" disabled={loteEmCurso || etiquetasEmCurso} aria-pressed={selecaoAtiva} onClick={() => { if (!loteEmCurso && !etiquetasEmCurso) { limparSelecao(); setSelecaoAtiva(value => !value); } }} className="min-h-11 rounded-lg border border-border bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">{selecaoAtiva ? 'Sair da seleção' : 'Selecionar para cobrar'}</button>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">Selecione até 20 contratos e confira as mensagens antes de enviar. Somente candidatos ativos e não arquivados aparecem para seleção. O servidor confirma a dívida e o contato da sua empresa novamente. Nenhuma cobrança altera o caixa.</p>
      {selecaoAtiva && <>
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="w-full text-sm sm:w-auto">{selecionados.length} de 20 selecionados</p>
          <button type="button" disabled={loteEmCurso || etiquetasEmCurso} onClick={() => escolherVisiveis()} className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring">Selecionar visíveis</button>
          <button type="button" disabled={loteEmCurso || etiquetasEmCurso} onClick={() => escolherVisiveis(true)} className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring">Selecionar vencidos visíveis</button>
          <button type="button" disabled={loteEmCurso || etiquetasEmCurso} onClick={() => { if (!loteEmCurso && !etiquetasEmCurso) limparSelecao(); }} className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring">Limpar seleção</button>
        </div>
        <p className="text-xs text-muted-foreground">Mudar filtros ou atualizar a lista limpa a seleção e a prévia. “Vencidos” compara o próximo vencimento registrado com a data da consulta; a elegibilidade definitiva vem na prévia.</p>
        {avisoSelecao && <p role="status" className="text-sm">{avisoSelecao}</p>}
        {selecionados.length > 0 && renderCobranca({ contratoIds: selecionados, limpar: limparSelecao, onBusy: setLoteEmCurso })}
      </>}
    </section>}
    {editorAberto && renderEtiquetas?.({ editor, fechar: () => { setEditorAberto(false); setEditor(null); }, onBusy: setEtiquetasEmCurso })}
    {modo === 'cards' ? <div className="grid min-w-0 gap-4 xl:grid-cols-2">{items.filter(item => item.kind === 'validated').map(renderItem)}</div> :
      <div aria-label="Pastas por identidade do cliente" className="space-y-3">{grupos.map(g => <details key={g.clienteId} className="rounded-xl border border-border p-3">
        <summary className="min-h-11 cursor-pointer break-words">{g.nome} — cliente #{g.clienteId} — {g.items.length} validados filtrados</summary>
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">{g.items.map(renderItem)}</div>
      </details>)}</div>}
    <div aria-label="Registros indisponíveis sempre visíveis" className="grid min-w-0 gap-4 xl:grid-cols-2">{items.filter(item => item.kind === 'unavailable').map(renderItem)}</div>
    {items.length === 0 && data.items.length > 0 && <p>Nenhum empréstimo neste filtro; o escopo confirmado e o histórico foram preservados.</p>}
    {data.items.length === 0 && <p>Nenhum empréstimo no escopo confirmado.</p>}
  </section>;
}
